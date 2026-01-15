# Unified BackfillService Documentation

## Overview

The Unified BackfillService is a complete rewrite that replaces both the existing BackfillService and DistrictBackfillService with a modern, unified system. The service leverages RefreshService methods as the primary data acquisition mechanism for historical data collection.

## Key Features

- **RefreshService Integration**: Direct use of proven RefreshService methods for reliable data acquisition
- **Intelligent Collection**: Automatic selection of optimal collection strategies based on scope and requirements
- **Unified Job Management**: Single job queue for all backfill types with unified progress tracking
- **Enhanced Error Handling**: District-level error tracking with partial snapshot creation
- **Modern API Design**: Clean, modern API interface with comprehensive error handling
- **Performance Optimization**: Rate limiting, concurrency controls, and caching for efficiency

## Architecture

### Core Components

1. **BackfillService**: Main orchestrator for all backfill operations
2. **JobManager**: Handles job lifecycle, progress tracking, and cleanup
3. **DataSourceSelector**: Manages collection strategy selection and delegates to RefreshService methods
4. **ScopeManager**: Manages district targeting and configuration validation

### Performance Optimization Components

- **RateLimiter**: Protects external data sources from being overwhelmed
- **ConcurrencyLimiter**: Controls concurrent district processing operations
- **IntermediateCache**: Caches intermediate results to avoid redundant operations

## Service Integration

The unified service integrates with existing infrastructure:

- **PerDistrictFileSnapshotStore**: Primary storage mechanism for all snapshot operations
- **DistrictConfigurationService**: Provides district scoping and validation
- **RefreshService**: Provides proven data collection methods
- **AlertManager**: Handles error notifications and monitoring alerts
- **CircuitBreaker**: Protects against external service failures

## API Endpoints

### POST /api/districts/backfill

Initiate a backfill operation with flexible targeting and configuration options.

**Request Body:**

```typescript
interface BackfillRequest {
  // Targeting options
  targetDistricts?: string[] // Specific districts to process

  // Date range
  startDate: string // ISO date string (required)
  endDate?: string // ISO date string (defaults to startDate)

  // Collection preferences
  collectionType?: 'system-wide' | 'per-district' | 'auto'

  // Performance options
  concurrency?: number // Max concurrent operations (default: 3)
  retryFailures?: boolean // Retry failed districts (default: true)
  skipExisting?: boolean // Skip already cached dates (default: true)
  rateLimitDelayMs?: number // Override default rate limit delay
  enableCaching?: boolean // Enable intermediate result caching (default: true)
}
```

**Response:**

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

### GET /api/districts/backfill/:backfillId

Get backfill progress and status with comprehensive error information.

**Response:** Same as POST response above, with updated progress information.

### DELETE /api/districts/backfill/:backfillId

Cancel a running backfill job.

**Response:**

```json
{
  "success": true,
  "message": "Backfill cancelled successfully",
  "backfillId": "uuid-string"
}
```

## Usage Examples

### Basic System-Wide Backfill

```typescript
import { BackfillService } from './services/UnifiedBackfillService.js'

const service = new BackfillService(
  refreshService,
  snapshotStore,
  configService
)

// Backfill last 30 days for all configured districts
const backfillId = await service.initiateBackfill({
  startDate: '2024-01-01',
  endDate: '2024-01-30',
})

// Check status
const status = service.getBackfillStatus(backfillId)
console.log(`Progress: ${status.progress.completed}/${status.progress.total}`)
```

### Targeted District Backfill

```typescript
// Backfill specific districts with custom settings
const backfillId = await service.initiateBackfill({
  targetDistricts: ['42', '15', '73'],
  startDate: '2024-07-01',
  endDate: '2024-12-31',
  collectionType: 'per-district',
  concurrency: 5,
  retryFailures: true,
  enableCaching: true,
})
```

### Single District Backfill

```typescript
// Backfill a single district for detailed analysis
const backfillId = await service.initiateBackfill({
  targetDistricts: ['42'],
  startDate: '2024-01-01',
  collectionType: 'per-district',
})
```

### HTTP API Usage

#### Initiate Backfill

