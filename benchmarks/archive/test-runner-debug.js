#!/usr/bin/env node

const { BenchmarkRunner } = require('./dist/runner.js');
const config = require('./config/benchmark-config.json');

async function test() {
  console.log('Testing benchmark runner...');
  
  // Override config for single server, single scenario
  const testConfig = {
    ...config,
    servers: [config.servers.find(s => s.name === 'mem100x')],
    scenarios: [{
      name: 'test-scenario',
      description: 'Test scenario',
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
      iterations: 2,
      warmupIterations: 1,
      concurrency: 1
    }]
  };
  
  // Set environment variables
  process.env.DISABLE_RATE_LIMITING = 'true';
  process.env.ITERATIONS = '2';
  
  const runner = new BenchmarkRunner(testConfig);
  
  try {
    await runner.run();
    console.log('✅ Benchmark completed');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

test().catch(console.error);