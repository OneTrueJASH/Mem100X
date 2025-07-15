#!/usr/bin/env node

// Add comprehensive stdio diagnostics
process.stdout.write('[Mem100x] STDOUT: Server process started\n');
process.stderr.write('[Mem100x] STDERR: Server process started\n');

// Echo every line received on stdin (for debugging)
process.stdin.on('data', (chunk) => {
  process.stderr.write(
    '[Mem100x] STDIN RECEIVED: ' + chunk.toString().replace(/\n/g, '\\n') + '\n'
  );
});

// Log process events
process.on('uncaughtException', (error) => {
  process.stderr.write('[Mem100x] UNCAUGHT EXCEPTION: ' + error.message + '\n');
});

process.on('unhandledRejection', (reason, promise) => {
  process.stderr.write('[Mem100x] UNHANDLED REJECTION: ' + String(reason) + '\n');
});

import { Server } from '@modelcontextprotocol/sdk/server/index'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio'
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types'
import { MemoryDatabase } from './database.js'
import { homedir } from 'os';
import { join } from 'path';
import { stringifyToolResponse } from './utils/fast-json.js'
import { getAllToolDefinitions } from './tool-definitions.js'
import { createTextContent } from './utils/fast-json.js'
import { toolSchemas, AddObservationsInput, CreateRelationsInput } from './tool-schemas.js'

