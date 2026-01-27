# Requirements Document

## Introduction

This document specifies requirements for fixing the district analytics page performance issues that cause 504 Gateway Timeout errors. The current implementation makes expensive operations that take 30-72 seconds, exceeding gateway timeout limits.

The scale of data is significant: up to 365 snapshots per program year across approximately 15 years of historical data. The frontend displays trends for entire program years and compares across multiple years. The solution must reduce API response times to under 10 seconds while maintaining data accuracy by pre-computing analytics during snapshot creation.

## Glossary

- **Analytics_Engine**: The backend service that processes cached district data to generate insights and analytics
- **Snapshot_Store**: The storage service that manages time-ordered snapshots of district data in Firestore
- **Analytics_Data_Source_Adapter**: The adapter that wraps snapshot storage to provide data to the Analytics Engine
- **Gateway_Timeout**: A 504 HTTP error that occurs when the backend takes too long to respond (typically 30-60 seconds)
- **Snapshot_Metadata**: Information about a snapshot including creation date, status, and data-as-of date
- **Pre_Computed_Analytics**: Analytics calculations performed during snapshot creation and stored alongside snapshot data
- **Program_Year**: A Toastmasters year running from July 1 to June 30 (e.g., 2023-2024)
- **Analytics_Summary**: A pre-computed summary containing membership trends, club health metrics, and distinguished club counts for a snapshot

## Requirements

### Requirement 1: Pre-Compute Analytics During Snapshot Creation

**User Story:** As a district leader, I want analytics to be pre-computed when data is collected, so that viewing analytics is instantaneous.

#### Acceptance Criteria

1. WHEN a new snapshot is created, THE Refresh_Service SHALL compute and store analytics summaries for each district in the snapshot
2. THE Pre_Computed_Analytics SHALL include membership totals, club health counts (thriving, vulnerable, intervention-required), and distinguished club counts
3. THE Pre_Computed_Analytics SHALL include membership trend data points (date and count) for the snapshot date
4. WHEN pre-computation fails for a district, THE Refresh_Service SHALL log the error and continue with other districts without failing the entire snapshot
5. THE Pre_Computed_Analytics SHALL be stored in a dedicated analytics summary file within the snapshot directory

### Requirement 2: Store Time-Series Data Efficiently

**User Story:** As a backend developer, I want time-series data stored in a format optimized for range queries, so that trend data can be retrieved without loading all snapshots.

#### Acceptance Criteria

1. THE Snapshot_Store SHALL maintain a time-series index file that contains date-indexed analytics summaries across all snapshots
2. WHEN a new snapshot is created, THE Snapshot_Store SHALL append the analytics summary to the time-series index
3. WHEN querying analytics for a date range, THE Analytics_Engine SHALL read from the time-series index instead of loading individual snapshots
4. THE time-series index SHALL support efficient range queries for program year boundaries (July 1 to June 30)
5. THE time-series index SHALL be partitioned by program year to limit file sizes

### Requirement 3: Optimize Snapshot Listing Performance

**User Story:** As a district leader, I want the analytics page to load quickly, so that I can view district performance data without waiting for timeouts.

#### Acceptance Criteria

1. WHEN the Analytics_Data_Source_Adapter retrieves snapshots in a date range, THE Snapshot_Store SHALL return snapshot metadata in a single batch query instead of individual queries per snapshot
2. WHEN listing snapshots, THE Snapshot_Store SHALL cache the snapshot list in memory with a configurable TTL of at least 60 seconds
3. WHEN the snapshot list cache is valid, THE Snapshot_Store SHALL return cached results without querying the database
4. THE Snapshot_Store SHALL provide a method to retrieve snapshot metadata for multiple snapshots in a single batch operation

### Requirement 4: Implement Aggregated Analytics Endpoint

**User Story:** As a frontend developer, I want a single API endpoint that returns all district analytics data, so that the frontend can make one request instead of multiple parallel requests.

#### Acceptance Criteria

1. WHEN a client requests district analytics, THE Backend SHALL provide a single aggregated endpoint that returns analytics, distinguished club analytics, and leadership insights in one response
2. WHEN the aggregated endpoint is called, THE Analytics_Engine SHALL read from pre-computed analytics instead of computing on-demand
3. WHEN generating the aggregated response, THE Backend SHALL complete within 5 seconds for any date range
4. THE aggregated endpoint SHALL support the same query parameters (startDate, endDate) as the individual endpoints
5. WHEN pre-computed analytics are not available for a date range, THE Backend SHALL fall back to on-demand computation with a warning log

### Requirement 5: Lazy Load Detailed Analytics

