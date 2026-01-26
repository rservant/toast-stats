# Implementation Plan: District Analytics Performance

## Overview

This implementation plan addresses the 504 Gateway Timeout errors on the district analytics page by introducing pre-computed analytics, time-series indexes, and a consolidated admin panel. The work is organized into phases: data validation fix, pre-computation infrastructure, API optimization, admin panel, and backfill tooling.

## Tasks

- [ ] 1. Implement District ID Validation
  - [ ] 1.1 Create DistrictIdValidator service
    - Create `backend/src/services/DistrictIdValidator.ts`
    - Implement validation rules: reject date patterns, empty/whitespace, non-alphanumeric
    - Export `validate()` and `filterValid()` methods
    - _Requirements: 9.1, 9.2, 9.3_
  
  - [ ] 1.2 Write property test for district ID validation
    - **Property 12: District ID Validation**
    - Generate random strings including date patterns, empty strings, special characters
    - Verify correct acceptance/rejection
    - **Validates: Requirements 9.1, 9.2, 9.3**
  
  - [ ] 1.3 Integrate validator into snapshot creation
    - Modify `RefreshService` to filter districts through validator before processing
    - Add rejection count to snapshot metadata
    - Log warnings for rejected records
    - _Requirements: 9.4, 9.5_

- [ ] 2. Checkpoint - Validation working
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. Implement Pre-Computed Analytics Infrastructure
  - [ ] 3.1 Define PreComputedAnalyticsSummary types
    - Create `backend/src/types/precomputedAnalytics.ts`
    - Define `PreComputedAnalyticsSummary`, `AnalyticsSummaryFile` interfaces
    - _Requirements: 1.2, 1.3_
  
  - [ ] 3.2 Create PreComputedAnalyticsService
    - Create `backend/src/services/PreComputedAnalyticsService.ts`
    - Implement `computeAndStore()` method that calculates analytics from district data
    - Implement `getAnalyticsSummary()` and `getLatestSummary()` methods
    - Store analytics in `analytics-summary.json` within snapshot directory
    - _Requirements: 1.1, 1.5_
  
  - [ ] 3.3 Write property test for analytics totals invariant
    - **Property 1: Pre-Computed Analytics Totals Invariant**
    - Generate random district data with varying club counts
    - Verify totals equal sum of parts
    - **Validates: Requirements 1.2**
  
  - [ ] 3.4 Integrate pre-computation into snapshot creation
    - Modify `RefreshService.writeSnapshot()` to call `PreComputedAnalyticsService.computeAndStore()`
    - Handle errors gracefully - log and continue if individual district fails
    - _Requirements: 1.1, 1.4_

- [ ] 4. Implement Time-Series Index Service
  - [ ] 4.1 Define TimeSeriesIndex types
    - Add `TimeSeriesDataPoint`, `ProgramYearIndex` interfaces to types file
    - _Requirements: 2.1_
  
  - [ ] 4.2 Create TimeSeriesIndexService
    - Create `backend/src/services/TimeSeriesIndexService.ts`
    - Implement `appendDataPoint()` to add entries to program year index files
    - Implement `getTrendData()` for efficient range queries
    - Implement `getProgramYearData()` for full program year retrieval
    - Partition indexes by program year (July 1 - June 30)
    - _Requirements: 2.1, 2.2, 2.4, 2.5_
  
  - [ ] 4.3 Integrate time-series index into snapshot creation
    - Call `TimeSeriesIndexService.appendDataPoint()` after snapshot write
    - _Requirements: 2.2_
  
  - [ ] 4.4 Update AnalyticsEngine to use time-series index
    - Modify `loadDistrictData()` to read from time-series index when available
    - Fall back to loading individual snapshots if index unavailable
    - _Requirements: 2.3_

- [ ] 5. Checkpoint - Pre-computation infrastructure complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement Aggregated Analytics Endpoint
  - [ ] 6.1 Create aggregated analytics route
    - Add `GET /api/districts/:districtId/analytics-summary` endpoint
    - Return combined summary, trends, and yearOverYear data
    - Read from pre-computed analytics and time-series index
    - Support startDate and endDate query parameters
    - _Requirements: 4.1, 4.4_
  
  - [ ] 6.2 Implement fallback to on-demand computation
    - If pre-computed data unavailable, compute on-demand
    - Log warning when fallback is used
    - _Requirements: 4.5_
  
  - [ ] 6.3 Add request deduplication middleware
    - Create `backend/src/middleware/requestDeduplication.ts`
    - Implement in-flight request tracking by cache key
    - Share results with concurrent identical requests
    - _Requirements: 6.1, 6.2, 6.3_
  
  - [ ] 6.4 Apply deduplication to analytics endpoints
    - Wrap analytics endpoints with deduplication middleware
    - _Requirements: 6.1_

