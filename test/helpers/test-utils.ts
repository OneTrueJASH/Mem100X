import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import os from 'os';
import { MultiDatabaseManager } from '../../dist/multi-database.js';

export interface TestContext {
  tempDir: string;
  db?: any;
  manager?: MultiDatabaseManager;
  cleanup: () => void;
}

export const testUtils = {
  async createTestContext(name = 'test') {
    const tempDir = mkdtempSync(join(os.tmpdir(), `mem100x-${name}-`));
    const config = createTestConfig(tempDir);
    const manager = new MultiDatabaseManager(config);

    return {
      manager,
      tempDir,
      cleanup: () => {
        manager.closeAll();
        rmSync(tempDir, { recursive: true, force: true });
      }
    };
  },

  createBulkEntities(count: number, prefix = 'Entity') {
    return Array.from({ length: count }, (_, i) => ({
      name: `${prefix}${i}`,
      entityType: 'test',
      observations: [createTextContent(`${prefix} ${i} data`)]
    }));
  }
};

// Backward compatibility function for existing tests
export function createTestEnvironment(config: any = {}): TestContext {
  const tempDir = mkdtempSync(join(os.tmpdir(), 'mem100x-test-'));
  let db: any;
  let manager: MultiDatabaseManager | undefined;

  if (config.createManager) {
    const testConfig = createTestConfig(tempDir);
    manager = new MultiDatabaseManager(testConfig);
  }

  const cleanup = () => {
    if (db) {
      db.close();
    }
    if (manager) {
      manager.closeAll();
    }
    rmSync(tempDir, { recursive: true, force: true });
  };

  return { tempDir, db, manager, cleanup };
}

function createTestConfig(tempDir: string) {
  return {
    multiContext: {
      personalDbPath: join(tempDir, 'personal.db'),
      workDbPath: join(tempDir, 'work.db'),
      defaultContext: 'personal' as 'personal' | 'work',
      autoDetect: true,
      confidenceThreshold: 0.7
    }
  };
}

function createTextContent(text: string) {
  return { type: 'text', text };
}
