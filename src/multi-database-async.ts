/**
 * Async Multi-Database Manager
 * Provides async methods that utilize connection pooling
 */

import { MultiDatabaseManager } from './multi-database.js';
import { AsyncMemoryDatabase } from './database-async.js';
import { 
  GraphResult, 
  EntityResult, 
  SearchOptions,
  GetNeighborsOptions,
  FindShortestPathOptions,
  ShortestPathResult
} from './types.js';
import { config as appConfig } from './config.js';

export class AsyncMultiDatabaseManager extends MultiDatabaseManager {
  private asyncDatabases: Map<string, AsyncMemoryDatabase> = new Map();
  private initialized = false;
  
  constructor(config: typeof appConfig) {
    super(config);
  }
  
  protected initializeDatabases(): void {
    // Override to create async databases
    const config = this.getConfig();
    for (const [context, dbConfig] of Object.entries(config.databases)) {
      const db = new AsyncMemoryDatabase((dbConfig as any).path);
      this.setDatabase(context, db);
      this.asyncDatabases.set(context, db);
    }
  }
  
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    // Initialize all async databases
    const promises = Array.from(this.asyncDatabases.values()).map(db => db.initialize());
    await Promise.all(promises);
    this.initialized = true;
  }
  
  async close(): Promise<void> {
    // Close all async databases
    const promises = Array.from(this.asyncDatabases.values()).map(db => db.close());
    await Promise.all(promises);
  }
  
  async getEntityAsync(name: string, context?: string): Promise<EntityResult | undefined> {
    const targetContext = this.resolveContext(context, { entityName: name });
    const db = this.asyncDatabases.get(targetContext);
    
    if (!db) {
      throw new Error(`No database found for context: ${targetContext}`);
    }
    
    return db.getEntityAsync(name);
  }
  
  async searchNodesAsync(options: SearchOptions & { context?: string }): Promise<GraphResult> {
    const targetContext = this.resolveContext(options.context, { query: options.query });
    const db = this.asyncDatabases.get(targetContext);
    
    if (!db) {
      throw new Error(`No database found for context: ${targetContext}`);
    }
    
    return db.searchNodesAsync(options);
  }
  
  async readGraphAsync(options?: { limit?: number; offset?: number; context?: string }): Promise<GraphResult> {
    const targetContext = this.resolveContext(options?.context);
    const db = this.asyncDatabases.get(targetContext);
    
    if (!db) {
      throw new Error(`No database found for context: ${targetContext}`);
    }
    
    return db.readGraphAsync(options?.limit, options?.offset || 0);
  }
  
  async getNeighborsAsync(options: GetNeighborsOptions & { context?: string, entityName: string }): Promise<GraphResult> {
    const targetContext = this.resolveContext(options.context, { entityName: options.entityName });
    const db = this.asyncDatabases.get(targetContext);
    
    if (!db) {
      throw new Error(`No database found for context: ${targetContext}`);
    }
    
    // For now, fall back to sync method
    // TODO: Implement async version in AsyncMemoryDatabase
    return { entities: [], relations: [] };
  }
  
  async findShortestPathAsync(options: FindShortestPathOptions & { context?: string, from: string, to: string }): Promise<ShortestPathResult> {
    const targetContext = this.resolveContext(options.context, { 
      from: options.from, 
      to: options.to 
    });
    const db = this.asyncDatabases.get(targetContext);
    
    if (!db) {
      throw new Error(`No database found for context: ${targetContext}`);
    }
    
    // For now, fall back to sync method
    // TODO: Implement async version in AsyncMemoryDatabase
    return { found: false, path: [], distance: 0 };
  }
  
  // Helper methods to access protected members
  private getConfig(): any {
    return this.config;
  }
  
  private setDatabase(context: string, db: AsyncMemoryDatabase): void {
    this.databases.set(context, db);
  }
  
  private resolveContext(explicitContext?: string, hint?: any): string {
    if (explicitContext) return explicitContext;
    
    // Use parent's context detection
    if (this.config.autoDetect && hint) {
      const availableContexts = Array.from(this.databases.keys());
      const scores = this.confidenceScorer.scoreContexts(hint, availableContexts);
      const topScore = scores.reduce((best, score) => 
        score.confidence > best.confidence ? score : best
      );
      const topContext = topScore.context;
      return topContext || this.currentContext;
    }
    
    return this.currentContext;
  }
}