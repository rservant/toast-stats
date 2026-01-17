# Design Document: Date-Aware District Statistics

## Overview

The Date-Aware District Statistics feature addresses a data consistency issue where the Division & Area Performance section displays data from a different date than the user's selected date. Currently, the `useDistrictStatistics` hook always fetches the latest snapshot, ignoring the date selection that correctly controls other dashboard sections like District Overview.

This feature modifies the frontend hook, backend API endpoint, and page integration to ensure the Division & Area Performance Cards display data matching the user's selected date, providing a consistent experience across all dashboard sections.

## Architecture

### Current Data Flow (Problem)

```
DistrictDetailPage
├── selectedDate (from ProgramYearContext)
├── useDistrictAnalytics(districtId, startDate, selectedDate) ✓ Date-aware
└── useDistrictStatistics(districtId) ✗ Always latest snapshot
    └── GET /api/districts/:districtId/statistics (no date param)
        └── serveDistrictFromPerDistrictSnapshot() → getLatestSuccessful()
```

### Proposed Data Flow (Solution)

```
DistrictDetailPage
├── selectedDate (from ProgramYearContext)
├── useDistrictAnalytics(districtId, startDate, selectedDate) ✓ Date-aware
└── useDistrictStatistics(districtId, selectedDate) ✓ Date-aware
    └── GET /api/districts/:districtId/statistics?date=YYYY-MM-DD
        └── serveDistrictFromPerDistrictSnapshotByDate()
            ├── If date provided: getSnapshot(date) or findNearestSnapshot(date)
            └── If no date: getLatestSuccessful() (backward compatible)
```

### Integration Points

- **DistrictDetailPage**: Existing page that will pass `selectedDate` to `useDistrictStatistics`
- **useMembershipData.ts**: Hook that will accept optional `selectedDate` parameter
- **Backend /statistics endpoint**: Will accept optional `date` query parameter
- **shared.ts utilities**: Existing `findNearestSnapshot` function for fallback behavior
- **DivisionPerformanceCards**: Existing component that receives `districtStatistics.asOfDate`

## Components and Interfaces

### Frontend Hook Enhancement

**File**: `frontend/src/hooks/useMembershipData.ts`

**Current Signature**:

```typescript
export const useDistrictStatistics = (districtId: string | null)
```

**New Signature**:

```typescript
export const useDistrictStatistics = (
  districtId: string | null,
  selectedDate?: string
)
```

**Changes**:

- Add optional `selectedDate` parameter
- Include `selectedDate` in query key for proper cache invalidation
- Pass `date` query parameter to API when `selectedDate` is provided

### Frontend Page Integration

**File**: `frontend/src/pages/DistrictDetailPage.tsx`

**Current Call** (Line ~117):

```typescript
const { data: districtStatistics, isLoading: isLoadingStatistics } =
  useDistrictStatistics(districtId || null)
```

**New Call**:

```typescript
const { data: districtStatistics, isLoading: isLoadingStatistics } =
  useDistrictStatistics(
    districtId || null,
    selectedDate || selectedProgramYear.endDate
  )
```

**Rationale**: This matches the pattern used by `useDistrictAnalytics` on line 108, ensuring consistent date handling across all data fetching hooks.

### Backend API Enhancement

**File**: `backend/src/routes/districts/core.ts`

**Endpoint**: `GET /api/districts/:districtId/statistics`

**New Query Parameter**:

- `date` (optional): ISO date string (YYYY-MM-DD)

**Behavior**:

- When `date` is provided: Return snapshot for that date, with fallback to nearest
- When `date` is not provided: Return latest snapshot (current behavior)

### Backend Helper Function

**File**: `backend/src/routes/districts/shared.ts`

**New Function**:

```typescript
export async function serveDistrictFromPerDistrictSnapshotByDate<T>(
  res: Response,
  districtId: string,
  requestedDate: string | undefined,
  dataExtractor: (district: DistrictStatistics) => T,
  errorContext: string
): Promise<T | null>
```

