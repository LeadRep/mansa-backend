
import axios from "axios";
import dotenv from "dotenv";
import logger from "../../../logger";

dotenv.config();

const apiKey = process.env.OPENAI_API_KEY;
const endpoint = process.env.OPENAI_ENDPOINT;

export const getAICompletion = async (prompt: string) => {
  if (!apiKey || !endpoint) {
    throw new Error("OpenAI API key or endpoint is not configured.");
  }

  const messages = [
    {
      role: "system",
      content: "You are an AI assistant that follows instructions precisely and returns data in the requested format.",
    },
    {
      role: "user",
      content: prompt,
    },
  ];

  const headers = {
    "Content-Type": "application/json",
    "api-key": apiKey,
  };

  const maxAttempts = 3;
  let attempt = 0;
  let lastErr: any = null;
  while (attempt < maxAttempts) {
    try {
      const aiResponse = await axios.post(
        `${endpoint}`,
        { messages, max_tokens: 2000, temperature: 0.0 },
        { headers }
      );

      let content = aiResponse.data?.choices?.[0]?.message?.content?.trim();

      if (content.startsWith("```json")) {
        content = content.substring(7, content.length - 3).trim();
      } else if (content.startsWith("```")) {
        content = content.substring(3, content.length - 3).trim();
      }

      return content;
    } catch (error: any) {
      lastErr = error;
      const status = error?.response?.status;
      const shouldRetry = status === 429 || status === 503;
      logger.error(error, "Error getting AI completion:");
      if (error.response) {
        logger.error(error.response.data, "Error response data:");
      }
      attempt += 1;
      if (!shouldRetry || attempt >= maxAttempts) break;
      const backoffMs = 1000 * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
  throw new Error("Failed to get completion from AI.");
};
