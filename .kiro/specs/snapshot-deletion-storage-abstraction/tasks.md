# Implementation Plan: Snapshot Deletion Storage Abstraction

## Overview

This implementation plan addresses the broken snapshot deletion functionality by extending the storage abstraction layer with delete operations and refactoring admin routes to comply with the storage abstraction steering document.

## Tasks

- [x] 1. Extend ISnapshotStorage interface with deleteSnapshot method
  - Add `deleteSnapshot(snapshotId: string): Promise<boolean>` to `backend/src/types/storageInterfaces.ts`
  - Add JSDoc documentation explaining return values and error behavior
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 2. Implement deleteSnapshot in FileSnapshotStore
  - [x] 2.1 Add deleteSnapshot method to FileSnapshotStore class
    - Implement snapshot directory deletion with `fs.rm`
    - Return false if snapshot doesn't exist (check with `fs.access`)
    - Invalidate any cached data for the deleted snapshot
    - Add structured logging with operation context
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [x] 2.2 Write unit tests for FileSnapshotStore.deleteSnapshot
    - Test delete existing snapshot returns true
    - Test delete non-existent snapshot returns false
    - Test deleted snapshot directory is removed
    - Test cache invalidation after deletion
    - _Requirements: 3.1, 3.2_

- [ ] 3. Implement deleteSnapshot in LocalSnapshotStorage
  - [x] 3.1 Add deleteSnapshot method that delegates to FileSnapshotStore
    - Simple delegation: `return this.store.deleteSnapshot(snapshotId)`
    - _Requirements: 3.1_
  - [x] 3.2 Write unit tests for LocalSnapshotStorage.deleteSnapshot
    - Verify delegation to FileSnapshotStore works correctly
    - _Requirements: 3.1, 3.2_

- [ ] 4. Implement deleteSnapshot in FirestoreSnapshotStorage
  - [x] 4.1 Add deleteSnapshot method to FirestoreSnapshotStorage class
    - Check if snapshot document exists, return false if not
    - Delete all documents in districts subcollection using batched writes
    - Delete root snapshot document
    - Integrate with circuit breaker for resilience
    - Add structured logging with operation context
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  - [x] 4.2 Write unit tests for FirestoreSnapshotStorage.deleteSnapshot
    - Test delete existing snapshot returns true
    - Test delete non-existent snapshot returns false
    - Test districts subcollection is deleted
    - Test batched deletion for >500 districts
    - _Requirements: 2.1, 2.2, 2.4_

- [x] 5. Checkpoint - Verify deleteSnapshot implementations
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Create ITimeSeriesIndexStorage interface
  - [x] 6.1 Define interface in `backend/src/types/storageInterfaces.ts`
    - Add `appendDataPoint`, `getTrendData`, `getProgramYearData` methods
    - Add `deleteSnapshotEntries(snapshotId: string): Promise<number>` method
    - Add `isReady(): Promise<boolean>` method
    - Add JSDoc documentation for all methods
    - _Requirements: 4.1, 4.2, 4.3_

- [ ] 7. Implement LocalTimeSeriesIndexStorage
  - [x] 7.1 Create `backend/src/services/storage/LocalTimeSeriesIndexStorage.ts`
    - Delegate to existing TimeSeriesIndexService for most operations
    - Implement `deleteSnapshotEntries` by reading all program year files, filtering entries, writing back
    - _Requirements: 4.4_
  - [x] 7.2 Write unit tests for LocalTimeSeriesIndexStorage
    - Test deleteSnapshotEntries removes correct entries
    - Test deleteSnapshotEntries returns count of removed entries
    - Test deleteSnapshotEntries handles non-existent snapshot
    - _Requirements: 4.2_

- [ ] 8. Implement FirestoreTimeSeriesIndexStorage
  - [x] 8.1 Create `backend/src/services/storage/FirestoreTimeSeriesIndexStorage.ts`
    - Store time-series data in Firestore collections
    - Implement `deleteSnapshotEntries` using batched queries and deletes
    - Integrate with circuit breaker for resilience
    - _Requirements: 4.5_
  - [x] 8.2 Write unit tests for FirestoreTimeSeriesIndexStorage
    - Test deleteSnapshotEntries removes correct entries
    - Test deleteSnapshotEntries returns count of removed entries
    - _Requirements: 4.2_

