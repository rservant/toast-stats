# Requirements Document

## Introduction

The backend currently scans all snapshot directories (~4,330 directories) on cold start to find the latest successful snapshot. This scan takes ~2.5 minutes, during which the frontend hangs waiting for API responses. This feature introduces a "latest-successful" pointer file maintained by the scraper-cli pipeline, allowing the backend to resolve the latest successful snapshot in constant time on startup. The backend falls back to the full directory scan if the pointer is missing or invalid.

## Glossary

- **Snapshot_Pointer**: A JSON file located at `snapshots/latest-successful.json` that contains the snapshot ID of the most recent successful snapshot. This replaces a symlink approach for cross-platform compatibility and atomicity.
- **Scraper_CLI**: The `packages/scraper-cli` pipeline responsible for scraping, transforming, and computing all data. It is the only process that writes snapshot data.
- **Backend**: The read-only API server (`backend/`) that serves pre-computed snapshot data. It performs no data computation.
- **Snapshot_Directory**: A directory under `snapshots/` named by date (e.g., `2026-02-06`) containing `metadata.json`, `manifest.json`, district files, and rankings.
- **Cold_Start**: The first request to the backend after process startup, before any in-memory caches are populated.
- **TransformService**: The service in Scraper_CLI responsible for transforming raw CSV data into snapshot files and writing metadata, manifests, and rankings.
- **FileSnapshotStore**: The backend service that reads snapshot data from the local filesystem and provides caching.

## Requirements

### Requirement 1: Snapshot Pointer Creation

**User Story:** As the scraper-cli pipeline, I want to write a pointer file after a successful snapshot transform, so that the backend can resolve the latest snapshot without scanning all directories.

#### Acceptance Criteria

1. WHEN the TransformService completes a transform operation with status "success", THE Scraper_CLI SHALL write a `latest-successful.json` file to the `snapshots/` directory containing the snapshot ID
2. WHEN the TransformService completes a transform operation with status "partial" or "failed", THE Scraper_CLI SHALL preserve the existing Snapshot_Pointer unchanged
3. THE Snapshot_Pointer file SHALL be written atomically using a temporary file and rename to prevent partial reads
4. THE Snapshot_Pointer file SHALL contain a JSON object with the snapshot ID, a timestamp of when the pointer was updated, and the schema version of the snapshot
5. WHEN multiple transform operations complete concurrently, THE Scraper_CLI SHALL ensure only the chronologically latest successful snapshot ID is written to the Snapshot_Pointer

### Requirement 2: Backend Fast Startup via Pointer

**User Story:** As the backend, I want to read the snapshot pointer file on cold start instead of scanning all directories, so that the first API response is served in under 1 second.

#### Acceptance Criteria

1. WHEN the Backend starts and the Snapshot_Pointer file exists and is valid, THE FileSnapshotStore SHALL read the snapshot directly from the referenced Snapshot_Directory without scanning other directories
2. WHEN the Backend reads a valid Snapshot_Pointer, THE FileSnapshotStore SHALL resolve the latest successful snapshot in under 100 milliseconds
3. WHEN the Backend reads the Snapshot_Pointer, THE FileSnapshotStore SHALL validate that the referenced Snapshot_Directory exists and contains a valid `metadata.json` with status "success"
4. IF the Snapshot_Pointer references a Snapshot_Directory that does not exist or has non-success status, THEN THE FileSnapshotStore SHALL fall back to the full directory scan

### Requirement 3: Fallback Behavior

**User Story:** As the backend operator, I want the backend to gracefully handle missing or corrupt pointer files, so that the system remains functional during migration or after manual cache operations.

#### Acceptance Criteria

1. IF the Snapshot_Pointer file does not exist, THEN THE FileSnapshotStore SHALL fall back to the full directory scan and log a warning
2. IF the Snapshot_Pointer file contains invalid JSON or missing required fields, THEN THE FileSnapshotStore SHALL fall back to the full directory scan and log a warning
3. IF the Snapshot_Pointer file cannot be read due to a filesystem error, THEN THE FileSnapshotStore SHALL fall back to the full directory scan and log the error
4. WHEN the FileSnapshotStore falls back to the full directory scan, THE FileSnapshotStore SHALL write a new valid Snapshot_Pointer file after successfully resolving the latest snapshot

### Requirement 4: Shared Pointer Contract

**User Story:** As a developer, I want the pointer file format defined in shared-contracts, so that both scraper-cli and backend use the same validated schema.

#### Acceptance Criteria

1. THE shared-contracts package SHALL define a TypeScript type for the Snapshot_Pointer file structure
2. THE shared-contracts package SHALL define a Zod schema for runtime validation of the Snapshot_Pointer file
3. THE Snapshot_Pointer type SHALL include fields for snapshot ID, updated timestamp, and schema version
4. WHEN the Scraper_CLI writes or the Backend reads the Snapshot_Pointer, THE system SHALL validate the content against the Zod schema

### Requirement 5: Backward Compatibility

**User Story:** As a backend operator, I want the system to work correctly whether or not the pointer file exists, so that I can deploy the backend update before running the updated scraper-cli.

#### Acceptance Criteria

1. WHEN the Backend is updated but the Scraper_CLI has not yet been updated, THE FileSnapshotStore SHALL operate using the existing full directory scan without errors
2. WHEN the Scraper_CLI is updated but the Backend has not yet been updated, THE Scraper_CLI SHALL write the Snapshot_Pointer file without affecting the existing snapshot directory structure
3. THE Snapshot_Pointer file SHALL be stored alongside the existing snapshot directories without modifying any existing file or directory layout
