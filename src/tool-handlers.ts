/**
 * Tool handlers for MCP server
 * Separates tool logic from server setup for better maintainability
 */

import { MultiDatabaseManager } from './multi-database.js';
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
import { createMCPToolResponse } from './mcp-types.js';
import { createTextContent } from './utils/fast-json.js';

export interface ToolContext {
  manager: MultiDatabaseManager;
  startTime: number;
  toolName: string;
  correlationId?: string;
}

// Context management handlers
export function handleSetContext(args: any, ctx: ToolContext) {
  const validated = toolSchemas.set_context.parse(args) as SetContextInput;
  const message = ctx.manager.setContext(validated.context);
  return createMCPToolResponse({ message }, `Context set to: ${validated.context}`);
}

export function handleGetContextInfo(args: any, ctx: ToolContext) {
  toolSchemas.get_context_info.parse(args); // Validate empty object
  const contextInfo = ctx.manager.getContextInfo();
  return createMCPToolResponse(contextInfo, `Current context: ${contextInfo.currentContext}`);
}

// Entity operation handlers
export function handleCreateEntities(args: any, ctx: ToolContext) {
  // Map MCP-standard 'content' to internal 'observations'
  const entities = args.entities.map((entity: any) => ({
    ...entity,
    observations: entity.content,
  }));
  const validated = toolSchemas.create_entities.parse({ ...args, entities });
  ctx.manager.createEntities(entities);
  const duration = performance.now() - ctx.startTime;

  const result = {
    success: true,
    entitiesCreated: validated.entities.length,
    performance: { duration: `${duration.toFixed(2)}ms` },
  };

  return createMCPToolResponse(
    result,
    `Created ${validated.entities.length} entities successfully`
  );
}

export function handleSearchNodes(args: any, ctx: ToolContext) {
  const validated = toolSchemas.search_nodes.parse(args) as SearchNodesInput;
  const results = ctx.manager.searchNodes(validated);
  const duration = performance.now() - ctx.startTime;

  const result = {
    ...results,
    performance: {
      duration: `${duration.toFixed(2)}ms`,
      resultCount: results.entities.length,
    },
  };

  return createMCPToolResponse(
    result,
    `Found ${results.entities.length} entities matching "${validated.query}"`
  );
}

export function handleReadGraph(args: any, ctx: ToolContext) {
  const validated = toolSchemas.read_graph.parse(args) as ReadGraphInput;
  const graph = ctx.manager.readGraph(validated.limit, validated.offset || 0, validated.context);
  const duration = performance.now() - ctx.startTime;

  const result = {
    ...graph,
    performance: {
      duration: `${duration.toFixed(2)}ms`,
      entityCount: graph.entities.length,
      relationCount: graph.relations.length,
    },
  };

  return createMCPToolResponse(
    result,
    `Graph contains ${graph.entities.length} entities and ${graph.relations.length} relations`
  );
}

export function handleOpenNodes(args: any, ctx: ToolContext) {
  const validated = toolSchemas.open_nodes.parse(args) as OpenNodesInput;
  const result = ctx.manager.openNodes(validated.names);
  const duration = performance.now() - ctx.startTime;

  const response = {
    ...result,
    performance: {
      duration: `${duration.toFixed(2)}ms`,
      entitiesFound: result.entities.length,
      relationsFound: result.relations.length,
    },
  };

  return createMCPToolResponse(
    response,
    `Opened ${result.entities.length} entities and found ${result.relations.length} relations`
  );
}

// Relation operation handlers
export function handleCreateRelations(args: any, ctx: ToolContext) {
  const validated = toolSchemas.create_relations.parse(args) as CreateRelationsInput;
  const created = ctx.manager.createRelations(validated.relations);
  const duration = performance.now() - ctx.startTime;

  const result = {
    created,
    performance: {
      duration: `${duration.toFixed(2)}ms`,
      rate: `${Math.round(validated.relations.length / (duration / 1000))} relations/sec`,
    },
  };

  return createMCPToolResponse(result, `Created ${created.length} relations successfully`);
}

