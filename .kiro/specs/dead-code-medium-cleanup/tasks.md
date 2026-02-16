# Implementation Plan: Dead Code Medium Cleanup

## Overview

Incrementally remove orphaned backfill code from the backend districts module, orphaned backfill test blocks from three test files, and the orphaned `useContrastCheck.ts` frontend hook. Each step is scoped to a single file or concern, with a compilation checkpoint after the backend changes and a final verification checkpoint.

## Tasks

- [x] 1. Remove orphaned backfill functions and related code from `backend/src/routes/districts/shared.ts`
  - Remove the `BackfillValidationResult` interface
  - Remove the `validateBackfillRequest()` function
  - Remove the `estimateCompletionTime()` function
  - Remove the `startBackfillCleanupInterval()` function
  - Remove the `stopBackfillCleanupInterval()` function
  - Remove the `cleanupIntervalId` variable
  - Remove the auto-start call `startBackfillCleanupInterval()` at module bottom
  - Remove the `import type { BackfillRequest } from '../../services/UnifiedBackfillService.js'` import
  - Remove the `// ============================================================================` section header comments for the removed sections ("Backfill Job Cleanup")
  - Retain all non-backfill functions and exports
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

- [x] 2. Remove orphaned backfill re-exports from `backend/src/routes/districts/index.ts`
  - Remove `getBackfillService` from the re-export block
  - Remove `startBackfillCleanupInterval` from the re-export block
  - Remove `stopBackfillCleanupInterval` from the re-export block
  - Retain all other re-exports unchanged
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 3. Checkpoint — Verify backend compiles
  - Run TypeScript compilation check on the backend to ensure no dangling references from the removals in steps 1-2
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Remove orphaned backfill test blocks from `backend/src/__tests__/districts.integration.test.ts`
  - Remove the entire `describe('Unified Backfill Endpoints', ...)` block including all nested describe/it blocks for POST, GET, and DELETE `/api/districts/backfill` endpoints
  - Retain all other test blocks unchanged
  - _Requirements: 3.1, 3.4_

- [x] 5. Remove orphaned backfill test blocks from `backend/src/__tests__/functionality-preservation.property.test.ts`
  - Remove the `it('should preserve response structure for backfill endpoints', ...)` test block
  - Remove the `it('should preserve request validation for backfill initiation', ...)` test block
  - Retain all other test blocks unchanged
  - _Requirements: 3.2, 3.5_

- [x] 6. Remove orphaned backfill test blocks from `backend/src/routes/districts/__tests__/route-composition.property.test.ts`
  - Remove the `it('should respond with proper error format for invalid backfill IDs', ...)` test block
  - Remove the `it('should handle backfill request validation consistently', ...)` test block
  - Update the stale comment `// (4 sub-routers: snapshots, backfill, core, analytics)` to `// (5 sub-routers: snapshots, core, rankings, analyticsSummary, analytics)`
  - Retain all other test blocks unchanged
  - _Requirements: 3.3, 3.6_

- [x] 7. Delete orphaned frontend hook `frontend/src/hooks/useContrastCheck.ts`
  - Delete the entire file
  - Verify no other frontend file imports `useContrastCheck`
  - _Requirements: 4.1, 4.2_

- [x] 8. Final checkpoint — Verify full codebase integrity
  - Run TypeScript compilation on both backend and frontend with zero errors
  - Run backend test suite and verify all retained tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 5.1, 5.2, 5.3_

## Notes

- All tasks are code removal or deletion — no new code is written
- Each task targets a single file for clean, reviewable diffs
- The intermediate checkpoint (task 3) catches dangling references early before touching test files
- No new tests are needed — compilation and existing test execution validate the cleanup per the testing steering document's guidance
