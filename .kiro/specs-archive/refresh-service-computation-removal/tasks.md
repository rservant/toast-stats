# Implementation Plan: Backend Computation Removal

## Overview

This implementation removes all on-demand computation from the backend by **migrating hardened code to analytics-core** (not rewriting), extending scraper-cli to generate time-series indexes and rankings, and updating backend services to be read-only.

**Critical Principle:** Backend computation code has been hardened with bug fixes. We MOVE this code to analytics-core, preserving all logic. We do NOT rewrite from scratch.

## Tasks

- [x] 1. Add time-series types to shared-contracts
  - [x] 1.1 Create TimeSeriesDataPoint type in shared-contracts/src/types/time-series.ts
    - Include date, snapshotId, membership, payments, dcpGoals, distinguishedTotal, clubCounts
    - _Requirements: 13.1_
  - [x] 1.2 Create ProgramYearIndexFile type in shared-contracts
    - Include districtId, programYear, startDate, endDate, lastUpdated, dataPoints, summary
    - _Requirements: 13.2_
  - [x] 1.3 Create ProgramYearSummary type in shared-contracts
    - Include totalDataPoints, membershipStart, membershipEnd, membershipPeak, membershipLow
    - _Requirements: 13.2_
  - [x] 1.4 Create TimeSeriesIndexMetadata type in shared-contracts
    - Include districtId, lastUpdated, availableProgramYears, totalDataPoints
    - _Requirements: 13.3_
  - [x] 1.5 Create Zod schemas for all time-series types
    - TimeSeriesDataPointSchema, ProgramYearIndexFileSchema, etc.
    - _Requirements: 13.4_
  - [x] 1.6 Create validation helpers for time-series types
    - validateTimeSeriesDataPoint, validateProgramYearIndexFile
    - _Requirements: 13.5_
  - [x] 1.7 Export all time-series types and schemas from shared-contracts/src/index.ts
    - _Requirements: 13.6, 13.7, 13.8_

- [x] 2. Migrate TimeSeriesDataPointBuilder to analytics-core
  - [x] 2.1 Copy computation methods from RefreshService to analytics-core/src/timeseries/TimeSeriesDataPointBuilder.ts
    - Copy buildTimeSeriesDataPoint, calculateTotalMembership, calculateTotalPayments
    - Copy calculateTotalDCPGoals, calculateClubHealthCounts, calculateDistinguishedTotal
    - Copy isDistinguished, parseIntSafe
    - PRESERVE all logic exactly
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_
  - [x] 2.2 Update imports to use shared-contracts types
    - Import TimeSeriesDataPoint from @toastmasters/shared-contracts
    - _Requirements: 6.8_
  - [x] 2.3 Export TimeSeriesDataPointBuilder from analytics-core/src/index.ts
    - _Requirements: 6.1_
  - [x] 2.4 Write property test for TimeSeriesDataPointBuilder equivalence
    - **Property 3: TimeSeriesDataPointBuilder Equivalence**
    - Compare output with original RefreshService methods
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8**

- [x] 3. Migrate BordaCountRankingCalculator to analytics-core
  - [x] 3.1 Copy RankingCalculator from backend/src/services/RankingCalculator.ts to analytics-core/src/rankings/BordaCountRankingCalculator.ts
    - Copy entire class with all methods
    - PRESERVE all logic exactly
    - _Requirements: 7.1, 7.2, 7.3_
  - [x] 3.2 Add buildRankingsData method to create AllDistrictsRankingsData
    - Build rankings data structure from ranked districts
    - _Requirements: 5.2_
  - [x] 3.3 Update imports to use shared-contracts types
    - Import AllDistrictsRankingsData from @toastmasters/shared-contracts
    - _Requirements: 7.4_
  - [x] 3.4 Export BordaCountRankingCalculator from analytics-core/src/index.ts
    - _Requirements: 7.1_
  - [x] 3.5 Write property test for ranking algorithm equivalence
    - **Property 2: Ranking Algorithm Equivalence**
    - Compare output with original backend RankingCalculator
    - **Validates: Requirements 5.3, 7.1, 7.2, 7.3, 7.4**

- [x] 4. Checkpoint - Ensure analytics-core tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Verify migrated modules compile and work correctly

