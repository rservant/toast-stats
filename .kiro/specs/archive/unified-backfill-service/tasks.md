# Implementation Plan: BackfillService

## Overview

This implementation plan creates a complete rewrite of the historical data backfill system, replacing existing BackfillService and DistrictBackfillService with a modern, unified BackfillService. The new service leverages RefreshService methods as the primary data acquisition mechanism and provides a clean, modern API interface.

The plan includes both backend service implementation and frontend component updates to ensure seamless integration with the new unified API.

## Tasks

- [x] 1. Create core BackfillService structure
  - Create new BackfillService class with modern TypeScript patterns
  - Implement unified job queue and progress tracking
  - Set up integration with PerDistrictFileSnapshotStore
  - _Requirements: 1.1, 1.3, 1.4, 1.5_

- [ ]\* 1.1 Write property test for job queue unification
  - **Property 1: Job Queue Unification**
  - **Validates: Requirements 1.4, 4.1, 4.2**

- [x] 2. Implement RefreshService-based data collection
  - Create DataSourceSelector that delegates to RefreshService methods
  - Implement collection strategy selection based on scope and requirements
  - Add support for system-wide, per-district, and targeted collection via RefreshService
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ]\* 2.1 Write property test for RefreshService integration
  - **Property 3: RefreshService Method Delegation**
  - **Validates: Requirements 3.1, 3.2, 3.5**

- [x] 3. Implement scope management and validation
  - Create ScopeManager for district targeting and validation
  - Integrate with DistrictConfigurationService for scope enforcement
  - Add support for flexible targeting options (single, multi, system-wide)
  - _Requirements: 2.1, 2.2, 2.3, 7.1, 7.3, 7.4_

- [ ]\* 3.1 Write property test for targeting scope validation
  - **Property 2: Targeting Scope Validation**
  - **Validates: Requirements 2.3, 7.4**

- [ ]\* 3.2 Write property test for configuration scope enforcement
  - **Property 7: Configuration Scope Enforcement**
  - **Validates: Requirements 7.3, 7.5**

- [x] 4. Remove legacy services and update all consumers
  - Remove existing BackfillService and DistrictBackfillService files
  - Update all route handlers to use new BackfillService
  - Update any other consumers of the legacy services
  - _Requirements: 1.1, 10.1_

- [ ]\* 4.1 Write integration tests for service replacement
  - Test that new BackfillService handles all previous use cases
  - Verify all route handlers work with new service
  - _Requirements: 1.1, 10.1_

- [x] 5. Implement modern API endpoints
  - Create clean, modern POST endpoint for backfill initiation
  - Implement comprehensive error handling with clear messages
  - Add proper HTTP status codes and response headers
  - _Requirements: 8.1, 8.2, 8.4, 8.5_

- [ ]\* 5.1 Write property test for API design
  - **Property 8: Modern API Response Consistency**
  - **Validates: Requirements 8.3, 8.4**

- [x] 6. Implement enhanced error handling and resilience
  - Add district-level error tracking with detailed context
  - Implement partial snapshot creation for mixed success/failure scenarios
  - Add retry logic with exponential backoff for transient failures
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ]\* 6.1 Write property test for error resilience
  - **Property 6: Error Resilience and Partial Success**
  - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**

- [x] 7. Implement consistent snapshot storage with RefreshService compatibility
  - Ensure all operations use PerDistrictFileSnapshotStore
  - Maintain full compatibility with RefreshService snapshot formats
  - Add proper metadata for collection method and scope
  - _Requirements: 5.1, 5.2, 5.5, 11.3_

- [ ]\* 7.1 Write property test for RefreshService compatibility
  - **Property 4: Snapshot Format Consistency**
  - **Validates: Requirements 5.1, 5.2, 11.3**

- [x] 8. Implement performance optimizations
  - Add rate limiting to protect external data sources
  - Implement configurable concurrency limits for district processing
  - Add caching for intermediate results to avoid redundant operations
  - _Requirements: 9.1, 9.2, 9.3_

- [ ]\* 8.1 Write property test for concurrent processing limits
  - **Property 9: Concurrent Processing Limits**
  - **Validates: Requirements 9.2**

- [ ]\* 8.2 Write property test for rate limiting protection
  - **Property 10: Rate Limiting Protection**
  - **Validates: Requirements 9.1**

- [ ] 9. Checkpoint - Ensure all core functionality works
  - Core functionality has critical issues with snapshot creation
  - Data collection works (CSV download and parsing successful) but snapshots are not being created
  - Need to debug the data transformation pipeline between CSV parsing and snapshot storage
  - Performance optimizations are integrated but cannot be fully validated until snapshot creation is fixed

- [x] 10. Update frontend components for unified backfill service
  - Update BackfillButton component to support new API interface
  - Enhance BackfillContext for improved state management
  - Update API hooks to use unified endpoints
  - Add support for enhanced progress tracking and error display
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [ ]\* 10.1 Write property test for frontend API compatibility
  - **Property 11: Frontend API Compatibility**
  - **Validates: Requirements 12.1, 12.3, 12.4**

- [x] 11. Add comprehensive documentation and examples
  - Create clear API documentation with examples
  - Add inline code documentation
  - Create usage examples for common scenarios
  - _Requirements: 10.4_

- [ ] 11.1 Write end-to-end integration tests
  - Test complete workflows from request to snapshot creation
  - Test error scenarios and recovery mechanisms
  - Verify RefreshService integration works correctly
  - **Note: Needs to be re-run after fixing snapshot creation issue in task 12**
  - _Requirements: 11.1, 11.2, 11.5_

- [x] 12. Debug and fix snapshot creation failure
  - Investigate why CSV data parsing succeeds but snapshot creation fails
  - Fix the data transformation pipeline between CSV parsing and snapshot storage
  - Ensure RefreshService integration properly converts parsed CSV data to DistrictStatistics format
  - Validate that PerDistrictFileSnapshotStore receives properly formatted data
  - Test the complete pipeline from CSV download through snapshot creation
  - _Requirements: 5.1, 5.2, 11.3, 6.1_

- [ ] 13. Final checkpoint - Complete system validation
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties
- This is a complete rewrite - no backward compatibility concerns
- The new BackfillService leverages RefreshService methods as the primary data source
- All legacy services and their consumers will be completely replaced
