import { apiClient, ApiResponse } from '../apiClient';
import logger from '../../../logger';
import {RequestConfig} from "../RequestConfig";

export class AIService {
  private endpoint = process.env.OPENAI_ENDPOINT!;
  private apiKey = process.env.OPENAI_API_KEY!;

  async request<T = any>(data: any, config: RequestConfig = {}): Promise<ApiResponse<T>> {
    const response = await apiClient.post(this.endpoint, data, {
      ...config,
      headers: {
        'api-key': this.apiKey,
        'Content-Type': 'application/json',
        ...config.headers,
      },
    });

    // Handle AI-specific response parsing
    return this.parseAIResponse<T>(response);
  }

  private parseAIResponse<T>(response: ApiResponse): ApiResponse<T> {
    let content = response.data?.choices?.[0]?.message?.content?.trim();
    //logger.info({aiContent: content}, "Ai content:");
    if (!content) {
      return response as ApiResponse<T>;
    }

    // Clean up code blocks if present
    if (content.startsWith('```')) {
      content = content
        .replace(/^```(?:json)?/, '')
        .replace(/```$/, '')
        .trim();
    }

    try {
      const parsedContent = JSON.parse(content);
      return {
        ...response,
        data: parsedContent,
      };
    } catch (parseError) {
      logger.error({ parseError, content }, 'Failed to parse AI response content as JSON');
      throw new Error('Failed to parse AI response as JSON');
    }
  }
}

export const aiService = new AIService();