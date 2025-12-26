# Month-End Data Reconciliation - Design Document

## Overview

The Month-End Data Reconciliation system addresses the challenge that Toastmasters dashboard data for month-end is not immediately finalized. The official dashboard continues updating previous month data for several days into the following month. This system automatically detects when month-end data is truly final and ensures our cached data represents the most accurate state.

The solution extends the existing DistrictBackfillService with intelligent reconciliation logic that monitors data changes, updates caches in real-time, and provides visibility into the reconciliation process.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Month-End Reconciliation System              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────┐ │
│  │ Reconciliation  │    │ Change Detection│    │ Progress    │ │
│  │ Scheduler       │    │ Engine          │    │ Tracker     │ │
│  └─────────────────┘    └─────────────────┘    └─────────────┘ │
│           │                       │                     │       │
│           ▼                       ▼                     ▼       │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │            Reconciliation Orchestrator                     │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                │                                 │
└────────────────────────────────┼─────────────────────────────────┘
                                 │
┌────────────────────────────────┼─────────────────────────────────┐
│              Existing System   │                                 │
├────────────────────────────────┼─────────────────────────────────┤
│                                ▼                                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────┐ │
│  │ District        │    │ Cache Manager   │    │ API         │ │
│  │ Backfill        │◄──►│                 │◄──►│ Endpoints   │ │
│  │ Service         │    │                 │    │             │ │
│  └─────────────────┘    └─────────────────┘    └─────────────┘ │
│                                │                                 │
└────────────────────────────────┼─────────────────────────────────┘
                                 │
                    ┌─────────────────┐
                    │ Toastmasters    │
                    │ Dashboard       │
                    └─────────────────┘
```

## Components and Interfaces

### 1. ReconciliationScheduler

**Purpose**: Automatically initiates reconciliation monitoring when months transition.

**Key Methods**:

```typescript
interface ReconciliationScheduler {
  scheduleMonthEndReconciliation(
    districtId: string,
    monthEndDate: Date
  ): Promise<void>
  checkPendingReconciliations(): Promise<ReconciliationJob[]>
  cancelReconciliation(jobId: string): Promise<void>
}
```

### 2. ChangeDetectionEngine

**Purpose**: Compares current dashboard data with cached data to identify changes.

**Key Methods**:

```typescript
interface ChangeDetectionEngine {
  detectChanges(
    districtId: string,
    cachedData: DistrictData,
    currentData: DistrictData
  ): DataChanges
  isSignificantChange(
    changes: DataChanges,
    thresholds: ChangeThresholds
  ): boolean
  calculateChangeMetrics(changes: DataChanges): ChangeMetrics
}
```

### 3. ReconciliationOrchestrator

**Purpose**: Coordinates the entire reconciliation process for a district/month.

**Key Methods**:

```typescript
interface ReconciliationOrchestrator {
  startReconciliation(
    districtId: string,
    targetMonth: string
  ): Promise<ReconciliationJob>
  processReconciliationCycle(jobId: string): Promise<ReconciliationStatus>
  finalizeReconciliation(jobId: string): Promise<void>
  extendReconciliation(jobId: string, additionalDays: number): Promise<void>
}
```

### 4. ProgressTracker

**Purpose**: Tracks and stores reconciliation progress for visibility and analysis.

**Key Methods**:

```typescript
interface ProgressTracker {
  recordDataUpdate(
    jobId: string,
    date: Date,
    changes: DataChanges
  ): Promise<void>
  getReconciliationTimeline(jobId: string): Promise<ReconciliationTimeline>
  estimateCompletion(jobId: string): Promise<Date | null>
  markAsFinalized(jobId: string, finalDate: Date): Promise<void>
}
```

## Data Models

### ReconciliationJob

```typescript
interface ReconciliationJob {
  id: string
  districtId: string
  targetMonth: string // YYYY-MM format
  status: 'active' | 'completed' | 'failed' | 'cancelled'
  startDate: Date
  endDate?: Date
  maxEndDate: Date // Configuration-based limit
  currentDataDate?: Date // Latest "as of" date from dashboard
  finalizedDate?: Date
  config: ReconciliationConfig
  metadata: {
    createdAt: Date
    updatedAt: Date
    triggeredBy: 'automatic' | 'manual'
  }
}
```

### ReconciliationConfig

```typescript
interface ReconciliationConfig {
  maxReconciliationDays: number // Default: 15
  stabilityPeriodDays: number // Default: 3
  checkFrequencyHours: number // Default: 24
  significantChangeThresholds: {
    membershipPercent: number // Default: 1%
    clubCountAbsolute: number // Default: 1
    distinguishedPercent: number // Default: 2%
  }
  autoExtensionEnabled: boolean // Default: true
  maxExtensionDays: number // Default: 5
}
```

### DataChanges

```typescript
interface DataChanges {
  hasChanges: boolean
  changedFields: string[]
  membershipChange?: {
    previous: number
    current: number
    percentChange: number
  }
  clubCountChange?: {
    previous: number
    current: number
    absoluteChange: number
  }
  distinguishedChange?: {
    previous: DistinguishedCounts
    current: DistinguishedCounts
    percentChange: number
  }
  timestamp: Date
  sourceDataDate: string // "as of" date from dashboard
}
```

### ReconciliationTimeline

```typescript
interface ReconciliationTimeline {
  jobId: string
  districtId: string
  targetMonth: string
  entries: ReconciliationEntry[]
  status: ReconciliationStatus
  estimatedCompletion?: Date
}

