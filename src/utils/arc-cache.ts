/**
 * Adaptive Replacement Cache (ARC) Implementation
 *
 * ARC dynamically balances between recency and frequency by maintaining:
 * - T1: Recent items seen once (LRU)
 * - T2: Recent items seen multiple times (LFU-like)
 * - B1: Ghost entries recently evicted from T1
 * - B2: Ghost entries recently evicted from T2
 *
 * The algorithm adapts the target size p for T1 based on workload.
 */

import type { ICache } from './cache-interface.js'

interface ARCNode<K, V> {
  key: K;
  value?: V;
  prev: ARCNode<K, V> | null;
  next: ARCNode<K, V> | null;
}

class LRUList<K, V> {
  private head: ARCNode<K, V> | null = null;
  private tail: ARCNode<K, V> | null = null;
  private nodeMap: Map<K, ARCNode<K, V>> = new Map();
  public size: number = 0;

  // Add to MRU position (head)
  add(key: K, value?: V): void {
    const node: ARCNode<K, V> = { key, value, prev: null, next: null };

    if (!this.head) {
      this.head = this.tail = node;
    } else {
      node.next = this.head;
      this.head.prev = node;
      this.head = node;
    }

    this.nodeMap.set(key, node);
    this.size++;
  }

  // Remove specific key
  remove(key: K): ARCNode<K, V> | null {
    const node = this.nodeMap.get(key);
    if (!node) return null;

    if (node.prev) node.prev.next = node.next;
    if (node.next) node.next.prev = node.prev;
    if (node === this.head) this.head = node.next;
    if (node === this.tail) this.tail = node.prev;

    this.nodeMap.delete(key);
    this.size--;
    return node;
  }

  // Remove LRU item (tail)
  removeLRU(): ARCNode<K, V> | null {
    if (!this.tail) return null;

    const node = this.tail;
    if (this.tail.prev) {
      this.tail = this.tail.prev;
      this.tail.next = null;
    } else {
      this.head = this.tail = null;
    }

    this.nodeMap.delete(node.key);
    this.size--;
    return node;
  }

  // Move to MRU position
  moveToHead(key: K): boolean {
    const node = this.nodeMap.get(key);
    if (!node || node === this.head) return !!node;

    // Remove from current position
    if (node.prev) node.prev.next = node.next;
    if (node.next) node.next.prev = node.prev;
    if (node === this.tail) this.tail = node.prev;

    // Add to head
    node.prev = null;
    node.next = this.head;
    if (this.head) this.head.prev = node;
    this.head = node;

    return true;
  }

  has(key: K): boolean {
    return this.nodeMap.has(key);
  }

  get(key: K): V | undefined {
    const node = this.nodeMap.get(key);
    return node?.value;
  }

  clear(): void {
    this.head = this.tail = null;
    this.nodeMap.clear();
    this.size = 0;
  }

  keys(): K[] {
    const result: K[] = [];
    let current = this.head;
    while (current) {
      result.push(current.key);
      current = current.next;
    }
    return result;
  }
}

export class ARCCache<K, V> {
  private readonly c: number; // Total cache size
  private p: number = 0; // Target size for T1 (adaptive parameter)

  // Cache lists
  private t1: LRUList<K, V>; // Recent items seen once
  private t2: LRUList<K, V>; // Recent items seen multiple times
  private b1: LRUList<K, V>; // Ghost entries from T1
  private b2: LRUList<K, V>; // Ghost entries from T2

  // Performance metrics
  private hits: number = 0;
  private misses: number = 0;
  private adaptations: number = 0;

  constructor(maxSize: number = 1000) {
    this.c = maxSize;
    this.p = Math.floor(maxSize / 2); // Initial target

    this.t1 = new LRUList<K, V>();
    this.t2 = new LRUList<K, V>();
    this.b1 = new LRUList<K, V>();
    this.b2 = new LRUList<K, V>();
  }

  get(key: K): V | undefined {
    // Case 1: Hit in T1 or T2
    if (this.t1.has(key)) {
      // Move from T1 to T2 (frequency promotion)
      const value = this.t1.get(key);
      this.t1.remove(key);
      this.t2.add(key, value);
      this.hits++;
      return value;
    }

    if (this.t2.has(key)) {
      // Move to MRU in T2
      this.t2.moveToHead(key);
      this.hits++;
      return this.t2.get(key);
    }

    // Cache miss
    this.misses++;
    return undefined;
  }

