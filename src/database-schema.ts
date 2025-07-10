/**
 * Database schema definitions for Mem100x
 * Single source of truth for all database table definitions and indexes
 */

import { config } from './config.js';

export const PRAGMAS = `
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA cache_size = -${config.database.cacheSizeMb * 256};
  PRAGMA temp_store = MEMORY;
  PRAGMA mmap_size = ${config.database.mmapSizeMb * 1024 * 1024};
  PRAGMA foreign_keys = ON;
`;

export const TABLES = `
  -- Entities table with full-text search support
  CREATE TABLE IF NOT EXISTS entities (
    name TEXT PRIMARY KEY COLLATE NOCASE,
    entity_type TEXT NOT NULL,
    observations TEXT NOT NULL,
    created_at REAL DEFAULT (julianday('now')),
    updated_at REAL DEFAULT (julianday('now'))
  );
  
  -- Relations table with efficient indexing
  CREATE TABLE IF NOT EXISTS relations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_entity TEXT NOT NULL COLLATE NOCASE,
    to_entity TEXT NOT NULL COLLATE NOCASE,
    relation_type TEXT NOT NULL,
    created_at REAL DEFAULT (julianday('now')),
    UNIQUE(from_entity, to_entity, relation_type),
    FOREIGN KEY (from_entity) REFERENCES entities(name) ON DELETE CASCADE,
    FOREIGN KEY (to_entity) REFERENCES entities(name) ON DELETE CASCADE
  );
`;

export const INDEXES = `
  -- Entity indexes for fast lookups
  CREATE INDEX IF NOT EXISTS idx_entity_type ON entities(entity_type);
  CREATE INDEX IF NOT EXISTS idx_entity_updated ON entities(updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_observations ON entities(observations);
  
  -- Relation indexes for efficient queries
  CREATE INDEX IF NOT EXISTS idx_from_entity ON relations(from_entity);
  CREATE INDEX IF NOT EXISTS idx_to_entity ON relations(to_entity);
  CREATE INDEX IF NOT EXISTS idx_relation_type ON relations(relation_type);
  CREATE INDEX IF NOT EXISTS idx_relation_composite ON relations(from_entity, to_entity);
`;

export const FTS_SCHEMA = `
  -- Create FTS5 virtual table for full-text search
  CREATE VIRTUAL TABLE IF NOT EXISTS entities_fts USING fts5(
    name,
    entity_type,
    observations,
    tokenize='unicode61'
  );
`;

export const FTS_TRIGGERS = `
  -- Triggers to keep FTS table in sync with entities table
  CREATE TRIGGER IF NOT EXISTS entities_fts_insert AFTER INSERT ON entities
  BEGIN
    INSERT INTO entities_fts(name, entity_type, observations)
    VALUES (new.name, new.entity_type, new.observations);
  END;
  
  CREATE TRIGGER IF NOT EXISTS entities_fts_update AFTER UPDATE ON entities
  BEGIN
    DELETE FROM entities_fts WHERE name = old.name;
    INSERT INTO entities_fts(name, entity_type, observations)
    VALUES (new.name, new.entity_type, new.observations);
  END;
  
  CREATE TRIGGER IF NOT EXISTS entities_fts_delete AFTER DELETE ON entities
  BEGIN
    DELETE FROM entities_fts WHERE name = old.name;
  END;
`;

export const FTS_REBUILD = `
  -- Rebuild FTS index from existing data
  INSERT INTO entities_fts(name, entity_type, observations)
  SELECT name, entity_type, observations FROM entities;
`;

/**
 * Get complete schema creation SQL
 */
export function getCompleteSchema(): string {
  return [
    TABLES,
    INDEXES,
    FTS_SCHEMA,
    FTS_TRIGGERS,
    FTS_REBUILD
  ].join('\n');
}

/**
 * Get pragmas as individual statements for execution
 */
export function getPragmas(): string[] {
  return PRAGMAS
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('PRAGMA'))
    .map(line => line.replace(/;$/, ''));
}