#!/usr/bin/env node

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const path = require('path');
const fs = require('fs');
const os = require('os');

async function testSingleOperation() {
  console.log('🔍 Testing Single Operation Performance');
  console.log('=====================================');

  // Create a temporary database for clean benchmark results
  const tempDbPath = path.join(os.tmpdir(), `mem100x-benchmark-${Date.now()}.db`);
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
    // Connect to server with increased timeout
    console.log('Connecting to server...');
    const connectStart = Date.now();

    // Set a longer timeout for the connection
    const connectPromise = client.connect(transport);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Connection timeout after 60 seconds')), 60000);
    });

    await Promise.race([connectPromise, timeoutPromise]);
    const connectEnd = Date.now();
    console.log(`✅ Connected to server in ${connectEnd - connectStart}ms`);

    // Test a single create_entities operation
    console.log('\n📝 Testing create_entities...');
    const startTime = Date.now();

    const result = await client.callTool('create_entities', {
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

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`✅ create_entities completed in ${duration}ms`);
    console.log('Result:', JSON.stringify(result, null, 2));

    // Test a single add_observations operation
    console.log('\n📝 Testing add_observations...');
    const startTime2 = Date.now();

    const result2 = await client.callTool('add_observations', {
      observations: [
        {
          entityName: 'test-entity-1',
          contents: [
            { type: 'text', text: 'Additional observation' }
          ]
        }
      ]
    });

    const endTime2 = Date.now();
    const duration2 = endTime2 - startTime2;

    console.log(`✅ add_observations completed in ${duration2}ms`);
    console.log('Result:', JSON.stringify(result2, null, 2));

    // Test a single search_nodes operation
    console.log('\n📝 Testing search_nodes...');
    const startTime3 = Date.now();

    const result3 = await client.callTool('search_nodes', {
      query: 'test'
    });

    const endTime3 = Date.now();
    const duration3 = endTime3 - startTime3;

    console.log(`✅ search_nodes completed in ${duration3}ms`);
    console.log('Result:', JSON.stringify(result3, null, 2));

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

testSingleOperation();
