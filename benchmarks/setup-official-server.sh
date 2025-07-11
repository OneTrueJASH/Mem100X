#!/bin/bash

# Setup script for the official MCP memory server
# This clones the server OUTSIDE of the Mem100x repository

set -e

OFFICIAL_SERVER_PATH="/Users/josh/source/personal/mcp-servers-official"
MEMORY_SERVER_PATH="$OFFICIAL_SERVER_PATH/src/memory"

echo "🔧 Setting up official MCP memory server..."
echo "   Target location: $OFFICIAL_SERVER_PATH"
echo ""

# Check if already cloned
if [ -d "$MEMORY_SERVER_PATH" ]; then
    echo "✅ Official server already exists at $MEMORY_SERVER_PATH"
else
    echo "📦 Cloning official MCP servers repository..."
    cd /Users/josh/source/personal
    
    # Clone with sparse checkout to get only the memory server
    git clone --filter=blob:none --sparse https://github.com/modelcontextprotocol/servers.git mcp-servers-official
    cd mcp-servers-official
    git sparse-checkout init --cone
    git sparse-checkout set src/memory
    
    echo "✅ Repository cloned successfully"
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies for official server..."
cd "$MEMORY_SERVER_PATH"

# Check if package.json exists
if [ -f "package.json" ]; then
    npm install
    echo "✅ Dependencies installed"
else
    echo "❌ package.json not found in $MEMORY_SERVER_PATH"
    exit 1
fi

# Build the server
echo ""
echo "🔨 Building official server..."
if npm run build; then
    echo "✅ Official server built successfully"
else
    echo "❌ Build failed"
    exit 1
fi

# Create a symlink in benchmarks for easy access
SYMLINK_PATH="/Users/josh/source/personal/Mem100x/benchmarks/servers/official-memory"
mkdir -p /Users/josh/source/personal/Mem100x/benchmarks/servers

if [ ! -L "$SYMLINK_PATH" ]; then
    ln -s "$MEMORY_SERVER_PATH" "$SYMLINK_PATH"
    echo "✅ Created symlink at $SYMLINK_PATH"
fi

echo ""
echo "✅ Official MCP memory server setup complete!"
echo ""
echo "Server location: $MEMORY_SERVER_PATH"
echo "Symlink in benchmarks: $SYMLINK_PATH"
echo ""
echo "You can now run benchmarks comparing both servers using:"
echo "  ./run-comparison.js"