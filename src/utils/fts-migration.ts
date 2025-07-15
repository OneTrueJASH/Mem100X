/**
 * FTS Migration Utility
 * Migrates existing FTS tables to use Simple Tokenizer for maximum performance
 */

import Database from 'better-sqlite3';
import { logger, logInfo, logError } from './logger.js';

export interface MigrationResult {
  success: boolean;
  oldConfig?: string;
  newConfig?: string;
  migrationTime?: number;
  error?: string;
}

/**
 * Migrate FTS table to use unicode61 Tokenizer for better performance
 */
export function migrateFTSToUnicode61(dbPath: string): MigrationResult {
  const startTime = Date.now();

  try {
    logInfo('Starting FTS migration to unicode61 Tokenizer', { dbPath });

    const db = new Database(dbPath);

    // Check if FTS table exists
    const ftsExists = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='entities_fts'
    `).get();

    if (!ftsExists) {
      logInfo('FTS table does not exist, no migration needed');
      db.close();
      return { success: true };
    }

    // Get current FTS configuration
    const currentConfig = db.prepare(`
      SELECT sql FROM sqlite_master
      WHERE type='table' AND name='entities_fts'
    `).get() as { sql: string } | undefined;

    if (!currentConfig) {
      db.close();
      return { success: false, error: 'Could not determine current FTS configuration' };
    }

    const oldConfig = currentConfig.sql;
    logInfo('Current FTS configuration detected', { config: oldConfig });

    // Check if already using unicode61 Tokenizer
    if (oldConfig.includes("tokenize='unicode61 remove_diacritics 2'")) {
      logInfo('FTS already using unicode61 Tokenizer, no migration needed');
      db.close();
      return {
        success: true,
        oldConfig: 'unicode61',
        newConfig: 'unicode61',
        migrationTime: Date.now() - startTime
      };
    }

    // Begin migration
    db.exec('BEGIN TRANSACTION');

    try {
      // Create new FTS table with unicode61 Tokenizer
      db.exec(`
        CREATE VIRTUAL TABLE entities_fts_new USING fts5(
          name,
          entity_type,
          observations,
          tokenize='unicode61 remove_diacritics 2',
          prefix='2,3,4',
          content='entities',
          content_rowid='rowid'
        )
      `);

      // Copy data from old FTS table to new one
      db.exec(`
        INSERT INTO entities_fts_new(name, entity_type, observations)
        SELECT name, entity_type, observations FROM entities_fts
      `);

      // Drop old FTS table
      db.exec('DROP TABLE entities_fts');

      // Rename new table to original name
      db.exec('ALTER TABLE entities_fts_new RENAME TO entities_fts');

      // Recreate triggers
      db.exec(`
        CREATE TRIGGER IF NOT EXISTS entities_fts_insert AFTER INSERT ON entities
        BEGIN
          INSERT INTO entities_fts(name, entity_type, observations)
          VALUES (new.name, new.entity_type, new.observations);
        END
      `);

      db.exec(`
        CREATE TRIGGER IF NOT EXISTS entities_fts_update AFTER UPDATE ON entities
        BEGIN
          DELETE FROM entities_fts WHERE name = old.name;
          INSERT INTO entities_fts(name, entity_type, observations)
          VALUES (new.name, new.entity_type, new.observations);
        END
      `);

      db.exec(`
        CREATE TRIGGER IF NOT EXISTS entities_fts_delete AFTER DELETE ON entities
        BEGIN
          DELETE FROM entities_fts WHERE name = old.name;
        END
      `);

      // Optimize the new FTS table
      db.exec('INSERT INTO entities_fts(entities_fts) VALUES("optimize")');

      db.exec('COMMIT');

      const migrationTime = Date.now() - startTime;
      logInfo('FTS migration completed successfully', {
        migrationTime,
        oldConfig: 'previous',
        newConfig: 'unicode61'
      });

      return {
        success: true,
        oldConfig: 'previous',
        newConfig: 'unicode61',
        migrationTime
      };

    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    } finally {
      db.close();
    }

  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logError('FTS migration failed', errorObj, { dbPath });

    return {
      success: false,
      error: errorObj.message,
      migrationTime: Date.now() - startTime
    };
  }
}

/**
 * Check if database needs FTS migration
 */
export function needsFTSMigration(dbPath: string): boolean {
  try {
    const db = new Database(dbPath);

    // Check if FTS table exists
    const ftsExists = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='entities_fts'
    `).get();

    if (!ftsExists) {
      db.close();
      return false; // No FTS table, no migration needed
    }

    // Check current configuration
    const currentConfig = db.prepare(`
      SELECT sql FROM sqlite_master
      WHERE type='table' AND name='entities_fts'
    `).get() as { sql: string } | undefined;

    db.close();

    if (!currentConfig) {
      return false;
    }

    // Return true if not using unicode61 Tokenizer
    return !currentConfig.sql.includes("tokenize='unicode61 remove_diacritics 2'");

  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logError('Error checking FTS migration status', errorObj, { dbPath });
    return false;
  }
}

/**
 * Get FTS table statistics
 */
export function getFTSStats(dbPath: string): {
  totalRows: number;
  indexedTerms: number;
  tokenizer: string;
} | null {
  try {
    const db = new Database(dbPath);

    // Check if FTS table exists
    const ftsExists = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='entities_fts'
    `).get();

    if (!ftsExists) {
      db.close();
      return null;
    }

    // Get FTS configuration
    const config = db.prepare(`
      SELECT sql FROM sqlite_master
      WHERE type='table' AND name='entities_fts'
    `).get() as { sql: string } | undefined;

    // Extract tokenizer from config
    let tokenizer = 'unknown';
    if (config) {
      const tokenizeMatch = config.sql.match(/tokenize='([^']+)'/);
      if (tokenizeMatch) {
        tokenizer = tokenizeMatch[1];
      }
    }

        // Get statistics
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_rows
      FROM entities_fts
    `).get() as { total_rows: number } | undefined;

    db.close();

    if (!stats) {
      return null;
    }

    return {
      totalRows: stats.total_rows,
      indexedTerms: 0, // Not available in this SQLite build
      tokenizer
    };

  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logError('Error getting FTS stats', errorObj, { dbPath });
    return null;
  }
}
