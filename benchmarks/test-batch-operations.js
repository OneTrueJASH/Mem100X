#!/usr/bin/env node

const { MemoryDatabase } = require('../dist/database.js');
const path = require('path');
const fs = require('fs');

async function testBatchOperations() {
  console.log('🧪 Testing Batch Operations...\n');

  // Use a temporary database for testing
  const testDbPath = '/tmp/mem100x-batch-test.db';
  const testBloomPath = '/tmp/mem100x-batch-test.cbloom';

  // Clean up any existing test files
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  if (fs.existsSync(testBloomPath)) fs.unlinkSync(testBloomPath);

  const db = new MemoryDatabase(testDbPath);

  try {
    console.log('📊 Testing Entity Creation...');

    // Test 1: Small batch (should use regular method)
    console.log('\n1️⃣ Small batch (10 entities):');
    const smallEntities = Array.from({ length: 10 }, (_, i) => ({
      name: `test-entity-${i}`,
      entityType: 'test',
      observations: [`Test observation ${i}`]
    }));

    const start1 = Date.now();
    const result1 = db.createEntities(smallEntities);
    const duration1 = Date.now() - start1;

    console.log(`   ✅ Created ${result1.length} entities in ${duration1}ms`);
    console.log(`   📈 Rate: ${(result1.length / duration1 * 1000).toFixed(2)} entities/sec`);

    // Test 2: Large batch (should use batch method)
    console.log('\n2️⃣ Large batch (1500 entities):');
    const largeEntities = Array.from({ length: 1500 }, (_, i) => ({
      name: `batch-entity-${i}`,
      entityType: 'batch-test',
      observations: [`Batch test observation ${i}`]
    }));

    const start2 = Date.now();
    const result2 = db.createEntities(largeEntities);
    const duration2 = Date.now() - start2;

    console.log(`   ✅ Created ${result2.length} entities in ${duration2}ms`);
    console.log(`   📈 Rate: ${(result2.length / duration2 * 1000).toFixed(2)} entities/sec`);

    // Test 3: Relations
    console.log('\n3️⃣ Testing Relation Creation...');

    // Create some entities for relations
    const relationEntities = Array.from({ length: 100 }, (_, i) => ({
      name: `relation-entity-${i}`,
      entityType: 'relation-test',
      observations: [`Relation test ${i}`]
    }));

    db.createEntities(relationEntities);

    // Test small relations batch
    console.log('\n   Small relations batch (50 relations):');
    const smallRelations = Array.from({ length: 50 }, (_, i) => ({
      from: `relation-entity-${i}`,
      to: `relation-entity-${i + 1}`,
      relationType: 'connects_to'
    }));

    const start3 = Date.now();
    const result3 = db.createRelations(smallRelations);
    const duration3 = Date.now() - start3;

    console.log(`   ✅ Created ${result3.length} relations in ${duration3}ms`);
    console.log(`   📈 Rate: ${(result3.length / duration3 * 1000).toFixed(2)} relations/sec`);

    // Test large relations batch
    console.log('\n   Large relations batch (1200 relations):');
    const largeRelations = Array.from({ length: 1200 }, (_, i) => ({
      from: `relation-entity-${i % 100}`,
      to: `relation-entity-${(i + 1) % 100}`,
      relationType: 'connects_to'
    }));

    const start4 = Date.now();
    const result4 = db.createRelations(largeRelations);
    const duration4 = Date.now() - start4;

    console.log(`   ✅ Created ${result4.length} relations in ${duration4}ms`);
    console.log(`   📈 Rate: ${(result4.length / duration4 * 1000).toFixed(2)} relations/sec`);

    // Test 4: Mixed operations
    console.log('\n4️⃣ Testing Mixed Operations...');

    const mixedEntities = Array.from({ length: 500 }, (_, i) => ({
      name: `mixed-entity-${i}`,
      entityType: 'mixed-test',
      observations: [`Mixed test ${i}`]
    }));

    const mixedRelations = Array.from({ length: 800 }, (_, i) => ({
      from: `mixed-entity-${i % 500}`,
      to: `mixed-entity-${(i + 1) % 500}`,
      relationType: 'related_to'
    }));

    const start5 = Date.now();
    const entitiesResult = db.createEntities(mixedEntities);
    const relationsResult = db.createRelations(mixedRelations);
    const duration5 = Date.now() - start5;

    console.log(`   ✅ Created ${entitiesResult.length} entities and ${relationsResult.length} relations in ${duration5}ms`);
    console.log(`   📈 Combined rate: ${((entitiesResult.length + relationsResult.length) / duration5 * 1000).toFixed(2)} ops/sec`);

    // Get final stats
    const stats = db.getStats();
    console.log('\n📊 Final Database Stats:');
    console.log(`   📝 Total entities: ${stats.totalEntities}`);
    console.log(`   🔗 Total relations: ${stats.totalRelations}`);
    console.log(`   💾 Database size: ${(stats.databaseSize / 1024 / 1024).toFixed(2)} MB`);

    console.log('\n✅ All batch operation tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    db.close();

    // Clean up test files
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testBloomPath)) fs.unlinkSync(testBloomPath);
  }
}

testBatchOperations().catch(console.error);
