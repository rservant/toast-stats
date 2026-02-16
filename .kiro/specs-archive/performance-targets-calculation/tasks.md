# Implementation Plan: Performance Targets Calculation

## Overview

This implementation fixes two bugs in the District Overview page:

1. "Targets: N/A" - caused by missing base values and recognition targets in PerformanceTargetsData
2. "+0 members" - caused by incorrect membership change calculation

The fix extends the analytics-core computation to include base values, recognition targets, and achieved levels, then updates the backend transformation to map these fields correctly.

## Tasks

- [x] 1. Create Target Calculator Module in Analytics Core
  - [x] 1.1 Create TargetCalculator.ts with target calculation functions
    - Create `packages/analytics-core/src/analytics/TargetCalculator.ts`
    - Implement `calculateGrowthTargets(base: number): RecognitionTargets`
    - Implement `calculatePercentageTargets(base: number): RecognitionTargets`
    - Implement `determineAchievedLevel(current: number, targets: RecognitionTargets | null): RecognitionLevel | null`
    - Export constants for growth percentages (1%, 3%, 5%, 8%) and distinguished percentages (45%, 50%, 55%, 60%)
    - _Requirements: 2.1-2.6, 3.1-3.6, 4.1-4.6, 5.1-5.6_

  - [x] 1.2 Write unit tests for TargetCalculator
    - Create `packages/analytics-core/src/analytics/__tests__/TargetCalculator.test.ts`
    - Test growth target calculations with specific base values (100, 95, 99)
    - Test percentage target calculations with specific base values
    - Test ceiling rounding with fractional results
    - Test achieved level determination at boundaries
    - Test null targets case
    - _Requirements: 2.1-2.6, 3.1-3.6, 4.1-4.6, 5.1-5.6_

  - [x] 1.3 Write property test for ceiling rounding invariant
    - Add property test to verify all targets are ceiling-rounded integers
    - **Property 4: Ceiling Rounding Invariant**
    - **Validates: Requirements 2.6, 3.6, 4.6**

  - [x] 1.4 Write property test for achieved level determination
    - Add property test to verify correct level classification for all current/target combinations
    - **Property 5: Achieved Level Determination**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

- [x] 2. Extend PerformanceTargetsData Type
  - [x] 2.1 Update types.ts with new fields
    - Add `paidClubBase: number | null` field
    - Add `paymentBase: number | null` field
    - Add `paidClubsTargets: RecognitionTargets | null` field
    - Add `membershipPaymentsTargets: RecognitionTargets | null` field
    - Add `distinguishedClubsTargets: RecognitionTargets | null` field
    - Add `paidClubsAchievedLevel: RecognitionLevel | null` field
    - Add `membershipPaymentsAchievedLevel: RecognitionLevel | null` field
    - Add `distinguishedClubsAchievedLevel: RecognitionLevel | null` field
    - _Requirements: 6.1-6.8_

- [x] 3. Update computePerformanceTargets Method
  - [x] 3.1 Extract base values from All-Districts Rankings
    - Find district in allDistrictsRankings by districtId
    - Extract paidClubBase and paymentBase from district ranking
    - Set to null if rankings data unavailable or district not found
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 3.2 Calculate recognition targets using TargetCalculator
    - Calculate paidClubsTargets using calculateGrowthTargets(paidClubBase)
    - Calculate membershipPaymentsTargets using calculateGrowthTargets(paymentBase)
    - Calculate distinguishedClubsTargets using calculatePercentageTargets(paidClubBase)
    - Set to null if base values unavailable
    - _Requirements: 2.1-2.5, 3.1-3.5, 4.1-4.5_

  - [x] 3.3 Determine achieved recognition levels
    - Calculate paidClubsAchievedLevel using determineAchievedLevel
    - Calculate membershipPaymentsAchievedLevel using determineAchievedLevel
    - Calculate distinguishedClubsAchievedLevel using determineAchievedLevel
    - _Requirements: 5.1-5.6_

  - [x] 3.4 Include new fields in return object
    - Add all new fields to the returned PerformanceTargetsData object
    - _Requirements: 6.1-6.8_

  - [x] 3.5 Write unit tests for computePerformanceTargets updates
    - Test base value extraction with valid rankings data
    - Test base value extraction with missing rankings data
    - Test target calculation integration
    - Test achieved level integration
    - _Requirements: 1.1-1.3, 2.1-2.5, 3.1-3.5, 4.1-4.5, 5.1-5.6_

- [x] 4. Checkpoint - Verify Analytics Core Changes
  - Ensure all analytics-core tests pass
  - Ask the user if questions arise

- [x] 5. Update Backend Transformation
  - [x] 5.1 Update transformPerformanceTargets function
    - Map paidClubBase to paidClubs.base
    - Map paymentBase to membershipPayments.base
    - Map paidClubBase to distinguishedClubs.base (distinguished uses Club_Base)
    - Map paidClubsTargets to paidClubs.targets
    - Map membershipPaymentsTargets to membershipPayments.targets
    - Map distinguishedClubsTargets to distinguishedClubs.targets
    - Map paidClubsAchievedLevel to paidClubs.achievedLevel
    - Map membershipPaymentsAchievedLevel to membershipPayments.achievedLevel
    - Map distinguishedClubsAchievedLevel to distinguishedClubs.achievedLevel
    - _Requirements: 7.1-7.9_

  - [x] 5.2 Write unit tests for updated transformation
    - Test transformation with all fields populated
    - Test transformation with null base/targets
    - Verify all field mappings are correct
    - _Requirements: 7.1-7.9_

- [x] 6. Fix Membership Change Calculation
  - [x] 6.1 Update membership change calculation in AnalyticsComputer
    - When paymentBase is available, calculate membershipChange as currentPayments - paymentBase
    - Fall back to existing snapshot-based calculation when paymentBase unavailable
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 6.2 Write unit tests for membership change calculation
    - Test with paymentBase available
    - Test fallback when paymentBase unavailable
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 7. Checkpoint - Verify All Changes
  - Ensure all backend tests pass
  - Ensure analytics-core tests pass
  - Ask the user if questions arise

- [x] 8. Integration Verification
  - [x] 8.1 Verify end-to-end data flow
    - Run scraper-cli to regenerate analytics with updated computation
    - Verify performance-targets.json contains new fields
    - Verify backend serves correct data
    - _Requirements: 1.1-1.4, 6.1-6.8, 7.1-7.9_

## Notes

- All tasks including tests are required for comprehensive coverage
- This fix does not require any API endpoint changes, only data computation changes
- The frontend already expects the correct data structure; only the backend computation was incomplete
- All computation happens in analytics-core per the data-computation-separation steering document
