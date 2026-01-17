# Design Document: Admin Routes Refactor

## Overview

This design describes the refactoring of `backend/src/routes/admin.ts` (1,478 lines, 16 route handlers) into focused, domain-specific route modules. The refactoring follows the established pattern used in `backend/src/routes/districts/` where routes are split by domain with shared utilities.

The primary goals are:

- Improve maintainability by grouping related endpoints
- Reduce file size to manageable chunks (< 500 lines per module)
- Preserve 100% API compatibility with existing endpoints
- Enable easier testing and future extension

## Architecture

### Directory Structure

```
backend/src/routes/
├── admin/
│   ├── index.ts              # Main router aggregating all sub-routers
│   ├── shared.ts             # Shared middleware and utilities
│   ├── snapshots.ts          # Snapshot management routes
│   ├── district-config.ts    # District configuration routes
│   ├── monitoring.ts         # Health, integrity, performance routes
│   ├── process-separation.ts # Process separation validation routes
│   └── __tests__/
│       ├── snapshots.test.ts
│       ├── district-config.test.ts
│       ├── monitoring.test.ts
│       ├── process-separation.test.ts
│       └── admin.integration.test.ts  # Migrated from current location
├── admin.ts                  # DEPRECATED: Re-exports from admin/index.ts for backward compatibility
└── ...
```

### Router Composition Pattern

Following the established pattern from `districts/index.ts`:

```typescript
// admin/index.ts
import { Router } from 'express'
import { snapshotsRouter } from './snapshots.js'
import { districtConfigRouter } from './district-config.js'
import { monitoringRouter } from './monitoring.js'
import { processSeparationRouter } from './process-separation.js'

const router = Router()

// Mount all route modules
router.use('/', snapshotsRouter)
router.use('/', districtConfigRouter)
router.use('/', monitoringRouter)
router.use('/', processSeparationRouter)

export default router
```

## Components and Interfaces

### Shared Module (`admin/shared.ts`)

The shared module provides common utilities used across all admin route modules.

```typescript
// admin/shared.ts
import { Request, Response, NextFunction } from 'express'
import { logger } from '../../utils/logger.js'
import { getProductionServiceFactory } from '../../services/ProductionServiceFactory.js'

/**
 * Middleware to log admin access
 * Applied to all admin routes for audit trail
 */
export const logAdminAccess = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  logger.info('Admin endpoint accessed', {
    endpoint: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  })
  next()
}

/**
 * Generate unique operation ID for request tracing
 */
export function generateOperationId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Get production service factory instance
 * Centralized access to avoid repeated imports
 */
export function getServiceFactory() {
  return getProductionServiceFactory()
}

/**
 * Standard error response format for admin routes
 */
export interface AdminErrorResponse {
  error: {
    code: string
    message: string
    details?: string
  }
}

/**
 * Standard metadata format for admin responses
 */
export interface AdminResponseMetadata {
  operation_id: string
  duration_ms: number
  generated_at?: string
  retrieved_at?: string
  checked_at?: string
  validated_at?: string
}
```

### Snapshot Routes Module (`admin/snapshots.ts`)

Handles all snapshot management endpoints.

**Endpoints:**

- `GET /snapshots` - List snapshots with filtering
- `GET /snapshots/:snapshotId` - Get snapshot details
- `GET /snapshots/:snapshotId/payload` - Get snapshot payload

**Estimated Lines:** ~350

```typescript
// admin/snapshots.ts
import { Router } from 'express'
import {
  logAdminAccess,
  generateOperationId,
  getServiceFactory,
} from './shared.js'
import { logger } from '../../utils/logger.js'
import { SnapshotFilters } from '../../types/snapshots.js'

export const snapshotsRouter = Router()

snapshotsRouter.get('/snapshots', logAdminAccess, async (req, res) => {
  // Implementation moved from admin.ts
})

snapshotsRouter.get(
  '/snapshots/:snapshotId',
  logAdminAccess,
  async (req, res) => {
    // Implementation moved from admin.ts
  }
)

snapshotsRouter.get(
  '/snapshots/:snapshotId/payload',
  logAdminAccess,
  async (req, res) => {
    // Implementation moved from admin.ts
  }
)
```

### District Configuration Routes Module (`admin/district-config.ts`)

Handles all district configuration management endpoints.

**Endpoints:**

- `GET /districts/config` - Get current configuration
- `POST /districts/config` - Add/replace districts
- `DELETE /districts/config/:districtId` - Remove district
- `POST /districts/config/validate` - Validate configuration
- `GET /districts/config/history` - Get configuration history

**Estimated Lines:** ~450

