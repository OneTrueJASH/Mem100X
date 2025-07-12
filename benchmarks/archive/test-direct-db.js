#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const os = require('os');

// Import the database directly
const { MemoryDatabase } = require('../dist/database.js');

async function testDirectDatabase() {
  console.log('🔍 Direct Database Test');
  console.log('======================');

  // Create a temporary database
  const tempDbPath = path.join(os.tmpdir(), `mem100x-direct-test-${Date.now()}.db`);
  console.log('📁 Using temporary database:', tempDbPath);

  try {
    console.log('Initializing database...');
    const startTime = Date.now();
    const db = new MemoryDatabase(tempDbPath);
    const initTime = Date.now() - startTime;
    console.log(`✅ Database initialized in ${initTime}ms`);

    // Test creating a single entity
    console.log('\n📝 Testing createEntities...');
    const createStart = Date.now();

    const entities = [
      {
        name: 'test-entity-1',
        entityType: 'test',
        observations: [
          { type: 'text', text: 'Test observation' }
        ]
      }
    ];

    const created = db.createEntities(entities);
    const createTime = Date.now() - createStart;

    console.log(`✅ createEntities completed in ${createTime}ms`);
    console.log('Created entities:', created.length);
    console.log('First entity:', JSON.stringify(created[0], null, 2));

    // Test searching
    console.log('\n📝 Testing searchNodes...');
    const searchStart = Date.now();

    const searchResults = db.searchNodes({ query: 'test', limit: 10 });
    const searchTime = Date.now() - searchStart;

    console.log(`✅ searchNodes completed in ${searchTime}ms`);
    console.log('Search results:', searchResults.entities.length);

    // Test reading graph
    console.log('\n📝 Testing readGraph...');
    const graphStart = Date.now();

    const graph = db.readGraph(10);
    const graphTime = Date.now() - graphStart;

    console.log(`✅ readGraph completed in ${graphTime}ms`);
    console.log('Graph entities:', graph.entities.length);
    console.log('Graph relations:', graph.relations.length);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    // Clean up
    try {
      if (fs.existsSync(tempDbPath)) {
        fs.unlinkSync(tempDbPath);
        console.log('\n🗑️  Temporary database cleaned up');
      }
      // Also clean up bloom filter file
      const bloomPath = tempDbPath.replace('.db', '.cbloom');
      if (fs.existsSync(bloomPath)) {
        fs.unlinkSync(bloomPath);
        console.log('🗑️  Temporary bloom filter cleaned up');
      }
    } catch (cleanupError) {
      console.warn('⚠️  Could not clean up temporary files:', cleanupError.message);
    }
  }
}

testDirectDatabase();
