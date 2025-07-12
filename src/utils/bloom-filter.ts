/**
 * High-Performance Bloom Filter
 * Probabilistic data structure for O(1) existence checks
 * Now with ultra-fast non-cryptographic hashing
 */

import xxhash from 'xxhash-wasm';

// Initialize xxhash instance
let hashInstance: Awaited<ReturnType<typeof xxhash>> | null = null;

export class BloomFilter {
  private readonly size: number;
  private readonly numHashes: number;
  private readonly bits: Uint8Array;
  private itemCount: number = 0;
  private initialized: boolean = false;

  constructor(expectedItems: number = 10000, falsePositiveRate: number = 0.01) {
    // Calculate optimal size and hash functions
    this.size = Math.ceil((-expectedItems * Math.log(falsePositiveRate)) / Math.log(2) ** 2);
    this.numHashes = Math.ceil((this.size / expectedItems) * Math.log(2));
    this.bits = new Uint8Array(Math.ceil(this.size / 8));
  }

  // Initialize the hash functions
  async init(): Promise<void> {
    if (!this.initialized) {
      hashInstance = await xxhash();
      this.initialized = true;
    }
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
    const hashes = this.getHashes(item);

    for (const hash of hashes) {
      const index = hash % this.size;
      const byteIndex = Math.floor(index / 8);
      const bitIndex = index % 8;
      this.bits[byteIndex] |= 1 << bitIndex;
    }

    this.itemCount++;
  }

  contains(item: string): boolean {
    const hashes = this.getHashes(item);

    for (const hash of hashes) {
      const index = hash % this.size;
      const byteIndex = Math.floor(index / 8);
      const bitIndex = index % 8;

      if ((this.bits[byteIndex] & (1 << bitIndex)) === 0) {
        return false;
      }
    }

    return true;
  }

  private getHashes(item: string): number[] {
    const hashes: number[] = [];

    if (hashInstance && this.initialized) {
      // Use ultra-fast xxhash when available
      const hash1 = hashInstance.h32(item, 0);
      const hash2 = hashInstance.h32(item, 1);

      // Use double hashing technique
      for (let i = 0; i < this.numHashes; i++) {
        hashes.push(Math.abs(hash1 + i * hash2));
      }
    } else {
      // Fallback to fast synchronous hash
      const hash1 = this.murmur3(item, 0);
      const hash2 = this.murmur3(item, 1);

      for (let i = 0; i < this.numHashes; i++) {
        hashes.push(Math.abs(hash1 + i * hash2));
      }
    }

    return hashes;
  }

  clear(): void {
    this.bits.fill(0);
    this.itemCount = 0;
  }

  getStats(): { size: number; numHashes: number; items: number; fillRate: number } {
    let setBits = 0;
    for (const byte of this.bits) {
      for (let i = 0; i < 8; i++) {
        if (byte & (1 << i)) setBits++;
      }
    }

    return {
      size: this.size,
      numHashes: this.numHashes,
      items: this.itemCount,
      fillRate: setBits / this.size,
    };
  }

  // Serialize the Bloom filter to a buffer for persistence
  serialize(): Buffer {
    // Create header with metadata
    const header = Buffer.alloc(16);
    header.writeUInt32BE(this.size, 0);
    header.writeUInt32BE(this.numHashes, 4);
    header.writeUInt32BE(this.itemCount, 8);
    header.writeUInt32BE(this.bits.length, 12);

    // Combine header and bits
    return Buffer.concat([header, Buffer.from(this.bits)]);
  }

  // Deserialize a Bloom filter from a buffer
  static deserialize(buffer: Buffer): BloomFilter {
    // Read header
    const size = buffer.readUInt32BE(0);
    const numHashes = buffer.readUInt32BE(4);
    const itemCount = buffer.readUInt32BE(8);
    const bitsLength = buffer.readUInt32BE(12);

    // Create a new filter with the same parameters
    const filter = Object.create(BloomFilter.prototype);
    filter.size = size;
    filter.numHashes = numHashes;
    filter.itemCount = itemCount;
    filter.initialized = false;

    // Copy bits
    filter.bits = new Uint8Array(bitsLength);
    buffer.copy(filter.bits, 0, 16, 16 + bitsLength);

    return filter;
  }

  // Save to file
  async saveToFile(filePath: string): Promise<void> {
    const fs = await import('fs/promises');
    const buffer = this.serialize();
    await fs.writeFile(filePath, buffer);
  }

  // Load from file
  static async loadFromFile(filePath: string): Promise<BloomFilter | null> {
    const fs = await import('fs/promises');
    try {
      const buffer = await fs.readFile(filePath);
      const filter = BloomFilter.deserialize(buffer);
      // Initialize hash functions
      await filter.init();
      return filter;
    } catch (error) {
      // File doesn't exist or is corrupted
      return null;
    }
  }
}
