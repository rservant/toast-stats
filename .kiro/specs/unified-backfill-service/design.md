# Design Document: Unified Backfill Service

## Overview

The Unified Backfill Service consolidates two existing backfill mechanisms into a single, resilient backend service with persistent job state, automatic recovery, and a consolidated Admin UI. The service handles both data collection (fetching historical Toastmasters dashboard data) and analytics generation (computing pre-computed analytics for existing snapshots).

The design follows the existing storage abstraction pattern established in the codebase, enabling environment-based selection between local filesystem and Firestore/GCS storage backends.

## Architecture

```mermaid
graph TB
    subgraph "Frontend"
        AdminPanel[Admin Panel - Backfill Section]
        JobHistory[Job History Component]
        ProgressDisplay[Progress Display Component]
        RateLimitConfig[Rate Limit Config Component]
    end

    subgraph "API Layer"
        BackfillRoutes[/api/admin/backfill/*]
    end

    subgraph "Service Layer"
        UnifiedBackfillService[UnifiedBackfillService]
        JobManager[JobManager]
        DataCollector[DataCollector]
        AnalyticsGenerator[AnalyticsGenerator]
        RecoveryManager[RecoveryManager]
    end

    subgraph "Storage Abstraction"
        IBackfillJobStorage[IBackfillJobStorage Interface]
        LocalJobStorage[LocalBackfillJobStorage]
        FirestoreJobStorage[FirestoreBackfillJobStorage]
    end

    subgraph "Existing Services"
        RefreshService[RefreshService]
        SnapshotStorage[ISnapshotStorage]
        TimeSeriesStorage[ITimeSeriesIndexStorage]
    end

    AdminPanel --> BackfillRoutes
    JobHistory --> BackfillRoutes
    ProgressDisplay --> BackfillRoutes
    RateLimitConfig --> BackfillRoutes

    BackfillRoutes --> UnifiedBackfillService
    UnifiedBackfillService --> JobManager
    UnifiedBackfillService --> DataCollector
    UnifiedBackfillService --> AnalyticsGenerator
    UnifiedBackfillService --> RecoveryManager

    JobManager --> IBackfillJobStorage
    IBackfillJobStorage --> LocalJobStorage
    IBackfillJobStorage --> FirestoreJobStorage

    DataCollector --> RefreshService
    DataCollector --> SnapshotStorage
    AnalyticsGenerator --> SnapshotStorage
    AnalyticsGenerator --> TimeSeriesStorage
```

## Components and Interfaces

### IBackfillJobStorage Interface

The storage abstraction interface for persisting backfill job state. Follows the existing pattern from `storageInterfaces.ts`.

```typescript
interface IBackfillJobStorage {
  // Job CRUD operations
  createJob(job: BackfillJob): Promise<void>
  getJob(jobId: string): Promise<BackfillJob | null>
  updateJob(jobId: string, updates: Partial<BackfillJob>): Promise<void>
  deleteJob(jobId: string): Promise<boolean>

  // Job queries
  listJobs(options?: ListJobsOptions): Promise<BackfillJob[]>
  getActiveJob(): Promise<BackfillJob | null>
  getJobsByStatus(status: BackfillJobStatus[]): Promise<BackfillJob[]>

  // Checkpoint operations
  updateCheckpoint(jobId: string, checkpoint: JobCheckpoint): Promise<void>
  getCheckpoint(jobId: string): Promise<JobCheckpoint | null>

  // Configuration
  getRateLimitConfig(): Promise<RateLimitConfig>
  setRateLimitConfig(config: RateLimitConfig): Promise<void>

  // Maintenance
  cleanupOldJobs(retentionDays: number): Promise<number>
  isReady(): Promise<boolean>
}

interface ListJobsOptions {
  limit?: number
  offset?: number
  status?: BackfillJobStatus[]
  jobType?: BackfillJobType[]
  startDateFrom?: string
  startDateTo?: string
}
```

### UnifiedBackfillService

The main orchestrator service that coordinates job execution, delegates to specialized collectors, and manages the job lifecycle.

```typescript
class UnifiedBackfillService {
  constructor(
    jobStorage: IBackfillJobStorage,
    snapshotStorage: ISnapshotStorage,
    timeSeriesStorage: ITimeSeriesIndexStorage,
    refreshService: RefreshService,
    configService: DistrictConfigurationService
  )

  // Job operations
  createJob(request: CreateJobRequest): Promise<BackfillJob>
  getJobStatus(jobId: string): Promise<BackfillJobStatus | null>
  cancelJob(jobId: string): Promise<boolean>

  // Preview/dry run
  previewJob(request: CreateJobRequest): Promise<JobPreview>

  // Job history
  listJobs(options?: ListJobsOptions): Promise<BackfillJob[]>

  // Configuration
  getRateLimitConfig(): Promise<RateLimitConfig>
  updateRateLimitConfig(config: Partial<RateLimitConfig>): Promise<void>

  // Recovery (called on startup)
  recoverIncompleteJobs(): Promise<void>
}
```

