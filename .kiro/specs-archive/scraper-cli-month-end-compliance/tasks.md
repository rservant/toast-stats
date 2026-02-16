# Implementation Plan: Scraper CLI Month-End Compliance

## Overview

This implementation modifies the TransformService in the scraper-cli package to handle month-end closing periods correctly. The changes involve reading cache metadata, calculating correct snapshot dates for closing periods, and including closing period fields in snapshot metadata.

## Tasks

- [x] 1. Create ClosingPeriodDetector utility
  - [x] 1.1 Create `packages/scraper-cli/src/utils/ClosingPeriodDetector.ts`
    - Port logic from `backend/src/services/ClosingPeriodDetector.ts`
    - Implement `getLastDayOfMonth(year, month)` method
    - Implement `detect(requestedDate, metadata)` method
    - Implement `parseDataMonth(dataMonth, referenceYear, referenceMonth)` method
    - Handle cross-year scenarios (December data in January)
    - _Requirements: 2.1, 2.3_

  - [x] 1.2 Write property test for last day of month calculation
    - **Property 1: Last Day of Month Calculation**
    - **Validates: Requirements 2.1**

  - [x] 1.3 Write property test for closing period snapshot date calculation
    - **Property 2: Closing Period Snapshot Date Calculation**
    - **Validates: Requirements 2.2, 2.3, 5.1, 5.2**

  - [x] 1.4 Write unit tests for ClosingPeriodDetector
    - Test `detect()` with closing period metadata
    - Test `detect()` with non-closing period metadata
    - Test `detect()` with null/missing metadata
    - Test cross-year scenario (December → January)
    - _Requirements: 1.3, 2.1, 2.3, 2.4_

- [x] 2. Checkpoint - Ensure ClosingPeriodDetector tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Add cache metadata reading to TransformService
  - [x] 3.1 Implement `readCacheMetadata(date)` method in TransformService
    - Read from `CACHE_DIR/raw-csv/{date}/metadata.json`
    - Parse JSON and extract `isClosingPeriod` and `dataMonth` fields
    - Return null if file doesn't exist or parsing fails
    - Log warning on parse errors
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 3.2 Write unit tests for cache metadata reading
    - Test with valid metadata file
    - Test with missing metadata file
    - Test with invalid JSON
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 4. Implement snapshot date determination
  - [x] 4.1 Implement `determineSnapshotDate(requestedDate, metadata)` method
    - Use ClosingPeriodDetector to detect closing period
    - Return ClosingPeriodInfo with correct snapshot date
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 4.2 Write unit tests for snapshot date determination
    - Test closing period returns last day of data month
    - Test non-closing period returns requested date
    - Test cross-year scenario
    - _Requirements: 2.2, 2.3, 2.4_

- [x] 5. Implement newer data wins logic
  - [x] 5.1 Implement `shouldUpdateSnapshot(snapshotDate, newCollectionDate)` method
    - Read existing snapshot metadata if it exists
    - Compare collection dates
    - Return true if new data is newer or no existing snapshot
    - Return false if existing data is newer or equal
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 5.2 Write unit tests for newer data wins logic
    - Test new data is newer → returns true
    - Test new data is equal → returns false
    - Test new data is older → returns false
    - Test no existing snapshot → returns true
    - Test existing snapshot has no collectionDate → returns true
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 6. Checkpoint - Ensure all helper method tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Modify TransformService transform flow
  - [x] 7.1 Update `transform()` method to use closing period logic
    - Call `readCacheMetadata()` at start of transform
    - Call `determineSnapshotDate()` to get correct snapshot date
    - Use snapshot date for directory naming instead of requested date
    - Call `shouldUpdateSnapshot()` before writing closing period snapshots
    - Skip transform if existing snapshot is newer
    - _Requirements: 2.2, 4.2, 4.3, 5.1, 5.2_

  - [x] 7.2 Update `writeMetadata()` to include closing period fields
    - Add `isClosingPeriodData` field when closing period
    - Add `collectionDate` field with actual "As of" date
    - Add `logicalDate` field with snapshot date
    - Omit fields for non-closing period snapshots
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 7.3 Write unit tests for closing period metadata in snapshots
    - Test closing period snapshot has all three fields
    - Test non-closing period snapshot omits fields
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 8. Integration testing
  - [x] 8.1 Write integration test for full transform flow with closing period
    - Create mock raw CSV files and cache metadata
    - Run transform with closing period metadata
    - Verify snapshot created at last day of data month
    - Verify snapshot metadata contains closing period fields
    - _Requirements: 2.2, 3.1, 3.2, 3.3, 5.1, 5.2_

  - [x] 8.2 Write integration test for newer data wins
    - Create existing snapshot with older collection date
    - Run transform with newer closing period data
    - Verify snapshot is updated
    - Create existing snapshot with newer collection date
    - Run transform with older closing period data
    - Verify snapshot is NOT updated
    - _Requirements: 4.2, 4.3_

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Compute-Analytics Closing Period Handling

