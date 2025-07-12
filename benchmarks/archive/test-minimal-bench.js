#!/usr/bin/env node

const { BenchmarkRunner } = require('./dist/runner.js');

// Custom config with minimal iterations
const config = {
  servers: [{
    name: 'mem100x',
    type: 'mem100x',
    startupTime: 2000,
    connectionConfig: {
      transport: 'stdio'
    }
  }],
  scenarios: [{
    name: 'minimal-test',
    description: 'Minimal test scenario',
    operations: [{
      type: 'create_entities',
      weight: 1.0,
      params: {
        entities: [{
          name: 'test-{{index}}',
          entityType: 'benchmark',
          observations: ['Test']
        }]
      }
    }],
    iterations: 10,
    warmupIterations: 2,
    concurrency: 1
  }],
  options: {
    dockerLimits: {
      cpus: '2',
      memory: '2g'
    },
    timeout: 60000,
    collectMetrics: true,
    outputFormat: 'json'
  }
};

async function test() {
  console.log('Running minimal benchmark test...');
  
  process.env.DISABLE_RATE_LIMITING = 'true';
  
  const runner = new BenchmarkRunner(config);
  
  try {
    await runner.run();
    console.log('✅ Benchmark completed');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

test().catch(console.error);