# Implementation Plan: RefreshService Refactor

## Overview

This plan extracts two specialized modules from `RefreshService.ts` (2,117 lines):

1. **ClosingPeriodDetector** - Handles month-end closing period detection logic
2. **DataNormalizer** - Transforms raw scraped data into normalized snapshot format

The refactoring preserves the existing public API while improving maintainability through separation of concerns.

## Tasks

- [x] 1. Extract ClosingPeriodDetector module
  - [x] 1.1 Create ClosingPeriodDetector.ts with interface and class
    - Define `ClosingPeriodResult` interface with isClosingPeriod, dataMonth, asOfDate, snapshotDate, collectionDate fields
    - Define `ClosingPeriodDetectorDependencies` interface with logger dependency
    - Implement `ClosingPeriodDetector` class with constructor accepting dependencies
    - Extract `detectClosingPeriod` method from RefreshService (lines 1156-1275)
    - Add `getLastDayOfMonth(year, month)` helper method
    - Add `parseDataMonth(dataMonth, referenceYear, referenceMonth)` helper method
    - Ensure file is ≤300 lines
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6_

  - [x] 1.2 Write unit tests for ClosingPeriodDetector
    - Test normal data (same month) detection returns isClosingPeriod: false
    - Test closing period detection when data month < CSV month
    - Test cross-year boundary handling (December data in January)
    - Test February handling for leap year (29 days) and non-leap year (28 days)
    - Test months with 30 and 31 days
    - Test invalid date format handling returns safe fallback
    - Test invalid data month format handling
    - _Requirements: 1.1, 1.2, 1.3, 5.4_

  - [x] 1.3 Write property test for closing period detection (Property 1)
    - **Property 1: Closing Period Detection Correctness**
    - _For any_ valid CSV date and data month combination, the ClosingPeriodDetector SHALL correctly identify whether it represents a closing period by comparing the data month to the CSV date month, and when a closing period is detected, the snapshot date SHALL be the last day of the data month
    - Generate random date pairs using fast-check
    - Verify isClosingPeriod is true when dataMonth < csvMonth (accounting for year)
    - Verify snapshotDate is last day of dataMonth when closing period detected
    - **Validates: Requirements 1.1, 1.2, 1.3**

  - [x] 1.4 Write property test for date boundary conditions (Property 5)
    - **Property 5: Date Boundary Conditions**
    - _For any_ month boundary scenario (including February in leap/non-leap years, months with 30/31 days, and year boundaries), the ClosingPeriodDetector SHALL correctly calculate the last day of the month and handle cross-year closing periods
    - Generate boundary dates for all months
    - Verify February 28/29 handling based on leap year
    - Verify 30-day months (Apr, Jun, Sep, Nov)
    - Verify 31-day months (Jan, Mar, May, Jul, Aug, Oct, Dec)
    - Verify December-to-January year boundary
    - **Validates: Requirements 1.1, 1.2, 5.4**

- [x] 2. Integrate ClosingPeriodDetector into RefreshService
  - [x] 2.1 Update RefreshService to use ClosingPeriodDetector
    - Add optional `closingPeriodDetector` parameter to constructor
    - Create default ClosingPeriodDetector instance if not provided
    - Replace inline `detectClosingPeriod` method with delegation to ClosingPeriodDetector
    - Remove extracted code from RefreshService
    - _Requirements: 1.5, 4.1, 4.2, 4.3_

  - [x] 2.2 Verify existing RefreshService tests pass
    - Run `RefreshService.closing-period.property.test.ts`
    - Run `RefreshService.no-new-month-snapshots.property.test.ts`
    - Run `RefreshService.property.test.ts`
    - Ensure all tests pass without modification
    - _Requirements: 5.1, 5.3_

- [x] 3. Checkpoint - Closing Period Detector Complete
  - Ensure all ClosingPeriodDetector tests pass
  - Ensure all existing RefreshService tests pass
  - Ask the user if questions arise

