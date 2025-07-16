# Mem100x Deployment Guide

**Multiple Distribution Methods for Every Environment**

Mem100x supports multiple deployment methods to meet diverse user preferences and infrastructure requirements.

## Quick Start

Choose your preferred installation method:

```bash
# Universal installer (auto-detects best method)
curl -fsSL https://raw.githubusercontent.com/OneTrueJASH/Mem100X/main/install.sh | bash

# Or specify method
./install.sh npm      # npm installation
./install.sh docker   # Docker installation
./install.sh source   # Source installation
```

## Installation Methods

### 1. npm (Recommended)

**Best for**: Most users, easy updates, global availability

```bash
# Install globally
npm install -g mem100x

# Usage
mem100x              # Multi-context server
mem100x-single       # Single-context server
```

**Configuration**:
```bash
# Copy example configuration
cp env.example .env

# Edit settings
nano .env

# Validate configuration
npm run config:validate
```

**Claude Desktop Configuration**:
```json
{
  "mcpServers": {
    "mem100x": {
      "command": "mem100x"
    }
  }
}
```

### 2. Docker

**Best for**: Containerized environments, isolation, consistent deployment

#### Quick Docker Setup

```bash
# Build and run multi-context server
docker build -t mem100x .
docker run --rm -v $(pwd)/data:/app/data mem100x

# Run single-context server
docker run --rm -v $(pwd)/data:/app/data mem100x node dist/index.js
```

#### Docker Compose (Recommended)

```bash
# Start multi-context server
docker-compose up mem100x

# Start single-context server
docker-compose up mem100x-single

# Start development server
docker-compose up mem100x-dev
```

#### Production Docker Setup

```bash
# Create data directory
mkdir -p /opt/mem100x/data

# Run with persistent storage
docker run -d \
  --name mem100x \
  --restart unless-stopped \
  -v /opt/mem100x/data:/app/data \
  -v /opt/mem100x/.env:/app/.env:ro \
  -e LOG_LEVEL=info \
  -e DATABASE_CACHE_SIZE_MB=512 \
  mem100x
```

**Claude Desktop Configuration**:
```json
{
  "mcpServers": {
    "mem100x": {
      "command": "docker",
      "args": ["run", "--rm", "-v", "/path/to/data:/app/data", "mem100x"]
    }
  }
}
```

### 3. Source Installation

**Best for**: Development, customization, latest features

```bash
# Clone repository
git clone https://github.com/OneTrueJASH/Mem100X.git
cd Mem100X

# Install dependencies
npm install

# Build project
npm run build

# Run servers
npm start              # Multi-context
node dist/index.js     # Single-context
```

**Configuration**:
```bash
# Copy example configuration
cp env.example .env

# Edit settings
nano .env

# Validate configuration
npm run config:validate
```

**Claude Desktop Configuration**:
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

### 4. Binary Installation (Future)

**Best for**: Standalone deployment, no Node.js dependency

```bash
# Download binary for your platform
# (Coming soon - pkg/nexe builds)

# Usage
./mem100x-linux-x64    # Linux x64
./mem100x-macos-arm64  # macOS ARM64
./mem100x-win-x64.exe  # Windows x64
```

## Deployment Environments

### Development

```bash
# Quick start with development settings
LOG_LEVEL=debug PROFILING_ENABLED=true npm start

# Or use Docker Compose
docker-compose up mem100x-dev
```

### Production

```bash
# High-performance settings
DATABASE_CACHE_SIZE_MB=1024 \
ENTITY_CACHE_SIZE=100000 \
CACHE_STRATEGY=arc \
READ_POOL_SIZE=50 \
npm start

# Or use Docker with production settings
docker run -d \
  --name mem100x-prod \
  --restart unless-stopped \
  -v /opt/mem100x/data:/app/data \
  -e DATABASE_CACHE_SIZE_MB=1024 \
  -e ENTITY_CACHE_SIZE=100000 \
  -e CACHE_STRATEGY=arc \
  -e READ_POOL_SIZE=50 \
  mem100x
```

### Memory-Constrained Environments

```bash
# Memory-optimized settings
DATABASE_CACHE_SIZE_MB=64 \
ENTITY_CACHE_SIZE=10000 \
CACHE_STRATEGY=lru \
READ_POOL_SIZE=5 \
npm start
```

## Configuration Management

### Environment Variables

```bash
# Database settings
DATABASE_CACHE_SIZE_MB=512
DATABASE_MMAP_SIZE_MB=2048

# Performance settings
ENTITY_CACHE_SIZE=50000
CACHE_STRATEGY=arc
READ_POOL_SIZE=20

# Logging
LOG_LEVEL=info
PROFILING_ENABLED=false
```

