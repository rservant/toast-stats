# Implementation Plan: Club Renewal Data Fix

## Overview

Fix `DataTransformer.extractClubs()` to merge payment/renewal data from `districtPerformance` records into `ClubStatistics` objects, with club ID normalization for cross-CSV matching and fallback to `clubPerformance` when no match exists.

## Tasks

- [x] 1. Add normalizeClubId helper and buildDistrictPerformanceLookup method
  - [x] 1.1 Add `normalizeClubId` private method to `DataTransformer` that strips leading zeros, preserving original value for all-zeros input
    - _Requirements: 2.1, 2.4_
  - [x] 1.2 Add `buildDistrictPerformanceLookup` private method that builds a `Map<string, ParsedRecord>` from `districtPerformance` records keyed by normalized club ID, using column names `Club`, `Club Number`, or `Club ID`
    - _Requirements: 2.1, 2.3_
  - [x] 1.3 Write unit tests for `normalizeClubId` edge cases (all-zeros, empty string, no leading zeros, mixed)
    - _Requirements: 2.1, 2.4_

- [x] 2. Modify extractClubs to merge district performance data
  - [x] 2.1 Update `extractClubs` signature to accept `districtPerformance: ParsedRecord[]` as second parameter
    - _Requirements: 1.1_
  - [x] 2.2 Build lookup map at start of `extractClubs` using `buildDistrictPerformanceLookup`
    - _Requirements: 1.1_
  - [x] 2.3 For each club, look up matching `districtPerformance` record by normalized club ID and source `octoberRenewals`, `aprilRenewals`, `newMembers`, and `paymentsCount` from the match, falling back to `clubPerformance` record
    - Use column names: `Oct. Ren.` / `Oct. Ren`, `Apr. Ren.` / `Apr. Ren`, `New Members` / `New`, `Total to Date`
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_
  - [x] 2.4 Update `transformRawCSV` call site to pass `districtPerformance` to `extractClubs`
    - _Requirements: 1.1_

- [x] 3. Checkpoint - Verify existing tests still pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Write unit tests for merge behavior
  - [x] 4.1 Update existing payment field extraction tests to use `districtPerformance` as the source
    - Update test data to provide payment columns in `districtPerformance` instead of `clubPerformance`
    - _Requirements: 1.2, 1.3, 1.4, 1.5_
  - [x] 4.2 Write unit tests for fallback, backward compatibility, and non-payment field invariance
    - Fallback: club in clubPerformance with no districtPerformance match uses clubPerformance values
    - Backward compat: empty districtPerformance produces same output as before
    - Non-payment invariance: districtPerformance values for non-payment fields are ignored
    - _Requirements: 1.6, 1.7, 3.1, 3.2_
  - [x] 4.3 Write unit test for real-world regression case (Club 00009905)
    - Use actual CSV column names and values from the bug report
    - Verify oct=9, apr=4, new=2, payments=16
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 2.1, 2.2_

- [x] 5. Write property-based tests
  - [x] 5.1 Write property test: payment fields sourced from district performance
    - **Property 1: Payment fields sourced from district performance when match exists**
    - Generate random clubPerformance and districtPerformance record pairs with matching club IDs
    - Verify all four payment fields match districtPerformance values
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.5**
  - [x] 5.2 Write property test: club ID normalization enables matching
    - **Property 2: Club ID normalization enables cross-CSV matching**
    - Generate random club IDs, add random leading zeros to one copy
    - Verify merge succeeds despite different zero-padding
    - **Validates: Requirements 2.1, 2.2**

- [x] 6. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- This is a data-computation fix in the collector-cli pipeline per the data-computation-separation steering document
- No backend changes needed — the backend remains read-only
- No API changes — no OpenAPI spec updates required
- The fix mirrors the existing pattern in `ClubHealthAnalyticsModuleBackend.analyzeClubTrends()`
