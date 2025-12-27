# Implementation Plan: Cache Location Configuration

## Overview

This implementation plan converts the cache location configuration design into a series of coding tasks that will make all on-disk caching locations configurable through a single `CACHE_DIR` environment variable. The approach focuses on creating a centralized configuration service and updating all cache service initializations to use consistent configuration.

## Tasks

- [x] 1. Create Cache Configuration Service
  - Create `CacheConfigService` singleton class for centralized cache directory management
  - Implement environment variable reading with `CACHE_DIR` support
  - Add path resolution and validation logic
  - Include security validation to prevent path traversal attacks
  - _Requirements: 1.1, 1.2, 1.3, 3.1_

- [x] 1.1 Write property test for cache configuration service
  - **Property 1: Environment Variable Configuration**
  - **Validates: Requirements 1.1, 1.2**

- [x] 1.2 Write property test for default fallback behavior
  - **Property 2: Default Fallback Behavior**
  - **Validates: Requirements 1.3**

- [x] 1.3 Write property test for security validation
  - **Property 4: Security Validation**
  - **Validates: Requirements 1.5, 4.1, 4.2**

- [x] 2. Implement Configuration Validation ✅ **COMPLETED**
  - Create `CacheDirectoryValidator` class for path security validation
  - Add write permission verification during initialization
  - Implement error handling and logging for validation failures
  - Add fallback logic when configured paths are invalid
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 2.1 Write property test for permission validation ✅ **COMPLETED**
  - **Property 6: Permission Validation**
  - **Validates: Requirements 4.3, 4.4**

- [x] 2.2 Write property test for validation failure fallback ✅ **COMPLETED**
  - **Property 7: Fallback on Validation Failure**
  - **Validates: Requirements 4.5, 4.4**

- [x] 3. Update Main Application Routes ✅ **COMPLETED**
  - Modify `backend/src/routes/districts.ts` to use `CacheConfigService`
  - Replace hardcoded `new CacheManager()` with configured initialization
  - Replace hardcoded `new DistrictCacheManager()` with configured initialization
  - Ensure all route-level cache managers use consistent configuration
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 3.1 Write property test for service configuration consistency ✅ **COMPLETED**
  - **Property 3: Service Configuration Consistency**
  - **Validates: Requirements 1.4, 2.1, 2.2, 2.4, 3.3, 6.4**
  - **Status: All 21 property-based tests passing**

- [x] 4. Update Assessment Module Configuration
  - Modify `CacheIntegrationService` to use `CacheConfigService`
  - Replace `selectCachePath()` method with configuration service usage
  - Remove dependency on `DISTRICT_CACHE_DIR` environment variable
  - Update assessment module to use unified `CACHE_DIR` configuration
  - _Requirements: 3.4, 6.2, 6.3_

- [x] 4.1 Write property test for unified configuration usage
  - **Property 5: Unified Configuration Usage**
  - **Validates: Requirements 3.1, 6.2, 6.3**

- [x] 5. Update Other Cache Service Initializations ✅ **COMPLETED**
  - Find and update any other locations that initialize cache services
  - Ensure all cache services use the configuration service
  - Verify no hardcoded cache paths remain in the codebase
  - Update service constructors to use configured cache directories
  - _Requirements: 6.1, 2.5_

- [x] 5.1 Write property test for configuration migration ✅ **COMPLETED**
  - **Property 10: Configuration Migration**
  - **Validates: Requirements 6.1**

- [x] 5.2 Write property test for backward compatibility ✅ **COMPLETED**
  - **Property 8: Backward Compatibility**
  - **Validates: Requirements 2.5, 6.5**

- [ ] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Update Test Configurations
  - Update test files to use configurable cache directories
  - Ensure test isolation with separate cache locations
  - Add support for parallel test execution with different cache directories
  - Update test cleanup to handle configurable cache directories
  - _Requirements: 5.1, 5.4, 5.5_

- [ ] 7.1 Write property test for test environment isolation
  - **Property 9: Test Environment Isolation**
  - **Validates: Requirements 5.1, 5.4, 5.5**

- [ ] 8. Update Configuration Files and Documentation
  - Update `.env.example` files to include `CACHE_DIR` configuration
  - Remove `DISTRICT_CACHE_DIR` references from configuration files
  - Update Docker and deployment configurations to use `CACHE_DIR`
  - Create configuration examples for different deployment scenarios
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 9. Update Assessment Module Tests
  - Update `cacheIntegrationService.path.test.ts` to test new configuration
  - Remove tests for `DISTRICT_CACHE_DIR` environment variable
  - Add tests for `CACHE_DIR` configuration usage
  - Ensure test coverage for configuration service integration
  - _Requirements: 6.2, 6.3_

- [ ] 10. Final Integration Testing
  - Test complete cache configuration system end-to-end
  - Verify all cache services use consistent configuration
  - Test error scenarios and fallback behavior
  - Validate security measures and path validation
  - _Requirements: All requirements validation_

- [ ] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks are required for comprehensive implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation maintains existing cache functionality while adding configurability
- Security validation is prioritized to prevent path traversal vulnerabilities
