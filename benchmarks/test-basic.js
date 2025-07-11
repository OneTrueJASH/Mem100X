const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

async function test() {
  console.log('Testing MCP client connection...');
  
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['../dist/server-multi.js']
  });
  
  const client = new Client({
    name: 'test-client',
    version: '1.0.0'
  }, {
    capabilities: {}
  });
  
  try {
    await client.connect(transport);
    console.log('✅ Connected successfully');
    
    // Test create entity
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
    
    console.log('✅ Created entity:', result);
    
    await client.close();
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

test();