**Responsibilities**:

- If `requestedDate` is provided, attempt to get snapshot for that date
- If exact date not found, use `findNearestSnapshot()` for fallback
- If no `requestedDate`, delegate to existing `serveDistrictFromPerDistrictSnapshot()`
- Include fallback metadata in response when applicable

## Data Models

### API Response Enhancement

The existing `DistrictStatistics` response will include enhanced `_snapshot_metadata`:

```typescript
interface SnapshotResponseMetadata {
  snapshot_id: string
  created_at: string
  schema_version: string
  calculation_version: string
  data_as_of: string
  // Existing closing period fields
  is_closing_period_data?: boolean
  collection_date?: string
  logical_date?: string
  // New fallback fields (when date parameter used)
  fallback?: {
    requested_date: string
    actual_snapshot_date: string
    fallback_reason:
      | 'no_snapshot_for_date'
      | 'closing_period_gap'
      | 'future_date'
    is_closing_period_data?: boolean
  }
}
```

### Query Key Structure

**Current**:

```typescript
queryKey: ['districtStatistics', districtId]
```

**New**:

```typescript
queryKey: ['districtStatistics', districtId, selectedDate]
```

**Rationale**: Including `selectedDate` in the query key ensures React Query properly caches and invalidates data when the date changes.

## Correctness Properties

### Property 1: Date Parameter Propagation

_For any_ valid district ID and date combination, when `useDistrictStatistics` is called with a `selectedDate`, the API request MUST include that date as a query parameter.

**Validates: Requirements 4.1, 4.2**

### Property 2: Query Key Uniqueness

_For any_ two calls to `useDistrictStatistics` with different `selectedDate` values, the query keys MUST be different, ensuring separate cache entries.

**Validates: Requirements 4.1 (cache invalidation)**

### Property 3: Backward Compatibility

_For any_ call to `useDistrictStatistics` without a `selectedDate` parameter, the behavior MUST be identical to the current implementation (returns latest snapshot).

**Validates: Requirements 6.2**

### Property 4: Date Format Validation

_For any_ date parameter passed to the API, if the format is not YYYY-MM-DD, the API MUST return a 400 error with code `INVALID_DATE_FORMAT`.

**Validates: Requirements 4.3**

### Property 5: Snapshot Selection Priority

_For any_ valid date request, the API MUST first attempt to return the exact date snapshot, and only fall back to nearest snapshot if exact match is unavailable.

**Validates: Requirements 5.1**

### Property 6: Fallback Metadata Inclusion

_For any_ API response where a fallback snapshot was used (different from requested date), the response MUST include `fallback` metadata indicating the requested date, actual date, and reason.

**Validates: Requirements 5.2**

### Property 7: Default Date Behavior

_For any_ call from DistrictDetailPage where `selectedDate` is undefined, the hook MUST be called with `selectedProgramYear.endDate` as the fallback date.

**Validates: Requirements 3.2**

### Property 8: Data Consistency Across Sections

_For any_ selected date on the DistrictDetailPage, the date used by `useDistrictStatistics` MUST match the date used by `useDistrictAnalytics`.

**Validates: Requirements 3.1 (User Story)**

### Property 9: Error Response Structure

_For any_ error condition (invalid date, no snapshot available), the API MUST return a structured error response with `code`, `message`, and `details` fields.

**Validates: Requirements 5.2 (Error Handling)**

### Property 10: AsOfDate Consistency

_For any_ successful API response, the `asOfDate` field in the response MUST match the `data_as_of` field in `_snapshot_metadata`.

**Validates: Requirements 3.1 (timestamp matching)**

## Error Handling

### Invalid Date Format

**Condition**: Date parameter doesn't match YYYY-MM-DD format

**Response**:

```json
{
  "error": {
    "code": "INVALID_DATE_FORMAT",
    "message": "Date must be in YYYY-MM-DD format",
    "details": "Received: invalid-date"
  }
}
```

