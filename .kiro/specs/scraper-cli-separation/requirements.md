# Requirements Document

## Introduction

This specification defines the separation of the Toastmasters dashboard scraping functionality from the backend application into a standalone command-line tool. The goal is to decouple data collection (scraping) from data processing (snapshot creation), allowing the backend to operate purely from cached CSV data. This separation improves operational flexibility, enables independent scheduling of scraping operations, and simplifies the backend's responsibilities.

## Glossary

- **Scraper_CLI**: The standalone command-line tool responsible for scraping data from the Toastmasters dashboard and storing it in the Raw CSV Cache
- **Raw_CSV_Cache**: The file-based cache storing downloaded CSV files organized by date and district
- **Backend**: The existing backend application that will be modified to read from the Raw CSV Cache and create snapshots
- **Snapshot**: An immutable, time-specific representation of normalized district data
- **RefreshService**: The existing service that orchestrates scraping, normalization, validation, and snapshot creation
- **SnapshotBuilder**: A new service that creates snapshots from cached CSV data without performing scraping
- **Closing_Period**: A period during month-end reconciliation when dashboard data may represent the previous month

## Requirements

### Requirement 1: Standalone Scraper CLI Tool

**User Story:** As a system operator, I want a standalone CLI tool for scraping dashboard data, so that I can run data collection independently from the backend application.

#### Acceptance Criteria

1. THE Scraper_CLI SHALL be a standalone executable that can be invoked from the command line
2. WHEN the Scraper_CLI is invoked, THE Scraper_CLI SHALL scrape data from the Toastmasters dashboard and store it in the Raw_CSV_Cache
3. THE Scraper_CLI SHALL support a `--date` option to specify the target date for scraping (format: YYYY-MM-DD)
4. WHEN no date is specified, THE Scraper_CLI SHALL default to the current date
5. THE Scraper_CLI SHALL support a `--districts` option to specify which districts to scrape (comma-separated list)
6. WHEN no districts are specified, THE Scraper_CLI SHALL scrape all configured districts from the district configuration
7. THE Scraper_CLI SHALL support a `--verbose` flag for detailed logging output
8. THE Scraper_CLI SHALL support a `--timeout` option to specify the maximum duration for the scraping operation
9. WHEN scraping completes successfully, THE Scraper_CLI SHALL output a JSON summary including dates scraped, districts processed, and cache locations
10. IF scraping fails for any district, THEN THE Scraper_CLI SHALL continue processing remaining districts and report failures in the summary
11. THE Scraper_CLI SHALL exit with code 0 on success, code 1 on partial failure, and code 2 on complete failure

### Requirement 2: Raw CSV Cache Storage

**User Story:** As a system operator, I want scraped data stored in a well-organized cache structure, so that the backend can reliably access the data for snapshot creation.

#### Acceptance Criteria

1. THE Scraper_CLI SHALL store all downloaded CSV files in the existing Raw_CSV_Cache directory structure
2. THE Scraper_CLI SHALL store metadata alongside CSV files including scrape timestamp, source URL, and data month
3. WHEN storing CSV data, THE Scraper_CLI SHALL detect and record closing period information in the cache metadata
4. THE Scraper_CLI SHALL use atomic file writes to prevent partial or corrupted cache entries
5. THE Scraper_CLI SHALL validate CSV content before storing to ensure data integrity
6. IF a cache entry already exists for the same date and district, THEN THE Scraper_CLI SHALL skip scraping unless `--force` flag is provided

### Requirement 3: Backend Snapshot Builder

**User Story:** As a system operator, I want the backend to create snapshots from cached CSV data, so that snapshot creation is decoupled from scraping operations.

#### Acceptance Criteria

