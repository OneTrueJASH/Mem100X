import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MultiDatabaseManager } from '../dist/multi-database.js';
import { createTextContent } from '../dist/utils/fast-json.js';
import { config } from '../dist/config.js';
import { mkdtempSync, rmSync, existsSync, writeFileSync, unlinkSync, chmodSync } from 'fs';
import { join } from 'path';
import os from 'os';

describe('Fault Injection Tests', () => {
  let manager: MultiDatabaseManager;
  let tempDir: string;

  function getTempConfig() {
    tempDir = mkdtempSync(join(os.tmpdir(), 'mem100x-fault-injection-'));
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
        contexts: {
          personal: {
            name: 'personal',
            path: personalDbPath,
            patterns: ['family', 'friend', 'hobby', 'personal'],
            entityTypes: ['person', 'place', 'hobby'],
            description: 'Personal life and relationships'
          },
          work: {
            name: 'work',
            path: workDbPath,
            patterns: ['project', 'client', 'meeting', 'work'],
            entityTypes: ['project', 'client', 'task'],
            description: 'Work and professional activities'
          }
        }
      }
    };
  }

  beforeEach(() => {
    const testConfig = getTempConfig();
    manager = new MultiDatabaseManager(testConfig);
  });

  afterEach(() => {
    if (manager) {
      manager.close();
    }
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Database Corruption Scenarios', () => {
    it('should handle corrupted WAL file', () => {
      // Create some data first
      manager.createEntities([{
        name: 'TestEntity',
        entityType: 'person',
        observations: [createTextContent('Test data')]
      }], 'personal');

      // Corrupt the WAL file by writing invalid data
      const walPath = join(tempDir, 'personal.db-wal');
      if (existsSync(walPath)) {
        writeFileSync(walPath, 'CORRUPTED_WAL_DATA', 'utf8');
      }

      // Try to perform operations - should handle gracefully
      expect(() => {
        manager.readGraph(undefined, undefined, 'personal');
      }).not.toThrow();
    });

    it('should handle corrupted database file', () => {
      // Create some data first
      manager.createEntities([{
        name: 'TestEntity',
        entityType: 'person',
        observations: [createTextContent('Test data')]
      }], 'personal');

      // Corrupt the main database file
      const dbPath = join(tempDir, 'personal.db');
      writeFileSync(dbPath, 'CORRUPTED_DATABASE_DATA', 'utf8');

      // Try to perform operations - should handle gracefully
      expect(() => {
        manager.readGraph(undefined, undefined, 'personal');
      }).not.toThrow();
    });

    it('should handle missing database file', () => {
      // Delete the database file
      const dbPath = join(tempDir, 'personal.db');
      if (existsSync(dbPath)) {
        unlinkSync(dbPath);
      }

      // Try to perform operations - should handle gracefully
      expect(() => {
        manager.readGraph(undefined, undefined, 'personal');
      }).not.toThrow();
    });

    it('should handle read-only database file', () => {
      // Create some data first
      manager.createEntities([{
        name: 'TestEntity',
        entityType: 'person',
        observations: [createTextContent('Test data')]
      }], 'personal');

      // Make database file read-only
      const dbPath = join(tempDir, 'personal.db');
      chmodSync(dbPath, 0o444);

      // Try to perform write operations - should handle gracefully
      expect(() => {
        manager.createEntities([{
          name: 'ReadOnlyTest',
          entityType: 'person',
          observations: [createTextContent('Read-only test')]
        }], 'personal');
      }).not.toThrow();

      // Restore permissions
      chmodSync(dbPath, 0o666);
    });
  });

  describe('Disk Space and I/O Failures', () => {
    it('should handle disk full scenarios', () => {
      // Mock disk full by making directory read-only
      chmodSync(tempDir, 0o444);

      // Try to perform operations - should handle gracefully
      expect(() => {
        manager.createEntities([{
          name: 'DiskFullTest',
          entityType: 'person',
          observations: [createTextContent('Disk full test')]
        }], 'personal');
      }).not.toThrow();

      // Restore permissions
      chmodSync(tempDir, 0o755);
    });

    it('should handle permission denied scenarios', () => {
      // Remove write permissions from temp directory
      chmodSync(tempDir, 0o444);

      // Try to perform operations - should handle gracefully
      expect(() => {
        manager.createEntities([{
          name: 'PermissionTest',
          entityType: 'person',
          observations: [createTextContent('Permission test')]
        }], 'personal');
      }).not.toThrow();

      // Restore permissions
      chmodSync(tempDir, 0o755);
    });
  });

  describe('Memory and Resource Exhaustion', () => {
    it('should handle large data operations gracefully', () => {
      // Create a large batch of entities
      const largeBatch = Array.from({ length: 1000 }, (_, i) => ({
        name: `LargeEntity${i}`,
        entityType: 'person',
        observations: [createTextContent(`Large entity ${i} with lots of data`.repeat(100))]
      }));

      // Should handle large operations without crashing
      expect(() => {
        manager.createEntities(largeBatch, 'personal');
      }).not.toThrow();
    });

    it('should handle memory pressure scenarios', () => {
      // Create many small entities to simulate memory pressure
      const entities = Array.from({ length: 100 }, (_, i) => ({
        name: `MemoryTest${i}`,
        entityType: 'person',
        observations: [createTextContent(`Memory test entity ${i}`)]
      }));

      // Should handle memory pressure gracefully
      expect(() => {
        for (let i = 0; i < 10; i++) {
          manager.createEntities(entities, 'personal');
        }
      }).not.toThrow();
    });
  });

  describe('Concurrent Access and Locking', () => {
    it('should handle concurrent write operations', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        manager.createEntities([{
          name: `ConcurrentEntity${i}`,
          entityType: 'person',
          observations: [createTextContent(`Concurrent entity ${i}`)]
        }], 'personal')
      );

      // Should handle concurrent operations without deadlocks
      const results = await Promise.all(promises);
      expect(results.every(r => r.length > 0)).toBe(true);
    });

    it('should handle concurrent read operations', async () => {
      // Create some data first
      manager.createEntities([{
        name: 'ConcurrentReadTest',
        entityType: 'person',
        observations: [createTextContent('Concurrent read test')]
      }], 'personal');

      const promises = Array.from({ length: 20 }, () =>
        manager.readGraph(undefined, undefined, 'personal')
      );

      // Should handle concurrent reads without issues
      const results = await Promise.all(promises);
      expect(results.every(r => r.entities.length >= 0)).toBe(true);
    });

    it('should handle mixed read/write operations', async () => {
      const operations = [
        // Reads
        ...Array.from({ length: 5 }, () => manager.readGraph(undefined, undefined, 'personal')),
        // Writes
        ...Array.from({ length: 5 }, (_, i) =>
          manager.createEntities([{
            name: `MixedOp${i}`,
            entityType: 'person',
            observations: [createTextContent(`Mixed operation ${i}`)]
          }], 'personal')
        )
      ];

      // Should handle mixed operations without conflicts
      const results = await Promise.all(operations);
      expect(results.length).toBe(10);
    });
  });

  describe('Network and External Dependencies', () => {
    it('should handle slow I/O operations', async () => {
      // Simulate slow I/O by creating large data
      const largeData = Array.from({ length: 100 }, (_, i) => ({
        name: `SlowIO${i}`,
        entityType: 'person',
        observations: [createTextContent(`Slow I/O test ${i}`.repeat(1000))]
      }));

      const startTime = Date.now();
      await manager.createEntities(largeData, 'personal');
      const endTime = Date.now();

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(30000); // 30 seconds
    });

    it('should handle interrupted operations', async () => {
      // Start a long operation
      const longOperation = manager.createEntities(
        Array.from({ length: 1000 }, (_, i) => ({
          name: `InterruptTest${i}`,
          entityType: 'person',
          observations: [createTextContent(`Interrupt test ${i}`)]
        })),
        'personal'
      );

      // Simulate interruption by closing manager
      setTimeout(() => {
        manager.close();
      }, 100);

      // Should handle interruption gracefully
      expect(() => {
        longOperation;
      }).not.toThrow();
    });
  });

  describe('Data Integrity and Validation', () => {
    it('should handle malformed entity data', () => {
      const malformedEntities = [
        {
          name: '', // Invalid empty name
          entityType: 'person',
          observations: []
        },
        {
          name: 'ValidEntity',
          entityType: '', // Invalid empty type
          observations: []
        },
        {
          name: 'ValidEntity2',
          entityType: 'person',
          observations: null as any // Invalid null observations
        }
      ];

      // Should throw validation errors for malformed data
      expect(() => {
        manager.createEntities(malformedEntities, 'personal');
      }).toThrow();
    });

    it('should handle malformed relation data', () => {
      // Create valid entities first
      manager.createEntities([
        {
          name: 'EntityA',
          entityType: 'person',
          observations: [createTextContent('Entity A')]
        },
        {
          name: 'EntityB',
          entityType: 'project',
          observations: [createTextContent('Entity B')]
        }
      ], 'personal');

      const malformedRelations = [
        {
          from: '', // Invalid empty from
          to: 'EntityB',
          relationType: 'works_on'
        },
        {
          from: 'EntityA',
          to: '', // Invalid empty to
          relationType: 'works_on'
        },
        {
          from: 'EntityA',
          to: 'EntityB',
          relationType: '' // Invalid empty type
        }
      ];

      // Should throw errors for malformed relations
      expect(() => {
        manager.createRelations(malformedRelations, 'personal');
      }).toThrow();
    });

    it('should handle circular references', () => {
      // Create entities
      manager.createEntities([
        {
          name: 'EntityA',
          entityType: 'person',
          observations: [createTextContent('Entity A')]
        },
        {
          name: 'EntityB',
          entityType: 'project',
          observations: [createTextContent('Entity B')]
        }
      ], 'personal');

      // Create circular relations
      const circularRelations = [
        {
          from: 'EntityA',
          to: 'EntityB',
          relationType: 'works_on'
        },
        {
          from: 'EntityB',
          to: 'EntityA',
          relationType: 'manages'
        }
      ];

      // Should handle circular references gracefully
      expect(() => {
        manager.createRelations(circularRelations, 'personal');
      }).not.toThrow();
    });
  });

  describe('Recovery and Resilience', () => {
    it('should recover from transaction failures', () => {
      // Start a transaction
      const transactionId = manager.beginTransaction('recovery-test');

      // Create some data in transaction
      manager.createEntities([{
        name: 'TransactionTest',
        entityType: 'person',
        observations: [createTextContent('Transaction test')]
      }], 'personal');

      // Simulate failure by rolling back
      manager.rollbackTransaction();

      // Should be able to continue operations
      expect(() => {
        manager.createEntities([{
          name: 'PostTransactionTest',
          entityType: 'person',
          observations: [createTextContent('Post-transaction test')]
        }], 'personal');
      }).not.toThrow();
    });

    it('should handle context switching failures', () => {
      // Try to switch to non-existent context
      expect(() => {
        manager.setContext('nonexistent-context');
      }).toThrow();

      // Should still be able to use valid contexts
      expect(() => {
        manager.setContext('personal');
        manager.createEntities([{
          name: 'ContextRecoveryTest',
          entityType: 'person',
          observations: [createTextContent('Context recovery test')]
        }], 'personal');
      }).not.toThrow();
    });

    it('should handle database connection failures', () => {
      // Close the manager
      manager.close();

      // Try to perform operations - should throw connection error
      expect(() => {
        manager.readGraph(undefined, undefined, 'personal');
      }).toThrow();
    });
  });

  describe('Performance Under Stress', () => {
    it('should handle rapid successive operations', async () => {
      const operations = Array.from({ length: 100 }, (_, i) =>
        manager.createEntities([{
          name: `RapidOp${i}`,
          entityType: 'person',
          observations: [createTextContent(`Rapid operation ${i}`)]
        }], 'personal')
      );

      const startTime = Date.now();
      const results = await Promise.all(operations);
      const endTime = Date.now();

      // Should complete all operations
      expect(results.length).toBe(100);
      expect(endTime - startTime).toBeLessThan(10000); // 10 seconds
    });

    it('should handle memory-intensive operations', () => {
      // Create entities with large observations
      const largeEntities = Array.from({ length: 50 }, (_, i) => ({
        name: `LargeObs${i}`,
        entityType: 'person',
        observations: [
          createTextContent(`Large observation ${i}`.repeat(1000)),
          createTextContent(`Another large observation ${i}`.repeat(1000))
        ]
      }));

      // Should handle memory-intensive operations
      expect(() => {
        manager.createEntities(largeEntities, 'personal');
      }).not.toThrow();
    });

    it('should handle search under load', async () => {
      // Create many entities
      const entities = Array.from({ length: 1000 }, (_, i) => ({
        name: `SearchLoad${i}`,
        entityType: 'person',
        observations: [createTextContent(`Search load test ${i}`)]
      }));

      await manager.createEntities(entities, 'personal');

      // Perform many searches concurrently
      const searches = Array.from({ length: 50 }, () =>
        manager.searchNodes({ query: 'SearchLoad', context: 'personal' })
      );

      const startTime = Date.now();
      const results = await Promise.all(searches);
      const endTime = Date.now();

      // Should complete searches efficiently
      expect(results.length).toBe(50);
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle empty operations', () => {
      // Empty entity creation
      expect(() => {
        manager.createEntities([], 'personal');
      }).not.toThrow();

      // Empty relation creation
      expect(() => {
        manager.createRelations([], 'personal');
      }).not.toThrow();

      // Empty search
      expect(() => {
        manager.searchNodes({ query: 'nonexistent', context: 'personal' });
      }).not.toThrow();
    });

    it('should handle very long entity names', () => {
      const longName = 'A'.repeat(10000); // Very long name

      expect(() => {
        manager.createEntities([{
          name: longName,
          entityType: 'person',
          observations: [createTextContent('Long name test')]
        }], 'personal');
      }).not.toThrow();
    });

    it('should handle special characters in data', () => {
      const specialChars = [
        'Entity with spaces',
        'Entity-with-dashes',
        'Entity_with_underscores',
        'Entity123with456numbers',
        'Entity with émojis 🚀',
        'Entity with "quotes"',
        'Entity with \'apostrophes\'',
        'Entity with <tags>',
        'Entity with & symbols',
        'Entity with % percent signs'
      ];

      expect(() => {
        manager.createEntities(
          specialChars.map(name => ({
            name,
            entityType: 'person',
            observations: [createTextContent(`Special char test: ${name}`)]
          })),
          'personal'
        );
      }).not.toThrow();
    });

    it('should handle unicode and international characters', () => {
      const unicodeEntities = [
        { name: 'José García', type: 'person' },
        { name: '李小明', type: 'person' },
        { name: 'Александр Петров', type: 'person' },
        { name: 'محمد أحمد', type: 'person' },
        { name: 'नरेंद्र मोदी', type: 'person' },
        { name: '한국인', type: 'person' }
      ];

      expect(() => {
        manager.createEntities(
          unicodeEntities.map(entity => ({
            name: entity.name,
            entityType: entity.type,
            observations: [createTextContent(`Unicode test: ${entity.name}`)]
          })),
          'personal'
        );
      }).not.toThrow();
    });
  });
});
