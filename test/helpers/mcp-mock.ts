import { EventEmitter } from 'events';
import { Tool, TextContent, ImageContent, AudioContent, ResourceContent } from '../../dist/mcp-types.js';

export interface MockMCPRequest {
  id: string;
  method: string;
  params: any;
}

export interface MockMCPResponse {
  id: string;
  result?: any;
  error?: any;
}

export class MockMCPClient extends EventEmitter {
  private requestId = 0;
  private pendingRequests = new Map<string, { resolve: Function; reject: Function }>();
  private tools: Tool[] = [];

  constructor() {
    super();
  }

  /**
   * Registers tools that the mock client can handle
   */
  registerTools(tools: Tool[]): void {
    this.tools = tools;
  }

  /**
   * Sends a request to the MCP server
   */
  async sendRequest(method: string, params: any = {}): Promise<any> {
    const id = (++this.requestId).toString();
    const request: MockMCPRequest = { id, method, params };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.emit('request', request);
    });
  }

  /**
   * Simulates receiving a response from the server
   */
  receiveResponse(response: MockMCPResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (pending) {
      this.pendingRequests.delete(response.id);
      if (response.error) {
        pending.reject(response.error);
      } else {
        pending.resolve(response.result);
      }
    }
  }

  /**
   * Simulates a notification from the server
   */
  receiveNotification(method: string, params: any = {}): void {
    this.emit('notification', { method, params });
  }

  /**
   * Lists available tools
   */
  async listTools(): Promise<Tool[]> {
    return this.tools;
  }

  /**
   * Calls a specific tool
   */
  async callTool(name: string, arguments_: any = {}): Promise<any> {
    const tool = this.tools.find(t => t.name === name);
    if (!tool) {
      throw new Error(`Tool '${name}' not found`);
    }

    return this.sendRequest('tools/call', {
      name,
      arguments: arguments_
    });
  }

  /**
   * Creates test content for different types
   */
  static createTestContent() {
    return {
      text: (content: string): TextContent => ({
        type: 'text',
        text: content
      }),
      image: (uri: string, mimeType: string = 'image/png'): ImageContent => ({
        type: 'image',
        uri,
        mimeType
      }),
      audio: (uri: string, mimeType: string = 'audio/mpeg'): AudioContent => ({
        type: 'audio',
        uri,
        mimeType
      }),
      resource: (uri: string, mimeType: string = 'application/json'): ResourceContent => ({
        type: 'resource',
        uri,
        mimeType
      })
    };
  }

  /**
   * Creates test tools for common scenarios
   */
  static createTestTools(): Tool[] {
    return [
      {
        name: 'list_memories',
        description: 'List all memories in the database',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', default: 10 },
            offset: { type: 'number', default: 0 }
          }
        }
      },
      {
        name: 'search_memories',
        description: 'Search memories by query',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            limit: { type: 'number', default: 10 }
          },
          required: ['query']
        }
      },
      {
        name: 'add_memory',
        description: 'Add a new memory',
        inputSchema: {
          type: 'object',
          properties: {
            content: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } }
          },
          required: ['content']
        }
      },
      {
        name: 'export_memory',
        description: 'Export memories',
        inputSchema: {
          type: 'object',
          properties: {
            format: { type: 'string', enum: ['json', 'csv'], default: 'json' },
            includeMetadata: { type: 'boolean', default: true }
          }
        }
      },
      {
        name: 'import_memory',
        description: 'Import memories',
        inputSchema: {
          type: 'object',
          properties: {
            data: { type: 'string' },
            format: { type: 'string', enum: ['json', 'csv'], default: 'json' }
          },
          required: ['data']
        }
      }
    ];
  }

  /**
   * Simulates a complete MCP session
   */
  async simulateSession(actions: Array<{ type: 'request' | 'notification'; method: string; params?: any }>): Promise<any[]> {
    const results: any[] = [];

    for (const action of actions) {
      if (action.type === 'request') {
        const result = await this.sendRequest(action.method, action.params);
        results.push(result);
      } else {
        this.receiveNotification(action.method, action.params);
      }
    }

    return results;
  }

  /**
   * Cleans up the mock client
   */
  cleanup(): void {
    this.pendingRequests.clear();
    this.removeAllListeners();
  }
}

/**
 * Creates a mock MCP server for testing
 */
export class MockMCPServer extends EventEmitter {
  private tools: Tool[] = [];
  private handlers = new Map<string, Function>();

  constructor() {
    super();
  }

  /**
   * Registers a tool handler
   */
  registerTool(name: string, handler: Function): void {
    this.handlers.set(name, handler);
  }

  /**
   * Registers multiple tools
   */
  registerTools(tools: Tool[]): void {
    this.tools = tools;
  }

  /**
   * Handles an incoming request
   */
  async handleRequest(request: MockMCPRequest): Promise<MockMCPResponse> {
    try {
      switch (request.method) {
        case 'tools/list':
          return {
            id: request.id,
            result: { tools: this.tools }
          };

        case 'tools/call':
          const handler = this.handlers.get(request.params.name);
          if (!handler) {
            return {
              id: request.id,
              error: { code: -32601, message: `Tool '${request.params.name}' not found` }
            };
          }

          const result = await handler(request.params.arguments || {});
          return {
            id: request.id,
            result
          };

        default:
          return {
            id: request.id,
            error: { code: -32601, message: `Method '${request.method}' not found` }
          };
      }
    } catch (error) {
      return {
        id: request.id,
        error: { code: -32603, message: error instanceof Error ? error.message : 'Internal error' }
      };
    }
  }

  /**
   * Sends a notification to connected clients
   */
  sendNotification(method: string, params: any = {}): void {
    this.emit('notification', { method, params });
  }
}
