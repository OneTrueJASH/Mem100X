/**
 * Tool handlers for MCP server
 * Separates tool logic from server setup for better maintainability
 */

import { MultiDatabaseManager } from './multi-database.js'
import {
  toolSchemas,
  SetContextInput,
  GetContextInfoInput,
  CreateContextInput,
  DeleteContextInput,
  UpdateContextInput,
  ListContextsInput,
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
  GetResilienceStatsInput,
  GetTransactionLogsInput,
  GetRecoveryActionsInput,
  DetectAndRepairCorruptionInput,
  ValidateDataIntegrityInput,
  ClearOldTransactionLogsInput,
  CreateResilientBackupInput,
  GetPrivacyStatsInput,
  GetPrivacyConfigInput,
  UpdatePrivacyConfigInput,
  CheckAccessInput,
  SetAccessControlInput,
  RemoveAccessControlInput,
  UnlockAccountInput,
  CheckComplianceInput,
  ApplyRetentionPolicyInput,
  CleanupAuditLogsInput,
  EncryptDataInput,
  DecryptDataInput,
  AnonymizeDataInput,
  ValidateInputInput,
  SanitizeOutputInput,
} from './tool-schemas.js'
import { createMCPToolResponse, MCPToolResponse } from './mcp-types.js'
import { createTextContent } from './utils/fast-json.js'
import * as fs from 'fs';
import * as path from 'path';
import {
  MemoryExport,
  ContextExport,
  EntityExport,
  RelationExport,
  ExportOptions,
  ExportResult,
  ImportOptions,
  ImportResult,
  ImportError,
  MigrationOptions
} from './types.js';
import { createHash } from 'crypto';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

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
  return createMCPToolResponse({ message }, `Context set to: ${validated.context}`, args._meta);
}

export function handleGetContextInfo(args: any, ctx: ToolContext) {
  toolSchemas.get_context_info.parse(args); // Validate empty object
  const contextInfo = ctx.manager.getContextInfo();
  return createMCPToolResponse(contextInfo, `Current context: ${contextInfo.currentContext}`, args._meta);
}

// Context management handlers
export function handleCreateContext(args: any, ctx: ToolContext) {
  const validated = toolSchemas.create_context.parse(args) as CreateContextInput;
  const message = ctx.manager.createContext(validated.name, {
    path: validated.path,
    patterns: validated.patterns,
    entityTypes: validated.entityTypes,
    description: validated.description,
  });
  const duration = performance.now() - ctx.startTime;

  const result = {
    success: true,
    contextName: validated.name,
    message,
    performance: { duration: `${duration.toFixed(2)}ms` },
  };

  return createMCPToolResponse(result, message, args._meta);
}

export function handleDeleteContext(args: any, ctx: ToolContext) {
  const validated = toolSchemas.delete_context.parse(args) as DeleteContextInput;
  const message = ctx.manager.deleteContext(validated.name, validated.force);
  const duration = performance.now() - ctx.startTime;

  const result = {
    success: true,
    contextName: validated.name,
    message,
    performance: { duration: `${duration.toFixed(2)}ms` },
  };

  return createMCPToolResponse(result, message, args._meta);
}

export function handleUpdateContext(args: any, ctx: ToolContext) {
  const validated = toolSchemas.update_context.parse(args) as UpdateContextInput;
  const message = ctx.manager.updateContext(validated.name, {
    patterns: validated.patterns,
    entityTypes: validated.entityTypes,
    description: validated.description,
  });
  const duration = performance.now() - ctx.startTime;

  const result = {
    success: true,
    contextName: validated.name,
    message,
    performance: { duration: `${duration.toFixed(2)}ms` },
  };

  return createMCPToolResponse(result, message, args._meta);
}

export function handleListContexts(args: any, ctx: ToolContext) {
  toolSchemas.list_contexts.parse(args); // Validate empty object
  const contexts = ctx.manager.listContexts();
  const duration = performance.now() - ctx.startTime;

  const result = {
    contexts,
    count: contexts.length,
    performance: { duration: `${duration.toFixed(2)}ms` },
  };

  return createMCPToolResponse(result, `Retrieved ${contexts.length} contexts`, args._meta);
}

// Entity operation handlers
export function handleCreateEntities(args: any, ctx: ToolContext) {
  // Use validated input from Zod
  const validated = toolSchemas.create_entities.parse(args);
  // Map MCP-standard 'content' to internal 'observations' and pass through ranking fields
  const entities = validated.entities.map((entity: any) => ({
    ...entity,
    observations: entity.content,
    // Pass through ranking/aging fields if present
    ...(entity.last_accessed !== undefined ? { last_accessed: entity.last_accessed } : {}),
    ...(entity.updated_at !== undefined ? { updated_at: entity.updated_at } : {}),
    ...(entity.access_count !== undefined ? { access_count: entity.access_count } : {}),
    ...(entity.prominence_score !== undefined ? { prominence_score: entity.prominence_score } : {}),
  }));
  ctx.manager.createEntities(entities);
  const duration = performance.now() - ctx.startTime;

  const result = {
    success: true,
    entitiesCreated: entities.length,
    performance: { duration: `${duration.toFixed(2)}ms` },
  };

  return createMCPToolResponse(
    result,
    `Created ${entities.length} entities successfully`,
    args._meta
  );
}

