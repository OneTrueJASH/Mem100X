/**
 * Type definitions for the MCP Memory Server
 * Following TypeScript best practices with precise type definitions
 */

export interface Entity {
  name: string;
  entityType: string;
  observations: RichContent[];
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
  access_count: number;
  last_accessed: number;
  prominence_score: number;
  decay_rate: number;
  importance_weight: number;
}

export interface RelationRow {
  id: number;
  from_entity: string;
  to_entity: string;
  relation_type: string;
  created_at: number;
  access_count: number;
  last_accessed: number;
  prominence_score: number;
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
  circuitBreaker?: {
    state: string;
    failureCount: number;
    successCount: number;
    totalRequests: number;
    failureRate: number;
    bulkOperationsEnabled: boolean;
  };
}

export interface SearchOptions {
  query: string;
  limit?: number;
  context?: string;
  // Context-aware search enhancements
  searchContext?: {
    currentEntities?: string[];
    recentSearches?: string[];
    userContext?: 'work' | 'personal' | 'neutral';
    conversationContext?: string;
  };
  searchMode?: 'exact' | 'semantic' | 'fuzzy' | 'hybrid';
  contentTypes?: ('text' | 'image' | 'audio' | 'resource')[];
  intent?: 'find' | 'browse' | 'explore' | 'verify';
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
  observations: RichContent[];
  // Optional ranking/aging fields
  last_accessed?: number;
  updated_at?: number;
  access_count?: number;
  prominence_score?: number;
}

export interface CreateRelationInput {
  from: string;
  to: string;
  relationType: string;
}

// MCP Content Block Union - matches official MCP specification
export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'image';
  data: string; // base64 encoded
  mimeType: string;
}

export interface AudioContent {
  type: 'audio';
  data: string; // base64 encoded
  mimeType: string;
}

export interface ResourceLinkContent {
  type: 'resource_link';
  uri: string;
  title?: string;
  description?: string;
}

export interface ResourceContent {
  type: 'resource';
  data: string; // base64 encoded
  mimeType: string;
  title?: string;
  description?: string;
}

// Discriminated union for all content types
export type RichContent =
  | TextContent
  | ImageContent
  | AudioContent
  | ResourceLinkContent
  | ResourceContent;

export interface ObservationUpdate {
  entityName: string;
  contents: RichContent[];
}

export interface ObservationDeletion {
  entityName: string;
  observations: RichContent[];
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
  contexts: Record<
    string,
    {
      path: string;
      entities: number;
      relations: number;
      sizeKb: number;
    }
  >;
  lastDetection: {
    topChoice: ContextScore;
    alternatives: ContextScore[];
    confidenceLevel: string;
  } | null;
}

// Temporary stub types for SDK imports
export class McpError extends Error {
  constructor(message: string, public code?: string, public details?: any) {
    super(message);
    this.name = 'McpError';
  }
}

export enum ErrorCode {
  InvalidParams = 'invalid_params',
  InvalidRequest = 'invalid_request',
  MethodNotFound = 'method_not_found',
  InternalError = 'internal_error',
  RateLimited = 'rate_limited',
  NotFound = 'not_found',
  PermissionDenied = 'permission_denied'
}

// Memory Export/Import Types
export interface MemoryExport {
  version: string;
  exportDate: string;
  sourceServer: string;
  sourceVersion: string;
  metadata: {
    totalEntities: number;
    totalRelations: number;
    totalObservations: number;
    contexts: string[];
    entityTypes: string[];
    relationTypes: string[];
    dateRange?: {
      from: string;
      to: string;
    };
  };
  contexts: Record<string, ContextExport>;
  checksum: string;
}

export interface ContextExport {
  name: string;
  entities: EntityExport[];
  relations: RelationExport[];
  metadata: {
    entityCount: number;
    relationCount: number;
    observationCount: number;
  };
}

export interface EntityExport {
  id?: string;
  name: string;
  entityType: string;
  content: RichContent[];
  metadata?: {
    createdAt?: string;
    updatedAt?: string;
    prominence?: number;
    accessCount?: number;
    lastAccessed?: string;
  };
}

export interface RelationExport {
  id?: string;
  from: string;
  to: string;
  relationType: string;
  metadata?: {
    createdAt?: string;
    strength?: number;
  };
}

export interface ImportOptions {
  context?: string;
  importMode: 'merge' | 'replace' | 'update' | 'append';
  conflictResolution: 'skip' | 'overwrite' | 'rename' | 'merge';
  validateBeforeImport: boolean;
  dryRun: boolean;
  sourceVersion?: string;
  sourceServer?: string;
  migrationOptions?: MigrationOptions;
  batchSize: number;
  progressCallback: boolean;
}

export interface MigrationOptions {
  preserveIds?: boolean;
  updateTimestamps?: boolean;
  remapEntityTypes?: Record<string, string>;
  remapRelationTypes?: Record<string, string>;
  filterContent?: {
    includeText: boolean;
    includeImages: boolean;
    includeAudio: boolean;
    includeResources: boolean;
  };
}

export interface ImportResult {
  success: boolean;
  summary: {
    entitiesImported: number;
    entitiesSkipped: number;
    entitiesUpdated: number;
    relationsImported: number;
    relationsSkipped: number;
    observationsImported: number;
    contextsCreated: number;
    errors: ImportError[];
  };
  details: {
    entityMapping: Record<string, string>;
    relationMapping: Record<string, string>;
    contextMapping: Record<string, string>;
  };
  warnings: string[];
  duration: number;
}

export interface ImportError {
  type: 'entity' | 'relation' | 'observation' | 'context' | 'validation';
  message: string;
  data?: any;
  entityName?: string;
  relationId?: string;
}

export interface ExportOptions {
  context?: string;
  format: 'json' | 'jsonl' | 'compressed';
  includeMetadata: boolean;
  includeObservations: boolean;
  includeRelations: boolean;
  filterByDate?: {
    from: string;
    to: string;
  };
  filterByEntityType?: string[];
  exportVersion: string;
  targetServer?: string;
  compressionLevel: number;
}

export interface ExportResult {
  success: boolean;
  data: MemoryExport | string;  // string when compressed
  summary: {
    totalEntities: number;
    totalRelations: number;
    totalObservations: number;
    contexts: string[];
    size: number;
    compressionRatio?: number;
  };
  duration: number;
  warnings: string[];
}
