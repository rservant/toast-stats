Note: # Implementation Plan: Membership Payments Change Badge Fix

## Overview

Fix `AnalyticsComputer.calculateMembershipChangeWithBase()` to produce correct membership change values by adding normalized districtId lookup, a meaningful snapshot-based fallback, and diagnostic logging.

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

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- This fix is entirely within `packages/analytics-core` — no backend, frontend, or API changes needed
- The existing test asserting `membershipChange === 0` for a single snapshot may need updating since the new fallback computes `sum(paymentsCount) - sum(membershipBase)` instead of returning 0
- After fixing, re-running `scraper-cli compute-analytics` will regenerate the pre-computed files with correct values
