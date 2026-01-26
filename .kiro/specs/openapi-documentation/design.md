# Design: OpenAPI 3.0 Documentation

## Overview

This design describes the structure and organization of the OpenAPI 3.0 specification for the Toast-Stats API. The specification will serve as comprehensive API documentation.

## File Location

The specification will be created at `docs/openapi.yaml`. The existing `backend/openapi.yaml` (Google API Gateway proxy config) remains unchanged.

## Specification Structure

### Info Section

```yaml
openapi: 3.0.3
info:
  title: Toast-Stats API
  description: Toastmasters District Statistics and Analytics API
  version: 1.0.0
  contact:
    name: Development Team
```

### Server Configuration

```yaml
servers:
  - url: http://localhost:3001/api
    description: Development server
  - url: https://toast-stats-api-ii5boewesq-ue.a.run.app/api
    description: Production server (Cloud Run)
```

### Tag Organization

| Tag       | Description                                      |
| --------- | ------------------------------------------------ |
| Districts | Core district data endpoints                     |
| Rankings  | Global and district ranking endpoints            |
| Analytics | Analytics and insights endpoints                 |
| Backfill  | Historical data collection endpoints             |
| Admin     | Administrative and snapshot management endpoints |
| Cache     | Cache management endpoints                       |

## Endpoint Documentation Strategy

### Path Parameter Patterns

- `{districtId}` - District identifier (string, e.g., "57", "F")
- `{clubId}` - Club identifier (string)
- `{backfillId}` - Backfill job identifier (string)
- `{snapshotId}` - Snapshot identifier (ISO date string, YYYY-MM-DD)
- `{date}` - Date parameter (ISO date string, YYYY-MM-DD)

### Common Query Parameters

| Parameter | Type          | Description                         |
| --------- | ------------- | ----------------------------------- |
| date      | string (date) | Specific date for data retrieval    |
| startDate | string (date) | Start of date range                 |
| endDate   | string (date) | End of date range                   |
| months    | integer       | Number of months of history         |
| fallback  | boolean       | Enable fallback to nearest snapshot |
| format    | string        | Export format (csv)                 |
| limit     | integer       | Maximum results to return           |
| status    | string        | Filter by status                    |

## Schema Design

### Core Schemas

#### District

```yaml
District:
  type: object
  properties:
    id:
      type: string
      description: District identifier
    name:
      type: string
      description: District name
    status:
      type: string
      enum: [active, inactive]
    lastUpdated:
      type: string
      format: date-time
```

#### DistrictStatistics

Comprehensive district performance data including:

- Basic info (districtId, districtName)
- Membership metrics (total, active, growth)
- Club metrics (total, paid, distinguished counts)
- Performance metrics (DCP goals, payments)
- Division/Area performance arrays

#### DistrictRanking

```yaml
DistrictRanking:
  type: object
  properties:
    districtId:
      type: string
    districtName:
      type: string
    aggregateScore:
      type: number
    clubsRank:
      type: integer
    paymentsRank:
      type: integer
    distinguishedRank:
      type: integer
    overallRank:
      type: integer
```

#### BackfillRequest

```yaml
BackfillRequest:
  type: object
  properties:
    targetDistricts:
      type: array
      items:
        type: string
    startDate:
      type: string
      format: date
    endDate:
      type: string
      format: date
    collectionType:
      type: string
      enum: [per-district, all-districts]
    concurrency:
      type: integer
      default: 3
```

#### BackfillStatus

```yaml
BackfillStatus:
  type: object
  properties:
    backfillId:
      type: string
    status:
      type: string
      enum: [processing, complete, error, cancelled]
    progress:
      type: object
      properties:
        total:
          type: integer
        completed:
          type: integer
        failed:
          type: integer
        percentage:
          type: number
    scope:
      type: object
      properties:
        scopeType:
          type: string
        targetDistricts:
          type: array
          items:
            type: string
```

### Error Schema

