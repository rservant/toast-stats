# Design Document: Analytics Date Selection Fix

## Overview

This design addresses the bug where analytics endpoints ignore the `endDate` query parameter and always return data from the latest successful snapshot. The fix introduces a helper function that centralizes date-aware snapshot selection logic, which all affected analytics endpoints will use.

The solution follows the existing architectural pattern in the codebase where `shared.ts` provides common utilities for route handlers. A new helper function `getSnapshotForDate` will encapsulate the logic for selecting the appropriate snapshot based on whether an `endDate` parameter is provided.

## Architecture

The fix follows the existing layered architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│                     Analytics Routes                             │
│  (analytics.ts - individual endpoint handlers)                   │
├─────────────────────────────────────────────────────────────────┤
│                     Shared Utilities                             │
│  (shared.ts - getSnapshotForDate helper)                        │
├─────────────────────────────────────────────────────────────────┤
│                     Snapshot Store                               │
│  (ISnapshotStorage - getSnapshot, getLatestSuccessful)          │
└─────────────────────────────────────────────────────────────────┘
```

### Design Decisions

1. **Centralized Helper Function**: Rather than duplicating the date selection logic in each endpoint, we create a single `getSnapshotForDate` helper in `shared.ts`. This ensures consistency and reduces code duplication.

2. **Backward Compatibility**: When no `endDate` is provided, the behavior remains unchanged (uses `getLatestSuccessful()`). This ensures existing API consumers are not affected.

3. **Explicit Error Handling**: When a requested snapshot doesn't exist, we return a clear 404 error with the `SNAPSHOT_NOT_FOUND` code rather than silently falling back to the latest snapshot.

## Components and Interfaces

### New Helper Function: `getSnapshotForDate`

Location: `backend/src/routes/districts/shared.ts`

```typescript
/**
 * Result of getting a snapshot for a specific date
 */
export interface GetSnapshotForDateResult {
  snapshot: Snapshot | null
  snapshotDate: string | null
  error?: {
    code: string
    message: string
    details: string
  }
}

/**
 * Get a snapshot for a specific date, or the latest successful snapshot if no date provided.
 *
 * @param endDate - Optional ISO date string (YYYY-MM-DD) for the requested snapshot
 * @returns The snapshot and its date, or an error if the requested snapshot doesn't exist
 */
export async function getSnapshotForDate(
  endDate?: string
): Promise<GetSnapshotForDateResult>
```

### Modified Endpoints

Each of the following endpoints will be updated to use `getSnapshotForDate`:

1. `GET /api/districts/:districtId/analytics`
2. `GET /api/districts/:districtId/membership-analytics`
3. `GET /api/districts/:districtId/leadership-insights`
4. `GET /api/districts/:districtId/distinguished-club-analytics`
5. `GET /api/districts/:districtId/vulnerable-clubs`

### Endpoint Modification Pattern

Before (current buggy implementation):

```typescript
const latestSnapshot = await snapshotStore.getLatestSuccessful()
if (!latestSnapshot) {
  // handle no data
}
const snapshotDate = latestSnapshot.snapshot_id
```

After (fixed implementation):

```typescript
const endDate =
  typeof req.query['endDate'] === 'string' ? req.query['endDate'] : undefined
const { snapshot, snapshotDate, error } = await getSnapshotForDate(endDate)

if (error) {
  res.status(404).json({ error })
  return
}

if (!snapshot || !snapshotDate) {
  // handle no data available
}
```

## Data Models

No new data models are required. The fix uses existing types:

- `Snapshot` - Existing type from `backend/src/types/snapshots.ts`
- `ISnapshotStorage` - Existing interface with `getSnapshot(snapshotId)` and `getLatestSuccessful()` methods

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property 1: Date-Aware Snapshot Selection

_For any_ valid ISO date string provided as `endDate`, the `getSnapshotForDate` helper SHALL return the snapshot with that exact `snapshot_id`, or return an error if no such snapshot exists.

**Validates: Requirements 1.1, 2.1, 3.1, 4.1, 5.1**

### Property 2: Error Response for Non-Existent Snapshots

_For any_ date string that does not correspond to an existing snapshot, the helper SHALL return an error object with:

- `code` equal to `SNAPSHOT_NOT_FOUND`
- `message` containing the requested date
- `details` providing guidance to try a different date

**Validates: Requirements 1.3, 2.3, 3.3, 4.3, 5.3, 6.1, 6.2, 6.3, 6.4**

### Property 3: Backward Compatibility - No Date Returns Latest

_For any_ call to `getSnapshotForDate` without an `endDate` parameter (undefined), the helper SHALL return the same snapshot as `snapshotStore.getLatestSuccessful()`.

**Validates: Requirements 1.2, 2.2, 3.2, 4.2, 5.2**

## Error Handling

### Error Scenarios

| Scenario                                   | HTTP Status | Error Code            | Message                                 |
| ------------------------------------------ | ----------- | --------------------- | --------------------------------------- |
| No `endDate` provided, no snapshots exist  | 404         | `NO_DATA_AVAILABLE`   | "No snapshot data available"            |
| `endDate` provided, snapshot doesn't exist | 404         | `SNAPSHOT_NOT_FOUND`  | "Snapshot not found for date {endDate}" |
| Invalid `endDate` format                   | 400         | `INVALID_DATE_FORMAT` | "endDate must be in YYYY-MM-DD format"  |

### Error Response Structure

```typescript
{
  error: {
    code: string // Machine-readable error code
    message: string // Human-readable error message
    details: string // Additional context or suggestions
  }
}
```

## Testing Strategy

Per the Testing Steering Document, property-based tests should only be used when warranted. For this fix:

**Property Test Assessment:**

1. **Mathematical invariants?** No - this is straightforward conditional logic
2. **Complex input spaces?** No - inputs are simple date strings
3. **Would 5 well-chosen examples provide equivalent confidence?** Yes
4. **Algebraic properties?** No

**Conclusion:** Property-based tests are NOT warranted for this fix. Unit tests with well-chosen examples will provide sufficient confidence.

### Unit Tests

Unit tests will verify the `getSnapshotForDate` helper function:

1. **Date-aware selection**: When `endDate` is provided and snapshot exists, returns that snapshot
2. **Backward compatibility**: When no `endDate` provided, returns latest successful snapshot
3. **Error handling**: When `endDate` provided but snapshot doesn't exist, returns proper error structure
4. **Edge cases**: Empty string `endDate`, undefined `endDate`

### Integration Tests

Integration tests will verify end-to-end behavior for one representative endpoint (`/api/districts/:districtId/analytics`):

1. Request with valid `endDate` returns data from that specific snapshot
2. Request without `endDate` returns data from latest snapshot
3. Request with non-existent `endDate` returns 404 with `SNAPSHOT_NOT_FOUND` error

### Test Isolation Requirements

Per Testing Steering Document:

- Tests MUST use unique, isolated resources
- Tests MUST be safe for parallel execution
- Tests MUST use dependency injection for the snapshot store (mock)

## OpenAPI Documentation Updates

Per the API Documentation steering document, the following updates are required:

### Affected Endpoints in `backend/openapi.yaml`

The `endDate` query parameter already exists in the OpenAPI spec for these endpoints. The implementation fix ensures the backend honors this documented parameter. No OpenAPI changes are required since:

1. The `endDate` parameter is already documented
2. The response schemas remain unchanged
3. Only the internal behavior (which snapshot is selected) changes

However, we should verify the 404 response for `SNAPSHOT_NOT_FOUND` is documented.
