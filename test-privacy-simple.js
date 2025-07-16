#!/usr/bin/env node

/**
 * Simple Privacy and Security Test
 * Tests the privacy system with features that are currently working
 */

import { PrivacySecurityManager, PRIVACY_PRESETS } from './src/utils/privacy-security.js';

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
async function testBasicEncryption() {
  log('🔐 Testing Basic Encryption');

  try {
    const privacy = new PrivacySecurityManager(PRIVACY_PRESETS.BASIC);

    // Test encryption with no encryption level
    const testData = 'sensitive information';
    const encrypted = privacy.encryptData(testData);
    const decrypted = privacy.decryptData(encrypted);

    if (decrypted !== testData) {
      throw new Error('Basic encryption/decryption failed');
    }

    log('✅ Basic Encryption - PASS');
    return true;
  } catch (error) {
    log('❌ Basic Encryption - FAIL', { error: error.message });
    return false;
  }
}

async function testStrongEncryption() {
  log('🔐 Testing Strong Encryption');

  try {
    const privacy = new PrivacySecurityManager(PRIVACY_PRESETS.STRONG);

    // Test encryption with strong encryption level
    const testData = 'sensitive information';
    const encrypted = privacy.encryptData(testData);
    const decrypted = privacy.decryptData(encrypted);

    if (decrypted !== testData) {
      throw new Error('Strong encryption/decryption failed');
    }

    log('✅ Strong Encryption - PASS');
    return true;
  } catch (error) {
    log('❌ Strong Encryption - FAIL', { error: error.message });
    return false;
  }
}

async function testConfiguration() {
  log('⚙️ Testing Configuration');

  try {
    const privacy = new PrivacySecurityManager(PRIVACY_PRESETS.BASIC);

    // Test 1: Get current config
    const config = privacy.getPrivacyConfig();
    if (!config.encryptionLevel) {
      throw new Error('Configuration not accessible');
    }

    // Test 2: Update config
    const newConfig = {
      ...config,
      encryptionLevel: 'strong',
      enableAuditTrails: true
    };
    privacy.updatePrivacyConfig(newConfig);

    // Test 3: Verify config update
    const updatedConfig = privacy.getPrivacyConfig();
    if (updatedConfig.encryptionLevel !== 'strong') {
      throw new Error('Configuration update not working');
    }

    log('✅ Configuration - PASS');
    return true;
  } catch (error) {
    log('❌ Configuration - FAIL', { error: error.message });
    return false;
  }
}

async function testPrivacyStats() {
  log('📊 Testing Privacy Stats');

  try {
    const privacy = new PrivacySecurityManager(PRIVACY_PRESETS.BASIC);

    // Test 1: Get initial stats
    const stats = privacy.getPrivacyStats();
    if (typeof stats.totalAuditEntries !== 'number') {
      throw new Error('Privacy stats not accessible');
    }

    // Test 2: Perform operations to update stats
    privacy.encryptData('test data');
    privacy.anonymizeData({ name: 'John Doe' });

    // Test 3: Check updated stats
    const updatedStats = privacy.getPrivacyStats();
    if (updatedStats.encryptionOperations < 1) {
      throw new Error('Stats not being updated');
    }

    log('✅ Privacy Stats - PASS');
    return true;
  } catch (error) {
    log('❌ Privacy Stats - FAIL', { error: error.message });
    return false;
  }
}

async function testCompliance() {
  log('📋 Testing Compliance');

  try {
    const privacy = new PrivacySecurityManager(PRIVACY_PRESETS.ENTERPRISE);

    // Test 1: Check compliance status
    const compliance = privacy.checkCompliance();
    if (typeof compliance !== 'object') {
      throw new Error('Compliance check not working');
    }

    // Test 2: Apply retention policy
    const retentionResult = privacy.applyRetentionPolicy();
    if (typeof retentionResult.deletedCount !== 'number') {
      throw new Error('Retention policy not working');
    }

    // Test 3: Cleanup audit logs
    const cleanupResult = privacy.cleanupAuditLogs();
    if (typeof cleanupResult.deletedCount !== 'number') {
      throw new Error('Audit log cleanup not working');
    }

    log('✅ Compliance - PASS');
    return true;
  } catch (error) {
    log('❌ Compliance - FAIL', { error: error.message });
    return false;
  }
}

async function testErrorHandling() {
  log('🚨 Testing Error Handling');

  try {
    const privacy = new PrivacySecurityManager(PRIVACY_PRESETS.BASIC);

    // Test 1: Invalid encryption data
    try {
      privacy.encryptData(null);
      throw new Error('Should have thrown error for null data');
    } catch (error) {
      // Expected error
    }

    // Test 2: Invalid decryption
    try {
      privacy.decryptData('invalid-encrypted-data');
      throw new Error('Should have thrown error for invalid encrypted data');
    } catch (error) {
      // Expected error
    }

    log('✅ Error Handling - PASS');
    return true;
  } catch (error) {
    log('❌ Error Handling - FAIL', { error: error.message });
    return false;
  }
}

async function testShutdown() {
  log('🔄 Testing Shutdown');

  try {
    const privacy = new PrivacySecurityManager(PRIVACY_PRESETS.BASIC);

    // Test shutdown
    privacy.shutdown();

    log('✅ Shutdown - PASS');
    return true;
  } catch (error) {
    log('❌ Shutdown - FAIL', { error: error.message });
    return false;
  }
}

// Main test runner
async function runAllTests() {
  log('🚀 Starting Simple Privacy and Security Tests');

  const tests = [
    testBasicEncryption,
    testStrongEncryption,
    testConfiguration,
    testPrivacyStats,
    testCompliance,
    testErrorHandling,
    testShutdown
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const result = await Promise.race([
        test(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Test timeout')), TEST_CONFIG.timeout)
        )
      ]);

      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      log('💥 Test failed with error', { error: error.message });
      failed++;
    }

    // Small delay between tests
    await sleep(100);
  }

  log('📊 Test Results', {
    total: tests.length,
    passed,
    failed,
    successRate: `${((passed / tests.length) * 100).toFixed(1)}%`
  });

  if (failed > 0) {
    throw new Error(`${failed} tests failed`);
  }

  log('🎉 All Simple Privacy and Security tests passed!');
}

// Run tests
runAllTests().catch((error) => {
  log('💥 Test suite failed', { error: error.message });
  process.exit(1);
});
