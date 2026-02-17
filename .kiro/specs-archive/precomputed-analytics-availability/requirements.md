# Requirements Document

## Introduction

This document specifies requirements for ensuring pre-computed analytics availability is clearly visible and that the system fails fast when analytics are unavailable. The system currently falls back to expensive on-demand analytics computation (60+ seconds) when pre-computed analytics are missing, creating poor user experience and unnecessary system load.

The solution is to eliminate the on-demand computation fallback entirely. Instead, the system will return an error when pre-computed analytics are unavailable, directing operators to use the existing analytics backfill mechanism. The existing snapshot list will be enhanced to show analytics availability status, making it easy to identify which snapshots need backfill.

## Glossary

- **Pre_Computed_Analytics**: Analytics summaries computed and stored during snapshot creation, enabling fast retrieval
- **Analytics_Summary_File**: The `analytics-summary.json` file stored within each snapshot directory containing pre-computed analytics for all districts
- **Analytics_Backfill**: The existing unified backfill service job type ('analytics-generation') for generating pre-computed analytics for existing snapshots
- **Snapshot_List**: The existing admin endpoint that lists all snapshots with their metadata

## Requirements

### Requirement 1: Remove On-Demand Analytics Computation Fallback

**User Story:** As a system operator, I want the system to return an error when pre-computed analytics are unavailable, so that I can identify and fix gaps using the backfill system rather than experiencing slow response times.

#### Acceptance Criteria

1. WHEN pre-computed analytics are not available for a requested district, THE analytics-summary endpoint SHALL return an HTTP 404 error
2. THE error response SHALL include a clear message indicating pre-computed analytics are not available
3. THE error response SHALL include a recommendation to run the analytics backfill
4. THE system SHALL NOT fall back to on-demand analytics computation
5. THE error response SHALL include the district ID that was requested

### Requirement 2: Snapshot List Analytics Availability Indicator

**User Story:** As a system operator, I want to see which snapshots have pre-computed analytics available when viewing the snapshot list, so that I can identify which snapshots need analytics backfill.

#### Acceptance Criteria

1. THE snapshot list endpoint SHALL include a boolean field indicating whether analytics are available for each snapshot
2. THE analytics availability check SHALL verify the existence of the analytics-summary.json file
3. THE snapshot list response SHALL include the new field without breaking existing consumers (backward compatible)
4. THE analytics availability check SHALL NOT significantly impact snapshot list performance (under 100ms additional latency)

### Requirement 3: Enhanced Error Logging

**User Story:** As a system operator, I want detailed logging when analytics are unavailable, so that I can identify patterns and prioritize backfill operations.

#### Acceptance Criteria

1. WHEN returning an analytics unavailable error, THE system SHALL log the district ID being requested
2. WHEN returning an analytics unavailable error, THE system SHALL log which snapshot was checked
3. THE error logs SHALL include a structured field indicating this is a gap-related issue
4. THE error logs SHALL include a recommendation to run the analytics backfill job

### Requirement 4: API Documentation

**User Story:** As a developer, I want the API changes documented in the OpenAPI specification, so that I can integrate with them correctly.

#### Acceptance Criteria

1. THE 404 error response for analytics-summary endpoint SHALL be documented in backend/openapi.yaml
2. THE new analyticsAvailable field in snapshot list response SHALL be documented
3. THE documentation SHALL include updated response schemas
