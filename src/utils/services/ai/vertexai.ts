import axios from "axios";
import fs from "fs";
import path from "path";
import logger from "../../../logger";
import { GoogleAuth } from "google-auth-library";

interface VertexAIConfig {
  projectId: string;
  location: string;
  model: string;
  apiKey?: string;
  maxTokens?: number;
  temperature?: number;
}

interface VertexAIResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

class VertexAIService {
  private projectId: string = "";
  private location: string = "us-central1";
  private model: string = "gemini-1.5-flash";
  private apiKey: string = "";
  private maxTokens: number = 2000;
  private temperature: number = 0.0;
  private auth: GoogleAuth | null = null;
  private accessToken: string = "";
  private tokenExpiry: number = 0;

  constructor(config?: Partial<VertexAIConfig>) {
    this.loadConfig(config);
    this.initializeAuth();
  }

  private loadConfig(config?: Partial<VertexAIConfig>) {
    // Check for API key in config or environment variables
    this.apiKey =
      config?.apiKey ||
      process.env.VERTEX_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      "";

    // Try to load from ai-config.json if not using api key
    try {
      const configPath = path.join(process.cwd(), "secrets", "ai-config.json");
      if (fs.existsSync(configPath)) {
        logger.info("Loading Vertex AI config from ai-config.json");
      }
    } catch (error) {
      logger.warn("Could not load ai-config.json");
    }

    // Load from environment or use defaults
    this.projectId =
      config?.projectId ||
      process.env.GCP_PROJECT_ID ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      "ornate-casing-444308-t1";
    this.location = config?.location || process.env.GCP_LOCATION || "us-central1";
    
    // Normalize model name (fallback from invalid 'gemini-3.5-flash')
    let rawModel = config?.model || process.env.VERTEX_AI_MODEL || "gemini-1.5-flash";
    if (rawModel.toLowerCase().includes("3.5")) {
      rawModel = "gemini-1.5-flash";
    }
    this.model = rawModel;
    this.maxTokens = config?.maxTokens || parseInt(process.env.VERTEX_AI_MAX_TOKENS || "2000");
    this.temperature = config?.temperature || parseFloat(process.env.VERTEX_AI_TEMPERATURE || "0.0");

    if (this.apiKey) {
      logger.info(`Vertex AI / Gemini configured with API Key: model=${this.model}`);
    } else {
      logger.info(`Vertex AI configured with ADC: project=${this.projectId}, model=${this.model}`);
    }
  }

  private async initializeAuth() {
    // If API Key is configured, OAuth ADC is optional
    if (this.apiKey) {
      return;
    }

    try {
      this.auth = new GoogleAuth({
        scopes: ["https://www.googleapis.com/auth/cloud-platform"],
      });
      logger.info("Vertex AI authentication initialized with ADC");
    } catch (error: any) {
      logger.warn(error, "Vertex AI ADC not initialized; will rely on API key or fallback");
    }
  }

  private async getAccessToken(): Promise<string> {
    try {
      if (!this.auth) {
        throw new Error("Auth not initialized");
      }

      if (this.accessToken && Date.now() < this.tokenExpiry - 5 * 60 * 1000) {
        return this.accessToken;
      }

      const credentials = await this.auth.getClient();
      const tokenResponse = await credentials.getAccessToken();

      if (!tokenResponse.token) {
        throw new Error("Failed to obtain access token");
      }

      this.accessToken = tokenResponse.token;
      this.tokenExpiry = Date.now() + 55 * 60 * 1000;
      return this.accessToken;
    } catch (error: any) {
      logger.error(error, "Error getting access token for Vertex AI");
      throw error;
    }
  }

