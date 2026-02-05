# Implementation Plan: Projected Year-End Simplification

## Overview

Simplify the distinguished projection to a single `projectedDistinguished` field and fix the frontend summing bug.

## Tasks

- [x] 1. Modify DistinguishedClubAnalyticsModule to use thriving count
  - [x] 1.1 Update `generateDistinguishedProjection()` to accept thriving count parameter
    - Add optional `thrivingCount` parameter to the method signature
    - When provided, use it directly instead of calling `calculateDistinguishedProjection()`
    - Set all `projected*` fields to the thriving count value
    - _Requirements: 1.1, 1.2, 1.3_
  - [x] 1.2 Update AnalyticsComputer to pass thriving count
    - In `computeDistrictAnalytics()`, get thriving count from `ClubHealthAnalyticsModule`
    - Pass thriving count to `generateDistinguishedProjection()`
    - _Requirements: 1.1_

- [x] 2. Add unit tests for projection simplification
  - [x] 2.1 Add test: projection equals thriving count for mixed health statuses
    - Create snapshot with clubs in different health states
    - Verify projection equals count of thriving clubs only
    - _Requirements: 1.1_
  - [x] 2.2 Add test: projection returns 0 when no thriving clubs
    - Create snapshot with only vulnerable/intervention-required clubs
    - Verify projection is 0
    - _Requirements: 1.4_
  - [x] 2.3 Add test: projection equals total when all clubs thriving
    - Create snapshot where all clubs meet thriving criteria
    - Verify projection equals total club count
    - _Requirements: 1.5_

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Remove deprecated linear regression code
  - [x] 4.1 Remove or deprecate `calculateDistinguishedProjection()` private method
    - The linear regression logic is no longer needed
    - Either remove the method or mark as deprecated with comment
    - _Requirements: 1.3_

- [x] 5. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Simplify DistinguishedProjection type to single projected field
  - [x] 6.1 Update DistinguishedProjection interface in analytics-core
    - Remove `projectedSelect` and `projectedPresident` fields from interface
    - Keep only `projectedDistinguished` as the single projected field
    - File: `packages/analytics-core/src/types.ts`
    - _Requirements: 2.1, 2.2_
  - [x] 6.2 Update DistinguishedClubAnalyticsModule return values
    - Modify `generateDistinguishedProjection()` to return only `projectedDistinguished`
    - Remove references to `projectedSelect` and `projectedPresident`
    - File: `packages/analytics-core/src/analytics/DistinguishedClubAnalyticsModule.ts`
    - _Requirements: 2.4_
  - [x] 6.3 Update AnalyticsComputer to use single projected field
    - Update `distinguishedLevelBreakdown` to use `projectedDistinguished` for all levels
    - File: `packages/analytics-core/src/analytics/AnalyticsComputer.ts`
    - _Requirements: 2.4_

- [x] 7. Update analytics-core tests
  - [x] 7.1 Update DistinguishedClubAnalyticsModule tests
    - Remove assertions for `projectedSelect` and `projectedPresident`
    - Update to check only `projectedDistinguished`
    - File: `packages/analytics-core/src/__tests__/DistinguishedClubAnalyticsModule.test.ts`
    - _Requirements: 2.5_
  - [x] 7.2 Update AnalyticsComputer integration tests
    - Update projection validation to check only `projectedDistinguished`
    - File: `packages/analytics-core/src/analytics/AnalyticsComputer.integration.test.ts`
    - _Requirements: 2.5_

- [x] 8. Update scraper-cli tests
  - [x] 8.1 Update AnalyticsWriter test fixtures
    - Remove `projectedSelect` and `projectedPresident` from test fixtures
    - File: `packages/scraper-cli/src/__tests__/AnalyticsWriter.test.ts`
    - _Requirements: 2.5_
  - [x] 8.2 Update AnalyticsWriter property test generators
    - Update `distinguishedProjectionArb` arbitrary to generate only `projectedDistinguished`
    - File: `packages/scraper-cli/src/__tests__/AnalyticsWriter.property.test.ts`
    - _Requirements: 2.5_
  - [x] 8.3 Update AnalyticsComputeService test fixtures
    - Remove `projectedSelect` and `projectedPresident` from test fixtures
    - File: `packages/scraper-cli/src/__tests__/AnalyticsComputeService.test.ts`
    - _Requirements: 2.5_

- [x] 9. Fix frontend helper function
  - [x] 9.1 Simplify getDistinguishedProjectionValue helper
    - Remove summing of multiple projected fields
    - Use only `projectedDistinguished` directly
    - File: `frontend/src/pages/DistrictDetailPage.tsx`
    - _Requirements: 2.3_
  - [x] 9.2 Update frontend test fixtures
    - Remove `projectedSelect` and `projectedPresident` from test fixtures
    - File: `frontend/src/hooks/__tests__/useAggregatedAnalytics.test.tsx`
    - _Requirements: 2.5_

- [x] 10. Final verification
  - [x] 10.1 Run all analytics-core tests
    - Verify all tests pass with simplified type
  - [x] 10.2 Run all scraper-cli tests
    - Verify all tests pass with updated fixtures
  - [x] 10.3 Run all frontend tests
    - Verify all tests pass with updated fixtures
  - [x] 10.4 Build all packages
    - Verify TypeScript compilation succeeds across all packages

- [x] 11. Update backend types and tests
  - [x] 11.1 Update DistinguishedClubAnalytics type in backend
    - Update `distinguishedProjection` to use simplified format (only `projectedDistinguished`)
    - Remove `smedley`, `presidents`, `select`, `distinguished`, `total` from projection type
    - File: `backend/src/types/analytics.ts`
    - _Requirements: 3.1_
  - [x] 11.2 Update PreComputedAnalyticsReader tests
    - Remove `projectedSelect` and `projectedPresident` from test fixtures
    - File: `backend/src/services/__tests__/PreComputedAnalyticsReader.test.ts`
    - File: `backend/src/services/__tests__/PreComputedAnalyticsReader.integration.test.ts`
    - File: `backend/src/services/__tests__/PreComputedAnalyticsReader.extended.test.ts`
    - _Requirements: 3.2_
  - [x] 11.3 Update analyticsSummary route tests
    - Remove `projectedSelect` and `projectedPresident` from test fixtures
    - File: `backend/src/routes/districts/__tests__/analyticsSummary.test.ts`
    - _Requirements: 3.2_

- [x] 12. Final backend verification
  - [x] 12.1 Run all backend tests
    - Verify all tests pass with updated types
  - [x] 12.2 Build backend package
    - Verify TypeScript compilation succeeds
