import { describe, it, afterEach } from 'vitest';
import { MultiDatabaseManager } from '../../dist/multi-database.js';
import { config } from '../../dist/config.js';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import os from 'os';

describe('Minimal Database Init Test', () => {
  let manager: MultiDatabaseManager;
  let tempDir: string;

  function getTempConfig() {
    tempDir = mkdtempSync(join(os.tmpdir(), 'mem100x-minimal-test-'));
    const personalDbPath = join(tempDir, 'personal.db');
    const workDbPath = join(tempDir, 'work.db');
    return {
      ...config,
      multiContext: {
        ...config.multiContext,
        personalDbPath,
        workDbPath,
        defaultContext: 'personal' as 'personal' | 'work',
      },
    };
  }

  afterEach(() => {
    if (manager) {
      manager.close();
    }
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should initialize and close MultiDatabaseManager without hanging', () => {
    const testConfig = getTempConfig();
    manager = new MultiDatabaseManager(testConfig);
    // The test passes if it reaches here without hanging or throwing an error
  });
});
