# Unified BackfillService API Reference

## Base URL

All API endpoints are relative to the base URL: `http://localhost:5001/api`

## Authentication

Currently, no authentication is required for backfill endpoints. Future versions may include authentication for administrative operations.

## Content Type

All requests and responses use `application/json` content type.

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": "Additional error details",
    "suggestions": ["Helpful suggestion 1", "Helpful suggestion 2"]
  },
  "request_id": "unique-request-identifier"
}
```

## Endpoints

### POST /districts/backfill

Initiate a new backfill operation with flexible targeting and configuration options.

#### Request

**Headers:**

- `Content-Type: application/json`

**Body:**

```typescript
{
  // Targeting options
  targetDistricts?: string[]     // Optional. Specific districts to process

  // Date range (required)
  startDate: string             // Required. ISO date string (YYYY-MM-DD)
  endDate?: string              // Optional. ISO date string, defaults to startDate

  // Collection preferences
  collectionType?: 'system-wide' | 'per-district' | 'auto'  // Default: 'auto'

  // Performance options
  concurrency?: number          // Optional. Max concurrent operations (1-10, default: 3)
  retryFailures?: boolean       // Optional. Retry failed districts (default: true)
  skipExisting?: boolean        // Optional. Skip already cached dates (default: true)
  rateLimitDelayMs?: number     // Optional. Override default rate limit delay
  enableCaching?: boolean       // Optional. Enable intermediate caching (default: true)
  cacheKeyPrefix?: string       // Optional. Custom cache key prefix
}
```

#### Response

**Success (201 Created):**

```json
{
  "backfillId": "uuid-string",
  "status": "processing",
  "scope": {
    "targetDistricts": ["42", "15"],
    "configuredDistricts": ["42", "15", "73"],
    "scopeType": "targeted",
    "validationPassed": true
  },
  "progress": {
    "total": 30,
    "completed": 0,
    "skipped": 0,
    "unavailable": 0,
    "failed": 0,
    "current": "2024-01-01",
    "districtProgress": {},
    "partialSnapshots": 0,
    "totalErrors": 0,
    "retryableErrors": 0,
    "permanentErrors": 0
  },
  "collectionStrategy": {
    "type": "targeted",
    "refreshMethod": {
      "name": "getMultipleDistricts",
      "params": {
        "districtIds": ["42", "15"]
      }
    },
    "rationale": "Targeted collection for multiple specific districts",
    "estimatedEfficiency": 0.7,
    "targetDistricts": ["42", "15"]
  },
  "snapshotIds": [],
  "request_id": "backfill_1234567890_abc123",
  "links": {
    "self": "/api/districts/backfill/uuid-string",
    "cancel": "/api/districts/backfill/uuid-string"
  }
}
```

**Error (400 Bad Request):**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": "Multiple validation errors found",
    "validation_errors": [
      {
        "field": "startDate",
        "message": "Start date is required",
        "code": "REQUIRED_FIELD"
      }
    ],
    "suggestions": [
      "Provide a valid start date in YYYY-MM-DD format",
      "Ensure target districts are valid district IDs"
    ]
  },
  "request_id": "backfill_1234567890_abc123"
}
```

#### Example Requests

**Basic System-Wide Backfill:**

```bash
curl -X POST http://localhost:5001/api/districts/backfill \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2024-01-01",
    "endDate": "2024-01-30"
  }'
```

**Targeted District Backfill:**

```bash
curl -X POST http://localhost:5001/api/districts/backfill \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2024-07-01",
    "endDate": "2024-12-31",
    "targetDistricts": ["42", "15", "73"],
    "collectionType": "per-district",
    "concurrency": 5,
    "retryFailures": true,
    "enableCaching": true
  }'
```

**High-Performance Backfill:**

```bash
curl -X POST http://localhost:5001/api/districts/backfill \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2024-01-01",
    "targetDistricts": ["42"],
    "concurrency": 8,
    "rateLimitDelayMs": 1000,
    "enableCaching": true,
    "cacheKeyPrefix": "priority"
  }'
```

### GET /districts/backfill/:backfillId

Get the current status and progress of a backfill operation.

#### Parameters

- `backfillId` (path, required): The unique identifier of the backfill job

#### Response

**Success (200 OK):**

