# Design Document: Analytics Engine Migration

## Overview

This design addresses the migration of the `AnalyticsEngine` service from the legacy `DistrictCacheManager` data source to the new `PerDistrictSnapshotStore` format. The migration ensures the district detail page (`/districts/:districtId/analytics`) works correctly with the new snapshot-based data architecture.

The key change is injecting `PerDistrictSnapshotStore` and `DistrictDataAggregator` as dependencies into `AnalyticsEngine`, replacing the `DistrictCacheManager` dependency.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     API Route Layer                              │
│  /api/districts/:districtId/analytics                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     AnalyticsEngine                              │
│  - generateDistrictAnalytics()                                   │
│  - getClubTrends()                                              │
│  - identifyAtRiskClubs()                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  DistrictDataAggregator                          │
│  - getDistrictData(snapshotId, districtId)                      │
│  - getAllDistricts(snapshotId)                                  │
│  - getDistrictSummary(snapshotId)                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                PerDistrictSnapshotStore                          │
│  - getLatestSuccessful()                                        │
│  - getSnapshot(snapshotId)                                      │
│  - listSnapshots()                                              │
│  - readDistrictData(snapshotId, districtId)                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    File System                                   │
│  cache/snapshots/{snapshotId}/district_{id}.json                │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Modified: AnalyticsEngine

The `AnalyticsEngine` class will be modified to accept the new data sources via constructor injection.

```typescript
interface IAnalyticsDataSource {
  getDistrictData(snapshotId: string, districtId: string): Promise<DistrictStatistics | null>
  getSnapshotsInRange(startDate?: string, endDate?: string): Promise<SnapshotInfo[]>
  getLatestSnapshot(): Promise<Snapshot | null>
}

class AnalyticsEngine {
  constructor(
    private dataSource: IAnalyticsDataSource,
    private snapshotStore: PerDistrictSnapshotStore
  ) {}

  async generateDistrictAnalytics(
    districtId: string,
    startDate?: string,
    endDate?: string
  ): Promise<DistrictAnalytics> {
    // 1. Get available snapshots in date range
    // 2. Load district data from each snapshot
    // 3. Calculate analytics from the data
  }
}
```

### New: AnalyticsDataSourceAdapter

An adapter that wraps `DistrictDataAggregator` and `PerDistrictSnapshotStore` to provide the `IAnalyticsDataSource` interface.

```typescript
class AnalyticsDataSourceAdapter implements IAnalyticsDataSource {
  constructor(
    private aggregator: DistrictDataAggregator,
    private snapshotStore: PerDistrictSnapshotStore
  ) {}

  async getDistrictData(snapshotId: string, districtId: string): Promise<DistrictStatistics | null> {
    return this.aggregator.getDistrictData(snapshotId, districtId)
  }

  async getSnapshotsInRange(startDate?: string, endDate?: string): Promise<SnapshotInfo[]> {
    const snapshots = await this.snapshotStore.listSnapshots()
    return snapshots.filter(s => {
      if (startDate && s.snapshot_id < startDate) return false
      if (endDate && s.snapshot_id > endDate) return false
      return s.status === 'success'
    })
  }

  async getLatestSnapshot(): Promise<Snapshot | null> {
    return this.snapshotStore.getLatestSuccessful()
  }
}
```

## Data Models

### DistrictStatistics (existing)

The `DistrictStatistics` type from the new snapshot format contains:

```typescript
interface DistrictStatistics {
  districtId: string
  membership?: {
    total: number
    newMembers?: number
    renewals?: number
  }
  clubs?: {
    total: number
    active: number
    suspended: number
    distinguished: number
  }
  dcpGoals?: {
    total: number
    achieved: number
  }
  divisions?: DivisionData[]
  areas?: AreaData[]
  clubPerformance?: ClubPerformanceData[]
}
```

### SnapshotInfo (existing)

```typescript
interface SnapshotInfo {
  snapshot_id: string  // ISO date format: YYYY-MM-DD
  status: 'success' | 'partial' | 'failed'
  created_at: string
}
```

### DistrictAnalytics (existing - response format)

The response format remains unchanged to maintain backward compatibility:

