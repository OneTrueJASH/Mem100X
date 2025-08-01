import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';

// Global test setup
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.MEM100X_LOG_LEVEL = 'error';
  process.env.MEM100X_DISABLE_AGING = 'true';

  // Disable console output during tests unless explicitly enabled
  if (!process.env.TEST_VERBOSE) {
    console.log = () => {};
    console.info = () => {};
    console.warn = () => {};
    console.error = () => {};
  }
});

// Global test teardown
afterAll(async () => {
  // Clean up any remaining resources
  // This is handled by individual test cleanup functions
});

// Per-test setup
beforeEach(async () => {
  // Reset any global state if needed
  vi.clearAllMocks();
  vi.clearAllTimers();
});

// Per-test teardown
afterEach(async () => {
  // Clean up after each test
  vi.restoreAllMocks();
});
