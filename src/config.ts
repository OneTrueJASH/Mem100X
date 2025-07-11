/**
 * Configuration management using dotenv
 */

import { config as loadEnv } from 'dotenv';
import { z } from 'zod';
import { join } from 'path';

// Load environment variables
loadEnv();

// Configuration schema
const configSchema = z.object({
  // Database Configuration
  database: z.object({
    path: z.string().default('./data/memory.db'),
    cacheSizeMb: z.number().default(64),
    mmapSizeMb: z.number().default(256),
  }),
  
  // Performance Configuration
  performance: z.object({
    entityCacheSize: z.number().default(5000),
    searchCacheSize: z.number().default(1000),
    relationQueryThreshold: z.number().default(200),
    compressionEnabled: z.boolean().default(true),
    cacheStrategy: z.enum(['lru', '2q', 'arc', 'radix']).default('lru'),
    useReadPool: z.boolean().default(true),
  }),
  
  // Bloom Filter Configuration
  bloomFilter: z.object({
    expectedItems: z.number().default(50000),
    falsePositiveRate: z.number().default(0.001),
  }),
  
  // Multi-Context Configuration
  multiContext: z.object({
    personalDbPath: z.string().default('./data/personal.db'),
    workDbPath: z.string().default('./data/work.db'),
    defaultContext: z.enum(['personal', 'work']).default('personal'),
  }),
  
  // Logging Configuration
  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  }),
  
  // Server Configuration
  server: z.object({
    port: z.number().default(3000),
    host: z.string().default('localhost'),
  }),
});

// Parse configuration from environment
function loadConfig() {
  const rawConfig = {
    database: {
      path: process.env.DATABASE_PATH,
      cacheSizeMb: process.env.DATABASE_CACHE_SIZE_MB 
        ? parseInt(process.env.DATABASE_CACHE_SIZE_MB, 10) 
        : undefined,
      mmapSizeMb: process.env.DATABASE_MMAP_SIZE_MB
        ? parseInt(process.env.DATABASE_MMAP_SIZE_MB, 10)
        : undefined,
    },
    performance: {
      entityCacheSize: process.env.ENTITY_CACHE_SIZE
        ? parseInt(process.env.ENTITY_CACHE_SIZE, 10)
        : undefined,
      searchCacheSize: process.env.SEARCH_CACHE_SIZE
        ? parseInt(process.env.SEARCH_CACHE_SIZE, 10)
        : undefined,
      relationQueryThreshold: process.env.RELATION_QUERY_THRESHOLD
        ? parseInt(process.env.RELATION_QUERY_THRESHOLD, 10)
        : undefined,
      compressionEnabled: process.env.COMPRESSION_ENABLED
        ? process.env.COMPRESSION_ENABLED === 'true'
        : undefined,
      cacheStrategy: process.env.CACHE_STRATEGY as 'lru' | '2q' | 'arc' | 'radix' | undefined,
      useReadPool: process.env.USE_READ_POOL
        ? process.env.USE_READ_POOL === 'true'
        : undefined,
    },
    bloomFilter: {
      expectedItems: process.env.BLOOM_FILTER_EXPECTED_ITEMS
        ? parseInt(process.env.BLOOM_FILTER_EXPECTED_ITEMS, 10)
        : undefined,
      falsePositiveRate: process.env.BLOOM_FILTER_FALSE_POSITIVE_RATE
        ? parseFloat(process.env.BLOOM_FILTER_FALSE_POSITIVE_RATE)
        : undefined,
    },
    multiContext: {
      personalDbPath: process.env.PERSONAL_DB_PATH,
      workDbPath: process.env.WORK_DB_PATH,
      defaultContext: process.env.DEFAULT_CONTEXT as 'personal' | 'work' | undefined,
    },
    logging: {
      level: process.env.LOG_LEVEL as 'error' | 'warn' | 'info' | 'debug' | undefined,
    },
    server: {
      port: process.env.SERVER_PORT
        ? parseInt(process.env.SERVER_PORT, 10)
        : undefined,
      host: process.env.SERVER_HOST,
    },
  };
  
  // Remove undefined values
  const cleanConfig = JSON.parse(JSON.stringify(rawConfig));
  
  // Parse and validate
  return configSchema.parse(cleanConfig);
}

// Export singleton config
export const config = loadConfig();

// Export for testing
export { configSchema, loadConfig };