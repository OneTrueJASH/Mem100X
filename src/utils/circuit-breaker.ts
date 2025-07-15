/**
 * Circuit Breaker implementation for MCP-compliant failure handling
 * Prevents cascading failures and provides graceful degradation
 */

import { logError, logWarn, logInfo } from './logger.js'

export enum CircuitState {
  CLOSED = 'CLOSED',    // Normal operation
  OPEN = 'OPEN',        // Failing, reject requests
  HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

export interface CircuitBreakerOptions {
  failureThreshold: number;      // Number of failures before opening
  recoveryTimeout: number;       // Time to wait before half-open (ms)
  expectedVolume: number;        // Expected request volume for monitoring
  enableBulkOperations: boolean; // Whether to enable bulk operation circuit breaker
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private successCount: number = 0;
  private totalRequests: number = 0;
  private readonly options: CircuitBreakerOptions;

  constructor(options: CircuitBreakerOptions) {
    this.options = options;
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(
    operation: () => Promise<T> | T,
    operationName: string = 'operation'
  ): Promise<T> {
    this.totalRequests++;

    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.transitionToHalfOpen();
      } else {
        throw new Error(`Circuit breaker is OPEN for ${operationName}. Service unavailable.`);
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error, operationName);
      throw error;
    }
  }

  /**
   * Execute a synchronous function with circuit breaker protection
   */
  executeSync<T>(
    operation: () => T,
    operationName: string = 'operation'
  ): T {
    this.totalRequests++;

    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.transitionToHalfOpen();
      } else {
        throw new Error(`Circuit breaker is OPEN for ${operationName}. Service unavailable.`);
      }
    }

    try {
      const result = operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error, operationName);
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.successCount++;

    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionToClosed();
    }
  }

  private onFailure(error: unknown, operationName: string): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    const errorObj = error instanceof Error ? error : new Error(String(error));

    logError(`Circuit breaker failure in ${operationName}`, errorObj, {
      failureCount: this.failureCount,
      threshold: this.options.failureThreshold,
      state: this.state
    });

    if (this.state === CircuitState.HALF_OPEN ||
        this.failureCount >= this.options.failureThreshold) {
      this.transitionToOpen();
    }
  }

  private shouldAttemptReset(): boolean {
    return Date.now() - this.lastFailureTime >= this.options.recoveryTimeout;
  }

  private transitionToOpen(): void {
    this.state = CircuitState.OPEN;
    logWarn('Circuit breaker opened', {
      failureCount: this.failureCount,
      threshold: this.options.failureThreshold,
      recoveryTimeout: this.options.recoveryTimeout
    });
  }

  private transitionToHalfOpen(): void {
    this.state = CircuitState.HALF_OPEN;
    this.failureCount = 0;
    logInfo('Circuit breaker half-open - testing recovery');
  }

  private transitionToClosed(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    logInfo('Circuit breaker closed - service recovered');
  }

  /**
   * Get current circuit breaker status
   */
  getStatus() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalRequests: this.totalRequests,
      failureRate: this.totalRequests > 0 ? (this.failureCount / this.totalRequests) * 100 : 0,
      lastFailureTime: this.lastFailureTime,
      options: this.options
    };
  }

  /**
   * Reset circuit breaker to closed state
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.totalRequests = 0;
    this.lastFailureTime = 0;
    logInfo('Circuit breaker manually reset');
  }

  /**
   * Check if bulk operations are enabled
   */
  isBulkOperationsEnabled(): boolean {
    return this.options.enableBulkOperations;
  }
}

/**
 * Create a circuit breaker instance with default MCP-compliant settings
 */
export function createCircuitBreaker(options?: Partial<CircuitBreakerOptions>): CircuitBreaker {
  const defaultOptions: CircuitBreakerOptions = {
    failureThreshold: 5,
    recoveryTimeout: 30000, // 30 seconds
    expectedVolume: 1000,
    enableBulkOperations: true,
    ...options
  };

  return new CircuitBreaker(defaultOptions);
}
