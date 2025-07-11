#!/usr/bin/env node

import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';
import Table from 'cli-table3';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function findLatestResults() {
  const resultsDir = path.join(__dirname, '..', 'results');
  const files = await fs.readdir(resultsDir);
  
  const benchmarkFiles = files
    .filter(f => f.startsWith('benchmark-') && f.endsWith('.json'))
    .sort()
    .reverse();
  
  if (benchmarkFiles.length === 0) {
    throw new Error('No benchmark results found');
  }
  
  return path.join(resultsDir, benchmarkFiles[0]);
}

async function compareResults(resultsFile) {
  const results = JSON.parse(await fs.readFile(resultsFile, 'utf-8'));
  
  console.log(chalk.bold.blue('\n📊 MCP Memory Server Comparison Report\n'));
  
  // Group by scenario
  const byScenario = results.reduce((acc, result) => {
    if (!acc[result.scenario]) acc[result.scenario] = {};
    acc[result.scenario][result.server] = result;
    return acc;
  }, {});
  
  // For each scenario, show comparison
  for (const [scenario, servers] of Object.entries(byScenario)) {
    console.log(chalk.bold.yellow(`\n${scenario}:`));
    
    const serverNames = Object.keys(servers);
    if (serverNames.length < 2) {
      console.log(chalk.gray('  (Only one server tested, no comparison available)'));
      continue;
    }
    
    // Create comparison table
    const table = new Table({
      head: ['Metric', ...serverNames, 'Winner'],
      colWidths: [25, ...serverNames.map(() => 20), 15]
    });
    
    // Throughput comparison
    const throughputs = serverNames.map(name => servers[name].performance.throughput);
    const maxThroughput = Math.max(...throughputs);
    const throughputWinner = serverNames[throughputs.indexOf(maxThroughput)];
    
    table.push([
      'Throughput (ops/s)',
      ...throughputs.map((t, i) => {
        const val = t.toFixed(0);
        return t === maxThroughput ? chalk.green(val) : val;
      }),
      chalk.green(throughputWinner)
    ]);
    
    // Latency comparisons
    const metrics = ['median', 'p95', 'p99'];
    const metricNames = {
      median: 'Latency p50 (ms)',
      p95: 'Latency p95 (ms)',
      p99: 'Latency p99 (ms)'
    };
    
    for (const metric of metrics) {
      const latencies = serverNames.map(name => servers[name].performance.latency[metric]);
      const minLatency = Math.min(...latencies);
      const latencyWinner = serverNames[latencies.indexOf(minLatency)];
      
      table.push([
        metricNames[metric],
        ...latencies.map((l, i) => {
          const val = l.toFixed(2);
          return l === minLatency ? chalk.green(val) : val;
        }),
        chalk.green(latencyWinner)
      ]);
    }
    
    // Success rate
    const successRates = serverNames.map(name => 
      (servers[name].operations.successful / servers[name].operations.total) * 100
    );
    const maxSuccess = Math.max(...successRates);
    const successWinner = serverNames[successRates.indexOf(maxSuccess)];
    
    table.push([
      'Success Rate (%)',
      ...successRates.map((s, i) => {
        const val = s.toFixed(1) + '%';
        return s === maxSuccess ? chalk.green(val) : val;
      }),
      chalk.green(successWinner)
    ]);
    
    console.log(table.toString());
    
    // Calculate performance difference
    if (serverNames.includes('mem100x') && serverNames.length === 2) {
      const mem100x = servers['mem100x'];
      const other = servers[serverNames.find(n => n !== 'mem100x')];
      
      const speedup = mem100x.performance.throughput / other.performance.throughput;
      const latencyReduction = (other.performance.latency.median - mem100x.performance.latency.median) / other.performance.latency.median * 100;
      
      console.log(chalk.bold(`\n  Mem100x Performance:`));
      console.log(`    • ${speedup.toFixed(1)}x faster throughput`);
      console.log(`    • ${latencyReduction.toFixed(0)}% lower median latency`);
    }
  }
  
  // Overall summary
  console.log(chalk.bold.green('\n🏆 Overall Performance Summary:\n'));
  
  const overallScores = {};
  for (const result of results) {
    if (!overallScores[result.server]) {
      overallScores[result.server] = {
        scenarios: 0,
        totalThroughput: 0,
        avgLatency: 0
      };
    }
    
    overallScores[result.server].scenarios++;
    overallScores[result.server].totalThroughput += result.performance.throughput;
    overallScores[result.server].avgLatency += result.performance.latency.median;
  }
  
  // Calculate averages and sort
  const rankings = Object.entries(overallScores)
    .map(([server, scores]) => ({
      server,
      avgThroughput: scores.totalThroughput / scores.scenarios,
      avgLatency: scores.avgLatency / scores.scenarios
    }))
    .sort((a, b) => b.avgThroughput - a.avgThroughput);
  
  rankings.forEach((rank, index) => {
    const icon = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
    console.log(`${icon} ${rank.server}:`);
    console.log(`   Average throughput: ${rank.avgThroughput.toFixed(0)} ops/s`);
    console.log(`   Average latency: ${rank.avgLatency.toFixed(2)} ms`);
  });
}

// Main
async function main() {
  try {
    const resultsFile = process.argv[2] || await findLatestResults();
    await compareResults(resultsFile);
  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
    process.exit(1);
  }
}

main();