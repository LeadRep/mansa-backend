import axios from "axios";
import { GoogleAuth } from "google-auth-library";
import logger from "../../../logger";
import { aiConfigManager } from "./aiConfig";

let googleAuthInstance: GoogleAuth | null = null;
let googleAccessToken: string = "";
let googleTokenExpiry: number = 0;

async function getGoogleAccessToken(): Promise<string> {
  if (googleAccessToken && Date.now() < googleTokenExpiry - 5 * 60 * 1000) {
    return googleAccessToken;
  }

  if (!googleAuthInstance) {
    googleAuthInstance = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
  }

  const client = await googleAuthInstance.getClient();
  const tokenRes = await client.getAccessToken();
  if (!tokenRes.token) {
    throw new Error("Could not acquire Google Cloud access token for embeddings.");
  }

  googleAccessToken = tokenRes.token;
  googleTokenExpiry = Date.now() + 55 * 60 * 1000;
  return googleAccessToken;
}

/**
 * Generate a single embedding vector for a given text snippet.
 */
export async function generateEmbedding(
  text: string,
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY" = "RETRIEVAL_DOCUMENT"
): Promise<number[]> {
  const clean = text.trim();
  if (!clean) return [];

  const provider = aiConfigManager.getProvider();

  if (provider === "vertexai") {
    try {
      const apiKey =
        process.env.VERTEX_API_KEY ||
        process.env.GEMINI_API_KEY ||
        process.env.GOOGLE_API_KEY;

      // If API key is provided, use Google Generative AI embeddings endpoint
      if (apiKey) {
        const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`;
        const res = await axios.post(
          geminiEndpoint,
          {
            content: {
              parts: [{ text: clean.slice(0, 8000) }],
            },
          },
          {
            headers: { "Content-Type": "application/json" },
            timeout: 15000,
          }
        );

        const values = res.data?.embedding?.values;
        if (Array.isArray(values) && values.length > 0) {
          return values;
        }
      }

      // Otherwise, use OAuth 2.0 ADC token endpoint
      const vertexConfig = aiConfigManager.getVertexAIConfig();
      const projectId = vertexConfig?.projectId || "ornate-casing-444308-t1";
      const location = vertexConfig?.location || "us-central1";
      const token = await getGoogleAccessToken();

      const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/text-embedding-004:predict`;

      const res = await axios.post(
        endpoint,
        {
          instances: [
            {
              content: clean.slice(0, 8000),
              task_type: taskType,
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          timeout: 15000,
        }
      );

      const values = res.data?.predictions?.[0]?.embeddings?.values;
      if (Array.isArray(values) && values.length > 0) {
        return values;
      }
    } catch (err: any) {
      logger.warn(
        { err: err.message },
        "Vertex AI / Gemini embeddings failed, falling back to local term vector"
      );
    }
  } else {
    // OpenAI or Azure OpenAI
    const openAIConfig = aiConfigManager.getOpenAIConfig();
    const apiKey = openAIConfig?.apiKey || process.env.OPENAI_API_KEY;
    const endpoint =
      process.env.OPENAI_EMBEDDINGS_ENDPOINT ||
      "https://api.openai.com/v1/embeddings";

    if (apiKey) {
      try {
        const res = await axios.post(
          endpoint,
          {
            input: clean.slice(0, 8000),
            model: "text-embedding-3-small",
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "api-key": apiKey,
              "Content-Type": "application/json",
            },
            timeout: 15000,
          }
        );

        const values = res.data?.data?.[0]?.embedding;
        if (Array.isArray(values) && values.length > 0) {
          return values;
        }
      } catch (err: any) {
        logger.warn(
          { err: err.message },
          "OpenAI embeddings failed, falling back to local term vector"
        );
      }
    }
  }

  // Graceful deterministic hash/frequency term vector fallback
  return generateDeterministicVector(clean);
}

/**
 * Batch generate embeddings for multiple chunks.
 */
export async function generateBatchEmbeddings(
  texts: string[]
): Promise<number[][]> {
  const results: number[][] = [];
  for (const text of texts) {
    const vec = await generateEmbedding(text, "RETRIEVAL_DOCUMENT");
    results.push(vec);
  }
  return results;
}

/**
 * Calculates cosine similarity between two numeric vectors.
 * Returns value between -1 and 1 (1 = identical).
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;

  // If dimensionality differs (e.g. fallback vector vs api vector), truncate to min length
  const len = Math.min(vecA.length, vecB.length);
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < len; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Deterministic bag-of-words / hash projection vector fallback (128-dim)
 */
function generateDeterministicVector(text: string, dimensions = 128): number[] {
  const vec = new Array(dimensions).fill(0);
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);

  for (const word of words) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = (hash << 5) - hash + word.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % dimensions;
    vec[idx] += 1;
  }

  // Normalize
  const norm = Math.sqrt(vec.reduce((acc, val) => acc + val * val, 0));
  if (norm > 0) {
    for (let i = 0; i < dimensions; i++) {
      vec[i] = vec[i] / norm;
    }
  }

  return vec;
}
