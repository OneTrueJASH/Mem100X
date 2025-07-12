#!/usr/bin/env node

const { runBenchmarks } = require('./src/runner');
const path = require('path');

async function runDebugBenchmarks() {
  console.log('🚀 Running Debug Benchmarks (Minimal Iterations)');
  console.log('===============================================');

  const configPath = path.join(__dirname, 'config', 'debug-benchmarks.json');

  try {
    const results = await runBenchmarks(configPath, {
      verbose: true,
      timeout: 30000, // 30 second timeout
      maxConcurrency: 2
    });

    console.log('\n✅ Debug benchmarks completed!');
    console.log('Results:', JSON.stringify(results, null, 2));

  } catch (error) {
    console.error('❌ Debug benchmarks failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

runDebugBenchmarks();
