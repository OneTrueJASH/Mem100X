import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CompressionUtils } from '../../../dist/utils/compression.js';
import { createTestEnvironment, TestContext } from '../../helpers/test-utils.js';
import { createTextContent } from '../../../dist/utils/fast-json.js';

describe('CompressionUtils', () => {
  let testContext: TestContext;

  beforeEach(() => {
    testContext = createTestEnvironment();
  });

  afterEach(() => {
    testContext.cleanup();
  });

  describe('Compression Decision', () => {
    it('should not compress short strings', () => {
      const shortText = 'This is a short text';
      expect(CompressionUtils.shouldCompress(shortText)).toBe(false);
    });

    it('should compress long strings', () => {
      const longText = 'a'.repeat(200);
      expect(CompressionUtils.shouldCompress(longText)).toBe(true);
    });

    it('should handle boundary conditions', () => {
      const boundaryText = 'a'.repeat(100);
      expect(CompressionUtils.shouldCompress(boundaryText)).toBe(false);

      const boundaryTextPlusOne = 'a'.repeat(101);
      expect(CompressionUtils.shouldCompress(boundaryTextPlusOne)).toBe(true);
    });
  });

  describe('Single String Compression', () => {
    it('should compress and decompress text correctly', () => {
      const originalText = 'This is a very long text that should be compressed. '.repeat(50);

      const compressed = CompressionUtils.compress(originalText);
      const decompressed = CompressionUtils.decompress(compressed);

      expect(decompressed).toBe(originalText);
    });

    it('should handle empty string', () => {
      const compressed = CompressionUtils.compress('');
      const decompressed = CompressionUtils.decompress(compressed);

      expect(decompressed).toBe('');
    });

    it('should handle unicode characters', () => {
      const unicodeText = '🚀 émojis and unicode: 中文, русский, العربية, हिन्दी '.repeat(20);

      const compressed = CompressionUtils.compress(unicodeText);
      const decompressed = CompressionUtils.decompress(compressed);

      expect(decompressed).toBe(unicodeText);
    });

    it('should handle special characters', () => {
      const specialText = '!@#$%^&*()_+-=[]{}|;:,.<>? '.repeat(30);

      const compressed = CompressionUtils.compress(specialText);
      const decompressed = CompressionUtils.decompress(compressed);

      expect(decompressed).toBe(specialText);
    });
  });

  describe('Observations Compression', () => {
    it('should compress observations with large text content', () => {
      const observations = [
        createTextContent('Short text'),
        createTextContent('a'.repeat(200)), // Should be compressed
        createTextContent('Another short text')
      ];

      const compressed = CompressionUtils.compressObservations(observations);
      const decompressed = CompressionUtils.decompressObservations(compressed);

      expect(decompressed).toHaveLength(3);
      expect(decompressed[0].type).toBe('text');
      expect(decompressed[0].text).toBe('Short text');
      expect(decompressed[1].type).toBe('text');
      expect(decompressed[1].text).toBe('a'.repeat(200));
      expect(decompressed[2].type).toBe('text');
      expect(decompressed[2].text).toBe('Another short text');
    });

    it('should not compress observations with small text content', () => {
      const observations = [
        createTextContent('Short text 1'),
        createTextContent('Short text 2'),
        createTextContent('Short text 3')
      ];

      const compressed = CompressionUtils.compressObservations(observations);
      const decompressed = CompressionUtils.decompressObservations(compressed);

      expect(decompressed).toEqual(observations);
    });

    it('should handle mixed content types', () => {
      const observations = [
        createTextContent('Short text'),
        { type: 'image', data: 'base64-image-data', mimeType: 'image/jpeg' },
        createTextContent('a'.repeat(200))
      ];

      const compressed = CompressionUtils.compressObservations(observations);
      const decompressed = CompressionUtils.decompressObservations(compressed);

      expect(decompressed).toHaveLength(3);
      expect(decompressed[0].type).toBe('text');
      expect(decompressed[0].text).toBe('Short text');
      expect(decompressed[1].type).toBe('image');
      expect(decompressed[1].data).toBe('base64-image-data');
      expect(decompressed[1].mimeType).toBe('image/jpeg');
      expect(decompressed[2].type).toBe('text');
      expect(decompressed[2].text).toBe('a'.repeat(200));
    });

    it('should handle empty observations array', () => {
      const observations: any[] = [];

      const compressed = CompressionUtils.compressObservations(observations);
      const decompressed = CompressionUtils.decompressObservations(compressed);

      expect(decompressed).toEqual([]);
    });
  });

  describe('Compression Ratio', () => {
    it('should calculate compression ratio correctly', () => {
      const original = 'a'.repeat(1000);
      const compressed = CompressionUtils.compress(original);

      const ratio = CompressionUtils.getCompressionRatio(original, compressed);

      expect(ratio).toBeLessThan(1); // Should be compressed
      expect(ratio).toBeGreaterThan(0);
    });

    it('should handle cases where compression doesn\'t help', () => {
      const original = 'abc'; // Very short, won't compress well
      const compressed = CompressionUtils.compress(original);

      const ratio = CompressionUtils.getCompressionRatio(original, compressed);

      expect(ratio).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle compression errors gracefully', () => {
      // Mock gzipSync to throw an error
      const originalGzipSync = require('zlib').gzipSync;
      require('zlib').gzipSync = vi.fn().mockImplementation(() => {
        throw new Error('Compression failed');
      });

      const observations = [
        createTextContent('a'.repeat(200))
      ];

      // Should fall back to uncompressed
      const result = CompressionUtils.compressObservations(observations);
      const decompressed = CompressionUtils.decompressObservations(result);

      expect(decompressed[0].text).toBe('a'.repeat(200));

      // Restore original function
      require('zlib').gzipSync = originalGzipSync;
    });

    it('should handle decompression errors gracefully', () => {
      const invalidCompressed = 'COMPRESSED:1:invalid-base64-data';

      const observations = [
        { type: 'text', text: invalidCompressed }
      ];

      const decompressed = CompressionUtils.decompressObservations(JSON.stringify(observations));

      // Should return original content on decompression error
      expect(decompressed[0].text).toBe(invalidCompressed);
    });

    it('should handle malformed compressed data', () => {
      const malformedData = 'COMPRESSED:invalid-format';

      const observations = [
        { type: 'text', text: malformedData }
      ];

      const decompressed = CompressionUtils.decompressObservations(JSON.stringify(observations));

      expect(decompressed[0].text).toBe(malformedData);
    });
  });

  describe('Versioned Compression Format', () => {
    it('should handle versioned compression format', () => {
      const originalText = 'a'.repeat(200);
      const compressed = CompressionUtils.compress(originalText);

      // Should use versioned format
      expect(compressed).toMatch(/^[A-Za-z0-9+/=]+$/); // Base64 format
    });

    it('should handle different compression versions', () => {
      const observations = [
        { type: 'text', text: 'COMPRESSED:1:base64data' },
        { type: 'text', text: 'COMPRESSED:2:base64data' }
      ];

      const decompressed = CompressionUtils.decompressObservations(JSON.stringify(observations));

      // Should handle both versions gracefully
      expect(decompressed[0].text).toBe('COMPRESSED:1:base64data');
      expect(decompressed[1].text).toBe('COMPRESSED:2:base64data');
    });
  });

  describe('Performance Tests', () => {
    it('should compress large data efficiently', () => {
      const largeText = 'This is a very large text that should be compressed efficiently. '.repeat(1000);

      const startTime = performance.now();
      const compressed = CompressionUtils.compress(largeText);
      const compressionTime = performance.now() - startTime;

      expect(compressionTime).toBeLessThan(100); // Should complete within 100ms
      expect(compressed.length).toBeLessThan(largeText.length);
    });

    it('should decompress large data efficiently', () => {
      const largeText = 'This is a very large text that should be compressed efficiently. '.repeat(1000);
      const compressed = CompressionUtils.compress(largeText);

      const startTime = performance.now();
      const decompressed = CompressionUtils.decompress(compressed);
      const decompressionTime = performance.now() - startTime;

      expect(decompressionTime).toBeLessThan(100); // Should complete within 100ms
      expect(decompressed).toBe(largeText);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null and undefined inputs', () => {
      expect(() => CompressionUtils.compress(null as any)).toThrow();
      expect(() => CompressionUtils.compress(undefined as any)).toThrow();
      expect(() => CompressionUtils.decompress(null as any)).toThrow();
      expect(() => CompressionUtils.decompress(undefined as any)).toThrow();
    });

    it('should handle very long strings', () => {
      const veryLongText = 'a'.repeat(100000);

      const compressed = CompressionUtils.compress(veryLongText);
      const decompressed = CompressionUtils.decompress(compressed);

      expect(decompressed).toBe(veryLongText);
    });

    it('should handle strings with many repeated patterns', () => {
      const repetitiveText = 'abcdefghijklmnopqrstuvwxyz'.repeat(100);

      const compressed = CompressionUtils.compress(repetitiveText);
      const decompressed = CompressionUtils.decompress(compressed);

      expect(decompressed).toBe(repetitiveText);
      expect(compressed.length).toBeLessThan(repetitiveText.length);
    });

    it('should handle strings with random data', () => {
      const randomText = Array.from({ length: 1000 }, () =>
        String.fromCharCode(Math.floor(Math.random() * 256))
      ).join('');

      const compressed = CompressionUtils.compress(randomText);
      const decompressed = CompressionUtils.decompress(compressed);

      expect(decompressed).toBe(randomText);
    });
  });

  describe('Data Integrity', () => {
    it('should preserve exact byte content', () => {
      const testCases = [
        'Hello, World!',
        '🚀 émojis and unicode: 中文, русский, العربية, हिन्दी',
        'Special chars: !@#$%^&*()_+-=[]{}|;:,.<>?',
        'Newlines:\n\t\r\n',
        'Null bytes:\u0000\u0001\u0002',
        'a'.repeat(1000),
        'Mixed content: 123 🚀 abc !@# \n\t'
      ];

      for (const testCase of testCases) {
        const compressed = CompressionUtils.compress(testCase);
        const decompressed = CompressionUtils.decompress(compressed);

        expect(decompressed).toBe(testCase);
      }
    });

    it('should handle round-trip compression multiple times', () => {
      const originalText = 'This is a test text that will be compressed multiple times. '.repeat(50);

      let currentText = originalText;

      // Compress and decompress multiple times
      for (let i = 0; i < 5; i++) {
        const compressed = CompressionUtils.compress(currentText);
        currentText = CompressionUtils.decompress(compressed);
      }

      expect(currentText).toBe(originalText);
    });
  });
});
