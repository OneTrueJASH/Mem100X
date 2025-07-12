#!/usr/bin/env node

const { MemoryDatabase } = require('../dist/database.js');
const path = require('path');
const fs = require('fs');
const os = require('os');

class ComprehensiveBenchmark {
  constructor() {
    this.tempDbPath = path.join(os.tmpdir(), `mem100x-comprehensive-${Date.now()}.db`);
    this.db = null;
    this.results = [];
    this.testData = {
      entities: [],
      relations: []
    };
  }

  log(message) {
    console.log(`[${new Date().toISOString()}] ${message}`);
  }

  async setup() {
    this.log('🔧 Setting up comprehensive benchmark...');
    this.log(`📁 Using temporary database: ${this.tempDbPath}`);

    const startTime = Date.now();
    this.db = new MemoryDatabase(this.tempDbPath);
    const initTime = Date.now() - startTime;

    this.log(`✅ Database initialized in ${initTime}ms`);

    // Generate test data
    this.generateTestData();
  }

  generateTestData() {
    this.log('📊 Generating test data...');

    // Generate entities for different scenarios
    this.testData.entities = [
      // Simple entities
      ...Array.from({ length: 100 }, (_, i) => ({
        name: `simple-${i}`,
        entityType: 'simple',
        observations: [{ type: 'text', text: `Simple entity ${i}` }]
      })),

      // Entities with multiple observations
      ...Array.from({ length: 50 }, (_, i) => ({
        name: `complex-${i}`,
        entityType: 'complex',
        observations: [
          { type: 'text', text: `Complex entity ${i} - primary observation` },
          { type: 'text', text: `Complex entity ${i} - secondary observation` },
          { type: 'text', text: `Complex entity ${i} - tertiary observation` }
        ]
      })),

      // Entities with different types
      ...Array.from({ length: 25 }, (_, i) => ({
        name: `person-${i}`,
        entityType: 'person',
        observations: [{ type: 'text', text: `Person ${i} - age ${20 + i}, location: city-${i % 5}` }]
      })),

      ...Array.from({ length: 25 }, (_, i) => ({
        name: `city-${i}`,
        entityType: 'city',
        observations: [{ type: 'text', text: `City ${i} - population ${10000 + i * 1000}` }]
      }))
    ];

    // Generate relations
    this.testData.relations = [
      // Person to city relations
      ...Array.from({ length: 25 }, (_, i) => ({
        from: `person-${i}`,
        to: `city-${i % 5}`,
        relationType: 'lives_in'
      })),

      // Person to person relations
      ...Array.from({ length: 20 }, (_, i) => ({
        from: `person-${i}`,
        to: `person-${(i + 1) % 25}`,
        relationType: 'knows'
      }))
    ];
  }

