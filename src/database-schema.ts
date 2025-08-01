/**
 * Database schema definitions for Mem100x
 * Single source of truth for all database table definitions and indexes
 */

import { config } from './config.js';

export const PRAGMAS = `
  PRAGMA journal_mode = DELETE;
  PRAGMA synchronous = NORMAL;
  PRAGMA cache_size = -${config.database.cacheSizeMb * 256};
  PRAGMA temp_store = MEMORY;
  PRAGMA mmap_size = ${config.database.mmapSizeMb * 1024 * 1024};
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 10000;
  PRAGMA wal_autocheckpoint = 2000;
  PRAGMA wal_checkpoint(PASSIVE);
  PRAGMA page_size = 8192;
  PRAGMA wal_checkpoint(TRUNCATE);
  PRAGMA optimize;
`;

export const TABLES = `
  -- Entities table with full-text search support and memory aging
  CREATE TABLE IF NOT EXISTS entities (
    name TEXT PRIMARY KEY COLLATE NOCASE,
    entity_type TEXT NOT NULL,
    observations TEXT NOT NULL,
    created_at REAL DEFAULT (julianday('now')),
    updated_at REAL DEFAULT (julianday('now')),
    -- Memory aging fields
    access_count INTEGER DEFAULT 0,
    last_accessed REAL DEFAULT (julianday('now')),
    prominence_score REAL DEFAULT 1.0,
    decay_rate REAL DEFAULT 0.1,
    importance_weight REAL DEFAULT 1.0
  );

  -- Relations table with efficient indexing
  CREATE TABLE IF NOT EXISTS relations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_entity TEXT NOT NULL COLLATE NOCASE,
    to_entity TEXT NOT NULL COLLATE NOCASE,
    relation_type TEXT NOT NULL,
    created_at REAL DEFAULT (julianday('now')),
    -- Memory aging fields for relations
    access_count INTEGER DEFAULT 0,
    last_accessed REAL DEFAULT (julianday('now')),
    prominence_score REAL DEFAULT 1.0,
    UNIQUE(from_entity, to_entity, relation_type),
    FOREIGN KEY (from_entity) REFERENCES entities(name) ON DELETE CASCADE,
    FOREIGN KEY (to_entity) REFERENCES entities(name) ON DELETE CASCADE
  );

  -- Memory aging configuration table
  CREATE TABLE IF NOT EXISTS memory_aging_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at REAL DEFAULT (julianday('now'))
  );
`;

export const INDEXES = `
  -- Entity indexes for fast lookups
  CREATE INDEX IF NOT EXISTS idx_entity_type ON entities(entity_type);
  CREATE INDEX IF NOT EXISTS idx_entity_updated ON entities(updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_observations ON entities(observations);

  -- Memory aging indexes
  CREATE INDEX IF NOT EXISTS idx_entity_prominence ON entities(prominence_score DESC);
  CREATE INDEX IF NOT EXISTS idx_entity_last_accessed ON entities(last_accessed DESC);
  CREATE INDEX IF NOT EXISTS idx_entity_access_count ON entities(access_count DESC);
  CREATE INDEX IF NOT EXISTS idx_entity_aging_composite ON entities(prominence_score DESC, last_accessed DESC);

  -- Relation indexes for efficient queries
  CREATE INDEX IF NOT EXISTS idx_from_entity ON relations(from_entity);
  CREATE INDEX IF NOT EXISTS idx_to_entity ON relations(to_entity);
  CREATE INDEX IF NOT EXISTS idx_relation_type ON relations(relation_type);
  CREATE INDEX IF NOT EXISTS idx_relation_composite ON relations(from_entity, to_entity);

  -- Memory aging indexes for relations
  CREATE INDEX IF NOT EXISTS idx_relation_prominence ON relations(prominence_score DESC);
  CREATE INDEX IF NOT EXISTS idx_relation_last_accessed ON relations(last_accessed DESC);
`;

// Enhanced FTS configurations for different use cases
export const FTS_CONFIGURATIONS = {
  // Default configuration - porter unicode61 tokenizer for best performance and search relevance
  DEFAULT: {
    tokenize: 'porter unicode61',
    prefix: '2,3,4',
    content: 'entities',
    content_rowid: 'rowid'
  },

  // Performance-optimized configuration (porter unicode61 with enhanced prefix)
  PERFORMANCE: {
    tokenize: 'porter unicode61',
    prefix: '1,2,3,4,5',
    content: 'entities',
    content_rowid: 'rowid'
  },

  // Feature-rich configuration with stemming and diacritics removal
  FEATURE_RICH: {
    tokenize: 'porter unicode61 remove_diacritics 2',
    prefix: '2,3,4',
    content: 'entities',
    content_rowid: 'rowid'
  },

  // Legacy unicode61 configuration (for backward compatibility)
  LEGACY: {
    tokenize: 'unicode61 remove_diacritics 2',
    prefix: '2,3,4',
    content: 'entities',
    content_rowid: 'rowid'
  },

  // Minimal configuration for simple searches
  MINIMAL: {
    tokenize: 'porter unicode61',
    prefix: '2,3',
    content: 'entities',
    content_rowid: 'rowid'
  }
};

export const FTS_SCHEMA = `
  -- Create FTS5 virtual table for full-text search with porter unicode61 tokenizer (best performance)
  CREATE VIRTUAL TABLE IF NOT EXISTS entities_fts USING fts5(
    name,
    entity_type,
    observations,
    tokenize='porter unicode61',
    prefix='2,3,4',
    content='entities',
    content_rowid='rowid'
  );

  -- Create auxiliary functions for ranking and highlighting
  -- Note: fts5vocab tables are created automatically by SQLite, no need to create manually
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

// export const FTS_REBUILD = `
//   -- Rebuild FTS index from existing data
//   INSERT INTO entities_fts(name, entity_type, observations)
//   SELECT name, entity_type, observations FROM entities;
// `;

// // Additional FTS optimization queries
// export const FTS_OPTIMIZATION = `
//   -- Optimize FTS index
//   INSERT INTO entities_fts(entities_fts) VALUES('optimize');
// 
//   -- Merge FTS segments for better performance
//   INSERT INTO entities_fts(entities_fts) VALUES('merge');
// 
//   -- Rebuild FTS index completely
//   INSERT INTO entities_fts(entities_fts) VALUES('rebuild');
// `;

// // FTS statistics and analysis queries
// export const FTS_STATS = `
//   -- Get FTS table statistics
//   SELECT
//     'entities_fts' as table_name,
//     COUNT(*) as total_rows,
//     (SELECT COUNT(*) FROM entities_fts WHERE entities_fts MATCH '*') as indexed_terms
//   FROM entities_fts;
// 
//   -- Get vocabulary statistics
//   SELECT
//     term,
//     doc,
//     cnt
//   FROM entities_fts_vocab
//   ORDER BY cnt DESC
//   LIMIT 100;
// `;

/**
 * Get complete schema creation SQL
 */
export function getCompleteSchema(): string {
  return [TABLES, INDEXES, FTS_SCHEMA, FTS_TRIGGERS].join('\n');
}

/**
 * Get complete schema with custom FTS configuration
 */
export function getCompleteSchemaWithFTS(ftsConfigName: keyof typeof FTS_CONFIGURATIONS = 'DEFAULT'): string {
  // const customFTS = createFTSSchema(ftsConfigName);
  return [TABLES, INDEXES].join('\n');
}

/**
 * Get pragmas as individual statements for execution
 */
export function getPragmas(): string[] {
  return PRAGMAS.split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('PRAGMA'))
    .map((line) => line.replace(/;$/, ''));
}
