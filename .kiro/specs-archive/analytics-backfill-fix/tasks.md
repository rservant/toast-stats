# Implementation Plan: Analytics Backfill Fix

## Overview

This implementation adds PreComputedAnalyticsService integration to the AnalyticsGenerator component so that analytics backfill jobs generate `analytics-summary.json` files alongside time-series index data.

## Tasks

- [x] 1. Update AnalyticsGenerator to accept PreComputedAnalyticsService
  - [x] 1.1 Add PreComputedAnalyticsService import and constructor parameter
    - Import PreComputedAnalyticsService type
    - Add as required constructor parameter after timeSeriesStorage
    - Store reference as private readonly field
    - _Requirements: 1.1, 1.2_
  - [x] 1.2 Add generatePreComputedAnalytics private method
    - Create method that calls preComputedAnalyticsService.computeAndStore()
    - Wrap in try-catch to handle errors gracefully
    - Log success at debug level, errors at warn level
    - _Requirements: 2.1, 2.2_
  - [x] 1.3 Call generatePreComputedAnalytics in processSnapshot
    - After successfully reading all district data
    - Before returning the success result
    - Pass snapshotId and collected districtData array
    - _Requirements: 2.1, 2.3_

- [x] 2. Update UnifiedBackfillService to provide PreComputedAnalyticsService
  - [x] 2.1 Add PreComputedAnalyticsService constructor parameter
    - Add as required parameter after configService
    - Store reference for passing to AnalyticsGenerator
    - _Requirements: 3.1, 3.2_
  - [x] 2.2 Pass PreComputedAnalyticsService to AnalyticsGenerator
    - Update AnalyticsGenerator instantiation to include the service
    - _Requirements: 3.2_

- [x] 3. Update callers of UnifiedBackfillService
  - [x] 3.1 Update ProductionServiceFactory or service initialization
    - Ensure PreComputedAnalyticsService is created and passed to UnifiedBackfillService
    - Configure with correct snapshots directory path
    - _Requirements: 3.1, 3.3_

- [x] 4. Checkpoint - Verify compilation and existing tests pass
  - Run TypeScript compilation to verify no type errors
  - Run existing tests to ensure no regressions
  - Ensure all tests pass, ask the user if questions arise

- [x] 5. Update tests for AnalyticsGenerator
  - [x] 5.1 Update existing AnalyticsGenerator tests
    - Add mock PreComputedAnalyticsService to test setup
    - Verify computeAndStore is called during snapshot processing
    - Verify error handling when computeAndStore fails
    - _Requirements: 2.1, 2.2_

- [x] 6. Final checkpoint - Ensure all tests pass
  - Run full test suite
  - Verify no TypeScript errors
  - Ensure all tests pass, ask the user if questions arise

## Notes

- The fix is minimal: one new dependency and one method call
- Error handling follows existing RefreshService pattern
- No API changes required (internal service modification only)
