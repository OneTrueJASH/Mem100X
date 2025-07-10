/**
 * Unified cache interface for all cache implementations
 * Allows seamless switching between LRU, 2Q, ARC, and RadixTree caches
 */

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  [key: string]: any; // Allow implementation-specific stats
}

export interface ICache<K, V> {
  get(key: K): V | undefined;
  set(key: K, value: V): void;
  has(key: K): boolean;
  delete(key: K): boolean;
  clear(): void;
  getStats(): CacheStats;
}

export type CacheStrategy = 'lru' | '2q' | 'arc' | 'radix';

// Cache factory
import { LRUCache } from './lru-cache.js';
import { TwoQueueCache } from './two-queue-cache.js';
import { ARCCache } from './arc-cache.js';
import { RadixTreeCache } from './radix-tree-cache.js';

export function createCache<K, V>(
  strategy: CacheStrategy,
  maxSize: number
): ICache<K, V> {
  switch (strategy) {
    case 'lru':
      return new LRUCache<K, V>(maxSize);
    case '2q':
      return new TwoQueueCache<K, V>(maxSize);
    case 'arc':
      return new ARCCache<K, V>(maxSize);
    case 'radix':
      // RadixTree only works with string keys - fallback to LRU for non-string keys
      return new LRUCache<K, V>(maxSize);
    default:
      // Default to LRU for unknown strategies
      return new LRUCache<K, V>(maxSize);
  }
}

// Specialized factory for string-key caches (common in entity storage)
export function createStringCache<V>(
  strategy: CacheStrategy,
  maxSize: number
): ICache<string, V> {
  switch (strategy) {
    case 'lru':
      return new LRUCache<string, V>(maxSize);
    case '2q':
      return new TwoQueueCache<string, V>(maxSize);
    case 'arc':
      return new ARCCache<string, V>(maxSize);
    case 'radix':
      return new RadixTreeCache<V>(maxSize) as ICache<string, V>;
    default:
      // Default to LRU for unknown strategies
      return new LRUCache<string, V>(maxSize);
  }
}