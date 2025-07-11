#!/usr/bin/env node

/**
 * Direct test of read pool performance
 */

const { AsyncMemoryDatabase } = require('../dist/database-async.js');
const { MemoryDatabase } = require('../dist/database.js');
const fs = require('fs');
const path = require('path');

async function setupTestDatabase(dbPath) {
  // Clean up old database
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
  
  // Create and populate sync database first
  const syncDb = new MemoryDatabase(dbPath);
  
  console.log('Populating test data...');
  for (let i = 0; i < 1000; i++) {
    syncDb.createEntities([{
      name: `test-entity-${i}`,
      entityType: 'benchmark',
      observations: [`Test entity ${i} for read pool benchmark`]
    }]);
  }
  
  console.log('Created 1000 test entities');
  syncDb.close();
}

async function testSyncPerformance(dbPath, iterations = 1000) {
  console.log(`\n=== Testing SYNC Database (${iterations} searches) ===`);
  
  const db = new MemoryDatabase(dbPath);
  const searches = ['test', 'entity', 'benchmark', '500', '999'];
  
  const start = Date.now();
  
  for (let i = 0; i < iterations; i++) {
    const query = searches[i % searches.length];
    db.searchNodes({ query, limit: 20 });
  }
  
  const duration = Date.now() - start;
  
  console.log(`Duration: ${duration}ms`);
  console.log(`Throughput: ${(iterations / (duration / 1000)).toFixed(2)} ops/s`);
  console.log(`Average latency: ${(duration / iterations).toFixed(2)}ms`);
  
  db.close();
  
  return { duration, iterations };
}

async function testAsyncPerformance(dbPath, iterations = 1000) {
  console.log(`\n=== Testing ASYNC Database with Read Pool (${iterations} searches) ===`);
  
  const db = new AsyncMemoryDatabase(dbPath);
  await db.initialize();
  
  const searches = ['test', 'entity', 'benchmark', '500', '999'];
  const promises = [];
  
  const start = Date.now();
  
  for (let i = 0; i < iterations; i++) {
    const query = searches[i % searches.length];
    promises.push(db.searchNodesAsync({ query, limit: 20 }));
  }
  
  await Promise.all(promises);
  
  const duration = Date.now() - start;
  
  console.log(`Duration: ${duration}ms`);
  console.log(`Throughput: ${(iterations / (duration / 1000)).toFixed(2)} ops/s`);
  console.log(`Average latency: ${(duration / iterations).toFixed(2)}ms`);
  
  await db.close();
  
  return { duration, iterations };
}

async function testConcurrentReads(dbPath, concurrency = 100) {
  console.log(`\n=== Testing Concurrent Reads (${concurrency} parallel operations) ===`);
  
  // Test sync with sequential execution
  console.log('\nSync (sequential):');
  const syncDb = new MemoryDatabase(dbPath);
  const syncStart = Date.now();
  
  for (let i = 0; i < concurrency; i++) {
    syncDb.searchNodes({ query: `entity-${i % 10}`, limit: 10 });
  }
  
  const syncDuration = Date.now() - syncStart;
  console.log(`Duration: ${syncDuration}ms`);
  console.log(`Average: ${(syncDuration / concurrency).toFixed(2)}ms per operation`);
  syncDb.close();
  
  // Test async with parallel execution
  console.log('\nAsync (parallel):');
  const asyncDb = new AsyncMemoryDatabase(dbPath);
  await asyncDb.initialize();
  
  const asyncStart = Date.now();
  const promises = [];
  
  for (let i = 0; i < concurrency; i++) {
    promises.push(asyncDb.searchNodesAsync({ query: `entity-${i % 10}`, limit: 10 }));
  }
  
  await Promise.all(promises);
  
  const asyncDuration = Date.now() - asyncStart;
  console.log(`Duration: ${asyncDuration}ms`);
  console.log(`Average: ${(asyncDuration / concurrency).toFixed(2)}ms per operation`);
  console.log(`\nSpeedup: ${(syncDuration / asyncDuration).toFixed(2)}x faster with async/read pool`);
  
  await asyncDb.close();
}

async function main() {
  console.log('🔍 Read Pool Performance Test\n');
  
  const dbPath = path.join(__dirname, 'test-read-pool.db');
  
  try {
    await setupTestDatabase(dbPath);
    
    // Test search performance
    const syncResult = await testSyncPerformance(dbPath, 1000);
    const asyncResult = await testAsyncPerformance(dbPath, 1000);
    
    console.log(`\n📊 Search Performance Improvement: ${((syncResult.duration / asyncResult.duration - 1) * 100).toFixed(1)}%`);
    
    // Test concurrent reads
    await testConcurrentReads(dbPath, 100);
    
    // Cleanup
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

main().catch(console.error);