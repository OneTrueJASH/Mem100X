/**
 * MCP Tool Definitions
 * Centralized tool metadata for all Mem100x tools
 */

import { MCPToolDefinition } from './mcp-types.js';
import { addDestructiveSafetyInfo } from './utils/destructive-ops.js';

export const TOOL_DEFINITIONS: Record<string, MCPToolDefinition> = {
  set_context: {
    name: 'set_context',
    title: 'Set Context',
    description: "Switch to a specific memory context (e.g., 'personal' or 'work')",
    inputSchema: {
      type: 'object',
      properties: {
        context: {
          type: 'string',
          description: 'The context to switch to',
        },
      },
      required: ['context'],
    },
  },

  get_context_info: {
    name: 'get_context_info',
    title: 'Get Context Info',
    description: 'Get information about available contexts and current state',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  create_context: {
    name: 'create_context',
    title: 'Create Context',
    description: 'Create a new memory context for organizing different types of information (e.g., projects, hobbies, studies)',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the new context (lowercase letters, numbers, hyphens, underscores only)',
        },
        path: {
          type: 'string',
          description: 'Optional: Custom database path for the context',
        },
        patterns: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: Patterns to match for automatic context detection',
        },
        entityTypes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: Entity types commonly found in this context',
        },
        description: {
          type: 'string',
          description: 'Optional: Human-readable description of the context',
        },
      },
      required: ['name'],
    },
  },

  delete_context: addDestructiveSafetyInfo({
    name: 'delete_context',
    title: 'Delete Context',
    description: 'Delete a memory context and its associated database',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the context to delete',
        },
        force: {
          type: 'boolean',
          description: 'Force deletion even if context contains entities',
          default: false,
        },
      },
      required: ['name'],
    },
  }, 'delete_context'),

  update_context: {
    name: 'update_context',
    title: 'Update Context',
    description: 'Update the configuration of an existing memory context',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the context to update',
        },
        patterns: {
          type: 'array',
          items: { type: 'string' },
          description: 'New patterns for context detection',
        },
        entityTypes: {
          type: 'array',
          items: { type: 'string' },
          description: 'New entity types for this context',
        },
        description: {
          type: 'string',
          description: 'Updated description of the context',
        },
      },
      required: ['name'],
    },
  },

  list_contexts: {
    name: 'list_contexts',
    title: 'List Contexts',
    description: 'List all available memory contexts with their statistics and configuration',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  create_entities: {
    name: 'create_entities',
    title: 'Create Entities',
    description:
      'Create multiple new entities in the knowledge graph. Performance: 59,780+ entities/sec',
    inputSchema: {
      type: 'object',
      properties: {
        entities: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'The name of the entity',
              },
              entityType: {
                type: 'string',
                description: 'The type of the entity',
              },
              content: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type: {
                      type: 'string',
                      enum: ['text', 'image', 'audio', 'resource_link', 'resource'],
                    },
                    text: { type: 'string', description: 'The text content' },
                    data: { type: 'string', description: 'Binary or base64 data' },
                    mimeType: { type: 'string', description: 'MIME type' },
                    uri: { type: 'string', description: 'Resource URI' },
                    title: { type: 'string', description: 'Title' },
                    description: { type: 'string', description: 'Description' },
                  },
                  required: ['type'],
                },
                description: 'An array of content blocks associated with the entity',
              },
            },
            required: ['name', 'entityType', 'content'],
          },
        },
      },
      required: ['entities'],
    },
  },

  search_nodes: {
    name: 'search_nodes',
    title: 'Search Nodes',
    description:
      'Search for nodes in the knowledge graph based on a query. Uses FTS5 for 88x faster performance (8,829 searches/sec) with context-aware ranking',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'The search query to match against entity names, types, and observation content',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 100)',
        },
        context: {
          type: 'string',
          description: 'Optional: specific context to use (overrides auto-detection)',
        },
        searchContext: {
          type: 'object',
          description: 'Enhanced search context for context-aware search',
          properties: {
            currentEntities: {
              type: 'array',
              items: { type: 'string' },
              description: 'Currently active entities for context boost'
            },
            recentSearches: {
              type: 'array',
              items: { type: 'string' },
              description: 'Recent search queries for relevance boost'
            },
            userContext: {
              type: 'string',
              enum: ['work', 'personal', 'neutral'],
              description: 'User context for relevance scoring'
            },
            conversationContext: {
              type: 'string',
              description: 'Current conversation context for semantic matching'
            }
          },
        },
        searchMode: {
          type: 'string',
          enum: ['exact', 'semantic', 'fuzzy', 'hybrid'],
          description: 'Search mode for different query types',
          default: 'hybrid'
        },
        contentTypes: {
          type: 'array',
          items: { type: 'string', enum: ['text', 'image', 'audio', 'resource'] },
          description: 'Content types to search for'
        },
        intent: {
          type: 'string',
          enum: ['find', 'browse', 'explore', 'verify'],
          description: 'Search intent for better result ranking'
        }
      },
      required: ['query'],
    },
  },

  read_graph: {
    name: 'read_graph',
    title: 'Read Graph',
    description: 'Read the entire knowledge graph with pagination support',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Optional: limit the number of entities returned for pagination',
        },
        offset: {
          type: 'number',
          description: 'Optional: offset for pagination (default: 0)',
        },
        context: {
          type: 'string',
          description: 'Optional: specific context to use (overrides auto-detection)',
        },
      },
    },
  },

  open_nodes: {
    name: 'open_nodes',
    title: 'Open Nodes',
    description: 'Open specific nodes in the knowledge graph by their names',
    inputSchema: {
      type: 'object',
      properties: {
        names: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'An array of entity names to retrieve',
        },
        context: {
          type: 'string',
          description: 'Optional: specific context to use (overrides auto-detection)',
        },
      },
      required: ['names'],
    },
  },

  create_relations: {
    name: 'create_relations',
    title: 'Create Relations',
    description:
      'Create multiple new relations between entities in the knowledge graph. Performance: 261,455+ relations/sec',
    inputSchema: {
      type: 'object',
      properties: {
        relations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              from: {
                type: 'string',
                description: 'The name of the entity where the relation starts',
              },
              to: {
                type: 'string',
                description: 'The name of the entity where the relation ends',
              },
              relationType: {
                type: 'string',
                description: 'The type of the relation',
              },
            },
            required: ['from', 'to', 'relationType'],
          },
        },
      },
      required: ['relations'],
    },
  },

  delete_relations: {
    name: 'delete_relations',
    title: 'Delete Relations',
    description: 'Delete multiple relations from the knowledge graph',
    inputSchema: {
      type: 'object',
      properties: {
        relations: {
          type: 'array',
          description: 'An array of relations to delete',
          items: {
            type: 'object',
            properties: {
              from: {
                type: 'string',
                description: 'The name of the entity where the relation starts',
              },
              to: {
                type: 'string',
                description: 'The name of the entity where the relation ends',
              },
              relationType: {
                type: 'string',
                description: 'The type of the relation',
              },
            },
            required: ['from', 'to', 'relationType'],
          },
        },
      },
      required: ['relations'],
    },
  },

  add_observations: {
    name: 'add_observations',
    title: 'Add Observations',
    description:
      'Add new observations to existing entities in the knowledge graph. Batched for performance',
    inputSchema: {
      type: 'object',
      properties: {
        updates: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              entityName: {
                type: 'string',
                description: 'The name of the entity to add the observations to',
              },
              content: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type: {
                      type: 'string',
                      enum: ['text', 'image', 'audio', 'resource_link', 'resource'],
                    },
                    text: { type: 'string', description: 'The text content' },
                    data: { type: 'string', description: 'Binary or base64 data' },
                    mimeType: { type: 'string', description: 'MIME type' },
                    uri: { type: 'string', description: 'Resource URI' },
                    title: { type: 'string', description: 'Title' },
                    description: { type: 'string', description: 'Description' },
                  },
                  required: ['type'],
                },
                description: 'An array of content blocks to add',
              },
            },
            required: ['entityName', 'content'],
          },
        },
      },
      required: ['updates'],
    },
  },

  delete_observations: {
    name: 'delete_observations',
    title: 'Delete Observations',
    description:
      'Delete specific observations from entities in the knowledge graph. Batched for performance',
    inputSchema: {
      type: 'object',
      properties: {
        deletions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              entityName: {
                type: 'string',
                description: 'The name of the entity containing the observations',
              },
              observations: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type: { type: 'string', enum: ['text'] },
                    text: { type: 'string', description: 'The text content' },
                  },
                  required: ['type', 'text'],
                },
                description: 'An array of text observations to delete',
              },
            },
            required: ['entityName', 'observations'],
          },
        },
      },
      required: ['deletions'],
    },
  },

  delete_entities: {
    name: 'delete_entities',
    title: 'Delete Entities',
    description: 'Delete multiple entities and their associated relations from the knowledge graph',
    inputSchema: {
      type: 'object',
      properties: {
        entityNames: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'An array of entity names to delete',
        },
      },
      required: ['entityNames'],
    },
  },

  search_nodes_context_aware: {
    name: 'search_nodes_context_aware',
    title: 'Context-Aware Search',
    description: 'Enhanced context-aware search with semantic understanding, suggestions, and intent analysis',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query to analyze and search for',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 20)',
        },
        searchContext: {
          type: 'object',
          description: 'Enhanced search context for context-aware search',
          properties: {
            currentEntities: {
              type: 'array',
              items: { type: 'string' },
              description: 'Currently active entities for context boost'
            },
            recentSearches: {
              type: 'array',
              items: { type: 'string' },
              description: 'Recent search queries for relevance boost'
            },
            userContext: {
              type: 'string',
              enum: ['work', 'personal', 'neutral'],
              description: 'User context for relevance scoring'
            },
            conversationContext: {
              type: 'string',
              description: 'Current conversation context for semantic matching'
            }
          }
        },
        searchMode: {
          type: 'string',
          enum: ['exact', 'semantic', 'fuzzy', 'hybrid'],
          description: 'Search mode for different query types',
          default: 'hybrid'
        },
        contentTypes: {
          type: 'array',
          items: { type: 'string', enum: ['text', 'image', 'audio', 'resource'] },
          description: 'Content types to search for'
        },
        intent: {
          type: 'string',
          enum: ['find', 'browse', 'explore', 'verify'],
          description: 'Search intent for better result ranking'
        }
      },
      required: ['query'],
    },
  },

  search_related_entities: {
    name: 'search_related_entities',
    title: 'Search Related Entities',
    description: 'Find entities related to a specific entity with context-aware relevance scoring',
    inputSchema: {
      type: 'object',
      properties: {
        entityName: {
          type: 'string',
          description: 'The name of the entity to find related entities for',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of related entities to return (default: 10)',
        },
        relationTypes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by specific relation types',
        },
        searchContext: {
          type: 'object',
          description: 'Enhanced search context for context-aware search',
          properties: {
            currentEntities: {
              type: 'array',
              items: { type: 'string' },
              description: 'Currently active entities for context boost'
            },
            recentSearches: {
              type: 'array',
              items: { type: 'string' },
              description: 'Recent search queries for relevance boost'
            },
            userContext: {
              type: 'string',
              enum: ['work', 'personal', 'neutral'],
              description: 'User context for relevance scoring'
            },
            conversationContext: {
              type: 'string',
              description: 'Current conversation context for semantic matching'
            }
          }
        }
      },
      required: ['entityName'],
    },
  },

  list_files: {
    name: 'list_files',
    title: 'List Files',
    description: 'List files in a directory and return resource links for each file',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Directory path to list files from (default: workspace root)',
        },
        pattern: {
          type: 'string',
          description: 'Optional glob or substring pattern to filter files',
        },
      },
    },
  },

  // System resilience tools
  get_resilience_stats: {
    name: 'get_resilience_stats',
    title: 'Get Resilience Stats',
    description: 'Get system resilience statistics including transaction success rates, recovery actions, and integrity checks',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  get_transaction_logs: {
    name: 'get_transaction_logs',
    title: 'Get Transaction Logs',
    description: 'Retrieve transaction logs for audit and debugging purposes',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of logs to return (default: 100, max: 1000)',
          default: 100,
        },
      },
    },
  },

  get_recovery_actions: {
    name: 'get_recovery_actions',
    title: 'Get Recovery Actions',
    description: 'Get list of recovery actions taken by the system for data integrity and corruption repair',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  detect_and_repair_corruption: {
    name: 'detect_and_repair_corruption',
    title: 'Detect and Repair Corruption',
    description: 'Detect and automatically repair data corruption issues across the system',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  validate_data_integrity: {
    name: 'validate_data_integrity',
    title: 'Validate Data Integrity',
    description: 'Validate data integrity using checksums and consistency checks',
    inputSchema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          description: 'Data to validate for integrity',
        },
        expectedChecksum: {
          type: 'string',
          description: 'Expected checksum for validation (optional)',
        },
      },
      required: ['data'],
    },
  },

  clear_old_transaction_logs: {
    name: 'clear_old_transaction_logs',
    title: 'Clear Old Transaction Logs',
    description: 'Clear old transaction logs to free up storage space',
    inputSchema: {
      type: 'object',
      properties: {
        olderThanDays: {
          type: 'number',
          description: 'Clear logs older than this many days (default: 30, max: 365)',
          default: 30,
        },
      },
    },
  },

  create_resilient_backup: {
    name: 'create_resilient_backup',
    title: 'Create Resilient Backup',
    description: 'Create a resilient backup with integrity validation and corruption detection',
    inputSchema: {
      type: 'object',
      properties: {
        backupPath: {
          type: 'string',
          description: 'Path for the resilient backup file',
        },
      },
      required: ['backupPath'],
    },
  },

  // Privacy and Security Tools
  get_privacy_stats: {
    name: 'get_privacy_stats',
    title: 'Get Privacy Stats',
    description: 'Get privacy and security statistics including audit entries, access attempts, and compliance status',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  get_privacy_config: {
    name: 'get_privacy_config',
    title: 'Get Privacy Config',
    description: 'Get current privacy configuration settings including encryption, access controls, and compliance settings',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  update_privacy_config: {
    name: 'update_privacy_config',
    title: 'Update Privacy Config',
    description: 'Update privacy configuration settings for encryption, access controls, audit trails, and compliance',
    inputSchema: {
      type: 'object',
      properties: {
        config: {
          type: 'object',
          description: 'Privacy configuration to update',
        },
      },
      required: ['config'],
    },
  },

  check_access: {
    name: 'check_access',
    title: 'Check Access',
    description: 'Check if a user has access to perform an operation in a specific context',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID to check access for',
        },
        operation: {
          type: 'string',
          description: 'Operation to check access for',
        },
        context: {
          type: 'string',
          description: 'Context to check access in',
        },
      },
      required: ['userId', 'operation', 'context'],
    },
  },

  set_access_control: {
    name: 'set_access_control',
    title: 'Set Access Control',
    description: 'Set access control permissions for a user across specified contexts',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID to set access control for',
        },
        permissions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Permissions to grant to the user',
        },
        contexts: {
          type: 'array',
          items: { type: 'string' },
          description: 'Contexts to grant access to',
        },
        expiresAt: {
          type: 'string',
          description: 'Expiration date for access control (ISO string)',
        },
      },
      required: ['userId', 'permissions', 'contexts'],
    },
  },

  remove_access_control: {
    name: 'remove_access_control',
    title: 'Remove Access Control',
    description: 'Remove access control for a user',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID to remove access control for',
        },
      },
      required: ['userId'],
    },
  },

  unlock_account: {
    name: 'unlock_account',
    title: 'Unlock Account',
    description: 'Unlock a user account that has been locked due to failed access attempts',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID to unlock',
        },
      },
      required: ['userId'],
    },
  },

  check_compliance: {
    name: 'check_compliance',
    title: 'Check Compliance',
    description: 'Check compliance status for GDPR, CCPA, and HIPAA regulations',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  apply_retention_policy: {
    name: 'apply_retention_policy',
    title: 'Apply Retention Policy',
    description: 'Apply data retention policy to clean up old data according to configured settings',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  cleanup_audit_logs: {
    name: 'cleanup_audit_logs',
    title: 'Cleanup Audit Logs',
    description: 'Clean up old audit log entries based on retention settings',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  encrypt_data: {
    name: 'encrypt_data',
    title: 'Encrypt Data',
    description: 'Encrypt sensitive data using configured encryption settings',
    inputSchema: {
      type: 'object',
      properties: {
        data: {
          type: 'string',
          description: 'Data to encrypt',
        },
      },
      required: ['data'],
    },
  },

  decrypt_data: {
    name: 'decrypt_data',
    title: 'Decrypt Data',
    description: 'Decrypt previously encrypted data',
    inputSchema: {
      type: 'object',
      properties: {
        encryptedData: {
          type: 'string',
          description: 'Encrypted data to decrypt',
        },
      },
      required: ['encryptedData'],
    },
  },

  anonymize_data: {
    name: 'anonymize_data',
    title: 'Anonymize Data',
    description: 'Anonymize data for privacy protection with configurable levels',
    inputSchema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          description: 'Data to anonymize',
        },
        level: {
          type: 'string',
          enum: ['none', 'partial', 'full'],
          description: 'Anonymization level (default: partial)',
          default: 'partial',
        },
      },
      required: ['data'],
    },
  },

  validate_input: {
    name: 'validate_input',
    title: 'Validate Input',
    description: 'Validate input data for security threats and suspicious patterns',
    inputSchema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          description: 'Data to validate for security threats',
        },
      },
      required: ['data'],
    },
  },

  sanitize_output: {
    name: 'sanitize_output',
    title: 'Sanitize Output',
    description: 'Sanitize output data to remove potentially dangerous content',
    inputSchema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          description: 'Data to sanitize',
        },
      },
      required: ['data'],
    },
  },

  // Memory Export/Import Tools
  export_memory: {
    name: 'export_memory',
    title: 'Export Memory',
    description: 'Export all entities, relations, and observations as a versioned JSON stream for migration and backup',
    inputSchema: {
      type: 'object',
      properties: {
        context: {
          type: 'string',
          description: 'Optional: specific context to export (default: all contexts)',
        },
        format: {
          type: 'string',
          enum: ['json', 'jsonl', 'compressed'],
          description: 'Export format (default: json)',
          default: 'json',
        },
        includeMetadata: {
          type: 'boolean',
          description: 'Include metadata like creation dates, prominence scores, etc. (default: true)',
          default: true,
        },
        includeObservations: {
          type: 'boolean',
          description: 'Include entity observations and content (default: true)',
          default: true,
        },
        includeRelations: {
          type: 'boolean',
          description: 'Include entity relations (default: true)',
          default: true,
        },
        filterByDate: {
          type: 'object',
          description: 'Filter entities by date range',
          properties: {
            from: {
              type: 'string',
              description: 'Start date (ISO string)',
            },
            to: {
              type: 'string',
              description: 'End date (ISO string)',
            },
          },
        },
        filterByEntityType: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by specific entity types',
        },
        exportVersion: {
          type: 'string',
          description: 'Export format version for compatibility (default: current)',
          default: '3.0.0',
        },
        targetServer: {
          type: 'string',
          description: 'Target server type for migration (mem100x, generic, etc.)',
        },
        compressionLevel: {
          type: 'number',
          description: 'Compression level 0-9 (default: 6)',
          default: 6,
        },
      },
    },
  },

  import_memory: {
    name: 'import_memory',
    title: 'Import Memory',
    description: 'Import entities, relations, and observations from a versioned export with migration support',
    inputSchema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          description: 'Export data to import (from export_memory tool)',
        },
        context: {
          type: 'string',
          description: 'Optional: target context for import (default: auto-detect or create)',
        },
        importMode: {
          type: 'string',
          enum: ['merge', 'replace', 'update', 'append'],
          description: 'Import mode: merge (default), replace, update existing, or append only',
          default: 'merge',
        },
        conflictResolution: {
          type: 'string',
          enum: ['skip', 'overwrite', 'rename', 'merge'],
          description: 'How to handle conflicts with existing entities (default: merge)',
          default: 'merge',
        },
        validateBeforeImport: {
          type: 'boolean',
          description: 'Validate data integrity before importing (default: true)',
          default: true,
        },
        dryRun: {
          type: 'boolean',
          description: 'Perform a dry run without actually importing (default: false)',
          default: false,
        },
        sourceVersion: {
          type: 'string',
          description: 'Source version for migration compatibility',
        },
        sourceServer: {
          type: 'string',
          description: 'Source server type for migration',
        },
        migrationOptions: {
          type: 'object',
          description: 'Migration-specific options',
          properties: {
            preserveIds: {
              type: 'boolean',
              description: 'Preserve original entity IDs if possible',
              default: false,
            },
            updateTimestamps: {
              type: 'boolean',
              description: 'Update timestamps to current time',
              default: true,
            },
            remapEntityTypes: {
              type: 'object',
              description: 'Map source entity types to target types',
            },
            remapRelationTypes: {
              type: 'object',
              description: 'Map source relation types to target types',
            },
            filterContent: {
              type: 'object',
              description: 'Filter content during import',
              properties: {
                includeText: { type: 'boolean', default: true },
                includeImages: { type: 'boolean', default: true },
                includeAudio: { type: 'boolean', default: true },
                includeResources: { type: 'boolean', default: true },
              },
            },
          },
        },
        batchSize: {
          type: 'number',
          description: 'Batch size for import operations (default: 1000)',
          default: 1000,
        },
        progressCallback: {
          type: 'boolean',
          description: 'Enable progress callbacks during import (default: true)',
          default: true,
        },
      },
      required: ['data'],
    },
  },
};

/**
 * Get all tool definitions as an array with safety info applied
 */
export function getAllToolDefinitions(): MCPToolDefinition[] {
  const defs = Object.entries(TOOL_DEFINITIONS).map(([name, def]) => addDestructiveSafetyInfo(def, name));
  return defs;
}

/**
 * Get a specific tool definition by name
 */
export function getToolDefinition(name: string): MCPToolDefinition | undefined {
  return TOOL_DEFINITIONS[name];
}
