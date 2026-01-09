# Implementation Plan: Analytics Engine Refactor

## Overview

This plan refactors `AnalyticsEngine.ts` (3,504 lines) into a modular architecture with 5 specialized analytics modules plus shared utilities. The implementation proceeds incrementally, extracting one module at a time while maintaining all existing tests passing.

## Tasks

- [x] 1. Set up module structure and shared utilities
  - [x] 1.1 Create analytics directory and index file
    - Create `backend/src/services/analytics/` directory
    - Create `backend/src/services/analytics/index.ts` with module exports
    - _Requirements: 1.6, 1.7_

  - [x] 1.2 Extract shared utility functions to AnalyticsUtils
    - Extract `parseIntSafe`, `ensureString` from AnalyticsEngine
    - Extract `getCurrentProgramMonth`, `getMonthName` from AnalyticsEngine
    - Extract `getDCPCheckpoint` from AnalyticsEngine
    - Extract `findPreviousProgramYearDate`, `calculatePercentageChange`, `determineTrend`
    - Create `backend/src/services/analytics/AnalyticsUtils.ts`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 1.3 Write unit tests for AnalyticsUtils
    - Test parseIntSafe with various inputs (string, number, null, undefined)
    - Test getDCPCheckpoint for all 12 months
    - Test getCurrentProgramMonth for various dates
    - _Requirements: 5.2_

- [x] 2. Extract MembershipAnalyticsModule
  - [x] 2.1 Create MembershipAnalyticsModule class
    - Extract `generateMembershipAnalytics` method
    - Extract `calculateMembershipYearOverYear` method
    - Extract private helpers: `calculateMembershipTrend`, `getTotalMembership`, `calculateMembershipChange`
    - Extract private helpers: `calculateTopGrowthClubs`, `calculateTopDecliningClubs`, `identifySeasonalPatterns`
    - Extract `calculateProgramYearChange`
    - Create `backend/src/services/analytics/MembershipAnalyticsModule.ts`
    - _Requirements: 1.1, 4.1, 4.2_

  - [x] 2.2 Write property test for MembershipAnalyticsModule output equivalence
    - **Property 1: Output Equivalence (Membership)**
    - **Validates: Requirements 2.3, 5.4**

  - [x] 2.3 Update AnalyticsEngine to delegate membership methods
    - Import MembershipAnalyticsModule
    - Instantiate module in constructor with dataSource
    - Delegate `generateMembershipAnalytics` to module
    - _Requirements: 1.1, 2.1, 2.2_

- [x] 3. Checkpoint - Verify membership module extraction
  - Ensure all existing AnalyticsEngine tests pass
  - Verify MembershipAnalyticsModule file is ≤800 lines
  - Ask the user if questions arise

- [x] 4. Extract DistinguishedClubAnalyticsModule
  - [x] 4.1 Create DistinguishedClubAnalyticsModule class
    - Extract `generateDistinguishedClubAnalytics` method
    - Extract `calculateDistinguishedYearOverYear` method
    - Extract private helpers: `calculateDistinguishedClubs`, `projectDistinguishedClubs`
    - Extract private helpers: `calculateDistinguishedProjection`, `trackDistinguishedAchievements`
    - Extract private helpers: `analyzeDCPGoals`, `determineDistinguishedLevel`, `identifyDistinguishedLevel`
    - Extract private helpers: `extractDistinguishedLevelFromStatus`, `isHigherLevel`, `getLevel4FieldName`
    - Create `backend/src/services/analytics/DistinguishedClubAnalyticsModule.ts`
    - _Requirements: 1.2, 4.1, 4.2_

  - [x] 4.2 Write property test for DistinguishedClubAnalyticsModule output equivalence
    - **Property 1: Output Equivalence (Distinguished)**
    - **Validates: Requirements 2.3, 5.4**

  - [x] 4.3 Update AnalyticsEngine to delegate distinguished club methods
    - Import DistinguishedClubAnalyticsModule
    - Instantiate module in constructor with dataSource
    - Delegate `generateDistinguishedClubAnalytics` to module
    - _Requirements: 1.2, 2.1, 2.2_

- [x] 5. Extract ClubHealthAnalyticsModule
  - [x] 5.1 Create ClubHealthAnalyticsModule class
    - Extract `identifyAtRiskClubs` method
    - Extract `getClubTrends` method
    - Extract private helpers: `analyzeClubTrends`, `assessClubHealth`, `calculateClubHealthScore`
    - Extract private helpers: `countVulnerableClubs`, `countInterventionRequiredClubs`, `countThrivingClubs`
    - Extract private helpers: `getCSPStatus`, `calculateNetGrowth`
    - Create `backend/src/services/analytics/ClubHealthAnalyticsModule.ts`
    - _Requirements: 1.3, 4.1, 4.2_

  - [x] 5.2 Write property test for ClubHealthAnalyticsModule output equivalence
    - **Property 1: Output Equivalence (Club Health)**
    - **Validates: Requirements 2.3, 5.4**

  - [x] 5.3 Update AnalyticsEngine to delegate club health methods
    - Import ClubHealthAnalyticsModule
    - Instantiate module in constructor with dataSource
    - Delegate `identifyAtRiskClubs` and `getClubTrends` to module
    - _Requirements: 1.3, 2.1, 2.2_

