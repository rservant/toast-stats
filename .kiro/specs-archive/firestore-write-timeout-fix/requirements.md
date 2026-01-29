# Requirements Document

## Introduction

This feature addresses critical production failures where Firestore snapshot writes are timing out with `DEADLINE_EXCEEDED` errors. The `writeSnapshot` operation in `FirestoreSnapshotStorage` is taking 100-121 seconds to complete, exceeding Firestore's default deadline of ~60 seconds. This causes backfill operations to fail completely when writing snapshots containing 132 districts worth of data.

The root cause is that the current implementation uses a single Firestore batch write to atomically write the root snapshot document AND all 132+ district subdocuments. While Firestore batches support up to 500 operations, the total time to commit a large batch can exceed Firestore's RPC deadline limits.

## Glossary

- **Firestore_Batch**: A Firestore WriteBatch that groups multiple write operations into a single atomic commit, limited to 500 operations per batch
- **Snapshot_Storage**: The `FirestoreSnapshotStorage` class responsible for persisting snapshot data to Google Cloud Firestore
- **District_Document**: A Firestore document in the `districts` subcollection containing statistics for a single district
- **Root_Document**: The main snapshot document containing metadata, manifest, and optional rankings data
- **Deadline_Exceeded**: A gRPC error (code 4) indicating the operation took longer than the allowed deadline
- **Chunked_Write**: A strategy that splits large write operations into smaller batches processed sequentially or in parallel
- **Exponential_Backoff**: A retry strategy where wait time increases exponentially between retry attempts
- **Controlled_Concurrency**: Limiting the number of parallel operations to avoid overwhelming the target system

## Requirements

### Requirement 1: Chunked Batch Writes

**User Story:** As a system operator, I want snapshot writes to be split into smaller batches, so that individual Firestore operations complete within deadline limits.

#### Acceptance Criteria

1. WHEN writing a snapshot with more than 50 district documents, THE Snapshot_Storage SHALL split the write into multiple batches
2. THE Snapshot_Storage SHALL limit each batch to a maximum of 50 write operations to ensure completion within Firestore deadlines
3. WHEN processing multiple batches, THE Snapshot_Storage SHALL write the root document in the first batch along with initial district documents
4. THE Snapshot_Storage SHALL log progress after each batch completes including batch number, operations count, and duration
5. IF a batch fails, THEN THE Snapshot_Storage SHALL include the batch number and failed operations in the error context

### Requirement 2: Retry Logic with Exponential Backoff

**User Story:** As a system operator, I want transient Firestore failures to be automatically retried, so that temporary network issues don't cause complete operation failures.

#### Acceptance Criteria

1. WHEN a batch write fails with a retryable error (DEADLINE_EXCEEDED, UNAVAILABLE, INTERNAL, ABORTED), THE Snapshot_Storage SHALL retry the operation
2. THE Snapshot_Storage SHALL use exponential backoff starting at 1 second, doubling each retry, with a maximum of 30 seconds between retries
3. THE Snapshot_Storage SHALL attempt a maximum of 3 retries per batch before failing
4. THE Snapshot_Storage SHALL add jitter (±20%) to backoff delays to prevent thundering herd effects
5. WHEN all retries are exhausted, THE Snapshot_Storage SHALL throw a StorageOperationError with retry attempt details
6. THE Snapshot_Storage SHALL log each retry attempt with the error type, attempt number, and next delay

### Requirement 3: Parallel District Writes with Controlled Concurrency

**User Story:** As a system operator, I want district documents to be written in parallel with controlled concurrency, so that snapshot writes complete faster while respecting Firestore limits.

#### Acceptance Criteria

1. THE Snapshot_Storage SHALL support configurable concurrency for parallel batch processing (default: 3 concurrent batches)
2. WHEN writing batches in parallel, THE Snapshot_Storage SHALL ensure the root document batch completes before district batches begin
3. THE Snapshot_Storage SHALL track and report the total number of successful and failed batch operations
4. IF any batch fails after retries, THEN THE Snapshot_Storage SHALL continue processing remaining batches and report partial success
5. THE Snapshot_Storage SHALL log the total write duration and breakdown by phase (root document, district batches)

### Requirement 4: Write Operation Timeout Configuration

**User Story:** As a system operator, I want to configure Firestore operation timeouts, so that I can tune performance based on network conditions and data size.

#### Acceptance Criteria

1. THE Snapshot_Storage SHALL support configurable timeout per batch operation (default: 30 seconds)
2. THE Snapshot_Storage SHALL support configurable total operation timeout (default: 5 minutes)
3. WHEN the total operation timeout is exceeded, THE Snapshot_Storage SHALL abort remaining operations and report partial completion status
4. THE Snapshot_Storage SHALL expose timeout configuration through the FirestoreSnapshotStorageConfig interface

### Requirement 5: Graceful Partial Write Handling

**User Story:** As a system operator, I want partial write failures to be handled gracefully, so that successful district writes are preserved even when some fail.

#### Acceptance Criteria

1. WHEN some district batches fail but others succeed, THE Snapshot_Storage SHALL update the manifest to reflect actual successful districts
2. THE Snapshot_Storage SHALL mark the snapshot status as 'partial' when not all districts were written successfully
3. THE Snapshot_Storage SHALL include a list of failed district IDs in the snapshot metadata
4. IF the root document write fails, THEN THE Snapshot_Storage SHALL fail the entire operation without writing district documents
5. THE Snapshot_Storage SHALL provide a method to check if a snapshot write completed fully or partially

### Requirement 6: Backward Compatibility

**User Story:** As a developer, I want the improved write implementation to maintain the existing API contract, so that calling code doesn't need modification.

#### Acceptance Criteria

1. THE Snapshot_Storage writeSnapshot method SHALL maintain its existing method signature
2. THE Snapshot_Storage SHALL preserve the existing document structure in Firestore (root document with districts subcollection)
3. WHEN all batches succeed, THE Snapshot_Storage SHALL produce identical Firestore documents as the previous implementation
4. THE Snapshot_Storage SHALL continue to integrate with the existing circuit breaker pattern
