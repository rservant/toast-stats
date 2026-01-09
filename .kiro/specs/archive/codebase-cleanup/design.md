# Design Document: Codebase Cleanup

## Overview

This design document outlines the approach for cleaning up the Toast-Stats codebase by removing legacy code, splitting large files, consolidating duplicated functionality, and simplifying test infrastructure. The cleanup is organized into five phases that can be executed incrementally.

## Architecture

### Current State

```
backend/src/
├── routes/
│   ├── districts.ts          # 4000+ lines, monolithic
│   └── admin.ts
├── services/
│   ├── CacheManager.ts       # Legacy, to be removed
│   ├── RealToastmastersAPIService.ts  # Legacy, to be removed
│   ├── PerDistrictSnapshotStore.ts    # Current architecture
│   ├── FileSnapshotStore.ts           # Current architecture
│   ├── __inspect-*.ts        # Debug scripts, to be removed
│   └── ...
└── utils/
    ├── TestPerformanceMonitor.ts      # Potentially unused
    ├── TestReliabilityMonitor.ts      # Potentially unused
    └── ...

frontend/src/
├── hooks/
│   ├── useBackfill.ts        # To be consolidated
│   └── useDistrictBackfill.ts # To be removed after consolidation
├── context/                   # Duplicate folder
│   └── AuthContext.tsx
├── contexts/                  # Primary folder
│   ├── BackfillContext.tsx
│   └── ProgramYearContext.tsx
└── components/
    ├── BrandComplianceDemo.tsx    # Unused, to be removed
    └── Navigation/
        └── NavigationExample.tsx  # Unused, to be removed
```

### Target State

```
backend/src/
├── routes/
│   └── districts/
│       ├── index.ts          # Composes all modules
│       ├── core.ts           # Core district data endpoints
│       ├── analytics.ts      # Analytics endpoints
│       ├── backfill.ts       # Backfill operations
│       ├── snapshots.ts      # Snapshot management (replaces cache)
│       └── shared.ts         # Shared utilities and middleware
├── services/
│   ├── PerDistrictSnapshotStore.ts
│   ├── FileSnapshotStore.ts
│   └── ... (no legacy services)
└── utils/
    └── ... (simplified test infrastructure)

frontend/src/
├── hooks/
│   └── useBackfill.ts        # Unified hook
├── contexts/                  # Single context folder
│   ├── AuthContext.tsx       # Moved from context/
│   ├── BackfillContext.tsx
│   └── ProgramYearContext.tsx
└── components/
    └── ... (no unused demo components)
```

## Components and Interfaces

### Phase 1: Legacy CacheManager Removal

#### Files to Remove

- `backend/src/services/CacheManager.ts`
- `backend/src/services/RealToastmastersAPIService.ts`
- `backend/src/services/__tests__/RealToastmastersAPIService.test.ts`
- `backend/scripts/migrate-cache.ts`
- `backend/scripts/clear-rankings-cache.ts`

#### Endpoint Migration Strategy

The legacy cache endpoints will be either removed or reimplemented using the snapshot store:

| Legacy Endpoint             | Action  | New Implementation                             |
| --------------------------- | ------- | ---------------------------------------------- |
| `GET /cache/dates`          | Migrate | Use `perDistrictSnapshotStore.listSnapshots()` |
| `GET /cache/statistics`     | Remove  | Not used by frontend                           |
| `GET /cache/metadata/:date` | Remove  | Not used by frontend                           |
| `GET /cache/version`        | Remove  | Not used by frontend                           |
| `GET /cache/stats`          | Remove  | Not used by frontend                           |
| `DELETE /cache`             | Remove  | Admin can use snapshot management              |
| `GET /available-dates`      | Migrate | Use snapshot store                             |

### Phase 2: Routes File Split

#### Module Structure

```typescript
// backend/src/routes/districts/shared.ts
export const validateDistrictId = (districtId: string): boolean => { ... }
export const getValidDistrictId = (req: Request): string | null => { ... }
export const createErrorResponse = (message: string, code: string) => { ... }

// Shared service instances
export const perDistrictSnapshotStore: PerDistrictFileSnapshotStore
export const districtDataAggregator: DistrictDataAggregator
export const analyticsEngine: AnalyticsEngine
export const backfillService: BackfillService
export const refreshService: RefreshService
```

```typescript
// backend/src/routes/districts/core.ts
// Endpoints: GET /, GET /:districtId, GET /:districtId/clubs, etc.
export const coreRouter = Router()
```

```typescript
// backend/src/routes/districts/analytics.ts
// Endpoints: GET /:districtId/analytics, GET /:districtId/trends, etc.
export const analyticsRouter = Router()
```

```typescript
// backend/src/routes/districts/backfill.ts
// Endpoints: POST /backfill, GET /backfill/:id, DELETE /backfill/:id, etc.
export const backfillRouter = Router()
```

```typescript
// backend/src/routes/districts/snapshots.ts
// Endpoints: GET /snapshots, GET /snapshots/:id, GET /:districtId/cached-dates
export const snapshotsRouter = Router()
```

```typescript
// backend/src/routes/districts/index.ts
import { coreRouter } from './core.js'
import { analyticsRouter } from './analytics.js'
import { backfillRouter } from './backfill.js'
import { snapshotsRouter } from './snapshots.js'

const router = Router()
router.use('/', coreRouter)
router.use('/', analyticsRouter)
router.use('/', backfillRouter)
router.use('/', snapshotsRouter)

export default router
```

