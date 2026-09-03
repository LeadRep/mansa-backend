import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import BotConfig from "../../models/BotConfig";
import PublicChatSession from "../../models/PublicChatSession";
import PublicChatMessage from "../../models/PublicChatMessage";
import { UnresolvedQuestion } from "../../models/UnresolvedQuestion";
import { retrieveRelevantChunks, buildRAGPrompt } from "../../utils/services/ai/ragEngine";
import { getAIService } from "../../utils/services/ai/aiConfig";
import logger from "../../logger";

/**
 * GET /v1/ai/public-chat/config
 * Return the public bot configuration for landing page / widget
 */
export const getPublicBotConfig = async (_req: Request, res: Response): Promise<void> => {
  try {
    let config = await BotConfig.findOne({ where: { ownerType: "admin", isActive: true } });
    if (!config) {
      config = await BotConfig.create({
        ownerType: "admin",
        botName: "LeadRep Assistant",
        welcomeMessage:
          "Hi there! 👋 How can I help you learn about LeadRep today? Ask anything about our lead intelligence, features, or pricing.",
        placeholderText: "Ask anything about LeadRep...",
        themeColor: "#2563EB",
        suggestedQuestions: [
          "What is LeadRep?",
          "How does lead discovery work?",
          "What pricing plans are available?",
          "How can I book a demo?",
        ],
        leadCaptureEnabled: true,
        leadCaptureTitle: "Want our team to follow up with tailored insights?",
        isActive: true,
      });
    }

    res.json({
      success: true,
      botName: config.botName,
      welcomeMessage: config.welcomeMessage,
      placeholderText: config.placeholderText,
      themeColor: config.themeColor,
      avatarUrl: config.avatarUrl,
      suggestedQuestions: config.suggestedQuestions,
      leadCaptureEnabled: config.leadCaptureEnabled,
      leadCaptureTitle: config.leadCaptureTitle,
    });
  } catch (error: any) {
    logger.error({ error }, "Error fetching public bot config");
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /v1/ai/public-chat/stream
 * SSE streaming endpoint for website visitors
 */
export const streamPublicChat = async (req: Request, res: Response): Promise<void> => {
  const { message, visitorId, pageUrl, referrer } = req.body;

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  (res as any).flushHeaders?.();

  const emit = (data: any) => {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch {
      /* client disconnected */
    }
  };

  const userText = message?.trim();
  if (!userText) {
    emit({ type: "error", message: "Message is required." });
    res.end();
    return;
  }

  const clientVisitorId = visitorId || uuidv4();

  try {
    // 1. Session setup
    let session = await PublicChatSession.findOne({
      where: { visitorId: clientVisitorId },
      order: [["createdAt", "DESC"]],
    });

    if (!session) {
      session = await PublicChatSession.create({
        visitorId: clientVisitorId,
        pageUrl: pageUrl || null,
        referrer: referrer || null,
      });
    }

    emit({ type: "session", sessionId: session.id, visitorId: clientVisitorId });
    emit({ type: "status", text: "Searching knowledge base..." });

    // 2. Persist user message
    await PublicChatMessage.create({
      sessionId: session.id,
      role: "user",
      content: userText,
    });

    // 3. Load prior message history
    const priorMessages = await PublicChatMessage.findAll({
      where: { sessionId: session.id },
      order: [["createdAt", "ASC"]],
      limit: 10,
    });

    const history = priorMessages.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    }));

    // 4. RAG Retrieval
    const retrievedChunks = await retrieveRelevantChunks(userText, {
      ownerType: "admin",
      topK: 5,
    });

    const botConfig = await BotConfig.findOne({ where: { ownerType: "admin" } });

    // Emit sources info
    const sourceReferences = retrievedChunks.map((c) => ({
      title: c.sourceTitle,
      type: c.sourceType,
      similarity: Math.round(c.similarity * 100),
    }));
    emit({ type: "sources", sources: sourceReferences });

    // 5. Generate prompt & LLM completion
    const prompt = buildRAGPrompt(userText, retrievedChunks, history, botConfig);
    const aiService = await getAIService();

    emit({ type: "status", text: "Generating response..." });
    const fullAnswer = await aiService.generateContent(prompt);

    // Stream the answer in natural chunks/words for fluid UI animation
    const words = fullAnswer.split(" ");
    for (let i = 0; i < words.length; i++) {
      const token = (i === 0 ? "" : " ") + words[i];
      emit({ type: "token", text: token });
      // Small micro-delay for smooth streaming visual
      if (i % 3 === 0) {
        await new Promise((r) => setTimeout(r, 12));
      }
    }

    // 6. Persist assistant message
    await PublicChatMessage.create({
      sessionId: session.id,
      role: "assistant",
      content: fullAnswer,
      sources: sourceReferences,
    });

    // 7. Track Knowledge Gap / Unresolved Question if similarity is low or no chunks match
    const topSimilarity = retrievedChunks[0]?.similarity || 0;
    const isLowConfidence =
      retrievedChunks.length === 0 ||
      topSimilarity < 0.48 ||
      fullAnswer.toLowerCase().includes("not mentioned in our knowledge base") ||
      fullAnswer.toLowerCase().includes("contact our team for more details");

    if (isLowConfidence && userText.trim().length > 4) {
      (async () => {
        try {
          const normalized = userText.trim();
          const existingGap = await UnresolvedQuestion.findOne({
            where: {
              ownerType: "admin",
              question: normalized,
              status: "pending",
            },
          });

          if (existingGap) {
            await existingGap.update({
              frequency: existingGap.frequency + 1,
              lastAskedAt: new Date(),
              lastBotResponse: fullAnswer.slice(0, 1000),
              similarityScore: topSimilarity,
            });
          } else {
            await UnresolvedQuestion.create({
              ownerType: "admin",
              question: normalized,
              frequency: 1,
              status: "pending",
              lastAskedAt: new Date(),
              lastBotResponse: fullAnswer.slice(0, 1000),
              similarityScore: topSimilarity,
              visitorId: clientVisitorId,
            });
          }
        } catch (gapErr) {
          logger.warn({ gapErr }, "Error logging unresolved question gap");
        }
      })();
    }

    emit({ type: "done" });
    res.end();
  } catch (error: any) {
    logger.error({ error }, "Error streaming public chat response");
    emit({
      type: "error",
      message: "I'm having a little trouble retrieving that right now. Please try again shortly.",
    });
    emit({ type: "done" });
    res.end();
  }
};

