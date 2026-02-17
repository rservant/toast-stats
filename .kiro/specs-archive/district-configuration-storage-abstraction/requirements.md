# Requirements Document

## Introduction

This document specifies the requirements for abstracting district configuration storage to support both local filesystem and GCP cloud storage backends. Currently, the `DistrictConfigurationService` stores configuration in local files (`cache/config/districts.json`), which doesn't persist across Cloud Run container restarts. This feature extends the existing storage abstraction pattern to include district configuration, enabling persistent configuration in Firestore when `STORAGE_PROVIDER=gcp`.

## Glossary

- **District_Configuration_Service**: The service responsible for managing the list of districts to collect data for during snapshot operations
- **Storage_Provider_Factory**: The factory that creates storage provider instances based on environment configuration
- **IDistrictConfigStorage**: The interface defining the contract for district configuration storage operations
- **Local_District_Config_Storage**: The local filesystem implementation of district configuration storage
- **Firestore_District_Config_Storage**: The Firestore implementation of district configuration storage
- **Configuration_Change**: A record of a modification to the district configuration for audit purposes
- **District_Configuration**: The data structure containing configured districts, timestamps, and version information

## Requirements

### Requirement 1: Storage Interface Definition

**User Story:** As a developer, I want a storage interface for district configuration, so that I can swap between local and cloud storage implementations without changing business logic.

#### Acceptance Criteria

1. THE IDistrictConfigStorage interface SHALL define methods for reading and writing district configuration
2. THE IDistrictConfigStorage interface SHALL define methods for reading and writing configuration change history
3. THE IDistrictConfigStorage interface SHALL define a method for checking storage readiness
4. THE IDistrictConfigStorage interface SHALL mirror the existing storage abstraction pattern used by ISnapshotStorage and IRawCSVStorage

### Requirement 2: Local Filesystem Implementation

**User Story:** As a developer, I want a local filesystem implementation of district configuration storage, so that I can develop and test without cloud dependencies.

#### Acceptance Criteria

1. WHEN STORAGE_PROVIDER is 'local' or unset, THE Local_District_Config_Storage SHALL store configuration in `cache/config/districts.json`
2. WHEN STORAGE_PROVIDER is 'local' or unset, THE Local_District_Config_Storage SHALL store audit logs in `cache/config/district-changes.log`
3. THE Local_District_Config_Storage SHALL perform atomic file writes using temporary files and rename operations
4. THE Local_District_Config_Storage SHALL create necessary directories if they do not exist
5. THE Local_District_Config_Storage SHALL maintain backward compatibility with existing configuration files

### Requirement 3: Firestore Implementation

**User Story:** As a developer, I want a Firestore implementation of district configuration storage, so that configuration persists across Cloud Run container restarts.

#### Acceptance Criteria

1. WHEN STORAGE_PROVIDER is 'gcp', THE Firestore_District_Config_Storage SHALL store configuration in a Firestore document at `config/districts`
2. WHEN STORAGE_PROVIDER is 'gcp', THE Firestore_District_Config_Storage SHALL store configuration change history in a subcollection `config/districts/history`
3. THE Firestore_District_Config_Storage SHALL use the same GCP_PROJECT_ID as other GCP storage providers
4. THE Firestore_District_Config_Storage SHALL integrate with the existing CircuitBreaker pattern for resilience
5. IF a Firestore operation fails due to a transient error, THEN THE Firestore_District_Config_Storage SHALL indicate the error is retryable

### Requirement 4: Storage Provider Factory Integration

**User Story:** As a developer, I want the StorageProviderFactory to create district configuration storage, so that storage selection is consistent across all storage types.

#### Acceptance Criteria

1. THE Storage_Provider_Factory SHALL create IDistrictConfigStorage instances based on STORAGE_PROVIDER environment variable
2. WHEN STORAGE_PROVIDER is 'gcp', THE Storage_Provider_Factory SHALL create Firestore_District_Config_Storage
3. WHEN STORAGE_PROVIDER is 'local' or unset, THE Storage_Provider_Factory SHALL create Local_District_Config_Storage
4. THE Storage_Provider_Factory SHALL return district configuration storage alongside snapshot and CSV storage

### Requirement 5: Service Refactoring

**User Story:** As a developer, I want the DistrictConfigurationService to use the storage abstraction, so that it works with both local and cloud storage.

#### Acceptance Criteria

1. THE District_Configuration_Service SHALL accept an IDistrictConfigStorage instance via constructor injection
2. THE District_Configuration_Service SHALL delegate all storage operations to the injected storage implementation
3. THE District_Configuration_Service SHALL maintain all existing public API methods without breaking changes
4. THE District_Configuration_Service SHALL preserve all existing validation and normalization logic

### Requirement 6: Route Integration

**User Story:** As a developer, I want the admin routes to use the storage-abstracted DistrictConfigurationService, so that configuration changes persist in the correct backend.

#### Acceptance Criteria

1. WHEN creating DistrictConfigurationService instances in routes, THE routes SHALL obtain storage from StorageProviderFactory
2. THE admin district configuration routes SHALL continue to function without API changes
3. THE shared district routes SHALL use the storage-abstracted DistrictConfigurationService

### Requirement 7: Error Handling

**User Story:** As a developer, I want consistent error handling for district configuration storage, so that failures are properly reported and logged.

#### Acceptance Criteria

1. IF a storage operation fails, THEN THE storage implementation SHALL throw a StorageOperationError with appropriate context
2. THE storage implementations SHALL log all operations with consistent structured logging
3. IF the storage is not ready, THEN THE isReady method SHALL return false without throwing

### Requirement 8: Configuration Migration

**User Story:** As an operator, I want existing local configuration to be preserved when switching storage providers, so that I don't lose my district configuration.

#### Acceptance Criteria

1. WHEN switching from local to GCP storage, THE system SHALL NOT automatically migrate existing configuration
2. THE system SHALL document the manual process for migrating configuration between storage backends
3. IF no configuration exists in the selected storage backend, THEN THE system SHALL return an empty configuration