interface ReconciliationEntry {
  date: Date
  sourceDataDate: string // Dashboard "as of" date
  changes: DataChanges
  isSignificant: boolean
  cacheUpdated: boolean
  notes?: string
}
```

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property 1: Automatic Reconciliation Initiation

_For any_ month transition, the system should automatically initiate reconciliation monitoring for the previous month without manual intervention
**Validates: Requirements 2.1**

### Property 2: Real-time Cache Updates

_For any_ data changes detected during reconciliation, the cached month-end entry should be immediately updated with the new data
**Validates: Requirements 2.3, 5.3**

### Property 3: Change Detection Accuracy

_For any_ comparison between cached and current dashboard data, the system should correctly identify all significant changes based on configured thresholds
**Validates: Requirements 2.2, 6.2**

### Property 4: Finalization Logic

_For any_ reconciliation period where no changes are detected for the configured stability period, the system should mark the month-end data as final
**Validates: Requirements 1.5, 2.4**

### Property 5: Data Status Indicators

_For any_ month-end data display, the system should show the correct status (preliminary/final) with accurate collection dates
**Validates: Requirements 1.3, 3.1, 3.2, 3.4**

### Property 6: Latest Data Selection

_For any_ month with multiple data points during reconciliation, the system should always use the data with the latest "as of" date from the dashboard
**Validates: Requirements 4.4, 4.5**

### Property 7: Reconciliation Timeline Accuracy

_For any_ reconciliation job, the progress timeline should accurately reflect all data changes and their timestamps during the reconciliation period
**Validates: Requirements 3.3, 5.1, 5.2**

### Property 8: Configuration Compliance

_For any_ reconciliation job, the system should respect all configured parameters including maximum periods, thresholds, and monitoring frequency
**Validates: Requirements 6.1, 6.2, 6.3**

### Property 9: Stability Period Detection

_For any_ sequence of consecutive days without data changes, the system should correctly identify and display the stability period
**Validates: Requirements 5.4**

### Property 10: Extension Logic

_For any_ reconciliation where significant changes are detected near the end of the monitoring period, the system should extend monitoring when auto-extension is enabled
**Validates: Requirements 4.3**

## Error Handling

### Reconciliation Failures

- **Dashboard Unavailable**: Retry with exponential backoff, alert if extended outage
- **Data Parsing Errors**: Log detailed error, use previous valid data, alert administrators
- **Cache Update Failures**: Retry cache operations, maintain data consistency
- **Configuration Errors**: Validate configuration on startup and changes

### Timeout Handling

- **Max Period Exceeded**: Finalize with best available data, log timeout reason
- **Network Timeouts**: Implement circuit breaker pattern for dashboard requests
- **Processing Timeouts**: Queue reconciliation jobs to prevent blocking

### Data Inconsistency

- **Conflicting Updates**: Use timestamp-based conflict resolution
- **Missing Data**: Attempt to backfill missing periods before reconciliation
- **Corrupted Cache**: Rebuild cache from source data when possible

## Testing Strategy

### Unit Testing

- Test change detection algorithms with various data scenarios
- Test reconciliation logic with different configuration parameters
- Test timeline generation and progress tracking
- Test configuration validation and error handling

### Property-Based Testing

- **Property 1**: Generate random month transitions and verify automatic reconciliation initiation
- **Property 2**: Generate data changes and verify immediate cache updates
- **Property 3**: Generate various data sets and verify change detection accuracy
- **Property 4**: Generate stability periods and verify correct finalization
- **Property 5**: Generate different data states and verify correct status indicators
- **Property 6**: Generate multiple data points and verify latest selection
- **Property 7**: Generate reconciliation activities and verify timeline accuracy
- **Property 8**: Generate various configurations and verify compliance
- **Property 9**: Generate stability sequences and verify detection
- **Property 10**: Generate late changes and verify extension logic

### Integration Testing

- Test end-to-end reconciliation workflows with mock dashboard data
- Test interaction with existing DistrictBackfillService
- Test API endpoints for reconciliation status and progress
- Test configuration changes during active reconciliation

### Performance Testing

- Test reconciliation performance with large numbers of districts
- Test memory usage during extended reconciliation periods
- Test database performance with reconciliation timeline storage
- Test concurrent reconciliation job processing

## Implementation Phases

### Phase 1: Core Reconciliation Engine (Week 1-2)

- Implement ReconciliationOrchestrator and ChangeDetectionEngine
- Create data models and database schema
- Implement basic reconciliation workflow
- Add configuration management

### Phase 2: Scheduling and Automation (Week 2-3)

- Implement ReconciliationScheduler for automatic initiation
- Add job queue management for concurrent reconciliations
- Implement retry logic and error handling
- Add monitoring and alerting

### Phase 3: Progress Tracking and UI (Week 3-4)

- Implement ProgressTracker for timeline management
- Create API endpoints for reconciliation status
- Build frontend components for reconciliation visibility
- Add reconciliation management interface

### Phase 4: Advanced Features (Week 4-5)

- Implement estimation algorithms for completion dates
- Add advanced configuration options
- Implement testing and simulation tools
- Add performance optimizations

## Deployment Considerations

### Database Changes

- Add reconciliation job tables
- Add reconciliation timeline tables
- Add configuration tables
- Create indexes for performance

### Configuration Management

- Add reconciliation settings to application config
- Provide environment-specific defaults
- Add runtime configuration validation

### Monitoring and Alerting

- Add metrics for reconciliation job success/failure rates
- Monitor reconciliation duration and data change patterns
- Alert on failed reconciliations or extended periods without finalization

### Backward Compatibility

- Ensure existing month-end data remains accessible
- Provide migration path for historical data
- Maintain existing API contracts while adding new endpoints
