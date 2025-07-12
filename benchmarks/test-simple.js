#!/usr/bin/env node

/**
 * Simple test to debug schema validation
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testSimple() {
  console.log('🧪 Simple test...\n');

  const transport = new StdioClientTransport({
    command: 'node',
    args: [path.join(__dirname, '..', 'dist', 'server-multi.js')],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      MEMORY_DB: '/tmp/mem100x-simple-test.db',
      DEBUG: '0',
      QUIET: '1',
    }
  });

  const client = new Client({
    name: 'simple-test-client',
    version: '1.0.0',
  }, {
    capabilities: {}
  });

  try {
    await client.connect(transport);
    console.log('✅ Connected to server\n');

    // Test 1: Simple text observation
    console.log('📝 Testing simple text observation...');
    const result = await client.callTool({
      name: 'add_observations',
      arguments: {
        observations: [{
          entityName: 'test-entity',
          contents: [
            { type: 'text', text: 'Simple test observation' }
          ]
        }]
      }
    });
    console.log('✅ Simple text observation added successfully');
    console.log('📊 Result:', JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
    process.exit(1);
  } finally {
    await client.close();
    await transport.close();
    console.log('\n🔌 Disconnected from server');
  }
}

testSimple().catch(console.error);
