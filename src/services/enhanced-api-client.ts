import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import { z } from 'zod';

// Simple in-memory cache implementation
class SimpleCache {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private ttl: number;

  constructor(ttlSeconds: number = 300) {
    this.ttl = ttlSeconds * 1000; // Convert to milliseconds
  }

  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  set(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }
}

// Simple rate limiter
class RateLimiter {
  private tokens: number;
  private maxTokens: number;
  private refillRate: number;
  private lastRefill: number;

  constructor(tokensPerMinute: number = 100) {
    this.maxTokens = tokensPerMinute;
    this.tokens = tokensPerMinute;
    this.refillRate = tokensPerMinute / 60000; // tokens per millisecond
    this.lastRefill = Date.now();
  }

  async waitForToken(): Promise<void> {
    this.refill();
    
    if (this.tokens < 1) {
      const waitTime = (1 - this.tokens) / this.refillRate;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.refill();
    }
    
    this.tokens -= 1;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}

// Enhanced API client with all the features
export class EnhancedMaybeFinanceAPI {
  private client: AxiosInstance;
  private rateLimiter: RateLimiter;
  private cache: SimpleCache;
  private retryDelays = [1000, 2000, 4000]; // Exponential backoff

  constructor(
    baseURL: string, 
    apiKey: string,
    options: {
      rateLimitPerMinute?: number;
      cacheTTLSeconds?: number;
      timeout?: number;
    } = {}
  ) {
    this.rateLimiter = new RateLimiter(options.rateLimitPerMinute || 100);
    this.cache = new SimpleCache(options.cacheTTLSeconds || 300);
    
    this.client = axios.create({
      baseURL,
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      timeout: options.timeout || 30000,
    });

    // Request interceptor for rate limiting
    this.client.interceptors.request.use(async (config) => {
      await this.rateLimiter.waitForToken();
      return config;
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const config = error.config;
        if (!config) throw error;

        // Check if we should retry
        const retryCount = (config as any).__retryCount || 0;
        const shouldRetry = this.shouldRetry(error, retryCount);
        
        if (shouldRetry && retryCount < this.retryDelays.length) {
          // Wait before retrying
          await new Promise(resolve => 
            setTimeout(resolve, this.retryDelays[retryCount])
          );
          
          // Increment retry count
          (config as any).__retryCount = retryCount + 1;
          
          // Retry the request
          return this.client.request(config);
        }

        // Format error message
        throw this.formatError(error);
      }
    );
  }

  private shouldRetry(error: AxiosError, retryCount: number): boolean {
    if (retryCount >= this.retryDelays.length) return false;
    
    // Retry on network errors
    if (!error.response) return true;
    
    // Retry on specific status codes
    const status = error.response.status;
    return status === 429 || // Rate limit
           status === 503 || // Service unavailable
           status === 504 || // Gateway timeout
           status >= 500;    // Server errors
  }

  private formatError(error: AxiosError): Error {
    const status = error.response?.status;
    const data = error.response?.data as any;
    
    let message = 'API request failed';
    
    if (status === 401) {
      message = 'Invalid API key or authentication failed';
    } else if (status === 403) {
      message = 'Access forbidden - check API permissions';
    } else if (status === 404) {
      message = 'Resource not found';
    } else if (status === 429) {
      message = 'Rate limit exceeded - please try again later';
    } else if (status === 422) {
      message = `Validation error: ${data?.message || 'Invalid request data'}`;
    } else if (data?.message) {
      message = data.message;
    } else if (error.message) {
      message = error.message;
    }
    
    const enhancedError = new Error(`[${status || 'Network'}] ${message}`);
    (enhancedError as any).status = status;
    (enhancedError as any).originalError = error;
    
    return enhancedError;
  }

  private getCacheKey(url: string, params?: any): string {
    return `${url}:${JSON.stringify(params || {})}`;
  }

  // Enhanced GET with caching
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const cacheKey = this.getCacheKey(url, config?.params);
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    // Make request
    const response = await this.client.get<T>(url, config);
    
    // Cache successful responses
    if (response.status === 200) {
      this.cache.set(cacheKey, response.data);
    }
    
    return response.data;
  }

  // Standard methods without caching
  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }

  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.patch<T>(url, data, config);
    return response.data;
  }

  // Clear cache
  clearCache(): void {
    this.cache.clear();
  }
}