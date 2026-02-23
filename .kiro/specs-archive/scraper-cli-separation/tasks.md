# Implementation Plan: Collector CLI Separation

## Overview

This implementation plan separates the Toastmasters dashboard scraping functionality into a standalone CLI tool and modifies the backend to create snapshots exclusively from cached CSV data. The implementation follows an incremental approach, ensuring each step builds on the previous and maintains a working system throughout.

## Tasks

- [x] 1. Create Collector CLI package structure
  - Create `packages/collector-cli/` directory structure
  - Create `package.json` with dependencies (commander, playwright, csv-parse)
  - Create `tsconfig.json` extending root TypeScript config
  - Create `bin/collector-cli` executable entry point
  - _Requirements: 1.1, 8.3_

- [x] 2. Move ToastmastersCollector to Collector CLI
  - [x] 2.1 Copy ToastmastersCollector.ts to `packages/collector-cli/src/services/`
    - Copy the file with all existing functionality
    - Update import paths for the new location
    - _Requirements: 8.3_
  - [x] 2.2 Extract shared types to common location
    - Create shared types for ScrapedRecord, DistrictInfo, CSVType
    - Update imports in both packages
    - _Requirements: 8.3_
  - [x] 2.3 Copy required utilities (logger, CircuitBreaker, RetryManager)
    - Copy utility files needed by the collector
    - Ensure no backend-specific dependencies
    - _Requirements: 8.3, 5.1_

- [x] 3. Implement CollectorOrchestrator
  - [x] 3.1 Create CollectorOrchestrator class
    - Implement configuration loading from district config
    - Implement cache directory resolution
    - Implement scrape orchestration logic
    - _Requirements: 1.2, 7.1, 7.2_
  - [x] 3.2 Implement scrape method with resilient processing
    - Process districts sequentially with error isolation
    - Continue on individual district failures
    - Collect and aggregate results
    - _Requirements: 1.10, 6.1_
  - [x] 3.3 Write property test for partial failure resilience
    - **Property 3: Partial Failure Resilience**
    - **Validates: Requirements 1.10**

- [x] 4. Implement Collector CLI interface
  - [x] 4.1 Create CLI with commander.js
    - Implement `--date` option with YYYY-MM-DD validation
    - Implement `--districts` option with comma-separated parsing
    - Implement `--force`, `--verbose`, `--timeout`, `--config` options
    - _Requirements: 1.3, 1.5, 1.7, 1.8, 7.5_
  - [x] 4.2 Implement JSON output formatting
    - Output scrape summary as JSON on success/failure
    - Include all required fields (timestamp, date, status, districts, cache locations)
    - _Requirements: 1.9_
  - [x] 4.3 Implement exit code logic
    - Exit 0 on full success
    - Exit 1 on partial failure
    - Exit 2 on complete failure or fatal error
    - _Requirements: 1.11_
  - [x] 4.4 Write property test for exit code consistency
    - **Property 4: Exit Code Consistency**
    - **Validates: Requirements 1.11**
  - [x] 4.5 Write property test for date parsing
    - **Property 1: CLI Date Parsing Validity**
    - **Validates: Requirements 1.3**

- [x] 5. Checkpoint - Verify Collector CLI works standalone
  - Ensure all tests pass, ask the user if questions arise.
  - Verify CLI can be invoked and produces expected output
  - Verify cache files are created in correct structure

- [x] 6. Implement SnapshotBuilder service
  - [x] 6.1 Create SnapshotBuilder class in backend
    - Implement cache reading logic (no scraping)
    - Implement cache availability checking
    - Inject RawCSVCacheService and DistrictConfigurationService
    - _Requirements: 3.1, 3.2_
  - [x] 6.2 Implement build method
    - Read CSV data from cache for specified date
    - Normalize data using existing DataNormalizer
    - Validate data using existing DataValidator
    - Calculate rankings using existing RankingCalculator
    - Create snapshot using existing SnapshotStore
    - _Requirements: 3.3, 3.4_
  - [x] 6.3 Implement partial snapshot handling
    - Detect missing districts from cache
    - Create partial snapshot with available data
    - Record missing districts in snapshot metadata
    - _Requirements: 3.5_
  - [x] 6.4 Implement metadata preservation
    - Read closing period info from cache metadata
    - Preserve isClosingPeriod, collectionDate, dataMonth in snapshot
    - _Requirements: 3.7_
  - [x] 6.5 Write property test for SnapshotBuilder isolation
    - **Property 10: SnapshotBuilder Isolation**
    - **Validates: Requirements 3.2, 4.2**
  - [x] 6.6 Write property test for partial snapshot creation
    - **Property 12: Partial Snapshot Creation**
    - **Validates: Requirements 3.5**

- [x] 7. Modify RefreshService to use SnapshotBuilder
  - [x] 7.1 Remove scraping code from RefreshService
    - Remove ToastmastersCollector dependency
    - Remove scrapeData method
    - Remove browser-related cleanup code
    - _Requirements: 8.1, 8.2_
  - [x] 7.2 Integrate SnapshotBuilder into RefreshService
    - Replace scraping logic with SnapshotBuilder.build()
    - Update executeRefresh to check cache availability first
    - Return informative error when cache is missing
    - _Requirements: 4.1, 4.3, 4.4_
  - [x] 7.3 Update refresh-cli.ts
    - Add `--date` parameter support
    - Update to use modified RefreshService
    - Maintain existing CLI options
    - _Requirements: 4.5, 4.6_

- [x] 8. Remove Playwright dependency from backend
  - [x] 8.1 Update backend package.json
    - Remove playwright from dependencies
    - Verify no other code imports playwright
    - _Requirements: 8.4_
  - [x] 8.2 Update backend imports
    - Remove any remaining playwright imports
    - Update type imports if needed
    - _Requirements: 8.4_

- [x] 9. Checkpoint - Verify backend works with cache-only refresh
  - Ensure all tests pass, ask the user if questions arise.
  - Verify refresh endpoint uses SnapshotBuilder
  - Verify no scraping occurs during refresh

- [x] 10. Implement cache integrity validation in SnapshotBuilder
  - [x] 10.1 Add checksum validation
    - Validate file checksums against cache metadata
    - Skip corrupted files with error logging
    - _Requirements: 6.3, 6.4_
  - [x] 10.2 Write property test for cache integrity validation
    - **Property 16: Cache Integrity Validation**
    - **Validates: Requirements 6.3, 6.4**

- [x] 11. Implement configuration consistency
  - [x] 11.1 Ensure shared configuration source
    - Both CLI and backend read from same district config file
    - Both use same cache directory resolution logic
    - _Requirements: 7.1, 7.2, 7.3_
  - [x] 11.2 Write property test for configuration consistency
    - **Property 17: Configuration Consistency**
    - **Validates: Requirements 7.1, 7.2**

- [x] 12. Update existing tests
  - [x] 12.1 Update RefreshService tests
    - Remove scraping-related test cases
    - Add SnapshotBuilder integration tests
    - Mock cache data instead of collector
    - _Requirements: 3.2, 4.2_
  - [x] 12.2 Move collector tests to Collector CLI package
    - Move ToastmastersCollector tests
    - Update test imports and paths
    - _Requirements: 8.3_

- [x] 13. Final checkpoint - Full integration verification
  - Ensure all tests pass, ask the user if questions arise.
  - Verify end-to-end flow: collector-cli → cache → backend refresh → snapshot
  - Verify both tools work independently

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- All property tests are required for comprehensive coverage
