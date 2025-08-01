# Mem100x Test Suite

This directory contains the comprehensive test suite for Mem100x, organized by test type and functionality.

## Test Structure

```
test/
├── unit/              # Fast, isolated unit tests
│   ├── utils/         # Utility function tests
│   ├── database/      # Database layer tests
│   └── memory/        # Memory management tests
├── integration/       # Component integration tests
├── e2e/              # End-to-end protocol tests
├── performance/      # Performance benchmarks
├── fixtures/         # Shared test data
└── helpers/          # Test utilities
```

## Test Categories

### Unit Tests (`unit/`)
Fast, isolated tests that verify individual functions and components in isolation.

- **`utils/`**: Tests for utility functions, cache systems, configuration validation
- **`database/`**: Tests for database operations, schema validation, multi-database management
- **`memory/`**: Tests for memory export/import, aging, and management features

### Integration Tests (`integration/`)
Tests that verify how components work together.

- Tool handlers with database integration
- Core functionality with multiple components
- Configuration and system integration

### End-to-End Tests (`e2e/`)
Full protocol tests that verify the complete MCP server functionality.

- MCP protocol compliance
- Client-server communication
- Complete workflow validation

### Performance Tests (`performance/`)
Benchmarks and stress tests to ensure system performance.

- Load testing
- Memory usage benchmarks
- Fault injection and resilience testing

## Running Tests

### All Tests
```bash
npm test
```

### Specific Test Categories
```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# E2E tests only
npm run test:e2e

# Performance tests only
npm run test:performance
```

### Test with Coverage
```bash
npm run test:coverage
```

### Test with Verbose Output
```bash
TEST_VERBOSE=true npm test
```

### Parallel Test Execution
```bash
npm run test:parallel
```

## Test Configuration

### Vitest Configuration
The test suite uses Vitest with different configurations for different test types:

- **Main config**: `vitest.config.ts` - General test configuration
- **Performance config**: Extended timeouts and specialized reporting
- **E2E config**: Longer timeouts for full workflow tests

### Environment Variables
- `NODE_ENV=test` - Sets test environment
- `MEM100X_LOG_LEVEL=error` - Reduces log noise during tests
- `MEM100X_DISABLE_AGING=true` - Disables memory aging for deterministic tests
- `TEST_VERBOSE=true` - Enables verbose console output

## Test Utilities

### Test Helpers (`helpers/`)
- **`test-utils.ts`**: Common test setup, teardown, and utility functions
- **`mcp-mock.ts`**: Mock MCP client and server for protocol testing
- **`setup.ts`**: Global test environment configuration

### Test Fixtures (`fixtures/`)
- **`test-data.json`**: Comprehensive test data for various scenarios
- Shared test entities, relations, and configurations

## Writing Tests

### Unit Test Example
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestEnvironment, TestData } from '../helpers/test-utils';

describe('Cache Warming', () => {
  let testContext: TestContext;

  beforeEach(() => {
    testContext = createTestEnvironment({ createDatabase: true });
  });

  afterEach(() => {
    testContext.cleanup();
  });

  it('should warm caches successfully', async () => {
    // Test implementation
  });
});
```

### Integration Test Example
```typescript
import { describe, it, expect } from 'vitest';
import { createTestEnvironment } from '../helpers/test-utils';

describe('Tool Handlers Integration', () => {
  it('should handle export and import workflow', async () => {
    const testContext = createTestEnvironment({ createManager: true });
    
    try {
      // Test implementation
    } finally {
      testContext.cleanup();
    }
  });
});
```

### Performance Test Example
```typescript
import { describe, it, expect } from 'vitest';
import { testUtils } from '../helpers/setup';

describe('Database Performance', () => {
  it('should handle large datasets efficiently', async () => {
    const { avgDuration, maxDuration } = await testUtils.performance.benchmark(
      async () => {
        // Performance test implementation
      },
      100 // iterations
    );

    expect(avgDuration).toBeLessThan(100); // 100ms threshold
    expect(maxDuration).toBeLessThan(500); // 500ms threshold
  });
});
```

## Test Data Management

### Using Test Fixtures
```typescript
import testData from '../fixtures/test-data.json';

describe('Entity Operations', () => {
  it('should create entities from fixture data', async () => {
    const entities = testData.entities.people;
    // Use fixture data in tests
  });
});
```

### Generating Test Data
```typescript
import { testUtils } from '../helpers/setup';

describe('Large Dataset Tests', () => {
  it('should handle bulk operations', async () => {
    const entities = testUtils.generateTestData.entities(1000);
    const relations = testUtils.generateTestData.relations(500);
    // Test with generated data
  });
});
```

## Best Practices

### Test Organization
1. **Group related tests** in describe blocks
2. **Use descriptive test names** that explain the expected behavior
3. **Follow the AAA pattern**: Arrange, Act, Assert
4. **Keep tests independent** - no shared state between tests

### Performance Considerations
1. **Use appropriate timeouts** for different test types
2. **Clean up resources** in afterEach/afterAll hooks
3. **Mock external dependencies** to keep tests fast
4. **Use test data fixtures** instead of generating data in tests

### Error Handling
1. **Test both success and failure cases**
2. **Verify error messages** are clear and descriptive
3. **Test edge cases** and boundary conditions
4. **Use try-catch blocks** for async error testing

### Coverage Goals
- **Unit tests**: 90%+ coverage
- **Integration tests**: 80%+ coverage
- **E2E tests**: Critical path coverage
- **Performance tests**: Baseline metrics established

## Continuous Integration

### Pre-commit Hooks
- Run unit tests before commit
- Check code coverage thresholds
- Validate test structure

### CI Pipeline
1. **Unit tests** - Fast feedback loop
2. **Integration tests** - Component interaction validation
3. **E2E tests** - Full system validation
4. **Performance tests** - Performance regression detection

### Test Reports
- **Coverage reports** in HTML and LCOV formats
- **Performance benchmarks** with historical comparison
- **Test results** in JSON format for CI integration

## Troubleshooting

### Common Issues
1. **Test timeouts**: Increase timeout for complex operations
2. **Resource cleanup**: Ensure proper cleanup in afterEach hooks
3. **Mock setup**: Verify mocks are properly configured
4. **Environment variables**: Check test environment configuration

### Debug Mode
```bash
# Enable debug output
DEBUG=* npm test

# Run specific test with debug
DEBUG=* npm test -- --run test-name
```

## Contributing

When adding new tests:
1. **Follow the existing structure** and naming conventions
2. **Add appropriate test categories** (unit/integration/e2e/performance)
3. **Update this README** if adding new test utilities or patterns
4. **Ensure tests are deterministic** and don't depend on external state
5. **Add performance benchmarks** for new features that may impact performance 