/**
 * High-Performance LRU Cache with O(1) operations
 * Uses doubly-linked list and hash map for optimal performance
 */

class ListNode<K, V> {
  constructor(
    public key: K,
    public value: V,
    public prev: ListNode<K, V> | null = null,
    public next: ListNode<K, V> | null = null
  ) {}
}

export class LRUCache<K, V> {
  private readonly maxSize: number;
  private readonly cache: Map<K, ListNode<K, V>>;
  private head: ListNode<K, V> | null = null;
  private tail: ListNode<K, V> | null = null;
  private size: number = 0;

  // Performance metrics
  private hits: number = 0;
  private misses: number = 0;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key: K): V | undefined {
    const node = this.cache.get(key);

    if (node) {
      // Move to front (most recently used)
      this.moveToFront(node);
      this.hits++;
      return node.value;
    }

    this.misses++;
    return undefined;
  }

  set(key: K, value: V): void {
    const existingNode = this.cache.get(key);

    if (existingNode) {
      // Update existing node
      existingNode.value = value;
      this.moveToFront(existingNode);
      return;
    }

    // Create new node
    const newNode = new ListNode(key, value);
    this.cache.set(key, newNode);

    // Add to front of list
    if (!this.head) {
      this.head = this.tail = newNode;
    } else {
      newNode.next = this.head;
      this.head.prev = newNode;
      this.head = newNode;
    }

    this.size++;

    // Evict if necessary
    if (this.size > this.maxSize) {
      this.evictLRU();
    }
  }

  private moveToFront(node: ListNode<K, V>): void {
    // Already at front
    if (node === this.head) return;

    // Remove from current position
    if (node.prev) node.prev.next = node.next;
    if (node.next) node.next.prev = node.prev;
    if (node === this.tail) this.tail = node.prev;

    // Move to front
    node.prev = null;
    node.next = this.head;
    if (this.head) this.head.prev = node;
    this.head = node;
  }

  private evictLRU(): void {
    if (!this.tail) return;

    // Remove from map
    this.cache.delete(this.tail.key);

    // Remove from list
    if (this.tail.prev) {
      this.tail = this.tail.prev;
      this.tail.next = null;
    } else {
      // Only one node
      this.head = this.tail = null;
    }

    this.size--;
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    const node = this.cache.get(key);
    if (!node) return false;

    // Remove from map
    this.cache.delete(key);

    // Remove from list
    if (node.prev) node.prev.next = node.next;
    if (node.next) node.next.prev = node.prev;
    if (node === this.head) this.head = node.next;
    if (node === this.tail) this.tail = node.prev;

    this.size--;
    return true;
  }

  clear(): void {
    this.cache.clear();
    this.head = this.tail = null;
    this.size = 0;
    this.hits = 0;
    this.misses = 0;
  }

  getStats(): { hits: number; misses: number; hitRate: number; size: number } {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
      size: this.size,
    };
  }
}
