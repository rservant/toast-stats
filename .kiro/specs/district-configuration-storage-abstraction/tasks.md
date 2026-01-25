# Implementation Plan: District Configuration Storage Abstraction

## Overview

This implementation extends the storage abstraction layer to include district configuration storage, following the established pattern used by `ISnapshotStorage` and `IRawCSVStorage`. The work is organized to build incrementally: interface definition → local implementation → Firestore implementation → factory integration → service refactoring → route updates.

## Tasks

- [ ] 1. Define IDistrictConfigStorage interface and types
  - [ ] 1.1 Add IDistrictConfigStorage interface to storageInterfaces.ts
    - Define `getConfiguration(): Promise<DistrictConfiguration | null>`
    - Define `saveConfiguration(config: DistrictConfiguration): Promise<void>`
    - Define `appendChangeLog(change: ConfigurationChange): Promise<void>`
    - Define `getChangeHistory(limit: number): Promise<ConfigurationChange[]>`
    - Define `isReady(): Promise<boolean>`
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 2. Implement LocalDistrictConfigStorage
  - [ ] 2.1 Create LocalDistrictConfigStorage class in backend/src/services/storage/
    - Implement IDistrictConfigStorage interface
    - Store configuration in `cache/config/districts.json`
    - Store audit logs in `cache/config/district-changes.log`
    - Use atomic file writes (temp file + rename)
    - Create directories if they don't exist
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  
  - [ ] 2.2 Write property test for LocalDistrictConfigStorage round-trip
    - **Property 1: Configuration Round-Trip Consistency**
    - **Validates: Requirements 2.1, 3.1**
  
  - [ ] 2.3 Write unit tests for LocalDistrictConfigStorage
    - Test file path construction
    - Test directory creation on first write
    - Test atomic write behavior
    - Test backward compatibility with existing files
    - Test error handling for filesystem errors
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 3. Checkpoint - Ensure local storage tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement FirestoreDistrictConfigStorage
  - [ ] 4.1 Create FirestoreDistrictConfigStorage class in backend/src/services/storage/
    - Implement IDistrictConfigStorage interface
    - Store configuration in Firestore document at `config/districts`
    - Store history in subcollection `config/districts/history`
    - Use GCP_PROJECT_ID from environment
    - Integrate with CircuitBreaker pattern
    - Handle transient errors as retryable
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  
  - [ ] 4.2 Write property test for FirestoreDistrictConfigStorage round-trip
    - **Property 1: Configuration Round-Trip Consistency**
    - **Validates: Requirements 2.1, 3.1**
  
  - [ ] 4.3 Write unit tests for FirestoreDistrictConfigStorage
    - Test document path construction
    - Test circuit breaker integration
    - Test retryable error classification
    - Test subcollection query ordering
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 5. Extend StorageProviderFactory
  - [ ] 5.1 Update StorageProviders interface to include districtConfigStorage
    - Add `districtConfigStorage: IDistrictConfigStorage` to StorageProviders
    - _Requirements: 4.4_
  
  - [ ] 5.2 Update createLocalProviders to create LocalDistrictConfigStorage
    - Instantiate LocalDistrictConfigStorage with cacheDir
    - Return in StorageProviders result
    - _Requirements: 4.3_
  
  - [ ] 5.3 Update createGCPProviders to create FirestoreDistrictConfigStorage
    - Instantiate FirestoreDistrictConfigStorage with projectId
    - Return in StorageProviders result
    - _Requirements: 4.2_
  
  - [ ] 5.4 Write property test for storage provider selection
    - **Property 2: Storage Provider Selection Consistency**
    - **Validates: Requirements 4.1, 4.2, 4.3**
  
  - [ ] 5.5 Write unit tests for StorageProviderFactory extension
    - Test environment variable parsing for district config
    - Test provider type selection
    - Test configuration validation
    - _Requirements: 4.1, 4.2, 4.3_

- [ ] 6. Checkpoint - Ensure factory tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Refactor DistrictConfigurationService
  - [ ] 7.1 Update DistrictConfigurationService constructor to accept IDistrictConfigStorage
    - Add storage parameter to constructor
    - Remove direct file path handling from constructor
    - Initialize default configuration
    - _Requirements: 5.1_
  
  - [ ] 7.2 Delegate storage operations to injected storage
    - Update loadConfiguration to use storage.getConfiguration()
    - Update saveConfiguration to use storage.saveConfiguration()
    - Update logConfigurationChange to use storage.appendChangeLog()
    - Update getConfigurationHistory to use storage.getChangeHistory()
    - _Requirements: 5.2_
  
  - [ ] 7.3 Preserve existing public API and validation logic
    - Ensure all public methods remain unchanged
    - Keep validation and normalization logic in service
    - Maintain cache invalidation behavior
    - _Requirements: 5.3, 5.4_
  
  - [ ] 7.4 Write property test for validation preservation
    - **Property 4: Validation Preservation**
    - **Validates: Requirements 5.4**
  
  - [ ] 7.5 Write unit tests for refactored DistrictConfigurationService
    - Test constructor injection
    - Test cache invalidation
    - Test validation logic preservation
    - Test delegation to storage
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 8. Update route integration
  - [ ] 8.1 Update backend/src/routes/districts/shared.ts
    - Obtain storage from StorageProviderFactory
    - Create DistrictConfigurationService with injected storage
    - _Requirements: 6.1_
  
  - [ ] 8.2 Update backend/src/routes/admin/district-config.ts
    - Ensure routes use storage-abstracted service
    - Verify no API changes required
    - _Requirements: 6.2_
  
  - [ ] 8.3 Update ScopeManager usage if needed
    - Verify ScopeManager receives properly configured service
    - _Requirements: 6.3_
  
  - [ ] 8.4 Write integration tests for route updates
    - Test admin routes with both storage backends
    - Test backward compatibility
    - _Requirements: 6.1, 6.2, 6.3_

- [ ] 9. Checkpoint - Ensure integration tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Error handling and edge cases
  - [ ] 10.1 Implement consistent error handling across storage implementations
    - Throw StorageOperationError with operation name and provider type
    - Log all operations with structured logging
    - Return false from isReady() without throwing when storage unavailable
    - _Requirements: 7.1, 7.2, 7.3_
  
  - [ ] 10.2 Write property test for error type consistency
    - **Property 5: Error Type Consistency**
    - **Validates: Requirements 7.1**
  
  - [ ] 10.3 Write property test for empty configuration default
    - **Property 6: Empty Configuration Default**
    - **Validates: Requirements 8.3**
  
  - [ ] 10.4 Write property test for change history ordering
    - **Property 7: Change History Ordering**
    - **Validates: Requirements 1.2, 3.2**

- [ ] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks are required for comprehensive implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation follows the existing storage abstraction pattern established by ISnapshotStorage and IRawCSVStorage
