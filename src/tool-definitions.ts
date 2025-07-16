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
