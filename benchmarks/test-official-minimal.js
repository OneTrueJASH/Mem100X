#!/usr/bin/env node

const { spawn } = require('child_process');

async function test() {
  console.log('Testing official server with minimal protocol...');
  
  const server = spawn('node', [
    '/Users/josh/source/personal/mcp-servers-official/src/memory/dist/index.js'
  ], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, NODE_DEBUG: 'mcp' }
  });

  // Collect all output
  let stdout = '';
  let stderr = '';
  
  server.stdout.on('data', (data) => {
    stdout += data.toString();
    console.log('[STDOUT]:', data.toString().trim());
  });
  
  server.stderr.on('data', (data) => {
    stderr += data.toString();
    console.log('[STDERR]:', data.toString().trim());
  });

  server.on('error', (error) => {
    console.error('[ERROR]:', error);
  });

  // Wait for startup
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Send a properly formatted message with correct line ending
  const initMessage = {
    jsonrpc: "2.0",
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test", version: "1.0.0" }
    },
    id: 1
  };
  
  console.log('\nSending:', JSON.stringify(initMessage));
  server.stdin.write(JSON.stringify(initMessage) + '\n');
  
  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Try initialized notification
  const initializedMessage = {
    jsonrpc: "2.0",
    method: "notifications/initialized",
    params: {}
  };
  
  console.log('\nSending:', JSON.stringify(initializedMessage));
  server.stdin.write(JSON.stringify(initializedMessage) + '\n');
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Now try create_entities
  const createMessage = {
    jsonrpc: "2.0",
    method: "tools/call",
    params: {
      name: "create_entities",
      arguments: {
        entities: [{
          name: "test-entity",
          entityType: "test",
          observations: ["Test observation"]
        }]
      }
    },
    id: 2
  };
  
  console.log('\nSending:', JSON.stringify(createMessage));
  server.stdin.write(JSON.stringify(createMessage) + '\n');
  
  // Wait and collect response
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log('\nKilling server...');
  server.kill();
  
  console.log('\nFinal stdout length:', stdout.length);
  console.log('Final stderr length:', stderr.length);
}

test().catch(console.error);