# Implementation Tasks: GCP Storage Migration

## Overview

This task list implements the migration of Toast-Stats backend storage from local filesystem to Google Cloud Platform services, with a storage abstraction layer enabling swappable implementations.

## Task Dependency Graph

```
1 (Interfaces) → 2 (Local Providers) → 3 (GCP Providers) → 4 (Factory) → 5 (Integration) → 6 (Testing)
```

---

## Task 1: Define Storage Provider Interfaces

Create the storage abstraction layer interfaces that define contracts for snapshot and CSV storage operations.

Validates: Requirements 1.1, 1.2, 6.1, 6.2, 6.3

- [ ] 1.1 Create `ISnapshotStorage` interface in `backend/src/types/storageInterfaces.ts`
  - Define all methods from design: `getLatestSuccessful`, `getLatest`, `writeSnapshot`, `listSnapshots`, `getSnapshot`, `isReady`
  - Include per-district operations: `writeDistrictData`, `readDistrictData`, `listDistrictsInSnapshot`, `getSnapshotManifest`, `getSnapshotMetadata`
  - Include rankings operations: `writeAllDistrictsRankings`, `readAllDistrictsRankings`, `hasAllDistrictsRankings`
  - Use existing types: `Snapshot`, `SnapshotMetadata`, `DistrictStatistics`, `AllDistrictsRankingsData`

- [ ] 1.2 Create `IRawCSVStorage` interface in `backend/src/types/storageInterfaces.ts`
  - Define core cache operations: `getCachedCSV`, `setCachedCSV`, `setCachedCSVWithMetadata`, `hasCachedCSV`
  - Include metadata management: `getCacheMetadata`, `updateCacheMetadata`
  - Include cache management: `clearCacheForDate`, `getCachedDates`
  - Include health/statistics: `getCacheStorageInfo`, `getCacheStatistics`, `getHealthStatus`
  - Use existing types: `CSVType`, `RawCSVCacheMetadata`, `RawCSVCacheStatistics`, `CacheHealthStatus`

- [ ] 1.3 Create `StorageConfig` type and `StorageError` classes in `backend/src/types/storageInterfaces.ts`
  - Define `StorageConfig` with `provider: 'local' | 'gcp'` and provider-specific config
  - Create `StorageError` base class with operation, provider, and cause
  - Create `StorageConfigurationError` for missing config
  - Create `StorageOperationError` with retryable flag

---

## Task 2: Implement Local Filesystem Providers

Wrap existing implementations to conform to the new storage interfaces.

Validates: Requirements 4.1, 4.2, 4.3, 4.4

- [ ] 2.1 Create `LocalSnapshotStorage` class in `backend/src/services/storage/LocalSnapshotStorage.ts`
  - Implement `ISnapshotStorage` interface
  - Delegate to existing `FileSnapshotStore` implementation
  - Accept `cacheDir` in constructor config
  - Ensure all methods pass through to underlying store

- [ ] 2.2 Create `LocalRawCSVStorage` class in `backend/src/services/storage/LocalRawCSVStorage.ts`
  - Implement `IRawCSVStorage` interface
  - Delegate to existing `RawCSVCacheService` implementation
  - Accept `ICacheConfigService` and `ILogger` in constructor
  - Ensure all methods pass through to underlying service

- [ ] 2.3 Write unit tests for local providers in `backend/src/services/storage/__tests__/`
  - Test `LocalSnapshotStorage` delegation to `FileSnapshotStore`
  - Test `LocalRawCSVStorage` delegation to `RawCSVCacheService`
  - Verify interface compliance with isolated test directories
  - Ensure tests are concurrent-safe per testing steering document

---

## Task 3: Implement GCP Cloud Providers

Create Cloud Firestore and Cloud Storage implementations.

Validates: Requirements 2.1-2.6, 3.1-3.6, 7.1-7.4

