#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { MultiDatabaseManager } from './multi-database.js';
import { toolHandlers, ToolContext } from './tool-handlers.js';
import { getAllToolDefinitions } from './tool-definitions.js';
import { stringifyGeneric } from './utils/fast-json.js';
import { logger, logError, logInfo } from './utils/logger.js';
import { config } from './config.js';
import { CircuitBreaker } from './utils/circuit-breaker.js';

export async function main() {
  logInfo('Starting Mem100x Multi-Context MCP server...');

  const manager = new MultiDatabaseManager(config);
  logInfo('MultiDatabaseManager initialized.');
  
  // Create circuit breakers for each tool
  const circuitBreakers = new Map<string, CircuitBreaker>();
  const criticalTools = ['create_entities', 'add_observations', 'create_relations'];
  
  for (const toolName of Object.keys(toolHandlers)) {
    // More strict settings for critical write operations
    const options = criticalTools.includes(toolName) 
      ? { failureThreshold: 3, resetTimeout: 10000, halfOpenMaxAttempts: 2 }
      : { failureThreshold: 5, resetTimeout: 5000, halfOpenMaxAttempts: 3 };
      
    circuitBreakers.set(toolName, new CircuitBreaker(options));
  }

  const server = new Server(
    {
      name: 'mem100x-multi',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: getAllToolDefinitions() };
  });

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      const handler = toolHandlers[name];
      if (!handler) {
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }
      
      const circuitBreaker = circuitBreakers.get(name);
      if (!circuitBreaker) {
        throw new McpError(ErrorCode.InternalError, `No circuit breaker for tool: ${name}`);
      }
      
      // Execute through circuit breaker
      const result = await circuitBreaker.execute(async () => {
        const context: ToolContext = {
          manager,
          startTime: performance.now(),
          toolName: name,
        };
        return handler(args, context);
      });
      
      return {
        content: [{ type: 'text', text: stringifyGeneric(result, true) }],
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      
      // Handle circuit breaker open state
      if (error instanceof Error && error.message.includes('Circuit breaker is open')) {
        const breaker = circuitBreakers.get(name);
        const stats = breaker?.getStats();
        logError(`Circuit breaker open for ${name}`, error, { stats });
        throw new McpError(
          ErrorCode.InternalError, 
          `Service temporarily unavailable for ${name} - too many failures. Please retry in a few seconds.`
        );
      }
      
      if (error && typeof error === 'object' && 'issues' in error) {
        const zodError = error as any;
        const issues = zodError.issues.map((issue: any) => `${issue.path.join('.')}: ${issue.message}`).join(', ');
        throw new McpError(ErrorCode.InvalidParams, `Invalid parameters for ${name}: ${issues}`);
      }
      logError(`Error executing tool: ${name}`, error as Error, { args });
      throw new McpError(ErrorCode.InternalError, `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  // Graceful shutdown handler
  const shutdown = async (signal: string) => {
    logInfo(`Received ${signal}. Shutting down gracefully...`);
    try {
      await server.close();
      logInfo('MCP server closed.');
      manager.closeAll();
      logInfo('All databases closed.');
      process.exit(0);
    } catch (error) {
      logError('Error during shutdown', error as Error);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  
  process.on('uncaughtException', (error) => {
    logError('Uncaught Exception', error);
    shutdown('uncaughtException').catch(console.error);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logError('Unhandled Rejection', new Error(String(reason)), { promise });
    shutdown('unhandledRejection').catch(console.error);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  logInfo('Mem100x Multi-Context MCP server running on stdio');
}

// Only run if this is the main module
if (require.main === module) {
  main().catch((error) => {
    logError('Fatal error during startup', error as Error);
    process.exit(1);
  });
}
