#!/usr/bin/env node

/**
 * Direct database benchmark to validate core performance claims
 * This bypasses the MCP server layer to test raw database throughput
 */

const { MemoryDatabase } = require('/Users/josh/source/personal/Mem100x/dist/database.js');
const path = require('path');

async function runDirectBenchmark() {
  console.log('🔍 Direct Database Benchmark\n');
  console.log('Testing raw database performance without MCP overhead...\n');
  
  // Initialize database
  const dbPath = path.join('/tmp', `benchmark-${Date.now()}.db`);
  const db = new MemoryDatabase(dbPath, {
    enableCounting: true,
    cacheSize: 128 * 1024 * 1024, // 128MB cache
    mmapSize: 512 * 1024 * 1024   // 512MB mmap
  });
  
  // Database initializes in constructor
  console.log('✅ Database initialized\n');
  
  // Test configurations
  const tests = [
    { name: 'Single Entity Creation', iterations: 10000, concurrency: 1 },
    { name: 'Batch Entity Creation (10)', iterations: 1000, batchSize: 10, concurrency: 1 },
    { name: 'Concurrent Entity Creation', iterations: 10000, concurrency: 100 },
  ];
  
  for (const test of tests) {
    console.log(`\n📊 ${test.name}`);
    console.log(`Iterations: ${test.iterations}, Concurrency: ${test.concurrency}`);
    
    const startTime = Date.now();
    let successful = 0;
    let failed = 0;
    
    if (test.concurrency === 1) {
      // Sequential test
      for (let i = 0; i < test.iterations; i++) {
        try {
          if (test.batchSize) {
            // Batch creation
            const entities = [];
            for (let j = 0; j < test.batchSize; j++) {
              entities.push({
                name: `entity-${i}-${j}`,
                entityType: 'benchmark',
                observations: [`Test observation ${i}-${j}`]
              });
            }
            const result = await db.createEntities(entities);
            successful += result.entities.length;
          } else {
            // Single creation
            const result = await db.createEntities([{
              name: `entity-${i}`,
              entityType: 'benchmark',
              observations: [`Test observation ${i}`]
            }]);
            successful++;
          }
        } catch (error) {
          failed++;
        }
      }
    } else {
      // Concurrent test
      const batches = Math.ceil(test.iterations / test.concurrency);
      
      for (let batch = 0; batch < batches; batch++) {
        const promises = [];
        const batchSize = Math.min(test.concurrency, test.iterations - (batch * test.concurrency));
        
        for (let j = 0; j < batchSize; j++) {
          const index = batch * test.concurrency + j;
          promises.push(
            db.createEntities([{
              name: `entity-${index}`,
              entityType: 'benchmark',
              observations: [`Test observation ${index}`]
            }]).then(() => {
              successful++;
            }).catch(() => {
              failed++;
            })
          );
        }
        
        await Promise.all(promises);
      }
    }
    
    const duration = Date.now() - startTime;
    const totalOps = test.batchSize ? test.iterations * test.batchSize : test.iterations;
    const throughput = (totalOps / (duration / 1000)).toFixed(0);
    const avgLatency = (duration / test.iterations).toFixed(2);
    
    console.log(`\nResults:`);
    console.log(`  Duration: ${duration}ms`);
    console.log(`  Successful: ${successful}`);
    console.log(`  Failed: ${failed}`);
    console.log(`  Throughput: ${throughput} ops/s`);
    console.log(`  Avg Latency: ${avgLatency}ms per ${test.batchSize ? 'batch' : 'operation'}`);
  }
  
  // Test search performance
  console.log('\n\n📊 Search Performance Test');
  const searchIterations = 1000;
  const searchStart = Date.now();
  let searchSuccess = 0;
  
  for (let i = 0; i < searchIterations; i++) {
    try {
      const results = await db.searchNodes('entity');
      searchSuccess++;
    } catch (error) {
      // Ignore
    }
  }
  
  const searchDuration = Date.now() - searchStart;
  const searchThroughput = (searchIterations / (searchDuration / 1000)).toFixed(0);
  
  console.log(`  Iterations: ${searchIterations}`);
  console.log(`  Duration: ${searchDuration}ms`);
  console.log(`  Throughput: ${searchThroughput} searches/s`);
  console.log(`  Avg Latency: ${(searchDuration / searchIterations).toFixed(2)}ms`);
  
  // Cleanup
  await db.close();
  console.log('\n✅ Benchmark complete!\n');
}

runDirectBenchmark().catch(console.error);