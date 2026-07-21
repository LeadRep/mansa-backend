/**
 * Shared "chat with tools" agent for LeadRep AI.
 *
 * Runs a bounded tool-calling loop against Azure OpenAI. Each iteration:
 *   1. Send the current message history to the model.
 *   2. If it returns tool_calls, execute them locally (scoped to the user),
 *      append the results, loop.
 *   3. If it streams content, forward tokens to `emit`.
 *
 * The `emit` callback lets the caller pipe events into anything (SSE, WS,
 * a test buffer). See askAgent controller for the SSE wiring.
 */
import fetch from "node-fetch";
import logger from "../../../logger";
import { TOOL_MAP, openAiToolDefs, ToolContext } from "./agentTools";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_ENDPOINT = process.env.OPENAI_ENDPOINT || "";
const MAX_TOOL_ITERATIONS = 4;

export type AgentEvent =
  | { type: "status"; text: string }
  | { type: "tool_call"; name: string; args: any }
  | { type: "tool_result"; name: string; ok: boolean }
  | { type: "token"; text: string }
  | { type: "error"; message: string }
  | { type: "done" };

export type AgentEmit = (event: AgentEvent) => void;

export type AgentMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export const SYSTEM_PROMPT = `You are LeadRep, an in-app AI assistant for a B2B sales-intelligence platform.

Your job is to help the signed-in user reason about their own leads, deals, contacts and pipeline. Use the provided tools to look up the user's real data before answering — never invent lead names, scores, or counts. If a tool returns nothing, say so plainly.

Formatting:
- Keep answers short and scannable.
- Use bullet points or numbered lists when returning more than two items.
- Put each lead / deal / contact on its own line, name first, then title @ company, then score.
- If you reference a specific lead or deal, include its id in square brackets like [id: <uuid>] so the UI can deep-link to it.

Tone: warm, concise, useful. No fluff, no repeating the question back.`;

async function callOpenAI(messages: AgentMessage[], stream: boolean): Promise<any> {
  if (!OPENAI_API_KEY || !OPENAI_ENDPOINT) {
    throw new Error("OPENAI_API_KEY or OPENAI_ENDPOINT not configured");
  }

  const body = {
    messages,
    tools: openAiToolDefs,
    tool_choice: "auto",
    temperature: 0.4,
    top_p: 0.9,
    stream,
  };

  const r = await fetch(OPENAI_ENDPOINT, {
    method: "POST",
    headers: {
      "api-key": OPENAI_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`Azure OpenAI error (${r.status}): ${text.slice(0, 400)}`);
  }
  return r;
}

async function executeToolCall(
  call: ToolCall,
  ctx: ToolContext
): Promise<{ ok: boolean; result: any }> {
  const spec = TOOL_MAP[call.function.name];
  if (!spec) return { ok: false, result: { error: `unknown tool: ${call.function.name}` } };

  let args: any = {};
  try {
    args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
  } catch (e: any) {
    return { ok: false, result: { error: `invalid tool arguments: ${e.message}` } };
  }

  try {
    const result = await spec.run(args, ctx);
    return { ok: true, result };
  } catch (e: any) {
    logger.error({ err: e, tool: call.function.name }, "tool execution failed");
    return { ok: false, result: { error: e.message || "tool failed" } };
  }
}

/**
 * Parse a streaming response body from Azure and forward text deltas via `emit`.
 * Returns the full accumulated text.
 */
async function pipeStream(response: any, emit: AgentEmit): Promise<string> {
  const body = response.body;
  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";

  const handleLines = (chunk: string) => {
    buffer += chunk;
    let idx: number;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const raw = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!raw.startsWith("data:")) continue;
      const payload = raw.replace(/^data:\s?/, "");
      if (payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload);
        const delta: string = json.choices?.[0]?.delta?.content ?? "";
        if (delta) {
          fullText += delta;
          emit({ type: "token", text: delta });
        }
      } catch {
        /* ignore keep-alive / partial */
      }
    }
  };

  if (typeof body?.getReader === "function") {
    const reader = body.getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      handleLines(decoder.decode(value, { stream: true }));
    }
  } else {
    await new Promise<void>((resolve, reject) => {
      body.on("data", (buf: Buffer) => handleLines(decoder.decode(buf)));
      body.on("end", () => resolve());
      body.on("error", (err: Error) => reject(err));
    });
  }
  return fullText;
}

/**
 * Run the agent. Returns the final assistant text (already streamed via emit).
 */
export async function runAgent(opts: {
  ctx: ToolContext;
  messages: AgentMessage[];
  emit: AgentEmit;
}): Promise<string> {
  const { ctx, emit } = opts;
  const messages: AgentMessage[] = [...opts.messages];

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    // First pass is non-streamed so we can detect tool_calls cleanly.
    const nonStream = await callOpenAI(messages, false);
    const json: any = await nonStream.json();
    const choice = json.choices?.[0];
    const message = choice?.message;
    const toolCalls: ToolCall[] | undefined = message?.tool_calls;

    if (toolCalls && toolCalls.length) {
      // Push the assistant tool-call turn.
      messages.push({
        role: "assistant",
        content: message.content ?? null,
        tool_calls: toolCalls,
      });

      for (const call of toolCalls) {
        emit({ type: "tool_call", name: call.function.name, args: safeParse(call.function.arguments) });
        emit({ type: "status", text: statusFor(call.function.name) });
        const { ok, result } = await executeToolCall(call, ctx);
        emit({ type: "tool_result", name: call.function.name, ok });
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result).slice(0, 8000),
        });
      }
      continue;
    }

    // No tool calls — this is (or should become) the final answer.
    // Re-request with streaming so we can push tokens to the client.
    const streamResp = await callOpenAI(messages, true);
    const fullText = await pipeStream(streamResp, emit);
    if (fullText.trim().length === 0 && message?.content) {
      // Fallback: some models return the answer on the first non-stream pass.
      emit({ type: "token", text: message.content });
      return message.content;
    }
    return fullText;
  }

  const cap = "I couldn’t reach a final answer after a few tool calls — please rephrase or narrow the question.";
  emit({ type: "token", text: cap });
  return cap;
}

function safeParse(s: string): any {
  try {
    return s ? JSON.parse(s) : {};
  } catch {
    return {};
  }
}

function statusFor(name: string): string {
  switch (name) {
    case "list_leads":
    case "get_lead_by_id":
      return "Searching your leads…";
    case "count_leads":
      return "Counting your leads…";
    case "list_deals":
      return "Reading your pipeline…";
    case "list_deal_contacts":
      return "Looking at your deals…";
    case "list_contacts":
      return "Checking your contacts…";
    case "get_companies":
      return "Aggregating your companies…";
    case "aggregate_stats":
      return "Computing your stats…";
    default:
      return `Running ${name}…`;
  }
}
