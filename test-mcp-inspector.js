#!/usr/bin/env node

const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');

async function testMem100xServer() {
  console.log('🚀 Testing Mem100x MCP Server...');
  let client;
  try {
    // Create transport to Mem100x server
    const transport = new StdioClientTransport({
      command: '/opt/homebrew/bin/node',
      args: ['/Users/josh/source/personal/Mem100x/dist/index.js'],
      env: {
        NODE_ENV: 'test',
        LOG_LEVEL: 'debug'
      }
    });

    // Create client
    client = new Client({
      name: "mem100x-test-client",
      version: "1.0.0"
    }, {
      capabilities: {
        tools: {}
      }
    });

    // Connect to server
    console.log('📡 Connecting to server...');
    await client.connect(transport);
    console.log('✅ Connected successfully!');

    // List available tools
    console.log('🔧 Listing tools...');
    const tools = await client.listTools();
    console.log('📋 Available tools:');
    tools.tools.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description}`);
    });

    // Test read_graph tool
    console.log('\n🔍 Testing read_graph tool...');
    const readResult = await client.callTool({
      name: "read_graph",
      arguments: {
        query: "test",
        limit: 10
      }
    });
    console.log('✅ read_graph result:', JSON.stringify(readResult, null, 2));

    // Test add_observations tool with proper MCP content blocks
    console.log('\n📝 Testing add_observations tool...');
    const addResult = await client.callTool({
      name: "add_observations",
      arguments: {
        updates: [{
          entityName: "Test Entity",
          content: [
            {
              type: "text",
              text: "This is a test observation from the MCP inspector test"
            }
          ]
        }]
      }
    });
    console.log('✅ add_observations result:', JSON.stringify(addResult, null, 2));

    // Test create_entities tool
    console.log('\n🏗️ Testing create_entities tool...');
    const createResult = await client.callTool({
      name: "create_entities",
      arguments: {
        entities: [
          {
            name: "Test Entity",
            entityType: "test",
            content: [
              {
                type: "text",
                text: "A test entity created via MCP inspector"
              }
            ]
          }
        ]
      }
    });
    console.log('✅ create_entities result:', JSON.stringify(createResult, null, 2));

    console.log('\n🎉 All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Error details:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
  } finally {
    // Cleanup
    try {
      if (client) {
        await client.close();
      }
    } catch (e) {
      console.log('Cleanup error:', e.message);
    }
  }
}

// Run the test
testMem100xServer().catch(console.error);
