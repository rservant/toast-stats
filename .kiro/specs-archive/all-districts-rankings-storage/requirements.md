# Requirements Document

## Introduction

This specification addresses a critical bug where the "All Districts" CSV data containing BordaCount rankings for all districts is fetched but never stored or made accessible to the frontend. The system currently only stores data for configured districts, losing the comprehensive ranking information needed for the all-districts rankings page.

## Glossary

- **All_Districts_CSV**: The CSV file from Toastmasters dashboard containing summary performance data for all districts worldwide
- **BordaCount_Rankings**: Calculated rankings using the Borda count voting method based on multiple performance metrics
- **Configured_Districts**: The subset of districts that the system is configured to collect detailed data for
- **Raw_CSV_Cache**: File-based cache storing original CSV files to avoid redundant downloads
- **Snapshot**: An immutable, time-specific representation of normalized application data
- **PerDistrictSnapshotStore**: Storage system that organizes snapshot data in directory-based structure with individual district files
- **Rankings_Data**: Processed district performance data with calculated BordaCount rankings

## Requirements

### Requirement 1: Store All Districts Rankings Data

**User Story:** As a system operator, I want the All Districts CSV data with BordaCount rankings to be stored in every snapshot, so that the frontend can display comprehensive district rankings regardless of which districts are configured for detailed collection.

#### Acceptance Criteria

1. WHEN RefreshService fetches the All Districts CSV, THE System SHALL store the raw CSV data in the Raw_CSV_Cache
2. WHEN RefreshService processes the All Districts CSV, THE System SHALL calculate BordaCount rankings for all districts in the CSV
3. WHEN PerDistrictSnapshotStore writes a snapshot, THE System SHALL store the processed rankings data in a separate file at the snapshot level
4. THE System SHALL store rankings data independently from individual district files
5. WHEN a snapshot is created, THE Rankings_Data file SHALL contain rankings for all districts in the All Districts CSV, not just configured districts

### Requirement 2: Leverage Raw CSV Caching

**User Story:** As a system operator, I want the system to reuse cached All Districts CSV files when available, so that we minimize redundant downloads and improve refresh performance.

#### Acceptance Criteria

1. WHEN RefreshService needs All Districts data, THE System SHALL check the Raw_CSV_Cache first
2. IF a cached All Districts CSV exists for the current date, THEN THE System SHALL use the cached file without downloading
3. IF no cached All Districts CSV exists for the current date, THEN THE System SHALL download the CSV and cache it
4. THE System SHALL store raw CSV files with date-based naming for cache lookup
5. WHEN using cached CSV data, THE System SHALL log the cache hit for monitoring

### Requirement 3: Extend PerDistrictSnapshotStore Structure

**User Story:** As a developer, I want the snapshot storage structure to include an all-districts-rankings file, so that ranking data is easily accessible without reading individual district files.

#### Acceptance Criteria

1. THE PerDistrictSnapshotStore SHALL create an `all-districts-rankings.json` file in each snapshot directory
2. THE `all-districts-rankings.json` file SHALL contain an array of ranking objects for all districts
3. THE Rankings file SHALL include metadata about the source CSV and calculation version
4. THE Snapshot manifest SHALL reference the all-districts-rankings file

### Requirement 4: Update Rankings API Endpoint

**User Story:** As a frontend developer, I want the `/api/districts/rankings` endpoint to serve data from the all-districts-rankings file, so that I can display comprehensive rankings efficiently.

#### Acceptance Criteria

1. WHEN the rankings endpoint receives a request, THE System SHALL read from the all-districts-rankings.json file
2. THE System SHALL serve data from the all-districts-rankings file
3. THE Rankings endpoint SHALL return rankings for all districts, not just configured districts
4. THE Response SHALL include metadata about the rankings data source

### Requirement 5: Integrate with RefreshService Workflow

**User Story:** As a system architect, I want the All Districts rankings storage to integrate seamlessly with the existing refresh workflow, so that rankings are automatically captured during every refresh operation.

#### Acceptance Criteria

1. WHEN RefreshService executes scrapeData(), THE System SHALL fetch the All Districts CSV and preserve it for ranking calculation
2. WHEN RefreshService executes scrapeData(), THE System SHALL continue to fetch all 3 CSV files (district performance, division performance, club performance) for each configured district
3. WHEN RefreshService calculates rankings, THE System SHALL calculate rankings for all districts from the All Districts CSV
4. WHEN RefreshService creates a snapshot, THE System SHALL pass the all-districts rankings data to the snapshot store
5. THE Refresh workflow SHALL not require changes to district configuration to capture all-districts rankings
6. IF ranking calculation fails for all districts, THEN THE System SHALL fail the entire refresh operation

### Requirement 6: Maintain Data Consistency

**User Story:** As a data analyst, I want the all-districts rankings to be consistent with the snapshot's calculation version, so that I can trust the ranking data for analysis.

#### Acceptance Criteria

1. THE All-districts-rankings file SHALL include the calculation_version used for ranking calculations
2. THE All-districts-rankings file SHALL include the ranking_version from the BordaCount calculator
3. THE All-districts-rankings file SHALL include the source CSV date and fetch timestamp
4. WHEN reading rankings data, THE System SHALL validate that the calculation version matches the snapshot metadata
5. THE System SHALL log warnings if version mismatches are detected

### Requirement 7: Handle Raw CSV Cache Management

**User Story:** As a system operator, I want the raw CSV cache to be managed efficiently, so that disk space is used appropriately and old cache files are cleaned up.

#### Acceptance Criteria

1. THE Raw_CSV_Cache SHALL store CSV files with date-based naming: `all-districts-{YYYY-MM-DD}.csv`
2. THE Raw_CSV_Cache SHALL include metadata files with fetch timestamps and file sizes
3. WHEN cache cleanup runs, THE System SHALL remove CSV files older than the configured retention period
4. THE System SHALL preserve at least one cached CSV file even if it exceeds the retention period
5. THE Cache cleanup SHALL run automatically during snapshot cleanup operations

### Requirement 8: Use ISO Date-Based Snapshot Directory Naming

**User Story:** As a system operator, I want snapshot directories named with ISO dates instead of timestamps, so that snapshots are human-readable and easier to manage.

#### Acceptance Criteria

1. THE PerDistrictSnapshotStore SHALL use ISO date format (YYYY-MM-DD) for snapshot directory names
2. WHEN creating a snapshot, THE System SHALL generate directory name from the snapshot's dataAsOfDate field
3. THE System SHALL enforce one snapshot per day by overwriting existing snapshot directories for the same date
4. THE current.json pointer SHALL reference snapshots by their ISO date directory name
5. THE System SHALL NOT maintain backward compatibility with timestamp-based directory names

### Requirement 9: Support Testing and Validation

**User Story:** As a developer, I want comprehensive tests for the all-districts rankings storage, so that I can confidently deploy changes without breaking existing functionality.

#### Acceptance Criteria

1. THE System SHALL include unit tests for all-districts rankings file creation
2. THE System SHALL include integration tests for the complete refresh-to-rankings-API flow
3. THE System SHALL include tests for raw CSV cache hit and miss scenarios
4. THE System SHALL include property-based tests for ranking data consistency across snapshots
5. THE Automated tests SHALL NOT contact the Toastmasters website and SHALL use mocked data instead
