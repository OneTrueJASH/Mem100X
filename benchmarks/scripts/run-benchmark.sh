#!/bin/bash

# MCP Memory Server Benchmark Runner

set -e

echo "🏁 MCP Memory Server Benchmark Suite"
echo "===================================="
echo ""

# Change to benchmarks directory
cd "$(dirname "$0")/.."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Parse arguments
SERVERS="all"
BUILD_ONLY=false
SKIP_BUILD=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --servers)
            SERVERS="$2"
            shift 2
            ;;
        --build-only)
            BUILD_ONLY=true
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--servers mem100x,official] [--build-only] [--skip-build]"
            exit 1
            ;;
    esac
done

# Build containers
if [ "$SKIP_BUILD" = false ]; then
    echo "🔨 Building Docker containers..."
    docker-compose -f docker/docker-compose.yml build
    
    if [ "$BUILD_ONLY" = true ]; then
        echo "✅ Build complete!"
        exit 0
    fi
fi

# Prepare environment
export BENCHMARK_MODE=docker
export NODE_ENV=production

# Create results directory
mkdir -p results

# Run benchmarks
if [ "$SERVERS" = "all" ]; then
    echo "📊 Running benchmarks for all servers..."
    docker-compose -f docker/docker-compose.yml run --rm benchmark-runner
else
    echo "📊 Running benchmarks for: $SERVERS"
    docker-compose -f docker/docker-compose.yml run --rm -e SERVERS="$SERVERS" benchmark-runner
fi

# Show results
echo ""
echo "📈 Generating comparison report..."
node scripts/compare-results.js

echo ""
echo "✅ Benchmark complete! Results saved in results/"