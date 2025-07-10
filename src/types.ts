/**
 * Type definitions for the MCP Memory Server
 * Following TypeScript best practices with precise type definitions
 */

export interface Entity {
  name: string;
  entityType: string;
  observations: string[];
}

export interface Relation {
  from: string;
  to: string;
  relationType: string;
}

export interface EntityRow {
  name: string;
  entity_type: string;
  observations: string;
  created_at: number;
  updated_at: number;
}

export interface RelationRow {
  id: number;
  from_entity: string;
  to_entity: string;
  relation_type: string;
  created_at: number;
}

export interface GraphResult {
  entities: EntityResult[];
  relations: RelationResult[];
  pagination?: {
    totalEntities: number;
    totalRelations: number;
    offset: number;
    limit?: number;
    hasMore: boolean;
  };
}

export interface EntityResult extends Entity {
  type: 'entity';
  _context?: string;
}

export interface RelationResult extends Relation {
  type: 'relation';
  _context?: string;
}

import { CacheStats } from './utils/cache-interface.js';

export interface BloomStats {
  size: number;
  numHashes: number;
  items: number;
  fillRate: number;
  saturatedCounters: number;
  averageCounter: number;
}

export interface DatabaseStats {
  totalEntities: number;
  totalRelations: number;
  entityTypes: Record<string, number>;
  databaseSizeKb: number;
  cacheStats: {
    entity: CacheStats;
    search: CacheStats;
  };
  bloomStats: BloomStats;
}

export interface SearchOptions {
  query: string;
  limit?: number;
  context?: string;
}

export interface GetNeighborsOptions {
  direction: 'outgoing' | 'incoming' | 'both';
  relationType?: string;
  depth: number;
  includeRelations: boolean;
  context?: string;
}

export interface FindShortestPathOptions {
  bidirectional: boolean;
  relationType?: string;
  maxDepth: number;
  context?: string;
}

export interface ShortestPathResult {
  found: boolean;
  path: string[];
  distance: number;
  nodesExplored?: number;
}

export interface CreateEntityInput {
  name: string;
  entityType: string;
  observations: string[];
}

export interface CreateRelationInput {
  from: string;
  to: string;
  relationType: string;
}

export interface ObservationUpdate {
  entityName: string;
  contents: string[];
}

export interface ObservationDeletion {
  entityName: string;
  observations: string[];
}

// Multi-database configuration types
export interface DatabaseConfig {
  path: string;
  patterns: string[];
  entityTypes: string[];
}

export interface MemoryConfig {
  databases: Record<string, DatabaseConfig>;
  defaultContext: string;
  autoDetect: boolean;
  detectionSettings?: {
    entityWeight?: number;
    typeWeight?: number;
    patternWeight?: number;
    relationWeight?: number;
    existingEntityWeight?: number;
  };
}

export interface ContextScore {
  context: string;
  confidence: number;
  score: number;
  breakdown: Record<string, number>;
  evidence: string[];
}

export interface ContextInfo {
  currentContext: string;
  contexts: Record<string, {
    path: string;
    entities: number;
    relations: number;
    sizeKb: number;
  }>;
  lastDetection: {
    topChoice: ContextScore;
    alternatives: ContextScore[];
    confidenceLevel: string;
  } | null;
}