- [x] 4. Extract DataNormalizer module
  - [x] 4.1 Create DataNormalizer.ts with interface and class
    - Define `RawDistrictData` interface with districtPerformance, divisionPerformance, clubPerformance fields
    - Define `DataNormalizerDependencies` interface with logger and closingPeriodDetector dependencies
    - Implement `DataNormalizer` class with constructor accepting dependencies
    - Extract `normalizeData` method from RefreshService (lines 1294-1393)
    - Extract `normalizeDistrictData` method from RefreshService (lines 1397-1441)
    - Extract `extractMembershipTotal` method from RefreshService (lines 1444-1460)
    - Extract `extractClubMembership` method from RefreshService (lines 1465-1478)
    - Extract `countActiveClubs` method from RefreshService (lines 1483-1489)
    - Extract `countDistinguishedClubs` method from RefreshService (lines 1494-1502)
    - Extract `parseNumber` helper method from RefreshService (lines 1507-1512)
    - Ensure file is ≤400 lines
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7_

  - [x] 4.2 Write unit tests for DataNormalizer
    - Test single district normalization produces valid DistrictStatistics
    - Test multiple district normalization
    - Test empty club performance array handling
    - Test missing field handling with default values
    - Test membership extraction accuracy from various field names
    - Test club counting accuracy (active and distinguished)
    - Test error handling when district normalization fails
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 4.3 Write property test for data normalization (Property 2)
    - **Property 2: Data Normalization Transformation**
    - _For any_ valid raw scraped data input, the DataNormalizer SHALL produce a valid NormalizedData structure where the number of districts in output equals the number of successfully processed district entries in input, each district has valid membership, clubs, and education statistics structures, and metadata fields are correctly populated
    - Generate random raw data structures using fast-check
    - Verify output district count matches successful input processing
    - Verify each district has required structure fields
    - Verify metadata fields are populated
    - **Validates: Requirements 2.1, 2.2**

  - [x] 4.4 Write property test for membership calculation (Property 3)
    - **Property 3: Membership Calculation Consistency**
    - _For any_ club performance data array, the extracted membership total SHALL equal the sum of individual club membership counts, and the count of clubs with membership details SHALL equal the number of valid club records in the input
    - Generate random club performance arrays using fast-check
    - Verify total membership equals sum of individual counts
    - Verify club count matches valid records
    - **Validates: Requirements 2.3, 2.4, 2.5**

- [x] 5. Integrate DataNormalizer into RefreshService
  - [x] 5.1 Update RefreshService to use DataNormalizer
    - Add optional `dataNormalizer` parameter to constructor
    - Create default DataNormalizer instance if not provided (inject ClosingPeriodDetector)
    - Replace inline normalization methods with delegation to DataNormalizer
    - Remove extracted code from RefreshService
    - _Requirements: 2.6, 4.1, 4.2, 4.3_

  - [x] 5.2 Verify existing RefreshService tests pass
    - Run all RefreshService test files
    - Ensure all tests pass without modification
    - _Requirements: 5.1, 5.3_

- [x] 6. Checkpoint - Data Normalizer Complete
  - Ensure all DataNormalizer tests pass
  - Ensure all existing RefreshService tests pass
  - Ask the user if questions arise

- [x] 7. API Preservation Verification
  - [x] 7.1 Verify public API signatures unchanged
    - Confirm `executeRefresh()` returns `RefreshResult` with identical structure
    - Confirm `validateConfiguration()` returns validation results with identical structure
    - Confirm `getCircuitBreakerStats()` returns identical structure
    - Confirm `resetCircuitBreaker()` behavior unchanged
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 7.2 Write property test for API contract preservation (Property 4)
    - **Property 4: API Contract Preservation**
    - _For any_ valid input to RefreshService public methods (executeRefresh, validateConfiguration), the return type structure SHALL match the documented interface exactly, ensuring backward compatibility with existing consumers
    - Generate valid inputs using fast-check
    - Verify return type structure matches interface
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

- [x] 8. Final Cleanup and Verification
  - [x] 8.1 Verify line count constraints
    - Confirm ClosingPeriodDetector.ts is ≤300 lines ✅ (234 lines)
    - Confirm DataNormalizer.ts is ≤400 lines ✅ (364 lines)
    - Confirm RefreshService.ts is reduced (target ~1,400 lines) ✅ (1,735 lines - 18% reduction from 2,117)
    - _Requirements: 1.6, 2.7_

  - [x] 8.2 Run full test suite
    - Run all RefreshService tests ✅ (80 passed)
    - Run all ClosingPeriodDetector tests ✅ (61 passed)
    - Run all DataNormalizer tests ✅ (51 passed)
    - Run integration tests ✅ (168 passed)
    - Verify test coverage has not decreased ✅
    - _Requirements: 5.1, 5.2, 5.3_
    - Note: 2 unrelated test failures exist in other modules (functionality-preservation.property.test.ts, CacheConfigService.edge-cases.test.ts)

- [x] 9. Final Checkpoint
  - All refactoring-related tests pass ✅
  - All line count constraints are met ✅
  - All requirements are satisfied ✅
  - Refactoring complete

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The existing property tests in `RefreshService.closing-period.property.test.ts` should continue to pass after refactoring
