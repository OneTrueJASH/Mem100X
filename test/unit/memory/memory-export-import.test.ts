import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MultiDatabaseManager } from '../../../dist/multi-database.js';
import { MemoryExport, ExportOptions, ImportOptions } from '../../../dist/types.js';
import { handleExportMemory, handleImportMemory } from '../../../dist/tool-handlers.js';
import { createTextContent } from '../../../dist/utils/fast-json.js';
import { createHash } from 'crypto';
import { config } from '../../../dist/config.js';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import os from 'os';

describe('Memory Export/Import', () => {
  let manager: MultiDatabaseManager;
  let tempDir: string;

  function getTempConfig() {
    // Use a unique temp dir for each test run
    tempDir = mkdtempSync(join(os.tmpdir(), 'mem100x-export-test-'));
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
    // Cleanup temp directory
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should export memory data with all entities and relations', async () => {
    // Create test data
    const ctx = { manager, startTime: performance.now(), toolName: 'export_memory' };

    // Create entities in personal context
    manager.createEntities([
      {
        name: 'TestEntity1',
        entityType: 'person',
        observations: [createTextContent('Test observation 1')]
      },
      {
        name: 'TestEntity2',
        entityType: 'project',
        observations: [createTextContent('Test observation 2')]
      }
    ], 'personal');

    // Create relations in personal context
    manager.createRelations([
      {
        from: 'TestEntity1',
        to: 'TestEntity2',
        relationType: 'works_on'
      }
    ], 'personal');

    // Export data
    const exportArgs = {
      format: 'json',
      includeMetadata: true,
      includeObservations: true,
      includeRelations: true,
      exportVersion: '3.0.0'
    };

        const result = await handleExportMemory(exportArgs, ctx);

    expect(result.structuredContent).toBeDefined();
    expect(result.structuredContent.success).toBe(true);
    expect(result.structuredContent.data).toBeDefined();

    const exportData = result.structuredContent.data as MemoryExport;

    // Validate export structure
    expect(exportData.version).toBe('3.0.0');
    expect(exportData.sourceServer).toBe('mem100x');
    expect(exportData.sourceVersion).toBe('3.0.0');
    expect(exportData.exportDate).toBeDefined();
    expect(exportData.checksum).toBeDefined();

    // Validate metadata
    expect(exportData.metadata.totalEntities).toBe(2);
    expect(exportData.metadata.totalRelations).toBe(1);
    expect(exportData.metadata.totalObservations).toBe(2);
    expect(exportData.metadata.contexts).toContain('personal');
    expect(exportData.metadata.entityTypes).toContain('person');
    expect(exportData.metadata.entityTypes).toContain('project');
    expect(exportData.metadata.relationTypes).toContain('works_on');

    // Validate contexts
    expect(exportData.contexts.personal).toBeDefined();
    expect(exportData.contexts.personal.entities).toHaveLength(2);
    expect(exportData.contexts.personal.relations).toHaveLength(1);

        // Validate entities
    const entity1 = exportData.contexts.personal.entities.find(e => e.name === 'TestEntity1');
    const entity2 = exportData.contexts.personal.entities.find(e => e.name === 'TestEntity2');

    expect(entity1).toBeDefined();
    expect(entity1!.entityType).toBe('person');
    expect(entity1!.content).toHaveLength(1);
    expect(entity1!.content[0].type).toBe('text');
    expect((entity1!.content[0] as any).text).toBe('Test observation 1');

    expect(entity2).toBeDefined();
    expect(entity2!.entityType).toBe('project');
    expect(entity2!.content).toHaveLength(1);
    expect((entity2!.content[0] as any).text).toBe('Test observation 2');

    // Validate relations
    const relation = exportData.contexts.personal.relations[0];
    expect(relation.from).toBe('TestEntity1');
    expect(relation.to).toBe('TestEntity2');
    expect(relation.relationType).toBe('works_on');
  });

  it('should import memory data successfully', async () => {
    const ctx = { manager, startTime: performance.now(), toolName: 'import_memory' };

    // Create export data
    const exportData: MemoryExport = {
      version: '3.0.0',
      exportDate: new Date().toISOString(),
      sourceServer: 'mem100x',
      sourceVersion: '3.0.0',
      metadata: {
        totalEntities: 2,
        totalRelations: 1,
        totalObservations: 2,
        contexts: ['personal'],
        entityTypes: ['person', 'project'],
        relationTypes: ['works_on']
      },
      contexts: {
        personal: {
          name: 'personal',
          entities: [
            {
              id: 'entity1',
              name: 'ImportedEntity1',
              entityType: 'person',
              content: [createTextContent('Imported observation 1')],
              metadata: {
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                prominence: 1.0,
                accessCount: 0,
                lastAccessed: new Date().toISOString()
              }
            },
            {
              id: 'entity2',
              name: 'ImportedEntity2',
              entityType: 'project',
              content: [createTextContent('Imported observation 2')]
            }
          ],
          relations: [
            {
              id: 'rel1',
              from: 'ImportedEntity1',
              to: 'ImportedEntity2',
              relationType: 'works_on',
              metadata: {
                createdAt: new Date().toISOString(),
                strength: 1.0
              }
            }
          ],
          metadata: {
            entityCount: 2,
            relationCount: 1,
            observationCount: 2
          }
        }
      },
      checksum: ''
    };

    // Generate checksum
    const dataString = JSON.stringify(exportData, (key, value) =>
      key === 'checksum' ? undefined : value
    );
    exportData.checksum = require('crypto').createHash('sha256').update(dataString).digest('hex');

    // Import data
    const importArgs = {
      data: exportData,
      importMode: 'merge',
      conflictResolution: 'merge',
      validateBeforeImport: true,
      dryRun: false
    };

        const result = await handleImportMemory(importArgs, ctx);

    expect(result.structuredContent).toBeDefined();
    expect(result.structuredContent.success).toBe(true);

    const importResult = result.structuredContent;
    expect(importResult.summary.entitiesImported).toBe(2);
    expect(importResult.summary.relationsImported).toBe(1);
    expect(importResult.summary.observationsImported).toBe(2);
    expect(importResult.summary.entitiesSkipped).toBe(0);
    expect(importResult.summary.relationsSkipped).toBe(0);

    // Verify imported data exists
    const importedEntity1 = manager.getEntity('ImportedEntity1');
    const importedEntity2 = manager.getEntity('ImportedEntity2');

    expect(importedEntity1).toBeDefined();
    expect(importedEntity1!.entityType).toBe('person');
    expect(importedEntity1!.observations).toHaveLength(1);
    expect((importedEntity1!.observations[0] as any).text).toBe('Imported observation 1');

    expect(importedEntity2).toBeDefined();
    expect(importedEntity2!.entityType).toBe('project');
    expect(importedEntity2!.observations).toHaveLength(1);
    expect((importedEntity2!.observations[0] as any).text).toBe('Imported observation 2');
  });

  it('should handle conflict resolution during import', async () => {
    const ctx = { manager, startTime: performance.now(), toolName: 'import_memory' };

    // Create existing entity in personal context
    manager.createEntities([
      {
        name: 'ExistingEntity',
        entityType: 'person',
        observations: [createTextContent('Original observation')]
      }
    ], 'personal');

    // Create export data with conflicting entity
    const exportData: MemoryExport = {
      version: '3.0.0',
      exportDate: new Date().toISOString(),
      sourceServer: 'mem100x',
      sourceVersion: '3.0.0',
      metadata: {
        totalEntities: 1,
        totalRelations: 0,
        totalObservations: 1,
        contexts: ['personal'],
        entityTypes: ['person'],
        relationTypes: []
      },
      contexts: {
        personal: {
          name: 'personal',
          entities: [
            {
              name: 'ExistingEntity',
              entityType: 'person',
              content: [createTextContent('New observation')]
            }
          ],
          relations: [],
          metadata: {
            entityCount: 1,
            relationCount: 0,
            observationCount: 1
          }
        }
      },
      checksum: ''
    };

    // Generate checksum
    const dataString = JSON.stringify(exportData, (key, value) =>
      key === 'checksum' ? undefined : value
    );
    exportData.checksum = require('crypto').createHash('sha256').update(dataString).digest('hex');

    // Test merge conflict resolution
    const mergeArgs = {
      data: exportData,
      importMode: 'merge',
      conflictResolution: 'merge',
      validateBeforeImport: true,
      dryRun: false
    };

    const mergeResult = await handleImportMemory(mergeArgs, ctx);
    expect(mergeResult.structuredContent.success).toBe(true);
    expect(mergeResult.structuredContent.summary.entitiesUpdated).toBe(1);
    expect(mergeResult.structuredContent.summary.entitiesImported).toBe(0);

    // Verify merged content
    const mergedEntity = manager.getEntity('ExistingEntity');
    expect(mergedEntity!.observations).toHaveLength(2);
    expect((mergedEntity!.observations[0] as any).text).toBe('Original observation');
    expect((mergedEntity!.observations[1] as any).text).toBe('New observation');
  });

  it('should validate import data before importing', async () => {
    const ctx = { manager, startTime: performance.now(), toolName: 'import_memory' };

    // Create invalid export data
    const invalidData = {
      version: '3.0.0',
      contexts: null, // Explicitly invalid context
    };

    const importArgs = {
      data: invalidData,
      validateBeforeImport: true,
      dryRun: false
    };

        const result = await handleImportMemory(importArgs, ctx);

    expect(result.structuredContent.success).toBe(false);
    expect(result.structuredContent.error).toBe('Invalid import data');
    expect(result.structuredContent.validationErrors).toBeDefined();
  });

  it('should support compressed export format', async () => {
    const ctx = { manager, startTime: performance.now(), toolName: 'export_memory' };

    // Create test data
    manager.createEntities([
      {
        name: 'CompressedEntity',
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

  it('should handle dry run imports', async () => {
    const ctx = { manager, startTime: performance.now(), toolName: 'import_memory' };

    // Create export data
    const exportData: MemoryExport = {
      version: '3.0.0',
      exportDate: new Date().toISOString(),
      sourceServer: 'mem100x',
      sourceVersion: '3.0.0',
      metadata: {
        totalEntities: 1,
        totalRelations: 0,
        totalObservations: 1,
        contexts: ['personal'],
        entityTypes: ['test'],
        relationTypes: []
      },
      contexts: {
        personal: {
          name: 'personal',
          entities: [
            {
              name: 'DryRunEntity',
              entityType: 'test',
              content: [createTextContent('Dry run test')]
            }
          ],
          relations: [],
          metadata: {
            entityCount: 1,
            relationCount: 0,
            observationCount: 1
          }
        }
      },
      checksum: ''
    };

    // Generate checksum
    const dataString = JSON.stringify(exportData, (key, value) =>
      key === 'checksum' ? undefined : value
    );
    exportData.checksum = require('crypto').createHash('sha256').update(dataString).digest('hex');

    // Test dry run
    const dryRunArgs = {
      data: exportData,
      dryRun: true
    };

        const result = await handleImportMemory(dryRunArgs, ctx);

    expect(result.structuredContent.success).toBe(true);
    expect(result.structuredContent.summary.entitiesImported).toBe(0); // No actual import
    expect(result.structuredContent.summary.relationsImported).toBe(0);

    // Verify no data was actually imported
    const entity = manager.getEntity('DryRunEntity');
    expect(entity).toBeNull();
  });
});
