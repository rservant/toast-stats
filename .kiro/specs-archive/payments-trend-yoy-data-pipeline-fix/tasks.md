# Implementation Plan: Payments Trend & YoY Data Pipeline Fix

## Overview

Fix two persistent bugs by changing the data source for payments trend in the `/analytics` endpoint and adding a proximity guard to `findSnapshotForDate` in analytics-core. Minimal, targeted changes in the correct architectural layers.

## Tasks

- [x] 1. Fix findSnapshotForDate proximity guard in analytics-core
  - [x] 1.1 Add 180-day proximity threshold to `findSnapshotForDate` in `packages/analytics-core/src/analytics/AnalyticsComputer.ts`
    - After finding the closest snapshot in the final fallback path, check if `closestDiff > 180 * 24 * 60 * 60 * 1000` and return `undefined` if so
    - Exact match and same-year match paths remain unchanged
    - _Requirements: 2.1, 2.3_
  - [x] 1.2 Write unit tests for `findSnapshotForDate` proximity guard
    - Update existing test in `packages/analytics-core/src/analytics/AnalyticsComputer.test.ts`
    - Test: single current-year snapshot (2024-01-15) with previous-year target (2023-01-15) returns `undefined` (>180 days, no same-year match)
    - Test: snapshot 179 days from target returns the snapshot (within threshold)
    - Test: snapshot 181 days from target returns `undefined` (exceeds threshold)
    - Test: exact date match is returned regardless of other distant snapshots
    - Test: same-year snapshot is returned (existing behavior preserved)
    - Fix the existing test "should return dataAvailable=false when no previous year data available" which currently asserts `dataAvailable: true` — it should now assert `dataAvailable: false`
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 2. Fix Analytics endpoint to use time-series index for payments trend
  - [x] 2.1 Replace the `readMembershipAnalytics` payments trend block in `backend/src/routes/districts/analytics.ts`
    - Import `getTimeSeriesIndexService` from `./shared.js`
    - When `startDate` and `endDate` are both present as strings, call `timeSeriesIndexService.getTrendData(districtId, startDate, endDate)` and map results to `{ date, payments }`
    - When date params are absent, omit `paymentsTrend` entirely
    - Wrap in try/catch, log debug on failure, omit `paymentsTrend` on error
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [x] 2.2 Write unit tests for the analytics endpoint payments trend change
    - Add tests in `backend/src/routes/districts/__tests__/` (create file if needed)
    - Test: with startDate+endDate, response includes `paymentsTrend` array from time-series data
    - Test: without date params, response omits `paymentsTrend`
    - Test: when getTrendData returns empty array, `paymentsTrend` is omitted
    - Test: when getTrendData throws, `paymentsTrend` is omitted and response still succeeds
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 3. Checkpoint — Ensure backend and analytics-core tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Fix YearOverYearComparison component zero-change guard
  - [x] 4.1 Add all-zero check to `frontend/src/components/YearOverYearComparison.tsx`
    - After the existing `!yearOverYear` guard, add a check: if `membershipChange === 0 && distinguishedChange === 0 && clubHealthChange === 0`, render the same `EmptyState` component
    - _Requirements: 3.1, 3.2_
  - [x] 4.2 Write unit tests for the zero-change guard
    - Add tests in `frontend/src/components/__tests__/YearOverYearComparison.test.tsx` (create file if needed)
    - Test: all-zero yearOverYear renders "No Historical Data" empty state
    - Test: non-zero yearOverYear renders comparison cards
    - Test: undefined yearOverYear renders empty state (existing behavior)
    - _Requirements: 3.1, 3.2_

- [x] 5. Update existing computeYearOverYear test expectations
  - [x] 5.1 Update the test "should return dataAvailable=false when no previous year data available" in `packages/analytics-core/src/analytics/AnalyticsComputer.test.ts`
    - This test currently asserts `dataAvailable: true` because `findSnapshotForDate` returned the same snapshot for both dates
    - After the fix, it should assert `dataAvailable: false` since the single snapshot is >180 days from the previous year target
    - _Requirements: 2.2, 4.1_

- [x] 6. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass across analytics-core, backend, and frontend. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- No API response shape changes — `paymentsTrend` is already an optional field in the `/analytics` response
- No OpenAPI update needed — the endpoint signature (path, params, status codes) is unchanged; only the internal data source changes
- After deploying the analytics-core fix, run `scraper-cli compute-analytics` to regenerate pre-computed files with correct YoY data (Requirement 4.1, 4.2)
- The backend remains a read-only API server — the time-series index is pre-computed by scraper-cli
