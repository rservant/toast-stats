# Implementation Plan: Analytics Summary Data Source Fix

## Overview

Rewire the analytics-summary route to read summary data from `PreComputedAnalyticsReader.readDistrictAnalytics()` instead of `PreComputedAnalyticsService.getLatestSummary()`. Consolidate the two separate `readDistrictAnalytics()` calls (one for summary, one for distinguished projection) into a single call. Update tests to mock the new data source.

## Tasks

- [x] 1. Rewire the analytics-summary route handler
  - [x] 1.1 Replace PreComputedAnalyticsService with PreComputedAnalyticsReader for summary data
    - In `backend/src/routes/districts/analyticsSummary.ts`:
    - Remove the `getPreComputedAnalyticsService` import from `./shared.js`
    - Move the `snapshotStore.getLatestSuccessful()` call to before any analytics reads
    - Replace `preComputedAnalyticsService.getLatestSummary(districtId)` with `preComputedAnalyticsReader.readDistrictAnalytics(latestSnapshot.snapshot_id, districtId)`
    - If `snapshotStore.getLatestSuccessful()` returns null, return 404 with `ANALYTICS_NOT_AVAILABLE`
    - _Requirements: 1.1, 1.2, 1.5_
  - [x] 1.2 Consolidate into a single readDistrictAnalytics call
    - Remove the separate try/catch block that calls `readDistrictAnalytics()` for distinguished projection
    - Extract `distinguishedProjection.projectedDistinguished` from the single `readDistrictAnalytics()` result
    - _Requirements: 3.1, 3.2, 3.3_
  - [x] 1.3 Map DistrictAnalytics fields to AggregatedAnalyticsResponse
    - Map `totalMembership` and `membershipChange` directly
    - Derive `clubCounts.total` from `allClubs.length`
    - Derive `clubCounts.thriving` from `thrivingClubs.length`
    - Derive `clubCounts.vulnerable` from `vulnerableClubs.length`
    - Derive `clubCounts.interventionRequired` from `interventionRequiredClubs.length`
    - Map `distinguishedClubs` fields directly (smedley, presidents, select, distinguished, total)
    - Map `distinguishedProjection.projectedDistinguished` to `summary.distinguishedProjection`
    - Use `latestSnapshot.created_at` for the `computedAt` response field
    - Set `dataSource` to `"precomputed"`
    - _Requirements: 1.3, 2.1, 2.2, 2.3, 2.4, 5.1, 5.2_

- [x] 2. Clean up unused imports and exports
  - [x] 2.1 Remove getPreComputedAnalyticsService from the route
    - Remove the `getPreComputedAnalyticsService` import from `analyticsSummary.ts`
    - Verify no other route files import `getPreComputedAnalyticsService` from shared.ts
    - If no other route consumers exist, remove the export from `shared.ts`
    - _Requirements: 4.1, 4.2_

- [x] 3. Verify OpenAPI spec synchronization
  - [x] 3.1 Confirm backend/openapi.yaml remains in sync
    - Verify the analytics-summary endpoint documentation in `backend/openapi.yaml` still matches the implementation (parameters, response shape, status codes are unchanged)
    - No changes should be needed since the response contract is preserved
    - _Requirements: 5.3_

- [x] 4. Update unit tests
  - [x] 4.1 Update analyticsSummary.test.ts to use new data source mocks
    - In `backend/src/routes/districts/__tests__/analyticsSummary.test.ts`:
    - Replace mocks of `PreComputedAnalyticsService.getLatestSummary()` with mocks of `PreComputedAnalyticsReader.readDistrictAnalytics()`
    - Mock should return a `DistrictAnalytics` object (with club arrays, distinguishedClubs, distinguishedProjection object) instead of `PreComputedAnalyticsSummary`
    - Update assertions to verify club counts are derived from array lengths
    - _Requirements: 6.1, 6.3_
  - [x] 4.2 Add test for null analytics (404 response)
    - Mock `readDistrictAnalytics()` to return null
    - Verify route returns 404 with error code `ANALYTICS_NOT_AVAILABLE`
    - _Requirements: 1.4, 6.2_
  - [x] 4.3 Add test for no snapshot available (404 response)
    - Mock `snapshotStore.getLatestSuccessful()` to return null
    - Verify route returns 404 with error code `ANALYTICS_NOT_AVAILABLE`
    - _Requirements: 1.5_
  - [x] 4.4 Verify single readDistrictAnalytics call
    - Assert `readDistrictAnalytics` is called exactly once per request
    - Assert `getPreComputedAnalyticsService` is not called
    - _Requirements: 3.1, 4.1_

- [x] 5. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- No property-based tests per the testing steering document — the field mapping is a simple transformation where unit tests with good examples provide sufficient confidence
- The response contract is unchanged, so no frontend changes are needed
- `PreComputedAnalyticsService` is still used by `UnifiedBackfillService`/`AnalyticsGenerator` for backward compatibility — do not delete the class itself
