# Implementation Plan: Remove Backend Backfill

## Overview

Systematic removal of all backfill code from backend and frontend, working from outermost references inward to minimize intermediate compilation errors. Each task group removes a layer and cleans up references before moving to the next.

## Tasks

- [x] 1. Remove backend backfill routes and server startup hooks
  - [x] 1.1 Remove backfill route registrations from admin router
    - In `backend/src/routes/admin/index.ts`: remove imports of `backfillRouter` and `unifiedBackfillRouter`, remove `router.use('/backfill', ...)` and `router.use('/unified-backfill', ...)` mounts, remove associated comments
    - _Requirements: 1.1, 2.1_
  - [x] 1.2 Remove UnifiedBackfillService singleton and recovery logic from server startup
    - In `backend/src/index.ts`: remove `UnifiedBackfillService` import, remove `unifiedBackfillServiceInstance` variable, remove `getUnifiedBackfillServiceInstance()` and `resetUnifiedBackfillServiceInstance()` functions and their exports, remove the entire backfill recovery initialization block (the try/catch that calls `initialize()`)
    - _Requirements: 4.1, 4.2, 4.3_
  - [x] 1.3 Delete backfill route files
    - Delete `backend/src/routes/admin/backfill.ts`
    - Delete `backend/src/routes/admin/unified-backfill.ts`
    - _Requirements: 1.1, 2.1_
  - [x] 1.4 Delete backfill route test files
    - Delete `backend/src/routes/admin/__tests__/backfill.test.ts`
    - Delete `backend/src/routes/admin/__tests__/unified-backfill.test.ts`
    - _Requirements: 1.4, 2.4_

- [x] 2. Remove backend backfill services
  - [x] 2.1 Delete all backfill service files and directories
    - Delete `backend/src/services/BackfillService.ts`
    - Delete `backend/src/services/UnifiedBackfillService.ts`
    - Delete entire `backend/src/services/backfill/` directory (including `unified/` and `__tests__/`)
    - _Requirements: 1.2, 1.3, 2.2, 2.3, 2.5_

- [x] 3. Remove backend backfill types and storage
  - [x] 3.1 Delete backfill API types file
    - Delete `backend/src/types/backfillJob.ts`
    - _Requirements: 3.1_
  - [x] 3.2 Remove backfill types from storageInterfaces.ts
    - In `backend/src/types/storageInterfaces.ts`: remove `IBackfillJobStorage` interface, `BackfillJob` interface, and all supporting types (`BackfillJobStatus`, `BackfillJobType`, `JobConfig`, `DistrictProgress`, `JobError`, `JobProgress`, `JobCheckpoint`, `JobResult`, `RateLimitConfig`, `ListJobsOptions`). Keep all non-backfill interfaces intact.
    - _Requirements: 3.2_
  - [x] 3.3 Delete backfill storage implementation files
    - Delete `backend/src/services/storage/LocalBackfillJobStorage.ts`
    - Delete `backend/src/services/storage/FirestoreBackfillJobStorage.ts`
    - _Requirements: 3.3, 3.4_
  - [x] 3.4 Remove backfillJobStorage from StorageProviderFactory
    - In `backend/src/services/storage/StorageProviderFactory.ts`: remove `IBackfillJobStorage` import, remove `LocalBackfillJobStorage` and `FirestoreBackfillJobStorage` imports, remove `backfillJobStorage` from `StorageProviders` interface, remove backfill storage creation logic from `createLocalProvidersFromEnvironment`, `createLocalProviders`, `createGCPProvidersFromEnvironment`, `createGCPProviders`, and remove `backfillJobStorage` from all return objects
    - _Requirements: 3.5_

