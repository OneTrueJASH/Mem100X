/**
 * MCP Error Code Mapping
 * Maps Mem100x errors to standard JSON-RPC error codes
 */

import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import {
  Mem100xError,
  EntityNotFoundError,
  InvalidContextError,
  TransactionError,
  ValidationError,
  InvalidInputError,
  ToolNotFoundError,
  ToolExecutionError,
  CacheCapacityError,
  ConfigurationError,
} from '../errors.js';

/**
 * Maps Mem100x errors to MCP/JSON-RPC error codes
 *
 * Standard JSON-RPC error codes:
 * -32700: Parse error
 * -32600: Invalid Request
 * -32601: Method not found
 * -32602: Invalid params
 * -32603: Internal error
 * -32000 to -32099: Server error (reserved for implementation-defined errors)
 */
export function mapErrorToMcpCode(error: unknown): ErrorCode {
  // Validation and input errors map to Invalid Params
  if (
    error instanceof EntityNotFoundError ||
    error instanceof InvalidContextError ||
    error instanceof ValidationError ||
    error instanceof InvalidInputError
  ) {
    return ErrorCode.InvalidParams;
  }

  // Tool errors
  if (error instanceof ToolNotFoundError) {
    return ErrorCode.MethodNotFound;
  }

  // Internal errors
  if (
    error instanceof TransactionError ||
    error instanceof ToolExecutionError ||
    error instanceof CacheCapacityError ||
    error instanceof ConfigurationError ||
    error instanceof Mem100xError
  ) {
    return ErrorCode.InternalError;
  }

  // Default to internal error for unknown errors
  return ErrorCode.InternalError;
}

/**
 * Creates an MCP-compliant error response
 */
export function createMcpError(error: unknown): {
  code: ErrorCode;
  message: string;
  data?: any;
} {
  const code = mapErrorToMcpCode(error);

  if (error instanceof Mem100xError) {
    return {
      code,
      message: error.message,
      data: {
        type: error.constructor.name,
        context: error.context,
        timestamp: error.timestamp,
      },
    };
  }

  if (error instanceof Error) {
    return {
      code,
      message: error.message,
      data: {
        type: error.constructor.name,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
    };
  }

  return {
    code,
    message: String(error),
    data: { type: 'UnknownError' },
  };
}
