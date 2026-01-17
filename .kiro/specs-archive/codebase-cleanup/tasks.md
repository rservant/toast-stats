# Implementation Plan: Codebase Cleanup

## Overview

This plan implements a comprehensive cleanup of the Toast-Stats codebase in five phases. Each phase is independent and can be executed incrementally. The cleanup removes legacy code, splits large files, consolidates duplicated functionality, and simplifies test infrastructure.

## Tasks

- [x] 1. Baseline verification
  - [x] 1.1 Run full backend test suite and record results
    - Execute `npm test` in backend directory
    - Record number of passing/failing tests
    - _Requirements: 1.6, 5.5_
    - **BASELINE RESULTS (2026-01-09):**
      - Test Files: 78 passed
      - Tests: 881 passed, 0 failed
      - Duration: 27.35s
  - [x] 1.2 Run full frontend test suite and record results
    - Execute `npm test` in frontend directory
    - Record number of passing/failing tests
    - _Requirements: 1.6, 5.5_
    - **BASELINE RESULTS (2026-01-09):**
      - Test Files: 49 passed, 3 skipped
      - Tests: 439 passed, 72 skipped, 0 failed
      - Duration: 11.00s

- [x] 2. Phase 1: Remove Legacy CacheManager System
  - [x] 2.1 Analyze legacy cache endpoint usage
    - Verify no frontend code calls legacy cache endpoints
    - Document which endpoints to remove vs migrate
    - _Requirements: 1.3_
  - [x] 2.2 Update districts routes to remove CacheManager dependency
    - Remove CacheManager import and instantiation from districts.ts
    - Remove toastmastersAPI (RealToastmastersAPIService/MockToastmastersAPIService) usage
    - Update `/cache/dates` to use snapshot store if needed
    - Remove unused cache endpoints (`/cache/statistics`, `/cache/metadata/:date`, `/cache/version`, `/cache/stats`, `DELETE /cache`)
    - _Requirements: 1.3, 1.4_
  - [x] 2.3 Remove legacy service files
    - Delete `backend/src/services/CacheManager.ts`
    - Delete `backend/src/services/RealToastmastersAPIService.ts`
    - Delete `backend/src/services/__tests__/RealToastmastersAPIService.test.ts`
    - _Requirements: 1.1, 1.2_
  - [x] 2.4 Remove legacy utility scripts
    - Delete `backend/scripts/migrate-cache.ts`
    - Delete `backend/scripts/clear-rankings-cache.ts`
    - _Requirements: 1.5_
  - [x] 2.5 Update any remaining imports
    - Search for and remove any remaining CacheManager imports
    - Search for and remove any remaining RealToastmastersAPIService imports
    - _Requirements: 1.1, 1.2_

- [x] 3. Checkpoint - Verify Phase 1
  - Run backend tests to ensure no regressions
  - Ensure all tests pass, ask the user if questions arise

- [x] 4. Phase 2: Split Large Routes File
  - [x] 4.1 Create shared utilities module
    - Create `backend/src/routes/districts/shared.ts`
    - Move validation functions (validateDistrictId, getValidDistrictId)
    - Move shared service instantiation
    - Move common error response helpers
    - _Requirements: 2.8_
  - [x] 4.2 Create core routes module
    - Create `backend/src/routes/districts/core.ts`
    - Move district listing endpoints (GET /)
    - Move district detail endpoints (GET /:districtId)
    - Move clubs endpoints (GET /:districtId/clubs)
    - Move membership endpoints
    - _Requirements: 2.5_
  - [x] 4.3 Create analytics routes module
    - Create `backend/src/routes/districts/analytics.ts`
    - Move analytics endpoints (GET /:districtId/analytics)
    - Move trends endpoints
    - Move division/area comparison endpoints
    - Move year-over-year endpoints
    - _Requirements: 2.2_
  - [x] 4.4 Create backfill routes module
    - Create `backend/src/routes/districts/backfill.ts`
    - Move global backfill endpoints (POST /backfill, GET /backfill/:id, DELETE /backfill/:id)
    - Move district backfill endpoints (POST /:districtId/backfill, etc.)
    - _Requirements: 2.3_
  - [x] 4.5 Create snapshots routes module
    - Create `backend/src/routes/districts/snapshots.ts`
    - Move snapshot listing endpoints
    - Move cached dates endpoints (GET /:districtId/cached-dates)
    - Move any remaining cache-related endpoints
    - _Requirements: 2.4_
  - [x] 4.6 Create index module to compose routes
    - Create `backend/src/routes/districts/index.ts`
    - Import and compose all route modules
    - Export the composed router
    - _Requirements: 2.6_
  - [x] 4.7 Update main routes import
    - Update `backend/src/index.ts` to import from new location
    - Remove old `backend/src/routes/districts.ts`
    - _Requirements: 2.1_

