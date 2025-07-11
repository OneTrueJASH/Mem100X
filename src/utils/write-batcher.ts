/**
 * Write batcher for high-concurrency scenarios
 * Batches multiple write operations into single transactions
 */

import { EntityResult, CreateEntityInput } from '../types.js';
import type { MemoryDatabase } from '../database.js';

interface PendingWrite<T, R> {
  data: T;
  resolve: (result: R) => void;
  reject: (error: Error) => void;
}

export class WriteBatcher {
  private pendingEntities: PendingWrite<CreateEntityInput, EntityResult>[] = [];
  private flushTimer?: NodeJS.Timeout;
  private isProcessing = false;
  
  constructor(
    private readonly db: MemoryDatabase,
    private readonly options: {
      batchSize: number;
      flushInterval: number;
    } = {
      batchSize: 100,
      flushInterval: 10
    }
  ) {}

  async addEntityWrite(entity: CreateEntityInput): Promise<EntityResult> {
    return new Promise((resolve, reject) => {
      this.pendingEntities.push({ data: entity, resolve, reject });
      
      if (this.pendingEntities.length >= this.options.batchSize) {
        this.flush();
      } else if (!this.flushTimer && !this.isProcessing) {
        this.flushTimer = setTimeout(() => this.flush(), this.options.flushInterval);
      }
    });
  }

  private async flush(): Promise<void> {
    if (this.isProcessing || this.pendingEntities.length === 0) return;
    
    this.isProcessing = true;
    clearTimeout(this.flushTimer);
    this.flushTimer = undefined;
    
    // Take all pending writes
    const batch = this.pendingEntities.splice(0);
    
    try {
      // Use batch creation if available
      const entities = batch.map(b => b.data);
      const results = this.db.createEntitiesBatch 
        ? this.db.createEntitiesBatch(entities)
        : this.db.createEntities(entities);
      
      // Resolve all promises with corresponding results
      batch.forEach((b, i) => {
        b.resolve(results[i]);
      });
    } catch (error) {
      // Reject all promises with the error
      batch.forEach(b => {
        b.reject(error as Error);
      });
    } finally {
      this.isProcessing = false;
      
      // Check if more writes came in while processing
      if (this.pendingEntities.length > 0) {
        this.flushTimer = setTimeout(() => this.flush(), this.options.flushInterval);
      }
    }
  }

  async flushAndWait(): Promise<void> {
    clearTimeout(this.flushTimer);
    await this.flush();
  }

  destroy(): void {
    clearTimeout(this.flushTimer);
    // Reject any pending writes
    this.pendingEntities.forEach(p => {
      p.reject(new Error('WriteBatcher destroyed'));
    });
    this.pendingEntities = [];
  }
}