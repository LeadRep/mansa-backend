import { apiClient, ApiResponse } from '../apiClient';
import logger from '../../../logger';
import {RequestConfig} from "../RequestConfig";

/**
 * Service for interacting with OpenAI HTTP API.
 *
 * This class centralizes configuration such as the endpoint URL and API key,
 * and exposes a generic `request` method to perform authenticated POST
 * requests against the OpenAI API. It also handles AI-specific response
 * parsing, including JSON extraction from code blocks.
 */
export class AIService {
  private endpoint = process.env.OPENAI_ENDPOINT!;
  private apiKey = process.env.OPENAI_API_KEY!;

  /**
   * Sends a POST request to the OpenAI API endpoint using the shared API client.
   *
   * The method automatically attaches the required API key and default headers,
   * and processes the response through AI-specific parsing logic to extract
   * and parse JSON content from the AI's response.
   *
   * @typeParam T - Expected shape of the parsed response data returned by the OpenAI API.
   * @param data - Request payload to send in the POST body (e.g., messages, model, parameters).
   * @param config - Optional additional request configuration (e.g. headers,
   *                 query parameters, or timeouts) merged into the API client call.
   * @returns A promise that resolves to the API client's `ApiResponse<T>` wrapper
   *          containing the parsed AI response data.
   * @throws {Error} If the AI response content cannot be parsed as valid JSON.
   */
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

  /**
   * Parses the AI API response to extract and clean JSON content.
   *
   * This method extracts the content from the AI's message response structure
   * (e.g., `choices[0].message.content`), removes markdown code block markers
   * if present, and attempts to parse the content as JSON. This is necessary
   * because AI responses may wrap JSON in markdown code blocks (```json...```).
   *
   * @typeParam T - Expected shape of the parsed JSON content.
   * @param response - The raw API response from the OpenAI API.
   * @returns The modified API response with parsed JSON data in the `data` field.
   * @throws {Error} If the content cannot be parsed as valid JSON.
   */
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