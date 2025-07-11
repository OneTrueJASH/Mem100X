/**
 * Async tool handlers for MCP server
 * Uses async database methods for better concurrency
 */

import { AsyncMultiDatabaseManager } from './multi-database-async.js';
import {
  toolSchemas,
  SetContextInput,
  GetContextInfoInput,
  CreateEntitiesInput,
  SearchNodesInput,
  ReadGraphInput,
  OpenNodesInput,
  CreateRelationsInput,
  DeleteRelationsInput,
  AddObservationsInput,
  DeleteObservationsInput,
  DeleteEntitiesInput,
  BeginTransactionInput,
  CommitTransactionInput,
  RollbackTransactionInput,
  CreateBackupInput,
  RestoreBackupInput,
  GetNeighborsInput,
  FindShortestPathInput,
} from './tool-schemas.js';

export interface AsyncToolContext {
  manager: AsyncMultiDatabaseManager;
  startTime: number;
  toolName: string;
}

// Context management handlers (remain sync)
export function handleSetContext(args: any, ctx: AsyncToolContext) {
  const validated = toolSchemas.set_context.parse(args) as SetContextInput;
  const message = ctx.manager.setContext(validated.context);
  return { message };
}

export function handleGetContextInfo(args: any, ctx: AsyncToolContext) {
  toolSchemas.get_context_info.parse(args); // Validate empty object
  return ctx.manager.getContextInfo();
}

// Entity operation handlers (write operations remain sync for now)
export function handleCreateEntities(args: any, ctx: AsyncToolContext) {
  const validated = toolSchemas.create_entities.parse(args) as CreateEntitiesInput;
  const created = ctx.manager.createEntities(validated.entities, validated.context);
  return { created };
}

// Search operations (now async!)
export async function handleSearchNodes(args: any, ctx: AsyncToolContext) {
  const validated = toolSchemas.search_nodes.parse(args) as SearchNodesInput;
  const result = await ctx.manager.searchNodesAsync({
    query: validated.query,
    limit: validated.limit,
    context: validated.context
  });
  return result;
}

export async function handleReadGraph(args: any, ctx: AsyncToolContext) {
  const validated = toolSchemas.read_graph.parse(args) as ReadGraphInput;
  const result = await ctx.manager.readGraphAsync({
    limit: validated.limit,
    offset: validated.offset,
    context: validated.context
  });
  return result;
}

export async function handleOpenNodes(args: any, ctx: AsyncToolContext) {
  const validated = toolSchemas.open_nodes.parse(args) as OpenNodesInput;
  
  // Use async getEntity for each node
  const entities = await Promise.all(
    validated.names.map(name => 
      ctx.manager.getEntityAsync(name, validated.context)
    )
  );
  
  // Filter out undefined results
  const validEntities = entities.filter(e => e !== undefined);
  
  // Get relations for found entities
  const entityNames = validEntities.map(e => e!.name);
  const db = ctx.manager.getDatabase(validated.context || ctx.manager.currentContext);
  const relations = db.getRelationsForEntities(entityNames);
  
  return {
    entities: validEntities,
    relations,
    totalEntities: validEntities.length,
    totalRelations: relations.length
  };
}

// Relation operations (remain sync for now)
export function handleCreateRelations(args: any, ctx: AsyncToolContext) {
  const validated = toolSchemas.create_relations.parse(args) as CreateRelationsInput;
  const created = ctx.manager.createRelations(validated.relations);
  return { created };
}

export function handleDeleteRelations(args: any, ctx: AsyncToolContext) {
  const validated = toolSchemas.delete_relations.parse(args) as DeleteRelationsInput;
  ctx.manager.deleteRelations(validated.relations);
  return { message: `Deleted ${validated.relations.length} relations` };
}

// Observation operations (remain sync)
export function handleAddObservations(args: any, ctx: AsyncToolContext) {
  const validated = toolSchemas.add_observations.parse(args) as AddObservationsInput;
  ctx.manager.addObservations(validated.observations);
  return { message: `Added observations to ${validated.observations.length} entities` };
}

