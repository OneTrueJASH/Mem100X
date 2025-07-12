#!/usr/bin/env node

const { spawn } = require('child_process');

async function test() {
  console.log('Testing official server raw output...');
  
  const server = spawn('node', [
    '/Users/josh/source/personal/mcp-servers-official/src/memory/dist/index.js'
  ], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let stdoutData = '';
  let stderrData = '';
  
  server.stdout.on('data', (data) => {
    console.log('[STDOUT]:', JSON.stringify(data.toString()));
    stdoutData += data.toString();
  });
  
  server.stderr.on('data', (data) => {
    console.log('[STDERR]:', data.toString());
    stderrData += data.toString();
  });

  // Send initialize
  const initRequest = JSON.stringify({
    jsonrpc: "2.0",
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test", version: "1.0.0" }
    },
    id: 1
  }) + '\n';
  
  console.log('Sending initialize...');
  server.stdin.write(initRequest);
  
  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Send create_entities
  const createRequest = JSON.stringify({
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
  }) + '\n';
  
  console.log('\nSending create_entities...');
  server.stdin.write(createRequest);
  
  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log('\nFinal stdout:', stdoutData);
  console.log('Final stderr:', stderrData);
  
  server.kill();
}

test().catch(console.error);