- [x] 6. Checkpoint - Verify club modules extraction
  - Ensure all existing AnalyticsEngine tests pass ✓ (8 tests passed)
  - Verify DistinguishedClubAnalyticsModule file is ≤800 lines ✓ (796 lines)
  - Verify ClubHealthAnalyticsModule file is ≤800 lines ✓ (707 lines)
  - Ask the user if questions arise

- [x] 7. Extract DivisionAreaAnalyticsModule
  - [x] 7.1 Create DivisionAreaAnalyticsModule class
    - Extract `compareDivisions` method
    - Extract private helpers: `analyzeDivisions`, `analyzeAreas`
    - Extract private helpers: `detectDivisionTrends`, `getDivisionDcpGoals`, `getTotalDcpGoals`
    - Create `backend/src/services/analytics/DivisionAreaAnalyticsModule.ts`
    - _Requirements: 1.4, 4.1, 4.2_

  - [x] 7.2 Write property test for DivisionAreaAnalyticsModule output equivalence
    - **Property 1: Output Equivalence (Division/Area)**
    - **Validates: Requirements 2.3, 5.4**

  - [x] 7.3 Update AnalyticsEngine to delegate division/area methods
    - Import DivisionAreaAnalyticsModule
    - Instantiate module in constructor with dataSource
    - Delegate `compareDivisions` to module
    - _Requirements: 1.4, 2.1, 2.2_

- [x] 8. Extract LeadershipAnalyticsModule
  - [x] 8.1 Create LeadershipAnalyticsModule class
    - Extract `generateLeadershipInsights` method
    - Extract private helpers: `calculateLeadershipEffectiveness`
    - Extract private helpers: `calculateDivisionHealthScore`, `calculateDivisionGrowthScore`, `calculateDivisionDCPScore`
    - Extract private helpers: `identifyBestPracticeDivisions`, `isDivisionConsistent`
    - Extract private helpers: `trackLeadershipChanges`, `analyzeAreaDirectorCorrelations`, `generateLeadershipSummary`
    - Create `backend/src/services/analytics/LeadershipAnalyticsModule.ts`
    - _Requirements: 1.5, 4.1, 4.2_

  - [x] 8.2 Write property test for LeadershipAnalyticsModule output equivalence
    - **Property 1: Output Equivalence (Leadership)**
    - **Validates: Requirements 2.3, 5.4**

  - [x] 8.3 Update AnalyticsEngine to delegate leadership methods
    - Import LeadershipAnalyticsModule
    - Instantiate module in constructor with dataSource
    - Delegate `generateLeadershipInsights` to module
    - _Requirements: 1.5, 2.1, 2.2_

- [x] 9. Checkpoint - Verify all modules extracted
  - Ensure all existing AnalyticsEngine tests pass ✓ (8 tests passed)
  - Verify DivisionAreaAnalyticsModule file is ≤800 lines ✓ (455 lines)
  - Verify LeadershipAnalyticsModule file is ≤800 lines ✓ (511 lines)
  - Ask the user if questions arise

- [x] 10. Refactor generateDistrictAnalytics to use modules
  - [x] 10.1 Update generateDistrictAnalytics to compose from modules
    - Use ClubHealthAnalyticsModule for club health data
    - Use MembershipAnalyticsModule for membership data
    - Use DistinguishedClubAnalyticsModule for distinguished club data
    - Use DivisionAreaAnalyticsModule for division/area rankings
    - Maintain identical output structure
    - _Requirements: 2.3, 2.4_

  - [x] 10.2 Write property test for generateDistrictAnalytics output equivalence
    - **Property 2: Module Delegation Consistency**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**

- [x] 11. Refactor calculateYearOverYear to use modules
  - [x] 11.1 Update calculateYearOverYear to compose from modules
    - Use MembershipAnalyticsModule for membership year-over-year
    - Use DistinguishedClubAnalyticsModule for distinguished year-over-year
    - Use ClubHealthAnalyticsModule for club health metrics
    - Maintain identical output structure
    - _Requirements: 2.3, 2.4_

- [x] 12. Final cleanup and verification
  - [x] 12.1 Remove unused private methods from AnalyticsEngine
    - Remove methods that have been extracted to modules
    - Verify AnalyticsEngine is now ≤300 lines
    - Update imports to use shared utilities
    - _Requirements: 1.6, 1.7_

  - [x] 12.2 Update analytics/index.ts exports
    - Export all module classes
    - Export AnalyticsUtils functions
    - _Requirements: 3.4_

  - [x] 12.3 Write comprehensive property test for full API equivalence
    - **Property 3: Utility Function Equivalence**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

- [x] 13. Final checkpoint - Full test suite verification
  - Run all existing AnalyticsEngine tests (must pass without modification)
  - Run all new module unit tests
  - Run all property tests
  - Verify test coverage has not decreased
  - Verify all module files are ≤800 lines
  - Verify all modules have ≤15 public methods
  - _Requirements: 5.1, 5.2, 5.3_

## Notes

- Tasks marked with `*` are optional property tests that can be skipped for faster MVP
- Each checkpoint ensures incremental validation before proceeding
- The refactoring preserves all existing behavior - no functional changes
- Property tests use fast-check with minimum 100 iterations
- Existing integration tests in `AnalyticsEngine.integration.test.ts` must pass throughout
