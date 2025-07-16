#!/usr/bin/env node

/**
 * Integration Test: Clear Error Messages
 * Tests user-friendly error messages, error categorization, and troubleshooting suggestions
 */

import { spawn } from 'child_process';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';

const TEST_TIMEOUT = 30000;
const SERVER_STARTUP_DELAY = 2000;

// Test configuration
const testConfig = {
  port: 0, // Use stdio
  logLevel: 'error',
  disableRateLimiting: true,
  disableCircuitBreakers: true,
};

// Test cases for different error scenarios
const errorTestCases = [
  {
    name: 'Entity Not Found Error',
    tool: 'search_nodes',
    args: { query: 'nonexistent-entity', context: 'personal' },
    expectedError: {
      message: "The requested information wasn't found in your memory",
      severity: 'low',
      category: 'database',
      hasSuggestions: true,
      hasTroubleshooting: true,
    },
  },
  {
    name: 'Invalid Context Error',
    tool: 'search_nodes',
    args: { query: 'test', context: 'invalid-context' },
    expectedError: {
      message: 'Invalid context specified',
      severity: 'medium',
      category: 'validation',
      hasSuggestions: true,
      hasTroubleshooting: true,
    },
  },
  {
    name: 'Invalid Input Error',
    tool: 'create_entities',
    args: { entities: [{ name: '', entityType: 'test' }] },
    expectedError: {
      message: 'Invalid input provided',
      severity: 'medium',
      category: 'validation',
      hasSuggestions: true,
      hasTroubleshooting: true,
    },
  },
  {
    name: 'Tool Not Found Error',
    tool: 'nonexistent_tool',
    args: {},
    expectedError: {
      message: 'Requested tool not found',
      severity: 'medium',
      category: 'validation',
      hasSuggestions: true,
      hasTroubleshooting: true,
    },
  },
  {
    name: 'Validation Error - Missing Required Fields',
    tool: 'create_entities',
    args: { entities: [{ name: 'test' }] }, // Missing entityType
    expectedError: {
      message: 'Input validation failed',
      severity: 'medium',
      category: 'validation',
      hasSuggestions: true,
      hasTroubleshooting: true,
    },
  },
  {
    name: 'Validation Error - Invalid Content',
    tool: 'add_observations',
    args: {
      observations: [
        {
          entityName: 'test',
          contents: [{ type: 'text', text: '' }], // Empty text
        },
      ],
    },
    expectedError: {
      message: 'Input validation failed',
      severity: 'medium',
      category: 'validation',
      hasSuggestions: true,
      hasTroubleshooting: true,
    },
  },
];

// Helper function to send MCP request
function sendMcpRequest(server, method, params = {}) {
  return new Promise((resolve, reject) => {
    const request = {
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    };

    server.stdin.write(JSON.stringify(request) + '\n');

    const timeout = setTimeout(() => {
      reject(new Error(`Request timeout for ${method}`));
    }, 5000);

    const responseHandler = (data) => {
      try {
        const response = JSON.parse(data.toString());
        if (response.id === request.id) {
          clearTimeout(timeout);
          server.stdout.removeListener('data', responseHandler);
          resolve(response);
        }
      } catch (error) {
        // Ignore parsing errors for non-JSON data
      }
    };

    server.stdout.on('data', responseHandler);
  });
}

// Helper function to validate error response
function validateErrorResponse(response, expectedError) {
  console.log(`\n🔍 Validating error response for: ${expectedError.message}`);

  // Check if response has error
  if (!response.error) {
    throw new Error('Response should contain an error');
  }

  const error = response.error;
  console.log(`   Error message: ${error.message}`);
  console.log(`   Error code: ${error.code}`);

  // Validate error message
  if (!error.message.includes(expectedError.message)) {
    throw new Error(
      `Expected error message to contain "${expectedError.message}", got "${error.message}"`
    );
  }

  // Validate error data structure
  if (!error.data) {
    throw new Error('Error response should contain data field');
  }

  const data = error.data;
  console.log(`   Error severity: ${data.severity}`);
  console.log(`   Error category: ${data.category}`);

  // Validate severity
  if (data.severity !== expectedError.severity) {
    throw new Error(
      `Expected severity "${expectedError.severity}", got "${data.severity}"`
    );
  }

  // Validate category
  if (data.category !== expectedError.category) {
    throw new Error(
      `Expected category "${expectedError.category}", got "${data.category}"`
    );
  }

  // Validate suggestions
  if (expectedError.hasSuggestions) {
    if (!data.suggestions || !Array.isArray(data.suggestions)) {
      throw new Error('Error response should contain suggestions array');
    }
    if (data.suggestions.length === 0) {
      throw new Error('Error response should contain at least one suggestion');
    }
    console.log(`   Suggestions count: ${data.suggestions.length}`);
    data.suggestions.forEach((suggestion, index) => {
      console.log(`     ${index + 1}. ${suggestion.action}: ${suggestion.description}`);
      if (!suggestion.action || !suggestion.description) {
        throw new Error('Suggestion should have action and description');
      }
    });
  }

  // Validate troubleshooting
  if (expectedError.hasTroubleshooting) {
    if (!data.troubleshooting || typeof data.troubleshooting !== 'string') {
      throw new Error('Error response should contain troubleshooting text');
    }
    if (data.troubleshooting.length === 0) {
      throw new Error('Error response should contain non-empty troubleshooting text');
    }
    console.log(`   Troubleshooting: ${data.troubleshooting}`);
  }

  // Validate technical details are preserved
  if (!data.technicalDetails) {
    throw new Error('Error response should contain technical details for debugging');
  }

  console.log(`   ✅ Error validation passed`);
  return true;
}

