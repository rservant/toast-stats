# Implementation Plan: GCS Snapshot Storage

## Overview

Implement `GCSSnapshotStorage` as a read-only `ISnapshotStorage` implementation that reads pre-computed snapshot data from a GCS bucket. Update `StorageProviderFactory` to create it when `STORAGE_PROVIDER=gcp`. Extend shared-contracts with the `writeComplete` manifest field.

## Tasks

- [x] 1. Extend shared-contracts with writeComplete field
  - [x] 1.1 Add `writeComplete?: boolean` to `SnapshotManifest` type in `packages/shared-contracts/src/types/snapshot-manifest.ts`
    - Add the optional boolean field to the interface
    - _Requirements: 9.1, 9.3_
  - [x] 1.2 Add `writeComplete: z.boolean().optional()` to `SnapshotManifestSchema` in `packages/shared-contracts/src/schemas/snapshot-manifest.schema.ts`
    - Add the Zod field to the schema
    - _Requirements: 9.1, 9.3_
  - [x] 1.3 Write unit tests for the updated SnapshotManifest schema
    - Test that manifests with `writeComplete: true`, `writeComplete: false`, and missing `writeComplete` all validate correctly
    - _Requirements: 9.1, 9.2, 9.3_

- [x] 2. Create GCSSnapshotStorage class with config, validation, and error classification
  - [x] 2.1 Create `backend/src/services/storage/GCSSnapshotStorage.ts` with config interface, constructor, and path building
    - Define `GCSSnapshotStorageConfig` with `projectId`, `bucketName`, `prefix?`, `storage?`
    - Constructor initializes `Storage`, `Bucket`, and `CircuitBreaker` instances
    - Implement `buildObjectPath(snapshotId, filename)` helper
    - _Requirements: 7.3 (prefix config), 5.1 (circuit breaker init), 5.4 (breaker config pattern)_
  - [x] 2.2 Implement `validateSnapshotId()` and `validateDistrictId()` input validation
    - Snapshot ID: regex match, calendar date validation, path traversal check, unicode/percent-encoding check
    - District ID: non-empty, alphanumeric-only, no whitespace/traversal
    - Both throw `StorageOperationError` with `retryable: false` and `provider: "gcs"`
    - _Requirements: 6.1, 6.2, 6.3, 4.6_
  - [x] 2.3 Implement `classifyError()` with structured-first error classification
    - Check numeric `statusCode`/`code` first (404, 408, 429, 5xx, 4xx)
    - Check string error codes (ECONNRESET, ENOTFOUND, ECONNREFUSED, ETIMEDOUT, EAI_AGAIN)
    - Fallback to message pattern matching
    - Return `{ retryable: boolean; is404: boolean }`
    - _Requirements: 4.1, 4.2, 4.3, 4.5_
  - [x] 2.4 Implement circuit breaker with correct `expectedErrors` polarity
    - `expectedErrors(err) === true` means "count toward threshold" (transient infra errors only)
    - `expectedErrors(err) === false` for 404s and permanent errors
    - Use `failureThreshold: 5`, `recoveryTimeout: 60000`, `monitoringPeriod: 180000`
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [x] 2.5 Write property test for error classification (Property 9)
    - **Property 9: Error classification sets retryable flag correctly**
    - Use tiered generators to test precedence correctly:
      - Gen A: statusCode-only errors (no string code, no message) — verify numeric classification
      - Gen B: string-code-only errors (no numeric code) — verify ECONNRESET/ENOTFOUND/etc classification
      - Gen C: message-only errors (no code fields) — verify message pattern fallback
      - Gen D: mixed-field errors (curated combinations) — verify precedence (statusCode > string code > message)
    - Verify classification output matches expected retryable/is404 flags per precedence tier
    - **Validates: Requirements 4.2, 4.3, 4.5**
  - [x] 2.6 Write property test for input validation (Property 10)
    - **Property 10: Input validation rejects invalid IDs before GCS calls**
    - Generate invalid snapshot IDs (bad format, invalid calendar dates, path traversal, unicode, percent-encoded)
    - Generate invalid district IDs (empty, whitespace, traversal characters)
    - Verify `StorageOperationError` thrown with `retryable: false`
    - **Validates: Requirements 6.1, 6.2, 6.3, 4.6**

