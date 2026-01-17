# Requirements Document

## Introduction

The District-Scoped Data Collection feature enables administrators to configure which specific Toastmasters districts to collect data for during snapshot operations, rather than attempting to collect data for all ~128 global districts. This feature also introduces per-district snapshot storage to improve performance, reduce storage requirements, and enable selective data management.

## Glossary

- **District_Configuration**: Administrator-defined list of district IDs to collect data for
- **Per_District_Snapshot**: Individual JSON files storing data for a single district within a snapshot
- **Snapshot_Directory**: Directory structure organizing per-district data files within a snapshot
- **District_Scope**: The set of districts currently configured for data collection
- **Incremental_District_Addition**: The ability to add new districts to the scope without affecting existing data

## Requirements

### Requirement 1: District Configuration Management

**User Story:** As an administrator, I want to configure which districts to collect data for, so that I can focus on relevant districts and reduce system resource usage.

#### Acceptance Criteria

1. THE Configuration_System SHALL provide a way to specify one or more district IDs for data collection
2. WHEN no districts are configured, THE System SHALL require administrator configuration before allowing refresh operations
3. WHEN districts are configured, THE System SHALL validate that district IDs exist in the Toastmasters system
4. THE Configuration_System SHALL support both numeric district IDs (e.g., "42") and alphabetic district IDs (e.g., "F")
5. THE Configuration_System SHALL persist district configuration across system restarts

### Requirement 2: Selective Data Collection

**User Story:** As a system operator, I want the refresh process to only collect data for configured districts, so that refresh operations complete faster and use fewer resources.

#### Acceptance Criteria

1. WHEN executing a refresh operation, THE Scraper SHALL fetch the all-districts summary CSV as before
2. WHEN processing district data, THE Scraper SHALL only fetch detailed data for districts in the configured scope
3. THE Scraper SHALL fetch district performance, division performance, and club performance CSV files for each configured district
4. WHEN a configured district is not found in the all-districts summary, THE System SHALL log a warning but continue processing other districts
5. THE System SHALL record which districts were successfully processed and which failed in snapshot metadata

### Requirement 3: Per-District Snapshot Storage

**User Story:** As a system architect, I want snapshot data stored per-district rather than in a single large JSON file, so that I can improve performance and enable selective data access.

#### Acceptance Criteria

1. THE Snapshot_Store SHALL create a directory structure for each snapshot instead of a single JSON file
2. WHEN storing a snapshot, THE System SHALL create one JSON file per district within the snapshot directory
3. THE Snapshot_Directory SHALL include a metadata.json file with snapshot-level information
4. WHEN reading snapshot data, THE System SHALL aggregate per-district files as needed for API responses

### Requirement 4: Incremental District Management

**User Story:** As an administrator, I want to add new districts to the configuration without affecting existing snapshot data, so that I can expand data collection scope over time.

#### Acceptance Criteria

1. WHEN adding a new district to the configuration, THE System SHALL include it in subsequent refresh operations
2. WHEN removing a district from the configuration, THE System SHALL stop collecting data for that district in new snapshots
3. THE System SHALL preserve historical data for districts that are removed from the configuration
4. WHEN a district is re-added to the configuration, THE System SHALL resume collecting data for that district
5. THE System SHALL provide clear logging when district scope changes occur

### Requirement 5: Configuration Interface

**User Story:** As an administrator, I want a clear interface to manage district configuration, so that I can easily update the scope of data collection.

#### Acceptance Criteria

1. THE Admin_Interface SHALL provide endpoints to view current district configuration
2. THE Admin_Interface SHALL provide endpoints to add districts to the configuration
3. THE Admin_Interface SHALL provide endpoints to remove districts from the configuration
4. THE Admin_Interface SHALL validate district IDs before accepting configuration changes
5. THE Admin_Interface SHALL require proper authentication for configuration changes

### Requirement 6: Snapshot Directory Structure

**User Story:** As a system maintainer, I want a clear directory structure for per-district snapshots, so that I can understand and manage snapshot data effectively.

#### Acceptance Criteria

1. THE Snapshot_Directory SHALL follow the pattern: `snapshots/{snapshot_id}/`
2. WITHIN each snapshot directory, THE System SHALL create files named `district_{district_id}.json`
3. THE Snapshot_Directory SHALL include a `metadata.json` file with snapshot-level information
4. THE Snapshot_Directory SHALL include a `manifest.json` file listing all district files in the snapshot
5. THE System SHALL maintain a `current.json` pointer file at the root level as before

### Requirement 7: Performance Optimization

**User Story:** As a system user, I want faster API responses when accessing district data, so that the application remains responsive.

#### Acceptance Criteria

1. WHEN serving district-specific API requests, THE System SHALL read only the relevant district file from the snapshot
2. WHEN serving multi-district API requests, THE System SHALL read only the required district files
3. THE System SHALL cache frequently accessed district files in memory
4. THE File_Access_Pattern SHALL minimize disk I/O for common read operations
5. THE System SHALL provide performance metrics for per-district file access

### Requirement 8: Error Handling and Resilience

**User Story:** As a system operator, I want robust error handling when some configured districts fail, so that partial data collection doesn't prevent snapshot creation.

#### Acceptance Criteria

1. WHEN some configured districts fail during collection, THE System SHALL create a partial snapshot with available data
2. THE System SHALL record detailed error information for failed districts in snapshot metadata
3. WHEN all configured districts fail, THE System SHALL create a failed snapshot with error details
4. THE System SHALL retry failed districts in subsequent refresh operations
5. THE System SHALL provide clear visibility into which districts succeeded and failed in each refresh

### Requirement 9: Configuration Validation and Feedback

**User Story:** As an administrator, I want clear feedback about district configuration validity, so that I can ensure the system is properly configured.

#### Acceptance Criteria

1. WHEN validating district configuration, THE System SHALL check district IDs against the all-districts summary
2. THE System SHALL provide warnings for configured districts that don't exist in the Toastmasters system
3. THE System SHALL provide recommendations for district IDs that might be typos or outdated
4. THE Configuration_Interface SHALL show the last successful data collection date for each configured district
5. THE System SHALL validate that at least one district is configured before allowing refresh operations

### Requirement 10: Backfill Service Integration

**User Story:** As a system operator, I want the BackfillService to drive snapshot creation for missing historical data, so that I can efficiently populate historical snapshots using the new per-district storage format.

#### Acceptance Criteria

1. WHEN the BackfillService identifies missing dates for configured districts, THE System SHALL create snapshots using the per-district storage format within snapshot directories
2. WHEN the BackfillService successfully fetches data for a date, THE System SHALL create a snapshot directory containing individual per-district JSON files
3. THE BackfillService SHALL integrate with the PerDistrictSnapshotStore to write snapshot data
4. WHEN backfill operations complete successfully, THE System SHALL update the current snapshot pointer if the backfilled date is more recent
5. THE BackfillService SHALL create snapshot metadata that includes backfill-specific information such as source and processing details
6. WHEN backfill operations encounter partial failures, THE System SHALL create partial snapshots with error tracking per district
7. THE BackfillService SHALL respect district configuration scope when creating historical snapshots
