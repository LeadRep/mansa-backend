import KnowledgeSource from "../../../models/KnowledgeSource";
import KnowledgeChunk from "../../../models/KnowledgeChunk";
import BotConfig from "../../../models/BotConfig";
import { generateEmbedding, cosineSimilarity } from "./embeddings";
import { aiConfigManager, getAIService } from "./aiConfig";
import logger from "../../../logger";

export interface RetrievedChunk {
  chunkId: string;
  sourceId: string;
  sourceTitle: string;
  sourceType: string;
  content: string;
  similarity: number;
}

export interface RAGQueryOptions {
  ownerType?: "admin" | "user";
  ownerId?: string | null;
  topK?: number;
  minSimilarity?: number;
}

export interface ChatHistoryMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/**
 * Retrieve top relevant chunks for a given question using hybrid semantic + keyword scoring.
 */
export async function retrieveRelevantChunks(
  query: string,
  options: RAGQueryOptions = {}
): Promise<RetrievedChunk[]> {
  const {
    ownerType = "admin",
    ownerId = null,
    topK = 5,
    minSimilarity = 0.25,
  } = options;

  const queryEmbedding = await generateEmbedding(query, "RETRIEVAL_QUERY");

  const whereSource: any = {
    isActive: true,
    ownerType,
  };
  if (ownerId) {
    whereSource.ownerId = ownerId;
  }

  // Load active sources and their chunks
  const chunks = await KnowledgeChunk.findAll({
    include: [
      {
        model: KnowledgeSource,
        as: "source",
        where: whereSource,
        attributes: ["id", "title", "type", "isActive", "ownerType", "ownerId"],
      },
    ],
  });

  if (!chunks || chunks.length === 0) {
    return [];
  }

  const queryKeywords = query
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const scored: RetrievedChunk[] = [];

  for (const chunk of chunks) {
    const chunkData = chunk.toJSON() as any;
    const source = chunkData.source;
    if (!source) continue;

    const embedding = chunkData.embedding;
    let similarity = 0;

    if (Array.isArray(embedding) && embedding.length > 0) {
      similarity = cosineSimilarity(queryEmbedding, embedding);
    }

    // Hybrid keyword bonus (0.0 to 0.2)
    const contentLower = chunkData.content.toLowerCase();
    let keywordHits = 0;
    for (const kw of queryKeywords) {
      if (contentLower.includes(kw)) {
        keywordHits++;
      }
    }
    const keywordBonus =
      queryKeywords.length > 0
        ? (keywordHits / queryKeywords.length) * 0.2
        : 0;

    const finalScore = similarity + keywordBonus;

    if (finalScore >= minSimilarity || keywordHits > 0) {
      scored.push({
        chunkId: chunkData.id,
        sourceId: source.id,
        sourceTitle: source.title,
        sourceType: source.type,
        content: chunkData.content,
        similarity: Math.min(1.0, Math.max(0.0, finalScore)),
      });
    }
  }

  // Sort descending by similarity score
  scored.sort((a, b) => b.similarity - a.similarity);

  return scored.slice(0, topK);
}

/**
 * Builds the system prompt and context for the LLM.
 */
export function buildRAGPrompt(
  query: string,
  retrievedChunks: RetrievedChunk[],
  history: ChatHistoryMessage[] = [],
  botConfig?: BotConfig | null
): string {
  const botName = botConfig?.botName || "LeadRep Assistant";

  let contextText = "";
  if (retrievedChunks.length > 0) {
    contextText = retrievedChunks
      .map(
        (c, idx) =>
          `[Source ${idx + 1}: ${c.sourceTitle}]\n${c.content.trim()}`
      )
      .join("\n\n---\n\n");
  } else {
    contextText = "No specific knowledge base documents matched this query.";
  }

  let conversationFormatted = "";
  if (history.length > 0) {
    conversationFormatted = history
      .slice(-6)
      .map(
        (m) =>
          `${m.role === "assistant" ? botName : "User"}: ${m.content.trim()}`
      )
      .join("\n");
  }

  return `
You are "${botName}", the helpful and professional AI representative for LeadRep.
Your primary objective is to assist website visitors and users by answering questions accurately based on the provided Knowledge Base context below.

=== KNOWLEDGE BASE CONTEXT ===
${contextText}
==============================

${
  conversationFormatted
    ? `=== RECENT CONVERSATION HISTORY ===\n${conversationFormatted}\n====================================\n`
    : ""
}

=== GUIDELINES ===
1. Answer the user's question clearly, concisely, and warmly.
2. Rely strictly on the information given in the KNOWLEDGE BASE CONTEXT. Do not invent pricing, features, guarantees, or contact information not supported by the context.
3. If the context does not contain enough information to answer completely, acknowledge it politely and suggest contacting the LeadRep team or trying another query.
4. Use clean Markdown formatting (bullet points, bold highlights, concise paragraphs) to make your response easy to read.
5. Keep your tone approachable, confident, and professional.

Current Visitor Question:
"${query}"

Response:
`.trim();
}

/**
 * Answer a query directly using RAG.
 */
export async function answerRAGQuery(
  query: string,
  options: RAGQueryOptions = {},
  history: ChatHistoryMessage[] = []
): Promise<{ answer: string; sources: RetrievedChunk[] }> {
  const retrievedChunks = await retrieveRelevantChunks(query, options);

  const botConfig = await BotConfig.findOne({
    where: {
      ownerType: options.ownerType || "admin",
      ...(options.ownerId ? { ownerId: options.ownerId } : {}),
      isActive: true,
    },
  });

  const prompt = buildRAGPrompt(query, retrievedChunks, history, botConfig);

  try {
    const aiService = await getAIService();
    const answer = await aiService.generateContent(prompt);
    return {
      answer: answer.trim(),
      sources: retrievedChunks,
    };
  } catch (err: any) {
    logger.error({ err: err.message }, "Error generating RAG answer");
    throw err;
  }
}
