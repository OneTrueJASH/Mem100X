# Quick Start Guide

Get up and running with the FASTEST MCP memory server in under 2 minutes!

## Installation

```bash
# Clone and install
git clone https://github.com/yourusername/mem100x.git
cd mem100x
npm install
npm run build
```

## Quick Configuration Setup

```bash
# Generate a fully populated .env file with all default values
npm run config:generate

# Or print the configuration to see all options
npm run config:print-defaults

# Validate your configuration (detects issues and provides recommendations)
npm run config:validate
```

### Configuration Validation Features

The validation tool helps you identify and fix configuration issues:

- **🔍 Unknown Variables**: Finds environment variables not used by Mem100x
- **🔄 Deprecated Variables**: Detects outdated variable names with migration guidance
- **💡 Performance Tips**: Suggests optimizations for your specific setup
- **✅ Configuration Summary**: Shows current settings and recommendations

## ⚠️ Important: Database Persistence

**By default, Mem100x uses local database files that may be ephemeral.** To ensure your data persists:

### Set Persistent Database Paths:

```bash
# For single-context usage
export DATABASE_PATH="/path/to/persistent/memory.db"

# For multi-context usage  
export MEM100X_PERSONAL_DB_PATH="/path/to/persistent/personal.db"
export MEM100X_WORK_DB_PATH="/path/to/persistent/work.db"
```

**Why this matters:** Default paths may be in temporary directories that get cleared, causing **permanent data loss**. The server will log warnings if using default paths.

## Default Usage (Multi-Context)

### 1. Start the server

```bash
npm start
```

### 2. Configure Claude Desktop

Add to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "mem100x": {
      "command": "node",
      "args": ["/absolute/path/to/mem100x/dist/server-multi.js"]
    }
  }
}
```

### 3. Test it out

Restart Claude Desktop and try:

- "Store information about my project meeting tomorrow at 2pm"
- "What do you remember about my meeting?"
- "Show me everything you remember"

## Single Database Usage

For simpler use cases without context separation:

```json
{
  "mcpServers": {
    "mem100x-single": {
      "command": "node",
      "args": ["/absolute/path/to/mem100x/dist/index.js"]
    }
  }
}
```

The server will automatically detect context from your content:

- **Personal**: family, vacation, hobbies, friends
- **Work**: projects, meetings, deadlines, colleagues

## Performance

Mem100x is blazing fast out of the box:

- **118,856 entities/second** creation rate (40x faster than alternatives)
- **310,310 searches/second** with sub-millisecond response times
- **117,585 entities/second** graph reading speed
- **Instant** context switching
- **98% token savings** with smart result limiting

## MCP SDK 1.15.1 Compatibility

Mem100x is fully compatible with the latest MCP SDK and supports all content block types:

### Supported Content Types

- **Text**: Plain text content
- **Image**: Image files with URIs
- **Audio**: Audio files with URIs
- **Resource Link**: Links to external resources
- **Resource**: Binary resources with MIME types

### Example Usage

```typescript
// Create entities with rich content
await client.callTool({
  name: 'create_entities',
  arguments: {
    entities: [
      {
        name: 'Project Documentation',
        entityType: 'document',
        content: [
          { type: 'text', text: 'API documentation for the new service' },
          { type: 'resource_link', resourceLink: { uri: 'https://docs.example.com/api' } },
        ],
      },
    ],
  },
});
```

## Available Tools

All MCP tools are ready to use with full SDK compatibility:

### Memory Operations

- `create_entities` - Store new information with MCP content blocks
- `search_nodes` - Lightning-fast search
- `read_graph` - Retrieve stored data
- `open_nodes` - Access specific items

### Advanced Features

- `create_relations` - Link related information
- `add_observations` - Add notes to existing items with MCP content blocks
- `set_context` - Switch between personal/work
- `get_context_info` - View memory statistics

## Benchmarks

Run comprehensive benchmarks to see the performance in action:

```bash
# Simple benchmarks
cd benchmarks && node simple-bench.js

# Comprehensive benchmarks
cd benchmarks && node comprehensive-bench.js

# Quick performance test
cd benchmarks && node run-simple-benchmarks.js
```

All benchmarks use the MCP server interface for accurate measurements.

## Pro Tips

1. **Performance**: First search takes ~1ms, repeated searches are instant (cached)
2. **Storage**: Automatically compresses large text to save space
3. **Context**: Let auto-detection handle context, or manually switch with "set context to work"
4. **Scale**: Handles 100,000+ items without breaking a sweat
5. **MCP Content**: Use rich content types for better AI understanding

## Troubleshooting

### Server won't start?

- Check the path in your Claude config is absolute
- Ensure you ran `npm run build`