- [x] 4.8 Write property test for route composition
  - **Property 3: Route Module Composition**
  - **Validates: Requirements 2.7**

- [x] 5. Checkpoint - Verify Phase 2
  - Run backend tests to ensure no regressions
  - Verify all API endpoints still work
  - Ensure all tests pass, ask the user if questions arise
  - **VERIFIED (2026-01-09):**
    - Test Files: 78 passed
    - Tests: 872 passed, 0 failed
    - Duration: 27.36s
    - Fixed property test for route composition (response structure validation)

- [x] 6. Phase 3: Consolidate Backfill Hooks
  - [x] 6.1 Refactor useBackfill hook to support both modes
    - Add optional districtId parameter to hook functions
    - Update endpoint URL construction based on districtId presence
    - Maintain existing function signatures for backward compatibility
    - _Requirements: 3.1, 3.2, 3.5, 3.6_
  - [x] 6.2 Update components using useDistrictBackfill
    - Update BackfillProgressBar to use unified hook
    - Update any other components using useDistrictBackfill
    - _Requirements: 3.3_
  - [x] 6.3 Remove useDistrictBackfill.ts
    - Delete `frontend/src/hooks/useDistrictBackfill.ts`
    - Verify no remaining imports
    - _Requirements: 3.4_

- [x] 6.4 Write property test for unified backfill hook
  - **Property 2: Unified Backfill Hook Behavior**
  - **Validates: Requirements 3.2, 3.5, 3.6**

- [x] 7. Checkpoint - Verify Phase 3
  - Run frontend tests to ensure no regressions
  - Ensure all tests pass, ask the user if questions arise
  - **VERIFIED (2026-01-09):**
    - Test Files: 50 passed, 3 skipped
    - Tests: 447 passed, 72 skipped, 0 failed
    - Duration: 10.79s
    - Compared to baseline: +1 test file, +8 tests (from property test addition)

- [x] 8. Phase 4: Simplify Test Infrastructure
  - [x] 8.1 Analyze test utility usage
    - Search for imports of TestPerformanceMonitor in backend
    - Search for imports of IntegratedTestMonitor
    - Document which utilities are actually used
    - _Requirements: 4.1_
    - **ANALYSIS RESULTS (2026-01-09):**
      - `TestPerformanceMonitor` - Only used by IntegratedTestMonitor (unused)
      - `IntegratedTestMonitor` - Not imported anywhere outside its own file
      - `TestReliabilityMonitor` - Only used by other unused utilities
      - `test-infrastructure.ts` - Not imported anywhere
      - Utilities kept: TestIsolationManager, PropertyTestInfrastructure, test-self-cleanup, test-cache-helper, test-data-factories, test-string-generators
  - [x] 8.2 Remove unused backend test utilities
    - Remove TestPerformanceMonitor if unused outside own tests
    - Remove IntegratedTestMonitor if unused
    - Keep TestReliabilityMonitor if used by property tests
    - _Requirements: 4.2_
    - **REMOVED (2026-01-09):**
      - `backend/src/utils/IntegratedTestMonitor.ts`
      - `backend/src/utils/TestPerformanceMonitor.ts`
      - `backend/src/utils/TestReliabilityMonitor.ts`
      - `backend/src/utils/test-infrastructure.ts`
      - 3 test files for removed utilities
  - [x] 8.3 Consolidate remaining test utilities
    - Create simplified test-helpers.ts if needed
    - Update imports in test files
    - _Requirements: 4.3_
    - **RESULT (2026-01-09):** No consolidation needed - remaining utilities are well-organized with distinct purposes
  - [x] 8.4 Document test infrastructure
    - Create or update README in test utils directory
    - Document remaining utilities and their purpose
    - _Requirements: 4.5_
    - **CREATED (2026-01-09):** `backend/src/utils/TEST_UTILITIES_README.md`

