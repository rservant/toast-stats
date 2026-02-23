# Implementation Plan: Backend Computation Removal

## Overview

This implementation removes on-demand analytics computation from the backend by **moving the hardened backend analytics modules to analytics-core** (not rewriting them), then updating routes to serve pre-computed files.

**Critical Principle:** The backend analytics modules have been hardened with bug fixes. We MOVE this code to analytics-core, preserving all logic. We do NOT rewrite from scratch.

## Tasks

- [x] 1. Move backend analytics types to analytics-core
  - [x] 1.1 Copy MembershipAnalytics type from backend/src/types/analytics.ts to analytics-core/types.ts
    - Include SeasonalPattern, yearOverYearComparison types
    - _Requirements: 1.2_
  - [x] 1.2 Copy LeadershipInsights type from backend/src/types/analytics.ts to analytics-core/types.ts
    - _Requirements: 4.2_
  - [x] 1.3 Copy YearOverYearComparison extended type from backend to analytics-core/types.ts
    - Include full metrics structure with byLevel breakdowns
    - _Requirements: 6.2, 6.3_
  - [x] 1.4 Copy DistrictPerformanceTargets type from backend to analytics-core/types.ts
    - _Requirements: 7.2_
  - [x] 1.5 Add VulnerableClubsData wrapper type to analytics-core/types.ts
    - Wrap existing ClubTrend arrays with metadata
    - _Requirements: 3.2_
  - [x] 1.6 Add ClubTrendsIndex type to analytics-core/types.ts
    - Record<clubId, ClubTrend> for efficient lookup
    - _Requirements: 2.2_
  - [x] 1.7 Export all new types from analytics-core/index.ts
    - _Requirements: 1.2, 2.2, 3.2, 4.2, 6.2, 7.2_

- [x] 2. Move backend AnalyticsUtils to analytics-core
  - [x] 2.1 Copy AnalyticsUtils.ts from backend/src/services/analytics/ to analytics-core/analytics/
    - Include parseIntSafe, ensureString, calculatePercentageChange, determineTrend, etc.
    - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1_
  - [x] 2.2 Update imports in copied AnalyticsUtils to use analytics-core paths
    - _Requirements: 1.1_

- [x] 3. Move and adapt MembershipAnalyticsModule to analytics-core
  - [x] 3.1 Copy MembershipAnalyticsModule.ts from backend to analytics-core/analytics/
    - _Requirements: 1.1, 1.2_
  - [x] 3.2 Adapt MembershipAnalyticsModule to accept DistrictStatistics[] instead of IAnalyticsDataSource
    - Remove constructor with dataSource
    - Change async methods to sync methods accepting snapshots parameter
    - PRESERVE all computation logic exactly
    - _Requirements: 1.1, 1.2_
  - [x] 3.3 Update imports to use analytics-core types and utils
    - _Requirements: 1.1_
  - [x] 3.4 Write unit tests verifying moved module produces same results
    - Test with sample data to ensure no regression
    - _Requirements: 1.1, 1.2_

- [x] 4. Move and adapt ClubHealthAnalyticsModule to analytics-core
  - [x] 4.1 Copy ClubHealthAnalyticsModule.ts from backend to analytics-core/analytics/
    - _Requirements: 2.1, 3.1_
  - [x] 4.2 Adapt ClubHealthAnalyticsModule to accept DistrictStatistics[] instead of IAnalyticsDataSource
    - PRESERVE all computation logic exactly
    - _Requirements: 2.1, 3.1_
  - [x] 4.3 Update imports to use analytics-core types and utils
    - _Requirements: 2.1_
  - [x] 4.4 Write unit tests verifying moved module produces same results
    - _Requirements: 2.1, 3.1_

