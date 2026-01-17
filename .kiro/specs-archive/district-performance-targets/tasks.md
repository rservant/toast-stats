# Implementation Plan: District Performance Targets

## Overview

This implementation plan transforms the District Overview page by integrating performance targets and rankings into existing metric cards. The work is divided into backend services (target calculation, region ranking), API integration, and frontend component enhancements.

## Tasks

- [x] 1. Create TargetCalculatorService
  - [x] 1.1 Create TypeScript interfaces for target calculation types
    - Define `RecognitionTargets`, `MetricTargets`, `RecognitionLevel` types
    - Add to `backend/src/types/analytics.ts`
    - _Requirements: 1.1, 2.1, 3.1_

  - [x] 1.2 Implement TargetCalculatorService class
    - Create `backend/src/services/TargetCalculatorService.ts`
    - Implement `calculatePaidClubsTargets()` with formula: ceil(base × multiplier)
    - Implement `calculatePaymentsTargets()` with same formula pattern
    - Implement `calculateDistinguishedTargets()` with percentage formula: ceil(base × percentage)
    - Implement `determineAchievedLevel()` helper to find highest achieved recognition level
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 2.2, 2.3, 2.4, 2.5, 2.6, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 1.3 Write property test for target calculation formula correctness
    - **Property 1: Target Calculation Formula Correctness**
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.5, 2.2, 2.3, 2.4, 2.5, 3.2, 3.3, 3.4, 3.5**

  - [x] 1.4 Write property test for ceiling rounding invariant
    - **Property 2: Ceiling Rounding Invariant**
    - **Validates: Requirements 1.6, 2.6, 3.6**

- [x] 2. Create RegionRankingService
  - [x] 2.1 Implement RegionRankingService class
    - Create `backend/src/services/RegionRankingService.ts`
    - Implement `calculateRegionRank()` to filter districts by region and compute rank
    - Implement `calculateWorldPercentile()` using formula: ((total - rank) / total) × 100
    - Return `RegionRankData` and `MetricRankings` types
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4_

  - [x] 2.2 Write property test for region ranking correctness
    - **Property 3: Region Ranking Correctness**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

  - [x] 2.3 Write property test for world percentile calculation
    - **Property 4: World Percentile Calculation**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**

- [x] 3. Extend DistrictAnalytics API Response
  - [x] 3.1 Add DistrictPerformanceTargets interface to analytics types
    - Define `DistrictPerformanceTargets` interface in `backend/src/types/analytics.ts`
    - Add optional `performanceTargets` field to `DistrictAnalytics` interface
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 3.2 Integrate services into AnalyticsEngine
    - Inject `TargetCalculatorService` and `RegionRankingService` into `AnalyticsEngine`
    - Modify `generateDistrictAnalytics()` to compute and include `performanceTargets`
    - Extract base values from district ranking data (`paidClubBase`, `paymentBase`)
    - Handle missing data by returning null for targets
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 8.1, 8.2, 8.3_

  - [x] 3.3 Write property test for API response completeness
    - **Property 6: API Response Completeness**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4**
    - **PBT Status: PASSED** - All 6 tests passed (response includes all required performance target fields, base values are included when available)

  - [x] 3.4 Write property test for missing data graceful handling
    - **Property 7: Missing Data Graceful Handling**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4**
    - **PBT Status: PASSED** - All 4 tests passed (null performanceTargets when rankings unavailable, null when district not found, null targets when base values invalid, null region rank when region empty)

- [x] 4. Checkpoint - Backend Implementation Complete
  - Ensure all backend tests pass
  - Verify API returns correct target and ranking data
  - Ask the user if questions arise

- [x] 5. Create TargetProgressCard Frontend Component
  - [x] 5.1 Create TargetProgressCard component
    - Create `frontend/src/components/TargetProgressCard.tsx`
    - Accept props: title, icon, current, base, targets, achievedLevel, rankings, badges, colorScheme
    - Display progress bars for each recognition level target
    - Show world rank, world percentile ("Top X%"), and region rank
    - Apply visual indicators (checkmark, color) when targets are met
    - _Requirements: 6.7, 6.8, 6.9_

  - [x] 5.2 Write property test for target achievement visual indication
    - **Property 5: Target Achievement Visual Indication**
    - **Validates: Requirements 6.9**

- [x] 6. Update DistrictOverview Component
  - [x] 6.1 Update frontend types for performance targets
    - Add `DistrictPerformanceTargets` and related types to `frontend/src/types/districts.ts`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 6.2 Transform Total Clubs card to Paid Clubs card
    - Replace "Total Clubs" card with `TargetProgressCard` for Paid Clubs
    - Retain existing Thriving, Vulnerable, Intervention Required badges
    - Display targets and rankings from `performanceTargets.paidClubs`
    - _Requirements: 6.1, 6.2_

  - [x] 6.3 Transform Total Membership card to Membership Payments card
    - Replace "Total Membership" card with `TargetProgressCard` for Membership Payments
    - Display targets and rankings from `performanceTargets.membershipPayments`
    - _Requirements: 6.3_

  - [x] 6.4 Enhance Distinguished Clubs card with targets
    - Replace Distinguished Clubs card with `TargetProgressCard`
    - Retain existing Smedley, President's, Select, Distinguished level badges
    - Display targets and rankings from `performanceTargets.distinguishedClubs`
    - _Requirements: 6.4, 6.5_

  - [x] 6.5 Remove Projected Year-End card
    - Remove the "Projected Year-End" card from DistrictOverview
    - _Requirements: 6.6_

  - [x] 6.6 Handle missing data display
    - Display "N/A" with tooltip for unavailable targets
    - Display "—" with tooltip for unavailable rankings
    - Omit region rank when region is unknown
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 7. Final Checkpoint - Full Integration Complete
  - Ensure all frontend and backend tests pass
  - Verify end-to-end data flow from API to UI
  - Ask the user if questions arise

## Notes

- Each task references specific requirements for traceability
- Property tests validate universal correctness properties using fast-check
- Unit tests validate specific examples and edge cases
- The implementation uses TypeScript with strict type checking per workspace rules
- All property tests are required for comprehensive coverage from the start
