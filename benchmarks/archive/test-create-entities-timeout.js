#!/usr/bin/env node

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const path = require('path');
const fs = require('fs');
const os = require('os');

async function testCreateEntitiesTimeout() {
  console.log('🔍 Testing create_entities Timeout');
  console.log('==================================');

  // Create a temporary database for clean benchmark results
  const tempDbPath = path.join(os.tmpdir(), `mem100x-create-test-${Date.now()}.db`);
  console.log('📁 Using temporary database:', tempDbPath);

  // Use the SDK's built-in server spawning logic
  const serverPath = String(path.join(__dirname, '../dist/index.js'));
  console.log('Resolved server path:', serverPath);
  if (!fs.existsSync(serverPath)) {
    console.error('❌ Server file does not exist at:', serverPath);
    process.exit(1);
  }

  const exec = '/opt/homebrew/bin/node'; // Absolute path to node
  const args = [serverPath];
  console.log('Spawning server with:', exec, args);
  const transport = new StdioClientTransport({
    command: exec,
    args: args,
    env: {
      ...process.env,
      MEMORY_DB: tempDbPath
    }
  });
  const client = new Client({
    name: 'test-client',
    version: '1.0.0'
  }, {
    capabilities: {
      tools: {}
    }
  });

  try {
    // Connect to server
    console.log('Connecting to server...');
    const connectStart = Date.now();
    await client.connect(transport);
    const connectEnd = Date.now();
    console.log(`✅ Connected to server in ${connectEnd - connectStart}ms`);

    // Test create_entities with detailed timing
    console.log('\n📝 Testing create_entities with timeout...');
    const startTime = Date.now();

    // Create a promise that will timeout after 10 seconds
    const createPromise = client.callTool('create_entities', {
      entities: [
        {
          name: 'test-entity-1',
          entityType: 'test',
          observations: [
            { type: 'text', text: 'Test observation' }
          ]
        }
      ]
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        const elapsed = Date.now() - startTime;
        reject(new Error(`create_entities timed out after ${elapsed}ms`));
      }, 10000);
    });

    try {
      const result = await Promise.race([createPromise, timeoutPromise]);
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`✅ create_entities completed in ${duration}ms`);
      console.log('Result:', JSON.stringify(result, null, 2));
    } catch (timeoutError) {
      console.error('❌ Timeout Error:', timeoutError.message);

      // Try to get more information about what's happening
      console.log('\n🔍 Attempting to get server status...');
      try {
        const tools = await client.listTools();
        console.log('✅ Server is still responsive (list_tools works)');
      } catch (statusError) {
        console.error('❌ Server is not responsive:', statusError.message);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    // Clean up
    console.log('\n🧹 Shutting down gracefully...');
    await transport.close();
    console.log('Server process terminated');

    // Clean up temporary database
    try {
      if (fs.existsSync(tempDbPath)) {
        fs.unlinkSync(tempDbPath);
        console.log('🗑️  Temporary database cleaned up');
      }
      // Also clean up bloom filter file
      const bloomPath = tempDbPath.replace('.db', '.cbloom');
      if (fs.existsSync(bloomPath)) {
        fs.unlinkSync(bloomPath);
        console.log('🗑️  Temporary bloom filter cleaned up');
      }
    } catch (cleanupError) {
      console.warn('⚠️  Could not clean up temporary files:', cleanupError.message);
    }
  }
}

testCreateEntitiesTimeout();
