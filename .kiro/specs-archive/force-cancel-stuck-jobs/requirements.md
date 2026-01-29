# Requirements Document

## Introduction

This feature adds an administrative endpoint and frontend UI to force-cancel backfill jobs that are stuck in a "running" or "recovering" state. The production system has experienced multiple backfill jobs becoming stuck, preventing new jobs from being created due to the one-job-at-a-time enforcement. This feature provides operators with a mechanism to manually intervene and clear stuck jobs without requiring direct database manipulation, accessible from the Admin page.

## Glossary

- **Backfill_Job**: A persistent record representing a data collection or analytics generation operation that processes historical data
- **Force_Cancel_Endpoint**: An administrative API endpoint that marks a job as cancelled regardless of its current state
- **Stuck_Job**: A backfill job with status "running" or "recovering" that is no longer actively processing and cannot complete
- **Recovery_State**: The checkpoint and status information used by the RecoveryManager to resume interrupted jobs on server startup
- **Operator**: A system administrator with access to administrative endpoints and the Admin page
- **Job_History_List**: The frontend component (`JobHistoryList`) that displays backfill job history, to be added to the Admin page
- **Admin_Page**: The administrative dashboard page (`frontend/src/pages/AdminPage.tsx`) where operators manage backfill operations

## Requirements

### Requirement 1: Force-Cancel Endpoint

**User Story:** As an operator, I want to force-cancel a stuck backfill job by ID, so that I can clear jobs that are blocking new backfill operations.

#### Acceptance Criteria

1. WHEN an operator sends a POST request to `/api/admin/unified-backfill/{jobId}/force-cancel` with a valid job ID, THE Force_Cancel_Endpoint SHALL mark the job as "cancelled" in storage
2. WHEN an operator sends a force-cancel request without the `force` query parameter or request body flag, THE Force_Cancel_Endpoint SHALL return a 400 error requiring confirmation
3. WHEN an operator sends a force-cancel request with `force=true`, THE Force_Cancel_Endpoint SHALL proceed with cancellation without additional confirmation
4. WHEN a force-cancel request is made for a non-existent job ID, THE Force_Cancel_Endpoint SHALL return a 404 error with a descriptive message
5. WHEN a force-cancel request is made for a job already in a terminal state (completed, failed, cancelled), THE Force_Cancel_Endpoint SHALL return a 400 error indicating the job cannot be force-cancelled

### Requirement 2: Job State Update

**User Story:** As an operator, I want the force-cancelled job to be properly marked in storage, so that it won't be recovered on server restart and new jobs can be created.

#### Acceptance Criteria

1. WHEN a job is force-cancelled, THE System SHALL update the job status to "cancelled" in Firestore
2. WHEN a job is force-cancelled, THE System SHALL set the `completedAt` timestamp to the current time
3. WHEN a job is force-cancelled, THE System SHALL set the `error` field to indicate force-cancellation with operator context
4. WHEN a job is force-cancelled, THE System SHALL clear or invalidate the checkpoint to prevent recovery attempts

### Requirement 3: Recovery Prevention

**User Story:** As an operator, I want force-cancelled jobs to not be recovered on server restart, so that the stuck state is permanently resolved.

#### Acceptance Criteria

1. WHEN the RecoveryManager scans for incomplete jobs, THE System SHALL NOT include jobs with status "cancelled" in the recovery list
2. WHEN a job has been force-cancelled, THE System SHALL allow new backfill jobs to be created immediately

### Requirement 4: Audit Logging

**User Story:** As an operator, I want force-cancellation actions to be logged, so that I can audit administrative interventions.

#### Acceptance Criteria

1. WHEN a force-cancel request is received, THE System SHALL log the request with the job ID and operator IP address
2. WHEN a job is successfully force-cancelled, THE System SHALL log the cancellation with the previous job status and timestamp
3. WHEN a force-cancel request fails, THE System SHALL log the failure reason and job ID

### Requirement 5: API Documentation

**User Story:** As a developer, I want the force-cancel endpoint documented in the OpenAPI specification, so that the API gateway is properly configured.

#### Acceptance Criteria

1. THE Force_Cancel_Endpoint SHALL be documented in `backend/openapi.yaml` with all parameters and response codes
2. THE OpenAPI documentation SHALL include the `force` parameter specification
3. THE OpenAPI documentation SHALL include error response schemas for 400, 404, and 500 status codes

### Requirement 6: Frontend Hook

**User Story:** As a frontend developer, I want a React hook to call the force-cancel endpoint, so that I can integrate the functionality into the Admin page.

#### Acceptance Criteria

1. THE System SHALL provide a `useForceCancelJob` hook in `useUnifiedBackfill.ts` that calls the force-cancel endpoint
2. WHEN the force-cancel mutation succeeds, THE Hook SHALL invalidate the job status and job list queries to refresh the UI
3. THE Hook SHALL accept a `force` parameter to bypass the confirmation requirement

### Requirement 7: Job History UI Integration

**User Story:** As an operator, I want to force-cancel stuck jobs from the Admin page, so that I can resolve stuck jobs without using external tools.

#### Acceptance Criteria

1. THE Admin_Page SHALL display a Job History section showing recent backfill jobs using the JobHistoryList component
2. WHEN a job has status "running" or "recovering", THE JobHistoryList SHALL display a "Force Cancel" button in the expanded job details
3. WHEN an operator clicks the "Force Cancel" button, THE System SHALL display a confirmation dialog warning about the action
4. WHEN an operator confirms the force-cancel action, THE System SHALL call the force-cancel endpoint with `force=true`
5. WHEN the force-cancel operation succeeds, THE JobHistoryList SHALL refresh to show the updated job status
6. WHEN the force-cancel operation fails, THE System SHALL display an error message to the operator
7. THE "Force Cancel" button SHALL be visually distinct (e.g., red/warning color) to indicate it is a destructive action
