/**
 * High-performance SQLite database implementation with better-sqlite3
 * Optimized for speed with prepared statements, indexes, and WAL mode
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync, copyFileSync, statSync } from 'fs';
import { dirname } from 'path';
import {
  EntityRow,
  RelationRow,
  GraphResult,
  EntityResult,
  RelationResult,
  DatabaseStats,
  SearchOptions,
  CreateEntityInput,
  CreateRelationInput,
  ObservationUpdate,
  ObservationDeletion,
  GetNeighborsOptions,
  FindShortestPathOptions,
  ShortestPathResult,
  RichContent,
  TextContent,
} from './types.js'
import { ICache, createStringCache } from './utils/cache-interface.js'
import { CountingBloomFilter } from './utils/counting-bloom-filter.js'
import { CompressionUtils } from './utils/compression.js'
import { ConnectionPool } from './utils/connection-pool.js'
import { getCompleteSchema, getPragmas } from './database-schema.js'
import { logger, logInfo, logDebug, logError, PerformanceTracker } from './utils/logger.js'
import { stringifyObservations, parseObservations } from './utils/fast-json.js'
import { config } from './config.js'
import { ValidationError } from './errors.js'
import { createCircuitBreaker } from './utils/circuit-breaker.js'
import { Worker } from 'worker_threads';
import { parseSearchQuery, buildFTSQuery, calculateRelevance, generateHighlights, determineMatchType, sortByRelevance, filterSearchResults } from './utils/search-optimizer.js'
import { analyzeSearchIntent, generateSearchSuggestions } from './utils/context-aware-search.js';
import { needsFTSMigration, migrateFTSToPorterUnicode61 } from './utils/fts-migration.js';
import { MemoryAgingSystem, MEMORY_AGING_PRESETS } from './utils/memory-aging.js';

const LARGE_BATCH_THRESHOLD = 1000;

// Set profilingEnabled to use config.performance.profilingEnabled
const profilingEnabled = config.performance.profilingEnabled;

// Utility for structured logging
function logProfile(event: string, data: Record<string, any>, correlationId?: string) {
  if (!profilingEnabled) return;
  const log = {
    timestamp: new Date().toISOString(),
    level: 'profile',
    event,
    correlationId: correlationId || uuidv4(),
    ...data,
  };
  process.stderr.write(JSON.stringify(log) + '\n');
}

// Use a local uuidv4 function as previously defined
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0,
      v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class MemoryDatabase {
  private db!: Database.Database;
  protected readonly dbPath: string;
  private readPool?: ConnectionPool;

  // Performance optimizations
  protected readonly entityCache: ICache<string, EntityResult>;
  protected readonly searchCache: ICache<string, GraphResult>;
  protected entityBloom!: CountingBloomFilter;
  protected readonly compressionEnabled: boolean = config.performance.compressionEnabled;
  private readonly useReadPool: boolean = config.performance.useReadPool ?? true;
  private readonly relationQueryThreshold: number = config.performance.relationQueryThreshold;

  // Transaction management
  private transactionDepth: number = 0;
  private isInTransaction: boolean = false;
  private searchCacheClearPending: boolean = false;
  private readonly bulkOperationCircuitBreaker = createCircuitBreaker({
    failureThreshold: 3,
    recoveryTimeout: 60000, // 1 minute
    enableBulkOperations: config.performance.enableBulkOperations
  });

  // Memory aging system
  private memoryAging: MemoryAgingSystem;

  // Prepared statements for maximum performance
  private statements: {
    createEntity?: Database.Statement;
    createEntityFast?: Database.Statement;
    getEntity?: Database.Statement;
    searchEntities?: Database.Statement;
    searchEntitiesLike?: Database.Statement;
    createRelation?: Database.Statement;
    deleteEntity?: Database.Statement;
    deleteRelation?: Database.Statement;
    updateObservations?: Database.Statement;
    getRelationsByEntity?: Database.Statement;
    getEntityStats?: Database.Statement;
    updateEntityAccess?: Database.Statement;
    updateRelationAccess?: Database.Statement;
    getAgingStats?: Database.Statement;
  } = {};

  constructor(dbPath: string) {
    this.dbPath = dbPath;

    // Initialize memory aging system
    this.memoryAging = new MemoryAgingSystem(MEMORY_AGING_PRESETS.BALANCED);

    // Initialize caches
    this.entityCache = createStringCache<EntityResult>(
      config.performance.cacheStrategy,
      config.performance.entityCacheSize
    );
    this.searchCache = createStringCache<GraphResult>(
      config.performance.cacheStrategy,
      config.performance.searchCacheSize
    );

    // Initialize database
    this.initDatabase();

    // Initialize read pool if enabled
    if (this.useReadPool && existsSync(this.dbPath)) {
      this.readPool = new ConnectionPool(this.dbPath, {
        minConnections: Math.max(2, Math.floor(config.performance.readPoolSize / 4)),
        maxConnections: config.performance.readPoolSize,
        acquireTimeout: 5000,
        idleTimeout: 60000,
        readonly: true,
      });
      logInfo('Read pool initialized', {
        minConnections: Math.max(2, Math.floor(config.performance.readPoolSize / 4)),
        maxConnections: 5,
      });
    }

    // Initialize bloom filter
    this.initializeBloomFilter();
  }

  private initDatabase(): void {
    const perf = new PerformanceTracker('database_initialization', { dbPath: this.dbPath });

    const dir = dirname(this.dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(this.dbPath);
    logInfo('Initializing database', { path: this.dbPath });

    // Apply optimizations
    const pragmas = getPragmas();
    for (const pragma of pragmas) {
      this.db.exec(pragma);
    }

    // Create schema
    this.db.exec(getCompleteSchema());

    // Check and migrate FTS to Porter + Unicode61 Tokenizer if needed
    if (needsFTSMigration(this.dbPath)) {
      logInfo('FTS migration to Porter + Unicode61 Tokenizer required', { dbPath: this.dbPath });
      const migrationResult = migrateFTSToPorterUnicode61(this.dbPath);
      if (migrationResult.success) {
        logInfo('FTS migration completed successfully', {
          migrationTime: migrationResult.migrationTime,
          oldConfig: migrationResult.oldConfig,
          newConfig: migrationResult.newConfig
        });
      } else {
        logError('FTS migration failed', new Error(migrationResult.error || 'Unknown error'), {
          dbPath: this.dbPath
        });
      }
    }

    // Prepare statements for performance
    this.prepareStatements();

    perf.end({ status: 'success' });
  }

  private prepareStatements(): void {
    this.statements.createEntity = this.db.prepare(`
      INSERT INTO entities (name, entity_type, observations)
      VALUES (?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET
        entity_type = excluded.entity_type,
        observations = excluded.observations,
        updated_at = julianday('now')
    `);

    // Fast insert without conflict handling for new entities
    this.statements.createEntityFast = this.db.prepare(`
      INSERT INTO entities (name, entity_type, observations, created_at, updated_at)
      VALUES (?, ?, ?, julianday('now'), julianday('now'))
    `);

    this.statements.getEntity = this.db.prepare('SELECT * FROM entities WHERE name = ?');

    this.statements.searchEntities = this.db.prepare(`
      SELECT e.* FROM entities e
      JOIN entities_fts ON e.name = entities_fts.name
      WHERE entities_fts MATCH ? ORDER BY rank LIMIT ?
    `);

    this.statements.searchEntitiesLike = this.db.prepare(`
      SELECT * FROM entities
      WHERE name LIKE ? OR entity_type LIKE ? OR observations LIKE ?
      ORDER BY updated_at DESC LIMIT ?
    `);

    this.statements.createRelation = this.db.prepare(`
      INSERT OR IGNORE INTO relations (from_entity, to_entity, relation_type)
      VALUES (?, ?, ?)
    `);

    this.statements.deleteEntity = this.db.prepare('DELETE FROM entities WHERE name = ?');

    this.statements.deleteRelation = this.db.prepare(
      'DELETE FROM relations WHERE from_entity = ? AND to_entity = ? AND relation_type = ?'
    );

    this.statements.updateObservations = this.db.prepare(
      "UPDATE entities SET observations = ?, updated_at = julianday('now') WHERE name = ?"
    );

    this.statements.getRelationsByEntity = this.db.prepare(`
      SELECT * FROM relations
      WHERE from_entity = ? OR to_entity = ?
    `);

    this.statements.getEntityStats = this.db.prepare(
      'SELECT entity_type, COUNT(*) as count FROM entities GROUP BY entity_type'
    );

    // Memory aging statements
    this.statements.updateEntityAccess = this.db.prepare(`
      UPDATE entities
      SET access_count = ?, last_accessed = ?, prominence_score = ?, updated_at = julianday('now')
      WHERE name = ?
    `);

    this.statements.updateRelationAccess = this.db.prepare(`
      UPDATE relations
      SET access_count = ?, last_accessed = ?, prominence_score = ?
      WHERE id = ?
    `);

    this.statements.getAgingStats = this.db.prepare(`
      SELECT
        COUNT(*) as total_entities,
        COUNT(CASE WHEN prominence_score > ? THEN 1 END) as active_entities,
        COUNT(CASE WHEN prominence_score <= ? THEN 1 END) as forgotten_entities,
        AVG(prominence_score) as avg_prominence,
        AVG(access_count) as avg_access_count
      FROM entities
    `);
  }

  // Helper method to execute read queries through the pool if available
  private async executeRead<T>(callback: (db: Database.Database) => T): Promise<T> {
    if (this.readPool) {
      const conn = await this.readPool.acquire();
      try {
        return callback(conn.db);
      } finally {
        this.readPool.release(conn);
      }
    }
    return callback(this.db);
  }

  // Synchronous wrapper for read operations
  private executeReadSync<T>(callback: (db: Database.Database) => T): T {
    // For now, fall back to main connection for sync operations
    // TODO: Implement sync pool operations if needed
    return callback(this.db);
  }

  private initializeBloomFilter(): void {
    const bloomPath = this.dbPath.replace('.db', '.cbloom');
    const loadedFilter = CountingBloomFilter.loadFromFileSync(bloomPath);

    if (loadedFilter) {
      this.entityBloom = loadedFilter;
      logInfo('Counting Bloom filter loaded from disk', { path: bloomPath });
    } else {
      this.entityBloom = new CountingBloomFilter(
        config.bloomFilter.expectedItems,
        config.bloomFilter.falsePositiveRate
      );
      this.entityBloom.initSync();
      logInfo('New Counting Bloom filter created', {
        expectedItems: config.bloomFilter.expectedItems,
        falsePositiveRate: config.bloomFilter.falsePositiveRate,
      });
      this.populateBloomFilter();
      this.saveBloomFilter();
    }
  }

  private populateBloomFilter(): void {
    if (!this.entityBloom) return;
    const rows = this.db.prepare('SELECT name FROM entities').all() as { name: string }[];
    for (const row of rows) {
      this.entityBloom.add(row.name.toLowerCase());
    }
  }

  private saveBloomFilter(): void {
    if (!this.entityBloom) return;
    const bloomPath = this.dbPath.replace('.db', '.cbloom');
    try {
      this.entityBloom.saveToFileSync(bloomPath);
      logDebug('Counting Bloom filter saved to disk', { path: bloomPath });
    } catch (error) {
      logError('Failed to save counting bloom filter', error as Error, { path: bloomPath });
    }
  }

  // Transaction helpers
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  createEntities(entities: CreateEntityInput[]): EntityResult[] {
    const correlationId = uuidv4();
    const start = process.hrtime.bigint();
    logProfile('createEntities_start', { count: entities.length }, correlationId);

    // Fast path for single entity creation
    if (entities.length === 1) {
      // Patch: ensure observations is always an array
      if (!entities[0].observations) entities[0].observations = [];
      return this.createSingleEntityOptimized(
        entities[0],
        new PerformanceTracker('createSingleEntityOptimized', { single: true })
      );
    }

    // Use batch method if enabled and above threshold
    if (
      config.performance.enableBulkOperations &&
      entities.length >= config.performance.batchSize
    ) {
      // Patch: ensure observations is always an array for all entities
      for (const entity of entities) {
        if (!entity.observations) entity.observations = [];
      }
      return this.createEntitiesBatch(entities);
    }

    // Patch: ensure observations is always an array for all entities
    for (const entity of entities) {
      if (!entity.observations) entity.observations = [];
    }

    const created = this.transaction(() => {
      const results: EntityResult[] = [];

      for (const entity of entities) {
        // Validate entity has required fields
        if (!entity.name) {
          throw new ValidationError('Entity name is required', 'name', entity);
        }

        const observationsData = this.compressionEnabled
          ? CompressionUtils.compressObservations(entity.observations)
          : stringifyObservations(entity.observations);

        this.statements.createEntity!.run(entity.name, entity.entityType, observationsData);

        const result: EntityResult = {
          type: 'entity',
          name: entity.name,
          entityType: entity.entityType,
          observations: entity.observations,
        };
        results.push(result);

        // Update caches
        this.entityCache.set(entity.name.toLowerCase(), result);
        this.entityBloom.add(entity.name.toLowerCase());
      }

      return results;
    });

    // Clear search cache as new entities were added
    this.searchCache.clear();
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;
    logProfile('createEntities_end', {
      count: entities.length,
      durationMs,
      avgPerEntity: durationMs / entities.length,
      created: created.length
    }, correlationId);
    return created;
  }

  // Optimized single entity creation with minimal overhead
  private createSingleEntityOptimized(
    entity: CreateEntityInput,
    perf: PerformanceTracker
  ): EntityResult[] {
    const correlationId = uuidv4();
    const start = process.hrtime.bigint();
    logProfile('createSingleEntityOptimized_start', { name: entity.name }, correlationId);
    // Patch: ensure observations is always an array
    if (!entity.observations) entity.observations = [];
    // Validate entity has required fields
    if (!entity.name) {
      throw new ValidationError('Entity name is required', 'name', entity);
    }
    // Skip compression for small observations (< 100 chars total)
    const observationsStr = stringifyObservations(entity.observations);
    const shouldCompress = this.compressionEnabled && observationsStr.length > 100;
    const observationsData = shouldCompress
      ? CompressionUtils.compressObservations(entity.observations)
      : observationsStr;

    const lowerName = entity.name.toLowerCase();
    const exists = this.entityBloom.contains(lowerName);

    // Skip transaction for non-conflicting inserts
    if (!exists) {
      try {
        // Use fast insert without ON CONFLICT
        this.statements.createEntityFast!.run(entity.name, entity.entityType, observationsData);

        const result: EntityResult = {
          type: 'entity',
          name: entity.name,
          entityType: entity.entityType,
          observations: entity.observations,
        };

        // Update caches
        this.entityCache.set(lowerName, result);
        this.entityBloom.add(lowerName);

        // Skip search cache clearing for single entity
        perf.end({ created: 1, optimized: true, fastPath: true });
        const end = process.hrtime.bigint();
        const durationMs = Number(end - start) / 1_000_000;
        logProfile('createSingleEntityOptimized_end', {
          name: entity.name,
          durationMs
        }, correlationId);
        return [result];
      } catch (error: any) {
        // If it's a unique constraint error, fall through to update path
        if (!error.message?.includes('UNIQUE constraint')) {
          throw error;
        }
      }
    }

    // For updates, use deferred transaction to reduce lock time
    this.db.exec('BEGIN DEFERRED');

    try {
      this.statements.createEntity!.run(entity.name, entity.entityType, observationsData);
      this.db.exec('COMMIT');

      const result: EntityResult = {
        type: 'entity',
        name: entity.name,
        entityType: entity.entityType,
        observations: entity.observations,
      };

      // Update caches after commit
      this.entityCache.set(lowerName, result);
      this.entityBloom.add(lowerName);

      // Defer search cache clearing (batch with other operations)
      if (!this.searchCacheClearPending) {
        this.searchCacheClearPending = true;
        process.nextTick(() => {
          this.searchCache.clear();
          this.searchCacheClearPending = false;
        });
      }

      perf.end({ created: 1, optimized: true, update: true });
      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1_000_000;
      logProfile('createSingleEntityOptimized_end', {
        name: entity.name,
        durationMs
      }, correlationId);
      return [result];
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

    // Optimized batch entity creation for better performance
  createEntitiesBatch(entities: CreateEntityInput[]): EntityResult[] {
    const correlationId = uuidv4();
    const start = process.hrtime.bigint();
    logProfile('createEntitiesBatch_start', { count: entities.length }, correlationId);

    if (entities.length === 0) return [];

    const perf = { end: () => {} };

    // Use regular method for small batches
    if (entities.length < 10) {
      return this.createEntities(entities);
    }

    // Calculate optimal batch size if dynamic sizing is enabled
    let batchSize = entities.length;
    if (config.performance.enableDynamicBatchSizing) {
      const averageEntitySize = this.calculateAverageEntitySize(entities);
      const optimalBatchSize = Math.min(
        config.performance.maxBatchSize,
        Math.floor((config.performance.targetBatchMemoryMb * 1024 * 1024) / averageEntitySize),
        entities.length
      );

      if (optimalBatchSize < entities.length) {
        // Process in smaller batches
        const results: EntityResult[] = [];
        for (let i = 0; i < entities.length; i += optimalBatchSize) {
          const batch = entities.slice(i, i + optimalBatchSize);
          const batchResults = this.createEntitiesBatch(batch);
          results.push(...batchResults);
        }
        return results;
      }

      batchSize = optimalBatchSize;
    }

    const results = this.bulkOperationCircuitBreaker.executeSync(
      () => this.executeBulkEntityCreation(entities, perf, correlationId),
      'createEntitiesBatch'
    );
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;
    logProfile('createEntitiesBatch_end', {
      count: entities.length,
      durationMs,
      avgPerEntity: durationMs / entities.length,
      created: results.length
    }, correlationId);
    return results;
  }

  // New: Asynchronous worker-based batch entity creation
  async createEntitiesBatchAsync(entities: CreateEntityInput[]): Promise<number> {
    if (entities.length <= LARGE_BATCH_THRESHOLD) {
      this.createEntitiesBatch(entities);
      return entities.length;
    }
    return new Promise((resolve, reject) => {
      const worker = new Worker(require.resolve('./workers/entity-bulk-insert-worker'), {
        workerData: {
          dbPath: this.dbPath,
          entities,
        },
      });
      worker.on('message', (msg) => {
        if (msg.type === 'done') {
          resolve(msg.inserted);
        } else if (msg.type === 'error') {
          reject(new Error(msg.error));
        } else if (msg.type === 'progress') {
          // Optionally: emit progress events or log
        }
      });
      worker.on('error', reject);
      worker.on('exit', (code) => {
        if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
      });
    });
  }

  // Calculate average entity size for dynamic batch sizing
  private calculateAverageEntitySize(entities: CreateEntityInput[]): number {
    if (entities.length === 0) return 1024; // Default 1KB

    const totalSize = entities.reduce((sum, entity) => {
      const nameSize = entity.name.length;
      const typeSize = entity.entityType.length;
      const observationsSize = entity.observations.reduce((obsSum, obs) => {
        if (obs.type === 'text') return obsSum + obs.text.length;
        if (obs.type === 'image' || obs.type === 'audio' || obs.type === 'resource') {
          return obsSum + (obs.data?.length || 0);
        }
        if (obs.type === 'resource_link') return obsSum + (obs.uri?.length || 0);
        return obsSum + 100; // Default size for unknown types
      }, 0);
      return sum + nameSize + typeSize + observationsSize;
    }, 0);

    return Math.max(totalSize / entities.length, 100); // Minimum 100 bytes
  }

  // Enhanced bulk operations with index deferral and memory optimization
  private executeBulkEntityCreation(entities: CreateEntityInput[], perf: any = { end: () => {} }, correlationId?: string): EntityResult[] {
    const startMem = process.memoryUsage();
    const start = process.hrtime.bigint();
    logProfile('executeBulkEntityCreation_start', {
      count: entities.length,
      memory: startMem
    }, correlationId);

    // Monitor memory usage during bulk operations (MCP Section 8.3)
    const memoryBefore = process.memoryUsage();
    logDebug('Bulk operation memory baseline', {
      rss: Math.round(memoryBefore.rss / 1024 / 1024),
      heapUsed: Math.round(memoryBefore.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memoryBefore.heapTotal / 1024 / 1024),
      external: Math.round(memoryBefore.external / 1024 / 1024)
    });

    // Store original PRAGMA settings for restoration
    const originalDeferForeignKeys = this.db.pragma('defer_foreign_keys', { simple: true });
    const originalSynchronous = this.db.pragma('synchronous', { simple: true });
    const originalJournalMode = this.db.pragma('journal_mode', { simple: true });

    // Optimize for bulk operations with aggressive settings (must be outside transaction)
    this.db.exec('PRAGMA defer_foreign_keys = ON');
    this.db.exec('PRAGMA synchronous = NORMAL');
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec('PRAGMA cache_size = -64000'); // 250MB cache for bulk operations
    this.db.exec('PRAGMA temp_store = MEMORY');
    this.db.exec('PRAGMA mmap_size = 268435456'); // 256MB mmap

    const created = this.transaction(() => {
      const triggerDisableStart = Date.now();

      // Temporarily disable FTS triggers for bulk insert
      this.db.exec('DROP TRIGGER IF EXISTS entities_fts_insert');

      const triggerDisableTime = Date.now() - triggerDisableStart;
      logDebug('FTS trigger disabled', {
        duration: triggerDisableTime,
        optimization: 'enabled'
      });

      try {
        const compressionStart = Date.now();

        // Pre-compress all observations with memory optimization
        const preparedData = entities.map((e) => ({
          name: e.name,
          entityType: e.entityType,
          observations: e.observations,
          observationsData: this.compressionEnabled
            ? CompressionUtils.compressObservations(e.observations)
            : stringifyObservations(e.observations),
        }));

        const compressionTime = Date.now() - compressionStart;
        logDebug('Observations prepared', {
          count: entities.length,
          compressionTime,
          compressionEnabled: this.compressionEnabled
        });

        const insertStart = Date.now();

        // Build bulk insert query with optimized batch size
        const batchSize = Math.min(entities.length, 5000); // Limit batch size for memory efficiency
        const results: EntityResult[] = [];

        for (let i = 0; i < entities.length; i += batchSize) {
          const batch = preparedData.slice(i, i + batchSize);
          const placeholders = batch
            .map(() => "(?, ?, ?, julianday('now'), julianday('now'))")
            .join(',');
          const values = batch.flatMap((e) => [e.name, e.entityType, e.observationsData]);

          // Execute bulk insert for this batch
          this.db
            .prepare(
              `INSERT OR IGNORE INTO entities (name, entity_type, observations, created_at, updated_at)
             VALUES ${placeholders}`
            )
            .run(...values);

          // Build results for this batch
          batch.forEach((e) => {
            results.push({
              type: 'entity',
              name: e.name,
              entityType: e.entityType,
              observations: e.observations
            });
          });

          // Force garbage collection between batches if available
          if (global.gc && i % (batchSize * 2) === 0) {
            global.gc();
          }
        }

        const insertTime = Date.now() - insertStart;
        logDebug('Bulk insert completed', {
          entities: entities.length,
          insertTime,
          avgPerEntity: Math.round(insertTime / entities.length),
          batchSize
        });

        const ftsStart = Date.now();

        // Bulk update FTS with optimized approach
        const ftsBatchSize = 1000; // Smaller batches for FTS to avoid memory issues
        for (let i = 0; i < entities.length; i += ftsBatchSize) {
          const batch = entities.slice(i, i + ftsBatchSize);
          const ftsPlaceholders = batch.map(() => '?').join(',');
          this.db
            .prepare(
              `INSERT INTO entities_fts (name, entity_type, observations)
             SELECT name, entity_type, observations FROM entities
             WHERE name IN (${ftsPlaceholders})`
            )
            .run(...batch.map((e) => e.name));
        }

        const ftsTime = Date.now() - ftsStart;
        logDebug('FTS bulk update completed', {
          entities: entities.length,
          ftsTime,
          avgPerEntity: Math.round(ftsTime / entities.length)
        });

        // Recreate FTS trigger
        this.db.exec(`
          CREATE TRIGGER IF NOT EXISTS entities_fts_insert AFTER INSERT ON entities
          BEGIN
            INSERT INTO entities_fts(name, entity_type, observations)
            VALUES (new.name, new.entity_type, new.observations);
          END
        `);

        // Rebuild FTS index to ensure sync after bulk insert
        this.db.exec(`INSERT INTO entities_fts(entities_fts) VALUES('rebuild');`);

        return results;

      } finally {
        // No PRAGMA changes here
      }
    });

    // Restore original PRAGMA settings (must be outside transaction)
    this.db.exec(`PRAGMA defer_foreign_keys = ${originalDeferForeignKeys}`);
    this.db.exec(`PRAGMA synchronous = ${originalSynchronous}`);
    this.db.exec(`PRAGMA journal_mode = ${originalJournalMode}`);
    this.db.exec('PRAGMA cache_size = -16384'); // Restore default cache size
    this.db.exec('PRAGMA mmap_size = 268435456'); // Keep mmap for performance

    // Monitor memory usage after bulk operations
    const memoryAfter = process.memoryUsage();
    logDebug('Bulk operation memory after', {
      rss: Math.round(memoryAfter.rss / 1024 / 1024),
      heapUsed: Math.round(memoryAfter.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memoryAfter.heapTotal / 1024 / 1024),
      external: Math.round(memoryAfter.external / 1024 / 1024),
      rssDelta: Math.round((memoryAfter.rss - memoryBefore.rss) / 1024 / 1024),
      heapDelta: Math.round((memoryAfter.heapUsed - memoryBefore.heapUsed) / 1024 / 1024)
    });

    // Update bloom filter
    entities.forEach(entity => {
      this.entityBloom.add(entity.name);
    });

    // Batch update caches
    created.forEach(entity => {
      this.entityCache.set(entity.name, entity);
    });

    // Clear search cache if needed
    if (this.searchCacheClearPending) {
      this.searchCache.clear();
      this.searchCacheClearPending = false;
    }

    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;

    perf.end({
      count: entities.length,
      durationMs,
      avgPerEntity: durationMs / entities.length,
      optimization: 'bulk'
    });

    logProfile('executeBulkEntityCreation_end', {
      count: entities.length,
      durationMs,
      avgPerEntity: durationMs / entities.length,
      created: created.length,
      memoryDelta: Math.round((memoryAfter.rss - memoryBefore.rss) / 1024 / 1024)
    }, correlationId);

    return created;
  }

  createRelations(relations: CreateRelationInput[]): RelationResult[] {
    // Use batch method if enabled and above threshold
    if (
      config.performance.enableBulkOperations &&
      relations.length >= config.performance.batchSize
    ) {
      return this.createRelationsBatch(relations);
    }

    const created: RelationResult[] = [];

    this.transaction(() => {
      for (const relation of relations) {
        const result = this.statements.createRelation!.run(
          relation.from,
          relation.to,
          relation.relationType
        );

        if (result.changes > 0) {
          created.push({
            type: 'relation',
            from: relation.from,
            to: relation.to,
            relationType: relation.relationType,
          });
        }
      }
    });

    return created;
  }

  createRelationsBatch(relations: CreateRelationInput[]): RelationResult[] {
    const perf = new PerformanceTracker('createRelationsBatch', { count: relations.length });

    if (relations.length === 0) {
      perf.end({ status: 'empty' });
      return [];
    }

    const created: RelationResult[] = [];
    const batchSize = 1000; // SQLite limit is 999 parameters, so use 1000 relations max per batch (3000 params)

    this.transaction(() => {
      // Process relations in batches to avoid SQLite parameter limit
      for (let i = 0; i < relations.length; i += batchSize) {
        const batch = relations.slice(i, i + batchSize);

        // Build bulk insert query for this batch
        const placeholders = batch.map(() => '(?, ?, ?)').join(', ');
        const bulkQuery = `
          INSERT OR IGNORE INTO relations (from_entity, to_entity, relation_type)
          VALUES ${placeholders}
        `;

        // Flatten parameters for this batch
        const params = batch.flatMap((relation) => [
          relation.from,
          relation.to,
          relation.relationType,
        ]);

        // Execute bulk insert for this batch
        const result = this.db.prepare(bulkQuery).run(...params);

        // Build results for this batch
        batch.forEach((relation) => {
          created.push({
            type: 'relation',
            from: relation.from,
            to: relation.to,
            relationType: relation.relationType,
          });
        });
      }
    });

    perf.end({ status: 'success', created: created.length });
    return created;
  }

  getEntity(name: string): EntityResult | undefined {
    const lowerName = name.toLowerCase();

    // Check cache first
    const cached = this.entityCache.get(lowerName);
    if (cached) return cached;

    // Check bloom filter
    if (!this.entityBloom.contains(lowerName)) return undefined;

    // Query database
    const row = this.statements.getEntity!.get(name) as EntityRow | undefined;
    if (!row) return undefined;

    const entity: EntityResult = {
      type: 'entity',
      name: row.name,
      entityType: row.entity_type,
      observations: this.compressionEnabled
        ? CompressionUtils.decompressObservations(row.observations)
        : parseObservations(row.observations),
    };

    // Cache the result
    this.entityCache.set(lowerName, entity);
    return entity;
  }

  searchNodes(options: SearchOptions): GraphResult {
    const { query, limit = 20, searchContext, searchMode, contentTypes, intent } = options;

    // Create enhanced cache key with context
    const contextHash = searchContext ? JSON.stringify(searchContext) : '';
    const cacheKey = `search:${query}:${limit}:${contextHash}:${searchMode || 'hybrid'}`;

    // Check cache
    const cached = this.searchCache.get(cacheKey);
    if (cached) return cached;

    // Parse and optimize the search query with context awareness
    const searchQuery = parseSearchQuery(query);

    // Override search mode if specified
    if (searchMode) {
      searchQuery.searchMode = searchMode;
    }

    // Override content types if specified
    if (contentTypes) {
      searchQuery.contentTypes = contentTypes;
    }

    const ftsQuery = buildFTSQuery(searchQuery);

    // Use read pool if available for better concurrency
    const executeSearch = async () => {
      if (this.readPool) {
        const conn = await this.readPool.acquire();
        try {
          // Enhanced FTS search with ranking
          const searchStmt = conn.db.prepare(`
            SELECT
              e.*,
              entities_fts.rank as fts_rank,
              entities_fts.name as fts_name,
              entities_fts.entity_type as fts_entity_type,
              entities_fts.observations as fts_observations
            FROM entities_fts
            JOIN entities e ON e.name = entities_fts.name
            WHERE entities_fts MATCH ?
            ORDER BY entities_fts.rank
            LIMIT ?
          `);

          const likeStmt = conn.db.prepare(`
            SELECT * FROM entities
            WHERE name LIKE ? OR entity_type LIKE ? OR observations LIKE ?
            LIMIT ?
          `);

          // Enhanced FTS search first
          let rows = searchStmt.all(ftsQuery, limit * 2) as (EntityRow & { fts_rank?: number })[];

          // Fallback to LIKE search if no FTS results
          if (rows.length === 0) {
            const likePattern = `%${query}%`;
            rows = likeStmt.all(likePattern, likePattern, likePattern, limit) as (EntityRow & { fts_rank?: number })[];
          }

          return rows;
        } finally {
          await this.readPool.release(conn);
        }
      } else {
        // Fallback to main connection with enhanced search
        const searchStmt = this.db.prepare(`
          SELECT
            e.*,
            entities_fts.rank as fts_rank,
            entities_fts.name as fts_name,
            entities_fts.entity_type as fts_entity_type,
            entities_fts.observations as fts_observations
          FROM entities_fts
          JOIN entities e ON e.name = entities_fts.name
          WHERE entities_fts MATCH ?
          ORDER BY entities_fts.rank
          LIMIT ?
        `);

        let rows = searchStmt.all(ftsQuery, limit * 2) as (EntityRow & { fts_rank: number })[];

        if (rows.length === 0) {
          const likePattern = `%${query}%`;
          const likeRows = this.statements.searchEntitiesLike!.all(
            likePattern,
            likePattern,
            likePattern,
            limit
          ) as EntityRow[];
          // Add fts_rank property for consistency
          rows = likeRows.map(row => ({ ...row, fts_rank: 0 }));
        }

        return rows;
      }
    };

    // Execute search (sync wrapper for now)
    let rows: (EntityRow & { fts_rank?: number })[] = [];

    if (this.readPool) {
      // For now, fall back to sync until we convert to async
      const searchStmt = this.db.prepare(`
        SELECT
          e.*,
          entities_fts.rank as fts_rank,
          entities_fts.name as fts_name,
          entities_fts.entity_type as fts_entity_type,
          entities_fts.observations as fts_observations
        FROM entities_fts
        JOIN entities e ON e.name = entities_fts.name
        WHERE entities_fts MATCH ?
        ORDER BY entities_fts.rank
        LIMIT ?
      `);

      rows = searchStmt.all(ftsQuery, limit * 2) as (EntityRow & { fts_rank: number })[];

      if (rows.length === 0) {
        const likePattern = `%${query}%`;
        rows = this.statements.searchEntitiesLike!.all(
          likePattern,
          likePattern,
          likePattern,
          limit
        ) as EntityRow[];
      }
    } else {
      const searchStmt = this.db.prepare(`
        SELECT
          e.*,
          entities_fts.rank as fts_rank,
          entities_fts.name as fts_name,
          entities_fts.entity_type as fts_entity_type,
          entities_fts.observations as fts_observations
        FROM entities_fts
        JOIN entities e ON e.name = entities_fts.name
        WHERE entities_fts MATCH ?
        ORDER BY entities_fts.rank
        LIMIT ?
      `);

      rows = searchStmt.all(ftsQuery, limit * 2) as (EntityRow & { fts_rank: number })[];

      if (rows.length === 0) {
        const likePattern = `%${query}%`;
        const likeRows = this.statements.searchEntitiesLike!.all(
          likePattern,
          likePattern,
          likePattern,
          limit
        ) as EntityRow[];
        // Add fts_rank property for consistency
        rows = likeRows.map(row => ({ ...row, fts_rank: 0 }));
      }
    }

    // Convert rows to entities with enhanced relevance scoring
    const searchResults = rows.map((row) => {
      const entity = {
        type: 'entity' as const,
        name: row.name,
        entityType: row.entity_type,
        observations: this.compressionEnabled
          ? CompressionUtils.decompressObservations(row.observations)
          : parseObservations(row.observations),
      };

      const relevance = calculateRelevance(row, searchQuery, row.fts_rank || 0, searchContext);
      const highlights = generateHighlights(row, searchQuery, searchContext);
      const matchType = determineMatchType(row, searchQuery);

      return {
        entity,
        relevance,
        highlights,
        matchType,
        score: relevance, // Add score property for compatibility
      };
    });

    // Sort by relevance and apply filters
    const sortedResults = sortByRelevance(searchResults);
    const filteredResults = filterSearchResults(sortedResults, {
      maxResults: limit,
      minRelevance: 0.1, // Minimum relevance threshold
    });

    // Extract entities for final result
    const entities: EntityResult[] = filteredResults.map(result => result.entity);

    // Update entity cache
    entities.forEach((entity) => this.entityCache.set(entity.name.toLowerCase(), entity));

    // Get relations for found entities
    const entityNames = entities.map((e) => e.name);
    const relations = entityNames.length > 0 ? this.getRelationsForEntities(entityNames) : [];

    const result = { entities, relations };
    this.searchCache.set(cacheKey, result);
    return result;
  }

  readGraph(limit?: number, offset: number = 0): GraphResult {
    const totalEntities = (this.db.prepare('SELECT COUNT(*) as count FROM entities').get() as any)
      .count;
    const totalRelations = (this.db.prepare('SELECT COUNT(*) as count FROM relations').get() as any)
      .count;

    const entityQuery = limit
      ? `SELECT * FROM entities ORDER BY updated_at DESC LIMIT ${limit} OFFSET ${offset}`
      : 'SELECT * FROM entities ORDER BY updated_at DESC';

    const entityRows = this.db.prepare(entityQuery).all() as EntityRow[];

    const entities: EntityResult[] = entityRows.map((row) => ({
      type: 'entity',
      name: row.name,
      entityType: row.entity_type,
      observations: this.compressionEnabled
        ? CompressionUtils.decompressObservations(row.observations)
        : parseObservations(row.observations),
    }));

    const relations =
      entities.length > 0 ? this.getRelationsForEntities(entities.map((e) => e.name)) : [];

    return {
      entities,
      relations,
      pagination: limit
        ? {
            totalEntities,
            totalRelations,
            offset,
            limit,
            hasMore: offset + entities.length < totalEntities,
          }
        : undefined,
    };
  }

  getRelationsForEntities(entityNames: string[]): RelationResult[] {
    if (entityNames.length === 0) return [];

    // Use temporary table for large queries
    if (entityNames.length > this.relationQueryThreshold) {
      return this.transaction(() => {
        // Create temp table
        this.db.exec('CREATE TEMP TABLE IF NOT EXISTS temp_entities (name TEXT PRIMARY KEY)');

        const insertStmt = this.db.prepare('INSERT OR IGNORE INTO temp_entities VALUES (?)');
        for (const name of entityNames) {
          insertStmt.run(name);
        }

        // Query using temp table
        const rows = this.db
          .prepare(
            `
          SELECT DISTINCT r.* FROM relations r
          WHERE r.from_entity IN (SELECT name FROM temp_entities)
             OR r.to_entity IN (SELECT name FROM temp_entities)
        `
          )
          .all() as RelationRow[];

        // Clean up
        this.db.exec('DROP TABLE temp_entities');

        return rows.map((row) => ({
          type: 'relation',
          from: row.from_entity,
          to: row.to_entity,
          relationType: row.relation_type,
        }));
      });
    }

    // Use IN clause for small queries
    const placeholders = entityNames.map(() => '?').join(',');
    const rows = this.db
      .prepare(
        `
      SELECT * FROM relations
      WHERE from_entity IN (${placeholders})
         OR to_entity IN (${placeholders})
    `
      )
      .all(...entityNames, ...entityNames) as RelationRow[];

    return rows.map((row) => ({
      type: 'relation',
      from: row.from_entity,
      to: row.to_entity,
      relationType: row.relation_type,
    }));
  }

  getNeighbors(entityName: string, options: GetNeighborsOptions): GraphResult {
    const { direction = 'both', relationType, depth = 1, includeRelations = true } = options;

    if (depth < 1 || depth > 5) {
      throw new Error('Depth must be between 1 and 5');
    }

    // Get all relations for the entity
    const allRelations = this.getRelationsForEntities([entityName]);

    // Filter relations based on direction and type
    const filteredRelations = allRelations.filter(relation => {
      // Filter by direction
      if (direction === 'outgoing' && relation.from !== entityName) return false;
      if (direction === 'incoming' && relation.to !== entityName) return false;

      // Filter by relation type if specified
      if (relationType && relation.relationType !== relationType) return false;

      return true;
    });

    // Get connected entity names
    const connectedNames = new Set<string>();
    for (const relation of filteredRelations) {
      if (relation.from === entityName) {
        connectedNames.add(relation.to);
      } else {
        connectedNames.add(relation.from);
      }
    }

    // If depth > 1, recursively get neighbors
    if (depth > 1) {
      const visited = new Set<string>([entityName]);
      const queue: Array<{ name: string; currentDepth: number }> = [];

      // Add immediate neighbors to queue
      for (const name of connectedNames) {
        queue.push({ name, currentDepth: 1 });
        visited.add(name);
      }

      // BFS to get neighbors at deeper levels
      while (queue.length > 0) {
        const { name, currentDepth } = queue.shift()!;

        if (currentDepth >= depth) continue;

        // Get relations for this entity
        const entityRelations = this.getRelationsForEntities([name]);
        const entityFilteredRelations = entityRelations.filter(relation => {
          if (direction === 'outgoing' && relation.from !== name) return false;
          if (direction === 'incoming' && relation.to !== name) return false;
          if (relationType && relation.relationType !== relationType) return false;
          return true;
        });

        // Add new neighbors to queue
        for (const relation of entityFilteredRelations) {
          const neighborName = relation.from === name ? relation.to : relation.from;
          if (!visited.has(neighborName)) {
            visited.add(neighborName);
            queue.push({ name: neighborName, currentDepth: currentDepth + 1 });
            connectedNames.add(neighborName);

            // Add relation to filtered relations if includeRelations is true
            if (includeRelations) {
              filteredRelations.push(relation);
            }
          }
        }
      }
    }

    // Get entity details for all connected entities
    const entities = Array.from(connectedNames).map(name => {
      const entity = this.getEntity(name);
      return entity || {
        type: 'entity' as const,
        name,
        entityType: 'unknown',
        observations: [],
      };
    });

    return {
      entities,
      relations: includeRelations ? filteredRelations : [],
    };
  }

  findShortestPath(from: string, to: string, options: FindShortestPathOptions): ShortestPathResult {
    const { bidirectional = true, relationType, maxDepth = 6 } = options;

    if (maxDepth < 1 || maxDepth > 10) {
      throw new Error('Max depth must be between 1 and 10');
    }

    // Check if entities exist
    const fromEntity = this.getEntity(from);
    const toEntity = this.getEntity(to);

    if (!fromEntity || !toEntity) {
      return { found: false, path: [], distance: -1, nodesExplored: 0 };
    }

    // BFS to find shortest path
    const visited = new Set<string>();
    const queue: Array<{ name: string; path: string[]; distance: number }> = [];
    const parentMap = new Map<string, string>();

    queue.push({ name: from, path: [from], distance: 0 });
    visited.add(from);

    let nodesExplored = 0;

    while (queue.length > 0) {
      const { name, path, distance } = queue.shift()!;
      nodesExplored++;

      if (name === to) {
        return { found: true, path, distance, nodesExplored };
      }

      if (distance >= maxDepth) continue;

      // Get relations for current entity
      const relations = this.getRelationsForEntities([name]);

      // Filter relations based on options
      const filteredRelations = relations.filter(relation => {
        if (relationType && relation.relationType !== relationType) return false;
        return true;
      });

      // Add neighbors to queue
      for (const relation of filteredRelations) {
        const neighborName = relation.from === name ? relation.to : relation.from;

        if (!visited.has(neighborName)) {
          visited.add(neighborName);
          const newPath = [...path, neighborName];
          queue.push({ name: neighborName, path: newPath, distance: distance + 1 });
        }
      }
    }

    return { found: false, path: [], distance: -1, nodesExplored };
  }

  addObservations(updates: ObservationUpdate[]): void {
    if (updates.length === 0) return;

    // Use batch optimization for large updates
    if (updates.length >= 10) {
      this.addObservationsBatch(updates);
      return;
    }

    this.transaction(() => {
      for (const update of updates) {
        const row = this.statements.getEntity!.get(update.entityName) as EntityRow | undefined;
        if (row) {
          const existing = this.compressionEnabled
            ? CompressionUtils.decompressObservations(row.observations)
            : parseObservations(row.observations);

          // Merge new observations with existing ones, avoiding duplicates
          const combined = this.mergeObservations(existing, update.contents);
          const observationsJson = this.compressionEnabled
            ? CompressionUtils.compressObservations(combined)
            : stringifyObservations(combined);

          this.statements.updateObservations!.run(observationsJson, update.entityName);
          this.entityCache.delete(update.entityName.toLowerCase());
        }
      }
    });

    this.searchCache.clear();
  }

  // Helper method to merge observations and avoid duplicates
  private mergeObservations(
    existing: RichContent[],
    newObservations: RichContent[]
  ): RichContent[] {
    const combined = [...existing];

    for (const newObs of newObservations) {
      // Check if this observation already exists (by type and content)
      const exists = combined.some((existingObs) => {
        if (existingObs.type !== newObs.type) return false;

        // Compare based on content type
        switch (newObs.type) {
          case 'text':
            return existingObs.type === 'text' && existingObs.text === newObs.text;
          case 'image':
            return (
              existingObs.type === 'image' &&
              existingObs.data === newObs.data &&
              existingObs.mimeType === newObs.mimeType
            );
          case 'audio':
            return (
              existingObs.type === 'audio' &&
              existingObs.data === newObs.data &&
              existingObs.mimeType === newObs.mimeType
            );
          case 'resource_link':
            return existingObs.type === 'resource_link' && existingObs.uri === newObs.uri;
          case 'resource':
            return (
              existingObs.type === 'resource' &&
              existingObs.data === newObs.data &&
              existingObs.mimeType === newObs.mimeType
            );
          default:
            return false;
        }
      });

      if (!exists) {
        combined.push(newObs);
      }
    }

    return combined;
  }

  private addObservationsBatch(updates: ObservationUpdate[]): void {
    const perf = new PerformanceTracker('addObservationsBatch', { count: updates.length });

    this.transaction(() => {
      // Prepare batch statement for fetching all entities at once
      const entityNames = updates.map((u) => u.entityName);
      const placeholders = entityNames.map(() => '?').join(',');

      // Fetch all entities in one query
      const entities = this.db
        .prepare(`SELECT name, observations FROM entities WHERE name IN (${placeholders})`)
        .all(...entityNames) as EntityRow[];

      // Create a map for quick lookup
      const entityMap = new Map<string, EntityRow>();
      for (const entity of entities) {
        entityMap.set(entity.name.toLowerCase(), entity);
      }

      // Prepare update statement outside the loop
      const updateStmt = this.db.prepare(
        "UPDATE entities SET observations = ?, updated_at = julianday('now') WHERE name = ?"
      );

      // Process updates
      for (const update of updates) {
        const entity = entityMap.get(update.entityName.toLowerCase());
        if (entity) {
          const existing = this.compressionEnabled
            ? CompressionUtils.decompressObservations(entity.observations)
            : parseObservations(entity.observations);

          // Merge new observations with existing ones, avoiding duplicates
          const combined = this.mergeObservations(existing, update.contents);
          const observationsJson = this.compressionEnabled
            ? CompressionUtils.compressObservations(combined)
            : stringifyObservations(combined);

          updateStmt.run(observationsJson, update.entityName);
          this.entityCache.delete(update.entityName.toLowerCase());
        }
      }
    });

    this.searchCache.clear();
    perf.end();
  }

  deleteEntities(entityNames: string[]): void {
    if (entityNames.length === 0) return;

    // Use batch method if enabled and above threshold
    if (
      config.performance.enableBulkOperations &&
      entityNames.length >= config.performance.batchSize
    ) {
      this.deleteEntitiesBatch(entityNames);
      return;
    }

    this.transaction(() => {
      for (const name of entityNames) {
        this.statements.deleteEntity!.run(name);
        this.entityBloom.remove(name.toLowerCase());
        this.entityCache.delete(name.toLowerCase());
      }
    });

    this.searchCache.clear();
  }

  // Enhanced bulk delete operations with optimized performance
  deleteEntitiesBatch(entityNames: string[]): void {
    const correlationId = uuidv4();
    const start = process.hrtime.bigint();
    logProfile('deleteEntitiesBatch_start', { count: entityNames.length }, correlationId);

    if (entityNames.length === 0) return;

    const perf = { end: () => {} };

    // Use regular method for small batches
    if (entityNames.length < 10) {
      this.deleteEntities(entityNames);
      return;
    }

    const results = this.bulkOperationCircuitBreaker.executeSync(
      () => this.executeBulkEntityDeletion(entityNames, perf, correlationId),
      'deleteEntitiesBatch'
    );

    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;
    logProfile('deleteEntitiesBatch_end', {
      count: entityNames.length,
      durationMs,
      avgPerEntity: durationMs / entityNames.length,
      deleted: results
    }, correlationId);
  }

  private executeBulkEntityDeletion(entityNames: string[], perf: any = { end: () => {} }, correlationId?: string): number {
    const startMem = process.memoryUsage();
    const start = process.hrtime.bigint();
    logProfile('executeBulkEntityDeletion_start', {
      count: entityNames.length,
      memory: startMem
    }, correlationId);

    // Store original PRAGMA settings for restoration
    const originalDeferForeignKeys = this.db.pragma('defer_foreign_keys', { simple: true });
    const originalSynchronous = this.db.pragma('synchronous', { simple: true });

    // Optimize for bulk operations (must be outside transaction)
    this.db.exec('PRAGMA defer_foreign_keys = ON');
    this.db.exec('PRAGMA synchronous = NORMAL');

    const deletedCount = this.transaction(() => {
      const triggerDisableStart = Date.now();

      // Temporarily disable FTS triggers for bulk delete
      this.db.exec('DROP TRIGGER IF EXISTS entities_fts_delete');

      const triggerDisableTime = Date.now() - triggerDisableStart;
      logDebug('FTS trigger disabled for delete', {
        duration: triggerDisableTime,
        optimization: 'enabled'
      });

      try {
        const deleteStart = Date.now();

        // Build bulk delete query with optimized batch size
        const batchSize = Math.min(entityNames.length, 5000);
        let totalDeleted = 0;

        for (let i = 0; i < entityNames.length; i += batchSize) {
          const batch = entityNames.slice(i, i + batchSize);
          const placeholders = batch.map(() => '?').join(',');

          // Delete from entities table
          const result = this.db
            .prepare(`DELETE FROM entities WHERE name IN (${placeholders})`)
            .run(...batch);

          totalDeleted += result.changes;

          // Delete from FTS table
          this.db
            .prepare(`DELETE FROM entities_fts WHERE name IN (${placeholders})`)
            .run(...batch);

          // Force garbage collection between batches if available
          if (global.gc && i % (batchSize * 2) === 0) {
            global.gc();
          }
        }

        const deleteTime = Date.now() - deleteStart;
        logDebug('Bulk delete completed', {
          entities: entityNames.length,
          deleted: totalDeleted,
          deleteTime,
          avgPerEntity: Math.round(deleteTime / entityNames.length)
        });

        // Recreate FTS trigger
        this.db.exec(`
          CREATE TRIGGER IF NOT EXISTS entities_fts_delete AFTER DELETE ON entities
          BEGIN
            DELETE FROM entities_fts WHERE name = old.name;
          END
        `);

        return totalDeleted;

      } finally {
        // No PRAGMA changes here
      }
    });

    // Restore original PRAGMA settings (must be outside transaction)
    this.db.exec(`PRAGMA defer_foreign_keys = ${originalDeferForeignKeys}`);
    this.db.exec(`PRAGMA synchronous = ${originalSynchronous}`);

    // Update caches and bloom filter
    entityNames.forEach(name => {
      this.entityCache.delete(name.toLowerCase());
      this.entityBloom.remove(name.toLowerCase());
    });

    // Clear search cache
    this.searchCache.clear();

    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;

    perf.end({
      count: entityNames.length,
      durationMs,
      avgPerEntity: durationMs / entityNames.length,
      deleted: deletedCount,
      optimization: 'bulk'
    });

    logProfile('executeBulkEntityDeletion_end', {
      count: entityNames.length,
      durationMs,
      avgPerEntity: durationMs / entityNames.length,
      deleted: deletedCount
    }, correlationId);

    return deletedCount;
  }

  deleteObservations(deletions: ObservationDeletion[]): void {
    if (deletions.length === 0) return;

    this.transaction(() => {
      for (const deletion of deletions) {
        const row = this.statements.getEntity!.get(deletion.entityName) as EntityRow | undefined;
        if (row) {
          const existing = this.compressionEnabled
            ? CompressionUtils.decompressObservations(row.observations)
            : parseObservations(row.observations);

          // Remove observations that match by type and content
          const updated = existing.filter(
            (existingObs) =>
              !deletion.observations.some((toRemove) => {
                if (toRemove.type !== existingObs.type) return false;

                // Compare based on content type
                switch (toRemove.type) {
                  case 'text':
                    return existingObs.type === 'text' && existingObs.text === toRemove.text;
                  case 'image':
                    return (
                      existingObs.type === 'image' &&
                      existingObs.data === toRemove.data &&
                      existingObs.mimeType === toRemove.mimeType
                    );
                  case 'audio':
                    return (
                      existingObs.type === 'audio' &&
                      existingObs.data === toRemove.data &&
                      existingObs.mimeType === toRemove.mimeType
                    );
                  case 'resource_link':
                    return existingObs.type === 'resource_link' && existingObs.uri === toRemove.uri;
                  case 'resource':
                    return (
                      existingObs.type === 'resource' &&
                      existingObs.data === toRemove.data &&
                      existingObs.mimeType === toRemove.mimeType
                    );
                  default:
                    return false;
                }
              })
          );

          const observationsJson = this.compressionEnabled
            ? CompressionUtils.compressObservations(updated)
            : stringifyObservations(updated);

          this.statements.updateObservations!.run(observationsJson, deletion.entityName);
          this.entityCache.delete(deletion.entityName.toLowerCase());
        }
      }
    });

    this.searchCache.clear();
  }

  deleteRelations(relations: CreateRelationInput[]): void {
    this.transaction(() => {
      for (const relation of relations) {
        this.statements.deleteRelation!.run(relation.from, relation.to, relation.relationType);
      }
    });
  }

  openNodes(names: string[]): GraphResult {
    if (names.length === 0) return { entities: [], relations: [] };

    const entities: EntityResult[] = [];
    const namesToQuery: string[] = [];

    // Check cache and bloom filter
    for (const name of names) {
      const lowerName = name.toLowerCase();
      if (!this.entityBloom.contains(lowerName)) continue;

      const cached = this.entityCache.get(lowerName);
      if (cached) {
        entities.push(cached);
      } else {
        namesToQuery.push(name);
      }
    }

    // Query remaining entities
    if (namesToQuery.length > 0) {
      const placeholders = namesToQuery.map(() => '?').join(',');
      const entityRows = this.db
        .prepare(`SELECT * FROM entities WHERE name IN (${placeholders})`)
        .all(...namesToQuery) as EntityRow[];

      for (const row of entityRows) {
        const entity: EntityResult = {
          type: 'entity',
          name: row.name,
          entityType: row.entity_type,
          observations: this.compressionEnabled
            ? CompressionUtils.decompressObservations(row.observations)
            : parseObservations(row.observations),
        };
        entities.push(entity);
        this.entityCache.set(row.name.toLowerCase(), entity);
      }
    }

    const foundNames = entities.map((e) => e.name);
    const relations = foundNames.length > 0 ? this.getRelationsForEntities(foundNames) : [];

    return { entities, relations };
  }

  getStats(): DatabaseStats {
    const entityCount = (this.db.prepare('SELECT COUNT(*) as count FROM entities').get() as any)
      .count;
    const relationCount = (this.db.prepare('SELECT COUNT(*) as count FROM relations').get() as any)
      .count;

    const typeRows = this.statements.getEntityStats!.all() as Array<{
      entity_type: string;
      count: number;
    }>;
    const entityTypes = typeRows.reduce(
      (acc, row) => {
        acc[row.entity_type] = row.count;
        return acc;
      },
      {} as Record<string, number>
    );

    const dbFileSize = statSync(this.dbPath).size;
    const circuitBreakerStats = this.bulkOperationCircuitBreaker.getStatus();

    return {
      totalEntities: entityCount,
      totalRelations: relationCount,
      entityTypes,
      databaseSizeKb: Math.round(dbFileSize / 1024),
      cacheStats: {
        entity: this.entityCache.getStats(),
        search: this.searchCache.getStats(),
      },
      bloomStats: this.entityBloom.getStats(),
      circuitBreaker: {
        state: circuitBreakerStats.state,
        failureCount: circuitBreakerStats.failureCount,
        successCount: circuitBreakerStats.successCount,
        totalRequests: circuitBreakerStats.totalRequests,
        failureRate: circuitBreakerStats.failureRate,
        bulkOperationsEnabled: circuitBreakerStats.options.enableBulkOperations
      },
    };
  }

  /**
   * Dynamically set SQLite PRAGMAs for performance tuning and benchmarking.
   * @param pragmas - An object where keys are PRAGMA names and values are their settings.
   */
  public setPragmas(pragmas: Record<string, string | number>): void {
    for (const [key, value] of Object.entries(pragmas)) {
      this.db.pragma(`${key} = ${value}`);
    }
  }

  // Utility method for tests that expect async initialization
  async waitForBloomFilter(): Promise<void> {
    // Bloom filter is initialized synchronously in constructor,
    // so this just returns immediately
    return Promise.resolve();
  }

  // Transaction operations
  beginTransaction(): void {
    if (this.isInTransaction) {
      throw new Error('A transaction is already active');
    }

    this.db.prepare('BEGIN').run();
    this.isInTransaction = true;
    this.transactionDepth = 1;
  }

  commitTransaction(): void {
    if (!this.isInTransaction) {
      throw new Error('No active transaction to commit');
    }

    this.db.prepare('COMMIT').run();
    this.isInTransaction = false;
    this.transactionDepth = 0;
    // Clear caches after successful commit
    this.entityCache.clear();
    this.searchCache.clear();
  }

  rollbackTransaction(): void {
    if (!this.isInTransaction) {
      throw new Error('No active transaction to rollback');
    }

    this.db.prepare('ROLLBACK').run();
    this.isInTransaction = false;
    this.transactionDepth = 0;
    // Clear caches after rollback
    this.entityCache.clear();
    this.searchCache.clear();
  }

  // Backup operations
  backup(backupPath: string): void {
    // Save bloom filter before backup
    this.saveBloomFilter();

    // Checkpoint WAL to ensure all changes are in main database file
    this.db.pragma('wal_checkpoint(TRUNCATE)');

    copyFileSync(this.dbPath, backupPath);
    const bloomPath = this.dbPath.replace('.db', '.cbloom');
    const backupBloomPath = backupPath.replace('.db', '.cbloom');
    if (existsSync(bloomPath)) {
      copyFileSync(bloomPath, backupBloomPath);
    }
  }

  close(): void {
    // Rollback any active transaction before closing
    if (this.isInTransaction) {
      try {
        this.db.prepare('ROLLBACK').run();
      } catch (error) {
        // Ignore errors during rollback on close
      }
      this.transactionDepth = 0;
      this.isInTransaction = false;
    }

    // Close read pool if it exists
    if (this.readPool) {
      this.readPool.close().catch((err) => {
        logError('Error closing read pool', err as Error);
      });
    }

    this.saveBloomFilter();
    this.db.close();
  }

  // Memory aging methods

  /**
   * Update entity access tracking and recalculate prominence
   */
  updateEntityAccess(entityName: string): void {
    const entity = this.getEntity(entityName);
    if (!entity) return;

    // Get current aging data from database
    const row = this.db.prepare(`
      SELECT access_count, last_accessed, prominence_score, importance_weight
      FROM entities WHERE name = ?
    `).get(entityName) as EntityRow;

    if (!row) return;

    // Calculate new prominence using memory aging system
    const agingResult = this.memoryAging.updateEntityAccess(
      row.access_count,
      row.last_accessed,
      row.prominence_score,
      row.importance_weight
    );

    // Update database
    this.statements.updateEntityAccess!.run(
      agingResult.newAccessCount,
      agingResult.newLastAccessed,
      agingResult.newProminence,
      entityName
    );

    // Update cache
    this.entityCache.delete(entityName.toLowerCase());
  }

  /**
   * Get aging-aware search results with prominence boost
   */
  searchNodesWithAging(options: SearchOptions): GraphResult {
    const baseResults = this.searchNodes(options);

    // Apply aging-aware boost to search results
    const boostedResults = baseResults.entities.map(entity => {
      const row = this.db.prepare(`
        SELECT prominence_score FROM entities WHERE name = ?
      `).get(entity.name) as EntityRow;

      if (row) {
        const searchBoost = this.memoryAging.getSearchBoost(row.prominence_score);
        return {
          ...entity,
          _searchBoost: searchBoost
        };
      }
      return entity;
    });

    // Sort by prominence (higher prominence first)
    boostedResults.sort((a, b) => {
      const aBoost = (a as any)._searchBoost || 1.0;
      const bBoost = (b as any)._searchBoost || 1.0;
      return bBoost - aBoost;
    });

    return {
      entities: boostedResults,
      relations: baseResults.relations,
      pagination: baseResults.pagination
    };
  }

  /**
   * Run memory aging calculations for all entities
   */
  runMemoryAging(): void {
    if (!this.memoryAging.shouldRunAging()) {
      return;
    }

    const entities = this.db.prepare(`
      SELECT name, access_count, last_accessed, prominence_score, importance_weight
      FROM entities
    `).all() as EntityRow[];

    const agingResults = this.memoryAging.calculateAgingForEntities(
      entities.map(row => ({
        name: row.name,
        accessCount: row.access_count,
        lastAccessed: row.last_accessed,
        prominenceScore: row.prominence_score,
        importanceWeight: row.importance_weight
      }))
    );

    // Update prominence scores in database
    this.transaction(() => {
      for (const result of agingResults) {
        this.db.prepare(`
          UPDATE entities
          SET prominence_score = ?
          WHERE name = ?
        `).run(result.newProminence, result.name);
      }
    });

    // Clear caches to reflect new prominence scores
    this.entityCache.clear();
    this.searchCache.clear();

    this.memoryAging.markAgingCompleted();

    logInfo('Memory aging completed', {
      totalEntities: entities.length,
      updatedEntities: agingResults.length,
      forgottenEntities: agingResults.filter(r => r.isForgotten).length
    });
  }

  /**
   * Get memory aging statistics
   */
  getMemoryAgingStats(): any {
    const config = this.memoryAging.getConfig();
    const threshold = config.minProminenceThreshold;

    const stats = this.statements.getAgingStats!.get(threshold, threshold) as any;

    return {
      ...stats,
      config: this.memoryAging.getConfig(),
      lastAgingRun: this.memoryAging['lastAgingRun'],
      agingCycles: this.memoryAging['agingCycles']
    };
  }

  /**
   * Set entity importance weight
   */
  setEntityImportance(entityName: string, importanceWeight: number): void {
    this.db.prepare(`
      UPDATE entities
      SET importance_weight = ?, updated_at = julianday('now')
      WHERE name = ?
    `).run(importanceWeight, entityName);

    // Recalculate prominence with new importance
    this.updateEntityAccess(entityName);
  }

  /**
   * Get recommended importance weight for an entity
   */
  getRecommendedImportance(entityName: string): number {
    const entity = this.getEntity(entityName);
    if (!entity) return 1.0;

    const relations = this.getRelationsForEntities([entityName]);
    const contentLength = entity.observations.reduce((sum, obs) => {
      if (obs.type === 'text') return sum + obs.text.length;
      return sum;
    }, 0);

    return this.memoryAging.getRecommendedImportanceWeight(
      entity.entityType,
      contentLength,
      relations.length
    );
  }

  /**
   * Enhanced context-aware search with semantic understanding and suggestions
   */
  searchNodesContextAware(options: SearchOptions): GraphResult & {
    suggestions: string[];
    intent: { type: string; confidence: number; hints: string[] };
    searchStats: { queryComplexity: string; semanticTerms: string[]; contextHints: string[] };
  } {
    const { query, limit = 20, searchContext, searchMode, contentTypes, intent } = options;

    // Analyze search intent
    const intentAnalysis = analyzeSearchIntent(query);

    // Generate search suggestions
    const suggestions = generateSearchSuggestions(query, searchContext);

    // Perform the search
    const searchResults = this.searchNodes(options);

    // Get search statistics
    const searchQuery = parseSearchQuery(query);
    const searchStats = {
      queryComplexity: searchQuery.complexity,
      semanticTerms: searchQuery.semanticTerms,
      contextHints: searchQuery.contextHints
    };

    return {
      ...searchResults,
      suggestions,
      intent: {
        type: intent || intentAnalysis.intent,
        confidence: intentAnalysis.confidence,
        hints: intentAnalysis.suggestions
      },
      searchStats
    };
  }

  /**
   * Semantic search for related entities
   */
  searchRelatedEntities(
    entityName: string,
    options: {
      limit?: number;
      relationTypes?: string[];
      searchContext?: SearchOptions['searchContext'];
    } = {}
  ): GraphResult {
    const { limit = 10, relationTypes, searchContext } = options;

    // Get direct relations
    const relations = this.getRelationsForEntities([entityName]);

    // Filter by relation types if specified
    const filteredRelations = relationTypes
      ? relations.filter(r => relationTypes.includes(r.relationType))
      : relations;

    // Get related entity names
    const relatedNames = filteredRelations.map(r =>
      r.from === entityName ? r.to : r.from
    );

    // Get the actual entities
    const entities = this.openNodes(relatedNames).entities;

    // Apply context-aware relevance scoring
    const scoredEntities = entities.map(entity => {
      const relevance = calculateRelevance(
        entity,
        { original: entityName, terms: [entityName], phrases: [], fuzzy: false, prefix: false, complexity: 'simple', estimatedCost: 1, semanticTerms: [], contextHints: [], searchMode: 'semantic', contentTypes: ['text'] },
        1,
        searchContext
      );

      return {
        ...entity,
        _relevance: relevance
      };
    });

    // Sort by relevance
    scoredEntities.sort((a, b) => (b as any)._relevance - (a as any)._relevance);

    return {
      entities: scoredEntities.slice(0, limit),
      relations: filteredRelations.slice(0, limit)
    };
  }
}
