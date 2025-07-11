import { 
  BenchmarkConfig, 
  BenchmarkResult, 
  ServerConfig, 
  ScenarioConfig,
  Operation 
} from './types';
import { Mem100xAdapter } from './adapters/mem100x-adapter';
import { OfficialMemoryAdapter } from './adapters/official-adapter';
import { BaseAdapter } from './adapters/base-adapter';
import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import * as ss from 'simple-statistics';

class BenchmarkRunner {
  private config: BenchmarkConfig;
  private results: BenchmarkResult[] = [];

  constructor(configPath: string = '../config/benchmark-config.json') {
    this.config = require(configPath);
  }

  async run(): Promise<void> {
    console.log(chalk.bold.blue('\n🏁 MCP Memory Server Benchmark Suite\n'));
    
    const serversToTest = this.getServersToTest();
    
    for (const serverConfig of serversToTest) {
      console.log(chalk.bold.yellow(`\n📊 Benchmarking ${serverConfig.name}...\n`));
      
      const adapter = this.createAdapter(serverConfig);
      
      try {
        await adapter.connect();
        
        for (const scenario of this.config.scenarios) {
          await this.runScenario(adapter, serverConfig, scenario);
        }
        
        await adapter.disconnect();
      } catch (error) {
        console.error(chalk.red(`Failed to benchmark ${serverConfig.name}:`), error);
        await adapter.disconnect().catch(() => {});
      }
    }
    
    await this.saveResults();
    this.displaySummary();
  }

  private getServersToTest(): ServerConfig[] {
    const serversEnv = process.env.SERVERS;
    if (serversEnv) {
      const serverNames = serversEnv.split(',');
      return this.config.servers.filter(s => serverNames.includes(s.name));
    }
    return this.config.servers;
  }

  private createAdapter(config: ServerConfig): BaseAdapter {
    switch (config.type) {
      case 'mem100x':
        return new Mem100xAdapter(config);
      case 'official':
        return new OfficialMemoryAdapter(config);
      default:
        throw new Error(`Unknown server type: ${config.type}`);
    }
  }

  private async runScenario(
    adapter: BaseAdapter, 
    serverConfig: ServerConfig, 
    scenario: ScenarioConfig
  ): Promise<void> {
    const spinner = ora(`Running ${scenario.name}`).start();
    
    const result: BenchmarkResult = {
      server: serverConfig.name,
      scenario: scenario.name,
      timestamp: Date.now(),
      duration: 0,
      operations: {
        total: 0,
        successful: 0,
        failed: 0
      },
      performance: {
        throughput: 0,
        latency: {
          min: Infinity,
          max: 0,
          mean: 0,
          median: 0,
          p95: 0,
          p99: 0
        }
      },
      resources: {
        memory: { initial: 0, peak: 0, final: 0 },
        cpu: { average: 0, peak: 0 }
      },
      errors: []
    };

    // Get initial metrics
    const initialMetrics = await adapter.getMetrics();
    result.resources.memory.initial = initialMetrics.memory.rss;

    // Warmup
    spinner.text = `${scenario.name} - Warming up...`;
    for (let i = 0; i < scenario.warmupIterations; i++) {
      const operation = this.selectOperation(scenario.operations);
      await adapter.executeOperation(this.prepareOperation(operation, i));
    }

    // Main benchmark
    spinner.text = `${scenario.name} - Running benchmark...`;
    const latencies: number[] = [];
    const startTime = Date.now();
    const errorMap = new Map<string, number>();

    for (let i = 0; i < scenario.iterations; i++) {
      const operation = this.selectOperation(scenario.operations);
      const preparedOp = this.prepareOperation(operation, i);
      
      const opResult = await adapter.executeOperation(preparedOp);
      
      result.operations.total++;
      
      if (opResult.success) {
        result.operations.successful++;
        latencies.push(opResult.duration / 1000); // Convert to ms
      } else {
        result.operations.failed++;
        const errorKey = `${operation.type}: ${opResult.error}`;
        errorMap.set(errorKey, (errorMap.get(errorKey) || 0) + 1);
      }

      // Update progress
      if (i % 100 === 0) {
        spinner.text = `${scenario.name} - Progress: ${i}/${scenario.iterations}`;
      }
    }

    result.duration = Date.now() - startTime;

    // Calculate performance metrics
    if (latencies.length > 0) {
      result.performance.throughput = (result.operations.successful / result.duration) * 1000;
      result.performance.latency = {
        min: ss.min(latencies),
        max: ss.max(latencies),
        mean: ss.mean(latencies),
        median: ss.median(latencies),
        p95: ss.quantile(latencies, 0.95),
        p99: ss.quantile(latencies, 0.99)
      };
    }

    // Get final metrics
    const finalMetrics = await adapter.getMetrics();
    result.resources.memory.final = finalMetrics.memory.rss;
    result.resources.memory.peak = Math.max(
      result.resources.memory.initial,
      result.resources.memory.final
    );

    // Convert error map to array
    result.errors = Array.from(errorMap.entries()).map(([error, count]) => {
      const [operation, message] = error.split(': ');
      return { operation, error: message, count };
    });

    this.results.push(result);
    
    spinner.succeed(`${scenario.name} - Complete! (${result.operations.successful}/${result.operations.total} successful)`);
  }