```json
{
  "backfillId": "uuid-string",
  "status": "processing",
  "scope": {
    "targetDistricts": ["42", "15"],
    "configuredDistricts": ["42", "15", "73"],
    "scopeType": "targeted",
    "validationPassed": true
  },
  "progress": {
    "total": 30,
    "completed": 15,
    "skipped": 5,
    "unavailable": 2,
    "failed": 1,
    "current": "2024-01-15",
    "districtProgress": {
      "42": {
        "districtId": "42",
        "status": "completed",
        "datesProcessed": 15,
        "datesTotal": 30,
        "successfulDates": ["2024-01-01", "2024-01-02"],
        "failedDates": [],
        "retryCount": 0
      },
      "15": {
        "districtId": "15",
        "status": "processing",
        "datesProcessed": 10,
        "datesTotal": 30,
        "successfulDates": ["2024-01-01"],
        "failedDates": ["2024-01-02"],
        "retryCount": 1,
        "lastError": "Network timeout"
      }
    },
    "partialSnapshots": 1,
    "totalErrors": 3,
    "retryableErrors": 2,
    "permanentErrors": 1
  },
  "collectionStrategy": {
    "type": "targeted",
    "refreshMethod": {
      "name": "getMultipleDistricts",
      "params": {
        "districtIds": ["42", "15"]
      }
    },
    "rationale": "Targeted collection for multiple specific districts",
    "estimatedEfficiency": 0.7,
    "targetDistricts": ["42", "15"]
  },
  "snapshotIds": ["1704067200000-partial-1704067800000"],
  "errorSummary": {
    "totalErrors": 3,
    "retryableErrors": 2,
    "permanentErrors": 1,
    "affectedDistricts": ["15"],
    "partialSnapshots": 1
  },
  "partialSnapshots": [
    {
      "snapshotId": "1704067200000-partial-1704067800000",
      "successfulDistricts": ["42"],
      "failedDistricts": ["15"],
      "totalDistricts": 2,
      "successRate": 0.5,
      "errors": [
        {
          "districtId": "15",
          "error": "Network timeout",
          "errorType": "network_error",
          "timestamp": "2024-01-15T10:30:00Z",
          "retryCount": 1,
          "isRetryable": true
        }
      ],
      "metadata": {
        "createdAt": "2024-01-15T10:30:00Z",
        "processingTime": 45000,
        "isPartial": true,
        "backfillJobId": "uuid-string"
      }
    }
  ],
  "performanceStatus": {
    "rateLimiter": {
      "currentCount": 5,
      "maxRequests": 10,
      "windowMs": 60000,
      "nextResetAt": "2024-01-15T10:31:00Z"
    },
    "concurrencyLimiter": {
      "activeSlots": 2,
      "maxConcurrent": 3,
      "queueLength": 0
    },
    "intermediateCache": {
      "hitRate": 0.75,
      "entryCount": 150,
      "sizeBytes": 2048000
    }
  }
}
```

**Error (404 Not Found):**

```json
{
  "error": {
    "code": "BACKFILL_NOT_FOUND",
    "message": "Backfill job not found",
    "details": "No backfill job found with the specified ID",
    "suggestions": [
      "Verify the backfill ID is correct",
      "Check if the job has been cleaned up due to age",
      "Use POST /api/districts/backfill to create a new job"
    ]
  },
  "request_id": "backfill_status_1234567890_def456"
}
```

#### Example Request

```bash
curl http://localhost:5001/api/districts/backfill/your-backfill-id
```

### DELETE /districts/backfill/:backfillId

Cancel a running backfill operation.

#### Parameters

- `backfillId` (path, required): The unique identifier of the backfill job

#### Response

**Success (200 OK):**

```json
{
  "success": true,
  "message": "Backfill cancelled successfully",
  "backfillId": "uuid-string",
  "previousStatus": "processing",
  "cancelledAt": "2024-01-15T10:35:00Z",
  "request_id": "backfill_cancel_1234567890_ghi789"
}
```

**Error (400 Bad Request) - Job Not Cancellable:**

```json
{
  "error": {
    "code": "BACKFILL_NOT_CANCELLABLE",
    "message": "Backfill job cannot be cancelled",
    "details": "Job is in 'complete' status and cannot be cancelled",
    "current_status": "complete",
    "suggestions": [
      "Only jobs in 'processing' status can be cancelled",
      "Use GET /api/districts/backfill/:id to check current status"
    ]
  },
  "request_id": "backfill_cancel_1234567890_ghi789"
}
```

**Error (404 Not Found):**

```json
{
  "error": {
    "code": "BACKFILL_NOT_FOUND",
    "message": "Backfill job not found",
    "details": "No backfill job found with the specified ID",
    "suggestions": [
      "Verify the backfill ID is correct",
      "Check if the job has already completed",
      "Use GET /api/districts/backfill/:id to check job status"
    ]
  },
  "request_id": "backfill_cancel_1234567890_ghi789"
}
```

#### Example Request

```bash
curl -X DELETE http://localhost:5001/api/districts/backfill/your-backfill-id
```

## Data Types

### BackfillRequest

```typescript
interface BackfillRequest {
  // Targeting options
  targetDistricts?: string[] // Optional array of district IDs

  // Date range
  startDate: string // Required ISO date string (YYYY-MM-DD)
  endDate?: string // Optional ISO date string

  // Collection preferences
  collectionType?: 'system-wide' | 'per-district' | 'auto'

  // Performance options
  concurrency?: number // 1-10, default: 3
  retryFailures?: boolean // Default: true
  skipExisting?: boolean // Default: true
  rateLimitDelayMs?: number // Milliseconds
  enableCaching?: boolean // Default: true
  cacheKeyPrefix?: string // Custom cache prefix
}
```

### BackfillResponse