```bash
curl -X POST http://localhost:5001/api/districts/backfill \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2024-01-01",
    "endDate": "2024-01-30",
    "targetDistricts": ["42", "15"],
    "collectionType": "auto",
    "concurrency": 3,
    "retryFailures": true,
    "enableCaching": true
  }'
```

#### Check Status

```bash
curl http://localhost:5001/api/districts/backfill/your-backfill-id
```

#### Cancel Backfill

```bash
curl -X DELETE http://localhost:5001/api/districts/backfill/your-backfill-id
```

## Collection Strategies

The service automatically selects the optimal collection strategy based on scope and requirements:

### System-Wide Collection

- **When**: No target districts specified or all configured districts requested
- **Method**: Uses RefreshService.executeRefresh() for comprehensive data collection
- **Efficiency**: High (single operation covers all districts)
- **Use Case**: Regular system-wide data refresh

### Per-District Collection

- **When**: Single district or small number of districts with detailed data needs
- **Method**: Uses RefreshService scraper methods for district-specific data
- **Efficiency**: Medium (multiple operations but detailed data)
- **Use Case**: Detailed analysis of specific districts

### Targeted Collection

- **When**: Multiple specific districts requested
- **Method**: Hybrid approach - system-wide with filtering or per-district based on count
- **Efficiency**: Variable (optimized based on district count)
- **Use Case**: Batch operations on specific district subsets

## Error Handling

### District-Level Error Handling

The service implements comprehensive error handling at the district level:

- **Continuation**: Individual district failures don't stop processing of other districts
- **Error Tracking**: Detailed error context including error type, timestamp, and retry eligibility
- **Partial Snapshots**: Created when some districts succeed and others fail

### Error Types

```typescript
type ErrorType =
  | 'fetch_failed' // Network or API errors
  | 'validation_failed' // Data validation errors
  | 'processing_failed' // Processing logic errors
  | 'scope_violation' // District not in configured scope
  | 'network_error' // Network connectivity issues
  | 'timeout_error' // Request timeout
  | 'rate_limit_error' // Rate limiting triggered
  | 'data_unavailable' // Data not available for date/district
  | 'snapshot_creation_failed' // Snapshot storage failed
```

### Retry Logic

- **Automatic Retries**: Transient errors are automatically retried with exponential backoff
- **Retry Configuration**: Configurable retry attempts, delays, and backoff multipliers
- **Error Classification**: Errors are classified as retryable or permanent

## Performance Optimization

### Rate Limiting

Protects external data sources from being overwhelmed:

```typescript
// Default configuration
{
  maxRequests: 10,      // Max 10 requests per minute
  windowMs: 60000,      // 1 minute window
  minDelayMs: 2000,     // Minimum 2 seconds between requests
  maxDelayMs: 30000,    // Maximum 30 seconds backoff
  backoffMultiplier: 2  // Exponential backoff
}
```

### Concurrency Control

Limits simultaneous operations to prevent resource exhaustion:

```typescript
// Default configuration
{
  maxConcurrent: 3,     // Max 3 concurrent district operations
  timeoutMs: 300000,    // 5 minute timeout for acquiring slot
  queueLimit: 20        // Max 20 operations in queue
}
```

### Intermediate Caching

Caches intermediate results to avoid redundant operations:

```typescript
// Default configuration
{
  defaultTtlMs: 3600000,    // 1 hour TTL for intermediate results
  maxEntries: 1000,         // Max 1000 cached results
  maxSizeBytes: 50 * 1024 * 1024, // 50MB cache size limit
  useLruEviction: true,     // Use LRU eviction policy
  cleanupIntervalMs: 300000 // Cleanup every 5 minutes
}
```

## Configuration

### Environment Variables

- `USE_MOCK_DATA`: Use mock data instead of real scraper (development/testing)
- `CACHE_DIRECTORY`: Directory for cache and snapshot storage
- `ADMIN_TOKEN`: Token for admin endpoints (if applicable)

### Service Configuration

```typescript
const backfillService = new BackfillService(
  refreshService, // RefreshService instance
  snapshotStore, // PerDistrictFileSnapshotStore instance
  configService, // DistrictConfigurationService instance
  alertManager, // Optional AlertManager instance
  circuitBreakerManager // Optional CircuitBreakerManager instance
)
```