- [x] 5. Create TimeSeriesIndexWriter in scraper-cli
  - [x] 5.1 Create TimeSeriesIndexWriter class in scraper-cli/src/services/TimeSeriesIndexWriter.ts
    - Use TimeSeriesDataPointBuilder from analytics-core
    - _Requirements: 4.1, 4.2_
  - [x] 5.2 Implement writeDataPoint method
    - Write to program-year-partitioned index files
    - Handle file creation and updates atomically
    - _Requirements: 4.2, 9.3_
  - [x] 5.3 Implement updateMetadata method
    - Update index-metadata.json for each district
    - _Requirements: 4.5_
  - [x] 5.4 Migrate program year calculation methods from TimeSeriesIndexService
    - getProgramYearForDate, getProgramYearStartDate, getProgramYearEndDate
    - _Requirements: 10.2_
  - [x] 5.5 Implement calculateProgramYearSummary method
    - Pre-compute summary statistics when writing index files
    - _Requirements: 16.3_
  - [x] 5.6 Write unit tests for TimeSeriesIndexWriter
    - Test file creation, updates, metadata
    - _Requirements: 4.1, 4.2, 4.5_

- [x] 6. Update AnalyticsComputeService to generate time-series indexes
  - [x] 6.1 Add TimeSeriesIndexWriter dependency to AnalyticsComputeService
    - _Requirements: 9.1_
  - [x] 6.2 Update computeDistrictAnalytics to write time-series data points
    - Build data point using TimeSeriesDataPointBuilder
    - Write using TimeSeriesIndexWriter
    - _Requirements: 4.1, 9.1, 9.2_
  - [x] 6.3 Handle time-series write failures gracefully
    - Log error and continue with other districts
    - _Requirements: 9.4_
  - [x] 6.4 Write integration test for time-series generation
    - Verify time-series files generated alongside analytics
    - **Property 1: Time-Series Generation Completeness**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

- [x] 7. Update TransformService to compute rankings
  - [x] 7.1 Add BordaCountRankingCalculator dependency to TransformService
    - _Requirements: 5.1_
  - [x] 7.2 Update transform method to compute rankings when all-districts data available
    - Use BordaCountRankingCalculator from analytics-core
    - _Requirements: 5.1, 5.3_
  - [x] 7.3 Write rankings to all-districts-rankings.json
    - _Requirements: 5.2_
  - [x] 7.4 Skip rankings computation gracefully when all-districts data not available
    - _Requirements: 5.4_
  - [x] 7.5 Write unit tests for rankings generation in transform
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 8. Checkpoint - Ensure scraper-cli tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Update TimeSeriesIndexService to be read-only
  - [x] 9.1 Remove appendDataPoint method from TimeSeriesIndexService
    - _Requirements: 8.2_
  - [x] 9.2 Remove rebuildIndex method from TimeSeriesIndexService
    - _Requirements: 8.3_
  - [x] 9.3 Remove calculateProgramYearSummary method from TimeSeriesIndexService
    - Read summary from pre-computed files instead
    - _Requirements: 8.5_
  - [x] 9.4 Update ITimeSeriesIndexService interface to remove write methods
    - _Requirements: 8.1_
  - [x] 9.5 Update getTrendData to return empty array when data missing
    - _Requirements: 8.4, 11.1_
  - [x] 9.6 Write unit tests for read-only TimeSeriesIndexService
    - _Requirements: 8.1, 8.4, 8.5_

- [x] 10. Remove computation from RefreshService
  - [x] 10.1 Remove triggerTimeSeriesIndexUpdate method
    - _Requirements: 1.1_
  - [x] 10.2 Remove buildTimeSeriesDataPoint method
    - _Requirements: 1.2_
  - [x] 10.3 Remove calculateTotalMembership method
    - _Requirements: 1.3_
  - [x] 10.4 Remove calculateTotalPayments method
    - _Requirements: 1.4_
  - [x] 10.5 Remove calculateTotalDCPGoals method
    - _Requirements: 1.5_
  - [x] 10.6 Remove calculateClubHealthCounts method
    - _Requirements: 1.6_
  - [x] 10.7 Remove calculateDistinguishedTotal method
    - _Requirements: 1.7_
  - [x] 10.8 Remove isDistinguished method
    - _Requirements: 1.8_
  - [x] 10.9 Remove parseIntSafe method
    - _Requirements: 1.9_
  - [x] 10.10 Remove ITimeSeriesIndexService dependency from constructor
    - _Requirements: 1.10_
  - [x] 10.11 Update RefreshService tests
    - _Requirements: 1.1-1.10_

- [x] 11. Remove computation from BackfillService
  - [x] 11.1 Remove buildTimeSeriesDataPoint method
    - _Requirements: 2.1_
  - [x] 11.2 Remove isDistinguished method
    - _Requirements: 2.2_
  - [x] 11.3 Remove parseIntSafe method
    - _Requirements: 2.3_
  - [x] 11.4 Update BackfillService to read pre-computed time-series data
    - _Requirements: 2.4_
  - [x] 11.5 Remove ITimeSeriesIndexService write dependency
    - _Requirements: 2.5_
  - [x] 11.6 Update BackfillService tests
    - _Requirements: 2.1-2.5_

