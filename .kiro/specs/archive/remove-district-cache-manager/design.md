# Design Document

## Overview

This design covers the removal of the legacy `DistrictCacheManager` service and migration of the `/cached-dates` endpoint to use `PerDistrictSnapshotStore`. The migration is straightforward since the new snapshot store already provides all necessary functionality through `PerDistrictFileSnapshotStore.listSnapshots()` and related methods.

The key changes are:

1. Migrate the `/cached-dates` endpoint to query `PerDistrictSnapshotStore` instead of `DistrictCacheManager`
2. Remove the unused `/data/:date` endpoint
3. Delete `DistrictCacheManager` and its interface
4. Clean up related tests and frontend code

## Architecture

```mermaid
graph TD
    subgraph "Before (Legacy)"
        FE1[Frontend: useDistrictCachedDates] --> EP1[GET /cached-dates]
        EP1 --> DCM[DistrictCacheManager]
        DCM --> FS1[cache/districts/{id}/{date}.json]
    end

    subgraph "After (Migrated)"
        FE2[Frontend: useDistrictCachedDates] --> EP2[GET /cached-dates]
        EP2 --> PDSS[PerDistrictSnapshotStore]
        PDSS --> FS2[cache/snapshots/{date}/district_{id}.json]
    end
```

## Components and Interfaces

### Migrated Endpoint: GET /api/districts/:districtId/cached-dates

The endpoint will be updated to use `PerDistrictSnapshotStore` and `DistrictDataAggregator`:

```typescript
/**
 * GET /api/districts/:districtId/cached-dates
 * List all available snapshot dates for a district
 *
 * Response format (unchanged):
 * {
 *   districtId: string,
 *   dates: string[],      // YYYY-MM-DD format, sorted ascending
 *   count: number,
 *   dateRange: { startDate: string, endDate: string } | null
 * }
 */
router.get('/:districtId/cached-dates', async (req: Request, res: Response) => {
  const districtId = getValidDistrictId(req)

  if (!districtId) {
    res.status(400).json({
      error: {
        code: 'INVALID_DISTRICT_ID',
        message: 'Invalid district ID format',
      },
    })
    return
  }

  // Get all successful snapshots
  const snapshots = await perDistrictSnapshotStore.listSnapshots()

  // Filter to snapshots that contain this district and are successful
  const districtDates: string[] = []
  for (const snapshot of snapshots) {
    if (snapshot.status !== 'success') continue

    // Check if district exists in this snapshot
    const districts = await perDistrictSnapshotStore.listDistrictsInSnapshot(
      snapshot.snapshot_id
    )
    if (districts.includes(districtId)) {
      districtDates.push(snapshot.snapshot_id) // snapshot_id is YYYY-MM-DD format
    }
  }

  // Sort dates ascending
  const sortedDates = districtDates.sort()

  // Calculate date range
  const dateRange =
    sortedDates.length > 0
      ? {
          startDate: sortedDates[0],
          endDate: sortedDates[sortedDates.length - 1],
        }
      : null

  res.json({
    districtId,
    dates: sortedDates,
    count: sortedDates.length,
    dateRange,
  })
})
```

### Files to Remove

| File                                                                          | Reason                                              |
| ----------------------------------------------------------------------------- | --------------------------------------------------- |
| `backend/src/services/DistrictCacheManager.ts`                                | Legacy service replaced by PerDistrictSnapshotStore |
| `backend/src/services/__tests__/CacheManager.initialization.property.test.ts` | Tests DistrictCacheManager initialization           |
| `backend/src/services/__tests__/CacheManager.error-handling.property.test.ts` | Tests DistrictCacheManager error handling           |
| `backend/src/services/__tests__/ConfigurationInjection.property.test.ts`      | References DistrictCacheManager                     |

### Files to Modify

| File                                                                      | Changes                                                                                                      |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `backend/src/routes/districts.ts`                                         | Remove DistrictCacheManager import and instance, migrate /cached-dates endpoint, remove /data/:date endpoint |
| `backend/src/types/serviceInterfaces.ts`                                  | Remove IDistrictCacheManager interface                                                                       |
| `backend/src/services/TestServiceFactory.ts`                              | Remove IDistrictCacheManager registration and createDistrictCacheManager method                              |
| `backend/src/services/__tests__/InterfaceBasedInjection.property.test.ts` | Remove IDistrictCacheManager references                                                                      |
| `frontend/src/hooks/useDistrictData.ts`                                   | Remove useDistrictData hook, keep useDistrictCachedDates and types needed by it                              |

## Data Models

### Response Format (Unchanged)

The `/cached-dates` endpoint response format remains the same to maintain frontend compatibility:

```typescript
interface CachedDatesResponse {
  districtId: string
  dates: string[] // Array of YYYY-MM-DD date strings
  count: number // Number of available dates
  dateRange: {
    startDate: string // Earliest date (YYYY-MM-DD)
    endDate: string // Latest date (YYYY-MM-DD)
  } | null // null if no dates available
}
```

### Mapping from Snapshot Store

| DistrictCacheManager                    | PerDistrictSnapshotStore                   |
| --------------------------------------- | ------------------------------------------ |
| `getCachedDatesForDistrict(districtId)` | `listSnapshots()` + filter by district     |
| `getDistrictDataRange(districtId)`      | Derived from filtered snapshot list        |
| `getDistrictData(districtId, date)`     | `readDistrictData(snapshotId, districtId)` |

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property 1: Cached Dates Source Correctness

_For any_ valid district ID, the `/cached-dates` endpoint SHALL return dates that correspond to successful snapshots in the PerDistrictSnapshotStore that contain data for that district.

**Validates: Requirements 1.1, 1.4**

### Property 2: Response Format Consistency

_For any_ request to the `/cached-dates` endpoint, the response SHALL contain all required fields (districtId, dates, count, dateRange) with correct types and the count SHALL equal the length of the dates array.

**Validates: Requirements 1.2**

### Property 3: Date Range Derivation

_For any_ non-empty dates array returned by the `/cached-dates` endpoint, the dateRange.startDate SHALL equal the minimum date and dateRange.endDate SHALL equal the maximum date in the array.

**Validates: Requirements 1.2**

## Error Handling

| Scenario                   | Response                                             |
| -------------------------- | ---------------------------------------------------- |
| Invalid district ID format | 400 Bad Request with `INVALID_DISTRICT_ID` code      |
| No snapshots for district  | 200 OK with empty dates array and null dateRange     |
| Snapshot store unavailable | 500 Internal Server Error with `SNAPSHOT_ERROR` code |

## Testing Strategy

### Unit Tests

Since this is primarily a removal/migration task, unit tests focus on:

- Verifying the migrated endpoint returns correct data format
- Verifying empty response when no snapshots exist for a district

### Property Tests

Property tests validate:

- Response format consistency (Property 2)
- Date range derivation correctness (Property 3)

### Integration Tests

- Verify the district detail page date selector works with the migrated endpoint
- Verify no regressions in existing functionality

### Test Removal

The following test files will be removed as they test the legacy DistrictCacheManager:

- `CacheManager.initialization.property.test.ts` - Tests DistrictCacheManager initialization
- `CacheManager.error-handling.property.test.ts` - Tests DistrictCacheManager error handling
- `ConfigurationInjection.property.test.ts` - References DistrictCacheManager

The `InterfaceBasedInjection.property.test.ts` file will be updated to remove IDistrictCacheManager references.
