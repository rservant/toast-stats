# Implementation Plan: Rankings District Validation Fix

## Overview

This implementation plan addresses the bug where rankings data includes invalid "As of MM/DD/YYYY" entries as district IDs. The fix integrates the existing `DistrictIdValidator` into two code paths that currently bypass validation when calculating rankings.

The implementation is minimal and surgical: we add validation calls to filter invalid records before they are converted to `DistrictStatistics` for ranking calculation.

## Tasks

- [ ] 1. Update SnapshotBuilder to filter invalid district IDs during rankings calculation
  - [ ] 1.1 Modify `calculateAllDistrictsRankings` method to filter records before conversion
    - Add call to `this.districtIdValidator.filterValidRecords(allDistricts)` at the start of the method
    - Use the filtered `valid` array for subsequent processing
    - Log summary when records are rejected
    - Return `undefined` if no valid records remain after filtering
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [ ] 1.2 Write unit tests for SnapshotBuilder rankings validation
    - Test that invalid records are filtered before ranking calculation
    - Test that undefined is returned when all records are invalid
    - Test that valid records are processed correctly
    - _Requirements: 1.1, 1.4_

- [ ] 2. Update BackfillService to filter invalid district IDs during rankings calculation
  - [ ] 2.1 Add DistrictIdValidator dependency to BackfillService
    - Import `DistrictIdValidator` and `IDistrictIdValidator` types
    - Add optional `districtIdValidator` parameter to constructor
    - Initialize with default `DistrictIdValidator` if not provided
    - Store as private readonly property
    - _Requirements: 2.1, 3.1_
  - [ ] 2.2 Modify `fetchAndCalculateAllDistrictsRankings` method to filter records before conversion
    - Add call to `this.districtIdValidator.filterValidRecords(allDistrictsData)` after CSV parsing
    - Use the filtered `valid` array for subsequent processing
    - Log summary when records are rejected (include backfillId, date, operation)
    - Throw error if no valid records remain after filtering
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [ ] 2.3 Write unit tests for BackfillService rankings validation
    - Test that invalid records are filtered before ranking calculation
    - Test that error is thrown when all records are invalid
    - Test that valid records are processed correctly
    - _Requirements: 2.1, 2.4_

- [ ] 3. Checkpoint - Verify implementation
  - Ensure all tests pass, ask the user if questions arise.
  - Run `npm test` in backend directory to verify no regressions
  - Manually verify the fix by checking rankings data doesn't contain "As of" entries

## Notes

- All tasks including tests are required for comprehensive coverage
- The `DistrictIdValidator` already has comprehensive tests - no changes needed to that service
- This fix does not add any new API endpoints, so no OpenAPI updates are required
- The fix is backward compatible - no changes to data models or interfaces