- [x] 4. Clean up backfill references in remaining backend code
  - [x] 4.1 Update monitoring route to remove backfill dependency
    - In `backend/src/routes/admin/monitoring.ts`: remove `getPendingBackfillJobCount` import from `./backfill.js`, set `pendingOperations` to `0` directly, update the comment on the `pendingOperations` field in `SystemHealthMetrics`
    - _Requirements: 5.1_
  - [x] 4.2 Remove backfill service from district shared module
    - In `backend/src/routes/districts/shared.ts`: remove `BackfillService` import from `../../services/UnifiedBackfillService.js`, remove `_backfillService` variable, remove `_backfillService = new BackfillService(...)` initialization, remove `getBackfillService()` export function
    - _Requirements: 5.2_
  - [x] 4.3 Update analytics error messages to reference scraper-cli
    - In `backend/src/routes/districts/analyticsSummary.ts`: replace all "Use the unified backfill service with job type 'analytics-generation'" recommendations with "Run scraper-cli compute-analytics", remove `backfillJobType` field from error details objects
    - In `backend/src/routes/districts/analytics.ts`: replace "Consider initiating a backfill" with "Run scraper-cli to collect historical data"
    - _Requirements: 5.3_
  - [x] 4.4 Update backend test files to remove backfill mocks
    - In `backend/src/routes/__tests__/admin.integration.test.ts`: remove `getUnifiedBackfillServiceInstance` from the `vi.mock('../../index.js', ...)` block
    - In `backend/src/routes/__tests__/admin.test.ts`: same removal
    - In `backend/src/routes/__tests__/admin.district-config.integration.test.ts`: same removal
    - In `backend/src/routes/districts/__tests__/analyticsSummary.test.ts`: update assertion strings to match new scraper-cli recommendations, remove `backfillJobType` assertions
    - _Requirements: 5.4_

- [x] 5. Checkpoint - Backend compilation and tests
  - Ensure `tsc --noEmit` passes in `backend/` with zero errors
  - Ensure `vitest --run` passes in `backend/` with no failures from missing backfill references
  - Ask the user if questions arise.

- [x] 6. Update OpenAPI specifications
  - [x] 6.1 Remove backfill endpoints from backend/openapi.yaml
    - Remove entire `/admin/backfill` section (POST endpoint)
    - Remove entire `/admin/backfill/{jobId}` section (GET, DELETE endpoints)
    - Remove entire `/admin/unified-backfill` section (POST endpoint)
    - Remove entire `/admin/unified-backfill/jobs` section (GET endpoint)
    - Remove entire `/admin/unified-backfill/preview` section (POST endpoint)
    - Remove entire `/admin/unified-backfill/config/rate-limit` section (GET, PUT endpoints)
    - Update analytics endpoint descriptions to replace backfill references with scraper-cli guidance
    - Remove `backfillJobType` from analytics error response details
    - _Requirements: 6.1, 6.2_
  - [x] 6.2 Remove backfill references from docs/openapi.yaml
    - Remove `Backfill` tag definition
    - Remove `BackfillRequest` and `BackfillStatus` schema definitions
    - Remove `BACKFILL_NOT_FOUND` and `BACKFILL_ERROR` from error code enums
    - Update analytics and snapshot descriptions to replace backfill references with scraper-cli guidance
    - _Requirements: 6.3, 6.4_

