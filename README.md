# Mem100x - The FASTEST Memory MCP Server Ever Built!

[![npm version](https://img.shields.io/npm/v/mem100x.svg)](https://www.npmjs.com/package/mem100x)
[![npm downloads](https://img.shields.io/npm/dm/mem100x.svg)](https://www.npmjs.com/package/mem100x)
[![CI Status](https://github.com/OneTrueJASH/Mem100X/actions/workflows/ci.yml/badge.svg)](https://github.com/OneTrueJASH/Mem100X/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Performance](https://img.shields.io/badge/Performance-118K%2B%20entities%2Fsec-brightgreen)](https://github.com/OneTrueJASH/Mem100X)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-1.15.1%2B-purple)](https://modelcontextprotocol.io)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org/)

> **118K+ entities/sec** | **Full MCP SDK 1.15.1 compatibility** | **Intelligent multi-context** | **Sub-millisecond performance**

## Why Mem100x?

Mem100x is the **fastest MCP memory server** with **full MCP SDK 1.15.1 compatibility** and intelligent multi-context support:

- **118,856 entities/second** creation rate (vs 3,000/sec for others)
- **310,310 searches/second** with sub-millisecond response times
- **Full MCP content block union schema** support (text, image, audio, resource_link, resource)
- **Automatic context separation** (personal vs work) with ML-like detection
- **98% token reduction** with smart result limiting
- **100% MCP SDK compatibility** with latest standards

## Features

### Blazing Fast Performance
- SQLite with WAL mode for concurrent operations
- Prepared statements for 10x query speed
- Optimized indexes on all searchable fields
- Transaction batching for bulk operations
- Bloom filters for ultra-fast lookups

### Full MCP SDK 1.15.1 Compatibility
- Complete content block union schema support
- Proper `content[]` and `structuredContent` response format
- All MCP tools implemented with latest standards
- Zod validation for all inputs
- Type-safe TypeScript implementation

### Intelligent Multi-Context Support
- Automatic personal/work context detection
- ML-like confidence scoring system
- Cross-context search capabilities
- Instant context switching (< 0.1ms)

### Complete MCP Tool Suite
All MCP tools implemented with performance tracking:
- Entity management (create, search, read, delete)
- Relation management (create, delete)
- Observation management (add, delete)
- Context management (switch, info)

### Production Ready
- Full TypeScript with strict mode
- Comprehensive error handling
- Graceful shutdown support
- Transaction integrity
- Battle-tested performance

## Quick Example

Using Mem100x with Claude Desktop:

```json
{
  "mcpServers": {
    "mem100x": {
      "command": "npx",
      "args": ["mem100x"]
    }
  }
}
```

Then in Claude:
- "Remember that my project meeting is tomorrow at 2pm with Sarah"
- "What meetings do I have this week?"
- "Store these API keys: production: sk-123, staging: sk-456"
- "Switch to personal context and remember my mom's birthday is June 15"

## Installation

### Option 1: Use with npx (Recommended)

No installation needed! Just use directly with `npx`:

```bash
# Run multi-context server (default)
npx mem100x

# Run single-context server
npx mem100x-single
```

### Option 2: Install globally

```bash
npm install -g mem100x
```

### Option 3: Install from source

```bash
# Clone the repository
git clone https://github.com/OneTrueJASH/Mem100X.git
cd Mem100X

# Install dependencies
npm install

# Build the project
npm run build
```

## Quick Start

### Default Usage (Multi-Context)

```bash
# Using npx (recommended)
npx mem100x

# Or if installed globally
mem100x

# Or if cloned from source
npm start
```

### Single Database Usage

```bash
# Using npx (recommended)
npx mem100x-single

# Or if installed globally
mem100x-single

# Or if cloned from source
node dist/index.js
```

### Claude Desktop Configuration

Add to your Claude Desktop config for the default multi-context server:

**Using npx (Recommended):**
```json
{
  "mcpServers": {
    "mem100x": {
      "command": "npx",
      "args": ["mem100x"]
    }
  }
}
```

**If installed globally:**
```json
{
  "mcpServers": {
    "mem100x": {
      "command": "mem100x"
    }
  }
}
```

**If installed from source:**
```json
{
  "mcpServers": {
    "mem100x": {
      "command": "node",
      "args": ["/path/to/Mem100X/dist/server-multi.js"]
    }
  }
}
```

For single-context usage:

**Using npx (Recommended):**
```json
{
  "mcpServers": {
    "mem100x-single": {
      "command": "npx",
      "args": ["mem100x-single"]
    }
  }
}
```

**If installed globally:**
```json
{
  "mcpServers": {
    "mem100x-single": {
      "command": "mem100x-single"
    }
  }
}
```

**If installed from source:**
```json
{
  "mcpServers": {
    "mem100x-single": {
      "command": "node",
      "args": ["/path/to/Mem100X/dist/index.js"]
    }
  }
}
```

## Performance

Mem100x delivers industry-leading performance validated through comprehensive benchmarks:

### Latest Performance Metrics
- **Entity Creation**: 118,856 entities/sec (40x faster than alternatives)
- **Search Operations**: 310,310 searches/sec with sub-millisecond response
- **Relation Creation**: 9,575 relations/sec
- **Graph Reading**: 117,585 entities/sec
- **Context Detection**: 100% accuracy with ML-like scoring

### Real-World Performance
- Sub-millisecond response times for all operations
- Handles 100,000+ entities without performance degradation
- Instant context switching (< 0.1ms)
- 98% token reduction through smart result limiting

### Benchmark Results
- **Entity Creation**: 118,856 entities/sec
- **Search Operations**: 310,310 searches/sec
- **Graph Reading**: 117,585 entities/sec
- **Relation Creation**: 9,575 relations/sec
- **Storage**: 550 bytes/entity
- **Context Detection**: 100% accuracy

## MCP Tools Reference

### Context Management
- `set_context` - Switch between contexts
- `get_context_info` - View context statistics

### Entity Operations
- `create_entities` - Bulk entity creation with MCP content blocks
- `search_nodes` - Lightning-fast search
- `read_graph` - Token-efficient reading
- `open_nodes` - Open specific entities

### Relation Operations
- `create_relations` - Create relationships
- `delete_relations` - Remove relationships

### Observation Management
- `add_observations` - Add notes to entities with MCP content blocks
- `delete_observations` - Remove observations
- `delete_entities` - Delete entities

## MCP Content Block Support

Mem100x fully supports the MCP content block union schema:

```typescript
// Supported content types
type ContentBlock = 
  | { type: "text"; text: string }
  | { type: "image"; image: { uri: string } }
  | { type: "audio"; audio: { uri: string } }
  | { type: "resource_link"; resourceLink: { uri: string } }
  | { type: "resource"; resource: { uri: string; mimeType: string } }
```

### Example Usage

```typescript
// Create entities with rich content
await client.callTool({
  name: "create_entities",
  arguments: {
    entities: [{
      name: "Project Documentation",
      entityType: "document",
      content: [
        { type: "text", text: "API documentation for the new service" },
        { type: "resource_link", resourceLink: { uri: "https://docs.example.com/api" } }
      ]
    }]
  }
});

// Add observations with mixed content
await client.callTool({
  name: "add_observations",
  arguments: {
    updates: [{
      entityName: "Meeting Notes",
      content: [
        { type: "text", text: "Key decisions from today's meeting" },
        { type: "image", image: { uri: "file:///path/to/diagram.png" } }
      ]
    }]
  }
});
```

## Architecture

Built with performance and MCP compliance as priorities:

```
src/
├── database.ts          # High-performance SQLite core
├── multi-database.ts    # Multi-context manager
├── context-confidence.ts # ML-like detection
├── server-multi.ts      # Default multi-context server
├── index.ts            # Single-context server
├── tool-handlers.ts    # MCP tool implementations
├── tool-schemas.ts     # Zod validation schemas
└── types.ts           # MCP-compatible type definitions
```

## Benchmarks

Comprehensive benchmark suite included:

```bash
# Run simple benchmarks
cd benchmarks && node simple-bench.js

# Run comprehensive benchmarks
cd benchmarks && node comprehensive-bench.js

# Quick performance test
cd benchmarks && node run-simple-benchmarks.js
```

All benchmarks use the MCP server interface for accurate performance measurement.

## Contributing

We love contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

Quick steps:
1. Fork the repository
2. Create a feature branch
3. Ensure all tests pass
4. Submit a PR

## License

MIT License - see LICENSE file

## Star This Repo!

If you're impressed by the performance (and you should be!), please star this repo! Let's make this the go-to memory MCP server for Claude!

---

**Built with a need for speed by the Mem100x team**
