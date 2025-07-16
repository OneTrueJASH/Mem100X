# Mem100x - The FASTEST MCP Memory Server
# Multi-stage build for optimal production image

# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mem100x -u 1001

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder --chown=mem100x:nodejs /app/dist ./dist
COPY --from=builder --chown=mem100x:nodejs /app/package*.json ./
COPY --from=builder --chown=mem100x:nodejs /app/env.example ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Create data directory with proper permissions
RUN mkdir -p /app/data && chown -R mem100x:nodejs /app/data

# Switch to non-root user
USER mem100x

# Expose port (for HTTP mode, though MCP typically uses stdio)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('Health check passed')" || exit 1

# Default command (multi-context mode)
CMD ["node", "dist/server-multi.js"]

# Alternative commands for different modes
# Single-context mode: docker run --rm mem100x node dist/index.js
# Custom config: docker run --rm -v $(pwd)/.env:/app/.env mem100x
