# Mem100x Configuration Guide

**For Power Users and Advanced Configuration**

Mem100x provides extensive configuration options for power users who need to tune performance, customize behavior, or adapt to specific environments.

## Quick Start

1. **Copy the example configuration:**
   ```bash
   cp env.example .env
   ```

2. **Edit the configuration:**
   ```bash
   nano .env
   ```

3. **Validate your configuration:**
   ```bash
   npx tsx scripts/validate-config.js
   ```

## Configuration Methods

### Environment Variables (Recommended)

Set environment variables in a `.env` file or system environment:

```bash
# Database performance
DATABASE_CACHE_SIZE_MB=512
DATABASE_MMAP_SIZE_MB=2048

# Cache settings
ENTITY_CACHE_SIZE=100000
CACHE_STRATEGY=arc

# Logging
LOG_LEVEL=debug
```

### System Environment Variables

```bash
export DATABASE_CACHE_SIZE_MB=512
export ENTITY_CACHE_SIZE=100000
npx mem100x
```

## Configuration Categories

### 🗄️ Database Configuration

| Variable | Default | Description | Performance Impact |
|----------|---------|-------------|-------------------|
| `DATABASE_PATH` | `./data/memory.db` | Database file path | None |
| `DATABASE_CACHE_SIZE_MB` | `256` | SQLite cache size | **High** - More cache = faster queries |
| `DATABASE_MMAP_SIZE_MB` | `1024` | Memory-mapped file size | **High** - More MMAP = better I/O |
| `DATABASE_PAGE_SIZE_KB` | `16` | SQLite page size | **Medium** - 16KB is optimal for most cases |
| `DATABASE_WAL_AUTOCHECKPOINT` | `1000` | WAL checkpoint frequency | **Low** - Lower = more durable, slower writes |
| `DATABASE_BUSY_TIMEOUT` | `30000` | Lock timeout (ms) | **Low** - Increase if you get "database locked" errors |

### ⚡ Performance Configuration

| Variable | Default | Description | Performance Impact |
|----------|---------|-------------|-------------------|
| `ENTITY_CACHE_SIZE` | `50000` | Entities in memory cache | **Very High** - More cache = faster access |
| `SEARCH_CACHE_SIZE` | `10000` | Search results cache | **High** - Reduces repeated search time |
| `RELATION_QUERY_THRESHOLD` | `500` | Optimized relation queries | **Medium** - Threshold for query optimization |
| `COMPRESSION_ENABLED` | `true` | Compress large observations | **Medium** - Saves space, slight CPU cost |
| `CACHE_STRATEGY` | `lru` | Cache replacement strategy | **High** - Affects cache hit rates |
| `USE_READ_POOL` | `true` | Database connection pool | **High** - Better concurrent performance |
| `READ_POOL_SIZE` | `20` | Connection pool size | **High** - More connections = better concurrency |
| `BATCH_SIZE` | `1000` | Bulk operation batch size | **High** - Larger batches = better throughput |
| `ENABLE_BULK_OPERATIONS` | `true` | Enable batch processing | **Very High** - Essential for performance |
| `ENABLE_PREPARED_STATEMENTS` | `true` | Use prepared statements | **High** - Faster query execution |
| `ENABLE_DYNAMIC_BATCH_SIZING` | `true` | Auto-adjust batch size | **Medium** - Optimizes memory usage |
| `MAX_BATCH_SIZE` | `5000` | Maximum batch size | **Medium** - Upper limit for batches |
| `TARGET_BATCH_MEMORY_MB` | `50` | Target memory per batch | **Low** - Memory management |
| `PROFILING_ENABLED` | `false` | Performance profiling | **None** - Debugging only |

### 🌸 Bloom Filter Configuration

| Variable | Default | Description | Performance Impact |
|----------|---------|-------------|-------------------|
| `BLOOM_FILTER_EXPECTED_ITEMS` | `50000` | Expected items in filter | **Medium** - Affects memory usage |
| `BLOOM_FILTER_FALSE_POSITIVE_RATE` | `0.001` | False positive rate | **Medium** - Lower = more memory, fewer false positives |

### 🔄 Multi-Context Configuration

| Variable | Default | Description | Performance Impact |
|----------|---------|-------------|-------------------|
| `PERSONAL_DB_PATH` | `./data/personal.db` | Personal context database | None |
| `WORK_DB_PATH` | `./data/work.db` | Work context database | None |
| `DEFAULT_CONTEXT` | `personal` | Default context | None |

### 📝 Logging Configuration

| Variable | Default | Description | Performance Impact |
|----------|---------|-------------|-------------------|
| `LOG_LEVEL` | `info` | Logging verbosity | **Low** - Debug level can impact performance |

### 🌐 Server Configuration

| Variable | Default | Description | Performance Impact |
|----------|---------|-------------|-------------------|
| `SERVER_PORT` | `3000` | HTTP server port | None (MCP stdio mode) |
| `SERVER_HOST` | `localhost` | HTTP server host | None (MCP stdio mode) |

## Cache Strategies

### LRU (Least Recently Used) - Default
- **Best for**: General purpose, mixed workloads
- **Memory**: Predictable
- **Performance**: Good for most cases

### 2Q (Two-Queue)
- **Best for**: Mixed access patterns, some temporal locality
- **Memory**: Slightly higher than LRU
- **Performance**: Better for workloads with some temporal locality

### ARC (Adaptive Replacement Cache)
- **Best for**: Large datasets (100K+ entities), adaptive workloads
- **Memory**: Adaptive
- **Performance**: Excellent for large, varied workloads

