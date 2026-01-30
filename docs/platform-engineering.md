# Platform Engineering Steering Document

**Status:** Authoritative  
**Applies to:** Backend services, deployment infrastructure, and operational practices  
**Audience:** All developers and automation agents (including Kiro)  
**Owner:** Development Team

---

## 1. Purpose

This document defines **mandatory platform engineering standards** for the Toast-Stats application.

Its goals are to:

- Establish authoritative guidance for backend architecture and deployment
- Define consistent patterns for Google Cloud Platform services
- Codify operational practices for observability, security, and incident response
- Provide standard templates and examples for common implementation patterns
- Serve as the central reference for platform-level decisions

This document is **normative**.

The keywords **MUST**, **MUST NOT**, **SHOULD**, and **MAY** are to be interpreted as described in RFC 2119.

Kiro MUST treat this document as the **primary source of truth** for all platform engineering decisions.

---

## 2. Non-Goals

This document explicitly does **NOT** cover:

- **TypeScript language standards** — See [typescript.md](./typescript.md)
- **Testing philosophy and practices** — See [testing.md](./testing.md) and [testing.eval.md](./testing.eval.md)
- **Storage abstraction patterns** — See [storage-abstraction.md](./storage-abstraction.md)
- **Property-based testing guidance** — See [property-testing-guidance.md](./property-testing-guidance.md)
- **API documentation requirements** — See [api-documentation.md](./api-documentation.md)
- **Git commit authorization** — See [git.md](./git.md)
- **Frontend development practices** — See [frontend-standards.md](./frontend-standards.md)
- **Performance SLOs and memory management** — See [performance-slos.md](./performance-slos.md)
- **Brand compliance and styling** — See [toastmasters-brand-guidelines.md](./toastmasters-brand-guidelines.md)
- **Modal dialog implementation** — See [modal-dialogs.md](./modal-dialogs.md)
- **Operational context and maintenance model** — See [production-maintenance.md](./production-maintenance.md)

This document provides **cross-references** to these documents rather than duplicating their content.

---

## 3. Authority Model

In the event of conflict, platform engineering rules MUST be applied according to the following precedence order (highest first):

1. **Domain-specific steering document** (e.g., typescript.md for TypeScript questions)
2. **This Platform Engineering Document** (general platform guidance)
3. **performance-slos.md** (performance-specific guidance)
4. **frontend-standards.md** (frontend-specific guidance)
5. Infrastructure configuration files (Dockerfile, cloudbuild.yaml, etc.)
6. Inline code comments

Lower-precedence sources MUST NOT weaken higher-precedence rules.

### Document Scope Boundaries

| Document | Authoritative Scope |
| -------- | ------------------- |
| platform-engineering.md | Backend architecture, deployment, observability, security, governance |
| frontend-standards.md | React patterns, Firebase Hosting, frontend build configuration |
| performance-slos.md | Performance targets, memory management, latency budgets |
| typescript.md | TypeScript compiler configuration, type safety patterns |
| testing.md | Testing philosophy, test isolation, coverage expectations |
| storage-abstraction.md | Data access patterns, storage provider abstraction |
| api-documentation.md | OpenAPI specification, endpoint documentation |
| git.md | Commit authorization, version control practices |
| production-maintenance.md | Operational context, data lifecycle, maintenance posture |

When guidance overlaps between documents, the document with the narrower, more specific scope takes precedence.

---

## 4. Reference Architecture

This section defines the deployment topology and infrastructure decisions for the Toast-Stats application.

