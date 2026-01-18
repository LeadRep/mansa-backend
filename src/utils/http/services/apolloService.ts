// src/utils/services/apolloService.ts
import { apiClient, ApiResponse } from '../apiClient';
import {RequestConfig} from "../RequestConfig";

export class ApolloService {
  private baseUrl = 'https://api.apollo.io/v1';
  private apiKey = process.env.APOLLO_API_KEY!;

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