// Test error message formatting
async function testErrorMessageFormatting() {
  console.log('\n🧪 Testing Error Message Formatting...');

  const { getUserFriendlyError, formatErrorForUser } = await import('./src/utils/error-messages.js');

  // Test EntityNotFoundError
  const entityError = new (await import('./src/errors.js')).EntityNotFoundError('test-entity');
  const userError = getUserFriendlyError(entityError);

  console.log(`   EntityNotFoundError user message: ${userError.message}`);
  console.log(`   Severity: ${userError.severity}`);
  console.log(`   Category: ${userError.category}`);
  console.log(`   Suggestions count: ${userError.suggestions.length}`);

  if (userError.message !== "The requested information wasn't found in your memory") {
    throw new Error('Incorrect user-friendly message for EntityNotFoundError');
  }

  if (userError.severity !== 'low') {
    throw new Error('Incorrect severity for EntityNotFoundError');
  }

  if (userError.category !== 'database') {
    throw new Error('Incorrect category for EntityNotFoundError');
  }

  if (userError.suggestions.length === 0) {
    throw new Error('EntityNotFoundError should have suggestions');
  }

  // Test formatted error message
  const formattedError = formatErrorForUser(entityError);
  console.log(`   Formatted error message length: ${formattedError.length}`);

  if (!formattedError.includes('❌')) {
    throw new Error('Formatted error should include error emoji');
  }

  if (!formattedError.includes('💡')) {
    throw new Error('Formatted error should include suggestions emoji');
  }

  if (!formattedError.includes('🔧')) {
    throw new Error('Formatted error should include troubleshooting emoji');
  }

  console.log('   ✅ Error message formatting tests passed');
}

// Test error categorization
async function testErrorCategorization() {
  console.log('\n🧪 Testing Error Categorization...');

  const { getUserFriendlyError } = await import('./src/utils/error-messages.js');
  const errors = await import('./src/errors.js');

  const testCases = [
    {
      error: new errors.EntityNotFoundError('test'),
      expectedSeverity: 'low',
      expectedCategory: 'database',
    },
    {
      error: new errors.InvalidContextError('invalid', ['personal', 'work']),
      expectedSeverity: 'medium',
      expectedCategory: 'validation',
    },
    {
      error: new errors.TransactionError('test'),
      expectedSeverity: 'high',
      expectedCategory: 'database',
    },
    {
      error: new errors.ConfigurationError('test'),
      expectedSeverity: 'high',
      expectedCategory: 'configuration',
    },
  ];

  for (const testCase of testCases) {
    const userError = getUserFriendlyError(testCase.error);

    if (userError.severity !== testCase.expectedSeverity) {
      throw new Error(
        `${testCase.error.constructor.name} should have severity "${testCase.expectedSeverity}", got "${userError.severity}"`
      );
    }

    if (userError.category !== testCase.expectedCategory) {
      throw new Error(
        `${testCase.error.constructor.name} should have category "${testCase.expectedCategory}", got "${userError.category}"`
      );
    }

    console.log(`   ✅ ${testCase.error.constructor.name}: ${userError.severity}/${userError.category}`);
  }

  console.log('   ✅ Error categorization tests passed');
}

// Test specific error message patterns
async function testSpecificErrorMessages() {
  console.log('\n🧪 Testing Specific Error Messages...');

  const { getUserFriendlyError } = await import('./src/utils/error-messages.js');

  // Test database lock error
  const dbLockError = new Error('database is locked');
  const dbLockUserError = getUserFriendlyError(dbLockError);

  if (!dbLockUserError.message.includes('Database is temporarily locked')) {
    throw new Error('Database lock error should have user-friendly message');
  }

  if (dbLockUserError.category !== 'database') {
    throw new Error('Database lock error should be categorized as database');
  }

  // Test permission error
  const permissionError = new Error('permission denied');
  const permissionUserError = getUserFriendlyError(permissionError);

  if (!permissionUserError.message.includes('Permission denied')) {
    throw new Error('Permission error should have user-friendly message');
  }

  if (permissionUserError.category !== 'permission') {
    throw new Error('Permission error should be categorized as permission');
  }

  // Test module not found error
  const moduleError = new Error('cannot find module');
  const moduleUserError = getUserFriendlyError(moduleError);

  if (!moduleUserError.message.includes('Required module not found')) {
    throw new Error('Module not found error should have user-friendly message');
  }

  if (moduleUserError.category !== 'configuration') {
    throw new Error('Module not found error should be categorized as configuration');
  }

  console.log('   ✅ Specific error message tests passed');
}

