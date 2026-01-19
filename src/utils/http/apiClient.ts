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

    // Log request initiation
    logger.info({
      method,
      url: this.sanitizeUrl(url),
      maxRetries: retries
    }, 'API request started');

    let lastApiError: ApiError | undefined;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response: AxiosResponse = await axios({
          method,
          url,
          ...axiosConfig,
        });

        // Log successful response
        logger.info({
          method,
          url: this.sanitizeUrl(url),
          status: response.status,
          attempts: attempt + 1
        }, 'API request completed successfully');

        return {
          data: response.data,
          status: response.status,
          headers: response.headers,
          success: true,
        };

      } catch (error: any) {
        lastApiError = {
          status: error?.response?.status,
          message: error?.response?.data?.error ??
            error?.response?.data?.message ??
            error?.message ??
            'API request failed',
          originalError: error,
        };

        const statusCode = error?.response?.status;
        const shouldRetry = this.shouldRetry(statusCode, attempt, retries);

        // Log error with attempt context
        if (logErrors && !shouldRetry) {
          logger.error({
            method,
            url: this.sanitizeUrl(url),
            status: statusCode,
            message: lastApiError.message,
            attempts: attempt + 1
          }, 'API request failed permanently');
        }

        if (!shouldRetry) {
          throw lastApiError;
        }

        // Wait before retrying with exponential backoff
        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
      }
    }

    throw lastApiError!;
  }

  private shouldRetry(statusCode: number | undefined, attempt: number, maxRetries: number): boolean {
    if (attempt >= maxRetries) {
      return false;
    }

    if (!statusCode) {
      return true;
    }

    if (statusCode >= 500 && statusCode < 600) {
      return true;
    }

    if (statusCode === 429) {
      logger.info(`Rate limited. Waiting ...`);
      return true;
    }

    if (statusCode >= 400 && statusCode < 500) {
      return false;
    }

    return true;
  }

  private sanitizeUrl(url: string): string {
    return url.replace(/([?&](?:api_key|apikey|token|password|secret)=)[^&]*/gi, '$1[REDACTED]');
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