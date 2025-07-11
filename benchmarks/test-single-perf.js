#!/usr/bin/env node

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

async function testSingleEntityPerf() {
  console.log('Testing single entity creation performance...');
  
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['../dist/server-multi.js']
  });

  const client = new Client({
    name: 'perf-test-client',
    version: '1.0.0',
  }, {
    capabilities: {}
  });

  try {
    await client.connect(transport);
    console.log('✅ Connected successfully\n');

    // Warmup
    console.log('Warming up...');
    for (let i = 0; i < 10; i++) {
      await client.callTool({
        name: 'create_entities',
        arguments: {
          entities: [{
            name: `warmup-${i}`,
            entityType: 'test',
            observations: ['Warmup entity']
          }]
        }
      });
    }

    // Test 1: Creating new entities (should use fast path)
    console.log('\nTest 1: Creating 100 NEW entities (fast path)...');
    const startNew = Date.now();
    
    for (let i = 0; i < 100; i++) {
      await client.callTool({
        name: 'create_entities',
        arguments: {
          entities: [{
            name: `new-entity-${Date.now()}-${i}`,
            entityType: 'benchmark',
            observations: ['Test observation']
          }]
        }
      });
    }
    
    const durationNew = Date.now() - startNew;
    const opsPerSecNew = (100 / (durationNew / 1000)).toFixed(2);
    console.log(`Duration: ${durationNew}ms`);
    console.log(`Throughput: ${opsPerSecNew} ops/s`);

    // Test 2: Updating existing entities (should use transaction path)
    console.log('\nTest 2: Updating 100 EXISTING entities (transaction path)...');
    const startUpdate = Date.now();
    
    for (let i = 0; i < 100; i++) {
      await client.callTool({
        name: 'create_entities',
        arguments: {
          entities: [{
            name: `warmup-${i % 10}`, // Re-use warmup entities
            entityType: 'updated',
            observations: ['Updated observation']
          }]
        }
      });
    }
    
    const durationUpdate = Date.now() - startUpdate;
    const opsPerSecUpdate = (100 / (durationUpdate / 1000)).toFixed(2);
    console.log(`Duration: ${durationUpdate}ms`);
    console.log(`Throughput: ${opsPerSecUpdate} ops/s`);

    // Compare
    console.log('\n📊 Performance Summary:');
    console.log(`New entities (fast path): ${opsPerSecNew} ops/s`);
    console.log(`Updates (transaction path): ${opsPerSecUpdate} ops/s`);
    console.log(`Fast path speedup: ${(opsPerSecNew / opsPerSecUpdate).toFixed(2)}x`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

testSingleEntityPerf().catch(console.error);