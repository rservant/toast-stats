# Implementation Plan: Pre-Computed Analytics Pipeline

## Overview

This implementation transforms the Toast-Stats application from "compute on request" to "serve pre-computed files". The work is organized into phases: shared package creation, collector-cli enhancements, backend modifications, and integration testing.

## Tasks

- [x] 1. Create shared analytics-core package
  - [x] 1.1 Initialize package structure
    - Create `packages/analytics-core/` directory
    - Set up package.json with TypeScript configuration
    - Configure exports for both ESM and CJS
    - _Requirements: 7.1, 2.6_

  - [x] 1.2 Extract DataTransformer from backend
    - Move CSV parsing logic from backend DataTransformationService
    - Create `IDataTransformer` interface
    - Implement `DataTransformer` class with same algorithms
    - _Requirements: 2.2, 1.1_

  - [x] 1.3 Extract analytics computation modules
    - Move MembershipAnalyticsModule algorithms
    - Move ClubHealthAnalyticsModule algorithms
    - Move DistinguishedClubAnalyticsModule algorithms
    - Move DivisionAreaAnalyticsModule algorithms
    - Create `IAnalyticsComputer` interface
    - _Requirements: 7.2, 7.3, 7.4, 7.5_

  - [x] 1.4 Add schema versioning
    - Create `version.ts` with ANALYTICS_SCHEMA_VERSION constant
    - Implement `isCompatibleVersion()` function
    - _Requirements: 7.6, 4.4_

  - [x] 1.5 Write property test for analytics equivalence
    - **Property 1: Analytics Computation Equivalence**
    - **Validates: Requirements 1.2, 1.4, 7.2, 7.3, 7.4, 7.5**

- [x] 2. Checkpoint - Shared package complete
  - Ensure all tests pass, ask the user if questions arise.
  - Verify package builds and exports correctly

- [x] 3. Implement collector-cli transform command
  - [x] 3.1 Create transform command structure
    - Add `transform` command to CLI with Commander.js
    - Implement `--date`, `--districts`, `--force`, `--verbose` options
    - _Requirements: 2.1, 2.5_

  - [x] 3.2 Implement CSV-to-snapshot transformation
    - Use shared DataTransformer from analytics-core
    - Write district JSON files to snapshot directory
    - Write metadata.json and manifest.json
    - _Requirements: 2.2, 2.3, 2.4_

  - [x] 3.3 Add --transform flag to scrape command
    - Optionally run transformation after scraping
    - _Requirements: 2.5_

  - [x] 3.4 Write unit tests for transform command
    - Test with representative CSV samples
    - Test file structure output
    - _Requirements: 2.4_

- [x] 4. Implement collector-cli compute-analytics command
  - [x] 4.1 Create compute-analytics command structure
    - Add `compute-analytics` command to CLI
    - Implement `--date`, `--districts`, `--force-analytics`, `--verbose` options
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 4.2 Implement AnalyticsWriter service
    - Create `IAnalyticsWriter` interface
    - Implement file writing with metadata (schemaVersion, computedAt, checksum)
    - Write to `analytics/` subdirectory within snapshot
    - _Requirements: 1.6, 3.1, 3.2_

  - [x] 4.3 Implement analytics computation pipeline
    - Load snapshot data from disk
    - Use shared AnalyticsComputer from analytics-core
    - Write district_analytics.json, membership.json, clubhealth.json
    - _Requirements: 1.2, 1.3_

  - [x] 4.4 Implement analytics manifest generation
    - Generate manifest.json with file list and checksums
    - Calculate SHA256 checksums for each file
    - _Requirements: 3.5_

  - [x] 4.5 Implement incremental update logic
    - Check if analytics exist for target date
    - Compare snapshot checksums to detect changes
    - Skip computation if unchanged (unless --force-analytics)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 4.6 Implement error isolation
    - Continue processing if one district fails
    - Log errors with district ID and details
    - Output JSON summary with successes and failures
    - _Requirements: 1.5, 8.4, 8.5, 10.1, 10.2_

  - [x] 4.7 Write property test for JSON round-trip
    - **Property 9: JSON Serialization Round-Trip**
    - **Validates: Requirements 9.6**

  - [x] 4.8 Write property test for manifest checksums
    - **Property 4: Manifest Checksum Validity**
    - **Validates: Requirements 3.5**

  - [x] 4.9 Write unit tests for compute-analytics command
    - Test with specific snapshot examples
    - Test incremental skip behavior
    - Test error isolation with injected failures
    - _Requirements: 5.2, 1.5_

