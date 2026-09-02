import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import KnowledgeSource from "../../models/KnowledgeSource";
import KnowledgeChunk from "../../models/KnowledgeChunk";
import BotConfig from "../../models/BotConfig";
import PublicChatSession from "../../models/PublicChatSession";
import PublicChatMessage from "../../models/PublicChatMessage";
import { parseDocumentFile, cleanText } from "../../utils/services/ai/documentParser";
import { chunkText } from "../../utils/services/ai/chunking";
import { generateBatchEmbeddings } from "../../utils/services/ai/embeddings";
import { answerRAGQuery, retrieveRelevantChunks } from "../../utils/services/ai/ragEngine";
import logger from "../../logger";

/**
 * List all knowledge sources + aggregate summary metrics
 */
export const listKnowledgeSources = async (_req: Request, res: Response): Promise<void> => {
  try {
    const sources = await KnowledgeSource.findAll({
      where: { ownerType: "admin" },
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: KnowledgeChunk,
          as: "chunks",
          attributes: ["id", "chunkIndex", "tokenCount"],
        },
      ],
    });

    const totalSources = sources.length;
    let totalChunks = 0;
    let totalTokens = 0;
    let readySources = 0;

    sources.forEach((s) => {
      totalChunks += s.chunkCount || 0;
      totalTokens += s.tokenCount || 0;
      if (s.status === "ready") readySources++;
    });

    res.json({
      success: true,
      stats: {
        totalSources,
        readySources,
        totalChunks,
        totalTokens,
      },
      sources,
    });
  } catch (error: any) {
    logger.error({ error }, "Error listing knowledge sources");
    res.status(500).json({ success: false, message: error.message || "Failed to list knowledge sources" });
  }
};

/**
 * Upload a document (PDF, TXT, MD, CSV, JSON) and index it
 */
export const uploadDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, message: "No file was uploaded." });
      return;
    }

    const title = req.body.title?.trim() || file.originalname;

    // Create initial processing record
    const source = await KnowledgeSource.create({
      ownerType: "admin",
      title,
      type: "document",
      filePath: file.path,
      fileType: file.mimetype || path.extname(file.originalname),
      fileSize: file.size,
      status: "processing",
      chunkCount: 0,
      tokenCount: 0,
      isActive: true,
      metadata: { originalFilename: file.originalname },
    });

    try {
      // 1. Parse document text
      const extracted = await parseDocumentFile(file.path, file.originalname, file.mimetype);
      
      // 2. Chunk text
      const chunks = chunkText(extracted.text, { chunkSize: 800, chunkOverlap: 150 });
      if (chunks.length === 0) {
        throw new Error("Extracted text was empty after processing.");
      }

      // 3. Generate embeddings
      const chunkTexts = chunks.map((c) => c.content);
      const embeddings = await generateBatchEmbeddings(chunkTexts);

      // 4. Save chunks
      let totalTokens = 0;
      const chunkRecords = chunks.map((c, i) => {
        totalTokens += c.tokenCount;
        return {
          sourceId: source.id,
          chunkIndex: c.chunkIndex,
          content: c.content,
          tokenCount: c.tokenCount,
          embedding: embeddings[i] || [],
          metadata: { sourceTitle: title },
        };
      });

      await KnowledgeChunk.bulkCreate(chunkRecords);

      // 5. Update source record
      await source.update({
        content: extracted.text.slice(0, 50000), // Preview sample
        chunkCount: chunks.length,
        tokenCount: totalTokens,
        status: "ready",
      });

      res.status(201).json({
        success: true,
        message: "Document uploaded and indexed successfully.",
        source,
      });
    } catch (processError: any) {
      logger.error({ processError }, "Error processing uploaded document");
      await source.update({
        status: "error",
        errorMessage: processError.message || "Failed to process document",
      });
      res.status(500).json({
        success: false,
        message: processError.message || "Failed to parse and index document",
        sourceId: source.id,
      });
    }
  } catch (error: any) {
    logger.error({ error }, "Error handling document upload");
    res.status(500).json({ success: false, message: error.message || "Upload failed" });
  }
};

/**
 * Add manual text or FAQ entry
 */
