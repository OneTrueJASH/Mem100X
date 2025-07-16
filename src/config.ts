/**
 * Configuration management using dotenv
 */

import { config as loadEnv } from 'dotenv';
import { z } from 'zod';
import { join } from 'path';

// Load environment variables
// In production, we don't want dotenv output to break stdio communication
loadEnv({ quiet: true });

// Configuration schema
const configSchema = z.object({
  // Database Configuration
  database: z.object({
    path: z.string().default('./data/memory.db'),
    cacheSizeMb: z.number().default(256), // Increased from 64MB to 256MB
    mmapSizeMb: z.number().default(1024), // Increased from 256MB to 1GB
    pageSizeKb: z.number().default(16), // 16KB pages for better I/O
    walAutocheckpoint: z.number().default(1000), // More frequent checkpoints
    busyTimeout: z.number().default(30000), // Increased timeout
  }),

  // Performance Configuration
  performance: z.object({
    entityCacheSize: z.number().default(50000), // Increased from 5000
    searchCacheSize: z.number().default(10000), // Increased from 1000
    relationQueryThreshold: z.number().default(500), // Increased from 200
    compressionEnabled: z.boolean().default(true),
    cacheStrategy: z.enum(['lru', '2q', 'arc', 'radix']).default('lru'),
    useReadPool: z.boolean().default(true),
    readPoolSize: z.number().default(20), // Increased from 5
    batchSize: z.number().default(1000), // New: batch size for bulk operations
    enableBulkOperations: z.boolean().default(true), // New: enable bulk operations
    enablePreparedStatements: z.boolean().default(true), // New: enable prepared statements
    enableDynamicBatchSizing: z.boolean().default(true), // New: enable dynamic batch sizing
    maxBatchSize: z.number().default(5000), // New: maximum batch size
    targetBatchMemoryMb: z.number().default(50), // New: target memory per batch
    profilingEnabled: z.boolean().default(false), // <-- add this line
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

  // System Resilience Configuration
  resilience: z.object({
    enableIntegrityChecks: z.boolean().default(true),
    enableAutoRollback: z.boolean().default(true),
    enableGracefulDegradation: z.boolean().default(true),
    maxTransactionRetries: z.number().default(3),
    integrityCheckInterval: z.number().default(300000), // 5 minutes
    backupBeforeOperations: z.boolean().default(false),
    logAllTransactions: z.boolean().default(true),
  }),

  // Privacy & Security Configuration
  privacy: z.object({
    encryptionLevel: z.enum(['none', 'basic', 'strong', 'enterprise']).default('none'),
    encryptionKey: z.string().optional(),
    autoEncryptSensitiveData: z.boolean().default(false),
    enableAccessControls: z.boolean().default(false),
    requireAuthentication: z.boolean().default(false),
    sessionTimeout: z.number().default(60),
    maxFailedAttempts: z.number().default(5),
    enableAuditTrails: z.boolean().default(false),
    auditLogRetention: z.number().default(90),
    logSensitiveOperations: z.boolean().default(false),
    anonymizeAuditLogs: z.boolean().default(false),
    enableDataAnonymization: z.boolean().default(false),
    anonymizationLevel: z.enum(['none', 'partial', 'full']).default('none'),
    dataRetentionPolicy: z.enum(['keep_forever', 'auto_delete', 'manual_delete']).default('keep_forever'),
    retentionPeriod: z.number().default(365),
    gdprCompliance: z.boolean().default(false),
    ccpaCompliance: z.boolean().default(false),
    hipaaCompliance: z.boolean().default(false),
    enableRateLimiting: z.boolean().default(false),
    enableInputValidation: z.boolean().default(false),
    enableOutputSanitization: z.boolean().default(false),
    blockSuspiciousPatterns: z.boolean().default(false),
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
      pageSizeKb: process.env.DATABASE_PAGE_SIZE_KB
        ? parseInt(process.env.DATABASE_PAGE_SIZE_KB, 10)
        : undefined,
      walAutocheckpoint: process.env.DATABASE_WAL_AUTOCHECKPOINT
        ? parseInt(process.env.DATABASE_WAL_AUTOCHECKPOINT, 10)
        : undefined,
      busyTimeout: process.env.DATABASE_BUSY_TIMEOUT
        ? parseInt(process.env.DATABASE_BUSY_TIMEOUT, 10)
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
      useReadPool: process.env.USE_READ_POOL ? process.env.USE_READ_POOL === 'true' : undefined,
      readPoolSize: process.env.READ_POOL_SIZE
        ? parseInt(process.env.READ_POOL_SIZE, 10)
        : undefined,
      batchSize: process.env.BATCH_SIZE ? parseInt(process.env.BATCH_SIZE, 10) : undefined,
      enableBulkOperations: process.env.ENABLE_BULK_OPERATIONS
        ? process.env.ENABLE_BULK_OPERATIONS === 'true'
        : undefined,
      enablePreparedStatements: process.env.ENABLE_PREPARED_STATEMENTS
        ? process.env.ENABLE_PREPARED_STATEMENTS === 'true'
        : undefined,
      enableDynamicBatchSizing: process.env.ENABLE_DYNAMIC_BATCH_SIZING
        ? process.env.ENABLE_DYNAMIC_BATCH_SIZING === 'true'
        : undefined,
      maxBatchSize: process.env.MAX_BATCH_SIZE ? parseInt(process.env.MAX_BATCH_SIZE, 10) : undefined,
      targetBatchMemoryMb: process.env.TARGET_BATCH_MEMORY_MB
        ? parseInt(process.env.TARGET_BATCH_MEMORY_MB, 10)
        : undefined,
      profilingEnabled: process.env.PROFILING_ENABLED
        ? process.env.PROFILING_ENABLED === 'true'
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
      port: process.env.SERVER_PORT ? parseInt(process.env.SERVER_PORT, 10) : undefined,
      host: process.env.SERVER_HOST,
    },
    resilience: {
      enableIntegrityChecks: process.env.ENABLE_INTEGRITY_CHECKS
        ? process.env.ENABLE_INTEGRITY_CHECKS === 'true'
        : undefined,
      enableAutoRollback: process.env.ENABLE_AUTO_ROLLBACK
        ? process.env.ENABLE_AUTO_ROLLBACK === 'true'
        : undefined,
      enableGracefulDegradation: process.env.ENABLE_GRACEFUL_DEGRADATION
        ? process.env.ENABLE_GRACEFUL_DEGRADATION === 'true'
        : undefined,
      maxTransactionRetries: process.env.MAX_TRANSACTION_RETRIES
        ? parseInt(process.env.MAX_TRANSACTION_RETRIES, 10)
        : undefined,
      integrityCheckInterval: process.env.INTEGRITY_CHECK_INTERVAL
        ? parseInt(process.env.INTEGRITY_CHECK_INTERVAL, 10)
        : undefined,
      backupBeforeOperations: process.env.BACKUP_BEFORE_OPERATIONS
        ? process.env.BACKUP_BEFORE_OPERATIONS === 'true'
        : undefined,
      logAllTransactions: process.env.LOG_ALL_TRANSACTIONS
        ? process.env.LOG_ALL_TRANSACTIONS === 'true'
        : undefined,
    },
    privacy: {
      encryptionLevel: process.env.ENCRYPTION_LEVEL as 'none' | 'basic' | 'strong' | 'enterprise' | undefined,
      encryptionKey: process.env.ENCRYPTION_KEY,
      autoEncryptSensitiveData: process.env.AUTO_ENCRYPT_SENSITIVE_DATA
        ? process.env.AUTO_ENCRYPT_SENSITIVE_DATA === 'true'
        : undefined,
      enableAccessControls: process.env.ENABLE_ACCESS_CONTROLS
        ? process.env.ENABLE_ACCESS_CONTROLS === 'true'
        : undefined,
      requireAuthentication: process.env.REQUIRE_AUTHENTICATION
        ? process.env.REQUIRE_AUTHENTICATION === 'true'
        : undefined,
      sessionTimeout: process.env.SESSION_TIMEOUT
        ? parseInt(process.env.SESSION_TIMEOUT, 10)
        : undefined,
      maxFailedAttempts: process.env.MAX_FAILED_ATTEMPTS
        ? parseInt(process.env.MAX_FAILED_ATTEMPTS, 10)
        : undefined,
      enableAuditTrails: process.env.ENABLE_AUDIT_TRAILS
        ? process.env.ENABLE_AUDIT_TRAILS === 'true'
        : undefined,
      auditLogRetention: process.env.AUDIT_LOG_RETENTION
        ? parseInt(process.env.AUDIT_LOG_RETENTION, 10)
        : undefined,
      logSensitiveOperations: process.env.LOG_SENSITIVE_OPERATIONS
        ? process.env.LOG_SENSITIVE_OPERATIONS === 'true'
        : undefined,
      anonymizeAuditLogs: process.env.ANONYMIZE_AUDIT_LOGS
        ? process.env.ANONYMIZE_AUDIT_LOGS === 'true'
        : undefined,
      enableDataAnonymization: process.env.ENABLE_DATA_ANONYMIZATION
        ? process.env.ENABLE_DATA_ANONYMIZATION === 'true'
        : undefined,
      anonymizationLevel: process.env.ANONYMIZATION_LEVEL as 'none' | 'partial' | 'full' | undefined,
      dataRetentionPolicy: process.env.DATA_RETENTION_POLICY as 'keep_forever' | 'auto_delete' | 'manual_delete' | undefined,
      retentionPeriod: process.env.RETENTION_PERIOD
        ? parseInt(process.env.RETENTION_PERIOD, 10)
        : undefined,
      gdprCompliance: process.env.GDPR_COMPLIANCE
        ? process.env.GDPR_COMPLIANCE === 'true'
        : undefined,
      ccpaCompliance: process.env.CCPA_COMPLIANCE
        ? process.env.CCPA_COMPLIANCE === 'true'
        : undefined,
      hipaaCompliance: process.env.HIPAA_COMPLIANCE
        ? process.env.HIPAA_COMPLIANCE === 'true'
        : undefined,
      enableRateLimiting: process.env.ENABLE_RATE_LIMITING
        ? process.env.ENABLE_RATE_LIMITING === 'true'
        : undefined,
      enableInputValidation: process.env.ENABLE_INPUT_VALIDATION
        ? process.env.ENABLE_INPUT_VALIDATION === 'true'
        : undefined,
      enableOutputSanitization: process.env.ENABLE_OUTPUT_SANITIZATION
        ? process.env.ENABLE_OUTPUT_SANITIZATION === 'true'
        : undefined,
      blockSuspiciousPatterns: process.env.BLOCK_SUSPICIOUS_PATTERNS
        ? process.env.BLOCK_SUSPICIOUS_PATTERNS === 'true'
        : undefined,
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
