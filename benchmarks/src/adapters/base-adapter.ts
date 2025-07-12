import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ServerAdapter, Operation, OperationResult, ResourceMetrics, ServerConfig } from '../types';
import microtime from 'microtime';
import { spawn, ChildProcess } from 'child_process';

// Simple mutex implementation for synchronizing access to shared state
class Mutex {
  private locked = false;
  private queue: Array<() => void> = [];

  async acquire(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.locked) {
        this.locked = true;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });
  }

  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next();
    } else {
      this.locked = false;
    }
  }
}

export abstract class BaseAdapter implements ServerAdapter {
  protected client: Client | null = null;
  protected process: ChildProcess | null = null;
  protected config: ServerConfig;
  protected createdEntities: string[] = [];
  private entitiesMutex = new Mutex(); // Add mutex for synchronizing access to createdEntities

  constructor(
    public name: string,
    config: ServerConfig
  ) {
    this.config = config;
  }

  async connect(): Promise<void> {
    console.log(`[${this.name}] Starting server...`);

    // Create MCP client and let StdioClientTransport handle the process
    const transport = new StdioClientTransport({
      command: this.getCommand(),
      args: this.getArgs(),
      env: this.getEnv(),
    });

    // Store transport for later access
    (this as any).transport = transport;

    this.client = new Client(
      {
        name: `benchmark-client-${this.name}`,
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    // Add error handler
    this.client.onerror = (error) => {
      console.error(`[${this.name}] Client error:`, error);
    };

    await this.client.connect(transport);

    console.log(`[${this.name}] Connected successfully`);
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }

    // The transport will handle closing the process
    const transport = (this as any).transport;
    if (transport && transport.close) {
      await transport.close();
    }

    console.log(`[${this.name}] Disconnected`);
  }

  async executeOperation(operation: Operation): Promise<OperationResult> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    // Remove verbose logging for performance
    // console.log(`[${this.name}] executeOperation called with:`, JSON.stringify(operation, null, 2));

    const startTime = microtime.now();

    try {
      let result: any;

      // Add timeout wrapper (5 seconds should be plenty for a single operation)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Operation timeout after 5s')), 5000);
      });

      const operationPromise = (async () => {
        switch (operation.type) {
          case 'create_entities':
            return await this.createEntities(operation.params);
          case 'search_nodes':
            return await this.searchNodes(operation.params);
          case 'create_relations':
            return await this.createRelations(operation.params);
          case 'add_observations':
            return await this.addObservations(operation.params);
          case 'read_graph':
            return await this.readGraph(operation.params);
          case 'delete_entities':
            return await this.deleteEntities(operation.params);
          default:
            throw new Error(`Unknown operation type: ${operation.type}`);
        }
      })();

      // Race between operation and timeout
      result = await Promise.race([operationPromise, timeoutPromise]);

      const duration = microtime.now() - startTime;

      return {
        success: true,
        duration,
        data: result,
      };
    } catch (error) {
      const duration = microtime.now() - startTime;
      console.error(
        `[${this.name}] Operation failed:`,
        error instanceof Error ? error.message : error,
        'Full error:',
        error
      );

      return {
        success: false,
        duration,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getMetrics(): Promise<ResourceMetrics> {
    // Since we're using StdioClientTransport, we can't easily access the child process
    // Return metrics for the current benchmark process instead
    return {
      memory: {
        rss: process.memoryUsage().rss,
        heapTotal: process.memoryUsage().heapTotal,
        heapUsed: process.memoryUsage().heapUsed,
      },
      cpu: {
        user: process.cpuUsage().user,
        system: process.cpuUsage().system,
      },
    };
  }

  // Abstract methods that subclasses must implement
  protected abstract getCommand(): string;
  protected abstract getArgs(): string[];

  // Optional method that subclasses can override
  protected getEnv(): Record<string, string> {
    return process.env as Record<string, string>;
  }

  // MCP operations - these use the standard tool names
  private async createEntities(params: any) {
    // If no params provided, create default entities
    if (!params) {
      const entityName = `test-entity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      params = {
        entities: [
          {
            name: entityName,
            entityType: 'benchmark',
            observations: [{ type: 'text', text: 'Test observation' }],
          },
        ],
      };
    }

    // Track created entity names with mutex protection
    if (params.entities) {
      await this.entitiesMutex.acquire();
      try {
        for (const entity of params.entities) {
          if (entity.name) {
            this.createdEntities.push(entity.name);
            // Keep only last 1000 entities to avoid memory issues
            if (this.createdEntities.length > 1000) {
              this.createdEntities.shift();
            }
          }
        }
      } finally {
        this.entitiesMutex.release();
      }
    }

    return await this.client!.callTool({
      name: 'create_entities',
      arguments: params,
    });
  }

  private async searchNodes(params: any) {
    return await this.client!.callTool({
      name: 'search_nodes',
      arguments: params || {
        query: 'test',
      },
    });
  }

  private async createRelations(params: any) {
    // If no params provided, create relations between existing entities
    if (!params) {
      await this.entitiesMutex.acquire();
      try {
        // Ensure we have at least 2 entities to create a relation
        if (this.createdEntities.length < 2) {
          // Create two entities first
          await this.createEntities({
            entities: [
              {
                name: `relation-entity-1-${Date.now()}`,
                entityType: 'benchmark',
                observations: [{ type: 'text', text: 'Entity for relation test' }],
              },
              {
                name: `relation-entity-2-${Date.now()}`,
                entityType: 'benchmark',
                observations: [{ type: 'text', text: 'Entity for relation test' }],
              },
            ],
          });
        }

        // Use last two created entities
        const fromEntity = this.createdEntities[this.createdEntities.length - 2];
        const toEntity = this.createdEntities[this.createdEntities.length - 1];

        params = {
          relations: [
            {
              from: fromEntity,
              to: toEntity,
              relationType: 'relates_to',
            },
          ],
        };
      } finally {
        this.entitiesMutex.release();
      }
    }

    return await this.client!.callTool({
      name: 'create_relations',
      arguments: params,
    });
  }

  private async addObservations(params: any) {
    // If no params provided, add observations to an existing entity
    if (!params) {
      await this.entitiesMutex.acquire();
      try {
        // Ensure we have at least one entity
        if (this.createdEntities.length === 0) {
          await this.createEntities(null);
        }

        // Use a random existing entity
        const entityName =
          this.createdEntities[Math.floor(Math.random() * this.createdEntities.length)];

        params = {
          observations: [
            {
              entityName: entityName,
              contents: [{ type: 'text', text: `New observation at ${Date.now()}` }],
            },
          ],
        };
      } finally {
        this.entitiesMutex.release();
      }
    }

    return await this.client!.callTool({
      name: 'add_observations',
      arguments: params,
    });
  }

  private async readGraph(params: any) {
    return await this.client!.callTool({
      name: 'read_graph',
      arguments: params || {},
    });
  }

  private async deleteEntities(params: any) {
    // Ensure confirm is always set for destructive operations
    if (params && !params.confirm) {
      params.confirm = true;
    }

    // If no params provided, delete some existing entities
    if (!params) {
      await this.entitiesMutex.acquire();
      try {
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
          entityNames: [entityToDelete],
          confirm: true, // Required for destructive operations
        };
      } finally {
        this.entitiesMutex.release();
      }
    }

    return await this.client!.callTool({
      name: 'delete_entities',
      arguments: params,
    });
  }
}
