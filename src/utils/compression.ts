/**
 * High-Performance Compression Utilities
 * Using built-in zlib for observation compression
 */

import { gzipSync, gunzipSync } from 'zlib';
import { stringifyObservations, parseObservations } from './fast-json.js';

export class CompressionUtils {
  private static readonly MIN_COMPRESS_LENGTH = 100; // Don't compress small strings
  private static readonly COMPRESSION_VERSION = 1;
  
  /**
   * Compress observations array to save space
   * Only compresses if it saves space
   */
  static compressObservations(observations: string[]): string {
    const json = stringifyObservations(observations);
    
    // Skip compression for small data
    if (json.length < this.MIN_COMPRESS_LENGTH) {
      return json;
    }
    
    try {
      // Compress individual large observations
      const processedObservations = observations.map((obs, index) => {
        if (obs.length > this.MIN_COMPRESS_LENGTH) {
          const compressed = gzipSync(obs);
          const base64 = compressed.toString('base64');
          if (base64.length < obs.length) {
            return `COMPRESSED:${this.COMPRESSION_VERSION}:${base64}`;
          }
        }
        return obs;
      });
      
      return stringifyObservations(processedObservations);
    } catch (error) {
      // Fall back to uncompressed on error
      console.error('Compression error:', error);
    }
    
    return json;
  }
  
  /**
   * Decompress observations if compressed
   */
  static decompressObservations(data: string): string[] {
    const observations = parseObservations(data);
    
    return observations.map((obs: string) => {
      if (obs.startsWith('COMPRESSED:')) {
        try {
          // Handle versioned format: COMPRESSED:1:base64data
          const parts = obs.split(':');
          if (parts.length >= 3) {
            const base64 = parts.slice(2).join(':'); // Handle colons in base64
            const compressed = Buffer.from(base64, 'base64');
            return gunzipSync(compressed).toString();
          }
        } catch (error) {
          console.error('Decompression error:', error);
          return obs; // Return original if decompression fails
        }
      }
      return obs;
    });
  }
  
  /**
   * Calculate compression ratio
   */
  static getCompressionRatio(original: string, compressed: string): number {
    return compressed.length / original.length;
  }
  
  /**
   * Check if text should be compressed
   */
  static shouldCompress(text: string): boolean {
    return text.length > this.MIN_COMPRESS_LENGTH;
  }
  
  /**
   * Compress a single string
   */
  static compress(text: string): string {
    try {
      const compressed = gzipSync(text);
      return compressed.toString('base64');
    } catch (error) {
      throw new Error(`Compression failed: ${error}`);
    }
  }
  
  /**
   * Decompress a single string
   */
  static decompress(compressed: string): string {
    try {
      const buffer = Buffer.from(compressed, 'base64');
      return gunzipSync(buffer).toString();
    } catch (error) {
      throw new Error(`Decompression failed: ${error}`);
    }
  }
}