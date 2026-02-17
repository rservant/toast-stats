# Requirements Document

## Introduction

This feature removes all backfill capability from the backend application to enforce the architectural principle that the backend is a read-only API server. The backend currently contains two backfill systems (legacy and unified) that violate the data-computation-separation steering document. All data computation and historical data collection must happen in the scraper-cli pipeline, not in the backend. This removal covers backend routes, services, storage implementations, types, singleton lifecycle management, documentation, OpenAPI specifications, and all frontend code that references backfill functionality.

## Glossary

- **Backend**: The Express.js API server in `backend/` that serves pre-computed data via REST endpoints
- **Legacy_Backfill_System**: The original backfill implementation consisting of `backend/src/routes/admin/backfill.ts`, `backend/src/services/BackfillService.ts`, and the `backend/src/services/backfill/` directory (excluding `unified/`)
- **Unified_Backfill_System**: The newer consolidated backfill implementation in `backend/src/services/backfill/unified/`, `backend/src/routes/admin/unified-backfill.ts`, and associated types/storage
- **Backfill_Storage**: Storage implementations for persisting backfill job state, including `LocalBackfillJobStorage` and `FirestoreBackfillJobStorage`
- **StorageProviderFactory**: The factory class in `backend/src/services/storage/StorageProviderFactory.ts` that creates storage provider instances including backfill job storage
- **Admin_Route_Index**: The router composition module at `backend/src/routes/admin/index.ts` that mounts all admin sub-routers
- **Server_Startup_Module**: The main entry point at `backend/src/index.ts` that initializes services and starts the server
- **OpenAPI_Spec**: The API specification files at `backend/openapi.yaml` (Swagger 2.0) and `docs/openapi.yaml` (OpenAPI 3.0.3)
- **Frontend_Backfill_Code**: All frontend hooks, contexts, components, and page sections related to backfill functionality
- **Monitoring_Route**: The admin monitoring endpoint at `backend/src/routes/admin/monitoring.ts` that reports system health metrics
- **District_Routes**: The district-level route modules that contain backfill-related error messages and references

## Requirements

### Requirement 1: Remove Legacy Backfill Backend Routes and Services

**User Story:** As a maintainer, I want to remove the legacy backfill route and service files from the backend, so that the backend no longer contains code that violates the read-only API server principle.

#### Acceptance Criteria

1. WHEN the legacy backfill route file `backend/src/routes/admin/backfill.ts` is removed, THE Admin_Route_Index SHALL no longer import or mount the `backfillRouter`
2. WHEN the legacy backfill service files are removed, THE Backend SHALL no longer contain `backend/src/services/BackfillService.ts` or any files in `backend/src/services/backfill/` (excluding the `unified/` subdirectory which is addressed in Requirement 2)
3. WHEN the legacy backfill re-export module `backend/src/services/UnifiedBackfillService.ts` is removed, THE Backend SHALL no longer contain that file
4. WHEN the legacy backfill test file `backend/src/routes/admin/__tests__/backfill.test.ts` is removed, THE Backend SHALL no longer contain that test file
5. THE Backend SHALL compile without TypeScript errors after all legacy backfill code is removed

### Requirement 2: Remove Unified Backfill Backend Routes and Services

**User Story:** As a maintainer, I want to remove the unified backfill route and service files from the backend, so that the larger and more complex backfill system is fully eliminated.

#### Acceptance Criteria

1. WHEN the unified backfill route file `backend/src/routes/admin/unified-backfill.ts` is removed, THE Admin_Route_Index SHALL no longer import or mount the `unifiedBackfillRouter`
2. WHEN the unified backfill service directory `backend/src/services/backfill/unified/` is removed, THE Backend SHALL no longer contain the `UnifiedBackfillService`, `JobManager`, `DataCollector`, `AnalyticsGenerator`, or `RecoveryManager` files
3. WHEN the unified backfill test files in `backend/src/services/backfill/unified/__tests__/` are removed, THE Backend SHALL no longer contain those test files
4. WHEN the unified backfill route test file `backend/src/routes/admin/__tests__/unified-backfill.test.ts` is removed, THE Backend SHALL no longer contain that test file
5. WHEN all files in `backend/src/services/backfill/` are removed (both legacy and unified), THE Backend SHALL no longer contain the `backend/src/services/backfill/` directory
6. THE Backend SHALL compile without TypeScript errors after all unified backfill code is removed