  private selectOperation(operations: Operation[]): Operation {
    if (operations.length === 1) return operations[0];
    
    const totalWeight = operations.reduce((sum, op) => sum + op.weight, 0);
    const random = Math.random() * totalWeight;
    
    let cumulativeWeight = 0;
    for (const op of operations) {
      cumulativeWeight += op.weight;
      if (random <= cumulativeWeight) return op;
    }
    
    return operations[operations.length - 1];
  }

  private prepareOperation(operation: Operation, index: number): Operation {
    // Replace template variables in params
    const prepared = { ...operation };
    
    if (prepared.params) {
      const params = JSON.stringify(prepared.params);
      const replaced = params
        .replace(/{{index}}/g, index.toString())
        .replace(/{{timestamp}}/g, Date.now().toString())
        .replace(/{{index \+ 1}}/g, (index + 1).toString());
      prepared.params = JSON.parse(replaced);
    }
    
    return prepared;
  }

  private async saveResults(): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `benchmark-${timestamp}.json`;
    const filepath = path.join('results', filename);
    
    await fs.mkdir('results', { recursive: true });
    await fs.writeFile(filepath, JSON.stringify(this.results, null, 2));
    
    console.log(chalk.green(`\n✅ Results saved to ${filepath}`));
  }

  private displaySummary(): void {
    console.log(chalk.bold.blue('\n📈 Benchmark Summary\n'));

    // Group results by scenario
    const scenarios = [...new Set(this.results.map(r => r.scenario))];
    
    for (const scenario of scenarios) {
      console.log(chalk.bold.yellow(`\n${scenario}:`));
      
      const table = new Table({
        head: [
          'Server',
          'Throughput (ops/s)',
          'Latency p50 (ms)',
          'Latency p95 (ms)',
          'Latency p99 (ms)',
          'Success Rate'
        ],
        colWidths: [20, 20, 18, 18, 18, 15]
      });

      const scenarioResults = this.results.filter(r => r.scenario === scenario);
      
      for (const result of scenarioResults) {
        const successRate = ((result.operations.successful / result.operations.total) * 100).toFixed(1);
        
        table.push([
          result.server,
          result.performance.throughput.toFixed(0),
          result.performance.latency.median.toFixed(2),
          result.performance.latency.p95.toFixed(2),
          result.performance.latency.p99.toFixed(2),
          `${successRate}%`
        ]);
      }
      
      console.log(table.toString());
    }

    // Overall winner
    console.log(chalk.bold.green('\n🏆 Performance Summary:\n'));
    
    const serverTotals = new Map<string, number>();
    for (const result of this.results) {
      const current = serverTotals.get(result.server) || 0;
      serverTotals.set(result.server, current + result.performance.throughput);
    }
    
    const sorted = Array.from(serverTotals.entries())
      .sort((a, b) => b[1] - a[1]);
    
    sorted.forEach(([server, throughput], index) => {
      const icon = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
      console.log(`${icon} ${server}: ${throughput.toFixed(0)} total ops/s`);
    });
  }
}

// Run the benchmark
if (require.main === module) {
  const runner = new BenchmarkRunner();
  runner.run().catch(console.error);
}