export function handleSearchNodes(args: any, ctx: ToolContext) {
  const validated = toolSchemas.search_nodes.parse(args) as SearchNodesInput;
  const results = ctx.manager.searchNodes(validated);
  // Return the result wrapped in createMCPToolResponse
  return createMCPToolResponse(results, `Found ${results.entities.length} results for "${validated.query}"`, args._meta);
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
    `Graph contains ${graph.entities.length} entities and ${graph.relations.length} relations`,
    args._meta
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
    `Opened ${result.entities.length} entities and found ${result.relations.length} relations`,
    args._meta
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

  return createMCPToolResponse(result, `Created ${created.length} relations successfully`, args._meta);
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
    `Deleted ${validated.relations.length} relations successfully`,
    args._meta
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
    `Added observations to ${validated.updates.length} entities successfully`,
    args._meta
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
    `Deleted observations from ${validated.deletions.length} entities successfully`,
    args._meta
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
    `Deleted ${validated.entityNames.length} entities successfully`,
    args._meta
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

  return createMCPToolResponse(result, `Transaction ${transactionId} started successfully`, args._meta);
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

  return createMCPToolResponse(result, 'Transaction committed successfully', args._meta);
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

  return createMCPToolResponse(result, 'Transaction rolled back successfully', args._meta);
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

  return createMCPToolResponse(result, `Backup created successfully at ${backupInfo.path}`, args._meta);
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
    `Database restored successfully from ${restoreInfo.backupPath}`,
    args._meta
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
    `Found ${result.entities.length} neighbors for "${validated.entityName}"`,
    args._meta
  );
}

