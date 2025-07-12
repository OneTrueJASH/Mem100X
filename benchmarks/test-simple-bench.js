#!/usr/bin/env node

const { Mem100xAdapter } = require('./dist/adapters/mem100x-adapter.js');

async function test() {
  console.log('Testing Mem100x adapter...');
  
  const adapter = new Mem100xAdapter({
    name: 'mem100x',
    command: 'node',
    args: []
  });
  
  try {
    console.log('Connecting...');
    await adapter.connect();
    console.log('✅ Connected');
    
    console.log('\nExecuting create_entities operation...');
    const result = await adapter.executeOperation({
      type: 'create_entities',
      params: {
        entities: [{
          name: 'test-entity-' + Date.now(),
          entityType: 'benchmark',
          observations: ['Test observation']
        }]
      }
    });
    
    console.log('✅ Result:', result);
    
    await adapter.disconnect();
    console.log('\n✅ Test completed');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    if (adapter) {
      await adapter.disconnect();
    }
    process.exit(1);
  }
}

test().catch(console.error);