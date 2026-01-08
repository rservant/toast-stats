# Requirements Document

## Introduction

The district detail page (`/districts/:districtId`) fails to load because the `AnalyticsEngine` service uses the old `DistrictCacheManager` data source, which looks for data in `cache/districts/{districtId}/{date}.json`. However, the system has migrated to a new `PerDistrictSnapshotStore` format that stores data in `cache/snapshots/{snapshotId}/district_{id}.json`. This migration broke the analytics endpoint while other endpoints (like `/rankings`) work correctly because they use the new data source directly.

## Glossary

- **AnalyticsEngine**: Service that generates comprehensive district analytics including membership trends, club health, and DCP goal analysis
- **DistrictCacheManager**: Legacy data access layer that reads from `cache/districts/{districtId}/{date}.json` files
- **PerDistrictSnapshotStore**: New data access layer that reads from `cache/snapshots/{snapshotId}/district_{id}.json` files
- **DistrictDataAggregator**: Service that provides efficient access to per-district snapshot data with caching
- **DistrictStatistics**: Normalized data structure containing all district performance metrics
- **Snapshot**: A point-in-time capture of all district data with metadata

## Requirements

### Requirement 1: Analytics Engine Data Source Migration

**User Story:** As a district leader, I want to view district analytics on the detail page, so that I can understand performance trends and identify areas for improvement.

#### Acceptance Criteria

1. WHEN a user requests district analytics, THE AnalyticsEngine SHALL retrieve data from the PerDistrictSnapshotStore
2. WHEN the PerDistrictSnapshotStore has no data for a district, THE AnalyticsEngine SHALL return a clear error indicating no data is available
3. WHEN generating analytics, THE AnalyticsEngine SHALL use the same data format as other endpoints that successfully use the new snapshot store
4. THE AnalyticsEngine SHALL maintain backward compatibility with existing API response formats

### Requirement 2: Date Range Support

**User Story:** As a district leader, I want to view analytics for specific date ranges, so that I can analyze performance over different time periods.

#### Acceptance Criteria

1. WHEN a startDate parameter is provided, THE AnalyticsEngine SHALL filter data to include only snapshots on or after that date
2. WHEN an endDate parameter is provided, THE AnalyticsEngine SHALL filter data to include only snapshots on or before that date
3. WHEN both startDate and endDate are provided, THE AnalyticsEngine SHALL return data within that range
4. WHEN no date parameters are provided, THE AnalyticsEngine SHALL use the latest available snapshot

### Requirement 3: Club Trend Analysis

**User Story:** As a district leader, I want to see club-level trends, so that I can identify at-risk and high-performing clubs.

#### Acceptance Criteria

1. WHEN generating analytics, THE AnalyticsEngine SHALL calculate club health status (healthy, at-risk, critical) based on membership and DCP goals
2. WHEN a club has membership below 12, THE AnalyticsEngine SHALL classify it as critical
3. WHEN a club has membership at or above 12 but zero DCP goals, THE AnalyticsEngine SHALL classify it as at-risk
4. WHEN a club has membership at or above 12 and at least one DCP goal, THE AnalyticsEngine SHALL classify it as healthy
5. THE AnalyticsEngine SHALL return separate arrays for atRiskClubs, criticalClubs, and healthyClubs

### Requirement 4: Distinguished Club Tracking

**User Story:** As a district leader, I want to see distinguished club counts by level, so that I can track progress toward district goals.

#### Acceptance Criteria

1. THE AnalyticsEngine SHALL count clubs at each distinguished level (Smedley, President's, Select, Distinguished)
2. THE AnalyticsEngine SHALL calculate a total distinguished club count
3. THE AnalyticsEngine SHALL provide a projection for end-of-year distinguished clubs based on current trends

### Requirement 5: Division and Area Rankings

**User Story:** As a district leader, I want to see division and area performance rankings, so that I can identify top performers and areas needing support.

#### Acceptance Criteria

1. THE AnalyticsEngine SHALL rank divisions by total DCP goals and average club health
2. THE AnalyticsEngine SHALL identify top-performing areas with normalized scores
3. THE AnalyticsEngine SHALL include trend indicators (improving, stable, declining) for divisions

### Requirement 6: Error Handling

**User Story:** As a user, I want clear error messages when data is unavailable, so that I understand what action to take.

#### Acceptance Criteria

1. IF no snapshot data exists for the requested district, THEN THE AnalyticsEngine SHALL return a 404 error with code 'NO_DATA_AVAILABLE'
2. IF the snapshot store is unavailable, THEN THE AnalyticsEngine SHALL return a 503 error with code 'SERVICE_UNAVAILABLE'
3. WHEN an error occurs, THE AnalyticsEngine SHALL include actionable details in the error response
