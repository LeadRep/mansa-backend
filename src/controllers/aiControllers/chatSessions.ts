import { Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import sendResponse from "../../utils/http/sendResponse";
import { ChatSession } from "../../models/ChatSession";
import { ChatMessage } from "../../models/ChatMessage";

const buildSessionPreview = async (session: ChatSession) => {
  const lastMessage = await ChatMessage.findOne({
    where: { sessionId: session.id },
    order: [["createdAt", "DESC"]],
  });

  return {
    id: session.id,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    lastMessage: lastMessage?.content ?? null,
  };
};

export const listChatSessions = async (req: JwtPayload, res: Response) => {
  try {
    const userId = req.user.id;
    const sessions = await ChatSession.findAll({
      where: { userId },
      order: [["updatedAt", "DESC"]],
    });

    const data = await Promise.all(sessions.map(buildSessionPreview));

    sendResponse(res, 200, "Chat sessions fetched successfully", data);
  } catch (error: any) {
    sendResponse(res, 500, "Failed to fetch chat sessions", null, error.message);
  }
};

export const createChatSession = async (req: JwtPayload, res: Response) => {
  try {
    const userId = req.user.id;
    const { title } = req.body as { title?: string };

    const session = await ChatSession.create({
      userId,
      title: title?.trim() || "New Chat",
    });

    sendResponse(res, 201, "Chat session created successfully", {
      id: session.id,
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      lastMessage: null,
    });
  } catch (error: any) {
    sendResponse(res, 500, "Failed to create chat session", null, error.message);
  }
};

export const getChatSession = async (req: JwtPayload, res: Response) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;

    const session = await ChatSession.findOne({
      where: { id: sessionId, userId },
    });

    if (!session) {
      sendResponse(res, 404, "Chat session not found");
      return;
    }

    const messages = await ChatMessage.findAll({
      where: { sessionId: session.id },
      order: [["createdAt", "ASC"]],
    });

    sendResponse(res, 200, "Chat session fetched successfully", {
      id: session.id,
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
    });
  } catch (error: any) {
    sendResponse(res, 500, "Failed to fetch chat session", null, error.message);
  }
};

export const deleteChatSession = async (req: JwtPayload, res: Response) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;

    const session = await ChatSession.findOne({
      where: { id: sessionId, userId },
    });

    if (!session) {
      sendResponse(res, 404, "Chat session not found");
      return;
    }

    await ChatMessage.destroy({ where: { sessionId: session.id } });
    await session.destroy();

    sendResponse(res, 200, "Chat session deleted successfully");
  } catch (error: any) {
    sendResponse(res, 500, "Failed to delete chat session", null, error.message);
  }
};