### 4.1 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           TOAST-STATS ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐         ┌──────────────────────────────────────┐  │
│  │   USERS          │         │         GOOGLE CLOUD PLATFORM         │  │
│  │                  │         │                                        │  │
│  │  ┌────────────┐  │  HTTPS  │  ┌────────────────────────────────┐  │  │
│  │  │  Browser   │──┼────────►│  │     Firebase Hosting (CDN)     │  │  │
│  │  └────────────┘  │         │  │  - Static assets (JS/CSS/HTML) │  │  │
│  │                  │         │  │  - Global edge caching          │  │  │
│  └──────────────────┘         │  │  - SPA rewrites                 │  │  │
│                               │  └───────────────┬────────────────┘  │  │
│                               │                  │                    │  │
│                               │                  │ /api/* proxy       │  │
│                               │                  ▼                    │  │
│                               │  ┌────────────────────────────────┐  │  │
│                               │  │      Cloud Run (Backend)       │  │  │
│                               │  │  - Node.js 22 + TypeScript     │  │  │
│                               │  │  - Express.js API              │  │  │
│                               │  │  - 512Mi memory / 1 vCPU       │  │  │
│                               │  │  - 0-10 instances autoscaling  │  │  │
│                               │  └───────────┬────────────────────┘  │  │
│                               │              │                        │  │
│                               │              │                        │  │
│                               │    ┌─────────┴─────────┐              │  │
│                               │    │                   │              │  │
│                               │    ▼                   ▼              │  │
│                               │  ┌──────────┐   ┌──────────────┐     │  │
│                               │  │ Firestore│   │ Cloud Storage│     │  │
│                               │  │          │   │    (GCS)     │     │  │
│                               │  │-Snapshots│   │ -Raw CSV     │     │  │
│                               │  │-Config   │   │  cache       │     │  │
│                               │  │-Rankings │   │              │     │  │
│                               │  └──────────┘   └──────────────┘     │  │
│                               │                                        │  │
│                               └────────────────────────────────────────┘  │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    CI/CD PIPELINE (GitHub Actions)                │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌────────┐ │   │
│  │  │TypeCheck│─►│  Lint   │─►│  Test   │─►│  Build  │─►│ Deploy │ │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └────────┘ │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Cloud Run vs GKE Rationale

The Toast-Stats backend is deployed on **Cloud Run** rather than Google Kubernetes Engine (GKE). This decision is based on the following factors:

#### Why Cloud Run

| Factor | Cloud Run Advantage |
| ------ | ------------------- |
| **Operational Simplicity** | Zero cluster management, no node pools, no Kubernetes expertise required |
| **Cost Efficiency** | Pay-per-request pricing with scale-to-zero capability; no idle cluster costs |
| **Deployment Speed** | Container deployment in seconds; no cluster provisioning delays |
| **Autoscaling** | Automatic scaling from 0-10 instances based on request load |
| **Maintenance Burden** | No Kubernetes version upgrades, no node patching, no control plane management |

#### When GKE Would Be Appropriate

GKE SHOULD be considered if the application requires:

- **Long-running background processes** that cannot be request-scoped
- **Stateful workloads** requiring persistent local storage
- **Complex networking** with service mesh requirements
- **Multi-container pods** with sidecar patterns
- **Custom scheduling** or resource allocation policies
- **Sustained high traffic** where reserved capacity is more cost-effective

#### Decision Summary

For Toast-Stats, Cloud Run is the correct choice because:

1. The application is a stateless API server with request-scoped operations
2. Traffic patterns are variable with periods of low/no activity
3. The single-operator model prioritizes simplicity over advanced orchestration
4. Cost optimization through scale-to-zero aligns with the maintenance posture

This decision SHOULD be revisited if traffic patterns change significantly or if the application requires capabilities outside Cloud Run's model.

### 4.3 Environment Tiers

The Toast-Stats application defines three environment tiers with distinct purposes and configurations.

#### Development Environment

| Attribute | Value |
| --------- | ----- |
| **Purpose** | Local development and feature testing |
| **Storage Provider** | `local` (filesystem-based) |
| **Data Source** | Local cache directory with sample/test data |
| **Access** | Developer machine only |
| **Deployment** | Manual (`npm run dev`) |

Development environment characteristics:

- MUST use `STORAGE_PROVIDER=local` environment variable
- SHOULD use local Firestore emulator when testing cloud storage patterns
- MAY use production data snapshots for realistic testing (with appropriate safeguards)
- MUST NOT connect to production GCP resources

#### Staging Environment

| Attribute | Value |
| --------- | ----- |
| **Purpose** | Pre-production validation and integration testing |
| **Storage Provider** | `gcp` (Firestore + GCS) |
| **Data Source** | Staging GCP project with isolated resources |
| **Access** | Authenticated developers and CI/CD pipeline |
| **Deployment** | Automated via GitHub Actions on `staging` branch |

Staging environment characteristics:

- MUST mirror production configuration as closely as possible
- MUST use separate GCP project from production
- SHOULD use production-like data volumes for performance validation
- MUST have separate service accounts with staging-scoped permissions
- MAY be used for load testing and performance validation

#### Production Environment

| Attribute | Value |
| --------- | ----- |
| **Purpose** | Live application serving end users |
| **Storage Provider** | `gcp` (Firestore + GCS) |
| **Data Source** | Production GCP project |
| **Access** | Authenticated users via Firebase Hosting |
| **Deployment** | Automated via GitHub Actions on `main` branch |

Production environment characteristics:

- MUST have all quality gates passing before deployment
- MUST use production GCP project with appropriate IAM controls
- MUST have monitoring and alerting configured
- MUST support rollback to previous version within 5 minutes
- MUST NOT be used for testing or experimentation

### 4.4 Environment Promotion Model

Changes flow through environments in a controlled promotion model.

#### Promotion Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Development │────►│   Staging   │────►│ Production  │
│             │     │             │     │             │
│ Local dev   │     │ Pre-prod    │     │ Live users  │
│ Feature     │     │ validation  │     │ Monitored   │
│ branches    │     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
      │                   │                   │
      │                   │                   │
      ▼                   ▼                   ▼
   Manual              Automated          Automated
   testing            CI/CD gates        CI/CD gates
                      + manual           + approval
                      validation
```

#### Promotion Gates

**Development → Staging:**

- All unit tests MUST pass
- TypeScript compilation MUST succeed with zero errors
- ESLint MUST pass with zero errors
- Code review MUST be approved
- Feature branch MUST be merged to `staging` branch

**Staging → Production:**

- All staging quality gates MUST pass
- Integration tests MUST pass in staging environment
- Manual validation SHOULD be performed for significant changes
- `staging` branch MUST be merged to `main` branch
- Deployment approval MAY be required for high-risk changes

#### Rollback Procedures

If issues are detected in production:

1. **Immediate rollback**: Revert to previous Cloud Run revision via console or CLI
2. **Code rollback**: Revert the problematic commit and redeploy
3. **Data rollback**: Restore from Firestore backup if data corruption occurred

Rollback MUST be achievable within 5 minutes of issue detection.

#### Environment Configuration Matrix

| Configuration | Development | Staging | Production |
| ------------- | ----------- | ------- | ---------- |
| `STORAGE_PROVIDER` | `local` | `gcp` | `gcp` |
| `NODE_ENV` | `development` | `staging` | `production` |
| `LOG_LEVEL` | `debug` | `info` | `info` |
| Cloud Run instances | N/A | 0-2 | 0-10 |
| Memory limit | N/A | 512Mi | 512Mi |
| Firestore project | Emulator | `toast-stats-staging` | `toast-stats-prod` |
| GCS bucket | Local cache | `toast-stats-staging-*` | `toast-stats-prod-*` |

---

## 5. Backend Standards

This section defines mandatory standards for backend development, including project structure, API design, validation, logging, and error handling.

### 5.1 Project Structure

The backend follows a layered architecture with clear separation of concerns.

#### Directory Layout

```
backend/
├── src/
│   ├── config/          # Configuration management and environment loading
│   ├── middleware/      # Express middleware (caching, deduplication, auth)
│   ├── routes/          # API route handlers organized by domain
│   │   ├── admin/       # Administrative endpoints
│   │   └── districts/   # District data endpoints
│   ├── services/        # Business logic and domain services
│   │   ├── analytics/   # Analytics computation services
│   │   ├── backfill/    # Data backfill services
│   │   └── storage/     # Storage provider implementations
│   ├── types/           # TypeScript type definitions and interfaces
│   ├── utils/           # Utility functions and shared helpers
│   ├── scripts/         # CLI scripts for maintenance and debugging
│   ├── __tests__/       # Integration and property-based tests
│   └── index.ts         # Application entry point
├── Dockerfile           # Container image definition
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
└── vitest.config.ts     # Test configuration
```

#### File Organization Rules

| File Type | Location | Naming Convention |
| --------- | -------- | ----------------- |
| Route handlers | `src/routes/` | `{domain}.ts` or `{domain}/index.ts` |
| Services | `src/services/` | `{Name}Service.ts` |
| Types/Interfaces | `src/types/` | `{domain}.ts` |
| Utilities | `src/utils/` | `{name}.ts` (camelCase) |
| Unit tests | Co-located with source | `{name}.test.ts` |
| Integration tests | `src/__tests__/` | `{name}.integration.test.ts` |
| Property tests | `src/__tests__/` | `{name}.property.test.ts` |

#### Structural Requirements

- Route handlers MUST be thin controllers that delegate to services
- Services MUST contain business logic and MUST NOT import Express types
- Types MUST be defined in `src/types/` and exported via `index.ts`
- Utilities MUST be pure functions without side effects where possible
- Test files MUST be co-located with source files for unit tests

### 5.2 TypeScript Configuration

For TypeScript compiler configuration, type safety patterns, and prohibited patterns, see [typescript.md](./typescript.md).

Key requirements from that document that apply to backend code:

- `strict: true` MUST be enabled
- `noImplicitAny: true` MUST be enabled
- `strictNullChecks: true` MUST be enabled
- `noUncheckedIndexedAccess: true` MUST be enabled
- The `any` type is **STRICTLY FORBIDDEN**
- External data MUST be typed as `unknown` and validated at runtime

### 5.3 API Design Conventions

#### RESTful Patterns

API endpoints MUST follow RESTful conventions:

| Operation | HTTP Method | URL Pattern | Example |
| --------- | ----------- | ----------- | ------- |
| List resources | GET | `/api/{resources}` | `GET /api/districts` |
| Get single resource | GET | `/api/{resources}/{id}` | `GET /api/districts/42` |
| Create resource | POST | `/api/{resources}` | `POST /api/snapshots` |
| Update resource | PUT/PATCH | `/api/{resources}/{id}` | `PUT /api/config/districts` |
| Delete resource | DELETE | `/api/{resources}/{id}` | `DELETE /api/snapshots/2024-01-15` |
| Trigger action | POST | `/api/{resources}/{id}/{action}` | `POST /api/backfill/start` |

#### URL Conventions

- Resource names MUST be plural nouns (e.g., `/districts`, `/snapshots`)
- URL segments MUST use kebab-case (e.g., `/api/program-years`)
- Query parameters MUST use camelCase (e.g., `?programYear=2023-2024`)
- Path parameters MUST be descriptive (e.g., `:districtId`, `:snapshotId`)

#### Versioning Strategy

The API currently uses implicit versioning through the `/api/` prefix. If breaking changes are required:

- New versions SHOULD be introduced via path prefix (e.g., `/api/v2/`)
- Existing endpoints MUST remain available during deprecation period
- Deprecation notices MUST be communicated via response headers

### 5.4 Error Response Format

All error responses MUST follow a consistent JSON structure:

```typescript
interface ErrorResponse {
  error: {
    code: string           // Machine-readable error code (SCREAMING_SNAKE_CASE)
    message: string        // Human-readable error description
    details?: unknown      // Optional additional context
    parameter?: string     // For validation errors: the invalid parameter
    retryable?: boolean    // Whether the client should retry
  }
}
```

#### Standard Error Codes

| HTTP Status | Error Code | Description |
| ----------- | ---------- | ----------- |
| 400 | `MISSING_PARAMETER` | Required parameter not provided |
| 400 | `INVALID_PARAMETER` | Parameter value is invalid |
| 400 | `VALIDATION_ERROR` | Request body failed validation |
| 404 | `NOT_FOUND` | Requested resource does not exist |
| 409 | `CONFLICT` | Resource state conflict (e.g., job already running) |
| 500 | `INTERNAL_ERROR` | Unexpected server error |
| 503 | `SERVICE_UNAVAILABLE` | Dependency unavailable (e.g., storage) |

#### Error Response Examples

```typescript
// ❌ FORBIDDEN - Inconsistent error format
res.status(400).json({ error: 'Missing district ID' })

// ✅ CORRECT - Structured error response
res.status(400).json({
  error: {
    code: 'MISSING_PARAMETER',
    message: 'Missing or invalid required parameter: districtId',
    parameter: 'districtId',
  },
})
```

### 5.5 Request/Response Validation with Zod

All API endpoints MUST validate request data using [zod](https://zod.dev/) schemas.

#### Validation Requirements

- Request bodies MUST be validated before processing
- Path parameters MUST be validated for format and constraints
- Query parameters MUST be validated with appropriate defaults
- Response data SHOULD be validated in development/test environments

#### Schema Definition Pattern

```typescript
import { z } from 'zod'

// Define schema with explicit types
const DistrictIdSchema = z.string().regex(/^[A-Za-z0-9]+$/, {
  message: 'District ID must contain only alphanumeric characters',
})

const ProgramYearSchema = z.string().regex(/^\d{4}-\d{4}$/, {
  message: 'Program year must be in YYYY-YYYY format',
})

const CreateSnapshotRequestSchema = z.object({
  districtIds: z.array(DistrictIdSchema).min(1),
  programYear: ProgramYearSchema,
  force: z.boolean().optional().default(false),
})

// Infer TypeScript types from schemas
type CreateSnapshotRequest = z.infer<typeof CreateSnapshotRequestSchema>
```

#### Validation Middleware Pattern

```typescript
import { Request, Response, NextFunction } from 'express'
import { z, ZodSchema } from 'zod'

function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body)
    
    if (!result.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: result.error.flatten(),
        },
      })
      return
    }
    
    req.body = result.data
    next()
  }
}

// Usage in route definition
router.post(
  '/snapshots',
  validateBody(CreateSnapshotRequestSchema),
  createSnapshotHandler
)
```

#### Validation Best Practices

- Schemas MUST be defined in a dedicated file or co-located with route handlers
- Schemas SHOULD use `.describe()` for documentation
- Schemas MUST NOT use `.passthrough()` in production (prevents unknown fields)
- Error messages MUST be user-friendly and actionable

### 5.6 Structured Logging Standards

All backend code MUST use structured JSON logging for production observability.

#### Log Levels

| Level | Usage | Environment |
| ----- | ----- | ----------- |
| `error` | Unexpected failures, exceptions | All |
| `warn` | Recoverable issues, deprecations | All |
| `info` | Significant events, request completion | All |
| `debug` | Detailed diagnostic information | Development only |

#### Required Log Fields

Every log entry MUST include:

```typescript
interface LogEntry {
  timestamp: string      // ISO 8601 format
  level: LogLevel        // 'error' | 'warn' | 'info' | 'debug'
  message: string        // Human-readable description
  environment: string    // 'development' | 'staging' | 'production'
  data?: unknown         // Structured context data
}
```

#### Request Logging

HTTP requests MUST be logged with:

```typescript
{
  timestamp: '2024-01-15T10:30:00.000Z',
  level: 'info',
  message: 'HTTP Request',
  environment: 'production',
  data: {
    method: 'GET',
    path: '/api/districts/42',
    statusCode: 200,
    duration: '45ms',
    userAgent: 'Mozilla/5.0...',
  }
}
```

#### Error Logging

Errors MUST be logged with stack traces:

```typescript
{
  timestamp: '2024-01-15T10:30:00.000Z',
  level: 'error',
  message: 'Failed to fetch district data',
  environment: 'production',
  data: {
    message: 'Connection timeout',
    stack: 'Error: Connection timeout\n    at ...',
    name: 'TimeoutError',
  }
}
```

#### Logging Best Practices

- Log messages MUST be descriptive and actionable
- Sensitive data (credentials, PII) MUST NOT be logged
- Log levels MUST be appropriate to the severity
- Debug logs MUST be disabled in production unless explicitly enabled

### 5.7 Error Handling Patterns

#### Error Classification

Errors are classified into three categories:

| Category | Description | HTTP Status | Retryable |
| -------- | ----------- | ----------- | --------- |
| **Client Errors** | Invalid input, missing parameters | 4xx | No |
| **Transient Errors** | Temporary failures, timeouts | 5xx | Yes |
| **Permanent Errors** | Configuration issues, bugs | 5xx | No |

#### Custom Error Classes

The codebase uses typed error classes for consistent error handling:

```typescript
// Base storage error with context
class StorageError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly provider: 'local' | 'firestore' | 'gcs',
    public readonly cause?: Error
  ) {
    super(message)
    this.name = 'StorageError'
  }
}

// Operation-specific error with retry guidance
class StorageOperationError extends StorageError {
  constructor(
    message: string,
    operation: string,
    provider: 'local' | 'firestore' | 'gcs',
    public readonly retryable: boolean,
    cause?: Error
  ) {
    super(message, operation, provider, cause)
    this.name = 'StorageOperationError'
  }
}
```

#### Error Propagation Rules

- Services MUST throw typed errors with context
- Route handlers MUST catch errors and return appropriate HTTP responses
- Transient errors SHOULD be retried with exponential backoff
- Permanent errors MUST be logged and reported immediately

#### Error Handling Pattern

```typescript
// ❌ FORBIDDEN - Swallowing errors
try {
  await storage.writeSnapshot(snapshot)
} catch (error) {
  console.log('Write failed')  // Lost context!
}

// ✅ CORRECT - Proper error handling with context
try {
  await storage.writeSnapshot(snapshot)
} catch (error) {
  if (error instanceof StorageOperationError && error.retryable) {
    logger.warn('Transient storage error, will retry', { error })
    // Implement retry logic
  } else {
    logger.error('Permanent storage error', error)
    throw error  // Propagate to caller
  }
}
```

#### Circuit Breaker Integration

For external dependencies, errors SHOULD trigger circuit breaker patterns:

- Track failure rates over a sliding window
- Open circuit after threshold failures
- Allow periodic probes to detect recovery
- Log circuit state transitions

### 5.8 Data Access Patterns

For all data access patterns including storage abstraction, provider selection, and implementation requirements, see [storage-abstraction.md](./storage-abstraction.md).

Key requirements from that document:

- All data access MUST go through storage abstractions (`ISnapshotStorage`, `IRawCSVStorage`, etc.)
- Direct filesystem operations (`fs.readFile`, `fs.writeFile`) are **FORBIDDEN** outside storage implementations
- Storage provider selection MUST be determined by `STORAGE_PROVIDER` environment variable
- Business logic MUST NOT depend on specific storage backends

---

## 6. Containerization and Deployment

This section defines mandatory standards for containerization, health checks, resource sizing, caching strategies, and dependency management.

### 6.1 Dockerfile Patterns

All backend services MUST use multi-stage Docker builds to optimize image size and security.

#### Required Multi-Stage Build Structure

```dockerfile
# ============================================
# Stage 1: Build
# ============================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files first for layer caching
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

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
LABEL org.opencontainers.image.title="Service Name"
LABEL org.opencontainers.image.description="Service Description"

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy package files for production install
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --omit=dev && \
    npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Set ownership and switch to non-root user
RUN chown -R nodejs:nodejs /app
USER nodejs

# Environment variables
ENV NODE_ENV=production

# Start the application
CMD ["node", "dist/index.js"]
```

#### Dockerfile Requirements

| Requirement | Rule | Rationale |
| ----------- | ---- | --------- |
| Base image | MUST use `node:22-alpine` | Minimal attack surface, small image size |
| Multi-stage build | MUST use separate build and production stages | Excludes devDependencies and build tools from final image |
| Non-root user | MUST run as non-root user | Security best practice; prevents privilege escalation |
| Package lock | MUST use `npm ci` with lock file | Ensures reproducible builds |
| Cache cleaning | MUST clean npm cache after install | Reduces image size |
| Labels | SHOULD include OCI image labels | Improves image discoverability and traceability |

#### Image Optimization Guidelines

- Final image size SHOULD be under 200MB for Node.js services
- Build stage artifacts MUST NOT be copied to production stage
- Only production dependencies MUST be installed in production stage
- Static assets SHOULD be served from CDN, not bundled in container

#### Prohibited Patterns

```dockerfile
# ❌ FORBIDDEN - Running as root
USER root
CMD ["node", "dist/index.js"]

# ❌ FORBIDDEN - Installing devDependencies in production
RUN npm install

# ❌ FORBIDDEN - Using npm install instead of npm ci
RUN npm install --omit=dev

# ❌ FORBIDDEN - Copying entire source to production
COPY . .
```

### 6.2 Health Check Endpoints

All backend services MUST implement health check endpoints for container orchestration and load balancing.

#### Required Endpoints

| Endpoint | Purpose | Response Time | HTTP Status |
| -------- | ------- | ------------- | ----------- |
| `/health` | Liveness probe | < 100ms | 200 OK |
| `/health/ready` | Readiness probe | < 500ms | 200 OK or 503 |

#### Liveness Probe (`/health`)

The liveness probe indicates whether the application process is running and responsive.

```typescript
// ✅ CORRECT - Simple liveness check
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? 'unknown',
  })
})
```

Liveness probe requirements:

- MUST respond within 100ms
- MUST NOT check external dependencies
- MUST return 200 if the process is running
- SHOULD include application version for debugging

#### Readiness Probe (`/health/ready`)

The readiness probe indicates whether the application is ready to receive traffic.

```typescript
// ✅ CORRECT - Readiness check with dependency verification
router.get('/health/ready', async (req, res) => {
  const checks: Record<string, boolean> = {}
  
  // Check storage availability
  try {
    const storage = getSnapshotStorage()
    checks.storage = await storage.isReady()
  } catch {
    checks.storage = false
  }
  
  const allHealthy = Object.values(checks).every(Boolean)
  
  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ready' : 'not_ready',
    timestamp: new Date().toISOString(),
    checks,
  })
})
```

Readiness probe requirements:

- MUST verify critical dependencies are available
- MUST respond within 500ms
- MUST return 503 if any critical dependency is unavailable
- SHOULD include individual check results for debugging

#### Dockerfile Health Check Configuration

```dockerfile
# Health check using wget (available in Alpine)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/health || exit 1
```

| Parameter | Value | Rationale |
| --------- | ----- | --------- |
| `--interval` | 30s | Balance between responsiveness and overhead |
| `--timeout` | 10s | Allow for slow responses under load |
| `--start-period` | 5s | Grace period for application startup |
| `--retries` | 3 | Avoid false positives from transient failures |

#### Cloud Run Health Check Configuration

Cloud Run uses HTTP health checks configured via service settings:

```yaml
# Cloud Run service configuration
spec:
  template:
    spec:
      containers:
        - name: backend
          livenessProbe:
            httpGet:
              path: /health
              port: 5001
            initialDelaySeconds: 5
            periodSeconds: 30
            timeoutSeconds: 10
            failureThreshold: 3
          startupProbe:
            httpGet:
              path: /health
              port: 5001
            initialDelaySeconds: 0
            periodSeconds: 2
            timeoutSeconds: 10
            failureThreshold: 15
```

### 6.3 Cloud Run Resource Sizing

This section defines resource allocation guidelines for Cloud Run services.

#### Default Resource Configuration

| Resource | Default | Minimum | Maximum |
| -------- | ------- | ------- | ------- |
| Memory | 512Mi | 256Mi | 2Gi |
| CPU | 1 vCPU | 0.5 vCPU | 2 vCPU |
| Concurrency | 80 | 1 | 1000 |
| Min instances | 0 | 0 | 10 |
| Max instances | 10 | 1 | 100 |
| Request timeout | 300s | 1s | 3600s |

#### Memory Sizing Guidelines

Memory allocation MUST account for:

1. **V8 heap**: JavaScript objects and runtime data
2. **Native memory**: Buffers, streams, native modules
3. **Overhead**: Node.js runtime, container overhead (~50-100MB)

```
Container Memory = V8 Heap Limit + Native Memory + Overhead
```

| Container Memory | Recommended `--max-old-space-size` | Use Case |
| ---------------- | ---------------------------------- | -------- |
| 256Mi | 150MB | Lightweight services, simple APIs |
| 512Mi | 384MB | Standard API services (default) |
| 1Gi | 768MB | Data processing, analytics |
| 2Gi | 1536MB | Heavy computation, large datasets |

**Rule**: `--max-old-space-size` SHOULD be set to approximately 75% of container memory to leave room for native memory and overhead.

#### CPU Sizing Guidelines

| CPU Allocation | Use Case | Characteristics |
| -------------- | -------- | --------------- |
| 0.5 vCPU | Low-traffic APIs | Cost-optimized, slower cold starts |
| 1 vCPU | Standard workloads | Balanced performance (default) |
| 2 vCPU | CPU-intensive tasks | Computation, data processing |

CPU allocation considerations:

- SHOULD use 1 vCPU for most API services
- MAY use 2 vCPU for CPU-bound operations (analytics, data processing)
- MUST NOT use less than 0.5 vCPU for production services

#### Concurrency Configuration

Concurrency defines the maximum number of concurrent requests per instance.

| Concurrency | Use Case | Trade-offs |
| ----------- | -------- | ---------- |
| 1 | CPU-intensive, stateful | Maximum isolation, higher cost |
| 10-20 | Memory-intensive operations | Balanced resource sharing |
| 80 | Standard API services | Default, good for I/O-bound work |
| 200+ | High-throughput, lightweight | Maximum efficiency, requires careful tuning |

Concurrency guidelines:

- SHOULD use concurrency of 80 for standard API services
- MUST reduce concurrency for memory-intensive operations
- MUST monitor memory usage when increasing concurrency
- SHOULD set concurrency based on: `Container Memory / Per-Request Memory`

#### Autoscaling Configuration

```yaml
# Cloud Run autoscaling configuration
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/minScale: "0"
        autoscaling.knative.dev/maxScale: "10"
```

| Setting | Development | Staging | Production |
| ------- | ----------- | ------- | ---------- |
| Min instances | 0 | 0 | 0 |
| Max instances | 2 | 2 | 10 |
| Scale-to-zero | Yes | Yes | Yes |

Autoscaling guidelines:

- MUST set `maxScale` to prevent runaway costs
- SHOULD use scale-to-zero for cost optimization
- MAY set `minScale: 1` for latency-sensitive production services
- MUST monitor cold start latency when using scale-to-zero

#### Request Timeout Configuration

| Endpoint Type | Timeout | Rationale |
| ------------- | ------- | --------- |
| Standard API | 60s | Sufficient for most operations |
| Data refresh | 300s | Long-running scraping operations |
| Backfill | 600s | Batch processing operations |
| Health checks | 10s | Quick response required |

Timeout guidelines:

- MUST set appropriate timeouts for each endpoint type
- SHOULD use shorter timeouts for user-facing endpoints
- MUST implement client-side timeouts in addition to server timeouts

### 6.4 Caching Strategies

This section defines caching patterns for optimizing performance and reducing load on backend services.

#### Cache Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                        CACHE HIERARCHY                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐ │
│  │   Browser    │──►│  CDN/Edge    │──►│  Application Cache   │ │
│  │   Cache      │   │  (Firebase)  │   │  (In-Memory LRU)     │ │
│  └──────────────┘   └──────────────┘   └──────────────────────┘ │
│        │                   │                      │              │
│        │                   │                      │              │
│        ▼                   ▼                      ▼              │
│   Cache-Control      CDN TTL              Memory Limits         │
│   Headers            Configuration        & Eviction            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### In-Memory Caching Requirements

All in-memory caches MUST implement bounded size and TTL-based eviction.

```typescript
// ✅ CORRECT - Bounded LRU cache with TTL
import { LRUCache } from 'lru-cache'

interface CacheOptions {
  maxSize: number      // Maximum number of entries
  maxAge: number       // TTL in milliseconds
  updateAgeOnGet?: boolean
}

const snapshotCache = new LRUCache<string, Snapshot>({
  max: 100,                    // Maximum 100 entries
  ttl: 5 * 60 * 1000,         // 5 minute TTL
  updateAgeOnGet: true,        // Reset TTL on access
  allowStale: false,           // Don't serve stale data
})
```

| Cache Type | Max Size | TTL | Eviction Policy |
| ---------- | -------- | --- | --------------- |
| Snapshot metadata | 100 entries | 5 minutes | LRU |
| District data | 50 entries | 10 minutes | LRU |
| Rankings | 20 entries | 5 minutes | LRU |
| Configuration | 10 entries | 30 minutes | LRU |

#### Cache Size Limits

In-memory cache size MUST be bounded to prevent memory exhaustion:

```typescript
// ❌ FORBIDDEN - Unbounded cache
const cache = new Map<string, Data>()  // Can grow indefinitely!

// ✅ CORRECT - Bounded cache with size calculation
const cache = new LRUCache<string, Data>({
  max: 100,
  maxSize: 50 * 1024 * 1024,  // 50MB maximum
  sizeCalculation: (value) => JSON.stringify(value).length,
})
```

Memory budget for caches:

- Total in-memory cache SHOULD NOT exceed 25% of container memory
- Individual cache instances SHOULD NOT exceed 50MB
- Cache size MUST be monitored and logged

#### HTTP Cache Headers

API responses MUST include appropriate cache headers:

```typescript
// Cache-Control header patterns
const CACHE_HEADERS = {
  // Static data that rarely changes
  immutable: 'public, max-age=31536000, immutable',
  
  // Data that can be cached but should be revalidated
  revalidate: 'public, max-age=300, stale-while-revalidate=60',
  
  // Data that should not be cached
  noCache: 'no-store, no-cache, must-revalidate',
  
  // Private data (user-specific)
  private: 'private, max-age=60',
}
```

| Endpoint Type | Cache-Control | Rationale |
| ------------- | ------------- | --------- |
| `/api/districts` | `public, max-age=300` | District list changes infrequently |
| `/api/districts/:id` | `public, max-age=60` | Individual district data |
| `/api/snapshots/latest` | `public, max-age=60` | Latest snapshot reference |
| `/api/admin/*` | `no-store` | Administrative operations |
| `/api/backfill/*` | `no-store` | Mutation operations |

#### Cache Invalidation Patterns

Cache invalidation MUST be explicit and predictable:

```typescript
// ✅ CORRECT - Explicit cache invalidation
class CacheService {
  private cache: LRUCache<string, Data>
  
  invalidate(key: string): void {
    this.cache.delete(key)
    logger.info('Cache invalidated', { key })
  }
  
  invalidatePattern(pattern: RegExp): void {
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key)
      }
    }
    logger.info('Cache pattern invalidated', { pattern: pattern.source })
  }
  
  invalidateAll(): void {
    this.cache.clear()
    logger.info('Cache cleared')
  }
}
```

Invalidation triggers:

- Data mutation operations MUST invalidate affected cache entries
- Snapshot refresh MUST invalidate snapshot-related caches
- Configuration changes MUST invalidate configuration caches
- Manual invalidation SHOULD be available via admin endpoints

#### Request Deduplication

Concurrent identical requests SHOULD be deduplicated:

```typescript
// ✅ CORRECT - Request deduplication
class DeduplicatingCache<T> {
  private cache: LRUCache<string, T>
  private pending: Map<string, Promise<T>> = new Map()
  
  async get(key: string, fetcher: () => Promise<T>): Promise<T> {
    // Check cache first
    const cached = this.cache.get(key)
    if (cached !== undefined) {
      return cached
    }
    
    // Check for pending request
    const pending = this.pending.get(key)
    if (pending) {
      return pending
    }
    
    // Create new request
    const promise = fetcher().then((result) => {
      this.cache.set(key, result)
      this.pending.delete(key)
      return result
    }).catch((error) => {
      this.pending.delete(key)
      throw error
    })
    
    this.pending.set(key, promise)
    return promise
  }
}
```

### 6.5 Dependency Management

This section defines practices for managing npm dependencies securely and consistently.

#### Version Pinning Requirements

| Dependency Type | Version Strategy | Example |
| --------------- | ---------------- | ------- |
| Production | Exact version | `"express": "4.18.2"` |
| Development | Exact version | `"vitest": "1.2.0"` |
| Peer dependencies | Range allowed | `"react": "^18.0.0"` |

```json
// ❌ FORBIDDEN - Unpinned versions
{
  "dependencies": {
    "express": "^4.18.0",
    "zod": "~3.22.0"
  }
}

// ✅ CORRECT - Pinned versions
{
  "dependencies": {
    "express": "4.18.2",
    "zod": "3.22.4"
  }
}
```

#### Package Lock Requirements

- `package-lock.json` MUST be committed to version control
- `npm ci` MUST be used in CI/CD pipelines (not `npm install`)
- Lock file MUST be regenerated when dependencies change
- Lock file version MUST match npm version used in CI

#### Security Update Process

```
┌─────────────────────────────────────────────────────────────────┐
│                  DEPENDENCY UPDATE WORKFLOW                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐ │
│  │   Dependabot │──►│   Review     │──►│   Test & Merge       │ │
│  │   Alert      │   │   PR         │   │                      │ │
│  └──────────────┘   └──────────────┘   └──────────────────────┘ │
│        │                   │                      │              │
│        ▼                   ▼                      ▼              │
│   Automated PR        Manual review         CI validation       │
│   creation            of changes            before merge        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

Security update requirements:

- Dependabot SHOULD be enabled for automated security alerts
- Critical vulnerabilities MUST be addressed within 24 hours
- High vulnerabilities MUST be addressed within 7 days
- Medium/Low vulnerabilities SHOULD be addressed within 30 days

#### Dependency Audit

```bash
# Run security audit
npm audit

# Fix automatically where possible
npm audit fix

# Generate audit report
npm audit --json > audit-report.json
```

CI pipeline MUST include:

- `npm audit` check with failure on high/critical vulnerabilities
- Dependency license compliance check
- Outdated dependency reporting

#### Allowed and Prohibited Dependencies

| Category | Policy | Examples |
| -------- | ------ | -------- |
| Core runtime | Allowed | express, zod, lru-cache |
| Testing | Allowed | vitest, fast-check |
| Type definitions | Allowed | @types/* |
| Native modules | Review required | sharp, bcrypt |
| Deprecated packages | Prohibited | request, moment |
| Unmaintained (>2 years) | Review required | - |

Dependency evaluation criteria:

- MUST have active maintenance (commits within 12 months)
- MUST have acceptable license (MIT, Apache 2.0, BSD)
- SHOULD have >1000 weekly downloads
- SHOULD have TypeScript types available
- MUST NOT have known critical vulnerabilities

#### Node.js Version Management

| Environment | Node.js Version | Management |
| ----------- | --------------- | ---------- |
| Development | 22.x LTS | `.nvmrc` file |
| CI/CD | 22.x LTS | GitHub Actions `node-version` |
| Production | 22.x Alpine | Dockerfile `FROM node:22-alpine` |

```
# .nvmrc
22
```

Node.js version requirements:

- All environments MUST use the same major Node.js version
- Version MUST be specified in `.nvmrc` for local development
- Dockerfile MUST use specific version tag (not `latest`)
- Version upgrades MUST be tested in staging before production

---

## 7. Google Cloud Deployment

This section defines mandatory standards for deploying services to Google Cloud Platform, including Cloud Run configuration, IAM requirements, secrets management, and environment configuration patterns.

### 7.1 Cloud Run Service Configuration

All Cloud Run services MUST be configured according to the following standards.

#### Service Definition

Cloud Run services MUST be defined with explicit configuration for all critical parameters:

```yaml
# cloud-run-service.yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: toast-stats-backend
  labels:
    app: toast-stats
    component: backend
spec:
  template:
    metadata:
      annotations:
        # Autoscaling configuration
        autoscaling.knative.dev/minScale: "0"
        autoscaling.knative.dev/maxScale: "10"
        # CPU allocation during startup
        run.googleapis.com/startup-cpu-boost: "true"
        # Execution environment
        run.googleapis.com/execution-environment: gen2
    spec:
      # Request timeout
      timeoutSeconds: 300
      # Service account for GCP API access
      serviceAccountName: toast-stats-backend@PROJECT_ID.iam.gserviceaccount.com
      # Container concurrency
      containerConcurrency: 80
      containers:
        - name: backend
          image: gcr.io/PROJECT_ID/toast-stats-backend:latest
          ports:
            - containerPort: 5001
          resources:
            limits:
              memory: 512Mi
              cpu: "1"
          env:
            - name: NODE_ENV
              value: production
            - name: PORT
              value: "5001"
```

#### Required Service Configuration

| Parameter | Production Value | Staging Value | Rationale |
| --------- | ---------------- | ------------- | --------- |
| `minScale` | 0 | 0 | Cost optimization with scale-to-zero |
| `maxScale` | 10 | 2 | Prevent runaway costs |
| `containerConcurrency` | 80 | 80 | Standard for I/O-bound services |
| `timeoutSeconds` | 300 | 300 | Allow long-running operations |
| `memory` | 512Mi | 512Mi | Standard API service allocation |
| `cpu` | 1 | 1 | Balanced performance |
| `execution-environment` | gen2 | gen2 | Better performance, faster cold starts |

#### Service Configuration Requirements

- Services MUST specify explicit memory and CPU limits
- Services MUST use the gen2 execution environment for improved performance
- Services MUST enable startup CPU boost for faster cold starts
- Services SHOULD use scale-to-zero unless latency requirements dictate otherwise
- Services MUST specify a service account for GCP API access

#### Deployment Command

```bash
# Deploy Cloud Run service from container image
gcloud run deploy toast-stats-backend \
  --image gcr.io/PROJECT_ID/toast-stats-backend:latest \
  --platform managed \
  --region us-central1 \
  --service-account toast-stats-backend@PROJECT_ID.iam.gserviceaccount.com \
  --memory 512Mi \
  --cpu 1 \
  --concurrency 80 \
  --timeout 300 \
  --min-instances 0 \
  --max-instances 10 \
  --set-env-vars NODE_ENV=production,PORT=5001 \
  --allow-unauthenticated
```

### 7.2 IAM and Service Accounts

All Cloud Run services MUST use dedicated service accounts with least-privilege permissions.

#### Service Account Naming Convention

Service accounts MUST follow this naming pattern:

```
{service-name}@{project-id}.iam.gserviceaccount.com
```

| Environment | Service Account | Example |
| ----------- | --------------- | ------- |
| Production | `toast-stats-backend@toast-stats-prod.iam.gserviceaccount.com` | Backend API service |
| Staging | `toast-stats-backend@toast-stats-staging.iam.gserviceaccount.com` | Backend API service |
| CI/CD | `github-actions@toast-stats-prod.iam.gserviceaccount.com` | Deployment automation |

#### Required IAM Roles

The backend service account MUST have the following roles:

| Role | Purpose | Scope |
| ---- | ------- | ----- |
| `roles/datastore.user` | Read/write Firestore documents | Project |
| `roles/storage.objectAdmin` | Read/write GCS objects | Specific buckets |
| `roles/secretmanager.secretAccessor` | Access secrets | Specific secrets |
| `roles/logging.logWriter` | Write structured logs | Project |
| `roles/cloudtrace.agent` | Write trace data | Project |

#### IAM Configuration Commands

```bash
# Create service account
gcloud iam service-accounts create toast-stats-backend \
  --display-name="Toast Stats Backend Service" \
  --description="Service account for Toast Stats backend API"

# Grant Firestore access
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:toast-stats-backend@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/datastore.user"

# Grant GCS access (bucket-level)
gsutil iam ch \
  serviceAccount:toast-stats-backend@PROJECT_ID.iam.gserviceaccount.com:objectAdmin \
  gs://toast-stats-prod-raw-csv

# Grant Secret Manager access (secret-level)
gcloud secrets add-iam-policy-binding SECRET_NAME \
  --member="serviceAccount:toast-stats-backend@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

#### IAM Requirements

- Each service MUST have a dedicated service account
- Service accounts MUST NOT use the default Compute Engine service account
- Permissions MUST be granted at the narrowest scope possible (bucket-level, secret-level)
- Service accounts MUST NOT have `roles/owner` or `roles/editor` roles
- Cross-project access MUST be explicitly documented and approved

#### CI/CD Service Account

The GitHub Actions deployment service account MUST have:

| Role | Purpose |
| ---- | ------- |
| `roles/run.admin` | Deploy Cloud Run services |
| `roles/iam.serviceAccountUser` | Act as the backend service account |
| `roles/storage.admin` | Push container images to GCR |
| `roles/firebase.admin` | Deploy Firebase Hosting |

### 7.3 Secrets Management

All sensitive configuration MUST be stored in Google Secret Manager and injected as environment variables at runtime.

#### Secret Naming Convention

Secrets MUST follow this naming pattern:

```
{environment}-{service}-{secret-name}
```

| Secret | Name Pattern | Example |
| ------ | ------------ | ------- |
| API keys | `{env}-backend-api-key` | `prod-backend-toastmasters-api-key` |
| Database credentials | `{env}-backend-db-{type}` | `prod-backend-db-connection-string` |
| Service tokens | `{env}-backend-{service}-token` | `prod-backend-firebase-token` |

#### Secret Injection Pattern

Secrets MUST be injected as environment variables using Cloud Run's native Secret Manager integration:

```yaml
# Cloud Run service configuration with secrets
spec:
  template:
    spec:
      containers:
        - name: backend
          env:
            # Direct secret reference
            - name: TOASTMASTERS_API_KEY
              valueFrom:
                secretKeyRef:
                  name: prod-backend-toastmasters-api-key
                  key: latest
            # Secret mounted as file (for certificates, etc.)
            - name: TLS_CERT_PATH
              value: /secrets/tls/cert.pem
          volumeMounts:
            - name: tls-cert
              mountPath: /secrets/tls
              readOnly: true
      volumes:
        - name: tls-cert
          secret:
            secretName: prod-backend-tls-cert
```

#### gcloud Deployment with Secrets

```bash
# Deploy with secret environment variables
gcloud run deploy toast-stats-backend \
  --image gcr.io/PROJECT_ID/toast-stats-backend:latest \
  --set-secrets="TOASTMASTERS_API_KEY=prod-backend-toastmasters-api-key:latest" \
  --set-secrets="DB_CONNECTION_STRING=prod-backend-db-connection:latest"
```

#### Secret Management Requirements

- Secrets MUST be stored in Google Secret Manager, not in environment variables or code
- Secrets MUST NOT be logged, even at debug level
- Secrets MUST be rotated according to the following schedule:

| Secret Type | Rotation Period | Automation |
| ----------- | --------------- | ---------- |
| API keys | 90 days | Manual with notification |
| Service tokens | 30 days | Automated where possible |
| Database credentials | 90 days | Manual with notification |
| TLS certificates | Before expiry | Automated via Cloud Certificate Manager |

#### Secret Access Patterns

```typescript
// ✅ CORRECT - Access secret from environment variable
const apiKey = process.env.TOASTMASTERS_API_KEY
if (!apiKey) {
  throw new Error('TOASTMASTERS_API_KEY environment variable is required')
}

// ❌ FORBIDDEN - Hardcoded secrets
const apiKey = 'sk-1234567890abcdef'

// ❌ FORBIDDEN - Secrets in configuration files
import config from './config.json'  // Contains secrets
```

#### Secret Audit Requirements

- Secret access MUST be logged via Cloud Audit Logs
- Secret versions MUST be retained for 90 days after rotation
- Unused secrets MUST be disabled, not deleted, for 30 days before permanent removal

### 7.4 Environment Configuration

Environment configuration MUST distinguish between build-time and runtime configuration.

#### Configuration Categories

| Category | When Applied | Storage Location | Examples |
| -------- | ------------ | ---------------- | -------- |
| **Build-time** | During container build | Dockerfile, build args | Node version, build flags |
| **Deploy-time** | During service deployment | Cloud Run config | Memory, CPU, scaling |
| **Runtime** | During request processing | Environment variables, Secret Manager | API keys, feature flags |

#### Build-Time Configuration

Build-time configuration is baked into the container image and MUST NOT contain secrets.

```dockerfile
# ✅ CORRECT - Build-time configuration
ARG NODE_VERSION=22
FROM node:${NODE_VERSION}-alpine

# Build-time environment for optimization
ENV NODE_ENV=production

# ❌ FORBIDDEN - Secrets at build time
ARG API_KEY=secret123
ENV API_KEY=${API_KEY}
```

Build-time configuration requirements:

- MUST be deterministic and reproducible
- MUST NOT contain secrets or environment-specific values
- SHOULD be minimal to maximize image reusability across environments

#### Deploy-Time Configuration

Deploy-time configuration is applied when the Cloud Run service is deployed.

```bash
# Deploy-time configuration via gcloud
gcloud run deploy toast-stats-backend \
  --memory 512Mi \
  --cpu 1 \
  --concurrency 80 \
  --min-instances 0 \
  --max-instances 10 \
  --timeout 300
```

Deploy-time configuration requirements:

- MUST be specified explicitly for each environment
- MUST be version-controlled in deployment scripts or CI/CD configuration
- SHOULD use environment-specific values from CI/CD variables

#### Runtime Configuration

Runtime configuration is resolved when the application starts or processes requests.

```typescript
// Runtime configuration pattern
interface RuntimeConfig {
  // Required configuration (fail fast if missing)
  storageProvider: 'local' | 'gcp'
  port: number
  
  // Optional configuration with defaults
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  cacheEnabled: boolean
}

function loadRuntimeConfig(): RuntimeConfig {
  const storageProvider = process.env.STORAGE_PROVIDER
  if (storageProvider !== 'local' && storageProvider !== 'gcp') {
    throw new Error('STORAGE_PROVIDER must be "local" or "gcp"')
  }
  
  const port = parseInt(process.env.PORT ?? '5001', 10)
  if (isNaN(port)) {
    throw new Error('PORT must be a valid number')
  }
  
  return {
    storageProvider,
    port,
    logLevel: (process.env.LOG_LEVEL as RuntimeConfig['logLevel']) ?? 'info',
    cacheEnabled: process.env.CACHE_ENABLED !== 'false',
  }
}
```

Runtime configuration requirements:

- MUST validate all required configuration at startup
- MUST fail fast with clear error messages for missing required configuration
- MUST provide sensible defaults for optional configuration
- MUST NOT use hardcoded values that vary by environment

#### Environment Variable Matrix

| Variable | Build-time | Deploy-time | Runtime | Required |
| -------- | ---------- | ----------- | ------- | -------- |
| `NODE_ENV` | ✓ | | | Yes |
| `PORT` | | | ✓ | Yes |
| `STORAGE_PROVIDER` | | | ✓ | Yes |
| `LOG_LEVEL` | | | ✓ | No (default: info) |
| `CACHE_ENABLED` | | | ✓ | No (default: true) |
| `TOASTMASTERS_API_KEY` | | | ✓ (secret) | Yes |
| Memory limit | | ✓ | | Yes |
| CPU limit | | ✓ | | Yes |
| Max instances | | ✓ | | Yes |

#### Configuration Validation

All runtime configuration MUST be validated at application startup:

```typescript
// ✅ CORRECT - Validate configuration at startup
import { z } from 'zod'

const ConfigSchema = z.object({
  STORAGE_PROVIDER: z.enum(['local', 'gcp']),
  PORT: z.string().regex(/^\d+$/).transform(Number),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  NODE_ENV: z.enum(['development', 'staging', 'production']),
})

export function validateConfig(): z.infer<typeof ConfigSchema> {
  const result = ConfigSchema.safeParse(process.env)
  
  if (!result.success) {
    console.error('Configuration validation failed:', result.error.flatten())
    process.exit(1)
  }
  
  return result.data
}

// Call at application startup
const config = validateConfig()
```

#### Prohibited Configuration Patterns

```typescript
// ❌ FORBIDDEN - Environment-specific logic in code
if (process.env.NODE_ENV === 'production') {
  // Production-specific behavior
} else {
  // Development behavior
}

// ✅ CORRECT - Configuration-driven behavior
const config = loadRuntimeConfig()
if (config.cacheEnabled) {
  // Caching behavior controlled by configuration
}

// ❌ FORBIDDEN - Secrets in code or config files
const API_KEY = 'sk-1234567890'

// ✅ CORRECT - Secrets from environment
const API_KEY = process.env.TOASTMASTERS_API_KEY
if (!API_KEY) {
  throw new Error('TOASTMASTERS_API_KEY is required')
}
```

### 7.5 Networking and CORS

This section defines networking requirements including CORS configuration and allowed origins for the Toast-Stats application.

#### CORS Configuration

Cross-Origin Resource Sharing (CORS) MUST be configured to allow the frontend application to communicate with the backend API.

##### Allowed Origins

| Environment | Allowed Origins | Rationale |
| ----------- | --------------- | --------- |
| Development | `http://localhost:3000`, `http://localhost:5173` | Local development servers (CRA, Vite) |
| Staging | `https://staging.toast-stats.web.app`, `https://staging-toast-stats.firebaseapp.com` | Firebase Hosting staging URLs |
| Production | `https://toast-stats.web.app`, `https://toast-stats.firebaseapp.com` | Firebase Hosting production URLs |

##### CORS Middleware Configuration

```typescript
import cors from 'cors'

// ✅ CORRECT - Environment-specific CORS configuration
const ALLOWED_ORIGINS: Record<string, string[]> = {
  development: [
    'http://localhost:3000',
    'http://localhost:5173',
  ],
  staging: [
    'https://staging.toast-stats.web.app',
    'https://staging-toast-stats.firebaseapp.com',
  ],
  production: [
    'https://toast-stats.web.app',
    'https://toast-stats.firebaseapp.com',
  ],
}

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    const env = process.env.NODE_ENV ?? 'development'
    const allowedOrigins = ALLOWED_ORIGINS[env] ?? ALLOWED_ORIGINS.development
    
    // Allow requests with no origin (e.g., mobile apps, curl)
    if (!origin) {
      callback(null, true)
      return
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400, // 24 hours preflight cache
}

app.use(cors(corsOptions))
```

##### CORS Requirements

- Origins MUST be explicitly whitelisted; wildcard (`*`) is **FORBIDDEN** in production
- Credentials MUST be enabled for authenticated requests
- Preflight responses SHOULD be cached for 24 hours to reduce OPTIONS requests
- CORS errors MUST be logged for debugging but MUST NOT expose internal details to clients

##### Prohibited CORS Patterns

```typescript
// ❌ FORBIDDEN - Wildcard origin in production
app.use(cors({ origin: '*' }))

// ❌ FORBIDDEN - Reflecting origin without validation
app.use(cors({ origin: true }))

// ❌ FORBIDDEN - Hardcoded origins without environment awareness
app.use(cors({ origin: 'https://toast-stats.web.app' }))
```

#### Network Security Headers

All HTTP responses MUST include security headers:

```typescript
import helmet from 'helmet'

// ✅ CORRECT - Security headers configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://firestore.googleapis.com'],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}))
```

| Header | Value | Purpose |
| ------ | ----- | ------- |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Enforce HTTPS |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `X-XSS-Protection` | `1; mode=block` | XSS filter (legacy browsers) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Control referrer information |

#### Firebase Hosting Proxy Configuration

Firebase Hosting proxies API requests to Cloud Run. The `firebase.json` configuration MUST include:

```json
{
  "hosting": {
    "rewrites": [
      {
        "source": "/api/**",
        "run": {
          "serviceId": "toast-stats-backend",
          "region": "us-central1"
        }
      },
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

Proxy requirements:

- All `/api/**` requests MUST be routed to Cloud Run
- SPA fallback MUST route all other requests to `index.html`
- Region MUST match the Cloud Run service region

### 7.6 CI/CD Pipeline

This section documents the CI/CD pipeline using GitHub Actions with quality gates for the Toast-Stats application.

#### Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        CI/CD PIPELINE STAGES                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐ │
│  │   Install   │──►│   Quality   │──►│    Build    │──►│   Deploy    │ │
│  │             │   │    Gates    │   │             │   │             │ │
│  └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘ │
│        │                 │                 │                 │          │
│        ▼                 ▼                 ▼                 ▼          │
│   npm ci            TypeScript         Docker build     Cloud Run      │
│   Cache deps        ESLint             Push to GCR      Firebase       │
│                     Prettier                                            │
│                     Unit tests                                          │
│                     npm audit                                           │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Quality Gates

All quality gates MUST pass before deployment proceeds. Failures are **blocking**.

| Gate | Tool | Threshold | Blocking |
| ---- | ---- | --------- | -------- |
| TypeScript compilation | `tsc --noEmit` | Zero errors | Yes |
| Linting | `eslint` | Zero errors | Yes |
| Formatting | `prettier --check` | All files formatted | Yes |
| Unit tests | `vitest run` | All tests pass | Yes |
| Security audit | `npm audit` | No high/critical vulnerabilities | Yes |
| Build | `npm run build` | Successful build | Yes |

#### GitHub Actions Workflow

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main, staging]

env:
  NODE_VERSION: '22'
  REGISTRY: gcr.io
  PROJECT_ID: ${{ secrets.GCP_PROJECT_ID }}

jobs:
  # ============================================
  # Quality Gates
  # ============================================
  quality-gates:
    name: Quality Gates
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: |
            backend/package-lock.json
            frontend/package-lock.json
      
      # Backend quality gates
      - name: Install backend dependencies
        run: npm ci
        working-directory: backend
      
      - name: TypeScript check (backend)
        run: npm run typecheck
        working-directory: backend
      
      - name: Lint (backend)
        run: npm run lint
        working-directory: backend
      
      - name: Format check (backend)
        run: npm run format:check
        working-directory: backend
      
      - name: Unit tests (backend)
        run: npm run test
        working-directory: backend
      
      - name: Security audit (backend)
        run: npm audit --audit-level=high
        working-directory: backend
      
      # Frontend quality gates
      - name: Install frontend dependencies
        run: npm ci
        working-directory: frontend
      
      - name: TypeScript check (frontend)
        run: npm run typecheck
        working-directory: frontend
      
      - name: Lint (frontend)
        run: npm run lint
        working-directory: frontend
      
      - name: Unit tests (frontend)
        run: npm run test
        working-directory: frontend

  # ============================================
  # Build and Push
  # ============================================
  build:
    name: Build and Push
    runs-on: ubuntu-latest
    needs: quality-gates
    if: github.event_name == 'push'
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
      
      - name: Configure Docker for GCR
        run: gcloud auth configure-docker
      
      - name: Build and push backend image
        run: |
          docker build -t ${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/toast-stats-backend:${{ github.sha }} .
          docker push ${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/toast-stats-backend:${{ github.sha }}
        working-directory: backend
      
      - name: Build frontend
        run: npm run build
        working-directory: frontend
        env:
          VITE_API_URL: ${{ github.ref == 'refs/heads/main' && 'https://api.toast-stats.web.app' || 'https://staging-api.toast-stats.web.app' }}
      
      - name: Upload frontend build artifact
        uses: actions/upload-artifact@v4
        with:
          name: frontend-build
          path: frontend/dist

  # ============================================
  # Deploy to Staging
  # ============================================
  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/staging'
    environment: staging
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
      
      - name: Deploy backend to Cloud Run (staging)
        run: |
          gcloud run deploy toast-stats-backend \
            --image ${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/toast-stats-backend:${{ github.sha }} \
            --region us-central1 \
            --platform managed \
            --tag staging \
            --no-traffic
      
      - name: Download frontend build
        uses: actions/download-artifact@v4
        with:
          name: frontend-build
          path: frontend/dist
      
      - name: Deploy frontend to Firebase (staging)
        run: |
          npm install -g firebase-tools
          firebase deploy --only hosting:staging --token ${{ secrets.FIREBASE_TOKEN }}

  # ============================================
  # Deploy to Production
  # ============================================
  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    environment: production
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
      
      - name: Deploy backend to Cloud Run (production)
        run: |
          gcloud run deploy toast-stats-backend \
            --image ${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/toast-stats-backend:${{ github.sha }} \
            --region us-central1 \
            --platform managed
      
      - name: Download frontend build
        uses: actions/download-artifact@v4
        with:
          name: frontend-build
          path: frontend/dist
      
      - name: Deploy frontend to Firebase (production)
        run: |
          npm install -g firebase-tools
          firebase deploy --only hosting --token ${{ secrets.FIREBASE_TOKEN }}
```

#### Pipeline Requirements

- Quality gates MUST run on all pull requests and pushes
- Build and deploy MUST only run on push events (not PRs)
- Staging deployment MUST occur on `staging` branch pushes
- Production deployment MUST occur on `main` branch pushes
- All jobs MUST use the same Node.js version specified in `.nvmrc`
- Dependencies MUST be cached to improve pipeline performance
- Secrets MUST be stored in GitHub Secrets, not in workflow files

#### Required GitHub Secrets

| Secret | Purpose | Scope |
| ------ | ------- | ----- |
| `GCP_PROJECT_ID` | Google Cloud project identifier | All environments |
| `GCP_SA_KEY` | Service account JSON key for deployment | All environments |
| `FIREBASE_TOKEN` | Firebase CLI authentication token | All environments |

### 7.7 Blue/Green Deployment

This section specifies blue/green deployment guidance for zero-downtime updates.

#### Deployment Strategy Overview

Cloud Run supports blue/green deployments through traffic splitting and revision management.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      BLUE/GREEN DEPLOYMENT FLOW                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐                              ┌─────────────┐           │
│  │   BLUE      │◄──── 100% Traffic ────────── │   Load      │           │
│  │  (Current)  │                              │  Balancer   │           │
│  │  Revision   │                              │             │           │
│  └─────────────┘                              └──────┬──────┘           │
│                                                      │                   │
│  ┌─────────────┐                                     │                   │
│  │   GREEN     │◄──── 0% Traffic (standby) ─────────┘                   │
│  │   (New)     │                                                         │
│  │  Revision   │                                                         │
│  └─────────────┘                                                         │
│                                                                          │
│  AFTER VALIDATION:                                                       │
│                                                                          │
│  ┌─────────────┐                              ┌─────────────┐           │
│  │   BLUE      │◄──── 0% Traffic ──────────── │   Load      │           │
│  │  (Previous) │                              │  Balancer   │           │
│  └─────────────┘                              └──────┬──────┘           │
│                                                      │                   │
│  ┌─────────────┐                                     │                   │
│  │   GREEN     │◄──── 100% Traffic ─────────────────┘                   │
│  │  (Current)  │                                                         │
│  └─────────────┘                                                         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Deployment Phases

##### Phase 1: Deploy New Revision (No Traffic)

Deploy the new revision without routing traffic to it:

```bash
# Deploy new revision with a tag, no traffic
gcloud run deploy toast-stats-backend \
  --image gcr.io/PROJECT_ID/toast-stats-backend:NEW_SHA \
  --region us-central1 \
  --tag green \
  --no-traffic
```

##### Phase 2: Validate New Revision

Test the new revision using the tagged URL:

```bash
# Test the green revision directly
curl https://green---toast-stats-backend-HASH.a.run.app/health

# Run smoke tests against the green revision
npm run test:smoke -- --base-url=https://green---toast-stats-backend-HASH.a.run.app
```

Validation requirements:

- Health endpoint MUST return 200 OK
- Smoke tests MUST pass
- No errors in Cloud Logging for the new revision
- Response times MUST be within acceptable thresholds

##### Phase 3: Gradual Traffic Migration

Gradually shift traffic to the new revision:

```bash
# Route 10% of traffic to green revision
gcloud run services update-traffic toast-stats-backend \
  --region us-central1 \
  --to-tags green=10

# Monitor for errors, then increase to 50%
gcloud run services update-traffic toast-stats-backend \
  --region us-central1 \
  --to-tags green=50

# Complete migration to 100%
gcloud run services update-traffic toast-stats-backend \
  --region us-central1 \
  --to-tags green=100
```

Traffic migration schedule:

| Stage | Traffic to Green | Duration | Monitoring |
| ----- | ---------------- | -------- | ---------- |
| Initial | 10% | 5 minutes | Error rate, latency |
| Canary | 50% | 10 minutes | Error rate, latency, logs |
| Full | 100% | - | Continuous monitoring |

##### Phase 4: Cleanup

After successful migration, clean up old revisions:

```bash
# Remove traffic tag from old revision
gcloud run services update-traffic toast-stats-backend \
  --region us-central1 \
  --clear-tags

# Optionally delete old revisions (keep last 3)
gcloud run revisions list --service toast-stats-backend --region us-central1 \
  --format="value(name)" | tail -n +4 | xargs -I {} gcloud run revisions delete {} --quiet
```

#### Rollback Procedure

If issues are detected during deployment:

```bash
# Immediate rollback: Route all traffic to previous revision
gcloud run services update-traffic toast-stats-backend \
  --region us-central1 \
  --to-revisions PREVIOUS_REVISION=100

# Or rollback to the last known good revision
gcloud run services update-traffic toast-stats-backend \
  --region us-central1 \
  --to-latest
```

Rollback triggers:

- Error rate exceeds 1% during traffic migration
- p95 latency exceeds 2x baseline
- Health check failures on new revision
- Critical errors in Cloud Logging

Rollback requirements:

- Rollback MUST be achievable within 2 minutes
- Previous revision MUST remain available for at least 24 hours
- Rollback events MUST be logged and alerted

#### Blue/Green Requirements

- New revisions MUST be deployed with `--no-traffic` initially
- Validation MUST occur before any traffic is routed to new revision
- Traffic migration MUST be gradual (10% → 50% → 100%)
- Rollback capability MUST be maintained throughout deployment
- At least 3 previous revisions MUST be retained for rollback

### 7.8 Cost Guardrails

This section defines cost guardrails including min/max instance limits and idle timeout settings.

#### Instance Limits

| Environment | Min Instances | Max Instances | Rationale |
| ----------- | ------------- | ------------- | --------- |
| Development | N/A | N/A | Local development only |
| Staging | 0 | 2 | Cost optimization, limited testing load |
| Production | 0 | 10 | Balance cost and capacity |

##### Minimum Instances

```bash
# Production: Scale to zero for cost optimization
gcloud run services update toast-stats-backend \
  --region us-central1 \
  --min-instances 0

# High-traffic production: Keep 1 instance warm to avoid cold starts
gcloud run services update toast-stats-backend \
  --region us-central1 \
  --min-instances 1
```

Minimum instance guidelines:

- SHOULD use `min-instances=0` for cost optimization (default)
- MAY use `min-instances=1` if cold start latency is unacceptable
- MUST NOT set `min-instances` higher than expected baseline traffic requires
- Cost impact: ~$15-30/month per always-on instance (512Mi, 1 vCPU)

##### Maximum Instances

```bash
# Set maximum instances to prevent runaway costs
gcloud run services update toast-stats-backend \
  --region us-central1 \
  --max-instances 10
```

Maximum instance guidelines:

- MUST set `max-instances` to prevent unbounded scaling
- Production SHOULD NOT exceed 10 instances without explicit approval
- Staging MUST NOT exceed 2 instances
- Cost impact: Each additional instance adds ~$0.00002400/vCPU-second

#### Idle Timeout and CPU Allocation

Cloud Run charges for CPU only while processing requests (by default).

```bash
# Default: CPU allocated only during request processing
gcloud run services update toast-stats-backend \
  --region us-central1 \
  --cpu-throttling

# Alternative: CPU always allocated (for background processing)
gcloud run services update toast-stats-backend \
  --region us-central1 \
  --no-cpu-throttling
```

| Setting | CPU Billing | Use Case | Cost Impact |
| ------- | ----------- | -------- | ----------- |
| `--cpu-throttling` (default) | Request time only | Standard APIs | Lower cost |
| `--no-cpu-throttling` | Instance lifetime | Background tasks | Higher cost |

CPU allocation requirements:

- MUST use `--cpu-throttling` for standard API services
- MAY use `--no-cpu-throttling` only for services with background processing needs
- MUST document justification for `--no-cpu-throttling` usage

#### Request Timeout

```bash
# Set request timeout to prevent long-running requests
gcloud run services update toast-stats-backend \
  --region us-central1 \
  --timeout 300
```

| Endpoint Type | Timeout | Monthly Cost Impact |
| ------------- | ------- | ------------------- |
| Standard API | 60s | Baseline |
| Data refresh | 300s | ~5x per request |
| Backfill | 600s | ~10x per request |

Timeout requirements:

- MUST set appropriate timeouts for each endpoint type
- Long-running operations SHOULD be moved to background jobs
- Timeouts MUST be monitored for optimization opportunities

#### Cost Monitoring and Alerts

##### Budget Alerts

```bash
# Create budget alert for Cloud Run costs
gcloud billing budgets create \
  --billing-account=BILLING_ACCOUNT_ID \
  --display-name="Toast Stats Cloud Run Budget" \
  --budget-amount=100USD \
  --threshold-rule=percent=50 \
  --threshold-rule=percent=90 \
  --threshold-rule=percent=100
```

Budget alert thresholds:

| Threshold | Action |
| --------- | ------ |
| 50% | Informational notification |
| 90% | Warning notification, review usage |
| 100% | Critical alert, investigate immediately |

##### Cost Monitoring Dashboard

Key metrics to monitor:

| Metric | Target | Alert Threshold |
| ------ | ------ | --------------- |
| Monthly Cloud Run cost | < $50 | > $75 |
| Instance hours/day | < 24 | > 48 |
| Request count/day | Baseline | > 2x baseline |
| Average request duration | < 500ms | > 1s |

##### Cost Optimization Checklist

- [ ] `max-instances` set to prevent runaway scaling
- [ ] `min-instances=0` unless cold starts are unacceptable
- [ ] `--cpu-throttling` enabled for standard APIs
- [ ] Request timeouts configured appropriately
- [ ] Budget alerts configured at 50%, 90%, 100%
- [ ] Monthly cost review scheduled

#### Cost Guardrail Requirements

- All Cloud Run services MUST have `max-instances` configured
- Production services MUST NOT exceed 10 max instances without approval
- Staging services MUST NOT exceed 2 max instances
- Budget alerts MUST be configured for all GCP projects
- Monthly cost reviews MUST be conducted
- Cost anomalies MUST be investigated within 24 hours

#### Estimated Monthly Costs

| Component | Staging | Production | Notes |
| --------- | ------- | ---------- | ----- |
| Cloud Run (backend) | $5-15 | $20-50 | Based on traffic patterns |
| Firebase Hosting | $0 | $0 | Free tier sufficient |
| Firestore | $0-5 | $5-20 | Based on read/write volume |
| Cloud Storage | $0-1 | $1-5 | Based on storage volume |
| Secret Manager | $0 | $0 | Free tier sufficient |
| **Total** | **$5-21** | **$26-75** | |

Cost estimates assume:

- Low to moderate traffic (< 100K requests/month)
- Scale-to-zero enabled
- Standard API response times (< 500ms average)
- Moderate Firestore usage (< 50K reads/day)

---


## 8. Observability and Operations

This section defines mandatory standards for observability, monitoring, alerting, and incident response. These standards ensure the Toast-Stats application can be effectively monitored, issues can be detected early, and incidents can be resolved quickly.

For operational context including the maintenance posture, data lifecycle, and failure modes, see [production-maintenance.md](./production-maintenance.md).

### 8.1 Metrics Collection

All backend services MUST emit structured metrics for operational visibility using Cloud Monitoring and structured logging.

#### Required Metrics Categories

| Category | Metrics | Collection Method |
| -------- | ------- | ----------------- |
| **Request Metrics** | Request count, latency, status codes | Structured logging + Cloud Monitoring |
| **Resource Metrics** | Memory usage, CPU utilization | Cloud Run built-in metrics |
| **Business Metrics** | Snapshot count, refresh success rate | Custom structured logs |
| **Dependency Metrics** | Storage latency, external API calls | Structured logging |

#### Structured Log-Based Metrics

Metrics MUST be collected through structured JSON logs that Cloud Monitoring can parse and aggregate.

```typescript
// ✅ CORRECT - Structured metric logging
interface MetricLog {
  timestamp: string
  level: 'info'
  message: string
  metric: {
    name: string
    value: number
    unit: string
    labels: Record<string, string>
  }
}

// Request duration metric
logger.info('Request completed', {
  metric: {
    name: 'http_request_duration_ms',
    value: 145,
    unit: 'milliseconds',
    labels: {
      method: 'GET',
      path: '/api/districts',
      status: '200',
    },
  },
})

// Business metric
logger.info('Snapshot refresh completed', {
  metric: {
    name: 'snapshot_refresh_duration_ms',
    value: 45000,
    unit: 'milliseconds',
    labels: {
      district_count: '5',
      success: 'true',
    },
  },
})
```

#### Request Metrics Requirements

Every HTTP request MUST log the following metrics:

```typescript
interface RequestMetrics {
  method: string           // HTTP method (GET, POST, etc.)
  path: string             // Request path (normalized, no IDs)
  statusCode: number       // HTTP response status code
  duration: number         // Request duration in milliseconds
  userAgent?: string       // Client user agent (truncated)
  requestId: string        // Unique request identifier
}

// ✅ CORRECT - Request completion logging
app.use((req, res, next) => {
  const startTime = Date.now()
  const requestId = crypto.randomUUID()
  
  res.on('finish', () => {
    const duration = Date.now() - startTime
    logger.info('HTTP Request', {
      requestId,
      method: req.method,
      path: normalizePath(req.path),
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('user-agent')?.substring(0, 100),
    })
  })
  
  next()
})
```

#### Resource Metrics

Cloud Run provides built-in resource metrics that MUST be monitored:

| Metric | Description | Alert Threshold |
| ------ | ----------- | --------------- |
| `container/cpu/utilization` | CPU usage percentage | > 80% sustained |
| `container/memory/utilization` | Memory usage percentage | > 85% sustained |
| `container/instance_count` | Number of running instances | > max_instances - 1 |
| `container/startup_latency` | Cold start duration | > 10 seconds |

#### Business Metrics

Application-specific business metrics MUST be logged for operational insight:

| Metric | Description | Labels |
| ------ | ----------- | ------ |
| `snapshot_refresh_duration_ms` | Time to complete snapshot refresh | `district_count`, `success` |
| `snapshot_count` | Total snapshots in storage | `status` (successful/failed) |
| `storage_operation_duration_ms` | Storage read/write latency | `operation`, `provider` |
| `cache_hit_rate` | In-memory cache effectiveness | `cache_name` |

```typescript
// ✅ CORRECT - Business metric logging
async function refreshSnapshot(districtIds: string[]): Promise<void> {
  const startTime = Date.now()
  let success = false
  
  try {
    await performRefresh(districtIds)
    success = true
  } finally {
    const duration = Date.now() - startTime
    logger.info('Snapshot refresh completed', {
      metric: {
        name: 'snapshot_refresh_duration_ms',
        value: duration,
        unit: 'milliseconds',
        labels: {
          district_count: String(districtIds.length),
          success: String(success),
        },
      },
    })
  }
}
```

#### Metrics Collection Requirements

- All HTTP requests MUST be logged with duration and status code
- Business operations MUST log duration and success/failure status
- Metrics MUST include relevant labels for filtering and aggregation
- Sensitive data (PII, credentials) MUST NOT appear in metric labels
- Metric names MUST use snake_case with unit suffix (e.g., `_ms`, `_count`)

### 8.2 Distributed Tracing

Request tracing MUST be implemented to correlate operations across service boundaries and enable debugging of complex request flows.

#### Trace Context Propagation

All requests MUST propagate trace context using the W3C Trace Context standard:

```typescript
// ✅ CORRECT - Trace context propagation
import { trace, context, SpanStatusCode } from '@opentelemetry/api'

const tracer = trace.getTracer('toast-stats-backend')

async function handleRequest(req: Request, res: Response): Promise<void> {
  const span = tracer.startSpan('handleRequest', {
    attributes: {
      'http.method': req.method,
      'http.url': req.url,
      'http.route': req.route?.path,
    },
  })
  
  try {
    await context.with(trace.setSpan(context.active(), span), async () => {
      // Request handling with active span context
      await processRequest(req, res)
    })
    span.setStatus({ code: SpanStatusCode.OK })
  } catch (error) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) })
    throw error
  } finally {
    span.end()
  }
}
```

#### Request ID Correlation

Every request MUST have a unique identifier that is:

1. Generated at request entry (or extracted from incoming headers)
2. Propagated to all downstream operations
3. Included in all log entries for the request
4. Returned in response headers for client correlation

```typescript
// ✅ CORRECT - Request ID middleware
import { randomUUID } from 'crypto'

interface RequestWithId extends Request {
  requestId: string
}

app.use((req: RequestWithId, res, next) => {
  // Use incoming request ID or generate new one
  const requestId = req.get('X-Request-ID') ?? randomUUID()
  req.requestId = requestId
  
  // Include in response headers
  res.set('X-Request-ID', requestId)
  
  // Add to async local storage for logging
  asyncLocalStorage.run({ requestId }, () => next())
})

// Logger automatically includes request ID
function createLogger() {
  return {
    info: (message: string, data?: unknown) => {
      const store = asyncLocalStorage.getStore()
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        message,
        requestId: store?.requestId,
        data,
      }))
    },
  }
}
```

#### Span Attributes

Spans MUST include relevant attributes for debugging:

| Span Type | Required Attributes |
| --------- | ------------------- |
| HTTP Request | `http.method`, `http.url`, `http.status_code`, `http.route` |
| Database Operation | `db.system`, `db.operation`, `db.name` |
| Storage Operation | `storage.provider`, `storage.operation`, `storage.bucket` |
| External API Call | `http.url`, `http.method`, `peer.service` |

#### Cloud Trace Integration

For production deployments, traces MUST be exported to Google Cloud Trace:

```typescript
// ✅ CORRECT - Cloud Trace configuration
import { TraceExporter } from '@google-cloud/opentelemetry-cloud-trace-exporter'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'

const provider = new NodeTracerProvider()

// Export traces to Cloud Trace in production
if (process.env.NODE_ENV === 'production') {
  const exporter = new TraceExporter()
  provider.addSpanProcessor(new SimpleSpanProcessor(exporter))
}

provider.register()
```

#### Tracing Requirements

- All incoming requests MUST have a request ID (generated or propagated)
- Request IDs MUST be included in all log entries
- Traces MUST be exported to Cloud Trace in production
- Span names MUST be descriptive and consistent
- Sensitive data MUST NOT appear in span attributes

### 8.3 Dashboards

Operational dashboards MUST be configured in Cloud Monitoring to provide visibility into application health and performance.

#### Required Dashboards

| Dashboard | Purpose | Key Widgets |
| --------- | ------- | ----------- |
| **Service Health** | Overall application health | Request rate, error rate, latency percentiles |
| **Resource Utilization** | Infrastructure capacity | CPU, memory, instance count |
| **Business Metrics** | Application-specific KPIs | Snapshot freshness, refresh success rate |
| **Cost Overview** | Resource consumption | Instance hours, request count, estimated cost |

#### Service Health Dashboard

The Service Health dashboard MUST include:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        SERVICE HEALTH DASHBOARD                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────┐ │
│  │   Request Rate      │  │   Error Rate        │  │   Availability  │ │
│  │   (requests/min)    │  │   (% 5xx responses) │  │   (% uptime)    │ │
│  │   ████████████      │  │   ▁▁▁▁▁▁▁▁▁▁▁▁     │  │   99.9%         │ │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────┘ │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                    LATENCY PERCENTILES (ms)                          ││
│  │   p50: ████████████████████ 145ms                                   ││
│  │   p95: ████████████████████████████████ 380ms                       ││
│  │   p99: ████████████████████████████████████████ 720ms               ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                    STATUS CODE DISTRIBUTION                          ││
│  │   2xx: ████████████████████████████████████████████████ 98.5%       ││
│  │   4xx: ██ 1.2%                                                       ││
│  │   5xx: ▏ 0.3%                                                        ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Dashboard Widget Specifications

| Widget | Metric | Aggregation | Time Range |
| ------ | ------ | ----------- | ---------- |
| Request Rate | `request_count` | Sum per minute | Last 1 hour |
| Error Rate | `5xx_count / total_count` | Percentage | Last 1 hour |
| p50 Latency | `request_duration_ms` | 50th percentile | Last 1 hour |
| p95 Latency | `request_duration_ms` | 95th percentile | Last 1 hour |
| p99 Latency | `request_duration_ms` | 99th percentile | Last 1 hour |
| Instance Count | `container/instance_count` | Max | Last 1 hour |
| Memory Usage | `container/memory/utilization` | Mean | Last 1 hour |

#### Business Metrics Dashboard

The Business Metrics dashboard MUST include:

| Widget | Description | Refresh Interval |
| ------ | ----------- | ---------------- |
| Snapshot Freshness | Time since last successful snapshot | 1 minute |
| Refresh Success Rate | Percentage of successful refreshes (24h) | 5 minutes |
| District Coverage | Number of districts with current data | 5 minutes |
| Data Staleness Alert | Visual indicator if data > 24h old | 1 minute |

#### Dashboard Requirements

- Service Health dashboard MUST be the default landing page
- All dashboards MUST auto-refresh at appropriate intervals
- Dashboards MUST be accessible to all team members
- Critical metrics MUST have visual thresholds (green/yellow/red)
- Dashboards SHOULD include links to relevant runbooks

### 8.4 Alerting

Alerting policies MUST be configured to notify operators of issues requiring attention.

#### Alert Severity Levels

| Severity | Response Time | Notification Channel | Examples |
| -------- | ------------- | -------------------- | -------- |
| **Critical** | Immediate (< 15 min) | PagerDuty/SMS | Service down, data corruption |
| **High** | < 1 hour | Email + Slack | Error rate > 5%, latency degradation |
| **Medium** | < 4 hours | Email | Elevated error rate, resource warnings |
| **Low** | Next business day | Email digest | Cost anomalies, deprecation warnings |

#### Required Alert Policies

| Alert | Condition | Severity | Action |
| ----- | --------- | -------- | ------ |
| Service Unavailable | Health check failures > 3 consecutive | Critical | Page on-call |
| High Error Rate | 5xx rate > 5% for 5 minutes | High | Notify team |
| Elevated Error Rate | 5xx rate > 1% for 15 minutes | Medium | Email notification |
| High Latency | p95 > 2s for 10 minutes | High | Notify team |
| Memory Pressure | Memory > 90% for 5 minutes | High | Notify team |
| Instance Scaling | Instances at max for 10 minutes | Medium | Email notification |
| Snapshot Staleness | No successful refresh > 24 hours | High | Notify team |
| Cost Anomaly | Daily cost > 2x baseline | Medium | Email notification |

#### Alert Configuration Pattern

```yaml
# Cloud Monitoring alert policy example
displayName: "High Error Rate Alert"
conditions:
  - displayName: "5xx Error Rate > 5%"
    conditionThreshold:
      filter: |
        resource.type = "cloud_run_revision"
        AND metric.type = "run.googleapis.com/request_count"
        AND metric.labels.response_code_class = "5xx"
      aggregations:
        - alignmentPeriod: 300s
          perSeriesAligner: ALIGN_RATE
          crossSeriesReducer: REDUCE_SUM
      comparison: COMPARISON_GT
      thresholdValue: 0.05
      duration: 300s
combiner: OR
notificationChannels:
  - projects/PROJECT_ID/notificationChannels/CHANNEL_ID
alertStrategy:
  autoClose: 1800s  # Auto-close after 30 minutes if resolved
```

#### Alert Notification Channels

| Channel | Use Case | Configuration |
| ------- | -------- | ------------- |
| Email | All severities | Team distribution list |
| Slack | High and above | #toast-stats-alerts channel |
| PagerDuty | Critical only | On-call rotation |

#### Alert Best Practices

- Alerts MUST be actionable (operator can take specific action)
- Alerts MUST include runbook links in the notification
- Alerts SHOULD have appropriate thresholds to avoid alert fatigue
- Alerts MUST be tested periodically to ensure delivery
- Alert conditions MUST be reviewed quarterly for relevance

#### Alerting Requirements

- All Critical and High severity conditions MUST have alerts configured
- Alerts MUST include clear descriptions and remediation guidance
- Alert thresholds MUST be tuned based on baseline metrics
- On-call rotation MUST be defined for Critical alerts
- Alert acknowledgment MUST be tracked for Critical alerts

### 8.5 Incident Response

This section defines incident response procedures for handling production issues.

#### Incident Severity Classification

| Severity | Definition | Examples | Response |
| -------- | ---------- | -------- | -------- |
| **SEV1** | Complete service outage | API unreachable, data corruption | All hands, immediate |
| **SEV2** | Major functionality impaired | High error rate, severe latency | Primary on-call, < 30 min |
| **SEV3** | Minor functionality impaired | Elevated errors, degraded performance | On-call, < 2 hours |
| **SEV4** | Minimal impact | Cosmetic issues, minor bugs | Next business day |

#### Incident Response Workflow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      INCIDENT RESPONSE WORKFLOW                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌───────┐ │
│  │  Detect  │──►│  Triage  │──►│ Mitigate │──►│  Resolve │──►│ Review│ │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘   └───────┘ │
│       │              │              │              │              │      │
│       ▼              ▼              ▼              ▼              ▼      │
│   Alert fires    Assess         Rollback or    Root cause     Post-    │
│   or user        severity       apply fix      analysis       mortem   │
│   report         and impact                                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Phase 1: Detection

Incidents are detected through:

1. **Automated alerts** from Cloud Monitoring
2. **User reports** via support channels
3. **Proactive monitoring** during deployments

Detection requirements:

- All alerts MUST be acknowledged within 15 minutes (Critical) or 1 hour (High)
- User reports MUST be triaged within 2 hours during business hours
- Deployment monitoring MUST continue for 30 minutes post-deploy

#### Phase 2: Triage

Triage determines severity and assigns ownership:

```markdown
## Incident Triage Checklist

- [ ] Confirm the issue is real (not false positive)
- [ ] Determine affected scope (users, features, data)
- [ ] Assign severity level (SEV1-4)
- [ ] Identify incident commander (for SEV1-2)
- [ ] Create incident channel/thread
- [ ] Notify stakeholders based on severity
```

#### Phase 3: Mitigation

Mitigation focuses on restoring service, not root cause:

##### Rollback Procedures

For deployment-related incidents, rollback is the primary mitigation:

```bash
# Immediate rollback to previous Cloud Run revision
gcloud run services update-traffic toast-stats-backend \
  --region us-central1 \
  --to-revisions PREVIOUS_REVISION=100

# Verify rollback success
curl https://toast-stats-backend-HASH.a.run.app/health
```

Rollback decision criteria:

| Condition | Action |
| --------- | ------ |
| Issue started after deployment | Rollback immediately |
| Issue is data-related | Investigate before rollback |
| Issue is external dependency | Do not rollback, implement workaround |
| Rollback unsuccessful | Escalate to SEV1 |

##### Other Mitigation Actions

| Issue Type | Mitigation Action |
| ---------- | ----------------- |
| High error rate | Rollback, increase logging |
| Memory exhaustion | Restart instances, reduce concurrency |
| External dependency failure | Enable circuit breaker, serve cached data |
| Data corruption | Stop writes, assess scope |

#### Phase 4: Resolution

Resolution addresses the root cause:

1. **Identify root cause** through logs, traces, and metrics
2. **Implement fix** with appropriate testing
3. **Deploy fix** following normal deployment process
4. **Verify resolution** through monitoring

Resolution requirements:

- Root cause MUST be identified for SEV1-2 incidents
- Fixes MUST go through normal CI/CD pipeline (except emergency hotfixes)
- Resolution MUST be verified through monitoring for 30 minutes

#### Phase 5: Post-Incident Review

All SEV1-2 incidents MUST have a post-incident review:

```markdown
## Post-Incident Review Template

### Incident Summary
- **Date/Time**: [When did it occur]
- **Duration**: [How long did it last]
- **Severity**: [SEV level]
- **Impact**: [Users/features affected]

### Timeline
- [Time] - Issue detected
- [Time] - Triage completed
- [Time] - Mitigation applied
- [Time] - Service restored
- [Time] - Root cause identified

### Root Cause
[Detailed explanation of what caused the incident]

### Contributing Factors
- [Factor 1]
- [Factor 2]

### Action Items
- [ ] [Action 1] - Owner: [Name] - Due: [Date]
- [ ] [Action 2] - Owner: [Name] - Due: [Date]

### Lessons Learned
- [What went well]
- [What could be improved]
```

#### Incident Communication

| Audience | Channel | Frequency | Content |
| -------- | ------- | --------- | ------- |
| Technical team | Slack/incident channel | Real-time | Technical details, actions |
| Stakeholders | Email | Hourly (SEV1-2) | Status, impact, ETA |
| Users | Status page | As needed | Service status, workarounds |

#### Incident Response Requirements

- SEV1 incidents MUST have an incident commander assigned
- All mitigation actions MUST be logged with timestamps
- Rollback MUST be attempted within 15 minutes for deployment-related SEV1-2
- Post-incident reviews MUST be completed within 5 business days
- Action items from reviews MUST be tracked to completion

#### Runbook References

Detailed runbooks SHOULD be maintained for common incident types:

| Runbook | Trigger | Location |
| ------- | ------- | -------- |
| Service Unavailable | Health check failures | `docs/runbooks/service-unavailable.md` |
| High Error Rate | 5xx rate > 5% | `docs/runbooks/high-error-rate.md` |
| Memory Exhaustion | Memory > 90% | `docs/runbooks/memory-exhaustion.md` |
| Snapshot Refresh Failure | Refresh fails > 3 times | `docs/runbooks/refresh-failure.md` |
| Rollback Procedure | Any deployment issue | `docs/runbooks/rollback.md` |

---


## 9. Security and Compliance

This section defines mandatory security and compliance standards for the Toast-Stats application. These standards ensure the application is built securely, dependencies are monitored for vulnerabilities, and user data is handled appropriately.

### 9.1 Threat Modeling

All new features and significant changes MUST undergo threat modeling to identify and mitigate security risks before implementation.

#### When Threat Modeling Is Required

Threat modeling MUST be performed for:

| Change Type | Requirement | Rationale |
| ----------- | ----------- | --------- |
| New API endpoints | Required | Potential attack surface expansion |
| Authentication/authorization changes | Required | Direct security impact |
| Data storage changes | Required | Data exposure risk |
| External service integrations | Required | Third-party trust boundaries |
| Infrastructure changes | Required | Network and access control impact |
| UI changes handling sensitive data | Required | Client-side security concerns |

Threat modeling MAY be skipped for:

- Bug fixes that don't change security boundaries
- Documentation updates
- Refactoring that doesn't change external interfaces
- Dependency updates (covered by dependency scanning)

#### STRIDE Threat Model Framework

All threat modeling MUST use the STRIDE framework to identify threats:

| Threat Category | Description | Example Mitigations |
| --------------- | ----------- | ------------------- |
| **S**poofing | Impersonating a user or system | Authentication, API keys, service accounts |
| **T**ampering | Modifying data or code | Input validation, integrity checks, signed requests |
| **R**epudiation | Denying actions occurred | Audit logging, request tracing, timestamps |
| **I**nformation Disclosure | Exposing sensitive data | Encryption, access controls, data minimization |
| **D**enial of Service | Making service unavailable | Rate limiting, resource quotas, circuit breakers |
| **E**levation of Privilege | Gaining unauthorized access | Least privilege, role-based access, input validation |

#### Threat Model Documentation

Threat models MUST be documented using this template:

```markdown
## Threat Model: [Feature Name]

### Overview
- **Feature**: [Brief description]
- **Author**: [Name]
- **Date**: [Date]
- **Status**: [Draft/Reviewed/Approved]

### Data Flow Diagram
[ASCII diagram showing data flow and trust boundaries]

### Assets
| Asset | Sensitivity | Location |
|-------|-------------|----------|
| [Asset name] | [High/Medium/Low] | [Where stored/processed] |

### Threats Identified
| ID | Category | Threat | Likelihood | Impact | Mitigation |
|----|----------|--------|------------|--------|------------|
| T1 | [STRIDE] | [Description] | [H/M/L] | [H/M/L] | [How addressed] |

### Residual Risks
[Any accepted risks and justification]

### Review Sign-off
- [ ] Security review completed
- [ ] Mitigations implemented
- [ ] Tests added for security controls
```

#### Threat Modeling Requirements

- Threat models MUST be created before implementation begins
- Threat models MUST be reviewed by at least one other team member
- High-impact threats MUST have documented mitigations
- Threat models MUST be updated when the feature changes significantly
- Threat models SHOULD be stored in `docs/threat-models/` directory

### 9.2 Dependency Scanning

All dependencies MUST be scanned for known vulnerabilities using automated tools integrated into the CI/CD pipeline.

#### Scanning Tools

| Tool | Purpose | Integration Point |
| ---- | ------- | ----------------- |
| **Trivy** | Container image scanning | CI/CD pipeline, pre-deployment |
| **npm audit** | Node.js dependency scanning | CI/CD pipeline, local development |
| **Dependabot** | Automated dependency updates | GitHub repository |

#### Trivy Configuration

Container images MUST be scanned with Trivy before deployment:

```yaml
# GitHub Actions workflow step
- name: Scan container image with Trivy
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: 'gcr.io/${{ env.PROJECT_ID }}/toast-stats-backend:${{ github.sha }}'
    format: 'table'
    exit-code: '1'
    ignore-unfixed: true
    vuln-type: 'os,library'
    severity: 'CRITICAL,HIGH'
```

#### Trivy Scanning Requirements

| Scan Type | Frequency | Blocking |
| --------- | --------- | -------- |
| Container image scan | Every build | Yes (CRITICAL/HIGH) |
| Filesystem scan | Weekly | No (report only) |
| IaC scan | On infrastructure changes | Yes (CRITICAL) |

#### npm Audit Configuration

Node.js dependencies MUST be audited in CI:

```yaml
# GitHub Actions workflow step
- name: Security audit
  run: npm audit --audit-level=high
  working-directory: backend
```

#### Vulnerability Response SLAs

| Severity | Response Time | Action Required |
| -------- | ------------- | --------------- |
| **Critical** | 24 hours | Immediate patch or mitigation |
| **High** | 7 days | Patch in next release |
| **Medium** | 30 days | Patch when convenient |
| **Low** | 90 days | Evaluate and track |

#### Dependency Scanning Requirements

- All container images MUST pass Trivy scan before deployment
- CI pipeline MUST fail on CRITICAL or HIGH vulnerabilities
- Dependabot MUST be enabled for automated security updates
- Vulnerability exceptions MUST be documented with justification and expiration date
- Weekly vulnerability reports SHOULD be reviewed by the team

#### Exception Documentation

When vulnerabilities cannot be immediately fixed, exceptions MUST be documented:

```markdown
## Vulnerability Exception

- **CVE**: CVE-YYYY-XXXXX
- **Package**: [package-name]
- **Severity**: [Critical/High/Medium/Low]
- **Reason for Exception**: [Why it cannot be fixed immediately]
- **Mitigation**: [What controls are in place]
- **Expiration**: [Date when exception expires]
- **Owner**: [Who is responsible for tracking]
```

### 9.3 Security Headers

All HTTP responses MUST include security headers to protect against common web vulnerabilities.

#### Required Security Headers

| Header | Value | Purpose |
| ------ | ----- | ------- |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Enforce HTTPS |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `X-XSS-Protection` | `1; mode=block` | XSS filter (legacy browsers) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Control referrer information |
| `Content-Security-Policy` | See below | Prevent XSS and injection attacks |
| `Permissions-Policy` | `geolocation=(), microphone=(), camera=()` | Disable unnecessary browser features |

#### Content Security Policy

The Content-Security-Policy header MUST be configured to restrict resource loading:

```typescript
// ✅ CORRECT - Helmet configuration with CSP
import helmet from 'helmet'

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],  // Required for some CSS-in-JS
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      connectSrc: [
        "'self'",
        'https://firestore.googleapis.com',
        'https://storage.googleapis.com',
      ],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin',
  },
  permissionsPolicy: {
    features: {
      geolocation: [],
      microphone: [],
      camera: [],
      payment: [],
      usb: [],
    },
  },
}))
```

#### Firebase Hosting Headers

Frontend assets served via Firebase Hosting MUST include security headers:

```json
{
  "hosting": {
    "headers": [
      {
        "source": "**",
        "headers": [
          {
            "key": "X-Content-Type-Options",
            "value": "nosniff"
          },
          {
            "key": "X-Frame-Options",
            "value": "DENY"
          },
          {
            "key": "X-XSS-Protection",
            "value": "1; mode=block"
          },
          {
            "key": "Referrer-Policy",
            "value": "strict-origin-when-cross-origin"
          },
          {
            "key": "Permissions-Policy",
            "value": "geolocation=(), microphone=(), camera=()"
          }
        ]
      }
    ]
  }
}
```

#### Security Headers Requirements

- All backend responses MUST include security headers via Helmet middleware
- Firebase Hosting MUST be configured with security headers in `firebase.json`
- Content-Security-Policy MUST be as restrictive as possible while allowing required functionality
- Security headers MUST be validated in CI using automated testing
- `'unsafe-inline'` and `'unsafe-eval'` SHOULD be avoided in CSP where possible

#### Prohibited Patterns

```typescript
// ❌ FORBIDDEN - Missing security headers
app.use(express.json())
// No helmet middleware!

// ❌ FORBIDDEN - Overly permissive CSP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'", '*'],  // Too permissive!
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],  // Dangerous!
    },
  },
}))

// ✅ CORRECT - Restrictive CSP with helmet
app.use(helmet())  // Uses secure defaults
```

### 9.4 PII Handling

Personally Identifiable Information (PII) MUST be handled with appropriate safeguards to protect user privacy and comply with data protection principles.

#### PII Classification

| Data Type | Classification | Handling Requirements |
| --------- | -------------- | --------------------- |
| Email addresses | PII | Minimize collection, encrypt at rest |
| Names | PII | Minimize collection, access controls |
| IP addresses | PII | Log rotation, anonymization |
| User IDs | Indirect PII | Access controls |
| Session tokens | Sensitive | Secure storage, expiration |
| API keys | Sensitive | Secret Manager, rotation |

#### Data Minimization Principles

All data collection MUST follow data minimization principles:

1. **Collect only what is necessary**: Do not collect data "just in case"
2. **Retain only as long as needed**: Define and enforce retention periods
3. **Limit access**: Apply least-privilege access controls
4. **Anonymize when possible**: Use aggregated or anonymized data for analytics

#### PII Handling Requirements

| Requirement | Implementation |
| ----------- | -------------- |
| Collection | MUST document purpose for each PII field collected |
| Storage | MUST encrypt PII at rest using GCP-managed encryption |
| Transmission | MUST use TLS 1.2+ for all PII transmission |
| Access | MUST implement role-based access controls |
| Logging | MUST NOT log PII in application logs |
| Retention | MUST define and enforce retention periods |
| Deletion | MUST support data deletion requests |

#### Secure Storage Patterns

```typescript
// ❌ FORBIDDEN - PII in logs
logger.info('User logged in', { email: user.email, name: user.name })

// ✅ CORRECT - Redacted PII in logs
logger.info('User logged in', { userId: user.id })

// ❌ FORBIDDEN - PII in error messages
throw new Error(`Invalid email: ${email}`)

// ✅ CORRECT - Generic error without PII
throw new Error('Invalid email format')
```

#### PII in Firestore

When storing PII in Firestore:

```typescript
// ✅ CORRECT - Separate PII into dedicated collection with stricter access
// users/{userId}/profile - Contains PII, restricted access
// users/{userId}/preferences - Non-PII, broader access

// Firestore security rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/profile {
      // Only the user and admins can access PII
      allow read, write: if request.auth.uid == userId 
                         || request.auth.token.admin == true;
    }
  }
}
```

#### Data Retention

| Data Type | Retention Period | Deletion Method |
| --------- | ---------------- | --------------- |
| User profiles | Account lifetime + 30 days | Automated deletion |
| Session data | 24 hours | TTL-based expiration |
| Audit logs | 90 days | Log rotation |
| Analytics data | 1 year (anonymized) | Aggregation |
| Backup data | 30 days | Automated cleanup |

#### PII Handling Checklist

Before collecting or processing PII:

- [ ] Document the purpose and legal basis for collection
- [ ] Implement encryption at rest and in transit
- [ ] Configure access controls (least privilege)
- [ ] Ensure PII is not logged
- [ ] Define retention period and deletion process
- [ ] Update privacy documentation if needed

### 9.5 Authentication and Authorization

All protected resources MUST implement appropriate authentication and authorization controls.

#### Authentication Patterns

The Toast-Stats application uses the following authentication patterns:

| Context | Authentication Method | Implementation |
| ------- | --------------------- | -------------- |
| User access | Firebase Authentication | Frontend SDK |
| Service-to-service | Service Account | GCP IAM |
| API access | API Key or Bearer Token | Backend middleware |
| Admin operations | Firebase Auth + Role claim | Custom claims |

#### Firebase Authentication Integration

Frontend authentication MUST use Firebase Authentication:

```typescript
// ✅ CORRECT - Firebase Auth initialization
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth'

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)

// Sign in with Google
const provider = new GoogleAuthProvider()
const result = await signInWithPopup(auth, provider)
const idToken = await result.user.getIdToken()

// Include token in API requests
fetch('/api/protected', {
  headers: {
    'Authorization': `Bearer ${idToken}`,
  },
})
```

#### Backend Token Verification

Backend endpoints MUST verify Firebase ID tokens:

```typescript
import { getAuth } from 'firebase-admin/auth'

// ✅ CORRECT - Token verification middleware
async function verifyToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid authorization header',
      },
    })
    return
  }
  
  const idToken = authHeader.split('Bearer ')[1]
  
  try {
    const decodedToken = await getAuth().verifyIdToken(idToken)
    req.user = decodedToken
    next()
  } catch (error) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token',
      },
    })
  }
}
```

#### Authorization Patterns

Authorization MUST follow the principle of least privilege:

| Role | Permissions | Implementation |
| ---- | ----------- | -------------- |
| Anonymous | Read public data | No auth required |
| Authenticated | Read all data, limited writes | Firebase Auth |
| Admin | Full access, admin operations | Custom claim `admin: true` |

#### Role-Based Access Control

Admin operations MUST verify role claims:

```typescript
// ✅ CORRECT - Role verification middleware
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.admin) {
    res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Admin access required',
      },
    })
    return
  }
  next()
}

// Usage
router.post('/admin/refresh', verifyToken, requireAdmin, refreshHandler)
```

#### Service Account Authentication

Service-to-service communication MUST use GCP service accounts:

```typescript
// ✅ CORRECT - Service account authentication
import { GoogleAuth } from 'google-auth-library'

const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
})

const client = await auth.getClient()
const response = await client.request({
  url: 'https://firestore.googleapis.com/...',
})
```

#### API Key Management

For external API access (if implemented):

| Requirement | Implementation |
| ----------- | -------------- |
| Storage | Google Secret Manager |
| Rotation | Every 90 days |
| Scope | Minimum required permissions |
| Logging | All API key usage logged |
| Revocation | Immediate revocation capability |

#### Authentication Requirements

- All protected endpoints MUST verify authentication tokens
- Tokens MUST be validated on every request (no client-side trust)
- Failed authentication MUST return 401 Unauthorized
- Failed authorization MUST return 403 Forbidden
- Authentication errors MUST NOT reveal whether a user exists
- Session tokens MUST have appropriate expiration times

#### Authorization Requirements

- All authorization decisions MUST be made server-side
- Role assignments MUST be stored in a trusted source (Firebase custom claims)
- Privilege escalation MUST require re-authentication
- Admin operations MUST be logged for audit purposes
- Default access MUST be deny (explicit allow required)

#### Prohibited Patterns

```typescript
// ❌ FORBIDDEN - Client-side authorization
if (user.role === 'admin') {
  // Show admin UI
  // This can be bypassed by modifying client code!
}

// ❌ FORBIDDEN - Trusting client-provided role
const role = req.body.role  // Never trust client input for authorization!

// ❌ FORBIDDEN - Hardcoded credentials
const apiKey = 'sk-1234567890'  // Use Secret Manager!

// ✅ CORRECT - Server-side authorization with verified claims
if (req.user?.admin === true) {
  // Admin operation - claim verified from Firebase token
}
```

#### Security Checklist for New Endpoints

Before deploying new endpoints:

- [ ] Authentication middleware applied (if protected)
- [ ] Authorization checks implemented (role verification)
- [ ] Input validation using zod schemas
- [ ] Error responses don't leak sensitive information
- [ ] Rate limiting configured (if public)
- [ ] Audit logging for sensitive operations
- [ ] Security headers configured

---


## 10. Quality Gates

This section defines mandatory quality gates that MUST pass before code can be merged or deployed. Quality gates ensure consistent code quality, prevent regressions, and maintain the reliability of the Toast-Stats application.

For testing philosophy, test isolation requirements, and evaluation criteria, see [testing.md](./testing.md) and [testing.eval.md](./testing.eval.md).

### 10.1 Backend Test Requirements

All backend code MUST be tested according to the following requirements.

#### Unit Test Requirements

Unit tests MUST be written for:

| Component Type | Test Requirement | Location |
| -------------- | ---------------- | -------- |
| Services | All public methods | Co-located `{name}.test.ts` |
| Utilities | All exported functions | Co-located `{name}.test.ts` |
| Validators | All validation schemas | Co-located `{name}.test.ts` |
| Route handlers | Request/response behavior | Co-located or `src/__tests__/` |

Unit test standards:

- Tests MUST be deterministic and repeatable
- Tests MUST NOT depend on external services (network, filesystem, databases)
- Tests MUST use dependency injection for testable design
- Tests MUST be isolated and safe for parallel execution
- Tests MUST clean up all resources in `afterEach` hooks

```typescript
// ✅ CORRECT - Isolated unit test with dependency injection
describe('DistrictService', () => {
  let service: DistrictService
  let mockStorage: MockSnapshotStorage

  beforeEach(() => {
    mockStorage = new MockSnapshotStorage()
    service = new DistrictService(mockStorage)
  })

  afterEach(() => {
    mockStorage.reset()
  })

  it('should return district data when snapshot exists', async () => {
    mockStorage.setSnapshot(testSnapshot)
    const result = await service.getDistrict('42')
    expect(result).toBeDefined()
  })
})
```

#### Integration Test Requirements

Integration tests MUST be written for:

| Integration Point | Test Requirement | Location |
| ----------------- | ---------------- | -------- |
| Storage operations | Read/write/delete cycles | `src/__tests__/*.integration.test.ts` |
| API endpoints | Full request/response flow | `src/__tests__/*.integration.test.ts` |
| External services | Contract verification | `src/__tests__/*.integration.test.ts` |

Integration test standards:

- Tests MUST use real implementations (not mocks) for the integration being tested
- Tests MUST use isolated resources (unique directories, ports, database instances)
- Tests MUST properly await all async cleanup operations
- Tests MUST be safe for parallel execution with other integration tests

```typescript
// ✅ CORRECT - Integration test with isolated resources
describe('SnapshotStorage Integration', () => {
  let storage: LocalSnapshotStorage
  let testDir: string

  beforeEach(async () => {
    testDir = await createUniqueTestDirectory()
    storage = new LocalSnapshotStorage(testDir)
  })

  afterEach(async () => {
    await cleanupTestDirectory(testDir)
  })

  it('should persist and retrieve snapshots', async () => {
    await storage.writeSnapshot(testSnapshot)
    const retrieved = await storage.getSnapshot(testSnapshot.id)
    expect(retrieved).toEqual(testSnapshot)
  })
})
```

#### Test Execution Requirements

Backend tests MUST pass under the following conditions:

| Execution Mode | Command | Requirement |
| -------------- | ------- | ----------- |
| Sequential | `npm run test` | All tests MUST pass |
| Parallel | `npm run test -- --run` | All tests MUST pass |
| Watch mode | `npm run test:watch` | Tests SHOULD pass on file changes |

CI pipeline MUST run tests in parallel mode to verify test isolation.

### 10.2 Frontend Test Requirements

All frontend code MUST be tested according to the following requirements.

#### Component Test Requirements

Component tests MUST be written for:

| Component Type | Test Requirement | Location |
| -------------- | ---------------- | -------- |
| UI Components | Rendering and interaction | Co-located `{Component}.test.tsx` |
| Hooks | State management and effects | Co-located `{hook}.test.ts` |
| Utilities | All exported functions | Co-located `{name}.test.ts` |
| Context providers | Provider behavior | Co-located `{Provider}.test.tsx` |

Component test standards:

- Tests MUST verify component rendering without errors
- Tests MUST verify user interactions (clicks, inputs, etc.)
- Tests MUST verify conditional rendering based on props/state
- Tests SHOULD use React Testing Library patterns

```typescript
// ✅ CORRECT - Component test with React Testing Library
import { render, screen, fireEvent } from '@testing-library/react'
import { DistrictCard } from './DistrictCard'

describe('DistrictCard', () => {
  it('should render district name', () => {
    render(<DistrictCard district={testDistrict} />)
    expect(screen.getByText(testDistrict.name)).toBeInTheDocument()
  })

  it('should call onClick when clicked', () => {
    const handleClick = vi.fn()
    render(<DistrictCard district={testDistrict} onClick={handleClick} />)
    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledWith(testDistrict.id)
  })
})
```

#### Accessibility Test Requirements

Accessibility testing MUST be performed for:

| Requirement | Test Method | Standard |
| ----------- | ----------- | -------- |
| Keyboard navigation | Manual + automated | WCAG 2.1 AA |
| Screen reader compatibility | Manual testing | WCAG 2.1 AA |
| Color contrast | Automated (axe-core) | WCAG 2.1 AA |
| Focus management | Component tests | WCAG 2.1 AA |

Accessibility test standards:

- Interactive components MUST be keyboard accessible
- All images MUST have appropriate alt text
- Form inputs MUST have associated labels
- Color MUST NOT be the only means of conveying information

```typescript
// ✅ CORRECT - Accessibility test with axe-core
import { render } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { DistrictCard } from './DistrictCard'

expect.extend(toHaveNoViolations)

describe('DistrictCard Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<DistrictCard district={testDistrict} />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
```

#### Frontend Test Execution

Frontend tests MUST pass under the following conditions:

| Execution Mode | Command | Requirement |
| -------------- | ------- | ----------- |
| Unit/Component | `npm run test` | All tests MUST pass |
| Accessibility | `npm run test:a11y` | No WCAG AA violations |
| Type checking | `npm run typecheck` | Zero TypeScript errors |

### 10.3 Code Coverage Expectations

Code coverage is treated as **guidance, not a hard threshold**. The goal is confidence in the test suite, not arbitrary metrics.

#### Coverage Philosophy

Per [testing.md](./testing.md):

> **Confidence beats coverage.**  
> Coverage is a signal, not a goal.

Coverage metrics SHOULD be used to:

- Identify untested code paths that may need attention
- Track coverage trends over time
- Guide code review discussions about test adequacy

Coverage metrics MUST NOT be used to:

- Block merges based solely on percentage thresholds
- Encourage writing low-value tests to hit targets
- Replace thoughtful test design with metric chasing

#### Coverage Guidance

| Code Category | Coverage Guidance | Rationale |
| ------------- | ----------------- | --------- |
| Business logic | High coverage expected | Core functionality must be protected |
| Utility functions | High coverage expected | Reusable code needs thorough testing |
| Route handlers | Moderate coverage expected | Integration tests may cover these |
| Configuration | Low coverage acceptable | Often tested implicitly |
| Error handling | Coverage of critical paths | Edge cases may be hard to trigger |

#### Coverage Reporting

Coverage reports SHOULD be generated in CI:

```bash
# Generate coverage report
npm run test -- --coverage

# Coverage report output
# - Statements: XX%
# - Branches: XX%
# - Functions: XX%
# - Lines: XX%
```

Coverage trends SHOULD be monitored:

- Significant coverage decreases SHOULD trigger review
- New code SHOULD maintain or improve overall coverage
- Coverage gaps in critical code SHOULD be addressed

#### What to Test vs. What Not to Test

**SHOULD be tested:**

- Business logic and domain rules
- Data transformations and calculations
- Error handling for expected failure modes
- User-facing behavior and interactions
- API contracts and response formats

**MAY have lower coverage:**

- Simple pass-through functions
- Framework boilerplate code
- Configuration and constants
- Third-party library wrappers

### 10.4 Lint and Format Requirements

All code MUST pass lint and format checks before merging.

#### ESLint Requirements

ESLint MUST be configured and enforced:

| Requirement | Rule | Enforcement |
| ----------- | ---- | ----------- |
| Zero errors | All rules | CI blocking |
| Zero warnings | Most rules | CI blocking (configurable) |
| TypeScript integration | `@typescript-eslint/*` | Required |
| Import ordering | `import/order` | Required |

ESLint configuration requirements:

- MUST extend recommended TypeScript ESLint rules
- MUST enforce `no-explicit-any` (per [typescript.md](./typescript.md))
- MUST enforce consistent import ordering
- SHOULD enforce consistent code style patterns

```bash
# Run ESLint
npm run lint

# ESLint must exit with code 0 (no errors)
```

#### Prettier Requirements

Prettier MUST be configured for consistent formatting:

| Requirement | Configuration | Enforcement |
| ----------- | ------------- | ----------- |
| Consistent formatting | `.prettierrc` | CI blocking |
| Format on save | Editor integration | Recommended |
| Pre-commit hook | Optional | Recommended |

Prettier configuration requirements:

- MUST use consistent configuration across backend and frontend
- MUST be run as part of CI pipeline
- SHOULD be integrated with editor for format-on-save

```bash
# Check formatting
npm run format:check

# Fix formatting
npm run format

# Format check must exit with code 0 (all files formatted)
```

#### CI Quality Gate Summary

The following checks MUST pass in CI before merge:

| Check | Command | Blocking |
| ----- | ------- | -------- |
| TypeScript compilation | `npm run typecheck` | Yes |
| ESLint | `npm run lint` | Yes |
| Prettier | `npm run format:check` | Yes |
| Unit tests | `npm run test` | Yes |
| Integration tests | `npm run test:integration` | Yes |
| Security audit | `npm audit --audit-level=high` | Yes |
| Build | `npm run build` | Yes |

#### Quality Gate Workflow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        QUALITY GATE WORKFLOW                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌───────┐ │
│  │TypeCheck │──►│  Lint    │──►│  Format  │──►│  Test    │──►│ Build │ │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘   └───────┘ │
│       │              │              │              │              │      │
│       ▼              ▼              ▼              ▼              ▼      │
│   Zero TS        Zero lint      All files      All tests     Build      │
│   errors         errors         formatted      passing       succeeds   │
│                                                                          │
│  ANY FAILURE = MERGE BLOCKED                                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Local Development Workflow

Developers SHOULD run quality checks locally before pushing:

```bash
# Run all quality checks locally
npm run typecheck && npm run lint && npm run format:check && npm run test

# Or use a combined script if available
npm run validate
```

Pre-commit hooks MAY be configured to run subset of checks:

- Format check (fast)
- Lint (fast)
- Type check (moderate)

Full test suite SHOULD be run before creating pull requests.

---


## 11. Standard Templates

This section provides **copy-paste ready templates** for common implementation patterns. These templates follow all conventions defined in this document and serve as authoritative starting points for new implementations.

All templates in this section:

- Follow the patterns and requirements defined in earlier sections
- Are production-ready with appropriate error handling
- Include inline comments explaining key decisions
- Can be customized for specific use cases while maintaining compliance

---

### 11.1 Dockerfile Template

This template implements the multi-stage build pattern defined in Section 6.1.

```dockerfile
# ============================================
# Toast-Stats Backend Dockerfile Template
# ============================================
# This template follows the multi-stage build pattern
# defined in platform-engineering.md Section 6.1
#
# Usage:
#   docker build -t toast-stats-backend .
#   docker run -p 5001:5001 toast-stats-backend
# ============================================

# ============================================
# Stage 1: Build
# Purpose: Compile TypeScript and prepare production assets
# ============================================
FROM node:22-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files first for optimal layer caching
# This layer is cached unless package files change
COPY package.json package-lock.json ./

# Install ALL dependencies (including devDependencies for build)
# Using npm ci for reproducible builds from lock file
RUN npm ci

# Copy TypeScript configuration
COPY tsconfig.json ./

# Copy source code
COPY src ./src

# Build TypeScript to JavaScript
# Output goes to ./dist directory
RUN npm run build

# ============================================
# Stage 2: Production
# Purpose: Minimal runtime image with only production dependencies
# ============================================
FROM node:22-alpine AS production

# OCI Image Labels for container metadata
# See: https://github.com/opencontainers/image-spec/blob/main/annotations.md
LABEL org.opencontainers.image.title="Toast-Stats Backend"
LABEL org.opencontainers.image.description="Backend API service for Toast-Stats application"
LABEL org.opencontainers.image.vendor="Toast-Stats"
LABEL org.opencontainers.image.source="https://github.com/your-org/toast-stats"

# Create non-root user for security
# Running as non-root prevents privilege escalation attacks
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files for production dependency installation
COPY package.json package-lock.json ./

# Install production dependencies only
# --omit=dev excludes devDependencies
# Clean npm cache to reduce image size
RUN npm ci --omit=dev && \
    npm cache clean --force

# Copy compiled JavaScript from builder stage
# Only the dist folder is needed, not source TypeScript
COPY --from=builder /app/dist ./dist

# Set ownership to non-root user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Set production environment
ENV NODE_ENV=production

# Default port (can be overridden at runtime)
ENV PORT=5001

# Expose the application port
EXPOSE 5001

# Health check configuration
# Matches the health endpoint defined in Section 6.2
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/health || exit 1

# Start the application
# Using node directly (not npm) for proper signal handling
CMD ["node", "dist/index.js"]
```

#### Template Customization Points

| Element | Customization | Example |
| ------- | ------------- | ------- |
| Image labels | Update for your service | `org.opencontainers.image.title="My Service"` |
| Port | Change default port | `ENV PORT=8080` |
| Health endpoint | Match your health route | `http://localhost:${PORT}/api/health` |
| Entry point | Match your build output | `CMD ["node", "dist/server.js"]` |

---

### 11.2 Health Endpoint Template

This template implements the health check endpoints defined in Section 6.2.

```typescript
// ============================================
// Health Check Endpoints Template
// ============================================
// This template implements the health check pattern
// defined in platform-engineering.md Section 6.2
//
// Endpoints:
//   GET /health       - Liveness probe (is the process running?)
//   GET /health/ready - Readiness probe (is the service ready for traffic?)
// ============================================

import { Router, Request, Response } from 'express'

// Import your storage interface for readiness checks
// Adjust import path based on your project structure
import { ISnapshotStorage } from '../types/storage.js'

/**
 * Health response interface for consistent response structure
 */
