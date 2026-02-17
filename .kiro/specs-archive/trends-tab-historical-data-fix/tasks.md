# Implementation Plan: Trends Tab Historical Data Fix

## Overview

Fix three bugs in the Trends tab: (1) sparse time-series data returning empty membership trends, (2) payments trend hook using wrong program year, (3) YoY comparison using same snapshot for both years + backend sending wrong change field type. Changes span backend, frontend, and scraper-cli.

## Tasks

- [x] 1. Fix sparse membership trend data in analytics summary route
  - [x] 1.1 Add program year end date helper and sparse data fallback in analyticsSummary.ts
    - In `backend/src/routes/districts/analyticsSummary.ts`, add a `getProgramYearEndDate` helper alongside the existing `getProgramYearStartDate`
    - After the initial `timeSeriesIndexService.getTrendData()` call, check if the result is empty
    - If empty, re-query with the full program year range (start from `getProgramYearStartDate(effectiveEndDate)` to `getProgramYearEndDate(effectiveEndDate)`)
    - Preserve the original `effectiveStartDate` and `effectiveEndDate` in the response `dateRange` field (do not change it to the expanded range)
    - _Requirements: 1.1, 1.2, 1.3_
  - [x] 1.2 Write unit tests for sparse data fallback
    - Test: when initial query returns empty but expanded program year query returns data, the route returns the expanded data
    - Test: response `dateRange` always reflects the original requested range, not the expanded range
    - Edge case: both queries return empty — verify empty trends array, no error
    - **Property 1: Response dateRange preserves original request**
    - **Validates: Requirements 1.1, 1.2, 1.3**

- [x] 2. Fix payments trend hook to use selected program year
  - [x] 2.1 Add selectedProgramYear parameter to usePaymentsTrend hook
    - In `frontend/src/hooks/usePaymentsTrend.ts`, add an optional `selectedProgramYear?: ProgramYear` parameter to the `usePaymentsTrend` function signature
    - Replace `const currentProgramYear = getCurrentProgramYear()` with `const currentProgramYear = selectedProgramYear ?? getCurrentProgramYear()`
    - Add `selectedProgramYear` to the `useMemo` dependency array
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 2.2 Pass selected program year from DistrictDetailPage
    - In `frontend/src/pages/DistrictDetailPage.tsx`, pass `effectiveProgramYear ?? undefined` as the new `selectedProgramYear` argument to `usePaymentsTrend`
    - _Requirements: 2.1, 2.2_
  - [x] 2.3 Write unit tests for selected program year behavior
    - Test: passing selectedProgramYear for 2024-2025 extracts data under the "2024-2025" label as currentYearTrend
    - Test: when no selectedProgramYear is passed, falls back to getCurrentProgramYear()
    - Edge case: selected program year has no data — verify empty currentYearTrend and null multiYearData
    - **Property 2: Selected program year determines current trend**
    - **Validates: Requirements 2.1, 2.2, 2.3**

- [x] 3. Checkpoint - Verify frontend and backend fixes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Fix YoY comparison to use previous year snapshot
  - [x] 4.1 Load previous year snapshot in AnalyticsComputeService
    - In `packages/scraper-cli/src/services/AnalyticsComputeService.ts`, in the `computeDistrictAnalytics` method, after loading the current snapshot:
    - Import `findPreviousProgramYearDate` from `@toastmasters-tracker/analytics-core`
    - Calculate the previous year date using `findPreviousProgramYearDate(date)`
    - Attempt to load the previous year's snapshot using `this.loadDistrictSnapshot(previousYearDate, districtId)`
    - Wrap the previous snapshot load in a try/catch — on failure, log a warning and continue with single snapshot
    - Build the snapshots array: if previous snapshot exists, `[previousSnapshot, snapshot]`; otherwise `[snapshot]`
    - Pass the combined array to `this.analyticsComputer.computeDistrictAnalytics()`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [x] 4.2 Write unit tests for previous year snapshot loading
    - Test: when previous year snapshot exists, computeDistrictAnalytics passes 2 snapshots to AnalyticsComputer
    - Test: when previous year snapshot doesn't exist, falls back to 1 snapshot
    - Test: when previous year snapshot read fails, catches error and continues with 1 snapshot
    - **Property 3: Two-snapshot YoY produces distinct metrics**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

- [x] 5. Fix YoY frontend-backend contract alignment
  - [x] 5.1 Send percentageChange instead of change in analyticsSummary route
    - In `backend/src/routes/districts/analyticsSummary.ts`, change the `yearOverYear` response construction:
    - Replace `yoyComparison.metrics.membership.change` with `yoyComparison.metrics.membership.percentageChange`
    - Replace `yoyComparison.metrics.distinguishedClubs.change` with `yoyComparison.metrics.distinguishedClubs.percentageChange`
    - Replace `yoyComparison.metrics.clubHealth.thrivingClubs.change` with `yoyComparison.metrics.clubHealth.thrivingClubs.percentageChange`
    - _Requirements: 4.1, 4.2_
  - [x] 5.2 Write unit tests for YoY contract alignment
    - Test: route maps percentageChange (not change) to response yearOverYear fields
    - Test: when percentageChange is 0, response fields are 0
    - Test: when percentageChange is negative, response fields are negative
    - **Property 4: Route sends percentageChange values**
    - **Validates: Requirements 4.1, 4.2, 4.3**

- [x] 6. Final checkpoint - Verify all fixes
  - Ensure all tests pass, ask the user if questions arise.
  - Verify TypeScript compilation has no errors across all modified files

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- No new API endpoints are added — the analytics-summary endpoint behavior changes but its URL, parameters, and response shape remain the same. The `yearOverYear` field values change from absolute to percentage semantics, which aligns with how the frontend already interprets them.
- The scraper-cli change (task 4.1) means existing pre-computed YoY files will need to be regenerated by re-running `compute-analytics` for snapshots that have a previous year snapshot available.
- No OpenAPI updates needed — no endpoint signatures change.