### Requirement 3: Remove Backfill Types and Storage Implementations

**User Story:** As a maintainer, I want to remove all backfill-related type definitions and storage implementations, so that no backfill data contracts or persistence code remains in the backend.

#### Acceptance Criteria

1. WHEN the backfill API types file `backend/src/types/backfillJob.ts` is removed, THE Backend SHALL no longer contain that file
2. WHEN the backfill storage interface `IBackfillJobStorage` and its associated types (`BackfillJob`, `BackfillJobStatus`, `BackfillJobType`, `JobConfig`, `JobProgress`, `JobCheckpoint`, `JobResult`, `RateLimitConfig`, `ListJobsOptions`, `DistrictProgress`, `JobError`) are removed from `backend/src/types/storageInterfaces.ts`, THE file SHALL retain all non-backfill interfaces and types intact
3. WHEN the local backfill storage implementation `backend/src/services/storage/LocalBackfillJobStorage.ts` is removed, THE Backend SHALL no longer contain that file
4. WHEN the Firestore backfill storage implementation `backend/src/services/storage/FirestoreBackfillJobStorage.ts` is removed, THE Backend SHALL no longer contain that file
5. WHEN the `backfillJobStorage` property is removed from the `StorageProviders` interface and its creation logic in `StorageProviderFactory`, THE StorageProviderFactory SHALL continue to create all non-backfill storage providers correctly
6. THE Backend SHALL compile without TypeScript errors after all backfill types and storage code is removed

### Requirement 4: Remove Backfill Singleton and Server Startup Logic

**User Story:** As a maintainer, I want to remove the UnifiedBackfillService singleton and its recovery logic from the server startup module, so that the backend no longer initializes or manages backfill services on startup.

#### Acceptance Criteria

1. WHEN the `getUnifiedBackfillServiceInstance` and `resetUnifiedBackfillServiceInstance` functions are removed from `backend/src/index.ts`, THE Server_Startup_Module SHALL no longer export those functions
2. WHEN the backfill recovery initialization block is removed from the server startup sequence, THE Server_Startup_Module SHALL start the server without attempting backfill job recovery
3. WHEN the `UnifiedBackfillService` import is removed from `backend/src/index.ts`, THE Server_Startup_Module SHALL no longer reference any backfill modules
4. THE Backend SHALL compile without TypeScript errors after the singleton and startup logic is removed

### Requirement 5: Clean Up Backfill References in Remaining Backend Code

**User Story:** As a maintainer, I want to remove all remaining references to backfill in non-backfill backend code, so that no dangling imports, error messages, or function calls reference removed backfill functionality.

#### Acceptance Criteria

1. WHEN the `getPendingBackfillJobCount` import and usage is removed from `backend/src/routes/admin/monitoring.ts`, THE Monitoring_Route SHALL set `pendingOperations` to `0` in the system health response
2. WHEN backfill-related service initialization is removed from `backend/src/routes/districts/shared.ts`, THE file SHALL no longer import `BackfillService` or maintain a `_backfillService` variable, and the `getBackfillService` function SHALL be removed
3. WHEN backfill-related error message strings in district route files (`analyticsSummary.ts`, `analytics.ts`) are updated, THE District_Routes SHALL replace backfill-specific recommendations with guidance to use the scraper-cli pipeline
4. WHEN test files that mock `getUnifiedBackfillServiceInstance` are updated, THE test files SHALL no longer mock that function
5. THE Backend SHALL compile without TypeScript errors after all backfill references are cleaned up

### Requirement 6: Update OpenAPI Specifications

**User Story:** As a maintainer, I want to remove all backfill endpoint documentation from both OpenAPI specification files, so that the API documentation accurately reflects the available endpoints.

#### Acceptance Criteria

1. WHEN backfill endpoints are removed from `backend/openapi.yaml`, THE OpenAPI_Spec SHALL no longer contain the `/admin/backfill`, `/admin/backfill/{jobId}`, `/admin/unified-backfill`, `/admin/unified-backfill/jobs`, `/admin/unified-backfill/preview`, or `/admin/unified-backfill/config/rate-limit` endpoint definitions
2. WHEN backfill-related references in analytics endpoint descriptions are updated in `backend/openapi.yaml`, THE descriptions SHALL replace backfill recommendations with guidance to use the scraper-cli pipeline
3. WHEN backfill schemas and references are removed from `docs/openapi.yaml`, THE file SHALL no longer contain `BackfillRequest`, `BackfillStatus`, `BACKFILL_NOT_FOUND`, `BACKFILL_ERROR`, or the `Backfill` tag definition
4. WHEN backfill-related references in analytics and snapshot descriptions are updated in `docs/openapi.yaml`, THE descriptions SHALL replace backfill recommendations with guidance to use the scraper-cli pipeline
5. THE OpenAPI_Spec files SHALL remain valid after all backfill references are removed

