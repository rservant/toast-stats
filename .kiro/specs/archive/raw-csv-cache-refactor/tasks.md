# Implementation Plan: Raw CSV Cache Service Refactor

## Overview

This plan extracts cross-cutting concerns from `RawCSVCacheService.ts` into focused modules while preserving the existing public API. The implementation follows a bottom-up approach: extract independent modules first, then integrate them into the main service.

## Tasks

- [x] 1. Extract CacheSecurityManager module
  - [x] 1.1 Create ICacheSecurityManager interface in serviceInterfaces.ts
    - Define all method signatures from design document
    - Add SecurityConfig type for configuration
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 1.2 Implement CacheSecurityManager class
    - Extract validatePathSafety from RawCSVCacheService
    - Extract validateCacheDirectoryBounds from RawCSVCacheService
    - Extract setSecureFilePermissions from RawCSVCacheService
    - Extract setSecureDirectoryPermissions from RawCSVCacheService
    - Extract validateCSVContentSecurity from RawCSVCacheService
    - Extract sanitizeDistrictId from RawCSVCacheService
    - Extract validateDistrictId from RawCSVCacheService
    - Extract validateDateString from RawCSVCacheService
    - Extract validateCSVContent from RawCSVCacheService
    - Ensure file is ≤300 lines
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7_

  - [x] 1.3 Write unit tests for CacheSecurityManager
    - Test path traversal rejection
    - Test directory bounds validation
    - Test CSV content security validation
    - Test district ID sanitization
    - _Requirements: 6.2_

  - [x] 1.4 Write property test for security validation correctness
    - **Property 3: Security Validation Correctness**
    - **Validates: Requirements 2.1, 2.2, 2.4, 2.5**

- [x] 2. Extract CacheIntegrityValidator module
  - [x] 2.1 Create ICacheIntegrityValidator interface in serviceInterfaces.ts
    - Define all method signatures from design document
    - Add IntegrityValidationResult, CorruptionDetectionResult, RecoveryResult types
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 2.2 Implement CacheIntegrityValidator class
    - Extract validateMetadataIntegrity logic from RawCSVCacheService
    - Extract detectCorruption logic from RawCSVCacheService
    - Extract attemptCorruptionRecovery logic from RawCSVCacheService
    - Extract recalculateIntegrityTotals logic from RawCSVCacheService
    - Extract repairMetadataIntegrity logic from RawCSVCacheService
    - Inject ILogger dependency via constructor
    - Ensure file is ≤400 lines
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 5.1_

  - [x] 2.3 Write unit tests for CacheIntegrityValidator
    - Test metadata validation against file system state
    - Test corruption detection for various content types
    - Test recovery operations
    - Test integrity totals recalculation
    - _Requirements: 6.2_

  - [x] 2.4 Write property test for integrity validation correctness
    - **Property 1: Integrity Validation Correctness**
    - **Validates: Requirements 1.1, 1.2, 1.4**

  - [x] 2.5 Write property test for corruption detection and recovery
    - **Property 2: Corruption Detection and Recovery**
    - **Validates: Requirements 1.2, 1.3**

- [x] 3. Checkpoint - Verify extracted modules
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Integrate extracted modules into RawCSVCacheService
  - [x] 4.1 Update RawCSVCacheService constructor
    - Add optional ICacheIntegrityValidator parameter
    - Add optional ICacheSecurityManager parameter
    - Add optional CircuitBreaker parameter (from existing utils)
    - Create default instances when not provided
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 4.2 Replace inline security logic with CacheSecurityManager delegation
    - Replace validatePathSafety calls with securityManager.validatePathSafety
    - Replace validateCacheDirectoryBounds calls with securityManager.validateCacheDirectoryBounds
    - Replace setSecureFilePermissions calls with securityManager.setSecureFilePermissions
    - Replace setSecureDirectoryPermissions calls with securityManager.setSecureDirectoryPermissions
    - Replace validateCSVContentSecurity calls with securityManager.validateCSVContentSecurity
    - Replace sanitizeDistrictId calls with securityManager.sanitizeDistrictId
    - Replace validateDistrictId calls with securityManager.validateDistrictId
    - Replace validateDateString calls with securityManager.validateDateString
    - Replace validateCSVContent calls with securityManager.validateCSVContent
    - Remove extracted private methods from RawCSVCacheService
    - _Requirements: 2.6_

  - [x] 4.3 Replace inline integrity logic with CacheIntegrityValidator delegation
    - Replace validateMetadataIntegrity implementation with integrityValidator delegation
    - Replace detectCorruption calls with integrityValidator.detectCorruption
    - Replace attemptCorruptionRecovery calls with integrityValidator.attemptCorruptionRecovery
    - Replace recalculateIntegrityTotals calls with integrityValidator.recalculateIntegrityTotals
    - Replace repairMetadataIntegrity implementation with integrityValidator delegation
    - Remove extracted private methods from RawCSVCacheService
    - _Requirements: 1.5_

  - [x] 4.4 Replace inline circuit breaker logic with CircuitBreaker class
    - Replace circuitBreaker state object with CircuitBreaker instance
    - Replace isCircuitBreakerOpen with circuitBreaker.execute wrapper
    - Replace recordCircuitBreakerFailure with CircuitBreaker error handling
    - Replace resetCircuitBreaker with circuitBreaker.reset
    - Update getCircuitBreakerStatus to use circuitBreaker.getStats
    - Update resetCircuitBreakerManually to use circuitBreaker.reset
    - Remove extracted private methods from RawCSVCacheService
    - _Requirements: 3.5_

- [x] 5. Checkpoint - Verify existing tests pass
  - Ensure all existing RawCSVCacheService tests pass without modification.
  - _Requirements: 6.1_

- [x] 6. Add integration tests for refactored service
  - [x] 6.1 Write integration tests for dependency injection
    - Test service creation with default dependencies
    - Test service creation with mock dependencies
    - Verify mock dependencies are called correctly
    - _Requirements: 5.2, 5.3, 5.4_

  - [x] 6.2 Write property test for behavioral equivalence
    - **Property 5: Behavioral Equivalence (API Preservation)**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

- [x] 7. Final checkpoint - Verify all tests pass and coverage maintained
  - Ensure all tests pass, ask the user if questions arise.
  - Verify test coverage percentage has not decreased.
  - _Requirements: 6.1, 6.3_

## Notes

- All tasks are required for comprehensive coverage
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The existing `CircuitBreaker` class in `backend/src/utils/CircuitBreaker.ts` is reused rather than creating a new implementation
