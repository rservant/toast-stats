# Implementation Plan: Remove DistrictCacheManager

## Overview

This plan removes the legacy `DistrictCacheManager` service and migrates the `/cached-dates` endpoint to use `PerDistrictSnapshotStore`. The implementation proceeds in phases: migrate the endpoint first, then remove the legacy code, then clean up tests and frontend.

## Tasks

- [x] 1. Migrate the cached-dates endpoint
  - [x] 1.1 Update GET /api/districts/:districtId/cached-dates to use PerDistrictSnapshotStore
    - Replace `districtCacheManager.getCachedDatesForDistrict()` with snapshot store queries
    - Use `perDistrictSnapshotStore.listSnapshots()` to get all snapshots
    - Filter snapshots to find those containing the requested district
    - Maintain the same response format (districtId, dates, count, dateRange)
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Remove unused data endpoint
  - [x] 2.1 Remove GET /api/districts/:districtId/data/:date endpoint from districts.ts
    - Delete the route handler for `/data/:date`
    - _Requirements: 2.1_

- [x] 3. Remove DistrictCacheManager from routes
  - [x] 3.1 Remove DistrictCacheManager import and instance from districts.ts
    - Remove `import { DistrictCacheManager } from '../services/DistrictCacheManager.js'`
    - Remove `const districtCacheManager = new DistrictCacheManager(cacheDirectory)`
    - _Requirements: 3.2, 3.3_

- [x] 4. Remove DistrictCacheManager service file
  - [x] 4.1 Delete backend/src/services/DistrictCacheManager.ts
    - _Requirements: 3.1_

- [x] 5. Remove IDistrictCacheManager interface
  - [x] 5.1 Remove IDistrictCacheManager from serviceInterfaces.ts
    - Delete the `IDistrictCacheManager` interface definition
    - _Requirements: 4.1_

- [x] 6. Update TestServiceFactory
  - [x] 6.1 Remove IDistrictCacheManager from TestServiceFactory.ts
    - Remove `IDistrictCacheManager` import
    - Remove `createDistrictCacheManager` method
    - Remove `IDistrictCacheManager` registration from `createTestContainer`
    - Remove `IDistrictCacheManager` from `InterfaceTokens`
    - _Requirements: 4.2, 4.3_

- [x] 7. Remove legacy test files
  - [x] 7.1 Delete CacheManager.initialization.property.test.ts
    - This file tests DistrictCacheManager initialization
    - _Requirements: 5.1_
  - [x] 7.2 Delete CacheManager.error-handling.property.test.ts
    - This file tests DistrictCacheManager error handling
    - _Requirements: 5.1_
  - [x] 7.3 Delete ConfigurationInjection.property.test.ts
    - This file references DistrictCacheManager
    - _Requirements: 5.1_

- [x] 8. Update InterfaceBasedInjection test
  - [x] 8.1 Remove IDistrictCacheManager references from InterfaceBasedInjection.property.test.ts
    - Remove `IDistrictCacheManager` import
    - Remove test cases that reference `IDistrictCacheManager`
    - Remove `createDistrictCacheManager` calls
    - _Requirements: 5.2, 5.4_

- [x] 9. Clean up frontend
  - [x] 9.1 Remove useDistrictData hook from useDistrictData.ts
    - Delete the `useDistrictData` function (it's not used anywhere)
    - Keep `useDistrictCachedDates` hook (it's used by DistrictDetailPage)
    - Keep `CachedDatesResponse` type (used by useDistrictCachedDates)
    - Remove unused types: `ClubPerformance`, `DivisionPerformance`, `DistrictPerformance`, `DistrictCacheEntry`
    - _Requirements: 6.2, 6.3_

- [x] 10. Checkpoint - Verify all tests pass
  - Run `npm test` in backend directory
  - Ensure all tests pass after the removal
  - Ensure TypeScript compilation succeeds
  - _Requirements: 5.3_

- [x] 11. Checkpoint - Verify frontend works
  - Verify the district detail page date selector loads dates correctly
  - Verify no TypeScript errors in frontend
  - _Requirements: 6.4_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The migration is done before removal to ensure the endpoint works with the new data source
- Test files are removed rather than updated since they test legacy functionality