**HTTP Status**: 400

### No Snapshot for Date (with fallback)

**Condition**: Requested date has no snapshot, but fallback is available

**Behavior**: Return nearest snapshot with fallback metadata

**Response includes**:

```json
{
  "_snapshot_metadata": {
    "fallback": {
      "requested_date": "2026-01-14",
      "actual_snapshot_date": "2026-01-10",
      "fallback_reason": "no_snapshot_for_date"
    }
  }
}
```

### No Snapshots Available

**Condition**: No snapshots exist for the district

**Response**:

```json
{
  "error": {
    "code": "NO_SNAPSHOT_AVAILABLE",
    "message": "No data snapshot available yet",
    "details": "Run a refresh operation to create the first snapshot"
  }
}
```

**HTTP Status**: 503

### District Not Found

**Condition**: District ID doesn't exist in snapshot

**Response**:

```json
{
  "error": {
    "code": "DISTRICT_NOT_FOUND",
    "message": "District not found"
  }
}
```

**HTTP Status**: 404

## Testing Strategy

### Unit Tests

**Hook Tests** (`useMembershipData.test.ts`):

- Test that `selectedDate` is included in query key
- Test that `date` query parameter is passed to API
- Test backward compatibility when `selectedDate` is undefined
- Test error handling for API failures

**Backend Route Tests** (`core.test.ts`):

- Test date parameter parsing and validation
- Test exact date snapshot retrieval
- Test fallback to nearest snapshot
- Test backward compatibility without date parameter
- Test error responses for invalid dates

### Property-Based Tests

**Configuration**: Each property test will run minimum 100 iterations with randomized inputs.

**Property Test Suite**:

1. **Date Parameter Propagation Property** (Property 1)
   - Generate random valid dates
   - Verify API receives date as query parameter
   - Tag: **Feature: date-aware-district-statistics, Property 1: Date parameter propagation**

2. **Query Key Uniqueness Property** (Property 2)
   - Generate pairs of different dates
   - Verify query keys are different
   - Tag: **Feature: date-aware-district-statistics, Property 2: Query key uniqueness**

3. **Backward Compatibility Property** (Property 3)
   - Call hook without date parameter
   - Verify behavior matches original implementation
   - Tag: **Feature: date-aware-district-statistics, Property 3: Backward compatibility**

4. **Date Format Validation Property** (Property 4)
   - Generate invalid date formats
   - Verify 400 response with correct error code
   - Tag: **Feature: date-aware-district-statistics, Property 4: Date format validation**

5. **Snapshot Selection Priority Property** (Property 5)
   - Generate dates with and without exact snapshots
   - Verify exact match is preferred over fallback
   - Tag: **Feature: date-aware-district-statistics, Property 5: Snapshot selection priority**

6. **Fallback Metadata Inclusion Property** (Property 6)
   - Generate requests that trigger fallback
   - Verify fallback metadata is present and accurate
   - Tag: **Feature: date-aware-district-statistics, Property 6: Fallback metadata inclusion**

### Integration Tests

**Page Integration Tests** (`DistrictDetailPage.integration.test.tsx`):

- Test that changing date selector updates Division & Area Performance section
- Test that "Data as of" timestamp matches selected date
- Test loading states during date changes
- Test error display when no data for selected date

**API Integration Tests**:

- Test full request/response cycle with date parameter
- Test cache behavior with different dates
- Test concurrent requests with different dates

### Test Organization

```
frontend/src/
├── hooks/
│   └── __tests__/
│       ├── useMembershipData.test.ts (unit tests)
│       └── useMembershipData.property.test.ts (property tests)
├── pages/
│   └── __tests__/
│       └── DistrictDetailPage.integration.test.tsx (integration tests)

backend/src/
├── routes/
│   └── districts/
│       └── __tests__/
│           ├── core.statistics.test.ts (unit tests)
│           └── core.statistics.property.test.ts (property tests)
```

