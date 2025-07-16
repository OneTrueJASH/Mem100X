#!/usr/bin/env node

/**
 * Zero-Config Default Integration Test for Mem100x
 * Verifies the server works out of the box with no config or manual setup.
 */

import { spawn } from 'child_process';
import { unlinkSync, existsSync, mkdirSync, readdirSync, rmdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = './data';
const CLEANUP_FILES = [
  './data/memory.db',
  './data/memory.cbloom',
  './data/personal.db',
  './data/personal.cbloom',
  './data/work.db',
  './data/work.cbloom',
];

function cleanDataDir() {
  if (existsSync(DATA_DIR)) {
    for (const file of readdirSync(DATA_DIR)) {
      try { unlinkSync(join(DATA_DIR, file)); } catch (e) {}
    }
    try { rmdirSync(DATA_DIR); } catch (e) {}
  }
  for (const file of CLEANUP_FILES) {
    try { unlinkSync(file); } catch (e) {}
  }
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runZeroConfigTest() {
  console.log('🧪 Zero-Config Default Integration Test\n');
  cleanDataDir();
  if (existsSync(DATA_DIR)) {
    console.error('❌ Failed to clean data directory');
    process.exit(1);
  }

  // 1. Start multi-context server (default)
  console.log('➡️  Starting multi-context server with no config...');
  const server = spawn('npx', ['tsx', 'src/server-multi.ts'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  let serverReady = false;
  let output = '';
  const readiness = (data) => {
    output += data.toString();
    if ((output.includes('Mem100x Multi-Context MCP server') || output.includes('Multi-Context MCP server running on stdio')) && !serverReady) {
      serverReady = true;
      console.log('✅ Server started successfully');
    }
  };
  server.stdout.on('data', readiness);
  server.stderr.on('data', (data) => {
    const stderr = data.toString();
    console.log('SERVER STDERR:', stderr);
    readiness(data);
  });

  await wait(2000);
  if (!serverReady) {
    console.error('❌ Server failed to start');
    server.kill();
    process.exit(1);
  }

  // 2. Check data directory and default DBs created
  if (!existsSync(DATA_DIR)) {
    console.error('❌ Data directory was not created');
    server.kill();
    process.exit(1);
  }
  const files = readdirSync(DATA_DIR);
  if (!files.some(f => f.endsWith('.db'))) {
    console.error('❌ No database files created in data directory');
    server.kill();
    process.exit(1);
  }
  console.log('✅ Data directory and DB files created');

  // 3. Run basic MCP tool calls
  async function callTool(toolName, args) {
    return new Promise((resolve, reject) => {
      const request = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args,
        },
      };
      let responseData = '';
      let responseComplete = false;
      const timeout = setTimeout(() => {
        if (!responseComplete) reject(new Error(`Timeout waiting for response from ${toolName}`));
      }, 10000);
      const processResponse = (data) => {
        responseData += data.toString();
        const lines = responseData.split('\n');
        for (const line of lines) {
          if (line.trim() && line.includes('"result"')) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.result && parsed.result.structuredContent) {
                responseComplete = true;
                clearTimeout(timeout);
                resolve(parsed.result.structuredContent);
                return;
              }
            } catch (e) {}
          }
          if (line.trim() && line.includes('"error"')) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.error) {
                responseComplete = true;
                clearTimeout(timeout);
                reject(parsed.error);
                return;
              }
            } catch (e) {}
          }
        }
      };
      server.stdout.on('data', processResponse);
      server.stderr.on('data', (data) => {
        const stderr = data.toString();
        console.log('TOOL CALL STDERR:', stderr);
        processResponse(data);
      });
      server.stdin.write(JSON.stringify(request) + '\n');
    });
  }

  try {
    // Create entity
    const entityPayload = [{ name: 'ZeroConfig Note', entityType: 'note', content: [{ type: 'text', text: 'Hello, world!' }] }];
    const createRes = await callTool('create_entities', { entities: entityPayload });
    if (!createRes || !Array.isArray(createRes.items || createRes.entities?.items)) throw new Error('Entity creation failed');
    console.log('✅ create_entities works');

    // Search entity
    const searchRes = await callTool('search_nodes', { query: 'ZeroConfig' });
    if (!searchRes || !Array.isArray(searchRes.items || searchRes.entities?.items)) throw new Error('search_nodes failed');
    console.log('✅ search_nodes works');

    // Set context
    console.log('➡️  Testing set_context...');
    const setCtxRes = await callTool('set_context', { context: 'work' });
    if (!setCtxRes || !setCtxRes.message) throw new Error('set_context failed');
    console.log('✅ set_context works');

    // Get context info
    const ctxInfo = await callTool('get_context_info', {});
    if (!ctxInfo || !ctxInfo.contexts) throw new Error('get_context_info failed');
    console.log('✅ get_context_info works');
  } catch (err) {
    console.error('❌ Tool call failed:', err);
    server.kill();
    process.exit(1);
  }

  server.kill();
  await wait(1000);

  console.log('\n🎉 Zero-Config Default: All tests passed!');
  console.log('✅ Mem100x works out of the box with no configuration required');
  console.log('✅ Multi-context server starts automatically with sensible defaults');
  console.log('✅ All core MCP tools work without manual setup');
}

runZeroConfigTest().catch((err) => {
  console.error('❌ Test script error:', err);
  process.exit(1);
});