  public async generateContent(
    prompt: string,
    options?: Partial<VertexAIConfig>
  ): Promise<string> {
    const maxAttempts = 3;
    let attempt = 0;
    let lastErr: any = null;

    let targetModel = options?.model || this.model;
    if (targetModel.toLowerCase().includes("3.5")) {
      targetModel = "gemini-1.5-flash";
    }

    const config = {
      ...options,
      model: targetModel,
      maxTokens: options?.maxTokens || this.maxTokens,
      temperature: options?.temperature ?? this.temperature,
    };

    const currentApiKey =
      options?.apiKey ||
      this.apiKey ||
      process.env.VERTEX_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      "";

    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens: config.maxTokens,
        temperature: config.temperature,
      },
    };

    while (attempt < maxAttempts) {
      try {
        let response: any;

        // Path A: Use API Key (Google AI Studio / Gemini Endpoint)
        if (currentApiKey) {
          const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${currentApiKey}`;
          try {
            response = await axios.post<VertexAIResponse>(geminiEndpoint, requestBody, {
              headers: {
                "Content-Type": "application/json",
              },
              timeout: 30000,
            });
          } catch (apiErr: any) {
            // If generativelanguage 404/error, attempt Vertex AI endpoint with API key
            const vertexKeyEndpoint = `https://${this.location}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}/publishers/google/models/${config.model}:generateContent?key=${currentApiKey}`;
            response = await axios.post<VertexAIResponse>(vertexKeyEndpoint, requestBody, {
              headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": currentApiKey,
              },
              timeout: 30000,
            });
          }
        } else {
          // Path B: Use OAuth 2.0 Access Token via ADC
          const accessToken = await this.getAccessToken();
          const endpoint = `https://${this.location}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}/publishers/google/models/${config.model}:generateContent`;

          response = await axios.post<VertexAIResponse>(endpoint, requestBody, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            timeout: 30000,
          });
        }

        // Extract text from response
        let content =
          response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
          "";

        if (!content) {
          throw new Error("No content in Vertex AI / Gemini response");
        }

        if (content.startsWith("```json")) {
          content = content.substring(7, content.length - 3).trim();
        } else if (content.startsWith("```")) {
          content = content.substring(3, content.length - 3).trim();
        }

        logger.info(`Vertex AI / Gemini completion successful on attempt ${attempt + 1}`);
        return content;
      } catch (error: any) {
        lastErr = error;
        const status = error?.response?.status;
        const shouldRetry = status === 429 || status === 503;

        logger.warn(
          {
            attempt: attempt + 1,
            status,
            error: error.message,
          },
          "Vertex AI / Gemini API error"
        );

        if (error.response?.data) {
          logger.debug(error.response.data, "Vertex AI error response");
        }

        attempt += 1;

        if (!shouldRetry || attempt >= maxAttempts) {
          break;
        }

        // Exponential backoff
        const backoffMs = 1000 * Math.pow(2, attempt - 1);
        logger.info(`Retrying Vertex AI after ${backoffMs}ms`);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }

    logger.error(lastErr, "Failed to get completion from Vertex AI after all retries");
    throw new Error(`Failed to get completion from Vertex AI: ${lastErr?.message || "Unknown error"}`);
  }

  public async evaluateLeads(
    leadsData: any[],
    preferences: any
  ): Promise<string> {
    const prompt = this.buildLeadEvaluationPrompt(leadsData, preferences);
    return this.generateContent(prompt, { temperature: 0.0 });
  }

  public async evaluateCustomerPreference(data: any): Promise<any> {
    const prompt = this.buildCustomerPreferencePrompt(data);
    const response = await this.generateContent(prompt);

    try {
      return JSON.parse(response);
    } catch {
      logger.error("Failed to parse Vertex AI response as JSON");
      throw new Error("Invalid JSON response from AI");
    }
  }

  private buildLeadEvaluationPrompt(leadsData: any[], preferences: any): string {
    return `
You are an expert lead evaluation assistant. Evaluate the following leads based on the user's preferences and return a detailed analysis.

User Preferences:
${JSON.stringify(preferences, null, 2)}

Leads to Evaluate:
${JSON.stringify(leadsData, null, 2)}

Please provide:
1. Lead quality score (0-100)
2. Fit with preferences (percentage)
3. Key strengths
4. Potential concerns
5. Recommendation (pursue/investigate/skip)

Return as JSON with array of evaluated leads.
`;
  }

  private buildCustomerPreferencePrompt(data: any): string {
    return `
Analyze the following customer data and generate relevant business insights and preferences.

Data:
${JSON.stringify(data, null, 2)}

Return JSON with: icp_summary, bp_profile, market_insights, recommended_focus_areas
`;
  }
}

// Singleton instance
let vertexAIInstance: VertexAIService | null = null;

export function getVertexAIService(config?: Partial<VertexAIConfig>): VertexAIService {
  if (!vertexAIInstance) {
    vertexAIInstance = new VertexAIService(config);
  }
  return vertexAIInstance;
}

// Export direct function for backward compatibility with openai.ts
export async function getAICompletion(
  prompt: string,
  config?: Partial<VertexAIConfig>
): Promise<string> {
  const service = getVertexAIService(config);
  return service.generateContent(prompt);
}

export default VertexAIService;
