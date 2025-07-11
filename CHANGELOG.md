# Changelog

All notable changes to this project will be documented in this file.

## [3.0.1](https://github.com/OneTrueJASH/Mem100X/compare/v3.0.0...v3.0.1) (2025-07-11)


### Bug Fixes

* add tag trigger to CI workflow for npm publishing ([4659b57](https://github.com/OneTrueJASH/Mem100X/commit/4659b57f53736899042c49e6272f6b4cc60ff463))

## [3.0.0](https://github.com/OneTrueJASH/Mem100X/compare/v2.0.0...v3.0.0) (2025-07-11)


### ⚠ BREAKING CHANGES

* mem100x command now runs multi-context server by default

### Features

* make multi-context server the default ([b648727](https://github.com/OneTrueJASH/Mem100X/commit/b648727be54fa614e199d60fd6c6e81913974a18))


### Bug Fixes

* configure release-please to use standard version tags ([7d245a6](https://github.com/OneTrueJASH/Mem100X/commit/7d245a684e0986510be75ff27252aef4b2b6ed35))
* correct release-please manifest JSON syntax ([a5f82fc](https://github.com/OneTrueJASH/Mem100X/commit/a5f82fcfee7a4fcc0aa7aafb6a2bafe8aa864dea))
* use PAT for release-please to fix label permissions ([052fb0d](https://github.com/OneTrueJASH/Mem100X/commit/052fb0d2c128aa87c63a65b21753df2d37627f47))


### Maintenance

* clean up repository for public release ([7542b17](https://github.com/OneTrueJASH/Mem100X/commit/7542b1719f4c4214d17257b5cb141b7b5f3db9cd))
* explicitly skip labeling in the release-please workflow ([5fb76d1](https://github.com/OneTrueJASH/Mem100X/commit/5fb76d118dbfd57cf9693052be8153bf64906866))
* release 2.0.0 ([a0dd736](https://github.com/OneTrueJASH/Mem100X/commit/a0dd736c2fb947e35af3597686baa98a93d4302d))
* **release:** 2.0.0 ([d83784f](https://github.com/OneTrueJASH/Mem100X/commit/d83784f2381ddbee6168a23ba6b0813d7f1ab57c))
* sync release-please manifest with current version ([0fbc36c](https://github.com/OneTrueJASH/Mem100X/commit/0fbc36c07e75772df0f53f8a03309fff287870b5))
* trigger release-please ([3e6debc](https://github.com/OneTrueJASH/Mem100X/commit/3e6debcb5fe02d81ea7a1893f546baf9dbec5dc1))

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