```yaml
ErrorResponse:
  type: object
  required:
    - error
  properties:
    error:
      type: object
      required:
        - code
        - message
      properties:
        code:
          type: string
          description: Machine-readable error code
        message:
          type: string
          description: Human-readable error message
        details:
          type: string
          description: Additional error context
        suggestions:
          type: array
          items:
            type: string
          description: Suggested actions to resolve the error
```

### Snapshot Metadata Schema

```yaml
SnapshotMetadata:
  type: object
  properties:
    snapshot_id:
      type: string
      description: Snapshot identifier (ISO date)
    created_at:
      type: string
      format: date-time
    status:
      type: string
      enum: [success, partial, failed]
    is_closing_period:
      type: boolean
    closing_period_type:
      type: string
      enum: [month-end, year-end]
    is_fallback:
      type: boolean
    fallback_reason:
      type: string
      enum: [no_snapshot_for_date, closing_period_gap, future_date]
    requested_date:
      type: string
      format: date
    actual_date:
      type: string
      format: date
```

## Error Code Enumeration

| Code                    | HTTP Status | Description                              |
| ----------------------- | ----------- | ---------------------------------------- |
| INVALID_DISTRICT_ID     | 400         | District ID format is invalid            |
| INVALID_DATE_FORMAT     | 400         | Date must be YYYY-MM-DD format           |
| INVALID_DATE_RANGE      | 400         | Start date must be before end date       |
| DATE_RANGE_TOO_LARGE    | 400         | Date range exceeds maximum allowed       |
| MISSING_DATE_PARAMETERS | 400         | Required date parameters not provided    |
| VALIDATION_ERROR        | 400         | Request validation failed                |
| SNAPSHOT_NOT_FOUND      | 404         | Requested snapshot does not exist        |
| BACKFILL_NOT_FOUND      | 404         | Backfill job not found                   |
| CLUB_NOT_FOUND          | 404         | Club not found in district               |
| NO_DATA_AVAILABLE       | 404         | No cached data available                 |
| CANNOT_CANCEL_JOB       | 409         | Job cannot be cancelled in current state |
| ANALYTICS_ERROR         | 500         | Analytics generation failed              |
| BACKFILL_ERROR          | 500         | Backfill operation failed                |
| INTERNAL_ERROR          | 500         | Unexpected internal error                |
| SERVICE_UNAVAILABLE     | 503         | Storage service temporarily unavailable  |

## Response Examples

### Successful District List Response

```yaml
example:
  districts:
    - id: '57'
      name: 'District 57'
      status: 'active'
      lastUpdated: '2026-01-24T10:30:00Z'
  _snapshot_metadata:
    snapshot_id: '2026-01-24'
    created_at: '2026-01-24T06:00:00Z'
    status: 'success'
```

### Error Response Example

```yaml
example:
  error:
    code: 'INVALID_DISTRICT_ID'
    message: 'Invalid district ID format'
    details: 'District ID must be alphanumeric'
```

## Implementation Notes

1. **Schema Reuse**: Use `$ref` extensively to avoid duplication
2. **Examples**: Include realistic examples for complex schemas
3. **Descriptions**: Every endpoint, parameter, and property should have a description
4. **Validation**: The spec should pass `openapi-generator validate`

## File Organization

The specification will be a single YAML file organized as:

1. OpenAPI version and info
2. Server definitions
3. Tags
4. Paths (grouped by tag)
5. Components
   - Schemas
   - Parameters
   - Responses

## Correctness Properties

### Property 1: Schema Consistency

All response schemas in the specification MUST match the actual TypeScript types defined in `backend/src/types/`.

### Property 2: Endpoint Coverage

Every route defined in `backend/src/routes/` MUST have a corresponding path in the OpenAPI specification.

### Property 3: Error Code Accuracy

All error codes documented in the specification MUST match the actual error codes returned by the API.

## Testing Strategy

Since this is documentation, testing focuses on:

1. OpenAPI validation (syntax correctness)
2. Manual verification against actual API responses
3. Schema alignment with TypeScript types

Property-based testing is NOT appropriate for this spec per the PBT steering guidance - documentation changes are easily verifiable through validation tools and manual inspection.
