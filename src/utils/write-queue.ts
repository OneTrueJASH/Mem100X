/**
 * Write queue for batching and serializing database write operations
 * Reduces lock contention by ensuring writes don't overlap
 */

import { PerformanceTracker } from './logger.js';

interface QueuedOperation<T> {
  operation: () => T | Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: any) => void;
  priority: number;
  timestamp: number;
}

export class WriteQueue {
  private queue: QueuedOperation<any>[] = [];
  private processing = false;
  private flushTimeout?: NodeJS.Timeout;
  private readonly maxBatchSize: number;
  private readonly flushInterval: number;
  
  constructor(options: { 
    maxBatchSize?: number; 
    flushInterval?: number;
  } = {}) {
    this.maxBatchSize = options.maxBatchSize || 10;
    this.flushInterval = options.flushInterval || 5; // ms
  }
  
  async enqueue<T>(
    operation: () => T | Promise<T>, 
    priority: number = 0
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        operation,
        resolve,
        reject,
        priority,
        timestamp: Date.now()
      });
      
      // Sort by priority (higher first) then by timestamp (older first)
      this.queue.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return a.timestamp - b.timestamp;
      });
      
      this.scheduleFlush();
    });
  }
  
  private scheduleFlush() {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
    }
    
    // Flush immediately if queue is full
    if (this.queue.length >= this.maxBatchSize) {
      this.flush();
    } else {
      // Otherwise schedule a flush
      this.flushTimeout = setTimeout(() => this.flush(), this.flushInterval);
    }
  }
  
  private async flush() {
    if (this.processing || this.queue.length === 0) {
      return;
    }
    
    this.processing = true;
    const perf = new PerformanceTracker('writeQueue.flush', { 
      queueSize: this.queue.length 
    });
    
    // Process up to maxBatchSize operations
    const batch = this.queue.splice(0, this.maxBatchSize);
    
    try {
      // Execute operations sequentially to avoid lock contention
      for (const item of batch) {
        try {
          const result = await item.operation();
          item.resolve(result);
        } catch (error) {
          item.reject(error);
        }
      }
      
      perf.end({ processed: batch.length });
    } finally {
      this.processing = false;
      
      // Schedule next flush if queue isn't empty
      if (this.queue.length > 0) {
        this.scheduleFlush();
      }
    }
  }
  
  async drain(): Promise<void> {
    while (this.queue.length > 0 || this.processing) {
      await this.flush();
      await new Promise(resolve => setTimeout(resolve, 1));
    }
  }
  
  get size(): number {
    return this.queue.length;
  }
  
  get isProcessing(): boolean {
    return this.processing;
  }
}