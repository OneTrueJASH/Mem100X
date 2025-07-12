#!/usr/bin/env node

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

async function test() {
  console.log('Testing official memory server...');
  
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['/Users/josh/source/personal/mcp-servers-official/src/memory/dist/index.js']
  });
  
  const client = new Client({
    name: 'test-client',
    version: '1.0.0'
  }, {
    capabilities: {}
  });
  
  try {
    console.log('Connecting...');
    await client.connect(transport);
    console.log('✅ Connected');
    
    // List available tools
    console.log('\nListing tools...');
    const tools = await client.listTools();
    console.log('Available tools:', tools.tools.map(t => t.name));
    
    // Try creating an entity
    console.log('\nTesting create_entities...');
    try {
      const result = await client.callTool({
        name: 'create_entities',
        arguments: {
          entities: [{
            name: 'test-entity',
            entityType: 'test',
            observations: ['Test observation']
          }]
        }
      });
      console.log('✅ Success:', JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('❌ create_entities failed:', error.message);
      
      // Try the official server's tool names
      console.log('\nTrying alternative tool names...');
      const alternativeNames = ['create-entities', 'createEntities', 'memory_create_entities'];
      
      for (const toolName of alternativeNames) {
        try {
          console.log(`Trying ${toolName}...`);
          const result = await client.callTool({
            name: toolName,
            arguments: {
              entities: [{
                name: 'test-entity',
                entityType: 'test',
                observations: ['Test observation']
              }]
            }
          });
          console.log(`✅ ${toolName} worked!`);
          break;
        } catch (e) {
          console.log(`❌ ${toolName} failed:`, e.message);
        }
      }
    }
    
    await transport.close();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

test().catch(console.error);