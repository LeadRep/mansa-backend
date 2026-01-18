// src/utils/apiClient.ts
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import logger from '../../logger';

export interface ApiClientConfig extends AxiosRequestConfig {
  retries?: number;
  retryDelay?: number;
  logErrors?: boolean;
}

export interface ApiResponse<T = any> {
  data: T;
  status: number;
  headers: any;
  success: boolean;
}

export interface ApiError {
  status?: number;
  message: string;
  originalError: any;
}

class ApiClient {
  private defaultConfig: ApiClientConfig = {
    timeout: 30000,
    retries: 3,
    retryDelay: 1000,
    logErrors: true,
  };

  async executeRequest<T = any>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    url: string,
    config: ApiClientConfig = {}
  ): Promise<ApiResponse<T>> {
    const finalConfig = { ...this.defaultConfig, ...config };
    const { retries = 3, retryDelay = 1000, logErrors = true, ...axiosConfig } = finalConfig;

    let lastError: any;
    let lastApiError: ApiError | undefined;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response: AxiosResponse = await axios({
          method,
          url,
          ...axiosConfig,
        });

        return {
          data: response.data,
          status: response.status,
          headers: response.headers,
          success: true,
        };

      } catch (error: any) {
        lastError = error;

        lastApiError = {
          status: error?.response?.status,
          message: error?.response?.data?.error ??
            error?.response?.data?.message ??
            error?.message ??
            'API request failed',
          originalError: error,
        };

        // Log error with context
        if (logErrors) {
          logger.error(
            {
              method,
              url,
              attempt: attempt + 1,
              maxAttempts: retries + 1,
              status: lastApiError.status,
              message: lastApiError.message
            },
            `API request failed (attempt ${attempt + 1}/${retries + 1})`
          );
        }

        const statusCode = error?.response?.status;

        // Determine if we should retry
        const shouldRetry = this.shouldRetry(statusCode, attempt, retries);

        if (!shouldRetry) {
          throw lastApiError;
        }

        // Wait before retrying with exponential backoff
        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
      }
    }

    throw lastApiError || lastError;
  }

  private shouldRetry(statusCode: number | undefined, attempt: number, maxRetries: number): boolean {
    // If this is the last attempt, don't retry
    if (attempt >= maxRetries) {
      return false;
    }

    // No status code means network error - retry
    if (!statusCode) {
      return true;
    }

    // Retry on server errors (5XX)
    if (statusCode >= 500 && statusCode < 600) {
      return true;
    }

    // Retry on rate limiting (429)
    if (statusCode === 429) {
      logger.info(`Rate limited. Waiting ...`);
      return true;
    }

    // Don't retry on client errors (4XX) except 429
    if (statusCode >= 400 && statusCode < 500) {
      return false;
    }

    // Retry on other unexpected status codes
    return true;
  }



  // Convenience methods
  async get<T = any>(url: string, config: ApiClientConfig = {}): Promise<ApiResponse<T>> {
    return this.executeRequest<T>('GET', url, config);
  }

  async post<T = any>(url: string, data?: any, config: ApiClientConfig = {}): Promise<ApiResponse<T>> {
    return this.executeRequest<T>('POST', url, { ...config, data });
  }

  async put<T = any>(url: string, data?: any, config: ApiClientConfig = {}): Promise<ApiResponse<T>> {
    return this.executeRequest<T>('PUT', url, { ...config, data });
  }

  async delete<T = any>(url: string, config: ApiClientConfig = {}): Promise<ApiResponse<T>> {
    return this.executeRequest<T>('DELETE', url, config);
  }

  async patch<T = any>(url: string, data?: any, config: ApiClientConfig = {}): Promise<ApiResponse<T>> {
    return this.executeRequest<T>('PATCH', url, { ...config, data });
  }
}

export const apiClient = new ApiClient();