/**
 * POST /v1/ai/public-chat/lead-capture
 * Capture visitor contact information
 */
export const captureLead = async (req: Request, res: Response): Promise<void> => {
  try {
    const { visitorId, sessionId, name, email, company, phone } = req.body;

    if (!email || !email.trim()) {
      res.status(400).json({ success: false, message: "Email is required." });
      return;
    }

    let session: PublicChatSession | null = null;
    if (sessionId) {
      session = await PublicChatSession.findByPk(sessionId);
    } else if (visitorId) {
      session = await PublicChatSession.findOne({
        where: { visitorId },
        order: [["createdAt", "DESC"]],
      });
    }

    if (session) {
      await session.update({
        visitorName: name?.trim() || session.visitorName,
        visitorEmail: email.trim(),
        visitorCompany: company?.trim() || session.visitorCompany,
        visitorPhone: phone?.trim() || session.visitorPhone,
      });
    } else if (visitorId) {
      session = await PublicChatSession.create({
        visitorId,
        visitorName: name?.trim(),
        visitorEmail: email.trim(),
        visitorCompany: company?.trim(),
        visitorPhone: phone?.trim(),
      });
    }

    res.json({
      success: true,
      message: "Thank you! Our team has received your information and will be in touch.",
    });
  } catch (error: any) {
    logger.error({ error }, "Error capturing visitor lead");
    res.status(500).json({ success: false, message: error.message });
  }
};
