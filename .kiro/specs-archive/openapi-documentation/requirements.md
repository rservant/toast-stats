# Requirements: OpenAPI 3.0 Documentation

## Overview

Create a comprehensive OpenAPI 3.0 specification that documents all Toast-Stats API endpoints. This replaces the current proxy-only `backend/openapi.yaml` with a proper API documentation spec that describes request/response schemas, error codes, and endpoint behaviors.

## Goals

- Provide accurate API documentation for developers
- Enable potential client code generation
- Support request/response validation
- Serve as the single source of truth for API contracts

## User Stories

### 1. API Documentation Structure

**As a** developer  
**I want** a well-organized OpenAPI 3.0 specification  
**So that** I can understand and use the Toast-Stats API effectively

**Acceptance Criteria:**

- 1.1 The specification SHALL use OpenAPI 3.0.3 format
- 1.2 The specification SHALL include proper info section with title, description, and version
- 1.3 The specification SHALL define server URLs for development and production
- 1.4 The specification SHALL organize endpoints using tags (Districts, Rankings, Analytics, Backfill, Admin)
- 1.5 The specification SHALL be located at `docs/openapi.yaml`

### 2. District Endpoints Documentation

**As a** developer  
**I want** complete documentation of district endpoints  
**So that** I can fetch district data correctly

**Acceptance Criteria:**

- 2.1 The specification SHALL document `GET /api/districts` (list all districts)
- 2.2 The specification SHALL document `GET /api/districts/rankings` with date and fallback query parameters
- 2.3 The specification SHALL document `GET /api/districts/{districtId}/statistics` with date query parameter
- 2.4 The specification SHALL document `GET /api/districts/{districtId}/clubs`
- 2.5 The specification SHALL document `GET /api/districts/{districtId}/membership-history` with months parameter
- 2.6 The specification SHALL document `GET /api/districts/{districtId}/educational-awards` with months parameter
- 2.7 The specification SHALL document `GET /api/districts/{districtId}/daily-reports` with date range parameters
- 2.8 The specification SHALL document `GET /api/districts/{districtId}/daily-reports/{date}`
- 2.9 The specification SHALL document `GET /api/districts/{districtId}/rank-history` with date range parameters
- 2.10 The specification SHALL document `GET /api/districts/{districtId}/available-ranking-years`
- 2.11 The specification SHALL document `GET /api/districts/{districtId}/cached-dates`
- 2.12 The specification SHALL document `GET /api/districts/cache/dates`

### 3. Analytics Endpoints Documentation

**As a** developer  
**I want** complete documentation of analytics endpoints  
**So that** I can generate district analytics correctly

**Acceptance Criteria:**

- 3.1 The specification SHALL document `GET /api/districts/{districtId}/analytics` with date range parameters
- 3.2 The specification SHALL document `GET /api/districts/{districtId}/membership-analytics` with date range parameters
- 3.3 The specification SHALL document `GET /api/districts/{districtId}/clubs/{clubId}/trends`
- 3.4 The specification SHALL document `GET /api/districts/{districtId}/vulnerable-clubs`
- 3.5 The specification SHALL document `GET /api/districts/{districtId}/leadership-insights` with date range parameters
- 3.6 The specification SHALL document `GET /api/districts/{districtId}/distinguished-club-analytics` with date range parameters
- 3.7 The specification SHALL document `GET /api/districts/{districtId}/year-over-year/{date}`
- 3.8 The specification SHALL document `GET /api/districts/{districtId}/export` with format and date range parameters

### 4. Backfill Endpoints Documentation

**As a** developer  
**I want** complete documentation of backfill endpoints  
**So that** I can manage historical data collection correctly

**Acceptance Criteria:**

- 4.1 The specification SHALL document `POST /api/districts/backfill` with request body schema
- 4.2 The specification SHALL document `GET /api/districts/backfill/{backfillId}`
- 4.3 The specification SHALL document `DELETE /api/districts/backfill/{backfillId}`
- 4.4 The specification SHALL document `POST /api/districts/{districtId}/backfill` with request body schema
- 4.5 The specification SHALL document `GET /api/districts/{districtId}/backfill/{backfillId}`
- 4.6 The specification SHALL document `DELETE /api/districts/{districtId}/backfill/{backfillId}`

### 5. Admin Endpoints Documentation

**As a** developer  
**I want** complete documentation of admin endpoints  
**So that** I can manage snapshots and system configuration correctly

**Acceptance Criteria:**

- 5.1 The specification SHALL document `GET /api/admin/snapshots` with filtering parameters
- 5.2 The specification SHALL document `GET /api/admin/snapshots/{snapshotId}`
- 5.3 The specification SHALL document `GET /api/admin/snapshots/{snapshotId}/payload`

### 6. Schema Definitions

**As a** developer  
**I want** complete schema definitions for all request/response types  
**So that** I can understand the data structures used by the API

**Acceptance Criteria:**

- 6.1 The specification SHALL define `District` schema with id, name, status, lastUpdated
- 6.2 The specification SHALL define `DistrictStatistics` schema with all performance metrics
- 6.3 The specification SHALL define `Club` schema with all club properties
- 6.4 The specification SHALL define `DistrictRanking` schema with ranking metrics
- 6.5 The specification SHALL define `BackfillRequest` schema with all configuration options
- 6.6 The specification SHALL define `BackfillStatus` schema with progress information
- 6.7 The specification SHALL define `DistrictAnalytics` schema with analytics data
- 6.8 The specification SHALL define `ErrorResponse` schema with code, message, details
- 6.9 The specification SHALL define `SnapshotMetadata` schema for response metadata
- 6.10 The specification SHALL define common parameter schemas (districtId, date, dateRange)

### 7. Error Documentation

**As a** developer  
**I want** complete documentation of error responses  
**So that** I can handle errors correctly in my application

**Acceptance Criteria:**

- 7.1 The specification SHALL document 400 Bad Request responses with error codes
- 7.2 The specification SHALL document 404 Not Found responses with error codes
- 7.3 The specification SHALL document 500 Internal Server Error responses
- 7.4 The specification SHALL document 503 Service Unavailable responses
- 7.5 The specification SHALL include error code enumerations (INVALID_DISTRICT_ID, NO_DATA_AVAILABLE, etc.)

### 8. Response Metadata Documentation

**As a** developer  
**I want** documentation of snapshot metadata included in responses  
**So that** I can understand data freshness and source information

**Acceptance Criteria:**

- 8.1 The specification SHALL document `_snapshot_metadata` object structure
- 8.2 The specification SHALL document closing period fields (is_closing_period, closing_period_type)
- 8.3 The specification SHALL document fallback fields (is_fallback, fallback_reason, requested_date, actual_date)
- 8.4 The specification SHALL document data source fields (data_source, from_cache)

## Non-Functional Requirements

### 9. Specification Quality

- 9.1 The specification SHALL pass OpenAPI 3.0 validation
- 9.2 The specification SHALL include examples for complex request/response bodies
- 9.3 The specification SHALL use consistent naming conventions (camelCase for properties)
- 9.4 The specification SHALL include descriptions for all endpoints, parameters, and schemas

## Out of Scope

- Authentication/authorization documentation (not currently implemented)
- Rate limiting documentation (handled at infrastructure level)
- WebSocket or streaming endpoints (not implemented)

## Notes

- The existing `backend/openapi.yaml` is a Google API Gateway proxy configuration and should be preserved
- The new documentation spec will be placed in `docs/openapi.yaml`
- Schema definitions should align with TypeScript types in `backend/src/types/`
