# Implementation Plan: Unified Backfill Service

## Overview

This implementation plan consolidates the two existing backfill mechanisms into a single, resilient Unified Backfill Service with persistent job state, automatic recovery, and a consolidated Admin UI. The implementation follows the existing storage abstraction pattern and TypeScript steering requirements.

## Tasks

- [ ] 1. Create IBackfillJobStorage interface and types
  - [ ] 1.1 Define IBackfillJobStorage interface in `backend/src/types/storageInterfaces.ts`
    - Add BackfillJob, BackfillJobStatus, BackfillJobType, JobConfig, JobProgress, JobCheckpoint, JobResult, JobError types
    - Add RateLimitConfig type
    - Add ListJobsOptions interface
    - Add IBackfillJobStorage interface with all methods
    - _Requirements: 1.1, 1.2, 1.6_
  - [ ] 1.2 Define API request/response types in `backend/src/types/backfillJob.ts`
    - Add CreateJobRequest, CreateJobResponse types
    - Add JobStatusResponse, ListJobsResponse types
    - Add JobPreview type for dry run
    - _Requirements: 9.2, 9.3, 9.5, 11.2, 11.3_

- [ ] 2. Implement LocalBackfillJobStorage
  - [ ] 2.1 Create `backend/src/services/storage/LocalBackfillJobStorage.ts`
    - Implement file-based storage in `{cacheDir}/backfill-jobs/` directory
    - Store jobs as individual JSON files: `{jobId}.json`
    - Store rate limit config in `rate-limit-config.json`
    - Implement graceful initialization (create directories/defaults if missing)
    - _Requirements: 1.1, 1.2, 1.5, 12.5_
  - [ ] 2.2 Write property test for job persistence round-trip
    - **Property 1: Job Persistence Round-Trip**
    - **Validates: Requirements 1.2**
  - [ ] 2.3 Write property test for job listing order
    - **Property 2: Job Listing Order Invariant**
    - **Validates: Requirements 1.6**
  - [ ] 2.4 Write unit tests for LocalBackfillJobStorage
    - Test graceful initialization with missing directories
    - Test job CRUD operations
    - Test cleanup of old jobs
    - _Requirements: 1.2, 1.6, 1.7_

- [ ] 3. Implement FirestoreBackfillJobStorage
  - [ ] 3.1 Create `backend/src/services/storage/FirestoreBackfillJobStorage.ts`
    - Implement Firestore-based storage in `backfill-jobs` collection
    - Store rate limit config in `config/rate-limit` document
    - Implement graceful initialization
    - _Requirements: 1.1, 1.5, 12.5_
  - [ ] 3.2 Write unit tests for FirestoreBackfillJobStorage
    - Test job CRUD operations with mock Firestore
    - Test graceful initialization
    - _Requirements: 1.2, 1.5_

- [ ] 4. Checkpoint - Ensure storage implementations pass all tests
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement JobManager
  - [ ] 5.1 Create `backend/src/services/backfill/unified/JobManager.ts`
    - Implement job lifecycle management (create, update, complete, fail, cancel)
    - Implement one-job-at-a-time enforcement with stale job detection
    - Implement checkpoint management for recovery
    - Implement progress update batching (persist within 5 seconds)
    - _Requirements: 1.2, 1.3, 3.1, 3.4, 7.2, 7.3_
  - [ ] 5.2 Write unit tests for JobManager
    - Test one-job-at-a-time enforcement
    - Test stale job override (10 minute threshold)
    - Test cancellation behavior
    - _Requirements: 3.1, 3.4, 7.2, 7.3_

- [ ] 6. Implement DataCollector
  - [ ] 6.1 Create `backend/src/services/backfill/unified/DataCollector.ts`
    - Extract and refactor data collection logic from existing BackfillService
    - Implement date range processing with checkpoint support
    - Implement preview/dry-run functionality
    - Integrate with existing RefreshService and SnapshotStorage
    - _Requirements: 2.2, 4.1, 4.3, 4.4, 10.3, 11.2_
  - [ ] 6.2 Write property test for date range validation
    - **Property 3: Date Range Validation**
    - **Validates: Requirements 4.3, 4.4**
  - [ ] 6.3 Write unit tests for DataCollector
    - Test date range generation
    - Test skip-on-resume logic
    - Test preview response format
    - _Requirements: 4.3, 4.4, 10.3, 11.3_

- [ ] 7. Implement AnalyticsGenerator
  - [ ] 7.1 Create `backend/src/services/backfill/unified/AnalyticsGenerator.ts`
    - Implement analytics generation for existing snapshots
    - Implement snapshot selection with optional date range filter
    - Implement preview/dry-run functionality
    - Integrate with existing TimeSeriesIndexStorage
    - _Requirements: 2.3, 4.2, 4.5, 11.2_
  - [ ] 7.2 Write unit tests for AnalyticsGenerator
    - Test snapshot selection with and without date range
    - Test preview response format
    - _Requirements: 4.5, 11.3_

- [ ] 8. Implement RecoveryManager
  - [ ] 8.1 Create `backend/src/services/backfill/unified/RecoveryManager.ts`
    - Implement detection of incomplete jobs on startup
    - Implement automatic resume from checkpoint
    - Implement recovery status tracking
    - _Requirements: 1.4, 10.1, 10.2, 10.3_
  - [ ] 8.2 Write unit tests for RecoveryManager
    - Test recovery detection
    - Test checkpoint restoration
    - _Requirements: 10.1, 10.3_

