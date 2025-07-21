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
import { createMCPToolResponse } from './mcp-types.js'
import { createTextContent } from './utils/fast-json.js'

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

  return createMCPToolResponse(result, message);
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

  return createMCPToolResponse(result, message);
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

  return createMCPToolResponse(result, message);
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

  return createMCPToolResponse(result, `Retrieved ${contexts.length} contexts`);
}

// Entity operation handlers
export function handleCreateEntities(args: any, ctx: ToolContext) {
  // Debug: print raw args
  process.stderr.write('DEBUG: handleCreateEntities raw args: ' + JSON.stringify(args) + '\n');
  // Direct Zod validation for failing test case
  try {
    const testInput = { entities: [{ name: 'MissingType', content: [] }] };
    toolSchemas.create_entities.parse(testInput);
    process.stderr.write('DEBUG: Zod validation for testInput PASSED (should not pass)\n');
  } catch (e) {
    process.stderr.write('DEBUG: Zod validation for testInput ERROR: ' + String(e) + '\n');
  }
  try {
    // Validate raw input first to catch missing required fields
    toolSchemas.create_entities.parse(args);
    process.stderr.write('DEBUG: Zod validation passed\n');
  } catch (e) {
    process.stderr.write('DEBUG: Zod validation error: ' + String(e) + '\n');
    throw e;
  }
  // Map MCP-standard 'content' to internal 'observations' and pass through ranking fields
  const entities = args.entities.map((entity: any) => ({
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
    `Created ${entities.length} entities successfully`
  );
}

export function handleSearchNodes(args: any, ctx: ToolContext) {
  const validated = toolSchemas.search_nodes.parse(args) as SearchNodesInput;
  const results = ctx.manager.searchNodes(validated);
  // Return the raw result object directly
  return results;
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

// Privacy and security handlers
export function handleGetPrivacyStats(args: any, ctx: ToolContext) {
  toolSchemas.get_privacy_stats.parse(args); // Validate empty object
  const stats = ctx.manager.getPrivacyStats();
  const duration = performance.now() - ctx.startTime;

  const result = {
    ...stats,
    performance: { duration: `${duration.toFixed(2)}ms` },
  };

  return createMCPToolResponse(result, 'Privacy statistics retrieved successfully');
}

export function handleGetPrivacyConfig(args: any, ctx: ToolContext) {
  toolSchemas.get_privacy_config.parse(args); // Validate empty object
  const config = ctx.manager.getPrivacyConfig();
  const duration = performance.now() - ctx.startTime;

  const result = {
    config,
    performance: { duration: `${duration.toFixed(2)}ms` },
  };

  return createMCPToolResponse(result, 'Privacy configuration retrieved successfully');
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

  return createMCPToolResponse(result, 'Privacy configuration updated successfully');
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

  return createMCPToolResponse(result, message);
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

  return createMCPToolResponse(result, `Access control set for user ${validated.userId}`);
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

  return createMCPToolResponse(result, `Access control removed for user ${validated.userId}`);
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

  return createMCPToolResponse(result, `Account unlocked for user ${validated.userId}`);
}

export function handleCheckCompliance(args: any, ctx: ToolContext) {
  toolSchemas.check_compliance.parse(args); // Validate empty object
  const compliance = ctx.manager.checkCompliance();
  const duration = performance.now() - ctx.startTime;

  const result = {
    compliance,
    performance: { duration: `${duration.toFixed(2)}ms` },
  };

  return createMCPToolResponse(result, 'Compliance status checked successfully');
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

  return createMCPToolResponse(response, message);
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

  return createMCPToolResponse(response, message);
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

  return createMCPToolResponse(result, 'Data encrypted successfully');
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

  return createMCPToolResponse(result, 'Data decrypted successfully');
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

  return createMCPToolResponse(result, `Data anonymized with level: ${validated.level}`);
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

  return createMCPToolResponse(response, message);
}

export function handleSanitizeOutput(args: any, ctx: ToolContext) {
  const validated = toolSchemas.sanitize_output.parse(args) as SanitizeOutputInput;
  const sanitizedData = ctx.manager.sanitizeOutput(validated.data);
  const duration = performance.now() - ctx.startTime;

  const result = {
    sanitizedData,
    performance: { duration: `${duration.toFixed(2)}ms` },
  };

  return createMCPToolResponse(result, 'Output sanitized successfully');
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
    `Found ${results.entities.length} entities matching "${validated.query}" with ${results.suggestions.length} suggestions`
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
    `Found ${results.entities.length} entities related to "${validated.entityName}"`
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

  return createMCPToolResponse(result, 'Resilience statistics retrieved successfully');
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

  return createMCPToolResponse(result, `Retrieved ${logs.length} transaction logs`);
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

  return createMCPToolResponse(result, `Retrieved ${actions.length} recovery actions`);
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

  return createMCPToolResponse(result, `Detected and repaired ${repairs.length} corruption issues`);
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
    `Data integrity validation ${integrityCheck.isValid ? 'passed' : 'failed'}`
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

  return createMCPToolResponse(result, 'Old transaction logs cleared successfully');
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

  return createMCPToolResponse(result, `Resilient backup created successfully at ${validated.backupPath}`);
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