async function main() {
  process.stderr.write('[Mem100x] Starting main function\n');

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

  process.stderr.write('[Mem100x] Server created, registering handlers\n');

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    process.stderr.write('[Mem100x] ListToolsRequestSchema handler called\n');
    const result = {
      tools: getAllToolDefinitions(),
    };
    process.stderr.write(
      '[Mem100x] ListToolsRequestSchema returning: ' +
        JSON.stringify(result).substring(0, 200) +
        '...\n'
    );
    return result;
  });

  // Register handler for MCP protocol method
  const toolHandler = async (request: any) => {
    process.stderr.write('[Mem100x] ToolHandler called with method: ' + request.method + '\n');
    process.stderr.write(
      '[Mem100x] ToolHandler params: ' + JSON.stringify(request.params).substring(0, 200) + '...\n'
    );

    const fs = require('fs');
    const logPath = '/tmp/mem100x-calltool.log';
    try {
      fs.appendFileSync(
        logPath,
        `[${new Date().toISOString()}] [${request.method}] Received tool call: ${JSON.stringify(request)}\n`
      );
    } catch (e) {}
    const { name, arguments: args } = request.params;
    // The rest of the handler logic is identical to the CallToolRequestSchema handler
    try {
      process.stderr.write('[Mem100x] Processing tool: ' + name + '\n');

      switch (name) {
        case 'create_entities': {
          // Map MCP-standard 'content' to internal 'observations'
          const entities = args.entities.map((entity: any) => ({
            ...entity,
            observations: entity.content,
          }));
          const validated = toolSchemas.create_entities.parse({ ...args, entities });
          const startTime = performance.now();

          const created = db.createEntities(entities);

          const duration = performance.now() - startTime;
          const rate = Math.round(validated.entities.length / (duration / 1000));

          const structuredContent = {
            created,
            performance: {
              duration: `${duration.toFixed(2)}ms`,
              rate: `${rate} entities/sec`,
            },
          };

          const response = {
            content: [createTextContent(`Created ${created.length} entities successfully`)],
            structuredContent,
          };

          process.stderr.write(
            '[Mem100x] create_entities response: ' +
              JSON.stringify(response).substring(0, 200) +
              '...\n'
          );
          return response;
        }
        case 'search_nodes': {
          const validated = toolSchemas.search_nodes.parse(args);
          const startTime = performance.now();

          const results = db.searchNodes({ query: validated.query, limit: validated.limit });

          const duration = performance.now() - startTime;

          const structuredContent = {
            ...results,
            performance: {
              duration: `${duration.toFixed(2)}ms`,
              resultCount: results.entities.length,
            },
          };

          const response = {
            content: [
              createTextContent(
                `Found ${results.entities.length} entities matching "${validated.query}"`
              ),
            ],
            structuredContent,
          };

          process.stderr.write(
            '[Mem100x] search_nodes response: ' +
              JSON.stringify(response).substring(0, 200) +
              '...\n'
          );
          return response;
        }
        case 'read_graph': {
          const fs = require('fs');
          const logPath = '/tmp/mem100x-read-graph.log';
          try {
            fs.appendFileSync(
              logPath,
              `[${new Date().toISOString()}] Entered read_graph handler\n`
            );
            const validated = toolSchemas.read_graph.parse(args);
            fs.appendFileSync(
              logPath,
              `[${new Date().toISOString()}] Parsed args: ${JSON.stringify(validated)}\n`
            );
            const startTime = performance.now();

            const graph = db.readGraph(validated.limit, validated.offset || 0);
            fs.appendFileSync(logPath, `[${new Date().toISOString()}] db.readGraph returned\n`);

            const duration = performance.now() - startTime;

            const structuredContent = {
              ...graph,
              performance: {
                duration: `${duration.toFixed(2)}ms`,
                entityCount: graph.entities.length,
                relationCount: graph.relations.length,
              },
            };

            const response = {
              content: [
                createTextContent(
                  `Graph contains ${graph.entities.length} entities and ${graph.relations.length} relations`
                ),
              ],
              structuredContent,
            };

            fs.appendFileSync(logPath, `[${new Date().toISOString()}] Returning response\n`);
            process.stderr.write(
              '[Mem100x] read_graph response: ' +
                JSON.stringify(response).substring(0, 200) +
                '...\n'
            );
            return response;
          } catch (err: any) {
            fs.appendFileSync(
              logPath,
              `[${new Date().toISOString()}] ERROR: ${err && err.stack ? err.stack : err}\n`
            );
            process.stderr.write('[Mem100x] read_graph ERROR: ' + err.message + '\n');
            throw err;
          }
        }
        case 'create_relations': {
          const validated = toolSchemas.create_relations.parse(args) as CreateRelationsInput;
          const startTime = performance.now();

          const created = db.createRelations(validated.relations);

          const duration = performance.now() - startTime;
          const rate = Math.round(validated.relations.length / (duration / 1000));

          const structuredContent = {
            created,
            performance: {
              duration: `${duration.toFixed(2)}ms`,
              rate: `${rate} relations/sec`,
            },
          };

          const response = {
            content: [createTextContent(`Created ${created.length} relations successfully`)],
            structuredContent,
          };

          process.stderr.write(
            '[Mem100x] create_relations response: ' +
              JSON.stringify(response).substring(0, 200) +
              '...\n'
          );
          return response;
        }
        case 'add_observations': {
          // Map MCP-standard 'content' to internal 'contents'
          const updates = args.updates.map((update: any) => ({
            ...update,
            contents: update.content,
          }));
          const validated = toolSchemas.add_observations.parse({ updates });
          const startTime = performance.now();

          db.addObservations(updates);

          const duration = performance.now() - startTime;

          const structuredContent = {
            success: true,
            observationsAdded: validated.updates.length,
            performance: {
              duration: `${duration.toFixed(2)}ms`,
            },
          };

          const response = {
            content: [
              createTextContent(
                `Added observations to ${validated.updates.length} entities successfully`
              ),
            ],
            structuredContent,
          };

          process.stderr.write(
            '[Mem100x] add_observations response: ' +
              JSON.stringify(response).substring(0, 200) +
              '...\n'
          );
          return response;
        }
        case 'delete_entities': {
          const validated = toolSchemas.delete_entities.parse(args);
          const startTime = performance.now();

          db.deleteEntities(validated.entityNames);

          const duration = performance.now() - startTime;

          const structuredContent = {
            success: true,
            deletedCount: validated.entityNames.length,
            performance: {
              duration: `${duration.toFixed(2)}ms`,
            },
          };

          const response = {
            content: [
              createTextContent(`Deleted ${validated.entityNames.length} entities successfully`),
            ],
            structuredContent,
          };

          process.stderr.write(
            '[Mem100x] delete_entities response: ' +
              JSON.stringify(response).substring(0, 200) +
              '...\n'
          );
          return response;
        }
        case 'delete_observations': {
          // Map MCP-standard 'content' to internal 'observations'
          const deletions = args.deletions.map((del: any) => ({
            ...del,
            observations: del.content,
          }));
          const validated = toolSchemas.delete_observations.parse({ deletions });
          const startTime = performance.now();

          db.deleteObservations(deletions);

          const duration = performance.now() - startTime;

          const structuredContent = {
            success: true,
            deletionsProcessed: validated.deletions.length,
            performance: {
              duration: `${duration.toFixed(2)}ms`,
            },
          };

          const response = {
            content: [
              createTextContent(
                `Deleted observations from ${validated.deletions.length} entities successfully`
              ),
            ],
            structuredContent,
          };

          process.stderr.write(
            '[Mem100x] delete_observations response: ' +
              JSON.stringify(response).substring(0, 200) +
              '...\n'
          );
          return response;
        }
        case 'delete_relations': {
          const validated = toolSchemas.delete_relations.parse(args);
          const startTime = performance.now();

          db.deleteRelations(validated.relations);

          const duration = performance.now() - startTime;

          const structuredContent = {
            success: true,
            deletedCount: validated.relations.length,
            performance: {
              duration: `${duration.toFixed(2)}ms`,
            },
          };

          const response = {
            content: [
              createTextContent(`Deleted ${validated.relations.length} relations successfully`),
            ],
            structuredContent,
          };

          process.stderr.write(
            '[Mem100x] delete_relations response: ' +
              JSON.stringify(response).substring(0, 200) +
              '...\n'
          );
          return response;
        }
        case 'open_nodes': {
          const validated = toolSchemas.open_nodes.parse(args);
          const startTime = performance.now();

          const results = db.openNodes(validated.names);

          const duration = performance.now() - startTime;

          const structuredContent = {
            ...results,
            performance: {
              duration: `${duration.toFixed(2)}ms`,
              requestedCount: validated.names.length,
              foundCount: results.entities.length,
            },
          };

          const response = {
            content: [
              createTextContent(
                `Opened ${results.entities.length} entities and found ${results.relations.length} relations`
              ),
            ],
            structuredContent,
          };

          process.stderr.write(
            '[Mem100x] open_nodes response: ' + JSON.stringify(response).substring(0, 200) + '...\n'
          );
          return response;
        }
        default:
          process.stderr.write('[Mem100x] Unknown tool: ' + name + '\n');
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }
    } catch (error) {
      process.stderr.write(
        '[Mem100x] ToolHandler ERROR: ' +
          (error instanceof Error ? error.message : String(error)) +
          '\n'
      );
      // Always return a valid MCP response structure
      return {
        content: [
          createTextContent(`Error: ${error instanceof Error ? error.message : String(error)}`),
        ],
        structuredContent: { error: error instanceof Error ? error.message : String(error) },
      };
    }
  };

  // Register handler for MCP protocol method
  server.setRequestHandler(CallToolRequestSchema, toolHandler);

  process.stderr.write('[Mem100x] Handlers registered, setting up transport\n');

  // Global error handlers
  process.on('uncaughtException', (error) => {
    process.stderr.write('[Mem100x] UNCAUGHT EXCEPTION: ' + error.message + '\n');
    console.error('Uncaught Exception:', error);
    console.error('Stack:', error.stack);
    db.close();
    // Give time for error to be logged before exiting
    setTimeout(() => process.exit(1), 100);
  });

  process.on('unhandledRejection', (reason, promise) => {
    process.stderr.write('[Mem100x] UNHANDLED REJECTION: ' + String(reason) + '\n');
    console.error('Unhandled Rejection at:', promise);
    console.error('Reason:', reason);
    db.close();
    // Give time for error to be logged before exiting
    setTimeout(() => process.exit(1), 100);
  });

  const transport = new StdioServerTransport();

  process.stderr.write('[Mem100x] Transport created, connecting server\n');

  // Graceful shutdown
  process.on('SIGINT', () => {
    process.stderr.write('[Mem100x] SIGINT received, shutting down\n');
    console.error('Shutting down gracefully...');
    db.close();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    process.stderr.write('[Mem100x] SIGTERM received, shutting down\n');
    console.error('Shutting down gracefully...');
    db.close();
    process.exit(0);
  });

  await server.connect(transport);
  process.stderr.write('[Mem100x] Server connected successfully\n');
  console.error('⚡ Mem100x MCP server started - The fastest memory server in the universe!');
}

main().catch((error) => {
  process.stderr.write('[Mem100x] Main function ERROR: ' + error.message + '\n');
  console.error('Server error:', error);
  process.exit(1);
});
