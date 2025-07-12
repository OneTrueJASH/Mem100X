#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

async function testRichContent() {
  console.log('🧪 Testing Rich Content Support...\n');

  // Create transport
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['../dist/server-multi.js'],
    env: { ...process.env, DISABLE_RATE_LIMITING: 'true' }
  });

  const client = new Client({
    name: 'test-client',
    version: '1.0.0',
  }, {
    capabilities: {}
  });

  try {
    await client.connect(transport);
    console.log('✅ Connected to server');

    // First, create an entity
    console.log('\n📝 Creating test entity...');
    const createResult = await client.callTool({
      name: 'create_entities',
      arguments: {
        entities: [{
          name: 'test-entity-rich-content',
          entityType: 'test',
          observations: [
            { type: 'text', text: 'Initial observation' }
          ]
        }]
      }
    });
    console.log('✅ Entity created:', createResult.content[0].text);

    // Now test add_observations with rich content
    console.log('\n📝 Testing add_observations with rich content...');
    const addResult = await client.callTool({
      name: 'add_observations',
      arguments: {
        observations: [{
          entityName: 'test-entity-rich-content',
          contents: [
            { type: 'text', text: 'Additional observation with rich content' },
            { type: 'text', text: 'Another rich content observation' }
          ]
        }]
      }
    });
    console.log('✅ Observations added:', addResult.content[0].text);

    // Test search to see if the observations are stored correctly
    console.log('\n🔍 Searching for the entity...');
    const searchResult = await client.callTool({
      name: 'search_nodes',
      arguments: {
        query: 'test-entity-rich-content'
      }
    });
    console.log('✅ Search result:', searchResult.content[0].text);

    console.log('\n🎉 Rich content test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error.content) {
      console.error('Error content:', error.content);
    }
  } finally {
    await client.close();
  }
}

testRichContent().catch(console.error);
