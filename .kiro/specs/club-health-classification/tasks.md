# Implementation Plan: Club Health Classification Refactor

## Overview

This plan refactors the existing `assessClubHealth` method in `AnalyticsEngine` to use monthly DCP checkpoint-based classification. The implementation modifies existing code rather than creating new services, maintaining full backward compatibility with the frontend.

## Tasks

- [x] 1. Add DCP checkpoint helper methods to AnalyticsEngine
  - [x] 1.1 Implement getDCPCheckpoint method
    - Add method that returns required DCP goals for a given month
    - July: 0 (administrative checkpoint), Aug-Sep: 1, Oct-Nov: 2, Dec-Jan: 3, Feb-Mar: 4, Apr-Jun: 5
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  - [x] 1.2 Implement getCurrentProgramMonth method
    - Extract month from snapshot date or use current date
    - Return month number (1-12)
    - _Requirements: 2.1_

- [x] 1.3 Write property test for DCP checkpoint monotonicity
  - **Property 3: DCP Checkpoint Monotonicity**
  - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

- [x] 2. Refactor assessClubHealth method
  - [x] 2.1 Update assessClubHealth to use new classification logic
    - Add latestClubData parameter to access raw club fields
    - Calculate net growth from Active Members and Mem. Base
    - Apply intervention override rule (membership < 12 AND net growth < 3)
    - Evaluate membership requirement (>= 20 OR net growth >= 3)
    - Evaluate DCP checkpoint based on current month
    - Handle CSP requirement with graceful degradation
    - Use new status values: 'thriving', 'vulnerable', 'intervention-required'
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.1_
  - [x] 2.2 Update riskFactors population
    - Add specific reasons for each unmet requirement
    - Include DCP checkpoint details (X achieved, Y required for Month)
    - Clear riskFactors for Thriving clubs
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 2.3 Write property test for health status mutual exclusivity
  - **Property 1: Health Status Mutual Exclusivity**
  - **Validates: Requirements 1.1, 1.4, 1.5**

- [x] 2.4 Write property test for intervention override rule
  - **Property 2: Intervention Override Rule**
  - **Validates: Requirements 1.2**

- [x] 3. Update analyzeClubTrends to pass club data
  - [x] 3.1 Modify analyzeClubTrends to pass latestClubData to assessClubHealth
    - Find the latest ScrapedRecord for each club
    - Pass it to assessClubHealth for net growth calculation
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 4. Checkpoint - Verify classification logic works
  - Run existing tests to ensure no regressions
  - Manually verify classification for sample clubs
  - Ensure all tests pass, ask the user if questions arise

- [x] 5. Update types and helper methods
  - [x] 5.1 Update ClubHealthStatus type in analytics.ts
    - Change from 'healthy' | 'at-risk' | 'critical' to 'thriving' | 'vulnerable' | 'intervention-required'
    - _Requirements: 3.3_
  - [x] 5.2 Update DistrictAnalytics interface
    - Rename healthyClubs to thrivingClubs
    - Rename atRiskClubs to vulnerableClubs
    - Rename criticalClubs to interventionRequiredClubs
    - _Requirements: 3.2_
  - [x] 5.3 Update countHealthyClubs to countThrivingClubs
    - Rename method and apply new classification logic
    - _Requirements: 3.2_
  - [x] 5.4 Update countAtRiskClubs to countVulnerableClubs
    - Rename method and apply new classification logic
    - _Requirements: 3.2_
  - [x] 5.5 Update countCriticalClubs to countInterventionRequiredClubs
    - Rename method and apply new classification logic
    - _Requirements: 3.2_
  - [x] 5.6 Update generateDistrictAnalytics to use new array names
    - Use thrivingClubs, vulnerableClubs, interventionRequiredClubs
    - _Requirements: 3.2_

- [x] 5.7 Write property test for API type consistency
  - **Property 5: API Type Consistency**
  - **Validates: Requirements 3.1, 3.3**

- [x] 5.8 Write property test for Thriving completeness
  - **Property 4: Thriving Completeness**
  - **Validates: Requirements 1.4**

- [x] 5.9 Write property test for reason completeness
  - **Property 6: Reason Completeness**
  - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

