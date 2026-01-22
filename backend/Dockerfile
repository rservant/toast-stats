# Backend Dockerfile
# Multi-stage build for optimized production image
#
# Build from monorepo root:
#   docker build -f backend/Dockerfile -t toast-stats-backend .
#
# Or build from backend directory with root context:
#   docker build -f Dockerfile -t toast-stats-backend ..

# ============================================
# Stage 1: Build
# ============================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy root package files for workspace dependency resolution
COPY package.json package-lock.json ./

# Copy backend package.json
COPY backend/package.json ./backend/

# Install all dependencies (including devDependencies for build)
# Skip prepare script (husky install) - not needed in Docker build
RUN npm ci --workspace=backend --ignore-scripts

# Copy backend source code
COPY backend/tsconfig.json ./backend/
COPY backend/src ./backend/src

# Build TypeScript to JavaScript
WORKDIR /app/backend
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

# Copy root package files for workspace dependency resolution
COPY package.json package-lock.json ./

# Copy backend package.json
COPY backend/package.json ./backend/

# Install production dependencies only
# Skip prepare script (husky install) which requires devDependencies
RUN npm ci --workspace=backend --omit=dev --ignore-scripts && \
    npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/backend/dist ./backend/dist

# Create cache directory with proper permissions
RUN mkdir -p /app/cache && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

WORKDIR /app/backend

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