interface HealthResponse {
  status: 'healthy' | 'unhealthy'
  timestamp: string
  version: string
  uptime?: number
}

/**
 * Readiness response interface with dependency checks
 */
interface ReadinessResponse {
  status: 'ready' | 'not_ready'
  timestamp: string
  checks: Record<string, boolean>
}

/**
 * Creates health check router with dependency injection
 * 
 * @param storage - Storage service for readiness checks
 * @returns Express router with health endpoints
 */
export function createHealthRouter(storage: ISnapshotStorage): Router {
  const router = Router()

  // ============================================
  // Liveness Probe: GET /health
  // ============================================
  // Purpose: Indicates if the application process is running
  // Requirements:
  //   - MUST respond within 100ms
  //   - MUST NOT check external dependencies
  //   - MUST return 200 if process is running
  // ============================================
  router.get('/health', (req: Request, res: Response) => {
    const response: HealthResponse = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? 'unknown',
      uptime: process.uptime(),
    }

    res.status(200).json(response)
  })

  // ============================================
  // Readiness Probe: GET /health/ready
  // ============================================
  // Purpose: Indicates if the application is ready for traffic
  // Requirements:
  //   - MUST verify critical dependencies
  //   - MUST respond within 500ms
  //   - MUST return 503 if any critical dependency unavailable
  // ============================================
  router.get('/health/ready', async (req: Request, res: Response) => {
    const checks: Record<string, boolean> = {}

    // Check storage availability
    try {
      checks.storage = await storage.isReady()
    } catch {
      checks.storage = false
    }

    // Add additional dependency checks as needed
    // Example: checks.database = await database.ping()
    // Example: checks.cache = await cache.isConnected()

    const allHealthy = Object.values(checks).every(Boolean)

    const response: ReadinessResponse = {
      status: allHealthy ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      checks,
    }

    res.status(allHealthy ? 200 : 503).json(response)
  })

  return router
}