1. THE Backend SHALL provide a SnapshotBuilder service that creates snapshots from Raw_CSV_Cache data
2. THE SnapshotBuilder SHALL read CSV data from the Raw_CSV_Cache without performing any scraping operations
3. WHEN building a snapshot, THE SnapshotBuilder SHALL normalize, validate, and calculate rankings from cached CSV data
4. THE SnapshotBuilder SHALL support building snapshots for a specific date by reading cached data for that date
5. IF cached data is missing for any configured district, THEN THE SnapshotBuilder SHALL create a partial snapshot and record the missing districts
6. IF no cached data exists for the requested date, THEN THE SnapshotBuilder SHALL return an error indicating missing cache data
7. THE SnapshotBuilder SHALL preserve all existing snapshot metadata including closing period information from cache metadata

### Requirement 4: Backend Refresh Workflow Modification

**User Story:** As a system operator, I want the backend refresh operation to use cached data, so that the backend no longer depends on direct dashboard access.

#### Acceptance Criteria

1. THE Backend refresh endpoint SHALL use the SnapshotBuilder to create snapshots from cached CSV data
2. THE Backend refresh endpoint SHALL NOT perform any scraping operations
3. WHEN refresh is triggered, THE Backend SHALL check for available cached data before attempting snapshot creation
4. IF cached data is not available for the current date, THEN THE Backend SHALL return an informative error message
5. THE Backend SHALL support a `--date` parameter to build snapshots from historical cached data
6. THE Backend refresh CLI SHALL maintain backward compatibility with existing command-line options

### Requirement 5: Operational Independence

**User Story:** As a system operator, I want to run scraping and snapshot creation independently, so that I can schedule and manage each operation separately.

#### Acceptance Criteria

1. THE Scraper_CLI SHALL operate without requiring the backend to be running
2. THE Backend SHALL operate without requiring the Scraper_CLI to be installed or available
3. THE Scraper_CLI and Backend SHALL share only the Raw_CSV_Cache directory as their integration point
4. WHEN the Scraper_CLI is run, THE Backend SHALL be able to detect new cached data on subsequent refresh operations
5. THE Scraper_CLI SHALL support running on a different machine than the backend (given shared cache access)

### Requirement 6: Error Handling and Resilience

**User Story:** As a system operator, I want robust error handling in both tools, so that failures are clearly reported and recoverable.

#### Acceptance Criteria

1. IF the Scraper_CLI encounters a network error, THEN THE Scraper_CLI SHALL retry with exponential backoff before failing
2. IF the Scraper_CLI circuit breaker opens, THEN THE Scraper_CLI SHALL report the circuit breaker status and exit gracefully
3. THE SnapshotBuilder SHALL validate cache data integrity before processing
4. IF cache data is corrupted, THEN THE SnapshotBuilder SHALL report the corruption and skip the affected files
5. THE Scraper_CLI SHALL log all operations with timestamps for debugging and audit purposes
6. THE Backend SHALL log cache access operations for debugging and monitoring

### Requirement 7: Configuration Consistency

**User Story:** As a system operator, I want both tools to use consistent configuration, so that district lists and cache locations are synchronized.

#### Acceptance Criteria

1. THE Scraper_CLI SHALL read district configuration from the same source as the Backend
2. THE Scraper_CLI SHALL use the same cache directory configuration as the Backend
3. WHEN district configuration changes, THE Scraper_CLI SHALL respect the updated configuration on next run
4. THE Scraper_CLI SHALL support environment variable configuration consistent with the Backend
5. THE Scraper_CLI SHALL support a `--config` option to specify an alternative configuration file

### Requirement 8: Clean Separation

**User Story:** As a system operator, I want a clean separation between scraping and snapshot creation, so that the architecture is simple and maintainable.

#### Acceptance Criteria

1. THE Backend SHALL remove all scraping-related code from the RefreshService
2. THE Backend refresh operation SHALL exclusively use the SnapshotBuilder to create snapshots from cached data
3. THE ToastmastersScraper class SHALL be moved to the Scraper_CLI package
4. THE Backend SHALL NOT have any dependency on Playwright or browser automation libraries
5. THE Scraper_CLI SHALL be the only component with dashboard scraping capabilities
