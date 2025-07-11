# MCP Memory Server Benchmark Suite

A fair and reproducible benchmarking framework for comparing MCP memory server implementations.

## Overview

This benchmark suite provides:
- **Fair comparison**: All servers run with identical resource constraints
- **Reproducible results**: Docker ensures consistent environment
- **Multiple scenarios**: From simple throughput to complex mixed workloads
- **Extensible design**: Easy to add new servers or scenarios

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js 20+
- At least 2GB free RAM

### Running Benchmarks

```bash
# Build all containers
cd benchmarks
npm install
npm run docker:build

# Run all benchmarks
npm run benchmark:all

# Run specific server
npm run benchmark:mem100x
npm run benchmark:official

# Compare results
npm run compare
```

## Benchmark Scenarios

### 1. Entity Creation Throughput
- **Goal**: Measure raw write performance
- **Operations**: 10,000 entity creations
- **Metric**: Entities per second

### 2. Search Performance
- **Goal**: Measure query speed
- **Operations**: 1,000 searches
- **Metric**: Searches per second

### 3. Mixed Workload
- **Goal**: Realistic usage patterns
- **Operations**: 50% reads, 20% writes, 20% searches, 10% updates
- **Metric**: Operations per second

### 4. Relation Performance
- **Goal**: Graph operation speed
- **Operations**: 5,000 relation creations
- **Metric**: Relations per second

### 5. Stress Test
- **Goal**: High concurrency handling
- **Operations**: 50 concurrent clients
- **Metric**: Latency under load

## Resource Constraints

All servers run with:
- **CPU**: 1.0 cores
- **Memory**: 512MB
- **Swap**: Disabled
- **Network**: Isolated

## Adding a New Server

1. Create adapter in `src/adapters/`:
```typescript
export class YourServerAdapter extends BaseAdapter {
  // Implement required methods
}
```

2. Create Dockerfile in `docker/servers/your-server/`:
```dockerfile
FROM node:20-alpine
# Your server setup
```

3. Add to `config/benchmark-config.json`:
```json
{
  "name": "your-server",
  "type": "custom",
  "dockerImage": "benchmark-your-server"
}
```

## Results Format

Results are saved in `results/` with timestamp:
```json
{
  "timestamp": "2024-01-11T12:00:00Z",
  "results": [
    {
      "server": "mem100x",
      "scenario": "entity-creation-throughput",
      "performance": {
        "throughput": 66821,
        "latency": {
          "p95": 0.015,
          "p99": 0.025
        }
      }
    }
  ]
}
```

## Understanding Results

- **Throughput**: Operations completed per second (higher is better)
- **Latency**: Time per operation in ms (lower is better)
  - p50: Median latency
  - p95: 95% of operations complete within this time
  - p99: 99% of operations complete within this time
- **Memory**: Peak memory usage during test
- **CPU**: Average CPU utilization

## Troubleshooting

### Container won't start
- Check Docker daemon is running
- Ensure ports aren't in use
- Verify resource limits aren't too restrictive

### Benchmark hangs
- Increase timeout in config
- Check server logs in `logs/`
- Ensure server supports all MCP operations

### Inconsistent results
- Run multiple iterations
- Ensure no other processes consuming resources
- Check for thermal throttling

## Contributing

To add new benchmark scenarios or improve the framework:
1. Fork the repository
2. Add your changes
3. Ensure all existing benchmarks still run
4. Submit a PR with benchmark results

## License

Same as parent project (MIT)