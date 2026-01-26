# Implementation Plan: Firestore Index Fix

## Overview

This implementation plan addresses production failures caused by missing Firestore composite indexes. The work is organized into: Firebase configuration, backend graceful degradation, frontend error handling, and documentation.

## Tasks

- [x] 1. Create Firestore Index Configuration
  - [x] 1.1 Create `firestore.indexes.json` with required composite indexes
    - Define index for `snapshots` collection with `__name__` descending
    - Define composite index for `snapshots` with `metadata.status` + `__name__` descending
    - Define index for `history` subcollection with `timestamp` descending
    - _Requirements: 1.1, 1.2, 1.3, 1.5_
  - [x] 1.2 Update `firebase.json` to reference Firestore indexes
    - Add `firestore.indexes` configuration pointing to `firestore.indexes.json`
    - _Requirements: 1.6_
  - [x] 1.3 Write unit tests for index configuration validation
    - Verify `firestore.indexes.json` exists and follows Firebase schema
    - Verify `firebase.json` references the indexes file
    - _Requirements: 1.5, 1.6_

- [x] 2. Implement Backend Error Handling Utilities
  - [x] 2.1 Create index error detection utilities in `FirestoreSnapshotStorage.ts`
    - Implement `isIndexError(error: unknown): boolean` function
    - Implement `extractIndexUrl(error: Error): string | null` function
    - _Requirements: 2.5, 2.6_
  - [x] 2.2 Write unit tests for error detection utilities
    - Test `isIndexError` with FAILED_PRECONDITION + index messages
    - Test `isIndexError` with other error types
    - Test `extractIndexUrl` with valid and invalid messages
    - **Property 2: Index Error Classification**
    - **Property 3: Index URL Extraction**
    - **Validates: Requirements 2.5, 2.6**

- [x] 3. Implement Backend Graceful Degradation
  - [x] 3.1 Update `listSnapshots` method in `FirestoreSnapshotStorage.ts`
    - Catch index errors and return empty array with logged warning
    - Log index creation URL for operators
    - _Requirements: 2.1, 2.6_
  - [x] 3.2 Update `getLatestSuccessful` method in `FirestoreSnapshotStorage.ts`
    - Catch index errors and return null with logged warning
    - Log index creation URL for operators
    - _Requirements: 2.2, 2.6_
  - [x] 3.3 Update `getLatest` method in `FirestoreSnapshotStorage.ts`
    - Catch index errors and return null with logged warning
    - Log index creation URL for operators
    - _Requirements: 2.3, 2.6_
  - [x] 3.4 Update `getChangeHistory` method in `FirestoreDistrictConfigStorage.ts`
    - Catch index errors and return empty array with logged warning
    - Log index creation URL for operators
    - _Requirements: 2.4, 2.6_
  - [x] 3.5 Write unit tests for graceful degradation
    - Mock Firestore to throw FAILED_PRECONDITION errors
    - Verify each method returns safe default on index error
    - Verify warning is logged with index URL
    - **Property 1: Graceful Degradation on Index Failure**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

- [x] 4. Checkpoint - Backend Implementation Complete
  - Ensure all backend tests pass, ask the user if questions arise.

- [x] 5. Implement Index Health Check
  - [x] 5.1 Add `IndexHealthResult` interface to `FirestoreSnapshotStorage.ts`
    - Define interface with `healthy`, `missingIndexes`, `indexCreationUrls` fields
    - _Requirements: 5.5_
  - [x] 5.2 Implement `isIndexHealthy` method in `FirestoreSnapshotStorage.ts`
    - Execute minimal query requiring composite index
    - Return health result with diagnostic information on failure
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [x] 5.3 Update `isReady` method to incorporate index health validation
    - Call `isIndexHealthy` as part of readiness check
    - _Requirements: 5.6_
  - [x] 5.4 Write unit tests for index health check
    - Test `isIndexHealthy` returns healthy when query succeeds
    - Test `isIndexHealthy` returns unhealthy with URLs when query fails
    - Test `isReady` incorporates index health
    - **Property 4: Health Check Failure Detection**
    - **Validates: Requirements 5.3, 5.5**

- [x] 6. Implement Frontend Error Handling for DateSelector
  - [x] 6.1 Update `DateSelector.tsx` to handle API errors
    - Add error state with user-friendly message
    - Add retry button functionality
    - Handle empty dates array with appropriate message
    - Log errors for debugging
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [x] 6.2 Write unit tests for DateSelector error handling
    - Test error state renders on API failure
    - Test empty state renders when no dates available
    - Test retry button triggers refetch
    - Test loading state transitions to error state
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 7. Implement Frontend Error Handling for ProgramYearSelector
  - [x] 7.1 Update `useAvailableProgramYears.ts` hook to expose error state
    - Add `isEmpty` flag to return value
    - Ensure `refetch` function is exposed
    - Verify retry count is bounded
    - _Requirements: 4.1, 4.4, 4.5_
  - [x] 7.2 Update `ProgramYearSelector.tsx` to handle error and empty states
    - Display user-friendly error message when in error state
    - Display message when no program years available
    - _Requirements: 4.2, 4.3_
  - [x] 7.3 Write unit tests for ProgramYearSelector error handling
    - Test hook returns error state with error details
    - Test hook exposes refetch function
    - Test component renders error message
    - Test component renders empty state message
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 8. Checkpoint - Frontend Implementation Complete
  - Ensure all frontend tests pass, ask the user if questions arise.

- [x] 9. Create Documentation
  - [x] 9.1 Create `docs/firestore-indexes.md` documentation
    - List all required composite indexes with field configurations
    - Explain purpose of each index and which queries require it
    - Include Firebase CLI deployment instructions
    - Include troubleshooting guidance for index errors
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 10. Final Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks including tests are required for comprehensive coverage
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests are not required for this feature per steering guidance - unit tests with well-chosen examples provide equivalent confidence
- The implementation uses TypeScript throughout (backend and frontend)
