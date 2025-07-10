#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { MemoryDatabase } from './database.js';
import { homedir } from 'os';
import { join } from 'path';
import { stringifyToolResponse } from './utils/fast-json.js';
import { getAllToolDefinitions } from './tool-definitions.js';
import { MCPToolResponse } from './mcp-types.js';

async function main() {
  // Initialize high-performance SQLite database
  const dbPath = process.env.MEMORY_DB || join(homedir(), '.mem100x', 'memory.db');
  const db = new MemoryDatabase(dbPath);

  const server = new Server(
    {
      name: 'mem100x',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: getAllToolDefinitions(),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'create_entities': {
          const { entities } = args as { entities: any[] };
          const startTime = performance.now();
          
          const created = db.createEntities(entities);
          
          const duration = performance.now() - startTime;
          const rate = Math.round(entities.length / (duration / 1000));
          
          return {
            content: [
              {
                type: 'text',
                text: stringifyToolResponse({
                  created,
                  performance: {
                    duration: `${duration.toFixed(2)}ms`,
                    rate: `${rate} entities/sec`
                  }
                }),
              },
            ],
          };
        }

        case 'search_nodes': {
          const { query, limit } = args as { query: string; limit?: number };
          const startTime = performance.now();
          
          const results = db.searchNodes({ query, limit });
          
          const duration = performance.now() - startTime;
          
          return {
            content: [
              {
                type: 'text',
                text: stringifyToolResponse({
                  ...results,
                  performance: {
                    duration: `${duration.toFixed(2)}ms`,
                    resultCount: results.entities.length
                  }
                }),
              },
            ],
          };
        }

        case 'read_graph': {
          const { limit } = args as { limit?: number };
          const startTime = performance.now();
          
          const graph = db.readGraph(limit, 0);
          
          const duration = performance.now() - startTime;
          
          return {
            content: [
              {
                type: 'text',
                text: stringifyToolResponse({
                  ...graph,
                  performance: {
                    duration: `${duration.toFixed(2)}ms`,
                    entityCount: graph.entities.length,
                    relationCount: graph.relations.length
                  }
                }),
              },
            ],
          };
        }

        case 'create_relations': {
          const { relations } = args as { relations: any[] };
          const startTime = performance.now();
          
          const created = db.createRelations(relations);
          
          const duration = performance.now() - startTime;
          const rate = Math.round(relations.length / (duration / 1000));
          
          return {
            content: [
              {
                type: 'text',
                text: stringifyToolResponse({
                  created,
                  performance: {
                    duration: `${duration.toFixed(2)}ms`,
                    rate: `${rate} relations/sec`
                  }
                }),
              },
            ],
          };
        }

        case 'add_observations': {
          const { observations } = args as { observations: any[] };
          const startTime = performance.now();
          
          db.addObservations(observations);
          
          const duration = performance.now() - startTime;
          
          return {
            content: [
              {
                type: 'text',
                text: stringifyToolResponse({
                  success: true,
                  observationsAdded: observations.length,
                  performance: {
                    duration: `${duration.toFixed(2)}ms`
                  }
                }),
              },
            ],
          };
        }

        case 'delete_entities': {
          const { entityNames } = args as { entityNames: string[] };
          const startTime = performance.now();
          
          db.deleteEntities(entityNames);
          
          const duration = performance.now() - startTime;
          
          return {
            content: [
              {
                type: 'text',
                text: stringifyToolResponse({
                  success: true,
                  deletedCount: entityNames.length,
                  performance: {
                    duration: `${duration.toFixed(2)}ms`
                  }
                }),
              },
            ],
          };
        }

        case 'delete_observations': {
          const { deletions } = args as { deletions: any[] };
          const startTime = performance.now();
          
          db.deleteObservations(deletions);
          
          const duration = performance.now() - startTime;
          
          return {
            content: [
              {
                type: 'text',
                text: stringifyToolResponse({
                  success: true,
                  deletionsProcessed: deletions.length,
                  performance: {
                    duration: `${duration.toFixed(2)}ms`
                  }
                }),
              },
            ],
          };
        }

        case 'delete_relations': {
          const { relations } = args as { relations: any[] };
          const startTime = performance.now();
          
          db.deleteRelations(relations);
          
          const duration = performance.now() - startTime;
          
          return {
            content: [
              {
                type: 'text',
                text: stringifyToolResponse({
                  success: true,
                  deletedCount: relations.length,
                  performance: {
                    duration: `${duration.toFixed(2)}ms`
                  }
                }),
              },
            ],
          };
        }

        case 'open_nodes': {
          const { names } = args as { names: string[] };
          const startTime = performance.now();
          
          const results = db.openNodes(names);
          
          const duration = performance.now() - startTime;
          
          return {
            content: [
              {
                type: 'text',
                text: stringifyToolResponse({
                  ...results,
                  performance: {
                    duration: `${duration.toFixed(2)}ms`,
                    requestedCount: names.length,
                    foundCount: results.entities.length
                  }
                }),
              },
            ],
          };
        }

        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${name}`
          );
      }
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  });

  // Global error handlers
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    console.error('Stack:', error.stack);
    db.close();
    // Give time for error to be logged before exiting
    setTimeout(() => process.exit(1), 100);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise);
    console.error('Reason:', reason);
    db.close();
    // Give time for error to be logged before exiting
    setTimeout(() => process.exit(1), 100);
  });

  const transport = new StdioServerTransport();
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.error('Shutting down gracefully...');
    db.close();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.error('Shutting down gracefully...');
    db.close();
    process.exit(0);
  });
  
  await server.connect(transport);
  console.error('⚡ Mem100x MCP server started - The fastest memory server in the universe!');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
