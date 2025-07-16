#!/usr/bin/env node

/**
 * Simple System Resilience Test
 * Tests the resilience module directly without requiring MCP server
 */

import { SystemResilience } from './src/utils/system-resilience.js';

// Test configuration
const TEST_CONFIG = {
  timeout: 10000,
};

// Utility functions
function log(message, data = {}) {
  console.log(`[${new Date().toISOString()}] ${message}`, data);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test cases
async function testTransactionIntegrity() {
  log('🧪 Testing Transaction Integrity');

  try {
    const resilience = new SystemResilience();

    // Test 1: Create transaction
    const transactionId = resilience.createTransaction('test_integrity', { test: 'data' });
    if (!transactionId) {
      throw new Error('Failed to create transaction');
    }

    // Test 2: Commit transaction with matching data
    const resultData = { test: 'data' };
    resilience.commitTransaction(transactionId, resultData);

    // Test 3: Check transaction log
    const logs = resilience.getTransactionLogs(10);
    const transaction = logs.find(log => log.id === transactionId);
    if (!transaction || transaction.status !== 'committed') {
      throw new Error('Transaction not properly committed');
    }

    log('✅ Transaction integrity test passed');
    return true;
  } catch (error) {
    log('❌ Transaction integrity test failed', { error: error.message });
    return false;
  }
}

async function testRollbackCapabilities() {
  log('🧪 Testing Rollback Capabilities');

  try {
    const resilience = new SystemResilience();

    // Test 1: Create transaction
    const transactionId = resilience.createTransaction('test_rollback', { test: 'data' });

    // Test 2: Rollback transaction
    resilience.rollbackTransaction(transactionId, 'Test rollback');

    // Test 3: Check transaction log
    const logs = resilience.getTransactionLogs(10);
    const transaction = logs.find(log => log.id === transactionId);
    if (!transaction || transaction.status !== 'rolled_back') {
      throw new Error('Transaction not properly rolled back');
    }

    // Test 4: Check recovery actions
    const actions = resilience.getRecoveryActions();
    const rollbackAction = actions.find(action => action.type === 'rollback');
    if (!rollbackAction) {
      throw new Error('Rollback action not recorded');
    }

    log('✅ Rollback capabilities test passed');
    return true;
  } catch (error) {
    log('❌ Rollback capabilities test failed', { error: error.message });
    return false;
  }
}

async function testDataCorruptionDetection() {
  log('🧪 Testing Data Corruption Detection');

  try {
    const resilience = new SystemResilience();

    // Test 1: Validate data integrity
    const testData = { test: 'data', timestamp: Date.now() };
    const integrityCheck = resilience.validateIntegrity(testData);
    if (!integrityCheck.isValid) {
      throw new Error('Valid data failed integrity check');
    }

    // Test 2: Test with invalid checksum
    const invalidCheck = resilience.validateIntegrity(testData, 'invalid_checksum');
    if (invalidCheck.isValid) {
      throw new Error('Invalid checksum should have failed validation');
    }

    // Test 3: Detect and repair corruption
    const repairs = await resilience.detectAndRepairCorruption();
    if (!Array.isArray(repairs)) {
      throw new Error('Repair result should be an array');
    }

    log('✅ Data corruption detection test passed');
    return true;
  } catch (error) {
    log('❌ Data corruption detection test failed', { error: error.message });
    return false;
  }
}

async function testGracefulDegradation() {
  log('🧪 Testing Graceful Degradation');

  try {
    const resilience = new SystemResilience();

        // Test 1: Execute with resilience (should succeed)
    const result = await resilience.executeWithResilience('test_operation', async () => {
      return { test: 'data' };
    }, { test: 'data' });

    if (result.test !== 'data') {
      throw new Error('Resilient operation should return success');
    }

    // Test 2: Execute with resilience (should fail and degrade)
    const degradedResult = await resilience.executeWithResilience('create_entities', async () => {
      throw new Error('Simulated failure');
    }, { test: 'data' });

    if (!Array.isArray(degradedResult)) {
      throw new Error('Degraded operation should return fallback array');
    }

    log('✅ Graceful degradation test passed');
    return true;
  } catch (error) {
    log('❌ Graceful degradation test failed', { error: error.message });
    return false;
  }
}

async function testTransactionLogging() {
  log('🧪 Testing Transaction Logging');

  try {
    const resilience = new SystemResilience();

    // Test 1: Create multiple transactions
    const transaction1 = resilience.createTransaction('test1', { data: 1 });
    const transaction2 = resilience.createTransaction('test2', { data: 2 });

    resilience.commitTransaction(transaction1, { data: 1 });
    resilience.rollbackTransaction(transaction2, 'Test rollback');

    // Test 2: Get transaction logs
    const logs = resilience.getTransactionLogs(10);
    if (logs.length < 2) {
      throw new Error('Expected at least 2 transaction logs');
    }

    // Test 3: Get recovery actions
    const actions = resilience.getRecoveryActions();
    if (actions.length < 1) {
      throw new Error('Expected at least 1 recovery action');
    }

    // Test 4: Get stats
    const stats = resilience.getStats();
    if (stats.totalTransactions < 2) {
      throw new Error('Expected at least 2 total transactions');
    }

    log('✅ Transaction logging test passed');
    return true;
  } catch (error) {
    log('❌ Transaction logging test failed', { error: error.message });
    return false;
  }
}

async function testConfigurationValidation() {
  log('🧪 Testing Configuration Validation');

  try {
    // Test 1: Create with default config
    const resilience1 = new SystemResilience();
    const stats1 = resilience1.getStats();

    if (!stats1.config.enableIntegrityChecks) {
      throw new Error('Default config should enable integrity checks');
    }

    // Test 2: Create with custom config
    const customConfig = {
      enableIntegrityChecks: false,
      enableAutoRollback: false,
      maxTransactionRetries: 5,
    };

    const resilience2 = new SystemResilience(customConfig);
    const stats2 = resilience2.getStats();

    if (stats2.config.enableIntegrityChecks) {
      throw new Error('Custom config should disable integrity checks');
    }

    if (stats2.config.maxTransactionRetries !== 5) {
      throw new Error('Custom config should set max retries to 5');
    }

    log('✅ Configuration validation test passed');
    return true;
  } catch (error) {
    log('❌ Configuration validation test failed', { error: error.message });
    return false;
  }
}

async function testErrorHandling() {
  log('🧪 Testing Error Handling');

  try {
    const resilience = new SystemResilience();

    // Test 1: Handle invalid transaction ID
    try {
      resilience.commitTransaction('invalid_id', {});
      throw new Error('Should have thrown error for invalid transaction ID');
    } catch (error) {
      if (!error.message.includes('not found')) {
        throw new Error('Expected specific error message for invalid transaction ID');
      }
    }

    // Test 2: Handle invalid transaction state
    const transactionId = resilience.createTransaction('test_error', {});
    resilience.commitTransaction(transactionId, {});

    try {
      resilience.commitTransaction(transactionId, {}); // Try to commit again
      throw new Error('Should have thrown error for already committed transaction');
    } catch (error) {
      if (!error.message.includes('not in pending state')) {
        throw new Error('Expected specific error message for invalid transaction state');
      }
    }

    log('✅ Error handling test passed');
    return true;
  } catch (error) {
    log('❌ Error handling test failed', { error: error.message });
    return false;
  }
}

async function testShutdown() {
  log('🧪 Testing Shutdown');

  try {
    const resilience = new SystemResilience();

    // Create some active transactions
    const transaction1 = resilience.createTransaction('shutdown_test1', {});
    const transaction2 = resilience.createTransaction('shutdown_test2', {});

    // Shutdown the system
    resilience.shutdown();

    // Check that active transactions were rolled back
    const logs = resilience.getTransactionLogs(10);
    const shutdownTransactions = logs.filter(log =>
      log.id === transaction1 || log.id === transaction2
    );

    for (const transaction of shutdownTransactions) {
      if (transaction.status !== 'rolled_back') {
        throw new Error('Shutdown should rollback active transactions');
      }
    }

    log('✅ Shutdown test passed');
    return true;
  } catch (error) {
    log('❌ Shutdown test failed', { error: error.message });
    return false;
  }
}

// Main test runner
async function runAllTests() {
  log('🚀 Starting Simple System Resilience Test Suite');

  const tests = [
    { name: 'Transaction Integrity', fn: testTransactionIntegrity },
    { name: 'Rollback Capabilities', fn: testRollbackCapabilities },
    { name: 'Data Corruption Detection', fn: testDataCorruptionDetection },
    { name: 'Graceful Degradation', fn: testGracefulDegradation },
    { name: 'Transaction Logging', fn: testTransactionLogging },
    { name: 'Configuration Validation', fn: testConfigurationValidation },
    { name: 'Error Handling', fn: testErrorHandling },
    { name: 'Shutdown', fn: testShutdown },
  ];

  const results = [];

  for (const test of tests) {
    log(`\n📋 Running: ${test.name}`);
    const startTime = Date.now();

    try {
      const result = await Promise.race([
        test.fn(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Test timeout')), TEST_CONFIG.timeout)
        )
      ]);

      const duration = Date.now() - startTime;
      results.push({
        name: test.name,
        passed: result,
        duration,
        error: null
      });

      log(`${result ? '✅' : '❌'} ${test.name} completed in ${duration}ms`);
    } catch (error) {
      const duration = Date.now() - startTime;
      results.push({
        name: test.name,
        passed: false,
        duration,
        error: error.message
      });

      log(`❌ ${test.name} failed after ${duration}ms: ${error.message}`);
    }
  }

  // Summary
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const successRate = ((passed / total) * 100).toFixed(1);

  log('\n📊 Test Summary');
  log('='.repeat(50));

  for (const result of results) {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    const error = result.error ? ` (${result.error})` : '';
    log(`${status} ${result.name} - ${result.duration}ms${error}`);
  }

  log('\n' + '='.repeat(50));
  log(`Overall: ${passed}/${total} tests passed (${successRate}%)`);

  if (passed === total) {
    log('🎉 All tests passed! System resilience feature is working correctly.');
    process.exit(0);
  } else {
    log('⚠️  Some tests failed. Please review the implementation.');
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  log('🛑 Test interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  log('🛑 Test terminated');
  process.exit(1);
});

// Run tests
runAllTests().catch((error) => {
  log('💥 Test suite failed', { error: error.message });
  process.exit(1);
});
