# Implementation Plan: Latest Snapshot Pointer

## Overview

Implement a `latest-successful.json` pointer file to eliminate the ~2.5 minute cold-start directory scan. The work flows bottom-up: shared contract first, then collector-cli writer, then backend reader with fallback.

## Tasks

- [x] 1. Define snapshot pointer contract in shared-contracts
  - [x] 1.1 Create `SnapshotPointer` type in `packages/shared-contracts/src/types/snapshot-pointer.ts`
    - Define interface with `snapshotId`, `updatedAt`, and `schemaVersion` fields
    - _Requirements: 4.1, 4.3_
  - [x] 1.2 Create Zod schema in `packages/shared-contracts/src/schemas/snapshot-pointer.schema.ts`
    - Add `SnapshotPointerSchema` with regex validation for snapshotId (YYYY-MM-DD) and datetime validation for updatedAt
    - _Requirements: 4.2_
  - [x] 1.3 Add `validateSnapshotPointer` function to `packages/shared-contracts/src/validation/validators.ts`
    - Follow existing `validateSnapshotMetadata` pattern
    - _Requirements: 4.4_
  - [x] 1.4 Export new type, schema, and validator from `packages/shared-contracts/src/index.ts`
    - _Requirements: 4.1, 4.2_
  - [x] 1.5 Write property test for schema round-trip
    - **Property 2: Snapshot pointer schema round-trip**
    - **Validates: Requirements 4.2**

- [x] 2. Implement pointer writer in collector-cli TransformService
  - [x] 2.1 Add `writeSnapshotPointer` private method to `TransformService`
    - Read existing pointer, compare dates, skip if existing is newer
    - Write atomically via temp file + rename
    - Import `SnapshotPointer`, `validateSnapshotPointer`, `SCHEMA_VERSION` from shared-contracts
    - _Requirements: 1.1, 1.3, 1.4, 1.5_
  - [x] 2.2 Call `writeSnapshotPointer` at end of `transform()` method only when status is "success"
    - Do not call for "partial" or "failed" status
    - Catch and log errors without failing the transform
    - _Requirements: 1.1, 1.2_
  - [x] 2.3 Write unit tests for pointer writer
    - Test successful write creates valid pointer file
    - Test partial/failed transform preserves existing pointer
    - Test no .tmp files left behind after write
    - Test newer existing pointer is not overwritten by older date
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  - [x] 2.4 Write property test for chronological ordering
    - **Property 1: Chronological ordering of pointer updates**
    - **Validates: Requirements 1.5**

- [x] 3. Checkpoint - Ensure shared-contracts and collector-cli tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement pointer reader in backend FileSnapshotStore
  - [x] 4.1 Add `findLatestSuccessfulViaPointer` private method to `FileSnapshotStore`
    - Read `latest-successful.json` from snapshots directory
    - Validate with Zod schema
    - Read and validate referenced snapshot directory has status "success"
    - Return null on any failure (missing file, invalid JSON, bad reference)
    - Log warnings for each failure mode
    - _Requirements: 2.1, 2.3, 3.1, 3.2, 3.3_
  - [x] 4.2 Add `repairSnapshotPointer` private method to `FileSnapshotStore`
    - Write pointer file atomically after successful fallback scan
    - Non-fatal: catch and log errors without propagating
    - _Requirements: 3.4_
  - [x] 4.3 Modify `findLatestSuccessfulByScanning` to use two-phase approach
    - Phase 1: Try `findLatestSuccessfulViaPointer` (fast path)
    - Phase 2: Fall back to existing directory scan if pointer fails
    - Call `repairSnapshotPointer` after successful fallback
    - _Requirements: 2.1, 2.4, 3.4_
  - [x] 4.4 Write unit tests for pointer reader and fallback
    - Test fast path with valid pointer returns correct snapshot
    - Test missing pointer file triggers fallback
    - Test invalid JSON pointer triggers fallback
    - Test pointer to non-existent directory triggers fallback
    - Test pointer to non-success snapshot triggers fallback
    - Test fallback repairs pointer file
    - Test backend works with no pointer file (backward compatibility)
    - Test pointer write doesn't modify existing snapshot files
    - _Requirements: 2.1, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 5.1, 5.2, 5.3_

- [x] 5. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- This feature introduces no new API endpoints, so no OpenAPI updates are needed
- The backend pointer repair (task 4.2) is a narrow exception to the read-only backend rule, justified as cache/index repair
- Property tests use fast-check via vitest with minimum 100 iterations
