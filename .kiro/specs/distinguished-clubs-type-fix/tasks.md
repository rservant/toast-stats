# Implementation Plan: Distinguished Clubs Type Fix

## Overview

This plan implements the fix for the type mismatch between analytics-core and frontend for the `distinguishedClubs` field. The implementation follows a bottom-up approach: update types first, then the analytics module, then the computer, and finally add backward compatibility in the backend.

## Tasks

- [x] 1. Update type definitions in analytics-core
  - [x] 1.1 Add DistinguishedClubCounts type to types.ts
    - Define interface with smedley, presidents, select, distinguished, and total fields
    - Add JSDoc comments explaining each field and thresholds
    - _Requirements: 1.1, 1.2_
  - [x] 1.2 Update DistrictAnalytics interface
    - Change `distinguishedClubs` from `DistinguishedClubSummary[]` to `DistinguishedClubCounts`
    - Add new field `distinguishedClubsList: DistinguishedClubSummary[]`
    - _Requirements: 1.1, 1.3_
  - [x] 1.3 Update DistinguishedClubSummary status type
    - Add 'smedley' to the status union type
    - _Requirements: 3.2_

- [x] 2. Update DistinguishedClubAnalyticsModule
  - [x] 2.1 Add generateDistinguishedClubCounts method
    - Implement method to generate DistinguishedClubCounts from snapshots
    - Use existing countDistinguishedClubs logic as foundation
    - _Requirements: 3.1_
  - [x] 2.2 Update determineDistinguishedStatus for Smedley
    - Add Smedley threshold check (10+ goals AND 25+ members)
    - Ensure Smedley is checked before President's (highest level first)
    - _Requirements: 3.2_
  - [x] 2.3 Write unit tests for threshold classification
    - Test boundary cases: 10/25 (smedley), 9/25 (president), 10/24 (president)
    - Test all classification levels with exact threshold values
    - _Requirements: 3.2_
  - [x] 2.4 Write unit tests for no double counting
    - Test club qualifying for smedley appears only in smedley count
    - Test club qualifying for president (not smedley) appears only in president count
    - Test mixed set of clubs produces correct exclusive counts
    - _Requirements: 3.3_

- [x] 3. Update AnalyticsComputer
  - [x] 3.1 Update computeDistrictAnalytics to use new format
    - Call generateDistinguishedClubCounts for distinguishedClubs field
    - Call generateDistinguishedClubSummaries for distinguishedClubsList field
    - _Requirements: 2.1, 2.2_
  - [ ]\* 3.2 Write property test for total equals sum (Property 1)
    - **Property 1: Total Equals Sum of Counts**
    - **Validates: Requirements 2.3**
  - [ ]\* 3.3 Write property test for counts-list consistency (Property 2)
    - **Property 2: Counts-List Consistency**
    - **Validates: Requirements 2.1, 2.2**

- [x] 4. Checkpoint - Verify analytics-core changes
  - Ensure all tests pass, ask the user if questions arise.
  - Run `npm run test` in packages/analytics-core
  - Verify TypeScript compilation succeeds

- [x] 5. Add backward compatibility in backend
  - [x] 5.1 Create legacy transformation utility
    - Add isLegacyDistinguishedClubsFormat type guard
    - Add transformLegacyDistinguishedClubs function
    - Place in backend/src/utils/legacyTransformation.ts
    - _Requirements: 4.1, 4.2_
  - [x] 5.2 Update analytics route to transform legacy data
    - Import transformation utility in analytics.ts route
    - Apply transformation when serving pre-computed analytics
    - Add warning log when transforming legacy data
    - _Requirements: 4.1, 4.3_
  - [x] 5.3 Write unit tests for transformation utility
    - Test empty array → all zeros
    - Test single item with status 'president' → presidents: 1, others: 0
    - Test mixed array → counts match status distribution
    - Test type guard detection (array vs object)
    - _Requirements: 4.1, 4.2_

- [x] 6. Verify type alignment
  - [x] 6.1 Compare frontend and analytics-core types
    - Verify DistinguishedClubCounts matches frontend expectation
    - Ensure no TypeScript errors in frontend compilation
    - _Requirements: 5.1, 5.3_

- [x] 7. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Run full test suite: `npm run test`
  - Verify no TypeScript errors: `npm run typecheck`

## Notes

- Tasks marked with `*` are optional property tests and can be skipped for faster MVP
- The fix is backward compatible - existing pre-computed files will be transformed on read
- No changes required to frontend code since it already expects the correct format
- Schema version does not need to change since this is a data format fix, not a schema change
- Testing approach streamlined per testing.md: 2 property tests (mathematical invariants) + comprehensive unit tests (thresholds, no-double-counting, legacy transformation)