### Radix
- **Best for**: Very large datasets, prefix-based access patterns
- **Memory**: Higher initial overhead
- **Performance**: Best for large datasets with structured access

## Performance Tuning Profiles

### 🚀 High-Performance Profile

For maximum performance with large datasets:

```bash
# Database
DATABASE_CACHE_SIZE_MB=1024
DATABASE_MMAP_SIZE_MB=4096
DATABASE_PAGE_SIZE_KB=16

# Performance
ENTITY_CACHE_SIZE=100000
SEARCH_CACHE_SIZE=50000
CACHE_STRATEGY=arc
READ_POOL_SIZE=50
BATCH_SIZE=5000
MAX_BATCH_SIZE=10000
TARGET_BATCH_MEMORY_MB=100

# Bloom Filter
BLOOM_FILTER_EXPECTED_ITEMS=100000
BLOOM_FILTER_FALSE_POSITIVE_RATE=0.001

# Features
ENABLE_BULK_OPERATIONS=true
ENABLE_PREPARED_STATEMENTS=true
ENABLE_DYNAMIC_BATCH_SIZING=true
COMPRESSION_ENABLED=true
```

### 💾 Memory-Optimized Profile

For environments with limited memory:

```bash
# Database
DATABASE_CACHE_SIZE_MB=64
DATABASE_MMAP_SIZE_MB=256
DATABASE_PAGE_SIZE_KB=16

# Performance
ENTITY_CACHE_SIZE=10000
SEARCH_CACHE_SIZE=5000
CACHE_STRATEGY=lru
READ_POOL_SIZE=5
BATCH_SIZE=100
MAX_BATCH_SIZE=1000
TARGET_BATCH_MEMORY_MB=10

# Bloom Filter
BLOOM_FILTER_EXPECTED_ITEMS=10000
BLOOM_FILTER_FALSE_POSITIVE_RATE=0.01

# Features
ENABLE_BULK_OPERATIONS=true
ENABLE_PREPARED_STATEMENTS=true
ENABLE_DYNAMIC_BATCH_SIZING=true
COMPRESSION_ENABLED=true
```

### 🔧 Development Profile

For development and debugging:

```bash
# Logging
LOG_LEVEL=debug
PROFILING_ENABLED=true

# Performance (reduced for faster feedback)
ENTITY_CACHE_SIZE=1000
SEARCH_CACHE_SIZE=500
BATCH_SIZE=100

# Features
COMPRESSION_ENABLED=false
ENABLE_BULK_OPERATIONS=false
```

## Advanced Configuration

### Rate Limiting

Disable rate limiting for benchmarks:

```bash
DISABLE_RATE_LIMITING=true
```

### Custom Database Paths

Use custom database locations:

```bash
PERSONAL_DB_PATH=/path/to/personal.db
WORK_DB_PATH=/path/to/work.db
```

### Multi-Environment Setup

Create environment-specific configurations:

```bash
# .env.production
LOG_LEVEL=warn
PROFILING_ENABLED=false
ENTITY_CACHE_SIZE=100000

# .env.development
LOG_LEVEL=debug
PROFILING_ENABLED=true
ENTITY_CACHE_SIZE=1000
```

## Configuration Validation

### Validate Your Configuration

```bash
npx tsx scripts/validate-config.js
```

This tool will:
- ✅ Check for valid environment variables
- 📊 Display current configuration
- 💡 Provide performance recommendations
- 🔍 Identify potential issues

### Common Issues

1. **Invalid Types**: Ensure numbers are actual numbers, not strings
2. **Missing Variables**: Undefined variables use defaults
3. **Invalid Values**: Check enum values (e.g., cache strategies)
4. **Path Issues**: Ensure database paths are writable

## Best Practices

### Performance Tuning

1. **Start with defaults** - They're optimized for most use cases
2. **Monitor memory usage** - Adjust cache sizes based on available RAM
3. **Use appropriate cache strategy** - LRU for general use, ARC for large datasets
4. **Enable bulk operations** - Essential for performance
5. **Tune batch sizes** - Balance memory usage with throughput

### Memory Management

1. **Entity cache size** - Should be 10-50% of total entities
2. **Search cache size** - Should be 5-20% of typical search results
3. **Database cache** - 256MB-1GB for most workloads
4. **MMAP size** - 1-4GB for large datasets

### Monitoring

1. **Enable profiling** for performance analysis
2. **Use debug logging** for troubleshooting
3. **Monitor database size** and growth
4. **Check cache hit rates** in logs

## Troubleshooting

### Common Problems

**"Database is locked" errors:**
```bash
DATABASE_BUSY_TIMEOUT=60000
```

**High memory usage:**
```bash
ENTITY_CACHE_SIZE=25000
SEARCH_CACHE_SIZE=5000
DATABASE_CACHE_SIZE_MB=128
```

**Slow performance:**
```bash
CACHE_STRATEGY=arc
READ_POOL_SIZE=50
BATCH_SIZE=5000
```

**Large database files:**
```bash
COMPRESSION_ENABLED=true
DATABASE_WAL_AUTOCHECKPOINT=100
```

### Getting Help

1. **Run configuration validation** to check for issues
2. **Enable debug logging** to see detailed information
3. **Check the logs** for performance metrics
4. **Use profiling** to identify bottlenecks

## Configuration Reference

For a complete list of all configuration options, see the `env.example` file in the project root.

---

**Need help?** Run `npx tsx scripts/validate-config.js` to validate your configuration and get personalized recommendations. 