- [x] 5. Move and adapt remaining analytics modules to analytics-core
  - [x] 5.1 Move and adapt DistinguishedClubAnalyticsModule
    - Copy, adapt to DistrictStatistics[], preserve logic
    - _Requirements: 5.1, 5.2_
  - [x] 5.2 Move and adapt DivisionAreaAnalyticsModule
    - Copy, adapt to DistrictStatistics[], preserve logic
    - _Requirements: 4.1_
  - [x] 5.3 Move and adapt LeadershipAnalyticsModule
    - Copy, adapt to DistrictStatistics[], preserve logic
    - _Requirements: 4.1, 4.2_
  - [x] 5.4 Move and adapt AreaDivisionRecognitionModule
    - Copy, adapt to DistrictStatistics[], preserve logic
    - _Requirements: 7.1_
  - [x] 5.5 Write unit tests for all moved modules
    - _Requirements: 4.1, 5.1, 7.1_

- [x] 6. Checkpoint - Ensure analytics-core tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Verify moved modules compile and work correctly

- [x] 7. Update AnalyticsComputer to use moved modules
  - [x] 7.1 Update AnalyticsComputer to instantiate moved modules
    - Replace simple analytics-core modules with moved backend modules
    - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1_
  - [x] 7.2 Add computeMembershipAnalytics method using moved MembershipAnalyticsModule
    - _Requirements: 1.1, 1.2_
  - [x] 7.3 Add computeVulnerableClubs method using moved ClubHealthAnalyticsModule
    - _Requirements: 3.1, 3.2_
  - [x] 7.4 Add computeLeadershipInsights method using moved LeadershipAnalyticsModule
    - _Requirements: 4.1, 4.2_
  - [x] 7.5 Add computeYearOverYear method using moved module logic
    - _Requirements: 6.1, 6.2, 6.3_
  - [x] 7.6 Add computePerformanceTargets method
    - _Requirements: 7.1, 7.2_
  - [x] 7.7 Add buildClubTrendsIndex method
    - _Requirements: 2.1, 2.2_
  - [x] 7.8 Update computeDistrictAnalytics to return ExtendedAnalyticsComputationResult
    - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1_
  - [x] 7.9 Write property test for club trends index lookup
    - **Property 3: Club Trends Index Lookup**
    - **Validates: Requirements 2.2, 2.3, 2.4**
  - [x] 7.10 Write property test for vulnerable clubs partition
    - **Property 4: Vulnerable Clubs Partition**
    - **Validates: Requirements 3.2, 3.3**

- [x] 8. Extend AnalyticsWriter to write new analytics file types
  - [x] 8.1 Add writeMembershipAnalytics method
    - Write district\_{id}\_membership-analytics.json
    - _Requirements: 1.1, 1.3_
  - [x] 8.2 Add writeVulnerableClubs method
    - Write district\_{id}\_vulnerable-clubs.json
    - _Requirements: 3.1_
  - [x] 8.3 Add writeLeadershipInsights method
    - Write district\_{id}\_leadership-insights.json
    - _Requirements: 4.1_
  - [x] 8.4 Add writeDistinguishedClubAnalytics method
    - Write district\_{id}\_distinguished-analytics.json
    - _Requirements: 5.1_
  - [x] 8.5 Add writeYearOverYear method
    - Write district\_{id}\_year-over-year.json
    - _Requirements: 6.1_
  - [x] 8.6 Add writePerformanceTargets method
    - Write district\_{id}\_performance-targets.json
    - _Requirements: 7.1_
  - [x] 8.7 Add writeClubTrendsIndex method
    - Write district\_{id}\_club-trends-index.json
    - _Requirements: 2.1_
  - [x] 8.8 Write unit tests for new AnalyticsWriter methods
    - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1_

- [x] 9. Update AnalyticsComputeService to generate all new files
  - [x] 9.1 Update computeDistrictAnalytics to call new AnalyticsComputer methods
    - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1_
  - [x] 9.2 Update computeDistrictAnalytics to write all new file types
    - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1_
  - [x] 9.3 Update manifest entries to include new file types
    - _Requirements: 12.3_
  - [x] 9.4 Write integration test for complete analytics generation
    - Verify all files are generated in a single compute-analytics run
    - _Requirements: 12.3_

