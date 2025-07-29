import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MultiDatabaseManager } from '../dist/multi-database.js';
import { handleExportMemory, handleImportMemory } from '../dist/tool-handlers.js';
import { createTextContent } from '../dist/utils/fast-json.js';
import { config } from '../dist/config.js';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import os from 'os';

describe('Simple Export/Import', () => {
  let manager: MultiDatabaseManager;
  let tempDir: string;

  function getTempConfig() {
    tempDir = mkdtempSync(join(os.tmpdir(), 'mem100x-simple-test-'));
    const personalDbPath = join(tempDir, 'personal.db');
    const workDbPath = join(tempDir, 'work.db');
    return {
      ...config,
      multiContext: {
        ...config.multiContext,
        personalDbPath,
        workDbPath,
        defaultContext: 'personal' as 'personal',
      },
      database: {
        ...config.database,
        path: personalDbPath,
      },
    };
  }

  beforeEach(() => {
    const testConfig = getTempConfig();
    manager = new MultiDatabaseManager(testConfig);
  });

  afterEach(() => {
    manager.close();
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should export and import a simple entity', async () => {
    const ctx = { manager, startTime: performance.now(), toolName: 'export_memory' };

    // Create a simple entity in personal context
    manager.createEntities([
      {
        name: 'TestPerson',
        entityType: 'person',
        observations: [createTextContent('This is a test person')]
      }
    ], 'personal');

    // Export the data
    const exportArgs = {
      format: 'json',
      includeMetadata: true,
      includeObservations: true,
      includeRelations: true
    };

    const exportResult = await handleExportMemory(exportArgs, ctx);

    expect(exportResult.structuredContent.success).toBe(true);
    expect(exportResult.structuredContent.data).toBeDefined();

    const exportData = exportResult.structuredContent.data;
    expect(exportData.metadata.totalEntities).toBe(1);
    expect(exportData.metadata.totalRelations).toBe(0);

    // Import the data into a new manager
    const importCtx = { manager, startTime: performance.now(), toolName: 'import_memory' };

    const importArgs = {
      data: exportData,
      importMode: 'merge',
      conflictResolution: 'merge',
      validateBeforeImport: true,
      dryRun: false
    };

    const importResult = await handleImportMemory(importArgs, importCtx);

    expect(importResult.structuredContent.success).toBe(true);
    expect(importResult.structuredContent.summary.entitiesUpdated).toBe(1);
    expect(importResult.structuredContent.summary.relationsImported).toBe(0);

    // Verify the entity was imported
    const importedEntity = manager.getEntity('TestPerson');
    expect(importedEntity).toBeDefined();
    expect(importedEntity!.entityType).toBe('person');
    expect(importedEntity!.observations).toHaveLength(2); // Merged observations
    expect((importedEntity!.observations[0] as any).text).toBe('This is a test person');
    expect((importedEntity!.observations[1] as any).text).toBe('This is a test person');
  });

  it('should handle compressed export format', async () => {
    const ctx = { manager, startTime: performance.now(), toolName: 'export_memory' };

    // Create test data
    manager.createEntities([
      {
        name: 'CompressedTest',
        entityType: 'test',
        observations: [createTextContent('Test for compression')]
      }
    ]);

    // Export with compression
    const exportArgs = {
      format: 'compressed',
      compressionLevel: 6
    };

    const result = await handleExportMemory(exportArgs, ctx);

    expect(result.structuredContent.success).toBe(true);
    expect(result.structuredContent.data).toBeDefined();
    expect(typeof result.structuredContent.data).toBe('string');
    expect(result.structuredContent.data.startsWith('H4sI')).toBe(true); // gzip header
    expect(result.structuredContent.summary.compressionRatio).toBeGreaterThan(0);
  });
});
