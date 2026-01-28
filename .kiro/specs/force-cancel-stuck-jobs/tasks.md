# Implementation Plan: Force-Cancel Stuck Jobs

## Overview

This implementation adds an admin endpoint and UI to force-cancel stuck backfill jobs. The work is organized into three main phases: backend API implementation, frontend hook and UI integration, and OpenAPI documentation.

## Tasks

- [x] 1. Implement backend force-cancel endpoint
  - [x] 1.1 Add `forceCancelJob` method to UnifiedBackfillService
    - Add method signature accepting jobId and operatorContext
    - Implement job existence check
    - Implement terminal state validation (reject completed/failed/cancelled)
    - Update job with status='cancelled', completedAt, error message, checkpoint=null
    - Return boolean indicating success
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  
  - [x] 1.2 Add force-cancel route handler to unified-backfill.ts
    - Add POST route at `/:jobId/force-cancel`
    - Validate `force` query parameter (require force=true)
    - Call service.forceCancelJob() with operator context
    - Return appropriate response/error codes
    - Add structured logging for audit trail
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 4.1, 4.2, 4.3_
  
  - [ ]* 1.3 Write unit tests for force-cancel endpoint
    - Test force-cancel with running job → success
    - Test force-cancel with recovering job → success
    - Test force-cancel without force parameter → 400
    - Test force-cancel with non-existent job → 404
    - Test force-cancel with terminal state jobs → 400
    - Verify job state updates (status, completedAt, error, checkpoint)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4_

- [x] 2. Checkpoint - Backend implementation complete
  - Ensure all backend tests pass, ask the user if questions arise.

- [x] 3. Update OpenAPI specification
  - [x] 3.1 Add force-cancel endpoint to backend/openapi.yaml
    - Add POST /admin/unified-backfill/{jobId}/force-cancel
    - Document path parameter (jobId)
    - Document query parameter (force)
    - Document response codes (200, 400, 404, 500, 503)
    - Add x-google-backend directive
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 4. Implement frontend force-cancel hook
  - [x] 4.1 Add `useForceCancelJob` hook to useUnifiedBackfill.ts
    - Create mutation function calling POST /admin/unified-backfill/{jobId}/force-cancel
    - Accept jobId and force parameters
    - Invalidate job status and jobs list queries on success
    - Export hook from module
    - _Requirements: 6.1, 6.2, 6.3_
  
  - [x] 4.2 Add ForceCancelResponse type definitions
    - Define response interface matching backend
    - Add to existing type definitions in useUnifiedBackfill.ts
    - _Requirements: 6.1_

- [x] 5. Integrate JobHistoryList into Admin page
  - [x] 5.1 Import and render JobHistoryList in BackfillSection
    - Import JobHistoryList component
    - Add Job History section below backfill configuration
    - Pass appropriate props (pageSize, className)
    - _Requirements: 7.1_
  
  - [x] 5.2 Enhance JobHistoryList with force-cancel capability
    - Add `onForceCancelJob` prop to JobHistoryListProps
    - Add "Force Cancel" button to JobHistoryItem for running/recovering jobs
    - Style button with warning/danger appearance (red color)
    - _Requirements: 7.2, 7.7_
  
  - [x] 5.3 Add force-cancel confirmation dialog
    - Add confirmation state to JobHistoryList
    - Show dialog when Force Cancel button clicked
    - Include warning message about destructive action
    - Call onForceCancelJob callback on confirm
    - _Requirements: 7.3, 7.4_
  
  - [x] 5.4 Wire up force-cancel in AdminPage
    - Use useForceCancelJob hook in BackfillSection
    - Pass force-cancel handler to JobHistoryList
    - Handle success (queries auto-invalidate)
    - Handle and display errors
    - _Requirements: 7.4, 7.5, 7.6_

- [x] 6. Checkpoint - Frontend implementation complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ]* 7. Write frontend component tests
  - [ ]* 7.1 Test JobHistoryList force-cancel button visibility
    - Verify button appears for running jobs
    - Verify button appears for recovering jobs
    - Verify button hidden for completed/failed/cancelled jobs
    - _Requirements: 7.2_
  
  - [ ]* 7.2 Test force-cancel confirmation flow
    - Verify dialog appears on button click
    - Verify cancel dismisses dialog
    - Verify confirm calls onForceCancelJob
    - _Requirements: 7.3, 7.4_

- [x] 8. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The backend implementation (tasks 1-2) should be completed before frontend work
- OpenAPI update (task 3) must be done alongside backend implementation per api-documentation steering
- Each task references specific requirements for traceability
