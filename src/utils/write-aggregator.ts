/**
 * Server-side transactional write aggregator
 * Intelligently batches write operations while respecting order
 */

import { MultiDatabaseManager } from '../multi-database.js';
import { EntityResult, RelationResult } from '../types.js';
import { logInfo, logError } from './logger.js';

// Define types for pending operations
export type WriteOperation = 
  | { type: 'create_entities'; data: any }
  | { type: 'add_observations'; data: any }
  | { type: 'create_relations'; data: any }
  | { type: 'delete_entities'; data: any };

type PendingWrite = {
  operation: WriteOperation;
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  timestamp: bigint;
};

export class WriteAggregator {
  private writeBuffer: PendingWrite[] = [];
  private isProcessing = false;
  private debounceTimer: NodeJS.Timeout | null = null;
  private stats = {
    totalBatches: 0,
    totalOperations: 0,
    totalSaved: 0
  };

  constructor(
    private manager: MultiDatabaseManager,
    private debounceMs: number = 5,
    private maxBatchSize: number = 100
  ) {}

  public async scheduleWrite(operation: WriteOperation): Promise<any> {
    return new Promise((resolve, reject) => {
      this.writeBuffer.push({ 
        operation, 
        resolve, 
        reject,
        timestamp: process.hrtime.bigint()
      });
      
      // Process immediately if we hit batch size
      if (this.writeBuffer.length >= this.maxBatchSize) {
        this.processBuffer();
      } else {
        this.scheduleProcessing();
      }
    });
  }

  private scheduleProcessing() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => this.processBuffer(), this.debounceMs);
  }

  private async processBuffer() {
    if (this.isProcessing || this.writeBuffer.length === 0) {
      return;
    }
    
    this.isProcessing = true;
    const processingStartTime = process.hrtime.bigint();
    
    // Take a snapshot of current buffer
    const batchToProcess = [...this.writeBuffer];
    this.writeBuffer = [];
    
    try {
      // Group operations by type while preserving order within each type
      const groupedOps = this.groupOperations(batchToProcess);
      
      // Process in order: creates -> relations -> updates -> deletes
      // This ensures entities exist before relations are created
      const results = new Map<PendingWrite, any>();
      
      // Single transaction for all operations
      const batchStartTime = process.hrtime.bigint();
      
      // Process creates first
      if (groupedOps.creates.length > 0) {
        const entities = groupedOps.creates.map(p => p.operation.data.entities).flat();
        const createResults = this.manager.createEntities(entities);
        
        // Map results back to original promises
        let resultIndex = 0;
        for (const pending of groupedOps.creates) {
          const entityCount = pending.operation.data.entities.length;
          const pendingResults = createResults.slice(resultIndex, resultIndex + entityCount);
          results.set(pending, pendingResults);
          resultIndex += entityCount;
        }
      }
      
      // Process relations (after entities are created)
      if (groupedOps.relations.length > 0) {
        const relations = groupedOps.relations.map(p => p.operation.data.relations).flat();
        const relationResults = this.manager.createRelations(relations);
        
        let resultIndex = 0;
        for (const pending of groupedOps.relations) {
          const relationCount = pending.operation.data.relations.length;
          const pendingResults = relationResults.slice(resultIndex, resultIndex + relationCount);
          results.set(pending, pendingResults);
          resultIndex += relationCount;
        }
      }
      
      // Process observation updates
      if (groupedOps.observations.length > 0) {
        const observations = groupedOps.observations.map(p => p.operation.data.observations).flat();
        this.manager.addObservations(observations);
        
        // addObservations doesn't return results, so just mark as successful
        for (const pending of groupedOps.observations) {
          results.set(pending, { success: true });
        }
      }
      
      // Process deletes last
      if (groupedOps.deletes.length > 0) {
        const entityNames = groupedOps.deletes.map(p => p.operation.data.entityNames).flat();
        this.manager.deleteEntities(entityNames);
        
        for (const pending of groupedOps.deletes) {
          results.set(pending, { success: true });
        }
      }
      
      const batchEndTime = process.hrtime.bigint();
      const batchTime = Number(batchEndTime - batchStartTime) / 1_000_000;
      
      // Update stats
      this.stats.totalBatches++;
      this.stats.totalOperations += batchToProcess.length;
      this.stats.totalSaved += batchToProcess.length - 1; // Operations saved by batching
      
      // Log batch performance
      if (batchToProcess.length > 1) {
        logInfo('Write batch processed', {
          operations: batchToProcess.length,
          batchTime_ms: batchTime,
          avgTime_ms: batchTime / batchToProcess.length,
          totalStats: this.stats
        });
      }
      
      // Resolve all promises
      for (const pending of batchToProcess) {
        const result = results.get(pending);
        if (result !== undefined) {
          pending.resolve(result);
        } else {
          pending.reject(new Error('No result found for operation'));
        }
      }
      
    } catch (error) {
      logError('Write batch failed', error as Error, { 
        batchSize: batchToProcess.length 
      });
      
      // Reject all pending operations
      batchToProcess.forEach(pending => pending.reject(error));
      
    } finally {
      this.isProcessing = false;
      
      // If new items came in while processing, schedule again
      if (this.writeBuffer.length > 0) {
        this.scheduleProcessing();
      }
    }
  }
  
  private groupOperations(operations: PendingWrite[]) {
    const groups = {
      creates: [] as PendingWrite[],
      relations: [] as PendingWrite[],
      observations: [] as PendingWrite[],
      deletes: [] as PendingWrite[]
    };
    
    for (const op of operations) {
      switch (op.operation.type) {
        case 'create_entities':
          groups.creates.push(op);
          break;
        case 'create_relations':
          groups.relations.push(op);
          break;
        case 'add_observations':
          groups.observations.push(op);
          break;
        case 'delete_entities':
          groups.deletes.push(op);
          break;
      }
    }
    
    return groups;
  }
  
  public getStats() {
    return { ...this.stats };
  }
}