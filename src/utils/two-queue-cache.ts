/**
 * Two-Queue (2Q) Cache Implementation
 * 
 * 2Q algorithm uses three structures:
 * - Am: Fast FIFO queue for recent items (admission queue)
 * - A1in: FIFO queue for items seen once
 * - A1out: Ghost entries (keys only) of recently evicted from A1in
 * 
 * Items graduate from A1in to Am only if accessed again while in A1out.
 * This filters out one-time access patterns efficiently.
 */

interface QueueNode<K, V> {
  key: K;
  value?: V; // Ghost entries don't store values
  prev: QueueNode<K, V> | null;
  next: QueueNode<K, V> | null;
}

class FIFOQueue<K, V> {
  private head: QueueNode<K, V> | null = null;
  private tail: QueueNode<K, V> | null = null;
  private nodeMap: Map<K, QueueNode<K, V>> = new Map();
  public size: number = 0;
  
  enqueue(key: K, value?: V): void {
    const node: QueueNode<K, V> = { key, value, prev: null, next: null };
    
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
  
  dequeue(): { key: K; value?: V } | null {
    if (!this.tail) return null;
    
    const result = { key: this.tail.key, value: this.tail.value };
    this.nodeMap.delete(this.tail.key);
    
    if (this.tail.prev) {
      this.tail = this.tail.prev;
      this.tail.next = null;
    } else {
      this.head = this.tail = null;
    }
    
    this.size--;
    return result;
  }
  
  remove(key: K): boolean {
    const node = this.nodeMap.get(key);
    if (!node) return false;
    
    if (node.prev) node.prev.next = node.next;
    if (node.next) node.next.prev = node.prev;
    if (node === this.head) this.head = node.next;
    if (node === this.tail) this.tail = node.prev;
    
    this.nodeMap.delete(key);
    this.size--;
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
    return Array.from(this.nodeMap.keys());
  }
}

export class TwoQueueCache<K, V> {
  private readonly maxSize: number;
  private readonly kinSize: number;  // Size of A1in (25% of total)
  private readonly koutSize: number; // Size of A1out (50% of total)
  
  private am: FIFOQueue<K, V>;     // Main cache (hot items)
  private a1in: FIFOQueue<K, V>;   // Recent items (seen once)
  private a1out: FIFOQueue<K, V>;  // Ghost entries (recently evicted)
  
  // Performance metrics
  private hits: number = 0;
  private misses: number = 0;
  
  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
    // Recommended 2Q parameters from paper
    this.kinSize = Math.floor(maxSize * 0.25);
    this.koutSize = Math.floor(maxSize * 0.5);
    
    this.am = new FIFOQueue<K, V>();
    this.a1in = new FIFOQueue<K, V>();
    this.a1out = new FIFOQueue<K, V>();
  }
  
  get(key: K): V | undefined {
    // Check Am (hot items)
    if (this.am.has(key)) {
      this.hits++;
      return this.am.get(key);
    }
    
    // Check A1in (recent items)
    if (this.a1in.has(key)) {
      this.hits++;
      return this.a1in.get(key);
    }
    
    // Not found in cache
    this.misses++;
    return undefined;
  }
  
  set(key: K, value: V): void {
    // If already in Am, just update (no movement in FIFO)
    if (this.am.has(key)) {
      // Remove and re-add to update value
      this.am.remove(key);
      this.am.enqueue(key, value);
      return;
    }
    
    // If in A1in, it's getting accessed again - promote to Am
    if (this.a1in.has(key)) {
      this.a1in.remove(key);
      this.promoteToAm(key, value);
      return;
    }
    
    // If in A1out (ghost list), it's a recent re-reference - goes to Am
    if (this.a1out.has(key)) {
      this.a1out.remove(key);
      this.promoteToAm(key, value);
      return;
    }
    
    // New item - goes to A1in
    this.addToA1in(key, value);
  }
  
  private promoteToAm(key: K, value: V): void {
    // Add to Am
    this.am.enqueue(key, value);
    
    // Evict from Am if necessary
    if (this.am.size > this.maxSize - this.kinSize) {
      const evicted = this.am.dequeue();
      // Items evicted from Am are gone (not ghosts)
    }
  }
  
  private addToA1in(key: K, value: V): void {
    // Add to A1in
    this.a1in.enqueue(key, value);
    
    // Evict from A1in if necessary
    if (this.a1in.size > this.kinSize) {
      const evicted = this.a1in.dequeue();
      if (evicted) {
        // Move to ghost list A1out (key only, no value)
        this.a1out.enqueue(evicted.key);
        
        // Maintain A1out size
        if (this.a1out.size > this.koutSize) {
          this.a1out.dequeue();
        }
      }
    }
  }
  
  has(key: K): boolean {
    return this.am.has(key) || this.a1in.has(key);
  }
  
  delete(key: K): boolean {
    return this.am.remove(key) || this.a1in.remove(key) || this.a1out.remove(key);
  }
  
  clear(): void {
    this.am.clear();
    this.a1in.clear();
    this.a1out.clear();
    this.hits = 0;
    this.misses = 0;
  }
  
  getStats(): { 
    hits: number; 
    misses: number; 
    hitRate: number; 
    size: number;
    distribution: {
      am: number;
      a1in: number;
      a1out: number;
    }
  } {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
      size: this.am.size + this.a1in.size,
      distribution: {
        am: this.am.size,
        a1in: this.a1in.size,
        a1out: this.a1out.size
      }
    };
  }
  
  // Get current state for debugging
  getState(): {
    am: K[];
    a1in: K[];
    a1out: K[];
  } {
    return {
      am: this.am.keys(),
      a1in: this.a1in.keys(),
      a1out: this.a1out.keys()
    };
  }
}