### JobManager

Handles job lifecycle, progress tracking, and checkpoint management.

```typescript
class JobManager {
  constructor(jobStorage: IBackfillJobStorage)

  createJob(request: CreateJobRequest): Promise<BackfillJob>
  updateProgress(jobId: string, progress: Partial<JobProgress>): Promise<void>
  updateCheckpoint(jobId: string, checkpoint: JobCheckpoint): Promise<void>
  completeJob(jobId: string, result: JobResult): Promise<void>
  failJob(jobId: string, error: string): Promise<void>
  cancelJob(jobId: string): Promise<boolean>

  // Deduplication
  canStartNewJob(): Promise<boolean>
  getActiveJob(): Promise<BackfillJob | null>
}
```

### DataCollector

Handles data collection backfill operations, reusing logic from existing BackfillService.

```typescript
class DataCollector {
  constructor(
    refreshService: RefreshService,
    snapshotStorage: ISnapshotStorage,
    configService: DistrictConfigurationService
  )

  collectForDateRange(
    startDate: string,
    endDate: string,
    options: CollectionOptions,
    progressCallback: (progress: CollectionProgress) => void
  ): Promise<CollectionResult>

  previewCollection(
    startDate: string,
    endDate: string,
    options: CollectionOptions
  ): Promise<CollectionPreview>
}
```

### AnalyticsGenerator

Handles analytics generation backfill operations.

```typescript
class AnalyticsGenerator {
  constructor(
    snapshotStorage: ISnapshotStorage,
    timeSeriesStorage: ITimeSeriesIndexStorage
  )

  generateForSnapshots(
    snapshotIds: string[],
    progressCallback: (progress: GenerationProgress) => void
  ): Promise<GenerationResult>

  previewGeneration(
    startDate?: string,
    endDate?: string
  ): Promise<GenerationPreview>
}
```

### RecoveryManager

Handles automatic recovery of incomplete jobs on server startup.

```typescript
class RecoveryManager {
  constructor(
    jobStorage: IBackfillJobStorage,
    unifiedBackfillService: UnifiedBackfillService
  )

  recoverIncompleteJobs(): Promise<RecoveryResult>
  getRecoveryStatus(): RecoveryStatus
}
```

## Data Models

### BackfillJob

```typescript
interface BackfillJob {
  jobId: string
  jobType: BackfillJobType
  status: BackfillJobStatus

  // Configuration
  config: JobConfig

  // Progress tracking
  progress: JobProgress

  // Checkpoint for recovery
  checkpoint: JobCheckpoint | null

  // Timing
  createdAt: string // ISO timestamp
  startedAt: string | null
  completedAt: string | null
  resumedAt: string | null // Set if job was recovered

  // Results
  result: JobResult | null
  error: string | null
}

type BackfillJobType = 'data-collection' | 'analytics-generation'

type BackfillJobStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'recovering' // Being resumed after restart

interface JobConfig {
  // Date range (for both job types)
  startDate?: string
  endDate?: string

  // For data-collection
  targetDistricts?: string[]
  skipExisting?: boolean

  // Rate limiting overrides
  rateLimitOverrides?: Partial<RateLimitConfig>
}

interface JobProgress {
  totalItems: number
  processedItems: number
  failedItems: number
  skippedItems: number
  currentItem: string | null

  // Per-district breakdown (for expandable detail)
  districtProgress: Map<string, DistrictProgress>

  // Error tracking
  errors: JobError[]
}

interface DistrictProgress {
  districtId: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped'
  itemsProcessed: number
  itemsTotal: number
  lastError: string | null
}

interface JobCheckpoint {
  lastProcessedItem: string
  lastProcessedAt: string
  itemsCompleted: string[] // List of completed item IDs for skip-on-resume
}

interface JobResult {
  itemsProcessed: number
  itemsFailed: number
  itemsSkipped: number
  snapshotIds: string[] // For data-collection
  duration: number // milliseconds
}

interface JobError {
  itemId: string
  message: string
  occurredAt: string
  isRetryable: boolean
}
```

### RateLimitConfig

