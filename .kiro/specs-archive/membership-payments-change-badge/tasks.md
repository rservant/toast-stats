Note: # Implementation Plan: Membership Payments Change Badge Fix

## Overview

Fix `AnalyticsComputer.calculateMembershipChangeWithBase()` to produce correct membership change values by adding normalized districtId lookup, a meaningful snapshot-based fallback, and diagnostic logging. Then fix the badge to display actual member count change instead of payment change.

## Tasks

- [x] 1. Fix calculateMembershipChangeWithBase in AnalyticsComputer
  - [x] 1.1 Add normalizeDistrictId helper and normalized lookup fallback
    - Add a private `normalizeDistrictId(id: string): string` method that strips non-numeric characters
    - In `calculateMembershipChangeWithBase`, after the existing exact-match `find()`, add a second `find()` using normalized comparison if exact match fails
    - _Requirements: 2.2_
  - [x] 1.2 Replace the zero-returning fallback with snapshot-based calculation
    - When no ranking is found (or paymentBase is missing), compute `sum(club.paymentsCount) - sum(club.membershipBase)` from the latest snapshot instead of delegating to `calculateMembershipChange(snapshots)` which returns 0 for single snapshots
    - _Requirements: 2.3_
  - [x] 1.3 Add diagnostic logging for failure paths
    - Log a warning when `allDistrictsRankings` is undefined
    - Log a warning when district is not found in rankings (include sought districtId and available districtIds)
    - Log a warning when `paymentBase` is null/undefined on a matched ranking
    - Add a logger parameter to `AnalyticsComputer` constructor or use `console.warn` following existing patterns
    - _Requirements: 1.1, 1.2, 1.3_
  - [x] 1.4 Write unit tests for all calculation paths
    - Test exact match rankings path returns `totalPayments - paymentBase`
    - Test normalized lookup succeeds when exact match fails (e.g., "D42" vs "42")
    - Test snapshot-based fallback when rankings unavailable
    - Test snapshot-based fallback when district not found in rankings
    - Test snapshot-based fallback when paymentBase is null
    - Test returns 0 for empty snapshots with no rankings
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 2. Checkpoint - Verify fix and run tests
  - Ensure all tests pass, ask the user if questions arise.
  - Run existing `AnalyticsComputer.test.ts` tests to confirm no regressions
  - Verify the existing test `should compute analytics from a single snapshot` now reflects the new fallback behavior (it currently asserts `membershipChange` is 0 — this assertion may need updating if the mock clubs have non-zero `membershipBase`)

- [x] 3. Add memberCountChange to analytics-core computation
  - [x] 3.1 Add `memberCountChange` field to `DistrictAnalytics` interface in `packages/analytics-core/src/types.ts`
    - Add `memberCountChange: number` field after `membershipChange`
    - _Requirements: 4.1_
  - [x] 3.2 Compute `memberCountChange` in `AnalyticsComputer.computeDistrictAnalytics()`
    - Call `this.membershipModule.calculateMembershipChange(sortedSnapshots)` to get the actual member count difference
    - Assign the result to `memberCountChange` in the `districtAnalytics` object
    - _Requirements: 4.2, 4.3_
  - [x] 3.3 Write unit tests for memberCountChange computation
    - Test with two snapshots: verify `memberCountChange` equals difference in total membership
    - Test with single snapshot: verify `memberCountChange` is 0
    - Test that `membershipChange` (payment-based) is preserved alongside `memberCountChange`
    - _Requirements: 6.1, 6.2_

- [x] 4. Propagate memberCountChange through backend types and API response
  - [x] 4.1 Add `memberCountChange` field to `DistrictAnalytics` interface in `backend/src/types/analytics.ts`
    - Add `memberCountChange: number` after `membershipChange`
    - _Requirements: 4.1_
  - [x] 4.2 Add `memberCountChange` field to `PreComputedAnalyticsSummary` in `backend/src/types/precomputedAnalytics.ts`
    - Add `memberCountChange: number` after `membershipChange`
    - _Requirements: 5.1_
  - [x] 4.3 Add `memberCountChange` to `AggregatedAnalyticsResponse` summary in `backend/src/routes/districts/analyticsSummary.ts`
    - Add `memberCountChange` to the response interface summary section
    - Map `summary.memberCountChange ?? 0` in the response builder
    - _Requirements: 5.2, 5.3_
  - [x] 4.4 Update OpenAPI specification in `backend/openapi.yaml`
    - Add `memberCountChange` field to the analytics-summary response schema
    - _Requirements: 5.3_

- [x] 5. Update frontend to display memberCountChange
  - [x] 5.1 Add `memberCountChange` to frontend type interfaces
    - Add `memberCountChange?: number` to `DistrictAnalytics` in `frontend/src/hooks/useDistrictAnalytics.ts`
    - Add `memberCountChange?: number` to `AnalyticsSummary` in `frontend/src/hooks/useAggregatedAnalytics.ts`
    - Map `memberCountChange` through `convertToAggregatedFormat`
    - _Requirements: 4.1, 5.3_
  - [x] 5.2 Update `DistrictOverview` badge to use `memberCountChange`
    - Change the badge to display `analytics.memberCountChange ?? analytics.membershipChange` with "members" label
    - Use fallback to `membershipChange` for backward compatibility with old pre-computed files
    - _Requirements: 4.4_
  - [ ]\* 5.3 Write unit tests for badge rendering
    - Test badge renders `memberCountChange` when available
    - Test badge falls back to `membershipChange` when `memberCountChange` is undefined
    - _Requirements: 6.3_

- [x] 6. Final checkpoint - Verify all changes
  - Ensure all tests pass, ask the user if questions arise.
  - Verify type consistency across analytics-core, backend, and frontend

## Notes

- Tasks 1 and 2 are completed from the previous Bug 1 fix
- Tasks 3–6 address the new Bug 2 (badge showing payment change instead of member count change)
- Tasks marked with `*` are optional and can be skipped for faster MVP
- No new API endpoints are created — only the response schema of the existing analytics-summary endpoint is extended with a new field
- After implementing, re-running `collector-cli compute-analytics` will regenerate pre-computed files with the new `memberCountChange` field
- The frontend fallback (`memberCountChange ?? membershipChange`) ensures the badge works even with old pre-computed files