export function handleDeleteRelations(args: any, ctx: ToolContext) {
  const validated = toolSchemas.delete_relations.parse(args) as DeleteRelationsInput;
  ctx.manager.deleteRelations(validated.relations);
  const duration = performance.now() - ctx.startTime;

  const result = {
    success: true,
    relationsDeleted: validated.relations.length,
    performance: { duration: `${duration.toFixed(2)}ms` },
  };

  return createMCPToolResponse(
    result,
    `Deleted ${validated.relations.length} relations successfully`
  );
}

// Observation operation handlers
export function handleAddObservations(args: any, ctx: ToolContext) {
  // Map MCP-standard 'content' to internal 'contents'
  const updates = args.updates.map((update: any) => ({
    ...update,
    contents: update.content,
  }));
  const validated = toolSchemas.add_observations.parse({ updates });
  ctx.manager.addObservations(updates);
  const duration = performance.now() - ctx.startTime;

  const result = {
    success: true,
    observationsAdded: validated.updates.length,
    performance: { duration: `${duration.toFixed(2)}ms` },
  };

  return createMCPToolResponse(
    result,
    `Added observations to ${validated.updates.length} entities successfully`
  );
}

export function handleDeleteObservations(args: any, ctx: ToolContext) {
  // Map MCP-standard 'content' to internal 'observations'
  const deletions = args.deletions.map((del: any) => ({
    ...del,
    observations: del.content,
  }));
  const validated = toolSchemas.delete_observations.parse({ deletions });
  ctx.manager.deleteObservations(deletions);
  const duration = performance.now() - ctx.startTime;

  const result = {
    success: true,
    deletions: validated.deletions.length,
    performance: { duration: `${duration.toFixed(2)}ms` },
  };

  return createMCPToolResponse(
    result,
    `Deleted observations from ${validated.deletions.length} entities successfully`
  );
}

// Entity deletion handler
export function handleDeleteEntities(args: any, ctx: ToolContext) {
  const validated = toolSchemas.delete_entities.parse(args) as DeleteEntitiesInput;
  ctx.manager.deleteEntities(validated.entityNames);
  const duration = performance.now() - ctx.startTime;

  const result = {
    success: true,
    entitiesDeleted: validated.entityNames.length,
    performance: { duration: `${duration.toFixed(2)}ms` },
  };

  return createMCPToolResponse(
    result,
    `Deleted ${validated.entityNames.length} entities successfully`
  );
}

// Transaction handlers
export function handleBeginTransaction(args: any, ctx: ToolContext) {
  const validated = toolSchemas.begin_transaction.parse(args) as BeginTransactionInput;
  const transactionId = ctx.manager.beginTransaction(validated.name);
  const duration = performance.now() - ctx.startTime;

  const result = {
    success: true,
    transactionId,
    message: `Transaction ${transactionId} started`,
    performance: { duration: `${duration.toFixed(2)}ms` },
  };

  return createMCPToolResponse(result, `Transaction ${transactionId} started successfully`);
}

export function handleCommitTransaction(args: any, ctx: ToolContext) {
  toolSchemas.commit_transaction.parse(args); // Validate empty object
  ctx.manager.commitTransaction();
  const duration = performance.now() - ctx.startTime;

  const result = {
    success: true,
    message: 'Transaction committed successfully',
    performance: { duration: `${duration.toFixed(2)}ms` },
  };

  return createMCPToolResponse(result, 'Transaction committed successfully');
}

export function handleRollbackTransaction(args: any, ctx: ToolContext) {
  toolSchemas.rollback_transaction.parse(args); // Validate empty object
  ctx.manager.rollbackTransaction();
  const duration = performance.now() - ctx.startTime;

  const result = {
    success: true,
    message: 'Transaction rolled back successfully',
    performance: { duration: `${duration.toFixed(2)}ms` },
  };

  return createMCPToolResponse(result, 'Transaction rolled back successfully');
}

