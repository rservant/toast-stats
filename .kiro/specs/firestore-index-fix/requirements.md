# Requirements Document

## Introduction

This feature addresses critical production issues caused by missing Firestore composite indexes. The `listSnapshots` operation in `FirestoreSnapshotStorage.ts` fails with `FAILED_PRECONDITION` errors because required indexes do not exist. This cascades to break the date selector, program year selector, and all district-related API endpoints. The feature will create the required indexes, add graceful degradation in the backend, and improve frontend error handling.

## Glossary

- **Firestore_Index**: A composite index in Google Cloud Firestore that enables efficient queries combining multiple fields or ordering operations
- **Snapshot_Storage**: The backend service (`FirestoreSnapshotStorage`) responsible for storing and retrieving district statistics snapshots
- **Date_Selector**: The frontend component that allows users to select a date for viewing historical data
- **Program_Year_Selector**: The frontend component that allows users to select a Toastmasters program year (July-June)
- **Graceful_Degradation**: The ability of a system to continue operating with reduced functionality when a component fails
- **Index_Health_Check**: A validation operation that verifies required Firestore indexes are available and functional

## Requirements

### Requirement 1: Create Required Firestore Composite Indexes

**User Story:** As a system operator, I want the required Firestore composite indexes to be defined and deployed, so that snapshot listing queries execute successfully.

#### Acceptance Criteria

1. THE Index_Configuration SHALL define a composite index for the `snapshots` collection with `__name__` field in descending order
2. THE Index_Configuration SHALL define a composite index for the `snapshots` collection combining `metadata.status` equality filter with `__name__` descending order
3. THE Index_Configuration SHALL define a composite index for the `config/districts/history` subcollection with `timestamp` field in descending order
4. WHEN the indexes are deployed THEN THE Firestore_Index queries in `listSnapshots`, `getLatestSuccessful`, `getLatest`, and `getChangeHistory` SHALL execute without `FAILED_PRECONDITION` errors
5. THE Index_Configuration SHALL be stored in a `firestore.indexes.json` file following Firebase CLI conventions
6. THE Firebase_Configuration SHALL reference the Firestore indexes file for deployment

### Requirement 2: Backend Graceful Degradation for Snapshot Listing

**User Story:** As a system operator, I want the backend to gracefully handle Firestore index failures, so that the application provides useful feedback instead of generic 500 errors.

#### Acceptance Criteria

1. WHEN the `listSnapshots` operation fails due to a missing index THEN THE Snapshot_Storage SHALL return an empty array with a logged warning instead of throwing an exception
2. WHEN the `getLatestSuccessful` operation fails due to a missing index THEN THE Snapshot_Storage SHALL return null with a logged warning instead of throwing an exception
3. WHEN the `getLatest` operation fails due to a missing index THEN THE Snapshot_Storage SHALL return null with a logged warning instead of throwing an exception
4. WHEN the `getChangeHistory` operation fails due to a missing index THEN THE District_Config_Storage SHALL return an empty array with a logged warning instead of throwing an exception
5. IF a Firestore query fails with `FAILED_PRECONDITION` error code THEN THE Storage_Service SHALL classify this as a non-retryable configuration error
6. THE Storage_Service SHALL log the index creation URL from the error message to assist operators in resolving the issue

### Requirement 3: Frontend Error Handling for Date Selector

**User Story:** As a user, I want the date selector to display a helpful message when data is unavailable, so that I understand the system state and can take appropriate action.

#### Acceptance Criteria

1. WHEN the available dates API returns an error THEN THE Date_Selector SHALL display an error state with a user-friendly message
2. WHEN the available dates API returns an empty array THEN THE Date_Selector SHALL display a message indicating no dates are available
3. WHEN the Date_Selector is in an error state THEN THE Date_Selector SHALL provide a retry button to attempt fetching dates again
4. THE Date_Selector SHALL NOT display a loading spinner indefinitely when the API fails
5. WHEN the Date_Selector encounters an error THEN THE Date_Selector SHALL log the error details for debugging purposes

### Requirement 4: Frontend Error Handling for Program Year Selector

**User Story:** As a user, I want the program year selector to handle API failures gracefully, so that I can still use the application with reduced functionality.

#### Acceptance Criteria

1. WHEN the available program years API returns an error THEN THE Program_Year_Selector hook SHALL return an error state with the error details
2. WHEN the available program years API returns an empty array THEN THE Program_Year_Selector component SHALL display a message indicating no program years are available
3. WHEN the Program_Year_Selector is in an error state THEN THE consuming component SHALL display a user-friendly error message
4. THE Program_Year_Selector hook SHALL expose a refetch function for retry attempts
5. THE Program_Year_Selector hook SHALL NOT retry indefinitely on persistent failures

### Requirement 5: Index Health Check and Validation

**User Story:** As a system operator, I want to validate that required Firestore indexes are available, so that I can proactively identify configuration issues before they affect users.

#### Acceptance Criteria

1. THE Snapshot_Storage SHALL provide an `isIndexHealthy` method that validates index availability
2. WHEN the `isIndexHealthy` method is called THEN THE Snapshot_Storage SHALL execute a minimal query that requires the composite index
3. IF the health check query fails with `FAILED_PRECONDITION` THEN THE `isIndexHealthy` method SHALL return false with diagnostic information
4. IF the health check query succeeds THEN THE `isIndexHealthy` method SHALL return true
5. THE Health_Check_Response SHALL include the index creation URL when indexes are missing
6. THE existing `isReady` method SHALL incorporate index health validation

### Requirement 6: Documentation of Required Indexes

**User Story:** As a developer, I want clear documentation of all required Firestore indexes, so that I can understand and maintain the index configuration.

#### Acceptance Criteria

1. THE Index_Documentation SHALL list all required composite indexes with their field configurations
2. THE Index_Documentation SHALL explain the purpose of each index and which queries require it
3. THE Index_Documentation SHALL include instructions for deploying indexes using Firebase CLI
4. THE Index_Documentation SHALL include troubleshooting guidance for index-related errors
5. THE Index_Documentation SHALL be located in the project documentation directory
