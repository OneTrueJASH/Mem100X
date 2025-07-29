#!/usr/bin/env node

/**
 * Auto-generate API Reference from Zod Schemas and Tool Definitions
 *
 * This script reads the Zod schemas and tool definitions from the source code
 * and generates a comprehensive API reference document.
 *
 * Usage:
 *   node scripts/generate-api-reference.js
 *   npm run generate-api-reference
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  sourceFiles: {
    toolSchemas: 'src/tool-schemas.ts',
    toolDefinitions: 'src/tool-definitions.ts',
    toolHandlers: 'src/tool-handlers.ts'
  },
  outputFile: 'API_REFERENCE.md',
  templateFile: 'scripts/api-reference-template.md'
};

// Performance metrics from the codebase
const PERFORMANCE_METRICS = {
  entityCreation: '59,780+ entities/sec',
  relationCreation: '261,455+ relations/sec',
  searchPerformance: '8,829 searches/sec (88x faster with FTS5)'
};

// Rate limits from the codebase
const RATE_LIMITS = {
  readOperations: { limit: 1000, window: '1 minute' },
  writeOperations: { limit: 100, window: '1 minute' },
  searchOperations: { limit: 500, window: '1 minute' },
  contextOperations: { limit: 50, window: '1 minute' },
  systemOperations: { limit: 20, window: '1 minute' }
};

// Error codes from the codebase
const ERROR_CODES = {
  standard: [
    'InvalidParams',
    'MethodNotFound',
    'InternalError',
    'RateLimitExceeded',
    'AccessDenied',
    'DataCorruption',
    'ValidationError'
  ],
  destructive: [
    'ConfirmationRequired',
    'ContextNotEmpty'
  ],
  search: [
    'QueryTooLong',
    'InvalidSearchMode',
    'NoResults'
  ],
  transaction: [
    'TransactionInProgress',
    'NoActiveTransaction',
    'TransactionTimeout'
  ],
  backup: [
    'BackupFailed',
    'RestoreFailed',
    'InvalidBackupFormat',
    'BackupCorrupted'
  ]
};

// Tool categories for organization
const TOOL_CATEGORIES = {
  'Context Management': [
    'set_context',
    'get_context_info',
    'create_context',
    'delete_context',
    'update_context',
    'list_contexts'
  ],
  'Entity Operations': [
    'create_entities',
    'delete_entities'
  ],
  'Search Operations': [
    'search_nodes',
    'search_nodes_context_aware',
    'search_related_entities',
    'read_graph',
    'open_nodes'
  ],
  'Relation Operations': [
    'create_relations',
    'delete_relations'
  ],
  'Observation Operations': [
    'add_observations',
    'delete_observations'
  ],
  'Transaction Management': [
    'begin_transaction',
    'commit_transaction',
    'rollback_transaction'
  ],
  'Backup & Restore': [
    'create_backup',
    'restore_backup'
  ],
  'Graph Traversal': [
    'get_neighbors',
    'find_shortest_path'
  ],
  'System Resilience': [
    'get_resilience_stats',
    'get_transaction_logs',
    'get_recovery_actions',
    'detect_and_repair_corruption',
    'validate_data_integrity',
    'clear_old_transaction_logs',
    'create_resilient_backup'
  ],
  'Privacy & Security': [
    'get_privacy_stats',
    'get_privacy_config',
    'update_privacy_config',
    'check_access',
    'set_access_control',
    'remove_access_control',
    'unlock_account',
    'check_compliance',
    'apply_retention_policy',
    'cleanup_audit_logs',
    'encrypt_data',
    'decrypt_data',
    'anonymize_data',
    'validate_input',
    'sanitize_output'
  ],
  'Memory Export/Import': [
    'export_memory',
    'import_memory'
  ],
  'File Operations': [
    'list_files'
  ]
};

/**
 * Extract tool information from source files
 */
