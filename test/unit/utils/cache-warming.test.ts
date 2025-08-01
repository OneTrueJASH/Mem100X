import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryDatabase } from '../../../dist/database.js';
import { CacheWarmer } from '../../../dist/utils/cache-warming.js';
import { createStringCache } from '../../../dist/utils/cache-interface.js';
import { config } from '../../../dist/config.js';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import os from 'os';

describe('Cache Warming', () => {
  let db: MemoryDatabase;
  let cacheWarmer: CacheWarmer;
  let entityCache: any;
  let searchCache: any;
  let tempDir: string;

  beforeEach(async () => {
    // Create temporary directory for test database
    tempDir = mkdtempSync(join(os.tmpdir(), 'mem100x-cache-test-'));
    const dbPath = join(tempDir, 'test-cache-warming.db');

    // Create test database
    db = new MemoryDatabase(dbPath);

    // Create test caches
    entityCache = createStringCache('lru', 100);
    searchCache = createStringCache('lru', 50);

    // Create cache warmer
    cacheWarmer = new CacheWarmer(entityCache, searchCache, db, {
      enabled: true,
      maxEntitiesToWarm: 10,
      maxSearchesToWarm: 5,
      warmingQueries: ['test', 'entity', 'search']
    });

    // Add some test data
    await db.createEntities([
      {
        name: 'Test Entity 1',
        entityType: 'test',
        observations: [{ type: 'text', text: 'This is a test entity' }]
      },
      {
        name: 'Test Entity 2',
        entityType: 'test',
        observations: [{ type: 'text', text: 'This is another test entity' }]
      }
    ]);
  });

  afterEach(async () => {
    await db.close();
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should warm caches successfully', async () => {
    const result = await cacheWarmer.warmCaches();

    expect(result.success).toBe(true);
    expect(result.entitiesWarmed).toBeGreaterThanOrEqual(0);
    expect(result.searchesWarmed).toBeGreaterThanOrEqual(0);
    expect(result.warmingTime).toBeGreaterThan(0);
    expect(result.cacheHitRate).toBeGreaterThanOrEqual(0);
  });

  it('should respect configuration settings', () => {
    const config = cacheWarmer.getConfig();

    expect(config.enabled).toBe(true);
    expect(config.maxEntitiesToWarm).toBe(10);
    expect(config.maxSearchesToWarm).toBe(5);
    expect(config.warmingQueries).toContain('test');
    expect(config.warmingQueries).toContain('entity');
    expect(config.warmingQueries).toContain('search');
  });

  it('should update configuration', () => {
    cacheWarmer.updateConfig({
      maxEntitiesToWarm: 20,
      warmingQueries: ['new', 'query']
    });

    const config = cacheWarmer.getConfig();
    expect(config.maxEntitiesToWarm).toBe(20);
    expect(config.warmingQueries).toContain('new');
    expect(config.warmingQueries).toContain('query');
  });

  it('should handle disabled cache warming', async () => {
    cacheWarmer.updateConfig({ enabled: false });

    const result = await cacheWarmer.warmCaches();

    expect(result.success).toBe(true);
    expect(result.entitiesWarmed).toBe(0);
    expect(result.searchesWarmed).toBe(0);
    expect(result.warmingTime).toBe(0);
  });
});
