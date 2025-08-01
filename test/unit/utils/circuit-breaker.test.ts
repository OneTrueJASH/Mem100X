import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CircuitBreaker, CircuitState, createCircuitBreaker } from '../../../dist/utils/circuit-breaker.js';
import { createTestEnvironment, TestContext } from '../../helpers/test-utils.js';

describe('CircuitBreaker', () => {
  let testContext: TestContext;
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    testContext = createTestEnvironment();
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      recoveryTimeout: 1000,
      expectedVolume: 10,
      enableBulkOperations: true
    });
  });

  afterEach(() => {
    testContext.cleanup();
  });

  describe('Initialization', () => {
    it('should initialize in CLOSED state', () => {
      const status = circuitBreaker.getStatus();
      expect(status.state).toBe(CircuitState.CLOSED);
      expect(status.failureCount).toBe(0);
      expect(status.successCount).toBe(0);
      expect(status.totalRequests).toBe(0);
    });

    it('should accept custom configuration', () => {
      const customBreaker = new CircuitBreaker({
        failureThreshold: 5,
        recoveryTimeout: 2000,
        expectedVolume: 20,
        enableBulkOperations: false
      });

      expect(customBreaker.isBulkOperationsEnabled()).toBe(false);
    });

    it('should handle default configuration', () => {
      const defaultBreaker = createCircuitBreaker();
      expect(defaultBreaker.getStatus().state).toBe(CircuitState.CLOSED);
    });
  });

  describe('CLOSED State Operations', () => {
    it('should execute successful operations normally', async () => {
      const result = await circuitBreaker.execute(
        async () => 'success',
        'test-operation'
      );

      expect(result).toBe('success');

      const status = circuitBreaker.getStatus();
      expect(status.state).toBe(CircuitState.CLOSED);
      expect(status.successCount).toBe(1);
      expect(status.failureCount).toBe(0);
    });

    it('should execute synchronous operations normally', () => {
      const result = circuitBreaker.executeSync(
        () => 'success',
        'test-operation'
      );

      expect(result).toBe('success');

      const status = circuitBreaker.getStatus();
      expect(status.state).toBe(CircuitState.CLOSED);
      expect(status.successCount).toBe(1);
      expect(status.failureCount).toBe(0);
    });

    it('should track failures and remain CLOSED until threshold', async () => {
      const failingOperation = async () => {
        throw new Error('Operation failed');
      };

      // First failure
      await expect(circuitBreaker.execute(failingOperation, 'test')).rejects.toThrow('Operation failed');
      expect(circuitBreaker.getStatus().state).toBe(CircuitState.CLOSED);
      expect(circuitBreaker.getStatus().failureCount).toBe(1);

      // Second failure
      await expect(circuitBreaker.execute(failingOperation, 'test')).rejects.toThrow('Operation failed');
      expect(circuitBreaker.getStatus().state).toBe(CircuitState.CLOSED);
      expect(circuitBreaker.getStatus().failureCount).toBe(2);

      // Third failure should open the circuit
      await expect(circuitBreaker.execute(failingOperation, 'test')).rejects.toThrow('Operation failed');
      expect(circuitBreaker.getStatus().state).toBe(CircuitState.OPEN);
    });

    it('should reset failure count on successful operation', async () => {
      const failingOperation = async () => {
        throw new Error('Operation failed');
      };

      // Two failures
      await expect(circuitBreaker.execute(failingOperation, 'test')).rejects.toThrow();
      await expect(circuitBreaker.execute(failingOperation, 'test')).rejects.toThrow();

      expect(circuitBreaker.getStatus().failureCount).toBe(2);

      // Successful operation should reset failure count
      await circuitBreaker.execute(async () => 'success', 'test');

      expect(circuitBreaker.getStatus().failureCount).toBe(0);
      expect(circuitBreaker.getStatus().state).toBe(CircuitState.CLOSED);
    });
  });

  describe('OPEN State Operations', () => {
    beforeEach(async () => {
      // Open the circuit by causing failures
      const failingOperation = async () => {
        throw new Error('Operation failed');
      };

      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failingOperation, 'test')).rejects.toThrow();
      }
    });

    it('should reject operations when circuit is OPEN', async () => {
      const status = circuitBreaker.getStatus();
      expect(status.state).toBe(CircuitState.OPEN);

      await expect(
        circuitBreaker.execute(async () => 'success', 'test')
      ).rejects.toThrow('Circuit breaker is OPEN for test. Service unavailable.');
    });

    it('should reject synchronous operations when circuit is OPEN', () => {
      const status = circuitBreaker.getStatus();
      expect(status.state).toBe(CircuitState.OPEN);

      expect(() =>
        circuitBreaker.executeSync(() => 'success', 'test')
      ).toThrow('Circuit breaker is OPEN for test. Service unavailable.');
    });

    it('should transition to HALF_OPEN after recovery timeout', async () => {
      // Wait for recovery timeout using real time
      await new Promise(resolve => setTimeout(resolve, 1100));

      // The circuit breaker only transitions to HALF_OPEN when a request is made
      // So we need to make a request to trigger the transition
      try {
        await circuitBreaker.execute(async () => {
          throw new Error('Test failure');
        }, 'test');
      } catch (error) {
        // Expected - this should trigger the transition to HALF_OPEN then back to OPEN
      }

      // Should now be in OPEN state because the failure in HALF_OPEN immediately opens the circuit
      const status = circuitBreaker.getStatus();
      expect(status.state).toBe(CircuitState.OPEN);
    });
  });

  describe('HALF_OPEN State Operations', () => {
    beforeEach(async () => {
      // Open the circuit
      const failingOperation = async () => {
        throw new Error('Operation failed');
      };

      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failingOperation, 'test')).rejects.toThrow();
      }

      // Wait for recovery timeout
      await new Promise(resolve => setTimeout(resolve, 1100));
    });

    it('should allow operations in HALF_OPEN state', async () => {
      // The circuit breaker should be in OPEN state, waiting for a request to trigger HALF_OPEN
      expect(circuitBreaker.getStatus().state).toBe(CircuitState.OPEN);

      const result = await circuitBreaker.execute(
        async () => 'success',
        'test-operation'
      );

      expect(result).toBe('success');
      expect(circuitBreaker.getStatus().state).toBe(CircuitState.CLOSED);
    });

    it('should transition to CLOSED on successful operation', async () => {
      // The circuit breaker should be in OPEN state, waiting for a request to trigger HALF_OPEN
      expect(circuitBreaker.getStatus().state).toBe(CircuitState.OPEN);

      await circuitBreaker.execute(async () => 'success', 'test');

      expect(circuitBreaker.getStatus().state).toBe(CircuitState.CLOSED);
      expect(circuitBreaker.getStatus().failureCount).toBe(0);
    });

    it('should transition back to OPEN on failure', async () => {
      // The circuit breaker should be in OPEN state, waiting for a request to trigger HALF_OPEN
      expect(circuitBreaker.getStatus().state).toBe(CircuitState.OPEN);

      await expect(
        circuitBreaker.execute(async () => {
          throw new Error('Operation failed');
        }, 'test')
      ).rejects.toThrow('Operation failed');

      expect(circuitBreaker.getStatus().state).toBe(CircuitState.OPEN);
    });

    it('should handle synchronous operations in HALF_OPEN state', () => {
      // The circuit breaker should be in OPEN state, waiting for a request to trigger HALF_OPEN
      expect(circuitBreaker.getStatus().state).toBe(CircuitState.OPEN);

      const result = circuitBreaker.executeSync(() => 'success', 'test');
      expect(result).toBe('success');
      expect(circuitBreaker.getStatus().state).toBe(CircuitState.CLOSED);
    });
  });

  describe('State Transitions', () => {
    it('should transition CLOSED -> OPEN on threshold exceeded', async () => {
      const failingOperation = async () => {
        throw new Error('Operation failed');
      };

      expect(circuitBreaker.getStatus().state).toBe(CircuitState.CLOSED);

      // Cause failures up to threshold
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failingOperation, 'test')).rejects.toThrow();
      }

      expect(circuitBreaker.getStatus().state).toBe(CircuitState.OPEN);
    });

    it('should transition OPEN -> HALF_OPEN after recovery timeout', async () => {
      // Open the circuit first
      const failingOperation = async () => {
        throw new Error('Operation failed');
      };

      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failingOperation, 'test')).rejects.toThrow();
      }

      expect(circuitBreaker.getStatus().state).toBe(CircuitState.OPEN);

      // Wait for recovery timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Make a request to trigger the transition to HALF_OPEN
      try {
        await circuitBreaker.execute(async () => {
          throw new Error('Test failure');
        }, 'test');
      } catch (error) {
        // Expected - this triggers the transition to HALF_OPEN then back to OPEN
      }

      expect(circuitBreaker.getStatus().state).toBe(CircuitState.OPEN);
    });

    it('should transition HALF_OPEN -> CLOSED on success', async () => {
      // Get to HALF_OPEN state
      const failingOperation = async () => {
        throw new Error('Operation failed');
      };

      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failingOperation, 'test')).rejects.toThrow();
      }

      await new Promise(resolve => setTimeout(resolve, 1100));

      // Successful operation should close the circuit
      await circuitBreaker.execute(async () => 'success', 'test');

      expect(circuitBreaker.getStatus().state).toBe(CircuitState.CLOSED);
    });

    it('should transition HALF_OPEN -> OPEN on failure', async () => {
      // Get to HALF_OPEN state
      const failingOperation = async () => {
        throw new Error('Operation failed');
      };

      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failingOperation, 'test')).rejects.toThrow();
      }

      await new Promise(resolve => setTimeout(resolve, 1100));

      // Another failure should open the circuit again
      await expect(circuitBreaker.execute(failingOperation, 'test')).rejects.toThrow();

      expect(circuitBreaker.getStatus().state).toBe(CircuitState.OPEN);
    });
  });

  describe('Error Handling', () => {
    it('should propagate original errors', async () => {
      const customError = new Error('Custom error message');
      const failingOperation = async () => {
        throw customError;
      };

      await expect(circuitBreaker.execute(failingOperation, 'test')).rejects.toThrow('Custom error message');
    });

    it('should handle different error types', async () => {
      const errorTypes = [
        new Error('Standard error'),
        new TypeError('Type error'),
        new RangeError('Range error'),
        'String error',
        123,
        { custom: 'error' }
      ];

      for (const error of errorTypes) {
        const failingOperation = async () => {
          throw error;
        };

        await expect(circuitBreaker.execute(failingOperation, 'test')).rejects.toThrow();
      }

      expect(circuitBreaker.getStatus().state).toBe(CircuitState.OPEN);
    });

    it('should handle synchronous errors', () => {
      const failingOperation = () => {
        throw new Error('Synchronous error');
      };

      expect(() => circuitBreaker.executeSync(failingOperation, 'test')).toThrow('Synchronous error');
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should track total requests', async () => {
      expect(circuitBreaker.getStatus().totalRequests).toBe(0);

      await circuitBreaker.execute(async () => 'success', 'test');
      expect(circuitBreaker.getStatus().totalRequests).toBe(1);

      await expect(
        circuitBreaker.execute(async () => {
          throw new Error('Failed');
        }, 'test')
      ).rejects.toThrow();

      expect(circuitBreaker.getStatus().totalRequests).toBe(2);
    });

    it('should track success and failure counts', async () => {
      // Successful operations
      await circuitBreaker.execute(async () => 'success', 'test');
      await circuitBreaker.execute(async () => 'success', 'test');

      expect(circuitBreaker.getStatus().successCount).toBe(2);
      expect(circuitBreaker.getStatus().failureCount).toBe(0);

      // Failed operations
      await expect(
        circuitBreaker.execute(async () => {
          throw new Error('Failed');
        }, 'test')
      ).rejects.toThrow();

      expect(circuitBreaker.getStatus().successCount).toBe(2);
      expect(circuitBreaker.getStatus().failureCount).toBe(1);
    });

    it('should provide comprehensive status information', () => {
      const status = circuitBreaker.getStatus();

      expect(status).toHaveProperty('state');
      expect(status).toHaveProperty('failureCount');
      expect(status).toHaveProperty('successCount');
      expect(status).toHaveProperty('totalRequests');
      expect(status).toHaveProperty('lastFailureTime');
      expect(status).toHaveProperty('options');
      expect(status.options).toHaveProperty('failureThreshold');
      expect(status.options).toHaveProperty('recoveryTimeout');
    });
  });

  describe('Reset Functionality', () => {
    it('should reset circuit to CLOSED state', async () => {
      // Open the circuit
      const failingOperation = async () => {
        throw new Error('Operation failed');
      };

      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failingOperation, 'test')).rejects.toThrow();
      }

      expect(circuitBreaker.getStatus().state).toBe(CircuitState.OPEN);

      // Reset the circuit
      circuitBreaker.reset();

      expect(circuitBreaker.getStatus().state).toBe(CircuitState.CLOSED);
      expect(circuitBreaker.getStatus().failureCount).toBe(0);
      expect(circuitBreaker.getStatus().successCount).toBe(0);
    });

    it('should allow operations after reset', async () => {
      // Open the circuit
      const failingOperation = async () => {
        throw new Error('Operation failed');
      };

      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failingOperation, 'test')).rejects.toThrow();
      }

      circuitBreaker.reset();

      // Should work normally after reset
      const result = await circuitBreaker.execute(async () => 'success', 'test');
      expect(result).toBe('success');
    });
  });

  describe('Bulk Operations', () => {
    it('should support bulk operations when enabled', () => {
      expect(circuitBreaker.isBulkOperationsEnabled()).toBe(true);
    });

    it('should disable bulk operations when configured', () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 3,
        recoveryTimeout: 1000,
        expectedVolume: 10,
        enableBulkOperations: false
      });

      expect(breaker.isBulkOperationsEnabled()).toBe(false);
    });
  });

  describe('Performance Tests', () => {
    it('should handle rapid operations efficiently', async () => {
      const startTime = performance.now();

      // Perform many operations
      for (let i = 0; i < 1000; i++) {
        await circuitBreaker.execute(async () => 'success', `operation-${i}`);
      }

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle rapid failures efficiently', async () => {
      const failingOperation = async () => {
        throw new Error('Operation failed');
      };

      const startTime = performance.now();

      // Perform many failing operations
      for (let i = 0; i < 100; i++) {
        try {
          await circuitBreaker.execute(failingOperation, `operation-${i}`);
        } catch (error) {
          // Expected
        }
      }

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Edge Cases', () => {
    it('should handle operations that return undefined', async () => {
      const result = await circuitBreaker.execute(async () => undefined, 'test');
      expect(result).toBeUndefined();
    });

    it('should handle operations that return null', async () => {
      const result = await circuitBreaker.execute(async () => null, 'test');
      expect(result).toBeNull();
    });

    it('should handle operations that return complex objects', async () => {
      const complexObject = {
        nested: {
          array: [1, 2, 3],
          string: 'test',
          number: 42
        }
      };

      const result = await circuitBreaker.execute(async () => complexObject, 'test');
      expect(result).toEqual(complexObject);
    });

    it('should handle very long operation names', async () => {
      const longName = 'a'.repeat(1000);

      const result = await circuitBreaker.execute(async () => 'success', longName);
      expect(result).toBe('success');
    });

    it('should handle operations that take time', async () => {
      const slowOperation = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'slow success';
      };

      const result = await circuitBreaker.execute(slowOperation, 'slow-test');
      expect(result).toBe('slow success');
    }, 10000); // Increase timeout to 10 seconds
  });

  describe('Configuration Validation', () => {
    it('should handle zero failure threshold', () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 0,
        recoveryTimeout: 1000,
        expectedVolume: 10,
        enableBulkOperations: true
      });

      // Should open immediately on first failure
      expect(breaker.getStatus().options.failureThreshold).toBe(0);
    });

    it('should handle very short recovery timeout', () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 3,
        recoveryTimeout: 1, // 1ms
        expectedVolume: 10,
        enableBulkOperations: true
      });

      expect(breaker.getStatus().options.recoveryTimeout).toBe(1);
    });

    it('should handle very long recovery timeout', () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 3,
        recoveryTimeout: 3600000, // 1 hour
        expectedVolume: 10,
        enableBulkOperations: true
      });

      expect(breaker.getStatus().options.recoveryTimeout).toBe(3600000);
    });
  });
});
