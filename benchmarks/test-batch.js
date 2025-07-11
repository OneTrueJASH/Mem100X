#!/usr/bin/env node

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

async function testBatchCreation() {
  console.log('Testing batch entity creation...');
  
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['../dist/server-multi.js']
  });

  const client = new Client({
    name: 'batch-test-client',
    version: '1.0.0',
  }, {
    capabilities: {}
  });

  try {
    await client.connect(transport);
    console.log('✅ Connected successfully');

    // Test creating 50 entities at once
    const entities = [];
    for (let i = 0; i < 50; i++) {
      entities.push({
        name: `batch-entity-${i}`,
        entityType: 'benchmark',
        observations: [`Entity ${i} created in batch`]
      });
    }

    console.log(`Creating ${entities.length} entities...`);
    const startTime = Date.now();
    
    const result = await client.callTool({
      name: 'create_entities',
      arguments: { entities }
    });
    
    const duration = Date.now() - startTime;
    console.log(`✅ Batch creation completed in ${duration}ms`);
    
    // Parse the result
    const content = result.content[0].text;
    const parsed = JSON.parse(content);
    console.log(`Created ${parsed.created.length} entities`);
    console.log(`Performance: ${parsed.performance.rate}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

testBatchCreation().catch(console.error);