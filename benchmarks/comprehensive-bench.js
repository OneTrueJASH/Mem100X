#!/usr/bin/env node

const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const path = require('path');
const fs = require('fs');
const os = require('os');

class ComprehensiveBenchmark {
  constructor() {
    this.tempDbPath = path.join(os.tmpdir(), `mem100x-comprehensive-${Date.now()}.db`);
    this.client = null;
    this.transport = null;
    this.results = [];
    this.testData = {
      entities: [],
      relations: []
    };
  }

  log(message) {
    console.log(`[${new Date().toISOString()}] ${message}`);
  }

  async setup() {
    this.log('🔧 Setting up comprehensive benchmark...');
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
      name: "mem100x-comprehensive-benchmark-client",
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

    // Generate test data
    this.generateTestData();
  }

  generateTestData() {
    this.log('📊 Generating test data...');

    // Generate entities for different scenarios
    this.testData.entities = [
      // Simple entities
      ...Array.from({ length: 100 }, (_, i) => ({
        name: `simple-${i}`,
        entityType: 'simple',
        content: [{ type: 'text', text: `Simple entity ${i}` }]
      })),

      // Entities with multiple observations
      ...Array.from({ length: 50 }, (_, i) => ({
        name: `complex-${i}`,
        entityType: 'complex',
        content: [
          { type: 'text', text: `Complex entity ${i} - primary observation` },
          { type: 'text', text: `Complex entity ${i} - secondary observation` },
          { type: 'text', text: `Complex entity ${i} - tertiary observation` }
        ]
      })),

      // Entities with different types
      ...Array.from({ length: 25 }, (_, i) => ({
        name: `person-${i}`,
        entityType: 'person',
        content: [{ type: 'text', text: `Person ${i} - age ${20 + i}, location: city-${i % 5}` }]
      })),

      ...Array.from({ length: 25 }, (_, i) => ({
        name: `city-${i}`,
        entityType: 'city',
        content: [{ type: 'text', text: `City ${i} - population ${10000 + i * 1000}` }]
      }))
    ];

    // Generate relations
    this.testData.relations = [
      // Person to city relations
      ...Array.from({ length: 25 }, (_, i) => ({
        from: `person-${i}`,
        to: `city-${i % 5}`,
        relationType: 'lives_in'
      })),

      // Person to person relations
      ...Array.from({ length: 20 }, (_, i) => ({
        from: `person-${i}`,
        to: `person-${(i + 1) % 25}`,
        relationType: 'knows'
      }))
    ];
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

  async runBulkInsertBenchmark() {
    this.log('\n📝 Bulk Insert Benchmark');
    this.log('========================');

    // Insert all test entities
    await this.measure('Bulk Insert All Entities', async () => {
      return await this.client.callTool({
        name: "create_entities",
        arguments: { entities: this.testData.entities }
      });
    });

    // Insert in smaller batches
    const batchSize = 25;
    const batches = [];
    for (let i = 0; i < this.testData.entities.length; i += batchSize) {
      batches.push(this.testData.entities.slice(i, i + batchSize));
    }

    await this.measure(`Batched Insert (${batchSize} per batch)`, async () => {
      const results = [];
      for (const batch of batches) {
        const result = await this.client.callTool({
          name: "create_entities",
          arguments: { entities: batch }
        });
        results.push(result);
      }
      return results;
    });
  }

  async runSearchBenchmark() {
    this.log('\n🔍 Search Performance Benchmark');
    this.log('===============================');

    // Simple text search
    await this.measure('Simple Text Search', async () => {
      return await this.client.callTool({
        name: "search_nodes",
        arguments: { query: 'simple', limit: 20 }
      });
    });

    // Entity type search
    await this.measure('Entity Type Search', async () => {
      return await this.client.callTool({
        name: "search_nodes",
        arguments: { query: 'person', limit: 30 }
      });
    });

    // Complex text search
    await this.measure('Complex Text Search', async () => {
      return await this.client.callTool({
        name: "search_nodes",
        arguments: { query: 'observation', limit: 50 }
      });
    });

    // Number search
    await this.measure('Number Search', async () => {
      return await this.client.callTool({
        name: "search_nodes",
        arguments: { query: '1000', limit: 10 }
      });
    });

    // Multiple searches (simulating real usage)
    await this.measure('Multiple Searches', async () => {
      const searches = ['simple', 'person', 'city', 'complex', 'observation'];
      const results = [];
      for (const query of searches) {
        const result = await this.client.callTool({
          name: "search_nodes",
          arguments: { query, limit: 10 }
        });
        results.push(result);
      }
      return results;
    });
  }

  async runRelationsBenchmark() {
    this.log('\n🔗 Relations Benchmark');
    this.log('=====================');

    // Create all relations
    await this.measure('Create All Relations', async () => {
      return await this.client.callTool({
        name: "create_relations",
        arguments: { relations: this.testData.relations }
      });
    });

    // Create relations in batches
    const relationBatchSize = 10;
    const relationBatches = [];
    for (let i = 0; i < this.testData.relations.length; i += relationBatchSize) {
      relationBatches.push(this.testData.relations.slice(i, i + relationBatchSize));
    }

    await this.measure(`Batched Relations (${relationBatchSize} per batch)`, async () => {
      const results = [];
      for (const batch of relationBatches) {
        const result = await this.client.callTool({
          name: "create_relations",
          arguments: { relations: batch }
        });
        results.push(result);
      }
      return results;
    });
  }

  async runGraphOperationsBenchmark() {
    this.log('\n📊 Graph Operations Benchmark');
    this.log('=============================');

    // Read entire graph
    await this.measure('Read Entire Graph', async () => {
      return await this.client.callTool({
        name: "read_graph",
        arguments: {}
      });
    });

    // Read graph with pagination
    await this.measure('Read Graph with Pagination', async () => {
      return await this.client.callTool({
        name: "read_graph",
        arguments: { limit: 50, offset: 0 }
      });
    });

    // Read graph with different limits
    await this.measure('Read Graph (Limit 100)', async () => {
      return await this.client.callTool({
        name: "read_graph",
        arguments: { limit: 100 }
      });
    });

    await this.measure('Read Graph (Limit 200)', async () => {
      return await this.client.callTool({
        name: "read_graph",
        arguments: { limit: 200 }
      });
    });
  }

  async runObservationsBenchmark() {
    this.log('\n📝 Observations Benchmark');
    this.log('=========================');

    // Add observations to existing entities
    const observationUpdates = [
      {
        entityName: 'simple-0',
        content: [
          { type: 'text', text: 'Additional observation for simple-0' },
          { type: 'text', text: 'Another observation for simple-0' }
        ]
      },
      {
        entityName: 'person-0',
        content: [
          { type: 'text', text: 'New observation for person-0' }
        ]
      },
      {
        entityName: 'city-0',
        content: [
          { type: 'text', text: 'Updated city information' },
          { type: 'text', text: 'Population growth data' }
        ]
      }
    ];

    await this.measure('Add Multiple Observations', async () => {
      return await this.client.callTool({
        name: "add_observations",
        arguments: { updates: observationUpdates }
      });
    });

    // Add observations in batches
    const batchUpdates = [];
    for (let i = 0; i < 10; i++) {
      batchUpdates.push({
        entityName: `simple-${i}`,
        content: [{ type: 'text', text: `Batch observation ${i}` }]
      });
    }

    await this.measure('Batch Add Observations', async () => {
      return await this.client.callTool({
        name: "add_observations",
        arguments: { updates: batchUpdates }
      });
    });
  }

  async runConcurrentOperationsBenchmark() {
    this.log('\n⚡ Concurrent Operations Benchmark');
    this.log('==================================');

    // Simulate concurrent searches
    await this.measure('Concurrent Searches', async () => {
      const searchPromises = [
        this.client.callTool({ name: "search_nodes", arguments: { query: 'simple', limit: 10 } }),
        this.client.callTool({ name: "search_nodes", arguments: { query: 'person', limit: 10 } }),
        this.client.callTool({ name: "search_nodes", arguments: { query: 'city', limit: 10 } }),
        this.client.callTool({ name: "search_nodes", arguments: { query: 'complex', limit: 10 } })
      ];

      return await Promise.all(searchPromises);
    });

    // Simulate mixed operations
    await this.measure('Mixed Operations', async () => {
      const operations = [
        this.client.callTool({ name: "read_graph", arguments: { limit: 20 } }),
        this.client.callTool({ name: "search_nodes", arguments: { query: 'simple', limit: 5 } }),
        this.client.callTool({ name: "search_nodes", arguments: { query: 'person', limit: 5 } })
      ];

      return await Promise.all(operations);
    });
  }

  printDetailedSummary() {
    this.log('\n📊 Comprehensive Benchmark Summary');
    this.log('==================================');

    const totalTime = this.results.reduce((sum, r) => sum + r.duration, 0);
    const avgTime = totalTime / this.results.length;
    const minTime = Math.min(...this.results.map(r => r.duration));
    const maxTime = Math.max(...this.results.map(r => r.duration));

    this.log(`Total operations: ${this.results.length}`);
    this.log(`Total time: ${totalTime}ms`);
    this.log(`Average time: ${avgTime.toFixed(2)}ms`);
    this.log(`Min time: ${minTime}ms`);
    this.log(`Max time: ${maxTime}ms`);

    // Group results by category
    const categories = {
      'Entity Creation': this.results.filter(r => r.name.includes('Entity') || r.name.includes('Insert')),
      'Search': this.results.filter(r => r.name.includes('Search')),
      'Relations': this.results.filter(r => r.name.includes('Relation')),
      'Graph Operations': this.results.filter(r => r.name.includes('Graph')),
      'Observations': this.results.filter(r => r.name.includes('Observation')),
      'Concurrent': this.results.filter(r => r.name.includes('Concurrent') || r.name.includes('Mixed'))
    };

    this.log('\nResults by Category:');
    Object.entries(categories).forEach(([category, results]) => {
      if (results.length > 0) {
        const categoryTime = results.reduce((sum, r) => sum + r.duration, 0);
        const categoryAvg = categoryTime / results.length;
        this.log(`  ${category}: ${results.length} operations, ${categoryTime}ms total, ${categoryAvg.toFixed(2)}ms avg`);
      }
    });

    this.log('\nDetailed Results:');
    this.results.forEach(result => {
      this.log(`  ${result.name}: ${result.duration}ms`);
    });
  }

  async run() {
    try {
      await this.setup();

      await this.runBulkInsertBenchmark();
      await this.runSearchBenchmark();
      await this.runRelationsBenchmark();
      await this.runGraphOperationsBenchmark();
      await this.runObservationsBenchmark();
      await this.runConcurrentOperationsBenchmark();

      this.printDetailedSummary();
    } catch (error) {
      this.log(`❌ Benchmark failed: ${error.message}`);
      console.error(error);
    } finally {
      await this.cleanup();
    }
  }
}

// Run the benchmark
const benchmark = new ComprehensiveBenchmark();
benchmark.run().catch(console.error);
