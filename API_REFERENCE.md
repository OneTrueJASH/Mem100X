# Mem100x API Reference

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

- **Entity Creation**: 59,780+ entities/sec
- **Relation Creation**: 261,455+ relations/sec
- **Search Performance**: 8,829 searches/sec (88x faster with FTS5)
- **Multi-context Support**: Isolated memory contexts for different domains

### Base URL

All API endpoints follow the MCP protocol specification.

---

## Authentication & Security

### Rate Limiting

All operations are subject to rate limiting based on operation type:
- **Read operations**: 1000 requests/1 minute
- **Write operations**: 100 requests/1 minute
- **Search operations**: 500 requests/1 minute

### Destructive Operations

Operations that can cause data loss require explicit confirmation:

```json
{
  "confirm": true
}
```

---

## Context Management

### Set Context

Switch to a specific memory context (e.g., 'personal' or 'work')

**Endpoint**: `set_context`

**Parameters**:
```json
{
  "context": "\"string\" // The context to switch to"
}
```

### Get Context Info

Get information about available contexts and current state

**Endpoint**: `get_context_info`

**Parameters**:
```json
{}
```

### Create Context

Create a new memory context for organizing different types of information (e.g., projects, hobbies, studies)

**Endpoint**: `create_context`

**Parameters**:
```json
{
  "name": "\"string\" // Name of the new context (lowercase letters, numbers, hyphens, underscores only)",
  "path": "\"string\" // Optional - Custom database path for the context",
  "patterns": "[] // Optional - Patterns to match for automatic context detection",
  "entityTypes": "[] // Optional - Entity types commonly found in this context",
  "description": "\"string\" // Optional - Human-readable description of the context"
}
```

### Delete Context

Delete a memory context and its associated database

**Endpoint**: `delete_context`

**Parameters**:
```json
{
  "name": "\"string\" // Name of the context to delete",
  "force": "true // Optional - Force deletion even if context contains entities - Default: false"
}
```

**Example**:
```json
{
  "confirm": true
}
```

### Update Context

Update the configuration of an existing memory context

**Endpoint**: `update_context`

**Parameters**:
```json
{
  "name": "\"string\" // Name of the context to update",
  "patterns": "[] // Optional - New patterns for context detection",
  "entityTypes": "[] // Optional - New entity types for this context",
  "description": "\"string\" // Optional - Updated description of the context"
}
```

### List Contexts

List all available memory contexts with their statistics and configuration

**Endpoint**: `list_contexts`

**Parameters**:
```json
{}
```

---

## Entity Operations

### Create Entities

Create multiple new entities in the knowledge graph. Performance: 59,780+ entities/sec

**Performance**: 59,780+ entities/sec

**Endpoint**: `create_entities`

**Parameters**:
```json
{
  "entities": "[] // Array of entities to create",
  "context": "\"string\" // Optional - Specific context to use"
}
```

### Delete Entities

Delete multiple entities and their associated relations from the knowledge graph

**Endpoint**: `delete_entities`

**Parameters**:
```json
{
  "entityNames": "[] // Array of entity names to delete"
}
```

**Example**:
```json
{
  "confirm": true
}
```

---

## Search Operations

### Search Nodes

Search for nodes in the knowledge graph based on a query. Uses FTS5 for 88x faster performance (8,829 searches/sec) with context-aware ranking

**Performance**: 8,829 searches/sec (88x faster with FTS5)

**Endpoint**: `search_nodes`

**Parameters**:
```json
{
  "query": "\"string\" // The search query to match against entity names, types, and observation content",
  "limit": "0 // Optional - Maximum number of results to return - Default: 20",
  "context": "\"string\" // Optional - Optional: specific context to use (overrides auto-detection)",
  "allContexts": "true // Optional - Search all contexts - Default: false",
  "searchMode": "\"exact\" // Optional - Search mode for different query types - Default: hybrid",
  "contentTypes": "[] // Optional - Content types to search for",
  "intent": "\"find\" // Optional - Search intent for better result ranking",
  "searchContext": "{} // Optional - Enhanced search context for context-aware search"
}
```

### Context-Aware Search

Enhanced context-aware search with semantic understanding, suggestions, and intent analysis

**Performance**: 8,829 searches/sec (88x faster with FTS5)

**Endpoint**: `search_nodes_context_aware`

**Parameters**:
```json
{
  "query": "\"string\" // The search query to analyze and search for",
  "limit": "0 // Optional - Maximum number of results to return - Default: 20",
  "context": "\"string\" // Optional - Optional: specific context to use (overrides auto-detection)",
  "allContexts": "true // Optional - Search all contexts - Default: false",
  "searchMode": "\"exact\" // Optional - Search mode for different query types - Default: hybrid",
  "contentTypes": "[] // Optional - Content types to search for",
  "intent": "\"find\" // Optional - Search intent for better result ranking",
  "searchContext": "{} // Optional - Enhanced search context for context-aware search"
}
```

