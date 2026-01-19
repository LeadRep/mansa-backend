// src/utils/apiClient.ts
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import logger from '../../logger';

/**
 * Configuration options for API client requests.
 * Extends AxiosRequestConfig to support all standard axios options.
 * 
 * @interface ApiClientConfig
 * @extends {AxiosRequestConfig}
 * @property {number} [retries] - Number of retry attempts for failed requests (default: 3)
 * @property {number} [retryDelay] - Initial delay in milliseconds between retries (default: 1000). Uses exponential backoff.
 * @property {boolean} [logErrors] - Whether to log errors during request failures (default: true)
 */
export interface ApiClientConfig extends AxiosRequestConfig {
  retries?: number;
  retryDelay?: number;
  logErrors?: boolean;
}

/**
 * Standardized API response structure.
 * 
 * @interface ApiResponse
 * @template T - The type of data returned in the response
 * @property {T} data - The response data from the API
 * @property {number} status - HTTP status code of the response
 * @property {any} headers - Response headers
 * @property {boolean} success - Indicates if the request was successful
 */
export interface ApiResponse<T = any> {
  data: T;
  status: number;
  headers: any;
  success: boolean;
}

/**
 * Standardized API error structure.
 * 
 * @interface ApiError
 * @property {number} [status] - HTTP status code if available
 * @property {string} message - Error message describing what went wrong
 * @property {any} originalError - The original error object from axios
 */
export interface ApiError {
  status?: number;
  message: string;
  originalError: any;
}

/**
 * HTTP API client with automatic retry logic and standardized error handling.
 * 
 * Features:
 * - Automatic retries with exponential backoff for failed requests
 * - Configurable retry behavior (count, delay, conditions)
 * - Comprehensive error logging with request context
 * - Standardized response and error formats
 * - Intelligent retry logic (retries on 5XX, 429, network errors; skips 4XX client errors)
 * 
 * Default configuration:
 * - timeout: 30000ms (30 seconds)
 * - retries: 3 attempts
 * - retryDelay: 1000ms (1 second, with exponential backoff)
 * - logErrors: true
 * 
 * @class ApiClient
 * @example
 * ```typescript
 * // Using the default instance
 * const response = await apiClient.get('https://api.example.com/data');
 * 
 * // With custom retry configuration
 * const response = await apiClient.post(
 *   'https://api.example.com/data',
 *   { key: 'value' },
 *   { retries: 5, retryDelay: 2000 }
 * );
 * ```
 */
class ApiClient {
  private defaultConfig: ApiClientConfig = {
    timeout: 30000,
    retries: 3,
    retryDelay: 1000,
    logErrors: true,
  };

  /**
   * Executes an HTTP request with automatic retry logic and error handling.
   * 
   * Retry behavior:
   * - Retries on server errors (5XX status codes)
   * - Retries on rate limiting (429 status code)
   * - Retries on network errors (no status code)
   * - Does NOT retry on client errors (4XX except 429)
   * - Uses exponential backoff: delay * 2^attempt
   * 
   * @template T - The expected type of the response data
   * @param {('GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH')} method - HTTP method to use
   * @param {string} url - The URL to send the request to
   * @param {ApiClientConfig} [config={}] - Configuration options including retry settings and axios options
   * @returns {Promise<ApiResponse<T>>} Promise resolving to standardized API response
   * @throws {ApiError} Throws standardized error if all retry attempts fail
   * 
   * @example
   * ```typescript
   * const response = await apiClient.executeRequest<User>('GET', '/api/user/123', {
   *   retries: 5,
   *   retryDelay: 2000,
   *   headers: { 'Authorization': 'Bearer token' }
   * });
   * ```
   */
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

