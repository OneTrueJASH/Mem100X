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
  ShortestPathResult
} from './types.js';
import { ICache, createStringCache } from './utils/cache-interface.js';
import { CountingBloomFilter } from './utils/counting-bloom-filter.js';
import { CompressionUtils } from './utils/compression.js';
import { ConnectionPool } from './utils/connection-pool.js';
import { getCompleteSchema, getPragmas } from './database-schema.js';
import { 
  logger, 
  logInfo, 
  logDebug, 
  logError, 
  PerformanceTracker 
} from './utils/logger.js';
import { 
  stringifyObservations, 
  parseObservations 
} from './utils/fast-json.js';
import { config } from './config.js';
import { ValidationError } from './errors.js';

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
  } = {};

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    
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
        readonly: true
      });
      logInfo('Read pool initialized', { 
        minConnections: Math.max(2, Math.floor(config.performance.readPoolSize / 4)), 
        maxConnections: 5 
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

    this.statements.getEntity = this.db.prepare(
      'SELECT * FROM entities WHERE name = ?'
    );

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

    this.statements.deleteEntity = this.db.prepare(
      'DELETE FROM entities WHERE name = ?'
    );

    this.statements.deleteRelation = this.db.prepare(
      'DELETE FROM relations WHERE from_entity = ? AND to_entity = ? AND relation_type = ?'
    );

    this.statements.updateObservations = this.db.prepare(
      'UPDATE entities SET observations = ?, updated_at = julianday(\'now\') WHERE name = ?'
    );

    this.statements.getRelationsByEntity = this.db.prepare(`
      SELECT * FROM relations 
      WHERE from_entity = ? OR to_entity = ?
    `);

    this.statements.getEntityStats = this.db.prepare(
      'SELECT entity_type, COUNT(*) as count FROM entities GROUP BY entity_type'
    );
  }
  
  // Helper method to execute read queries through the pool if available
  private async executeRead<T>(
    callback: (db: Database.Database) => T
  ): Promise<T> {
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
  private executeReadSync<T>(
    callback: (db: Database.Database) => T
  ): T {
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
        falsePositiveRate: config.bloomFilter.falsePositiveRate 
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
    const perf = new PerformanceTracker('createEntities', { count: entities.length });
    
    // Fast path for single entity creation
    if (entities.length === 1) {
      return this.createSingleEntityOptimized(entities[0], perf);
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
          observations: entity.observations
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
    perf.end({ created: created.length });
    return created;
  }

  // Optimized single entity creation with minimal overhead
  private createSingleEntityOptimized(entity: CreateEntityInput, perf: PerformanceTracker): EntityResult[] {
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
          observations: entity.observations
        };
        
        // Update caches
        this.entityCache.set(lowerName, result);
        this.entityBloom.add(lowerName);
        
        // Skip search cache clearing for single entity
        perf.end({ created: 1, optimized: true, fastPath: true });
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
        observations: entity.observations
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
      return [result];
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  // Optimized batch entity creation for better performance
  createEntitiesBatch(entities: CreateEntityInput[]): EntityResult[] {
    if (entities.length === 0) return [];
    
    // Use regular method for small batches
    if (entities.length < 10) {
      return this.createEntities(entities);
    }
    
    const perf = new PerformanceTracker('createEntitiesBatch', { count: entities.length });
    
    const created = this.transaction(() => {
      // Temporarily disable FTS triggers for bulk insert
      this.db.exec('DROP TRIGGER IF EXISTS entities_fts_insert');
      
      try {
        // Pre-compress all observations
        const preparedData = entities.map(e => ({
          name: e.name,
          entityType: e.entityType,
          observations: e.observations,
          observationsData: this.compressionEnabled 
            ? CompressionUtils.compressObservations(e.observations)
            : stringifyObservations(e.observations)
        }));
        
        // Build bulk insert query
        const placeholders = entities.map(() => "(?, ?, ?, julianday('now'), julianday('now'))").join(',');
        const values = preparedData.flatMap(e => [e.name, e.entityType, e.observationsData]);
        
        // Execute bulk insert
        this.db.prepare(
          `INSERT OR IGNORE INTO entities (name, entity_type, observations, created_at, updated_at) 
           VALUES ${placeholders}`
        ).run(...values);
        
        // Bulk update FTS
        const ftsPlaceholders = entities.map(() => '?').join(',');
        this.db.prepare(
          `INSERT INTO entities_fts (name, entity_type, observations) 
           SELECT name, entity_type, observations FROM entities 
           WHERE name IN (${ftsPlaceholders})`
        ).run(...entities.map(e => e.name));
        
        // Build results and update caches in batch
        const results: EntityResult[] = [];
        const cacheUpdates: Array<[string, EntityResult]> = [];
        
        for (const data of preparedData) {
          const result: EntityResult = {
            type: 'entity',
            name: data.name,
            entityType: data.entityType,
            observations: data.observations
          };
          results.push(result);
          cacheUpdates.push([data.name.toLowerCase(), result]);
          this.entityBloom.add(data.name.toLowerCase());
        }
        
        // Batch cache update
        for (const [key, value] of cacheUpdates) {
          this.entityCache.set(key, value);
        }
        
        return results;
      } finally {
        // Re-enable FTS trigger
        this.db.exec(`
          CREATE TRIGGER IF NOT EXISTS entities_fts_insert AFTER INSERT ON entities
          BEGIN
            INSERT INTO entities_fts(name, entity_type, observations)
            VALUES (new.name, new.entity_type, new.observations);
          END;
        `);
      }
    });
    
    // Clear search cache as new entities were added
    this.searchCache.clear();
    perf.end({ created: created.length });
    return created;
  }

  createRelations(relations: CreateRelationInput[]): RelationResult[] {
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
            relationType: relation.relationType
          });
        }
      }
    });
    
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
        : parseObservations(row.observations)
    };
    
    // Cache the result
    this.entityCache.set(lowerName, entity);
    return entity;
  }

  searchNodes(options: SearchOptions): GraphResult {
    const { query, limit = 20 } = options;
    const cacheKey = `search:${query}:${limit}`;
    
    // Check cache
    const cached = this.searchCache.get(cacheKey);
    if (cached) return cached;

    // Use read pool if available for better concurrency
    const executeSearch = async () => {
      if (this.readPool) {
        const conn = await this.readPool.acquire();
        try {
          // Prepare statements on pooled connection
          const searchStmt = conn.db.prepare(`
            SELECT e.* FROM entities_fts fts
            JOIN entities e ON e.name = fts.name
            WHERE entities_fts MATCH ?
            ORDER BY rank
            LIMIT ?
          `);
          
          const likeStmt = conn.db.prepare(`
            SELECT * FROM entities 
            WHERE name LIKE ? OR entity_type LIKE ? OR observations LIKE ?
            LIMIT ?
          `);
          
          // FTS search first
          const ftsQuery = query.split(/\s+/)
            .filter(term => term.length > 0)
            .map(term => `"${term}"*`)
            .join(' OR ');
          
          let rows = searchStmt.all(ftsQuery, limit) as EntityRow[];
          
          // Fallback to LIKE search if no FTS results
          if (rows.length === 0) {
            const likePattern = `%${query}%`;
            rows = likeStmt.all(likePattern, likePattern, likePattern, limit) as EntityRow[];
          }
          
          return rows;
        } finally {
          await this.readPool.release(conn);
        }
      } else {
        // Fallback to main connection
        const ftsQuery = query.split(/\s+/)
          .filter(term => term.length > 0)
          .map(term => `"${term}"*`)
          .join(' OR ');
        
        let rows = this.statements.searchEntities!.all(ftsQuery, limit) as EntityRow[];
        
        if (rows.length === 0) {
          const likePattern = `%${query}%`;
          rows = this.statements.searchEntitiesLike!.all(
            likePattern, likePattern, likePattern, limit
          ) as EntityRow[];
        }
        
        return rows;
      }
    };
    
    // Execute search (sync wrapper for now)
    let rows: EntityRow[];
    if (this.readPool) {
      // For now, fall back to sync until we convert to async
      const ftsQuery = query.split(/\s+/)
        .filter(term => term.length > 0)
        .map(term => `"${term}"*`)
        .join(' OR ');
      
      rows = this.statements.searchEntities!.all(ftsQuery, limit) as EntityRow[];
      
      if (rows.length === 0) {
        const likePattern = `%${query}%`;
        rows = this.statements.searchEntitiesLike!.all(
          likePattern, likePattern, likePattern, limit
        ) as EntityRow[];
      }
    } else {
      const ftsQuery = query.split(/\s+/)
        .filter(term => term.length > 0)
        .map(term => `"${term}"*`)
        .join(' OR ');
      
      rows = this.statements.searchEntities!.all(ftsQuery, limit) as EntityRow[];
      
      if (rows.length === 0) {
        const likePattern = `%${query}%`;
        rows = this.statements.searchEntitiesLike!.all(
          likePattern, likePattern, likePattern, limit
        ) as EntityRow[];
      }
    }

    // Convert rows to entities
    const entities: EntityResult[] = rows.map(row => ({
      type: 'entity',
      name: row.name,
      entityType: row.entity_type,
      observations: this.compressionEnabled 
        ? CompressionUtils.decompressObservations(row.observations)
        : parseObservations(row.observations)
    }));

    // Update entity cache
    entities.forEach(entity => 
      this.entityCache.set(entity.name.toLowerCase(), entity)
    );
    
    // Get relations for found entities
    const entityNames = entities.map(e => e.name);
    const relations = entityNames.length > 0 
      ? this.getRelationsForEntities(entityNames) 
      : [];
    
    const result = { entities, relations };
    this.searchCache.set(cacheKey, result);
    return result;
  }

  readGraph(limit?: number, offset: number = 0): GraphResult {
    const totalEntities = (this.db.prepare('SELECT COUNT(*) as count FROM entities').get() as any).count;
    const totalRelations = (this.db.prepare('SELECT COUNT(*) as count FROM relations').get() as any).count;
    
    const entityQuery = limit 
      ? `SELECT * FROM entities ORDER BY updated_at DESC LIMIT ${limit} OFFSET ${offset}`
      : 'SELECT * FROM entities ORDER BY updated_at DESC';
    
    const entityRows = this.db.prepare(entityQuery).all() as EntityRow[];
    
    const entities: EntityResult[] = entityRows.map(row => ({
      type: 'entity',
      name: row.name,
      entityType: row.entity_type,
      observations: this.compressionEnabled 
        ? CompressionUtils.decompressObservations(row.observations)
        : parseObservations(row.observations)
    }));
    
    const relations = entities.length > 0 
      ? this.getRelationsForEntities(entities.map(e => e.name)) 
      : [];
    
    return { 
      entities, 
      relations,
      pagination: limit ? {
        totalEntities,
        totalRelations,
        offset,
        limit,
        hasMore: offset + entities.length < totalEntities
      } : undefined
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
        const rows = this.db.prepare(`
          SELECT DISTINCT r.* FROM relations r
          WHERE r.from_entity IN (SELECT name FROM temp_entities)
             OR r.to_entity IN (SELECT name FROM temp_entities)
        `).all() as RelationRow[];
        
        // Clean up
        this.db.exec('DROP TABLE temp_entities');
        
        return rows.map(row => ({
          type: 'relation',
          from: row.from_entity,
          to: row.to_entity,
          relationType: row.relation_type
        }));
      });
    }

    // Use IN clause for small queries
    const placeholders = entityNames.map(() => '?').join(',');
    const rows = this.db.prepare(`
      SELECT * FROM relations 
      WHERE from_entity IN (${placeholders}) 
         OR to_entity IN (${placeholders})
    `).all(...entityNames, ...entityNames) as RelationRow[];
    
    return rows.map(row => ({
      type: 'relation',
      from: row.from_entity,
      to: row.to_entity,
      relationType: row.relation_type
    }));
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
          
          const combined = Array.from(new Set([...existing, ...update.contents]));
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

  private addObservationsBatch(updates: ObservationUpdate[]): void {
    const perf = new PerformanceTracker('addObservationsBatch', { count: updates.length });
    
    this.transaction(() => {
      // Prepare batch statement for fetching all entities at once
      const entityNames = updates.map(u => u.entityName);
      const placeholders = entityNames.map(() => '?').join(',');
      
      // Fetch all entities in one query
      const entities = this.db.prepare(
        `SELECT name, observations FROM entities WHERE name IN (${placeholders})`
      ).all(...entityNames) as EntityRow[];
      
      // Create a map for quick lookup
      const entityMap = new Map<string, EntityRow>();
      for (const entity of entities) {
        entityMap.set(entity.name.toLowerCase(), entity);
      }
      
      // Prepare update statement outside the loop
      const updateStmt = this.db.prepare(
        'UPDATE entities SET observations = ?, updated_at = julianday(\'now\') WHERE name = ?'
      );
      
      // Process updates
      for (const update of updates) {
        const entity = entityMap.get(update.entityName.toLowerCase());
        if (entity) {
          const existing = this.compressionEnabled 
            ? CompressionUtils.decompressObservations(entity.observations)
            : parseObservations(entity.observations);
          
          const combined = Array.from(new Set([...existing, ...update.contents]));
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
    this.transaction(() => {
      for (const name of entityNames) {
        this.statements.deleteEntity!.run(name);
        this.entityBloom.remove(name.toLowerCase());
        this.entityCache.delete(name.toLowerCase());
      }
    });
    
    this.searchCache.clear();
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
          
          const toRemove = new Set(deletion.observations);
          const updated = existing.filter(obs => !toRemove.has(obs));
          
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
        this.statements.deleteRelation!.run(
          relation.from,
          relation.to,
          relation.relationType
        );
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
      const entityRows = this.db.prepare(
        `SELECT * FROM entities WHERE name IN (${placeholders})`
      ).all(...namesToQuery) as EntityRow[];
      
      for (const row of entityRows) {
        const entity: EntityResult = {
          type: 'entity',
          name: row.name,
          entityType: row.entity_type,
          observations: this.compressionEnabled 
            ? CompressionUtils.decompressObservations(row.observations)
            : parseObservations(row.observations)
        };
        entities.push(entity);
        this.entityCache.set(row.name.toLowerCase(), entity);
      }
    }
    
    const foundNames = entities.map(e => e.name);
    const relations = foundNames.length > 0 
      ? this.getRelationsForEntities(foundNames) 
      : [];
    
    return { entities, relations };
  }

  getStats(): DatabaseStats {
    const entityCount = (this.db.prepare('SELECT COUNT(*) as count FROM entities').get() as any).count;
    const relationCount = (this.db.prepare('SELECT COUNT(*) as count FROM relations').get() as any).count;
    
    const typeRows = this.statements.getEntityStats!.all() as Array<{ entity_type: string; count: number }>;
    const entityTypes = typeRows.reduce((acc, row) => {
      acc[row.entity_type] = row.count;
      return acc;
    }, {} as Record<string, number>);
    
    const dbFileSize = statSync(this.dbPath).size;

    return {
      totalEntities: entityCount,
      totalRelations: relationCount,
      entityTypes,
      databaseSizeKb: Math.round(dbFileSize / 1024),
      cacheStats: {
        entity: this.entityCache.getStats(),
        search: this.searchCache.getStats()
      },
      bloomStats: this.entityBloom.getStats()
    };
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
      this.readPool.close().catch(err => {
        logError('Error closing read pool', err as Error);
      });
    }
    
    this.saveBloomFilter();
    this.db.close();
  }
}