export const createTextSource = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, content, type = "text" } = req.body;

    if (!title || !content || !content.trim()) {
      res.status(400).json({ success: false, message: "Title and content are required." });
      return;
    }

    const cleanContent = cleanText(content);

    const source = await KnowledgeSource.create({
      ownerType: "admin",
      title: title.trim(),
      type: type === "faq" ? "faq" : "text",
      content: cleanContent,
      fileSize: Buffer.byteLength(cleanContent, "utf8"),
      status: "processing",
      chunkCount: 0,
      tokenCount: 0,
      isActive: true,
    });

    try {
      const chunks = chunkText(cleanContent, { chunkSize: 700, chunkOverlap: 100 });
      const chunkTexts = chunks.map((c) => c.content);
      const embeddings = await generateBatchEmbeddings(chunkTexts);

      let totalTokens = 0;
      const chunkRecords = chunks.map((c, i) => {
        totalTokens += c.tokenCount;
        return {
          sourceId: source.id,
          chunkIndex: c.chunkIndex,
          content: c.content,
          tokenCount: c.tokenCount,
          embedding: embeddings[i] || [],
          metadata: { sourceTitle: title },
        };
      });

      await KnowledgeChunk.bulkCreate(chunkRecords);

      await source.update({
        chunkCount: chunks.length,
        tokenCount: totalTokens,
        status: "ready",
      });

      res.status(201).json({
        success: true,
        message: "Knowledge entry created and indexed successfully.",
        source,
      });
    } catch (procErr: any) {
      await source.update({
        status: "error",
        errorMessage: procErr.message,
      });
      res.status(500).json({ success: false, message: procErr.message });
    }
  } catch (error: any) {
    logger.error({ error }, "Error creating text knowledge source");
    res.status(500).json({ success: false, message: error.message || "Failed to create knowledge entry" });
  }
};

/**
 * Toggle source active status
 */
export const toggleKnowledgeSource = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const source = await KnowledgeSource.findByPk(id);
    if (!source) {
      res.status(404).json({ success: false, message: "Knowledge source not found." });
      return;
    }

    await source.update({ isActive: !source.isActive });
    res.json({ success: true, isActive: source.isActive });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Delete a knowledge source and associated chunks
 */
export const deleteKnowledgeSource = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const source = await KnowledgeSource.findByPk(id);
    if (!source) {
      res.status(404).json({ success: false, message: "Knowledge source not found." });
      return;
    }

    // If file on disk, try to remove
    if (source.filePath && fs.existsSync(source.filePath)) {
      try {
        fs.unlinkSync(source.filePath);
      } catch (e) {
        logger.warn("Could not delete file from disk");
      }
    }

    await KnowledgeChunk.destroy({ where: { sourceId: id } });
    await source.destroy();

    res.json({ success: true, message: "Knowledge source deleted successfully." });
  } catch (error: any) {
    logger.error({ error }, "Error deleting knowledge source");
    res.status(500).json({ success: false, message: error.message || "Failed to delete knowledge source" });
  }
};

/**
 * Re-index an existing source
 */