// ============================================
// Usage Example
// ============================================
// In your main application file (e.g., index.ts):
//
// import { createHealthRouter } from './routes/health.js'
// import { getSnapshotStorage } from './services/storage/index.js'
//
// const storage = getSnapshotStorage()
// app.use(createHealthRouter(storage))
// ============================================
```

#### Health Endpoint Response Examples

**Liveness Response (200 OK):**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.2.3",
  "uptime": 3600.5
}
```

**Readiness Response (200 OK):**
```json
{
  "status": "ready",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "checks": {
    "storage": true
  }
}
```

**Readiness Response (503 Service Unavailable):**
```json
{
  "status": "not_ready",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "checks": {
    "storage": false
  }
}
```

---

### 11.3 Structured Logging Template

This template implements the structured logging standards defined in Section 5.6.

```typescript
// ============================================
// Structured Logging Template
// ============================================
// This template implements the structured logging pattern
// defined in platform-engineering.md Section 5.6
//
// Features:
//   - JSON-formatted log output for Cloud Logging
//   - Request ID correlation via AsyncLocalStorage
//   - Environment-aware log levels
//   - Metric logging support
// ============================================

import { AsyncLocalStorage } from 'async_hooks'

// ============================================
// Types
// ============================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  requestId?: string
  userId?: string
  [key: string]: unknown
}

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  environment: string
  requestId?: string
  data?: unknown
}

interface MetricData {
  name: string
  value: number
  unit: string
  labels: Record<string, string>
}

// ============================================
// Async Local Storage for Request Context
// ============================================

const asyncLocalStorage = new AsyncLocalStorage<LogContext>()

/**
 * Run a function with request context available to all loggers
 * Use this in middleware to establish request-scoped context
 */
export function runWithContext<T>(context: LogContext, fn: () => T): T {
  return asyncLocalStorage.run(context, fn)
}

/**
 * Get the current request context
 */
export function getContext(): LogContext | undefined {
  return asyncLocalStorage.getStore()
}

// ============================================
// Logger Implementation
// ============================================

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

function getMinLogLevel(): LogLevel {
  const env = process.env.NODE_ENV ?? 'development'
  // Debug logs only in development
  return env === 'development' ? 'debug' : 'info'
}

function shouldLog(level: LogLevel): boolean {
  const minLevel = getMinLogLevel()
  return LOG_LEVELS[level] >= LOG_LEVELS[minLevel]
}

function formatLogEntry(level: LogLevel, message: string, data?: unknown): LogEntry {
  const context = getContext()
  
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    environment: process.env.NODE_ENV ?? 'development',
    requestId: context?.requestId,
    data,
  }
}

function writeLog(entry: LogEntry): void {
  // Output as single-line JSON for Cloud Logging parsing
  const output = JSON.stringify(entry)
  
  // Use appropriate console method for log level
  switch (entry.level) {
    case 'error':
      console.error(output)
      break
    case 'warn':
      console.warn(output)
      break
    default:
      console.log(output)
  }
}

// ============================================
// Public Logger API
// ============================================

export const logger = {
  /**
   * Debug level logging - development only
   * Use for detailed diagnostic information
   */
  debug(message: string, data?: unknown): void {
    if (shouldLog('debug')) {
      writeLog(formatLogEntry('debug', message, data))
    }
  },

  /**
   * Info level logging - significant events
   * Use for request completion, state changes, etc.
   */
  info(message: string, data?: unknown): void {
    if (shouldLog('info')) {
      writeLog(formatLogEntry('info', message, data))
    }
  },

  /**
   * Warn level logging - recoverable issues
   * Use for deprecations, retry attempts, etc.
   */
  warn(message: string, data?: unknown): void {
    if (shouldLog('warn')) {
      writeLog(formatLogEntry('warn', message, data))
    }
  },

  /**
   * Error level logging - unexpected failures
   * Use for exceptions, unrecoverable errors
   */
  error(message: string, error?: Error | unknown): void {
    if (shouldLog('error')) {
      const errorData = error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : error
      writeLog(formatLogEntry('error', message, errorData))
    }
  },

  /**
   * Log a metric for Cloud Monitoring
   * Use for business metrics, performance data
   */
  metric(metric: MetricData): void {
    if (shouldLog('info')) {
      writeLog(formatLogEntry('info', `Metric: ${metric.name}`, { metric }))
    }
  },
}

// ============================================
// Request Logging Middleware
// ============================================

import { Request, Response, NextFunction } from 'express'
import { randomUUID } from 'crypto'

/**
 * Express middleware for request logging and context setup
 * Establishes request ID and logs request completion
 */
export function requestLoggingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now()
  const requestId = req.get('X-Request-ID') ?? randomUUID()

  // Set request ID in response header for client correlation
  res.set('X-Request-ID', requestId)

  // Run the rest of the request with context
  runWithContext({ requestId }, () => {
    // Log request completion when response finishes
    res.on('finish', () => {
      const duration = Date.now() - startTime

      logger.info('HTTP Request', {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        userAgent: req.get('user-agent')?.substring(0, 100),
      })

      // Log as metric for monitoring
      logger.metric({
        name: 'http_request_duration_ms',
        value: duration,
        unit: 'milliseconds',
        labels: {
          method: req.method,
          path: normalizePath(req.path),
          status: String(res.statusCode),
        },
      })
    })

    next()
  })
}

/**
 * Normalize path for metric labels (remove IDs)
 */
function normalizePath(path: string): string {
  // Replace numeric IDs with placeholder
  return path.replace(/\/\d+/g, '/:id')
    // Replace UUIDs with placeholder
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:uuid')
}
```