### Requirement 7: Remove Frontend Backfill Code

**User Story:** As a maintainer, I want to remove all frontend backfill hooks, contexts, components, and page sections, so that the frontend no longer contains UI for triggering or monitoring backfill operations.

#### Acceptance Criteria

1. WHEN the `BackfillContext` file `frontend/src/contexts/BackfillContext.tsx` is removed, THE Frontend_Backfill_Code SHALL no longer provide a `BackfillProvider` or `useBackfillContext` hook
2. WHEN the backfill hooks files `frontend/src/hooks/useBackfill.ts` and `frontend/src/hooks/useUnifiedBackfill.ts` are removed, THE Frontend_Backfill_Code SHALL no longer contain API hooks for backfill operations
3. WHEN the backfill components `DistrictBackfillButton.tsx`, `BackfillProgressBar.tsx`, `JobProgressDisplay.tsx`, `JobHistoryList.tsx`, and `RateLimitConfigPanel.tsx` are removed from `frontend/src/components/`, THE Frontend_Backfill_Code SHALL no longer contain those component files
4. WHEN the `BackfillProvider` wrapper and `BackfillProgressBar` rendering are removed from `frontend/src/App.tsx`, THE App component SHALL render the application without any backfill context or progress UI
5. WHEN the `BackfillSection` and all backfill-related UI are removed from `frontend/src/pages/AdminPage.tsx`, THE AdminPage SHALL display remaining admin sections (Snapshots, System Health) without any backfill controls
6. WHEN backfill-related text and icons are updated in `frontend/src/pages/DistrictDetailPage.tsx`, `frontend/src/pages/LandingPage.tsx`, `frontend/src/components/DistrictOverview.tsx`, `frontend/src/components/LeadershipInsights.tsx`, and `frontend/src/components/DCPGoalAnalysis.tsx`, THE pages and components SHALL replace backfill references with guidance to use the scraper-cli or Admin Panel for data collection
7. WHEN the `BackfillProvider` is removed from test utilities in `frontend/src/__tests__/test-utils.tsx`, THE test utility SHALL render without the backfill context wrapper
8. WHEN test files that mock or import `BackfillContext` are updated, THE test files SHALL no longer reference backfill context or providers
9. THE Frontend SHALL compile without TypeScript errors after all backfill code is removed

### Requirement 8: Remove Backfill Documentation and Data Files

**User Story:** As a maintainer, I want to remove all backfill-related documentation files and data directories, so that no stale documentation or cached job data remains in the repository.

#### Acceptance Criteria

1. WHEN the backfill documentation files are removed, THE Backend SHALL no longer contain `backend/docs/README-unified-backfill.md`, `backend/docs/unified-backfill-api-reference.md`, `backend/docs/unified-backfill-examples.md`, `backend/docs/unified-backfill-quick-start.md`, or `backend/docs/unified-backfill-service.md`
2. WHEN the backfill data directory `backend/data/cache/backfill-jobs/` is removed, THE Backend SHALL no longer contain that directory
3. IF the `backend/data/cache/backfill-jobs/` directory is tracked in version control, THEN THE removal SHALL include removing it from the repository

### Requirement 9: Verify System Integrity After Removal

**User Story:** As a maintainer, I want to verify that the entire system compiles and all remaining tests pass after the backfill removal, so that I have confidence the removal did not break any non-backfill functionality.

#### Acceptance Criteria

1. THE Backend SHALL compile with zero TypeScript errors after all backfill code is removed
2. THE Frontend SHALL compile with zero TypeScript errors after all backfill code is removed
3. WHEN the remaining backend test suite is executed, THE test suite SHALL pass with no failures caused by missing backfill references
4. WHEN the remaining frontend test suite is executed, THE test suite SHALL pass with no failures caused by missing backfill references
5. THE `EmptyState` component in `frontend/src/components/ErrorDisplay.tsx` SHALL retain the `backfill` icon option or replace it with a suitable alternative icon, so that pages using `icon="backfill"` continue to render correctly
