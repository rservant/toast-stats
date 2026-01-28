# Implementation Plan: Firestore Write Timeout Fix

## Overview

This implementation transforms the single-batch snapshot write in `FirestoreSnapshotStorage` into a chunked, retry-capable, concurrent batch write system. The work is organized to build foundational utilities first, then integrate them into the main write flow.

## Tasks

- [ ] 1. Add batch write configuration types and defaults
  - [ ] 1.1 Add BatchWriteConfig interface to FirestoreSnapshotStorage.ts
    - Define maxOperationsPerBatch (default: 50)
    - Define maxConcurrentBatches (default: 3)
    - Define batchTimeoutMs (default: 30000)
    - Define totalTimeoutMs (default: 300000)
    - Define maxRetries (default: 3)
    - Define initialBackoffMs (default: 1000)
    - Define maxBackoffMs (default: 30000)
    - Define jitterFactor (default: 0.2)
    - _Requirements: 4.1, 4.2, 4.4_
  - [ ] 1.2 Add BatchWriteResult and SnapshotWriteResult interfaces
    - BatchWriteResult: batchIndex, operationCount, success, retryAttempts, durationMs, error, districtIds
    - SnapshotWriteResult: snapshotId, complete, totalBatches, successfulBatches, failedBatches, districtsWritten, failedDistricts, totalDurationMs, batchResults
    - _Requirements: 3.3, 5.1, 5.2, 5.3_
  - [ ] 1.3 Extend FirestoreSnapshotStorageConfig to accept batchWriteConfig
    - Add optional batchWriteConfig property
    - Merge with defaults in constructor
    - _Requirements: 4.4, 6.1_

- [ ] 2. Implement backoff calculation utility
  - [ ] 2.1 Add calculateBackoffDelay private method
    - Implement exponential backoff: min(initialBackoffMs \* 2^attempt, maxBackoffMs)
    - Add jitter: delay \* (1 + random(-jitterFactor, +jitterFactor))
    - Accept optional random function for testing
    - _Requirements: 2.2, 2.4_
  - [ ] 2.2 Write unit tests for backoff calculation
    - Test attempt 0 → 1000ms base
    - Test attempt 1 → 2000ms base
    - Test attempt 2 → 4000ms base
    - Test cap at maxBackoffMs (30000ms)
    - Test jitter bounds with mock random
    - _Requirements: 2.2, 2.4_
  - [ ] 2.3 Write property test for backoff jitter bounds
    - **Property 4: Backoff Calculation with Jitter**
    - Generate attempt numbers 0-10
    - Verify actualDelay within baseDelay \* (1 ± jitterFactor)
    - **Validates: Requirements 2.2, 2.4**

- [ ] 3. Implement retry logic for batch writes
  - [ ] 3.1 Add isRetryableWriteError private method
    - Check for DEADLINE_EXCEEDED, UNAVAILABLE, INTERNAL, ABORTED
    - Return false for all other errors
    - _Requirements: 2.1_
  - [ ] 3.2 Add executeBatchWithRetry private method
    - Accept WriteBatch, batchIndex, optional districtIds
    - Attempt batch.commit() with timeout
    - On retryable error: calculate backoff, wait, retry up to maxRetries
    - Log each retry attempt with error type, attempt number, next delay
    - Return BatchWriteResult with success/failure details
    - _Requirements: 2.1, 2.3, 2.5, 2.6, 1.4, 1.5_
  - [ ] 3.3 Write unit tests for retry logic
    - Test retryable error triggers retry
    - Test non-retryable error fails immediately
    - Test max 3 retries then failure
    - Test each error type classification
    - _Requirements: 2.1, 2.3, 2.5_

