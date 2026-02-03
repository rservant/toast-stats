# Implementation Plan: Per-Metric Rankings

## Overview

This implementation adds per-metric ranking data (world rank, world percentile, region rank) to the district performance targets. The approach reuses existing rankings from `all-districts-rankings.json` and computes additional metrics (percentile, region rank) in the analytics pipeline.

## Tasks

- [ ] 1. Update PerformanceTargetsData type to include rankings
  - [ ] 1.1 Add MetricRankings fields to PerformanceTargetsData in analytics-core/src/types.ts
    - Add `paidClubsRankings: MetricRankings` field
    - Add `membershipPaymentsRankings: MetricRankings` field
    - Add `distinguishedClubsRankings: MetricRankings` field
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 2. Create MetricRankingsCalculator utility
  - [ ] 2.1 Create new file analytics-core/src/rankings/MetricRankingsCalculator.ts
    - Implement `calculateWorldPercentile(worldRank: number, totalDistricts: number): number | null`
    - Implement `calculateRegionRank(districtId: string, metric: string, rankings: DistrictRanking[]): RegionRankResult`
    - Implement `calculateMetricRankings(districtId: string, metric: string, allDistrictsRankings: AllDistrictsRankingsData): MetricRankings`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 6.1_
  
  - [ ] 2.2 Write unit tests for MetricRankingsCalculator
    - Test world percentile calculation with examples (rank=1/total=100, rank=50/total=100, etc.)
    - Test null handling (totalDistricts=0, totalDistricts=1, worldRank=null)
    - Test region rank computation with ties
    - Test unknown region handling
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.2, 3.4, 6.1_
  
  - [ ] 2.3 Write property test for percentile calculation
    - **Property 1: Percentile calculation correctness**
    - **Validates: Requirements 2.1, 2.2**
  
  - [ ] 2.4 Write property test for region rank ordering
    - **Property 2: Region rank ordering invariant**
    - **Validates: Requirements 3.2, 6.1**

- [ ] 3. Checkpoint - Ensure MetricRankingsCalculator tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Update AnalyticsComputer.computePerformanceTargets()
  - [ ] 4.1 Modify computePerformanceTargets signature to accept allDistrictsRankings parameter
    - Add optional parameter `allDistrictsRankings?: AllDistrictsRankingsData`
    - _Requirements: 5.2_
  
  - [ ] 4.2 Integrate MetricRankingsCalculator into computePerformanceTargets
    - Use calculator to compute rankings for each metric
    - Handle null allDistrictsRankings gracefully (return null rankings)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  
  - [ ] 4.3 Write unit tests for updated computePerformanceTargets
    - Test with valid allDistrictsRankings data
    - Test with null allDistrictsRankings (should return null rankings)
    - Test world rank extraction matches source data
    - _Requirements: 1.2, 1.3, 1.4, 1.5_

- [ ] 5. Update AnalyticsComputeService to load and pass rankings
  - [ ] 5.1 Add loadAllDistrictsRankings method to AnalyticsComputeService
    - Load all-districts-rankings.json from snapshot directory
    - Return null if file not found (log warning, don't fail)
    - _Requirements: 5.1, 5.3, 5.4_
  
  - [ ] 5.2 Update computeDistrictAnalytics to pass rankings to computePerformanceTargets
    - Load rankings once per compute operation
    - Pass to computePerformanceTargets for each district
    - _Requirements: 5.2_
  
  - [ ] 5.3 Write integration tests for AnalyticsComputeService rankings loading
    - Test successful loading of all-districts-rankings.json
    - Test graceful handling when file is missing
    - Test end-to-end flow produces performance-targets with rankings
    - _Requirements: 5.1, 5.3, 5.4_

- [ ] 6. Checkpoint - Ensure all analytics tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Export MetricRankingsCalculator from analytics-core
  - [ ] 7.1 Update analytics-core/src/index.ts to export MetricRankingsCalculator
    - Export the class and any related types
    - _Requirements: 4.1_

- [ ] 8. Final checkpoint - Verify end-to-end functionality
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks including tests are required for comprehensive coverage
- This feature does NOT require backend API changes - the backend already serves performanceTargets from pre-computed files
- This feature does NOT require frontend changes - the frontend already expects MetricRankings in performanceTargets
- The existing all-districts-rankings.json already contains clubsRank, paymentsRank, distinguishedRank
- Region rank is computed fresh since it's not in the existing rankings file
