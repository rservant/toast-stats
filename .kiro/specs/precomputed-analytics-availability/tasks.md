# Implementation Plan: Pre-Computed Analytics Availability

## Overview

This implementation removes the expensive on-demand analytics computation fallback, returning a 404 error instead, and enhances the snapshot list to show analytics availability status. The changes are minimal and focused on modifying existing endpoints rather than creating new infrastructure.

## Tasks

- [x] 1. Create AnalyticsAvailabilityChecker service
  - [x] 1.1 Create `backend/src/services/AnalyticsAvailabilityChecker.ts`
    - Implement `hasAnalytics(snapshotId: string): Promise<boolean>` method
    - Implement `checkBatch(snapshotIds: string[]): Promise<Map<string, boolean>>` method
    - Use existing storage abstraction pattern (check for analytics-summary.json file)
    - Handle file system errors gracefully (return false, don't throw)
    - _Requirements: 2.1, 2.2_

  - [x] 1.2 Write unit tests for AnalyticsAvailabilityChecker
    - Test `hasAnalytics()` returns true when file exists
    - Test `hasAnalytics()` returns false when file doesn't exist
    - Test `hasAnalytics()` returns false when snapshot directory doesn't exist
    - Test `checkBatch()` returns correct map for mixed availability
    - Test error handling returns false for file system errors
    - _Requirements: 2.1, 2.2_

- [x] 2. Modify analytics-summary endpoint to remove fallback
  - [x] 2.1 Update `backend/src/routes/districts/analyticsSummary.ts`
    - Remove the on-demand computation fallback code block
    - Return 404 with error code "ANALYTICS_NOT_AVAILABLE" when analytics not found
    - Include district ID in error response details
    - Include backfill recommendation in error response
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 2.2 Update error logging for analytics unavailable
    - Log with structured field `analytics_gap: true`
    - Include district ID and snapshot ID in log
    - Include backfill recommendation in log message
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 2.3 Write unit tests for 404 response
    - Test returns 404 when pre-computed analytics don't exist
    - Test error response has code "ANALYTICS_NOT_AVAILABLE"
    - Test error response includes district ID in details
    - Test error response includes backfill recommendation
    - Test response time is under 5 seconds (no computation fallback)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 3. Checkpoint - Verify analytics endpoint changes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Enhance snapshot list endpoint with analytics availability
  - [x] 4.1 Update `backend/src/routes/admin/snapshots.ts`
    - Import and use AnalyticsAvailabilityChecker
    - Add `analytics_available` boolean field to each snapshot in response
    - Add `analytics_available_count` and `analytics_missing_count` to metadata
    - Ensure backward compatibility (all existing fields preserved)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 4.2 Write unit tests for enhanced snapshot list
    - Test `analytics_available: true` when analytics-summary.json exists
    - Test `analytics_available: false` when file doesn't exist
    - Test all original SnapshotMetadata fields still present
    - Test metadata includes analytics counts
    - Test response time increase is under 100ms
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 5. Update OpenAPI specification
  - [x] 5.1 Add 404 response to analytics-summary endpoint in `backend/openapi.yaml`
    - Document ANALYTICS_NOT_AVAILABLE error code
    - Document error response schema with districtId, recommendation, backfillJobType
    - _Requirements: 4.1_

  - [x] 5.2 Update snapshot list response schema in `backend/openapi.yaml`
    - Add `analytics_available` boolean field to snapshot schema
    - Add `analytics_available_count` and `analytics_missing_count` to metadata
    - _Requirements: 4.2, 4.3_

- [x] 6. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Each task references specific requirements for traceability
- The implementation modifies existing endpoints rather than creating new ones
- Uses unit tests per property-testing-guidance.md (no PBT needed for this feature)