- [ ] 4. Implement batch chunking
  - [ ] 4.1 Add chunkDistrictDocuments private method
    - Accept districts array and snapshotId
    - Create batches of maxOperationsPerBatch size
    - First batch includes root document + initial districts
    - Return array of { batch, districtIds } objects
    - _Requirements: 1.1, 1.2, 1.3_
  - [ ] 4.2 Write unit tests for batch chunking
    - Test 1 district → 1 batch
    - Test 49 districts → 1 batch (root + 49 = 50)
    - Test 50 districts → 2 batches
    - Test 51 districts → 2 batches
    - Test 100 districts → 3 batches
    - Test 132 districts (production case) → 3 batches
    - Verify root document in batch 0
    - _Requirements: 1.1, 1.2, 1.3_

- [ ] 5. Implement concurrent batch processing
  - [ ] 5.1 Add processBatchesWithConcurrency private method
    - Accept array of batches and starting index
    - Process batches with maxConcurrentBatches parallelism
    - Use Promise.allSettled to continue on failures
    - Return array of BatchWriteResult
    - _Requirements: 3.1, 3.4_
  - [ ] 5.2 Write unit tests for concurrent processing
    - Test concurrency limit respected
    - Test partial failure continues remaining batches
    - Test all success scenario
    - Test all failure scenario
    - _Requirements: 3.1, 3.4_

- [ ] 6. Checkpoint - Verify utilities work correctly
  - Ensure all unit tests pass
  - Review logging output format
  - Ask the user if questions arise

- [ ] 7. Refactor writeSnapshot to use chunked writes
  - [ ] 7.1 Update writeSnapshot method implementation
    - Build root document and manifest as before
    - Create first batch with root document
    - Execute root batch with retry (fail fast if root fails)
    - Chunk remaining districts into batches
    - Process district batches with concurrency
    - Aggregate results into SnapshotWriteResult
    - Update manifest if partial success
    - Log total duration and breakdown by phase
    - _Requirements: 1.1, 1.2, 1.3, 3.2, 3.3, 3.5, 5.4, 6.1, 6.2_
  - [ ] 7.2 Add partial success handling
    - Track failed district IDs
    - Update manifest.districts to reflect actual successes
    - Set metadata.writeComplete = false if any failures
    - Set metadata.writeFailedDistricts with failed IDs
    - _Requirements: 5.1, 5.2, 5.3_
  - [ ] 7.3 Write unit tests for refactored writeSnapshot
    - Test small snapshot (< 50 districts) - single batch
    - Test large snapshot (132 districts) - multiple batches
    - Test root batch failure - no district writes
    - Test partial district batch failure - partial success
    - Test all batches succeed - complete success
    - _Requirements: 1.1, 5.4, 6.1, 6.2_

- [ ] 8. Add write completion check method
  - [ ] 8.1 Add isSnapshotWriteComplete method
    - Accept snapshotId
    - Read metadata and check writeComplete field
    - Return true if writeComplete is true or undefined (backward compat)
    - Return false if writeComplete is false
    - _Requirements: 5.5_
  - [ ] 8.2 Write unit tests for completion check
    - Test complete snapshot returns true
    - Test partial snapshot returns false
    - Test legacy snapshot (no field) returns true
    - _Requirements: 5.5_

- [ ] 9. Checkpoint - Integration verification
  - Ensure all tests pass
  - Verify circuit breaker integration still works
  - Test with Firestore emulator if available
  - Ask the user if questions arise

- [ ] 10. Write property test for write/read equivalence
  - [ ] 10.1 Implement equivalence property test
    - **Property 9: Document Structure Equivalence**
    - Generate valid Snapshot objects with 1-200 districts
    - Write via writeSnapshot, read via getSnapshot
    - Verify districts, metadata, rankings are equivalent
    - Requires Firestore emulator
    - **Validates: Requirements 6.2, 6.3**

- [ ] 11. Final checkpoint - Full test suite
  - Ensure all tests pass including property tests
  - Verify no TypeScript errors
  - Review logging for production readiness
  - Ask the user if questions arise

## Notes

- All tasks are required for comprehensive implementation
- The implementation preserves backward compatibility - existing callers don't need changes
- Property tests require Firestore emulator and may be skipped in CI without emulator
- The 50 operations per batch limit is conservative; Firestore allows 500 but smaller batches complete faster
