# Date-Aware District Statistics - Implementation Tasks

## Overview

This task list implements date-aware district statistics to ensure the Division & Area Performance section displays data matching the user's selected date, providing consistency across all dashboard sections.

---

## Task 1: Backend API Enhancement - Add Date Parameter to Statistics Endpoint

- [x] 1.1 Add date query parameter parsing to `/api/districts/:districtId/statistics` endpoint
  - Modify `backend/src/routes/districts/core.ts`
  - Accept optional `date` query parameter in YYYY-MM-DD format
  - Validate date format using existing `validateDateFormat` function
  - Return 400 error with code `INVALID_DATE_FORMAT` for invalid dates
  - _Requirements: 4.3, Property 4_

- [x] 1.2 Create `serveDistrictFromPerDistrictSnapshotByDate` helper function
  - Add new function to `backend/src/routes/districts/shared.ts`
  - Accept `requestedDate` parameter alongside existing parameters
  - When date provided: attempt to get snapshot for that date
  - When date not provided: delegate to existing `serveDistrictFromPerDistrictSnapshot`
  - Use existing `findNearestSnapshot` for fallback behavior
  - Include fallback metadata in response when applicable
  - _Requirements: 4.3, 4.4, 5.1, Property 5, Property 6_

- [x] 1.3 Update statistics endpoint to use date-aware snapshot selection
  - Integrate `serveDistrictFromPerDistrictSnapshotByDate` into statistics endpoint
  - Pass date parameter from request to helper function
  - Ensure backward compatibility when date is not provided
  - Update cache key generation to include date parameter
  - _Requirements: 4.3, 6.1, 6.2, Property 3_

- [x] 1.4 Write unit tests for backend date parameter handling
  - Test date parameter parsing and validation
  - Test exact date snapshot retrieval
  - Test fallback to nearest snapshot
  - Test backward compatibility without date parameter
  - Test error responses for invalid dates
  - _Requirements: 4.3, 5.1, 5.2_

---

## Task 2: Current Snapshot Pointer Removal

- [x] 2.1 Remove current.json pointer mechanism from SnapshotStore
  - Remove `currentPointerFile` property from `FileSnapshotStore` class
  - Remove `currentPointerCache` and `currentPointerCacheTime` properties
  - Remove `updateCurrentPointer()` private method
  - Remove `getCachedCurrentPointer()` private method
  - Remove `setCurrentSnapshot()` public method
  - Update `getLatestSuccessful()` to use `findLatestSuccessfulByScanning()` directly
  - Update `performOptimizedRead()` to skip current.json pointer check
  - Remove `skipCurrentPointerUpdate` handling in `writeSnapshot()`
  - _Requirements: 8.2, Property 11, Property 12_

- [x] 2.2 Remove skipCurrentPointerUpdate option from WriteSnapshotOptions
  - Remove `skipCurrentPointerUpdate` from `WriteSnapshotOptions` interface
  - Update all callers in `SnapshotBuilder.ts` to remove this option
  - Update all callers in `BackfillService.ts` to remove this option
  - _Requirements: 8.2_

- [x] 2.3 Update SnapshotIntegrityValidator to remove current.json validation
  - Remove `validateCurrentPointer()` method
  - Update `validateSnapshotStore()` to not check current pointer
  - Update `CurrentPointerIntegrityResult` interface removal or deprecation
  - Update `SnapshotStoreIntegrityResult` to remove `currentPointer` field
  - _Requirements: 8.2_

- [x] 2.4 Update SnapshotRecoveryService to remove current.json recovery logic
  - Remove any `recoverCurrentPointer()` method if present
  - Remove current pointer backup logic in recovery operations
  - Update recovery guidance to not mention current.json
  - _Requirements: 8.2_

- [x] 2.5 Update tests that reference current.json
  - Update `SnapshotIntegrityValidator.unit.test.ts` to remove current pointer tests
  - Update any other tests that create or validate current.json
  - Ensure all tests pass with directory scanning as primary mechanism
  - _Requirements: 8.2, Property 13_

---

## Task 3: Frontend Hook Enhancement

- [x] 3.1 Add selectedDate parameter to useDistrictStatistics hook
  - Modify `frontend/src/hooks/useMembershipData.ts`
  - Add optional `selectedDate?: string` parameter to function signature
  - Update query key to include selectedDate: `['districtStatistics', districtId, selectedDate]`
  - Pass date as query parameter to API when selectedDate is provided
  - Maintain backward compatibility when selectedDate is undefined
  - _Requirements: 4.1, Property 1, Property 2, Property 3_

- [x] 3.2 Write unit tests for useDistrictStatistics hook changes
  - Test that selectedDate is included in query key
  - Test that date query parameter is passed to API
  - Test backward compatibility when selectedDate is undefined
  - Test error handling for API failures
  - _Requirements: 4.1_

---

## Task 4: Frontend Page Integration

- [x] 4.1 Update DistrictDetailPage to pass selectedDate to useDistrictStatistics
  - Modify `frontend/src/pages/DistrictDetailPage.tsx`
  - Pass `selectedDate || selectedProgramYear.endDate` to useDistrictStatistics
  - Match the pattern used by useDistrictAnalytics for consistency
  - _Requirements: 4.2, Property 7, Property 8_

- [x] 4.2 Write integration tests for date consistency across sections
  - Test that changing date selector updates Division & Area Performance section
  - Test that "Data as of" timestamp matches selected date
  - Test loading states during date changes
  - Test error display when no data for selected date
  - _Requirements: 3.1, 3.2, 3.3_

---

## Task 5: Documentation and Cleanup

- [x] 5.1 Update backend architecture documentation
  - Remove references to current.json pointer in `docs/BACKEND_ARCHITECTURE.md`
  - Update storage structure diagrams
  - Document date-aware statistics endpoint
  - _Requirements: 8.2_

- [x] 5.2 Verify all tests pass
  - Run full backend test suite
  - Run full frontend test suite
  - Ensure no regressions from current.json removal
  - _Requirements: All_

---

## Success Criteria

1. Selecting a date in the date picker updates the Division & Area Performance section to show data from that date
2. The "Data as of" timestamp in DivisionPerformanceCards matches the selected date
3. The default behavior (no date selected) shows the most recent data
4. Users receive clear feedback when data is unavailable for a selected date
5. All existing functionality continues to work without regression
6. The current.json pointer mechanism is completely removed from the codebase
