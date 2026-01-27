# Requirements Document

## Introduction

This document specifies requirements for consolidating the two existing backfill mechanisms (Data Backfill for historical snapshot collection and Admin Analytics Backfill for pre-computed analytics generation) into a single, resilient Unified Backfill Service. The unified service will provide persistent job state, server-side deduplication, automatic recovery, and a consolidated Admin UI for all backfill operations.

## Glossary

- **Unified_Backfill_Service**: The consolidated backend service that handles both data collection (historical snapshots) and analytics generation (pre-computed analytics) operations
- **Backfill_Job**: A persistent record representing a backfill operation with its configuration, progress, and status
- **Job_Storage**: The storage abstraction layer (IBackfillJobStorage interface) for persisting backfill job state across server restarts
- **Data_Backfill**: The operation of fetching historical Toastmasters dashboard data for specified date ranges
- **Analytics_Backfill**: The operation of generating pre-computed analytics for existing snapshots
- **Job_Manager**: The component responsible for job lifecycle management, progress tracking, state persistence, and automatic recovery
- **Admin_Panel**: The consolidated frontend interface for managing all backfill operations
- **Dry_Run**: A preview mode that shows what would be processed without actually executing the backfill

## Requirements

### Requirement 1: Persistent Job Storage

**User Story:** As a system operator, I want backfill job state to persist across server restarts, so that I can track job progress and history reliably.

#### Acceptance Criteria

1. THE Job_Storage SHALL implement the IBackfillJobStorage interface following the existing storage abstraction pattern
2. WHEN a backfill job is created, THE Job_Storage SHALL persist the job record immediately
3. WHEN job progress is updated, THE Job_Storage SHALL persist the updated state within 5 seconds
4. WHEN the server restarts with incomplete jobs, THE Job_Manager SHALL automatically resume processing from the last checkpoint
5. THE Job_Storage SHALL support both local filesystem and Firestore storage backends via the storage abstraction pattern
6. WHEN listing jobs, THE Job_Storage SHALL return jobs sorted by creation time (newest first)
7. THE Job_Storage SHALL retain completed and failed jobs for at least 30 days

### Requirement 2: Unified Job Types

**User Story:** As a system operator, I want to manage both data collection and analytics generation through a single interface, so that I can simplify backfill operations.

#### Acceptance Criteria

1. THE Unified_Backfill_Service SHALL support two job types: 'data-collection' and 'analytics-generation'
2. WHEN a data-collection job is created, THE Unified_Backfill_Service SHALL fetch historical dashboard data for the specified date range
3. WHEN an analytics-generation job is created, THE Unified_Backfill_Service SHALL generate pre-computed analytics for existing snapshots
4. THE Backfill_Job SHALL include a 'jobType' field distinguishing between data-collection and analytics-generation
5. WHEN displaying job progress, THE Admin_Panel SHALL show job-type-specific progress information

### Requirement 3: Server-Side Job Deduplication

**User Story:** As a system operator, I want the system to prevent duplicate backfill jobs, so that I don't accidentally run multiple conflicting operations.

#### Acceptance Criteria

1. THE Unified_Backfill_Service SHALL enforce a global one-job-at-a-time policy
2. WHEN a job is already running, THE Unified_Backfill_Service SHALL reject new job requests with a clear error message
3. WHEN checking for running jobs, THE Unified_Backfill_Service SHALL query the persistent Job_Storage (not in-memory state)
4. IF a running job becomes stale (no progress update for 10 minutes), THEN THE Unified_Backfill_Service SHALL allow new jobs to be created

### Requirement 4: Date Range Specification

**User Story:** As a system operator, I want to specify date ranges for backfill operations, so that I can target specific time periods.

#### Acceptance Criteria

1. WHEN creating a data-collection job, THE Admin_Panel SHALL provide date range selection controls
2. WHEN creating an analytics-generation job, THE Admin_Panel SHALL provide optional date range filters for snapshot selection
3. THE Unified_Backfill_Service SHALL validate that startDate is before or equal to endDate
4. THE Unified_Backfill_Service SHALL validate that endDate is before today (dashboard data is delayed)
5. WHEN no date range is specified for analytics-generation, THE Unified_Backfill_Service SHALL process all existing snapshots

### Requirement 5: Job Progress Tracking

**User Story:** As a system operator, I want to see detailed progress of backfill operations, so that I can monitor their status.

#### Acceptance Criteria

