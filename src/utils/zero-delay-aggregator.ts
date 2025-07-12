// src/utils/zero-delay-aggregator.ts
// Zero-delay write aggregator using process.nextTick for minimal overhead

import { MultiDatabaseManager } from '../multi-database.js';
import { logInfo, logError } from './logger.js';

type PendingWrite = {
  operation: 'create_entities' | 'add_observations' | 'create_relations' | 'delete_entities';
  data: any;
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
};

export class ZeroDelayWriteAggregator {
  private writeBuffer: PendingWrite[] = [];
  private isScheduled = false;
  private stats = {
    totalBatches: 0,
    totalOperations: 0,
    batchedOperations: 0,
  };

  constructor(private manager: MultiDatabaseManager) {}

  public scheduleWrite(operation: PendingWrite['operation'], data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.writeBuffer.push({ operation, data, resolve, reject });

      if (!this.isScheduled) {
        this.isScheduled = true;
        process.nextTick(() => this.processBuffer());
      }
    });
  }

  private processBuffer() {
    this.isScheduled = false;
    const batchToProcess = [...this.writeBuffer];
    this.writeBuffer = [];

    this.stats.totalOperations += batchToProcess.length;

    if (batchToProcess.length === 1) {
      // Single operation - no batching benefit
      const op = batchToProcess[0];
      try {
        const result = this.executeOperation(op.operation, op.data);
        op.resolve(result);
      } catch (error) {
        op.reject(error);
      }
      return;
    }

    if (batchToProcess.length > 1) {
      this.stats.totalBatches++;
      this.stats.batchedOperations += batchToProcess.length;

      // Group operations by type while preserving order
      const grouped = this.groupOperations(batchToProcess);
      const results = new Map<PendingWrite, any>();

      try {
        // Process in order: creates -> relations -> updates -> deletes

        // Process creates first
        if (grouped.creates.length > 0) {
          const entities = grouped.creates.map((p) => p.data.entities).flat();
          const createResults = this.manager.createEntities(entities);

          let resultIndex = 0;
          for (const pending of grouped.creates) {
            const entityCount = pending.data.entities.length;
            const pendingResults = createResults.slice(resultIndex, resultIndex + entityCount);
            results.set(pending, pendingResults);
            resultIndex += entityCount;
          }
        }

        // Process relations after entities
        if (grouped.relations.length > 0) {
          const relations = grouped.relations.map((p) => p.data.relations).flat();
          const relationResults = this.manager.createRelations(relations);

          let resultIndex = 0;
          for (const pending of grouped.relations) {
            const relationCount = pending.data.relations.length;
            const pendingResults = relationResults.slice(resultIndex, resultIndex + relationCount);
            results.set(pending, pendingResults);
            resultIndex += relationCount;
          }
        }

        // Process observation updates
        if (grouped.observations.length > 0) {
          const observations = grouped.observations.map((p) => p.data.observations).flat();
          this.manager.addObservations(observations);

          for (const pending of grouped.observations) {
            results.set(pending, { success: true });
          }
        }

        // Process deletes last
        if (grouped.deletes.length > 0) {
          const entityNames = grouped.deletes.map((p) => p.data.entityNames).flat();
          this.manager.deleteEntities(entityNames);

          for (const pending of grouped.deletes) {
            results.set(pending, { success: true });
          }
        }

        // Always log batching info for debugging
        logInfo('Zero-delay batch processed', {
          operations: batchToProcess.length,
          grouped: {
            creates: grouped.creates.length,
            relations: grouped.relations.length,
            observations: grouped.observations.length,
            deletes: grouped.deletes.length,
          },
          stats: this.getStats(),
        });

        // Resolve all promises
        for (const pending of batchToProcess) {
          const result = results.get(pending);
          pending.resolve(result || { success: true });
        }
      } catch (error) {
        logError('Zero-delay batch failed', error as Error, {
          batchSize: batchToProcess.length,
        });

        // Reject all pending operations
        batchToProcess.forEach((pending) => pending.reject(error));
      }
    }

    // If new items came in while processing, schedule again
    if (this.writeBuffer.length > 0 && !this.isScheduled) {
      this.isScheduled = true;
      process.nextTick(() => this.processBuffer());
    }
  }

  private executeOperation(operation: PendingWrite['operation'], data: any): any {
    switch (operation) {
      case 'create_entities':
        return this.manager.createEntities(data.entities);
      case 'add_observations':
        return this.manager.addObservations(data.observations);
      case 'create_relations':
        return this.manager.createRelations(data.relations);
      case 'delete_entities':
        return this.manager.deleteEntities(data.entityNames);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  private groupOperations(operations: PendingWrite[]) {
    const groups = {
      creates: [] as PendingWrite[],
      relations: [] as PendingWrite[],
      observations: [] as PendingWrite[],
      deletes: [] as PendingWrite[],
    };

    for (const op of operations) {
      switch (op.operation) {
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
