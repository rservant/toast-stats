# Implementation Plan: Storage Provider Integration Fix

## Overview

This implementation plan addresses the incomplete GCP storage migration by updating `shared.ts` to use `StorageProviderFactory` and adding graceful empty storage handling. The changes are minimal and focused on fixing the integration gap.

## Tasks

- [x] 1. Fix FileSnapshotStore empty directory handling
  - [x] 1.1 Add directory existence check in `findLatestSuccessfulByScanning()`
    - Add `fs.access()` check before `fs.readdir()` in `backend/src/services/SnapshotStore.ts`
    - Return `null` gracefully when directory doesn't exist (ENOENT)
    - Log debug message for missing directory scenario
    - _Requirements: 3.1, 3.3, 3.4_
  - [x] 1.2 Write unit tests for empty directory handling
    - Test `findLatestSuccessfulByScanning` returns `null` when directory doesn't exist
    - Test `findLatestSuccessfulByScanning` returns `null` when directory is empty
    - Test `getLatestSuccessful` returns `null` for empty storage
    - _Requirements: 2.3, 2.4, 3.1, 3.2_

- [x] 2. Update shared.ts to use StorageProviderFactory
  - [x] 2.1 Replace FileSnapshotStore with StorageProviderFactory
    - Import `StorageProviderFactory` from `../../services/storage/StorageProviderFactory.js`
    - Import `ISnapshotStorage` type from `../../types/storageInterfaces.js`
    - Replace direct `FileSnapshotStore` instantiation with `StorageProviderFactory.createFromEnvironment()`
    - Update `snapshotStore` export to use `ISnapshotStorage` type
    - Maintain `perDistrictSnapshotStore` as backward compatibility alias
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [x] 2.2 Update service initialization to use storage provider
    - Update `districtDataAggregator` creation to use the new `snapshotStore`
    - Update `RefreshService` initialization to use the storage provider
    - Update `BackfillService` initialization to use the storage provider
    - Ensure all services use the same storage provider instance
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  - [x] 2.3 Write integration tests for storage provider selection
    - Test that `STORAGE_PROVIDER=local` uses `LocalSnapshotStorage`
    - Test that `STORAGE_PROVIDER=gcp` uses `FirestoreSnapshotStorage` (mock GCP)
    - Test that unset `STORAGE_PROVIDER` defaults to local
    - **Property 1: Storage Provider Selection**
    - **Validates: Requirements 1.1, 1.2**

- [x] 3. Checkpoint - Verify storage provider integration
  - Ensure all tests pass, ask the user if questions arise.
  - Verify `STORAGE_PROVIDER` environment variable is respected
  - Test with empty storage to confirm 503 response

- [x] 4. Verify error response consistency
  - [x] 4.1 Review existing error handling in route handlers
    - Verify `serveFromPerDistrictSnapshot` returns 503 for empty storage
    - Verify `serveDistrictFromPerDistrictSnapshot` returns 503 for empty storage
    - Verify error response includes `code`, `message`, and `details` fields
    - _Requirements: 2.1, 6.1, 6.2, 6.3_
  - [x] 4.2 Write tests for error response consistency
    - Test all district routes return 503 with `NO_SNAPSHOT_AVAILABLE` for empty storage
    - Test error response structure matches expected format
    - **Property 3: HTTP 503 for Empty Storage**
    - **Property 4: Consistent Error Response Structure**
    - **Validates: Requirements 2.1, 2.2, 6.1, 6.2, 6.3, 6.4**

- [x] 5. Update documentation
  - [x] 5.1 Update storage-migration-guide.md
    - Add section noting the completed route handler integration
    - Document that all route handlers now respect `STORAGE_PROVIDER`
    - Add troubleshooting section for empty storage scenarios
    - _Requirements: 5.1, 5.3, 5.4_
  - [x] 5.2 Update DEPLOYMENT.md
    - Add verification steps for confirming storage provider selection
    - Add troubleshooting for 503 `NO_SNAPSHOT_AVAILABLE` responses
    - Note the fix for the incomplete migration
    - _Requirements: 5.2, 5.3_

- [x] 6. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Verify documentation is accurate and complete

## Notes

- All tasks are required for comprehensive coverage
- The fix is minimal and focused on the integration gap
- Existing storage abstraction layer is well-designed; we're just ensuring it's used correctly
- Property-based tests are not warranted per the property-testing-guidance steering document since the input space is bounded and well-defined
