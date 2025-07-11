# Setting Up Official Server Comparison

This guide explains how to set up and run benchmarks comparing Mem100x with the official MCP memory server.

## Prerequisites

1. Ensure Mem100x is built:
   ```bash
   cd /Users/josh/source/personal/Mem100x
   npm run build
   ```

2. Ensure benchmarks are built:
   ```bash
   cd benchmarks
   npm install
   npm run build
   ```

## Setup Official Server

Run the setup script to clone and prepare the official server:

```bash
./setup-official-server.sh
```

This will:
- Clone the official MCP servers repository to `/Users/josh/source/personal/mcp-servers-official`
- Install dependencies for the memory server
- Build the official server
- Create a symlink for easy access

## Running Comparisons

### Quick Comparison (Recommended for testing)
```bash
./run-comparison.js --quick
```

### Full Comparison
```bash
./run-comparison.js
```

### Specific Scenarios
```bash
./run-comparison.js --scenarios=entity-creation-throughput,search-performance
```

## Understanding Results

The comparison script will:
1. Run the same benchmarks on both servers
2. Display side-by-side performance metrics
3. Calculate speed improvements
4. Show overall performance summary

### Key Metrics
- **Throughput**: Operations per second (higher is better)
- **Latency**: Response time in milliseconds (lower is better)
- **Speed advantage**: How many times faster Mem100x is

## Troubleshooting

### Official server not found
Run: `./setup-official-server.sh`

### Build errors
1. Check Node.js version (18+ required)
2. Clear node_modules and reinstall
3. Ensure TypeScript is installed globally

### Connection errors
- The official server might take longer to start
- Check if the server file exists at the expected path
- Use `--verbose` flag for more details

## Notes

- The official server is cloned OUTSIDE of the Mem100x repository
- Results are saved in the `results/` directory
- The comparison uses identical test scenarios for fairness