### Search Related Entities

Find entities related to a specific entity

**Performance**: 8,829 searches/sec (88x faster with FTS5)

**Endpoint**: `search_related_entities`

**Parameters**:
```json
{
  "entityName": "\"string\" // Entity name",
  "limit": "0 // Optional - Maximum results - Default: 10",
  "relationTypes": "[] // Optional - Filter by relation types",
  "searchContext": "{} // Optional - Search context"
}
```

### Read Graph

Read the entire knowledge graph with pagination support

**Endpoint**: `read_graph`

**Parameters**:
```json
{
  "limit": "0 // Optional - Optional: limit the number of entities returned for pagination",
  "offset": "0 // Optional - Optional: offset for pagination - Default: 0",
  "context": "\"string\" // Optional - Optional: specific context to use (overrides auto-detection)"
}
```

### Open Nodes

Open specific nodes in the knowledge graph by their names

**Endpoint**: `open_nodes`

**Parameters**:
```json
{
  "names": "[] // An array of entity names to retrieve",
  "context": "\"string\" // Optional - Optional: specific context to use (overrides auto-detection)"
}
```

---

## Relation Operations

### Create Relations

Create multiple new relations between entities in the knowledge graph. Performance: 261,455+ relations/sec

**Performance**: 261,455+ relations/sec

**Endpoint**: `create_relations`

**Parameters**:
```json
{
  "relations": "[] // Array of relations to create"
}
```

### Delete Relations

Delete multiple relations from the knowledge graph

**Endpoint**: `delete_relations`

**Parameters**:
```json
{
  "relations": "[] // Array of relations to delete"
}
```

**Example**:
```json
{
  "confirm": true
}
```

---

## Observation Operations

### Add Observations

Add new observations to existing entities in the knowledge graph. Batched for performance

**Endpoint**: `add_observations`

**Parameters**:
```json
{
  "updates": "[] // Array of observation updates"
}
```

### Delete Observations

Delete observations from entities

**Endpoint**: `delete_observations`

**Parameters**:
```json
{
  "deletions": "[] // Array of observation deletions"
}
```

**Example**:
```json
{
  "confirm": true
}
```

---

## Transaction Management

### Begin Transaction

Start a new transaction for atomic operations

**Endpoint**: `begin_transaction`

**Parameters**:
```json
{
  "name": "\"string\" // Optional - Optional transaction name for debugging"
}
```

### Commit Transaction

Commit the current transaction

**Endpoint**: `commit_transaction`

**Parameters**:
```json
{}
```

### Rollback Transaction

Rollback the current transaction

**Endpoint**: `rollback_transaction`

**Parameters**:
```json
{}
```

---

## Backup & Restore

### Create Backup

Create a backup of the current context or all contexts

**Endpoint**: `create_backup`

**Parameters**:
```json
{
  "backupPath": "\"string\" // Optional - Optional: Custom backup path",
  "context": "\"string\" // Optional - Optional: Specific context to backup"
}
```

### Restore Backup

Restore from a backup file

**Endpoint**: `restore_backup`

**Parameters**:
```json
{
  "backupPath": "\"string\" // Path to backup file",
  "context": "\"string\" // Optional - Context to restore to",
  "confirmRestore": "true // Must be true to confirm the restore operation"
}
```

**Example**:
```json
{
  "confirm": true
}
```

---

## Graph Traversal

### Get Neighbors

Get neighboring entities of a specific entity

**Endpoint**: `get_neighbors`

**Parameters**:
```json
{
  "entityName": "\"string\" // Entity name",
  "direction": "\"outgoing\" // Optional - Direction of relations to follow - Default: both",
  "relationType": "\"string\" // Optional - Filter by specific relation type",
  "depth": "0 // Optional - How many hops to traverse (1-5) - Default: 1",
  "includeRelations": "true // Optional - Include relation details in response - Default: true",
  "context": "\"string\" // Optional - Specific context to search in"
}
```

### Find Shortest Path

Find the shortest path between two entities

**Endpoint**: `find_shortest_path`

**Parameters**:
```json
{
  "from": "\"string\" // Source entity name",
  "to": "\"string\" // Target entity name",
  "bidirectional": "true // Optional - Whether to follow relations in both directions - Default: true",
  "relationType": "\"string\" // Optional - Filter by specific relation type",
  "maxDepth": "0 // Optional - Maximum depth to search (1-10) - Default: 6"
}
```

