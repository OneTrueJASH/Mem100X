# Mem100x benchmark container
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++ sqlite-dev

# Copy source code
WORKDIR /build
COPY package*.json ./
COPY tsconfig.json ./
COPY src ./src

# Install and build
RUN npm ci && npm run build

# Runtime stage
FROM node:20-alpine

# Install runtime dependencies
RUN apk add --no-cache sqlite procps

# Create user
RUN addgroup -g 1001 benchmark && \
    adduser -D -u 1001 -G benchmark benchmark

# Set up directories
WORKDIR /app
RUN mkdir -p /data && chown -R benchmark:benchmark /app /data

# Copy built application
COPY --from=builder /build/package*.json ./
COPY --from=builder /build/dist ./dist
COPY --from=builder /build/node_modules ./node_modules

# Switch to non-root user
USER benchmark

# Environment
ENV NODE_ENV=production
ENV MEMORY_DB=/data/benchmark.db

# MCP server listens on stdio
EXPOSE 8080

# Health check
HEALTHCHECK --interval=5s --timeout=3s --start-period=5s --retries=3 \
    CMD test -f /data/benchmark.db || exit 1

# Run the multi-context server (default)
CMD ["node", "dist/server-multi.js"]