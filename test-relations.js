#!/usr/bin/env node

import { MemoryDatabase } from './dist/database.js';

async function testRelations() {
  console.log('Testing relation creation...');

  const db = new MemoryDatabase('./test_relations.db');

  try {
    // Create some test entities
    const entities = [
      {
        name: 'test entity 1',
        entityType: 'person',
        observations: [{ type: 'text', text: 'Test entity 1' }]
      },
      {
        name: 'test entity 2',
        entityType: 'person',
        observations: [{ type: 'text', text: 'Test entity 2' }]
      },
      {
        name: 'test entity 3',
        entityType: 'person',
        observations: [{ type: 'text', text: 'Test entity 3' }]
      }
    ];

    console.log('Creating entities...');
    const createdEntities = db.createEntities(entities);
    console.log(`Created ${createdEntities.length} entities`);

    // Create relations
    const relations = [
      { from: 'test entity 1', to: 'test entity 2', relationType: 'knows' },
      { from: 'test entity 2', to: 'test entity 3', relationType: 'works_with' },
      { from: 'test entity 1', to: 'test entity 3', relationType: 'references' }
    ];

    console.log('Creating relations...');
    const createdRelations = db.createRelationsBatch(relations);
    console.log(`Created ${createdRelations.length} relations`);

    // Check database stats
    const stats = db.getStats();
    console.log('Database stats:', stats);

    // Try to read relations
    const graph = db.readGraph();
    console.log('Graph entities:', graph.entities.length);
    console.log('Graph relations:', graph.relations.length);

  } finally {
    db.close();
  }
}

testRelations().catch(console.error);