#### Log Output Examples

**Info Log:**
```json
{"timestamp":"2024-01-15T10:30:00.000Z","level":"info","message":"HTTP Request","environment":"production","requestId":"550e8400-e29b-41d4-a716-446655440000","data":{"method":"GET","path":"/api/districts/42","statusCode":200,"duration":"45ms"}}
```

**Error Log:**
```json
{"timestamp":"2024-01-15T10:30:00.000Z","level":"error","message":"Failed to fetch district data","environment":"production","requestId":"550e8400-e29b-41d4-a716-446655440000","data":{"name":"TimeoutError","message":"Connection timeout","stack":"Error: Connection timeout\n    at ..."}}
```

**Metric Log:**
```json
{"timestamp":"2024-01-15T10:30:00.000Z","level":"info","message":"Metric: http_request_duration_ms","environment":"production","requestId":"550e8400-e29b-41d4-a716-446655440000","data":{"metric":{"name":"http_request_duration_ms","value":45,"unit":"milliseconds","labels":{"method":"GET","path":"/api/districts/:id","status":"200"}}}}
```

---

### 11.4 Firebase Hosting Headers Template

This template implements the Firebase Hosting configuration with security headers defined in Section 9.3.

```json
{
  "hosting": {
    "public": "dist",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    
    "rewrites": [
      {
        "source": "/api/**",
        "run": {
          "serviceId": "toast-stats-backend",
          "region": "us-central1"
        }
      },
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    
    "headers": [
      {
        "source": "**",
        "headers": [
          {
            "key": "X-Content-Type-Options",
            "value": "nosniff"
          },
          {
            "key": "X-Frame-Options",
            "value": "DENY"
          },
          {
            "key": "X-XSS-Protection",
            "value": "1; mode=block"
          },
          {
            "key": "Referrer-Policy",
            "value": "strict-origin-when-cross-origin"
          },
          {
            "key": "Permissions-Policy",
            "value": "geolocation=(), microphone=(), camera=(), payment=(), usb=()"
          },
          {
            "key": "Strict-Transport-Security",
            "value": "max-age=31536000; includeSubDomains; preload"
          }
        ]
      },
      {
        "source": "**/*.@(js|css)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
          }
        ]
      },
      {
        "source": "**/*.@(jpg|jpeg|gif|png|svg|webp|ico)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=86400"
          }
        ]
      },
      {
        "source": "**/*.@(woff|woff2|ttf|otf|eot)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
          },
          {
            "key": "Access-Control-Allow-Origin",
            "value": "*"
          }
        ]
      },
      {
        "source": "/index.html",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "no-cache, no-store, must-revalidate"
          }
        ]
      },
      {
        "source": "/service-worker.js",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "no-cache, no-store, must-revalidate"
          }
        ]
      }
    ]
  }
}
```

