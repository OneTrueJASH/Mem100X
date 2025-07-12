#!/usr/bin/env node

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const path = require('path');

class RealisticBenchmarkTest {
  constructor() {
    this.client = null;
    this.transport = null;
  }

  async connect() {
    console.log('🔌 Spawning and connecting to Mem100x server...');

    const serverPath = path.join(__dirname, '..', 'dist', 'server-multi.js');
    this.transport = new StdioClientTransport({
      command: 'node',
      args: [serverPath],
      env: {
        ...process.env,
        NODE_ENV: 'production',
        MEMORY_DB: '/tmp/mem100x-realistic-test.db',
        DEBUG: '0',
        QUIET: '1'
      }
    });

    this.client = new Client({
      name: 'realistic-benchmark-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    await this.client.connect(this.transport);
    console.log('✅ Connected');
  }

  async executeOperation(type, params) {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    const startTime = Date.now();

    try {
      let result;

      switch (type) {
        case 'create_entities':
          result = await this.client.callTool({
            name: 'create_entities',
            arguments: params
          });
          break;

        case 'search_nodes':
          result = await this.client.callTool({
            name: 'search_nodes',
            arguments: params
          });
          break;

        case 'create_relations':
          result = await this.client.callTool({
            name: 'create_relations',
            arguments: params
          });
          break;

        case 'add_observations':
          // Log the request payload for debugging
          console.log('add_observations request:', JSON.stringify(params, null, 2));
          result = await this.client.callTool({
            name: 'add_observations',
            arguments: params
          });
          // Log the full response for debugging
          console.log('add_observations response:', JSON.stringify(result, null, 2));
          break;

        case 'read_graph':
          result = await this.client.callTool({
            name: 'read_graph',
            arguments: params
          });
          break;

        default:
          throw new Error(`Unknown operation type: ${type}`);
      }

      const duration = Date.now() - startTime;
      return { success: true, duration, data: result };

    } catch (error) {
      const duration = Date.now() - startTime;
      return { success: false, duration, error: error.message };
    }
  }

  async runSingleUserSession() {
    console.log('\n🧪 Running Single User Session Test\n');

    const operations = [
      { type: 'create_entities', weight: 0.3 },
      { type: 'search_nodes', weight: 0.3 },
      { type: 'create_relations', weight: 0.1 },
      { type: 'add_observations', weight: 0.3 } // Increased weight for testing
    ];

    const results = {
      total: 0,
      successful: 0,
      failed: 0,
      latencies: [],
      byType: {}
    };

    const iterations = 20; // Reduced for testing
    const createdEntities = []; // Track created entities

    for (let i = 0; i < iterations; i++) {
      // Select operation based on weights
      const totalWeight = operations.reduce((sum, op) => sum + op.weight, 0);
      let random = Math.random() * totalWeight;
      let selectedOp = operations[0];

      for (const op of operations) {
        random -= op.weight;
        if (random <= 0) {
          selectedOp = op;
          break;
        }
      }

      // Generate realistic parameters
      const params = this.generateParams(selectedOp.type, i, createdEntities);

      // Handle cases where generateParams returns a different operation type
      const actualOpType = params.type || selectedOp.type;

      console.log(`   ${i + 1}/${iterations}: ${actualOpType}...`);

      const result = await this.executeOperation(actualOpType, params);

      results.total++;
      results.latencies.push(result.duration);

      if (result.success) {
        results.successful++;
        if (!results.byType[actualOpType]) {
          results.byType[actualOpType] = { total: 0, successful: 0, failed: 0 };
        }
        results.byType[actualOpType].total++;
        results.byType[actualOpType].successful++;

        // Track created entities for relation creation
        if (actualOpType === 'create_entities' && params.entities) {
          createdEntities.push(...params.entities.map(e => e.name));
        }
      } else {
        results.failed++;
        if (!results.byType[actualOpType]) {
          results.byType[actualOpType] = { total: 0, successful: 0, failed: 0 };
        }
        results.byType[actualOpType].total++;
        results.byType[actualOpType].failed++;
        console.log(`     ❌ Failed: ${result.error}`);
      }
    }

    // Calculate metrics
    const totalTime = results.latencies.reduce((a, b) => a + b, 0);
    const avgLatency = totalTime / results.latencies.length;
    const throughput = (results.successful / totalTime) * 1000;

    console.log('\n📊 Results:');
    console.log(`   ✅ Success Rate: ${((results.successful / results.total) * 100).toFixed(1)}%`);
    console.log(`   📈 Throughput: ${throughput.toFixed(2)} ops/sec`);
    console.log(`   ⏱️  Average Latency: ${avgLatency.toFixed(2)}ms`);

    console.log('\n   Operations by type:');
    for (const [type, stats] of Object.entries(results.byType)) {
      const successRate = ((stats.successful / stats.total) * 100).toFixed(1);
      console.log(`     ${type}: ${stats.successful}/${stats.total} (${successRate}%)`);
    }

    return results;
  }

  generateParams(type, index, existingEntities = []) {
    const timestamp = Date.now();
    const topics = ['AI', 'Machine Learning', 'Data Science', 'Programming'];
    const topic = topics[index % topics.length];

    switch (type) {
      case 'create_entities':
        return {
          entities: [{
            name: `user-thought-${timestamp}-${index}`,
            entityType: 'thought',
            observations: [
              `User thought about ${topic}`,
              `Context: brainstorming session ${index}`
            ]
          }]
        };

      case 'search_nodes':
        return {
          query: topic.toLowerCase()
        };

      case 'create_relations':
        // Only create relations if we have at least 2 existing entities
        if (existingEntities.length < 2) {
          // Fallback to creating entities instead
          return {
            type: 'create_entities', // Change the operation type
            entities: [{
              name: `user-thought-${timestamp}-${index}-fallback`,
              entityType: 'thought',
              observations: [
                `Fallback entity for relation creation`,
                `Index: ${index}`
              ]
            }]
          };
        }

        // Create relations between existing entities
        const fromEntity = existingEntities[existingEntities.length - 2];
        const toEntity = existingEntities[existingEntities.length - 1];
        return {
          relations: [{
            from: fromEntity,
            to: toEntity,
            relationType: 'follows_from'
          }]
        };

      case 'add_observations':
        // Add observations to an existing entity, or create one if none exist
        const targetEntity = existingEntities.length > 0
          ? existingEntities[existingEntities.length - 1]
          : `user-thought-${timestamp}-${index}`;

        return {
          observations: [{
            entityName: targetEntity,
            contents: [
              { type: 'text', text: `Additional context added at ${timestamp}` },
              { type: 'text', text: `Follow-up thought about ${topic}` }
            ]
          }]
        };

      default:
        return {};
    }
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up...');

    if (this.transport) {
      await this.transport.close();
    }

    console.log('✅ Cleanup complete');
  }
}

async function main() {
  const test = new RealisticBenchmarkTest();

  try {
    await test.connect();
    await test.runSingleUserSession();
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await test.cleanup();
  }
}

if (require.main === module) {
  main().catch(console.error);
}
