# Implementation Plan: Data Refresh Architecture

## Overview

This implementation plan transforms the current tightly-coupled system into a clean snapshot-based architecture. The approach separates data refresh from read operations through a SnapshotStore abstraction, ensuring consistent performance and reliability.

## Tasks

- [x] 1. Set up core snapshot infrastructure and interfaces
  - Create SnapshotStore interface with getLatestSuccessful(), getLatest(), writeSnapshot(), and listSnapshots() methods
  - Define Snapshot, NormalizedData, and SnapshotMetadata TypeScript interfaces
  - Set up directory structure under CACHE_DIR/snapshots/ with current.json pointer file
  - _Requirements: 5.1, 5.4, 8.1, 8.2_

- [ ]\* 1.1 Write property test for SnapshotStore interface compliance
  - **Property 17: SnapshotStore Interface Compliance**
  - **Validates: Requirements 5.1**

- [ ] 2. Implement FileSnapshotStore with atomic operations
  - [x] 2.1 Create FileSnapshotStore class implementing SnapshotStore interface
    - Implement getLatestSuccessful() using current.json pointer
    - Implement getLatest() by scanning snapshot directory
    - Implement atomic writeSnapshot() with temporary file and rename
    - Implement listSnapshots() with filtering and limiting support
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]\* 2.2 Write property test for atomic snapshot persistence
    - **Property 18: Atomic Snapshot Persistence**
    - **Validates: Requirements 5.2**

  - [ ]\* 2.3 Write property test for dual query support
    - **Property 19: Dual Query Support**
    - **Validates: Requirements 5.3**

  - [ ]\* 2.4 Write property test for current pointer maintenance
    - **Property 20: Current Pointer Maintenance**
    - **Validates: Requirements 5.4**

- [ ] 3. Create data validation system with Zod schemas
  - [x] 3.1 Implement DataValidator class with comprehensive schema validation
    - Define Zod schema for NormalizedData structure
    - Implement validate() method returning ValidationResult
    - Add validation for required fields, data types, and business rules
    - _Requirements: 6.1, 6.2_

  - [ ]\* 3.2 Write property test for schema validation
    - **Property 22: Schema Validation**
    - **Validates: Requirements 6.1**

  - [ ]\* 3.3 Write property test for validation rejection
    - **Property 23: Validation Rejection**
    - **Validates: Requirements 6.2**

- [x] 4. Implement RefreshService orchestration logic
  - [x] 4.1 Create RefreshService class with complete refresh workflow
    - Implement executeRefresh() method coordinating scraping, normalization, validation
    - Add scrapeData() method integrating with existing ToastmastersScraper
    - Add normalizeData() method converting raw scraping results to NormalizedData
    - Add createSnapshot() method with proper versioning and error handling
    - _Requirements: 2.2, 2.4, 2.5, 4.1, 4.2, 4.3_

  - [ ]\* 4.2 Write property test for successful refresh creates success snapshot
    - **Property 8: Successful Refresh Creates Success Snapshot**
    - **Validates: Requirements 2.4**

  - [ ]\* 4.3 Write property test for failed refresh preserves current pointer
    - **Property 9: Failed Refresh Preserves Current Pointer**
    - **Validates: Requirements 2.5, 4.1, 4.3**

  - [ ]\* 4.4 Write property test for error logging in failed snapshots
    - **Property 14: Error Logging in Failed Snapshots**
    - **Validates: Requirements 4.2**

- [x] 5. Add retry logic and circuit breaker patterns
  - [x] 5.1 Implement network retry logic with exponential backoff
    - Integrate with existing RetryManager utility
    - Add circuit breaker pattern for scraping operations
    - Handle network timeouts and connection failures gracefully
    - _Requirements: 4.5_

  - [ ]\* 5.2 Write property test for network retry logic
    - **Property 16: Network Retry Logic**
    - **Validates: Requirements 4.5**