### Property-Based Testing Library

**Library**: fast-check (TypeScript property-based testing library)

**Custom Generators Needed**:

- Valid ISO date string generator
- Invalid date format generator
- District ID generator
- Snapshot metadata generator

## Design Decisions

### Decision 1: Optional Date Parameter (Backward Compatibility)

**Choice**: Make `selectedDate` parameter optional in both hook and API

**Rationale**:

- Existing code calling `useDistrictStatistics` without a date continues to work
- API clients without date parameter get current behavior (latest snapshot)
- Gradual migration path for any other consumers

**Alternatives Considered**:

- Required date parameter: Would break existing code
- Separate endpoint: Would duplicate logic and increase maintenance

### Decision 2: Fallback to Nearest Snapshot

**Choice**: When exact date snapshot unavailable, return nearest available snapshot with metadata

**Rationale**:

- Matches existing behavior in `/rankings` endpoint
- Provides useful data even when exact date unavailable
- Metadata allows UI to inform user of the fallback

**Alternatives Considered**:

- Return 404 for missing dates: Poor UX, user gets no data
- Return empty response: Confusing, unclear if error or no data

### Decision 3: Include Date in Query Key

**Choice**: Add `selectedDate` to React Query key: `['districtStatistics', districtId, selectedDate]`

**Rationale**:

- Ensures proper cache invalidation when date changes
- Allows caching of multiple date snapshots simultaneously
- Follows React Query best practices

**Alternatives Considered**:

- Single cache entry with manual invalidation: Error-prone, complex
- No caching: Poor performance, unnecessary API calls

### Decision 4: Use Existing findNearestSnapshot Function

**Choice**: Reuse `findNearestSnapshot()` from shared.ts for fallback logic

**Rationale**:

- Already tested and proven in `/rankings` endpoint
- Handles closing period gaps correctly
- Consistent fallback behavior across endpoints

**Alternatives Considered**:

- New fallback implementation: Duplicates logic, inconsistent behavior
- No fallback: Poor UX for dates without exact snapshots

### Decision 5: Default to Program Year End Date

**Choice**: When `selectedDate` is undefined in DistrictDetailPage, use `selectedProgramYear.endDate`

**Rationale**:

- Matches pattern used by `useDistrictAnalytics`
- Ensures consistent date across all sections
- Provides sensible default within program year context

**Alternatives Considered**:

- Use current date: May be outside program year
- Use undefined (latest): Inconsistent with other sections

### Decision 6: Remove current.json Pointer Mechanism

**Choice**: Remove the `current.json` pointer file and rely solely on directory scanning for `getLatestSuccessful()`

**Rationale**:

- With date-aware access, the concept of a single "current" snapshot is semantically unclear
- Directory scanning is already implemented and tested as a fallback mechanism
- Eliminates potential inconsistency between pointer and actual snapshots
- Reduces maintenance burden and potential corruption scenarios
- Simplifies the codebase by removing redundant state management

**Alternatives Considered**:

- Keep current.json for performance: Directory scanning is fast enough (< 100 snapshots typically)
- Rename to "latest.json": Still semantically confusing with date-aware access
- Keep for backward compatibility: No external consumers depend on this internal mechanism

## Implementation Order

1. **Backend API Enhancement** (core.ts)
   - Add date query parameter parsing
   - Add date format validation
   - Create `serveDistrictFromPerDistrictSnapshotByDate` helper
   - Integrate with existing `findNearestSnapshot`

2. **Current Snapshot Pointer Removal** (SnapshotStore.ts, SnapshotBuilder.ts, etc.)
   - Remove `currentPointerFile` and related properties
   - Remove `updateCurrentPointer()`, `getCachedCurrentPointer()`, `setCurrentSnapshot()` methods
   - Update `getLatestSuccessful()` to use directory scanning only
   - Remove `skipCurrentPointerUpdate` option
   - Update SnapshotRecoveryService and SnapshotIntegrityValidator
   - Update affected tests

