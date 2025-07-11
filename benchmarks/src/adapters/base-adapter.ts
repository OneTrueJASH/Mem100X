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
  protected createdEntities: string[] = [];
  
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
    // If no params provided, create default entities
    if (!params) {
      const entityName = `test-entity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      params = {
        entities: [{
          name: entityName,
          entityType: 'benchmark',
          observations: ['Test observation']
        }]
      };
    }
    
    // Track created entity names
    if (params.entities) {
      for (const entity of params.entities) {
        if (entity.name) {
          this.createdEntities.push(entity.name);
          // Keep only last 1000 entities to avoid memory issues
          if (this.createdEntities.length > 1000) {
            this.createdEntities.shift();
          }
        }
      }
    }
    
    return await this.client!.callTool({
      name: 'create_entities',
      arguments: params
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
    // If no params provided, create relations between existing entities
    if (!params) {
      // Ensure we have at least 2 entities to create a relation
      if (this.createdEntities.length < 2) {
        // Create two entities first
        await this.createEntities({
          entities: [
            {
              name: `relation-entity-1-${Date.now()}`,
              entityType: 'benchmark',
              observations: ['Entity for relation test']
            },
            {
              name: `relation-entity-2-${Date.now()}`,
              entityType: 'benchmark', 
              observations: ['Entity for relation test']
            }
          ]
        });
      }
      
      // Use last two created entities
      const fromEntity = this.createdEntities[this.createdEntities.length - 2];
      const toEntity = this.createdEntities[this.createdEntities.length - 1];
      
      params = {
        relations: [{
          from: fromEntity,
          to: toEntity,
          relationType: 'relates_to'
        }]
      };
    }
    
    return await this.client!.callTool({
      name: 'create_relations',
      arguments: params
    });
  }

  private async addObservations(params: any) {
    // If no params provided, add observations to an existing entity
    if (!params) {
      // Ensure we have at least one entity
      if (this.createdEntities.length === 0) {
        await this.createEntities(null);
      }
      
      // Use a random existing entity
      const entityName = this.createdEntities[
        Math.floor(Math.random() * this.createdEntities.length)
      ];
      
      params = {
        observations: [{
          entityName: entityName,
          contents: [`New observation at ${Date.now()}`]
        }]
      };
    }
    
    return await this.client!.callTool({
      name: 'add_observations',
      arguments: params
    });
  }

  private async readGraph(params: any) {
    return await this.client!.callTool({
      name: 'read_graph',
      arguments: params || {}
    });
  }

  private async deleteEntities(params: any) {
    // If no params provided, delete some existing entities
    if (!params) {
      if (this.createdEntities.length === 0) {
        // No entities to delete, create one first
        await this.createEntities(null);
      }
      
      // Delete a random entity
      const indexToDelete = Math.floor(Math.random() * this.createdEntities.length);
      const entityToDelete = this.createdEntities[indexToDelete];
      
      // Remove from tracking array
      this.createdEntities.splice(indexToDelete, 1);
      
      params = {
        entityNames: [entityToDelete]
      };
    }
    
    return await this.client!.callTool({
      name: 'delete_entities',
      arguments: params
    });
  }
}