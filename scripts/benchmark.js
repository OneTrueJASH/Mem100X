#!/usr/bin/env node

/**
 * Mem100x Benchmark Runner
 * Simple script to run the comprehensive performance benchmark suite
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Starting Mem100x Performance Benchmark Suite...\n');

// Run the performance suite
const benchmarkProcess = spawn('node', ['benchmarks/performance-suite.ts'], {
  stdio: 'inherit',
  cwd: join(__dirname, '..')
});

benchmarkProcess.on('close', (code) => {
  console.log(`\n📊 Benchmark suite completed with exit code: ${code}`);

  if (code === 0) {
    console.log('✅ All benchmarks passed successfully!');
  } else {
    console.log('❌ Some benchmarks failed. Check the output above for details.');
  }

  process.exit(code);
});

benchmarkProcess.on('error', (error) => {
  console.error('💥 Failed to run benchmark suite:', error.message);
  process.exit(1);
});
