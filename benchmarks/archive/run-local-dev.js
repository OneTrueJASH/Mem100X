#!/usr/bin/env node

/**
 * Enhanced local benchmark runner with development features
 * Supports individual scenario runs, multiple servers, and better error handling
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
// Chalk v5 is ESM only, so we need to use dynamic import or downgrade
const chalk = {
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  gray: (text) => `\x1b[90m${text}\x1b[0m`,
  bold: {
    blue: (text) => `\x1b[1m\x1b[34m${text}\x1b[0m`,
    green: (text) => `\x1b[1m\x1b[32m${text}\x1b[0m`,
    yellow: (text) => `\x1b[1m\x1b[33m${text}\x1b[0m`
  }
};

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .usage('Usage: $0 [options]')
  .option('servers', {
    alias: 's',
    type: 'string',
    description: 'Comma-separated list of servers to test',
    default: 'mem100x'
  })
  .option('scenarios', {
    alias: 'c',
    type: 'string',
    description: 'Comma-separated list of scenarios to run',
    default: 'all'
  })
  .option('iterations', {
    alias: 'i',
    type: 'number',
    description: 'Override default iterations for all scenarios'
  })
  .option('quick', {
    alias: 'q',
    type: 'boolean',
    description: 'Run quick version with reduced iterations',
    default: false
  })
  .option('verbose', {
    alias: 'v',
    type: 'boolean',
    description: 'Show server output',
    default: false
  })
  .option('keep-db', {
    alias: 'k',
    type: 'boolean',
    description: 'Keep database files after run',
    default: false
  })
  .help()
  .argv;

// Server configurations
const serverConfigs = {
  'mem100x': {
    name: 'Mem100x',
    path: path.join(__dirname, '..', 'dist', 'server-multi.js'),
    dbPath: '/tmp/mem100x-benchmark.db',
    startDelay: 2000
  },
  'mem100x-single': {
    name: 'Mem100x Single',
    path: path.join(__dirname, '..', 'dist', 'index.js'),
    dbPath: '/tmp/mem100x-single-benchmark.db',
    startDelay: 2000
  },
  'official': {
    name: 'Official Memory',
    path: path.join(__dirname, 'docker', 'servers', 'official-memory', 'index.js'),
    dbPath: '/tmp/official-benchmark.db',
    startDelay: 3000
  }
};

const runningServers = [];
const tempFiles = [];

// Cleanup function
function cleanup() {
  console.log('\n' + chalk.yellow('Shutting down...'));
  
  // Kill all running servers
  runningServers.forEach(server => {
    try {
      server.kill('SIGTERM');
    } catch (e) {
      // Ignore errors during cleanup
    }
  });
  
  // Clean up temp files unless keep-db is set
  if (!argv.keepDb) {
    tempFiles.forEach(file => {
      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
          console.log(chalk.gray(`Cleaned up: ${file}`));
        }
      } catch (e) {
        console.error(chalk.red(`Failed to clean up ${file}:`, e.message));
      }
    });
  }
  
  process.exit(0);
}

// Set up cleanup handlers
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', () => {
  if (!argv.keepDb) {
    tempFiles.forEach(file => {
      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      } catch (e) {
        // Ignore errors on exit
      }
    });
  }
});

// Main execution
async function main() {
  console.log(chalk.bold.blue('🏁 Enhanced Local MCP Benchmark Runner\n'));
  
  const serversToTest = argv.servers.split(',').filter(s => s.trim());
  const scenarios = argv.scenarios === 'all' ? undefined : argv.scenarios.split(',');
  
  // Validate servers
  for (const server of serversToTest) {
    if (!serverConfigs[server]) {
      console.error(chalk.red(`Unknown server: ${server}`));
      console.log(chalk.yellow(`Available servers: ${Object.keys(serverConfigs).join(', ')}`));
      process.exit(1);
    }
  }
  
  // Start servers
  console.log(chalk.yellow('Starting servers...'));
  for (const serverName of serversToTest) {
    const config = serverConfigs[serverName];
    
    // Check if server file exists
    if (!fs.existsSync(config.path)) {
      console.error(chalk.red(`Server file not found: ${config.path}`));
      console.log(chalk.yellow(`You may need to build the project first: npm run build`));
      process.exit(1);
    }
    
    console.log(chalk.gray(`Starting ${config.name}...`));
    
    // Track database files for cleanup
    tempFiles.push(config.dbPath);
    if (fs.existsSync(config.dbPath)) {
      fs.unlinkSync(config.dbPath);
    }
    
    const serverProcess = spawn('node', [config.path], {
      env: {
        ...process.env,
        MEMORY_DB: config.dbPath,
        NODE_ENV: 'production'
      },
      stdio: argv.verbose ? 'inherit' : 'pipe'
    });
    
    serverProcess.on('error', (err) => {
      console.error(chalk.red(`Failed to start ${config.name}:`, err.message));
      cleanup();
    });
    
    if (!argv.verbose) {
      // Capture output for error reporting
      serverProcess.stderr.on('data', (data) => {
        console.error(chalk.red(`[${config.name}] Error:`, data.toString()));
      });
    }
    
    runningServers.push(serverProcess);
  }
  
  // Wait for servers to start
  const maxDelay = Math.max(...serversToTest.map(s => serverConfigs[s].startDelay));
  console.log(chalk.gray(`Waiting ${maxDelay}ms for servers to initialize...\n`));
  await new Promise(resolve => setTimeout(resolve, maxDelay));
  
  // Prepare environment for runner
  const env = {
    ...process.env,
    SERVERS: serversToTest.join(','),
    BENCHMARK_MODE: 'local',
    NODE_ENV: 'production'
  };
  
  if (scenarios) {
    env.SCENARIOS = scenarios.join(',');
  }
  
  if (argv.iterations) {
    env.ITERATIONS = argv.iterations.toString();
  }
  
  if (argv.quick) {
    env.QUICK_MODE = 'true';
  }
  
  // Run benchmarks
  console.log(chalk.bold.green('Running benchmarks...\n'));
  
  const runner = spawn('node', ['dist/runner.js'], {
    env,
    stdio: 'inherit'
  });
  
  runner.on('error', (err) => {
    console.error(chalk.red('Failed to run benchmarks:', err.message));
    cleanup();
  });
  
  runner.on('close', (code) => {
    if (code === 0) {
      console.log(chalk.bold.green('\n✅ Benchmarks completed successfully!'));
    } else {
      console.error(chalk.red(`\n❌ Benchmarks failed with code ${code}`));
    }
    cleanup();
  });
}

// Run the main function
main().catch(err => {
  console.error(chalk.red('Fatal error:', err));
  cleanup();
});