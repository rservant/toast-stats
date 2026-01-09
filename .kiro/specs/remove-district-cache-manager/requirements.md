# Requirements Document

## Introduction

The `DistrictCacheManager` service is a legacy data access layer that stores district data in `cache/districts/{districtId}/{YYYY-MM-DD}.json` files. The system has fully migrated to the `PerDistrictSnapshotStore` format which stores data in `cache/snapshots/{snapshotId}/district_{id}.json`. The `AnalyticsEngine` has already been migrated to use the new data source. This spec covers removing the remaining `DistrictCacheManager` code and migrating or removing the endpoints that still depend on it.

## Glossary

- **DistrictCacheManager**: Legacy data access layer that reads/writes from `cache/districts/{districtId}/{date}.json` files - to be removed
- **PerDistrictSnapshotStore**: New data access layer that reads from `cache/snapshots/{snapshotId}/district_{id}.json` files
- **DistrictDataAggregator**: Service that provides efficient access to per-district snapshot data with caching
- **IDistrictCacheManager**: Interface definition for the legacy cache manager in `serviceInterfaces.ts`
- **TestServiceFactory**: Factory class that creates service instances for testing, includes `IDistrictCacheManager` registration

## Requirements

### Requirement 1: Migrate Cached Dates Endpoint

**User Story:** As a district leader viewing the district detail page, I want to see available dates for historical data, so that I can select specific dates to view performance data.

#### Acceptance Criteria

1. WHEN a user requests cached dates for a district via `GET /api/districts/:districtId/cached-dates`, THE System SHALL retrieve available snapshot dates from the PerDistrictSnapshotStore
2. THE System SHALL return the same response format as the current endpoint (districtId, dates array, count, dateRange)
3. WHEN no snapshots exist for the district, THE System SHALL return an empty dates array with null dateRange
4. THE System SHALL filter snapshots to only include successful snapshots for the specified district

### Requirement 2: Remove Unused Data Endpoint

**User Story:** As a developer, I want to remove unused code, so that the codebase remains maintainable and free of dead code.

#### Acceptance Criteria

1. THE System SHALL remove the `GET /api/districts/:districtId/data/:date` endpoint from the routes file
2. THE System SHALL remove the `useDistrictData` hook from the frontend since it is not used by any component
3. THE System SHALL preserve the `DistrictCacheEntry` type if it is used elsewhere, or remove it if unused

### Requirement 3: Remove DistrictCacheManager Service

**User Story:** As a developer, I want to remove the legacy DistrictCacheManager service, so that the codebase has a single source of truth for district data.

#### Acceptance Criteria

1. THE System SHALL delete the `backend/src/services/DistrictCacheManager.ts` file
2. THE System SHALL remove all imports of `DistrictCacheManager` from route files
3. THE System SHALL remove the `districtCacheManager` instance from `districts.ts` routes

### Requirement 4: Remove IDistrictCacheManager Interface

**User Story:** As a developer, I want to remove the legacy interface definition, so that the type system reflects the current architecture.

#### Acceptance Criteria

1. THE System SHALL remove the `IDistrictCacheManager` interface from `serviceInterfaces.ts`
2. THE System SHALL remove any imports of `IDistrictCacheManager` from test files and service factories
3. THE System SHALL remove `IDistrictCacheManager` registration from `TestServiceFactory`

### Requirement 5: Update or Remove Related Tests

**User Story:** As a developer, I want tests to reflect the current architecture, so that the test suite remains valid and maintainable.

#### Acceptance Criteria

1. THE System SHALL remove or update property tests that directly test `DistrictCacheManager` functionality
2. THE System SHALL update any integration tests that depend on `DistrictCacheManager`
3. THE System SHALL ensure all remaining tests pass after the removal
4. IF tests reference `IDistrictCacheManager` interface, THEN THE System SHALL remove those references

### Requirement 6: Clean Up Frontend

**User Story:** As a developer, I want the frontend to use only the current data architecture, so that the frontend code is consistent with the backend.

#### Acceptance Criteria

1. THE System SHALL update `useDistrictCachedDates` hook to work with the migrated endpoint response format
2. THE System SHALL remove the unused `useDistrictData` hook from `useDistrictData.ts`
3. THE System SHALL remove unused type definitions (`DistrictCacheEntry`, `ClubPerformance`, `DivisionPerformance`, `DistrictPerformance`) if they are not used elsewhere
4. THE System SHALL verify the district detail page date selector continues to work correctly