- [x] 5. Checkpoint - Collector CLI commands complete
  - Ensure all tests pass, ask the user if questions arise.
  - Verify transform and compute-analytics commands work end-to-end

- [x] 6. Implement backend PreComputedAnalyticsReader
  - [x] 6.1 Create PreComputedAnalyticsReader service
    - Create `IPreComputedAnalyticsReader` interface
    - Implement file reading from analytics directory
    - Implement schema version validation
    - _Requirements: 4.1, 4.4, 4.5_

  - [x] 6.2 Update analytics API routes
    - Modify `/api/districts/:districtId/analytics` to use PreComputedAnalyticsReader
    - Return 404 if pre-computed analytics not found
    - Return 500 if schema version incompatible or file corrupted
    - Remove on-demand computation code path
    - _Requirements: 4.1, 4.2, 4.5, 4.6_

  - [x] 6.3 Update OpenAPI specification
    - Update `backend/openapi.yaml` with new error responses
    - Document 404 for missing analytics
    - Document 500 for version mismatch
    - _Requirements: 4.2, 4.5_

  - [x] 6.4 Add logging for analytics serving
    - Log when serving pre-computed analytics
    - Log file path and schema version
    - _Requirements: 10.4_

  - [x] 6.5 Write unit tests for PreComputedAnalyticsReader
    - Test with valid analytics files
    - Test 404 for missing files
    - Test 500 for corrupted JSON
    - Test 500 for incompatible schema version
    - _Requirements: 4.2, 4.5, 10.3, 10.5_

- [x] 7. Checkpoint - Backend serving complete
  - Ensure all tests pass, ask the user if questions arise.
  - Verify API returns pre-computed analytics correctly

- [x] 8. Implement collector-cli upload command
  - [x] 8.1 Create upload command structure
    - Add `upload` command to CLI
    - Implement `--date`, `--incremental`, `--dry-run`, `--verbose` options
    - _Requirements: 6.1_

  - [x] 8.2 Implement GCS upload logic
    - Upload snapshot files and analytics files
    - Support incremental uploads (compare checksums)
    - _Requirements: 6.2, 6.3_

  - [x] 8.3 Implement error handling for uploads
    - Continue on individual file failures
    - Output summary with uploaded files and errors
    - _Requirements: 6.4, 6.5_

  - [x] 8.4 Write unit tests for upload command
    - Test with mock GCS client
    - Test incremental upload logic
    - Test error isolation
    - _Requirements: 6.3, 6.4_

- [x] 9. Integration testing and validation
  - [x] 9.1 Write full pipeline integration test
    - Create isolated cache directory
    - Write test CSV files
    - Run transform → compute-analytics → verify files
    - _Requirements: 1.7, 11.5_

  - [x] 9.2 Write backend serving integration test
    - Create isolated cache with pre-computed analytics
    - Start backend with test cache directory
    - Request analytics via API, verify response matches file
    - _Requirements: 4.3, 11.1, 11.2, 11.3_

  - [x] 9.3 Verify API compatibility with frontend
    - Ensure response structure matches DistrictAnalytics type
    - Test with useDistrictAnalytics hook expectations
    - _Requirements: 4.3_

- [x] 10. Final checkpoint - All tests pass
  - Ensure all unit tests pass
  - Ensure all property tests pass
  - Ensure all integration tests pass
  - Ask the user if questions arise

## Notes

- All tasks are required for comprehensive coverage
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (only 3 warranted per PBT guidance)
- Unit tests validate specific examples and edge cases