export const reindexKnowledgeSource = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const source = await KnowledgeSource.findByPk(id);
    if (!source) {
      res.status(404).json({ success: false, message: "Knowledge source not found." });
      return;
    }

    await source.update({ status: "processing", errorMessage: null });

    let rawText = source.content || "";
    if (source.type === "document" && source.filePath && fs.existsSync(source.filePath)) {
      const extracted = await parseDocumentFile(source.filePath, source.title, source.fileType || "");
      rawText = extracted.text;
    }

    if (!rawText.trim()) {
      await source.update({ status: "error", errorMessage: "No readable content found to index." });
      res.status(400).json({ success: false, message: "No readable content to index." });
      return;
    }

    // Delete old chunks
    await KnowledgeChunk.destroy({ where: { sourceId: id } });

    // Chunk and generate embeddings
    const chunks = chunkText(rawText);
    const chunkTexts = chunks.map((c) => c.content);
    const embeddings = await generateBatchEmbeddings(chunkTexts);

    let totalTokens = 0;
    const chunkRecords = chunks.map((c, i) => {
      totalTokens += c.tokenCount;
      return {
        sourceId: source.id,
        chunkIndex: c.chunkIndex,
        content: c.content,
        tokenCount: c.tokenCount,
        embedding: embeddings[i] || [],
        metadata: { sourceTitle: source.title },
      };
    });

    await KnowledgeChunk.bulkCreate(chunkRecords);

    await source.update({
      chunkCount: chunks.length,
      tokenCount: totalTokens,
      status: "ready",
      content: rawText.slice(0, 50000),
    });

    res.json({ success: true, message: "Knowledge source re-indexed successfully.", source });
  } catch (error: any) {
    logger.error({ error }, "Error re-indexing knowledge source");
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get bot configuration
 */
export const getBotConfig = async (_req: Request, res: Response): Promise<void> => {
  try {
    let config = await BotConfig.findOne({ where: { ownerType: "admin" } });
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
        allowedDomains: ["*"],
      });
    }

    res.json({ success: true, config });
  } catch (error: any) {
    logger.error({ error }, "Error getting bot config");
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update bot configuration
 */
export const updateBotConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      botName,
      welcomeMessage,
      placeholderText,
      themeColor,
      avatarUrl,
      suggestedQuestions,
      leadCaptureEnabled,
      leadCaptureTitle,
      isActive,
      allowedDomains,
    } = req.body;

    let config = await BotConfig.findOne({ where: { ownerType: "admin" } });
    if (!config) {
      config = await BotConfig.create({
        ownerType: "admin",
        botName: botName || "LeadRep Assistant",
        welcomeMessage: welcomeMessage || "Hi there! 👋 How can I help you today?",
        placeholderText: placeholderText || "Ask anything about LeadRep...",
        themeColor: themeColor || "#2563EB",
        avatarUrl,
        suggestedQuestions: suggestedQuestions || [],
        leadCaptureEnabled: leadCaptureEnabled ?? true,
        leadCaptureTitle: leadCaptureTitle || "Want our team to follow up with tailored insights?",
        isActive: isActive ?? true,
        allowedDomains: allowedDomains || ["*"],
      });
    } else {
      await config.update({
        botName: botName ?? config.botName,
        welcomeMessage: welcomeMessage ?? config.welcomeMessage,
        placeholderText: placeholderText ?? config.placeholderText,
        themeColor: themeColor ?? config.themeColor,
        avatarUrl: avatarUrl !== undefined ? avatarUrl : config.avatarUrl,
        suggestedQuestions: suggestedQuestions ?? config.suggestedQuestions,
        leadCaptureEnabled: leadCaptureEnabled ?? config.leadCaptureEnabled,
        leadCaptureTitle: leadCaptureTitle ?? config.leadCaptureTitle,
        isActive: isActive ?? config.isActive,
        allowedDomains: allowedDomains ?? config.allowedDomains,
      });
    }

    res.json({ success: true, message: "Bot configuration updated successfully.", config });
  } catch (error: any) {
    logger.error({ error }, "Error updating bot config");
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Admin Playground: Test RAG search and answer generation
 */
export const testRAGQuery = async (req: Request, res: Response): Promise<void> => {
  try {
    const { query } = req.body;
    if (!query || !query.trim()) {
      res.status(400).json({ success: false, message: "Query string is required." });
      return;
    }

    const retrievedChunks = await retrieveRelevantChunks(query.trim(), {
      ownerType: "admin",
      topK: 5,
    });

    const result = await answerRAGQuery(query.trim(), { ownerType: "admin" });

    res.json({
      success: true,
      query,
      answer: result.answer,
      retrievedChunks,
    });
  } catch (error: any) {
    logger.error({ error }, "Error executing test RAG query");
    res.status(500).json({ success: false, message: error.message || "Failed to generate test answer." });
  }
};

/**
 * Get visitor conversations / analytics
 */
export const getVisitorConversations = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 30;
    const page = parseInt(req.query.page as string) || 1;
    const offset = (page - 1) * limit;

    const { count, rows: sessions } = await PublicChatSession.findAndCountAll({
      order: [["createdAt", "DESC"]],
      limit,
      offset,
      include: [
        {
          model: PublicChatMessage,
          as: "messages",
          order: [["createdAt", "ASC"]],
        },
      ],
    });

    res.json({
      success: true,
      total: count,
      page,
      totalPages: Math.ceil(count / limit),
      sessions,
    });
  } catch (error: any) {
    logger.error({ error }, "Error fetching visitor conversations");
    res.status(500).json({ success: false, message: error.message });
  }
};
