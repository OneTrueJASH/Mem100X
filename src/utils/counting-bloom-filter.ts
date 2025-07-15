/**
 * High-Performance Counting Bloom Filter
 * Supports both addition and deletion of items
 * Uses counters instead of bits to track item frequency
 */

import xxhash from 'xxhash-wasm';
import fs from 'fs';

// Initialize xxhash instance
let hashInstance: Awaited<ReturnType<typeof xxhash>> | null = null;

export class CountingBloomFilter {
  private readonly size: number;
  private readonly numHashes: number;
  private readonly counters: Uint8Array; // Using 8-bit counters (max 255)
  private itemCount: number = 0;
  private initialized: boolean = false;

  constructor(expectedItems: number = 10000, falsePositiveRate: number = 0.01) {
    // Calculate optimal size and hash functions
    this.size = Math.ceil((-expectedItems * Math.log(falsePositiveRate)) / Math.log(2) ** 2);
    this.numHashes = Math.ceil((this.size / expectedItems) * Math.log(2));
    this.counters = new Uint8Array(this.size);
  }

  // Initialize the hash functions
  async init(): Promise<void> {
    if (!this.initialized) {
      hashInstance = await xxhash();
      this.initialized = true;
    }
  }

  // Synchronous initialization (uses fallback hash)
  initSync(): void {
    this.initialized = true;
  }

  // Synchronous fallback for immediate use
  private murmur3(str: string, seed: number): number {
    let h1 = seed;
    const c1 = 0xcc9e2d51;
    const c2 = 0x1b873593;
    const r1 = 15;
    const r2 = 13;
    const m = 5;
    const n = 0xe6546b64;

    for (let i = 0; i < str.length; i++) {
      let k1 = str.charCodeAt(i);
      k1 = Math.imul(k1, c1);
      k1 = (k1 << r1) | (k1 >>> (32 - r1));
      k1 = Math.imul(k1, c2);

      h1 ^= k1;
      h1 = (h1 << r2) | (h1 >>> (32 - r2));
      h1 = Math.imul(h1, m) + n;
    }

    h1 ^= str.length;
    h1 ^= h1 >>> 16;
    h1 = Math.imul(h1, 0x85ebca6b);
    h1 ^= h1 >>> 13;
    h1 = Math.imul(h1, 0xc2b2ae35);
    h1 ^= h1 >>> 16;

    return h1 >>> 0;
  }

  add(item: string): void {
    const indices = this.getIndices(item);

    for (const index of indices) {
      // Increment counter, but cap at 255 to prevent overflow
      if (this.counters[index] < 255) {
        this.counters[index]++;
      }
    }

    this.itemCount++;
  }

  remove(item: string): boolean {
    // First check if item might be in the filter
    if (!this.contains(item)) {
      return false;
    }

    const indices = this.getIndices(item);

    // Check if we can safely decrement all counters
    for (const index of indices) {
      if (this.counters[index] === 0) {
        return false; // Item wasn't actually in the filter
      }
    }

    // Decrement all counters
    for (const index of indices) {
      this.counters[index]--;
    }

    this.itemCount--;
    return true;
  }

  contains(item: string): boolean {
    const indices = this.getIndices(item);

    for (const index of indices) {
      if (this.counters[index] === 0) {
        return false;
      }
    }

    return true;
  }

  private getIndices(item: string): number[] {
    const indices: number[] = [];

    if (hashInstance && this.initialized) {
      // Use ultra-fast xxhash when available
      const hash1 = hashInstance.h32(item, 0);
      const hash2 = hashInstance.h32(item, 1);

      // Use double hashing technique
      for (let i = 0; i < this.numHashes; i++) {
        indices.push(Math.abs(hash1 + i * hash2) % this.size);
      }
    } else {
      // Fallback to fast synchronous hash
      const hash1 = this.murmur3(item, 0);
      const hash2 = this.murmur3(item, 1);

      for (let i = 0; i < this.numHashes; i++) {
        indices.push(Math.abs(hash1 + i * hash2) % this.size);
      }
    }

    return indices;
  }

