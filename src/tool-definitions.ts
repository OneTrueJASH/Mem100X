/**
 * MCP Tool Definitions
 * Centralized tool metadata for all Mem100x tools
 */

import { MCPToolDefinition } from './mcp-types.js';
import { addDestructiveSafetyInfo } from './utils/destructive-ops.js';

export const TOOL_DEFINITIONS: Record<string, MCPToolDefinition> = {
  set_context: {
    name: 'set_context',
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
    description: 'Get information about available contexts and current state',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  create_entities: {
    name: 'create_entities',
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

  read_graph: {
    name: 'read_graph',
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

  // System resilience tools
  get_resilience_stats: {
    name: 'get_resilience_stats',
    description: 'Get system resilience statistics including transaction success rates, recovery actions, and integrity checks',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  get_transaction_logs: {
    name: 'get_transaction_logs',
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
    description: 'Get list of recovery actions taken by the system for data integrity and corruption repair',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  detect_and_repair_corruption: {
    name: 'detect_and_repair_corruption',
    description: 'Detect and automatically repair data corruption issues across the system',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  validate_data_integrity: {
    name: 'validate_data_integrity',
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
    description: 'Get privacy and security statistics including audit entries, access attempts, and compliance status',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  get_privacy_config: {
    name: 'get_privacy_config',
    description: 'Get current privacy configuration settings including encryption, access controls, and compliance settings',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  update_privacy_config: {
    name: 'update_privacy_config',
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
    description: 'Check compliance status for GDPR, CCPA, and HIPAA regulations',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  apply_retention_policy: {
    name: 'apply_retention_policy',
    description: 'Apply data retention policy to clean up old data according to configured settings',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  cleanup_audit_logs: {
    name: 'cleanup_audit_logs',
    description: 'Clean up old audit log entries based on retention settings',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  encrypt_data: {
    name: 'encrypt_data',
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
};

/**
 * Get all tool definitions as an array with safety info applied
 */
export function getAllToolDefinitions(): MCPToolDefinition[] {
  return Object.entries(TOOL_DEFINITIONS).map(([name, def]) => addDestructiveSafetyInfo(def, name));
}

/**
 * Get a specific tool definition by name
 */
export function getToolDefinition(name: string): MCPToolDefinition | undefined {
  return TOOL_DEFINITIONS[name];
}