#### Header Configuration Reference

| Header | Purpose | Value |
| ------ | ------- | ----- |
| `X-Content-Type-Options` | Prevent MIME sniffing | `nosniff` |
| `X-Frame-Options` | Prevent clickjacking | `DENY` |
| `X-XSS-Protection` | XSS filter (legacy) | `1; mode=block` |
| `Referrer-Policy` | Control referrer info | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | Disable browser features | Disable unused APIs |
| `Strict-Transport-Security` | Enforce HTTPS | 1 year with preload |

#### Cache Control Strategy

| Asset Type | Cache Strategy | Rationale |
| ---------- | -------------- | --------- |
| JS/CSS (hashed) | Immutable, 1 year | Content-addressed, safe to cache forever |
| Images | 1 day | May change, moderate caching |
| Fonts | Immutable, 1 year | Rarely change |
| index.html | No cache | Must always fetch latest |
| Service Worker | No cache | Must always fetch latest |

#### Template Customization Points

| Element | Customization | Example |
| ------- | ------------- | ------- |
| `public` | Build output directory | `"public": "build"` |
| `serviceId` | Cloud Run service name | `"serviceId": "my-backend"` |
| `region` | Cloud Run region | `"region": "europe-west1"` |
| API path | API route prefix | `"source": "/v1/api/**"` |

