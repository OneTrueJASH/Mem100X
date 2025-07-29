#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  InitializeRequestSchema,
  InitializedNotificationSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { MultiDatabaseManager } from './multi-database.js'
import { toolHandlers, ToolContext } from './tool-handlers.js'
import { getAllToolDefinitions } from './tool-definitions.js'
import { stringifyGeneric, createTextContent } from './utils/fast-json.js'
import { logger, logError, logInfo } from './utils/logger.js'
import { config } from './config.js'
import { generateEnvFile } from './config.js';
import { createCircuitBreaker, CircuitBreaker } from './utils/circuit-breaker.js'
import { ZeroDelayWriteAggregator } from './utils/zero-delay-aggregator.js'
import { mapErrorToMcpCode,  createMcpError } from './utils/mcp-errors.js';
import { formatErrorForUser } from './utils/error-messages.js';
import { validateToolInput } from './utils/input-validation.js'
import { validateDestructiveOperation } from './utils/destructive-ops.js'
import { createRateLimiters, getRateLimiterForTool } from './utils/rate-limiter.js'
import * as fs from 'fs';
import { readFileSync } from 'fs';
import * as readline from 'node:readline';
import { isJSONRPCRequest, isJSONRPCNotification, isJSONRPCResponse, isJSONRPCError } from '@modelcontextprotocol/sdk/types.js';

// Helper function to map ErrorCode string to JSON-RPC code
function errorCodeToJsonRpcCode(code: string): number {
  switch (code) {
    case 'invalid_params': return -32602;
    case 'invalid_request': return -32600;
    case 'method_not_found': return -32601;
    case 'internal_error': return -32603;
    case 'rate_limited':
    case 'not_found':
    case 'permission_denied':
    default: return -32000;
  }
}

// Helper to get the server version from package.json
function getServerVersion() {
  try {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));
    return pkg.version || 'unknown';
  } catch {
    return 'unknown';
  }
}

// Helper to make JSON-RPC error responses
function makeJsonRpcError(id: string | number | null, code: number, message: string, data?: unknown) {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
      data,
    },
  };
}

// Subclass the SDK Server to expose a public handler for JSON-RPC messages
class PublicServer extends Server {
  public async handleJsonRpcMessage(msg: any): Promise<any> {
    if (!msg || typeof msg !== 'object') {
      const err = makeJsonRpcError(null, -32600, 'Invalid Request', 'Not an object');
      // Debug: confirm emission
      console.error('[MCP RESP ERR]', err);
      console.log(JSON.stringify(err));
      return err;
    }
    if (!msg.jsonrpc || msg.jsonrpc !== '2.0') {
      const err = makeJsonRpcError(msg.id ?? null, -32600, 'Invalid Request', 'jsonrpc must be "2.0"');
      // Debug: confirm emission
      console.error('[MCP RESP ERR]', err);
      console.log(JSON.stringify(err));
      return err;
    }
    if (isJSONRPCRequest(msg)) {
      // Requests (with id and method)
      const handler = (this as any)._requestHandlers.get(msg.method);
      if (!handler) {
        const err = makeJsonRpcError(msg.id ?? null, ErrorCode.MethodNotFound, 'Method not found', { method: msg.method });
        // Debug: confirm emission
        console.error('[MCP RESP ERR]', err);
        console.log(JSON.stringify(err));
        return err;
      }
      try {
        const result = await handler(msg, undefined);
        const resp = { jsonrpc: '2.0', id: msg.id, result };
        // Debug: confirm emission
        console.error('[MCP RESP OK]', resp);
        console.log(JSON.stringify(resp));
        return resp;
      } catch (error: any) {
        const err = makeJsonRpcError(msg.id ?? null, error.code ?? -32603, error.message ?? 'Internal error', error.data);
        // Debug: confirm emission
        console.error('[MCP RESP ERR]', err);
        console.log(JSON.stringify(err));
        return err;
      }
    } else if (isJSONRPCNotification(msg)) {
      // Notifications (no id)
      const handler = (this as any)._notificationHandlers.get(msg.method);
      if (handler) {
        try {
          await handler(msg);
        } catch (error) {
          // Notifications do not send responses
        }
      }
      return undefined;
    } else if (isJSONRPCResponse(msg) || isJSONRPCError(msg)) {
      // Responses/errors (should not be sent to server, but handle gracefully)
      // No-op
      return undefined;
    } else {
      const err = makeJsonRpcError(msg.id ?? null, -32600, 'Invalid Request', 'Unknown message type');
      // Debug: confirm emission
      console.error('[MCP RESP ERR]', err);
      console.log(JSON.stringify(err));
      return err;
    }
  }
}

