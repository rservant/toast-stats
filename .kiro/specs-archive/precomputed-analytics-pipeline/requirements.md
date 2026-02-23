# Requirements Document

## Introduction

This document specifies the requirements for transforming the Toast-Stats application from a "compute on request" architecture to a "serve pre-computed files" architecture. The current system exceeds Google Cloud Run's 512MB memory limit during heavy analytics computation because the backend accumulates large amounts of data in memory when computing analytics on-demand. This feature moves analytics computation to the local collector-cli, stores results as small JSON files, and has the backend serve these pre-computed files directly.

## Glossary

- **Collector_CLI**: The standalone command-line tool (`packages/collector-cli/`) that scrapes data from the Toastmasters dashboard and stores it locally
- **Analytics_Engine**: The existing backend service (`backend/src/services/AnalyticsEngine.ts`) that computes analytics from snapshot data
- **Analytics_Module**: Specialized analytics computation modules (MembershipAnalyticsModule, ClubHealthAnalyticsModule, etc.)
- **Pre_Computed_Analytics**: JSON files containing analytics results computed during collector runs rather than on API request
- **Snapshot_Store**: The file-based storage system (`backend/src/services/SnapshotStore.ts`) that stores district data snapshots
- **Analytics_Directory**: A subdirectory within each snapshot directory that contains pre-computed analytics files
- **Backend**: The Express.js API server (`backend/`) that serves data to the frontend
- **Frontend**: The React application that displays analytics data via hooks like `useDistrictAnalytics`

## Requirements

### Requirement 1: Pre-Computed Analytics Generation

**User Story:** As a system operator, I want analytics to be computed during local collector runs, so that the backend can serve data without heavy memory usage.

#### Acceptance Criteria

1. WHEN the Collector_CLI completes a scrape operation, THE Collector_CLI SHALL transform raw CSV data into snapshots using the same transformation logic as the Backend
2. WHEN snapshots are created, THE Collector_CLI SHALL compute analytics for each district using the same algorithms as the Analytics_Engine
3. WHEN computing analytics, THE Collector_CLI SHALL generate membership trends, club health scores, distinguished club projections, division/area comparisons, and year-over-year metrics
4. THE Pre_Computed_Analytics SHALL produce identical results to the current Analytics_Engine for the same input data
5. IF analytics computation fails for a district, THEN THE Collector_CLI SHALL log the error and continue processing remaining districts
6. WHEN analytics are computed, THE Collector_CLI SHALL store them in an `analytics/` subdirectory within the snapshot directory
7. THE data pipeline SHALL be: raw CSV → snapshot → pre-computed analytics (all in Collector_CLI)

### Requirement 2: Snapshot Creation in Collector CLI

**User Story:** As a system operator, I want snapshots created during collector runs, so that the full data pipeline runs locally before upload.

#### Acceptance Criteria

1. THE Collector_CLI SHALL provide a `transform` command that converts raw CSV files into snapshot format
2. WHEN transforming raw CSVs, THE Collector_CLI SHALL use the same DataTransformationService logic as the Backend
3. THE Collector_CLI SHALL store snapshots in the same directory structure as the Backend expects: `CACHE_DIR/snapshots/{date}/`
4. WHEN a snapshot is created, THE Collector_CLI SHALL write district JSON files, metadata.json, and manifest.json
5. THE `scrape` command SHALL optionally run transformation automatically with a `--transform` flag
6. THE data transformation logic SHALL be extracted into a shared package usable by both Collector_CLI and Backend

### Requirement 3: Analytics File Storage Structure

**User Story:** As a developer, I want pre-computed analytics stored in a consistent structure, so that the backend can reliably locate and serve them.

#### Acceptance Criteria

1. THE Collector_CLI SHALL store pre-computed analytics in the following structure:
   ```
   CACHE_DIR/snapshots/{date}/analytics/
   ├── district_{id}_analytics.json
   ├── district_{id}_membership_trends.json
   ├── district_{id}_club_health.json
   └── global_rankings_summary.json
   ```
2. WHEN writing analytics files, THE Collector_CLI SHALL include a schema version and computation timestamp in each file
3. THE Pre_Computed_Analytics files SHALL each be smaller than 100KB to ensure fast serving
4. WHEN a snapshot directory exists, THE Analytics_Directory SHALL be created alongside existing district files
5. THE Collector_CLI SHALL write an analytics manifest file listing all generated analytics files with their checksums

### Requirement 4: Backend Analytics Serving

**User Story:** As a frontend developer, I want the backend to serve pre-computed analytics, so that API responses are fast and memory-efficient.

#### Acceptance Criteria

1. WHEN the Backend receives an analytics request, THE Backend SHALL read and return pre-computed analytics files
2. IF pre-computed analytics do not exist for the requested district and date, THEN THE Backend SHALL return a 404 error with a message indicating analytics are not available
3. THE Backend SHALL maintain API compatibility with existing frontend hooks (useDistrictAnalytics, useMembershipData, etc.)
4. WHEN serving pre-computed analytics, THE Backend SHALL validate the schema version matches the expected version
5. IF the schema version is incompatible, THEN THE Backend SHALL return a 500 error with a message indicating version mismatch
6. THE Backend SHALL NOT compute analytics on-demand to avoid memory issues in Cloud Run

