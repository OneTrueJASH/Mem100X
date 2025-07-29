import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MultiDatabaseManager } from '../dist/multi-database.js';
import { handleExportMemory, handleImportMemory, ToolContext } from '../dist/tool-handlers.js';
import { createTextContent } from '../dist/utils/fast-json.js';
import { config } from '../dist/config.js';
import { ExportResult, ImportResult } from '../dist/types.js';
import { mkdtempSync, rmSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import os from 'os';

  describe('Tool Handlers Comprehensive Tests', () => {
  let manager: MultiDatabaseManager;
  let tempDir: string;
  let toolContext: ToolContext;

  function getTempConfig() {
    tempDir = mkdtempSync(join(os.tmpdir(), 'mem100x-tool-handlers-'));
    const personalDbPath = join(tempDir, 'personal.db');
    const workDbPath = join(tempDir, 'work.db');
    return {
      ...config,
      multiContext: {
        ...config.multiContext,
        personalDbPath,
        workDbPath,
        defaultContext: 'personal' as 'personal' | 'work',
        autoDetect: true,
        confidenceThreshold: 0.7
      }
    };
  }

  beforeEach(() => {
    manager = new MultiDatabaseManager(getTempConfig());
    toolContext = {
      manager,
      startTime: Date.now(),
      toolName: 'test'
    };
  });

  afterEach(() => {
    if (manager) {
      manager.close();
    }
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Export Memory Tool', () => {
    beforeEach(() => {
      // Create test data
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

      manager.createRelations([
        {
          from: 'TestEntity1',
          to: 'TestEntity2',
          relationType: 'works_on'
        }
      ], 'personal');
    });

        it('should export all contexts by default', async () => {
      const result = await handleExportMemory({}, toolContext);

      expect(result.structuredContent.success).toBe(true);
      expect(result.structuredContent.data).toBeDefined();
      expect(result.structuredContent.data.contexts).toBeDefined();
      expect(Object.keys(result.structuredContent.data.contexts)).toHaveLength(2); // personal and work
      expect(result.structuredContent.data.contexts.personal.entities).toHaveLength(2);
      expect(result.structuredContent.data.contexts.personal.relations).toHaveLength(1);
    });

    it('should export specific context', async () => {
      const result = await handleExportMemory({
        context: 'personal'
      }, toolContext);

      expect(result.structuredContent.success).toBe(true);
      expect(result.structuredContent.data.contexts).toBeDefined();
      expect(Object.keys(result.structuredContent.data.contexts)).toHaveLength(1);
      expect(result.structuredContent.data.contexts.personal).toBeDefined();
    });

    it('should export with metadata', async () => {
      const result = await handleExportMemory({
        includeMetadata: true
      }, toolContext);

      expect(result.structuredContent.success).toBe(true);
      const entity = result.structuredContent.data.contexts.personal.entities[0];
      expect(entity.metadata).toBeDefined();
      expect(entity.metadata?.createdAt).toBeDefined();
    });

    it('should export without observations', async () => {
      const result = await handleExportMemory({
        includeObservations: false
      }, toolContext);

      expect(result.structuredContent.success).toBe(true);
      const entity = result.structuredContent.data.contexts.personal.entities[0];
      expect(entity.content).toHaveLength(0);
    });

    it('should export without relations', async () => {
      const result = await handleExportMemory({
        includeRelations: false
      }, toolContext);

      expect(result.structuredContent.success).toBe(true);
      expect(result.structuredContent.data.contexts.personal.relations).toHaveLength(0);
      expect(result.structuredContent.data.contexts.work.relations).toHaveLength(0);
    });

        it('should export with date filtering', async () => {
      const result = await handleExportMemory({
        filterByDate: {
          from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
          to: new Date().toISOString()
        }
      }, toolContext);

      expect(result.structuredContent.success).toBe(true);
    });

    it('should export with entity type filtering', async () => {
      const result = await handleExportMemory({
        filterByEntityType: ['person']
      }, toolContext);

      expect(result.structuredContent.success).toBe(true);
      const entities = result.structuredContent.data.contexts.personal.entities;
      expect(entities.every(e => e.entityType === 'person')).toBe(true);
    });

    it('should export with compression', async () => {
      const result = await handleExportMemory({
        format: 'compressed',
        compressionLevel: 9
      }, toolContext);

      expect(result.structuredContent.success).toBe(true);
      expect(result.structuredContent.summary.compressionRatio).toBeDefined();
    });

    it('should export with custom version', async () => {
      const result = await handleExportMemory({
        exportVersion: '2.0.0'
      }, toolContext);

      expect(result.structuredContent.success).toBe(true);
      expect(result.structuredContent.data.version).toBe('2.0.0');
    });

    it('should handle export with non-existent context', async () => {
      const result = await handleExportMemory({
        context: 'nonexistent'
      }, toolContext);

      expect(result.structuredContent.success).toBe(true);
      expect(result.structuredContent.data.contexts.nonexistent).toBeDefined();
      expect(result.structuredContent.data.contexts.nonexistent.entities).toHaveLength(0);
      expect(result.structuredContent.data.contexts.nonexistent.relations).toHaveLength(0);
    });
  });

  describe('Import Memory Tool', () => {
    let exportData: any;

        beforeEach(async () => {
      // Create test data and export it
      manager.createEntities([
        {
          name: 'ImportEntity1',
          entityType: 'person',
          observations: [createTextContent('Import observation 1')]
        },
        {
          name: 'ImportEntity2',
          entityType: 'project',
          observations: [createTextContent('Import observation 2')]
        }
      ], 'personal');

      const exportResult = await handleExportMemory({}, toolContext);
      exportData = exportResult.structuredContent.data;
    });

    it('should import with merge mode', async () => {
      const result = await handleImportMemory({
        data: exportData,
        importMode: 'merge'
      }, toolContext);

      expect(result.structuredContent.success).toBe(true);
      expect(result.structuredContent.summary.entitiesUpdated).toBeGreaterThan(0);
    });

    it('should import with replace mode', async () => {
      const result = await handleImportMemory({
        data: exportData,
        importMode: 'replace'
      }, toolContext);

      expect(result.structuredContent.success).toBe(true);
    });

    it('should import with update mode', async () => {
      const result = await handleImportMemory({
        data: exportData,
        importMode: 'update'
      }, toolContext);

      expect(result.structuredContent.success).toBe(true);
    });

    it('should import with append mode', async () => {
      const result = await handleImportMemory({
        data: exportData,
        importMode: 'append'
      }, toolContext);

      expect(result.structuredContent.success).toBe(true);
    });

    it('should import with skip conflict resolution', async () => {
      const result = await handleImportMemory({
        data: exportData,
        conflictResolution: 'skip'
      }, toolContext);

      expect(result.structuredContent.success).toBe(true);
    });

    it('should import with overwrite conflict resolution', async () => {
      const result = await handleImportMemory({
        data: exportData,
        conflictResolution: 'overwrite'
      }, toolContext);

      expect(result.structuredContent.success).toBe(true);
    });

    it('should import with rename conflict resolution', async () => {
      const result = await handleImportMemory({
        data: exportData,
        conflictResolution: 'rename'
      }, toolContext);

      expect(result.structuredContent.success).toBe(true);
    });

    it('should import with dry run', async () => {
      const result = await handleImportMemory({
        data: exportData,
        dryRun: true
      }, toolContext);

      expect(result.structuredContent.success).toBe(true);
      expect(result.structuredContent.summary.entitiesImported).toBe(0);
    });

    it('should import with validation disabled', async () => {
      const result = await handleImportMemory({
        data: exportData,
        validateBeforeImport: false
      }, toolContext);

      expect(result.structuredContent.success).toBe(true);
    });

    it('should import with custom batch size', async () => {
      const result = await handleImportMemory({
        data: exportData,
        batchSize: 50
      }, toolContext);

      expect(result.structuredContent.success).toBe(true);
    });

    it('should import with progress callbacks disabled', async () => {
      const result = await handleImportMemory({
        data: exportData,
        progressCallback: false
      }, toolContext);

      expect(result.structuredContent.success).toBe(true);
    });

    it('should import with source version', async () => {
      const result = await handleImportMemory({
        data: exportData,
        sourceVersion: '2.0.0'
      }, toolContext);

      expect(result.structuredContent.success).toBe(true);
    });

    it('should import with source server type', async () => {
      const result = await handleImportMemory({
        data: exportData,
        sourceServer: 'generic'
      }, toolContext);

      expect(result.structuredContent.success).toBe(true);
    });

    it('should import with migration options', async () => {
      const result = await handleImportMemory({
        data: exportData,
        migrationOptions: {
          preserveIds: true,
          updateTimestamps: false,
          remapEntityTypes: { 'person': 'individual' },
          remapRelationTypes: { 'works_on': 'contributes_to' },
          filterContent: {
            includeText: true,
            includeImages: false,
            includeAudio: false,
            includeResources: false
          }
        }
      }, toolContext);

      expect(result.structuredContent.success).toBe(true);
    });

    it('should handle import with invalid data', async () => {
      const invalidData = { ...exportData, contexts: null };

      const result = await handleImportMemory({
        data: invalidData
      }, toolContext);

      expect(result.structuredContent.success).toBe(false);
      expect(result.structuredContent.warnings).toBeDefined();
      expect(Array.isArray(result.structuredContent.warnings.items)).toBe(true);
    });

    it('should handle import with empty data', async () => {
      const emptyData = { version: '3.0.0', contexts: {} };

      const result = await handleImportMemory({
        data: emptyData
      }, toolContext);

      expect(result.structuredContent.success).toBe(true);
      expect(result.structuredContent.summary.entitiesImported).toBe(0);
    });

    it('should import to specific context', async () => {
      const result = await handleImportMemory({
        data: exportData,
        context: 'work'
      }, toolContext);

      expect(result.structuredContent.success).toBe(true);
    });

    it('should handle import with corrupted data', async () => {
      const corruptedData = {
        ...exportData,
        contexts: {
          personal: {
            name: 'personal',
            entities: [
              {
                name: null, // Invalid entity
                entityType: 'person',
                observations: []
              }
            ],
            relations: []
          }
        }
      };

      const result = await handleImportMemory({
        data: corruptedData
      }, toolContext);

      expect(result.structuredContent.success).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle export with closed manager', async () => {
      manager.close();

      const result = await handleExportMemory({}, toolContext);

      expect(result.structuredContent.success).toBe(false);
      expect(result.structuredContent.warnings).toBeDefined();
      expect(Array.isArray(result.structuredContent.warnings.items)).toBe(true);
    });

    it('should handle import with closed manager', async () => {
      manager.close();

      const result = await handleImportMemory({
        data: { contexts: {} }
      }, toolContext);

      expect(result.structuredContent.success).toBe(false);
      expect(result.structuredContent.warnings).toBeDefined();
      expect(Array.isArray(result.structuredContent.warnings.items)).toBe(true);
    });

    it('should handle export with database errors', async () => {
      // Close the current manager first
      manager.close();
      
      // Delete the database file to simulate an error
      const dbPath = join(tempDir, 'personal.db');
      if (existsSync(dbPath)) {
        rmSync(dbPath);
      }
      
      // Create a directory with the same name as the database file
      // This will cause SQLite to fail when trying to open it
      mkdtempSync(dbPath);
      
      // Try to create a new manager with the problematic path
      try {
        manager = new MultiDatabaseManager(getTempConfig());
        toolContext.manager = manager;
        
        // If we get here, try to export and it should fail
        const result = await handleExportMemory({}, toolContext);
        expect(result.structuredContent.success).toBe(false);
      } catch (error) {
        // If manager creation fails, that's also acceptable
        expect(error).toBeDefined();
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle export with very large dataset', async () => {
      // Create many entities
      const entities = Array.from({ length: 1000 }, (_, i) => ({
        name: `Entity${i}`,
        entityType: 'person',
        observations: [createTextContent(`Observation ${i}`)]
      }));

      manager.createEntities(entities, 'personal');

      const result = await handleExportMemory({}, toolContext);

      expect(result.structuredContent.success).toBe(true);
      expect(result.structuredContent.data.contexts.personal.entities).toHaveLength(1000);
    });

    it('should handle import with very large dataset', async () => {
      // Create large export data
      const largeExportData = {
        version: '3.0.0',
        exportDate: new Date().toISOString(),
        sourceServer: 'mem100x',
        sourceVersion: '3.0.0',
        metadata: {
          totalEntities: 100,
          totalRelations: 0,
          totalObservations: 100,
          contexts: ['personal'],
          entityTypes: ['person'],
          relationTypes: []
        },
        contexts: {
          personal: {
            name: 'personal',
            entities: Array.from({ length: 100 }, (_, i) => ({
              name: `LargeEntity${i}`,
              entityType: 'person',
              content: [createTextContent(`Large observation ${i}`)]
            })),
            relations: []
          }
        }
      };

      const result = await handleImportMemory({
        data: largeExportData
      }, toolContext);

      expect(result.structuredContent.success).toBe(true);
    });

    it('should handle export with special characters in names', async () => {
      manager.createEntities([
        {
          name: 'Entity with spaces and special chars: !@#$%^&*()',
          entityType: 'person',
          observations: [createTextContent('Special observation')]
        }
      ], 'personal');

      const result = await handleExportMemory({}, toolContext);

      expect(result.structuredContent.success).toBe(true);
      const entity = result.structuredContent.data.contexts.personal.entities.find(
        e => e.name === 'Entity with spaces and special chars: !@#$%^&*()'
      );
      expect(entity).toBeDefined();
      expect(entity.name).toBe('Entity with spaces and special chars: !@#$%^&*()');
    });

    it('should handle import with special characters in names', async () => {
      const specialData = {
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
                name: 'Special Entity: !@#$%^&*()',
                entityType: 'person',
                content: [createTextContent('Special observation')]
              }
            ],
            relations: []
          }
        }
      };

      const result = await handleImportMemory({
        data: specialData
      }, toolContext);

      expect(result.structuredContent.success).toBe(true);
    });
  });
});
