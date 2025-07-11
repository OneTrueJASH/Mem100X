#!/usr/bin/env node

/**
 * Direct comparison runner for Mem100x vs Official MCP Memory Server
 * Runs the same benchmarks on both servers and displays side-by-side results
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Simple color helpers
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
  cyan: '\x1b[36m'
};

console.log(`${colors.bright}${colors.blue}🏁 MCP Memory Server Comparison${colors.reset}\n`);
console.log(`${colors.cyan}Comparing Mem100x vs Official MCP Memory Server${colors.reset}\n`);

// Check if official server is set up
const officialServerPath = '/Users/josh/source/personal/mcp-servers-official/src/memory/dist/index.js';
const symlinkPath = path.join(__dirname, 'servers', 'official-memory', 'dist', 'index.js');

if (!fs.existsSync(officialServerPath) && !fs.existsSync(symlinkPath)) {
  console.error(`${colors.red}❌ Official server not found!${colors.reset}\n`);
  console.log(`Please run: ${colors.yellow}./setup-official-server.sh${colors.reset}\n`);
  process.exit(1);
}

// Parse arguments
const args = process.argv.slice(2);
const quickMode = args.includes('--quick') || args.includes('-q');
const verboseMode = args.includes('--verbose') || args.includes('-v');
const scenariosArg = args.find(arg => arg.startsWith('--scenarios='));
const scenarios = scenariosArg ? scenariosArg.split('=')[1] : 
  quickMode ? 'entity-creation-throughput,search-performance' : null;

// Configuration
const config = {
  servers: 'mem100x,official-memory',
  scenarios: scenarios,
  quick: quickMode,
  verbose: verboseMode,
  iterations: quickMode ? 100 : undefined
};

console.log(`${colors.gray}Configuration:${colors.reset}`);
console.log(`  Mode: ${quickMode ? 'Quick (reduced iterations)' : 'Full'}`);
console.log(`  Scenarios: ${scenarios || 'All'}`);
console.log(`  Verbose: ${verboseMode ? 'Yes' : 'No'}`);
console.log('');

// Function to run benchmarks
async function runBenchmarks() {
  console.log(`${colors.yellow}Starting benchmark comparison...${colors.reset}\n`);

  const env = {
    ...process.env,
    SERVERS: config.servers,
    BENCHMARK_MODE: 'local',
    NODE_ENV: 'production'
  };

  if (config.scenarios) {
    env.SCENARIOS = config.scenarios;
  }

  if (config.quick) {
    env.QUICK_MODE = 'true';
  }

  if (config.iterations) {
    env.ITERATIONS = config.iterations.toString();
  }

  return new Promise((resolve, reject) => {
    const runner = spawn('node', ['dist/runner.js'], {
      env,
      stdio: 'inherit'
    });

    runner.on('error', (err) => {
      console.error(`${colors.red}Failed to run benchmarks:${colors.reset}`, err.message);
      reject(err);
    });

    runner.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Benchmarks failed with code ${code}`));
      }
    });
  });
}

// Function to show comparison summary
async function showComparison() {
  console.log(`\n${colors.bright}${colors.green}📊 Performance Comparison Summary${colors.reset}\n`);
  
  try {
    // Find the latest results file
    const resultsDir = path.join(__dirname, 'results');
    const files = fs.readdirSync(resultsDir)
      .filter(f => f.startsWith('benchmark-') && f.endsWith('.json'))
      .sort()
      .reverse();
    
    if (files.length === 0) {
      console.log(`${colors.red}No results found${colors.reset}`);
      return;
    }
    
    const latestFile = path.join(resultsDir, files[0]);
    const rawResults = JSON.parse(fs.readFileSync(latestFile, 'utf8'));
    
    // Handle both array and object formats
    const results = Array.isArray(rawResults) ? rawResults : rawResults.results;
    
    // Group results by scenario
    const scenarios = {};
    if (results && Array.isArray(results)) {
      results.forEach(result => {
        if (!scenarios[result.scenario]) {
          scenarios[result.scenario] = {};
        }
        scenarios[result.scenario][result.server] = result;
      });
    } else {
      console.log(`${colors.red}Invalid results format${colors.reset}`);
      return;
    }
  
  // Display comparison for each scenario
  Object.entries(scenarios).forEach(([scenarioName, servers]) => {
    console.log(`${colors.bright}${scenarioName}:${colors.reset}`);
    
    const mem100x = servers['mem100x'];
    const official = servers['official-memory'];
    
    if (mem100x && official) {
      const speedup = (mem100x.performance.throughput / official.performance.throughput).toFixed(1);
      const mem100xLatency = mem100x.performance.latency.median || mem100x.performance.latency.p50;
      const officialLatency = official.performance.latency.median || official.performance.latency.p50;
      const latencyReduction = ((officialLatency - mem100xLatency) / officialLatency * 100);
      
      console.log(`  Mem100x:         ${colors.green}${Math.round(mem100x.performance.throughput)} ops/s${colors.reset} (${mem100xLatency.toFixed(2)}ms median)`);
      console.log(`  Official:        ${Math.round(official.performance.throughput)} ops/s (${officialLatency.toFixed(2)}ms median)`);
      console.log(`  ${colors.bright}${colors.green}Speed advantage: ${speedup}x faster${colors.reset}`);
      if (latencyReduction > 0) {
        console.log(`  ${colors.bright}${colors.green}Latency reduced: ${Math.round(latencyReduction)}%${colors.reset}`);
      }
    } else if (mem100x) {
      console.log(`  Mem100x: ${colors.green}${Math.round(mem100x.performance.throughput)} ops/s${colors.reset}`);
      console.log(`  Official: ${colors.red}No data${colors.reset}`);
    }
    console.log('');
  });
  
  // Overall performance summary
  console.log(`${colors.bright}${colors.cyan}Overall Performance:${colors.reset}`);
  const mem100xTotal = results
    .filter(r => r.server === 'mem100x')
    .reduce((sum, r) => sum + r.performance.throughput, 0);
  const officialTotal = results
    .filter(r => r.server === 'official-memory')
    .reduce((sum, r) => sum + r.performance.throughput, 0);
  
  if (mem100xTotal > 0 && officialTotal > 0) {
    const overallSpeedup = (mem100xTotal / officialTotal).toFixed(1);
    console.log(`  ${colors.bright}${colors.green}Mem100x is ${overallSpeedup}x faster overall${colors.reset}`);
  }
  } catch (error) {
    console.error(`${colors.red}Error showing comparison:${colors.reset}`, error.message);
  }
}

// Main execution
async function main() {
  try {
    // Check if dist directory exists
    if (!fs.existsSync(path.join(__dirname, 'dist', 'runner.js'))) {
      console.error(`${colors.red}Benchmarks not built. Please run: npm run build${colors.reset}`);
      process.exit(1);
    }
    
    await runBenchmarks();
    await showComparison();
    
    console.log(`\n${colors.green}✅ Comparison complete!${colors.reset}`);
  } catch (error) {
    console.error(`\n${colors.red}❌ Comparison failed:${colors.reset}`, error.message);
    process.exit(1);
  }
}

// Show usage
if (args.includes('--help') || args.includes('-h')) {
  console.log('Usage: ./run-comparison.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --quick, -q              Run quick comparison with reduced iterations');
  console.log('  --scenarios=<list>       Run specific scenarios (comma-separated)');
  console.log('  --verbose, -v            Show verbose output');
  console.log('  --help, -h               Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  ./run-comparison.js --quick');
  console.log('  ./run-comparison.js --scenarios=entity-creation-throughput,search-performance');
  process.exit(0);
}

main();