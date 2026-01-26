# Requirements Document

## Introduction

This specification addresses an incomplete GCP storage migration in the Toast-Stats application. The previous GCP storage migration spec (archived at `.kiro/specs-archive/gcp-storage-migration/`) implemented the storage abstraction layer but left a critical integration gap: the `shared.ts` file in `backend/src/routes/districts/` directly instantiates `FileSnapshotStore` instead of using the `StorageProviderFactory`. This causes the application to ignore the `STORAGE_PROVIDER` environment variable for route-level storage operations, resulting in local filesystem usage even when GCP storage is configured.

Additionally, when cloud storage is empty (no snapshots available), the backend returns 500 errors instead of the expected 503 `NO_SNAPSHOT_AVAILABLE` response, preventing the frontend from displaying the friendly onboarding dialog.

## Glossary

- **Storage_Provider_Factory**: Factory class that creates storage provider instances based on the `STORAGE_PROVIDER` environment variable, returning either local filesystem or GCP cloud storage implementations
- **Snapshot_Store**: Service responsible for persisting and retrieving immutable, time-ordered snapshot data containing district statistics
- **ISnapshotStorage**: Interface defining the contract for snapshot storage operations, implemented by both `LocalSnapshotStorage` and `FirestoreSnapshotStorage`
- **Shared_Module**: The `backend/src/routes/districts/shared.ts` module that provides common utilities and services for district route handlers
- **NO_SNAPSHOT_AVAILABLE**: HTTP 503 error code indicating no data snapshot exists yet, triggering the frontend onboarding dialog
- **FileSnapshotStore**: Local filesystem implementation of snapshot storage using directory-based structure
- **FirestoreSnapshotStorage**: GCP Cloud Firestore implementation of snapshot storage

## Requirements

### Requirement 1: Storage Provider Factory Integration in Routes

**User Story:** As an operator, I want the district routes to respect the `STORAGE_PROVIDER` environment variable, so that I can use GCP cloud storage in production without code changes.

#### Acceptance Criteria

1. WHEN the application starts with `STORAGE_PROVIDER=gcp`, THE Shared_Module SHALL use `FirestoreSnapshotStorage` for all snapshot operations
2. WHEN the application starts with `STORAGE_PROVIDER=local` or unset, THE Shared_Module SHALL use `LocalSnapshotStorage` for all snapshot operations
3. THE Shared_Module SHALL obtain storage providers through `StorageProviderFactory.createFromEnvironment()` instead of directly instantiating `FileSnapshotStore`
4. THE Shared_Module SHALL maintain backward compatibility with existing route handlers that depend on `snapshotStore` and `perDistrictSnapshotStore` exports

### Requirement 2: Graceful Empty Storage Handling

**User Story:** As a user, I want to see a friendly onboarding message when no data is available, so that I understand I need to run a refresh operation.

#### Acceptance Criteria

1. WHEN storage is empty (no snapshots exist), THE System SHALL return HTTP 503 with error code `NO_SNAPSHOT_AVAILABLE`
2. WHEN storage is empty, THE System SHALL NOT return HTTP 500 internal server errors
3. WHEN `getLatestSuccessful()` is called on empty storage, THE Storage_Provider SHALL return `null` instead of throwing an error
4. WHEN the snapshots directory does not exist, THE FileSnapshotStore SHALL handle this gracefully and return `null` from `getLatestSuccessful()`

### Requirement 3: FileSnapshotStore Directory Handling

**User Story:** As a developer, I want the FileSnapshotStore to handle missing directories gracefully, so that the application works correctly on fresh deployments.

#### Acceptance Criteria

1. WHEN the snapshots directory does not exist, THE `findLatestSuccessfulByScanning()` method SHALL return `null` instead of throwing an error
2. WHEN the snapshots directory is empty, THE `findLatestSuccessfulByScanning()` method SHALL return `null`
3. WHEN a directory read operation fails with `ENOENT`, THE FileSnapshotStore SHALL log a debug message and return `null`
4. THE FileSnapshotStore SHALL NOT require manual directory creation before first use

### Requirement 4: Service Initialization Consistency

**User Story:** As a developer, I want consistent storage provider usage across all service initialization paths, so that the application behaves predictably.

#### Acceptance Criteria

1. THE Shared_Module service initialization SHALL use the same storage provider instance for all dependent services
2. WHEN `RefreshService` is initialized in Shared_Module, THE System SHALL pass the storage provider from `StorageProviderFactory`
3. WHEN `BackfillService` is initialized in Shared_Module, THE System SHALL pass the storage provider from `StorageProviderFactory`
4. WHEN `DistrictDataAggregator` is created, THE System SHALL use the storage provider from `StorageProviderFactory`

### Requirement 5: Documentation Updates

**User Story:** As an operator, I want accurate documentation about storage configuration, so that I can correctly deploy and troubleshoot the application.

#### Acceptance Criteria

1. THE `backend/docs/storage-migration-guide.md` SHALL document that all route handlers now respect `STORAGE_PROVIDER`
2. THE `DEPLOYMENT.md` SHALL include verification steps for confirming storage provider selection
3. THE documentation SHALL note that the previous incomplete migration has been resolved
4. THE documentation SHALL include troubleshooting steps for empty storage scenarios

### Requirement 6: Error Response Consistency

**User Story:** As a frontend developer, I want consistent error responses from the API, so that I can handle all error cases appropriately.

#### Acceptance Criteria

1. WHEN no snapshot is available, ALL district route handlers SHALL return the same `NO_SNAPSHOT_AVAILABLE` error structure
2. THE error response SHALL include `code`, `message`, and `details` fields
3. THE `details` field SHALL instruct the user to run a refresh operation
4. THE HTTP status code SHALL be 503 (Service Unavailable) for missing snapshot scenarios
