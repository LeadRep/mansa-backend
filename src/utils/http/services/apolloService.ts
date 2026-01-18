// src/utils/services/apolloService.ts
import { apiClient, ApiResponse } from '../apiClient';
import {RequestConfig} from "../RequestConfig";

/**
 * Service for interacting with the Apollo.io HTTP API.
 *
 * This class centralizes configuration such as the base URL and API key,
 * and exposes a generic `request` method to perform authenticated POST
 * requests against Apollo endpoints.
 */
export class ApolloService {
  private baseUrl = 'https://api.apollo.io/v1';
  private apiKey = process.env.APOLLO_API_KEY!;

  /**
   * Sends a POST request to an Apollo API endpoint using the shared API client.
   *
   * The method automatically normalizes the endpoint path, prefixes it with
   * the Apollo base URL, and attaches the required API key and default headers.
   *
   * @typeParam T - Expected shape of the response `data` returned by the Apollo API.
   * @param endpoint - The Apollo API endpoint path, relative to `/v1`
   *                   (leading slashes are normalized away).
   * @param data - Optional request payload to send in the POST body.
   * @param config - Optional additional request configuration (e.g. headers,
   *                 query parameters, or timeouts) merged into the API client call.
   * @returns A promise that resolves to the API client's `ApiResponse<T>` wrapper
   *          containing the Apollo API response.
   */
  async request<T = any>(endpoint: string, data?: any, config: RequestConfig = {}): Promise<ApiResponse<T>> {
    const normalizedEndpoint = endpoint.replace(/^\/+/, '');
    return apiClient.post<T>(
      `${this.baseUrl}/${normalizedEndpoint}`,
      data,
      {
      ...config,
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json',
        accept: "application/json",
        'x-api-key': this.apiKey,
        ...config.headers,
      },
    });
  }
}

export const apolloService = new ApolloService();