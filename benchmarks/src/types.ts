/**
 * Types for MCP Benchmark Suite
 */

export interface BenchmarkConfig {
  servers: ServerConfig[];
  scenarios: ScenarioConfig[];
  options: BenchmarkOptions;
}

export interface ServerConfig {
  name: string;
  type: 'mem100x' | 'official' | 'custom';
  dockerImage?: string;
  dockerFile?: string;
  startupTime?: number; // ms to wait after starting
  connectionConfig: {
    transport: 'stdio' | 'http';
    endpoint?: string;
  };
}

export interface ScenarioConfig {
  name: string;
  description: string;
  operations: Operation[];
  iterations: number;
  warmupIterations: number;
  concurrency: number;
}

export interface Operation {
  type:
    | 'create_entities'
    | 'search_nodes'
    | 'create_relations'
    | 'add_observations'
    | 'read_graph'
    | 'delete_entities';
  weight: number; // For mixed workloads
  params?: any;
}

export interface BenchmarkOptions {
  dockerLimits: {
    cpus: string;
    memory: string;
  };
  timeout: number;
  collectMetrics: boolean;
  outputFormat: 'json' | 'table' | 'csv';
}

export interface BenchmarkResult {
  server: string;
  scenario: string;
  timestamp: number;
  duration: number;
  operations: {
    total: number;
    successful: number;
    failed: number;
  };
  performance: {
    throughput: number; // ops/sec
    latency: {
      min: number;
      max: number;
      mean: number;
      median: number;
      p95: number;
      p99: number;
    };
  };
  resources: {
    memory: {
      initial: number;
      peak: number;
      final: number;
    };
    cpu: {
      average: number;
      peak: number;
    };
  };
  errors: Array<{
    operation: string;
    error: string;
    count: number;
  }>;
}

export interface ServerAdapter {
  name: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  executeOperation(operation: Operation): Promise<OperationResult>;
  getMetrics(): Promise<ResourceMetrics>;
}

export interface OperationResult {
  success: boolean;
  duration: number; // microseconds
  error?: string;
  data?: any;
}

export interface ResourceMetrics {
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
  };
  cpu: {
    user: number;
    system: number;
  };
}
