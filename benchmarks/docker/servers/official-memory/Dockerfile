# Official MCP memory server benchmark container
FROM node:20-alpine

# Install git to clone the repository
RUN apk add --no-cache git python3 make g++

# Create user
RUN addgroup -g 1001 benchmark && \
    adduser -D -u 1001 -G benchmark benchmark

# Clone the official memory server
WORKDIR /app
RUN git clone https://github.com/modelcontextprotocol/servers.git && \
    cd servers && \
    git checkout main

# Install dependencies for the memory server
WORKDIR /app/servers
RUN npm install

# Set up the memory server specifically
WORKDIR /app/servers/src/memory
RUN npm install

# Create data directory
RUN mkdir -p /data && chown -R benchmark:benchmark /app /data

# Switch to non-root user
USER benchmark

# Environment
ENV NODE_ENV=production

# MCP server listens on stdio
EXPOSE 8080

# Health check
HEALTHCHECK --interval=5s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "process.exit(0)"

# Run the official memory server
CMD ["node", "build/index.js"]