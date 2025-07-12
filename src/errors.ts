/**
 * Custom error classes for better error handling and debugging
 * Provides structured errors with context for different failure scenarios
 */

/**
 * Base error class for all Mem100x errors
 */
export class Mem100xError extends Error {
  public readonly timestamp: Date;
  public readonly context?: Record<string, any>;

  constructor(message: string, context?: Record<string, any>) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date();
    this.context = context;

    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      stack: this.stack,
    };
  }
}

/**
 * Database-related errors
 */
export class DatabaseError extends Mem100xError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, context);
  }
}

export class EntityNotFoundError extends DatabaseError {
  public readonly entityName: string;

  constructor(entityName: string) {
    super(`Entity not found: ${entityName}`, { entityName });
    this.entityName = entityName;
  }
}

export class DuplicateEntityError extends DatabaseError {
  public readonly entityName: string;

  constructor(entityName: string) {
    super(`Entity already exists: ${entityName}`, { entityName });
    this.entityName = entityName;
  }
}

export class InvalidRelationError extends DatabaseError {
  public readonly from: string;
  public readonly to: string;
  public readonly relationType: string;

  constructor(from: string, to: string, relationType: string, reason: string) {
    super(`Invalid relation: ${reason}`, { from, to, relationType });
    this.from = from;
    this.to = to;
    this.relationType = relationType;
  }
}

/**
 * Transaction-related errors
 */
export class TransactionError extends Mem100xError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, context);
  }
}

export class NoActiveTransactionError extends TransactionError {
  constructor(operation: string) {
    super(`No active transaction for operation: ${operation}`, { operation });
  }
}

export class TransactionAlreadyActiveError extends TransactionError {
  constructor(transactionId?: string) {
    super('A transaction is already active', { transactionId });
  }
}

/**
 * Context-related errors
 */
export class ContextError extends Mem100xError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, context);
  }
}

export class InvalidContextError extends ContextError {
  public readonly invalidContext: string;
  public readonly validContexts: string[];

  constructor(invalidContext: string, validContexts: string[]) {
    super(`Invalid context '${invalidContext}'. Valid contexts: ${validContexts.join(', ')}`, {
      invalidContext,
      validContexts,
    });
    this.invalidContext = invalidContext;
    this.validContexts = validContexts;
  }
}

export class ContextDetectionError extends ContextError {
  constructor(message: string, context?: Record<string, any>) {
    super(`Context detection failed: ${message}`, context);
  }
}

/**
 * Validation errors
 */
export class ValidationError extends Mem100xError {
  public readonly field?: string;
  public readonly value?: any;

  constructor(message: string, field?: string, value?: any) {
    super(message, { field, value });
    this.field = field;
    this.value = value;
  }
}

export class InvalidInputError extends ValidationError {
  constructor(field: string, value: any, expectedType: string) {
    super(
      `Invalid input for field '${field}': expected ${expectedType}, got ${typeof value}`,
      field,
      value
    );
  }
}

/**
 * Configuration errors
 */
export class ConfigurationError extends Mem100xError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, context);
  }
}

export class MissingConfigError extends ConfigurationError {
  public readonly configKey: string;

  constructor(configKey: string) {
    super(`Missing required configuration: ${configKey}`, { configKey });
    this.configKey = configKey;
  }
}

export class InvalidConfigError extends ConfigurationError {
  public readonly configKey: string;
  public readonly configValue: any;

  constructor(configKey: string, configValue: any, reason: string) {
    super(`Invalid configuration for '${configKey}': ${reason}`, { configKey, configValue });
    this.configKey = configKey;
    this.configValue = configValue;
  }
}

/**
 * Cache-related errors
 */
export class CacheError extends Mem100xError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, context);
  }
}

export class CacheCapacityError extends CacheError {
  public readonly requestedSize: number;
  public readonly maxSize: number;

  constructor(requestedSize: number, maxSize: number) {
    super(`Cache capacity exceeded: requested ${requestedSize}, max ${maxSize}`, {
      requestedSize,
      maxSize,
    });
    this.requestedSize = requestedSize;
    this.maxSize = maxSize;
  }
}

/**
 * Backup/Restore errors
 */
export class BackupError extends Mem100xError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, context);
  }
}

export class BackupFailedError extends BackupError {
  public readonly backupPath: string;
  public readonly originalError?: Error;

  constructor(backupPath: string, originalError?: Error) {
    super(`Backup failed for path: ${backupPath}`, {
      backupPath,
      originalError: originalError?.message,
    });
    this.backupPath = backupPath;
    this.originalError = originalError;
  }
}

export class RestoreFailedError extends BackupError {
  public readonly restorePath: string;
  public readonly originalError?: Error;

  constructor(restorePath: string, originalError?: Error) {
    super(`Restore failed from path: ${restorePath}`, {
      restorePath,
      originalError: originalError?.message,
    });
    this.restorePath = restorePath;
    this.originalError = originalError;
  }
}

/**
 * MCP Protocol errors
 */
export class MCPError extends Mem100xError {
  public readonly toolName?: string;

  constructor(message: string, toolName?: string, context?: Record<string, any>) {
    super(message, { ...context, toolName });
    this.toolName = toolName;
  }
}

export class ToolNotFoundError extends MCPError {
  constructor(toolName: string) {
    super(`Tool not found: ${toolName}`, toolName);
  }
}

export class ToolExecutionError extends MCPError {
  public readonly originalError?: Error;

  constructor(toolName: string, originalError?: Error) {
    super(`Tool execution failed: ${toolName}`, toolName, {
      originalError: originalError?.message,
    });
    this.originalError = originalError;
  }
}

/**
 * Helper function to determine if an error is a Mem100x error
 */
export function isMem100xError(error: unknown): error is Mem100xError {
  return error instanceof Mem100xError;
}

/**
 * Helper function to create a structured error response
 */
export function createErrorResponse(error: unknown): {
  error: {
    type: string;
    message: string;
    details?: any;
  };
} {
  if (isMem100xError(error)) {
    return {
      error: {
        type: error.constructor.name,
        message: error.message,
        details: error.context,
      },
    };
  }

  if (error instanceof Error) {
    return {
      error: {
        type: 'Error',
        message: error.message,
      },
    };
  }

  return {
    error: {
      type: 'UnknownError',
      message: String(error),
    },
  };
}