    // If we reach here, all retries have been exhausted
    // lastApiError will always be set since we've caught at least one error
    throw lastApiError!;
  }

  /**
   * Determines whether a failed request should be retried based on the status code and attempt count.
   * 
   * Retry logic:
   * - Always retries if attempts remain and status is 5XX (server errors)
   * - Always retries on 429 (rate limiting)
   * - Always retries on network errors (no status code)
   * - Never retries on 4XX client errors (except 429)
   * - Retries on any other unexpected status codes
   * 
   * @private
   * @param {number | undefined} statusCode - HTTP status code from the response, or undefined for network errors
   * @param {number} attempt - Current attempt number (0-indexed)
   * @param {number} maxRetries - Maximum number of retries allowed
   * @returns {boolean} True if the request should be retried, false otherwise
   */
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



  /**
   * Performs a GET request.
   * 
   * @template T - The expected type of the response data
   * @param {string} url - The URL to send the GET request to
   * @param {ApiClientConfig} [config={}] - Configuration options including retry settings and axios options
   * @returns {Promise<ApiResponse<T>>} Promise resolving to standardized API response
   * @throws {ApiError} Throws standardized error if all retry attempts fail
   * 
   * @example
   * ```typescript
   * const users = await apiClient.get<User[]>('/api/users');
   * ```
   */
  async get<T = any>(url: string, config: ApiClientConfig = {}): Promise<ApiResponse<T>> {
    return this.executeRequest<T>('GET', url, config);
  }

  /**
   * Performs a POST request.
   * 
   * @template T - The expected type of the response data
   * @param {string} url - The URL to send the POST request to
   * @param {any} [data] - The data to send in the request body
   * @param {ApiClientConfig} [config={}] - Configuration options including retry settings and axios options
   * @returns {Promise<ApiResponse<T>>} Promise resolving to standardized API response
   * @throws {ApiError} Throws standardized error if all retry attempts fail
   * 
   * @example
   * ```typescript
   * const newUser = await apiClient.post<User>('/api/users', { name: 'John Doe' });
   * ```
   */
  async post<T = any>(url: string, data?: any, config: ApiClientConfig = {}): Promise<ApiResponse<T>> {
    return this.executeRequest<T>('POST', url, { ...config, data });
  }

  /**
   * Performs a PUT request.
   * 
   * @template T - The expected type of the response data
   * @param {string} url - The URL to send the PUT request to
   * @param {any} [data] - The data to send in the request body
   * @param {ApiClientConfig} [config={}] - Configuration options including retry settings and axios options
   * @returns {Promise<ApiResponse<T>>} Promise resolving to standardized API response
   * @throws {ApiError} Throws standardized error if all retry attempts fail
   * 
   * @example
   * ```typescript
   * const updated = await apiClient.put<User>('/api/users/123', { name: 'Jane Doe' });
   * ```
   */
  async put<T = any>(url: string, data?: any, config: ApiClientConfig = {}): Promise<ApiResponse<T>> {
    return this.executeRequest<T>('PUT', url, { ...config, data });
  }

  /**
   * Performs a DELETE request.
   * 
   * @template T - The expected type of the response data
   * @param {string} url - The URL to send the DELETE request to
   * @param {ApiClientConfig} [config={}] - Configuration options including retry settings and axios options
   * @returns {Promise<ApiResponse<T>>} Promise resolving to standardized API response
   * @throws {ApiError} Throws standardized error if all retry attempts fail
   * 
   * @example
   * ```typescript
   * await apiClient.delete('/api/users/123');
   * ```
   */
  async delete<T = any>(url: string, config: ApiClientConfig = {}): Promise<ApiResponse<T>> {
    return this.executeRequest<T>('DELETE', url, config);
  }

  /**
   * Performs a PATCH request.
   * 
   * @template T - The expected type of the response data
   * @param {string} url - The URL to send the PATCH request to
   * @param {any} [data] - The data to send in the request body
   * @param {ApiClientConfig} [config={}] - Configuration options including retry settings and axios options
   * @returns {Promise<ApiResponse<T>>} Promise resolving to standardized API response
   * @throws {ApiError} Throws standardized error if all retry attempts fail
   * 
   * @example
   * ```typescript
   * const updated = await apiClient.patch<User>('/api/users/123', { email: 'new@example.com' });
   * ```
   */
  async patch<T = any>(url: string, data?: any, config: ApiClientConfig = {}): Promise<ApiResponse<T>> {
    return this.executeRequest<T>('PATCH', url, { ...config, data });
  }
}

/**
 * Default singleton instance of ApiClient.
 * Use this for most API requests throughout the application.
 * 
 * @constant {ApiClient}
 * @example
 * ```typescript
 * import { apiClient } from './apiClient';
 * const response = await apiClient.get('/api/data');
 * ```
 */
export const apiClient = new ApiClient();