function extractToolInfo() {
  // Manual API definition based on actual tool schemas and definitions
  const toolInfo = {
    // Context Management
    set_context: {
      name: 'set_context',
      title: 'Set Context',
      description: 'Switch to a specific memory context (e.g., \'personal\' or \'work\')',
      parameters: {
        context: { type: 'string', required: true, description: 'The context to switch to' }
      }
    },

    get_context_info: {
      name: 'get_context_info',
      title: 'Get Context Info',
      description: 'Get information about available contexts and current state',
      parameters: {}
    },

    create_context: {
      name: 'create_context',
      title: 'Create Context',
      description: 'Create a new memory context for organizing different types of information (e.g., projects, hobbies, studies)',
      parameters: {
        name: { type: 'string', required: true, description: 'Name of the new context (lowercase letters, numbers, hyphens, underscores only)' },
        path: { type: 'string', required: false, description: 'Custom database path for the context' },
        patterns: { type: 'array', required: false, description: 'Patterns to match for automatic context detection' },
        entityTypes: { type: 'array', required: false, description: 'Entity types commonly found in this context' },
        description: { type: 'string', required: false, description: 'Human-readable description of the context' }
      }
    },

    delete_context: {
      name: 'delete_context',
      title: 'Delete Context',
      description: 'Delete a memory context and its associated database',
      parameters: {
        name: { type: 'string', required: true, description: 'Name of the context to delete' },
        force: { type: 'boolean', required: false, description: 'Force deletion even if context contains entities', defaultValue: false }
      }
    },

    update_context: {
      name: 'update_context',
      title: 'Update Context',
      description: 'Update the configuration of an existing memory context',
      parameters: {
        name: { type: 'string', required: true, description: 'Name of the context to update' },
        patterns: { type: 'array', required: false, description: 'New patterns for context detection' },
        entityTypes: { type: 'array', required: false, description: 'New entity types for this context' },
        description: { type: 'string', required: false, description: 'Updated description of the context' }
      }
    },

    list_contexts: {
      name: 'list_contexts',
      title: 'List Contexts',
      description: 'List all available memory contexts with their statistics and configuration',
      parameters: {}
    },

    // Entity Operations
    create_entities: {
      name: 'create_entities',
      title: 'Create Entities',
      description: 'Create multiple new entities in the knowledge graph. Performance: 59,780+ entities/sec',
      parameters: {
        entities: { type: 'array', required: true, description: 'Array of entities to create' },
        context: { type: 'string', required: false, description: 'Specific context to use' }
      }
    },

    delete_entities: {
      name: 'delete_entities',
      title: 'Delete Entities',
      description: 'Delete multiple entities and their associated relations from the knowledge graph',
      parameters: {
        entityNames: { type: 'array', required: true, description: 'Array of entity names to delete' }
      }
    },

    // Search Operations
    search_nodes: {
      name: 'search_nodes',
      title: 'Search Nodes',
      description: 'Search for nodes in the knowledge graph based on a query. Uses FTS5 for 88x faster performance (8,829 searches/sec) with context-aware ranking',
      parameters: {
        query: { type: 'string', required: true, description: 'The search query to match against entity names, types, and observation content' },
        limit: { type: 'number', required: false, description: 'Maximum number of results to return', defaultValue: 20 },
        context: { type: 'string', required: false, description: 'Optional: specific context to use (overrides auto-detection)' },
        allContexts: { type: 'boolean', required: false, description: 'Search all contexts', defaultValue: false },
        searchMode: { type: 'enum: exact, semantic, fuzzy, hybrid', required: false, description: 'Search mode for different query types', defaultValue: 'hybrid' },
        contentTypes: { type: 'array', required: false, description: 'Content types to search for' },
        intent: { type: 'enum: find, browse, explore, verify', required: false, description: 'Search intent for better result ranking' },
        searchContext: { type: 'object', required: false, description: 'Enhanced search context for context-aware search' }
      }
    },

    search_nodes_context_aware: {
      name: 'search_nodes_context_aware',
      title: 'Context-Aware Search',
      description: 'Enhanced context-aware search with semantic understanding, suggestions, and intent analysis',
      parameters: {
        query: { type: 'string', required: true, description: 'The search query to analyze and search for' },
        limit: { type: 'number', required: false, description: 'Maximum number of results to return', defaultValue: 20 },
        context: { type: 'string', required: false, description: 'Optional: specific context to use (overrides auto-detection)' },
        allContexts: { type: 'boolean', required: false, description: 'Search all contexts', defaultValue: false },
        searchMode: { type: 'enum: exact, semantic, fuzzy, hybrid', required: false, description: 'Search mode for different query types', defaultValue: 'hybrid' },
        contentTypes: { type: 'array', required: false, description: 'Content types to search for' },
        intent: { type: 'enum: find, browse, explore, verify', required: false, description: 'Search intent for better result ranking' },
        searchContext: { type: 'object', required: false, description: 'Enhanced search context for context-aware search' }
      }
    },

    search_related_entities: {
      name: 'search_related_entities',
      title: 'Search Related Entities',
      description: 'Find entities related to a specific entity',
      parameters: {
        entityName: { type: 'string', required: true, description: 'Entity name' },
        limit: { type: 'number', required: false, description: 'Maximum results', defaultValue: 10 },
        relationTypes: { type: 'array', required: false, description: 'Filter by relation types' },
        searchContext: { type: 'object', required: false, description: 'Search context' }
      }
    },

    read_graph: {
      name: 'read_graph',
      title: 'Read Graph',
      description: 'Read the entire knowledge graph with pagination support',
      parameters: {
        limit: { type: 'number', required: false, description: 'Optional: limit the number of entities returned for pagination' },
        offset: { type: 'number', required: false, description: 'Optional: offset for pagination', defaultValue: 0 },
        context: { type: 'string', required: false, description: 'Optional: specific context to use (overrides auto-detection)' }
      }
    },

    open_nodes: {
      name: 'open_nodes',
      title: 'Open Nodes',
      description: 'Open specific nodes in the knowledge graph by their names',
      parameters: {
        names: { type: 'array', required: true, description: 'An array of entity names to retrieve' },
        context: { type: 'string', required: false, description: 'Optional: specific context to use (overrides auto-detection)' }
      }
    },

    // Relation Operations
    create_relations: {
      name: 'create_relations',
      title: 'Create Relations',
      description: 'Create multiple new relations between entities in the knowledge graph. Performance: 261,455+ relations/sec',
      parameters: {
        relations: { type: 'array', required: true, description: 'Array of relations to create' }
      }
    },

    delete_relations: {
      name: 'delete_relations',
      title: 'Delete Relations',
      description: 'Delete multiple relations from the knowledge graph',
      parameters: {
        relations: { type: 'array', required: true, description: 'Array of relations to delete' }
      }
    },

    // Observation Operations
    add_observations: {
      name: 'add_observations',
      title: 'Add Observations',
      description: 'Add new observations to existing entities in the knowledge graph. Batched for performance',
      parameters: {
        updates: { type: 'array', required: true, description: 'Array of observation updates' }
      }
    },

    delete_observations: {
      name: 'delete_observations',
      title: 'Delete Observations',
      description: 'Delete observations from entities',
      parameters: {
        deletions: { type: 'array', required: true, description: 'Array of observation deletions' }
      }
    },

    // Transaction Management
    begin_transaction: {
      name: 'begin_transaction',
      title: 'Begin Transaction',
      description: 'Start a new transaction for atomic operations',
      parameters: {
        name: { type: 'string', required: false, description: 'Optional transaction name for debugging' }
      }
    },

    commit_transaction: {
      name: 'commit_transaction',
      title: 'Commit Transaction',
      description: 'Commit the current transaction',
      parameters: {}
    },

    rollback_transaction: {
      name: 'rollback_transaction',
      title: 'Rollback Transaction',
      description: 'Rollback the current transaction',
      parameters: {}
    },

    // Backup & Restore
    create_backup: {
      name: 'create_backup',
      title: 'Create Backup',
      description: 'Create a backup of the current context or all contexts',
      parameters: {
        backupPath: { type: 'string', required: false, description: 'Optional: Custom backup path' },
        context: { type: 'string', required: false, description: 'Optional: Specific context to backup' }
      }
    },

    restore_backup: {
      name: 'restore_backup',
      title: 'Restore Backup',
      description: 'Restore from a backup file',
      parameters: {
        backupPath: { type: 'string', required: true, description: 'Path to backup file' },
        context: { type: 'string', required: false, description: 'Context to restore to' },
        confirmRestore: { type: 'boolean', required: true, description: 'Must be true to confirm the restore operation' }
      }
    },

    // Graph Traversal
    get_neighbors: {
      name: 'get_neighbors',
      title: 'Get Neighbors',
      description: 'Get neighboring entities of a specific entity',
      parameters: {
        entityName: { type: 'string', required: true, description: 'Entity name' },
        direction: { type: 'enum: outgoing, incoming, both', required: false, description: 'Direction of relations to follow', defaultValue: 'both' },
        relationType: { type: 'string', required: false, description: 'Filter by specific relation type' },
        depth: { type: 'number', required: false, description: 'How many hops to traverse (1-5)', defaultValue: 1 },
        includeRelations: { type: 'boolean', required: false, description: 'Include relation details in response', defaultValue: true },
        context: { type: 'string', required: false, description: 'Specific context to search in' }
      }
    },

    find_shortest_path: {
      name: 'find_shortest_path',
      title: 'Find Shortest Path',
      description: 'Find the shortest path between two entities',
      parameters: {
        from: { type: 'string', required: true, description: 'Source entity name' },
        to: { type: 'string', required: true, description: 'Target entity name' },
        bidirectional: { type: 'boolean', required: false, description: 'Whether to follow relations in both directions', defaultValue: true },
        relationType: { type: 'string', required: false, description: 'Filter by specific relation type' },
        maxDepth: { type: 'number', required: false, description: 'Maximum depth to search (1-10)', defaultValue: 6 }
      }
    },

    // System Resilience
    get_resilience_stats: {
      name: 'get_resilience_stats',
      title: 'Get Resilience Stats',
      description: 'Get system resilience statistics',
      parameters: {}
    },

    get_transaction_logs: {
      name: 'get_transaction_logs',
      title: 'Get Transaction Logs',
      description: 'Get recent transaction logs',
      parameters: {
        limit: { type: 'number', required: false, description: 'Maximum logs', defaultValue: 100 }
      }
    },

    get_recovery_actions: {
      name: 'get_recovery_actions',
      title: 'Get Recovery Actions',
      description: 'Get available recovery actions',
      parameters: {}
    },

    detect_and_repair_corruption: {
      name: 'detect_and_repair_corruption',
      title: 'Detect and Repair Corruption',
      description: 'Detect and automatically repair data corruption',
      parameters: {}
    },

    validate_data_integrity: {
      name: 'validate_data_integrity',
      title: 'Validate Data Integrity',
      description: 'Validate data integrity using checksums',
      parameters: {
        data: { type: 'any', required: true, description: 'Data to validate' },
        expectedChecksum: { type: 'string', required: false, description: 'Expected checksum for validation' }
      }
    },

    clear_old_transaction_logs: {
      name: 'clear_old_transaction_logs',
      title: 'Clear Old Transaction Logs',
      description: 'Clear old transaction logs to free storage',
      parameters: {
        olderThanDays: { type: 'number', required: false, description: 'Clear logs older than days', defaultValue: 30 }
      }
    },

    create_resilient_backup: {
      name: 'create_resilient_backup',
      title: 'Create Resilient Backup',
      description: 'Create a resilient backup with integrity validation',
      parameters: {
        backupPath: { type: 'string', required: true, description: 'Backup file path' }
      }
    },

    // Privacy & Security
    get_privacy_stats: {
      name: 'get_privacy_stats',
      title: 'Get Privacy Stats',
      description: 'Get privacy and security statistics',
      parameters: {}
    },

    get_privacy_config: {
      name: 'get_privacy_config',
      title: 'Get Privacy Config',
      description: 'Get current privacy configuration',
      parameters: {}
    },

    update_privacy_config: {
      name: 'update_privacy_config',
      title: 'Update Privacy Config',
      description: 'Update privacy configuration settings',
      parameters: {
        config: { type: 'object', required: true, description: 'Privacy configuration to update' }
      }
    },

    check_access: {
      name: 'check_access',
      title: 'Check Access',
      description: 'Check user access permissions',
      parameters: {
        userId: { type: 'string', required: true, description: 'User ID' },
        operation: { type: 'string', required: true, description: 'Operation to check' },
        context: { type: 'string', required: true, description: 'Context to check' }
      }
    },

    set_access_control: {
      name: 'set_access_control',
      title: 'Set Access Control',
      description: 'Set access control permissions for a user',
      parameters: {
        userId: { type: 'string', required: true, description: 'User ID' },
        permissions: { type: 'array', required: true, description: 'Permissions to grant' },
        contexts: { type: 'array', required: true, description: 'Contexts to grant access to' },
        expiresAt: { type: 'string', required: false, description: 'Expiration date (ISO string)' }
      }
    },

    remove_access_control: {
      name: 'remove_access_control',
      title: 'Remove Access Control',
      description: 'Remove access control for a user',
      parameters: {
        userId: { type: 'string', required: true, description: 'User ID' }
      }
    },

    unlock_account: {
      name: 'unlock_account',
      title: 'Unlock Account',
      description: 'Unlock a locked user account',
      parameters: {
        userId: { type: 'string', required: true, description: 'User ID' }
      }
    },

    check_compliance: {
      name: 'check_compliance',
      title: 'Check Compliance',
      description: 'Check compliance status for regulations',
      parameters: {}
    },

    apply_retention_policy: {
      name: 'apply_retention_policy',
      title: 'Apply Retention Policy',
      description: 'Apply data retention policy',
      parameters: {}
    },

    cleanup_audit_logs: {
      name: 'cleanup_audit_logs',
      title: 'Cleanup Audit Logs',
      description: 'Clean up old audit log entries',
      parameters: {}
    },

    encrypt_data: {
      name: 'encrypt_data',
      title: 'Encrypt Data',
      description: 'Encrypt sensitive data',
      parameters: {
        data: { type: 'string', required: true, description: 'Data to encrypt' }
      }
    },

    decrypt_data: {
      name: 'decrypt_data',
      title: 'Decrypt Data',
      description: 'Decrypt previously encrypted data',
      parameters: {
        encryptedData: { type: 'string', required: true, description: 'Encrypted data to decrypt' }
      }
    },

    anonymize_data: {
      name: 'anonymize_data',
      title: 'Anonymize Data',
      description: 'Anonymize data for privacy protection',
      parameters: {
        data: { type: 'any', required: true, description: 'Data to anonymize' },
        level: { type: 'enum: none, partial, full', required: false, description: 'Anonymization level', defaultValue: 'partial' }
      }
    },

    validate_input: {
      name: 'validate_input',
      title: 'Validate Input',
      description: 'Validate input data for security threats',
      parameters: {
        data: { type: 'any', required: true, description: 'Data to validate' }
      }
    },

    sanitize_output: {
      name: 'sanitize_output',
      title: 'Sanitize Output',
      description: 'Sanitize output data to remove dangerous content',
      parameters: {
        data: { type: 'any', required: true, description: 'Data to sanitize' }
      }
    },

    // Memory Export/Import
    export_memory: {
      name: 'export_memory',
      title: 'Export Memory',
      description: 'Export all entities, relations, and observations as a versioned JSON stream for migration and backup',
      parameters: {
        context: { type: 'string', required: false, description: 'Optional: specific context to export (default: all contexts)' },
        format: { type: 'enum: json, jsonl, compressed', required: false, description: 'Export format', defaultValue: 'json' },
        includeMetadata: { type: 'boolean', required: false, description: 'Include metadata like creation dates, prominence scores, etc.', defaultValue: true },
        includeObservations: { type: 'boolean', required: false, description: 'Include entity observations and content', defaultValue: true },
        includeRelations: { type: 'boolean', required: false, description: 'Include entity relations', defaultValue: true },
        filterByDate: { type: 'object', required: false, description: 'Filter entities by date range' },
        filterByEntityType: { type: 'array', required: false, description: 'Filter by specific entity types' },
        exportVersion: { type: 'string', required: false, description: 'Export format version for compatibility', defaultValue: '3.0.0' },
        targetServer: { type: 'string', required: false, description: 'Target server type for migration (mem100x, generic, etc.)' },
        compressionLevel: { type: 'number', required: false, description: 'Compression level 0-9', defaultValue: 6 }
      }
    },

    import_memory: {
      name: 'import_memory',
      title: 'Import Memory',
      description: 'Import entities, relations, and observations from a versioned JSON stream',
      parameters: {
        data: { type: 'object', required: true, description: 'Import data' },
        mode: { type: 'enum: merge, replace, update, append', required: false, description: 'Import mode', defaultValue: 'merge' },
        conflictResolution: { type: 'enum: skip, overwrite, rename', required: false, description: 'Conflict resolution', defaultValue: 'skip' },
        dryRun: { type: 'boolean', required: false, description: 'Perform dry run', defaultValue: false },
        validateBeforeImport: { type: 'boolean', required: false, description: 'Validate before import', defaultValue: true },
        batchSize: { type: 'number', required: false, description: 'Batch size for processing', defaultValue: 100 },
        progressCallbacks: { type: 'boolean', required: false, description: 'Enable progress callbacks', defaultValue: true },
        sourceVersion: { type: 'string', required: false, description: 'Source version for migration' },
        sourceServer: { type: 'string', required: false, description: 'Source server type' },
        migrationOptions: { type: 'object', required: false, description: 'Migration options' }
      }
    },

    // File Operations
    list_files: {
      name: 'list_files',
      title: 'List Files',
      description: 'List files in the workspace with optional filtering',
      parameters: {
        path: { type: 'string', required: false, description: 'Directory path to list files from (default: workspace root)' },
        pattern: { type: 'string', required: false, description: 'Optional glob or substring pattern to filter files' }
      }
    }
  };

  return toolInfo;
}