  clear(): void {
    this.counters.fill(0);
    this.itemCount = 0;
  }

  getStats(): {
    size: number;
    numHashes: number;
    items: number;
    fillRate: number;
    saturatedCounters: number;
    averageCounter: number;
  } {
    let nonZeroCounters = 0;
    let saturatedCounters = 0;
    let totalCount = 0;

    for (const counter of this.counters) {
      if (counter > 0) {
        nonZeroCounters++;
        totalCount += counter;
      }
      if (counter === 255) {
        saturatedCounters++;
      }
    }

    return {
      size: this.size,
      numHashes: this.numHashes,
      items: this.itemCount,
      fillRate: nonZeroCounters / this.size,
      saturatedCounters,
      averageCounter: nonZeroCounters > 0 ? totalCount / nonZeroCounters : 0,
    };
  }

  // Serialize the Counting Bloom filter to a buffer for persistence
  serialize(): Buffer {
    // Create header with metadata
    const header = Buffer.alloc(16);
    header.writeUInt32BE(this.size, 0);
    header.writeUInt32BE(this.numHashes, 4);
    header.writeUInt32BE(this.itemCount, 8);
    header.writeUInt32BE(this.counters.length, 12);

    // Combine header and counters
    return Buffer.concat([header, Buffer.from(this.counters)]);
  }

  // Deserialize a Counting Bloom filter from a buffer
  static deserialize(buffer: Buffer): CountingBloomFilter {
    // Read header
    const size = buffer.readUInt32BE(0);
    const numHashes = buffer.readUInt32BE(4);
    const itemCount = buffer.readUInt32BE(8);
    const countersLength = buffer.readUInt32BE(12);

    // Create a new filter with the same parameters
    const filter = Object.create(CountingBloomFilter.prototype);
    filter.size = size;
    filter.numHashes = numHashes;
    filter.itemCount = itemCount;
    filter.initialized = false;

    // Copy counters
    filter.counters = new Uint8Array(countersLength);
    buffer.copy(filter.counters, 0, 16, 16 + countersLength);

    return filter;
  }

  // Save to file
  async saveToFile(filePath: string): Promise<void> {
    const fs = await import('fs/promises');
    const buffer = this.serialize();
    await fs.writeFile(filePath, buffer);
  }

  // Synchronous save to file
  saveToFileSync(filePath: string): void {
    const buffer = this.serialize();
    fs.writeFileSync(filePath, buffer);
  }

  // Load from file
  static async loadFromFile(filePath: string): Promise<CountingBloomFilter | null> {
    const fs = await import('fs/promises');
    try {
      const buffer = await fs.readFile(filePath);
      const filter = CountingBloomFilter.deserialize(buffer);
      // Initialize hash functions
      await filter.init();
      return filter;
    } catch (error) {
      // File doesn't exist or is corrupted
      return null;
    }
  }

  // Synchronous load from file
  static loadFromFileSync(filePath: string): CountingBloomFilter | null {
    try {
      const buffer = fs.readFileSync(filePath);
      const filter = CountingBloomFilter.deserialize(buffer);
      filter.initSync();
      return filter;
    } catch (error) {
      // File doesn't exist or is corrupted
      return null;
    }
  }

  // Migrate from regular Bloom filter
  static async migrateFromBloomFilter(
    oldFilter: any,
    expectedItems: number = 10000,
    falsePositiveRate: number = 0.01
  ): Promise<CountingBloomFilter> {
    const newFilter = new CountingBloomFilter(expectedItems, falsePositiveRate);
    await newFilter.init();

    // Note: We can't directly migrate the data, but we can create a new filter
    // with the same parameters
    console.log('Created new Counting Bloom Filter. Previous filter data cannot be migrated.');
    return newFilter;
  }
}