- [x] 10. Checkpoint - Ensure collector-cli tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Extend PreComputedAnalyticsReader to read new file types
  - [x] 11.1 Add readMembershipAnalytics method
    - _Requirements: 10.1_
  - [x] 11.2 Add readVulnerableClubs method
    - _Requirements: 10.2_
  - [x] 11.3 Add readLeadershipInsights method
    - _Requirements: 10.3_
  - [x] 11.4 Add readDistinguishedClubAnalytics method
    - _Requirements: 10.4_
  - [x] 11.5 Add readYearOverYear method
    - _Requirements: 10.5_
  - [x] 11.6 Add readPerformanceTargets method
    - _Requirements: 10.6_
  - [x] 11.7 Add readClubTrends method (lookup from index)
    - _Requirements: 10.1, 2.4_
  - [x] 11.8 Write unit tests for new PreComputedAnalyticsReader methods
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

- [x] 12. Update backend routes to serve pre-computed data
  - [x] 12.1 Update membership-analytics route to use PreComputedAnalyticsReader
    - Remove AnalyticsEngine call, read from pre-computed file
    - Return 404 with helpful message if file missing
    - _Requirements: 1.4, 1.5, 8.1_
  - [x] 12.2 Update club trends route to use PreComputedAnalyticsReader
    - _Requirements: 2.4, 2.5, 8.2_
  - [x] 12.3 Update vulnerable-clubs route to use PreComputedAnalyticsReader
    - _Requirements: 3.4, 3.5, 8.3_
  - [x] 12.4 Update leadership-insights route to use PreComputedAnalyticsReader
    - _Requirements: 4.3, 4.4, 8.4_
  - [x] 12.5 Update distinguished-club-analytics route to use PreComputedAnalyticsReader
    - _Requirements: 5.3, 5.4, 8.5_
  - [x] 12.6 Update year-over-year route to use PreComputedAnalyticsReader
    - _Requirements: 6.4, 6.5, 8.6_
  - [x] 12.7 Update analytics export route to use pre-computed data
    - _Requirements: 8.7, 11.1, 11.2, 11.4_
  - [x] 12.8 Update analytics-summary route to remove AnalyticsEngine call
    - _Requirements: 8.8_
  - [x] 12.9 Write unit tests for updated routes
    - _Requirements: 1.5, 2.5, 3.5, 4.4, 5.4, 6.5, 11.4, 12.1, 12.2_

- [x] 13. Checkpoint - Ensure backend route tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Remove AnalyticsEngine and original analytics modules from backend
  - [x] 14.1 Remove AnalyticsEngine.ts from backend/src/services/
    - _Requirements: 9.1_
  - [x] 14.2 Remove backend/src/services/analytics/ directory
    - All modules have been moved to analytics-core
    - _Requirements: 9.2_
  - [x] 14.3 Remove TargetCalculatorService.ts from backend/src/services/
    - _Requirements: 9.3_
  - [x] 14.4 Remove RegionRankingService.ts from backend/src/services/
    - _Requirements: 9.3_
  - [x] 14.5 Clean up imports and references to removed services
    - Update shared.ts to remove getAnalyticsEngine
    - _Requirements: 9.4_
  - [x] 14.6 Remove analytics-related types only used by AnalyticsEngine from backend
    - _Requirements: 9.4_

- [x] 15. Update OpenAPI specification for modified routes
  - [x] 15.1 Update response schemas in backend/openapi.yaml
    - Update 404 response descriptions to mention pre-computed data
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_

- [x] 16. Final checkpoint - Ensure all tests pass and build succeeds
  - Ensure all tests pass, ask the user if questions arise.
  - Verify TypeScript compilation succeeds with no errors
  - Verify no references to removed services remain

## Notes

- All tasks are required for comprehensive implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (index lookup, partition)
- Unit tests validate specific examples and edge cases
- **CRITICAL: Backend analytics modules are MOVED, not rewritten, to preserve bug fixes**
- The existing `precomputed-analytics-alignment` spec handles DistrictAnalytics structure alignment
- This spec focuses on eliminating remaining on-demand computation violations
