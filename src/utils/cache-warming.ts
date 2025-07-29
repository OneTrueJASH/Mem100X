/**
 * Cache Warming Utility
 * Pre-populates caches with frequently accessed data to avoid cold stalls
 */

import { ICache } from './cache-interface.js';
import { logInfo, logDebug, PerformanceTracker } from './logger.js';
import { config } from '../config.js';

export interface CacheWarmingConfig {
  enabled: boolean;
  entityWarmingEnabled: boolean;
  searchWarmingEnabled: boolean;
  maxEntitiesToWarm: number;
  maxSearchesToWarm: number;
  warmingQueries: string[];
  priorityEntities: string[];
}

export interface WarmingResult {
  entitiesWarmed: number;
  searchesWarmed: number;
  warmingTime: number;
  cacheHitRate: number;
  success: boolean;
  error?: string;
}

export class CacheWarmer {
  private config: CacheWarmingConfig;
  private entityCache: ICache<string, any>;
  private searchCache: ICache<string, any>;
  private database: any;

  constructor(
    entityCache: ICache<string, any>,
    searchCache: ICache<string, any>,
    database: any,
    warmingConfig?: Partial<CacheWarmingConfig>
  ) {
    this.entityCache = entityCache;
    this.searchCache = searchCache;
    this.database = database;

    this.config = {
      enabled: config.performance.cacheWarmingEnabled ?? true,
      entityWarmingEnabled: true,
      searchWarmingEnabled: true,
      maxEntitiesToWarm: 1000,
      maxSearchesToWarm: 100,
      warmingQueries: [
        'meeting',
        'project',
        'document',
        'task',
        'deadline',
        'important',
        'urgent',
        'review',
        'discussion',
        'decision'
      ],
      priorityEntities: [],
      ...warmingConfig
    };
  }

  /**
   * Warm up caches with frequently accessed data
   */
  async warmCaches(): Promise<WarmingResult> {
    if (!this.config.enabled) {
      logDebug('Cache warming disabled');
      return {
        entitiesWarmed: 0,
        searchesWarmed: 0,
        warmingTime: 0,
        cacheHitRate: 0,
        success: true
      };
    }

    const perf = new PerformanceTracker('cache_warming');
    const startTime = Date.now();

    try {
      logInfo('Starting cache warming...', {
        entityWarming: this.config.entityWarmingEnabled,
        searchWarming: this.config.searchWarmingEnabled,
        maxEntities: this.config.maxEntitiesToWarm,
        maxSearches: this.config.maxSearchesToWarm
      });

      let entitiesWarmed = 0;
      let searchesWarmed = 0;

      // Warm entity cache
      if (this.config.entityWarmingEnabled) {
        entitiesWarmed = await this.warmEntityCache();
      }

      // Warm search cache
      if (this.config.searchWarmingEnabled) {
        searchesWarmed = await this.warmSearchCache();
      }

      const warmingTime = Date.now() - startTime;
      const cacheHitRate = this.calculateCacheHitRate();

      logInfo('Cache warming completed', {
        entitiesWarmed,
        searchesWarmed,
        warmingTime,
        cacheHitRate: cacheHitRate.toFixed(2) + '%'
      });

      perf.end({
        entitiesWarmed,
        searchesWarmed,
        warmingTime,
        cacheHitRate
      });

      return {
        entitiesWarmed,
        searchesWarmed,
        warmingTime,
        cacheHitRate,
        success: true
      };

    } catch (error) {
      const warmingTime = Date.now() - startTime;
      logDebug('Cache warming failed', { error: error instanceof Error ? error.message : String(error) });

      perf.end({
        error: error instanceof Error ? error.message : String(error),
        warmingTime
      });

      return {
        entitiesWarmed: 0,
        searchesWarmed: 0,
        warmingTime,
        cacheHitRate: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Warm entity cache with frequently accessed entities
   */
  private async warmEntityCache(): Promise<number> {
    let warmed = 0;

    try {
      // Get recent entities (most likely to be accessed)
      const recentEntities = await this.getRecentEntities(this.config.maxEntitiesToWarm);

      for (const entity of recentEntities) {
        try {
          // Pre-load entity into cache
          const entityKey = `entity:${entity.name}`;
          if (!this.entityCache.has(entityKey)) {
            const entityData = await this.database.getEntity(entity.name);
            if (entityData) {
              this.entityCache.set(entityKey, entityData);
              warmed++;
            }
          }
        } catch (error) {
          // Continue warming other entities even if one fails
          logDebug('Failed to warm entity', {
            entity: entity.name,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      // Warm priority entities if specified
      for (const entityName of this.config.priorityEntities) {
        try {
          const entityKey = `entity:${entityName}`;
          if (!this.entityCache.has(entityKey)) {
            const entityData = await this.database.getEntity(entityName);
            if (entityData) {
              this.entityCache.set(entityKey, entityData);
              warmed++;
            }
          }
        } catch (error) {
          logDebug('Failed to warm priority entity', {
            entity: entityName,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

    } catch (error) {
      logDebug('Entity cache warming failed', {
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return warmed;
  }

  /**
   * Warm search cache with common search queries
   */
  private async warmSearchCache(): Promise<number> {
    let warmed = 0;

    try {
      for (const query of this.config.warmingQueries) {
        try {
          const searchKey = `search:${query}`;
          if (!this.searchCache.has(searchKey)) {
            const searchResults = await this.database.searchNodes({
              query,
              limit: 10
            });
            if (searchResults && searchResults.entities && searchResults.entities.length > 0) {
              this.searchCache.set(searchKey, searchResults);
              warmed++;
            }
          }
        } catch (error) {
          // Continue warming other searches even if one fails
          logDebug('Failed to warm search', {
            query,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

    } catch (error) {
      logDebug('Search cache warming failed', {
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return warmed;
  }

  /**
   * Get recent entities for warming
   */
  private async getRecentEntities(limit: number): Promise<Array<{ name: string }>> {
    try {
      // This would need to be implemented based on your database schema
      // For now, return an empty array - implement based on your actual schema
      return [];
    } catch (error) {
      logDebug('Failed to get recent entities for warming', {
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Calculate current cache hit rate
   */
  private calculateCacheHitRate(): number {
    const entityStats = this.entityCache.getStats();
    const searchStats = this.searchCache.getStats();

    const totalHits = entityStats.hits + searchStats.hits;
    const totalRequests = entityStats.hits + entityStats.misses + searchStats.hits + searchStats.misses;

    return totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;
  }

  /**
   * Update warming configuration
   */
  updateConfig(newConfig: Partial<CacheWarmingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current warming configuration
   */
  getConfig(): CacheWarmingConfig {
    return { ...this.config };
  }
}
