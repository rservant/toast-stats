# Backend Dockerfile — Monorepo-aware build
# Build context must be the repo root (not backend/).
#
# Cloud Run deploy:
#   gcloud run deploy --source=. --dockerfile=backend/Dockerfile
#
# Local build:
#   docker build -f backend/Dockerfile -t toast-stats-backend .

# ============================================
# Stage 1: Build workspace dependencies + backend
# ============================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy root package files (workspace config)
COPY package.json package-lock.json ./

# Copy workspace package.json files (for npm ci)
COPY packages/shared-contracts/package.json packages/shared-contracts/
COPY packages/analytics-core/package.json packages/analytics-core/
COPY backend/package.json backend/

# Install all dependencies (including devDependencies for build)
RUN npm ci --workspace=@toastmasters/shared-contracts \
           --workspace=@toastmasters/analytics-core \
           --workspace=backend

# Copy workspace source files
COPY packages/shared-contracts/tsconfig.json packages/shared-contracts/
COPY packages/shared-contracts/src packages/shared-contracts/src

COPY packages/analytics-core/tsconfig.json packages/analytics-core/
COPY packages/analytics-core/src packages/analytics-core/src

COPY backend/tsconfig.json backend/
COPY backend/src backend/src

# Build workspace dependencies first, then backend
RUN npm run build --workspace=@toastmasters/shared-contracts && \
    npm run build --workspace=@toastmasters/analytics-core && \
    npm run build --workspace=backend

# ============================================
# Stage 2: Production
# ============================================
FROM node:22-alpine AS production

LABEL org.opencontainers.image.title="Toast-Stats Backend"
LABEL org.opencontainers.image.description="Toastmasters District Statistics API Server"

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy root package files
COPY package.json package-lock.json ./

# Copy workspace package.json files
COPY packages/shared-contracts/package.json packages/shared-contracts/
COPY packages/analytics-core/package.json packages/analytics-core/
COPY backend/package.json backend/

# Install production dependencies only
RUN npm ci --omit=dev \
           --workspace=@toastmasters/shared-contracts \
           --workspace=@toastmasters/analytics-core \
           --workspace=backend && \
    npm cache clean --force

# Copy built artifacts from builder
COPY --from=builder /app/packages/shared-contracts/dist packages/shared-contracts/dist
COPY --from=builder /app/packages/analytics-core/dist packages/analytics-core/dist
COPY --from=builder /app/backend/dist backend/dist

# Create cache directory with proper permissions
RUN mkdir -p /app/cache && \
    chown -R nodejs:nodejs /app

USER nodejs

# Environment variables
ENV NODE_ENV=production
ENV PORT=5001
ENV CACHE_DIR=/app/cache
ENV NODE_OPTIONS="--max-old-space-size=384"

EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:5001/health || exit 1

# Start from the backend dist directory
CMD ["node", "backend/dist/index.js"]