```typescript
interface RateLimitConfig {
  maxRequestsPerMinute: number
  maxConcurrent: number
  minDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
}
```

### JobPreview (Dry Run Response)

```typescript
interface JobPreview {
  jobType: BackfillJobType
  totalItems: number
  dateRange: {
    startDate: string
    endDate: string
  }
  affectedDistricts: string[]
  estimatedDuration: number // milliseconds
  itemBreakdown: {
    dates?: string[] // For data-collection
    snapshotIds?: string[] // For analytics-generation
  }
}
```

### API Request/Response Types

```typescript
interface CreateJobRequest {
  jobType: BackfillJobType
  startDate?: string
  endDate?: string
  targetDistricts?: string[]
  skipExisting?: boolean
  rateLimitOverrides?: Partial<RateLimitConfig>
}

interface CreateJobResponse {
  jobId: string
  status: BackfillJobStatus
  message: string
  metadata: {
    operationId: string
    createdAt: string
  }
}

interface JobStatusResponse {
  jobId: string
  jobType: BackfillJobType
  status: BackfillJobStatus
  config: JobConfig
  progress: JobProgress
  checkpoint: JobCheckpoint | null
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  resumedAt: string | null
  result: JobResult | null
  error: string | null
  metadata: {
    operationId: string
    retrievedAt: string
  }
}

interface ListJobsResponse {
  jobs: BackfillJob[]
  total: number
  limit: number
  offset: number
  metadata: {
    operationId: string
    retrievedAt: string
  }
}
```

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

Per the property-testing-guidance steering document, property-based tests are reserved for cases with mathematical invariants, complex input spaces, or universal business rules. Many requirements are better validated with well-chosen example-based unit tests.

### Property 1: Job Persistence Round-Trip

_For any_ valid BackfillJob, creating the job via Job_Storage and then retrieving it by jobId SHALL return an equivalent job object.

**Validates: Requirements 1.2**

_Rationale: This is a serialization/deserialization round-trip property - a classic PBT use case per the guidance._

### Property 2: Job Listing Order Invariant

_For any_ set of BackfillJobs created at different times, listing jobs SHALL return them sorted by creation time with newest first.

**Validates: Requirements 1.6**

_Rationale: This is a sorting invariant - the output must maintain a specific ordering property regardless of input order._

### Property 3: Date Range Validation

_For any_ CreateJobRequest with startDate and endDate, if startDate > endDate OR endDate >= today, the request SHALL be rejected with a validation error.

**Validates: Requirements 4.3, 4.4**

_Rationale: Input validation with boundary conditions benefits from PBT to explore edge cases around date boundaries._

### Property 4: Job Filtering By Status

_For any_ status filter applied to listJobs, all returned jobs SHALL have a status matching one of the filter values.

**Validates: Requirements 6.3**

_Rationale: This is a universal property about filtering - the invariant must hold for all possible filter combinations._

### Property 5: Rate Limit Config Persistence Round-Trip

_For any_ valid RateLimitConfig, setting the config via Job_Storage and then retrieving it SHALL return an equivalent config object.

**Validates: Requirements 12.5**

_Rationale: Another serialization round-trip property._

### Example-Based Tests (Not Property Tests)

The following requirements are better validated with specific example-based unit tests per the property-testing-guidance:

| Requirement             | Test Approach                         | Rationale                                |
| ----------------------- | ------------------------------------- | ---------------------------------------- |
| 1.7 Job retention       | 3-4 examples with dates at boundaries | Simple date comparison, examples clearer |
| 3.1 One-job-at-a-time   | 2-3 examples (running, pending, none) | Bounded state space, examples sufficient |
| 3.4 Stale job override  | 2 examples (stale vs fresh)           | Simple time comparison                   |
| 5.4 Error recording     | 1-2 examples verifying fields         | Structural validation, not complex input |
| 7.2, 7.3 Cancellation   | Integration test with mock            | Behavior verification, not invariant     |
| 9.5 Pagination          | 3-4 examples with edge cases          | Bounded input space                      |
| 10.1, 10.3 Recovery     | Integration test with checkpoint      | Complex interaction, not pure function   |
| 11.2, 11.3 Preview      | 2-3 examples                          | Simple CRUD-like operation               |
| 12.3 Rate limit applied | 1-2 examples                          | Configuration wiring                     |

## Error Handling

### Storage Errors

