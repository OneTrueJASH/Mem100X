#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class RealisticBenchmarkRunner {
  constructor() {
    this.config = require('./config/realistic-benchmarks.json');
    this.randomData = this.config.options.randomData;
  }

  // Generate random data for template substitution
  getRandomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  // Substitute placeholders in operation parameters
  substitutePlaceholders(params, index) {
    if (!params) return params;

    const timestamp = Date.now();
    const session = `session-${timestamp}`;
    const batch = Math.floor(index / 10) + 1;
    const user = this.getRandomItem(this.randomData.users);
    const otherUser = this.getRandomItem(this.randomData.users.filter(u => u !== user));
    const topic = this.getRandomItem(this.randomData.topics);
    const project = this.getRandomItem(this.randomData.projects);
    const source = this.getRandomItem(this.randomData.sources);
    const searchTerm = this.getRandomItem(this.randomData.searchTerms);
    const context = this.getRandomItem(this.randomData.contexts);
    const thought = this.getRandomItem(this.randomData.thoughts);

    const substitutions = {
      '{{timestamp}}': timestamp,
      '{{index}}': index,
      '{{session}}': session,
      '{{batch}}': batch,
      '{{user}}': user,
      '{{otherUser}}': otherUser,
      '{{topic}}': topic,
      '{{project}}': project,
      '{{source}}': source,
      '{{searchTerm}}': searchTerm,
      '{{context}}': context,
      '{{thought}}': thought,
      '{{randomTopic}}': this.getRandomItem(this.randomData.topics),
      '{{randomContext}}': this.getRandomItem(this.randomData.contexts),
      '{{randomSearchTerm}}': this.getRandomItem(this.randomData.searchTerms),
      '{{randomThought}}': this.getRandomItem(this.randomData.thoughts),
      '{{randomContribution}}': `Contribution about ${this.getRandomItem(this.randomData.topics)}`,
      '{{randomProject}}': this.getRandomItem(this.randomData.projects),
      '{{randomAddition}}': `Additional info about ${this.getRandomItem(this.randomData.topics)}`,
      '{{randomFinding}}': `Finding related to ${this.getRandomItem(this.randomData.topics)}`,
      '{{randomSource}}': this.getRandomItem(this.randomData.sources),
      '{{randomResearchTerm}}': this.getRandomItem(this.randomData.searchTerms),
      '{{randomAnalysis}}': `Analysis of ${this.getRandomItem(this.randomData.topics)}`,
      '{{randomUserInput}}': `User input about ${this.getRandomItem(this.randomData.topics)}`,
      '{{randomAIResponse}}': `AI response about ${this.getRandomItem(this.randomData.topics)}`,
      '{{randomInfo}}': `Information about ${this.getRandomItem(this.randomData.topics)}`,
      '{{randomUpdate}}': `Update about ${this.getRandomItem(this.randomData.topics)}`
    };

    const substitute = (obj) => {
      if (typeof obj === 'string') {
        let result = obj;
        for (const [placeholder, value] of Object.entries(substitutions)) {
          result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
        }
        return result;
      } else if (Array.isArray(obj)) {
        return obj.map(substitute);
      } else if (obj && typeof obj === 'object') {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
          result[key] = substitute(value);
        }
        return result;
      }
      return obj;
    };

    return substitute(params);
  }

  // Select operation based on weights
  selectOperation(operations) {
    const totalWeight = operations.reduce((sum, op) => sum + op.weight, 0);
    let random = Math.random() * totalWeight;

    for (const operation of operations) {
      random -= operation.weight;
      if (random <= 0) {
        return operation;
      }
    }
    return operations[0]; // Fallback
  }

  async runScenario(scenarioName) {
    const scenario = this.config.scenarios.find(s => s.name === scenarioName);
    if (!scenario) {
      throw new Error(`Scenario ${scenarioName} not found`);
    }

    console.log(`\n🧪 Running ${scenario.name}: ${scenario.description}`);
    console.log(`📊 Operations: ${scenario.iterations} iterations, ${scenario.concurrency} concurrent`);

    const results = {
      scenario: scenario.name,
      operations: {
        total: 0,
        successful: 0,
        failed: 0,
        byType: {}
      },
      performance: {
        totalTime: 0,
        averageLatency: 0,
        throughput: 0
      },
      errors: []
    };

    const startTime = Date.now();
    const latencies = [];

    // Run operations
    for (let i = 0; i < scenario.iterations; i++) {
      const operation = this.selectOperation(scenario.operations);
      const params = this.substitutePlaceholders(operation.params, i);

      const opStart = Date.now();
      try {
        // Simulate operation execution (replace with actual MCP calls)
        await this.executeOperation(operation.type, params);
        const latency = Date.now() - opStart;

        results.operations.total++;
        results.operations.successful++;
        latencies.push(latency);

        if (!results.operations.byType[operation.type]) {
          results.operations.byType[operation.type] = { total: 0, successful: 0, failed: 0 };
        }
        results.operations.byType[operation.type].total++;
        results.operations.byType[operation.type].successful++;

      } catch (error) {
        results.operations.total++;
        results.operations.failed++;
        results.errors.push(`${operation.type}: ${error.message}`);

        if (!results.operations.byType[operation.type]) {
          results.operations.byType[operation.type] = { total: 0, successful: 0, failed: 0 };
        }
        results.operations.byType[operation.type].total++;
        results.operations.byType[operation.type].failed++;
      }

      // Progress indicator
      if ((i + 1) % 10 === 0) {
        process.stdout.write(`\r   Progress: ${i + 1}/${scenario.iterations} (${Math.round((i + 1) / scenario.iterations * 100)}%)`);
      }
    }

    const totalTime = Date.now() - startTime;
    results.performance.totalTime = totalTime;
    results.performance.averageLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    results.performance.throughput = (results.operations.successful / totalTime) * 1000; // ops/sec

    console.log(`\n✅ Completed ${scenario.name}`);
    console.log(`   📈 Throughput: ${results.performance.throughput.toFixed(2)} ops/sec`);
    console.log(`   ⏱️  Average latency: ${results.performance.averageLatency.toFixed(2)}ms`);
    console.log(`   ✅ Success rate: ${((results.operations.successful / results.operations.total) * 100).toFixed(1)}%`);

    if (results.operations.failed > 0) {
      console.log(`   ❌ Failures: ${results.operations.failed}`);
    }

    return results;
  }

  // Simulate operation execution (replace with actual MCP client calls)
  async executeOperation(type, params) {
    // Simulate realistic operation times
    const delays = {
      'create_entities': 5 + Math.random() * 10,    // 5-15ms
      'search_nodes': 10 + Math.random() * 20,      // 10-30ms
      'create_relations': 3 + Math.random() * 7,    // 3-10ms
      'add_observations': 8 + Math.random() * 12,   // 8-20ms
      'read_graph': 50 + Math.random() * 100        // 50-150ms
    };

    await new Promise(resolve => setTimeout(resolve, delays[type] || 10));

    // Simulate occasional failures
    if (Math.random() < 0.01) { // 1% failure rate
      throw new Error('Simulated operation failure');
    }
  }

  async runAllScenarios() {
    console.log('🏁 Running Realistic Benchmark Suite\n');

    const allResults = [];

    for (const scenario of this.config.scenarios) {
      try {
        const result = await this.runScenario(scenario.name);
        allResults.push(result);
      } catch (error) {
        console.error(`❌ Failed to run ${scenario.name}:`, error.message);
      }
    }

    this.displaySummary(allResults);
  }

  displaySummary(results) {
    console.log('\n📊 Benchmark Summary\n');
    console.log('='.repeat(80));

    for (const result of results) {
      console.log(`\n${result.scenario}:`);
      console.log(`  Throughput: ${result.performance.throughput.toFixed(2)} ops/sec`);
      console.log(`  Avg Latency: ${result.performance.averageLatency.toFixed(2)}ms`);
      console.log(`  Success Rate: ${((result.operations.successful / result.operations.total) * 100).toFixed(1)}%`);

      if (Object.keys(result.operations.byType).length > 0) {
        console.log('  Operations by type:');
        for (const [type, stats] of Object.entries(result.operations.byType)) {
          console.log(`    ${type}: ${stats.successful}/${stats.total} (${((stats.successful / stats.total) * 100).toFixed(1)}%)`);
        }
      }
    }
  }
}

// CLI interface
async function main() {
  const runner = new RealisticBenchmarkRunner();

  const scenario = process.argv[2];
  if (scenario) {
    await runner.runScenario(scenario);
  } else {
    await runner.runAllScenarios();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = RealisticBenchmarkRunner;