The following tasks extend the month-end compliance feature to the `compute-analytics` command.

- [x] 10. Add cache metadata reading to AnalyticsComputeService
  - [x] 10.1 Implement `readCacheMetadata(date)` method in AnalyticsComputeService
    - Read from `CACHE_DIR/raw-csv/{date}/metadata.json`
    - Parse JSON and extract `isClosingPeriod` and `dataMonth` fields
    - Return null if file doesn't exist or parsing fails
    - Log warning on parse errors
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 10.2 Add ClosingPeriodDetector to AnalyticsComputeService
    - Import and instantiate ClosingPeriodDetector utility
    - Add `determineSnapshotDate(requestedDate, metadata)` method
    - _Requirements: 7.1_

  - [x] 10.3 Write unit tests for cache metadata reading in AnalyticsComputeService
    - Test with valid metadata file containing closing period info
    - Test with missing metadata file
    - Test with invalid JSON
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 11. Modify AnalyticsComputeService compute flow
  - [x] 11.1 Update `compute()` method to use closing period logic
    - Call `readCacheMetadata()` at start of compute
    - Call `determineSnapshotDate()` to get correct snapshot date
    - Use adjusted snapshot date for `snapshotExists()` check
    - Use adjusted snapshot date for `discoverAvailableDistricts()` call
    - Use adjusted snapshot date for all `computeDistrictAnalytics()` calls
    - Use adjusted snapshot date for analytics output directory
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 8.1, 8.3_

  - [x] 11.2 Update JSON output to report actual snapshot date
    - Include actual snapshot date used in result
    - Log the date adjustment when verbose mode is enabled
    - _Requirements: 8.2_

  - [x] 11.3 Write unit tests for closing period snapshot lookup
    - Test closing period metadata → looks for snapshot at last day of data month
    - Test non-closing period → looks for snapshot at requested date
    - Test missing metadata → looks for snapshot at requested date
    - Test cross-year scenario (December data in January)
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 12. Checkpoint - Ensure AnalyticsComputeService tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Integration testing for compute-analytics closing period handling
  - [x] 13.1 Write integration test for full compute-analytics flow with closing period
    - Create mock raw CSV files and cache metadata with closing period info
    - Run transform to create snapshot at adjusted date
    - Run compute-analytics with original requested date
    - Verify analytics computed successfully using adjusted snapshot date
    - Verify analytics written to correct directory (alongside snapshot)
    - _Requirements: 7.2, 8.1_

  - [x] 13.2 Write integration test for non-closing period behavior
    - Create mock raw CSV files without closing period metadata
    - Run transform and compute-analytics
    - Verify analytics computed at requested date
    - _Requirements: 7.4, 8.3_

- [x] 14. Final checkpoint - Ensure all compute-analytics tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The ClosingPeriodDetector utility is based on the existing backend implementation
- The `SnapshotMetadataFile` interface in shared-contracts already has the required closing period fields
- No API changes are required - this is purely a scraper-cli pipeline change
- The ClosingPeriodDetector utility created in tasks 1.x can be reused directly for the AnalyticsComputeService
