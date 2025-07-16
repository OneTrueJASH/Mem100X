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

function validateConfiguration() {
  console.log('🔧 Mem100x Configuration Validation Tool\n');

  // Check if .env file exists
  const envFileExists = existsSync('.env');
  console.log(`📁 .env file: ${envFileExists ? '✅ Found' : '⚠️  Not found (using system environment variables)'}`);

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
          console.log(`   ${key}`);
        });
      }
    } catch (error) {
      console.log('   ❌ Error reading .env file');
    }
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
    console.log(`   Profiling: ${config.performance.profilingEnabled ? '✅ Enabled' : '❌ Disabled'}`);
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
    console.error('   - Ensure all environment variables have correct types (numbers, booleans, etc.)');
    console.error('   - Remove any undefined or invalid environment variables');

    process.exit(1);
  }
}

// Run validation
validateConfiguration();
