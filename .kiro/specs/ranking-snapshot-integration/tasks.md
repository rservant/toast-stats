# Implementation Plan: Ranking Snapshot Integration

## Overview

This implementation integrates district ranking calculations into the snapshot creation process, moving the sophisticated Borda count ranking system from the legacy cache system into the per-district snapshot architecture. The approach ensures rankings are computed once during data ingestion and stored immutably with each snapshot.

## Tasks

- [x] 1. Create ranking calculator service
  - Implement `BordaCountRankingCalculator` class with Borda count algorithm
  - Add ranking calculation methods for club growth, payment growth, and distinguished club percentages
  - Implement tie handling logic for equal metric values
  - Add ranking algorithm version tracking
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

- [ ]\* 1.1 Write property test for Borda count calculation
  - **Property 1: Borda Count Calculation Correctness**
  - **Validates: Requirements 1.6, 1.7**

- [ ]\* 1.2 Write property test for category ranking consistency
  - **Property 2: Category Ranking Consistency**
  - **Validates: Requirements 1.2, 1.3, 1.4**

- [ ]\* 1.3 Write property test for tie handling
  - **Property 3: Tie Handling Correctness**
  - **Validates: Requirements 1.5**

- [ ]\* 1.4 Write property test for final ranking order
  - **Property 4: Final Ranking Order**
  - **Validates: Requirements 1.8**

- [x] 2. Extend DistrictStatistics interface for ranking data
  - Add `DistrictRankingData` interface with all ranking fields
  - Extend `DistrictStatistics` to include optional ranking property
  - Update type definitions to support ranking fields in API responses
  - Ensure backward compatibility with existing district data
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x]\* 2.1 Write property test for ranking data persistence
  - **Property 5: Ranking Data Persistence**
  - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

- [x]\* 2.2 Write property test for ranking data retrieval
  - **Property 6: Ranking Data Retrieval**
  - **Validates: Requirements 2.5**

- [x] 3. Integrate ranking calculator into RefreshService
  - Modify `RefreshService` constructor to accept `RankingCalculator` dependency
  - Add ranking calculation step in `createSnapshot` method before writing district data
  - Implement error handling for ranking calculation failures
  - Ensure ranking calculations use the same source data as stored in snapshots
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ]\* 3.1 Write property test for snapshot creation integration
  - **Property 10: Snapshot Creation Integration**
  - **Validates: Requirements 5.2, 5.4**

- [ ]\* 3.2 Write property test for error handling resilience
  - **Property 11: Error Handling Resilience**
  - **Validates: Requirements 5.3**

- [x] 4. Update snapshot metadata for ranking versioning
  - Modify snapshot metadata to include ranking algorithm version
  - Update `PerDistrictSnapshotMetadata` interface to track calculation versions
  - Ensure ranking version is recorded during snapshot creation
  - Implement version compatibility checking for historical snapshots
  - _Requirements: 3.1, 3.3, 3.4_

- [ ]\* 4.1 Write property test for snapshot metadata versioning
  - **Property 7: Snapshot Metadata Versioning**
  - **Validates: Requirements 3.1**

- [ ]\* 4.2 Write property test for historical data immutability
  - **Property 8: Historical Data Immutability**
  - **Validates: Requirements 3.3**

- [x] 5. Update districts rankings API endpoint
  - Modify `/api/districts/rankings` endpoint to serve ranking data from snapshots
  - Update response transformation to include all DistrictRanking interface fields
  - Add snapshot metadata to API responses for data freshness indication
  - Implement proper error handling when no snapshots are available
  - _Requirements: 4.1, 4.2, 4.3, 4.4_
  - **Status: COMPLETED** ✅ - Rankings endpoint successfully updated to serve from per-district snapshots with proper error handling

- [ ]\* 5.1 Write property test for API response completeness
  - **Property 9: API Response Completeness**
  - **Validates: Requirements 4.2, 4.4**

- [ ]\* 5.2 Write unit test for no snapshot error handling
  - Test that 503 error is returned when no snapshot is available
  - **Validates: Requirements 4.3**

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Update BackfillService for ranking consistency
  - Integrate ranking calculator into backfill operations
  - Ensure consistent ranking algorithm version across backfilled snapshots
  - Add ranking calculation to historical snapshot creation
  - Maintain consistency with RefreshService ranking integration
  - _Requirements: 5.5_

- [ ]\* 7.1 Write property test for backfill consistency
  - **Property 12: Backfill Consistency**
  - **Validates: Requirements 5.5**

- [x] 8. Update service factories and dependency injection
  - Add `RankingCalculator` to production and test service factories
  - Wire ranking calculator into RefreshService and BackfillService
  - Ensure proper dependency injection for ranking calculator
  - Update service initialization to include ranking calculator
  - _Requirements: 5.1_

- [x]\* 8.1 Write integration tests for service wiring
  - Test that ranking calculator is properly injected into services
  - Test end-to-end ranking calculation in snapshot creation

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation maintains backward compatibility with existing snapshots
- Ranking calculations are integrated into existing snapshot creation workflows