/**
 * Extract parameters from Zod schema
 */
function extractParameters(schemaText) {
  const parameters = {};

  // Extract property definitions more accurately
  const propertyMatches = schemaText.match(/(\w+):\s*z\.([^,}]+?)(?:,|$)/g);

  propertyMatches?.forEach(match => {
    const colonIndex = match.indexOf(':');
    const name = match.substring(0, colonIndex).trim();
    const typeDef = match.substring(colonIndex + 1).trim();

    if (name && !name.startsWith('_') && !name.includes(':')) {
      const cleanName = name.replace(/[,\s]/g, '');

      parameters[cleanName] = {
        type: extractZodType(typeDef),
        required: !typeDef.includes('.optional()'),
        description: extractDescription(typeDef),
        defaultValue: extractDefaultValue(typeDef)
      };
    }
  });

  return parameters;
}

/**
 * Extract Zod type information
 */
function extractZodType(typeDef) {
  if (typeDef.includes('z.string()')) return 'string';
  if (typeDef.includes('z.number()')) return 'number';
  if (typeDef.includes('z.boolean()')) return 'boolean';
  if (typeDef.includes('z.array(')) return 'array';
  if (typeDef.includes('z.object(')) return 'object';
  if (typeDef.includes('z.enum(')) {
    const enumMatch = typeDef.match(/z\.enum\(\[([^\]]+)\]\)/);
    return enumMatch ? `enum: ${enumMatch[1]}` : 'enum';
  }
  if (typeDef.includes('z.any()')) return 'any';
  return 'unknown';
}

