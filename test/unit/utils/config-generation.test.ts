import { describe, it, expect } from 'vitest';
import { generateEnvFile } from '../../../dist/config.js';

describe('Configuration Generation', () => {
  it('should generate a complete .env file with all default values', () => {
    const envContent = generateEnvFile();

    // Check that the content is a string
    expect(typeof envContent).toBe('string');
    expect(envContent.length).toBeGreaterThan(1000);

    // Check for required sections
    expect(envContent).toContain('# DATABASE CONFIGURATION');
    expect(envContent).toContain('# PERFORMANCE CONFIGURATION');
    expect(envContent).toContain('# MEMORY AGING CONFIGURATION');
    expect(envContent).toContain('# MULTI-CONTEXT CONFIGURATION');
    expect(envContent).toContain('# LOGGING CONFIGURATION');

    // Check for key configuration variables
    expect(envContent).toContain('DATABASE_PATH=./data/memory.db');
    expect(envContent).toContain('ENTITY_CACHE_SIZE=50000');
    expect(envContent).toContain('SEARCH_CACHE_SIZE=10000');
    expect(envContent).toContain('CACHE_STRATEGY=lru');
    expect(envContent).toContain('LOG_LEVEL=info');
    expect(envContent).toContain('MEMORY_AGING_ENABLED=true');
    expect(envContent).toContain('MEMORY_AGING_PRESET=balanced');

    // Check for multi-context configuration
    expect(envContent).toContain('MEM100X_PERSONAL_DB_PATH=./data/personal.db');
    expect(envContent).toContain('MEM100X_WORK_DB_PATH=./data/work.db');
    expect(envContent).toContain('DEFAULT_CONTEXT=personal');

    // Check for performance tuning examples
    expect(envContent).toContain('# High-performance configuration for large datasets:');
    expect(envContent).toContain('# Memory-optimized configuration for limited resources:');
    expect(envContent).toContain('# Development configuration with detailed logging:');

    // Check for timestamp
    expect(envContent).toContain('# Generated on:');
    expect(envContent).toMatch(/# Generated on: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
  });

  it('should include all configuration categories', () => {
    const envContent = generateEnvFile();

    const categories = [
      'DATABASE CONFIGURATION',
      'PERFORMANCE CONFIGURATION',
      'MEMORY AGING CONFIGURATION',
      'BLOOM FILTER CONFIGURATION',
      'MULTI-CONTEXT CONFIGURATION',
      'LOGGING CONFIGURATION',
      'SERVER CONFIGURATION',
      'ADVANCED CONFIGURATION',
      'PERFORMANCE TUNING EXAMPLES'
    ];

    categories.forEach(category => {
      expect(envContent).toContain(`# ${category}`);
    });
  });

  it('should include all default values', () => {
    const envContent = generateEnvFile();

    const defaultValues = [
      'DATABASE_PATH=./data/memory.db',
      'DATABASE_CACHE_SIZE_MB=256',
      'DATABASE_MMAP_SIZE_MB=1024',
      'ENTITY_CACHE_SIZE=50000',
      'SEARCH_CACHE_SIZE=10000',
      'CACHE_STRATEGY=lru',
      'USE_READ_POOL=true',
      'READ_POOL_SIZE=20',
      'BATCH_SIZE=1000',
      'ENABLE_BULK_OPERATIONS=true',
      'ENABLE_PREPARED_STATEMENTS=true',
      'ENABLE_DYNAMIC_BATCH_SIZING=true',
      'MAX_BATCH_SIZE=5000',
      'TARGET_BATCH_MEMORY_MB=50',
      'CACHE_WARMING_ENABLED=true',
      'MAX_ENTITIES_TO_WARM=1000',
      'MAX_SEARCHES_TO_WARM=100',
      'PROFILING_ENABLED=false',
      'MEMORY_AGING_ENABLED=true',
      'MEMORY_AGING_PRESET=balanced',
      'BLOOM_FILTER_EXPECTED_ITEMS=50000',
      'BLOOM_FILTER_FALSE_POSITIVE_RATE=0.001',
      'MEM100X_PERSONAL_DB_PATH=./data/personal.db',
      'MEM100X_WORK_DB_PATH=./data/work.db',
      'DEFAULT_CONTEXT=personal',
      'LOG_LEVEL=info',
      'SERVER_PORT=3000',
      'SERVER_HOST=localhost',
      'DISABLE_RATE_LIMITING=false'
    ];

    defaultValues.forEach(value => {
      expect(envContent).toContain(value);
    });
  });
});