```typescript
// admin/district-config.ts
import { Router } from 'express'
import {
  logAdminAccess,
  generateOperationId,
  getServiceFactory,
} from './shared.js'
import { logger } from '../../utils/logger.js'
import { DistrictConfigurationService } from '../../services/DistrictConfigurationService.js'

export const districtConfigRouter = Router()

districtConfigRouter.get(
  '/districts/config',
  logAdminAccess,
  async (req, res) => {
    // Implementation moved from admin.ts
  }
)

districtConfigRouter.post(
  '/districts/config',
  logAdminAccess,
  async (req, res) => {
    // Implementation moved from admin.ts
  }
)

districtConfigRouter.delete(
  '/districts/config/:districtId',
  logAdminAccess,
  async (req, res) => {
    // Implementation moved from admin.ts
  }
)

districtConfigRouter.post(
  '/districts/config/validate',
  logAdminAccess,
  async (req, res) => {
    // Implementation moved from admin.ts
  }
)

districtConfigRouter.get(
  '/districts/config/history',
  logAdminAccess,
  async (req, res) => {
    // Implementation moved from admin.ts
  }
)
```

### Monitoring Routes Module (`admin/monitoring.ts`)

Handles all health, integrity, and performance monitoring endpoints.

**Endpoints:**

- `GET /snapshot-store/health` - Check snapshot store health
- `GET /snapshot-store/integrity` - Validate snapshot store integrity
- `GET /snapshot-store/performance` - Get performance metrics
- `POST /snapshot-store/performance/reset` - Reset performance metrics

**Estimated Lines:** ~350

```typescript
// admin/monitoring.ts
import { Router } from 'express'
import {
  logAdminAccess,
  generateOperationId,
  getServiceFactory,
} from './shared.js'
import { logger } from '../../utils/logger.js'
import { FileSnapshotStore } from '../../services/FileSnapshotStore.js'

export const monitoringRouter = Router()

monitoringRouter.get(
  '/snapshot-store/health',
  logAdminAccess,
  async (req, res) => {
    // Implementation moved from admin.ts
  }
)

monitoringRouter.get(
  '/snapshot-store/integrity',
  logAdminAccess,
  async (req, res) => {
    // Implementation moved from admin.ts
  }
)

monitoringRouter.get(
  '/snapshot-store/performance',
  logAdminAccess,
  async (req, res) => {
    // Implementation moved from admin.ts
  }
)

monitoringRouter.post(
  '/snapshot-store/performance/reset',
  logAdminAccess,
  async (req, res) => {
    // Implementation moved from admin.ts
  }
)
```

### Process Separation Routes Module (`admin/process-separation.ts`)

Handles all process separation validation and monitoring endpoints.

**Endpoints:**

- `GET /process-separation/validate` - Validate process separation
- `GET /process-separation/monitor` - Monitor concurrent operations
- `GET /process-separation/compliance` - Get compliance metrics
- `GET /process-separation/independence` - Validate read performance independence

**Estimated Lines:** ~200

```typescript
// admin/process-separation.ts
import { Router } from 'express'
import {
  logAdminAccess,
  generateOperationId,
  getServiceFactory,
} from './shared.js'
import { logger } from '../../utils/logger.js'
import { ProcessSeparationValidator } from '../../services/ProcessSeparationValidator.js'

export const processSeparationRouter = Router()

processSeparationRouter.get(
  '/process-separation/validate',
  logAdminAccess,
  async (req, res) => {
    // Implementation moved from admin.ts
  }
)

processSeparationRouter.get(
  '/process-separation/monitor',
  logAdminAccess,
  async (req, res) => {
    // Implementation moved from admin.ts
  }
)

processSeparationRouter.get(
  '/process-separation/compliance',
  logAdminAccess,
  async (req, res) => {
    // Implementation moved from admin.ts
  }
)

processSeparationRouter.get(
  '/process-separation/independence',
  logAdminAccess,
  async (req, res) => {
    // Implementation moved from admin.ts
  }
)
```

## Data Models

No new data models are introduced. The refactoring preserves all existing request/response structures:

### Existing Response Structures (Preserved)

```typescript
// Snapshot list response
interface SnapshotListResponse {
  snapshots: SnapshotMetadata[]
  metadata: {
    total_count: number
    filters_applied: SnapshotFilters
    limit_applied: number | undefined
    query_duration_ms: number
    generated_at: string
  }
}

// Health check response
interface HealthCheckResponse {
  health: {
    is_ready: boolean
    current_snapshot: SnapshotSummary | null
    latest_snapshot: SnapshotSummary | null
    recent_activity: RecentActivitySummary
    store_status: StoreStatus
  }
  metadata: AdminResponseMetadata
}

// District configuration response
interface DistrictConfigResponse {
  configuration: DistrictConfiguration
  status: {
    hasConfiguredDistricts: boolean
    totalDistricts: number
  }
  validation: ValidationResult
  metadata: AdminResponseMetadata
}
```

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property 1: API Path Preservation (Round-Trip)

_For any_ valid HTTP request to an admin endpoint path that existed before refactoring, the refactored router SHALL route the request to a handler that produces an identical response structure.

**Validates: Requirements 5.1, 5.2, 5.3**

### Property 2: Router Delegation Correctness

_For any_ HTTP request to an admin endpoint, the Admin_Router SHALL delegate to exactly one sub-router based on the request path prefix, and that sub-router SHALL handle the request completely.