**User Story:** As a user, I want the page to show summary data immediately and load detailed data on demand, so that I can start working without waiting for everything.

#### Acceptance Criteria

1. WHEN the district page loads, THE Frontend SHALL first request summary analytics (totals and trends) which are pre-computed
2. WHEN the user navigates to detailed views (clubs table, division rankings), THE Frontend SHALL request detailed data on demand
3. THE Backend SHALL provide separate endpoints for summary analytics (fast, pre-computed) and detailed analytics (slower, computed on demand)
4. THE summary analytics endpoint SHALL return within 2 seconds for any date range

### Requirement 6: Implement Request Deduplication

**User Story:** As a frontend developer, I want the backend to handle concurrent identical requests efficiently, so that parallel API calls don't cause redundant processing.

#### Acceptance Criteria

1. WHEN multiple identical analytics requests arrive concurrently, THE Backend SHALL process only one request and share the result with all waiting clients
2. WHEN a request is being processed, THE Backend SHALL queue subsequent identical requests instead of starting new processing
3. THE request deduplication cache SHALL expire after the response is sent or after a configurable timeout

### Requirement 7: Backfill Pre-Computed Analytics

**User Story:** As a system operator, I want to generate pre-computed analytics for existing snapshots, so that historical data benefits from the performance improvements.

#### Acceptance Criteria

1. THE Backend SHALL provide an admin endpoint to trigger backfill of pre-computed analytics for existing snapshots
2. WHEN backfilling, THE System SHALL process snapshots in chronological order to build accurate time-series data
3. THE backfill process SHALL be resumable, tracking progress and continuing from the last processed snapshot
4. THE backfill process SHALL run in the background without blocking normal operations

### Requirement 8: Snapshot Regeneration and Cleanup

**User Story:** As a system operator, I want to delete and regenerate snapshots cleanly, so that I can fix data quality issues and apply schema changes.

#### Acceptance Criteria

1. THE Backend SHALL provide an admin endpoint to delete all snapshots for a district or all districts
2. THE Backend SHALL provide an admin endpoint to delete snapshots within a specific date range
3. WHEN snapshots are deleted, THE System SHALL also delete associated pre-computed analytics and time-series index entries
4. THE Backend SHALL provide an admin endpoint to regenerate snapshots from source data with current schema and validation rules
5. THE regeneration process SHALL be resumable and track progress

### Requirement 9: Data Validation During Snapshot Creation

**User Story:** As a system operator, I want invalid data filtered out during snapshot creation, so that analytics are not corrupted by malformed records.

#### Acceptance Criteria

1. WHEN creating a snapshot, THE Data_Validator SHALL reject records where the district ID matches a date pattern (e.g., "As of MM/DD/YYYY")
2. WHEN creating a snapshot, THE Data_Validator SHALL reject records where the district ID is empty, null, or contains only whitespace
3. WHEN creating a snapshot, THE Data_Validator SHALL reject records where the district ID contains invalid characters (only alphanumeric allowed)
4. WHEN invalid records are detected, THE Data_Validator SHALL log a warning with the rejected record details and continue processing valid records
5. THE Data_Validator SHALL provide a summary count of rejected records in the snapshot metadata

### Requirement 10: Consolidated Admin Panel

**User Story:** As a system operator, I want all administrative functions accessible from a single admin page, so that I can manage the system efficiently without navigating to multiple locations.

#### Acceptance Criteria

1. THE Frontend SHALL provide a dedicated Admin page accessible from the main navigation
2. THE Admin page SHALL display all available admin operations in organized sections (Snapshots, Analytics, System Health)
3. THE Admin page SHALL include snapshot management controls: list snapshots, delete snapshots, regenerate snapshots
4. THE Admin page SHALL include analytics management controls: trigger backfill, view pre-computation status
5. THE Admin page SHALL display system health metrics: cache hit rates, average response times, pending operations
6. WHEN an admin operation is in progress, THE Admin page SHALL display real-time progress and status updates
7. THE Admin page SHALL require appropriate authorization before displaying or executing admin operations

### Requirement 11: Monitoring and Alerting

**User Story:** As a system operator, I want visibility into analytics endpoint performance, so that I can identify and address performance issues proactively.

#### Acceptance Criteria

1. WHEN an analytics request completes, THE Backend SHALL log the total processing time and whether pre-computed data was used
2. WHEN an analytics request takes longer than 5 seconds, THE Backend SHALL log a warning with diagnostic information
3. WHEN pre-computed analytics are missing for a requested date range, THE Backend SHALL log a warning indicating backfill may be needed