export function handleDeleteObservations(args: any, ctx: AsyncToolContext) {
  const validated = toolSchemas.delete_observations.parse(args) as DeleteObservationsInput;
  ctx.manager.deleteObservations(validated.deletions);
  return { message: `Deleted observations from ${validated.deletions.length} entities` };
}

export function handleDeleteEntities(args: any, ctx: AsyncToolContext) {
  const validated = toolSchemas.delete_entities.parse(args) as DeleteEntitiesInput;
  ctx.manager.deleteEntities(validated.entityNames);
  return { message: `Deleted ${validated.entityNames.length} entities` };
}

// Transaction operations (remain sync)
export function handleBeginTransaction(args: any, ctx: AsyncToolContext) {
  toolSchemas.begin_transaction.parse(args); // Validate empty object
  ctx.manager.beginTransaction();
  return { message: 'Transaction started' };
}

export function handleCommitTransaction(args: any, ctx: AsyncToolContext) {
  toolSchemas.commit_transaction.parse(args); // Validate empty object
  ctx.manager.commitTransaction();
  return { message: 'Transaction committed' };
}

export function handleRollbackTransaction(args: any, ctx: AsyncToolContext) {
  toolSchemas.rollback_transaction.parse(args); // Validate empty object
  ctx.manager.rollbackTransaction();
  return { message: 'Transaction rolled back' };
}

// Backup operations (remain sync)
export function handleCreateBackup(args: any, ctx: AsyncToolContext) {
  const validated = toolSchemas.create_backup.parse(args) as CreateBackupInput;
  const result = ctx.manager.createBackup(validated.backupPath, validated.context);
  return result;
}

export function handleRestoreBackup(args: any, ctx: AsyncToolContext) {
  const validated = toolSchemas.restore_backup.parse(args) as RestoreBackupInput;
  ctx.manager.restoreBackup(validated.backupPath, validated.context);
  return { message: 'Backup restored successfully' };
}

// Advanced query operations (convert to async)
export async function handleGetNeighbors(args: any, ctx: AsyncToolContext) {
  const validated = toolSchemas.get_neighbors.parse(args) as GetNeighborsInput;
  const result = await ctx.manager.getNeighborsAsync({
    entityName: validated.entityName,
    direction: validated.direction || 'both',
    relationType: validated.relationType,
    depth: validated.depth || 1,
    includeRelations: validated.includeRelations !== false,
    context: validated.context
  });
  return result;
}

export async function handleFindShortestPath(args: any, ctx: AsyncToolContext) {
  const validated = toolSchemas.find_shortest_path.parse(args) as FindShortestPathInput;
  const result = await ctx.manager.findShortestPathAsync({
    from: validated.from,
    to: validated.to,
    bidirectional: validated.bidirectional !== false,
    relationType: validated.relationType,
    maxDepth: validated.maxDepth || 6,
    context: validated.context
  });
  return result;
}

// Export handlers map with proper async types
export const asyncToolHandlers: Record<string, (args: any, ctx: AsyncToolContext) => any | Promise<any>> = {
  // Context management
  set_context: handleSetContext,
  get_context_info: handleGetContextInfo,
  
  // Entity operations
  create_entities: handleCreateEntities,
  search_nodes: handleSearchNodes,
  read_graph: handleReadGraph,
  open_nodes: handleOpenNodes,
  
  // Relation operations
  create_relations: handleCreateRelations,
  delete_relations: handleDeleteRelations,
  
  // Observation operations
  add_observations: handleAddObservations,
  delete_observations: handleDeleteObservations,
  delete_entities: handleDeleteEntities,
  
  // Transaction operations
  begin_transaction: handleBeginTransaction,
  commit_transaction: handleCommitTransaction,
  rollback_transaction: handleRollbackTransaction,
  
  // Backup operations
  create_backup: handleCreateBackup,
  restore_backup: handleRestoreBackup,
  
  // Advanced queries
  get_neighbors: handleGetNeighbors,
  find_shortest_path: handleFindShortestPath,
};