# Implementation Plan: Closing Period Fallback Cache

## Overview

This implementation adds an in-memory fallback cache to the ToastmastersCollector class that stores knowledge about which dates require fallback navigation. The implementation modifies the existing navigation flow to check the cache first and skip unnecessary failed requests for known fallback dates.

## Tasks

- [x] 1. Add FallbackInfo and FallbackMetrics interfaces
  - Create `FallbackInfo` interface with requestedDate, fallbackMonth, fallbackYear, crossedProgramYearBoundary, actualDateString, cachedAt
  - Create `FallbackMetrics` interface with cacheHits, cacheMisses, fallbackDatesDiscovered
  - Add to `packages/collector-cli/src/types/collector.ts`
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 7.1, 7.2_

- [x] 2. Add cache instance properties to ToastmastersCollector
  - Add `fallbackCache: Map<string, FallbackInfo>` private property
  - Add `fallbackMetrics: FallbackMetrics` private property with initial values
  - Initialize both in constructor
  - Add `getFallbackMetrics()` public method
  - Add `hasCachedFallback(date: string)` public method
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 2.1 Write property test for cache isolation between instances
  - **Property 5: Cache isolation between instances**
  - **Validates: Requirements 6.3**

- [x] 3. Implement cacheFallbackKnowledge helper method
  - Create private method that stores FallbackInfo in cache
  - Increment fallbackDatesDiscovered counter
  - Add debug logging with date, fallbackMonth, crossedProgramYearBoundary
  - _Requirements: 4.1, 4.3, 5.2_

- [x] 3.1 Write property test for cache entry completeness
  - **Property 4: Cache entry completeness**
  - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

- [x] 4. Implement navigateWithCachedFallback helper method
  - Create private method that navigates using cached FallbackInfo
  - Build fallback URL using cached parameters
  - Handle program year boundary crossing
  - Verify date matches after navigation
  - Return success/failure with actualDateString
  - _Requirements: 3.2, 1.2_

- [x] 5. Modify navigateToDateWithFallback to check cache first
  - Add cache lookup at start of method
  - On cache hit: increment cacheHits, log info, call navigateWithCachedFallback
  - On cache miss: increment cacheMisses, proceed with existing logic
  - After successful fallback: call cacheFallbackKnowledge
  - Update return type to include usedCachedFallback boolean
  - _Requirements: 1.1, 1.2, 3.1, 3.2, 3.3, 4.1, 5.1_

- [x] 5.1 Write property test for cache population on fallback success
  - **Property 1: Cache population on fallback success**
  - **Validates: Requirements 1.1, 4.1, 4.3**

- [x] 5.2 Write property test for direct fallback navigation on cache hit
  - **Property 2: Direct fallback navigation on cache hit**
  - **Validates: Requirements 1.2, 3.2**

- [x] 5.3 Write property test for standard navigation on cache miss
  - **Property 3: Standard navigation on cache miss**
  - **Validates: Requirements 3.3**

- [x] 5.4 Write property test for no cache modification on standard success
  - **Property 7: No cache modification on standard success**
  - **Validates: Requirements 4.2**

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Update CollectorOrchestrator to report fallback metrics
  - Get metrics from collector via getFallbackMetrics()
  - Include cache hit/miss statistics in scrape result summary
  - Log metrics at end of scrape session
  - _Requirements: 7.3_

- [x] 7.1 Write property test for metrics tracking accuracy
  - **Property 6: Metrics tracking accuracy**
  - **Validates: Requirements 7.1, 7.2**

- [x] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks including property tests are required
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation is contained within the collector-cli package
- No changes to the backend are required
