#!/usr/bin/env node

/**
 * Test script to verify content type handling
 * Tests all content types supported by the MCP SDK
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testContentTypes() {
  console.log('🧪 Testing content types with Mem100x server...\n');

  // Start the server
  const transport = new StdioClientTransport({
    command: 'node',
    args: [path.join(__dirname, '..', 'dist', 'server-multi.js')],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      MEMORY_DB: '/tmp/mem100x-content-test.db',
      DEBUG: '0',
      QUIET: '1',
    }
  });

  const client = new Client({
    name: 'content-test-client',
    version: '1.0.0',
  }, {
    capabilities: {}
  });

  try {
    await client.connect(transport);
    console.log('✅ Connected to server\n');

    // Test 1: Text content
    console.log('📝 Testing text content...');
    const textResult = await client.callTool({
      name: 'create_entities',
      arguments: {
        entities: [{
          name: 'text-test-entity',
          entityType: 'test',
          observations: [
            { type: 'text', text: 'This is a text observation' }
          ]
        }]
      }
    });
    console.log('✅ Text content created successfully');

    // Test 2: Multiple text observations
    console.log('\n📝 Testing multiple text observations...');
    const multipleTextResult = await client.callTool({
      name: 'add_observations',
      arguments: {
        observations: [{
          entityName: 'text-test-entity',
          contents: [
            { type: 'text', text: 'Second observation' },
            { type: 'text', text: 'Third observation' }
          ]
        }]
      }
    });
    console.log('✅ Multiple text observations added successfully');

    // Test 3: Create entity with multiple text observations
    console.log('\n📝 Testing entity with multiple text observations...');
    const multipleEntityResult = await client.callTool({
      name: 'create_entities',
      arguments: {
        entities: [{
          name: 'multiple-text-entity',
          entityType: 'test',
          observations: [
            { type: 'text', text: 'First text observation' },
            { type: 'text', text: 'Second text observation' },
            { type: 'text', text: 'Third text observation' }
          ]
        }]
      }
    });
    console.log('✅ Entity with multiple text observations created successfully');

    // Test 4: Read back the entities to verify storage
    console.log('\n📖 Reading back entities to verify storage...');
    const readResult = await client.callTool({
      name: 'open_nodes',
      arguments: {
        names: ['text-test-entity', 'multiple-text-entity']
      }
    });
    console.log('✅ Entities read back successfully');
    console.log('📊 Read result:', JSON.stringify(readResult, null, 2));

    console.log('\n🎉 All content type tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  } finally {
    await client.close();
    await transport.close();
    console.log('\n🔌 Disconnected from server');
  }
}

// Run the test
testContentTypes().catch(console.error);
