# Implementation Plan: Pre-Computed Analytics Availability

## Overview

This implementation removes the expensive on-demand analytics computation fallback, returning a 404 error instead, and enhances the snapshot list to show analytics availability status. The changes are minimal and focused on modifying existing endpoints rather than creating new infrastructure.

## Tasks

- [ ] 1. Create AnalyticsAvailabilityChecker service
  - [ ] 1.1 Create `backend/src/services/AnalyticsAvailabilityChecker.ts`
    - Implement `hasAnalytics(snapshotId: string): Promise<boolean>` method
    - Implement `checkBatch(snapshotIds: string[]): Promise<Map<string, boolean>>` method
    - Use existing storage abstraction pattern (check for analytics-summary.json file)
    - Handle file system errors gracefully (return false, don't throw)
    - *Requirements: 2.1, 2.2*

  - [ ] 1.2 Write unit tests for AnalyticsAvailabilityChecker
    - Test `hasAnalytics()` returns true when file exists
    - Test `hasAnalytics()` returns false when file doesn't exist
    - Test `hasAnalytics()` returns false when snapshot directory doesn't exist
    - Test `checkBatch()` returns correct map for mixed availability
    - Test error handling returns false for file system errors
    - *Requirements: 2.1, 2.2*

- [ ] 2. Modify analytics-summary endpoint to remove fallback
  - [ ] 2.1 Update `backend/src/routes/districts/analyticsSummary.ts`
    - Remove the on-demand computation fallback code block
    - Return 404 with error code "ANALYTICS_NOT_AVAILABLE" when analytics not found
    - Include district ID in error response details
    - Include backfill recommendation in error response
    - *Requirements: 1.1, 1.2, 1.3, 1.4, 1.5*

  - [ ] 2.2 Update error logging for analytics unavailable
    - Log with structured field `analytics_gap: true`
    - Include district ID and snapshot ID in log
    - Include backfill recommendation in log message
    - *Requirements: 3.1, 3.2, 3.3, 3.4*

  - [ ] 2.3 Write unit tests for 404 response
    - Test returns 404 when pre-computed analytics don't exist
    - Test error response has code "ANALYTICS_NOT_AVAILABLE"
    - Test error response includes district ID in details
    - Test error response includes backfill recommendation
    - Test response time is under 5 seconds (no computation fallback)
    - *Requirements: 1.1, 1.2, 1.3, 1.4, 1.5*

- [ ] 3. Checkpoint - Verify analytics endpoint changes
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Enhance snapshot list endpoint with analytics availability
  - [ ] 4.1 Update `backend/src/routes/admin/snapshots.ts`
    - Import and use AnalyticsAvailabilityChecker
    - Add `analytics_available` boolean field to each snapshot in response
    - Add `analytics_available_count` and `analytics_missing_count` to metadata
    - Ensure backward compatibility (all existing fields preserved)
    - *Requirements: 2.1, 2.2, 2.3*

  - [ ] 4.2 Write unit tests for enhanced snapshot list
    - Test `analytics_available: true` when analytics-summary.json exists
    - Test `analytics_available: false` when file doesn't exist
    - Test all original SnapshotMetadata fields still present
    - Test metadata includes analytics counts
    - Test response time increase is under 100ms
    - *Requirements: 2.1, 2.2, 2.3, 2.4*

- [ ] 5. Update OpenAPI specification
  - [ ] 5.1 Add 404 response to analytics-summary endpoint in `backend/openapi.yaml`
    - Document ANALYTICS_NOT_AVAILABLE error code
    - Document error response schema with districtId, recommendation, backfillJobType
    - *Requirements: 4.1*

  - [ ] 5.2 Update snapshot list response schema in `backend/openapi.yaml`
    - Add `analytics_available` boolean field to snapshot schema
    - Add `analytics_available_count` and `analytics_missing_count` to metadata
    - *Requirements: 4.2, 4.3*

- [ ] 6. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Each task references specific requirements for traceability
- The implementation modifies existing endpoints rather than creating new ones
- Uses unit tests per property-testing-guidance.md (no PBT needed for this feature)
