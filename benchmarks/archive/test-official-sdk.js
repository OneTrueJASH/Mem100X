#!/usr/bin/env node

// Test using the same SDK version as official server
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

async function test() {
  console.log('Testing with official server SDK client...');
  
  // Use exact same client setup
  const client = new Client(
    {
      name: 'test-client',
      version: '1.0.0'
    },
    {
      capabilities: {}
    }
  );
  
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['/Users/josh/source/personal/mcp-servers-official/src/memory/dist/index.js']
  });
  
  try {
    console.log('Connecting...');
    await client.connect(transport);
    console.log('✅ Connected');
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('\nTesting create_entities...');
    const result = await client.callTool({
      name: 'create_entities',
      arguments: {
        entities: [{
          name: 'test-entity-' + Date.now(),
          entityType: 'test',
          observations: ['Test observation']
        }]
      }
    });
    
    console.log('✅ Success:', JSON.stringify(result, null, 2));
    
    await transport.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

test().catch(console.error);