```typescript
interface DistrictAnalytics {
  districtId: string
  dateRange: { start: string; end: string }
  totalMembership: number
  membershipChange: number
  membershipTrend: Array<{ date: string; count: number }>
  topGrowthClubs: Array<{ clubId: string; clubName: string; growth: number }>
  allClubs: ClubTrend[]
  atRiskClubs: ClubTrend[]
  healthyClubs: ClubTrend[]
  criticalClubs: ClubTrend[]
  distinguishedClubs: {
    smedley: number
    presidents: number
    select: number
    distinguished: number
    total: number
  }
  distinguishedProjection: number
  divisionRankings: DivisionAnalytics[]
  topPerformingAreas: AreaAnalytics[]
  yearOverYear?: YearOverYearData
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Data Source Usage

*For any* analytics request with a valid district ID, the AnalyticsEngine SHALL retrieve data from the PerDistrictSnapshotStore (not the legacy DistrictCacheManager).

**Validates: Requirements 1.1**

### Property 2: Response Format Consistency

*For any* successful analytics request, the response SHALL contain all required fields (districtId, dateRange, totalMembership, membershipChange, membershipTrend, allClubs, atRiskClubs, healthyClubs, criticalClubs, distinguishedClubs, divisionRankings, topPerformingAreas) with correct types.

**Validates: Requirements 1.3, 1.4**

### Property 3: Date Range Filtering

*For any* analytics request with startDate and/or endDate parameters, all data points in the response SHALL have dates within the specified range (inclusive).

**Validates: Requirements 2.1, 2.2, 2.3**

### Property 4: Club Health Classification

*For any* club in the analytics response:
- If membership < 12, the club SHALL be in criticalClubs
- If membership >= 12 AND dcpGoals = 0, the club SHALL be in atRiskClubs  
- If membership >= 12 AND dcpGoals >= 1, the club SHALL be in healthyClubs
- Each club SHALL appear in exactly one of these arrays

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

### Property 5: Distinguished Club Counting

*For any* analytics response, the distinguishedClubs.total SHALL equal the sum of distinguishedClubs.smedley + distinguishedClubs.presidents + distinguishedClubs.select + distinguishedClubs.distinguished.

**Validates: Requirements 4.1, 4.2**

### Property 6: Division Ranking Consistency

*For any* analytics response with multiple divisions, the divisionRankings array SHALL be sorted by rank in ascending order, and each division's rank SHALL be unique.

**Validates: Requirements 5.1, 5.3**

### Property 7: Error Response Quality

*For any* error response from the analytics endpoint, the response SHALL include an error object with code, message, and details fields.

**Validates: Requirements 6.3**

## Error Handling

### No Data Available

When no snapshot data exists for the requested district:

```typescript
{
  error: {
    code: 'NO_DATA_AVAILABLE',
    message: 'No cached data available for analytics',
    details: 'Consider initiating a backfill to fetch historical data'
  }
}
```

HTTP Status: 404

### Service Unavailable

When the snapshot store is unavailable:

```typescript
{
  error: {
    code: 'SERVICE_UNAVAILABLE', 
    message: 'Snapshot store is temporarily unavailable',
    details: 'Please try again later'
  }
}
```

HTTP Status: 503

### Invalid Parameters

When date parameters are invalid:

```typescript
{
  error: {
    code: 'INVALID_DATE_FORMAT',
    message: 'startDate must be in YYYY-MM-DD format',
    details: 'Received: invalid-date'
  }
}
```

HTTP Status: 400

## Testing Strategy

### Unit Tests

Unit tests will verify:
- Individual calculation methods (club health classification, distinguished counting)
- Date range filtering logic
- Error handling for edge cases

### Property-Based Tests

Property-based tests using fast-check will verify:
- Club health classification is deterministic and mutually exclusive
- Distinguished club totals are consistent
- Date filtering is correct for any valid date range
- Response format is always valid

Configuration:
- Minimum 100 iterations per property test
- Use fast-check for TypeScript property-based testing
- Tag format: **Feature: analytics-engine-migration, Property {number}: {property_text}**

### Integration Tests

Integration tests will verify:
- End-to-end flow from API request to response
- Correct interaction with PerDistrictSnapshotStore
- Backward compatibility with existing API consumers