1. THE Backfill_Job SHALL track: total items, processed items, failed items, skipped items, and current item
2. WHEN a job is running, THE Admin_Panel SHALL display a progress bar with percentage complete
3. THE Admin_Panel SHALL provide expandable detail showing per-district progress when expanded
4. WHEN errors occur, THE Backfill_Job SHALL record error details including affected item and error message
5. THE Admin_Panel SHALL display rate limiting status as read-only information

### Requirement 6: Job History

**User Story:** As a system operator, I want to view history of completed and failed jobs, so that I can debug issues and track operations.

#### Acceptance Criteria

1. THE Admin_Panel SHALL display a list of recent jobs with status, start time, duration, and outcome
2. WHEN viewing job history, THE Admin_Panel SHALL show job type, date range, items processed, and error summary
3. THE Admin_Panel SHALL allow filtering job history by status (completed, failed, cancelled)
4. THE Admin_Panel SHALL display job history in a dedicated section below the job controls
5. WHEN a job completes or fails, THE Admin_Panel SHALL update the history list automatically

### Requirement 7: Job Cancellation

**User Story:** As a system operator, I want to cancel running backfill jobs, so that I can stop operations that are no longer needed.

#### Acceptance Criteria

1. WHEN a job is running, THE Admin_Panel SHALL display a cancel button
2. WHEN cancellation is requested, THE Unified_Backfill_Service SHALL stop processing new items gracefully
3. WHEN a job is cancelled, THE Backfill_Job SHALL record the cancellation time and partial progress
4. THE Unified_Backfill_Service SHALL complete any in-flight item processing before stopping

### Requirement 8: Consolidated Admin UI

**User Story:** As a system operator, I want all backfill controls in the Admin page, so that I have a single location for backfill management.

#### Acceptance Criteria

1. THE Admin_Panel SHALL provide a unified "Backfill" section replacing the current "Analytics" section
2. THE Admin_Panel SHALL include job type selection (data-collection or analytics-generation)
3. THE Admin_Panel SHALL include date range selection controls
4. THE Admin_Panel SHALL display current job progress when a job is running
5. THE Admin_Panel SHALL display job history below the controls
6. THE BackfillButton component SHALL be removed from LandingPage
7. THE DistrictBackfillButton component SHALL be removed from DistrictDetailPage

### Requirement 9: API Consolidation

**User Story:** As a developer, I want a single set of backfill API endpoints, so that the API is consistent and maintainable.

#### Acceptance Criteria

1. THE Unified_Backfill_Service SHALL expose endpoints under /api/admin/backfill/\*
2. POST /api/admin/backfill SHALL create a new backfill job with jobType and optional date range
3. GET /api/admin/backfill/:jobId SHALL return job progress and status
4. DELETE /api/admin/backfill/:jobId SHALL cancel a running job
5. GET /api/admin/backfill/jobs SHALL return job history with pagination
6. THE /api/districts/backfill/\* endpoints SHALL be deprecated and removed

### Requirement 10: Automatic Recovery

**User Story:** As a system operator, I want incomplete jobs to automatically resume after server restarts, so that long-running operations complete reliably.

#### Acceptance Criteria

1. WHEN the server restarts with an incomplete job, THE Job_Manager SHALL automatically resume processing from the last checkpoint
2. THE Backfill_Job SHALL track checkpoint information including last processed item and timestamp
3. WHEN resuming, THE Unified_Backfill_Service SHALL skip already-processed items based on checkpoint data
4. THE Admin_Panel SHALL indicate when a job has been resumed with the original start time and resume time

### Requirement 11: Dry Run Mode

**User Story:** As a system operator, I want to preview what a backfill would process before running it, so that I can verify configuration before large operations.

#### Acceptance Criteria

1. THE Admin_Panel SHALL provide a "Preview" button alongside the "Start Backfill" button
2. WHEN dry run is requested, THE Unified_Backfill_Service SHALL return a preview of items to be processed without executing
3. THE preview response SHALL include: total items count, date range, affected districts, and estimated duration
4. THE Admin_Panel SHALL display the preview results in a confirmation dialog before allowing the actual backfill to start

### Requirement 12: Rate Limiting Configuration

**User Story:** As a system operator, I want to view and configure rate limiting settings, so that I can balance backfill speed with system load.

#### Acceptance Criteria

1. THE Admin_Panel SHALL display current rate limiting settings (requests per minute, concurrency limit, delay between requests)
2. THE Admin_Panel SHALL allow modifying rate limiting settings before starting a job
3. WHEN rate limiting settings are changed, THE Unified_Backfill_Service SHALL apply them to the next job
4. THE Admin_Panel SHALL display current rate limiter status during job execution (requests made, throttle state)
5. THE Unified_Backfill_Service SHALL persist rate limiting configuration separately from job configuration
