# Implementation Plan: Analytics Engine Migration

## Overview

This plan migrates the `AnalyticsEngine` from the legacy `DistrictCacheManager` to the new `PerDistrictSnapshotStore` data source. The implementation uses dependency injection to swap data sources while maintaining backward compatibility.

## Tasks

- [x] 1. Create IAnalyticsDataSource interface and adapter
  - [x] 1.1 Define IAnalyticsDataSource interface in types/serviceInterfaces.ts
    - Add interface with getDistrictData, getSnapshotsInRange, getLatestSnapshot methods
    - _Requirements: 1.1_
  - [x] 1.2 Create AnalyticsDataSourceAdapter class
    - Implement IAnalyticsDataSource wrapping DistrictDataAggregator and PerDistrictSnapshotStore
    - Add getSnapshotsInRange method with date filtering logic
    - _Requirements: 1.1, 2.1, 2.2, 2.3_
  - [ ]* 1.3 Write property test for date range filtering
    - **Property 3: Date Range Filtering**
    - **Validates: Requirements 2.1, 2.2, 2.3**

- [x] 2. Modify AnalyticsEngine to use new data source
  - [x] 2.1 Update AnalyticsEngine constructor to accept IAnalyticsDataSource
    - Add dataSource parameter alongside existing cacheManager
    - Support both old and new data sources during transition
    - _Requirements: 1.1, 1.4_
  - [x] 2.2 Update loadDistrictData method to use new data source
    - Replace DistrictCacheManager calls with IAnalyticsDataSource calls
    - Map DistrictStatistics to DistrictCacheEntry format for compatibility
    - _Requirements: 1.1, 1.3_
  - [ ]* 2.3 Write property test for response format consistency
    - **Property 2: Response Format Consistency**
    - **Validates: Requirements 1.3, 1.4**

- [x] 3. Checkpoint - Verify data loading works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Update club health classification logic
  - [x] 4.1 Refactor calculateClubHealth to work with DistrictStatistics
    - Extract membership and DCP goals from new data format
    - Apply classification rules: critical (<12), at-risk (>=12, 0 goals), healthy (>=12, >=1 goal)
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [x] 4.2 Update analyzeClubTrends to return separate arrays
    - Ensure atRiskClubs, criticalClubs, healthyClubs are mutually exclusive
    - _Requirements: 3.5_
  - [ ]* 4.3 Write property test for club health classification
    - **Property 4: Club Health Classification**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

- [x] 5. Update distinguished club counting
  - [x] 5.1 Refactor calculateDistinguishedClubs for new data format
    - Extract distinguished level from DistrictStatistics
    - Count clubs at each level (Smedley, President's, Select, Distinguished)
    - _Requirements: 4.1, 4.2_
  - [ ]* 5.2 Write property test for distinguished counting
    - **Property 5: Distinguished Club Counting**
    - **Validates: Requirements 4.1, 4.2**

- [x] 6. Update division and area ranking
  - [x] 6.1 Refactor analyzeDivisions for new data format
    - Calculate rankings based on DCP goals and club health
    - Include trend indicators
    - _Requirements: 5.1, 5.3_
  - [x] 6.2 Refactor analyzeAreas for new data format
    - Calculate normalized scores for areas
    - _Requirements: 5.2_
  - [ ]* 6.3 Write property test for division ranking
    - **Property 6: Division Ranking Consistency**
    - **Validates: Requirements 5.1, 5.3**

- [x] 7. Checkpoint - Verify analytics calculations
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Update route initialization
  - [x] 8.1 Update districts.ts route to create AnalyticsEngine with new data source
    - Create AnalyticsDataSourceAdapter with existing perDistrictSnapshotStore and districtDataAggregator
    - Pass adapter to AnalyticsEngine constructor
    - _Requirements: 1.1_
  - [x] 8.2 Update error handling in analytics endpoint
    - Return proper error codes for no data (404) and service unavailable (503)
    - Include actionable details in error responses
    - _Requirements: 6.1, 6.2, 6.3_
  - [ ]* 8.3 Write property test for error response quality
    - **Property 7: Error Response Quality**
    - **Validates: Requirements 6.3**

- [x] 9. Final checkpoint - End-to-end verification
  - Ensure all tests pass, ask the user if questions arise.
  - Verify district detail page loads correctly

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