| Error Type                | Handling Strategy                                     |
| ------------------------- | ----------------------------------------------------- |
| Job not found             | Return null or 404 response                           |
| Storage unavailable       | Retry with exponential backoff, fail after 3 attempts |
| Concurrent modification   | Use optimistic locking, retry on conflict             |
| Serialization error       | Log error, return 500 with details                    |
| Config file missing       | Create with defaults, log info message                |
| Storage directory missing | Create directory structure, continue                  |

### Graceful Initialization

When the application starts:

1. **Storage Directory**: If the job storage directory doesn't exist, create it automatically
2. **Rate Limit Config**: If no rate limit configuration exists, create one with sensible defaults:
   ```typescript
   const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
     maxRequestsPerMinute: 10,
     maxConcurrent: 3,
     minDelayMs: 2000,
     maxDelayMs: 30000,
     backoffMultiplier: 2,
   }
   ```
3. **Job Index**: If no job index exists, create an empty one
4. **Never fail on missing config**: Log informational messages, create defaults, continue startup

### Job Execution Errors

| Error Type                   | Handling Strategy                                        |
| ---------------------------- | -------------------------------------------------------- |
| Data fetch failure           | Record error, continue with next item, mark as retryable |
| Analytics generation failure | Record error, continue with next snapshot                |
| Rate limit exceeded          | Apply backoff, retry after delay                         |
| Timeout                      | Record error, mark as retryable, continue                |
| Checkpoint save failure      | Log warning, continue (will re-process on restart)       |

### Recovery Errors

| Error Type            | Handling Strategy                          |
| --------------------- | ------------------------------------------ |
| Corrupted checkpoint  | Log error, restart job from beginning      |
| Missing job data      | Mark job as failed, allow new jobs         |
| Storage inconsistency | Log error, attempt repair, fail gracefully |

### API Error Responses

```typescript
interface ErrorResponse {
  error: {
    code: string
    message: string
    details?: string
    retryable?: boolean
  }
  metadata: {
    operationId: string
    timestamp: string
  }
}

// Error codes
const ERROR_CODES = {
  JOB_NOT_FOUND: 'JOB_NOT_FOUND',
  JOB_ALREADY_RUNNING: 'JOB_ALREADY_RUNNING',
  INVALID_DATE_RANGE: 'INVALID_DATE_RANGE',
  INVALID_JOB_TYPE: 'INVALID_JOB_TYPE',
  CANCELLATION_FAILED: 'CANCELLATION_FAILED',
  STORAGE_ERROR: 'STORAGE_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
}
```

## Testing Strategy

### Unit Tests

Unit tests focus on individual component logic with well-chosen examples:

- **JobManager**: Job lifecycle state transitions, deduplication logic, checkpoint management
- **DataCollector**: Date range generation, skip logic, progress calculation
- **AnalyticsGenerator**: Snapshot selection, analytics computation delegation
- **RecoveryManager**: Recovery detection, checkpoint restoration
- **Validation**: Date range validation edge cases, job type validation

### Property-Based Tests

Per property-testing-guidance, property tests are limited to cases with genuine invariants:

| Property                     | Test Focus                | Iterations |
| ---------------------------- | ------------------------- | ---------- |
| Job Persistence Round-Trip   | Serialization correctness | 100        |
| Job Listing Order Invariant  | Sorting correctness       | 100        |
| Date Range Validation        | Boundary conditions       | 100        |
| Job Filtering By Status      | Filter correctness        | 100        |
| Rate Limit Config Round-Trip | Serialization correctness | 100        |

Tag format: **Feature: unified-backfill-service, Property {number}: {property_text}**

### Integration Tests

Integration tests verify component interactions:

- Storage implementations (Local and Firestore) against IBackfillJobStorage interface
- API endpoints with mock services
- Recovery flow with simulated restart
- End-to-end job execution with test data
- Graceful initialization with missing config files

### Test Configuration

```typescript
// Property test configuration
const PROPERTY_TEST_CONFIG = {
  numRuns: 100,
  seed: undefined, // Random seed for reproducibility when debugging
  verbose: false,
}

// Test data generators for property tests
const jobIdArbitrary = fc.uuid()
const jobTypeArbitrary = fc.constantFrom(
  'data-collection',
  'analytics-generation'
)
const dateArbitrary = fc
  .date({ min: new Date('2020-01-01'), max: new Date() })
  .map(d => d.toISOString().split('T')[0])
const jobStatusArbitrary = fc.constantFrom(
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled'
)
```

### Test Isolation Requirements

Per testing.md steering document:

- Each test uses unique job IDs and isolated storage instances
- Tests clean up all created resources in afterEach hooks
- No shared state between tests
- Tests must pass when run in parallel with `--run` flag
