#!/usr/bin/env node

/**
 * Mem100x Configuration Validation Tool
 * Validates environment variables and configuration settings for power users
 */

import { configSchema, loadConfig } from '../src/config.js';
import { config as loadEnv } from 'dotenv';
import { existsSync, readFileSync } from 'fs';

// Load environment variables
loadEnv({ quiet: true });

// Define all known environment variables
const KNOWN_ENV_VARS = {
  // Database Configuration
  'DATABASE_PATH': 'Database file path',
  'DATABASE_CACHE_SIZE_MB': 'SQLite cache size in MB',
  'DATABASE_MMAP_SIZE_MB': 'Memory-mapped file size in MB',
  'DATABASE_PAGE_SIZE_KB': 'SQLite page size in KB',
  'DATABASE_WAL_AUTOCHECKPOINT': 'WAL autocheckpoint frequency',
  'DATABASE_BUSY_TIMEOUT': 'Database busy timeout in milliseconds',

  // Performance Configuration
  'ENTITY_CACHE_SIZE': 'Entity cache size',
  'SEARCH_CACHE_SIZE': 'Search cache size',
  'RELATION_QUERY_THRESHOLD': 'Relation query threshold',
  'COMPRESSION_ENABLED': 'Enable compression for large observations',
  'CACHE_STRATEGY': 'Cache strategy (lru, 2q, arc, radix)',
  'USE_READ_POOL': 'Enable read connection pool',
  'READ_POOL_SIZE': 'Read pool size',
  'BATCH_SIZE': 'Batch size for bulk operations',
  'ENABLE_BULK_OPERATIONS': 'Enable bulk operations',
  'ENABLE_PREPARED_STATEMENTS': 'Enable prepared statements',
  'ENABLE_DYNAMIC_BATCH_SIZING': 'Enable dynamic batch sizing',
  'MAX_BATCH_SIZE': 'Maximum batch size',
  'TARGET_BATCH_MEMORY_MB': 'Target memory per batch in MB',
  'CACHE_WARMING_ENABLED': 'Enable cache warming',
  'MAX_ENTITIES_TO_WARM': 'Maximum entities to warm',
  'MAX_SEARCHES_TO_WARM': 'Maximum searches to warm',
  'PROFILING_ENABLED': 'Enable performance profiling',

  // Memory Aging Configuration
  'MEMORY_AGING_ENABLED': 'Enable memory aging',
  'MEMORY_AGING_PRESET': 'Memory aging preset',
  'MEMORY_AGING_CUSTOM_CONFIG': 'Custom memory aging configuration',

  // Bloom Filter Configuration
  'BLOOM_FILTER_EXPECTED_ITEMS': 'Expected number of items in bloom filter',
  'BLOOM_FILTER_FALSE_POSITIVE_RATE': 'False positive rate for bloom filter',

  // Multi-Context Configuration
  'MEM100X_PERSONAL_DB_PATH': 'Personal database path',
  'MEM100X_WORK_DB_PATH': 'Work database path',
  'DEFAULT_CONTEXT': 'Default context (personal, work)',

  // Logging Configuration
  'LOG_LEVEL': 'Log level (error, warn, info, debug)',

  // Server Configuration
  'SERVER_PORT': 'Server port',
  'SERVER_HOST': 'Server host',

  // Advanced Configuration
  'DISABLE_RATE_LIMITING': 'Disable rate limiting'
};

// Define deprecated environment variables
const DEPRECATED_ENV_VARS = {
  'PERSONAL_DB_PATH': 'Use MEM100X_PERSONAL_DB_PATH instead',
  'WORK_DB_PATH': 'Use MEM100X_WORK_DB_PATH instead',
  'NODE_ENV': 'Not used by Mem100x (Node.js standard)',
  'PORT': 'Use SERVER_PORT instead',
  'HOST': 'Use SERVER_HOST instead'
};