---

## System Resilience

### Get Resilience Stats

Get system resilience statistics

**Endpoint**: `get_resilience_stats`

**Parameters**:
```json
{}
```

### Get Transaction Logs

Get recent transaction logs

**Endpoint**: `get_transaction_logs`

**Parameters**:
```json
{
  "limit": "0 // Optional - Maximum logs - Default: 100"
}
```

### Get Recovery Actions

Get available recovery actions

**Endpoint**: `get_recovery_actions`

**Parameters**:
```json
{}
```

### Detect and Repair Corruption

Detect and automatically repair data corruption

**Endpoint**: `detect_and_repair_corruption`

**Parameters**:
```json
{}
```

### Validate Data Integrity

Validate data integrity using checksums

**Endpoint**: `validate_data_integrity`

**Parameters**:
```json
{
  "data": "null // Data to validate",
  "expectedChecksum": "\"string\" // Optional - Expected checksum for validation"
}
```

### Clear Old Transaction Logs

Clear old transaction logs to free storage

**Endpoint**: `clear_old_transaction_logs`

**Parameters**:
```json
{
  "olderThanDays": "0 // Optional - Clear logs older than days - Default: 30"
}
```

### Create Resilient Backup

Create a resilient backup with integrity validation

**Endpoint**: `create_resilient_backup`

**Parameters**:
```json
{
  "backupPath": "\"string\" // Backup file path"
}
```

---

## Privacy & Security

### Get Privacy Stats

Get privacy and security statistics

**Endpoint**: `get_privacy_stats`

**Parameters**:
```json
{}
```

### Get Privacy Config

Get current privacy configuration

**Endpoint**: `get_privacy_config`

**Parameters**:
```json
{}
```

### Update Privacy Config

Update privacy configuration settings

**Endpoint**: `update_privacy_config`

**Parameters**:
```json
{
  "config": "{} // Privacy configuration to update"
}
```

### Check Access

Check user access permissions

**Endpoint**: `check_access`

**Parameters**:
```json
{
  "userId": "\"string\" // User ID",
  "operation": "\"string\" // Operation to check",
  "context": "\"string\" // Context to check"
}
```

### Set Access Control

Set access control permissions for a user

**Endpoint**: `set_access_control`

**Parameters**:
```json
{
  "userId": "\"string\" // User ID",
  "permissions": "[] // Permissions to grant",
  "contexts": "[] // Contexts to grant access to",
  "expiresAt": "\"string\" // Optional - Expiration date (ISO string)"
}
```

### Remove Access Control

Remove access control for a user

**Endpoint**: `remove_access_control`

**Parameters**:
```json
{
  "userId": "\"string\" // User ID"
}
```

### Unlock Account

Unlock a locked user account

**Endpoint**: `unlock_account`

**Parameters**:
```json
{
  "userId": "\"string\" // User ID"
}
```

### Check Compliance

Check compliance status for regulations

**Endpoint**: `check_compliance`

**Parameters**:
```json
{}
```

### Apply Retention Policy

Apply data retention policy

**Endpoint**: `apply_retention_policy`

**Parameters**:
```json
{}
```

### Cleanup Audit Logs

Clean up old audit log entries

**Endpoint**: `cleanup_audit_logs`

**Parameters**:
```json
{}
```

### Encrypt Data

Encrypt sensitive data

**Endpoint**: `encrypt_data`

**Parameters**:
```json
{
  "data": "\"string\" // Data to encrypt"
}
```

### Decrypt Data

Decrypt previously encrypted data

**Endpoint**: `decrypt_data`

**Parameters**:
```json
{
  "encryptedData": "\"string\" // Encrypted data to decrypt"
}
```

### Anonymize Data

Anonymize data for privacy protection

**Endpoint**: `anonymize_data`

**Parameters**:
```json
{
  "data": "null // Data to anonymize",
  "level": "\"none\" // Optional - Anonymization level - Default: partial"
}
```

### Validate Input

Validate input data for security threats

**Endpoint**: `validate_input`

**Parameters**:
```json
{
  "data": "null // Data to validate"
}
```

### Sanitize Output

Sanitize output data to remove dangerous content

**Endpoint**: `sanitize_output`

**Parameters**:
```json
{
  "data": "null // Data to sanitize"
}
```

---

## Memory Export/Import

### Export Memory

Export all entities, relations, and observations as a versioned JSON stream for migration and backup

**Endpoint**: `export_memory`