// Patch: Add debug logs to PublicServer handler
class DebugPublicServer extends PublicServer {
  constructor(serverInfo: any, serverOptions: any) {
    super(serverInfo, serverOptions);
  }
  public async handleJsonRpcMessage(msg: any): Promise<any> {
    console.error('[HANDLE] called with:', msg);
    const result = await super.handleJsonRpcMessage(msg);
    console.error('[HANDLE] returning:', result);
    return result;
  }
}

export async function main() {
  // Check for --print-defaults flag
  if (process.argv.includes('--print-defaults')) {
    console.log(generateEnvFile());
    process.exit(0);
  }

  // Unconditional debug: server startup
  console.error('SERVER READY');

  logInfo('Starting Mem100x Multi-Context MCP server...');

  const manager = new MultiDatabaseManager(config);
  logInfo('MultiDatabaseManager initialized.');

  // Create zero-delay write aggregator for minimal-overhead batching
  const writeAggregator = new ZeroDelayWriteAggregator(manager);
  logInfo('Zero-delay write aggregator initialized.');

  // Create rate limiters (can be disabled for benchmarks)
  const rateLimitingEnabled = process.env.DISABLE_RATE_LIMITING !== 'true';
  const rateLimiters = rateLimitingEnabled ? createRateLimiters() : null;
  logInfo(rateLimitingEnabled ? 'Rate limiters initialized.' : 'Rate limiting disabled.');

  // Create circuit breakers for each tool
  const circuitBreakers = new Map<string, CircuitBreaker>();
  const criticalTools = ['create_entities', 'add_observations', 'create_relations'];
  const writeTools = ['create_entities', 'add_observations', 'create_relations', 'delete_entities'];
  const readTools = ['search_nodes', 'read_graph', 'get_context_info'];

  for (const toolName of Object.keys(toolHandlers)) {
    // More strict settings for critical write operations
    const options = criticalTools.includes(toolName)
      ? { failureThreshold: 3, resetTimeout: 10000, halfOpenMaxAttempts: 2 }
      : { failureThreshold: 5, resetTimeout: 5000, halfOpenMaxAttempts: 3 };

    circuitBreakers.set(toolName, createCircuitBreaker({
      failureThreshold: options.failureThreshold,
      recoveryTimeout: options.resetTimeout,
      expectedVolume: 1000,
      enableBulkOperations: true
    }));
  }

  const serverInfo = {
    name: 'mem100x-multi',
    version: '3.0.1', // Use actual package version
  };

  // Build the tools capability object with proper type
  const toolsCapability: Record<string, any> = {};
  for (const toolDef of getAllToolDefinitions()) {
    toolsCapability[toolDef.name] = {
      description: toolDef.description,
      parameters: toolDef.inputSchema ? {
        type: 'object',
        properties: toolDef.inputSchema.properties,
        required: toolDef.inputSchema.required,
      } : undefined,
    };
  }

  const serverOptions = {
    capabilities: {
      tools: toolsCapability,
      resources: {},
      prompts: {
        initialize: {
          description: 'Negotiate protocol version with the client.',
          parameters: {
            type: 'object',
            properties: {
              version: {
                type: 'string',
                description: 'Client\'s requested protocol version (e.g., "1.0.0").',
              },
              protocolVersion: {
                type: 'string',
                description: 'Client\'s requested protocol version (e.g., "1.0.0").',
              },
            },
            required: ['version', 'protocolVersion'],
          },
        },
      },
    },
  };

  // Use the PublicServer subclass for the main server instance
  const publicServer = new DebugPublicServer(serverInfo, serverOptions);

  // List tools handler
  publicServer.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: getAllToolDefinitions() };
  });

  // Protocol version negotiation: handle initialize request
  publicServer.setRequestHandler(InitializeRequestSchema, async (request) => {
    const clientVersion = request.params?.version || request.params?.protocolVersion;
    const serverVersion = getServerVersion();
    // For now, require exact match (could be relaxed to semver compatible)
    if (clientVersion && clientVersion !== serverVersion) {
      throw new McpError(
        errorCodeToJsonRpcCode(ErrorCode.InvalidParams as unknown as string),
        `Protocol version mismatch: client requested ${clientVersion}, server supports ${serverVersion}`,
        { clientVersion, serverVersion }
      );
    }
    return {
      protocolVersion: serverVersion,
      serverInfo: {
        name: 'mem100x-multi',
        version: serverVersion,
      },
    };
  });

  // Call tool handler
  publicServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    process.stderr.write('DEBUG: Received tool request: ' + JSON.stringify(request) + '\n');
    try {
      // --- Begin original handler logic ---
      const { name, arguments: args } = request.params;
      const requestStartTime = process.hrtime.bigint();
      const correlationId = String(
        request.params._meta?.progressToken ||
          `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      );
      let requestSuccess = false;
      try {
        const handler = toolHandlers[name];
        if (!handler) {
          throw new McpError(errorCodeToJsonRpcCode(ErrorCode.MethodNotFound as unknown as string), `Unknown tool: ${name}`);
        }

        // Validate input using Zod schema if available (for elicitation)
        const toolSchemas = (await import('./tool-schemas.js')).toolSchemas;
        if (toolSchemas && name in toolSchemas) {
          (toolSchemas as any)[name].parse(args);
        }

        // Apply rate limiting if enabled
        if (rateLimiters) {
          const limiterType = getRateLimiterForTool(name);
          await rateLimiters[limiterType].checkLimit(request);
        }

        // Validate input size to prevent DoS
        validateToolInput(name, args);

        // Validate destructive operations require confirmation
        validateDestructiveOperation(name, args);

        const circuitBreaker = circuitBreakers.get(name);
        if (!circuitBreaker) {
          throw new McpError(errorCodeToJsonRpcCode(ErrorCode.InternalError as unknown as string), `No circuit breaker for tool: ${name}`);
        }

        // Time circuit breaker execution
        const circuitBreakerStartTime = process.hrtime.bigint();

        let result: any;

        // Use zero-delay aggregator for write operations
        if (writeTools.includes(name)) {
          result = await writeAggregator.scheduleWrite(name as any, args);
        }
        // For read operations, bypass circuit breaker for lower latency
        else if (readTools.includes(name)) {
          const context: ToolContext = {
            manager,
            startTime: performance.now(),
            toolName: name,
            correlationId,
          };
          result = await handler(args, context);
        }
        // Execute all other operations through circuit breaker
        else {
          result = await circuitBreaker.execute(async () => {
            const dbCallStartTime = process.hrtime.bigint();

            const context: ToolContext = {
              manager,
              startTime: performance.now(),
              toolName: name,
              correlationId,
            };

            const dbResult = await handler(args, context);

            const dbCallEndTime = process.hrtime.bigint();
            const dbCallTime = Number(dbCallEndTime - dbCallStartTime) / 1_000_000;

            // Log timing for operations
            if (dbCallTime > 50) {
              logInfo(`DB timing for ${name}`, { dbCallTime_ms: dbCallTime });
            }

            return dbResult;
          });
        }

        const circuitBreakerEndTime = process.hrtime.bigint();
        const requestEndTime = process.hrtime.bigint();

        // Calculate timings
        const totalRequestTime = Number(requestEndTime - requestStartTime) / 1_000_000;
        const circuitBreakerTime =
          Number(circuitBreakerEndTime - circuitBreakerStartTime) / 1_000_000;

        // Log timing details for analysis
        if (totalRequestTime > 50) {
          // Log slow requests
          logInfo(`Request timing for ${name}`, {
            totalRequestTime_ms: totalRequestTime,
            circuitBreakerTime_ms: circuitBreakerTime,
            overhead_ms: circuitBreakerTime - totalRequestTime,
          });
        }

        requestSuccess = true;

        // General debug print for all tool calls
        fs.appendFileSync('debug-server-multi.log',
          `DEBUG: tool name: ${name}\n` +
          'DEBUG: result: ' + JSON.stringify(result, null, 2) + '\n'
        );
        // Extract content and structuredContent from the result
        // Handle case where result might be undefined
        if (!result) {
          return {
            content: [createTextContent('Operation completed successfully')],
            structuredContent: { success: true },
          };
        }

        // Ensure result is properly formatted for MCP
        let content, structuredContent;

        // Check if result already has the MCP format
        if (
          result &&
          typeof result === 'object' &&
          'content' in result &&
          'structuredContent' in result
        ) {
          content = result.content;
          structuredContent = result.structuredContent;
        } else {
          // Result is not in MCP format, wrap it properly
          content = [createTextContent(stringifyGeneric(result, true))];

          // Always ensure structuredContent is an object, not an array
          if (Array.isArray(result)) {
            structuredContent = { items: result };
          } else if (typeof result === 'object' && result !== null) {
            // Debug print for result shape
            if (name === 'search_nodes') {
              fs.appendFileSync('debug-server-multi.log',
                'DEBUG: server-multi.ts result for search_nodes: ' + JSON.stringify(result, null, 2) + '\n' +
                'DEBUG: typeof result.entities: ' + typeof result.entities + ' ' + Array.isArray(result.entities) + '\n'
              );
            }
            // Special-case: if this is a search_nodes or similar result, return arrays directly
            if (result.entities && Array.isArray(result.entities)) {
              structuredContent = result;
            } else {
              // Check if any properties are arrays and wrap them
              const processed: any = {};
              for (const [key, value] of Object.entries(result)) {
                if (Array.isArray(value)) {
                  processed[key] = { items: value };
                } else {
                  processed[key] = value;
                }
              }
              structuredContent = processed;
            }
          } else {
            structuredContent = { value: result };
          }
        }

        return {
          content: content || [createTextContent('Operation completed successfully')],
          structuredContent: structuredContent || { success: true },
        };
      } catch (error) {
        // --- ELICITATION SUPPORT: Zod validation error handling ---
        if (error && typeof error === 'object' && 'issues' in error) {
          const zodError = error as any;
          const missingFields = zodError.issues.map((issue: any) => ({
            path: issue.path,
            message: issue.message,
            expectedType: issue.expected || (issue.code === 'invalid_type' ? issue.received : undefined)
          }));
          const toolDef = getAllToolDefinitions().find((t) => t.name === name);
          return {
            content: [
              createTextContent(
                'Missing or invalid input: ' +
                  missingFields.map((f: any) => `'${f.path.join('.')}'`).join(', ') +
                  '. ' +
                  missingFields.map((f: any) => f.message).join(' ')
              )
            ],
            structuredContent: {
              elicitation: true,
              missingFields,
              inputSchema: toolDef ? toolDef.inputSchema : undefined,
              originalInput: args,
              _meta: args && args._meta ? args._meta : undefined
            }
          };
        }
        // --- END ELICITATION SUPPORT ---
        if (error instanceof McpError) {
          throw error;
        }
        if (error instanceof Error && error.message.includes('Circuit breaker is open')) {
          const breaker = circuitBreakers.get(name);
          const stats = breaker?.getStatus();
          logError(`Circuit breaker open for ${name}`, error, { stats });
          throw new McpError(
            errorCodeToJsonRpcCode(ErrorCode.InternalError as unknown as string),
            error.message,
            { stats }
          );
        }
        if (error instanceof McpError) {
          throw error;
        }
        const mcpError = createMcpError(error);
        logError(`Error executing tool: ${name}`, error as Error, {
          args,
          mcpError,
          correlationId,
        });
        throw new McpError(errorCodeToJsonRpcCode(String(mcpError.code)), mcpError.message, mcpError.data);
      } finally {
        if (rateLimiters) {
          const limiterType = getRateLimiterForTool(name);
          rateLimiters[limiterType].updateAfterRequest(request, requestSuccess);
        }
      }
      // --- End original handler logic ---
      // Fallback: should never reach here, but return a generic error if so
      return {
        content: [createTextContent('Unknown error occurred')],
        structuredContent: { error: true },
      };
    } catch (error) {
      // SDK limitation workaround: wrap plain string or non-MCP error as custom error code
      // -32001: SDK validation error
      // -32002: Method not found error
      if (
        typeof error === 'string' ||
        (error && typeof error === 'object' && !('code' in error)) ||
        (error && typeof error === 'object' && (error as any)?.code === 'internal_error' && typeof (error as any)?.message === 'string' &&
          ((error as any)?.message.toLowerCase().includes('not found') || (error as any)?.message.toLowerCase().includes('unknown tool')))
      ) {
        let code = 'server_error_1';
        let message = typeof error === 'string' ? error : (error && (error as any)?.message) || 'SDK validation error';
        if (
          (message && message.toLowerCase().includes('not found')) ||
          (message && message.toLowerCase().includes('unknown tool'))
        ) {
          code = 'server_error_2';
          message = 'Unknown tool or method';
        }
        return {
          error: {
            code,
            message,
            data: error
          }
        };
      }
      // Otherwise, rethrow
      throw error;
    }
  });

  // Graceful shutdown handler
  const shutdown = async (signal: string) => {
    logInfo(`Received ${signal}. Shutting down gracefully...`);
    try {
      await publicServer.close();
      logInfo('MCP server closed.');

      // Stop rate limiters if enabled
      if (rateLimiters) {
        Object.values(rateLimiters).forEach((limiter) => limiter.stop());
        logInfo('Rate limiters stopped.');
      }

      manager.closeAll();
      logInfo('All databases closed.');

      // Close readline interface if open
      if (rl && typeof rl.close === 'function') {
        rl.close();
        logInfo('Readline interface closed.');
      }

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

  // --- Custom stdio JSON-RPC loop for full LLM compatibility ---
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rl.on('line', async (line) => {
    // Unconditional debug: received line
    console.error('RECEIVED LINE:', line);
    let msg;
    try {
      msg = JSON.parse(line);
      // Unconditional debug: parsed JSON
      console.error('PARSED MESSAGE:', msg);
    } catch (err) {
      const errResp = makeJsonRpcError(null, -32700, 'Parse error', String(err));
      // Unconditional debug: parse error response
      console.error('PARSE ERROR RESPONSE:', errResp);
      process.stdout.write(JSON.stringify(errResp) + '\n');
      return;
    }
    if (Array.isArray(msg)) {
      // Batch request
      console.error('BATCH MESSAGE: calling handler for each item');
      const responses = await Promise.all(msg.map(async (item) => {
        console.error('BEFORE HANDLE BATCH ITEM:', item);
        const result = await publicServer.handleJsonRpcMessage(item);
        console.error('AFTER HANDLE BATCH ITEM:', result);
        return result;
      }));
      // Only send if at least one response is not undefined (notifications)
      if (responses.some((r) => r !== undefined)) {
        process.stdout.write(JSON.stringify(responses) + '\n');
      }
      return;
    }
    // Single message
    console.error('BEFORE HANDLE SINGLE MESSAGE:', msg);
    const resp = await publicServer.handleJsonRpcMessage(msg);
    console.error('AFTER HANDLE SINGLE MESSAGE:', resp);
    // Unconditional debug: handled response
    if (resp !== undefined) {
      console.error('HANDLED RESPONSE:', resp);
      process.stdout.write(JSON.stringify(resp) + '\n');
    }
  });

  async function sendJsonRpcError(id: string | number | null, code: number, message: string, data?: unknown) {
    const errorObj = makeJsonRpcError(id, code, message, data);
    process.stdout.write(JSON.stringify(errorObj) + '\n');
  }
}

// --- TEST-ONLY: Expose tool handler logic for direct invocation in tests ---
(main as any).__callToolHandlerForTest = async function(request: any) {
  // Replicate the logic from server.setRequestHandler(CallToolRequestSchema, ...)
  const { name, arguments: args } = request.params;
  // Reuse the same manager, circuitBreakers, etc. as in main
  // For test, create new instances for isolation
  const manager = new MultiDatabaseManager(config);
  const writeAggregator = new ZeroDelayWriteAggregator(manager);
  const rateLimitingEnabled = process.env.DISABLE_RATE_LIMITING !== 'true';
  const rateLimiters = rateLimitingEnabled ? createRateLimiters() : null;
  const circuitBreakers = new Map<string, CircuitBreaker>();
  const criticalTools = ['create_entities', 'add_observations', 'create_relations'];
  const writeTools = ['create_entities', 'add_observations', 'create_relations', 'delete_entities'];
  const readTools = ['search_nodes', 'read_graph', 'get_context_info'];
  for (const toolName of Object.keys(toolHandlers)) {
    const options = criticalTools.includes(toolName)
      ? { failureThreshold: 3, resetTimeout: 10000, halfOpenMaxAttempts: 2 }
      : { failureThreshold: 5, resetTimeout: 5000, halfOpenMaxAttempts: 3 };
    circuitBreakers.set(toolName, createCircuitBreaker({
      failureThreshold: options.failureThreshold,
      recoveryTimeout: options.resetTimeout,
      expectedVolume: 1000,
      enableBulkOperations: true
    }));
  }
  // Copy-paste the tool handler logic from setRequestHandler(CallToolRequestSchema, ...)
  try {
    const handler = toolHandlers[name];
    if (!handler) {
      throw new McpError(errorCodeToJsonRpcCode(ErrorCode.MethodNotFound as unknown as string), `Unknown tool: ${name}`);
    }
    // Validate input size to prevent DoS
    validateToolInput(name, args);
    // Validate input using Zod schema if available (for elicitation)
    const toolSchemas = (await import('./tool-schemas.js')).toolSchemas;
    if (toolSchemas && name in toolSchemas) {
      (toolSchemas as any)[name].parse(args);
    }
    // Validate destructive operations require confirmation
    validateDestructiveOperation(name, args);
    const circuitBreaker = circuitBreakers.get(name);
    if (!circuitBreaker) {
      throw new McpError(errorCodeToJsonRpcCode(ErrorCode.InternalError as unknown as string), `No circuit breaker for tool: ${name}`);
    }
    let result: any;
    if (writeTools.includes(name)) {
      result = await writeAggregator.scheduleWrite(name as any, args);
    } else if (readTools.includes(name)) {
      const context: ToolContext = {
        manager,
        startTime: performance.now(),
        toolName: name,
        correlationId: 'test',
      };
      result = await handler(args, context);
    } else {
      result = await circuitBreaker.execute(async () => {
        const context: ToolContext = {
          manager,
          startTime: performance.now(),
          toolName: name,
          correlationId: 'test',
        };
        return await handler(args, context);
      });
    }
    if (!result) {
      return {
        content: [createTextContent('Operation completed successfully')],
        structuredContent: { success: true },
      };
    }
    let content, structuredContent;
    if (
      result &&
      typeof result === 'object' &&
      'content' in result &&
      'structuredContent' in result
    ) {
      content = result.content;
      structuredContent = result.structuredContent;
    } else {
      content = [createTextContent(stringifyGeneric(result, true))];
      if (Array.isArray(result)) {
        structuredContent = { items: result };
      } else if (typeof result === 'object' && result !== null) {
        const processed: any = {};
        for (const [key, value] of Object.entries(result)) {
          if (Array.isArray(value)) {
            processed[key] = { items: value };
          } else {
            processed[key] = value;
          }
        }
        structuredContent = processed;
      } else {
        structuredContent = { value: result };
      }
    }
    return {
      content: content || [createTextContent('Operation completed successfully')],
      structuredContent: structuredContent || { success: true },
    };
  } catch (error) {
    // --- ELICITATION SUPPORT: Zod validation error handling ---
    if (error && typeof error === 'object' && 'issues' in error) {
      const zodError = error as any;
      const missingFields = zodError.issues.map((issue: any) => ({
        path: issue.path,
        message: issue.message,
        expectedType: issue.expected || (issue.code === 'invalid_type' ? issue.received : undefined)
      }));
      const toolDef = getAllToolDefinitions().find((t) => t.name === name);
      return {
        content: [
          createTextContent(
            'Missing or invalid input: ' +
              missingFields.map((f: any) => `'${f.path.join('.')}'`).join(', ') +
              '. ' +
              missingFields.map((f: any) => f.message).join(' ')
          )
        ],
        structuredContent: {
          elicitation: true,
          missingFields,
          inputSchema: toolDef ? toolDef.inputSchema : undefined,
          originalInput: args,
          _meta: args && args._meta ? args._meta : undefined
        }
      };
    }
    if (error instanceof McpError) {
      throw error;
    }
    const mcpError = createMcpError(error);
    throw new McpError(errorCodeToJsonRpcCode(String(mcpError.code)), mcpError.message, mcpError.data);
  }
};
// --- TEST-ONLY: Expose initialize handler for direct invocation in tests ---
(main as any).__callInitializeForTest = async function(request: any) {
  const clientVersion = request.params?.version || request.params?.protocolVersion;
  const serverVersion = getServerVersion();
  if (clientVersion && clientVersion !== serverVersion) {
    throw new McpError(
      errorCodeToJsonRpcCode(ErrorCode.InvalidParams as unknown as string),
      `Protocol version mismatch: client requested ${clientVersion}, server supports ${serverVersion}`,
      { clientVersion, serverVersion }
    );
  }
  return {
    version: serverVersion,
    serverName: 'mem100x-multi',
    message: 'Protocol version negotiation successful',
  };
};

// Only run if this is the main module
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url === process.argv[1]) {
  main().catch((error) => {
    logError('Fatal error during startup', error as Error);
    process.exit(1);
  });
}

// Ensure the server starts when this file is run directly
main().catch(console.error);