### Requirement 5: Incremental Analytics Updates

**User Story:** As a system operator, I want analytics to be updated incrementally, so that collector runs complete quickly without recomputing everything.

#### Acceptance Criteria

1. WHEN the Collector_CLI runs, THE Collector_CLI SHALL check if analytics already exist for the target date
2. IF analytics exist and the underlying snapshot data has not changed, THEN THE Collector_CLI SHALL skip analytics computation for that district
3. WHEN new snapshot data is scraped, THE Collector_CLI SHALL recompute only the affected analytics files
4. THE Collector_CLI SHALL provide a `--force-analytics` flag to recompute all analytics regardless of existing files
5. WHEN checking for changes, THE Collector_CLI SHALL compare snapshot checksums to determine if recomputation is needed

### Requirement 6: Analytics Upload to Cloud Storage

**User Story:** As a system operator, I want to upload pre-computed analytics to Google Cloud Storage, so that the production backend can serve them.

#### Acceptance Criteria

1. THE Collector_CLI SHALL provide an `upload` command to sync local snapshots and analytics to Google Cloud Storage
2. WHEN uploading, THE Collector_CLI SHALL upload both snapshot data and pre-computed analytics files
3. THE Collector_CLI SHALL support incremental uploads, only uploading files that have changed
4. IF upload fails for any file, THEN THE Collector_CLI SHALL report the failure and continue with remaining files
5. WHEN upload completes, THE Collector_CLI SHALL output a summary of uploaded files and any errors

### Requirement 7: Analytics Computation Modules

**User Story:** As a developer, I want analytics computation logic to be shared between collector-cli and backend, so that results are consistent.

#### Acceptance Criteria

1. THE Analytics computation logic SHALL be extracted into a shared package that both Collector_CLI and Backend can use
2. WHEN computing membership analytics, THE shared module SHALL use the same algorithms as MembershipAnalyticsModule
3. WHEN computing club health analytics, THE shared module SHALL use the same algorithms as ClubHealthAnalyticsModule
4. WHEN computing distinguished club analytics, THE shared module SHALL use the same algorithms as DistinguishedClubAnalyticsModule
5. WHEN computing division/area analytics, THE shared module SHALL use the same algorithms as DivisionAreaAnalyticsModule
6. THE shared module SHALL be versioned to track algorithm changes

### Requirement 8: CLI Analytics Command

**User Story:** As a system operator, I want a dedicated CLI command for analytics computation, so that I can run analytics separately from scraping.

#### Acceptance Criteria

1. THE Collector_CLI SHALL provide a `compute-analytics` command that computes analytics for existing snapshots
2. WHEN the `compute-analytics` command is invoked with a date, THE Collector_CLI SHALL compute analytics for that snapshot
3. THE `compute-analytics` command SHALL support a `--districts` option to compute analytics for specific districts only
4. THE `compute-analytics` command SHALL output a JSON summary of computed analytics files
5. IF the specified snapshot does not exist, THEN THE Collector_CLI SHALL return an error with exit code 2

### Requirement 9: Analytics File Format

**User Story:** As a developer, I want analytics files to have a consistent format, so that they can be reliably parsed and served.

#### Acceptance Criteria

1. THE Pre_Computed_Analytics files SHALL be valid JSON with UTF-8 encoding
2. WHEN writing analytics files, THE Collector_CLI SHALL include metadata: schemaVersion, computedAt, snapshotDate, districtId
3. THE district analytics file SHALL contain the complete DistrictAnalytics structure matching the frontend type definition
4. THE membership trends file SHALL contain time-series data for membership and payments
5. THE club health file SHALL contain club-level health scores, risk factors, and status classifications
6. FOR ALL valid Pre_Computed_Analytics objects, serializing then deserializing SHALL produce an equivalent object (round-trip property)

### Requirement 10: Error Handling and Logging

**User Story:** As a system operator, I want clear error messages and logs, so that I can diagnose issues with analytics computation.

#### Acceptance Criteria

1. WHEN analytics computation fails, THE Collector_CLI SHALL log the district ID, error message, and stack trace
2. THE Collector_CLI SHALL provide a `--verbose` flag for detailed computation logging
3. WHEN the Backend fails to read pre-computed analytics, THE Backend SHALL return an appropriate error response (404 for missing, 500 for corrupted)
4. THE Backend SHALL log when it serves pre-computed analytics for monitoring purposes
5. IF a pre-computed analytics file is corrupted or invalid JSON, THEN THE Backend SHALL return a 500 error and log the corruption details

### Requirement 11: Local Development Support

**User Story:** As a developer, I want to run the application locally using locally generated pre-computed analytics, so that I can develop and debug with the same data flow as production.

#### Acceptance Criteria

1. THE Backend SHALL read pre-computed analytics from the local file system when running locally
2. THE Backend SHALL use the same CACHE_DIR configuration for both local development and production
3. WHEN the Collector_CLI generates pre-computed analytics locally, THE Backend SHALL be able to serve them immediately without any upload step
4. THE Collector_CLI `compute-analytics` command SHALL work with locally scraped data without requiring cloud connectivity
5. THE local development workflow SHALL be: scrape locally → compute analytics locally → run backend locally → serve pre-computed analytics