- [x] 3. Implement core read helpers and write/delete rejection
  - [x] 3.1 Implement `readObject<T>()` generic helper
    - Wrap GCS `file.download()` in circuit breaker
    - Parse JSON, validate with provided Zod schema
    - JSON parse failure throws `StorageOperationError` with `retryable: false` (not treated as 404, counts as permanent corruption)
    - Handle 404 → return null (using `classifyError`)
    - Wrap all errors in `StorageOperationError`
    - _Requirements: 4.1 (404 semantics), 4.4 (Zod validation failure), 4.5 (error wrapping)_
  - [x] 3.2 Implement `checkObjectExists()` helper using `file.exists()`
    - Use `file.exists()` (HEAD request), not download
    - Wrap in circuit breaker; `exists()` returns `[boolean]` and does not throw on 404 — circuit breaker only sees genuine infra errors (network, permission)
    - _Requirements: 2.2 (rankings existence), 5.1 (breaker wrapping)_
  - [x] 3.3 Implement async generator `iterateSnapshotPrefixes()`
    - Paginated `getFiles()` with `delimiter: "/"`, `maxResults: 100`, `autoPaginate: false`
    - Extract snapshot IDs from `apiResponse.prefixes` array (match the exact `bucket.getFiles()` return tuple shape used in `GCSRawCSVStorage`)
    - Yield incrementally via page tokens
    - _Requirements: 1.8 (delimiter-based prefix listing), 10.1 (paginated enumeration)_
  - [x] 3.4 Implement async generator `iterateDistrictKeys()`
    - Paginated `getFiles()` with prefix `{prefix}/{snapshotId}/district_`
    - Extract district IDs from object key names via regex
    - Validate extracted district IDs via `validateDistrictId()` before yielding (prevents drift between extraction and validation rules)
    - _Requirements: 1.6 (district listing), 6.3 (district ID validation), 10.3 (paginated district enumeration)_
  - [x] 3.5 Implement write/delete rejection methods
    - `writeSnapshot()`, `writeDistrictData()`, `writeAllDistrictsRankings()`, `deleteSnapshot()` all throw `StorageOperationError` with `retryable: false`, `provider: "gcs"`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [x] 3.6 Write unit tests for read helpers and write rejection
    - Test `readObject` with valid data, invalid JSON (verify non-retryable error, not 404), schema-violating data, 404
    - Test `checkObjectExists` with existing and missing objects; verify 404 does not throw (exists returns false)
    - Test `iterateSnapshotPrefixes` with mocked `apiResponse.prefixes` to verify correct tuple extraction; assert prefixes come from `apiResponse.prefixes`, not from `files` array
    - Test all 4 write/delete methods throw correctly
    - Test path construction for each file type
    - _Requirements: 1.3, 1.4, 1.5, 3.1, 3.2, 3.3, 3.4, 4.1, 4.4_

- [x] 4. Checkpoint - Verify all tests pass
  - Run backend test suite; fix any failures before proceeding to task 5

- [x] 5. Implement snapshot read operations
  - [x] 5.1 Implement `isSnapshotWriteComplete()`
    - Read manifest via `readObject`, check `writeComplete === true`
    - Return false for missing manifest or missing/false flag
    - _Requirements: 9.1, 9.2, 9.3_
  - [x] 5.2 Implement `getSnapshotMetadata()` and `getSnapshotManifest()`
    - Read and validate via `readObject` with appropriate schemas
    - Map `SnapshotMetadataFile` to `PerDistrictSnapshotMetadata` via mapping function
    - _Requirements: 1.4 (getSnapshotManifest), 1.5 (getSnapshotMetadata)_
  - [x] 5.3 Implement `readDistrictData()`
    - Validate snapshotId and districtId
    - Read `district_{id}.json` via `readObject` with `PerDistrictDataSchema`
    - Adapt via `adaptDistrictStatisticsFileToBackend()`
    - _Requirements: 1.3, 6.1, 6.3_
  - [x] 5.4 Implement `readAllDistrictsRankings()` and `hasAllDistrictsRankings()`
    - `readAllDistrictsRankings`: check `isSnapshotWriteComplete` first, return null if false; read rankings file via `readObject`
    - `hasAllDistrictsRankings`: use `checkObjectExists` — `file.exists()` returns boolean, does not throw on missing object
    - _Requirements: 2.1 (rankings read), 2.2 (rankings existence), 2.3 (missing returns null), 2.4 (writeComplete guard)_
  - [x] 5.5 Implement `listDistrictsInSnapshot()`
    - Use `iterateDistrictKeys()` async generator
    - Collect district IDs into array
    - _Requirements: 1.6, 10.3_
  - [x] 5.6 Write unit tests for snapshot read operations
    - Test `isSnapshotWriteComplete` with manifest present/absent, writeComplete true/false/missing
    - Test `readDistrictData` with valid data and 404
    - Test `readAllDistrictsRankings` with writeComplete guard
    - Test `hasAllDistrictsRankings` returns boolean without throwing on missing object
    - Test `listDistrictsInSnapshot` with known district files
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 9.1, 9.2, 9.3_

