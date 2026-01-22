# Backend Dockerfile
# Multi-stage build for optimized production image
#
# For Cloud Build (build context is backend/):
#   docker build -t toast-stats-backend .
#
# For local build from repo root:
#   docker build -f backend/Dockerfile -t toast-stats-backend backend/

# ============================================
# Stage 1: Build
# ============================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json ./

# Install all dependencies (including devDependencies for build)
RUN npm install

# Copy source code and TypeScript config
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript to JavaScript
RUN npm run build

# ============================================
# Stage 2: Production
# ============================================
FROM node:22-alpine AS production

# Add labels for container metadata
LABEL org.opencontainers.image.title="Toast-Stats Backend"
LABEL org.opencontainers.image.description="Toastmasters District Statistics API Server"
LABEL org.opencontainers.image.source="https://github.com/toast-stats/toast-stats"

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy package.json for production install
COPY package.json ./

# Install production dependencies only
RUN npm install --omit=dev && \
    npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create cache directory with proper permissions
RUN mkdir -p /app/cache && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Environment variables
ENV NODE_ENV=production
ENV PORT=5001
ENV CACHE_DIR=/app/cache

# Expose the application port
EXPOSE 5001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:5001/health || exit 1

# Start the application
CMD ["node", "dist/index.js"]