- [ ] 9. Checkpoint - Ensure all service components pass tests
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Implement UnifiedBackfillService
  - [ ] 10.1 Create `backend/src/services/backfill/unified/UnifiedBackfillService.ts`
    - Orchestrate JobManager, DataCollector, AnalyticsGenerator, RecoveryManager
    - Implement createJob, getJobStatus, cancelJob, previewJob, listJobs
    - Implement rate limit configuration management
    - Wire up recovery on initialization
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 7.1, 11.2, 12.3_
  - [ ] 10.2 Write property test for job filtering by status
    - **Property 4: Job Filtering By Status**
    - **Validates: Requirements 6.3**
  - [ ] 10.3 Write property test for rate limit config round-trip
    - **Property 5: Rate Limit Config Persistence Round-Trip**
    - **Validates: Requirements 12.5**
  - [ ] 10.4 Write integration tests for UnifiedBackfillService
    - Test end-to-end job creation and execution
    - Test recovery flow
    - _Requirements: 2.2, 2.3, 10.1_

- [ ] 11. Update StorageProviderFactory
  - [ ] 11.1 Add backfillJobStorage to StorageProviders interface
    - Update `backend/src/services/storage/StorageProviderFactory.ts`
    - Add backfillJobStorage to StorageProviders type
    - Create LocalBackfillJobStorage in createLocalProviders
    - Create FirestoreBackfillJobStorage in createGCPProviders
    - _Requirements: 1.5_

- [ ] 12. Implement API routes
  - [ ] 12.1 Create `backend/src/routes/admin/unified-backfill.ts`
    - POST /api/admin/backfill - Create new job
    - GET /api/admin/backfill/:jobId - Get job status
    - DELETE /api/admin/backfill/:jobId - Cancel job
    - GET /api/admin/backfill/jobs - List job history
    - POST /api/admin/backfill/preview - Dry run
    - GET /api/admin/backfill/config/rate-limit - Get rate limit config
    - PUT /api/admin/backfill/config/rate-limit - Update rate limit config
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 11.2, 12.1, 12.2_
  - [ ] 12.2 Write API integration tests
    - Test all endpoints with mock service
    - Test error responses
    - _Requirements: 9.2, 9.3, 9.4, 9.5_
  - [ ] 12.3 Register routes in admin router
    - Update `backend/src/routes/admin/index.ts` to include unified-backfill routes
    - _Requirements: 9.1_

- [ ] 13. Checkpoint - Ensure backend is complete and all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Create frontend hooks
  - [ ] 14.1 Create `frontend/src/hooks/useUnifiedBackfill.ts`
    - Implement useCreateJob, useJobStatus, useCancelJob, useListJobs hooks
    - Implement usePreviewJob hook for dry run
    - Implement useRateLimitConfig hook
    - Replace useAdminBackfill functionality
    - _Requirements: 5.2, 6.1, 8.4, 11.4, 12.1_

- [ ] 15. Update Admin Panel UI
  - [ ] 15.1 Create BackfillSection component in `frontend/src/pages/AdminPage.tsx`
    - Replace AnalyticsSection with unified BackfillSection
    - Add job type selector (data-collection / analytics-generation)
    - Add date range selection controls
    - Add preview button and confirmation dialog
    - _Requirements: 8.1, 8.2, 8.3, 11.1, 11.4_
  - [ ] 15.2 Create JobProgressDisplay component
    - Display progress bar with percentage
    - Add expandable per-district progress detail
    - Display rate limiter status
    - Add cancel button for running jobs
    - _Requirements: 5.2, 5.3, 5.5, 7.1, 12.4_
  - [ ] 15.3 Create JobHistoryList component
    - Display list of recent jobs with status, duration, outcome
    - Add status filter controls
    - Show job type, date range, error summary
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  - [ ] 15.4 Create RateLimitConfigPanel component
    - Display current rate limit settings
    - Add controls to modify settings
    - _Requirements: 12.1, 12.2_

- [ ] 16. Remove deprecated components
  - [ ] 16.1 Remove BackfillButton from LandingPage
    - Update `frontend/src/pages/LandingPage.tsx`
    - Remove BackfillButton import and usage
    - _Requirements: 8.6_
  - [ ] 16.2 Remove DistrictBackfillButton from DistrictDetailPage
    - Update `frontend/src/pages/DistrictDetailPage.tsx`
    - Remove DistrictBackfillButton import and usage
    - _Requirements: 8.7_
  - [ ] 16.3 Deprecate old backfill routes
    - Add deprecation warnings to `/api/districts/backfill/*` endpoints
    - Update `backend/src/routes/districts/backfill.ts` with deprecation notices
    - _Requirements: 9.6_

- [ ] 17. Checkpoint - Ensure frontend changes work correctly
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 18. Wire up recovery on server startup
  - [ ] 18.1 Update server initialization
    - Call RecoveryManager.recoverIncompleteJobs() on startup
    - Log recovery status
    - _Requirements: 1.4, 10.1_

- [ ] 19. Final integration testing
  - [ ] 19.1 Write end-to-end tests
    - Test complete data-collection job flow
    - Test complete analytics-generation job flow
    - Test recovery after simulated restart
    - Test UI interactions
    - _Requirements: 2.2, 2.3, 10.1_

- [ ] 20. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks are required for comprehensive implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (5 total per PBT guidance)
- Unit tests validate specific examples and edge cases
- The implementation reuses existing BackfillService logic where possible
- Storage abstraction follows the established pattern in StorageProviderFactory