- [x] 12. Remove computation from SnapshotBuilder
  - [x] 12.1 Remove calculateAllDistrictsRankings method
    - _Requirements: 3.1_
  - [x] 12.2 Remove RankingCalculator dependency from constructor
    - _Requirements: 3.2_
  - [x] 12.3 Update SnapshotBuilder to read pre-computed rankings from file
    - _Requirements: 3.3_
  - [x] 12.4 Handle missing rankings gracefully
    - _Requirements: 3.4_
  - [x] 12.5 Update SnapshotBuilder tests
    - _Requirements: 3.1-3.4_

- [x] 13. Checkpoint - Ensure backend core services tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Remove computation from PreComputedAnalyticsService
  - [x] 14.1 Remove computeDistrictAnalytics method
    - _Requirements: 14.1_
  - [x] 14.2 Remove calculateTotalMembership method
    - _Requirements: 14.2_
  - [x] 14.3 Remove calculateClubHealthCounts method
    - _Requirements: 14.3_
  - [x] 14.4 Remove calculateDistinguishedClubCounts method
    - _Requirements: 14.4_
  - [x] 14.5 Remove calculateTotalPayments method
    - _Requirements: 14.5_
  - [x] 14.6 Remove calculateTotalDCPGoals method
    - _Requirements: 14.6_
  - [x] 14.7 Update PreComputedAnalyticsService to read from pre-computed files only
    - _Requirements: 14.7_
  - [x] 14.8 Update PreComputedAnalyticsService tests
    - _Requirements: 14.1-14.7_

- [x] 15. Remove computation from AnalyticsGenerator (unified backfill)
  - [x] 15.1 Remove buildTimeSeriesDataPoint method
    - _Requirements: 15.1_
  - [x] 15.2 Remove calculateTotalMembership method
    - _Requirements: 15.2_
  - [x] 15.3 Remove calculateTotalPayments method
    - _Requirements: 15.3_
  - [x] 15.4 Remove calculateTotalDCPGoals method
    - _Requirements: 15.4_
  - [x] 15.5 Remove calculateClubHealthCounts method
    - _Requirements: 15.5_
  - [x] 15.6 Remove calculateDistinguishedTotal method
    - _Requirements: 15.6_
  - [x] 15.7 Update AnalyticsGenerator to read pre-computed data only
    - _Requirements: 15.7_
  - [x] 15.8 Update AnalyticsGenerator tests
    - _Requirements: 15.1-15.7_

- [x] 16. Remove computation from TimeSeriesIndexStorage implementations
  - [x] 16.1 Remove calculateProgramYearSummary from LocalTimeSeriesIndexStorage
    - _Requirements: 16.1_
  - [x] 16.2 Remove calculateProgramYearSummary from FirestoreTimeSeriesIndexStorage
    - _Requirements: 16.2_
  - [x] 16.3 Update storage implementations to read pre-computed summaries
    - _Requirements: 16.4_
  - [x] 16.4 Update TimeSeriesIndexStorage tests
    - _Requirements: 16.1-16.4_

- [x] 17. Remove computation from route handlers
  - [x] 17.1 Remove calculateDistinguishedProjection from analyticsSummary.ts
    - _Requirements: 17.1_
  - [x] 17.2 Update analyticsSummary route to read pre-computed distinguishedProjection
    - _Requirements: 17.2_
  - [x] 17.3 Remove overallRank sorting computation from core.ts
    - _Requirements: 17.3_
  - [x] 17.4 Update core.ts route to read pre-computed overallRank
    - _Requirements: 17.4_
  - [x] 17.5 Update route handler tests
    - _Requirements: 17.1-17.5_

- [x] 18. Remove RankingCalculator from backend
  - [x] 18.1 Delete backend/src/services/RankingCalculator.ts
    - _Requirements: 12.1_
  - [x] 18.2 Remove RankingCalculator imports from shared.ts
    - _Requirements: 12.2_
  - [x] 18.3 Remove RankingCalculator initialization from shared.ts
    - _Requirements: 12.3_
  - [x] 18.4 Clean up any remaining RankingCalculator references
    - _Requirements: 12.2_

- [x] 19. Checkpoint - Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 20. Final validation
  - [x] 20.1 Verify TypeScript compilation succeeds with no errors
    - _Requirements: All_
  - [x] 20.2 Verify no computation methods remain in backend services
    - _Requirements: All_
  - [x] 20.3 Run full test suite across all packages
    - _Requirements: All_

## Notes

- All tasks are required for comprehensive implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate algorithm equivalence (ranking, time-series builder)
- Unit tests validate specific examples and edge cases
- **CRITICAL: Backend code is MOVED to analytics-core, not rewritten, to preserve bug fixes**
- The existing `backend-computation-removal` spec handles AnalyticsEngine violations
- This spec focuses on RefreshService, BackfillService, SnapshotBuilder, and related violations
