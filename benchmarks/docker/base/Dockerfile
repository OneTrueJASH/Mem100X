# Base image for MCP benchmark suite
FROM node:20-alpine

# Install system dependencies for monitoring and better-sqlite3
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite \
    procps \
    htop \
    # For better-sqlite3 compilation
    sqlite-dev \
    # For metrics collection
    linux-headers

# Create benchmark user (non-root)
RUN addgroup -g 1001 benchmark && \
    adduser -D -u 1001 -G benchmark benchmark

# Set up working directory
WORKDIR /benchmark

# Install global npm packages for benchmarking
RUN npm install -g \
    @modelcontextprotocol/sdk \
    # For precise time measurements
    microtime \
    # For statistics
    simple-statistics

# Create directories for benchmark framework
RUN mkdir -p \
    /benchmark/src \
    /benchmark/results \
    /benchmark/logs \
    /benchmark/metrics && \
    chown -R benchmark:benchmark /benchmark

# Copy package.json for benchmark dependencies
COPY package.json /benchmark/

# Install benchmark dependencies
RUN npm install

# Switch to benchmark user
USER benchmark

# Environment variables for consistent behavior
ENV NODE_ENV=benchmark
ENV NODE_OPTIONS="--max-old-space-size=384"

# Health check
HEALTHCHECK --interval=5s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "process.exit(0)"

# Base command (will be overridden by specific implementations)
CMD ["node", "--version"]