export function handleFindShortestPath(args: any, ctx: ToolContext) {
  const validated = toolSchemas.find_shortest_path.parse(args) as FindShortestPathInput;
  const result = ctx.manager.findShortestPath(validated.from, validated.to, {
    bidirectional: validated.bidirectional !== false,
    relationType: validated.relationType,
    maxDepth: validated.maxDepth || 6,
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

  return createMCPToolResponse(response, message, args._meta);
}

// Privacy and security handlers
export function handleGetPrivacyStats(args: any, ctx: ToolContext) {
  toolSchemas.get_privacy_stats.parse(args); // Validate empty object
  const stats = ctx.manager.getPrivacyStats();
  const duration = performance.now() - ctx.startTime;

  const result = {
    ...stats,
    performance: { duration: `${duration.toFixed(2)}ms` },
  };

  return createMCPToolResponse(result, 'Privacy statistics retrieved successfully', args._meta);
}

export function handleGetPrivacyConfig(args: any, ctx: ToolContext) {
  toolSchemas.get_privacy_config.parse(args); // Validate empty object
  const config = ctx.manager.getPrivacyConfig();
  const duration = performance.now() - ctx.startTime;

  const result = {
    config,
    performance: { duration: `${duration.toFixed(2)}ms` },
  };

  return createMCPToolResponse(result, 'Privacy configuration retrieved successfully', args._meta);
}

export function handleUpdatePrivacyConfig(args: any, ctx: ToolContext) {
  const validated = toolSchemas.update_privacy_config.parse(args) as UpdatePrivacyConfigInput;
  ctx.manager.updatePrivacyConfig(validated.config);
  const duration = performance.now() - ctx.startTime;

  const result = {
    success: true,
    message: 'Privacy configuration updated successfully',
    performance: { duration: `${duration.toFixed(2)}ms` },
  };

  return createMCPToolResponse(result, 'Privacy configuration updated successfully', args._meta);
}

export function handleCheckAccess(args: any, ctx: ToolContext) {
  const validated = toolSchemas.check_access.parse(args) as CheckAccessInput;
  const hasAccess = ctx.manager.checkAccess(validated.userId, validated.operation, validated.context);
  const duration = performance.now() - ctx.startTime;

  const result = {
    hasAccess,
    userId: validated.userId,
    operation: validated.operation,
    context: validated.context,
    performance: { duration: `${duration.toFixed(2)}ms` },
  };

  const message = hasAccess
    ? `Access granted for user ${validated.userId} to ${validated.operation} in ${validated.context}`
    : `Access denied for user ${validated.userId} to ${validated.operation} in ${validated.context}`;

  return createMCPToolResponse(result, message, args._meta);
}

export function handleSetAccessControl(args: any, ctx: ToolContext) {
  const validated = toolSchemas.set_access_control.parse(args) as SetAccessControlInput;
  ctx.manager.setAccessControl(validated.userId, validated.permissions, validated.contexts, validated.expiresAt);
  const duration = performance.now() - ctx.startTime;

  const result = {
    success: true,
    userId: validated.userId,
    permissions: validated.permissions,
    contexts: validated.contexts,
    expiresAt: validated.expiresAt,
    performance: { duration: `${duration.toFixed(2)}ms` },
  };

  return createMCPToolResponse(result, `Access control set for user ${validated.userId}`, args._meta);
}

export function handleRemoveAccessControl(args: any, ctx: ToolContext) {
  const validated = toolSchemas.remove_access_control.parse(args) as RemoveAccessControlInput;
  ctx.manager.removeAccessControl(validated.userId);
  const duration = performance.now() - ctx.startTime;

  const result = {
    success: true,
    userId: validated.userId,
    performance: { duration: `${duration.toFixed(2)}ms` },
  };

  return createMCPToolResponse(result, `Access control removed for user ${validated.userId}`, args._meta);
}

export function handleUnlockAccount(args: any, ctx: ToolContext) {
  const validated = toolSchemas.unlock_account.parse(args) as UnlockAccountInput;
  ctx.manager.unlockAccount(validated.userId);
  const duration = performance.now() - ctx.startTime;

  const result = {
    success: true,
    userId: validated.userId,
    performance: { duration: `${duration.toFixed(2)}ms` },
  };

  return createMCPToolResponse(result, `Account unlocked for user ${validated.userId}`, args._meta);
}

export function handleCheckCompliance(args: any, ctx: ToolContext) {
  toolSchemas.check_compliance.parse(args); // Validate empty object
  const compliance = ctx.manager.checkCompliance();
  const duration = performance.now() - ctx.startTime;

  const result = {
    compliance,
    performance: { duration: `${duration.toFixed(2)}ms` },
  };

  return createMCPToolResponse(result, 'Compliance status checked successfully', args._meta);
}

export function handleApplyRetentionPolicy(args: any, ctx: ToolContext) {
  toolSchemas.apply_retention_policy.parse(args); // Validate empty object
  const result = ctx.manager.applyRetentionPolicy();
  const duration = performance.now() - ctx.startTime;

  const response = {
    ...result,
    performance: { duration: `${duration.toFixed(2)}ms` },
  };

  const message = `Retention policy applied: ${result.deletedCount} items deleted, ${result.errors.length} errors`;

  return createMCPToolResponse(response, message, args._meta);
}

export function handleCleanupAuditLogs(args: any, ctx: ToolContext) {
  toolSchemas.cleanup_audit_logs.parse(args); // Validate empty object
  const result = ctx.manager.cleanupAuditLogs();
  const duration = performance.now() - ctx.startTime;

  const response = {
    ...result,
    performance: { duration: `${duration.toFixed(2)}ms` },
  };

  const message = `Audit logs cleaned up: ${result.deletedCount} entries deleted`;

  return createMCPToolResponse(response, message, args._meta);
}

export function handleEncryptData(args: any, ctx: ToolContext) {
  const validated = toolSchemas.encrypt_data.parse(args) as EncryptDataInput;
  const encryptedData = ctx.manager.encryptData(validated.data);
  const duration = performance.now() - ctx.startTime;

  const result = {
    encryptedData,
    originalLength: validated.data.length,
    encryptedLength: encryptedData.length,
    performance: { duration: `${duration.toFixed(2)}ms` },
  };

  return createMCPToolResponse(result, 'Data encrypted successfully', args._meta);
}

export function handleDecryptData(args: any, ctx: ToolContext) {
  const validated = toolSchemas.decrypt_data.parse(args) as DecryptDataInput;
  const decryptedData = ctx.manager.decryptData(validated.encryptedData);
  const duration = performance.now() - ctx.startTime;

  const result = {
    decryptedData,
    encryptedLength: validated.encryptedData.length,
    decryptedLength: decryptedData.length,
    performance: { duration: `${duration.toFixed(2)}ms` },
  };

  return createMCPToolResponse(result, 'Data decrypted successfully', args._meta);
}

export function handleAnonymizeData(args: any, ctx: ToolContext) {
  const validated = toolSchemas.anonymize_data.parse(args) as AnonymizeDataInput;
  const anonymizedData = ctx.manager.anonymizeData(validated.data, validated.level);
  const duration = performance.now() - ctx.startTime;

  const result = {
    anonymizedData,
    anonymizationLevel: validated.level,
    performance: { duration: `${duration.toFixed(2)}ms` },
  };

  return createMCPToolResponse(result, `Data anonymized with level: ${validated.level}`, args._meta);
}

export function handleValidateInput(args: any, ctx: ToolContext) {
  const validated = toolSchemas.validate_input.parse(args) as ValidateInputInput;
  const result = ctx.manager.validateInput(validated.data);
  const duration = performance.now() - ctx.startTime;

  const response = {
    ...result,
    performance: { duration: `${duration.toFixed(2)}ms` },
  };

  const message = result.isValid
    ? 'Input validation passed'
    : `Input validation failed: ${result.errors.join(', ')}`;

  return createMCPToolResponse(response, message, args._meta);
}

export function handleSanitizeOutput(args: any, ctx: ToolContext) {
  const validated = toolSchemas.sanitize_output.parse(args) as SanitizeOutputInput;
  const sanitizedData = ctx.manager.sanitizeOutput(validated.data);
  const duration = performance.now() - ctx.startTime;

  const result = {
    sanitizedData,
    performance: { duration: `${duration.toFixed(2)}ms` },
  };

  return createMCPToolResponse(result, 'Output sanitized successfully', args._meta);
}

// Context-aware search handlers
export function handleSearchNodesContextAware(args: any, ctx: ToolContext) {
  const validated = toolSchemas.search_nodes_context_aware.parse(args) as any;
  const results = ctx.manager.searchNodesContextAware(validated);
  const duration = performance.now() - ctx.startTime;

  const result = {
    ...results,
    performance: {
      duration: `${duration.toFixed(2)}ms`,
      resultCount: results.entities.length,
      suggestionsCount: results.suggestions.length,
      intentConfidence: results.intent.confidence,
    },
  };

  return createMCPToolResponse(
    result,
    `Found ${results.entities.length} entities matching "${validated.query}" with ${results.suggestions.length} suggestions`,
    args._meta
  );
}

export function handleSearchRelatedEntities(args: any, ctx: ToolContext) {
  const validated = toolSchemas.search_related_entities.parse(args) as any;
  const results = ctx.manager.searchRelatedEntities(validated.entityName, {
    limit: validated.limit,
    relationTypes: validated.relationTypes,
    searchContext: validated.searchContext,
  });
  const duration = performance.now() - ctx.startTime;

  const result = {
    ...results,
    performance: {
      duration: `${duration.toFixed(2)}ms`,
      resultCount: results.entities.length,
      relationCount: results.relations.length,
    },
  };

  return createMCPToolResponse(
    result,
    `Found ${results.entities.length} entities related to "${validated.entityName}"`,
    args._meta
  );
}

// System resilience handlers
export function handleGetResilienceStats(args: any, ctx: ToolContext) {
  toolSchemas.get_resilience_stats.parse(args); // Validate empty object
  const stats = ctx.manager.getResilienceStats();
  const duration = performance.now() - ctx.startTime;

  const result = {
    ...stats,
    performance: { duration: `${duration.toFixed(2)}ms` },
  };

  return createMCPToolResponse(result, 'Resilience statistics retrieved successfully', args._meta);
}

export function handleGetTransactionLogs(args: any, ctx: ToolContext) {
  const validated = toolSchemas.get_transaction_logs.parse(args) as GetTransactionLogsInput;
  const logs = ctx.manager.getTransactionLogs(validated.limit);
  const duration = performance.now() - ctx.startTime;

  const result = {
    logs,
    count: logs.length,
    performance: { duration: `${duration.toFixed(2)}ms` },
  };

  return createMCPToolResponse(result, `Retrieved ${logs.length} transaction logs`, args._meta);
}

export function handleGetRecoveryActions(args: any, ctx: ToolContext) {
  toolSchemas.get_recovery_actions.parse(args); // Validate empty object
  const actions = ctx.manager.getRecoveryActions();
  const duration = performance.now() - ctx.startTime;

  const result = {
    actions,
    count: actions.length,
    performance: { duration: `${duration.toFixed(2)}ms` },
  };

  return createMCPToolResponse(result, `Retrieved ${actions.length} recovery actions`, args._meta);
}

export async function handleDetectAndRepairCorruption(args: any, ctx: ToolContext) {
  toolSchemas.detect_and_repair_corruption.parse(args); // Validate empty object
  const repairs = await ctx.manager.detectAndRepairCorruption();
  const duration = performance.now() - ctx.startTime;

  const result = {
    repairs,
    count: repairs.length,
    performance: { duration: `${duration.toFixed(2)}ms` },
  };

  return createMCPToolResponse(result, `Detected and repaired ${repairs.length} corruption issues`, args._meta);
}

export function handleValidateDataIntegrity(args: any, ctx: ToolContext) {
  const validated = toolSchemas.validate_data_integrity.parse(args) as ValidateDataIntegrityInput;
  const integrityCheck = ctx.manager.validateDataIntegrity(validated.data, validated.expectedChecksum);
  const duration = performance.now() - ctx.startTime;

  const result = {
    ...integrityCheck,
    performance: { duration: `${duration.toFixed(2)}ms` },
  };

  return createMCPToolResponse(
    result,
    `Data integrity validation ${integrityCheck.isValid ? 'passed' : 'failed'}`,
    args._meta
  );
}

export function handleClearOldTransactionLogs(args: any, ctx: ToolContext) {
  const validated = toolSchemas.clear_old_transaction_logs.parse(args) as ClearOldTransactionLogsInput;
  ctx.manager.clearOldTransactionLogs(validated.olderThanDays);
  const duration = performance.now() - ctx.startTime;

  const result = {
    success: true,
    olderThanDays: validated.olderThanDays,
    performance: { duration: `${duration.toFixed(2)}ms` },
  };

  return createMCPToolResponse(result, 'Old transaction logs cleared successfully', args._meta);
}

export function handleCreateResilientBackup(args: any, ctx: ToolContext) {
  const validated = toolSchemas.create_resilient_backup.parse(args) as CreateResilientBackupInput;
  ctx.manager.createResilientBackup(validated.backupPath);
  const duration = performance.now() - ctx.startTime;

  const result = {
    success: true,
    backupPath: validated.backupPath,
    performance: { duration: `${duration.toFixed(2)}ms` },
  };

  return createMCPToolResponse(result, `Resilient backup created successfully at ${validated.backupPath}`, args._meta);
}

export function handleListFiles(args: any, ctx: ToolContext) {
  const { path: dirPath, pattern } = args;
  const baseDir = dirPath || process.cwd();
  let files: string[] = [];
  try {
    files = fs.readdirSync(baseDir);
  } catch (e) {
    return createMCPToolResponse({ error: 'Directory not found or inaccessible' }, 'Directory not found or inaccessible', args._meta);
  }
  // Filter files by pattern if provided
  let filtered = files;
  if (pattern) {
    filtered = files.filter(f => f.includes(pattern));
  }
  const resourceLinks = filtered.map((file) => {
    const filePath = path.join(baseDir, file);
    const stat = fs.statSync(filePath);
    return {
      type: 'resource_link',
      uri: 'file://' + filePath,
      title: file,
      description: stat.isDirectory() ? 'Directory' : 'File',
    };
  });
  const structuredContent = filtered.map((file) => {
    const filePath = path.join(baseDir, file);
    const stat = fs.statSync(filePath);
    return {
      name: file,
      path: filePath,
      isDirectory: stat.isDirectory(),
      size: stat.size,
      mtime: stat.mtime,
    };
  });
  return createMCPToolResponse({ resourceLinks, files: structuredContent }, `Listed ${filtered.length} files in ${baseDir}`, args._meta);
}

// Memory Export/Import Handlers
export async function handleExportMemory(args: any, ctx: ToolContext): Promise<MCPToolResponse> {
  const startTime = performance.now();

  // Check if manager is closed
  try {
    ctx.manager.getContextInfo();
  } catch (error) {
    const duration = performance.now() - startTime;
    const errorResult: ExportResult = {
      success: false,
      data: {} as MemoryExport,
      summary: {
        totalEntities: 0,
        totalRelations: 0,
        totalObservations: 0,
        contexts: [],
        size: 0,
      },
      duration,
      warnings: [error instanceof Error ? error.message : String(error)],
    };
    return createMCPToolResponse(errorResult);
  }
  
  // If a specific context is requested, check if it exists
  if (args.context) {
    const contextInfo = ctx.manager.getContextInfo();
    if (!Object.keys(contextInfo.contexts).includes(args.context)) {
      // Return success with empty data for non-existent context
      const emptyData: MemoryExport = {
        version: args.exportVersion || '3.0.0',
        exportDate: new Date().toISOString(),
        sourceServer: 'mem100x',
        sourceVersion: '3.0.0',
        metadata: {
          totalEntities: 0,
          totalRelations: 0,
          totalObservations: 0,
          contexts: [args.context],
          entityTypes: [],
          relationTypes: [],
        },
        contexts: {
          [args.context]: {
            name: args.context,
            entities: [],
            relations: [],
            metadata: {
              entityCount: 0,
              relationCount: 0,
              observationCount: 0,
            }
          }
        },
        checksum: ''
      };
      
      // Calculate checksum
      const dataString = JSON.stringify(emptyData, (key, value) =>
        key === 'checksum' ? undefined : value
      );
      emptyData.checksum = createHash('sha256').update(dataString).digest('hex');
      
      return createMCPToolResponse({
        success: true,
        data: emptyData,
        summary: {
          totalEntities: 0,
          totalRelations: 0,
          totalObservations: 0,
          contexts: [args.context],
          size: Buffer.byteLength(JSON.stringify(emptyData), 'utf8'),
        },
        duration: performance.now() - startTime,
        warnings: [],
      });
    }
  }

  // Parse and validate options
  const options: ExportOptions = {
    context: args.context,
    format: args.format || 'json',
    includeMetadata: args.includeMetadata !== false,
    includeObservations: args.includeObservations !== false,
    includeRelations: args.includeRelations === false ? false : true,
    filterByDate: args.filterByDate,
    filterByEntityType: args.filterByEntityType,
    exportVersion: args.exportVersion || '3.0.0',
    targetServer: args.targetServer,
    compressionLevel: args.compressionLevel || 6,
  };

  try {
    const exportData = await exportMemoryData(ctx.manager, options);
    const duration = performance.now() - startTime;

    // Calculate size
    const dataString = JSON.stringify(exportData);
    const size = Buffer.byteLength(dataString, 'utf8');

    const summary: any = {
      totalEntities: exportData.metadata.totalEntities,
      totalRelations: exportData.metadata.totalRelations,
      totalObservations: exportData.metadata.totalObservations,
      contexts: exportData.metadata.contexts,
      size,
    };
    
    // Add compression ratio if compression was used
    if (options.format === 'compressed') {
      const originalSize = JSON.stringify(exportData).length;
      summary.compressionRatio = originalSize / size;
    }

    let finalExportData: string | MemoryExport;
    const originalDataString = JSON.stringify(exportData);
    const originalSize = Buffer.byteLength(originalDataString, 'utf8');

    if (options.format === 'compressed') {
      const compressedBuffer = await gzipAsync(Buffer.from(originalDataString), { level: options.compressionLevel });
      finalExportData = compressedBuffer.toString('base64');
      summary.size = Buffer.byteLength(finalExportData, 'utf8');
      summary.compressionRatio = originalSize / summary.size;
    } else {
      finalExportData = exportData;
      summary.size = originalSize;
    }

    const result: ExportResult = {
      success: true,
      data: finalExportData,
      summary: summary,
      duration,
      warnings: [],
    };
    return createMCPToolResponse(result);
  } catch (error) {
    const duration = performance.now() - startTime;
    const errorResult: ExportResult = {
      success: false,
      data: {} as MemoryExport,
      summary: {
        totalEntities: 0,
        totalRelations: 0,
        totalObservations: 0,
        contexts: [],
        size: 0,
      },
      duration,
      warnings: [error instanceof Error ? error.message : String(error)],
    };
    return createMCPToolResponse(errorResult);
  }
}

export async function handleImportMemory(args: any, ctx: ToolContext): Promise<MCPToolResponse> {
  const startTime = performance.now();

  // Check if manager is closed
  try {
    ctx.manager.getContextInfo();
  } catch (error) {
    const duration = performance.now() - startTime;
    const errorResult: ImportResult = {
      success: false,
      summary: {
        entitiesImported: 0,
        entitiesSkipped: 0,
        entitiesUpdated: 0,
        relationsImported: 0,
        relationsSkipped: 0,
        observationsImported: 0,
        contextsCreated: 0,
        errors: [{ type: 'validation' as const, message: 'Manager is closed or unavailable' }]
      },
      details: {
        entityMapping: {},
        relationMapping: {},
        contextMapping: {}
      },
      warnings: ['Manager is closed or unavailable'],
      duration
    };
    return createMCPToolResponse(errorResult);
  }

  // Parse and validate options
  const options: ImportOptions = {
    context: args.context,
    importMode: args.importMode || 'merge',
    conflictResolution: args.conflictResolution || 'merge',
    validateBeforeImport: args.validateBeforeImport !== false,
    dryRun: args.dryRun || false,
    sourceVersion: args.sourceVersion,
    sourceServer: args.sourceServer,
    migrationOptions: args.migrationOptions,
    batchSize: args.batchSize || 1000,
    progressCallback: args.progressCallback !== false,
  };

  try {
    let importData: MemoryExport;

    // Handle compressed data
    if (typeof args.data === 'string' && args.data.startsWith('H4sI')) {
      const compressed = Buffer.from(args.data, 'base64');
      const decompressed = await gunzipAsync(compressed);
      importData = JSON.parse(decompressed.toString());
    } else {
      importData = args.data;
    }

    // Validate import data
    if (options.validateBeforeImport) {
      const validationResult = validateImportData(importData);
      if (!validationResult.valid) {
        // If the only error is empty contexts, treat as success
        if (validationResult.errors.length === 1 &&
            validationResult.errors[0].includes('No contexts found')) {
          const successResult: ImportResult = {
            success: true,
            summary: {
              entitiesImported: 0,
              entitiesSkipped: 0,
              entitiesUpdated: 0,
              relationsImported: 0,
              relationsSkipped: 0,
              observationsImported: 0,
              contextsCreated: 0,
              errors: []
            },
            details: {
              entityMapping: {},
              relationMapping: {},
              contextMapping: {}
            },
            warnings: validationResult.errors,
            duration: 0
          };
          return createMCPToolResponse(successResult);
        }

        const errorResult: ImportResult & { error?: string, validationErrors?: string[] } = {
          success: false,
          error: 'Invalid import data',
          validationErrors: validationResult.errors,
          summary: {
            entitiesImported: 0,
            entitiesSkipped: 0,
            entitiesUpdated: 0,
            relationsImported: 0,
            relationsSkipped: 0,
            observationsImported: 0,
            contextsCreated: 0,
            errors: validationResult.errors.map(msg => ({ type: 'validation' as const, message: msg }))
          },
          details: {
            entityMapping: {},
            relationMapping: {},
            contextMapping: {}
          },
          warnings: validationResult.errors,
          duration: 0
        };
        return createMCPToolResponse(errorResult);
      }
    }
    
    

    try {
      const importResult = await importMemoryData(ctx.manager, importData, options);
      const duration = performance.now() - startTime;
      const result: ImportResult = { ...importResult, duration, warnings: importResult.warnings || [] };
      return createMCPToolResponse(result);
    } catch (error) {
      const duration = performance.now() - startTime;
      const errorResult: ImportResult = {
        success: false,
        summary: {
          entitiesImported: 0,
          entitiesSkipped: 0,
          entitiesUpdated: 0,
          relationsImported: 0,
          relationsSkipped: 0,
          observationsImported: 0,
          contextsCreated: 0,
          errors: [{ type: 'validation' as const, message: error instanceof Error ? error.message : String(error) }]
        },
        details: {
          entityMapping: {},
          relationMapping: {},
          contextMapping: {}
        },
        warnings: [error instanceof Error ? error.message : String(error)],
        duration
      };
      return createMCPToolResponse(errorResult);
    }

  } catch (error) {
    const duration = performance.now() - startTime;
    const errorResult: ImportResult = {
      success: false,
      summary: {
        entitiesImported: 0,
        entitiesSkipped: 0,
        entitiesUpdated: 0,
        relationsImported: 0,
        relationsSkipped: 0,
        observationsImported: 0,
        contextsCreated: 0,
        errors: [{ type: 'validation' as const, message: error instanceof Error ? error.message : String(error) }]
      },
      details: {
        entityMapping: {},
        relationMapping: {},
        contextMapping: {}
      },
      warnings: [error instanceof Error ? error.message : String(error)],
      duration
    };
    return createMCPToolResponse(errorResult);
  }
}

// Helper functions for export/import
async function exportMemoryData(manager: MultiDatabaseManager, options: ExportOptions): Promise<MemoryExport> {
  const contexts = options.context ? [options.context] : Object.keys(manager.getContextInfo().contexts);
  const exportData: MemoryExport = {
    version: options.exportVersion,
    exportDate: new Date().toISOString(),
    sourceServer: 'mem100x',
    sourceVersion: '3.0.0',
    metadata: {
      totalEntities: 0,
      totalRelations: 0,
      totalObservations: 0,
      contexts: [],
      entityTypes: [],
      relationTypes: [],
    },
    contexts: {},
    checksum: '',
  };

  const allEntityTypes = new Set<string>();
  const allRelationTypes = new Set<string>();

  for (const contextName of contexts) {
    try {
      const contextData = await exportContext(manager, contextName, options);
      exportData.contexts[contextName] = contextData;

      exportData.metadata.totalEntities += contextData.metadata.entityCount;
      exportData.metadata.totalRelations += contextData.metadata.relationCount;
      exportData.metadata.totalObservations += contextData.metadata.observationCount;
      exportData.metadata.contexts.push(contextName);

      // Collect entity and relation types
      contextData.entities.forEach(entity => allEntityTypes.add(entity.entityType));
      contextData.relations.forEach(relation => allRelationTypes.add(relation.relationType));
    } catch (error: any) {
      // Check if this is a database error (not just invalid context)
      if (error.message && (error.message.includes('database') || error.message.includes('sqlite') || 
          error.message.includes('SQLITE') || error.message.includes('file is not a database'))) {
        // Re-throw database errors to be handled at a higher level
        throw error;
      }
      // If context doesn't exist or has other issues, create an empty context export
      const emptyContextData: ContextExport = {
        name: contextName,
        entities: [],
        relations: [],
        metadata: {
          entityCount: 0,
          relationCount: 0,
          observationCount: 0,
        },
      };
      exportData.contexts[contextName] = emptyContextData;
      exportData.metadata.contexts.push(contextName);
    }
  }

  exportData.metadata.entityTypes = Array.from(allEntityTypes);
  exportData.metadata.relationTypes = Array.from(allRelationTypes);

  // Calculate checksum
  const dataString = JSON.stringify(exportData, (key, value) =>
    key === 'checksum' ? undefined : value
  );
  exportData.checksum = createHash('sha256').update(dataString).digest('hex');

  return exportData;
}

async function exportContext(manager: MultiDatabaseManager, contextName: string, options: ExportOptions): Promise<ContextExport> {
  // Get all entities and relations using readGraph with specific context
  let graph;
  try {
    graph = manager.readGraph(undefined, 0, contextName);
  } catch (error: any) {
    // Only return empty context if error is 'Invalid context', otherwise re-throw
    if (typeof error.message === 'string' && error.message.includes('Invalid context')) {
      return {
        name: contextName,
        entities: [],
        relations: [],
        metadata: {
          entityCount: 0,
          relationCount: 0,
          observationCount: 0,
        },
      };
    }
    throw error;
  }

  // Filter entities if needed
  let filteredEntities = graph.entities;
  if (options.filterByDate) {
    filteredEntities = graph.entities.filter((entity: any) => {
      const createdAt = new Date(entity.created_at || Date.now());
      const from = options.filterByDate!.from ? new Date(options.filterByDate!.from) : null;
      const to = options.filterByDate!.to ? new Date(options.filterByDate!.to) : null;

      if (from && createdAt < from) return false;
      if (to && createdAt > to) return false;
      return true;
    });
  }

  if (options.filterByEntityType && options.filterByEntityType.length > 0) {
    filteredEntities = filteredEntities.filter((entity: any) =>
      options.filterByEntityType!.includes(entity.entityType)
    );
  }

  // Convert to export format
  const exportEntities: EntityExport[] = filteredEntities.map((entity: any) => {
    return {
      id: entity.name, // Use name as ID for compatibility
      name: entity.name,
      entityType: entity.entityType,
      content: options.includeObservations ? entity.observations : [],
      metadata: options.includeMetadata ? {
        createdAt: new Date(entity.created_at || Date.now()).toISOString(),
        updatedAt: new Date(entity.updated_at || Date.now()).toISOString(),
        prominence: entity.prominence_score || 1.0,
        accessCount: entity.access_count || 0,
        lastAccessed: new Date(entity.last_accessed || Date.now()).toISOString(),
      } : undefined,
    };
  });

  // Create a mapping from lowercase entity names to original case
  const entityNameMap = new Map<string, string>();
  for (const entity of graph.entities) {
    entityNameMap.set(entity.name.toLowerCase(), entity.name);
  }

  // Filter relations to only include those between filtered entities
  const filteredEntityNames = new Set(filteredEntities.map((e: any) => e.name.toLowerCase()));
  // Explicitly check for false to ensure we don't export relations when requested
  const exportRelations: RelationExport[] = (options.includeRelations === false) ? [] : graph.relations
    .filter((relation: any) => {
      // Normalize case for comparison
      const fromNormalized = relation.from.toLowerCase();
      const toNormalized = relation.to.toLowerCase();
      return filteredEntityNames.has(fromNormalized) && filteredEntityNames.has(toNormalized);
    })
    .map((relation: any) => ({
      id: relation.id?.toString() || `${relation.from}-${relation.to}-${relation.relationType}`,
      from: entityNameMap.get(relation.from.toLowerCase()) || relation.from,
      to: entityNameMap.get(relation.to.toLowerCase()) || relation.to,
      relationType: relation.relationType,
      metadata: options.includeMetadata ? {
        createdAt: new Date(relation.created_at || Date.now()).toISOString(),
        strength: relation.prominence_score || 1.0,
        confidence: relation.confidence_score || 1.0,
      } : undefined,
    }));

  return {
    name: contextName,
    entities: exportEntities,
    relations: exportRelations,
    metadata: {
      entityCount: exportEntities.length,
      relationCount: exportRelations.length,
      observationCount: exportEntities.reduce((sum, entity) => sum + entity.content.length, 0),
    },
  };
}

async function importMemoryData(manager: MultiDatabaseManager, importData: MemoryExport, options: ImportOptions): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    summary: {
      entitiesImported: 0,
      entitiesSkipped: 0,
      entitiesUpdated: 0,
      relationsImported: 0,
      relationsSkipped: 0,
      observationsImported: 0,
      contextsCreated: 0,
      errors: [],
    },
    details: {
      entityMapping: {},
      relationMapping: {},
      contextMapping: {},
    },
    warnings: [],
    duration: 0,
  };

  // Validate checksum if present
  if (importData.checksum) {
    const dataString = JSON.stringify(importData, (key, value) =>
      key === 'checksum' ? undefined : value
    );
    const expectedChecksum = createHash('sha256').update(dataString).digest('hex');
    if (importData.checksum !== expectedChecksum) {
      result.summary.errors.push({
        type: 'validation',
        message: 'Checksum validation failed',
      });
      result.success = false;
      return result;
    }
  }

  // Process each context
  if (!importData.contexts || typeof importData.contexts !== 'object') {
    // This case should ideally be caught by validateImportData, but as a safeguard
    // or for empty but valid imports, we should not proceed with iteration.
    return result;
  }

  for (const [contextName, contextData] of Object.entries(importData.contexts)) {
    try {
      const targetContext = options.context || contextName;

      // Create context if it doesn't exist
      if (!manager.getDatabase(targetContext)) {
        await manager.createContext(targetContext);
        result.summary.contextsCreated++;
      }

      const contextResult = await importContext(
        manager,
        targetContext,
        contextData,
        options
      );

      // Merge results
      result.summary.entitiesImported += contextResult.entitiesImported;
      result.summary.entitiesSkipped += contextResult.entitiesSkipped;
      result.summary.entitiesUpdated += contextResult.entitiesUpdated;
      result.summary.relationsImported += contextResult.relationsImported;
      result.summary.relationsSkipped += contextResult.relationsSkipped;
      result.summary.observationsImported += contextResult.observationsImported;
      result.details.entityMapping = { ...result.details.entityMapping, ...contextResult.entityMapping };
      result.details.relationMapping = { ...result.details.relationMapping, ...contextResult.relationMapping };
      result.details.contextMapping[contextName] = targetContext;

    } catch (error) {
      result.summary.errors.push({
        type: 'context',
        message: error instanceof Error ? error.message : String(error),
        data: { contextName },
      });
    }
  }

  return result;
}