### Configuration Files

```bash
# Copy example
cp env.example .env

# Edit configuration
nano .env

# Validate settings
npm run config:validate
```

### Docker Configuration

```bash
# Mount configuration file
docker run -v $(pwd)/.env:/app/.env:ro mem100x

# Or use environment variables
docker run -e DATABASE_CACHE_SIZE_MB=1024 mem100x
```

## Data Management

### Data Persistence

```bash
# Local directory
mkdir -p /opt/mem100x/data

# Docker volume
docker volume create mem100x_data

# Backup data
cp -r /opt/mem100x/data /backup/mem100x-$(date +%Y%m%d)
```

### Data Migration

```bash
# Export data (future feature)
mem100x export --output backup.json

# Import data (future feature)
mem100x import --input backup.json
```

## Monitoring and Health Checks

### Health Check Endpoints

```bash
# Docker health check
docker inspect mem100x | grep Health -A 10

# Manual health check
node -e "console.log('Health check passed')"
```

### Logging

```bash
# View logs
docker logs mem100x

# Follow logs
docker logs -f mem100x

# Log levels
LOG_LEVEL=debug  # Detailed logging
LOG_LEVEL=info   # Standard logging
LOG_LEVEL=warn   # Warnings only
LOG_LEVEL=error  # Errors only
```

### Performance Monitoring

```bash
# Enable profiling
PROFILING_ENABLED=true npm start

# Monitor resource usage
docker stats mem100x
```

## Security Considerations

### Docker Security

```bash
# Run as non-root user (default in Dockerfile)
docker run --user 1001:1001 mem100x

# Limit container resources
docker run --memory=1g --cpus=2 mem100x

# Use read-only filesystem where possible
docker run --read-only mem100x
```

### Network Security

```bash
# Isolate container network
docker run --network none mem100x

# Use custom network
docker network create mem100x_net
docker run --network mem100x_net mem100x
```

## Troubleshooting

### Common Issues

**"Database is locked" errors**:
```bash
DATABASE_BUSY_TIMEOUT=60000 npm start
```

**High memory usage**:
```bash
ENTITY_CACHE_SIZE=25000 SEARCH_CACHE_SIZE=5000 npm start
```

**Slow performance**:
```bash
CACHE_STRATEGY=arc READ_POOL_SIZE=50 BATCH_SIZE=5000 npm start
```

**Docker permission issues**:
```bash
# Fix data directory permissions
sudo chown -R 1001:1001 /opt/mem100x/data
```

### Getting Help

1. **Check logs**: `docker logs mem100x` or application logs
2. **Validate configuration**: `npm run config:validate`
3. **Test connectivity**: Verify MCP client can connect
4. **Check resources**: Monitor CPU, memory, disk usage

## Performance Tuning

### High-Performance Profile

```bash
# Database
DATABASE_CACHE_SIZE_MB=1024
DATABASE_MMAP_SIZE_MB=4096

# Performance
ENTITY_CACHE_SIZE=100000
SEARCH_CACHE_SIZE=50000
CACHE_STRATEGY=arc
READ_POOL_SIZE=50
BATCH_SIZE=5000
MAX_BATCH_SIZE=10000

# Features
ENABLE_BULK_OPERATIONS=true
ENABLE_PREPARED_STATEMENTS=true
ENABLE_DYNAMIC_BATCH_SIZING=true
```

### Memory-Optimized Profile

```bash
# Database
DATABASE_CACHE_SIZE_MB=64
DATABASE_MMAP_SIZE_MB=256

# Performance
ENTITY_CACHE_SIZE=10000
SEARCH_CACHE_SIZE=5000
CACHE_STRATEGY=lru
READ_POOL_SIZE=5
BATCH_SIZE=100
MAX_BATCH_SIZE=1000
```

## Integration Examples

### Claude Desktop

```json
{
  "mcpServers": {
    "mem100x": {
      "command": "mem100x"
    },
    "mem100x-single": {
      "command": "mem100x-single"
    }
  }
}
```

### Custom MCP Client

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/nodejs';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';

const transport = new StdioServerTransport({
  command: 'mem100x',
  args: [],
});

const client = new Client({
  name: 'mem100x-client',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {},
  },
});

await client.connect(transport);
```

## Support

- **Documentation**: [CONFIGURATION.md](CONFIGURATION.md)
- **Issues**: [GitHub Issues](https://github.com/OneTrueJASH/Mem100X/issues)
- **Discussions**: [GitHub Discussions](https://github.com/OneTrueJASH/Mem100X/discussions)

---

**Choose the deployment method that best fits your environment and requirements!** 
