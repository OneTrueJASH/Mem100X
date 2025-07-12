#!/usr/bin/env node

const { spawn } = require('child_process');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const path = require('path');

async function test() {
  console.log('Testing direct benchmark environment...');
  
  // Start server as benchmark does
  const serverPath = path.join(__dirname, '..', 'dist', 'server-multi.js');
  const serverProcess = spawn('node', [serverPath], {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      MEMORY_DB: '/tmp/mem100x-benchmark.db',
      DEBUG: '0',
      QUIET: '1',
      DISABLE_RATE_LIMITING: 'true'
    },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  // Monitor stderr
  serverProcess.stderr.on('data', (data) => {
    console.log('[Server stderr]:', data.toString());
  });

  // Wait for ready
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Startup timeout')), 10000);
    
    let stderrBuffer = '';
    const checkReady = (data) => {
      stderrBuffer += data.toString();
      if (stderrBuffer.includes('running on stdio')) {
        clearTimeout(timeout);
        serverProcess.stderr.removeListener('data', checkReady);
        resolve();
      }
    };
    
    serverProcess.stderr.on('data', checkReady);
  });

  console.log('Server started');

  // Create transport using server process stdio
  const transport = new StdioClientTransport({
    stdin: serverProcess.stdin,
    stdout: serverProcess.stdout
  });

  const client = new Client({
    name: 'direct-test-client',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  try {
    await client.connect(transport);
    console.log('✅ Connected');

    // Test create_entities
    const result = await client.callTool({
      name: 'create_entities',
      arguments: {
        entities: [{
          name: 'direct-test-entity',
          entityType: 'benchmark',
          observations: ['Direct test']
        }]
      }
    });

    console.log('✅ Result:', JSON.stringify(result, null, 2));

    await transport.close();
    serverProcess.kill();
    console.log('✅ Test completed');
  } catch (error) {
    console.error('❌ Error:', error);
    serverProcess.kill();
    process.exit(1);
  }
}

test().catch(console.error);