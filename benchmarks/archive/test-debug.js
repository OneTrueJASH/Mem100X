#!/usr/bin/env node

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const path = require('path');

async function test() {
  console.log('Testing MCP request/response...');
  
  const transport = new StdioClientTransport({
    command: 'node',
    args: [path.join(__dirname, '../dist/server-multi.js')],
    env: { ...process.env, DISABLE_RATE_LIMITING: 'true' }
  });
  
  const client = new Client({
    name: 'debug-client',
    version: '1.0.0'
  }, {
    capabilities: {}
  });
  
  try {
    await client.connect(transport);
    console.log('✅ Connected successfully');
    
    // Test a simple create_entities call
    console.log('\n📝 Testing create_entities...');
    const result = await client.callTool({
      name: 'create_entities',
      arguments: {
        entities: [{
          name: 'debug-entity',
          entityType: 'test',
          observations: ['Debug observation']
        }]
      }
    });
    console.log('✅ Success:', JSON.stringify(result, null, 2));
    
    // Test without proper arguments structure
    console.log('\n📝 Testing with incorrect args structure...');
    try {
      const badResult = await client.callTool({
        name: 'create_entities',
        // Incorrect - should be under 'arguments' key
        entities: [{
          name: 'bad-entity',
          entityType: 'test',
          observations: ['Bad observation']
        }]
      });
      console.log('✅ Unexpected success:', badResult);
    } catch (error) {
      console.log('❌ Expected error:', error.message, 'Code:', error.code);
    }
    
    await transport.close();
    console.log('\n✅ Test completed');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

test().catch(console.error);