- [x] 7. Remove frontend backfill code
  - [x] 7.1 Delete frontend backfill hooks, context, and components
    - Delete `frontend/src/contexts/BackfillContext.tsx`
    - Delete `frontend/src/hooks/useBackfill.ts`
    - Delete `frontend/src/hooks/useUnifiedBackfill.ts`
    - Delete `frontend/src/components/DistrictBackfillButton.tsx`
    - Delete `frontend/src/components/BackfillProgressBar.tsx`
    - Delete `frontend/src/components/JobProgressDisplay.tsx`
    - Delete `frontend/src/components/JobHistoryList.tsx`
    - Delete `frontend/src/components/RateLimitConfigPanel.tsx`
    - _Requirements: 7.1, 7.2, 7.3_
  - [x] 7.2 Remove backfill from App.tsx
    - Remove `BackfillProvider` and `useBackfillContext` imports from `./contexts/BackfillContext`
    - Remove `BackfillProgressBar` import from `./components/BackfillProgressBar`
    - Remove `activeBackfills` and `removeBackfill` destructuring from `useBackfillContext()` in `Layout`
    - Remove `BackfillProvider` wrapper from the JSX tree
    - Remove the backfill progress bar mapping block
    - _Requirements: 7.4_
  - [x] 7.3 Remove backfill section from AdminPage
    - In `frontend/src/pages/AdminPage.tsx`: remove `useUnifiedBackfill`, `useForceCancelJob`, `BackfillJobType`, `JobPreview` imports, remove `JobProgressDisplay` and `JobHistoryList` imports, remove the entire `BackfillSection` component, remove the "Unified Backfill" section from the page JSX, remove `BACKFILL_JOB_ID_KEY` constant and related localStorage logic
    - _Requirements: 7.5_
  - [x] 7.4 Update frontend pages and components to remove backfill text
    - In `frontend/src/pages/DistrictDetailPage.tsx`: update empty state message to remove "backfill" wording, change `icon="backfill"` to `icon="data"` or keep as-is if the icon is retained
    - In `frontend/src/pages/LandingPage.tsx`: change "Go to the Admin page to start a backfill operation" to "Go to the Admin page to manage data collection"
    - In `frontend/src/components/DistrictOverview.tsx`: update empty state message and action label to remove "backfill" wording, change `icon="backfill"` to `icon="data"`
    - In `frontend/src/components/LeadershipInsights.tsx`: change "Please initiate a backfill to fetch" to "Please use the Admin Panel to collect"
    - In `frontend/src/components/DCPGoalAnalysis.tsx`: change "Please initiate a backfill to fetch" to "Please use the Admin Panel to collect"
    - _Requirements: 7.6_
  - [x] 7.5 Update frontend test files
    - In `frontend/src/__tests__/test-utils.tsx`: remove `BackfillProvider` import and wrapper from render utility
    - In `frontend/src/pages/__tests__/AdminPage.test.tsx`: remove "Unified Backfill" section tests, update remaining assertions
    - In `frontend/src/pages/__tests__/LandingPage.test.tsx`: update assertion text to match new wording
    - In `frontend/src/pages/__tests__/DistrictDetailPage.GlobalRankings.test.tsx`: remove `BackfillContext` mock
    - In `frontend/src/pages/__tests__/DistrictDetailPage.TrendsTab.test.tsx`: remove `BackfillProvider` import and wrapper
    - In `frontend/src/pages/__tests__/DistrictDetailPage.AreaRecognition.integration.test.tsx`: remove `BackfillProvider` import and wrapper
    - In `frontend/src/pages/__tests__/DistrictDetailPage.date-consistency.integration.test.tsx`: remove `BackfillContext` mock
    - _Requirements: 7.7, 7.8_

- [x] 8. Remove backfill documentation and data files
  - [x] 8.1 Delete backfill documentation
    - Delete `backend/docs/README-unified-backfill.md`
    - Delete `backend/docs/unified-backfill-api-reference.md`
    - Delete `backend/docs/unified-backfill-examples.md`
    - Delete `backend/docs/unified-backfill-quick-start.md`
    - Delete `backend/docs/unified-backfill-service.md`
    - _Requirements: 8.1_
  - [x] 8.2 Delete backfill data directory
    - Delete `backend/data/cache/backfill-jobs/` directory
    - _Requirements: 8.2, 8.3_

- [x] 9. Final checkpoint - Full system verification
  - Ensure `tsc --noEmit` passes in both `backend/` and `frontend/` with zero errors
  - Ensure `vitest --run` passes in both `backend/` and `frontend/` with no failures
  - Verify `backend/openapi.yaml` contains no backfill endpoint paths
  - Verify `docs/openapi.yaml` contains no backfill schemas or tags
  - Ask the user if questions arise.
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
