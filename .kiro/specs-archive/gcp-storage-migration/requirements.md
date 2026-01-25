# Requirements Document

## Introduction

This specification defines the migration of Toast-Stats backend storage from local filesystem to Google Cloud Platform (GCP) services. The migration targets Cloud Firestore for structured snapshot data and Cloud Storage (GCS) for raw CSV file storage. The system must support both cloud operation in GCP and local development without requiring GCP credentials or emulators.

## Glossary

- **Snapshot_Store**: Service responsible for persisting and retrieving immutable, time-ordered snapshot data containing district statistics
- **Raw_CSV_Cache**: Service responsible for caching raw CSV files downloaded from the Toastmasters dashboard
- **Cloud_Firestore**: GCP's serverless NoSQL document database for storing structured JSON data
- **Cloud_Storage**: GCP's object storage service (GCS) for storing blob data like CSV files
- **Storage_Provider**: Abstraction layer that defines the contract for storage operations, enabling swappable implementations
- **Local_Provider**: Storage implementation using the local filesystem for development environments
- **Cloud_Provider**: Storage implementation using GCP services (Firestore + GCS) for production
- **Environment_Configuration**: System for selecting storage provider based on runtime environment

## Requirements

### Requirement 1: Storage Abstraction Layer

**User Story:** As a developer, I want a storage abstraction layer, so that I can swap between local and cloud storage implementations without changing business logic.

#### Acceptance Criteria

1. THE Storage_Provider interface SHALL define contracts for snapshot storage operations matching the existing `SnapshotStore` interface
2. THE Storage_Provider interface SHALL define contracts for raw CSV cache operations matching the existing `IRawCSVCacheService` interface
3. WHEN business logic calls storage operations, THE System SHALL route to the configured provider implementation
4. THE System SHALL support dependency injection of storage providers for testability

### Requirement 2: Cloud Firestore Snapshot Storage

**User Story:** As an operator, I want snapshots stored in Cloud Firestore, so that I can leverage GCP's managed database for reliable, scalable storage.

#### Acceptance Criteria

1. WHEN a snapshot is written, THE Firestore_Provider SHALL store the snapshot metadata as a Firestore document
2. WHEN a snapshot is written, THE Firestore_Provider SHALL store individual district data as sub-documents or separate documents
3. WHEN reading the latest successful snapshot, THE Firestore_Provider SHALL query Firestore for the most recent successful snapshot by date
4. THE Firestore_Provider SHALL preserve the existing snapshot semantics: immutable, time-ordered, with current/historical distinction
5. WHEN storing all-districts rankings, THE Firestore_Provider SHALL store rankings data alongside the snapshot
6. THE Firestore_Provider SHALL use ISO date format (YYYY-MM-DD) as the document ID for snapshots

### Requirement 3: Cloud Storage Raw CSV Cache

**User Story:** As an operator, I want raw CSV files stored in Cloud Storage, so that I can leverage GCP's object storage for blob data.

#### Acceptance Criteria

1. WHEN a CSV file is cached, THE GCS_Provider SHALL store the file as an object in a Cloud Storage bucket
2. WHEN retrieving a cached CSV, THE GCS_Provider SHALL return the object content from Cloud Storage
3. THE GCS_Provider SHALL organize objects using the existing path convention: `raw-csv/{date}/[district-{id}/]{type}.csv`
4. WHEN checking if a CSV exists, THE GCS_Provider SHALL check object existence in Cloud Storage
5. THE GCS_Provider SHALL store and retrieve cache metadata as JSON objects alongside CSV files
6. THE GCS_Provider SHALL preserve existing cache semantics including metadata integrity validation

### Requirement 4: Local Filesystem Storage for Development

**User Story:** As a developer, I want local filesystem storage for development, so that I can develop and test without GCP credentials or emulators.

#### Acceptance Criteria

1. THE Local_Provider SHALL implement the same Storage_Provider interface as cloud providers
2. WHEN running in local mode, THE System SHALL use filesystem-based storage identical to current implementation
3. THE Local_Provider SHALL NOT require any GCP credentials or network connectivity
4. THE Local_Provider SHALL maintain full feature parity with cloud providers for testing purposes

### Requirement 5: Environment-Based Configuration

**User Story:** As an operator, I want environment-based configuration, so that I can switch between local and cloud storage based on deployment context.

#### Acceptance Criteria

1. THE System SHALL read a `STORAGE_PROVIDER` environment variable to determine which provider to use
2. WHEN `STORAGE_PROVIDER` is set to `local`, THE System SHALL use the Local_Provider
3. WHEN `STORAGE_PROVIDER` is set to `gcp`, THE System SHALL use the Cloud_Provider (Firestore + GCS)
4. WHEN `STORAGE_PROVIDER` is not set, THE System SHALL default to `local` for development safety
5. WHEN using GCP provider, THE System SHALL read `GCP_PROJECT_ID` for the GCP project identifier
6. WHEN using GCP provider, THE System SHALL read `GCS_BUCKET_NAME` for the Cloud Storage bucket name
7. IF required GCP configuration is missing when GCP provider is selected, THEN THE System SHALL fail fast with a clear error message

### Requirement 6: Data Model Compatibility

**User Story:** As a developer, I want the new storage to use the same data models, so that existing code continues to work without modification.

#### Acceptance Criteria

1. THE Storage_Provider implementations SHALL accept and return the same TypeScript types as current implementations
2. THE Snapshot type, SnapshotMetadata type, and DistrictStatistics type SHALL remain unchanged
3. THE RawCSVCacheMetadata type and related types SHALL remain unchanged
4. WHEN migrating, THE System SHALL NOT require backward compatibility with existing local data

### Requirement 7: Error Handling and Resilience

**User Story:** As an operator, I want robust error handling, so that storage failures are handled gracefully and logged appropriately.

#### Acceptance Criteria

1. WHEN a Firestore operation fails, THE System SHALL throw a typed error with operation context
2. WHEN a Cloud Storage operation fails, THE System SHALL throw a typed error with operation context
3. THE System SHALL log all storage operations with appropriate detail for debugging
4. THE Cloud_Provider SHALL implement circuit breaker patterns consistent with existing RawCSVCacheService

### Requirement 8: Testing Strategy

**User Story:** As a developer, I want comprehensive testing, so that I can verify both local and cloud implementations work correctly.

#### Acceptance Criteria

1. THE Local_Provider SHALL be testable with isolated filesystem directories
2. THE Cloud_Provider SHALL be testable using GCP emulators (Firestore emulator, fake-gcs-server)
3. WHEN running unit tests, THE System SHALL use mock providers or local providers
4. THE System SHALL include integration tests that verify provider contract compliance
5. ALL tests SHALL be isolated and concurrent-safe per the testing steering document
