# Implementation Plan: Admin Routes Refactor

## Overview

This plan implements the refactoring of `admin.ts` (1,478 lines) into focused route modules following the established `districts/` pattern. The implementation proceeds incrementally, ensuring API compatibility at each step.

## Tasks

- [x] 1. Create admin route module structure
  - [x] 1.1 Create `backend/src/routes/admin/` directory structure
    - Create admin/ directory with placeholder files
    - _Requirements: 1.6, 2.7, 3.8, 4.4_
  - [x] 1.2 Create shared utilities module (`admin/shared.ts`)
    - Extract `logAdminAccess` middleware
    - Add `generateOperationId` helper
    - Add `getServiceFactory` wrapper
    - Define shared types (`AdminErrorResponse`, `AdminResponseMetadata`)
    - _Requirements: 6.1, 6.4_
  - [x] 1.3 Write unit tests for shared utilities
    - Test `logAdminAccess` middleware behavior
    - Test `generateOperationId` uniqueness
    - _Requirements: 6.2_

- [x] 2. Extract snapshot routes
  - [x] 2.1 Create `admin/snapshots.ts` module
    - Move `GET /snapshots` handler
    - Move `GET /snapshots/:snapshotId` handler
    - Move `GET /snapshots/:snapshotId/payload` handler
    - Import shared middleware and utilities
    - _Requirements: 1.1, 1.2, 1.3, 1.5_
  - [x] 2.2 Write unit tests for snapshot routes
    - Test list snapshots with filters
    - Test get snapshot details
    - Test get snapshot payload
    - Test error handling
    - _Requirements: 7.1_

- [x] 3. Extract district configuration routes
  - [x] 3.1 Create `admin/district-config.ts` module
    - Move `GET /districts/config` handler
    - Move `POST /districts/config` handler
    - Move `DELETE /districts/config/:districtId` handler
    - Move `POST /districts/config/validate` handler
    - Move `GET /districts/config/history` handler
    - Import shared middleware and utilities
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  - [x] 3.2 Write unit tests for district configuration routes
    - Test get configuration
    - Test add/replace districts
    - Test remove district
    - Test validate configuration
    - Test get history
    - _Requirements: 7.1_

- [x] 4. Extract monitoring routes
  - [x] 4.1 Create `admin/monitoring.ts` module
    - Move `GET /snapshot-store/health` handler
    - Move `GET /snapshot-store/integrity` handler
    - Move `GET /snapshot-store/performance` handler
    - Move `POST /snapshot-store/performance/reset` handler
    - Import shared middleware and utilities
    - _Requirements: 3.1, 3.2, 3.3, 3.7_
  - [x] 4.2 Write unit tests for monitoring routes
    - Test health check
    - Test integrity check
    - Test performance metrics
    - Test metrics reset
    - _Requirements: 7.1_

- [x] 5. Extract process separation routes
  - [x] 5.1 Create `admin/process-separation.ts` module
    - Move `GET /process-separation/validate` handler
    - Move `GET /process-separation/monitor` handler
    - Move `GET /process-separation/compliance` handler
    - Move `GET /process-separation/independence` handler
    - Import shared middleware and utilities
    - _Requirements: 4.1, 4.2, 4.3_
  - [x] 5.2 Write unit tests for process separation routes
    - Test validate process separation
    - Test monitor concurrent operations
    - Test compliance metrics
    - Test independence validation
    - _Requirements: 7.1_

- [x] 6. Create router aggregation
  - [x] 6.1 Create `admin/index.ts` router composition
    - Import all route modules
    - Mount routes in correct order
    - Export default router
    - _Requirements: 1.5, 2.6, 3.7, 4.3_
  - [x] 6.2 Update original `admin.ts` to re-export
    - Replace implementation with re-export from `admin/index.js`
    - Maintain backward compatibility for existing imports
    - _Requirements: 5.1_

- [x] 7. Checkpoint - Verify API compatibility
  - Ensure all existing tests pass
  - Verify all endpoints respond at original paths
  - Ask the user if questions arise

- [x] 8. Migrate and update tests
  - [x] 8.1 Move existing integration tests
    - Move `admin.integration.test.ts` to `admin/__tests__/`
    - Update imports to use new module structure
    - Verify tests pass without modification
    - _Requirements: 7.1_
  - [x] 8.2 Write property test for API equivalence
    - **Property 1: API Path Preservation**
    - **Validates: Requirements 5.1, 5.2, 5.3**
  - [x] 8.3 Write property test for middleware consistency
    - **Property 3: Middleware Application Consistency**
    - **Validates: Requirements 5.4, 6.2**

- [x] 9. Final verification
  - [x] 9.1 Verify file line counts
    - Confirm snapshots.ts ≤ 400 lines
    - Confirm district-config.ts ≤ 500 lines
    - Confirm monitoring.ts ≤ 400 lines
    - Confirm process-separation.ts ≤ 200 lines
    - _Requirements: 1.6, 2.7, 3.8, 4.4_
  - [x] 9.2 Run full test suite
    - Run all backend tests
    - Verify no regressions
    - _Requirements: 7.1, 7.2_

- [x] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise

## Notes

- All tasks are required for comprehensive testing
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