/**
 * Extract description from Zod schema
 */
function extractDescription(typeDef) {
  const descMatch = typeDef.match(/\.describe\(['"`]([^'"`]*)['"`]\)/);
  return descMatch ? descMatch[1] : '';
}

/**
 * Extract default value from Zod schema
 */
function extractDefaultValue(typeDef) {
  const defaultMatch = typeDef.match(/\.default\(([^)]+)\)/);
  if (defaultMatch) {
    const defaultValue = defaultMatch[1];
    if (defaultValue === 'true') return true;
    if (defaultValue === 'false') return false;
    if (!isNaN(defaultValue)) return Number(defaultValue);
    if (defaultValue.startsWith('"') || defaultValue.startsWith("'")) {
      return defaultValue.slice(1, -1);
    }
    return defaultValue;
  }
  return undefined;
}

/**
 * Generate API reference content
 */
function generateApiReference(toolInfo) {
  let content = `# Mem100x API Reference

*Auto-generated from Zod schemas and tool definitions*

## Table of Contents

- [Overview](#overview)
- [Authentication & Security](#authentication--security)
- [Context Management](#context-management)
- [Entity Operations](#entity-operations)
- [Search Operations](#search-operations)
- [Relation Operations](#relation-operations)
- [Observation Operations](#observation-operations)
- [Transaction Management](#transaction-management)
- [Backup & Restore](#backup--restore)
- [Graph Traversal](#graph-traversal)
- [System Resilience](#system-resilience)
- [Privacy & Security](#privacy--security)
- [Memory Export/Import](#memory-exportimport)
- [File Operations](#file-operations)
- [Data Types](#data-types)
- [Error Codes](#error-codes)

## Overview

Mem100x is a high-performance, multi-context memory system that provides a comprehensive API for managing knowledge graphs, entities, relations, and observations. The API is built on the Model Context Protocol (MCP) and provides type-safe operations with runtime validation.

### Performance Highlights

- **Entity Creation**: ${PERFORMANCE_METRICS.entityCreation}
- **Relation Creation**: ${PERFORMANCE_METRICS.relationCreation}
- **Search Performance**: ${PERFORMANCE_METRICS.searchPerformance}
- **Multi-context Support**: Isolated memory contexts for different domains

### Base URL

All API endpoints follow the MCP protocol specification.

---

## Authentication & Security

### Rate Limiting

All operations are subject to rate limiting based on operation type:
- **Read operations**: ${RATE_LIMITS.readOperations.limit} requests/${RATE_LIMITS.readOperations.window}
- **Write operations**: ${RATE_LIMITS.writeOperations.limit} requests/${RATE_LIMITS.writeOperations.window}
- **Search operations**: ${RATE_LIMITS.searchOperations.limit} requests/${RATE_LIMITS.searchOperations.window}

### Destructive Operations

Operations that can cause data loss require explicit confirmation:

\`\`\`json
{
  "confirm": true
}
\`\`\`

---

`;

  // Generate sections for each category
  Object.entries(TOOL_CATEGORIES).forEach(([category, tools]) => {
    content += `## ${category}\n\n`;

    tools.forEach(toolName => {
      const tool = toolInfo[toolName];
      if (tool) {
        content += generateToolDocumentation(tool);
      }
    });

    content += '---\n\n';
  });

  // Add data types section
  content += generateDataTypesSection();

  // Add error codes section
  content += generateErrorCodesSection();

  // Add rate limits section
  content += generateRateLimitsSection();

  // Add best practices section
  content += generateBestPracticesSection();

  // Add footer
  content += `---

*This API reference is auto-generated from the Zod schemas and tool definitions. For the most up-to-date information, refer to the source code in \`src/tool-schemas.ts\` and \`src/tool-definitions.ts\`.*
`;

  return content;
}

/**
 * Generate documentation for a single tool
 */
function generateToolDocumentation(tool) {
  let content = `### ${tool.title || tool.name}\n\n`;

  if (tool.description) {
    content += `${tool.description}\n\n`;
  }

  // Add performance info if available
  if (tool.name === 'create_entities') {
    content += `**Performance**: ${PERFORMANCE_METRICS.entityCreation}\n\n`;
  } else if (tool.name === 'create_relations') {
    content += `**Performance**: ${PERFORMANCE_METRICS.relationCreation}\n\n`;
  } else if (tool.name.includes('search')) {
    content += `**Performance**: ${PERFORMANCE_METRICS.searchPerformance}\n\n`;
  }

  content += `**Endpoint**: \`${tool.name}\`\n\n`;

  // Generate parameters section
  if (Object.keys(tool.parameters).length > 0) {
    content += `**Parameters**:\n\`\`\`json\n`;
    content += generateParametersJson(tool.parameters);
    content += `\n\`\`\`\n\n`;
  } else {
    content += `**Parameters**:\n\`\`\`json\n{}\n\`\`\`\n\n`;
  }

  // Add example if it's a destructive operation
  if (isDestructiveOperation(tool.name)) {
    content += `**Example**:\n\`\`\`json\n{\n  "confirm": true\n}\n\`\`\`\n\n`;
  }

  return content;
}

/**
 * Generate JSON parameters representation
 */
function generateParametersJson(parameters) {
  const jsonParams = {};

  Object.entries(parameters).forEach(([name, param]) => {
    let value = getJsonValue(param.type);
    let comment = '';

    if (!param.required) {
      comment += 'Optional';
    }
    if (param.description) {
      if (comment) comment += ' - ';
      comment += param.description;
    }
    if (param.defaultValue !== undefined) {
      if (comment) comment += ' - ';
      comment += `Default: ${param.defaultValue}`;
    }

    if (comment) {
      jsonParams[name] = `${value} // ${comment}`;
    } else {
      jsonParams[name] = value;
    }
  });

  return JSON.stringify(jsonParams, null, 2);
}

/**
 * Get JSON value representation for a Zod type
 */
function getJsonValue(zodType) {
  if (zodType === 'string') return '"string"';
  if (zodType === 'number') return '0';
  if (zodType === 'boolean') return 'true';
  if (zodType === 'array') return '[]';
  if (zodType === 'object') return '{}';
  if (zodType.startsWith('enum:')) {
    const enumValues = zodType.replace('enum: ', '').split(', ');
    return `"${enumValues[0]}"`;
  }
  if (zodType === 'any') return 'null';
  return 'null';
}

/**
 * Check if operation is destructive
 */
function isDestructiveOperation(toolName) {
  const destructiveOps = [
    'delete_context',
    'delete_entities',
    'delete_relations',
    'delete_observations',
    'restore_backup'
  ];
  return destructiveOps.includes(toolName);
}

/**
 * Generate data types section
 */
function generateDataTypesSection() {
  return `## Data Types

### Content Types

#### Text Content
\`\`\`json
{
  "type": "text",
  "text": "string" // Required: Text content
}
\`\`\`

#### Image Content
\`\`\`json
{
  "type": "image",
  "data": "string", // Required: Base64 encoded image data
  "mimeType": "string" // Required: MIME type (e.g., "image/png")
}
\`\`\`

#### Audio Content
\`\`\`json
{
  "type": "audio",
  "data": "string", // Required: Base64 encoded audio data
  "mimeType": "string" // Required: MIME type (e.g., "audio/mp3")
}
\`\`\`

#### Resource Link Content
\`\`\`json
{
  "type": "resource_link",
  "uri": "string", // Required: Resource URI
  "title": "string", // Optional: Resource title
  "description": "string" // Optional: Resource description
}
\`\`\`

#### Resource Content
\`\`\`json
{
  "type": "resource",
  "data": "string", // Required: Base64 encoded resource data
  "mimeType": "string", // Required: MIME type
  "title": "string", // Optional: Resource title
  "description": "string" // Optional: Resource description
}
\`\`\`

### Entity Structure
\`\`\`json
{
  "name": "string", // Required: Entity name
  "entityType": "string", // Required: Entity type
  "content": [ // Required: Array of content blocks
    {
      "type": "text|image|audio|resource_link|resource",
      // ... content-specific fields
    }
  ]
}
\`\`\`

### Relation Structure
\`\`\`json
{
  "from": "string", // Required: Source entity name
  "to": "string", // Required: Target entity name
  "relationType": "string" // Required: Relation type
}
\`\`\`

---

`;
}

/**
 * Generate error codes section
 */
function generateErrorCodesSection() {
  let content = `## Error Codes

### Standard Error Codes

${ERROR_CODES.standard.map(code => `- **${code}**: ${getErrorDescription(code)}`).join('\n')}

### Destructive Operation Errors

${ERROR_CODES.destructive.map(code => `- **${code}**: ${getErrorDescription(code)}`).join('\n')}

### Search Errors

${ERROR_CODES.search.map(code => `- **${code}**: ${getErrorDescription(code)}`).join('\n')}

### Transaction Errors

${ERROR_CODES.transaction.map(code => `- **${code}**: ${getErrorDescription(code)}`).join('\n')}

### Backup/Restore Errors

${ERROR_CODES.backup.map(code => `- **${code}**: ${getErrorDescription(code)}`).join('\n')}

---

`;

  return content;
}

/**
 * Get error description
 */
function getErrorDescription(code) {
  const descriptions = {
    'InvalidParams': 'Invalid parameters provided',
    'MethodNotFound': 'Tool not found',
    'InternalError': 'Internal server error',
    'RateLimitExceeded': 'Rate limit exceeded',
    'AccessDenied': 'Access denied',
    'DataCorruption': 'Data corruption detected',
    'ValidationError': 'Data validation failed',
    'ConfirmationRequired': 'Destructive operation requires explicit confirmation',
    'ContextNotEmpty': 'Cannot delete context with entities (use force=true)',
    'QueryTooLong': 'Search query exceeds maximum length',
    'InvalidSearchMode': 'Invalid search mode specified',
    'NoResults': 'No results found for query',
    'TransactionInProgress': 'Transaction already in progress',
    'NoActiveTransaction': 'No active transaction to commit/rollback',
    'TransactionTimeout': 'Transaction timed out',
    'BackupFailed': 'Backup operation failed',
    'RestoreFailed': 'Restore operation failed',
    'InvalidBackupFormat': 'Invalid backup format',
    'BackupCorrupted': 'Backup file is corrupted'
  };

  return descriptions[code] || 'Unknown error';
}

/**
 * Generate rate limits section
 */
function generateRateLimitsSection() {
  return `## Rate Limits

| Operation Type | Limit | Window |
|----------------|-------|--------|
| Read Operations | ${RATE_LIMITS.readOperations.limit} | ${RATE_LIMITS.readOperations.window} |
| Write Operations | ${RATE_LIMITS.writeOperations.limit} | ${RATE_LIMITS.writeOperations.window} |
| Search Operations | ${RATE_LIMITS.searchOperations.limit} | ${RATE_LIMITS.searchOperations.window} |
| Context Operations | ${RATE_LIMITS.contextOperations.limit} | ${RATE_LIMITS.contextOperations.window} |
| System Operations | ${RATE_LIMITS.systemOperations.limit} | ${RATE_LIMITS.systemOperations.window} |

---

`;
}

/**
 * Generate best practices section
 */
function generateBestPracticesSection() {
  return `## Best Practices

### Performance Optimization

1. **Batch Operations**: Use batch operations for multiple entities/relations
2. **Context Awareness**: Specify context when possible to avoid auto-detection overhead
3. **Search Optimization**: Use appropriate search modes and filters
4. **Pagination**: Use pagination for large result sets

### Security

1. **Confirmation**: Always confirm destructive operations
2. **Input Validation**: Validate all input data
3. **Access Control**: Use appropriate access controls
4. **Audit Logging**: Monitor audit logs for suspicious activity

### Data Integrity

1. **Transactions**: Use transactions for atomic operations
2. **Backup**: Regular backups with integrity validation
3. **Corruption Detection**: Monitor for data corruption
4. **Validation**: Validate data before import

---

`;
}

/**
 * Main function
 */
function main() {
  console.log('🔍 Extracting tool information from source files...');
  const toolInfo = extractToolInfo();

  console.log(`📝 Found ${Object.keys(toolInfo).length} tools`);

  console.log('📄 Generating API reference...');
  const apiReference = generateApiReference(toolInfo);

  console.log('💾 Writing API reference to file...');
  fs.writeFileSync(CONFIG.outputFile, apiReference, 'utf8');

  console.log(`✅ API reference generated successfully: ${CONFIG.outputFile}`);
  console.log(`📊 Generated documentation for ${Object.keys(toolInfo).length} tools across ${Object.keys(TOOL_CATEGORIES).length} categories`);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  extractToolInfo,
  generateApiReference,
  main
};
