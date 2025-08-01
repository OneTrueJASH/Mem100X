import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LRUCache } from '../../../dist/utils/lru-cache.js';
import { createTestEnvironment, TestContext } from '../../helpers/test-utils.js';

describe('LRUCache', () => {
  let testContext: TestContext;
  let cache: LRUCache<string, number>;

  beforeEach(() => {
    testContext = createTestEnvironment();
    cache = new LRUCache<string, number>(3);
  });

  afterEach(() => {
    testContext.cleanup();
  });

  describe('Initialization', () => {
    it('should initialize with correct size', () => {
      const stats = cache.getStats();
      expect(stats.size).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
    });

    it('should handle different max sizes', () => {
      const smallCache = new LRUCache<string, number>(1);
      const largeCache = new LRUCache<string, number>(1000);

      expect(smallCache.getStats().size).toBe(0);
      expect(largeCache.getStats().size).toBe(0);
    });

    it('should handle zero size cache', () => {
      const zeroCache = new LRUCache<string, number>(0);
      expect(zeroCache.getStats().size).toBe(0);
    });
  });

  describe('Basic Operations', () => {
    it('should set and get values correctly', () => {
      cache.set('key1', 100);
      cache.set('key2', 200);

      expect(cache.get('key1')).toBe(100);
      expect(cache.get('key2')).toBe(200);
    });

    it('should return undefined for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should update existing values', () => {
      cache.set('key1', 100);
      cache.set('key1', 150);

      expect(cache.get('key1')).toBe(150);
    });

    it('should handle different data types', () => {
      const stringCache = new LRUCache<string, string>(2);
      const objectCache = new LRUCache<string, object>(2);

      stringCache.set('str', 'value');
      objectCache.set('obj', { key: 'value' });

      expect(stringCache.get('str')).toBe('value');
      expect(objectCache.get('obj')).toEqual({ key: 'value' });
    });
  });

  describe('LRU Eviction', () => {
    it('should evict least recently used item when capacity is exceeded', () => {
      cache.set('key1', 100);
      cache.set('key2', 200);
      cache.set('key3', 300);
      cache.set('key4', 400); // Should evict key1

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBe(200);
      expect(cache.get('key3')).toBe(300);
      expect(cache.get('key4')).toBe(400);
    });

    it('should update access order when getting items', () => {
      cache.set('key1', 100);
      cache.set('key2', 200);
      cache.set('key3', 300);

      // Access key1 to make it most recently used
      cache.get('key1');

      // Add new item, should evict key2 (now least recently used)
      cache.set('key4', 400);

      expect(cache.get('key1')).toBe(100);
      expect(cache.get('key2')).toBeUndefined();
      expect(cache.get('key3')).toBe(300);
      expect(cache.get('key4')).toBe(400);
    });

    it('should update access order when setting existing items', () => {
      cache.set('key1', 100);
      cache.set('key2', 200);
      cache.set('key3', 300);

      // Update key1 to make it most recently used
      cache.set('key1', 150);

      // Add new item, should evict key2 (now least recently used)
      cache.set('key4', 400);

      expect(cache.get('key1')).toBe(150);
      expect(cache.get('key2')).toBeUndefined();
      expect(cache.get('key3')).toBe(300);
      expect(cache.get('key4')).toBe(400);
    });

    it('should handle single item cache correctly', () => {
      const singleCache = new LRUCache<string, number>(1);

      singleCache.set('key1', 100);
      expect(singleCache.get('key1')).toBe(100);

      singleCache.set('key2', 200);
      expect(singleCache.get('key1')).toBeUndefined();
      expect(singleCache.get('key2')).toBe(200);
    });
  });

  describe('Cache Statistics', () => {
    it('should track hits and misses correctly', () => {
      cache.set('key1', 100);

      // Hit
      cache.get('key1');
      expect(cache.getStats().hits).toBe(1);
      expect(cache.getStats().misses).toBe(0);

      // Miss
      cache.get('nonexistent');
      expect(cache.getStats().hits).toBe(1);
      expect(cache.getStats().misses).toBe(1);
    });

    it('should calculate hit rate correctly', () => {
      cache.set('key1', 100);

      cache.get('key1'); // Hit
      cache.get('key1'); // Hit
      cache.get('nonexistent'); // Miss

      const stats = cache.getStats();
      expect(stats.hitRate).toBe(2 / 3); // 2 hits out of 3 total requests
    });

    it('should track size correctly', () => {
      expect(cache.getStats().size).toBe(0);

      cache.set('key1', 100);
      expect(cache.getStats().size).toBe(1);

      cache.set('key2', 200);
      expect(cache.getStats().size).toBe(2);

      cache.set('key3', 300);
      expect(cache.getStats().size).toBe(3);

      // Adding more should not increase size due to eviction
      cache.set('key4', 400);
      expect(cache.getStats().size).toBe(3);
    });
  });

  describe('Delete Operations', () => {
    it('should delete items correctly', () => {
      cache.set('key1', 100);
      cache.set('key2', 200);

      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBe(200);
      expect(cache.getStats().size).toBe(1);
    });

    it('should return false for non-existent keys', () => {
      expect(cache.delete('nonexistent')).toBe(false);
    });

    it('should handle deleting from empty cache', () => {
      expect(cache.delete('any')).toBe(false);
    });

    it('should handle deleting last item', () => {
      cache.set('key1', 100);
      expect(cache.delete('key1')).toBe(true);
      expect(cache.getStats().size).toBe(0);
    });

    it('should maintain LRU order after deletion', () => {
      cache.set('key1', 100);
      cache.set('key2', 200);
      cache.set('key3', 300);

      // Delete middle item
      cache.delete('key2');

      // Check cache size after deletion
      expect(cache.getStats().size).toBe(2);

      // Add new item, should not evict anything since cache size is under limit
      cache.set('key4', 400);

      expect(cache.get('key1')).toBe(100);
      expect(cache.get('key3')).toBe(300);
      expect(cache.get('key4')).toBe(400);
    });
  });

  describe('Clear Operations', () => {
    it('should clear all items', () => {
      cache.set('key1', 100);
      cache.set('key2', 200);

      cache.clear();

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
      expect(cache.getStats().size).toBe(0);
    });

    it('should reset statistics after clear', () => {
      cache.set('key1', 100);
      cache.get('key1'); // Hit
      cache.get('nonexistent'); // Miss

      cache.clear();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
      expect(stats.size).toBe(0);
    });

    it('should handle clearing empty cache', () => {
      expect(() => cache.clear()).not.toThrow();
      expect(cache.getStats().size).toBe(0);
    });
  });

  describe('Has Operations', () => {
    it('should check existence without affecting LRU order', () => {
      cache.set('key1', 100);
      cache.set('key2', 200);
      cache.set('key3', 300);

      // Check existence - this should NOT move key1 to the front
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('nonexistent')).toBe(false);

      // Add new item - since cache size is 3, this should evict the least recently used item
      // key1 should be evicted because it was accessed first (set first)
      cache.set('key4', 400);

      // key1 should be evicted (least recently used)
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBe(200);
      expect(cache.get('key3')).toBe(300);
      expect(cache.get('key4')).toBe(400);
    });

    it('should handle has on empty cache', () => {
      expect(cache.has('any')).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null and undefined keys', () => {
      expect(() => cache.set(null as any, 100)).not.toThrow();
      expect(() => cache.set(undefined as any, 100)).not.toThrow();
      expect(() => cache.get(null as any)).not.toThrow();
      expect(() => cache.get(undefined as any)).not.toThrow();
    });

    it('should handle null and undefined values', () => {
      cache.set('key1', null as any);
      cache.set('key2', undefined as any);

      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeUndefined();
    });

    it('should handle very large cache sizes', () => {
      const largeCache = new LRUCache<string, number>(100000);

      for (let i = 0; i < 1000; i++) {
        largeCache.set(`key${i}`, i);
      }

      expect(largeCache.getStats().size).toBe(1000);
      expect(largeCache.get('key500')).toBe(500);
    });

    it('should handle rapid set/get operations', () => {
      for (let i = 0; i < 100; i++) {
        cache.set(`key${i}`, i);
        cache.get(`key${i}`);
      }

      expect(cache.getStats().size).toBe(3); // Max size
      expect(cache.getStats().hits).toBe(100);
    });

    it('should handle circular references in values', () => {
      const obj: any = { key: 'value' };
      obj.self = obj; // Circular reference

      cache.set('circular', obj);
      const retrieved = cache.get('circular');

      expect(retrieved).toBe(obj);
      expect((retrieved as any).self).toBe(obj);
    });
  });

  describe('Performance Tests', () => {
    it('should handle large number of operations efficiently', () => {
      const startTime = performance.now();

      // Perform 10,000 operations
      for (let i = 0; i < 10000; i++) {
        cache.set(`key${i}`, i);
        cache.get(`key${i}`);
      }

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should maintain O(1) operations', () => {
      const times: number[] = [];

      // Measure set operations
      for (let i = 0; i < 100; i++) {
        const start = performance.now();
        cache.set(`key${i}`, i);
        times.push(performance.now() - start);
      }

      const avgSetTime = times.reduce((a, b) => a + b, 0) / times.length;
      expect(avgSetTime).toBeLessThan(1); // Average under 1ms

      // Measure get operations
      const getTimes: number[] = [];
      for (let i = 0; i < 100; i++) {
        const start = performance.now();
        cache.get(`key${i}`);
        getTimes.push(performance.now() - start);
      }

      const avgGetTime = getTimes.reduce((a, b) => a + b, 0) / getTimes.length;
      expect(avgGetTime).toBeLessThan(1); // Average under 1ms
    });

    it('should handle eviction performance under load', () => {
      const smallCache = new LRUCache<string, number>(10);

      const startTime = performance.now();

      // Continuously add items to trigger evictions
      for (let i = 0; i < 1000; i++) {
        smallCache.set(`key${i}`, i);
      }

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(100); // Should complete within 100ms
      expect(smallCache.getStats().size).toBe(10);
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory during eviction', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many operations to trigger evictions
      for (let i = 0; i < 10000; i++) {
        cache.set(`key${i}`, i);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });

    it('should handle cache with large values', () => {
      const largeString = 'x'.repeat(10000);

      for (let i = 0; i < 100; i++) {
        cache.set(`key${i}`, largeString as any);
      }

      expect(cache.getStats().size).toBe(3); // Max size maintained
      expect(cache.get('key99')).toBe(largeString);
    });
  });

  describe('Concurrent Access Simulation', () => {
    it('should handle rapid concurrent-like operations', () => {
      const operations: Array<() => void> = [];

      // Create many operations
      for (let i = 0; i < 1000; i++) {
        operations.push(() => cache.set(`key${i}`, i));
        operations.push(() => cache.get(`key${i}`));
        operations.push(() => cache.has(`key${i}`));
      }

      // Execute operations rapidly
      const startTime = performance.now();
      operations.forEach(op => op());
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(cache.getStats().size).toBe(3); // Max size maintained
    });
  });

  describe('Cache Consistency', () => {
    it('should maintain consistency after complex operations', () => {
      // Add items
      cache.set('key1', 100);
      cache.set('key2', 200);
      cache.set('key3', 300);

      // Access items to change order
      cache.get('key1');
      cache.get('key3');

      // Delete and add
      cache.delete('key2');
      cache.set('key4', 400);

      // Verify final state
      expect(cache.get('key1')).toBe(100);
      expect(cache.get('key2')).toBeUndefined();
      expect(cache.get('key3')).toBe(300);
      expect(cache.get('key4')).toBe(400);
      expect(cache.getStats().size).toBe(3);
    });

    it('should handle boundary conditions correctly', () => {
      // Test exactly at capacity
      cache.set('key1', 100);
      cache.set('key2', 200);
      cache.set('key3', 300);

      expect(cache.getStats().size).toBe(3);

      // Add one more to trigger eviction
      cache.set('key4', 400);

      expect(cache.getStats().size).toBe(3);
      expect(cache.get('key1')).toBeUndefined(); // Should be evicted
    });
  });
});