**Parameters**:
```json
{
  "context": "\"string\" // Optional - Optional: specific context to export (default: all contexts)",
  "format": "\"json\" // Optional - Export format - Default: json",
  "includeMetadata": "true // Optional - Include metadata like creation dates, prominence scores, etc. - Default: true",
  "includeObservations": "true // Optional - Include entity observations and content - Default: true",
  "includeRelations": "true // Optional - Include entity relations - Default: true",
  "filterByDate": "{} // Optional - Filter entities by date range",
  "filterByEntityType": "[] // Optional - Filter by specific entity types",
  "exportVersion": "\"string\" // Optional - Export format version for compatibility - Default: 3.0.0",
  "targetServer": "\"string\" // Optional - Target server type for migration (mem100x, generic, etc.)",
  "compressionLevel": "0 // Optional - Compression level 0-9 - Default: 6"
}
```

### Import Memory

Import entities, relations, and observations from a versioned JSON stream

**Endpoint**: `import_memory`

**Parameters**:
```json
{
  "data": "{} // Import data",
  "mode": "\"merge\" // Optional - Import mode - Default: merge",
  "conflictResolution": "\"skip\" // Optional - Conflict resolution - Default: skip",
  "dryRun": "true // Optional - Perform dry run - Default: false",
  "validateBeforeImport": "true // Optional - Validate before import - Default: true",
  "batchSize": "0 // Optional - Batch size for processing - Default: 100",
  "progressCallbacks": "true // Optional - Enable progress callbacks - Default: true",
  "sourceVersion": "\"string\" // Optional - Source version for migration",
  "sourceServer": "\"string\" // Optional - Source server type",
  "migrationOptions": "{} // Optional - Migration options"
}
```

---

## File Operations

### List Files

List files in the workspace with optional filtering

**Endpoint**: `list_files`

**Parameters**:
```json
{
  "path": "\"string\" // Optional - Directory path to list files from (default: workspace root)",
  "pattern": "\"string\" // Optional - Optional glob or substring pattern to filter files"
}
```

---

## Data Types

### Content Types

#### Text Content
```json
{
  "type": "text",
  "text": "string" // Required: Text content
}
```

#### Image Content
```json
{
  "type": "image",
  "data": "string", // Required: Base64 encoded image data
  "mimeType": "string" // Required: MIME type (e.g., "image/png")
}
```

#### Audio Content
```json
{
  "type": "audio",
  "data": "string", // Required: Base64 encoded audio data
  "mimeType": "string" // Required: MIME type (e.g., "audio/mp3")
}
```

#### Resource Link Content
```json
{
  "type": "resource_link",
  "uri": "string", // Required: Resource URI
  "title": "string", // Optional: Resource title
  "description": "string" // Optional: Resource description
}
```

#### Resource Content
```json
{
  "type": "resource",
  "data": "string", // Required: Base64 encoded resource data
  "mimeType": "string", // Required: MIME type
  "title": "string", // Optional: Resource title
  "description": "string" // Optional: Resource description
}
```

### Entity Structure
```json
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
```

### Relation Structure
```json
{
  "from": "string", // Required: Source entity name
  "to": "string", // Required: Target entity name
  "relationType": "string" // Required: Relation type
}
```

---

## Error Codes

### Standard Error Codes

- **InvalidParams**: Invalid parameters provided
- **MethodNotFound**: Tool not found
- **InternalError**: Internal server error
- **RateLimitExceeded**: Rate limit exceeded
- **AccessDenied**: Access denied
- **DataCorruption**: Data corruption detected
- **ValidationError**: Data validation failed

### Destructive Operation Errors

- **ConfirmationRequired**: Destructive operation requires explicit confirmation
- **ContextNotEmpty**: Cannot delete context with entities (use force=true)

### Search Errors

- **QueryTooLong**: Search query exceeds maximum length
- **InvalidSearchMode**: Invalid search mode specified
- **NoResults**: No results found for query

### Transaction Errors

- **TransactionInProgress**: Transaction already in progress
- **NoActiveTransaction**: No active transaction to commit/rollback
- **TransactionTimeout**: Transaction timed out

### Backup/Restore Errors

- **BackupFailed**: Backup operation failed
- **RestoreFailed**: Restore operation failed
- **InvalidBackupFormat**: Invalid backup format
- **BackupCorrupted**: Backup file is corrupted

---

## Rate Limits

| Operation Type | Limit | Window |
|----------------|-------|--------|
| Read Operations | 1000 | 1 minute |
| Write Operations | 100 | 1 minute |
| Search Operations | 500 | 1 minute |
| Context Operations | 50 | 1 minute |
| System Operations | 20 | 1 minute |

---

## Best Practices

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

---

*This API reference is auto-generated from the Zod schemas and tool definitions. For the most up-to-date information, refer to the source code in `src/tool-schemas.ts` and `src/tool-definitions.ts`.*