---

### 11.5 GitHub Actions Workflow Template

This template implements the CI/CD pipeline defined in Section 7.6.

```yaml
# ============================================
# Toast-Stats CI/CD Pipeline
# ============================================
# This workflow implements the CI/CD pipeline
# defined in platform-engineering.md Section 7.6
#
# Triggers:
#   - Push to main or staging branches
#   - Pull requests to main or staging branches
#
# Jobs:
#   1. quality-gates: TypeScript, lint, format, tests, audit
#   2. build: Docker image build and push
#   3. deploy-staging: Deploy to staging environment
#   4. deploy-production: Deploy to production environment
# ============================================

name: CI/CD Pipeline

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main, staging]

env:
  NODE_VERSION: '22'
  REGISTRY: gcr.io
  PROJECT_ID: ${{ secrets.GCP_PROJECT_ID }}
  REGION: us-central1
  BACKEND_SERVICE: toast-stats-backend

# Prevent concurrent deployments to same environment
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  # ============================================
  # Quality Gates
  # ============================================
  # All quality gates MUST pass before deployment
  # Failures are blocking
  # ============================================
  quality-gates:
    name: Quality Gates
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: |
            backend/package-lock.json
            frontend/package-lock.json
      
      # ----------------------------------------
      # Backend Quality Gates
      # ----------------------------------------
      - name: Install backend dependencies
        run: npm ci
        working-directory: backend
      
      - name: TypeScript check (backend)
        run: npm run typecheck
        working-directory: backend
      
      - name: Lint (backend)
        run: npm run lint
        working-directory: backend
      
      - name: Format check (backend)
        run: npm run format:check
        working-directory: backend
      
      - name: Unit tests (backend)
        run: npm run test
        working-directory: backend
      
      - name: Security audit (backend)
        run: npm audit --audit-level=high
        working-directory: backend
      
      # ----------------------------------------
      # Frontend Quality Gates
      # ----------------------------------------
      - name: Install frontend dependencies
        run: npm ci
        working-directory: frontend
      
      - name: TypeScript check (frontend)
        run: npm run typecheck
        working-directory: frontend
      
      - name: Lint (frontend)
        run: npm run lint
        working-directory: frontend
      
      - name: Format check (frontend)
        run: npm run format:check
        working-directory: frontend
      
      - name: Unit tests (frontend)
        run: npm run test
        working-directory: frontend

  # ============================================
  # Build and Push
  # ============================================
  # Build Docker image and push to registry
  # Only runs on push events (not PRs)
  # ============================================
  build:
    name: Build and Push
    runs-on: ubuntu-latest
    needs: quality-gates
    if: github.event_name == 'push'
    
    outputs:
      image-tag: ${{ steps.meta.outputs.tags }}
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
      
      - name: Configure Docker for GCR
        run: gcloud auth configure-docker
      
      - name: Extract metadata for Docker
        id: meta
        run: |
          echo "tags=${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/${{ env.BACKEND_SERVICE }}:${{ github.sha }}" >> $GITHUB_OUTPUT
      
      - name: Build backend Docker image
        run: |
          docker build \
            --tag ${{ steps.meta.outputs.tags }} \
            --label "org.opencontainers.image.revision=${{ github.sha }}" \
            --label "org.opencontainers.image.created=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
            .
        working-directory: backend
      
      - name: Scan image with Trivy
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ steps.meta.outputs.tags }}
          format: 'table'
          exit-code: '1'
          ignore-unfixed: true
          vuln-type: 'os,library'
          severity: 'CRITICAL,HIGH'
      
      - name: Push backend image to GCR
        run: docker push ${{ steps.meta.outputs.tags }}
      
      # ----------------------------------------
      # Build Frontend
      # ----------------------------------------
      - name: Setup Node.js for frontend build
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      
      - name: Install frontend dependencies
        run: npm ci
        working-directory: frontend
      
      - name: Build frontend
        run: npm run build
        working-directory: frontend
        env:
          VITE_API_URL: ${{ github.ref == 'refs/heads/main' && 'https://toast-stats.web.app/api' || 'https://staging-toast-stats.web.app/api' }}
      
      - name: Upload frontend build artifact
        uses: actions/upload-artifact@v4
        with:
          name: frontend-build
          path: frontend/dist
          retention-days: 1

  # ============================================
  # Deploy to Staging
  # ============================================
  # Deploys to staging environment on staging branch
  # ============================================
  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/staging'
    environment: staging
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
      
      - name: Deploy backend to Cloud Run (staging)
        run: |
          gcloud run deploy ${{ env.BACKEND_SERVICE }} \
            --image ${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/${{ env.BACKEND_SERVICE }}:${{ github.sha }} \
            --region ${{ env.REGION }} \
            --platform managed \
            --memory 512Mi \
            --cpu 1 \
            --concurrency 80 \
            --min-instances 0 \
            --max-instances 2 \
            --set-env-vars NODE_ENV=staging,STORAGE_PROVIDER=gcp \
            --tag staging
      
      - name: Download frontend build
        uses: actions/download-artifact@v4
        with:
          name: frontend-build
          path: frontend/dist
      
      - name: Deploy frontend to Firebase (staging)
        run: |
          npm install -g firebase-tools
          firebase deploy --only hosting:staging --token ${{ secrets.FIREBASE_TOKEN }}

  # ============================================
  # Deploy to Production
  # ============================================
  # Deploys to production environment on main branch
  # ============================================
  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    environment: production
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
      
      - name: Deploy backend to Cloud Run (production)
        run: |
          gcloud run deploy ${{ env.BACKEND_SERVICE }} \
            --image ${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/${{ env.BACKEND_SERVICE }}:${{ github.sha }} \
            --region ${{ env.REGION }} \
            --platform managed \
            --memory 512Mi \
            --cpu 1 \
            --concurrency 80 \
            --min-instances 0 \
            --max-instances 10 \
            --set-env-vars NODE_ENV=production,STORAGE_PROVIDER=gcp
      
      - name: Download frontend build
        uses: actions/download-artifact@v4
        with:
          name: frontend-build
          path: frontend/dist
      
      - name: Deploy frontend to Firebase (production)
        run: |
          npm install -g firebase-tools
          firebase deploy --only hosting --token ${{ secrets.FIREBASE_TOKEN }}
      
      - name: Verify deployment health
        run: |
          # Wait for deployment to stabilize
          sleep 30
          # Check health endpoint
          curl --fail --silent --show-error \
            "https://${{ env.BACKEND_SERVICE }}-${{ env.PROJECT_ID }}.${{ env.REGION }}.run.app/health" \
            | jq .
```

#### Required GitHub Secrets

| Secret | Description | How to Obtain |
| ------ | ----------- | ------------- |
| `GCP_PROJECT_ID` | Google Cloud project ID | GCP Console |
| `GCP_SA_KEY` | Service account JSON key | `gcloud iam service-accounts keys create` |
| `FIREBASE_TOKEN` | Firebase CLI token | `firebase login:ci` |

#### Workflow Customization Points

| Element | Customization | Example |
| ------- | ------------- | ------- |
| `NODE_VERSION` | Node.js version | `'20'` |
| `REGION` | Cloud Run region | `'europe-west1'` |
| `BACKEND_SERVICE` | Service name | `'my-api-service'` |
| Branch names | Trigger branches | `[main, develop]` |
| Max instances | Scaling limits | `--max-instances 20` |

---

### 11.6 Cloud Run Service Configuration Template

This template implements the Cloud Run service configuration defined in Section 7.1.