function validateConfiguration() {
  console.log('🔧 Mem100x Configuration Validation Tool\n');

  // Check if .env file exists
  const envFileExists = existsSync('.env');
  console.log(`📁 .env file: ${envFileExists ? '✅ Found' : '⚠️  Not found (using system environment variables)'}`);

  // Collect all environment variables
  const allEnvVars = new Set();
  const unknownVars = [];
  const deprecatedVars = [];
  const validVars = [];

  // Check .env file if it exists
  if (envFileExists) {
    console.log('📄 .env file contents:');
    try {
      const envContent = readFileSync('.env', 'utf8');
      const lines = envContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));
      if (lines.length === 0) {
        console.log('   (no environment variables set)');
      } else {
        lines.forEach(line => {
          const [key] = line.split('=');
          if (key && key.trim()) {
            allEnvVars.add(key.trim());
            console.log(`   ${key.trim()}`);
          }
        });
      }
    } catch (error) {
      console.log('   ❌ Error reading .env file');
    }
  }

  // Check all environment variables (from .env and system)
  Object.keys(process.env).forEach(key => {
    if (key.startsWith('MEM100X_') ||
        KNOWN_ENV_VARS[key] ||
        DEPRECATED_ENV_VARS[key]) {
      allEnvVars.add(key);
    }
  });

  // Categorize environment variables
  allEnvVars.forEach(key => {
    if (DEPRECATED_ENV_VARS[key]) {
      deprecatedVars.push({ key, reason: DEPRECATED_ENV_VARS[key] });
    } else if (KNOWN_ENV_VARS[key]) {
      validVars.push({ key, description: KNOWN_ENV_VARS[key] });
    } else {
      unknownVars.push(key);
    }
  });

  // Report environment variable issues
  let hasIssues = false;

  if (unknownVars.length > 0) {
    hasIssues = true;
    console.log('\n⚠️  Unknown Environment Variables:');
    console.log('   The following environment variables are not recognized by Mem100x:');
    unknownVars.forEach(key => {
      console.log(`   ❌ ${key}`);
    });
    console.log('   💡 These variables will be ignored. Consider removing them if not needed.');
  }

  if (deprecatedVars.length > 0) {
    hasIssues = true;
    console.log('\n🔄 Deprecated Environment Variables:');
    console.log('   The following environment variables are deprecated:');
    deprecatedVars.forEach(({ key, reason }) => {
      console.log(`   ⚠️  ${key}: ${reason}`);
    });
    console.log('   💡 Please update these variables to their new names.');
  }

  if (hasIssues) {
    console.log('\n📋 Valid Environment Variables:');
    console.log('   The following variables are recognized by Mem100x:');
    Object.keys(KNOWN_ENV_VARS).forEach(key => {
      const isSet = allEnvVars.has(key);
      console.log(`   ${isSet ? '✅' : '⚪'} ${key}: ${KNOWN_ENV_VARS[key]}`);
    });
  }

  console.log('\n🔍 Validating configuration...');

  try {
    const config = loadConfig();
    console.log('✅ Configuration validation passed!\n');

    // Display current configuration
    console.log('📊 Current Configuration:');
    console.log('');

    // Database Configuration
    console.log('🗄️  Database Configuration:');
    console.log(`   Path: ${config.database.path}`);
    console.log(`   Cache Size: ${config.database.cacheSizeMb}MB`);
    console.log(`   MMAP Size: ${config.database.mmapSizeMb}MB`);
    console.log(`   Page Size: ${config.database.pageSizeKb}KB`);
    console.log(`   WAL Autocheckpoint: ${config.database.walAutocheckpoint}`);
    console.log(`   Busy Timeout: ${config.database.busyTimeout}ms`);
    console.log('');

    // Performance Configuration
    console.log('⚡ Performance Configuration:');
    console.log(`   Entity Cache Size: ${config.performance.entityCacheSize.toLocaleString()}`);
    console.log(`   Search Cache Size: ${config.performance.searchCacheSize.toLocaleString()}`);
    console.log(`   Relation Query Threshold: ${config.performance.relationQueryThreshold}`);
    console.log(`   Compression: ${config.performance.compressionEnabled ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   Cache Strategy: ${config.performance.cacheStrategy.toUpperCase()}`);
    console.log(`   Read Pool: ${config.performance.useReadPool ? '✅ Enabled' : '❌ Disabled'} (${config.performance.readPoolSize} connections)`);
    console.log(`   Batch Size: ${config.performance.batchSize.toLocaleString()}`);
    console.log(`   Bulk Operations: ${config.performance.enableBulkOperations ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   Prepared Statements: ${config.performance.enablePreparedStatements ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   Dynamic Batch Sizing: ${config.performance.enableDynamicBatchSizing ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   Max Batch Size: ${config.performance.maxBatchSize.toLocaleString()}`);
    console.log(`   Target Batch Memory: ${config.performance.targetBatchMemoryMb}MB`);
    console.log(`   Cache Warming: ${config.performance.cacheWarmingEnabled ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   Max Entities to Warm: ${config.performance.maxEntitiesToWarm.toLocaleString()}`);
    console.log(`   Max Searches to Warm: ${config.performance.maxSearchesToWarm.toLocaleString()}`);
    console.log(`   Profiling: ${config.performance.profilingEnabled ? '✅ Enabled' : '❌ Disabled'}`);
    console.log('');

    // Memory Aging Configuration
    console.log('🧠 Memory Aging Configuration:');
    console.log(`   Enabled: ${config.memoryAging.enabled ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   Preset: ${config.memoryAging.preset}`);
    console.log('');

    // Bloom Filter Configuration
    console.log('🌸 Bloom Filter Configuration:');
    console.log(`   Expected Items: ${config.bloomFilter.expectedItems.toLocaleString()}`);
    console.log(`   False Positive Rate: ${config.bloomFilter.falsePositiveRate}`);
    console.log('');

    // Multi-Context Configuration
    console.log('🔄 Multi-Context Configuration:');
    console.log(`   Personal DB Path: ${config.multiContext.personalDbPath}`);
    console.log(`   Work DB Path: ${config.multiContext.workDbPath}`);
    console.log(`   Default Context: ${config.multiContext.defaultContext}`);
    console.log('');

    // Logging Configuration
    console.log('📝 Logging Configuration:');
    console.log(`   Level: ${config.logging.level.toUpperCase()}`);
    console.log('');

    // Server Configuration
    console.log('🌐 Server Configuration:');
    console.log(`   Host: ${config.server.host}`);
    console.log(`   Port: ${config.server.port}`);
    console.log('');

    // Performance recommendations
    console.log('💡 Performance Recommendations:');

    const recommendations = [];

    if (config.database.cacheSizeMb < 256) {
      recommendations.push('Consider increasing DATABASE_CACHE_SIZE_MB to 256MB or higher for better performance');
    }

    if (config.database.mmapSizeMb < 1024) {
      recommendations.push('Consider increasing DATABASE_MMAP_SIZE_MB to 1GB or higher for better I/O performance');
    }

    if (config.performance.entityCacheSize < 50000) {
      recommendations.push('Consider increasing ENTITY_CACHE_SIZE to 50,000 or higher for better caching');
    }

    if (config.performance.readPoolSize < 20) {
      recommendations.push('Consider increasing READ_POOL_SIZE to 20 or higher for better concurrent performance');
    }

    if (config.performance.cacheStrategy === 'lru' && config.performance.entityCacheSize > 100000) {
      recommendations.push('Consider using CACHE_STRATEGY=arc for large datasets (100K+ entities)');
    }

    if (!config.performance.enableBulkOperations) {
      recommendations.push('Enable ENABLE_BULK_OPERATIONS=true for better performance with large operations');
    }

    if (!config.performance.enablePreparedStatements) {
      recommendations.push('Enable ENABLE_PREPARED_STATEMENTS=true for better query performance');
    }

    if (recommendations.length === 0) {
      console.log('   ✅ Your configuration looks optimal!');
    } else {
      recommendations.forEach(rec => console.log(`   💭 ${rec}`));
    }

    // Summary of issues
    if (hasIssues) {
      console.log('\n⚠️  Configuration Issues Summary:');
      if (unknownVars.length > 0) {
        console.log(`   ❌ ${unknownVars.length} unknown environment variable(s)`);
      }
      if (deprecatedVars.length > 0) {
        console.log(`   🔄 ${deprecatedVars.length} deprecated environment variable(s)`);
      }
      console.log('   💡 Run "npm run config:generate" to see all valid options');
    }

    console.log('\n🎉 Configuration validation complete!');

  } catch (error) {
    console.error('❌ Configuration validation failed:');
    console.error(error.message);

    if (error.issues) {
      console.error('\n🔍 Validation Issues:');
      error.issues.forEach(issue => {
        console.error(`   ${issue.path.join('.')}: ${issue.message}`);
      });
    }

    console.error('\n💡 Tips:');
    console.error('   - Check the env.example file for valid configuration options');
    console.error('   - Run "npm run config:print-defaults" to see all valid options');
    console.error('   - Ensure all environment variables have correct types (numbers, booleans, etc.)');
    console.error('   - Remove any undefined or invalid environment variables');

    process.exit(1);
  }
}

// Run validation
validateConfiguration();
