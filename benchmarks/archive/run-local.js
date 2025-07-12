#!/usr/bin/env node

/**
 * Local benchmark runner - runs benchmarks without Docker
 * For testing and development
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🏁 Running MCP Benchmarks Locally\n');

// Add server readiness check
async function waitForServerReady({ host = 'localhost', port = 3000, timeoutMs = 10000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      // Try to connect to the server (stdio: check process, http: check port)
      // For stdio, check if process is running (simulate with a delay)
      await new Promise(res => setTimeout(res, 250));
      // If you have a health endpoint, you could check it here
      return true;
    } catch (e) {
      // Not ready yet
    }
  }
  throw new Error('Server did not become ready in time');
}

(async () => {
  // Start mem100x server
  console.log('Starting Mem100x server...');
  const mem100xPath = path.join(__dirname, '..', 'dist', 'server-multi.js');

  const mem100x = spawn('node', [mem100xPath], {
    env: {
      ...process.env,
      MEMORY_DB: '/tmp/mem100x-benchmark.db',
      NODE_ENV: 'production'
    }
  });

  mem100x.on('error', (err) => {
    console.error('Failed to start Mem100x:', err);
    process.exit(1);
  });

  // Wait for server to be ready
  await waitForServerReady();

  // Wait for servers to start
  setTimeout(() => {
    console.log('Running benchmarks...\n');

    // Run the benchmark
    const runner = spawn('node', ['dist/runner.js'], {
      env: {
        ...process.env,
        SERVERS: 'mem100x',
        BENCHMARK_MODE: 'local'
      },
      stdio: 'inherit'
    });

    runner.on('close', (code) => {
      mem100x.kill();
      process.exit(code);
    });
  }, 2000);

  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    mem100x.kill();
    process.exit(0);
  });
})();
