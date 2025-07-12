#!/usr/bin/env node

const { Mem100xAdapter } = require('./dist/adapters/mem100x-adapter.js');

async function test() {
  console.log('Testing sequential operations...');
  
  const adapter = new Mem100xAdapter({
    name: 'mem100x',
    command: 'node',
    args: []
  });
  
  try {
    console.log('Connecting...');
    await adapter.connect();
    console.log('✅ Connected');
    
    const numOperations = 20;
    let successful = 0;
    let failed = 0;
    
    console.log(`\nRunning ${numOperations} sequential operations...`);
    
    for (let i = 0; i < numOperations; i++) {
      const result = await adapter.executeOperation({
        type: 'create_entities',
        params: {
          entities: [{
            name: `sequential-entity-${i}-${Date.now()}`,
            entityType: 'benchmark',
            observations: [`Sequential test ${i}`]
          }]
        }
      });
      
      if (result.success) {
        successful++;
        process.stdout.write('.');
      } else {
        failed++;
        process.stdout.write('X');
        console.error(`\nOperation ${i} failed:`, result.error);
      }
      
      // Add tiny delay between operations
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    console.log(`\n\n✅ Complete: ${successful} successful, ${failed} failed`);
    
    await adapter.disconnect();
    console.log('✅ Disconnected');
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