- [x] 6. Write unit tests for classification scenarios
  - [x] 6.1 Test intervention required cases
    - Membership 8, net growth 0 → intervention-required
    - Membership 11, net growth 2 → intervention-required
    - Membership 11, net growth 3 → NOT intervention-required (growth override)
    - _Requirements: 1.2, 1.3_
  - [x] 6.2 Test thriving cases
    - Membership 20, DCP meets checkpoint, CSP true → thriving
    - Membership 15, net growth 5, DCP meets checkpoint → thriving
    - _Requirements: 1.4_
  - [x] 6.3 Test vulnerable cases
    - Membership 20, DCP below checkpoint → vulnerable
    - Membership 20, DCP meets checkpoint, CSP false → vulnerable
    - _Requirements: 1.5_
  - [x] 6.4 Test month boundary cases
    - Test classification at each month transition
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 7. Update frontend types and hooks
  - [x] 7.1 Update ClubTrend type in useDistrictAnalytics.ts
    - Change currentStatus type to new values
    - _Requirements: 3.3_
  - [x] 7.2 Update DistrictAnalytics interface in useDistrictAnalytics.ts
    - Rename healthyClubs to thrivingClubs
    - Rename atRiskClubs to vulnerableClubs
    - Rename criticalClubs to interventionRequiredClubs
    - _Requirements: 3.2_
  - [x] 7.3 Update useClubTrends.ts
    - Update ClubTrend type reference
    - Update useAtRiskClubs to useVulnerableClubs
    - _Requirements: 3.2, 3.3_

- [x] 8. Rename and update frontend components
  - [x] 8.1 Rename AtRiskClubsPanel to VulnerableClubsPanel
    - Update component name and file name
    - Change "At-Risk Clubs" title to "Vulnerable Clubs"
    - Update status badge to show "VULNERABLE"
    - _Requirements: 6.2_
  - [x] 8.2 Rename CriticalClubsPanel to InterventionRequiredClubsPanel
    - Update component name and file name
    - Change "Critical Clubs" title to "Intervention Required"
    - Update status badge to show "INTERVENTION REQUIRED"
    - _Requirements: 6.3_
  - [x] 8.3 Update ClubsTable component
    - Update getStatusBadge for new status values
    - Update getRowColor for new status values
    - Update status display labels (THRIVING, VULNERABLE, INTERVENTION REQUIRED)
    - Update statusOrder for sorting
    - _Requirements: 6.4_
  - [x] 8.4 Update YearOverYearComparison component
    - Change "healthyClubs" references to "thrivingClubs"
    - Update "Club Health %" label to "Thriving Clubs %"
    - _Requirements: 6.5_

- [x] 9. Update DistrictDetailPage
  - [x] 9.1 Update imports and component usage
    - Import VulnerableClubsPanel instead of AtRiskClubsPanel
    - Import InterventionRequiredClubsPanel instead of CriticalClubsPanel
    - _Requirements: 6.6_
  - [x] 9.2 Update variable names
    - Rename criticalClubs to interventionRequiredClubs
    - Rename atRiskClubs to vulnerableClubs
    - Update analytics references (thrivingClubs instead of healthyClubs)
    - _Requirements: 6.6_

- [x] 10. Update component tests
  - [x] 10.1 Rename and update AtRiskClubsPanel.test.tsx
    - Rename to VulnerableClubsPanel.test.tsx
    - Update test descriptions and assertions
    - _Requirements: 6.2_
  - [x] 10.2 Rename and update CriticalClubsPanel.test.tsx
    - Rename to InterventionRequiredClubsPanel.test.tsx
    - Update test descriptions and assertions
    - _Requirements: 6.3_
  - [x] 10.3 Update ClubsTable tests
    - Update status values in test data
    - _Requirements: 6.4_

- [x] 11. Checkpoint - Verify frontend works
  - Run frontend tests
  - Verify district detail page displays correct terminology
  - Ensure all tests pass, ask the user if questions arise

- [x] 12. Integration testing
  - [x] 12.1 Verify generateDistrictAnalytics returns correct arrays
    - vulnerableClubs contains Vulnerable clubs
    - interventionRequiredClubs contains Intervention Required clubs
    - thrivingClubs contains Thriving clubs
    - _Requirements: 3.2_
  - [x] 12.2 Verify year-over-year calculations use new logic
    - Club health metrics use new classification
    - _Requirements: 3.4_

- [x] 13. Final checkpoint - Complete validation
  - Run full test suite (backend and frontend)
  - Verify UI displays correct classifications with new terminology
  - Ensure all tests pass, ask the user if questions arise

## Notes

- Tasks marked with `*` are optional property-based tests that can be skipped for faster MVP
- This refactoring updates both backend and frontend to use new terminology
- The API contract changes (new status values and array names) require coordinated backend/frontend deployment
- CSP data is available starting from the 2025-2026 program year; for prior years, CSP is treated as submitted since the field did not exist
