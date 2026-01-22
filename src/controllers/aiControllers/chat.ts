// controllers/chat.ts (Azure OpenAI, SSE streaming, friendlier tone, no CRM gate)
import type { Response, RequestHandler } from "express";
import fetch from "node-fetch";
import Users from "../../models/Users";
import { Leads } from "../../models/Leads";
import { CustomerPref } from "../../models/CustomerPref";
import { JwtPayload } from "jsonwebtoken";
import { ChatSession } from "../../models/ChatSession";
import {
  ChatMessage,
  ChatMessageRole,
} from "../../models/ChatMessage";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const OPENAI_ENDPOINT = process.env.OPENAI_ENDPOINT!; // full Azure URL incl. api-version
const BING_API_KEY = process.env.BING_API_KEY || "";

type ModelRole = "system" | "user" | "assistant";
type Msg = { role: ModelRole; content: string };

function asModelRole(role: "user" | "ai"): ModelRole {
  return role === "ai" ? "assistant" : "user";
}

// Optional, generic browse helper (kept brand-agnostic in what we pass to the model)
async function browseIfNeeded(userText: string): Promise<string> {
  if (!BING_API_KEY) return "";
  if (
    !/(latest|news|benchmark|compare|vs\.|statistics|market|pricing|docs?)/i.test(
      userText
    )
  )
    return "";

  const q = userText; // keep broad
  const url = `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(
    q
  )}&count=5&mkt=en-US`;
  try {
    const r = await fetch(url, {
      headers: { "Ocp-Apim-Subscription-Key": BING_API_KEY },
    });
    const data: any = await r.json();
    const items = data.webPages?.value?.slice(0, 3) ?? [];
    // anonymize sources so the model doesn’t output specific brand names unless user gives them
    return items
      .map((it: any, i: number) => `• Reference ${i + 1}: ${it.snippet}`)
      .join("\n");
  } catch {
    return "";
  }
}

// --- put near the top of chat.ts ---
// hide anything sensitive you never want to leak
function redact<T extends Record<string, any>>(o: T): T {
  const clone = JSON.parse(JSON.stringify(o));
  const secretKeys = [
    "password",
    "token",
    "apiKey",
    "api_key",
    "secret",
    "refreshToken",
  ];
  const stack: any[] = [clone];
  while (stack.length) {
    const cur = stack.pop();
    if (cur && typeof cur === "object") {
      for (const k of Object.keys(cur)) {
        if (secretKeys.includes(k)) cur[k] = "[REDACTED]";
        else if (typeof cur[k] === "object") stack.push(cur[k]);
      }
    }
  }
  return clone;
}

// quick chunker by characters (tokens ≈ chars/3; this is fine for a simple approach)
function chunkString(str: string, size = 6000): string[] {
  const out: string[] = [];
  for (let i = 0; i < str.length; i += size) out.push(str.slice(i, i + size));
  return out;
}

const SYSTEM_PROMPT = `
You are LeadRep, a friendly helpful AI. 
Always format responses cleanly:
- Use bullet points or numbered lists for multiple items.
- Put each lead/contact/deal on its own line.
- Add proper spacing and punctuation.
- Keep tone conversational and helpful.
Always format multi-item results as a short ordered or unordered list with each item on its own line.

`;

async function getSessionWithMessages(
  sessionId: string,
  userId: string
) {
  const session = await ChatSession.findOne({
    where: { id: sessionId, userId },
  });
  if (!session) {
    return { session: null, messages: [] };
  }
  const messages = await ChatMessage.findAll({
    where: { sessionId },
    order: [["createdAt", "ASC"]],
  });
  return { session, messages };
}

async function createMessage(
  sessionId: string,
  userId: string,
  role: ChatMessageRole,
  content: string
) {
  return ChatMessage.create({ sessionId, userId, role, content });
}

