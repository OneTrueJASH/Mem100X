const { MemoryDatabase } = require('../dist/database.js');
const { join } = require('path');
const { homedir } = require('os');

async function runSimpleBenchmarks() {
  console.log('🚀 Running Simple Mem100x Benchmarks\n');

  // Use a temporary database for clean results
  const dbPath = join(homedir(), '.mem100x', 'benchmark-temp.db');
  const db = new MemoryDatabase(dbPath);

  try {
    // Test 1: Entity Creation Performance
    console.log('📊 Test 1: Entity Creation Performance');
    const entities = Array.from({ length: 1000 }, (_, i) => ({
      name: `entity_${i}`,
      observations: [
        { text: `This is observation ${i} for entity ${i}`, type: 'text' },
        { text: `Another observation for entity ${i}`, type: 'text' }
      ]
    }));

    const startTime = performance.now();
    const created = db.createEntities(entities);
    const duration = performance.now() - startTime;
    const rate = Math.round(entities.length / (duration / 1000));

    console.log(`✅ Created ${created.length} entities in ${duration.toFixed(2)}ms`);
    console.log(`⚡ Performance: ${rate} entities/sec\n`);

    // Test 2: Search Performance
    console.log('🔍 Test 2: Search Performance');
    const searchStart = performance.now();
    const searchResults = db.searchNodes({ query: 'entity', limit: 100 });
    const searchDuration = performance.now() - searchStart;
    const searchRate = Math.round(1000 / (searchDuration / 1000));

    console.log(`✅ Found ${searchResults.entities.length} entities in ${searchDuration.toFixed(2)}ms`);
    console.log(`⚡ Performance: ${searchRate} searches/sec\n`);

    // Test 3: Graph Reading Performance
    console.log('📖 Test 3: Graph Reading Performance');
    const readStart = performance.now();
    const graph = db.readGraph(1000, 0);
    const readDuration = performance.now() - readStart;

    console.log(`✅ Read ${graph.entities.length} entities and ${graph.relations.length} relations in ${readDuration.toFixed(2)}ms`);
    console.log(`⚡ Performance: ${Math.round(graph.entities.length / (readDuration / 1000))} entities/sec\n`);

    // Test 4: Relation Creation Performance
    console.log('🔗 Test 4: Relation Creation Performance');
    const relations = Array.from({ length: 500 }, (_, i) => ({
      from: `entity_${i}`,
      to: `entity_${i + 1}`,
      type: 'related_to'
    }));

    const relStart = performance.now();
    const createdRels = db.createRelations(relations);
    const relDuration = performance.now() - relStart;
    const relRate = Math.round(relations.length / (relDuration / 1000));

    console.log(`✅ Created ${createdRels.length} relations in ${relDuration.toFixed(2)}ms`);
    console.log(`⚡ Performance: ${relRate} relations/sec\n`);

    // Summary
    console.log('📈 Performance Summary:');
    console.log(`   • Entity Creation: ${rate} entities/sec`);
    console.log(`   • Search Operations: ${searchRate} searches/sec`);
    console.log(`   • Graph Reading: ${Math.round(graph.entities.length / (readDuration / 1000))} entities/sec`);
    console.log(`   • Relation Creation: ${relRate} relations/sec`);

  } catch (error) {
    console.error('❌ Benchmark error:', error);
  } finally {
    db.close();
    console.log('\n✅ Benchmarks completed');
  }
}

runSimpleBenchmarks().catch(console.error);
