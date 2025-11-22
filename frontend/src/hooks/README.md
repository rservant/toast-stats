# District Data Hooks

This directory contains React Query hooks for fetching and managing district-level data in the Toastmasters District Visualizer.

## Available Hooks

### District Data Hooks

#### `useDistrictData(districtId, date, enabled?)`
Fetches cached district data for a specific date, including district, division, and club performance reports.

**Parameters:**
- `districtId`: The district ID (e.g., "46")
- `date`: Date in YYYY-MM-DD format
- `enabled`: Optional boolean to enable/disable the query (default: true)

**Returns:** District cache entry with all three report types

**Cache Strategy:** 10 minutes stale time (historical data doesn't change)

**Example:**
```typescript
const { data, isLoading, error } = useDistrictData('46', '2025-11-22');
```

#### `useDistrictCachedDates(districtId, enabled?)`
Fetches all available cached dates for a district.

**Parameters:**
- `districtId`: The district ID
- `enabled`: Optional boolean to enable/disable the query (default: true)

**Returns:** List of cached dates and date range

**Cache Strategy:** 5 minutes stale time

**Example:**
```typescript
const { data: cachedDates } = useDistrictCachedDates('46');
// cachedDates.dates: ['2025-11-01', '2025-11-02', ...]
// cachedDates.dateRange: { startDate: '2025-11-01', endDate: '2025-11-22' }
```

### Analytics Hooks

#### `useDistrictAnalytics(districtId, startDate?, endDate?)`
Fetches comprehensive district analytics including membership trends, club health, distinguished status, and division rankings.

**Parameters:**
- `districtId`: The district ID
- `startDate`: Optional start date for analysis range
- `endDate`: Optional end date for analysis range

**Returns:** Comprehensive district analytics object

**Cache Strategy:** 5 minutes stale time

**Example:**
```typescript
const { data: analytics } = useDistrictAnalytics('46', '2025-07-01', '2025-11-22');
```

#### `useClubTrends(districtId, clubId, enabled?)`
Fetches trend data for a specific club including membership history, DCP goal progress, and risk assessment.

**Parameters:**
- `districtId`: The district ID
- `clubId`: The club ID
- `enabled`: Optional boolean to enable/disable the query (default: true)

**Returns:** Club trend data with membership and DCP trends

**Cache Strategy:** 5 minutes stale time

**Example:**
```typescript
const { data: clubTrend } = useClubTrends('46', '123456');
```

#### `useAtRiskClubs(districtId, enabled?)`
Fetches list of at-risk and critical clubs for a district.

**Parameters:**
- `districtId`: The district ID
- `enabled`: Optional boolean to enable/disable the query (default: true)

**Returns:** List of at-risk clubs with risk factors

**Cache Strategy:** 5 minutes stale time

**Example:**
```typescript
const { data: atRiskData } = useAtRiskClubs('46');
// atRiskData.clubs: Array of at-risk clubs
// atRiskData.criticalClubs: Count of critical clubs
```

### Backfill Hooks

#### `useInitiateDistrictBackfill(districtId)`
Mutation hook to initiate a backfill operation for a district.

**Parameters:**
- `districtId`: The district ID

**Returns:** Mutation object with `mutate` function

**Example:**
```typescript
const { mutate: startBackfill } = useInitiateDistrictBackfill('46');
startBackfill({ startDate: '2025-07-01', endDate: '2025-11-22' });
```

#### `useDistrictBackfillStatus(districtId, backfillId, enabled?)`
Polls the status of a district backfill operation. Automatically polls every 2 seconds while processing.

**Parameters:**
- `districtId`: The district ID
- `backfillId`: The backfill job ID
- `enabled`: Optional boolean to enable/disable polling (default: true)

**Returns:** Backfill status with progress information

**Auto-polling:** Stops when status is 'complete' or 'error'

**Example:**
```typescript
const { data: status } = useDistrictBackfillStatus('46', backfillId, true);
// status.progress: { total, completed, current, skipped, failed }
```

#### `useCancelDistrictBackfill(districtId)`
Mutation hook to cancel a running backfill operation.

**Parameters:**
- `districtId`: The district ID

**Returns:** Mutation object with `mutate` function

**Example:**
```typescript
const { mutate: cancelBackfill } = useCancelDistrictBackfill('46');
cancelBackfill(backfillId);
```

## Caching Strategy

All hooks use React Query's caching mechanism with the following defaults:

- **Stale Time:** 5-10 minutes depending on data type
  - Historical data (useDistrictData): 10 minutes
  - Analytics and trends: 5 minutes
- **Retry:** 2 attempts for failed requests
- **Refetch on Window Focus:** Disabled (configured globally)
- **Background Refetching:** Enabled for backfill status polling

## Query Keys

Query keys are structured for optimal cache invalidation:

- `['districtData', districtId, date]` - District data by date
- `['district-cached-dates', districtId]` - Cached dates list
- `['districtAnalytics', districtId, startDate, endDate]` - District analytics
- `['clubTrends', districtId, clubId]` - Club trends
- `['atRiskClubs', districtId]` - At-risk clubs
- `['districtBackfillStatus', districtId, backfillId]` - Backfill status

## Error Handling

All hooks return standard React Query error objects. Common error scenarios:

- **404 Not Found:** No cached data available for the requested date/district
- **400 Bad Request:** Invalid parameters (e.g., malformed date)
- **500 Server Error:** Backend processing error

Handle errors using the `error` property:

```typescript
const { data, error, isLoading } = useDistrictData('46', '2025-11-22');

if (error) {
  // Handle error - show message to user
  console.error('Failed to fetch district data:', error.message);
}
```

## Requirements Mapping

These hooks fulfill the following requirements from the district-level-data spec:

- **Requirement 1.4:** Cache district data retrieval (useDistrictData, useDistrictCachedDates)
- **Requirement 2.2:** Backfill progress tracking (useDistrictBackfillStatus)
- **Requirement 3.1:** Display club performance (useDistrictAnalytics, useClubTrends)
- **Requirement 4.4:** At-risk club identification (useAtRiskClubs)
