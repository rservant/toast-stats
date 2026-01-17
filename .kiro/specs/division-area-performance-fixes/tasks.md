# Implementation Plan: Division and Area Performance Fixes

## Overview

This implementation plan fixes five calculation bugs in the `extractDivisionPerformance.ts` module. The fixes involve reading club base values from CSV fields, using consistent distinguished level determination logic, and counting visit completions correctly.

## Tasks

- [x] 1. Add helper function for distinguished level determination
  - [x] 1.1 Create `determineDistinguishedLevel` helper function
    - Add function to determine distinguished level from club data
    - Check "Club Distinguished Status" field as primary source
    - Calculate from DCP goals, membership, and net growth if status field is missing
    - Handle CSP requirement for 2025-2026+ data
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 1.2 Write unit tests for `determineDistinguishedLevel`
    - Test with valid "Club Distinguished Status" field
    - Test with missing status field (DCP calculation)
    - Test all distinguished levels (Distinguished, Select, Presidents, Smedley)
    - Test CSP requirement behavior
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 2. Add helper function for visit counting
  - [x] 2.1 Create `countVisitCompletions` helper function
    - Add function to count clubs with "1" in a visit field
    - Handle missing, empty, and "0" values correctly
    - _Requirements: 4.2, 5.2_

  - [x] 2.2 Write unit tests for `countVisitCompletions`
    - Test with all clubs having "1"
    - Test with no clubs having "1"
    - Test with mixed values
    - Test with missing fields
    - _Requirements: 4.2, 4.4, 5.2, 5.4_

- [x] 3. Fix division club base calculation
  - [x] 3.1 Update `extractDivisionPerformance` to read "Division Club Base" field
    - Read "Division Club Base" from first club in division
    - Parse as integer with fallback to club count
    - Log debug message when using fallback
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 3.2 Write unit tests for division club base extraction
    - Test with valid "Division Club Base" field present
    - Test with missing field (fallback to count)
    - Test with invalid/non-numeric value (fallback to count)
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 4. Fix area club base calculation
  - [x] 4.1 Update `extractAreasForDivision` to read "Area Club Base" field
    - Read "Area Club Base" from first club in area
    - Parse as integer with fallback to club count
    - Log debug message when using fallback
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 4.2 Write unit tests for area club base extraction
    - Test with valid "Area Club Base" field present
    - Test with missing field (fallback to count)
    - Test with invalid/non-numeric value (fallback to count)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 5. Fix distinguished clubs counting
  - [x] 5.1 Update division distinguished clubs calculation
    - Use `determineDistinguishedLevel` helper for each club
    - Count clubs with any distinguished level
    - Remove dependency on clubPerformance lookup
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 5.2 Update area distinguished clubs calculation
    - Use `determineDistinguishedLevel` helper for each club
    - Count clubs with any distinguished level
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 5.3 Write unit tests for distinguished clubs counting
    - Test division with mixed distinguished statuses
    - Test area with mixed distinguished statuses
    - Test with status field vs DCP calculation
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 6. Fix visit counting
  - [x] 6.1 Update first round visit calculation
    - Use `countVisitCompletions` helper with "Nov Visit award" field
    - Iterate through all clubs in area
    - Pass count to `calculateVisitStatus`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 6.2 Update second round visit calculation
    - Use `countVisitCompletions` helper with "May visit award" field
    - Iterate through all clubs in area
    - Pass count to `calculateVisitStatus`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 6.3 Write unit tests for visit counting integration
    - Test area with all visits completed
    - Test area with no visits completed
    - Test area with partial visits
    - _Requirements: 4.2, 4.4, 4.5, 5.2, 5.4, 5.5_

- [x] 7. Update existing tests and add error handling tests
  - [x] 7.1 Update existing unit test fixtures
    - Add "Division Club Base" and "Area Club Base" fields to test data
    - Update expected visit counts to match counting logic
    - _Requirements: 6.4_

  - [x] 7.2 Write unit tests for error handling
    - Test with malformed district snapshot (no throw, returns empty array)
    - Test with missing required fields (uses defaults)
    - Test with invalid data types (graceful fallback)
    - _Requirements: 6.2, 6.3_

- [x] 8. Checkpoint - Ensure all tests pass
  - Run full test suite
  - Verify no regressions in existing functionality

## Notes

- All testing uses focused unit tests with well-chosen examples (no property tests needed)
- Each task references specific requirements for traceability
- The helper functions (tasks 1-2) should be implemented first as they are used by subsequent tasks
