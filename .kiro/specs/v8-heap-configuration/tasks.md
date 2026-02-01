# Implementation Plan: V8 Heap Configuration

## Overview

This implementation adds V8 heap memory configuration to prevent OOM crashes in production. The work involves modifying the Dockerfile, creating two utility modules (HeapValidator and MemoryMonitor), and integrating them into the application startup sequence.

## Tasks

- [ ] 1. Configure NODE_OPTIONS in Dockerfile
  - Add `ENV NODE_OPTIONS="--max-old-space-size=384"` to the production stage
  - Place alongside existing environment variables (NODE_ENV, PORT, CACHE_DIR)
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 2. Implement HeapValidator module
  - [ ] 2.1 Create `backend/src/utils/heapValidator.ts`
    - Import v8 module for heap statistics
    - Implement `validateHeapConfiguration()` function
    - Read heap_size_limit from v8.getHeapStatistics()
    - Convert to megabytes and log the value
    - Compare against container memory (default 512MB, configurable via CONTAINER_MEMORY_MB)
    - Log warning if heap ratio exceeds 85%
    - _Requirements: 2.1, 2.2, 2.3_
  - [ ] 2.2 Write unit tests for HeapValidator
    - Test warning logged when heap > 85% of container (e.g., 440MB/512MB)
    - Test no warning when heap ≤ 85% of container (e.g., 384MB/512MB)
    - Test boundary condition at exactly 85%
    - Test default container memory when env var not set
    - Test custom container memory from CONTAINER_MEMORY_MB
    - _Requirements: 2.1, 2.2, 2.3_

- [ ] 3. Implement MemoryMonitor module
  - [ ] 3.1 Create `backend/src/utils/memoryMonitor.ts`
    - Implement MemoryMonitor class with start/stop methods
    - Use process.memoryUsage() to collect metrics
    - Convert bytes to megabytes for logging
    - Log metrics using existing logger infrastructure
    - Store interval reference for cleanup
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [ ] 3.2 Write unit tests for MemoryMonitor
    - Test metrics logged with correct structure
    - Test bytes to MB conversion (0, 1048576, 402653184)
    - Test start creates interval
    - Test stop clears interval
    - Test idempotent stop behavior
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 4. Integrate into application startup
  - [ ] 4.1 Modify `backend/src/index.ts` for heap validation
    - Import validateHeapConfiguration from heapValidator
    - Call validateHeapConfiguration() early in startup (before server.listen)
    - _Requirements: 2.4_
  - [ ] 4.2 Modify `backend/src/index.ts` for memory monitoring
    - Import MemoryMonitor from memoryMonitor
    - Create MemoryMonitor instance after server starts
    - Start monitoring with 60000ms interval
    - _Requirements: 3.1, 3.2_
  - [ ] 4.3 Add graceful shutdown cleanup
    - Stop MemoryMonitor in SIGTERM handler before server.close()
    - Stop MemoryMonitor in SIGINT handler before server.close()
    - _Requirements: 4.1, 4.2, 4.3_

- [ ] 5. Checkpoint - Verify implementation
  - Ensure TypeScript compiles without errors
  - Ensure all tests pass
  - Verify heap validation logs appear at startup
  - Ask the user if questions arise

- [ ] 6. Write integration tests
  - Test heap validator runs before server starts
  - Test memory monitor starts after server initialization
  - Test cleanup occurs on shutdown signals
  - _Requirements: 2.4, 4.1, 4.2, 4.3_

- [ ] 7. Final checkpoint
  - Ensure all tests pass
  - Verify Dockerfile builds successfully
  - Ask the user if questions arise

## Notes

- All tasks are required for comprehensive implementation
- This feature does not add any new API endpoints, so no OpenAPI updates are required
- The implementation follows the memory budget formula: Container (512Mi) = V8 Heap (384MB) + Native (~100MB) + Overhead (~28MB)
