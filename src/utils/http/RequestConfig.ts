export type RequestConfig = {
  headers?: Record<string, string>;
  timeout?: number;
} & Record<string, any>;
