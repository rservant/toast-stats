# Date-Aware District Statistics - Requirements

## 1. Overview

The district statistics endpoint currently always returns data from the latest snapshot, ignoring the user's selected date. This causes confusion when users select a specific date (e.g., Jan 14, 2026) but see data from a different date (e.g., Dec 5, 2022) in the Division & Area Performance section.

## 2. Problem Statement

**Current Behavior:**

- User selects Jan 14, 2026 in the date picker
- District Overview and other sections show data for Jan 14, 2026 (via `useDistrictAnalytics`)
- Division & Area Performance Cards show data from Dec 5, 2022 (via `useDistrictStatistics`)
- The "Data as of" timestamp shows Dec 5, 2022

**Root Cause (Complete Data Flow Analysis):**

1. **Frontend - DistrictDetailPage.tsx (Line 116-117):**

   ```typescript
   const { data: districtStatistics } = useDistrictStatistics(
     districtId || null
   )
   ```

   The `selectedDate` is NOT passed to `useDistrictStatistics`, unlike `useDistrictAnalytics` which correctly receives the date.

2. **Frontend - useMembershipData.ts:**

   ```typescript
   export const useDistrictStatistics = (districtId: string | null) => {
   ```

   The hook doesn't accept a date parameter at all.

3. **Backend - /api/districts/:districtId/statistics endpoint:**
   - Doesn't accept a `date` query parameter
   - Calls `serveDistrictFromPerDistrictSnapshot()` which always uses `perDistrictSnapshotStore.getLatestSuccessful()`
   - Always returns the latest snapshot regardless of user's date selection

4. **Component - DivisionPerformanceCards:**
   - Receives `districtStatistics.asOfDate` from the wrong (latest) snapshot
   - Displays "Data as of: Dec 5, 2022" even when user selected Jan 14, 2026

## 3. User Stories

### 3.1 As a district leader

**I want** the Division & Area Performance data to match my selected date  
**So that** I can analyze historical performance consistently across all dashboard sections

**Acceptance Criteria:**

- When I select a specific date in the date picker, the Division & Area Performance section shows data from that date
- The "Data as of" timestamp matches my selected date
- If no data exists for the selected date, I see a clear message or the nearest available date is used

### 3.2 As a district leader

**I want** to see the most recent data by default  
**So that** I don't have to manually select a date every time I visit the dashboard

**Acceptance Criteria:**

- When no date is selected, the system shows the most recent available data
- The date picker defaults to "Latest in Program Year"
- All sections show data from the same snapshot

### 3.3 As a district leader

**I want** to understand when data is unavailable for my selected date  
**So that** I can choose a different date or understand data gaps

**Acceptance Criteria:**

- If the selected date has no snapshot data, I see a clear error message or fallback behavior
- The error message suggests alternative dates with available data
- I can easily switch to a date with available data

## 4. Technical Requirements

### 4.1 Frontend Hook Enhancement (useMembershipData.ts)

- The `useDistrictStatistics` hook MUST accept an optional `selectedDate` parameter
- The hook MUST pass the `selectedDate` to the API as a query parameter
- The query key MUST include the date to ensure proper cache invalidation
- The hook MUST handle cases where no data exists for the selected date

### 4.2 Frontend Page Integration (DistrictDetailPage.tsx)

- The `DistrictDetailPage` MUST pass `selectedDate` to `useDistrictStatistics`
- The call should match the pattern used by `useDistrictAnalytics`:
  ```typescript
  useDistrictStatistics(
    districtId || null,
    selectedDate || selectedProgramYear.endDate
  )
  ```

### 4.3 Backend API Enhancement (core.ts)

- The `/api/districts/:districtId/statistics` endpoint MUST accept an optional `date` query parameter
- When `date` is provided, the endpoint MUST return data from the snapshot matching that date
- When `date` is not provided, the endpoint MUST return data from the latest snapshot (current behavior)
- The response MUST include the actual snapshot date used (for verification)