3. **Frontend Hook Update** (useMembershipData.ts)
   - Add `selectedDate` parameter
   - Update query key to include date
   - Add date query parameter to API call

4. **Page Integration** (DistrictDetailPage.tsx)
   - Pass `selectedDate` to `useDistrictStatistics`
   - Use `selectedProgramYear.endDate` as fallback

5. **Testing**
   - Unit tests for hook and API changes
   - Property-based tests for correctness properties
   - Integration tests for end-to-end behavior
   - Update existing tests that reference current.json

## Performance Considerations

### Cache Efficiency

- Each date gets its own cache entry
- Stale time (15 minutes) prevents excessive API calls
- Users navigating between dates benefit from cached responses

### API Response Time

- Date parameter lookup uses existing snapshot indexing
- `findNearestSnapshot` is O(n) on snapshot count (typically < 100)
- No significant performance impact expected

### Memory Usage

- Multiple cached date entries increase memory usage
- React Query's garbage collection handles cleanup
- `gcTime` (30 minutes default) limits cache growth

## Current Snapshot Pointer Removal

### Overview

As part of this feature, the `current.json` pointer mechanism will be removed from the codebase. This pointer file was used to track the "current" snapshot for quick access, but with date-aware statistics, the concept of a single "current" snapshot becomes semantically unclear.

### Components to Modify

**File**: `backend/src/services/SnapshotStore.ts`

**Removals**:

- `currentPointerFile` property
- `currentPointerCache` and `currentPointerCacheTime` properties
- `updateCurrentPointer()` method
- `getCachedCurrentPointer()` method
- `setCurrentSnapshot()` method
- `skipCurrentPointerUpdate` handling in `writeSnapshot()`

**Changes to `getLatestSuccessful()`**:

```typescript
// Before: Try current.json first, fall back to scanning
async getLatestSuccessful(): Promise<Snapshot | null> {
  // Try current.json pointer first
  const pointer = await this.getCachedCurrentPointer()
  // ... fallback to findLatestSuccessfulByScanning()
}

// After: Always use directory scanning
async getLatestSuccessful(): Promise<Snapshot | null> {
  return await this.findLatestSuccessfulByScanning()
}
```

**File**: `backend/src/services/SnapshotBuilder.ts`

**Removals**:

- `skipCurrentPointerUpdate` option from `SnapshotBuilderOptions`

**File**: `backend/src/services/SnapshotRecoveryService.ts`

**Removals**:

- `recoverCurrentPointer()` method
- References to `currentPointerFile` in recovery logic
- Current pointer backup logic in `createBackups()`

**File**: `backend/src/services/SnapshotIntegrityValidator.ts`

**Removals**:

- Current pointer validation logic
- `currentPointerFile` references

### Interface Changes

**Before**:

```typescript
export interface WriteSnapshotOptions {
  skipCurrentPointerUpdate?: boolean
  // ... other options
}
```

**After**:

```typescript
export interface WriteSnapshotOptions {
  // skipCurrentPointerUpdate removed
  // ... other options
}
```

### Migration Strategy

1. Remove `current.json` file handling from code
2. Update tests that reference `current.json`
3. Existing `current.json` files in production will be ignored (no migration needed)
4. Directory scanning becomes the sole mechanism for finding latest snapshot

### Correctness Properties for Removal

### Property 11: Directory Scanning as Primary Mechanism

_For any_ call to `getLatestSuccessful()`, the method MUST use directory scanning to find the latest successful snapshot, without relying on any pointer file.

**Validates: Requirements 8.2**

### Property 12: No Current Pointer Side Effects

_For any_ call to `writeSnapshot()`, the method MUST NOT create or update any `current.json` pointer file.

**Validates: Requirements 8.2**

### Property 13: Backward Compatibility with Existing Files

_For any_ cache directory containing an existing `current.json` file, the system MUST continue to function correctly by ignoring the file.

**Validates: Requirements 8.2 (graceful handling)**
