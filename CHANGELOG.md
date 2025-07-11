# Changelog

All notable changes to this project will be documented in this file.

## [2.0.0] - 2025-01-10

- **Breaking Changes**
  - Multi-context server is now the default (`mem100x` command)
  - Single-context server moved to `mem100x-single` command

- **Changed**
  - Default binary `mem100x` now runs multi-context server
  - Single database server available as separate `mem100x-single` binary
  - Updated all documentation to reflect multi-context as primary mode

[2.0.0]: https://github.com/OneTrueJASH/Mem100X/releases/tag/v2.0.0

## [1.0.0] - 2025-01-10

### Initial Release

- **Core Features**
  - High-performance SQLite database with better-sqlite3
  - All 11 MCP tools implemented and optimized
  - Multi-context support (personal/work separation)
  - Intelligent context detection with ML-like scoring

- **Performance**
  - 66,821 entities/second creation rate (22x faster than alternatives)
  - 8,829 searches/second with FTS5 (88x faster)
  - 261,455 relations/second creation rate
  - Sub-millisecond response times for all operations

- **Advanced Features**
  - O(1) LRU cache implementation
  - Persistent Bloom filter with xxhash
  - Automatic compression for large observations
  - Transaction support for atomic operations
  - Backup/restore functionality

- **Production Ready**
  - TypeScript with strict mode
  - Comprehensive error handling
  - Graceful shutdown support
  - GitHub Actions CI/CD

[1.0.0]: https://github.com/OneTrueJASH/Mem100X/releases/tag/v1.0.0