```typescript
interface BackfillResponse {
  backfillId: string
  status: 'processing' | 'complete' | 'error' | 'cancelled' | 'partial_success'
  scope: BackfillScope
  progress: BackfillProgress
  collectionStrategy: CollectionStrategy
  error?: string
  snapshotIds: string[]
  errorSummary?: ErrorSummary
  partialSnapshots?: PartialSnapshotResult[]
  performanceStatus?: PerformanceStatus
}
```

### BackfillScope

```typescript
interface BackfillScope {
  targetDistricts: string[]
  configuredDistricts: string[]
  scopeType: 'system-wide' | 'targeted' | 'single-district'
  validationPassed: boolean
}
```

### BackfillProgress

```typescript
interface BackfillProgress {
  total: number // Total operations to perform
  completed: number // Completed operations
  skipped: number // Skipped (already cached)
  unavailable: number // Data not available
  failed: number // Failed operations
  current: string // Current date being processed

  // District-level tracking
  districtProgress: Record<string, DistrictProgress>

  // Enhanced error tracking
  partialSnapshots: number // Snapshots created with some failures
  totalErrors: number // Total error count across all districts
  retryableErrors: number // Errors that can be retried
  permanentErrors: number // Errors that cannot be retried
}
```

### DistrictProgress

```typescript
interface DistrictProgress {
  districtId: string
  status:
    | 'pending'
    | 'processing'
    | 'completed'
    | 'failed'
    | 'skipped'
    | 'blacklisted'
  datesProcessed: number
  datesTotal: number
  lastError?: string
  successfulDates: string[]
  failedDates: string[]
  retryCount: number
}
```

### CollectionStrategy

```typescript
interface CollectionStrategy {
  type: 'system-wide' | 'per-district' | 'targeted'
  refreshMethod: {
    name: 'getAllDistricts' | 'getDistrictPerformance' | 'getMultipleDistricts'
    params: Record<string, unknown>
  }
  rationale: string
  estimatedEfficiency: number
  targetDistricts?: string[]
}
```

### ErrorSummary

```typescript
interface ErrorSummary {
  totalErrors: number
  retryableErrors: number
  permanentErrors: number
  affectedDistricts: string[]
  partialSnapshots: number
}
```

### PerformanceStatus

```typescript
interface PerformanceStatus {
  rateLimiter: {
    currentCount: number
    maxRequests: number
    windowMs: number
    nextResetAt: string
  }
  concurrencyLimiter: {
    activeSlots: number
    maxConcurrent: number
    queueLength: number
  }
  intermediateCache: {
    hitRate: number
    entryCount: number
    sizeBytes: number
  }
}
```

## Status Codes

- `200 OK`: Request successful
- `201 Created`: Backfill job created successfully
- `400 Bad Request`: Invalid request format or parameters
- `404 Not Found`: Backfill job not found
- `500 Internal Server Error`: Server error occurred

## Rate Limiting

The API implements rate limiting to protect external data sources:

- **Default Limits**: 10 requests per minute per client
- **Backoff**: Exponential backoff for rate limit violations
- **Headers**: Rate limit information included in response headers

## Request/Response Headers

### Request Headers

- `Content-Type: application/json` (required for POST requests)
- `User-Agent: your-client/version` (recommended)

### Response Headers

- `Content-Type: application/json`
- `X-Request-ID: unique-request-identifier`
- `X-Backfill-ID: backfill-job-identifier` (for POST requests)

## Polling Guidelines

When monitoring backfill progress:

1. **Poll Interval**: Poll every 2-5 seconds while status is 'processing'
2. **Stop Conditions**: Stop polling when status is 'complete', 'error', or 'cancelled'
3. **Timeout**: Implement client-side timeout for long-running operations
4. **Error Handling**: Handle network errors gracefully with exponential backoff

## Common Error Codes

- `VALIDATION_ERROR`: Request validation failed
- `BACKFILL_NOT_FOUND`: Backfill job not found
- `BACKFILL_NOT_CANCELLABLE`: Job cannot be cancelled in current status
- `SCOPE_VIOLATION`: Target districts not in configured scope
- `INTERNAL_ERROR`: Server-side error occurred
- `RATE_LIMIT_EXCEEDED`: Too many requests

## Best Practices

### Request Optimization

1. **Use Auto Collection Type**: Let the service select optimal strategy
2. **Set Reasonable Date Ranges**: Avoid extremely large date ranges
3. **Enable Caching**: Improves performance for repeated operations
4. **Configure Appropriate Concurrency**: Balance speed with resource usage

### Error Handling

1. **Check Error Summaries**: Use error summaries to identify patterns
2. **Monitor Partial Snapshots**: Review partial results for completeness
3. **Implement Retry Logic**: Handle transient errors with exponential backoff
4. **Log Request IDs**: Include request IDs in client logs for debugging

### Performance

1. **Monitor Performance Status**: Use performance metrics to optimize settings
2. **Adjust Based on Load**: Reduce concurrency during high system load
3. **Use Appropriate Cache Prefixes**: Organize cached data effectively
4. **Monitor Cache Hit Rates**: High hit rates indicate effective caching
