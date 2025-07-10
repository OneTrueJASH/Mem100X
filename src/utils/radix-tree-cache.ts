/**
 * Memory-efficient Radix Tree (Compressed Trie) Cache implementation
 * Optimized for string keys with shared prefixes (like entity names)
 * Provides O(k) lookup where k is key length, with minimal memory overhead
 */

interface RadixNode<V> {
  value?: V;
  children: Map<string, RadixNode<V>>;
  isLeaf: boolean;
  accessCount: number;
  lastAccess: number;
}

export class RadixTreeCache<V> {
  private root: RadixNode<V>;
  private size: number = 0;
  private readonly maxSize: number;
  
  // LRU eviction tracking
  private accessOrder: Map<string, number> = new Map();
  private accessCounter: number = 0;
  
  // Performance metrics
  private hits: number = 0;
  private misses: number = 0;
  
  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
    this.root = this.createNode();
  }
  
  private createNode(): RadixNode<V> {
    return {
      children: new Map(),
      isLeaf: false,
      accessCount: 0,
      lastAccess: 0
    };
  }
  
  get(key: string): V | undefined {
    const result = this.findNode(key);
    
    if (result && result.node.isLeaf && result.remainingKey === '') {
      // Update access tracking
      this.accessCounter++;
      result.node.lastAccess = this.accessCounter;
      this.accessOrder.set(key, this.accessCounter);
      result.node.accessCount++;
      
      this.hits++;
      return result.node.value;
    }
    
    this.misses++;
    return undefined;
  }
  
  set(key: string, value: V): void {
    // Insert or update
    this.insert(key, value);
    
    // Track access order for LRU
    this.accessCounter++;
    this.accessOrder.set(key, this.accessCounter);
    
    // Evict if necessary
    if (this.size > this.maxSize) {
      this.evictLRU();
    }
  }
  
  private insert(key: string, value: V): void {
    let current = this.root;
    let remainingKey = key;
    
    while (remainingKey.length > 0) {
      let matchFound = false;
      
      // Try to find a child with common prefix
      for (const [edge, child] of current.children) {
        const commonPrefix = this.getCommonPrefix(remainingKey, edge);
        
        if (commonPrefix.length > 0) {
          matchFound = true;
          
          if (commonPrefix === edge) {
            // Full edge match, continue down
            current = child;
            remainingKey = remainingKey.substring(commonPrefix.length);
          } else {
            // Partial match, need to split edge
            const newMiddle = this.createNode();
            const oldEdgeSuffix = edge.substring(commonPrefix.length);
            const newEdgeSuffix = remainingKey.substring(commonPrefix.length);
            
            // Update parent to point to new middle node
            current.children.delete(edge);
            current.children.set(commonPrefix, newMiddle);
            
            // Old child becomes child of middle node
            newMiddle.children.set(oldEdgeSuffix, child);
            
            // Create new leaf node if we have remaining key
            if (newEdgeSuffix.length > 0) {
              const newLeaf = this.createNode();
              newLeaf.isLeaf = true;
              newLeaf.value = value;
              newLeaf.lastAccess = this.accessCounter;
              newMiddle.children.set(newEdgeSuffix, newLeaf);
              this.size++;
            } else {
              // New value goes in middle node
              newMiddle.isLeaf = true;
              newMiddle.value = value;
              newMiddle.lastAccess = this.accessCounter;
              this.size++;
            }
            
            return;
          }
          break;
        }
      }
      
      if (!matchFound) {
        // No matching edge, create new leaf
        const newLeaf = this.createNode();
        newLeaf.isLeaf = true;
        newLeaf.value = value;
        newLeaf.lastAccess = this.accessCounter;
        current.children.set(remainingKey, newLeaf);
        this.size++;
        return;
      }
    }
    
    // Key already exists, update value
    if (current.isLeaf) {
      current.value = value;
      current.lastAccess = this.accessCounter;
    } else {
      // Make current node a leaf
      current.isLeaf = true;
      current.value = value;
      current.lastAccess = this.accessCounter;
      this.size++;
    }
  }
  
  private findNode(key: string): { node: RadixNode<V>; remainingKey: string } | null {
    let current = this.root;
    let remainingKey = key;
    
    while (remainingKey.length > 0) {
      let matchFound = false;
      
      for (const [edge, child] of current.children) {
        if (remainingKey.startsWith(edge)) {
          current = child;
          remainingKey = remainingKey.substring(edge.length);
          matchFound = true;
          break;
        }
      }
      
      if (!matchFound) {
        return null;
      }
    }
    
    return { node: current, remainingKey };
  }
  
  private getCommonPrefix(str1: string, str2: string): string {
    let i = 0;
    while (i < str1.length && i < str2.length && str1[i] === str2[i]) {
      i++;
    }
    return str1.substring(0, i);
  }
  
  has(key: string): boolean {
    const result = this.findNode(key);
    return result !== null && result.node.isLeaf && result.remainingKey === '';
  }
  
  delete(key: string): boolean {
    // For simplicity, we'll mark as deleted rather than restructuring tree
    const result = this.findNode(key);
    
    if (result && result.node.isLeaf && result.remainingKey === '') {
      result.node.isLeaf = false;
      result.node.value = undefined;
      this.accessOrder.delete(key);
      this.size--;
      return true;
    }
    
    return false;
  }
  
  private evictLRU(): void {
    // Find oldest accessed key
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    
    for (const [key, time] of this.accessOrder) {
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.delete(oldestKey);
    }
  }
  
  clear(): void {
    this.root = this.createNode();
    this.size = 0;
    this.accessOrder.clear();
    this.accessCounter = 0;
    this.hits = 0;
    this.misses = 0;
  }
  
  getStats(): { hits: number; misses: number; hitRate: number; size: number; memoryInfo: any } {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
      size: this.size,
      memoryInfo: {
        nodeCount: this.countNodes(),
        averageEdgeLength: this.getAverageEdgeLength(),
        maxDepth: this.getMaxDepth()
      }
    };
  }
  
  private countNodes(node: RadixNode<V> = this.root): number {
    let count = 1;
    for (const child of node.children.values()) {
      count += this.countNodes(child);
    }
    return count;
  }
  
  private getAverageEdgeLength(node: RadixNode<V> = this.root, sum: number = 0, count: number = 0): number {
    for (const [edge, child] of node.children) {
      sum += edge.length;
      count++;
      const result = this.getAverageEdgeLength(child, sum, count);
      sum = result * count;
    }
    return count > 0 ? sum / count : 0;
  }
  
  private getMaxDepth(node: RadixNode<V> = this.root, depth: number = 0): number {
    let maxDepth = depth;
    for (const child of node.children.values()) {
      maxDepth = Math.max(maxDepth, this.getMaxDepth(child, depth + 1));
    }
    return maxDepth;
  }
  
  // Memory estimation (approximate)
  estimateMemoryUsage(): number {
    // Each node: object overhead + Map overhead + value reference
    const nodeOverhead = 64; // Approximate object overhead
    const mapOverhead = 48; // Map overhead per instance
    const stringOverhead = 24; // String object overhead
    const pointerSize = 8; // 64-bit pointers
    
    let totalMemory = 0;
    
    const traverse = (node: RadixNode<V>) => {
      totalMemory += nodeOverhead + mapOverhead;
      
      // Count edge strings
      for (const [edge, child] of node.children) {
        totalMemory += stringOverhead + edge.length * 2; // UTF-16
        totalMemory += pointerSize; // Reference to child
        traverse(child);
      }
      
      if (node.isLeaf && node.value) {
        totalMemory += pointerSize; // Reference to value
      }
    };
    
    traverse(this.root);
    
    // Add accessOrder Map overhead
    totalMemory += mapOverhead + this.accessOrder.size * (stringOverhead + 8 + pointerSize * 2);
    
    return totalMemory;
  }
}