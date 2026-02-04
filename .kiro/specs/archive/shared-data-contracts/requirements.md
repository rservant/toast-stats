# Requirements Document

## Introduction

This document specifies requirements for a shared data contracts package (`@toastmasters/shared-contracts`) that establishes a single source of truth for file format types between the scraper-cli (data producer) and backend (data consumer). The current system has two independent type definitions for the same data structures, causing runtime failures that TypeScript cannot catch at compile time.

The core problem is that scraper-cli writes `DistrictStatistics` from `analytics-core` (with fields like `snapshotDate`, `clubs[]`, `divisions[]`, `areas[]`, `totals`) while the backend expects `DistrictStatistics` from `backend/src/types/districts.ts` (with fields like `asOfDate`, `membership`, `clubs`, `education`, `goals`, `performance`, `ranking`). These are fundamentally different structures with the same name.

## Glossary

- **Shared_Contracts_Package**: A new npm workspace package (`@toastmasters/shared-contracts`) that defines all file format types used for data exchange between scraper-cli and backend
- **File_Format_Type**: A TypeScript interface that defines the exact structure of JSON files written to disk by scraper-cli and read by backend
- **Data_Producer**: The scraper-cli package that writes pre-computed data files to the snapshot directory
- **Data_Consumer**: The backend package that reads pre-computed data files from the snapshot directory
- **Contract_Violation**: A runtime error that occurs when the data written by the producer does not match the structure expected by the consumer
- **Compile_Time_Verification**: TypeScript type checking that ensures both producer and consumer use identical type definitions
- **Runtime_Validation**: Zod schema validation that verifies data structure at runtime boundaries
- **Snapshot_Directory**: The file system location (`CACHE_DIR/snapshots/{date}/`) where pre-computed data files are stored

## Requirements

### Requirement 1: Shared Contracts Package Creation

**User Story:** As a developer, I want a single source of truth for file format types, so that compile-time type checking prevents data contract mismatches between scraper-cli and backend.

#### Acceptance Criteria

1. THE Shared_Contracts_Package SHALL be created at `packages/shared-contracts/` as a new npm workspace
2. THE Shared_Contracts_Package SHALL export all File_Format_Types used for data exchange between Data_Producer and Data_Consumer
3. THE Shared_Contracts_Package SHALL be configured with dual ESM/CJS builds matching the analytics-core package structure
4. THE Shared_Contracts_Package SHALL have zero runtime dependencies except for Zod (for validation schemas)

### Requirement 2: Per-District Data Contract

**User Story:** As a developer, I want a single `PerDistrictData` type definition, so that the district JSON files written by scraper-cli match exactly what the backend expects to read.

#### Acceptance Criteria

1. THE Shared_Contracts_Package SHALL export a `PerDistrictData` interface that defines the wrapper structure for district JSON files
2. THE `PerDistrictData` interface SHALL include fields: `districtId`, `districtName`, `collectedAt`, `status`, `errorMessage` (optional), and `data`
3. THE `data` field in `PerDistrictData` SHALL reference a `DistrictStatisticsFile` type that defines the exact structure stored in district files
4. WHEN the Data_Producer writes a district file, THE Data_Producer SHALL use the `PerDistrictData` type from Shared_Contracts_Package
5. WHEN the Data_Consumer reads a district file, THE Data_Consumer SHALL use the `PerDistrictData` type from Shared_Contracts_Package

### Requirement 3: All-Districts Rankings Contract

**User Story:** As a developer, I want a single `AllDistrictsRankingsData` type definition, so that the rankings file written by scraper-cli matches exactly what the backend expects to read.

#### Acceptance Criteria

1. THE Shared_Contracts_Package SHALL export an `AllDistrictsRankingsData` interface that defines the structure of `all-districts-rankings.json`
2. THE `AllDistrictsRankingsData` interface SHALL include a `metadata` object with fields: `snapshotId`, `calculatedAt`, `schemaVersion`, `calculationVersion`, `rankingVersion`, `sourceCsvDate`, `csvFetchedAt`, `totalDistricts`, `fromCache`
3. THE `AllDistrictsRankingsData` interface SHALL include a `rankings` array of `DistrictRanking` objects
4. THE Shared_Contracts_Package SHALL export a `DistrictRanking` interface with all ranking fields
5. WHEN the Data_Producer writes rankings, THE Data_Producer SHALL use the `AllDistrictsRankingsData` type from Shared_Contracts_Package
6. WHEN the Data_Consumer reads rankings, THE Data_Consumer SHALL use the `AllDistrictsRankingsData` type from Shared_Contracts_Package

### Requirement 4: Snapshot Metadata Contract

**User Story:** As a developer, I want a single snapshot metadata type definition, so that the metadata.json file written by scraper-cli matches exactly what the backend expects to read.

#### Acceptance Criteria

