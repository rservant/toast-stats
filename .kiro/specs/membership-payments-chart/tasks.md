# Implementation Plan: Membership Payments Tracking Chart

## Overview

This implementation plan adds a Membership Payments Tracking Chart to the District Membership Trend card's Trends tab. The chart displays YTD membership payment data over time with multi-year comparison (current year vs previous 2 years).

## Tasks

- [x] 1. Create payment data utility functions
  - [x] 1.1 Create `calculateProgramYearDay` function in `frontend/src/utils/programYear.ts`
    - Calculate days since July 1 for any given date
    - Handle program year boundary (July 1 start)
    - Return value between 0-365
    - _Requirements: 2.2_
  - [x] 1.2 Write property test for `calculateProgramYearDay`
    - **Property 3: Program Year Day Alignment**
    - **Validates: Requirements 2.2**
  - [x] 1.3 Create `buildPaymentTrend` function in `frontend/src/utils/paymentTrend.ts`
    - Extract totalPayments from snapshot data
    - Sort by date ascending
    - Calculate programYearDay for each data point
    - Exclude snapshots with missing payment data
    - _Requirements: 3.1, 3.2, 3.3_
  - [x] 1.4 Write property test for `buildPaymentTrend`
    - **Property 4: Payment Data Extraction**
    - **Validates: Requirements 3.1, 3.2**

- [x] 2. Checkpoint - Ensure utility functions work correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Create usePaymentsTrend hook
  - [x] 3.1 Create `usePaymentsTrend` hook in `frontend/src/hooks/usePaymentsTrend.ts`
    - Fetch payment trend data for current program year
    - Fetch historical data for previous 2 years when available
    - Group data by program year
    - Calculate year-over-year change
    - Return loading and error states
    - _Requirements: 2.1, 2.4, 6.2_
  - [x] 3.2 Write property test for year count limiting
    - **Property 2: Year Count Limiting**
    - **Validates: Requirements 2.1, 2.4**
  - [x] 3.3 Write property test for statistics calculation
    - **Property 5: Statistics Calculation**
    - **Validates: Requirements 6.1, 6.2, 6.4**

- [x] 4. Checkpoint - Ensure hook works correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Create MembershipPaymentsChart component
  - [x] 5.1 Create `MembershipPaymentsChart` component in `frontend/src/components/MembershipPaymentsChart.tsx`
    - Create component structure with statistics summary panel
    - Implement multi-year line chart using Recharts
    - Add custom tooltip showing date and payment count
    - Add legend for year identification
    - Use Toastmasters brand colors (TM Loyal Blue, TM True Maroon, TM Cool Gray)
    - Follow MembershipTrendChart styling patterns
    - _Requirements: 1.2, 1.3, 1.4, 2.3, 2.5, 5.1, 5.5, 6.1, 6.3_
  - [x] 5.2 Add loading skeleton state
    - Use existing LoadingSkeleton component
    - _Requirements: 4.1_
  - [x] 5.3 Add empty state handling
    - Use existing EmptyState component
    - Display explanatory message when no data available
    - _Requirements: 4.2, 4.3_
  - [x] 5.4 Add year-over-year change indicator
    - Show up/down trend indicator
    - Display percentage change
    - _Requirements: 6.2, 6.4_
  - [x] 5.5 Add accessibility attributes
    - Add ARIA labels for chart and interactive elements
    - Add chart description for screen readers
    - _Requirements: 5.2, 5.3_
  - [x] 5.6 Write property test for trend line rendering
    - **Property 1: Trend Line Rendering**
    - **Validates: Requirements 1.3**

- [x] 6. Checkpoint - Ensure component renders correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Integrate into DistrictDetailPage
  - [x] 7.1 Add MembershipPaymentsChart to Trends tab in `frontend/src/pages/DistrictDetailPage.tsx`
    - Import MembershipPaymentsChart component
    - Add usePaymentsTrend hook call
    - Position below MembershipTrendChart
    - Wrap with LazyChart for performance
    - _Requirements: 1.1_
  - [x] 7.2 Ensure responsive layout
    - Test on mobile viewport sizes
    - Verify chart scales correctly
    - _Requirements: 5.4_

- [x] 8. Fix historical data fetching
  - [ ] 8.1 Update DistrictDetailPage to not pass programYearStartDate to usePaymentsTrend
    - Remove the `selectedProgramYear.startDate` parameter from usePaymentsTrend call
    - Allow the hook to automatically fetch 3 years of data for comparison
    - _Requirements: 7.1, 7.2_
  - [x] 8.2 Verify multi-year data is displayed correctly
    - Check that previous years' data appears in the chart
    - Verify year-over-year statistics are calculated
    - Confirm legend shows all available years
    - _Requirements: 2.1, 2.3, 2.5, 6.2_

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks are required for comprehensive implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation follows existing patterns from MembershipTrendChart and YearOverYearComparison components