async function importContext(
  manager: MultiDatabaseManager,
  targetContext: string,
  contextData: ContextExport,
  options: ImportOptions
): Promise<{
  entitiesImported: number;
  entitiesSkipped: number;
  entitiesUpdated: number;
  relationsImported: number;
  relationsSkipped: number;
  observationsImported: number;
  entityMapping: Record<string, string>;
  relationMapping: Record<string, string>;
}> {
  const result = {
    entitiesImported: 0,
    entitiesSkipped: 0,
    entitiesUpdated: 0,
    relationsImported: 0,
    relationsSkipped: 0,
    observationsImported: 0,
    entityMapping: {} as Record<string, string>,
    relationMapping: {} as Record<string, string>,
  };

  // Import entities
  for (const entity of contextData.entities) {
    try {
      // Validate entity has a name
      if (!entity.name || typeof entity.name !== 'string') {
        result.entitiesSkipped++;
        continue;
      }
      
      // Support both 'content' and 'observations' fields for backward compatibility
      if (!entity.content && (entity as any).observations) {
        entity.content = (entity as any).observations;
      }
      
      // Ensure content is an array
      if (!entity.content || !Array.isArray(entity.content)) {
        entity.content = [];
      }
      
      const existingEntity = manager.getEntity(entity.name, targetContext);

      if (existingEntity) {
        switch (options.conflictResolution) {
          case 'skip':
            result.entitiesSkipped++;
            continue;
          case 'overwrite':
            if (!options.dryRun) {
              manager.deleteEntities([entity.name], targetContext);
            }
            break;
          case 'rename':
            entity.name = `${entity.name}_imported_${Date.now()}`;
            break;
          case 'merge':
            // Merge observations by recreating the entity with combined content
            if (!options.dryRun) {
              const existingObservations = existingEntity.observations;
              const newObservations = entity.content;
              const mergedObservations = [...existingObservations, ...newObservations];

              // Delete and recreate the entity with merged observations
              manager.deleteEntities([entity.name], targetContext);
              manager.createEntities([{
                name: entity.name,
                entityType: entity.entityType,
                observations: mergedObservations
              }], targetContext);
            }
            result.entitiesUpdated++;
            continue;
        }
      }

      if (!options.dryRun) {
        manager.createEntities([{
          name: entity.name,
          entityType: entity.entityType,
          observations: entity.content
        }], targetContext);
        result.entitiesImported++;
        result.observationsImported += entity.content.length;
      } else {
        // For dry run, don't count anything as imported
        // The counters should remain 0 for dry run
      }

      result.entityMapping[entity.id || entity.name] = entity.name;

    } catch (error) {
      // Continue with other entities
      console.error(`Failed to import entity ${entity.name}:`, error);
    }
  }

  // Import relations
  for (const relation of contextData.relations) {
    try {
      const fromEntity = result.entityMapping[relation.from] || relation.from;
      const toEntity = result.entityMapping[relation.to] || relation.to;

      // Check if both entities exist
      const fromExists = manager.getEntity(fromEntity, targetContext);
      const toExists = manager.getEntity(toEntity, targetContext);

      if (!fromExists || !toExists) {
        result.relationsSkipped++;
        continue;
      }

      if (!options.dryRun) {
        manager.createRelations([{
          from: fromEntity,
          to: toEntity,
          relationType: relation.relationType
        }], targetContext);
        result.relationsImported++;
      } else {
        // For dry run, don't count anything as imported
        // The counters should remain 0 for dry run
      }

      result.relationMapping[relation.id || `${relation.from}-${relation.to}-${relation.relationType}`] =
        `${fromEntity}-${toEntity}-${relation.relationType}`;

    } catch (error) {
      // Continue with other relations
      console.error(`Failed to import relation ${relation.from} -> ${relation.to}:`, error);
    }
  }

  return result;
}

