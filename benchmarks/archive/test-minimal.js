#!/usr/bin/env node

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const path = require('path');
const fs = require('fs');
const os = require('os');

async function testMinimal() {
  console.log('🔍 Minimal Server Test');
  console.log('=====================');

  // Create a temporary database for clean benchmark results
  const tempDbPath = path.join(os.tmpdir(), `mem100x-minimal-${Date.now()}.db`);
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

    // Test tool listing
    console.log('\n📝 Testing list_tools...');
    const startTime = Date.now();

    const tools = await client.listTools();
    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`✅ list_tools completed in ${duration}ms`);
    console.log(`Found ${tools.tools.length} tools:`);
    tools.tools.forEach(tool => {
      console.log(`  - ${tool.name}`);
    });

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

testMinimal();
