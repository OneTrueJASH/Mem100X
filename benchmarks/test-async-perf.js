#!/usr/bin/env node

/**
 * Test async vs sync performance for read operations
 */

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { spawn } = require('child_process');

async function connectToServer(serverPath, name = 'test-client') {
  const serverProcess = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'production' }
  });

  const transport = new StdioClientTransport({
    command: 'node',
    args: [serverPath],
    env: { ...process.env, NODE_ENV: 'production' }
  });

  const client = new Client({ name, version: '1.0.0' }, { capabilities: {} });
  await client.connect(transport);
  
  return { client, transport, serverProcess };
}

async function populateTestData(client, count = 100) {
  console.log(`\nPopulating ${count} test entities...`);
  
  for (let i = 0; i < count; i++) {
    await client.callTool({
      name: 'create_entities',
      arguments: {
        entities: [{
          name: `test-entity-${i}`,
          entityType: 'benchmark',
          observations: [`Test entity ${i} for async benchmark`]
        }]
      }
    });
  }
  
  console.log(`✅ Created ${count} entities`);
}

async function testSearchPerformance(client, iterations = 100) {
  console.log(`\nTesting search performance (${iterations} iterations)...`);
  
  const start = Date.now();
  const promises = [];
  
  for (let i = 0; i < iterations; i++) {
    const promise = client.callTool({
      name: 'search_nodes',
      arguments: {
        query: 'test',
        limit: 20
      }
    });
    promises.push(promise);
  }
  
  await Promise.all(promises);
  const duration = Date.now() - start;
  
  console.log(`Duration: ${duration}ms`);
  console.log(`Throughput: ${(iterations / (duration / 1000)).toFixed(2)} ops/s`);
  console.log(`Average latency: ${(duration / iterations).toFixed(2)}ms`);
  
  return { duration, iterations };
}

async function testReadGraphPerformance(client, iterations = 100) {
  console.log(`\nTesting read_graph performance (${iterations} iterations)...`);
  
  const start = Date.now();
  const promises = [];
  
  for (let i = 0; i < iterations; i++) {
    const promise = client.callTool({
      name: 'read_graph',
      arguments: {
        limit: 50
      }
    });
    promises.push(promise);
  }
  
  await Promise.all(promises);
  const duration = Date.now() - start;
  
  console.log(`Duration: ${duration}ms`);
  console.log(`Throughput: ${(iterations / (duration / 1000)).toFixed(2)} ops/s`);
  console.log(`Average latency: ${(duration / iterations).toFixed(2)}ms`);
  
  return { duration, iterations };
}

async function testConcurrentReads(client, concurrency = 20) {
  console.log(`\nTesting ${concurrency} concurrent read operations...`);
  
  const operations = [];
  const start = Date.now();
  
  // Mix of read operations
  for (let i = 0; i < concurrency; i++) {
    if (i % 3 === 0) {
      operations.push(client.callTool({
        name: 'search_nodes',
        arguments: { query: `entity-${i % 10}` }
      }));
    } else if (i % 3 === 1) {
      operations.push(client.callTool({
        name: 'read_graph',
        arguments: { limit: 20 }
      }));
    } else {
      operations.push(client.callTool({
        name: 'open_nodes',
        arguments: { names: [`test-entity-${i % 50}`] }
      }));
    }
  }
  
  await Promise.all(operations);
  const duration = Date.now() - start;
  
  console.log(`Duration: ${duration}ms`);
  console.log(`All ${concurrency} operations completed`);
  console.log(`Average latency: ${(duration / concurrency).toFixed(2)}ms per operation`);
  
  return { duration, concurrency };
}

async function runComparison() {
  console.log('🔍 Async vs Sync Performance Comparison\n');
  
  // Test sync server
  console.log('=== Testing SYNC Server ===');
  const syncPath = '/Users/josh/source/personal/Mem100x/dist/server-multi.js';
  const { client: syncClient, serverProcess: syncProcess } = await connectToServer(syncPath, 'sync-test');
  
  try {
    await populateTestData(syncClient, 100);
    
    const syncSearch = await testSearchPerformance(syncClient, 100);
    const syncReadGraph = await testReadGraphPerformance(syncClient, 100);
    const syncConcurrent = await testConcurrentReads(syncClient, 50);
    
    await syncClient.close();
    syncProcess.kill();
    
    // Test async server
    console.log('\n=== Testing ASYNC Server ===');
    const asyncPath = '/Users/josh/source/personal/Mem100x/dist/server-multi-async.js';
    const { client: asyncClient, serverProcess: asyncProcess } = await connectToServer(asyncPath, 'async-test');
    
    const asyncSearch = await testSearchPerformance(asyncClient, 100);
    const asyncReadGraph = await testReadGraphPerformance(asyncClient, 100);
    const asyncConcurrent = await testConcurrentReads(asyncClient, 50);
    
    await asyncClient.close();
    asyncProcess.kill();
    
    // Show comparison
    console.log('\n📊 Performance Comparison Summary\n');
    console.log('Search Performance:');
    console.log(`  Sync:  ${(syncSearch.iterations / (syncSearch.duration / 1000)).toFixed(2)} ops/s`);
    console.log(`  Async: ${(asyncSearch.iterations / (asyncSearch.duration / 1000)).toFixed(2)} ops/s`);
    console.log(`  Improvement: ${((asyncSearch.duration / syncSearch.duration - 1) * -100).toFixed(1)}%`);
    
    console.log('\nRead Graph Performance:');
    console.log(`  Sync:  ${(syncReadGraph.iterations / (syncReadGraph.duration / 1000)).toFixed(2)} ops/s`);
    console.log(`  Async: ${(asyncReadGraph.iterations / (asyncReadGraph.duration / 1000)).toFixed(2)} ops/s`);
    console.log(`  Improvement: ${((asyncReadGraph.duration / syncReadGraph.duration - 1) * -100).toFixed(1)}%`);
    
    console.log('\nConcurrent Reads:');
    console.log(`  Sync:  ${(syncConcurrent.duration / syncConcurrent.concurrency).toFixed(2)}ms avg latency`);
    console.log(`  Async: ${(asyncConcurrent.duration / asyncConcurrent.concurrency).toFixed(2)}ms avg latency`);
    console.log(`  Improvement: ${((asyncConcurrent.duration / syncConcurrent.duration - 1) * -100).toFixed(1)}%`);
    
  } catch (error) {
    console.error('Error during testing:', error);
    syncProcess.kill();
    if (asyncProcess) asyncProcess.kill();
  }
}

runComparison().catch(console.error);