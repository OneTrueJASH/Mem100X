import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BloomFilter } from '../../../dist/utils/bloom-filter.js';
import { createTestEnvironment, TestContext } from '../../helpers/test-utils.js';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';

describe('BloomFilter', () => {
  let testContext: TestContext;
  let bloomFilter: BloomFilter;

  beforeEach(async () => {
    testContext = createTestEnvironment();
    bloomFilter = new BloomFilter(1000, 0.01);
    await bloomFilter.init();
  });

  afterEach(() => {
    testContext.cleanup();
  });

  describe('Initialization', () => {
    it('should initialize with correct parameters', () => {
      const stats = bloomFilter.getStats();
      expect(stats.size).toBeGreaterThan(0);
      expect(stats.numHashes).toBeGreaterThan(0);
      expect(stats.items).toBe(0);
      expect(stats.fillRate).toBe(0);
    });

    it('should calculate optimal size based on false positive rate', () => {
      const smallFilter = new BloomFilter(100, 0.1);
      const largeFilter = new BloomFilter(10000, 0.001);

      expect(largeFilter.getStats().size).toBeGreaterThan(smallFilter.getStats().size);
    });

    it('should handle edge case parameters', () => {
      expect(() => new BloomFilter(0, 0.01)).not.toThrow();
      expect(() => new BloomFilter(1000, 0.001)).not.toThrow();
      expect(() => new BloomFilter(1000, 0.999)).not.toThrow();
    });
  });

  describe('Basic Operations', () => {
    it('should add and contain items correctly', () => {
      const items = ['test1', 'test2', 'test3'];

      items.forEach(item => bloomFilter.add(item));

      items.forEach(item => {
        expect(bloomFilter.contains(item)).toBe(true);
      });
    });

    it('should not contain items that were not added', () => {
      bloomFilter.add('test1');
      bloomFilter.add('test2');

      expect(bloomFilter.contains('test3')).toBe(false);
      expect(bloomFilter.contains('nonexistent')).toBe(false);
    });

    it('should handle empty string', () => {
      bloomFilter.add('');
      expect(bloomFilter.contains('')).toBe(true);
    });

    it('should handle special characters', () => {
      const specialItems = [
        'test with spaces',
        'test-with-dashes',
        'test_with_underscores',
        'test123',
        'test!@#$%^&*()',
        'test\n\t\r',
        'test\u0000\u0001'
      ];

      specialItems.forEach(item => bloomFilter.add(item));

      specialItems.forEach(item => {
        expect(bloomFilter.contains(item)).toBe(true);
      });
    });

    it('should handle unicode characters', () => {
      const unicodeItems = [
        'test with émojis 🚀',
        'test with 中文',
        'test with русский',
        'test with العربية',
        'test with हिन्दी'
      ];

      unicodeItems.forEach(item => bloomFilter.add(item));

      unicodeItems.forEach(item => {
        expect(bloomFilter.contains(item)).toBe(true);
      });
    });
  });

  describe('False Positive Rate', () => {
    it('should maintain acceptable false positive rate', () => {
      const filter = new BloomFilter(1000, 0.01);
      const addedItems = new Set<string>();
      const testItems = new Set<string>();

      // Add 1000 items
      for (let i = 0; i < 1000; i++) {
        const item = `item${i}`;
        filter.add(item);
        addedItems.add(item);
      }

      // Test 1000 different items
      let falsePositives = 0;
      for (let i = 1000; i < 2000; i++) {
        const item = `test${i}`;
        testItems.add(item);
        if (filter.contains(item)) {
          falsePositives++;
        }
      }

      const falsePositiveRate = falsePositives / testItems.size;
      expect(falsePositiveRate).toBeLessThan(0.05); // Allow 5% tolerance
    });

    it('should handle different false positive rate configurations', () => {
      const lowRateFilter = new BloomFilter(1000, 0.001);
      const highRateFilter = new BloomFilter(1000, 0.1);

      // Add same items to both filters
      for (let i = 0; i < 500; i++) {
        const item = `item${i}`;
        lowRateFilter.add(item);
        highRateFilter.add(item);
      }

      // Test false positives
      let lowRateFalsePositives = 0;
      let highRateFalsePositives = 0;

      for (let i = 500; i < 1000; i++) {
        const item = `test${i}`;
        if (lowRateFilter.contains(item)) lowRateFalsePositives++;
        if (highRateFilter.contains(item)) highRateFalsePositives++;
      }

      // High rate filter should have more false positives
      expect(highRateFalsePositives).toBeGreaterThanOrEqual(lowRateFalsePositives);
    });
  });

  describe('Performance Tests', () => {
    it('should handle large number of items efficiently', () => {
      const startTime = performance.now();

      // Add 10,000 items
      for (let i = 0; i < 10000; i++) {
        bloomFilter.add(`item${i}`);
      }

      const addTime = performance.now() - startTime;
      expect(addTime).toBeLessThan(1000); // Should complete within 1 second

      // Test lookup performance
      const lookupStart = performance.now();
      for (let i = 0; i < 1000; i++) {
        bloomFilter.contains(`item${i}`);
      }

      const lookupTime = performance.now() - lookupStart;
      expect(lookupTime).toBeLessThan(100); // Should complete within 100ms
    });

    it('should maintain O(1) lookup performance', () => {
      // Add items
      for (let i = 0; i < 1000; i++) {
        bloomFilter.add(`item${i}`);
      }

      const times: number[] = [];

      // Measure lookup times
      for (let i = 0; i < 100; i++) {
        const start = performance.now();
        bloomFilter.contains(`item${i}`);
        times.push(performance.now() - start);
      }

      // All lookups should be fast and consistent
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);

      expect(avgTime).toBeLessThan(1); // Average under 1ms
      expect(maxTime).toBeLessThan(5); // Max under 5ms
    });
  });

  describe('Edge Cases', () => {
    it('should handle duplicate additions', () => {
      bloomFilter.add('test');
      bloomFilter.add('test'); // Duplicate

      expect(bloomFilter.contains('test')).toBe(true);
      expect(bloomFilter.getStats().items).toBe(2);
    });

    it('should handle very long strings', () => {
      const longString = 'a'.repeat(10000);
      bloomFilter.add(longString);

      expect(bloomFilter.contains(longString)).toBe(true);
    });

    it('should handle null and undefined gracefully', () => {
      expect(() => bloomFilter.add(null as any)).toThrow();
      expect(() => bloomFilter.add(undefined as any)).toThrow();
      expect(() => bloomFilter.contains(null as any)).toThrow();
      expect(() => bloomFilter.contains(undefined as any)).toThrow();
    });

    it('should handle non-string inputs', () => {
      expect(() => bloomFilter.add(123 as any)).toThrow();
      expect(() => bloomFilter.add({} as any)).toThrow();
      expect(() => bloomFilter.add([] as any)).toThrow();
    });

    it('should handle filter saturation', () => {
      const smallFilter = new BloomFilter(10, 0.01);

      // Add more items than the filter was designed for
      for (let i = 0; i < 100; i++) {
        smallFilter.add(`item${i}`);
      }

      // Should still work, but with higher false positive rate
      expect(smallFilter.contains('item0')).toBe(true);
    });
  });

  describe('Statistics', () => {
    it('should track item count correctly', () => {
      expect(bloomFilter.getStats().items).toBe(0);

      bloomFilter.add('item1');
      expect(bloomFilter.getStats().items).toBe(1);

      bloomFilter.add('item2');
      expect(bloomFilter.getStats().items).toBe(2);
    });

    it('should calculate fill rate correctly', () => {
      const stats = bloomFilter.getStats();
      expect(stats.fillRate).toBe(0);

      // Add items and check fill rate increases
      for (let i = 0; i < 100; i++) {
        bloomFilter.add(`item${i}`);
      }

      const newStats = bloomFilter.getStats();
      expect(newStats.fillRate).toBeGreaterThan(0);
      expect(newStats.fillRate).toBeLessThanOrEqual(1);
    });

    it('should provide accurate size information', () => {
      const stats = bloomFilter.getStats();
      expect(stats.size).toBeGreaterThan(0);
      expect(stats.numHashes).toBeGreaterThan(0);
      expect(stats.numHashes).toBeLessThanOrEqual(stats.size);
    });
  });

  describe('Serialization', () => {
    it('should serialize and deserialize correctly', async () => {
      // Add some items
      bloomFilter.add('item1');
      bloomFilter.add('item2');
      bloomFilter.add('item3');

      // Serialize
      const buffer = bloomFilter.serialize();
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);

              // Deserialize
        const deserialized = BloomFilter.deserialize(buffer);
        expect(deserialized).toBeInstanceOf(BloomFilter);
        await deserialized.init();

        // Check items are preserved
        expect(deserialized.contains('item1')).toBe(true);
      expect(deserialized.contains('item2')).toBe(true);
      expect(deserialized.contains('item3')).toBe(true);
      expect(deserialized.contains('nonexistent')).toBe(false);

      // Check stats are preserved
      const originalStats = bloomFilter.getStats();
      const deserializedStats = deserialized.getStats();
      expect(deserializedStats.items).toBe(originalStats.items);
      expect(deserializedStats.size).toBe(originalStats.size);
      expect(deserializedStats.numHashes).toBe(originalStats.numHashes);
    });

    it('should handle empty filter serialization', () => {
      const buffer = bloomFilter.serialize();
      const deserialized = BloomFilter.deserialize(buffer);

      expect(deserialized.getStats().items).toBe(0);
      expect(deserialized.contains('any')).toBe(false);
    });
  });

  describe('File Operations', () => {
    it('should save and load from file', async () => {
      // Add items
      bloomFilter.add('item1');
      bloomFilter.add('item2');

      const filePath = join(testContext.tempDir, 'bloom-filter.bin');

      // Save to file
      await bloomFilter.saveToFile(filePath);
      expect(existsSync(filePath)).toBe(true);

      // Load from file
      const loaded = await BloomFilter.loadFromFile(filePath);
      expect(loaded).toBeInstanceOf(BloomFilter);
      expect(loaded!.contains('item1')).toBe(true);
      expect(loaded!.contains('item2')).toBe(true);

      // Cleanup
      unlinkSync(filePath);
    });

    it('should handle non-existent file', async () => {
      const result = await BloomFilter.loadFromFile('nonexistent.bin');
      expect(result).toBeNull();
    });

    it('should handle corrupted file', async () => {
      const filePath = join(testContext.tempDir, 'corrupted.bin');
      writeFileSync(filePath, 'corrupted data');

      const result = await BloomFilter.loadFromFile(filePath);
      expect(result).toBeNull();

      unlinkSync(filePath);
    });
  });

  describe('Clear Operation', () => {
    it('should clear all items', () => {
      bloomFilter.add('item1');
      bloomFilter.add('item2');

      expect(bloomFilter.getStats().items).toBe(2);
      expect(bloomFilter.contains('item1')).toBe(true);

      bloomFilter.clear();

      expect(bloomFilter.getStats().items).toBe(0);
      expect(bloomFilter.contains('item1')).toBe(false);
      expect(bloomFilter.contains('item2')).toBe(false);
    });

    it('should reset fill rate after clear', () => {
      for (let i = 0; i < 100; i++) {
        bloomFilter.add(`item${i}`);
      }

      expect(bloomFilter.getStats().fillRate).toBeGreaterThan(0);

      bloomFilter.clear();

      expect(bloomFilter.getStats().fillRate).toBe(0);
    });
  });

  describe('Hash Function Consistency', () => {
    it('should produce consistent hashes for same input', () => {
      const item = 'test item';
      bloomFilter.add(item);

      // Create new filter and add same item
      const newFilter = new BloomFilter(1000, 0.01);
      newFilter.add(item);

      // Both should contain the item
      expect(bloomFilter.contains(item)).toBe(true);
      expect(newFilter.contains(item)).toBe(true);
    });

    it('should handle hash collisions gracefully', () => {
      // This test verifies that the bloom filter handles potential hash collisions
      // by using multiple hash functions
      const items = ['item1', 'item2', 'item3', 'item4', 'item5'];

      items.forEach(item => bloomFilter.add(item));

      // All added items should be present
      items.forEach(item => {
        expect(bloomFilter.contains(item)).toBe(true);
      });

      // Check that the filter uses multiple hash functions
      const stats = bloomFilter.getStats();
      expect(stats.numHashes).toBeGreaterThan(1);
    });
  });
});