- [x] 6. Implement complex operations (getLatestSuccessful, getSnapshot, listSnapshots)
  - [x] 6.1 Implement `getSnapshot()` with single-manifest-read optimization
    - Read manifest once, check writeComplete
    - Read metadata, read all district files
    - Re-read manifest to confirm writeComplete still true
    - Assemble Snapshot object
    - _Requirements: 1.2, 9.4_
  - [x] 6.2 Implement `getLatestSuccessful()` and `getLatest()`
    - Collect snapshot prefixes via `iterateSnapshotPrefixes()`, sort reverse lexical
    - `getLatestSuccessful()`: iterate, read metadata, check status === "success", check writeComplete, return first match
    - `getLatest()`: same scan, skip status check, still check writeComplete
    - Confirm `ISnapshotStorage` defines `getLatest()`; if it does not, do not implement
    - _Requirements: 1.1 (latest successful), 9.5 (writeComplete guard on both), 10.4 (lexical ordering)_
  - [x] 6.3 Implement `listSnapshots()` with filtering and limit
    - Collect and sort prefixes reverse-lexical
    - Read metadata for each, apply SnapshotFilters, collect up to limit
    - Do NOT read manifest during listSnapshots; pass `manifest: null` to mapping function (district_count derived from metadata fields)
    - Map to SnapshotMetadata via `mapMetadataFileToSnapshotMetadata(file, null)`
    - _Requirements: 1.7 (list with filters), 10.2 (short-circuit at limit), 10.4 (lexical ordering)_
  - [x] 6.4 Implement `isReady()` readiness check
    - Verify bucket accessibility via prefix listing scoped to Object_Prefix
    - Return false without throwing on any error
    - _Requirements: 8.1, 8.2_
  - [x] 6.5 Write unit tests for complex operations
    - Test `getLatestSuccessful` with mixed statuses and writeComplete flags
    - Test `getLatest` returns most recent writeComplete snapshot regardless of status
    - Test `getSnapshot` assembly with known districts, test writeComplete guard (before and after)
    - Test `listSnapshots` with status filter, date range filter, limit; verify no manifest reads occur
    - Test `isReady` success and failure
    - _Requirements: 1.1, 1.2, 1.7, 8.1, 8.2, 9.4, 9.5, 10.2_

- [x] 7. Checkpoint - Verify all tests pass
  - Run backend test suite; fix any failures before proceeding to task 8

- [x] 8. Integrate with StorageProviderFactory and export
  - [x] 8.1 Update `StorageProviderFactory.createGCPProviders()` to create `GCSSnapshotStorage`
    - Replace `FirestoreSnapshotStorage` creation with `GCSSnapshotStorage`
    - Pass `projectId`, `bucketName`, `prefix: 'snapshots'`
    - _Requirements: 7.1, 7.2_
  - [x] 8.2 Update `backend/src/services/storage/index.ts` exports
    - Export `GCSSnapshotStorage` and `GCSSnapshotStorageConfig`
    - _Requirements: 7.1_
  - [x] 8.3 Write unit tests for StorageProviderFactory GCS integration
    - Test that `STORAGE_PROVIDER=gcp` creates `GCSSnapshotStorage`
    - Test that missing `GCS_BUCKET_NAME` throws `StorageConfigurationError`
    - _Requirements: 7.1, 7.2_

- [x] 9. Final checkpoint - Verify all tests pass
  - Run backend test suite; fix any failures before marking spec complete

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability (annotated where non-obvious)
- Checkpoints are concrete: run tests, fix if red, do not proceed if failing
- Property tests (2.5, 2.6) validate complex input spaces; unit tests cover the rest
- Property test 2.5 uses tiered generators to enforce error classification precedence (statusCode > string code > message)
- The `storage?: Storage` constructor parameter enables test injection without real GCS
- `checkObjectExists()` uses `file.exists()` which returns `[boolean]` — it does not throw on 404, so circuit breaker only sees infra errors
- `listSnapshots()` intentionally does not read manifests (perf); district_count derived from metadata
- No new API endpoints are introduced — this is a storage layer change only