```yaml
# ============================================
# Toast-Stats Cloud Run Service Configuration
# ============================================
# This template implements the Cloud Run configuration
# defined in platform-engineering.md Section 7.1
#
# Usage:
#   gcloud run services replace service.yaml
#
# Or deploy via gcloud CLI with equivalent flags
# ============================================

apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: toast-stats-backend
  labels:
    app: toast-stats
    component: backend
    environment: production
  annotations:
    # Service-level annotations
    run.googleapis.com/description: "Toast-Stats Backend API Service"
    run.googleapis.com/ingress: all

spec:
  template:
    metadata:
      annotations:
        # ----------------------------------------
        # Autoscaling Configuration
        # ----------------------------------------
        # Scale to zero for cost optimization
        autoscaling.knative.dev/minScale: "0"
        # Maximum instances to prevent runaway costs
        autoscaling.knative.dev/maxScale: "10"
        
        # ----------------------------------------
        # Performance Configuration
        # ----------------------------------------
        # Enable CPU boost during container startup
        run.googleapis.com/startup-cpu-boost: "true"
        # Use second-generation execution environment
        run.googleapis.com/execution-environment: gen2
        
        # ----------------------------------------
        # VPC Configuration (if needed)
        # ----------------------------------------
        # Uncomment to connect to VPC
        # run.googleapis.com/vpc-access-connector: projects/PROJECT/locations/REGION/connectors/CONNECTOR
        # run.googleapis.com/vpc-access-egress: private-ranges-only

    spec:
      # ----------------------------------------
      # Request Timeout
      # ----------------------------------------
      # Maximum time for request processing (seconds)
      # Set higher for long-running operations
      timeoutSeconds: 300
      
      # ----------------------------------------
      # Service Account
      # ----------------------------------------
      # Dedicated service account with least-privilege permissions
      serviceAccountName: toast-stats-backend@PROJECT_ID.iam.gserviceaccount.com
      
      # ----------------------------------------
      # Concurrency
      # ----------------------------------------
      # Maximum concurrent requests per instance
      # 80 is good default for I/O-bound services
      containerConcurrency: 80

      containers:
        - name: backend
          # ----------------------------------------
          # Container Image
          # ----------------------------------------
          # Use specific SHA for reproducible deployments
          image: gcr.io/PROJECT_ID/toast-stats-backend:IMAGE_SHA
          
          # ----------------------------------------
          # Port Configuration
          # ----------------------------------------
          ports:
            - name: http1
              containerPort: 5001
          
          # ----------------------------------------
          # Resource Limits
          # ----------------------------------------
          resources:
            limits:
              # Memory limit (see Section 6.3 for sizing guide)
              memory: 512Mi
              # CPU limit (1 = 1 vCPU)
              cpu: "1"
          
          # ----------------------------------------
          # Environment Variables
          # ----------------------------------------
          env:
            # Runtime environment
            - name: NODE_ENV
              value: production
            
            # Application port
            - name: PORT
              value: "5001"
            
            # Storage provider selection
            - name: STORAGE_PROVIDER
              value: gcp
            
            # Log level
            - name: LOG_LEVEL
              value: info
            
            # V8 heap size (75% of memory limit)
            - name: NODE_OPTIONS
              value: "--max-old-space-size=384"
          
          # ----------------------------------------
          # Secrets from Secret Manager
          # ----------------------------------------
          # Uncomment and configure as needed
          # env:
          #   - name: API_KEY
          #     valueFrom:
          #       secretKeyRef:
          #         name: prod-backend-api-key
          #         key: latest
          
          # ----------------------------------------
          # Startup Probe
          # ----------------------------------------
          # Determines when container is ready to receive traffic
          startupProbe:
            httpGet:
              path: /health
              port: 5001
            # Initial delay before first probe
            initialDelaySeconds: 0
            # Time between probes during startup
            periodSeconds: 2
            # Probe timeout
            timeoutSeconds: 10
            # Number of failures before container is restarted
            failureThreshold: 15
          
          # ----------------------------------------
          # Liveness Probe
          # ----------------------------------------
          # Determines if container should be restarted
          livenessProbe:
            httpGet:
              path: /health
              port: 5001
            # Delay after startup probe succeeds
            initialDelaySeconds: 5
            # Time between probes
            periodSeconds: 30
            # Probe timeout
            timeoutSeconds: 10
            # Number of failures before restart
            failureThreshold: 3

  # ----------------------------------------
  # Traffic Configuration
  # ----------------------------------------
  traffic:
    # Route all traffic to latest revision
    - percent: 100
      latestRevision: true
```

#### Equivalent gcloud CLI Command

```bash
# Deploy using gcloud CLI with equivalent configuration
gcloud run deploy toast-stats-backend \
  --image gcr.io/PROJECT_ID/toast-stats-backend:IMAGE_SHA \
  --region us-central1 \
  --platform managed \
  --service-account toast-stats-backend@PROJECT_ID.iam.gserviceaccount.com \
  --memory 512Mi \
  --cpu 1 \
  --concurrency 80 \
  --timeout 300 \
  --min-instances 0 \
  --max-instances 10 \
  --set-env-vars "NODE_ENV=production,PORT=5001,STORAGE_PROVIDER=gcp,LOG_LEVEL=info,NODE_OPTIONS=--max-old-space-size=384" \
  --execution-environment gen2 \
  --cpu-boost \
  --allow-unauthenticated
```

#### Configuration Reference

| Parameter | Production | Staging | Development |
| --------- | ---------- | ------- | ----------- |
| `minScale` | 0 | 0 | N/A |
| `maxScale` | 10 | 2 | N/A |
| `memory` | 512Mi | 512Mi | N/A |
| `cpu` | 1 | 1 | N/A |
| `concurrency` | 80 | 80 | N/A |
| `timeout` | 300s | 300s | N/A |
| `NODE_ENV` | production | staging | development |
| `STORAGE_PROVIDER` | gcp | gcp | local |

#### Template Customization Points

| Element | Customization | Example |
| ------- | ------------- | ------- |
| Service name | Your service name | `name: my-api-service` |
| Project ID | Your GCP project | `PROJECT_ID` placeholder |
| Region | Deployment region | Set via gcloud `--region` |
| Memory | Based on workload | `memory: 1Gi` |
| Max instances | Based on traffic | `maxScale: "20"` |
| Secrets | Your secret names | Update `secretKeyRef` |

---

## 12. Final Rules

> **Templates are starting points, not rigid constraints.**  
> **Customize templates to fit specific requirements while maintaining compliance.**  
> **When in doubt, refer to the detailed guidance in earlier sections.**  
> **Keep templates synchronized with evolving best practices.**


---

## 13. Appendix

This appendix provides reference materials, governance guidance, and supporting documentation for the steering document suite.

### 13.1 Glossary

This glossary defines key terms used across all steering documents in this repository. Terms are listed alphabetically.

| Term | Definition |
| ---- | ---------- |
| **Acceptance Criteria** | Specific, testable conditions that a feature or change must satisfy to be considered complete. |
| **ADR** | Architecture Decision Record - a document capturing an important architectural decision along with its context and consequences. |
| **Backpressure** | A mechanism to slow down producers when consumers cannot keep up with the rate of data, preventing resource exhaustion. |
| **Blue/Green Deployment** | A deployment strategy using two identical environments where traffic is switched from the current (blue) to the new (green) version. |
| **Circuit Breaker** | A design pattern that prevents cascading failures by failing fast when a downstream service is unavailable or unhealthy. |
| **Cloud Run** | Google Cloud's fully managed serverless platform for running containerized applications with automatic scaling. |
| **Cold Start** | The latency incurred when a new container instance is started to handle a request, including initialization time. |
| **Concurrency** | The maximum number of simultaneous requests a single container instance can handle. |
| **Core Web Vitals** | A set of user-centric metrics (LCP, FID, CLS) that measure real-world user experience on web pages. |
| **DCP** | Distinguished Club Program - Toastmasters International's recognition program for club achievement. |
| **Firestore** | Google Cloud's NoSQL document database for storing and syncing data at scale. |
| **GCS** | Google Cloud Storage - object storage service for storing and accessing data on Google Cloud. |
| **GKE** | Google Kubernetes Engine - managed Kubernetes service for running containerized applications. |
| **Health Check** | An endpoint that reports the operational status of a service, used by orchestrators for liveness and readiness probes. |
| **IAM** | Identity and Access Management - Google Cloud's system for managing access to resources. |
| **Idempotent** | An operation that produces the same result regardless of how many times it is executed. |
| **LCP** | Largest Contentful Paint - a Core Web Vital measuring the time until the largest content element is rendered. |
| **Liveness Probe** | A health check that determines if a container is running; failure triggers container restart. |
| **LRU Cache** | Least Recently Used cache - a cache eviction policy that removes the least recently accessed items first. |
| **Normative** | A document or section that defines mandatory requirements (as opposed to informative/advisory content). |
| **OpenAPI** | A specification for describing RESTful APIs, enabling documentation and code generation. |
| **PBT** | Property-Based Testing - a testing approach that verifies properties hold across randomly generated inputs. |
| **PII** | Personally Identifiable Information - data that can identify an individual, requiring special handling. |
| **Quality Gate** | A checkpoint in the CI/CD pipeline that must pass before code can proceed to the next stage. |
| **Readiness Probe** | A health check that determines if a container is ready to receive traffic; failure removes it from load balancing. |
| **RFC 2119** | A standard defining keywords (MUST, SHOULD, MAY) for use in requirement specifications. |
| **RSS** | Resident Set Size - the total memory allocated to a process, including heap, stack, and code segments. |
| **Scale-to-Zero** | The ability of a serverless platform to reduce instances to zero when there is no traffic, reducing costs. |
| **Service Account** | A special type of account used by applications to authenticate and authorize API calls. |
| **SLO** | Service Level Objective - a target value or range for a service level measured by a service level indicator. |
| **Snapshot** | An immutable, time-specific representation of normalized application data and its derived results. |
| **Steering Document** | An authoritative reference document that defines mandatory standards, patterns, and constraints for a specific domain. |
| **STRIDE** | A threat modeling framework categorizing threats as Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, and Elevation of Privilege. |
| **TTI** | Time to Interactive - a metric measuring when a page becomes fully interactive and responsive to user input. |
| **TTL** | Time to Live - the duration for which cached data remains valid before expiration. |
| **V8 Heap** | The memory region managed by V8's garbage collector for JavaScript objects in Node.js. |
| **WCAG** | Web Content Accessibility Guidelines - standards for making web content accessible to people with disabilities. |
| **Zod** | A TypeScript-first schema validation library used for runtime type checking and data validation. |

### 13.2 Decision Log Template

Architectural decisions SHOULD be recorded using Architecture Decision Records (ADRs). This template provides a standard format for documenting decisions.

#### ADR Template

```markdown
# ADR-XXXX: [Decision Title]

**Status:** [Proposed | Accepted | Deprecated | Superseded by ADR-YYYY]
**Date:** YYYY-MM-DD
**Author:** [Name]
**Reviewers:** [Names]

## Context

[Describe the situation that requires a decision. Include relevant background, constraints, and forces at play.]

## Decision Drivers

- [Driver 1: e.g., Performance requirements]
- [Driver 2: e.g., Cost constraints]
- [Driver 3: e.g., Team expertise]
- [Driver 4: e.g., Maintenance burden]

## Considered Options

### Option 1: [Name]

**Description:** [Brief description of the option]

**Pros:**
- [Advantage 1]
- [Advantage 2]

**Cons:**
- [Disadvantage 1]
- [Disadvantage 2]

### Option 2: [Name]

**Description:** [Brief description of the option]

**Pros:**
- [Advantage 1]
- [Advantage 2]

**Cons:**
- [Disadvantage 1]
- [Disadvantage 2]

## Decision

[State the decision clearly. Use active voice: "We will use X because..."]

## Consequences

### Positive

- [Positive consequence 1]
- [Positive consequence 2]

### Negative

- [Negative consequence 1]
- [Mitigation strategy if applicable]

### Neutral

- [Neutral consequence or trade-off]

## Compliance

- [ ] Decision aligns with steering document requirements
- [ ] Affected steering documents updated (if applicable)
- [ ] Team notified of decision

## References

- [Link to relevant steering document]
- [Link to external documentation]
- [Link to related ADRs]
```

#### ADR Naming Convention

ADRs SHOULD be stored in `docs/adr/` with the following naming convention:

```
docs/adr/
├── 0001-use-cloud-run-over-gke.md
├── 0002-adopt-firestore-for-snapshots.md
├── 0003-implement-storage-abstraction.md
└── README.md  # Index of all ADRs
```

#### When to Create an ADR

An ADR SHOULD be created when:

- Choosing between multiple viable architectural approaches
- Making decisions that are difficult or expensive to reverse
- Deviating from established patterns in steering documents
- Introducing new technologies or frameworks
- Changing existing architectural patterns

An ADR MAY be skipped for:

- Routine implementation decisions within established patterns
- Bug fixes that don't change architecture
- Minor refactoring within existing boundaries

### 13.3 When to Deviate Rubric

Steering documents define mandatory standards, but legitimate exceptions may arise. This rubric defines when deviations are acceptable and the approval process required.

#### Deviation Categories

| Category | Description | Approval Required | Documentation |
| -------- | ----------- | ----------------- | ------------- |
| **Emergency** | Critical production issue requiring immediate action | Post-hoc review within 48 hours | Incident report |
| **Temporary** | Short-term deviation with planned remediation | Team lead approval | ADR with timeline |
| **Permanent** | Long-term exception due to unique constraints | Steering document owner approval | ADR + steering doc update |
| **Experimental** | Proof-of-concept or research exploration | Team lead approval | Time-boxed with review date |

#### Acceptable Reasons for Deviation

Deviations MAY be acceptable when:

1. **Technical Impossibility**: The standard cannot be met due to technical constraints
   - Example: Third-party library requires `any` type in specific interface
   - Mitigation: Isolate the deviation to the smallest possible scope

2. **Performance Requirements**: Meeting the standard would violate performance SLOs
   - Example: Streaming large files requires bypassing storage abstraction
   - Mitigation: Document performance justification with measurements

3. **Security Requirements**: The standard conflicts with security best practices
   - Example: Security scanner requires specific configuration not in standard
   - Mitigation: Document security rationale and review with security team

4. **External Dependencies**: Third-party systems impose incompatible requirements
   - Example: External API requires non-standard authentication pattern
   - Mitigation: Isolate integration code and document constraints

5. **Legacy Migration**: Gradual migration from legacy patterns
   - Example: Existing code cannot be immediately refactored
   - Mitigation: Create migration plan with timeline and track progress

#### Unacceptable Reasons for Deviation

Deviations MUST NOT be approved for:

- **Convenience**: "It's easier this way"
- **Unfamiliarity**: "I don't know how to do it the standard way"
- **Time Pressure**: "We don't have time to do it right" (except Emergency category)
- **Preference**: "I prefer a different approach"

#### Deviation Approval Process

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      DEVIATION APPROVAL WORKFLOW                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────┐ │
│  │   Identify   │──►│   Document   │──►│   Request    │──►│  Review  │ │
│  │   Need       │   │   Rationale  │   │   Approval   │   │          │ │
│  └──────────────┘   └──────────────┘   └──────────────┘   └──────────┘ │
│        │                  │                  │                  │       │
│        ▼                  ▼                  ▼                  ▼       │
│   Why is the         Create ADR         Submit for         Approver    │
│   standard not       with full          appropriate        evaluates   │
│   applicable?        justification      approval level     against     │
│                                                            rubric      │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                         DECISION                                  │  │
│  │                                                                    │  │
│  │   ┌─────────────┐              ┌─────────────┐                   │  │
│  │   │  APPROVED   │              │  REJECTED   │                   │  │
│  │   │             │              │             │                   │  │
│  │   │ - Document  │              │ - Provide   │                   │  │
│  │   │   in ADR    │              │   guidance  │                   │  │
│  │   │ - Set       │              │ - Suggest   │                   │  │
│  │   │   review    │              │   compliant │                   │  │
│  │   │   date      │              │   approach  │                   │  │
│  │   └─────────────┘              └─────────────┘                   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Deviation Documentation Requirements

All approved deviations MUST include:

1. **Scope**: Exactly which files, functions, or components are affected
2. **Rationale**: Why the standard cannot be met
3. **Mitigation**: How negative impacts are minimized
4. **Timeline**: When the deviation will be reviewed or remediated (if temporary)
5. **Owner**: Who is responsible for the deviation and its remediation

#### Deviation Review Schedule

| Category | Review Frequency | Action on Review |
| -------- | ---------------- | ---------------- |
| Emergency | Within 48 hours | Convert to Temporary or remediate |
| Temporary | Monthly | Assess progress toward remediation |
| Permanent | Quarterly | Confirm still necessary |
| Experimental | At time-box expiration | Convert to Permanent, remediate, or extend |

### 13.4 Document Relationships and Precedence

This section defines how steering documents relate to each other and which document takes precedence when guidance overlaps or conflicts.

#### Document Hierarchy

The steering document suite follows a hierarchical structure with clear ownership boundaries:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    STEERING DOCUMENT HIERARCHY                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  TIER 1: DOMAIN-SPECIFIC (Highest Precedence)                           │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ typescript.md    │ testing.md       │ storage-abstraction.md       ││
│  │ git.md           │ api-documentation.md                             ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                              │                                           │
│                              ▼                                           │
│  TIER 2: CROSS-CUTTING STANDARDS                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ platform-engineering.md (this document)                             ││
│  │ - Backend architecture, deployment, observability, security         ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                              │                                           │
│                              ▼                                           │
│  TIER 3: SPECIALIZED GUIDANCE                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ performance-slos.md      │ frontend-standards.md                    ││
│  │ - Performance targets    │ - React patterns, Firebase Hosting       ││
│  │ - Memory management      │ - Frontend build configuration           ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                              │                                           │
│                              ▼                                           │
│  TIER 4: IMPLEMENTATION GUIDANCE (Lowest Precedence)                    │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ modal-dialogs.md         │ property-testing-guidance.md             ││
│  │ toastmasters-brand-guidelines.md │ production-maintenance.md        ││
│  │ testing.eval.md                                                      ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Precedence Rules

When guidance from multiple documents applies to a situation, precedence MUST be resolved as follows:

1. **Tier 1 documents** take precedence over all other tiers for their specific domain
2. **Tier 2 documents** take precedence over Tier 3 and Tier 4 for general platform guidance
3. **Tier 3 documents** take precedence over Tier 4 for their specialized areas
4. **Tier 4 documents** provide implementation details that MUST NOT conflict with higher tiers

#### Document Scope Matrix

| Document | Authoritative Scope | Defers To |
| -------- | ------------------- | --------- |
| **typescript.md** | TypeScript compiler config, type safety, `any` prohibition | None (Tier 1) |
| **testing.md** | Testing philosophy, isolation, coverage expectations | None (Tier 1) |
| **storage-abstraction.md** | Data access patterns, storage providers | None (Tier 1) |
| **git.md** | Commit authorization, version control | None (Tier 1) |
| **api-documentation.md** | OpenAPI specification, endpoint docs | None (Tier 1) |
| **platform-engineering.md** | Backend architecture, deployment, observability, security | Tier 1 documents |
| **performance-slos.md** | Performance targets, memory management | platform-engineering.md |
| **frontend-standards.md** | React patterns, Firebase Hosting | platform-engineering.md, typescript.md |
| **modal-dialogs.md** | Modal implementation patterns | frontend-standards.md |
| **toastmasters-brand-guidelines.md** | Brand colors, typography, accessibility | frontend-standards.md |
| **property-testing-guidance.md** | When to use PBT | testing.md |
| **testing.eval.md** | Test evaluation checklist | testing.md |
| **production-maintenance.md** | Operational context, maintenance posture | platform-engineering.md |

#### Conflict Resolution Process

When apparent conflicts exist between steering documents:

1. **Identify the conflict**: Clearly state which documents and sections conflict
2. **Determine scope**: Identify which document has authoritative scope for the situation
3. **Apply precedence**: Use the precedence rules to determine which guidance applies
4. **Document if unclear**: If precedence is ambiguous, create an ADR to resolve and update documents

#### Cross-Reference Requirements

When steering documents reference each other:

- References MUST use relative markdown links: `[document.md](./document.md)`
- References SHOULD specify the relevant section: "See [testing.md](./testing.md) Section 6"
- References MUST NOT duplicate content from the referenced document
- If content is duplicated for convenience, it MUST be marked as non-authoritative

#### Document Update Coordination

When updating steering documents:

1. **Check dependencies**: Identify documents that reference or are referenced by the updated document
2. **Verify consistency**: Ensure updates don't create conflicts with related documents
3. **Update cross-references**: Fix any broken links or outdated section references
4. **Notify stakeholders**: Inform team members of significant changes to steering guidance

#### Adding New Steering Documents

New steering documents MUST:

1. Define their authoritative scope in Section 1 (Purpose)
2. Specify their tier in the document hierarchy
3. List documents they defer to in their Authority Model section
4. Be added to the Document Scope Matrix in this appendix
5. Use consistent formatting with existing steering documents

New steering documents SHOULD:

- Fill a gap not covered by existing documents
- Not duplicate content from existing documents
- Be reviewed by the owner of related documents before adoption

---

## 14. Final Rules (Updated)

> **Templates are starting points, not rigid constraints.**  
> **Customize templates to fit specific requirements while maintaining compliance.**  
> **When in doubt, refer to the detailed guidance in earlier sections.**  
> **Keep templates synchronized with evolving best practices.**  
> **Deviations require documentation, justification, and appropriate approval.**  
> **Document precedence resolves conflicts; domain-specific documents take priority.**
