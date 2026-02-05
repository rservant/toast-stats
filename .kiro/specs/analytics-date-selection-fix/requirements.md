# Requirements Document

## Introduction

This document specifies the requirements for fixing the date selection bug in the district analytics endpoints. Currently, when users select a specific date in the "View Specific Date" picker on the District Detail Page, the backend ignores the `endDate` query parameter and always returns data from the latest successful snapshot instead of the requested date.

The fix ensures that analytics endpoints respect the `endDate` parameter by using `snapshotStore.getSnapshot(endDate)` when a date is provided, falling back to `getLatestSuccessful()` only when no date is specified.

## Glossary

- **Snapshot**: A point-in-time capture of district data, identified by an ISO date string (e.g., "2017-04-22")
- **Snapshot_Store**: The service responsible for reading and managing snapshot data from storage
- **Analytics_Endpoint**: A backend API route that serves pre-computed analytics data for a district
- **endDate**: A query parameter specifying the date for which analytics data should be retrieved
- **Date_Range**: The time period covered by the analytics data, shown in the API response

## Requirements

### Requirement 1: Date-Aware Snapshot Selection for Main Analytics Endpoint

**User Story:** As a user viewing district analytics, I want to see data for the specific date I selected, so that I can analyze historical performance at any point in time.

#### Acceptance Criteria

1. WHEN the `/api/districts/:districtId/analytics` endpoint receives a request with an `endDate` query parameter, THE Analytics_Endpoint SHALL use `snapshotStore.getSnapshot(endDate)` to retrieve the snapshot for that specific date
2. WHEN the `/api/districts/:districtId/analytics` endpoint receives a request without an `endDate` query parameter, THE Analytics_Endpoint SHALL use `snapshotStore.getLatestSuccessful()` to retrieve the most recent snapshot
3. IF the requested `endDate` snapshot does not exist, THEN THE Analytics_Endpoint SHALL return a 404 error with a descriptive message indicating the snapshot was not found
4. WHEN returning analytics data, THE Analytics_Endpoint SHALL include a `dateRange` that reflects the actual snapshot date being served

### Requirement 2: Date-Aware Snapshot Selection for Membership Analytics Endpoint

**User Story:** As a user viewing membership analytics, I want to see data for the specific date I selected, so that I can track membership trends at any historical point.

#### Acceptance Criteria

1. WHEN the `/api/districts/:districtId/membership-analytics` endpoint receives a request with an `endDate` query parameter, THE Analytics_Endpoint SHALL use `snapshotStore.getSnapshot(endDate)` to retrieve the snapshot for that specific date
2. WHEN the `/api/districts/:districtId/membership-analytics` endpoint receives a request without an `endDate` query parameter, THE Analytics_Endpoint SHALL use `snapshotStore.getLatestSuccessful()` to retrieve the most recent snapshot
3. IF the requested `endDate` snapshot does not exist, THEN THE Analytics_Endpoint SHALL return a 404 error with a descriptive message

### Requirement 3: Date-Aware Snapshot Selection for Leadership Insights Endpoint

**User Story:** As a user viewing leadership insights, I want to see data for the specific date I selected, so that I can analyze leadership effectiveness at any historical point.

#### Acceptance Criteria

1. WHEN the `/api/districts/:districtId/leadership-insights` endpoint receives a request with an `endDate` query parameter, THE Analytics_Endpoint SHALL use `snapshotStore.getSnapshot(endDate)` to retrieve the snapshot for that specific date
2. WHEN the `/api/districts/:districtId/leadership-insights` endpoint receives a request without an `endDate` query parameter, THE Analytics_Endpoint SHALL use `snapshotStore.getLatestSuccessful()` to retrieve the most recent snapshot
3. IF the requested `endDate` snapshot does not exist, THEN THE Analytics_Endpoint SHALL return a 404 error with a descriptive message

### Requirement 4: Date-Aware Snapshot Selection for Distinguished Club Analytics Endpoint

**User Story:** As a user viewing distinguished club analytics, I want to see data for the specific date I selected, so that I can track club achievements at any historical point.

#### Acceptance Criteria

1. WHEN the `/api/districts/:districtId/distinguished-club-analytics` endpoint receives a request with an `endDate` query parameter, THE Analytics_Endpoint SHALL use `snapshotStore.getSnapshot(endDate)` to retrieve the snapshot for that specific date
2. WHEN the `/api/districts/:districtId/distinguished-club-analytics` endpoint receives a request without an `endDate` query parameter, THE Analytics_Endpoint SHALL use `snapshotStore.getLatestSuccessful()` to retrieve the most recent snapshot
3. IF the requested `endDate` snapshot does not exist, THEN THE Analytics_Endpoint SHALL return a 404 error with a descriptive message

### Requirement 5: Date-Aware Snapshot Selection for Vulnerable Clubs Endpoint

**User Story:** As a user viewing vulnerable clubs data, I want to see data for the specific date I selected, so that I can analyze club health at any historical point.

#### Acceptance Criteria

1. WHEN the `/api/districts/:districtId/vulnerable-clubs` endpoint receives a request with an `endDate` query parameter, THE Analytics_Endpoint SHALL use `snapshotStore.getSnapshot(endDate)` to retrieve the snapshot for that specific date
2. WHEN the `/api/districts/:districtId/vulnerable-clubs` endpoint receives a request without an `endDate` query parameter, THE Analytics_Endpoint SHALL use `snapshotStore.getLatestSuccessful()` to retrieve the most recent snapshot
3. IF the requested `endDate` snapshot does not exist, THEN THE Analytics_Endpoint SHALL return a 404 error with a descriptive message

### Requirement 6: Consistent Error Handling for Missing Snapshots

**User Story:** As a user, I want clear error messages when data for my selected date is unavailable, so that I understand why the request failed.

#### Acceptance Criteria

1. WHEN a requested snapshot does not exist, THE Analytics_Endpoint SHALL return HTTP status 404
2. WHEN a requested snapshot does not exist, THE Analytics_Endpoint SHALL include an error response with code `SNAPSHOT_NOT_FOUND`
3. WHEN a requested snapshot does not exist, THE Analytics_Endpoint SHALL include a message indicating the specific date that was requested
4. WHEN a requested snapshot does not exist, THE Analytics_Endpoint SHALL include details suggesting the user try a different date or check available snapshots
