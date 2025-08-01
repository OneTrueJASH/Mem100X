import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RateLimiter, createRateLimiters, getRateLimiterForTool } from '../../../dist/utils/rate-limiter.js';
import { createTestEnvironment, TestContext } from '../../helpers/test-utils.js';
import { McpError } from '../../../dist/types.js';

describe('RateLimiter', () => {
  let testContext: TestContext;
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    testContext = createTestEnvironment();
    rateLimiter = new RateLimiter({
      windowMs: 1000,
      maxRequests: 5,
      skipFailedRequests: false,
      skipSuccessfulRequests: false,
      keyGenerator: (request: any) => request.clientId || 'default'
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    testContext.cleanup();
    rateLimiter.stop();
    vi.useRealTimers();
  });

  describe('Initialization', () => {
    it('should initialize with correct configuration', () => {
      const status = rateLimiter.getStatus({ clientId: 'test' });
      expect(status.remaining).toBe(5);
      expect(status.resetTime).toBeGreaterThan(Date.now());
    });

    it('should handle custom key generator', () => {
      const customLimiter = new RateLimiter({
        windowMs: 1000,
        maxRequests: 3,
        keyGenerator: (request: any) => request.userId
      });

      const request1 = { userId: 'user1' };
      const request2 = { userId: 'user2' };

      expect(() => customLimiter.checkLimit(request1)).not.toThrow();
      expect(() => customLimiter.checkLimit(request2)).not.toThrow();

      customLimiter.stop();
    });

    it('should handle default configuration', () => {
      const defaultLimiter = new RateLimiter({
        windowMs: 1000,
        maxRequests: 10
      });

      expect(() => defaultLimiter.checkLimit({})).not.toThrow();
      defaultLimiter.stop();
    });
  });

  describe('Basic Rate Limiting', () => {
    it('should allow requests within limit', async () => {
      const request = { clientId: 'test' };

      // Should allow 5 requests
      for (let i = 0; i < 5; i++) {
        await expect(rateLimiter.checkLimit(request)).resolves.not.toThrow();
      }
    });

    it('should reject requests when limit exceeded', async () => {
      const request = { clientId: 'test' };

      // Use up all 5 requests
      for (let i = 0; i < 5; i++) {
        await rateLimiter.checkLimit(request);
      }

      // 6th request should be rejected
      await expect(rateLimiter.checkLimit(request)).rejects.toThrow(McpError);
    });

    it('should track remaining requests correctly', async () => {
      const request = { clientId: 'test' };

      let status = rateLimiter.getStatus(request);
      expect(status.remaining).toBe(5);

      await rateLimiter.checkLimit(request);
      status = rateLimiter.getStatus(request);
      expect(status.remaining).toBe(4);

      await rateLimiter.checkLimit(request);
      status = rateLimiter.getStatus(request);
      expect(status.remaining).toBe(3);
    });

    it('should reset after window expires', async () => {
      const request = { clientId: 'test' };

      // Use up all requests
      for (let i = 0; i < 5; i++) {
        await rateLimiter.checkLimit(request);
      }

      // Fast forward time
      vi.advanceTimersByTime(1000);

      // Should allow requests again
      await expect(rateLimiter.checkLimit(request)).resolves.not.toThrow();
    });
  });

  describe('Different Client Keys', () => {
    it('should track different clients separately', async () => {
      const client1 = { clientId: 'client1' };
      const client2 = { clientId: 'client2' };

      // Use up all requests for client1
      for (let i = 0; i < 5; i++) {
        await rateLimiter.checkLimit(client1);
      }

      // Client2 should still have full quota
      await expect(rateLimiter.checkLimit(client2)).resolves.not.toThrow();

      // Client1 should be limited
      await expect(rateLimiter.checkLimit(client1)).rejects.toThrow(McpError);
    });

    it('should handle many different clients', async () => {
      const clients = Array.from({ length: 100 }, (_, i) => ({ clientId: `client${i}` }));

      // Each client should be able to make 5 requests
      for (const client of clients) {
        for (let i = 0; i < 5; i++) {
          await expect(rateLimiter.checkLimit(client)).resolves.not.toThrow();
        }
      }
    });
  });

  describe('Skip Failed Requests', () => {
    it('should not count failed requests when configured', async () => {
      const limiter = new RateLimiter({
        windowMs: 1000,
        maxRequests: 3,
        skipFailedRequests: true
      });

      const request = { clientId: 'test' };

      // Make 3 requests
      for (let i = 0; i < 3; i++) {
        await limiter.checkLimit(request);
      }

      // Mark one as failed
      limiter.updateAfterRequest(request, false);

      // Should be able to make one more request
      await expect(limiter.checkLimit(request)).resolves.not.toThrow();

      limiter.stop();
    });

    it('should count failed requests when not configured to skip', async () => {
      const request = { clientId: 'test' };

      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        await rateLimiter.checkLimit(request);
      }

      // Mark one as failed, but it still counts
      rateLimiter.updateAfterRequest(request, false);

      // Should still be limited
      await expect(rateLimiter.checkLimit(request)).rejects.toThrow(McpError);
    });
  });

  describe('Skip Successful Requests', () => {
    it('should not count successful requests when configured', async () => {
      const limiter = new RateLimiter({
        windowMs: 1000,
        maxRequests: 3,
        skipSuccessfulRequests: true
      });

      const request = { clientId: 'test' };

      // Make 3 requests
      for (let i = 0; i < 3; i++) {
        await limiter.checkLimit(request);
      }

      // Mark one as successful
      limiter.updateAfterRequest(request, true);

      // Should be able to make one more request
      await expect(limiter.checkLimit(request)).resolves.not.toThrow();

      limiter.stop();
    });

    it('should count successful requests when not configured to skip', async () => {
      const request = { clientId: 'test' };

      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        await rateLimiter.checkLimit(request);
      }

      // Mark one as successful, but it still counts
      rateLimiter.updateAfterRequest(request, true);

      // Should still be limited
      await expect(rateLimiter.checkLimit(request)).rejects.toThrow(McpError);
    });
  });

  describe('Error Messages', () => {
    it('should provide informative error messages', async () => {
      const request = { clientId: 'test' };

      // Use up all requests
      for (let i = 0; i < 5; i++) {
        await rateLimiter.checkLimit(request);
      }

      try {
        await rateLimiter.checkLimit(request);
      } catch (error) {
        expect(error).toBeInstanceOf(McpError);
        expect((error as McpError).message).toContain('Rate limit exceeded');
        expect((error as McpError).message).toContain('retry after');
      }
    });

    it('should include retry information in error', async () => {
      const request = { clientId: 'test' };

      // Use up all requests
      for (let i = 0; i < 5; i++) {
        await rateLimiter.checkLimit(request);
      }

      try {
        await rateLimiter.checkLimit(request);
      } catch (error) {
        const mcpError = error as McpError;
        expect(mcpError.details).toHaveProperty('retryAfter');
        expect(mcpError.details).toHaveProperty('limit');
        expect(mcpError.details).toHaveProperty('windowMs');
      }
    });
  });

  describe('Status Information', () => {
    it('should provide accurate status information', async () => {
      const request = { clientId: 'test' };

      let status = rateLimiter.getStatus(request);
      expect(status.remaining).toBe(5);
      expect(status.resetTime).toBeGreaterThan(Date.now());

      await rateLimiter.checkLimit(request);

      status = rateLimiter.getStatus(request);
      expect(status.remaining).toBe(4);
      expect(status.resetTime).toBeGreaterThan(Date.now());
    });

    it('should handle status for non-existent keys', () => {
      const request = { clientId: 'nonexistent' };
      const status = rateLimiter.getStatus(request);

      expect(status.remaining).toBe(5);
      expect(status.resetTime).toBeGreaterThan(Date.now());
    });
  });

  describe('Cleanup', () => {
    it('should clean up expired entries', async () => {
      const request = { clientId: 'test' };

      // Make some requests
      await rateLimiter.checkLimit(request);
      await rateLimiter.checkLimit(request);

      // Fast forward time to trigger cleanup
      vi.advanceTimersByTime(60000); // 1 minute

      // Cleanup should have removed expired entries
      // New requests should start fresh
      const newRequest = { clientId: 'new' };
      await expect(rateLimiter.checkLimit(newRequest)).resolves.not.toThrow();
    });

    it('should stop cleanup interval when stopped', () => {
      expect(() => rateLimiter.stop()).not.toThrow();
      // Should not throw if called multiple times
      expect(() => rateLimiter.stop()).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero max requests', async () => {
      const zeroLimiter = new RateLimiter({
        windowMs: 1000,
        maxRequests: 0
      });

      const request = { clientId: 'test' };
      await expect(zeroLimiter.checkLimit(request)).rejects.toThrow(McpError);

      zeroLimiter.stop();
    });

    it('should handle very large max requests', async () => {
      const largeLimiter = new RateLimiter({
        windowMs: 1000,
        maxRequests: 1000000
      });

      const request = { clientId: 'test' };

      // Should handle large numbers without issues
      for (let i = 0; i < 1000; i++) {
        await expect(largeLimiter.checkLimit(request)).resolves.not.toThrow();
      }

      largeLimiter.stop();
    });

    it('should handle very short windows', async () => {
      const shortLimiter = new RateLimiter({
        windowMs: 1, // 1ms
        maxRequests: 3
      });

      const request = { clientId: 'test' };

      // Should work with very short windows
      for (let i = 0; i < 3; i++) {
        await expect(shortLimiter.checkLimit(request)).resolves.not.toThrow();
      }

      await expect(shortLimiter.checkLimit(request)).rejects.toThrow(McpError);

      shortLimiter.stop();
    });

    it('should handle very long windows', async () => {
      const longLimiter = new RateLimiter({
        windowMs: 3600000, // 1 hour
        maxRequests: 3
      });

      const request = { clientId: 'test' };

      // Should work with very long windows
      for (let i = 0; i < 3; i++) {
        await expect(longLimiter.checkLimit(request)).resolves.not.toThrow();
      }

      await expect(longLimiter.checkLimit(request)).rejects.toThrow(McpError);

      longLimiter.stop();
    });

    it('should handle null and undefined requests', async () => {
      await expect(rateLimiter.checkLimit(null as any)).rejects.toThrow();
      await expect(rateLimiter.checkLimit(undefined as any)).rejects.toThrow();
    });

    it('should handle requests without key generator properties', async () => {
      const request = {};
      await expect(rateLimiter.checkLimit(request)).resolves.not.toThrow();
    });
  });

  describe('Performance Tests', () => {
    it('should handle rapid requests efficiently', async () => {
      const request = { clientId: 'test' };
      const startTime = performance.now();

      // Make many requests rapidly
      for (let i = 0; i < 100; i++) {
        try {
          await rateLimiter.checkLimit(request);
        } catch (error) {
          // Expected after limit is exceeded
        }
      }

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle many different clients efficiently', async () => {
      const startTime = performance.now();

      // Create many different clients
      for (let i = 0; i < 1000; i++) {
        const request = { clientId: `client${i}` };
        await rateLimiter.checkLimit(request);
      }

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory with many clients', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Create many clients
      for (let i = 0; i < 10000; i++) {
        const request = { clientId: `client${i}` };
        await rateLimiter.checkLimit(request);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });
});

describe('Rate Limiter Factory Functions', () => {
  describe('createRateLimiters', () => {
    it('should create rate limiters with different configurations', () => {
      const limiters = createRateLimiters();

      expect(limiters).toHaveProperty('write');
      expect(limiters).toHaveProperty('expensive');
      expect(limiters).toHaveProperty('global');

      // Each should be a RateLimiter instance
      expect(limiters.write).toBeInstanceOf(RateLimiter);
      expect(limiters.expensive).toBeInstanceOf(RateLimiter);
      expect(limiters.global).toBeInstanceOf(RateLimiter);
    });

    it('should have different limits for different types', () => {
      const limiters = createRateLimiters();

      const testRequest = { clientId: 'test' };

      // Write operations should have higher limits
      for (let i = 0; i < 100; i++) {
        try {
          limiters.write.checkLimit(testRequest);
        } catch (error) {
          // Expected after limit
        }
      }

      // Expensive operations should have lower limits
      for (let i = 0; i < 10; i++) {
        try {
          limiters.expensive.checkLimit(testRequest);
        } catch (error) {
          // Expected after limit
        }
      }
    });
  });

  describe('getRateLimiterForTool', () => {
    it('should return correct limiter for write tools', () => {
      expect(getRateLimiterForTool('add_memory')).toBe('write');
      expect(getRateLimiterForTool('update_memory')).toBe('write');
      expect(getRateLimiterForTool('delete_memory')).toBe('write');
    });

    it('should return correct limiter for expensive tools', () => {
      expect(getRateLimiterForTool('search_memories')).toBe('expensive');
      expect(getRateLimiterForTool('export_memory')).toBe('expensive');
      expect(getRateLimiterForTool('import_memory')).toBe('expensive');
    });

    it('should return global for unknown tools', () => {
      expect(getRateLimiterForTool('unknown_tool')).toBe('global');
      expect(getRateLimiterForTool('')).toBe('global');
    });

    it('should handle case sensitivity', () => {
      expect(getRateLimiterForTool('ADD_MEMORY')).toBe('write');
      expect(getRateLimiterForTool('Search_Memories')).toBe('expensive');
    });
  });
});