- [-] 6. Create admin refresh HTTP endpoint with authentication
  - [ ] 6.1 Implement AdminRefreshController with ADMIN_TOKEN authentication
    - Create POST /api/admin/refresh endpoint
    - Add ADMIN_TOKEN validation middleware
    - Integrate with RefreshService for actual refresh execution
    - Return structured JSON response with refresh status and snapshot_id
    - _Requirements: 2.1, 2.6_

  - [ ]\* 6.2 Write property test for admin authentication required
    - **Property 6: Admin Authentication Required**
    - **Validates: Requirements 2.1**

  - [ ]\* 6.3 Write unit tests for authentication edge cases
    - Test missing token, invalid token, and malformed requests
    - _Requirements: 2.1_

- [-] 7. Create CLI refresh script with shared logic
  - [x] 7.1 Implement CLI script using shared RefreshService
    - Create npm run refresh script in package.json
    - Add CLI argument parsing for optional parameters
    - Share RefreshService logic between HTTP endpoint and CLI
    - Add proper exit codes and error handling
    - _Requirements: 2.6_

  - [ ]\* 7.2 Write property test for dual execution support
    - **Property 10: Dual Execution Support**
    - **Validates: Requirements 2.6**

- [x] 8. Checkpoint - Ensure refresh system works end-to-end
  - Ensure all refresh tests pass, ask the user if questions arise.

- [-] 9. Modify existing read endpoints to use SnapshotStore
  - [x] 9.1 Update district routes to serve from snapshots instead of direct scraping
    - Modify existing endpoints in /api/districts/\* to use SnapshotStore.getLatestSuccessful()
    - Remove direct scraping triggers from read operations
    - Add snapshot metadata to API responses (created_at, schema_version, calculation_version)
    - Return HTTP 503 with structured error when no snapshot available
    - _Requirements: 1.1, 1.2, 3.1, 3.2, 3.3, 7.1, 7.2_

  - [ ]\* 9.2 Write property test for reads never trigger scraping
    - **Property 1: Read Operations Never Trigger Scraping**
    - **Validates: Requirements 1.1**

  - [ ]\* 9.3 Write property test for reads always serve latest successful snapshot
    - **Property 2: Reads Always Serve Latest Successful Snapshot**
    - **Validates: Requirements 1.2, 3.5**

  - [ ]\* 9.4 Write property test for timestamp metadata inclusion
    - **Property 11: Timestamp Metadata Inclusion**
    - **Validates: Requirements 3.1, 7.1**

  - [ ]\* 9.5 Write property test for version metadata inclusion
    - **Property 12: Version Metadata Inclusion**
    - **Validates: Requirements 3.3, 8.1, 8.2**

- [x] 10. Implement error handling for no snapshot scenarios
  - [x] 10.1 Add structured error responses for missing snapshots
    - Return HTTP 503 with JSON error when no successful snapshot exists
    - Include helpful error messages and recovery guidance
    - Ensure error responses are frontend-friendly
    - _Requirements: 3.2, 7.2_

  - [ ]\* 10.2 Write example test for no snapshot available error
    - Test specific scenario when no successful snapshot exists
    - **Validates: Requirements 3.2**

  - [ ]\* 10.3 Write property test for structured error responses
    - **Property 27: Structured Error Responses**
    - **Validates: Requirements 7.2**

- [ ] 11. Add comprehensive logging with snapshot ID correlation
  - [x] 11.1 Implement logging throughout refresh and read operations
    - Add structured logging with snapshot IDs in all related operations
    - Log refresh operation timing, status, and error information
    - Include snapshot metadata in log entries for correlation
    - _Requirements: 6.3, 6.4_

  - [ ]\* 11.2 Write property test for refresh operation logging
    - **Property 24: Refresh Operation Logging**
    - **Validates: Requirements 6.3**

  - [ ]\* 11.3 Write property test for snapshot ID correlation
    - **Property 25: Snapshot ID Correlation**
    - **Validates: Requirements 6.4**

- [-] 12. Implement performance monitoring and metrics
  - [ ] 12.1 Add metrics collection for refresh operations and read performance
    - Track refresh success rates, duration, and failure reasons
    - Monitor read endpoint response times and throughput
    - Add metrics for snapshot storage usage and performance
    - _Requirements: 6.5, 1.5_

  - [ ]\* 12.2 Write property test for metrics collection
    - **Property 26: Metrics Collection**
    - **Validates: Requirements 6.5**

  - [ ]\* 12.3 Write property test for sub-second response times
    - **Property 5: Sub-Second Response Times**
    - **Validates: Requirements 1.5**

