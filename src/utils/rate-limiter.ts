/**
 * Rate limiting implementation for MCP servers
 * Prevents abuse by limiting request rates per client
 */

import { McpError, ErrorCode } from '../types.js'
import { config } from '../config.js'

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  skipFailedRequests?: boolean; // Don't count failed requests
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  keyGenerator?: (request: any) => string; // Custom key generator
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private config: RateLimitConfig;
  private cleanupInterval: NodeJS.Timeout;

  constructor(config: RateLimitConfig) {
    this.config = {
      skipFailedRequests: false,
      skipSuccessfulRequests: false,
      keyGenerator: () => 'global', // Default to global rate limiting
      ...config,
    };

    // Cleanup old entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  /**
   * Check if request should be allowed
   */
  async checkLimit(request: any): Promise<void> {
    const key = this.config.keyGenerator!(request);
    const now = Date.now();

    let entry = this.limits.get(key);

    // Initialize or reset entry
    if (!entry || now >= entry.resetTime) {
      entry = {
        count: 0,
        resetTime: now + this.config.windowMs,
      };
      this.limits.set(key, entry);
    }

    // Check if limit exceeded
    if (entry.count >= this.config.maxRequests) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Rate limit exceeded. Please retry after ${retryAfter} seconds.`,
        {
          retryAfter,
          limit: this.config.maxRequests,
          windowMs: this.config.windowMs,
        }
      );
    }

    // Increment counter (will be decremented if configured to skip)
    entry.count++;
  }

  /**
   * Update rate limit after request completion
   */
  updateAfterRequest(request: any, success: boolean): void {
    const key = this.config.keyGenerator!(request);
    const entry = this.limits.get(key);

    if (!entry) return;

    // Decrement counter if configured to skip this type of request
    if (
      (success && this.config.skipSuccessfulRequests) ||
      (!success && this.config.skipFailedRequests)
    ) {
      entry.count = Math.max(0, entry.count - 1);
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.limits.entries()) {
      if (now >= entry.resetTime) {
        this.limits.delete(key);
      }
    }
  }

  /**
   * Get current limit status for a key
   */
  getStatus(request: any): { remaining: number; resetTime: number } {
    const key = this.config.keyGenerator!(request);
    const entry = this.limits.get(key);
    const now = Date.now();

    if (!entry || now >= entry.resetTime) {
      return {
        remaining: this.config.maxRequests,
        resetTime: now + this.config.windowMs,
      };
    }

    return {
      remaining: Math.max(0, this.config.maxRequests - entry.count),
      resetTime: entry.resetTime,
    };
  }

  /**
   * Stop the cleanup interval
   */
  stop(): void {
    clearInterval(this.cleanupInterval);
  }
}

/**
 * Create rate limiters for different operation types
 */
export function createRateLimiters() {
  return {
    // Global rate limit - 1000 requests per minute
    global: new RateLimiter({
      windowMs: 60 * 1000,
      maxRequests: 1000,
      keyGenerator: () => 'global',
    }),

    // Write operations - 100 per minute
    write: new RateLimiter({
      windowMs: 60 * 1000,
      maxRequests: 100,
      keyGenerator: () => 'write',
    }),

    // Expensive operations - 10 per minute
    expensive: new RateLimiter({
      windowMs: 60 * 1000,
      maxRequests: 10,
      keyGenerator: () => 'expensive',
    }),
  };
}

/**
 * Determine which rate limiter to use for a tool
 */
export function getRateLimiterForTool(toolName: string): 'write' | 'expensive' | 'global' {
  const writeTools = [
    'create_entities',
    'create_relations',
    'add_observations',
    'delete_entities',
    'delete_relations',
    'delete_observations',
  ];

  const expensiveTools = ['find_shortest_path', 'get_neighbors'];

  if (writeTools.includes(toolName)) return 'write';
  if (expensiveTools.includes(toolName)) return 'expensive';
  return 'global';
}
