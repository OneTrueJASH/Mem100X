/**
 * Structured logging configuration using Winston
 * Provides performance tracking, error logging, and debugging capabilities
 */

import winston from 'winston';
import { config } from '../config.js';

// Custom log levels
const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    perf: 3,    // Performance metrics
    debug: 4,
    trace: 5    // Detailed trace logs
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    perf: 'cyan',
    debug: 'blue',
    trace: 'magenta'
  }
};

// Create custom format for structured logging
const structuredFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Stderr format for MCP compliance
const stderrFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    // MCP servers must log to stderr in a format that doesn't interfere with JSON-RPC
    const logObj = {
      timestamp,
      level,
      message,
      ...meta
    };
    return JSON.stringify(logObj);
  })
);

// Create logger instance - MCP compliant (stderr only)
const logger = winston.createLogger({
  levels: customLevels.levels,
  level: config.logging.level,
  format: stderrFormat,
  defaultMeta: { 
    service: 'mem100x',
    pid: process.pid
  },
  transports: [
    // MCP servers MUST log to stderr only
    new winston.transports.Stream({
      stream: process.stderr,
      format: stderrFormat
    })
  ]
});

// Add colors
winston.addColors(customLevels.colors);

// Performance tracking helper
export class PerformanceTracker {
  private startTime: number;
  private operation: string;
  private metadata: Record<string, any>;
  
  constructor(operation: string, metadata: Record<string, any> = {}) {
    this.startTime = performance.now();
    this.operation = operation;
    this.metadata = metadata;
  }
  
  end(additionalMetadata: Record<string, any> = {}): void {
    const duration = performance.now() - this.startTime;
    logger.log('perf', `${this.operation} completed`, {
      operation: this.operation,
      duration: duration.toFixed(3),
      durationMs: duration,
      ...this.metadata,
      ...additionalMetadata
    });
  }
}

// Export logger instance and helpers
export { logger };

// Convenience methods
export const logError = (message: string, error: Error, metadata?: Record<string, any>) => {
  logger.error(message, {
    error: error.message,
    stack: error.stack,
    ...metadata
  });
};

export const logPerf = (operation: string, duration: number, metadata?: Record<string, any>) => {
  logger.log('perf', `${operation} performance`, {
    operation,
    duration: duration.toFixed(3),
    durationMs: duration,
    opsPerSec: Math.round(1000 / duration),
    ...metadata
  });
};

export const logQuery = (query: string, duration: number, rowCount: number, metadata?: Record<string, any>) => {
  logger.log('perf', 'Database query', {
    query: query.substring(0, 100), // Truncate long queries
    duration: duration.toFixed(3),
    durationMs: duration,
    rowCount,
    rowsPerSec: Math.round(rowCount / (duration / 1000)),
    ...metadata
  });
};

export const logCacheHit = (cache: string, key: string, hit: boolean) => {
  logger.debug('Cache access', {
    cache,
    key,
    hit,
    result: hit ? 'HIT' : 'MISS'
  });
};

export const logInfo = (message: string, metadata?: Record<string, any>) => {
  logger.info(message, metadata);
};

export const logDebug = (message: string, metadata?: Record<string, any>) => {
  logger.debug(message, metadata);
};

export const logWarn = (message: string, metadata?: Record<string, any>) => {
  logger.warn(message, metadata);
};