// Main test function
async function runClearErrorMessagesTest() {
  console.log('🚀 Starting Clear Error Messages Integration Test');
  console.log('=' .repeat(60));

  let server = null;
  let testResults = {
    passed: 0,
    failed: 0,
    errors: [],
  };

  try {
    // Test 1: Error message formatting
    try {
      await testErrorMessageFormatting();
      testResults.passed++;
      console.log('✅ Test 1: Error message formatting - PASSED');
    } catch (error) {
      testResults.failed++;
      testResults.errors.push(`Test 1 failed: ${error.message}`);
      console.log(`❌ Test 1: Error message formatting - FAILED: ${error.message}`);
    }

    // Test 2: Error categorization
    try {
      await testErrorCategorization();
      testResults.passed++;
      console.log('✅ Test 2: Error categorization - PASSED');
    } catch (error) {
      testResults.failed++;
      testResults.errors.push(`Test 2 failed: ${error.message}`);
      console.log(`❌ Test 2: Error categorization - FAILED: ${error.message}`);
    }

    // Test 3: Specific error messages
    try {
      await testSpecificErrorMessages();
      testResults.passed++;
      console.log('✅ Test 3: Specific error messages - PASSED');
    } catch (error) {
      testResults.failed++;
      testResults.errors.push(`Test 3 failed: ${error.message}`);
      console.log(`❌ Test 3: Specific error messages - FAILED: ${error.message}`);
    }

    // Test 4: Server error responses (if server can start)
    try {
      console.log('\n🧪 Testing Server Error Responses...');

      // Check if server can be built
      if (!existsSync('./dist/server-multi.js')) {
        console.log('   ⚠️  Server not built, skipping server error response tests');
        console.log('   💡 Run "npm run build" to enable server error response tests');
      } else {
        // Start server
        server = spawn('node', ['dist/server-multi.js'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, ...testConfig },
        });

        // Wait for server to start
        await new Promise(resolve => setTimeout(resolve, SERVER_STARTUP_DELAY));

        // Test error responses
        for (const testCase of errorTestCases) {
          try {
            console.log(`\n   Testing: ${testCase.name}`);

            const response = await sendMcpRequest(server, 'tools/call', {
              name: testCase.tool,
              arguments: testCase.args,
            });

            if (response.error) {
              validateErrorResponse(response, testCase.expectedError);
              console.log(`   ✅ ${testCase.name} - PASSED`);
              testResults.passed++;
            } else {
              throw new Error('Expected error response but got success');
            }
          } catch (error) {
            console.log(`   ❌ ${testCase.name} - FAILED: ${error.message}`);
            testResults.failed++;
            testResults.errors.push(`${testCase.name} failed: ${error.message}`);
          }
        }
      }
    } catch (error) {
      testResults.failed++;
      testResults.errors.push(`Server error response test failed: ${error.message}`);
      console.log(`❌ Test 4: Server error responses - FAILED: ${error.message}`);
    }

  } catch (error) {
    testResults.failed++;
    testResults.errors.push(`Test suite failed: ${error.message}`);
    console.log(`❌ Test suite failed: ${error.message}`);
  } finally {
    // Cleanup
    if (server) {
      server.kill();
    }
  }

  // Test summary
  console.log('\n' + '=' .repeat(60));
  console.log('📊 Clear Error Messages Test Summary');
  console.log('=' .repeat(60));
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📈 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);

  if (testResults.errors.length > 0) {
    console.log('\n❌ Errors:');
    testResults.errors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error}`);
    });
  }

  if (testResults.failed === 0) {
    console.log('\n🎉 All Clear Error Messages tests passed!');
    console.log('\n✨ Feature #16: Clear Error Messages - IMPLEMENTED');
    console.log('   ✅ User-friendly error messages with actionable suggestions');
    console.log('   ✅ Error categorization by severity and impact');
    console.log('   ✅ Comprehensive troubleshooting guides');
    console.log('   ✅ Enhanced error context with helpful details');
    console.log('   ✅ Error message testing and validation');
  } else {
    console.log('\n💥 Some tests failed. Please review the errors above.');
    process.exit(1);
  }
}

// Run the test
runClearErrorMessagesTest().catch((error) => {
  console.error('💥 Test suite crashed:', error);
  process.exit(1);
});