### 4.4 Backend Snapshot Selection (shared.ts)

- Create or use an existing function to get a snapshot by specific date (not just latest)
- Handle cases where the requested date doesn't have a snapshot (fallback to nearest or return error)

## 5. Data Consistency Requirements

### 5.1 Snapshot Selection Logic

- When a specific date is requested, use the snapshot with that exact date if available
- If exact date not available, use `findNearestSnapshot()` (already exists in shared.ts)
- All API calls for the same page view SHOULD use the same snapshot date
- The snapshot date MUST be included in API responses for verification

### 5.2 Error Handling

- Return 404 with a helpful message if no snapshots exist for the district
- Return the closest available snapshot if the exact date doesn't exist (with fallback metadata)
- Include available date ranges in error responses

## 6. Non-Functional Requirements

### 6.1 Performance

- Adding the date parameter MUST NOT significantly impact response time
- Caching MUST work correctly with the date parameter
- The cache key MUST include the date parameter

### 6.2 Backward Compatibility

- The API MUST remain backward compatible (date parameter is optional)
- Existing clients without the date parameter MUST continue to work
- The default behavior (no date = latest) MUST be preserved

## 7. Out of Scope

- Adding new snapshot creation logic
- Adding date pickers to other pages
- Modifying `useDistrictAnalytics` (already works correctly)

## 8. Current Snapshot Pointer Removal

### 8.1 Background

The system currently maintains a `current.json` pointer file that tracks the "current" snapshot for quick access. With date-aware statistics, the concept of a single "current" snapshot becomes less relevant since users explicitly select dates.

### 8.2 Requirements

- The `current.json` pointer file mechanism SHALL be removed from the codebase
- The `getLatestSuccessful()` method SHALL use directory scanning (`findLatestSuccessfulByScanning()`) as the primary mechanism
- The `skipCurrentPointerUpdate` option in `WriteSnapshotOptions` SHALL be removed
- The `setCurrentSnapshot()` method SHALL be removed
- All references to `currentPointerFile`, `currentPointerCache`, and related fields SHALL be removed
- The `SnapshotRecoveryService` SHALL be updated to remove current.json recovery logic
- The `SnapshotIntegrityValidator` SHALL be updated to remove current.json validation

### 8.3 Rationale

- Simplifies the codebase by removing redundant state
- Eliminates potential inconsistency between pointer and actual snapshots
- Directory scanning is already implemented and tested as fallback
- Date-aware access makes "current" pointer semantically unclear
- Reduces maintenance burden and potential corruption scenarios

## 9. Success Criteria

The feature is successful when:

1. Selecting a date in the date picker updates the Division & Area Performance section to show data from that date
2. The "Data as of" timestamp in DivisionPerformanceCards matches the selected date
3. The default behavior (no date selected) shows the most recent data
4. Users receive clear feedback when data is unavailable for a selected date
5. All existing functionality continues to work without regression

## 10. Dependencies

- Existing snapshot storage system (`PerDistrictSnapshotStore`)
- Current date selection mechanism in `ProgramYearContext`
- Backend `findNearestSnapshot` function (already exists)
- Frontend `useDistrictStatistics` hook
- `DivisionPerformanceCards` component

## 11. Risks and Mitigations

| Risk                                      | Impact | Mitigation                                      |
| ----------------------------------------- | ------ | ----------------------------------------------- |
| Cache key conflicts with date parameter   | High   | Update cache key generation to include date     |
| Performance degradation with date lookups | Medium | Use existing snapshot indexing                  |
| Breaking changes to API contract          | High   | Make date parameter optional, maintain defaults |
| Inconsistent dates across components      | High   | Use centralized date selection from context     |

## 12. Implementation Order

1. **Backend first:** Add `date` query parameter to `/statistics` endpoint
2. **Hook update:** Add `selectedDate` parameter to `useDistrictStatistics`
3. **Page integration:** Pass `selectedDate` from `DistrictDetailPage` to the hook
4. **Testing:** Verify date consistency across all sections
