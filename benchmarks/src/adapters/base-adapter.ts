import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { 
  ServerAdapter, 
  Operation, 
  OperationResult, 
  ResourceMetrics, 
  ServerConfig 
} from '../types';
import microtime from 'microtime';
import { spawn, ChildProcess } from 'child_process';

export abstract class BaseAdapter implements ServerAdapter {
  protected client: Client | null = null;
  protected process: ChildProcess | null = null;
  protected config: ServerConfig;
  
  constructor(public name: string, config: ServerConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    console.log(`[${this.name}] Starting server...`);
    
    // Start the server process
    this.process = await this.startServer();
    
    // Wait for startup
    if (this.config.startupTime) {
      await new Promise(resolve => setTimeout(resolve, this.config.startupTime));
    }
    
    // Create MCP client
    const transport = new StdioClientTransport({
      command: this.getCommand(),
      args: this.getArgs(),
    });
    
    this.client = new Client({
      name: `benchmark-client-${this.name}`,
      version: '1.0.0',
    }, {
      capabilities: {}
    });
    
    await this.client.connect(transport);
    console.log(`[${this.name}] Connected successfully`);
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
    
    if (this.process) {
      this.process.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (!this.process.killed) {
        this.process.kill('SIGKILL');
      }
      this.process = null;
    }
    
    console.log(`[${this.name}] Disconnected`);
  }

  async executeOperation(operation: Operation): Promise<OperationResult> {
    if (!this.client) {
      throw new Error('Client not connected');
    }
    
    const startTime = microtime.now();
    
    try {
      let result: any;
      
      switch (operation.type) {
        case 'create_entities':
          result = await this.createEntities(operation.params);
          break;
        case 'search_nodes':
          result = await this.searchNodes(operation.params);
          break;
        case 'create_relations':
          result = await this.createRelations(operation.params);
          break;
        case 'add_observations':
          result = await this.addObservations(operation.params);
          break;
        case 'read_graph':
          result = await this.readGraph(operation.params);
          break;
        case 'delete_entities':
          result = await this.deleteEntities(operation.params);
          break;
        default:
          throw new Error(`Unknown operation type: ${operation.type}`);
      }
      
      const duration = microtime.now() - startTime;
      
      return {
        success: true,
        duration,
        data: result
      };
    } catch (error) {
      const duration = microtime.now() - startTime;
      
      return {
        success: false,
        duration,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async getMetrics(): Promise<ResourceMetrics> {
    if (!this.process || !this.process.pid) {
      throw new Error('Process not running');
    }
    
    // Get process metrics using /proc (Linux) or ps (macOS)
    const pid = this.process.pid;
    
    // This is a simplified version - in production you'd use proper process monitoring
    return {
      memory: {
        rss: process.memoryUsage().rss,
        heapTotal: process.memoryUsage().heapTotal,
        heapUsed: process.memoryUsage().heapUsed,
      },
      cpu: {
        user: process.cpuUsage().user,
        system: process.cpuUsage().system,
      }
    };
  }

  // Abstract methods that subclasses must implement
  protected abstract startServer(): Promise<ChildProcess>;
  protected abstract getCommand(): string;
  protected abstract getArgs(): string[];

  // MCP operations - these use the standard tool names
  private async createEntities(params: any) {
    return await this.client!.callTool({
      name: 'create_entities',
      arguments: params || {
        entities: [{
          name: `test-entity-${Date.now()}`,
          entityType: 'benchmark',
          observations: ['Test observation']
        }]
      }
    });
  }

  private async searchNodes(params: any) {
    return await this.client!.callTool({
      name: 'search_nodes',
      arguments: params || {
        query: 'test'
      }
    });
  }

  private async createRelations(params: any) {
    return await this.client!.callTool({
      name: 'create_relations',
      arguments: params || {
        relations: [{
          from: 'entity1',
          to: 'entity2',
          relationType: 'relates_to'
        }]
      }
    });
  }

  private async addObservations(params: any) {
    return await this.client!.callTool({
      name: 'add_observations',
      arguments: params || {
        observations: [{
          entityName: 'test-entity',
          contents: ['New observation']
        }]
      }
    });
  }

  private async readGraph(params: any) {
    return await this.client!.callTool({
      name: 'read_graph',
      arguments: params || {}
    });
  }

  private async deleteEntities(params: any) {
    return await this.client!.callTool({
      name: 'delete_entities',
      arguments: params || {
        entityNames: ['test-entity']
      }
    });
  }
}