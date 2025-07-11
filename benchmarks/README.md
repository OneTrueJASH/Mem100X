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
- Node.js 18+
- Docker and Docker Compose (for production benchmarks)
- Built main project (`npm run build` in parent directory)

### Installation
```bash
cd benchmarks
npm install
npm run build
```

### Running Benchmarks

#### Local Development (Recommended for testing)

1. **Quick Test** - Run a single scenario with reduced iterations:
```bash
./run-local-dev.js --quick --scenarios entity-creation-throughput
```

2. **Full Local Run** - Run all scenarios locally:
```bash
./run-local.js
# or with enhanced features:
./run-local-dev.js
```

3. **Watch Mode** - Auto-rerun benchmarks on file changes:
```bash
./watch-benchmarks.js
```

4. **Custom Configuration**:
```bash
# Run specific servers
./run-local-dev.js --servers mem100x,mem100x-single

# Run specific scenarios
./run-local-dev.js --scenarios entity-creation-throughput,search-performance

# Custom iterations
./run-local-dev.js --iterations 1000

# Verbose mode (show server output)
./run-local-dev.js --verbose

# Keep database files after run
./run-local-dev.js --keep-db
```

#### Docker Production Benchmarks

```bash
# Build and run all benchmarks
./scripts/run-benchmark.sh

# Run specific servers
./scripts/run-benchmark.sh --servers mem100x,official

# Build only
./scripts/run-benchmark.sh --build-only

# Skip build
./scripts/run-benchmark.sh --skip-build
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

## Available Scripts

- `run-local.js` - Basic local benchmark runner
- `run-local-dev.js` - Enhanced local runner with CLI options
- `watch-benchmarks.js` - Development watch mode
- `test-basic.js` - Test MCP client connection
- `scripts/run-benchmark.sh` - Docker-based production benchmarks
- `scripts/compare-results.js` - Compare benchmark results

## Troubleshooting

### Server won't start
- Ensure main project is built: `cd .. && npm run build`
- Check if database files need cleanup
- Use `--verbose` flag to see server output
- Check Docker daemon is running (for Docker benchmarks)

### Module not found errors
- Run `npm install` in both benchmarks and parent directory
- Rebuild: `npm run build`

### Permission denied
- Make scripts executable: `chmod +x *.js scripts/*.sh`

### Benchmark hangs
- Increase timeout in config
- Check server logs in `logs/` or use `--verbose`
- Ensure server supports all MCP operations

### Inconsistent results
- Run multiple iterations
- Ensure no other processes consuming resources
- Check for thermal throttling
- Use Docker mode for more consistent results

## Contributing

To add new benchmark scenarios or improve the framework:
1. Fork the repository
2. Add your changes
3. Ensure all existing benchmarks still run
4. Submit a PR with benchmark results

## License

Same as parent project (MIT)