- [ ] 13. Add snapshot versioning and evolution support
  - [ ] 13.1 Implement schema and calculation version management
    - Add version tracking for data structure changes
    - Implement version evolution logic for new snapshots
    - Preserve historical version information in existing snapshots
    - Add cross-version comparison support
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ]\* 13.2 Write property test for version preservation
    - **Property 28: Version Preservation**
    - **Validates: Requirements 8.3**

  - [ ]\* 13.3 Write property test for version evolution
    - **Property 29: Version Evolution**
    - **Validates: Requirements 8.4**

  - [ ]\* 13.4 Write property test for cross-version comparison
    - **Property 30: Cross-Version Comparison**
    - **Validates: Requirements 8.5**

- [x] 14. Implement advanced error handling and recovery
  - [x] 14.1 Add corruption detection and recovery mechanisms
    - Implement snapshot integrity validation
    - Add recovery procedures for corrupted current.json pointer
    - Provide clear error messages and recovery guidance
    - Add automatic fallback to previous successful snapshots
    - _Requirements: 4.4_

  - [ ]\* 14.2 Write property test for corruption error handling
    - **Property 15: Corruption Error Handling**
    - **Validates: Requirements 4.4**

- [-] 15. Add performance optimizations and concurrent access handling
  - [x] 15.1 Implement performance optimizations for read operations
    - Add concurrent read request handling without performance degradation
    - Ensure read performance independence from refresh operations
    - Optimize file system access patterns and caching
    - _Requirements: 1.3, 1.4_

  - [ ]\* 15.2 Write property test for concurrent read performance
    - **Property 3: Concurrent Read Performance**
    - **Validates: Requirements 1.3**

  - [ ]\* 15.3 Write property test for read performance independence
    - **Property 4: Read Performance Independence**
    - **Validates: Requirements 1.4**

- [-] 16. Implement snapshot listing and debugging features
  - [x] 16.1 Add snapshot management and debugging capabilities
    - Implement snapshot listing with filtering and limiting
    - Add snapshot metadata inspection tools
    - Create debugging endpoints for snapshot analysis
    - _Requirements: 5.5_

  - [ ]\* 16.2 Write property test for snapshot listing functionality
    - **Property 21: Snapshot Listing Functionality**
    - **Validates: Requirements 5.5**

- [x] 17. Add process separation validation
  - [x] 17.1 Ensure refresh operations run independently from read operations
    - Validate that refresh processes don't block read operations
    - Ensure read operations continue during refresh execution
    - Add monitoring for process separation compliance
    - _Requirements: 2.2, 2.3_

  - [ ]\* 17.2 Write property test for refresh process separation
    - **Property 7: Refresh Process Separation**
    - **Validates: Requirements 2.2, 2.3**

- [x] 18. Implement failed snapshot exclusion logic
  - [x] 18.1 Ensure failed snapshots are never served to read endpoints
    - Add filtering logic to exclude failed snapshots from serving
    - Validate that only successful snapshots are returned by getLatestSuccessful()
    - Add tests for failed snapshot exclusion
    - _Requirements: 3.4_

  - [ ]\* 18.2 Write property test for failed snapshots not served
    - **Property 13: Failed Snapshots Not Served**
    - **Validates: Requirements 3.4**

- [x] 19. Final integration testing and validation
  - [ ] 19.1 Run comprehensive integration tests
    - Test end-to-end refresh workflows with real data
    - Validate read endpoint behavior during refresh operations
    - Test error recovery scenarios and graceful degradation
    - Verify all authentication and authorization flows
    - _Requirements: All_

  - [ ]\* 19.2 Write integration tests for complete workflows
    - Test complete refresh-to-read cycles
    - Test failure recovery scenarios
    - _Requirements: All_

- [x] 20. Final checkpoint - Ensure all tests pass and system is production ready
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using fast-check library
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end workflows
- The implementation follows the existing TypeScript/Node.js backend architecture
- All new code should integrate with existing services like ToastmastersScraper, RetryManager, and logger utilities
