#!/usr/bin/env node

/**
 * Development watch mode for benchmarks
 * Watches for changes and automatically reruns quick benchmarks
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Simple color helpers
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  gray: '\x1b[90m'
};

console.log(`${colors.bright}${colors.blue}🔄 Benchmark Watch Mode${colors.reset}\n`);

const watchPaths = [
  path.join(__dirname, '../src'),
  path.join(__dirname, '../dist'),
  path.join(__dirname, 'src'),
  path.join(__dirname, 'dist')
];

let isRunning = false;
let runnerProcess = null;
let debounceTimer = null;

function runBenchmarks() {
  if (isRunning) {
    console.log(`${colors.yellow}⏳ Benchmark already running, will run again after completion${colors.reset}`);
    return;
  }

  isRunning = true;
  console.log(`\n${colors.green}▶️  Running quick benchmarks...${colors.reset}\n`);

  runnerProcess = spawn('./run-local-dev.js', ['--quick', '--scenarios', 'entity-creation-throughput,search-performance'], {
    stdio: 'inherit'
  });

  runnerProcess.on('close', (code) => {
    isRunning = false;
    runnerProcess = null;
    
    if (code === 0) {
      console.log(`\n${colors.green}✅ Benchmark run completed${colors.reset}`);
    } else {
      console.log(`\n${colors.red}❌ Benchmark run failed with code ${code}${colors.reset}`);
    }
    
    console.log(`${colors.gray}Watching for changes...${colors.reset}\n`);
  });

  runnerProcess.on('error', (err) => {
    console.error(`${colors.red}Error running benchmarks: ${err.message}${colors.reset}`);
    isRunning = false;
    runnerProcess = null;
  });
}

function handleChange(eventType, filename) {
  if (filename && (filename.endsWith('.ts') || filename.endsWith('.js'))) {
    console.log(`${colors.gray}Changed: ${filename}${colors.reset}`);
    
    // Debounce to avoid multiple runs for rapid changes
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      runBenchmarks();
    }, 1000);
  }
}

// Set up watchers
console.log(`${colors.gray}Watching paths:${colors.reset}`);
watchPaths.forEach(watchPath => {
  if (fs.existsSync(watchPath)) {
    console.log(`  - ${watchPath}`);
    fs.watch(watchPath, { recursive: true }, handleChange);
  }
});

console.log(`\n${colors.yellow}Press Ctrl+C to exit${colors.reset}`);
console.log(`${colors.gray}Watching for changes...${colors.reset}\n`);

// Initial run
runBenchmarks();

// Handle cleanup
process.on('SIGINT', () => {
  console.log(`\n${colors.yellow}Shutting down...${colors.reset}`);
  if (runnerProcess) {
    runnerProcess.kill('SIGTERM');
  }
  process.exit(0);
});