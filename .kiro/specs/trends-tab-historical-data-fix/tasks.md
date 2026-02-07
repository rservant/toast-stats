# Implementation Plan: Trends Tab Historical Data Fix

## Overview

Rewire the Trends tab in `DistrictDetailPage.tsx` to use `aggregatedAnalytics` (time-series data from `/analytics-summary`) instead of `analytics` (single-snapshot data from `/analytics`) for the MembershipTrendChart and YearOverYearComparison components. Frontend-only change, no backend modifications.

## Tasks

- [x] 1. Update Trends tab data sources in DistrictDetailPage
  - [x] 1.1 Switch MembershipTrendChart to use aggregated analytics data
    - In `frontend/src/pages/DistrictDetailPage.tsx`, change the Trends tab's MembershipTrendChart section:
    - Change guard from `{analytics &&` to `{aggregatedAnalytics &&`
    - Change `membershipTrend` prop from `analytics.membershipTrend` to `aggregatedAnalytics.trends.membership`
    - Change `isLoading` prop from `isLoadingAnalytics` to `isLoadingAggregated`
    - _Requirements: 1.1, 1.2, 1.3, 3.1, 3.2, 3.3_
  - [x] 1.2 Switch YearOverYearComparison to use aggregated analytics data
    - Change guard from `{analytics &&` to `{aggregatedAnalytics &&`
    - Change `yearOverYear` prop source from `analytics.yearOverYear` to `aggregatedAnalytics.yearOverYear`
    - Change `currentYear` prop to derive from `aggregatedAnalytics.summary`:
      - `totalMembership` from `aggregatedAnalytics.summary.totalMembership`
      - `distinguishedClubs` from `aggregatedAnalytics.summary.distinguishedClubs.total`
      - `thrivingClubs` from `aggregatedAnalytics.summary.clubCounts.thriving`
      - `totalClubs` from `aggregatedAnalytics.summary.clubCounts.total`
    - Change `isLoading` prop from `isLoadingAnalytics` to `isLoadingAggregated`
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3_
  - [x] 1.3 Write unit tests for Trends tab data source wiring
    - Test that MembershipTrendChart receives aggregated trend data when aggregatedAnalytics is available
    - Test that YearOverYearComparison receives aggregated yearOverYear and summary data
    - Test that components are not rendered when aggregatedAnalytics is null
    - **Property 1: Trends tab data source wiring**
    - **Property 2: Trends tab guard condition**
    - **Validates: Requirements 1.1, 2.1, 2.2, 3.1, 3.2**

- [x] 2. Checkpoint - Verify the fix
  - Ensure all tests pass, ask the user if questions arise.
  - Verify TypeScript compilation has no errors in `DistrictDetailPage.tsx`

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The MembershipPaymentsChart is unchanged — it already uses `usePaymentsTrend` which is a separate, correctly-wired data source
- No backend or API changes needed — this is purely a frontend prop wiring fix
- No OpenAPI updates needed — no API endpoints are being added or modified