  async cleanup() {
    this.log('🧹 Cleaning up...');

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

  async runBulkInsertBenchmark() {
    this.log('\n📝 Bulk Insert Benchmark');
    this.log('========================');

    // Insert all test entities
    this.measure('Bulk Insert All Entities', () => {
      return this.db.createEntities(this.testData.entities);
    });

    // Insert in smaller batches
    const batchSize = 25;
    const batches = [];
    for (let i = 0; i < this.testData.entities.length; i += batchSize) {
      batches.push(this.testData.entities.slice(i, i + batchSize));
    }

    this.measure(`Batched Insert (${batchSize} per batch)`, () => {
      const results = [];
      for (const batch of batches) {
        results.push(...this.db.createEntities(batch));
      }
      return results;
    });
  }

  async runSearchBenchmark() {
    this.log('\n🔍 Search Performance Benchmark');
    this.log('===============================');

    // Simple text search
    this.measure('Simple Text Search', () => {
      return this.db.searchNodes({ query: 'simple', limit: 20 });
    });

    // Entity type search
    this.measure('Entity Type Search', () => {
      return this.db.searchNodes({ query: 'person', limit: 30 });
    });

    // Complex text search
    this.measure('Complex Text Search', () => {
      return this.db.searchNodes({ query: 'observation', limit: 50 });
    });

    // Number search
    this.measure('Number Search', () => {
      return this.db.searchNodes({ query: '1000', limit: 10 });
    });

    // Multiple searches (simulating real usage)
    this.measure('Multiple Searches', () => {
      const searches = ['simple', 'person', 'city', 'complex', 'observation'];
      const results = [];
      for (const query of searches) {
        results.push(this.db.searchNodes({ query, limit: 10 }));
      }
      return results;
    });
  }

  async runRelationsBenchmark() {
    this.log('\n🔗 Relations Benchmark');
    this.log('=====================');

    // Create all relations
    this.measure('Create All Relations', () => {
      return this.db.createRelations(this.testData.relations);
    });

    // Get relations for specific entities
    this.measure('Get Relations for Person', () => {
      return this.db.getRelationsForEntities(['person-0', 'person-1', 'person-2']);
    });

    // Get relations for cities
    this.measure('Get Relations for Cities', () => {
      return this.db.getRelationsForEntities(['city-0', 'city-1']);
    });
  }

  async runGraphOperationsBenchmark() {
    this.log('\n📊 Graph Operations Benchmark');
    this.log('=============================');

    // Read entire graph
    this.measure('Read Full Graph', () => {
      return this.db.readGraph();
    });

    // Read limited graph
    this.measure('Read Limited Graph (50)', () => {
      return this.db.readGraph(50);
    });

    // Read with offset
    this.measure('Read Graph with Offset', () => {
      return this.db.readGraph(25, 25);
    });

    // Get database statistics
    this.measure('Get Database Stats', () => {
      return this.db.getStats();
    });
  }

  async runObservationsBenchmark() {
    this.log('\n📝 Observations Benchmark');
    this.log('=========================');

    // Add observations to existing entities
    const observationUpdates = [
      {
        entityName: 'simple-0',
        contents: [
          { type: 'text', text: 'Updated observation 1' },
          { type: 'text', text: 'Updated observation 2' }
        ]
      },
      {
        entityName: 'person-0',
        contents: [
          { type: 'text', text: 'New person observation' }
        ]
      }
    ];

    this.measure('Add Observations', () => {
      this.db.addObservations(observationUpdates);
      return { success: true };
    });

    // Add observations to multiple entities
    const bulkUpdates = Array.from({ length: 10 }, (_, i) => ({
      entityName: `simple-${i}`,
      contents: [{ type: 'text', text: `Bulk update observation ${i}` }]
    }));

    this.measure('Bulk Add Observations', () => {
      this.db.addObservations(bulkUpdates);
      return { success: true };
    });
  }

  async runConcurrentOperationsBenchmark() {
    this.log('\n⚡ Concurrent Operations Benchmark');
    this.log('===================================');

    // Simulate concurrent reads
    this.measure('Concurrent Reads', () => {
      const results = [];
      for (let i = 0; i < 10; i++) {
        results.push(this.db.searchNodes({ query: 'simple', limit: 5 }));
      }
      return results;
    });

    // Simulate mixed operations
    this.measure('Mixed Operations', () => {
      const results = [];
      results.push(this.db.searchNodes({ query: 'person', limit: 5 }));
      results.push(this.db.readGraph(10));
      results.push(this.db.getStats());
      results.push(this.db.searchNodes({ query: 'city', limit: 3 }));
      return results;
    });
  }

  printDetailedSummary() {
    this.log('\n📊 Comprehensive Benchmark Summary');
    this.log('===================================');

    const totalTime = this.results.reduce((sum, r) => sum + r.duration, 0);
    const avgTime = totalTime / this.results.length;
    const minTime = Math.min(...this.results.map(r => r.duration));
    const maxTime = Math.max(...this.results.map(r => r.duration));

    this.log(`Total operations: ${this.results.length}`);
    this.log(`Total time: ${totalTime}ms`);
    this.log(`Average time: ${avgTime.toFixed(2)}ms`);
    this.log(`Min time: ${minTime}ms`);
    this.log(`Max time: ${maxTime}ms`);

    // Group by operation type
    const groups = {
      'Insert': this.results.filter(r => r.name.includes('Insert')),
      'Search': this.results.filter(r => r.name.includes('Search')),
      'Relations': this.results.filter(r => r.name.includes('Relation')),
      'Graph': this.results.filter(r => r.name.includes('Graph')),
      'Observations': this.results.filter(r => r.name.includes('Observation')),
      'Concurrent': this.results.filter(r => r.name.includes('Concurrent'))
    };

    this.log('\nResults by Category:');
    Object.entries(groups).forEach(([category, ops]) => {
      if (ops.length > 0) {
        const avg = ops.reduce((sum, r) => sum + r.duration, 0) / ops.length;
        this.log(`  ${category}: ${ops.length} ops, avg ${avg.toFixed(2)}ms`);
      }
    });

    this.log('\nDetailed Results:');
    this.results.forEach(result => {
      this.log(`  ${result.name}: ${result.duration}ms`);
    });
  }

  async run() {
    try {
      await this.setup();

      await this.runBulkInsertBenchmark();
      await this.runSearchBenchmark();
      await this.runRelationsBenchmark();
      await this.runGraphOperationsBenchmark();
      await this.runObservationsBenchmark();
      await this.runConcurrentOperationsBenchmark();

      this.printDetailedSummary();

    } catch (error) {
      this.log(`❌ Benchmark failed: ${error.message}`);
      console.error(error.stack);
    } finally {
      await this.cleanup();
    }
  }
}

// Run the comprehensive benchmark
const benchmark = new ComprehensiveBenchmark();
benchmark.run();