### Phase 3: Backfill Hooks Consolidation

#### Unified Hook Interface

```typescript
// frontend/src/hooks/useBackfill.ts

interface BackfillOptions {
  districtId?: string  // If provided, uses district-specific endpoints
}

interface UseBackfillResult {
  initiateBackfill: UseMutationResult<BackfillResponse, Error, BackfillRequest>
  backfillStatus: UseQueryResult<BackfillResponse, Error>
  cancelBackfill: UseMutationResult<void, Error, string>
}

export function useBackfill(options?: BackfillOptions): UseBackfillResult {
  const { districtId } = options ?? {}

  // Determine endpoint based on whether districtId is provided
  const baseUrl = districtId
    ? `/districts/${districtId}/backfill`
    : '/districts/backfill'

  // ... implementation
}

// Convenience hooks for backward compatibility
export function useInitiateBackfill(districtId?: string) { ... }
export function useBackfillStatus(backfillId: string | null, districtId?: string) { ... }
export function useCancelBackfill(districtId?: string) { ... }
```

### Phase 4: Test Infrastructure Simplification

#### Analysis of Test Utilities

| Utility                         | Location           | Used By                   | Action            |
| ------------------------------- | ------------------ | ------------------------- | ----------------- |
| `TestPerformanceMonitor`        | backend/utils      | Own tests only            | Remove            |
| `TestReliabilityMonitor`        | backend/utils      | Own tests, property tests | Keep (simplified) |
| `IntegratedTestMonitor`         | backend/utils      | Not imported              | Remove            |
| `BackendTestPerformanceMonitor` | backend/utils      | test-infrastructure.ts    | Consolidate       |
| `testPerformanceMonitor`        | frontend/**tests** | Test infrastructure       | Keep              |

#### Simplified Test Infrastructure

```typescript
// backend/src/utils/test-helpers.ts
// Consolidated test utilities

export interface TestContext {
  testDir: string
  cleanup: () => Promise<void>
}

export function createTestContext(testName: string): TestContext { ... }
export function createIsolatedTestDir(): string { ... }
export function cleanupTestDir(dir: string): Promise<void> { ... }
```

### Phase 5: Dead Code Removal

#### Files to Remove

**Backend Debug Scripts:**

- `backend/src/services/__inspect-all-districts.ts`
- `backend/src/services/__inspect-club-page.ts`
- `backend/src/services/__inspect-csv.ts`
- `backend/src/services/__inspect-page.ts`
- `backend/src/services/__inspect-statuses.ts`
- `backend/src/services/__scrape-districts.ts`
- `backend/src/services/__test-cache.ts`
- `backend/src/services/__test-scraper.ts`

**Unused Monitor:**

- `backend/src/services/ProcessSeparationMonitor.ts` (commented out in admin.ts)

**Frontend Demo Components:**

- `frontend/src/components/BrandComplianceDemo.tsx`
- `frontend/src/components/Navigation/NavigationExample.tsx`

#### Context Folder Consolidation

Move `frontend/src/context/AuthContext.tsx` to `frontend/src/contexts/AuthContext.tsx` and update all imports. Remove the empty `frontend/src/context/` folder.

## Data Models

No changes to data models. This cleanup is focused on code organization and removal of unused code.

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property 1: Existing Functionality Preservation

_For any_ API endpoint that existed before the cleanup, calling that endpoint with the same parameters SHALL return a response with the same structure and semantically equivalent data.

**Validates: Requirements 1.6, 2.7, 3.3, 4.4, 5.5**

### Property 2: Unified Backfill Hook Behavior

_For any_ backfill operation, the unified hook SHALL route to the correct endpoint based on whether a district ID is provided: district-specific endpoint when districtId is present, global endpoint when districtId is absent.

**Validates: Requirements 3.2, 3.5, 3.6**

### Property 3: Route Module Composition

_For any_ request to the districts API, the composed router SHALL handle the request identically to the original monolithic router, preserving all middleware execution order and response formatting.

**Validates: Requirements 2.7**

## Error Handling

### Removal Verification

Before removing any file:

1. Search for all imports of the file
2. Search for all string references to exported symbols
3. Run the full test suite
4. Verify no runtime errors in development mode

### Rollback Strategy

Each phase can be rolled back independently:

- Phase 1: Restore CacheManager and related files from git
- Phase 2: Restore original districts.ts from git
- Phase 3: Restore separate backfill hooks from git
- Phase 4: Restore test utilities from git
- Phase 5: Restore removed files from git

## Testing Strategy

### Dual Testing Approach

This cleanup primarily relies on existing tests to verify correctness. New tests are minimal:

**Unit Tests:**

- Verify route module composition works correctly
- Verify unified backfill hook routes to correct endpoints
- Verify shared utilities work as expected

**Property Tests:**

- Property 1 is verified by running the existing test suite
- Property 2 can be tested with a simple property test for endpoint routing
- Property 3 is verified by existing integration tests

### Test Execution Plan

1. Run full test suite before any changes (baseline)
2. After each phase, run full test suite
3. Compare test results to baseline
4. Any test failures must be investigated and resolved before proceeding

### Property-Based Testing Configuration

- Use Vitest with fast-check for property tests
- Minimum 100 iterations per property test
- Tag format: **Feature: codebase-cleanup, Property {number}: {property_text}**