- [ ] 3.1 Add GCP dependencies to `backend/package.json`
  - Add `@google-cloud/firestore: ^7.x`
  - Add `@google-cloud/storage: ^7.x`
  - Run `npm install` to update lock file

- [ ] 3.2 Create `FirestoreSnapshotStorage` class in `backend/src/services/storage/FirestoreSnapshotStorage.ts`
  - Implement `ISnapshotStorage` interface
  - Use ISO date (YYYY-MM-DD) as Firestore document ID
  - Store snapshot metadata and manifest in root document
  - Store district data in `districts` subcollection
  - Store rankings data embedded in root document (if present)
  - Implement circuit breaker integration using existing `CircuitBreaker` utility
  - Include proper error handling with `StorageOperationError`

- [ ] 3.3 Create `GCSRawCSVStorage` class in `backend/src/services/storage/GCSRawCSVStorage.ts`
  - Implement `IRawCSVStorage` interface
  - Use path convention: `raw-csv/{date}/[district-{id}/]{type}.csv`
  - Store metadata as JSON objects alongside CSV files
  - Implement circuit breaker integration
  - Include proper error handling with `StorageOperationError`

- [ ] 3.4 Write unit tests for GCP providers with mocked clients
  - Test `FirestoreSnapshotStorage` operations with mocked Firestore client
  - Test `GCSRawCSVStorage` operations with mocked Storage client
  - Verify error handling and circuit breaker behavior
  - Test document ID format (ISO date) compliance

---

## Task 4: Implement Storage Provider Factory

Create the factory for environment-based provider selection.

Validates: Requirements 5.1-5.7, 1.3

- [ ] 4.1 Create `StorageProviderFactory` class in `backend/src/services/storage/StorageProviderFactory.ts`
  - Implement `createFromEnvironment()` static method
  - Read `STORAGE_PROVIDER` env var (default to 'local')
  - Read `GCP_PROJECT_ID` and `GCS_BUCKET_NAME` for GCP provider
  - Throw `StorageConfigurationError` if GCP config is missing when GCP provider selected
  - Implement `create(config: StorageConfig)` for explicit configuration
  - Return `{ snapshotStorage: ISnapshotStorage, rawCSVStorage: IRawCSVStorage }`

- [ ] 4.2 Write unit tests for `StorageProviderFactory`
  - Test local provider creation with default config
  - Test local provider creation with explicit config
  - Test GCP provider creation with valid config
  - Test fail-fast behavior when GCP config is missing
  - Test environment variable reading

---

## Task 5: Integrate Storage Abstraction with Application

Wire the storage abstraction into the existing application architecture.

Validates: Requirements 1.3, 1.4

- [ ] 5.1 Update `ServiceContainer` to use storage abstraction
  - Register `ISnapshotStorage` and `IRawCSVStorage` tokens
  - Use `StorageProviderFactory.createFromEnvironment()` for provider creation
  - Update existing service registrations to use new interfaces
  - Maintain backward compatibility with existing code

- [ ] 5.2 Update `RefreshService` to use `ISnapshotStorage` interface
  - Replace direct `FileSnapshotStore` usage with injected `ISnapshotStorage`
  - Ensure all snapshot operations go through the interface
  - Update constructor to accept `ISnapshotStorage`

- [ ] 5.3 Update `SnapshotBuilder` to use `IRawCSVStorage` interface
  - Replace direct `RawCSVCacheService` usage with injected `IRawCSVStorage`
  - Ensure all CSV cache operations go through the interface
  - Update constructor to accept `IRawCSVStorage`

- [ ] 5.4 Update API routes to use storage interfaces
  - Ensure routes resolve storage services from container
  - Verify all data access goes through abstraction layer

---

## Task 6: Property-Based Testing

Implement property-based tests for critical storage invariants.

Validates: Requirements 8.1-8.5, Design Properties 1-4

