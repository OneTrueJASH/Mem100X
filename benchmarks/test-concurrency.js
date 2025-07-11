#!/usr/bin/env node

/**
 * Test concurrent operations to identify latency sources
 */

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { spawn } = require('child_process');

async function connectToServer() {
  const serverPath = '/Users/josh/source/personal/Mem100x/dist/server-multi.js';
  const serverProcess = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'production' }
  });

  const transport = new StdioClientTransport({
    command: 'node',
    args: [serverPath],
    env: { ...process.env, NODE_ENV: 'production' }
  });

  const client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} });
  await client.connect(transport);
  
  return { client, transport, serverProcess };
}

async function testConcurrentWrites(client, count = 10) {
  console.log(`\nTesting ${count} concurrent write operations...`);
  const start = Date.now();
  
  const promises = [];
  for (let i = 0; i < count; i++) {
    const promise = client.callTool({
      name: 'create_entities',
      arguments: {
        entities: [{
          name: `concurrent-test-${Date.now()}-${i}`,
          entityType: 'test',
          observations: ['Concurrent write test']
        }]
      }
    });
    promises.push(promise);
  }
  
  const results = await Promise.all(promises);
  const duration = Date.now() - start;
  
  console.log(`Completed in ${duration}ms (${(count / (duration / 1000)).toFixed(2)} ops/s)`);
  console.log(`Average latency: ${(duration / count).toFixed(2)}ms per operation`);
  
  return { duration, count };
}

async function testSequentialWrites(client, count = 10) {
  console.log(`\nTesting ${count} sequential write operations...`);
  const start = Date.now();
  
  for (let i = 0; i < count; i++) {
    await client.callTool({
      name: 'create_entities',
      arguments: {
        entities: [{
          name: `sequential-test-${Date.now()}-${i}`,
          entityType: 'test',
          observations: ['Sequential write test']
        }]
      }
    });
  }
  
  const duration = Date.now() - start;
  
  console.log(`Completed in ${duration}ms (${(count / (duration / 1000)).toFixed(2)} ops/s)`);
  console.log(`Average latency: ${(duration / count).toFixed(2)}ms per operation`);
  
  return { duration, count };
}

async function testMixedWorkload(client, duration = 5000) {
  console.log(`\nTesting mixed workload for ${duration / 1000} seconds...`);
  
  const operations = [];
  const start = Date.now();
  let totalOps = 0;
  
  // Create some initial entities
  for (let i = 0; i < 5; i++) {
    await client.callTool({
      name: 'create_entities',
      arguments: {
        entities: [{
          name: `mixed-base-${i}`,
          entityType: 'test',
          observations: ['Base entity for mixed test']
        }]
      }
    });
  }
  
  const endTime = Date.now() + duration;
  const promises = [];
  
  while (Date.now() < endTime) {
    // Mix of operations
    const op = Math.random();
    const opStart = Date.now();
    
    let promise;
    if (op < 0.3) {
      // Create
      promise = client.callTool({
        name: 'create_entities',
        arguments: {
          entities: [{
            name: `mixed-new-${Date.now()}-${totalOps}`,
            entityType: 'test',
            observations: ['Mixed workload test']
          }]
        }
      });
    } else if (op < 0.8) {
      // Search
      promise = client.callTool({
        name: 'search_nodes',
        arguments: { query: 'mixed' }
      });
    } else {
      // Read graph
      promise = client.callTool({
        name: 'read_graph',
        arguments: {}
      });
    }
    
    promise.then(() => {
      const latency = Date.now() - opStart;
      operations.push({ type: op < 0.3 ? 'create' : op < 0.8 ? 'search' : 'read', latency });
    });
    
    promises.push(promise);
    totalOps++;
    
    // Don't overwhelm with too many concurrent operations
    if (promises.length >= 10) {
      await Promise.race(promises);
      promises.splice(0, promises.findIndex(p => p.isFulfilled));
    }
  }
  
  await Promise.all(promises);
  
  const actualDuration = Date.now() - start;
  const throughput = totalOps / (actualDuration / 1000);
  
  // Calculate latency percentiles
  operations.sort((a, b) => a.latency - b.latency);
  const p50 = operations[Math.floor(operations.length * 0.5)]?.latency || 0;
  const p95 = operations[Math.floor(operations.length * 0.95)]?.latency || 0;
  const p99 = operations[Math.floor(operations.length * 0.99)]?.latency || 0;
  
  console.log(`\nCompleted ${totalOps} operations in ${actualDuration}ms`);
  console.log(`Throughput: ${throughput.toFixed(2)} ops/s`);
  console.log(`Latency - p50: ${p50}ms, p95: ${p95}ms, p99: ${p99}ms`);
  
  // Group by operation type
  const byType = operations.reduce((acc, op) => {
    if (!acc[op.type]) acc[op.type] = [];
    acc[op.type].push(op.latency);
    return acc;
  }, {});
  
  for (const [type, latencies] of Object.entries(byType)) {
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    console.log(`${type}: ${latencies.length} ops, avg latency: ${avg.toFixed(2)}ms`);
  }
}

async function main() {
  console.log('🔍 Concurrency Test for Mem100x\n');
  
  const { client, transport, serverProcess } = await connectToServer();
  console.log('✅ Connected to server');
  
  try {
    // Test different scenarios
    await testSequentialWrites(client, 20);
    await testConcurrentWrites(client, 20);
    await testMixedWorkload(client, 5000);
    
  } finally {
    await client.close();
    serverProcess.kill();
  }
}

main().catch(console.error);