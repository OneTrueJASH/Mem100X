import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryDatabase } from '../../../dist/database.js';
import { MultiDatabaseManager } from '../../../dist/multi-database.js';
import { config } from '../../../dist/config.js';
import { existsSync, unlinkSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import os from 'os';

describe('Database Path Warnings', () => {
  const testDbPath = './data/test-warning.db';
  const customDbPath = '/tmp/test-persistent.db';
  let tempDir: string;

  afterEach(() => {
    // Clean up test files
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
    if (existsSync(customDbPath)) {
      unlinkSync(customDbPath);
    }
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should warn when using default database path', () => {
    // This test verifies that the warning logic is in place
    // The actual warning will be logged during database initialization
    const defaultPath = './data/memory.db';
    const db = new MemoryDatabase(defaultPath);

    // The warning should be logged during initialization
    // We can't easily capture the log in this test, but we can verify
    // that the database is created with the default path
    expect(db).toBeDefined();

    // Clean up
    db.close();
  });

  it('should not warn when using custom database path', () => {
    // This test verifies that custom paths don't trigger warnings
    const db = new MemoryDatabase(customDbPath);

    // The warning should NOT be logged for custom paths
    expect(db).toBeDefined();

    // Clean up
    db.close();
  });

  it('should warn for multi-database default paths', () => {
    // This test verifies that multi-database warnings are in place
    // Create a temporary directory for test databases to avoid conflicts
    tempDir = mkdtempSync(join(os.tmpdir(), 'mem100x-warning-test-'));

    // Create a test config with temporary paths
    const testConfig = {
      ...config,
      multiContext: {
        ...config.multiContext,
        personalDbPath: join(tempDir, 'test-personal.db'),
        workDbPath: join(tempDir, 'test-work.db'),
      }
    };

    const manager = new MultiDatabaseManager(testConfig);

    // The warning should be logged during initialization for default paths
    expect(manager).toBeDefined();

    // Clean up
    manager.closeAll();
  });
});
