# Implementation Plan: District-Scoped Data Collection

## Overview

This implementation plan transforms the current system from collecting all ~128 global districts to a configurable, selective approach with per-district snapshot storage. The implementation follows the requirements-first workflow and builds incrementally on the existing RefreshService and FileSnapshotStore architecture.

## Tasks

- [x] 1. Create district configuration service and storage
  - Create `DistrictConfigurationService` class with CRUD operations for district configuration
  - Implement configuration storage in `config/districts.json` with validation
  - Add district ID validation supporting both numeric ("42") and alphabetic ("F") formats
  - _Requirements: 1.1, 1.3, 1.4, 1.5_

- [x]\* 1.1 Write property test for district configuration persistence
  - **Property 1: District Configuration Persistence**
  - **Validates: Requirements 1.5**

- [x]\* 1.2 Write property test for district ID format support
  - **Property 2: District ID Format Support**
  - **Validates: Requirements 1.4**

- [x] 2. Enhance RefreshService for selective district processing
  - Modify `RefreshService.extractDistrictIds()` to use configured districts instead of all districts
  - Update `RefreshService.scrapeData()` to only process configured districts
  - Add configuration validation before refresh operations
  - _Requirements: 1.2, 2.2, 2.3, 9.5_

- [x]\* 2.1 Write property test for selective data collection
  - **Property 5: Selective Data Collection**
  - **Validates: Requirements 2.2**

- [x]\* 2.2 Write property test for complete district data fetching
  - **Property 6: Complete District Data Fetching**
  - **Validates: Requirements 2.3**

- [x]\* 2.3 Write property test for configuration validation enforcement
  - **Property 3: Configuration Validation Enforcement**
  - **Validates: Requirements 1.2, 9.5**

- [x] 3. Implement per-district snapshot storage
  - Create `PerDistrictSnapshotStore` extending `FileSnapshotStore`
  - Implement directory-based snapshot structure: `snapshots/{snapshot_id}/district_{district_id}.json`
  - Add `metadata.json` and `manifest.json` files to snapshot directories
  - Update `current.json` pointer maintenance for new format
  - _Requirements: 3.1, 3.2, 6.1, 6.2, 6.4, 6.5_

- [ ]\* 3.1 Write property test for per-district snapshot structure
  - **Property 9: Per-District Snapshot Structure**
  - **Validates: Requirements 3.1, 3.2, 6.1, 6.2**

- [ ]\* 3.2 Write property test for snapshot metadata completeness
  - **Property 10: Snapshot Metadata Completeness**
  - **Validates: Requirements 3.3, 6.4**

- [ ]\* 3.3 Write property test for current snapshot pointer maintenance
  - **Property 16: Current Snapshot Pointer Maintenance**
  - **Validates: Requirements 6.5**

- [x] 4. Create district data aggregator service
  - Implement `DistrictDataAggregator` for efficient per-district file reading
  - Add selective file access for district-specific API requests
  - Implement caching for frequently accessed district files
  - _Requirements: 3.4, 7.1, 7.2, 7.3_

- [ ]\* 4.1 Write property test for data aggregation consistency
  - **Property 11: Data Aggregation Consistency**
  - **Validates: Requirements 3.4**

- [ ]\* 4.2 Write property test for selective file access
  - **Property 17: Selective File Access**
  - **Validates: Requirements 7.1, 7.2**

- [ ]\* 4.3 Write property test for file access caching
  - **Property 18: File Access Caching**
  - **Validates: Requirements 7.3**

- [x] 5. Add error handling and resilience features
  - Implement partial snapshot creation when some districts fail
  - Add detailed error tracking per district in snapshot metadata
  - Implement retry logic for failed districts in subsequent refreshes
  - _Requirements: 2.4, 2.5, 8.1, 8.4, 8.5_

- [ ]\* 5.1 Write property test for resilient processing
  - **Property 7: Resilient Processing**
  - **Validates: Requirements 2.4**

- [ ]\* 5.2 Write property test for success/failure tracking
  - **Property 8: Success/Failure Tracking**
  - **Validates: Requirements 2.5, 9.2**

- [ ]\* 5.3 Write property test for partial snapshot creation
  - **Property 21: Partial Snapshot Creation**
  - **Validates: Requirements 8.1**

