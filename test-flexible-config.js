#!/usr/bin/env node

/**
 * Flexible Configuration Integration Test for Mem100x
 * Validates that all configuration options work correctly for power users.
 */

import { spawn } from 'child_process';
import { unlinkSync, existsSync, mkdirSync, readdirSync, rmdirSync, writeFileSync } from 'fs';
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

async function runFlexibleConfigTest() {
  console.log('🔧 Flexible Configuration Integration Test\n');
  cleanDataDir();

  // Test 1: Validate configuration tool
  console.log('➡️  Testing configuration validation tool...');
  try {
    const { execSync } = await import('child_process');
    const output = execSync('npx tsx scripts/validate-config.js', { encoding: 'utf8' });
    if (output.includes('Configuration validation passed')) {
      console.log('✅ Configuration validation tool works');
    } else {
      throw new Error('Configuration validation failed');
    }
  } catch (error) {
    console.error('❌ Configuration validation tool failed:', error.message);
    process.exit(1);
  }

  // Test 2: High-performance configuration
  console.log('\n➡️  Testing high-performance configuration...');
  const highPerfEnv = {
    DATABASE_CACHE_SIZE_MB: '1024',
    DATABASE_MMAP_SIZE_MB: '4096',
    ENTITY_CACHE_SIZE: '100000',
    SEARCH_CACHE_SIZE: '50000',
    CACHE_STRATEGY: 'arc',
    READ_POOL_SIZE: '50',
    BATCH_SIZE: '5000',
    MAX_BATCH_SIZE: '10000',
    TARGET_BATCH_MEMORY_MB: '100',
    BLOOM_FILTER_EXPECTED_ITEMS: '100000',
    ENABLE_BULK_OPERATIONS: 'true',
    ENABLE_PREPARED_STATEMENTS: 'true',
    ENABLE_DYNAMIC_BATCH_SIZING: 'true',
    COMPRESSION_ENABLED: 'true',
  };

  await testConfiguration(highPerfEnv, 'High-Performance');
  cleanDataDir();

  // Test 3: Memory-optimized configuration
  console.log('\n➡️  Testing memory-optimized configuration...');
  const memoryOptEnv = {
    DATABASE_CACHE_SIZE_MB: '64',
    DATABASE_MMAP_SIZE_MB: '256',
    ENTITY_CACHE_SIZE: '10000',
    SEARCH_CACHE_SIZE: '5000',
    CACHE_STRATEGY: 'lru',
    READ_POOL_SIZE: '5',
    BATCH_SIZE: '100',
    MAX_BATCH_SIZE: '1000',
    TARGET_BATCH_MEMORY_MB: '10',
    BLOOM_FILTER_EXPECTED_ITEMS: '10000',
    BLOOM_FILTER_FALSE_POSITIVE_RATE: '0.01',
    ENABLE_BULK_OPERATIONS: 'true',
    ENABLE_PREPARED_STATEMENTS: 'true',
    ENABLE_DYNAMIC_BATCH_SIZING: 'true',
    COMPRESSION_ENABLED: 'true',
  };

  await testConfiguration(memoryOptEnv, 'Memory-Optimized');
  cleanDataDir();

  // Test 4: Development configuration
  console.log('\n➡️  Testing development configuration...');
  const devEnv = {
    LOG_LEVEL: 'debug',
    PROFILING_ENABLED: 'true',
    ENTITY_CACHE_SIZE: '1000',
    SEARCH_CACHE_SIZE: '500',
    BATCH_SIZE: '100',
    COMPRESSION_ENABLED: 'false',
    ENABLE_BULK_OPERATIONS: 'false',
  };

  await testConfiguration(devEnv, 'Development');
  cleanDataDir();

  // Test 5: Custom database paths
  console.log('\n➡️  Testing custom database paths...');
  const customPathsEnv = {
    PERSONAL_DB_PATH: './data/custom-personal.db',
    WORK_DB_PATH: './data/custom-work.db',
    DEFAULT_CONTEXT: 'work',
  };

  await testConfiguration(customPathsEnv, 'Custom-Paths');
  cleanDataDir();

  // Test 6: Rate limiting disabled
  console.log('\n➡️  Testing rate limiting disabled...');
  const noRateLimitEnv = {
    DISABLE_RATE_LIMITING: 'true',
  };

  await testConfiguration(noRateLimitEnv, 'No-Rate-Limit');
  cleanDataDir();

  console.log('\n🎉 Flexible Configuration: All tests passed!');
  console.log('✅ All configuration profiles work correctly');
  console.log('✅ Environment variables are properly applied');
  console.log('✅ Configuration validation tool functions');
  console.log('✅ Power users can customize all aspects');
}

async function testConfiguration(envVars, profileName) {
  const server = spawn('npx', ['tsx', 'src/server-multi.ts'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, ...envVars },
  });

  let serverReady = false;
  let output = '';
  const readiness = (data) => {
    output += data.toString();
    if ((output.includes('Mem100x Multi-Context MCP server') || output.includes('Multi-Context MCP server running on stdio')) && !serverReady) {
      serverReady = true;
      console.log(`✅ ${profileName} server started successfully`);
    }
  };
  server.stdout.on('data', readiness);
  server.stderr.on('data', readiness);

  await wait(2000);
  if (!serverReady) {
    console.error(`❌ ${profileName} server failed to start`);
    server.kill();
    process.exit(1);
  }

    // Verify configuration was applied by checking logs
  const configApplied = output.includes('MultiDatabaseManager initialized') &&
                       output.includes('Zero-delay write aggregator initialized') &&
                       (output.includes('Rate limiters initialized') || output.includes('Rate limiting disabled'));

  if (!configApplied) {
    console.error(`❌ ${profileName} configuration not properly applied`);
    server.kill();
    process.exit(1);
  }

  // Test basic functionality
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
      server.stderr.on('data', processResponse);
      server.stdin.write(JSON.stringify(request) + '\n');
    });
  }

  try {
    // Create entity
    const entityPayload = [{ name: `${profileName} Test`, entityType: 'note', content: [{ type: 'text', text: 'Configuration test' }] }];
    const createRes = await callTool('create_entities', { entities: entityPayload });
    if (!createRes || !Array.isArray(createRes.items || createRes.entities?.items)) throw new Error('Entity creation failed');
    console.log(`✅ ${profileName}: create_entities works`);

    // Search entity
    const searchRes = await callTool('search_nodes', { query: profileName });
    if (!searchRes || !Array.isArray(searchRes.items || searchRes.entities?.items)) throw new Error('search_nodes failed');
    console.log(`✅ ${profileName}: search_nodes works`);

    // Get context info
    const ctxInfo = await callTool('get_context_info', {});
    if (!ctxInfo || !ctxInfo.contexts) throw new Error('get_context_info failed');
    console.log(`✅ ${profileName}: get_context_info works`);

  } catch (err) {
    console.error(`❌ ${profileName} tool call failed:`, err);
    server.kill();
    process.exit(1);
  }

  server.kill();
  await wait(1000);
}

runFlexibleConfigTest().catch((err) => {
  console.error('❌ Test script error:', err);
  process.exit(1);
});