## Monitoring and Observability

### Performance Status

Get real-time performance optimization status:

```typescript
const performanceStatus = backfillService.getPerformanceStatus()
console.log('Rate Limiter:', performanceStatus.rateLimiter)
console.log('Concurrency:', performanceStatus.concurrencyLimiter)
console.log('Cache Stats:', performanceStatus.intermediateCache)
```

### Logging

The service provides comprehensive logging at multiple levels:

- **Info**: Job lifecycle events, strategy selection, completion status
- **Debug**: Detailed processing steps, data extraction, caching operations
- **Warn**: Scope violations, partial failures
- **Error**: Critical failures, snapshot creation errors, service errors

### Metrics

Key metrics tracked by the service:

- **Job Metrics**: Total jobs, completion rate, average processing time
- **District Metrics**: Success rate per district, error counts
- **Performance Metrics**: Cache hit rate, concurrency utilization, rate limit status
- **Error Metrics**: Error counts by type, retry success rate, permanent failures

## Troubleshooting

### Common Issues

1. **"No valid districts to process"**
   - Check district configuration service
   - Verify target districts are in configured scope
   - Review district validation logs

2. **High failure rates**
   - Check network connectivity
   - Review rate limiting settings
   - Examine external service status

3. **Slow processing**
   - Increase concurrency limits (with caution)
   - Check cache hit rates
   - Review rate limiting delays

4. **Partial snapshots**
   - Review district-level error logs
   - Check for blacklisted districts
   - Verify data availability for dates

### Debug Commands

```bash
# Check service health
curl http://localhost:5001/api/admin/snapshot-store/health

# List recent snapshots
curl http://localhost:5001/api/admin/snapshots?limit=10

# Check performance metrics
curl http://localhost:5001/api/admin/snapshot-store/performance
```

## Migration from Legacy Services

The Unified BackfillService completely replaces both existing BackfillService and DistrictBackfillService:

### API Changes

- **Unified Endpoint**: Single `/api/districts/backfill` endpoint replaces multiple endpoints
- **Enhanced Request Format**: More flexible targeting and configuration options
- **Improved Response Format**: Comprehensive progress tracking and error information

### Behavioral Changes

- **RefreshService Integration**: Uses RefreshService methods instead of direct scraping
- **Enhanced Error Handling**: District-level error tracking with partial snapshots
- **Performance Optimization**: Built-in rate limiting, concurrency control, and caching

### Migration Steps

1. Update API clients to use new endpoint format
2. Update request/response handling for new data structures
3. Remove references to legacy BackfillService and DistrictBackfillService
4. Test with new error handling and progress tracking features

## Best Practices

### Request Configuration

- **Use Auto Collection Type**: Let the service select the optimal strategy
- **Set Reasonable Concurrency**: Start with default (3) and adjust based on performance
- **Enable Caching**: Improves performance for repeated operations
- **Configure Retry Logic**: Enable retries for better resilience

### Error Handling

- **Monitor Partial Snapshots**: Review partial results for data completeness
- **Check Error Summaries**: Use error summaries to identify systemic issues
- **Review District Progress**: Monitor district-level progress for targeted troubleshooting

### Performance Tuning

- **Monitor Cache Hit Rates**: High hit rates indicate effective caching
- **Adjust Rate Limits**: Balance speed with external service protection
- **Scale Concurrency Carefully**: Higher concurrency may overwhelm external services

## Security Considerations

- **Input Validation**: All requests are validated for proper format and scope
- **Scope Enforcement**: District targeting is validated against configured scope
- **Rate Limiting**: Protects against abuse and external service overload
- **Error Information**: Error messages don't expose sensitive system information

## Future Enhancements

Planned improvements for the Unified BackfillService:

- **Webhook Support**: Notifications for job completion and errors
- **Batch Operations**: Support for multiple concurrent backfill jobs
- **Advanced Scheduling**: Cron-like scheduling for regular backfill operations
- **Metrics Dashboard**: Web-based dashboard for monitoring and management
- **Export Capabilities**: Export backfill results in various formats