// Backup and restore handlers
export function handleCreateBackup(args: any, ctx: ToolContext) {
  const validated = toolSchemas.create_backup.parse(args) as CreateBackupInput;
  const backupInfo = ctx.manager.createBackup(
    validated.backupPath || '', // Empty string will be handled by the manager
    validated.context || ctx.manager.currentContext
  );
  const duration = performance.now() - ctx.startTime;

  const result = {
    success: true,
    backupPath: backupInfo.path,
    size: backupInfo.size,
    context: backupInfo.context,
    timestamp: backupInfo.timestamp,
    message: `Backup created successfully at ${backupInfo.path}`,
    performance: { duration: `${duration.toFixed(2)}ms` },
  };

  return createMCPToolResponse(result, `Backup created successfully at ${backupInfo.path}`);
}

export function handleRestoreBackup(args: any, ctx: ToolContext) {
  const validated = toolSchemas.restore_backup.parse(args) as RestoreBackupInput;

  if (!validated.confirmRestore) {
    throw new Error('Restore operation must be confirmed by setting confirmRestore to true');
  }
  const restoreInfo = ctx.manager.restoreBackup(
    validated.backupPath,
    validated.context ?? ctx.manager.currentContext
  );
  const duration = performance.now() - ctx.startTime;

  const result = {
    success: true,
    restoredFrom: restoreInfo.backupPath,
    context: restoreInfo.context,
    entitiesRestored: restoreInfo.stats.entityCount,
    relationsRestored: restoreInfo.stats.relationCount,
    message: `Database restored successfully from ${restoreInfo.backupPath}`,
    performance: { duration: `${duration.toFixed(2)}ms` },
  };

  return createMCPToolResponse(
    result,
    `Database restored successfully from ${restoreInfo.backupPath}`
  );
}

// Graph traversal handlers
export function handleGetNeighbors(args: any, ctx: ToolContext) {
  const validated = toolSchemas.get_neighbors.parse(args) as GetNeighborsInput;
  const result = ctx.manager.getNeighbors(validated.entityName, {
    direction: validated.direction || 'both',
    relationType: validated.relationType,
    depth: validated.depth || 1,
    includeRelations: validated.includeRelations !== false,
    context: validated.context,
  });
  const duration = performance.now() - ctx.startTime;

  const response = {
    ...result,
    performance: {
      duration: `${duration.toFixed(2)}ms`,
      nodesVisited: result.entities.length,
      relationsFound: result.relations?.length || 0,
      depth: validated.depth || 1,
    },
  };

  return createMCPToolResponse(
    response,
    `Found ${result.entities.length} neighbors for "${validated.entityName}"`
  );
}

export function handleFindShortestPath(args: any, ctx: ToolContext) {
  const validated = toolSchemas.find_shortest_path.parse(args) as FindShortestPathInput;
  const result = ctx.manager.findShortestPath(validated.from, validated.to, {
    bidirectional: validated.bidirectional !== false,
    relationType: validated.relationType,
    maxDepth: validated.maxDepth || 6,
    context: validated.context,
  });
  const duration = performance.now() - ctx.startTime;

  const response = {
    found: result.found,
    path: result.path,
    distance: result.distance,
    performance: {
      duration: `${duration.toFixed(2)}ms`,
      nodesExplored: result.nodesExplored || 0,
      pathLength: result.distance,
    },
  };

  const message = result.found
    ? `Found path from "${validated.from}" to "${validated.to}" with distance ${result.distance}`
    : `No path found from "${validated.from}" to "${validated.to}"`;

  return createMCPToolResponse(response, message);
}

// Tool handler registry
export const toolHandlers: Record<string, (args: any, ctx: ToolContext) => any> = {
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

  // Entity deletion
  delete_entities: handleDeleteEntities,

  // Transaction management
  begin_transaction: handleBeginTransaction,
  commit_transaction: handleCommitTransaction,
  rollback_transaction: handleRollbackTransaction,

  // Backup and restore
  create_backup: handleCreateBackup,
  restore_backup: handleRestoreBackup,

  // Graph traversal
  get_neighbors: handleGetNeighbors,
  find_shortest_path: handleFindShortestPath,
};