1. THE Shared_Contracts_Package SHALL export a `SnapshotMetadataFile` interface that defines the structure of `metadata.json`
2. THE `SnapshotMetadataFile` interface SHALL include fields: `snapshotId`, `createdAt`, `schemaVersion`, `calculationVersion`, `status`, `configuredDistricts`, `successfulDistricts`, `failedDistricts`, `errors`, `processingDuration`, `source`, `dataAsOfDate`
3. THE `SnapshotMetadataFile` interface SHALL include optional closing period fields: `isClosingPeriodData`, `collectionDate`, `logicalDate`
4. WHEN the Data_Producer writes metadata, THE Data_Producer SHALL use the `SnapshotMetadataFile` type from Shared_Contracts_Package
5. WHEN the Data_Consumer reads metadata, THE Data_Consumer SHALL use the `SnapshotMetadataFile` type from Shared_Contracts_Package

### Requirement 5: Snapshot Manifest Contract

**User Story:** As a developer, I want a single snapshot manifest type definition, so that the manifest.json file written by scraper-cli matches exactly what the backend expects to read.

#### Acceptance Criteria

1. THE Shared_Contracts_Package SHALL export a `SnapshotManifest` interface that defines the structure of `manifest.json`
2. THE Shared_Contracts_Package SHALL export a `DistrictManifestEntry` interface for individual district entries in the manifest
3. THE `SnapshotManifest` interface SHALL include fields: `snapshotId`, `createdAt`, `districts`, `totalDistricts`, `successfulDistricts`, `failedDistricts`, `allDistrictsRankings` (optional)
4. WHEN the Data_Producer writes manifest, THE Data_Producer SHALL use the `SnapshotManifest` type from Shared_Contracts_Package
5. WHEN the Data_Consumer reads manifest, THE Data_Consumer SHALL use the `SnapshotManifest` type from Shared_Contracts_Package

### Requirement 6: Runtime Validation Schemas

**User Story:** As a developer, I want Zod validation schemas for all file format types, so that I can validate data at runtime boundaries and catch contract violations early.

#### Acceptance Criteria

1. THE Shared_Contracts_Package SHALL export Zod schemas for all File_Format_Types
2. THE Zod schemas SHALL be named with a `Schema` suffix (e.g., `PerDistrictDataSchema`, `AllDistrictsRankingsDataSchema`)
3. THE Zod schemas SHALL match their corresponding TypeScript interfaces exactly
4. THE Shared_Contracts_Package SHALL export validation helper functions: `validatePerDistrictData`, `validateAllDistrictsRankings`, `validateSnapshotMetadata`, `validateSnapshotManifest`
5. WHEN validation fails, THE validation helper functions SHALL return a descriptive error message indicating which fields are invalid

### Requirement 7: Scraper-CLI Migration

**User Story:** As a developer, I want the scraper-cli to use shared contracts, so that any type changes are caught at compile time.

#### Acceptance Criteria

1. THE Data_Producer SHALL add `@toastmasters/shared-contracts` as a dependency
2. THE Data_Producer SHALL import all file format types from `@toastmasters/shared-contracts` instead of defining them locally
3. THE Data_Producer SHALL remove local type definitions that duplicate shared contracts
4. WHEN the Data_Producer writes files, THE Data_Producer SHALL validate data against Zod schemas before writing
5. IF validation fails before writing, THEN THE Data_Producer SHALL log the validation error and throw an exception

### Requirement 8: Backend Migration

**User Story:** As a developer, I want the backend to use shared contracts, so that any type changes are caught at compile time.

#### Acceptance Criteria

1. THE Data_Consumer SHALL add `@toastmasters/shared-contracts` as a dependency
2. THE Data_Consumer SHALL import all file format types from `@toastmasters/shared-contracts` instead of defining them locally
3. THE Data_Consumer SHALL remove local type definitions that duplicate shared contracts
4. WHEN the Data_Consumer reads files, THE Data_Consumer SHALL validate data against Zod schemas after reading
5. IF validation fails after reading, THEN THE Data_Consumer SHALL log the validation error and return an appropriate error response

### Requirement 9: District Statistics Reconciliation

**User Story:** As a developer, I want a clear definition of what district statistics data is stored in files, so that the analytics-core transformation output matches what the backend expects.

#### Acceptance Criteria

1. THE Shared_Contracts_Package SHALL export a `DistrictStatisticsFile` interface that defines the exact structure stored in district JSON files
2. THE `DistrictStatisticsFile` interface SHALL be based on the analytics-core `DistrictStatistics` structure (with `snapshotDate`, `clubs[]`, `divisions[]`, `areas[]`, `totals`)
3. THE Data_Consumer SHALL adapt the `DistrictStatisticsFile` to its internal `DistrictStatistics` type if needed for API responses
4. THE adaptation logic SHALL be centralized in a single adapter function in the backend
5. THE adapter function SHALL be covered by unit tests that verify the transformation

### Requirement 10: Version Compatibility

**User Story:** As a developer, I want schema version constants in the shared contracts, so that both producer and consumer can verify compatibility.

#### Acceptance Criteria

1. THE Shared_Contracts_Package SHALL export a `SCHEMA_VERSION` constant for data structure compatibility
2. THE Shared_Contracts_Package SHALL export a `CALCULATION_VERSION` constant for business logic compatibility
3. THE Shared_Contracts_Package SHALL export a `RANKING_VERSION` constant for ranking algorithm compatibility
4. WHEN the Data_Producer writes files, THE Data_Producer SHALL include the version constants in metadata
5. WHEN the Data_Consumer reads files, THE Data_Consumer SHALL verify version compatibility before processing
