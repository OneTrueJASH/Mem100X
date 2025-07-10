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

export class MemoryDatabase {
  private db!: Database.Database;
  private readonly dbPath: string;
  
  // Performance optimizations
  private readonly entityCache: ICache<string, EntityResult>;
  private readonly searchCache: ICache<string, GraphResult>;
  private entityBloom!: CountingBloomFilter;
  private readonly compressionEnabled: boolean = config.performance.compressionEnabled;
  private readonly relationQueryThreshold: number = config.performance.relationQueryThreshold;
  
  // Transaction management
  private transactionDepth: number = 0;
  private isInTransaction: boolean = false;

  // Prepared statements for maximum performance
  private statements: {
    createEntity?: Database.Statement;
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
    
    const created = this.transaction(() => {
      const results: EntityResult[] = [];
      
      for (const entity of entities) {
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

    // FTS search first
    const ftsQuery = query.split(/\s+/)
      .filter(term => term.length > 0)
      .map(term => `"${term}"*`)
      .join(' OR ');
    
    let rows = this.statements.searchEntities!.all(ftsQuery, limit) as EntityRow[];

    // Fallback to LIKE search if no FTS results
    if (rows.length === 0) {
      const likePattern = `%${query}%`;
      rows = this.statements.searchEntitiesLike!.all(
        likePattern, likePattern, likePattern, limit
      ) as EntityRow[];
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
    
    this.saveBloomFilter();
    this.db.close();
  }
}