#!/usr/bin/env node

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

async function test() {
  console.log('Testing official memory server with debug...');
  
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
  
  // Add error handler
  client.onerror = (error) => {
    console.error('[Client Error]:', error);
  };
  
  try {
    console.log('Connecting...');
    await client.connect(transport);
    console.log('✅ Connected');
    
    // Get tool description
    console.log('\nGetting tool info...');
    const tools = await client.listTools();
    const createEntitiesInfo = tools.tools.find(t => t.name === 'create_entities');
    console.log('create_entities tool info:', JSON.stringify(createEntitiesInfo, null, 2));
    
    // Try different argument formats
    const testCases = [
      {
        name: 'Standard format',
        args: {
          entities: [{
            name: 'test-entity',
            entityType: 'test',
            observations: ['Test observation']
          }]
        }
      },
      {
        name: 'Without entityType',
        args: {
          entities: [{
            name: 'test-entity',
            observations: ['Test observation']
          }]
        }
      },
      {
        name: 'With type instead of entityType',
        args: {
          entities: [{
            name: 'test-entity',
            type: 'test',
            observations: ['Test observation']
          }]
        }
      },
      {
        name: 'Minimal entity',
        args: {
          entities: [{
            name: 'test-entity'
          }]
        }
      }
    ];
    
    for (const testCase of testCases) {
      console.log(`\nTrying ${testCase.name}...`);
      console.log('Arguments:', JSON.stringify(testCase.args, null, 2));
      
      try {
        const result = await client.callTool({
          name: 'create_entities',
          arguments: testCase.args
        });
        console.log('✅ Success!');
        console.log('Result:', JSON.stringify(result, null, 2));
        break;
      } catch (error) {
        console.error('❌ Failed:', error.message);
      }
    }
    
    await transport.close();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

test().catch(console.error);