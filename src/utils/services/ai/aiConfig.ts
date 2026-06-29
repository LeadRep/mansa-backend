import dotenv from "dotenv";
import logger from "../../../logger";

dotenv.config();

type AIProvider = "openai" | "vertexai";

interface AIServiceConfig {
  provider: AIProvider;
  openai?: {
    apiKey: string;
    endpoint: string;
  };
  vertexai?: {
    projectId: string;
    location: string;
    model: string;
    maxTokens: number;
    temperature: number;
  };
}

class AIConfigManager {
  private config: AIServiceConfig;
  private provider: AIProvider;

  constructor() {
    this.provider = (process.env.AI_PROVIDER || "openai") as AIProvider;

    this.config = {
      provider: this.provider,
      openai: {
        apiKey: process.env.OPENAI_API_KEY || "",
        endpoint: process.env.OPENAI_ENDPOINT || "",
      },
      vertexai: {
        projectId:
          process.env.GCP_PROJECT_ID ||
          process.env.GOOGLE_CLOUD_PROJECT ||
          "ornate-casing-444308-t1",
        location: process.env.GCP_LOCATION || "us-central1",
        model: process.env.VERTEX_AI_MODEL || "gemini-1.5-flash",
        maxTokens: parseInt(process.env.VERTEX_AI_MAX_TOKENS || "2000"),
        temperature: parseFloat(process.env.VERTEX_AI_TEMPERATURE || "0.0"),
      },
    };

    logger.info(`AI Service configured to use: ${this.provider}`);
    this.validateConfig();
  }

  private validateConfig() {
    if (this.provider === "openai") {
      if (!this.config.openai?.apiKey || !this.config.openai?.endpoint) {
        logger.warn(
          "OpenAI provider selected but OPENAI_API_KEY or OPENAI_ENDPOINT not configured"
        );
      }
    } else if (this.provider === "vertexai") {
      if (!this.config.vertexai?.projectId) {
        logger.warn("Vertex AI provider selected but GCP_PROJECT_ID not configured");
      }
    }
  }

  getProvider(): AIProvider {
    return this.provider;
  }

  getConfig(): AIServiceConfig {
    return this.config;
  }

  setProvider(provider: AIProvider) {
    this.provider = provider;
    this.config.provider = provider;
    logger.info(`AI Provider switched to: ${provider}`);
  }

  getVertexAIConfig() {
    return this.config.vertexai;
  }

  getOpenAIConfig() {
    return this.config.openai;
  }
}

export const aiConfigManager = new AIConfigManager();

// Helper function to get the appropriate AI service
export async function getAIService() {
  const provider = aiConfigManager.getProvider();

  if (provider === "vertexai") {
    const { getVertexAIService } = await import("./vertexai");
    return getVertexAIService(aiConfigManager.getVertexAIConfig());
  } else {
    // Default to OpenAI or a wrapper
    const module = await import("./openai");
    return {
      generateContent: module.getAICompletion,
    };
  }
}

export default aiConfigManager;
