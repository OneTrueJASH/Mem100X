/**
 * Multi-Database Manager with Synchronous Operations
 * Intelligently manages multiple memory contexts with automatic routing
 */

import { MemoryDatabase } from './database.js';
import { ContextConfidenceScorer } from './context-confidence.js';
import { 
  MemoryConfig, 
  GraphResult, 
  EntityResult, 
  RelationResult, 
  CreateEntityInput, 
  CreateRelationInput, 
  ObservationUpdate, 
  ObservationDeletion, 
  SearchOptions, 
  GetNeighborsOptions, 
  FindShortestPathOptions, 
  ShortestPathResult 
} from './types.js';
import { existsSync, mkdirSync, copyFileSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { config as appConfig } from './config.js';
import { logInfo } from './utils/logger.js';

export class MultiDatabaseManager {
  private databases: Map<string, MemoryDatabase> = new Map();
  private _currentContext: string;
  private entityContextMap: Map<string, string> = new Map();
  private confidenceScorer!: ContextConfidenceScorer;
  private config!: MemoryConfig;

  public get currentContext(): string {
    return this._currentContext;
  }

  constructor(config: typeof appConfig) {
    this._currentContext = config.multiContext.defaultContext;
    this.initialize(config);
  }

  private initialize(config: typeof appConfig): void {
    this.config = this.loadConfig(config);
    this.initializeDatabases();
    this.loadEntityMappings();
    
    // Convert database configs to the format expected by ContextConfidenceScorer
    const scorerConfigs: Record<string, any> = {};
    for (const [context, dbConfig] of Object.entries(this.config.databases)) {
      scorerConfigs[context] = {
        enabled: true,
        dbPath: dbConfig.path,
        patterns: dbConfig.patterns,
        entityTypes: dbConfig.entityTypes,
        autoDetect: this.config.autoDetect
      };
    }
    
    this.confidenceScorer = new ContextConfidenceScorer(
      scorerConfigs,
      this.entityContextMap
    );
  }

  private loadConfig(config: typeof appConfig): MemoryConfig {
    return {
      databases: {
        personal: {
          path: config.multiContext.personalDbPath,
          patterns: ['personal', 'family', 'health', 'hobby'],
          entityTypes: ['person', 'family_member', 'friend']
        },
        work: {
          path: config.multiContext.workDbPath,
          patterns: ['work', 'project', 'colleague', 'meeting'],
          entityTypes: ['project', 'company', 'colleague']
        }
      },
      defaultContext: config.multiContext.defaultContext,
      autoDetect: true,
      detectionSettings: {
        entityWeight: 0.4,
        typeWeight: 0.25,
        patternWeight: 0.15,
        relationWeight: 0.1,
        existingEntityWeight: 0.1
      }
    };
  }

  private initializeDatabases(): void {
    for (const [context, dbConfig] of Object.entries(this.config.databases)) {
      const db = new MemoryDatabase(dbConfig.path);
      this.databases.set(context, db);
    }
  }

  private loadEntityMappings(): void {
    this.entityContextMap.clear();
    for (const [context, db] of this.databases) {
      const graph = db.readGraph();
      for (const entity of graph.entities) {
        this.entityContextMap.set(entity.name.toLowerCase(), context);
      }
    }
  }

  private detectContext(data: any): { context: string; confidence: number } {
    if (!this.config.autoDetect) {
      return { context: this._currentContext, confidence: 1.0 };
    }
    if (data.context && this.databases.has(data.context)) {
      return { context: data.context, confidence: 1.0 };
    }
    const scores = this.confidenceScorer.scoreContexts(data, Array.from(this.databases.keys()));
    if (scores.length === 0) {
      return { context: this._currentContext, confidence: 0.0 };
    }
    return { context: scores[0].context, confidence: scores[0].confidence };
  }

  public getContextInfo(): any {
    const contexts: any = {};
    for (const [context, db] of this.databases.entries()) {
      const stats = db.getStats();
      contexts[context] = {
        path: (db as any).dbPath,
        entities: stats.totalEntities,
        relations: stats.totalRelations,
        sizeKb: stats.databaseSizeKb,
      };
    }

    return {
      currentContext: this.currentContext,
      contexts,
      lastDetection: (this.confidenceScorer as any).lastDetection || null,
    };
  }

  public setContext(context: string): string {
    if (this.databases.has(context)) {
      this._currentContext = context;
      return `Switched to ${context} context`;
    }
    throw new Error(`Unknown context: ${context}.`);
  }

  public createEntities(entities: CreateEntityInput[], context?: string): EntityResult[] {
    const targetContext = (context ? { context, confidence: 1.0 } : this.detectContext({ entities })).context;
    const db = this.databases.get(targetContext);
    if (!db) throw new Error(`Invalid context: ${targetContext}`);
    
    // Use batch creation for larger sets
    const created = entities.length >= 10 && db.createEntitiesBatch
      ? db.createEntitiesBatch(entities)
      : db.createEntities(entities);
      
    for (const entity of created) {
      this.entityContextMap.set(entity.name.toLowerCase(), targetContext);
    }
    return created.map(e => ({ ...e, _context: targetContext }));
  }

  public createRelations(relations: CreateRelationInput[], context?: string): RelationResult[] {
    const detection = context ? { context, confidence: 1.0 } : this.detectContext({ relations });
    const targetContext = detection.context;
    const db = this.databases.get(targetContext);
    if (!db) throw new Error(`Invalid context: ${targetContext}`);
    
    const created = db.createRelations(relations);
    return created.map(r => ({ ...r, _context: targetContext }));
  }

  public searchNodes(options: SearchOptions): GraphResult {
    if (options.context) {
      const db = this.databases.get(options.context);
      if (!db) throw new Error(`Invalid context: ${options.context}`);
      const results = db.searchNodes(options);
      return {
        entities: results.entities.map(e => ({ ...e, _context: options.context })),
        relations: results.relations.map(r => ({ ...r, _context: options.context }))
      };
    }
    
    // Search across all contexts
    const allEntities: EntityResult[] = [];
    const allRelations: RelationResult[] = [];
    
    for (const [context, db] of this.databases) {
      const results = db.searchNodes(options);
      allEntities.push(...results.entities.map(e => ({ ...e, _context: context })));
      allRelations.push(...results.relations.map(r => ({ ...r, _context: context })));
    }
    
    return { entities: allEntities, relations: allRelations };
  }

  public readGraph(limit?: number, offset: number = 0, context?: string): GraphResult {
    if (context) {
      const db = this.databases.get(context);
      if (!db) throw new Error(`Invalid context: ${context}`);
      const graph = db.readGraph(limit, offset);
      return {
        entities: graph.entities.map(e => ({ ...e, _context: context })),
        relations: graph.relations.map(r => ({ ...r, _context: context })),
        pagination: graph.pagination
      };
    }
    
    // Read from current context
    const db = this.databases.get(this._currentContext);
    if (!db) throw new Error(`Invalid current context: ${this._currentContext}`);
    const graph = db.readGraph(limit, offset);
    return {
      entities: graph.entities.map(e => ({ ...e, _context: this._currentContext })),
      relations: graph.relations.map(r => ({ ...r, _context: this._currentContext })),
      pagination: graph.pagination
    };
  }

  public openNodes(names: string[], context?: string): GraphResult {
    if (context) {
      const db = this.databases.get(context);
      if (!db) throw new Error(`Invalid context: ${context}`);
      const results = db.openNodes(names);
      return {
        entities: results.entities.map(e => ({ ...e, _context: context })),
        relations: results.relations.map(r => ({ ...r, _context: context }))
      };
    }
    
    // Search all contexts for requested nodes
    const allEntities: EntityResult[] = [];
    const entityNamesFound = new Set<string>();
    
    for (const [ctx, db] of this.databases) {
      const remaining = names.filter(name => !entityNamesFound.has(name.toLowerCase()));
      if (remaining.length === 0) break;
      
      const results = db.openNodes(remaining);
      for (const entity of results.entities) {
        allEntities.push({ ...entity, _context: ctx });
        entityNamesFound.add(entity.name.toLowerCase());
      }
    }
    
    // Get relations for found entities
    const foundNames = allEntities.map(e => e.name);
    const allRelations: RelationResult[] = [];
    
    if (foundNames.length > 0) {
      for (const [ctx, db] of this.databases) {
        const relations = db.getRelationsForEntities(foundNames);
        allRelations.push(...relations.map(r => ({ ...r, _context: ctx })));
      }
    }
    
    return { entities: allEntities, relations: allRelations };
  }

  public addObservations(updates: ObservationUpdate[], context?: string): void {
    if (context) {
      const db = this.databases.get(context);
      if (!db) throw new Error(`Invalid context: ${context}`);
      db.addObservations(updates);
      return;
    }
    
    // Group updates by entity context
    const updatesByContext = new Map<string, ObservationUpdate[]>();
    
    for (const update of updates) {
      const entityContext = this.entityContextMap.get(update.entityName.toLowerCase()) || this._currentContext;
      if (!updatesByContext.has(entityContext)) {
        updatesByContext.set(entityContext, []);
      }
      updatesByContext.get(entityContext)!.push(update);
    }
    
    // Apply updates to respective databases
    for (const [ctx, contextUpdates] of updatesByContext) {
      const db = this.databases.get(ctx);
      if (db) {
        db.addObservations(contextUpdates);
      }
    }
  }

  public deleteObservations(deletions: ObservationDeletion[], context?: string): void {
    if (context) {
      const db = this.databases.get(context);
      if (!db) throw new Error(`Invalid context: ${context}`);
      db.deleteObservations(deletions);
      return;
    }
    
    // Group deletions by entity context
    const deletionsByContext = new Map<string, ObservationDeletion[]>();
    
    for (const deletion of deletions) {
      const entityContext = this.entityContextMap.get(deletion.entityName.toLowerCase()) || this._currentContext;
      if (!deletionsByContext.has(entityContext)) {
        deletionsByContext.set(entityContext, []);
      }
      deletionsByContext.get(entityContext)!.push(deletion);
    }
    
    // Apply deletions to respective databases
    for (const [ctx, contextDeletions] of deletionsByContext) {
      const db = this.databases.get(ctx);
      if (db) {
        db.deleteObservations(contextDeletions);
      }
    }
  }

  public deleteEntities(entityNames: string[], context?: string): void {
    if (context) {
      const db = this.databases.get(context);
      if (!db) throw new Error(`Invalid context: ${context}`);
      db.deleteEntities(entityNames);
      for (const name of entityNames) {
        this.entityContextMap.delete(name.toLowerCase());
      }
      return;
    }
    
    // Delete from appropriate contexts
    const entitiesByContext = new Map<string, string[]>();
    
    for (const name of entityNames) {
      const entityContext = this.entityContextMap.get(name.toLowerCase()) || this._currentContext;
      if (!entitiesByContext.has(entityContext)) {
        entitiesByContext.set(entityContext, []);
      }
      entitiesByContext.get(entityContext)!.push(name);
    }
    
    for (const [ctx, names] of entitiesByContext) {
      const db = this.databases.get(ctx);
      if (db) {
        db.deleteEntities(names);
        for (const name of names) {
          this.entityContextMap.delete(name.toLowerCase());
        }
      }
    }
  }

  public deleteRelations(relations: CreateRelationInput[], context?: string): void {
    const targetContext = context || this.detectContext({ relations }).context;
    const db = this.databases.get(targetContext);
    if (!db) throw new Error(`Invalid context: ${targetContext}`);
    
    db.deleteRelations(relations);
  }

  public getStats(context?: string): any {
    if (context) {
      const db = this.databases.get(context);
      if (!db) throw new Error(`Invalid context: ${context}`);
      return db.getStats();
    }
    
    // Aggregate stats from all contexts
    const allStats: any = {
      totalEntities: 0,
      totalRelations: 0,
      contexts: {}
    };
    
    for (const [ctx, db] of this.databases) {
      const stats = db.getStats();
      allStats.totalEntities += stats.totalEntities;
      allStats.totalRelations += stats.totalRelations;
      allStats.contexts[ctx] = stats;
    }
    
    return allStats;
  }

  public beginTransaction(name?: string): string {
    // Transactions are context-specific
    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    // In a real implementation, you'd track active transactions
    return transactionId;
  }

  public commitTransaction(): void {
    // Commit any active transactions
    // In this implementation, transactions are handled at the database level
  }

  public rollbackTransaction(): void {
    // Rollback any active transactions
    // In this implementation, transactions are handled at the database level
  }

  public createBackup(backupPath?: string, context?: string): any {
    const targetContext = context || this._currentContext;
    const db = this.databases.get(targetContext);
    if (!db) throw new Error(`Invalid context: ${targetContext}`);
    
    const actualBackupPath = backupPath || `./backups/backup-${targetContext}-${Date.now()}.db`;
    const dir = dirname(actualBackupPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    
    db.backup(actualBackupPath);
    
    return {
      path: actualBackupPath,
      size: statSync(actualBackupPath).size,
      context: targetContext,
      timestamp: new Date().toISOString()
    };
  }

  public restoreBackup(backupPath: string, context?: string): any {
    const targetContext = context || this._currentContext;
    if (!existsSync(backupPath)) {
      throw new Error('Backup file not found');
    }
    
    // Check if there's an active transaction
    if (this.isInTransaction && this.isInTransaction()) {
      this.rollbackTransaction();
    }
    
    const dbConfig = this.config.databases[targetContext];
    if (!dbConfig) throw new Error(`Invalid context: ${targetContext}`);
    
    // Create safety backup before restore
    const safetyBackupPath = `${dbConfig.path}.safety-${Date.now()}`;
    const db = this.databases.get(targetContext);
    if (db && existsSync(dbConfig.path)) {
      try {
        copyFileSync(dbConfig.path, safetyBackupPath);
        logInfo('Safety backup created', { path: safetyBackupPath });
      } catch (error) {
        // Continue with restore even if safety backup fails
        logInfo('Failed to create safety backup', { error });
      }
    }
    
    // Close existing database
    if (db) {
      db.close();
    }
    
    // Copy backup to database path
    copyFileSync(backupPath, dbConfig.path);
    
    // Also restore bloom filter if it exists
    const backupBloomPath = backupPath.replace('.db', '.cbloom');
    const targetBloomPath = dbConfig.path.replace('.db', '.cbloom');
    if (existsSync(backupBloomPath)) {
      copyFileSync(backupBloomPath, targetBloomPath);
    }
    
    // Reinitialize database
    const newDb = new MemoryDatabase(dbConfig.path);
    this.databases.set(targetContext, newDb);
    
    // Reload entity mappings
    this.loadEntityMappings();
    
    const stats = newDb.getStats();
    return {
      backupPath,
      context: targetContext,
      stats: {
        entityCount: stats.totalEntities,
        relationCount: stats.totalRelations
      }
    };
  }

  public isInTransaction(): boolean {
    // Placeholder for transaction checking
    return false;
  }

  public getNeighbors(entityName: string, options: GetNeighborsOptions): GraphResult {
    const targetContext = options.context || this.entityContextMap.get(entityName.toLowerCase()) || this._currentContext;
    const db = this.databases.get(targetContext);
    if (!db) throw new Error(`Invalid context: ${targetContext}`);

    // For now, return empty result as this would require implementing graph traversal
    return { entities: [], relations: [] };
  }

  public findShortestPath(from: string, to: string, options: FindShortestPathOptions): ShortestPathResult {
    const fromContext = this.entityContextMap.get(from.toLowerCase());
    const toContext = this.entityContextMap.get(to.toLowerCase());
    
    if (fromContext !== toContext) {
      return { found: false, path: [], distance: -1 };
    }
    
    const targetContext = options.context || fromContext || this._currentContext;
    const db = this.databases.get(targetContext);
    if (!db) throw new Error(`Invalid context: ${targetContext}`);
    
    // For now, return not found as this would require implementing graph algorithms
    return { found: false, path: [], distance: -1 };
  }

  public getEntity(name: string, context?: string): EntityResult | null {
    if (context) {
      const db = this.databases.get(context);
      if (!db) throw new Error(`Invalid context: ${context}`);
      const entity = db.getEntity(name);
      return entity || null;
    }
    
    // Search all contexts
    for (const [ctx, db] of this.databases) {
      const entity = db.getEntity(name);
      if (entity) {
        return { ...entity, _context: ctx };
      }
    }
    
    return null;
  }

  public close(): void {
    this.closeAll();
  }

  public closeAll(): void {
    for (const db of this.databases.values()) {
      db.close();
    }
  }
}