- [x] 9. Checkpoint - Verify Phase 4
  - Run all tests to ensure no regressions
  - Ensure all tests pass, ask the user if questions arise
  - **VERIFIED (2026-01-09):**
    - Backend: 75 test files, 858 tests passed (reduced from baseline due to removed unused test utilities)
    - Frontend: 50 test files, 447 tests passed, 72 skipped
    - Duration: Backend 27.30s, Frontend 10.95s
    - All tests pass - Phase 4 cleanup successful

- [x] 10. Phase 5: Remove Dead Code
  - [x] 10.1 Remove backend debug scripts
    - Delete `backend/src/services/__inspect-all-districts.ts`
    - Delete `backend/src/services/__inspect-club-page.ts`
    - Delete `backend/src/services/__inspect-csv.ts`
    - Delete `backend/src/services/__inspect-page.ts`
    - Delete `backend/src/services/__inspect-statuses.ts`
    - Delete `backend/src/services/__scrape-districts.ts`
    - Delete `backend/src/services/__test-cache.ts`
    - Delete `backend/src/services/__test-scraper.ts`
    - _Requirements: 5.1_
  - [x] 10.2 Remove unused ProcessSeparationMonitor
    - Delete `backend/src/services/ProcessSeparationMonitor.ts`
    - Remove commented import from admin.ts
    - _Requirements: 5.2_
  - [x] 10.3 Remove unused frontend demo components
    - Delete `frontend/src/components/BrandComplianceDemo.tsx`
    - Delete `frontend/src/components/Navigation/NavigationExample.tsx`
    - _Requirements: 5.3_
  - [x] 10.4 Consolidate context folders
    - Move `frontend/src/context/AuthContext.tsx` to `frontend/src/contexts/`
    - Update imports in useAuth.ts and test files
    - Delete empty `frontend/src/context/` folder
    - _Requirements: 5.4_

- [x] 11. Final Checkpoint - Complete Validation
  - Run full backend test suite
  - Run full frontend test suite
  - Compare results to baseline from task 1
  - Ensure all tests pass, ask the user if questions arise
  - **FINAL RESULTS (2026-01-09):**
    - Backend: 76 test files, 867 tests passed, 0 failed
    - Frontend: 50 test files, 447 tests passed, 72 skipped, 0 failed
    - Duration: Backend 27.27s, Frontend 10.89s
  - **COMPARISON TO BASELINE:**
    - Backend baseline: 78 files, 881 tests → Final: 76 files, 867 tests
    - Reduction due to removal of unused test utilities (Phase 4)
    - Frontend baseline: 49 files, 439 tests → Final: 50 files, 447 tests
    - Increase due to new property tests (Property 2 and Property 3)
  - **CLEANUP VALIDATED:** All functionality preserved, no regressions

- [x] 11.1 Write property test for functionality preservation
  - **Property 1: Existing Functionality Preservation**
  - **Validates: Requirements 1.6, 2.7, 3.3, 4.4, 5.5**
  - Created: `backend/src/__tests__/functionality-preservation.property.test.ts`
  - 9 property tests validating API response structure preservation

## Notes

- Each phase can be executed independently
- Checkpoints ensure incremental validation
- If any phase causes test failures, investigate before proceeding
- The baseline verification in task 1 is critical for validating the cleanup
- Property tests validate that the cleanup maintains existing behavior
