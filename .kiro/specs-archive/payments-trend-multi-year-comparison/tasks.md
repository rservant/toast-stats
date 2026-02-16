# Implementation Plan: Payments Trend Multi-Year Comparison

## Overview

Remove the `aggregatedPaymentsTrend` override from the `usePaymentsTrend` hook so it uses its internal `useDistrictAnalytics` 3-year fetch for multi-year chart data. Frontend-only change — no backend modifications.

## Tasks

- [x] 1. Update usePaymentsTrend hook to remove aggregatedPaymentsTrend parameter
  - [x] 1.1 Remove the `aggregatedPaymentsTrend` parameter from the `usePaymentsTrend` function signature in `frontend/src/hooks/usePaymentsTrend.ts`
    - Remove the 4th parameter `aggregatedPaymentsTrend?: Array<{ date: string; payments: number }>`
    - Shift `selectedProgramYear` to become the 4th parameter
    - Update the JSDoc to remove the aggregatedPaymentsTrend documentation
    - _Requirements: 1.1, 1.3_
  - [x] 1.2 Remove the aggregatedPaymentsTrend override in the useMemo block
    - Change `const rawTrend = aggregatedPaymentsTrend ?? analyticsData.paymentsTrend` to `const rawTrend = analyticsData.paymentsTrend`
    - Remove `aggregatedPaymentsTrend` from the `useMemo` dependency array
    - _Requirements: 1.1_

- [x] 2. Update DistrictDetailPage call site
  - [x] 2.1 Update the `usePaymentsTrend` call in `frontend/src/pages/DistrictDetailPage.tsx`
    - Remove the `aggregatedAnalytics?.trends?.payments` argument
    - Pass `effectiveProgramYear ?? undefined` as the 4th argument (was 5th)
    - _Requirements: 1.3, 4.1_

- [x] 3. Checkpoint - Verify compilation and existing tests
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Write unit tests for multi-year data flow
  - [x] 4.1 Write unit tests for the updated usePaymentsTrend hook in `frontend/src/hooks/__tests__/usePaymentsTrend.multiYear.test.ts`
    - Test that when useDistrictAnalytics returns 3 years of payment data, multiYearData contains 3 year groups
    - Test that when useDistrictAnalytics returns 1 year of data, multiYearData has current year only with empty previousYears
    - Test that when useDistrictAnalytics returns 5 years of data, multiYearData is capped at 3 years (most recent)
    - Test that selectedProgramYear determines which year is currentYear vs previousYears
    - Test YoY change: previous year data within 7 days produces correct change value
    - Test YoY change: no previous year data within 7 days produces null
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 3.3_

- [x] 5. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- No backend changes needed — the `/analytics` endpoint already supports multi-year date ranges
- No chart component changes needed — `MembershipPaymentsChart` already renders multiple lines
- The existing `usePaymentsTrend.selectedProgramYear.test.ts` tests should continue to pass after updating the hook signature
