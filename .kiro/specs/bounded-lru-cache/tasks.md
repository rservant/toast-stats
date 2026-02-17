# Implementation Plan: Bounded LRU Cache

## Overview

This plan migrates the `CacheService` from `node-cache` to `lru-cache` with bounded memory management. The implementation maintains full API compatibility while adding entry count and size limits per the Performance SLOs document.

## Tasks

- [x] 1. Add lru-cache dependency
  - Run `npm install lru-cache` in backend directory
  - Verify package.json includes lru-cache
  - _Requirements: 7.1_

- [x] 2. Implement CacheService with lru-cache
  - [x] 2.1 Update CacheOptions interface
    - Add `max?: number` for entry limit (default: 1000)
    - Add `maxSize?: number` for size limit (default: 50MB)
    - Remove `checkperiod` (not used by lru-cache)
    - _Requirements: 3.4, 3.5_
  - [x] 2.2 Replace NodeCache with LRUCache
    - Import `LRUCache` from `lru-cache`
    - Configure with max, maxSize, sizeCalculation, ttl
    - Convert TTL from seconds to milliseconds
    - Set updateAgeOnGet: true, allowStale: false
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 4.1, 4.2, 4.3, 4.4_
  - [x] 2.3 Implement size calculation function
    - Use JSON.stringify(value).length for size
    - Add try/catch with 1KB fallback for non-serializable values
    - _Requirements: 3.3_
  - [x] 2.4 Add hit/miss tracking
    - Add private hits and misses counters
    - Increment hits on successful get
    - Increment misses on undefined return
    - _Requirements: 6.3_
  - [x] 2.5 Update getStats method
    - Return current entry count from cache.size
    - Return calculated size from cache.calculatedSize
    - Return configured max and maxSize values
    - _Requirements: 2.8, 6.1, 6.2, 6.4_
  - [x] 2.6 Adapt invalidate methods
    - Use cache.delete() for single key deletion
    - Return 1 if key existed, 0 otherwise
    - _Requirements: 2.3, 2.4_

- [x] 3. Checkpoint - Verify existing tests pass
  - Run existing CacheService tests
  - Ensure all tests pass, ask the user if questions arise

- [x] 4. Write unit tests for new features
  - [x] 4.1 Test default configuration values
    - Test default max: 1000, maxSize: 50MB, ttl: 900s
    - _Requirements: 3.1, 3.2_
  - [x] 4.2 Test custom configuration
    - Test custom max, maxSize, and ttl values
    - _Requirements: 3.4, 3.5_
  - [x] 4.3 Test edge cases
    - Test single entry cache (max: 1)
    - Test non-serializable value handling
    - _Requirements: 5.1, 5.2_

- [x] 5. Write property-based tests
  - [x] 5.1 Property test for cache round-trip
    - **Property 1: Cache Round-Trip Consistency**
    - **Validates: Requirements 2.1, 2.2**
  - [x] 5.2 Property test for entry limit
    - **Property 2: Entry Limit Enforcement**
    - **Validates: Requirements 1.2, 3.4, 5.1**
  - [x] 5.3 Property test for size limit
    - **Property 3: Size Limit Enforcement**
    - **Validates: Requirements 1.3, 3.3, 3.5, 5.2**
  - [x] 5.4 Property test for LRU ordering
    - **Property 4: LRU Access Ordering**
    - **Validates: Requirements 5.3**
  - [x] 5.5 Property test for statistics
    - **Property 5: Statistics Accuracy**
    - **Validates: Requirements 2.8, 6.1, 6.2, 6.3**

- [x] 6. Checkpoint - Ensure all tests pass
  - Run full test suite with `npm test`
  - Ensure all tests pass, ask the user if questions arise

- [x] 7. Remove node-cache dependency
  - Remove `node-cache` from package.json dependencies
  - Run `npm install` to update package-lock.json
  - Verify no remaining imports of node-cache
  - _Requirements: 7.2_

- [x] 8. Final checkpoint
  - Run full test suite to confirm all tests pass
  - Verify no TypeScript errors with `npm run typecheck`
  - Ensure all tests pass, ask the user if questions arise

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- The singleton export `cacheService` is preserved for backward compatibility