function validateImportData(importData: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Basic structure validation
  if (!importData) {
    errors.push('Import data is null or undefined');
    return { valid: false, errors };
  }

  if (typeof importData !== 'object') {
    errors.push('Import data must be an object');
    return { valid: false, errors };
  }

  // Check for contexts field - this is the most important
  if (!importData.contexts) {
    errors.push('Missing contexts field');
  } else if (importData.contexts === null) {
    errors.push('Contexts field cannot be null');
  } else if (typeof importData.contexts !== 'object') {
    errors.push('Contexts field must be an object');
  } else if (Array.isArray(importData.contexts)) {
    // Handle array format for backward compatibility
    if (importData.contexts.length === 0) {
      errors.push('No contexts found');
    }
  } else {
    // Object format - check if it's empty
    const contextKeys = Object.keys(importData.contexts);
    if (contextKeys.length === 0) {
      // Empty contexts object is valid - don't add an error
      // Will be handled specially below
    }
  }

  // Optional fields - only validate if present
  if (importData.version && typeof importData.version !== 'string') {
    errors.push('Version field must be a string');
  }

  if (importData.exportDate && typeof importData.exportDate !== 'string') {
    errors.push('ExportDate field must be a string');
  }

  if (importData.sourceServer && typeof importData.sourceServer !== 'string') {
    errors.push('SourceServer field must be a string');
  }

  if (importData.metadata && typeof importData.metadata !== 'object') {
    errors.push('Metadata field must be an object');
  }

  // Validate context data structure if contexts is an object
  if (importData.contexts && typeof importData.contexts === 'object' && !Array.isArray(importData.contexts)) {
    // Check if contexts object is empty
    if (Object.keys(importData.contexts).length === 0) {
      // Empty contexts object is valid - this is a valid import with no data
      return { valid: true, errors: [] };
    }

    for (const [contextName, contextData] of Object.entries(importData.contexts)) {
      if (!contextData || typeof contextData !== 'object') {
        errors.push(`Invalid context data for ${contextName}`);
        continue;
      }

      if (!Array.isArray((contextData as any).entities)) {
        errors.push(`Invalid entities array for context ${contextName}`);
      }
      if (!Array.isArray((contextData as any).relations)) {
        errors.push(`Invalid relations array for context ${contextName}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Tool handler registry
export const toolHandlers: Record<string, (args: any, ctx: ToolContext) => any> = {
  // Context management
  set_context: handleSetContext,
  get_context_info: handleGetContextInfo,
  create_context: handleCreateContext,
  delete_context: handleDeleteContext,
  update_context: handleUpdateContext,
  list_contexts: handleListContexts,

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

  // Context-aware search
  search_nodes_context_aware: handleSearchNodesContextAware,
  search_related_entities: handleSearchRelatedEntities,

  // System resilience
  get_resilience_stats: handleGetResilienceStats,
  get_transaction_logs: handleGetTransactionLogs,
  get_recovery_actions: handleGetRecoveryActions,
  detect_and_repair_corruption: handleDetectAndRepairCorruption,
  validate_data_integrity: handleValidateDataIntegrity,
  clear_old_transaction_logs: handleClearOldTransactionLogs,
  create_resilient_backup: handleCreateResilientBackup,
  list_files: handleListFiles,
  export_memory: handleExportMemory,
  import_memory: handleImportMemory,

  // Privacy and security handlers
  get_privacy_stats: handleGetPrivacyStats,
  get_privacy_config: handleGetPrivacyConfig,
  update_privacy_config: handleUpdatePrivacyConfig,
  check_access: handleCheckAccess,
  set_access_control: handleSetAccessControl,
  remove_access_control: handleRemoveAccessControl,
  unlock_account: handleUnlockAccount,
  check_compliance: handleCheckCompliance,
  apply_retention_policy: handleApplyRetentionPolicy,
  cleanup_audit_logs: handleCleanupAuditLogs,
  encrypt_data: handleEncryptData,
  decrypt_data: handleDecryptData,
  anonymize_data: handleAnonymizeData,
  validate_input: handleValidateInput,
  sanitize_output: handleSanitizeOutput,
};