- [ ] 6.1 Create snapshot round-trip property test (Property 1)
  - File: `backend/src/services/storage/__tests__/snapshot-roundtrip.property.test.ts`
  - Generate complex Snapshot objects with varying metadata, district counts, field combinations
  - Verify write then read produces equivalent Snapshot
  - Run against both LocalSnapshotStorage and FirestoreSnapshotStorage (with emulator)
  - Use fast-check with minimum 100 iterations
  - **Validates: Requirements 2.1, 2.2**

- [ ] 6.2 Create CSV content round-trip property test (Property 2)
  - File: `backend/src/services/storage/__tests__/csv-roundtrip.property.test.ts`
  - Generate CSV strings with special characters, unicode, varying lengths
  - Verify setCachedCSV then getCachedCSV returns identical content
  - Run against both LocalRawCSVStorage and GCSRawCSVStorage (with emulator)
  - Use fast-check with minimum 100 iterations
  - **Validates: Requirements 3.1, 3.2**

- [ ] 6.3 Create latest successful snapshot ordering property test (Property 3)
  - File: `backend/src/services/storage/__tests__/snapshot-ordering.property.test.ts`
  - Generate sets of snapshots with varying dates and statuses
  - Verify getLatestSuccessful returns most recent successful snapshot
  - Test edge cases: no snapshots, no successful snapshots, all successful
  - Use fast-check with minimum 100 iterations
  - **Validates: Requirements 2.3, 2.4**

- [ ] 6.4 Create provider contract equivalence property test (Property 4)
  - File: `backend/src/services/storage/__tests__/provider-equivalence.property.test.ts`
  - Generate operation sequences (write, read, list, delete)
  - Verify LocalSnapshotStorage and FirestoreSnapshotStorage produce identical results
  - Verify LocalRawCSVStorage and GCSRawCSVStorage produce identical results
  - Use fast-check with minimum 100 iterations
  - **Validates: Requirements 4.4, 1.1, 1.2**

---

## Task 7: Integration Testing with GCP Emulators

Set up and run integration tests using GCP emulators.

Validates: Requirements 8.2, 8.3, 8.4

- [ ] 7.1 Create emulator setup documentation and scripts
  - Document Firestore emulator setup: `firebase emulators:start --only firestore`
  - Document GCS emulator setup: `fake-gcs-server` or similar
  - Create npm scripts for starting emulators
  - Add emulator configuration to test setup

- [ ] 7.2 Create contract test suite for storage providers
  - File: `backend/src/services/storage/__tests__/storage-contract.test.ts`
  - Use `describe.each` to run same tests against all provider implementations
  - Test all interface methods for contract compliance
  - Verify error handling consistency across providers

- [ ]* 7.3 Create end-to-end integration test with emulators
  - Test full refresh flow with GCP providers
  - Verify data persistence and retrieval
  - Test error recovery scenarios

---

## Task 8: Documentation and Configuration

Finalize documentation and deployment configuration.

Validates: Requirements 5.5, 5.6, 5.7

- [ ] 8.1 Update environment configuration documentation
  - Document `STORAGE_PROVIDER` environment variable
  - Document `GCP_PROJECT_ID` and `GCS_BUCKET_NAME` for GCP mode
  - Update `.env.example` files with new variables
  - Document authentication requirements for GCP

- [ ] 8.2 Update deployment documentation
  - Document Cloud Run deployment with GCP storage
  - Document Firestore index requirements (if any)
  - Document GCS bucket configuration recommendations
  - Update `DEPLOYMENT.md` with storage migration notes

- [ ]* 8.3 Create migration guide
  - Document steps to migrate from local to GCP storage
  - Note that backward compatibility with existing local data is not required
  - Provide rollback procedures

---

## Notes

- Tasks marked with `*` are optional enhancements
- All tests must follow the testing steering document requirements for isolation and concurrency safety
- Property-based tests use fast-check library already installed in the project
- GCP emulator tests may be skipped in CI if emulators are not available
