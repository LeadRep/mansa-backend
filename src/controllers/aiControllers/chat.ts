// controllers/chat.ts (Azure OpenAI, SSE streaming, friendlier tone, no CRM gate)
import type { Request, Response, RequestHandler } from "express";
import fetch from "node-fetch";
import * as crypto from "crypto";
import Redis from "ioredis";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const OPENAI_ENDPOINT = process.env.OPENAI_ENDPOINT!; // full Azure URL incl. api-version
const BING_API_KEY = process.env.BING_API_KEY || "";
const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;

type ModelRole = "system" | "user" | "assistant";
type Msg = { role: ModelRole; content: string };
const CHAT_TTL = 60 * 60 * 24;

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

async function getHistory(chatId: string): Promise<Msg[]> {
  if (!redis) return [];
  const raw = await redis.get(`chat:${chatId}`);
  return raw ? (JSON.parse(raw) as Msg[]) : [];
}
async function saveHistory(chatId: string, history: Msg[]) {
  if (!redis) return;
  await redis.set(`chat:${chatId}`, JSON.stringify(history), "EX", CHAT_TTL);
}

const SYSTEM_PROMPT = `
You are Mansa, a friendly, helpful AI assistant. Answer any question clearly and conversationally.
Style & Tone:
- Warm, encouraging, and concise. Use short paragraphs and bullets when helpful.
- Keep wording clean with proper spacing and punctuation.
Neutrality & Brands:
- Avoid naming external companies/brands unless the user explicitly mentions them first; then you may reference them neutrally.
Honesty:
- If you're unsure or lack tools/data, say so briefly and suggest the next best step.
Browsing:
- When browsing context is provided by the system, use it to improve accuracy but keep references generic (e.g., "a reputable source").
`;

export const chatStream: RequestHandler = async (
  req: Request,
  res: Response
): Promise<void> => {
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  try {
    const { chatId, messages } = req.body as {
      chatId: string;
      messages: { role: "user" | "ai"; content: string }[];
    };
    const id = chatId || crypto.randomUUID();
    const userText = messages[messages.length - 1]?.content || "";

    // Memory
    const history = await getHistory(id);

    // Optional browse (generic, anonymized)
    const browseBullets = await browseIfNeeded(userText);
    const browseMsg: Msg[] = browseBullets
      ? [
          {
            role: "system",
            content: `Context from recent public sources:\n${browseBullets}`,
          },
        ]
      : [];

    const finalMessages: Msg[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history,
      ...messages.map(
        (m): Msg => ({ role: asModelRole(m.role), content: m.content })
      ),
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
    const appended: Msg[] = [
      ...history,
      ...messages.map(
        (m): Msg => ({ role: asModelRole(m.role), content: m.content })
      ),
      { role: "assistant", content: fullText },
    ];
    await saveHistory(id, appended);

    res.end();
  } catch (err) {
    res.write(
      `data: Sorry—something went wrong on my end. Please try again in a moment.\n\n`
    );
    res.write(`data: [[END]]\n\n`);
    res.end();
  }
};
