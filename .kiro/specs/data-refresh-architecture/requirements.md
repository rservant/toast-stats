# Requirements Document

## Introduction

The Data Refresh Architecture feature addresses the current coupling between data scraping/refresh operations and normal API read requests. Currently, API endpoints may trigger expensive scraping operations, leading to slow response times and potential timeouts. This enhancement decouples these concerns by implementing a snapshot-based architecture where refresh operations are explicit and separate from read operations.

## Glossary

- **Snapshot**: An immutable, time-specific representation of normalized application data and its derived results
- **Current_Snapshot**: The most recent successful snapshot that represents the latest available data
- **Historical_Snapshot**: Any snapshot other than the current snapshot
- **Refresh_Operation**: The process that creates a new snapshot from source data through scraping and normalization
- **Read_Operation**: Retrieval of data from an existing snapshot without triggering refresh activity
- **Snapshot_Store**: The abstraction layer that manages snapshot persistence and retrieval
- **Last_Known_Good**: The most recent successful snapshot, used when newer refresh attempts fail
- **Schema_Version**: The structural definition of the normalized data contained in a snapshot
- **Calculation_Version**: The specific set of computation or scoring rules applied to a snapshot

## Requirements

### Requirement 1

**User Story:** As an API consumer, I want consistent and fast response times from read endpoints, so that the application remains responsive regardless of data refresh status.

#### Acceptance Criteria

1. WHEN making requests to read endpoints THEN the system SHALL NOT trigger scraping or refresh operations
2. WHEN read endpoints are called THEN the system SHALL respond with data from the most recent successful snapshot
3. WHEN multiple concurrent read requests are made THEN the system SHALL serve all requests from cached snapshots without performance degradation
4. WHEN the system is serving read requests THEN response times SHALL be independent of scraping performance or availability
5. WHEN read operations are performed THEN the system SHALL maintain sub-second response times for typical data queries

### Requirement 2

**User Story:** As a system administrator, I want explicit control over when data refresh operations occur, so that I can manage system resources and schedule updates appropriately.

#### Acceptance Criteria

1. WHEN triggering a refresh operation THEN the system SHALL require explicit authentication via ADMIN_TOKEN
2. WHEN a refresh is initiated THEN the system SHALL execute scraping and normalization as a separate process from read operations
3. WHEN refresh operations are running THEN the system SHALL continue serving read requests from existing snapshots
4. WHEN a refresh completes successfully THEN the system SHALL create a new snapshot with status "success"
5. WHEN a refresh fails THEN the system SHALL create a snapshot with status "failed" but NOT update the current successful snapshot pointer
6. WHEN refresh operations are scheduled THEN the system SHALL support both HTTP endpoint and CLI script execution

### Requirement 3

**User Story:** As a data consumer, I want to know the freshness and reliability of the data I'm viewing, so that I can make informed decisions based on data quality indicators.

#### Acceptance Criteria

1. WHEN viewing data THEN the system SHALL display the snapshot creation timestamp (e.g., "Data as of Nov 11, 2025")
2. WHEN no successful snapshot exists THEN the system SHALL return HTTP 503 with a clear message "No data snapshot available yet"
3. WHEN displaying snapshot metadata THEN the system SHALL include schema version and calculation version information
4. WHEN a snapshot has status "failed" THEN the system SHALL NOT serve this data to read endpoints
5. WHEN multiple snapshots exist THEN the system SHALL always serve data from the most recent successful snapshot

### Requirement 4

**User Story:** As a system operator, I want robust error handling and recovery mechanisms, so that temporary failures don't compromise data availability.

#### Acceptance Criteria

1. WHEN a refresh operation fails THEN the system SHALL continue serving the previous successful snapshot unchanged
2. WHEN scraping encounters errors THEN the system SHALL log detailed error information in the failed snapshot
3. WHEN validation fails during refresh THEN the system SHALL treat this as a refresh failure and preserve the current successful snapshot
4. WHEN the snapshot store is corrupted THEN the system SHALL provide clear error messages and recovery guidance
5. WHEN network issues prevent scraping THEN the system SHALL retry with appropriate backoff strategies

### Requirement 5

**User Story:** As a developer, I want a clean abstraction for snapshot management, so that the system can evolve storage mechanisms without affecting business logic.

#### Acceptance Criteria

1. WHEN implementing snapshot storage THEN the system SHALL provide a SnapshotStore interface with standard operations
2. WHEN storing snapshots THEN the system SHALL persist them atomically to prevent partial writes
3. WHEN retrieving snapshots THEN the system SHALL support both "latest successful" and "latest regardless of status" queries
4. WHEN managing snapshots THEN the system SHALL maintain a pointer file to the current successful snapshot
5. WHEN listing snapshots THEN the system SHALL support filtering and limiting for debugging purposes

### Requirement 6

**User Story:** As a system maintainer, I want comprehensive validation and monitoring of snapshot operations, so that data quality issues are detected early.

#### Acceptance Criteria

1. WHEN creating a snapshot THEN the system SHALL validate the normalized payload against a defined schema
2. WHEN validation detects missing required fields THEN the system SHALL reject the snapshot and maintain the current pointer
3. WHEN refresh operations start and complete THEN the system SHALL log timing, status, and error information
4. WHEN snapshots are created THEN the system SHALL include unique snapshot IDs in all log entries
5. WHEN monitoring snapshot operations THEN the system SHALL provide metrics on refresh success rates and durations

### Requirement 7

**User Story:** As a frontend developer, I want clear API contracts for data freshness, so that I can build appropriate user interfaces for data status.

#### Acceptance Criteria

1. WHEN the frontend requests data freshness information THEN the API SHALL provide snapshot metadata including creation timestamp
2. WHEN no snapshot is available THEN the API SHALL return structured error responses that the frontend can handle gracefully
3. WHEN displaying data status THEN the frontend SHALL show user-friendly messages like "No data snapshot yet. Run refresh."
4. WHEN snapshot metadata changes THEN the frontend SHALL be able to update data freshness displays without full page reloads
5. WHEN multiple data views are open THEN all views SHALL consistently show the same snapshot timestamp

### Requirement 8

**User Story:** As a system architect, I want the snapshot format to support system evolution, so that schema and calculation changes can be managed over time.

#### Acceptance Criteria

1. WHEN creating snapshots THEN the system SHALL include schema_version to track data structure changes
2. WHEN creating snapshots THEN the system SHALL include calculation_version to track computation logic changes
3. WHEN reading historical snapshots THEN the system SHALL preserve the original schema and calculation versions
4. WHEN schema or calculation logic changes THEN new snapshots SHALL use current versions while preserving historical context
5. WHEN comparing snapshots across versions THEN the system SHALL account for version differences through recorded metadata
