/**
 * Async wrapper for MemoryDatabase to utilize connection pooling
 * Provides async methods for read operations using the read pool
 */

import { MemoryDatabase } from './database.js';
import { 
  EntityResult, 
  GraphResult, 
  SearchOptions,
  GetNeighborsOptions,
  FindShortestPathOptions,
  ShortestPathResult,
  EntityRow,
  RelationRow,
  RelationResult
} from './types.js';
import { ConnectionPool, PooledConnection } from './utils/connection-pool.js';
import { CompressionUtils } from './utils/compression.js';
import { parseObservations } from './utils/fast-json.js';
import { config } from './config.js';

export class AsyncMemoryDatabase extends MemoryDatabase {
  private asyncReadPool: ConnectionPool | null = null;
  
  async initialize(): Promise<void> {
    // Initialize read pool if enabled
    if (config.performance.useReadPool) {
      this.asyncReadPool = new ConnectionPool(this.getDbPath(), {
        minConnections: 2,
        maxConnections: 5,
        acquireTimeout: 5000,
        idleTimeout: 60000,
        readonly: true
      });
    }
  }
  
  async close(): Promise<void> {
    if (this.asyncReadPool) {
      await this.asyncReadPool.close();
    }
    super.close();
  }
  
  async getEntityAsync(name: string): Promise<EntityResult | undefined> {
    const lowerName = name.toLowerCase();
    
    // Check cache first
    const cached = this.getEntityFromCache(lowerName);
    if (cached) return cached;
    
    // Check bloom filter
    if (!this.checkBloomFilter(lowerName)) return undefined;
    
    // Use read pool for database query
    if (this.asyncReadPool) {
      const conn = await this.asyncReadPool.acquire();
      try {
        const stmt = conn.db.prepare('SELECT * FROM entities WHERE name = ?');
        const row = stmt.get(name) as EntityRow | undefined;
        
        if (!row) return undefined;
        
        const entity = this.createEntityResult(row);
        this.cacheEntity(lowerName, entity);
        return entity;
      } finally {
        await this.asyncReadPool.release(conn);
      }
    }
    
    // Fallback to sync method
    return this.getEntity(name);
  }
  
  async searchNodesAsync(options: SearchOptions): Promise<GraphResult> {
    const { query, limit = 20 } = options;
    const cacheKey = `search:${query}:${limit}`;
    
    // Check cache
    const cached = this.getSearchFromCache(cacheKey);
    if (cached) return cached;
    
    if (this.asyncReadPool) {
      const conn = await this.asyncReadPool.acquire();
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
        
        // Convert to entities and get relations
        const entities = rows.map(row => this.createEntityResult(row));
        const entityNames = entities.map(e => e.name);
        const relations = await this.getRelationsForEntitiesAsync(entityNames, conn);
        
        const result: GraphResult = {
          entities,
          relations,
        };
        
        this.cacheSearchResult(cacheKey, result);
        return result;
      } finally {
        await this.asyncReadPool.release(conn);
      }
    }
    
    // Fallback to sync method
    return this.searchNodes(options);
  }
  
  async readGraphAsync(limit?: number, offset: number = 0): Promise<GraphResult> {
    const actualLimit = limit || 100;
    const cacheKey = `graph:${actualLimit}:${offset}`;
    
    // Check cache
    const cached = this.getSearchFromCache(cacheKey);
    if (cached) return cached;
    
    if (this.asyncReadPool) {
      const conn = await this.asyncReadPool.acquire();
      try {
        const entityStmt = conn.db.prepare(`
          SELECT * FROM entities 
          ORDER BY updated_at DESC 
          LIMIT ? OFFSET ?
        `);
        
        const rows = entityStmt.all(actualLimit, offset) as EntityRow[];
        const entities = rows.map(row => this.createEntityResult(row));
        const entityNames = entities.map(e => e.name);
        const relations = await this.getRelationsForEntitiesAsync(entityNames, conn);
        
        const result: GraphResult = {
          entities,
          relations,
        };
        
        this.cacheSearchResult(cacheKey, result);
        return result;
      } finally {
        await this.asyncReadPool.release(conn);
      }
    }
    
    // Fallback to sync method
    return this.readGraph(limit, offset);
  }
  
  private async getRelationsForEntitiesAsync(
    entityNames: string[], 
    conn?: PooledConnection
  ): Promise<RelationResult[]> {
    if (entityNames.length === 0) return [];
    
    const executeQuery = async (connection: PooledConnection) => {
      if (entityNames.length > config.performance.relationQueryThreshold) {
        // Use temp table for large queries
        connection.db.exec('CREATE TEMP TABLE IF NOT EXISTS temp_entities (name TEXT PRIMARY KEY)');
        connection.db.exec('DELETE FROM temp_entities');
        
        const insertStmt = connection.db.prepare('INSERT INTO temp_entities (name) VALUES (?)');
        const insertMany = connection.db.transaction((names: string[]) => {
          for (const name of names) {
            insertStmt.run(name);
          }
        });
        insertMany(entityNames);
        
        const rows = connection.db.prepare(`
          SELECT DISTINCT r.* FROM relations r
          WHERE r.from_entity IN (SELECT name FROM temp_entities)
             OR r.to_entity IN (SELECT name FROM temp_entities)
        `).all() as RelationRow[];
        
        connection.db.exec('DROP TABLE temp_entities');
        
        return rows;
      } else {
        // Direct query for small sets
        const placeholders = entityNames.map(() => '?').join(',');
        const stmt = connection.db.prepare(`
          SELECT DISTINCT * FROM relations 
          WHERE from_entity IN (${placeholders}) 
             OR to_entity IN (${placeholders})
        `);
        
        return stmt.all(...entityNames, ...entityNames) as RelationRow[];
      }
    };
    
    if (conn) {
      const rows = await executeQuery(conn);
      return rows.map(row => ({
        type: 'relation' as const,
        from: row.from_entity,
        to: row.to_entity,
        relationType: row.relation_type
      }));
    } else if (this.asyncReadPool) {
      const pooledConn = await this.asyncReadPool.acquire();
      try {
        const rows = await executeQuery(pooledConn);
        return rows.map(row => ({
          type: 'relation' as const,
          from: row.from_entity,
          to: row.to_entity,
          relationType: row.relation_type
        }));
      } finally {
        await this.asyncReadPool.release(pooledConn);
      }
    }
    
    // Fallback to sync method
    return this.getRelationsForEntities(entityNames);
  }
  
  // Helper methods to access protected members
  private getDbPath(): string {
    return this.dbPath;
  }
  
  private getEntityFromCache(name: string): EntityResult | undefined {
    return this.entityCache.get(name);
  }
  
  private checkBloomFilter(name: string): boolean {
    return this.entityBloom.contains(name);
  }
  
  private createEntityResult(row: EntityRow): EntityResult {
    return {
      type: 'entity',
      name: row.name,
      entityType: row.entity_type,
      observations: this.compressionEnabled 
        ? CompressionUtils.decompressObservations(row.observations)
        : parseObservations(row.observations)
    };
  }
  
  private cacheEntity(name: string, entity: EntityResult): void {
    this.entityCache.set(name, entity);
  }
  
  private getSearchFromCache(key: string): GraphResult | undefined {
    return this.searchCache.get(key);
  }
  
  private cacheSearchResult(key: string, result: GraphResult): void {
    this.searchCache.set(key, result);
  }
  
  // Override getRelationsForEntities to be accessible
  getRelationsForEntities(entityNames: string[]): RelationResult[] {
    return super.getRelationsForEntities(entityNames);
  }
}