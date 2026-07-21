/**
 * POST /v1/ai/ask — the "Ask LeadRep" endpoint.
 *
 * Streams SSE frames with a small JSON envelope so the frontend can render
 * status chips ("Searching your leads…") alongside the streamed answer.
 *
 * Envelope: `data: {"type":"token","text":"…"}\n\n`
 *   Types: status | tool_call | tool_result | token | done | error
 */
import type { Response, RequestHandler } from "express";
import type { JwtPayload } from "jsonwebtoken";
import Users from "../../models/Users";
import { ChatSession } from "../../models/ChatSession";
import { ChatMessage } from "../../models/ChatMessage";
import { AgentEvent, AgentMessage, runAgent, SYSTEM_PROMPT } from "../../utils/services/ai/agent";
import logger from "../../logger";

const MAX_HISTORY_TURNS = 12;

type AskBody = {
  sessionId?: string;
  message: string;
  page?: string; // optional route context, e.g. "/leads"
};

export const askAgentStream: RequestHandler = async (
  req: JwtPayload,
  res: Response
): Promise<void> => {
  const userId = req.user?.id;

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const emit = (evt: AgentEvent) => {
    try {
      res.write(`data: ${JSON.stringify(evt)}\n\n`);
    } catch {
      /* client disconnected */
    }
  };

  const body = req.body as AskBody;
  const userText = body?.message?.trim();

  if (!userText) {
    emit({ type: "error", message: "message is required" });
    res.end();
    return;
  }

  try {
    // Session: reuse existing ChatSession model so history is unified with /ai/chat.
    let session: ChatSession | null = null;
    if (body.sessionId) {
      session = await ChatSession.findOne({
        where: { id: body.sessionId, userId },
      });
    }
    if (!session) {
      session = await ChatSession.create({
        userId,
        title: userText.length > 60 ? `${userText.slice(0, 60)}…` : userText,
      });
    }

    // Persist the user turn immediately.
    await ChatMessage.create({
      sessionId: session.id,
      userId,
      role: "user",
      content: userText,
    });

    // Load prior turns (only user/assistant — tool-call turns aren't persisted).
    const prior = await ChatMessage.findAll({
      where: { sessionId: session.id },
      order: [["createdAt", "ASC"]],
      limit: MAX_HISTORY_TURNS * 2,
    });

    // Light user context for the model.
    const user = await Users.findByPk(userId, {
      attributes: ["firstName", "lastName", "companyName", "country"],
    });
    const userLine = user
      ? `The signed-in user is ${user.get("firstName") || ""} ${user.get("lastName") || ""}`.trim() +
        (user.get("companyName") ? ` at ${user.get("companyName")}` : "") +
        (user.get("country") ? ` (${user.get("country")}).` : ".")
      : "";
    const pageLine = body.page ? `The user is currently on the "${body.page}" page.` : "";

    const messages: AgentMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(userLine || pageLine
        ? [{ role: "system" as const, content: [userLine, pageLine].filter(Boolean).join(" ") }]
        : []),
      ...prior.map(
        (m): AgentMessage => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        })
      ),
    ];

    // Announce the session id up front so the client can persist it.
    emit({ type: "status", text: `session:${session.id}` });

    const finalText = await runAgent({
      ctx: { userId },
      messages,
      emit,
    });

    if (finalText.trim().length) {
      await ChatMessage.create({
        sessionId: session.id,
        userId,
        role: "assistant",
        content: finalText,
      });
      await session.update({ updatedAt: new Date() });
    }

    emit({ type: "done" });
    res.end();
  } catch (err: any) {
    logger.error({ err }, "ask-agent stream failed");
    emit({
      type: "error",
      message: "Sorry — something went wrong. Please try again in a moment.",
    });
    emit({ type: "done" });
    res.end();
  }
};
