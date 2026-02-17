# Implementation Plan: Analytics Date Selection Fix

## Overview

This implementation fixes the bug where analytics endpoints ignore the `endDate` query parameter. The fix introduces a centralized `getSnapshotForDate` helper function in `shared.ts` that all affected endpoints will use for date-aware snapshot selection.

## Tasks

- [x] 1. Create the `getSnapshotForDate` helper function
  - [x] 1.1 Add `GetSnapshotForDateResult` interface to `backend/src/routes/districts/shared.ts`
    - Define interface with `snapshot`, `snapshotDate`, and optional `error` fields
    - _Requirements: 1.1, 6.1, 6.2, 6.3, 6.4_
  - [x] 1.2 Implement `getSnapshotForDate` function in `backend/src/routes/districts/shared.ts`
    - When `endDate` provided: use `snapshotStore.getSnapshot(endDate)`
    - When `endDate` not provided: use `snapshotStore.getLatestSuccessful()`
    - Return proper error structure when requested snapshot doesn't exist
    - _Requirements: 1.1, 1.2, 1.3, 6.1, 6.2, 6.3, 6.4_
  - [x] 1.3 Write unit tests for `getSnapshotForDate` helper
    - Test date-aware selection with existing snapshot
    - Test backward compatibility (no date returns latest)
    - Test error handling for non-existent snapshot
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Update analytics endpoints to use date-aware snapshot selection
  - [x] 2.1 Update `/api/districts/:districtId/analytics` endpoint
    - Extract `endDate` from query parameters
    - Replace `snapshotStore.getLatestSuccessful()` with `getSnapshotForDate(endDate)`
    - Handle error response when snapshot not found
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [x] 2.2 Update `/api/districts/:districtId/membership-analytics` endpoint
    - Extract `endDate` from query parameters
    - Replace `snapshotStore.getLatestSuccessful()` with `getSnapshotForDate(endDate)`
    - Handle error response when snapshot not found
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 2.3 Update `/api/districts/:districtId/leadership-insights` endpoint
    - Extract `endDate` from query parameters
    - Replace `snapshotStore.getLatestSuccessful()` with `getSnapshotForDate(endDate)`
    - Handle error response when snapshot not found
    - _Requirements: 3.1, 3.2, 3.3_
  - [x] 2.4 Update `/api/districts/:districtId/distinguished-club-analytics` endpoint
    - Extract `endDate` from query parameters
    - Replace `snapshotStore.getLatestSuccessful()` with `getSnapshotForDate(endDate)`
    - Handle error response when snapshot not found
    - _Requirements: 4.1, 4.2, 4.3_
  - [x] 2.5 Update `/api/districts/:districtId/vulnerable-clubs` endpoint
    - Extract `endDate` from query parameters
    - Replace `snapshotStore.getLatestSuccessful()` with `getSnapshotForDate(endDate)`
    - Handle error response when snapshot not found
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 3. Checkpoint - Verify implementation
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Write integration tests
  - [x] 4.1 Write integration test for date-aware analytics endpoint
    - Test request with valid `endDate` returns correct snapshot data
    - Test request without `endDate` returns latest snapshot data
    - Test request with non-existent `endDate` returns 404
    - _Requirements: 1.1, 1.2, 1.3, 6.1, 6.2_

- [x] 5. Verify OpenAPI documentation
  - [x] 5.1 Verify `endDate` parameter is documented in `backend/openapi.yaml`
    - Check all affected endpoints have `endDate` query parameter documented
    - Verify 404 response for `SNAPSHOT_NOT_FOUND` is documented
    - _Requirements: 6.1, 6.2_

- [x] 6. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks are required for comprehensive testing
- The fix uses the existing `snapshotStore.getSnapshot(snapshotId)` method which is already available
- No new API endpoints are created; only existing endpoint behavior is corrected
- OpenAPI documentation should already have `endDate` parameter; task 5 verifies this