**Validates: Requirements 1.5, 2.6, 3.7, 4.3**

### Property 3: Middleware Application Consistency

_For any_ HTTP request to any admin endpoint, the logAdminAccess middleware SHALL be invoked exactly once before the route handler executes.

**Validates: Requirements 5.4, 6.2**

### Property 4: Response Format Equivalence

_For any_ valid request to an existing admin endpoint, the response body structure (JSON keys and value types) SHALL be identical before and after refactoring.

**Validates: Requirements 5.2, 5.3**

## Error Handling

Error handling patterns are preserved from the existing implementation:

### Standard Error Response Format

```typescript
{
  error: {
    code: string,      // e.g., 'SNAPSHOT_NOT_FOUND', 'INVALID_DISTRICT_ID'
    message: string,   // Human-readable error message
    details?: string   // Optional additional context
  }
}
```

### HTTP Status Codes (Preserved)

| Status | Usage                             |
| ------ | --------------------------------- |
| 200    | Successful operation              |
| 400    | Invalid request parameters        |
| 404    | Resource not found                |
| 500    | Internal server error             |
| 503    | Service unavailable (no snapshot) |

### Error Handling Pattern

Each route handler follows the established pattern:

```typescript
try {
  // Operation logic
  logger.info('Operation completed', { operation_id, duration_ms })
  res.json({ data, metadata })
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error'
  logger.error('Operation failed', {
    operation_id,
    error: errorMessage,
    duration_ms,
  })
  res.status(500).json({
    error: {
      code: 'OPERATION_FAILED',
      message: 'Failed to perform operation',
      details: errorMessage,
    },
  })
}
```

## Testing Strategy

### Dual Testing Approach

The refactoring requires both unit tests and property-based tests to ensure correctness:

**Unit Tests:**

- Verify specific endpoint behaviors
- Test error conditions and edge cases
- Validate request parameter handling

**Property-Based Tests:**

- Verify API equivalence across all endpoints
- Test middleware application consistency
- Validate response structure preservation

### Test Organization

```
backend/src/routes/admin/__tests__/
├── snapshots.test.ts           # Unit tests for snapshot routes
├── district-config.test.ts     # Unit tests for district config routes
├── monitoring.test.ts          # Unit tests for monitoring routes
├── process-separation.test.ts  # Unit tests for process separation routes
├── shared.test.ts              # Unit tests for shared utilities
├── api-equivalence.property.test.ts  # Property tests for API preservation
└── admin.integration.test.ts   # Migrated integration tests
```

### Property-Based Testing Configuration

- **Framework:** fast-check (already used in the codebase)
- **Minimum iterations:** 100 per property test
- **Tag format:** `Feature: admin-routes-refactor, Property N: [property_text]`

### Test Migration Strategy

1. Move existing `admin.integration.test.ts` to new location
2. Update imports to use new module structure
3. Verify all existing tests pass without modification
4. Add new unit tests for each route module
5. Add property tests for API equivalence

## Design Decisions

### Decision 1: Follow Existing Pattern from districts/

**Rationale:** The `districts/` route organization provides a proven pattern with:

- Clear separation of concerns
- Shared utilities module
- Index file for router composition
- Co-located tests

This consistency reduces cognitive load for maintainers.

### Decision 2: Preserve Original admin.ts as Re-export

**Rationale:** To ensure zero breaking changes for any code importing from `admin.ts`:

```typescript
// backend/src/routes/admin.ts (after refactor)
export { default } from './admin/index.js'
```

This allows gradual migration of imports while maintaining backward compatibility.

### Decision 3: Shared Middleware in Dedicated Module

**Rationale:** Centralizing `logAdminAccess` and utility functions in `shared.ts`:

- Ensures consistent middleware application
- Reduces code duplication
- Makes testing easier
- Follows the pattern established in `districts/shared.ts`

### Decision 4: Route Module Size Limits

**Rationale:** The requirements specify maximum line counts:

- Snapshot routes: ≤400 lines
- District config routes: ≤500 lines
- Monitoring routes: ≤400 lines
- Process separation routes: ≤200 lines

These limits ensure each module remains focused and maintainable.

## Migration Notes

### Backward Compatibility

The refactoring MUST maintain:

1. All existing endpoint paths unchanged
2. All request parameter handling unchanged
3. All response structures unchanged
4. All HTTP status codes unchanged
5. All error response formats unchanged

### Import Path Changes

After refactoring, imports can use either:

```typescript
// Old path (still works via re-export)
import adminRoutes from '../routes/admin.js'

// New path (preferred)
import adminRoutes from '../routes/admin/index.js'
```

### Verification Checklist

Before completing the refactoring:

- [ ] All existing integration tests pass
- [ ] All endpoints respond at original paths
- [ ] Response structures match original implementation
- [ ] Middleware logging occurs on all routes
- [ ] No TypeScript compilation errors
- [ ] Each module is within line count limits
