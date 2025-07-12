#!/usr/bin/env node

const { MemoryDatabase } = require('../dist/database.js');
const path = require('path');
const fs = require('fs');
const os = require('os');

class SimpleBenchmark {
  constructor() {
    this.tempDbPath = path.join(os.tmpdir(), `mem100x-simple-bench-${Date.now()}.db`);
    this.db = null;
    this.results = [];
  }

  log(message) {
    console.log(`[${new Date().toISOString()}] ${message}`);
  }

  async setup() {
    this.log('🔧 Setting up benchmark...');
    this.log(`📁 Using temporary database: ${this.tempDbPath}`);

    const startTime = Date.now();
    this.db = new MemoryDatabase(this.tempDbPath);
    const initTime = Date.now() - startTime;

    this.log(`✅ Database initialized in ${initTime}ms`);
  }

  async cleanup() {
    this.log('�� Cleaning up...');

    if (this.db) {
      try {
        this.db.close();
        this.log('✅ Database closed');
      } catch (error) {
        this.log(`⚠️  Database close warning: ${error.message}`);
      }
    }

    // Add a small delay to ensure file handles are released
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      if (fs.existsSync(this.tempDbPath)) {
        fs.unlinkSync(this.tempDbPath);
        this.log('🗑️  Database file cleaned up');
      }

      const bloomPath = this.tempDbPath.replace('.db', '.cbloom');
      if (fs.existsSync(bloomPath)) {
        fs.unlinkSync(bloomPath);
        this.log('🗑️  Bloom filter cleaned up');
      }
    } catch (error) {
      this.log(`⚠️  Cleanup warning: ${error.message}`);
    }

    this.log('✅ Cleanup complete');
  }

  measure(name, fn) {
    const startTime = Date.now();
    const result = fn();
    const duration = Date.now() - startTime;

    this.results.push({ name, duration, result });
    this.log(`✅ ${name}: ${duration}ms`);

    return { duration, result };
  }

  async measureAsync(name, fn) {
    const startTime = Date.now();
    const result = await fn();
    const duration = Date.now() - startTime;

    this.results.push({ name, duration, result });
    this.log(`✅ ${name}: ${duration}ms`);

    return { duration, result };
  }

  async runEntityCreationBenchmark() {
    this.log('\n📝 Entity Creation Benchmark');
    this.log('============================');

    // Single entity creation
    this.measure('Single Entity Creation', () => {
      return this.db.createEntities([{
        name: 'test-entity-1',
        entityType: 'test',
        observations: [{ type: 'text', text: 'Test observation' }]
      }]);
    });

    // Batch entity creation (10 entities)
    const batchEntities = Array.from({ length: 10 }, (_, i) => ({
      name: `batch-entity-${i}`,
      entityType: 'batch',
      observations: [{ type: 'text', text: `Batch observation ${i}` }]
    }));

    this.measure('Batch Entity Creation (10)', () => {
      return this.db.createEntities(batchEntities);
    });

    // Large batch (100 entities)
    const largeBatch = Array.from({ length: 100 }, (_, i) => ({
      name: `large-batch-${i}`,
      entityType: 'large',
      observations: [{ type: 'text', text: `Large batch observation ${i}` }]
    }));

    this.measure('Large Batch Creation (100)', () => {
      return this.db.createEntities(largeBatch);
    });
  }

  async runSearchBenchmark() {
    this.log('\n🔍 Search Benchmark');
    this.log('==================');

    // Simple search
    this.measure('Simple Search', () => {
      return this.db.searchNodes({ query: 'test', limit: 10 });
    });

    // Search with more results
    this.measure('Search with Limit', () => {
      return this.db.searchNodes({ query: 'batch', limit: 50 });
    });

    // Full text search
    this.measure('Full Text Search', () => {
      return this.db.searchNodes({ query: 'observation', limit: 20 });
    });
  }

  async runGraphBenchmark() {
    this.log('\n📊 Graph Operations Benchmark');
    this.log('=============================');

    // Read graph
    this.measure('Read Graph (All)', () => {
      return this.db.readGraph();
    });

    // Read graph with limit
    this.measure('Read Graph (Limited)', () => {
      return this.db.readGraph(50);
    });

    // Get stats
    this.measure('Get Database Stats', () => {
      return this.db.getStats();
    });
  }

  async runRelationsBenchmark() {
    this.log('\n🔗 Relations Benchmark');
    this.log('=====================');

    // Create some relations
    const relations = [
      { from: 'test-entity-1', to: 'batch-entity-0', relationType: 'related_to' },
      { from: 'batch-entity-0', to: 'batch-entity-1', relationType: 'next_to' },
      { from: 'large-batch-0', to: 'large-batch-1', relationType: 'similar_to' }
    ];

    this.measure('Create Relations', () => {
      return this.db.createRelations(relations);
    });

    // Get relations for entities
    this.measure('Get Relations', () => {
      return this.db.getRelationsForEntities(['test-entity-1', 'batch-entity-0']);
    });
  }

  async runObservationsBenchmark() {
    this.log('\n📝 Observations Benchmark');
    this.log('=========================');

    // Add observations
    const observations = [
      {
        entityName: 'test-entity-1',
        contents: [
          { type: 'text', text: 'Additional observation 1' },
          { type: 'text', text: 'Additional observation 2' }
        ]
      }
    ];

    this.measure('Add Observations', () => {
      this.db.addObservations(observations);
      return { success: true };
    });
  }

  printSummary() {
    this.log('\n📊 Benchmark Summary');
    this.log('===================');

    const totalTime = this.results.reduce((sum, r) => sum + r.duration, 0);
    const avgTime = totalTime / this.results.length;

    this.log(`Total operations: ${this.results.length}`);
    this.log(`Total time: ${totalTime}ms`);
    this.log(`Average time: ${avgTime.toFixed(2)}ms`);

    this.log('\nDetailed Results:');
    this.results.forEach(result => {
      this.log(`  ${result.name}: ${result.duration}ms`);
    });
  }

  async run() {
    try {
      await this.setup();

      await this.runEntityCreationBenchmark();
      await this.runSearchBenchmark();
      await this.runGraphBenchmark();
      await this.runRelationsBenchmark();
      await this.runObservationsBenchmark();

      this.printSummary();

    } catch (error) {
      this.log(`❌ Benchmark failed: ${error.message}`);
      console.error(error.stack);
    } finally {
      await this.cleanup();
    }
  }
}

// Run the benchmark
const benchmark = new SimpleBenchmark();
benchmark.run();
