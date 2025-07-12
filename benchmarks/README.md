# Mem100x Benchmark Suite

A clean, focused benchmark suite for testing Mem100x database performance without MCP overhead.

## Overview

This benchmark suite focuses on **direct database operations** to measure the core performance of Mem100x. We've separated the database layer from the MCP layer to isolate performance issues and provide reliable metrics.

## Key Findings

### ✅ Database Performance (Excellent)

- **Database initialization**: 17-18ms
- **Single entity creation**: 1ms
- **Bulk insert (200 entities)**: 6ms
- **Search operations**: 0-33ms (depending on complexity)
- **Graph operations**: 0-1ms
- **Relations**: 0-17ms
- **Observations**: 0-5ms

### ❌ MCP Layer Issues (Needs Investigation)

- **Server startup**: 136ms (acceptable)
- **Tool listing**: 1ms (works fine)
- **Tool execution**: 5+ second timeouts (problematic)

## Benchmark Files

### 1. `simple-bench.js` - Basic Operations

Tests fundamental database operations with minimal data:

- Single entity creation
- Small batch operations (10-100 entities)
- Basic search and graph operations
- Relations and observations

**Usage:**

```bash
node benchmarks/simple-bench.js
```

### 2. `comprehensive-bench.js` - Full Performance Test

Comprehensive benchmark with realistic data scenarios:

- 200 entities with various types and complexity
- 45 relations between entities
- Multiple search patterns
- Bulk operations
- Concurrent operations simulation

**Usage:**

```bash
node benchmarks/comprehensive-bench.js
```

### 3. `mcp-simple-test.js` - MCP Layer Test

Tests the MCP server layer (currently has timeout issues):

- Server connection
- Tool listing
- Simple tool operations
- Entity creation via MCP

**Usage:**

```bash
node benchmarks/mcp-simple-test.js
```

## Performance Results

### Comprehensive Benchmark Summary (Latest Run)

```
Total operations: 18
Total time: 117ms
Average time: 6.50ms
Min time: 0ms
Max time: 33ms

Results by Category:
  Insert: 2 ops, avg 10.00ms
  Search: 5 ops, avg 10.20ms
  Relations: 3 ops, avg 6.00ms
  Graph: 3 ops, avg 0.67ms
  Observations: 2 ops, avg 2.50ms
  Concurrent: 1 ops, avg 1.00ms
```

### Performance Highlights

- **Fastest operations**: Graph reads (0-1ms), simple searches (0-2ms)
- **Most intensive**: Complex text search (33ms), bulk relations (17ms)
- **Scalability**: Bulk insert of 200 entities in 6ms (33,333 entities/second)
- **Concurrent operations**: 10 concurrent reads in 1ms

## Test Data Structure

The comprehensive benchmark uses realistic test data:

### Entities (200 total)

- **100 simple entities**: Single observation each
- **50 complex entities**: 3 observations each
- **25 person entities**: With age and location data
- **25 city entities**: With population data

### Relations (45 total)

- **25 person-city relations**: "lives_in" relationships
- **20 person-person relations**: "knows" relationships

## Architecture

### Clean Database Approach

- Uses temporary databases for each test run
- Automatic cleanup of database files and bloom filters
- No interference between test runs
- Consistent baseline performance

### MCP Layer Isolation

- Database operations tested directly
- MCP issues identified and isolated
- Clear separation of concerns

## Troubleshooting

### Hanging Cleanup

If tests hang during cleanup:

1. Check for active database connections
2. Ensure proper database.close() calls
3. Add delays for file handle release

### MCP Timeouts

If MCP tests timeout:

1. The issue is in the MCP tool handlers, not the database
2. Focus on direct database benchmarks for performance metrics
3. Investigate MCP layer separately

## Future Improvements

1. **Fix MCP Layer**: Resolve timeout issues in tool handlers
2. **Add Load Testing**: Test with larger datasets (10K+ entities)
3. **Memory Profiling**: Monitor memory usage during operations
4. **Concurrency Testing**: Test with multiple concurrent clients
5. **Persistence Testing**: Test with persistent databases

## Archive

The `benchmarks/archive/` directory contains the previous complex benchmark suite that had MCP integration issues. The new suite provides cleaner, more reliable performance metrics.
