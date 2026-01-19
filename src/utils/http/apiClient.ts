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
    const requestId = this.generateRequestId();
    const finalConfig = { ...this.defaultConfig, ...config };
    const { retries = 3, retryDelay = 1000, logErrors = true, ...axiosConfig } = finalConfig;
    const startTime = Date.now();

    // Log initial request details
    logger.info({
      requestId,
      service: 'ApiClient',
      method,
      url: this.sanitizeUrl(url),
      timeout: axiosConfig.timeout,
      maxRetries: retries,
      hasData: !!axiosConfig.data,
      dataSize: axiosConfig.data ? JSON.stringify(axiosConfig.data).length : 0,
      userAgent: axiosConfig.headers?.['User-Agent'] || 'default'
    }, 'API request initiated');

    let lastApiError: ApiError | undefined;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const attemptStartTime = Date.now();

      try {
        // Log attempt start (except for first attempt which is already logged above)
        if (attempt > 0) {
          logger.info({
            requestId,
            service: 'ApiClient',
            method,
            url: this.sanitizeUrl(url),
            attempt: attempt + 1,
            maxAttempts: retries + 1,
            backoffDelay: retryDelay * Math.pow(2, attempt - 1)
          }, `API request retry attempt ${attempt + 1}`);
        }

        const response: AxiosResponse = await axios({
          method,
          url,
          ...axiosConfig,
        });

        const totalDuration = Date.now() - startTime;
        const attemptDuration = Date.now() - attemptStartTime;

        // Log successful response
        logger.info({
          requestId,
          service: 'ApiClient',
          method,
          url: this.sanitizeUrl(url),
          status: response.status,
          totalDuration,
          attemptDuration,
          attempt: attempt + 1,
          responseSize: JSON.stringify(response.data).length,
          contentType: response.headers['content-type'],
          rateLimit: this.extractRateLimitInfo(response.headers),
          success: true
        }, `API request successful ${attempt > 0 ? `after ${attempt + 1} attempts` : 'on first attempt'}`);

        return {
          data: response.data,
          status: response.status,
          headers: response.headers,
          success: true,
        };

      } catch (error: any) {
        const attemptDuration = Date.now() - attemptStartTime;

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

        // Log error with comprehensive context
        if (logErrors) {
          const logLevel = shouldRetry ? 'warn' : 'error';
          logger[logLevel](
            {
              requestId,
              service: 'ApiClient',
              method,
              url: this.sanitizeUrl(url),
              attempt: attempt + 1,
              maxAttempts: retries + 1,
              attemptDuration,
              totalDuration: Date.now() - startTime,
              status: lastApiError.status,
              message: lastApiError.message,
              errorType: this.categorizeError(error),
              willRetry: shouldRetry,
              retryDelay: shouldRetry ? retryDelay * Math.pow(2, attempt) : undefined,
              rateLimit: error?.response?.headers ? this.extractRateLimitInfo(error.response.headers) : undefined,
              // Network-specific info
              isNetworkError: !error?.response,
              isTimeout: error?.code === 'ECONNABORTED',
              host: new URL(url).hostname
            },
            `API request ${shouldRetry ? 'failed, will retry' : 'failed permanently'} (attempt ${attempt + 1}/${retries + 1})`
          );
        }

        if (!shouldRetry) {
          const totalDuration = Date.now() - startTime;

          logger.error({
            requestId,
            service: 'ApiClient',
            method,
            url: this.sanitizeUrl(url),
            finalStatus: lastApiError.status,
            finalMessage: lastApiError.message,
            totalAttempts: attempt + 1,
            totalDuration,
            exhaustedRetries: attempt >= retries
          }, 'API request failed permanently after all retries');

          throw lastApiError;
        }

        // Wait before retrying with exponential backoff
        const backoffDelay = retryDelay * Math.pow(2, attempt);
        logger.debug({
          requestId,
          service: 'ApiClient',
          backoffDelay,
          nextAttempt: attempt + 2
        }, `Waiting ${backoffDelay}ms before retry`);

        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }

    // If we reach here, all retries have been exhausted
    // lastApiError will always be set since we've caught at least one error
    throw lastApiError!;
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
      logger.info({
        service: 'ApiClient',
        status: statusCode,
        attempt: attempt + 1,
        willWait: true
      }, 'Rate limited. Waiting before retry...');
      return true;
    }

    // Don't retry on client errors (4XX) except 429
    if (statusCode >= 400 && statusCode < 500) {
      return false;
    }

    // Retry on other unexpected status codes
    return true;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sanitizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      // Remove sensitive query parameters
      const sensitiveParams = ['api_key', 'apikey', 'token', 'password', 'secret'];
      sensitiveParams.forEach(param => {
        if (urlObj.searchParams.has(param)) {
          urlObj.searchParams.set(param, '[REDACTED]');
        }
      });
      return urlObj.toString();
    } catch {
      return url.replace(/([?&](?:api_key|apikey|token|password|secret)=)[^&]*/gi, '$1[REDACTED]');
    }
  }

  private extractRateLimitInfo(headers: any): object | undefined {
    const rateLimitHeaders = [
      'x-ratelimit-limit',
      'x-ratelimit-remaining',
      'x-ratelimit-reset',
      'retry-after',
      'x-rate-limit-limit',
      'x-rate-limit-remaining',
      'x-rate-limit-reset'
    ];

    const rateLimitInfo: any = {};
    let hasRateLimitInfo = false;

    rateLimitHeaders.forEach(header => {
      const value = headers[header] || headers[header.toLowerCase()];
      if (value !== undefined) {
        rateLimitInfo[header] = value;
        hasRateLimitInfo = true;
      }
    });

    return hasRateLimitInfo ? rateLimitInfo : undefined;
  }

  private categorizeError(error: any): string {
    if (!error?.response) return 'network';

    const status = error.response.status;
    if (status === 401) return 'authentication';
    if (status === 403) return 'authorization';
    if (status === 404) return 'not_found';
    if (status === 429) return 'rate_limit';
    if (status >= 400 && status < 500) return 'client_error';
    if (status >= 500) return 'server_error';

    return 'unknown';
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