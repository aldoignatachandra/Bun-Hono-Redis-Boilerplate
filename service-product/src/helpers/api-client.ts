/**
 * Internal API Client
 *
 * Production-grade HTTP client for service-to-service communication.
 * Implements proper error handling, timeouts, and logging.
 *
 * @module api-client
 */

/**
 * Configuration for API client requests
 */
export interface ApiClientConfig {
  /** Base URL of the target service (e.g., 'http://localhost:3001') */
  baseUrl: string;
  /** Request timeout in milliseconds (default: 5000) */
  timeout?: number;
  /** Optional authorization token for system auth */
  authToken?: string;
  /** Additional headers to include in requests */
  headers?: Record<string, string>;
}

/**
 * API response wrapper matching the standard API response format
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  meta?: Record<string, unknown>;
  error?: {
    code: string;
    details?: unknown;
  };
}

/**
 * Error thrown when API request fails
 */
export class ApiClientError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

/**
 * Creates a timeout promise that rejects after specified milliseconds
 */
function createTimeoutPromise(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Request timeout after ${ms}ms`)), ms);
  });
}

/**
 * Internal API Client
 *
 * Provides a type-safe way to make HTTP requests to other internal services.
 * Handles timeouts, errors, and response parsing.
 *
 * @example
 * ```typescript
 * const client = createApiClient({
 *   baseUrl: 'http://localhost:3001',
 *   timeout: 5000,
 *   authToken: 'Basic ' + btoa('user:pass')
 * });
 *
 * const response = await client.get<OldestUserResponse>('/api/internal/users/oldest?role=USER');
 * console.log(response.data);
 * ```
 */
export class InternalApiClient {
  private baseUrl: string;
  private timeout: number;
  private defaultHeaders: Record<string, string>;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.timeout = config.timeout || 5000;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': 'service-product/internal-api-client',
      ...config.headers,
    };

    if (config.authToken) {
      this.defaultHeaders['Authorization'] = config.authToken;
    }
  }

  /**
   * Makes a GET request to the specified endpoint
   */
  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await Promise.race([
        fetch(url, {
          method: 'GET',
          headers: this.defaultHeaders,
        }),
        createTimeoutPromise(this.timeout),
      ]);

      if (!response.ok) {
        // Try to parse error response
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        let errorCode = `HTTP_${response.status}`;
        let errorDetails: unknown;

        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorCode = errorData.error.code || errorCode;
            errorDetails = errorData.error.details;
            errorMessage = errorData.message || errorMessage;
          }
        } catch {
          // Response is not JSON, use status text
        }

        throw new ApiClientError(errorMessage, response.status, errorCode, errorDetails);
      }

      const data: ApiResponse<T> = await response.json();
      return data;
    } catch (error) {
      if (error instanceof ApiClientError) {
        throw error;
      }

      // Handle network errors and timeouts
      const message = error instanceof Error ? error.message : 'Unknown network error';
      throw new ApiClientError(
        `Failed to connect to ${this.baseUrl}: ${message}`,
        0,
        'NETWORK_ERROR',
        message
      );
    }
  }

  /**
   * Makes a POST request to the specified endpoint
   */
  async post<T>(endpoint: string, body: unknown): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await Promise.race([
        fetch(url, {
          method: 'POST',
          headers: this.defaultHeaders,
          body: JSON.stringify(body),
        }),
        createTimeoutPromise(this.timeout),
      ]);

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        let errorCode = `HTTP_${response.status}`;
        let errorDetails: unknown;

        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorCode = errorData.error.code || errorCode;
            errorDetails = errorData.error.details;
            errorMessage = errorData.message || errorMessage;
          }
        } catch {
          // Response is not JSON
        }

        throw new ApiClientError(errorMessage, response.status, errorCode, errorDetails);
      }

      const data: ApiResponse<T> = await response.json();
      return data;
    } catch (error) {
      if (error instanceof ApiClientError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : 'Unknown network error';
      throw new ApiClientError(
        `Failed to connect to ${this.baseUrl}: ${message}`,
        0,
        'NETWORK_ERROR',
        message
      );
    }
  }
}

/**
 * Factory function to create an API client instance
 */
export function createApiClient(config: ApiClientConfig): InternalApiClient {
  return new InternalApiClient(config);
}

/**
 * Default client configurations for known services
 */
export const ServiceUrls = {
  USER_SERVICE: process.env.USER_SERVICE_URL || 'http://localhost:3101',
  PRODUCT_SERVICE: process.env.PRODUCT_SERVICE_URL || 'http://localhost:3102',
  AUTH_SERVICE: process.env.AUTH_SERVICE_URL || 'http://localhost:3100',
} as const;
