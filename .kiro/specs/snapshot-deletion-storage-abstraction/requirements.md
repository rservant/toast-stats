# Requirements Document

## Introduction

This document specifies the requirements for fixing the snapshot deletion functionality in the admin panel and ensuring compliance with the storage abstraction steering document. Currently, the delete operations only work with local filesystem storage and fail silently when running in production with Firestore storage (STORAGE_PROVIDER=gcp). Additionally, several backend components violate the storage abstraction rules by performing direct filesystem operations.

The fix requires:

1. Extending the storage abstraction layer to include delete operations
2. Updating the admin routes to use the abstraction instead of direct filesystem operations
3. Creating storage abstractions for time-series index and pre-computed analytics operations
4. Removing all direct filesystem access from route handlers and non-storage services

## Glossary

- **ISnapshotStorage**: The storage abstraction interface that defines operations for snapshot persistence, enabling swappable implementations for local filesystem and cloud storage.
- **ITimeSeriesIndexStorage**: A new storage abstraction interface for time-series index operations, enabling consistent access across storage backends.
- **IPreComputedAnalyticsStorage**: A new storage abstraction interface for pre-computed analytics operations, enabling consistent access across storage backends.
- **FirestoreSnapshotStorage**: The cloud storage implementation that stores snapshots in Google Cloud Firestore as documents with district data in subcollections.
- **LocalSnapshotStorage**: The local filesystem storage implementation that delegates to FileSnapshotStore for development environments.
- **FileSnapshotStore**: The underlying filesystem-based snapshot store that manages snapshot directories and files.
- **Snapshot**: A complete, immutable, time-ordered representation of district statistics data captured at a specific point in time.
- **Cascading_Deletion**: The process of deleting a snapshot along with all associated data including time-series index entries and pre-computed analytics.
- **Time_Series_Index**: Index files that track district membership data points over time, organized by program year.
- **Admin_Routes**: Express.js route handlers that provide administrative operations for snapshot management.
- **Storage_Abstraction_Violation**: Code that performs direct filesystem operations (fs.readFile, fs.writeFile, fs.rm, etc.) outside of storage implementation classes.

## Requirements

### Requirement 1: Storage Interface Extension for Deletion

**User Story:** As a system maintainer, I want the storage abstraction layer to support snapshot deletion, so that delete operations work consistently across all storage backends.

#### Acceptance Criteria

1. THE ISnapshotStorage interface SHALL include a `deleteSnapshot(snapshotId: string): Promise<boolean>` method
2. THE deleteSnapshot method SHALL return true WHEN the snapshot was successfully deleted
3. THE deleteSnapshot method SHALL return false WHEN the snapshot does not exist
4. IF an error occurs during deletion, THEN THE deleteSnapshot method SHALL throw a StorageOperationError with appropriate context

### Requirement 2: Firestore Delete Implementation

**User Story:** As a system operator, I want to delete snapshots from Firestore storage, so that I can manage storage costs and remove outdated data in production.

#### Acceptance Criteria

1. WHEN deleteSnapshot is called on FirestoreSnapshotStorage, THE implementation SHALL delete the root snapshot document
2. WHEN deleteSnapshot is called on FirestoreSnapshotStorage, THE implementation SHALL delete all documents in the districts subcollection
3. THE FirestoreSnapshotStorage deleteSnapshot method SHALL use batch operations for atomic deletion where possible
4. IF the snapshot document does not exist, THEN THE FirestoreSnapshotStorage deleteSnapshot method SHALL return false without throwing an error
5. THE FirestoreSnapshotStorage deleteSnapshot method SHALL integrate with the circuit breaker for resilience
6. THE FirestoreSnapshotStorage deleteSnapshot method SHALL log deletion operations with appropriate context

### Requirement 3: Local Storage Delete Implementation

**User Story:** As a developer, I want snapshot deletion to work in local development, so that I can test delete functionality without cloud infrastructure.

#### Acceptance Criteria

1. WHEN deleteSnapshot is called on LocalSnapshotStorage, THE implementation SHALL delete the snapshot directory and all its contents
2. IF the snapshot directory does not exist, THEN THE LocalSnapshotStorage deleteSnapshot method SHALL return false without throwing an error
3. THE LocalSnapshotStorage deleteSnapshot method SHALL handle filesystem errors gracefully
4. THE LocalSnapshotStorage deleteSnapshot method SHALL log deletion operations with appropriate context

### Requirement 4: Time-Series Index Storage Abstraction

**User Story:** As a system maintainer, I want time-series index operations to go through a storage abstraction, so that cascading deletion works consistently across all storage backends.

#### Acceptance Criteria

1. THE system SHALL define an ITimeSeriesIndexStorage interface for time-series index operations
2. THE ITimeSeriesIndexStorage interface SHALL include a `deleteSnapshotEntries(snapshotId: string): Promise<number>` method that removes all data points for a given snapshot
3. THE ITimeSeriesIndexStorage interface SHALL include methods for reading and writing time-series data points
4. THE LocalTimeSeriesIndexStorage implementation SHALL delegate to the existing TimeSeriesIndexService for filesystem operations
5. THE FirestoreTimeSeriesIndexStorage implementation SHALL store time-series data in Firestore collections

### Requirement 5: Admin Route Storage Abstraction Compliance

**User Story:** As a system operator, I want the admin endpoints to comply with the storage abstraction steering document, so that they work correctly with any storage backend.

#### Acceptance Criteria

1. THE admin snapshot management routes SHALL NOT import or use the `fs` module directly
2. THE admin snapshot management routes SHALL use ISnapshotStorage for all snapshot operations
3. THE admin snapshot management routes SHALL use ITimeSeriesIndexStorage for time-series index cleanup
4. THE admin monitoring routes SHALL NOT import or use the `fs` module directly
5. THE admin monitoring routes SHALL use storage abstractions for checking pre-computed analytics existence
6. WHEN deleting snapshots by IDs, THE admin route SHALL call deleteSnapshot on the storage provider for each snapshot
7. WHEN deleting snapshots in a date range, THE admin route SHALL use listSnapshots with date filters to find matching snapshots

### Requirement 6: Cascading Deletion via Storage Abstraction

**User Story:** As a system operator, I want cascading deletion to work correctly with all storage backends, so that orphaned data is properly cleaned up.

#### Acceptance Criteria

1. WHEN a snapshot is deleted, THE system SHALL call ITimeSeriesIndexStorage.deleteSnapshotEntries to remove associated time-series data
2. WHEN a snapshot is deleted, THE system SHALL remove any pre-computed analytics data (which is stored within the snapshot in both local and Firestore implementations)
3. THE cascading deletion logic SHALL work correctly regardless of the underlying storage provider
4. IF time-series index cleanup fails, THEN THE system SHALL log the error and continue with the deletion operation
5. THE deletion result SHALL report the number of time-series entries removed

### Requirement 7: Error Handling and Logging

**User Story:** As a system operator, I want clear error messages and logging for delete operations, so that I can diagnose issues in production.

#### Acceptance Criteria

1. WHEN a delete operation fails, THE system SHALL log the error with operation context including snapshot ID and storage provider type
2. THE delete operation results SHALL include detailed information about what was deleted and any errors encountered
3. IF partial deletion occurs, THEN THE system SHALL report which components were successfully deleted and which failed
4. THE system SHALL use structured logging with consistent operation identifiers for traceability