  set(key: K, value: V): void {
    // Case 1: Already in T1 or T2 - update
    if (this.t1.has(key)) {
      this.t1.remove(key);
      this.t2.add(key, value);
      return;
    }

    if (this.t2.has(key)) {
      this.t2.remove(key);
      this.t2.add(key, value);
      return;
    }

    // Case 2: In ghost list B1
    if (this.b1.has(key)) {
      // Adapt: increase p (favor recency)
      const delta = this.b2.size > this.b1.size ? Math.floor(this.b2.size / this.b1.size) : 1;
      this.p = Math.min(this.p + delta, this.c);
      this.adaptations++;

      // Remove from B1
      this.b1.remove(key);

      // Make room in cache
      this.replace(key, false);

      // Add to T2 (it was frequent enough to be re-referenced)
      this.t2.add(key, value);
      return;
    }

    // Case 3: In ghost list B2
    if (this.b2.has(key)) {
      // Adapt: decrease p (favor frequency)
      const delta = this.b1.size > this.b2.size ? Math.floor(this.b1.size / this.b2.size) : 1;
      this.p = Math.max(this.p - delta, 0);
      this.adaptations++;

      // Remove from B2
      this.b2.remove(key);

      // Make room in cache
      this.replace(key, true);

      // Add to T2
      this.t2.add(key, value);
      return;
    }

    // Case 4: New item
    const totalSize = this.t1.size + this.t2.size;

    // Make room if cache is full
    if (totalSize >= this.c) {
      // If T1 is full, replace from T1
      if (this.t1.size >= this.c) {
        const evicted = this.t1.removeLRU();
        if (evicted) {
          this.b1.add(evicted.key); // Add to ghost list
        }
      } else {
        this.replace(key, false);
      }
    }

    // Add to T1 (new items start here)
    this.t1.add(key, value);

    // Maintain ghost list sizes
    this.maintainGhostLists();
  }

  private replace(key: K, inB2: boolean): void {
    const t1Size = this.t1.size;
    const targetT1 = this.p;

    if (t1Size > 0 && (t1Size > targetT1 || (t1Size === targetT1 && inB2))) {
      // Evict from T1
      const evicted = this.t1.removeLRU();
      if (evicted) {
        this.b1.add(evicted.key);
      }
    } else {
      // Evict from T2
      const evicted = this.t2.removeLRU();
      if (evicted) {
        this.b2.add(evicted.key);
      }
    }
  }

  private maintainGhostLists(): void {
    // Maintain B1 size
    while (this.b1.size > this.c - this.p) {
      this.b1.removeLRU();
    }

    // Maintain B2 size
    while (this.b2.size > this.p) {
      this.b2.removeLRU();
    }
  }

  has(key: K): boolean {
    return this.t1.has(key) || this.t2.has(key);
  }

  delete(key: K): boolean {
    return (
      this.t1.remove(key) !== null ||
      this.t2.remove(key) !== null ||
      this.b1.remove(key) !== null ||
      this.b2.remove(key) !== null
    );
  }

  clear(): void {
    this.t1.clear();
    this.t2.clear();
    this.b1.clear();
    this.b2.clear();
    this.p = Math.floor(this.c / 2);
    this.hits = 0;
    this.misses = 0;
    this.adaptations = 0;
  }

  getStats(): {
    hits: number;
    misses: number;
    hitRate: number;
    size: number;
    p: number;
    adaptations: number;
    distribution: {
      t1: number;
      t2: number;
      b1: number;
      b2: number;
    };
  } {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
      size: this.t1.size + this.t2.size,
      p: this.p,
      adaptations: this.adaptations,
      distribution: {
        t1: this.t1.size,
        t2: this.t2.size,
        b1: this.b1.size,
        b2: this.b2.size,
      },
    };
  }

  // Get current state for debugging
  getState(): {
    t1: K[];
    t2: K[];
    b1: K[];
    b2: K[];
    p: number;
  } {
    return {
      t1: this.t1.keys(),
      t2: this.t2.keys(),
      b1: this.b1.keys(),
      b2: this.b2.keys(),
      p: this.p,
    };
  }
}
