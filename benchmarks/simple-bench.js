#!/usr/bin/env node

const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const path = require('path');
const fs = require('fs');
const os = require('os');

class SimpleBenchmark {
  constructor() {
    this.tempDbPath = path.join(os.tmpdir(), `mem100x-simple-bench-${Date.now()}.db`);
    this.client = null;
    this.transport = null;
    this.results = [];
  }

  log(message) {
    console.log(`[${new Date().toISOString()}] ${message}`);
  }

  async setup() {
    this.log('🔧 Setting up benchmark...');
    this.log(`📁 Using temporary database: ${this.tempDbPath}`);

    // Create transport to Mem100x server with temp database
    this.transport = new StdioClientTransport({
      command: '/opt/homebrew/bin/node',
      args: ['/Users/josh/source/personal/Mem100x/dist/index.js'],
      env: {
        NODE_ENV: 'test',
        LOG_LEVEL: 'info',
        MEMORY_DB: this.tempDbPath
      }
    });

    // Create client
    this.client = new Client({
      name: "mem100x-benchmark-client",
      version: "1.0.0"
    }, {
      capabilities: {
        tools: {}
      }
    });

    // Connect to server
    this.log('📡 Connecting to MCP server...');
    await this.client.connect(this.transport);
    this.log('✅ Connected to MCP server');
  }

  async cleanup() {
    this.log('🧹 Cleaning up...');

    if (this.client) {
      try {
        await this.client.close();
        this.log('✅ MCP client closed');
      } catch (error) {
        this.log(`⚠️  Client close warning: ${error.message}`);
      }
    }

    // Add a small delay to ensure file handles are released
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      if (fs.existsSync(this.tempDbPath)) {
        fs.unlinkSync(this.tempDbPath);
        this.log('🗑️  Database file cleaned up');
      }

      const bloomPath = this.tempDbPath.replace('.db', '.cbloom');
      if (fs.existsSync(bloomPath)) {
        fs.unlinkSync(bloomPath);
        this.log('🗑️  Bloom filter cleaned up');
      }
    } catch (error) {
      this.log(`⚠️  Cleanup warning: ${error.message}`);
    }

    this.log('✅ Cleanup complete');
  }

  async measure(name, fn) {
    const startTime = Date.now();
    const result = await fn();
    const duration = Date.now() - startTime;

    this.results.push({ name, duration, result });
    this.log(`✅ ${name}: ${duration}ms`);

    return { duration, result };
  }

  async runEntityCreationBenchmark() {
    this.log('\n📝 Entity Creation Benchmark');
    this.log('============================');

    // Single entity creation
    await this.measure('Single Entity Creation', async () => {
      return await this.client.callTool({
        name: "create_entities",
        arguments: {
          entities: [{
            name: 'test-entity-1',
            entityType: 'test',
            content: [{ type: 'text', text: 'Test observation' }]
          }]
        }
      });
    });

    // Batch entity creation (10 entities)
    const batchEntities = Array.from({ length: 10 }, (_, i) => ({
      name: `batch-entity-${i}`,
      entityType: 'batch',
      content: [{ type: 'text', text: `Batch observation ${i}` }]
    }));

    await this.measure('Batch Entity Creation (10)', async () => {
      return await this.client.callTool({
        name: "create_entities",
        arguments: { entities: batchEntities }
      });
    });

    // Large batch (100 entities)
    const largeBatch = Array.from({ length: 100 }, (_, i) => ({
      name: `large-batch-${i}`,
      entityType: 'large',
      content: [{ type: 'text', text: `Large batch observation ${i}` }]
    }));

    await this.measure('Large Batch Creation (100)', async () => {
      return await this.client.callTool({
        name: "create_entities",
        arguments: { entities: largeBatch }
      });
    });
  }

  async runSearchBenchmark() {
    this.log('\n🔍 Search Benchmark');
    this.log('==================');

    // Simple search
    await this.measure('Simple Search', async () => {
      return await this.client.callTool({
        name: "search_nodes",
        arguments: { query: 'test', limit: 10 }
      });
    });

    // Search with more results
    await this.measure('Search with Limit', async () => {
      return await this.client.callTool({
        name: "search_nodes",
        arguments: { query: 'batch', limit: 50 }
      });
    });

    // Full text search
    await this.measure('Full Text Search', async () => {
      return await this.client.callTool({
        name: "search_nodes",
        arguments: { query: 'observation', limit: 20 }
      });
    });
  }

  async runGraphBenchmark() {
    this.log('\n📊 Graph Operations Benchmark');
    this.log('=============================');

    // Read graph
    await this.measure('Read Graph (All)', async () => {
      return await this.client.callTool({
        name: "read_graph",
        arguments: {}
      });
    });

    // Read graph with limit
    await this.measure('Read Graph (Limited)', async () => {
      return await this.client.callTool({
        name: "read_graph",
        arguments: { limit: 50 }
      });
    });
  }

  async runRelationsBenchmark() {
    this.log('\n🔗 Relations Benchmark');
    this.log('=====================');

    // Create some relations
    const relations = [
      { from: 'test-entity-1', to: 'batch-entity-0', relationType: 'related_to' },
      { from: 'batch-entity-0', to: 'batch-entity-1', relationType: 'next_to' },
      { from: 'large-batch-0', to: 'large-batch-1', relationType: 'similar_to' }
    ];

    await this.measure('Create Relations', async () => {
      return await this.client.callTool({
        name: "create_relations",
        arguments: { relations }
      });
    });
  }

  async runObservationsBenchmark() {
    this.log('\n📝 Observations Benchmark');
    this.log('=========================');

    // Add observations
    const updates = [
      {
        entityName: 'test-entity-1',
        content: [
          { type: 'text', text: 'Additional observation 1' },
          { type: 'text', text: 'Additional observation 2' }
        ]
      }
    ];

    await this.measure('Add Observations', async () => {
      return await this.client.callTool({
        name: "add_observations",
        arguments: { updates }
      });
    });
  }

  printSummary() {
    this.log('\n📊 Benchmark Summary');
    this.log('===================');

    const totalTime = this.results.reduce((sum, r) => sum + r.duration, 0);
    const avgTime = totalTime / this.results.length;

    this.log(`Total operations: ${this.results.length}`);
    this.log(`Total time: ${totalTime}ms`);
    this.log(`Average time: ${avgTime.toFixed(2)}ms`);

    this.log('\nDetailed Results:');
    this.results.forEach(result => {
      this.log(`  ${result.name}: ${result.duration}ms`);
    });
  }

  async run() {
    try {
      await this.setup();

      await this.runEntityCreationBenchmark();
      await this.runSearchBenchmark();
      await this.runGraphBenchmark();
      await this.runRelationsBenchmark();
      await this.runObservationsBenchmark();

      this.printSummary();
    } catch (error) {
      this.log(`❌ Benchmark failed: ${error.message}`);
      console.error(error);
    } finally {
      await this.cleanup();
    }
  }
}

// Run the benchmark
const benchmark = new SimpleBenchmark();
benchmark.run().catch(console.error);
