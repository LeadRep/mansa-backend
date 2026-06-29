import axios from "axios";
import fs from "fs";
import path from "path";
import logger from "../../../logger";
import { GoogleAuth } from "google-auth-library";

interface VertexAIConfig {
  projectId: string;
  location: string;
  model: string;
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
    // Try to load from ai-config.json
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
      "ornate-casing-444308-t1"; // From ai-config.json
    this.location = config?.location || process.env.GCP_LOCATION || "us-central1";
    this.model = config?.model || process.env.VERTEX_AI_MODEL || "gemini-1.5-flash";
    this.maxTokens = config?.maxTokens || parseInt(process.env.VERTEX_AI_MAX_TOKENS || "2000");
    this.temperature = config?.temperature || parseFloat(process.env.VERTEX_AI_TEMPERATURE || "0.0");

    logger.info(`Vertex AI configured: project=${this.projectId}, model=${this.model}`);
  }

  private async initializeAuth() {
    try {
      // Use Application Default Credentials (ADC)
      // The SDK will look for GOOGLE_APPLICATION_CREDENTIALS env var
      // or use the default credentials from the system
      this.auth = new GoogleAuth({
        scopes: ["https://www.googleapis.com/auth/cloud-platform"],
      });

      logger.info("Vertex AI authentication initialized with ADC");
    } catch (error: any) {
      logger.error(error, "Failed to initialize Vertex AI authentication");
      throw new Error("Could not initialize Vertex AI authentication");
    }
  }

  private async getAccessToken(): Promise<string> {
    try {
      if (!this.auth) {
        throw new Error("Auth not initialized");
      }

      // Check if token is still valid (with 5 min buffer)
      if (this.accessToken && Date.now() < this.tokenExpiry - 5 * 60 * 1000) {
        return this.accessToken;
      }

      const credentials = await this.auth.getClient();
      const token = await credentials.getAccessToken();

      if (!token.token) {
        throw new Error("Failed to obtain access token");
      }

      this.accessToken = token.token;
      this.tokenExpiry = token.expiry_date || Date.now() + 60 * 60 * 1000;

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

    const config = {
      ...options,
      model: options?.model || this.model,
      maxTokens: options?.maxTokens || this.maxTokens,
      temperature: options?.temperature ?? this.temperature,
    };

    while (attempt < maxAttempts) {
      try {
        const accessToken = await this.getAccessToken();

        const endpoint = `https://${this.location}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}/publishers/google/models/${config.model}:generateContent`;

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

        const response = await axios.post<VertexAIResponse>(endpoint, requestBody, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          timeout: 30000,
        });

        // Extract text from Vertex AI response
        let content =
          response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
          "";

        if (!content) {
          throw new Error("No content in Vertex AI response");
        }

        // Handle JSON code blocks
        if (content.startsWith("```json")) {
          content = content.substring(7, content.length - 3).trim();
        } else if (content.startsWith("```")) {
          content = content.substring(3, content.length - 3).trim();
        }

        logger.info(`Vertex AI completion successful on attempt ${attempt + 1}`);
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
          "Vertex AI API error"
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