- [ ] 9. Update StorageProviderFactory
  - [x] 9.1 Add timeSeriesIndexStorage to StorageProviders interface
    - Update `backend/src/services/storage/StorageProviderFactory.ts`
    - Create LocalTimeSeriesIndexStorage for local provider
    - Create FirestoreTimeSeriesIndexStorage for GCP provider
    - _Requirements: 4.4, 4.5_

- [x] 10. Checkpoint - Verify time-series storage implementations
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Refactor admin snapshot-management routes
  - [x] 11.1 Remove fs and path imports from snapshot-management.ts
    - Remove `import fs from 'fs/promises'`
    - Remove `import path from 'path'`
    - _Requirements: 5.1_
  - [x] 11.2 Update deleteSnapshotWithCascade function
    - Accept ISnapshotStorage and ITimeSeriesIndexStorage as parameters
    - Use `snapshotStorage.listDistrictsInSnapshot()` to get district list
    - Use `timeSeriesStorage.deleteSnapshotEntries()` for time-series cleanup
    - Use `snapshotStorage.deleteSnapshot()` for snapshot deletion
    - Handle time-series cleanup failures gracefully (log and continue)
    - _Requirements: 5.2, 5.3, 6.1, 6.3, 6.4_
  - [x] 11.3 Update DELETE /api/admin/snapshots route
    - Get storage providers from factory
    - Pass storage instances to deleteSnapshotWithCascade
    - _Requirements: 5.6_
  - [x] 11.4 Update DELETE /api/admin/snapshots/range route
    - Use `snapshotStorage.listSnapshots()` with date filters to find snapshots
    - Remove direct filesystem directory listing
    - _Requirements: 5.7_
  - [x] 11.5 Update DELETE /api/admin/snapshots/all route
    - Use `snapshotStorage.listSnapshots()` to enumerate all snapshots
    - Remove direct filesystem directory listing
    - _Requirements: 5.2_
  - [x] 11.6 Write integration tests for refactored routes
    - Test DELETE /api/admin/snapshots uses storage abstraction
    - Test DELETE /api/admin/snapshots/range uses listSnapshots
    - Test cascading deletion removes time-series entries
    - Test partial failure handling (time-series fails, snapshot succeeds)
    - _Requirements: 5.6, 5.7, 6.1, 6.4_

- [ ] 12. Refactor admin monitoring routes
  - [x] 12.1 Remove fs import from monitoring.ts
    - Remove `import fs from 'fs/promises'`
    - _Requirements: 5.4_
  - [x] 12.2 Update GET /api/admin/health route
    - Remove direct filesystem check for analytics-summary.json
    - Use storage abstraction to check for pre-computed analytics
    - Note: Analytics are stored within snapshots, so use getSnapshotMetadata or similar
    - _Requirements: 5.5_
  - [x] 12.3 Write tests for refactored monitoring routes
    - Test health endpoint works without fs access
    - _Requirements: 5.4, 5.5_

- [x] 13. Checkpoint - Verify admin route refactoring
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Update ProductionServiceFactory
  - [x] 14.1 Add createTimeSeriesIndexStorage method
    - Return appropriate implementation based on STORAGE_PROVIDER
    - _Requirements: 4.4, 4.5_
  - [x] 14.2 Expose timeSeriesIndexStorage in container registration
    - Register ITimeSeriesIndexStorage interface in production container
    - _Requirements: 4.1_

- [ ] 15. Final verification and cleanup
  - [x] 15.1 Verify no fs imports remain in route handlers
    - Check snapshot-management.ts has no fs import
    - Check monitoring.ts has no fs import
    - _Requirements: 5.1, 5.4_
  - [x] 15.2 Run full test suite
    - Ensure all existing tests still pass
    - Ensure new tests pass
    - Verify tests run in parallel without conflicts

- [x] 16. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks including tests are required for comprehensive coverage
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- The implementation follows the existing patterns in StorageProviderFactory
- All storage implementations must handle errors gracefully with StorageOperationError