- [ ] 7. Implement Snapshot List Caching
  - [ ] 7.1 Add in-memory cache for snapshot list
    - Modify `FileSnapshotStore.listSnapshots()` to cache results
    - Configure TTL of 60 seconds minimum
    - Invalidate cache on snapshot write/delete
    - _Requirements: 3.2, 3.3_
  
  - [ ] 7.2 Add batch metadata retrieval method
    - Implement `getSnapshotMetadataBatch()` method
    - Return metadata for multiple snapshots in single operation
    - _Requirements: 3.4_

- [ ] 8. Checkpoint - API optimization complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Implement Admin Panel Backend
  - [ ] 9.1 Create admin snapshot management endpoints
    - Add `DELETE /api/admin/snapshots` endpoint (accepts array of IDs)
    - Add `DELETE /api/admin/snapshots/range` endpoint (startDate, endDate)
    - Add `DELETE /api/admin/snapshots/all` endpoint (optional districtId filter)
    - Implement cascading deletion of analytics and index entries
    - _Requirements: 8.1, 8.2, 8.3_
  
  - [ ] 9.2 Create admin backfill endpoints
    - Add `POST /api/admin/backfill` endpoint to trigger backfill
    - Add `GET /api/admin/backfill/:jobId` endpoint for progress
    - Add `DELETE /api/admin/backfill/:jobId` endpoint to cancel
    - _Requirements: 7.1_
  
  - [ ] 9.3 Implement BackfillService
    - Create `backend/src/services/BackfillService.ts`
    - Process snapshots in chronological order
    - Track progress and support resumption
    - Run in background without blocking normal operations
    - _Requirements: 7.2, 7.3, 7.4_
  
  - [ ] 9.4 Create admin system health endpoint
    - Add `GET /api/admin/health` endpoint
    - Return cache hit rates, average response times, pending operations
    - _Requirements: 11.1_

- [ ] 10. Implement Admin Panel Frontend
  - [ ] 10.1 Create AdminPage component
    - Create `frontend/src/pages/AdminPage.tsx`
    - Add route `/admin` to router
    - Add navigation link to admin page
    - _Requirements: 10.1_
  
  - [ ] 10.2 Implement Snapshots section
    - Display list of snapshots with status and pre-computation status
    - Add delete controls (single, range, all)
    - Add confirmation dialogs for destructive actions
    - _Requirements: 10.2, 10.3_
  
  - [ ] 10.3 Implement Analytics section
    - Add backfill trigger button
    - Display backfill progress with real-time updates
    - Show pre-computation status summary
    - _Requirements: 10.4, 10.6_
  
  - [ ] 10.4 Implement System Health section
    - Display cache hit rates, response times, pending operations
    - Auto-refresh metrics periodically
    - _Requirements: 10.5_
  
  - [ ] 10.5 Add authorization check
    - Verify admin authorization before rendering page
    - Redirect unauthorized users
    - _Requirements: 10.7_

- [ ] 11. Update Frontend to Use Aggregated Endpoint
  - [ ] 11.1 Create useAggregatedAnalytics hook
    - Create `frontend/src/hooks/useAggregatedAnalytics.ts`
    - Call new `/analytics-summary` endpoint
    - Fall back to individual endpoints if aggregated fails
    - _Requirements: 5.1_
  
  - [ ] 11.2 Update DistrictDetailPage to use aggregated hook
    - Replace multiple hook calls with single aggregated hook for overview tab
    - Keep individual hooks for detailed views (clubs, divisions)
    - _Requirements: 5.1, 5.2_

- [ ] 12. Checkpoint - Full implementation complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Add Performance Monitoring
  - [ ] 13.1 Add response time logging
    - Log total processing time for analytics requests
    - Log whether pre-computed data was used
    - Log warning if response time exceeds 5 seconds
    - _Requirements: 11.1, 11.2, 11.3_

- [ ] 14. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- The implementation order prioritizes the data validation fix first (addresses the "As of" bug), then builds infrastructure, then optimizes APIs
