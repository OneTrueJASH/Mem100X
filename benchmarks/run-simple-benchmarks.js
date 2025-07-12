const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { join } = require('path');
const { homedir } = require('os');
const path = require('path');
const fs = require('fs');
const os = require('os');

async function runSimpleBenchmarks() {
  console.log('🚀 Running Simple Mem100x Benchmarks via MCP\n');

  // Use a temporary database for clean results
  const tempDbPath = path.join(os.tmpdir(), `mem100x-simple-run-${Date.now()}.db`);

  // Create transport to Mem100x server with temp database
  const transport = new StdioClientTransport({
    command: '/opt/homebrew/bin/node',
    args: ['/Users/josh/source/personal/Mem100x/dist/index.js'],
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'info',
      MEMORY_DB: tempDbPath
    }
  });

  // Create client
  const client = new Client({
    name: "mem100x-simple-run-client",
    version: "1.0.0"
  }, {
    capabilities: {
      tools: {}
    }
  });

  try {
    // Connect to server
    console.log('📡 Connecting to MCP server...');
    await client.connect(transport);
    console.log('✅ Connected to MCP server\n');

    // Test 1: Entity Creation Performance
    console.log('📊 Test 1: Entity Creation Performance');
    const entities = Array.from({ length: 1000 }, (_, i) => ({
      name: `entity_${i}`,
      entityType: 'test',
      content: [
        { type: 'text', text: `This is observation ${i} for entity ${i}` },
        { type: 'text', text: `Another observation for entity ${i}` }
      ]
    }));

    const startTime = performance.now();
    const result = await client.callTool({
      name: "create_entities",
      arguments: { entities }
    });
    const duration = performance.now() - startTime;
    const rate = Math.round(entities.length / (duration / 1000));

    console.log(`✅ Created ${entities.length} entities in ${duration.toFixed(2)}ms`);
    console.log(`⚡ Performance: ${rate} entities/sec\n`);

    // Test 2: Search Performance
    console.log('🔍 Test 2: Search Performance');
    const searchStart = performance.now();
    const searchResult = await client.callTool({
      name: "search_nodes",
      arguments: { query: 'entity', limit: 100 }
    });
    const searchDuration = performance.now() - searchStart;
    const searchRate = Math.round(1000 / (searchDuration / 1000));

    const searchEntities = searchResult.structuredContent?.entities || [];
    console.log(`✅ Found ${searchEntities.length} entities in ${searchDuration.toFixed(2)}ms`);
    console.log(`⚡ Performance: ${searchRate} searches/sec\n`);

    // Test 3: Graph Reading Performance
    console.log('📖 Test 3: Graph Reading Performance');
    const readStart = performance.now();
    const graphResult = await client.callTool({
      name: "read_graph",
      arguments: { limit: 1000, offset: 0 }
    });
    const readDuration = performance.now() - readStart;

    const graphData = graphResult.structuredContent || {};
    const graphEntities = graphData.entities || [];
    const graphRelations = graphData.relations || [];

    console.log(`✅ Read ${graphEntities.length} entities and ${graphRelations.length} relations in ${readDuration.toFixed(2)}ms`);
    console.log(`⚡ Performance: ${Math.round(graphEntities.length / (readDuration / 1000))} entities/sec\n`);

    // Test 4: Relation Creation Performance
    console.log('🔗 Test 4: Relation Creation Performance');
    const relations = Array.from({ length: 500 }, (_, i) => ({
      from: `entity_${i}`,
      to: `entity_${i + 1}`,
      relationType: 'related_to'
    }));

    const relStart = performance.now();
    const relResult = await client.callTool({
      name: "create_relations",
      arguments: { relations }
    });
    const relDuration = performance.now() - relStart;
    const relRate = Math.round(relations.length / (relDuration / 1000));

    const createdRels = relResult.structuredContent?.created || [];
    console.log(`✅ Created ${createdRels.length} relations in ${relDuration.toFixed(2)}ms`);
    console.log(`⚡ Performance: ${relRate} relations/sec\n`);

    // Summary
    console.log('📈 Performance Summary:');
    console.log(`   • Entity Creation: ${rate} entities/sec`);
    console.log(`   • Search Operations: ${searchRate} searches/sec`);
    console.log(`   • Graph Reading: ${Math.round(graphEntities.length / (readDuration / 1000))} entities/sec`);
    console.log(`   • Relation Creation: ${relRate} relations/sec`);

  } catch (error) {
    console.error('❌ Benchmark error:', error);
  } finally {
    // Cleanup
    try {
      await client.close();
      console.log('✅ MCP client closed');
    } catch (e) {
      console.log('⚠️  Client close warning:', e.message);
    }

    // Clean up temp files
    try {
      if (fs.existsSync(tempDbPath)) {
        fs.unlinkSync(tempDbPath);
      }
      const bloomPath = tempDbPath.replace('.db', '.cbloom');
      if (fs.existsSync(bloomPath)) {
        fs.unlinkSync(bloomPath);
      }
    } catch (e) {
      console.log('⚠️  Cleanup warning:', e.message);
    }

    console.log('\n✅ Benchmarks completed');
  }
}

runSimpleBenchmarks().catch(console.error);
