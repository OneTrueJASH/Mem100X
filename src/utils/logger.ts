/**
 * Structured logging configuration using Winston
 * Provides performance tracking, error logging, and debugging capabilities
 */

import winston from 'winston';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { config } from '../config.js';

// Ensure logs directory exists
const logsDir = join(process.cwd(), 'logs');
mkdirSync(logsDir, { recursive: true });

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

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss.SSS'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  })
);

// Create logger instance
const logger = winston.createLogger({
  levels: customLevels.levels,
  level: config.logging.level,
  format: structuredFormat,
  defaultMeta: { 
    service: 'mem100x',
    pid: process.pid
  },
  transports: [
    // Write all logs to combined.log
    new winston.transports.File({ 
      filename: join(logsDir, 'combined.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    // Write errors to separate file
    new winston.transports.File({ 
      filename: join(logsDir, 'error.log'), 
      level: 'error',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5
    }),
    // Write performance logs to separate file
    new winston.transports.File({ 
      filename: join(logsDir, 'performance.log'), 
      level: 'perf',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
      format: winston.format.combine(
        structuredFormat,
        winston.format((info) => {
          return info.level === 'perf' ? info : false;
        })()
      )
    })
  ]
});

// Add console transport if not in production
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: config.logging.level
  }));
}

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