- [x] 6. Create admin API endpoints for district configuration
  - Add `GET /api/admin/districts/config` to view current configuration
  - Add `POST /api/admin/districts/config` to add districts
  - Add `DELETE /api/admin/districts/config/:districtId` to remove districts
  - Add authentication and validation for all configuration endpoints
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ]\* 6.1 Write property test for admin interface completeness
  - **Property 15: Admin Interface Completeness**
  - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

- [x] 7. Add configuration validation and feedback features
  - Implement district ID validation against all-districts summary
  - Add warnings for non-existent districts with suggestions for typos
  - Display last successful collection date for each configured district
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [ ]\* 7.1 Write property test for district ID validation
  - **Property 4: District ID Validation**
  - **Validates: Requirements 1.3, 10.1**

- [ ]\* 7.2 Write property test for invalid district warnings
  - **Property 23: Invalid District Warnings**
  - **Validates: Requirements 9.2**

- [ ]\* 7.3 Write property test for district ID recommendations
  - **Property 24: District ID Recommendations**
  - **Validates: Requirements 9.3**

- [x] 8. Implement incremental district management
  - Add support for adding new districts without affecting existing snapshots
  - Implement district removal while preserving historical data
  - Add configuration change logging and effects tracking
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ]\* 8.1 Write property test for configuration change effects
  - **Property 13: Configuration Change Effects**
  - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

- [ ]\* 8.2 Write property test for configuration change logging
  - **Property 14: Configuration Change Logging**
  - **Validates: Requirements 4.5**

- [ ] 9. Add performance monitoring and metrics
  - Implement performance metrics collection for per-district file access
  - Add monitoring for selective file access patterns
  - Create performance reporting for district-scoped operations
  - _Requirements: 7.5_

- [ ]\* 9.1 Write property test for performance metrics collection
  - **Property 19: Performance Metrics Collection**
  - **Validates: Requirements 7.5**

- [x] 10. Update existing API routes for new snapshot format
  - Modify district routes to work with per-district snapshot files
  - Ensure backward compatibility for existing API responses
  - Update snapshot serving logic to use new aggregation service
  - _Requirements: 8.2_

- [ ]\* 10.1 Write property test for new snapshot format usage
  - **Property 20: New Snapshot Format Usage**
  - **Validates: Requirements 8.2**

- [x] 11. Integration and testing checkpoint
  - Ensure all tests pass and integration works end-to-end
  - Verify district configuration, refresh, and API serving work together
  - Test error scenarios and recovery mechanisms
  - Ask the user if questions arise

- [x] 12. Integrate BackfillService with snapshot creation
  - Modify BackfillService to use PerDistrictSnapshotStore instead of direct cache storage
  - Update backfill operations to create snapshot directories containing individual per-district JSON files
  - Add snapshot metadata generation for backfill operations including source and job tracking
  - Implement current snapshot pointer updates for recent backfill dates
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ]\* 12.1 Write property test for backfill snapshot creation
  - **Property 26: Backfill Snapshot Creation**
  - **Validates: Requirements 10.1, 10.2**

- [ ]\* 12.2 Write property test for backfill snapshot store integration
  - **Property 27: Backfill Snapshot Store Integration**
  - **Validates: Requirements 10.3**

- [ ]\* 12.3 Write property test for backfill current pointer updates
  - **Property 28: Backfill Current Pointer Updates**
  - **Validates: Requirements 10.4**

- [ ]\* 12.4 Write property test for backfill metadata completeness
  - **Property 29: Backfill Metadata Completeness**
  - **Validates: Requirements 10.5**

- [x] 13. Enhance BackfillService error handling for snapshot operations
  - Implement partial snapshot creation when some districts fail during backfill
  - Add district-specific error tracking in backfill snapshot metadata
  - Ensure backfill operations respect current district configuration scope
  - Add integration between backfill jobs and snapshot validation
  - _Requirements: 10.6, 10.7_

- [ ]\* 13.1 Write property test for backfill partial snapshot handling
  - **Property 30: Backfill Partial Snapshot Handling**
  - **Validates: Requirements 10.6**

- [ ]\* 13.2 Write property test for backfill district scope compliance
  - **Property 31: Backfill District Scope Compliance**
  - **Validates: Requirements 10.7**

- [ ] 14. Final validation and cleanup
  - Run comprehensive test suite including property-based tests
  - Validate all requirements are met through automated testing
  - Clean up any temporary code or debugging artifacts
  - Ensure all tests pass, ask the user if questions arise

## Notes

- Tasks marked with `*` are optional property-based tests that can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation and user feedback
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The implementation builds incrementally on existing RefreshService and FileSnapshotStore architecture