export const chatStream: RequestHandler = async (
  req: JwtPayload,
  res: Response
): Promise<void> => {
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  const userId = req.user.id;
  try {
    const [
      userRecord,
      leadsRecords,
      customerPreferenceRecord,
      leadsTotal,
    ] =
      await Promise.all([
        Users.findByPk(userId, {
          attributes: [
            "id",
            "firstName",
            "lastName",
            "email",
            "role",
            "companyName",
            "country",
          ],
        }),
        Leads.findAll({
          where: { owner_id: userId },
          attributes: [
            "id",
            "full_name",
            "title",
            "email",
            "phone",
            "organization",
            "country",
            "score",
            "category",
            "reason",
            "createdAt",
            "updatedAt",
          ],
          order: [["updatedAt", "DESC"]],
          limit: 25,
        }),
        CustomerPref.findOne({
          where: { userId },
          attributes: [
            "ICP",
            "BP",
            "territories",
            "leadsGenerationStatus",
            "refreshLeads",
            "nextRefresh",
          ],
        }),
        Leads.count({ where: { owner_id: userId } }),
      ]);

    const user = userRecord ? userRecord.toJSON() : null;
    const leads = leadsRecords.map((lead) => {
      const json = lead.toJSON() as any;
      return {
        id: json.id,
        name: json.full_name,
        title: json.title,
        email: json.email,
        phone: json.phone,
        company:
          typeof json.organization === "object"
            ? json.organization?.name ||
              json.organization?.company ||
              json.organization?.legal_name ||
              null
            : null,
        country: json.country,
        score: json.score,
        category: json.category,
        reason: json.reason,
        createdAt: json.createdAt,
      };
    });
    const customerPreference = customerPreferenceRecord
      ? customerPreferenceRecord.toJSON()
      : null;
    const dbBundle = {
      user: user ?? null,
      leads: leads ?? null,
      leads_total: leadsTotal,
      customerPreference: customerPreference ?? null,
      // add anything else you fetched for this user/chat
      // pipelines, settings, preferences, past reports, etc.
    };
    const safeDb = redact(dbBundle);
    const dbJson = JSON.stringify(safeDb, null, 2);
    const dbChunks = chunkString(dbJson, 6000);
    const { chatId, message, messages } = req.body as {
      chatId?: string;
      message?: string;
      messages?: { role: "user" | "ai"; content: string }[];
    };

    if (!chatId) {
      throw new Error("chatId is required");
    }

    const { session, messages: persistedMessages } = await getSessionWithMessages(
      chatId,
      userId
    );

    if (!session) {
      throw new Error("Chat session not found");
    }

    const latestUserText =
      typeof message === "string" && message.trim().length
        ? message.trim()
        : messages?.[messages.length - 1]?.content?.trim() ?? "";

    if (!latestUserText) {
      throw new Error("Message text is required");
    }

    // Persist user message immediately
    const userMsgRecord = await createMessage(
      chatId,
      userId,
      "user",
      latestUserText
    );

    const history: Msg[] = persistedMessages
      .concat([userMsgRecord])
      .map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      }));

    if (
      (!session.title || session.title === "New Chat") &&
      latestUserText.length
    ) {
      const newTitle =
        latestUserText.length > 60
          ? `${latestUserText.slice(0, 60)}…`
          : latestUserText;
      await session.update({ title: newTitle });
    }

    // Optional browse (generic, anonymized)
    const browseBullets = await browseIfNeeded(latestUserText);
    const browseMsg: Msg[] = browseBullets
      ? [
          {
            role: "system",
            content: `Context from recent public sources:\n${browseBullets}`,
          },
        ]
      : [];
    const dbContextMessages = dbChunks.map((c, i) => ({
      role: "system" as const,
      content: `Here is the authenticated user's CRM data from the database (chunk ${
        i + 1
      }/${dbChunks.length}). 
      Use this data to answer any relevant questions about the user, their organization, leads, contacts, deals, or preferences. 
      If asked "what is my name?", check the 'user' object. 
      If asked "how many leads do I have?", check 'crm.leads_total'. 
      Only use this data when relevant.
      
      ${c}`,
    }));

    const finalMessages: Msg[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...dbContextMessages,
      ...history,
      ...browseMsg,
    ];

    // Azure OpenAI streaming
    const r = await fetch(OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        "api-key": OPENAI_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: finalMessages,
        temperature: 0.6, // friendlier, less strict
        top_p: 0.9,
        stream: true,
      }),
    });

    if (!r.ok || !r.body) {
      const errText = await r.text().catch(() => "Unknown error");
      throw new Error(`Azure OpenAI error: ${errText}`);
    }

    // Read stream (works in Node or Web reader)
    const body = r.body as unknown as ReadableStream<Uint8Array>;
    const useWebReader = typeof (body as any)?.getReader === "function";

    let fullText = "";

    if (useWebReader) {
      const reader = (
        body as any
      ).getReader() as ReadableStreamDefaultReader<Uint8Array>;
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter((l) => l.startsWith("data:"));
        for (const l of lines) {
          const payload = l.replace(/^data:\s?/, "");
          if (payload === "[DONE]") {
            res.write(`data: [[END]]\n\n`);
            break;
          }
          try {
            const json = JSON.parse(payload);
            const delta: string = json.choices?.[0]?.delta?.content ?? "";
            if (delta) {
              fullText += delta;
              res.write(`data: ${delta}\n\n`);
            }
          } catch {
            /* ignore */
          }
        }
      }
    } else {
      const decoder = new TextDecoder();
      await new Promise<void>((resolve) => {
        (r.body as any)
          .on("data", (buf: Buffer) => {
            const chunk = decoder.decode(buf);
            const lines = chunk
              .split("\n")
              .filter((l) => l.startsWith("data:"));
            for (const l of lines) {
              const payload = l.replace(/^data:\s?/, "");
              if (payload === "[DONE]") {
                res.write(`data: [[END]]\n\n`);
                return;
              }
              try {
                const json = JSON.parse(payload);
                const delta: string = json.choices?.[0]?.delta?.content ?? "";
                if (delta) {
                  fullText += delta;
                  res.write(`data: ${delta}\n\n`);
                }
              } catch {
                /* ignore */
              }
            }
          })
          .on("end", () => resolve());
      });
    }

    // Save memory (assistant reply appended)
    if (fullText.trim().length) {
      await createMessage(chatId, userId, "assistant", fullText);
      await session.update({ updatedAt: new Date() });
    }

    res.end();
  } catch (err) {
    res.write(
      `data: Sorry—something went wrong on my end. Please try again in a moment.\n\n`
    );
    res.write(`data: [[END]]\n\n`);
    res.end();
  }
};
