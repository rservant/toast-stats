# Design Document: Dead Code Medium Cleanup

## Overview

This cleanup removes orphaned code left behind after the deletion of `backend/src/routes/districts/backfill.ts` and `frontend/src/hooks/useResponsiveDesign.ts`. The work is purely subtractive — no new functionality, no new files, no new interfaces. The goal is to eliminate dead code that could confuse future maintainers and cause test suite noise (404s from tests hitting deleted endpoints).

Three categories of dead code are addressed:

1. Orphaned backfill functions and their re-exports in the backend districts module
2. Orphaned test blocks across three test files that exercise deleted `/api/districts/backfill` endpoints
3. An orphaned frontend hook file (`useContrastCheck.ts`)

## Architecture

No architectural changes. The existing two-process architecture (scraper-cli for computation, backend for serving) is unaffected. The admin backfill endpoints at `/api/admin/unified-backfill` remain the active replacement and are untouched.

### Affected Files

| File                                                                        | Action                                                            | Category           |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------ |
| `backend/src/routes/districts/shared.ts`                                    | Remove orphaned functions, interface, import, and auto-start call | Backend dead code  |
| `backend/src/routes/districts/index.ts`                                     | Remove orphaned re-exports                                        | Backend dead code  |
| `backend/src/__tests__/districts.integration.test.ts`                       | Remove "Unified Backfill Endpoints" describe block                | Test cleanup       |
| `backend/src/__tests__/functionality-preservation.property.test.ts`         | Remove two backfill test blocks                                   | Test cleanup       |
| `backend/src/routes/districts/__tests__/route-composition.property.test.ts` | Remove two backfill test blocks, update stale comment             | Test cleanup       |
| `frontend/src/hooks/useContrastCheck.ts`                                    | Delete entire file                                                | Frontend dead code |

## Components and Interfaces

### shared.ts — Code to Remove

The following exports are orphaned and will be removed:

- `BackfillValidationResult` interface
- `validateBackfillRequest()` function (~120 lines)
- `estimateCompletionTime()` function (~20 lines)
- `startBackfillCleanupInterval()` function
- `stopBackfillCleanupInterval()` function
- `cleanupIntervalId` module-level variable
- The auto-start call `startBackfillCleanupInterval()` at module bottom
- The `import type { BackfillRequest }` from `UnifiedBackfillService.js` (only used by `validateBackfillRequest`)

The following exports are retained (no changes):

- All service initialization (`getRefreshService`, `getBackfillService`, `getTimeSeriesIndexService`)
- All validation helpers (`validateDistrictId`, `extractStringParam`, `getValidDistrictId`, `validateDateFormat`)
- All response metadata types and helpers
- All snapshot finding helpers
- All data serving helpers
- `getProgramYearInfo()`

Note: `getBackfillService()` in `shared.ts` is still used internally by the admin backfill routes (via `backend/src/routes/admin/backfill.ts` which has its own `getBackfillService()`). The `shared.ts` version is only re-exported from `index.ts` where nobody imports it — so the re-export is removed from `index.ts`, but the function itself stays in `shared.ts` because it's used by the `_backfillService` initialization and could be imported directly.

Wait — let me re-check. The `getBackfillService` in `shared.ts` is used by `startBackfillCleanupInterval` which calls it. If we remove `startBackfillCleanupInterval`, we need to check if `getBackfillService` has other callers.

Looking at the search results: `getBackfillService` from `shared.ts` is re-exported from `index.ts` but nobody imports it from there. The `admin/backfill.ts` has its own separate `getBackfillService()`. So the question is: does anything else in the codebase import `getBackfillService` from `shared.ts` directly?

From the grep results, only `index.ts` re-exports it, and `admin/backfill.ts` defines its own. The `shared.ts` `getBackfillService` is used by `startBackfillCleanupInterval` (which we're removing). However, `getBackfillService` is also part of the service initialization pattern alongside `getRefreshService` and `getTimeSeriesIndexService`. The `_backfillService` is initialized in `initializeServices()` and `getBackfillService` is the accessor. Since the admin routes use their own backfill service instance, and the only caller of `shared.ts`'s `getBackfillService` was the cleanup interval (being removed), the function itself becomes orphaned too.

However, removing `getBackfillService` would also mean removing the `_backfillService` initialization from `initializeServices()` and the `BackfillService` import. This is a larger change that could affect the initialization flow. To keep the cleanup safe and scoped, we will only remove the re-export from `index.ts` and the cleanup interval functions. The `getBackfillService` function and `_backfillService` initialization in `shared.ts` will remain — they are low-risk dead code that can be addressed in a future pass.

### index.ts — Re-exports to Remove

```typescript
// Remove these three re-exports:
getBackfillService,
startBackfillCleanupInterval,
stopBackfillCleanupInterval,
```

### Test Blocks to Remove

**districts.integration.test.ts:**

- The entire `describe('Unified Backfill Endpoints', ...)` block (lines ~1397-1590), containing:
  - `POST /api/districts/backfill` tests (7 tests)
  - `GET /api/districts/backfill/:backfillId` tests (2 tests)
  - `DELETE /api/districts/backfill/:backfillId` tests (2 tests)

**functionality-preservation.property.test.ts:**

- `it('should preserve response structure for backfill endpoints', ...)` block
- `it('should preserve request validation for backfill initiation', ...)` block

**route-composition.property.test.ts:**

- `it('should respond with proper error format for invalid backfill IDs', ...)` block
- `it('should handle backfill request validation consistently', ...)` block
- Update stale comment: `// (4 sub-routers: snapshots, backfill, core, analytics)` → `// (5 sub-routers: snapshots, core, rankings, analyticsSummary, analytics)`

### useContrastCheck.ts — Full Deletion

The entire file is deleted. No other file imports from it (confirmed via grep).

## Data Models

No data model changes. This is purely a code removal operation.

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

This cleanup is purely subtractive. The key correctness concern is that removing dead code does not break anything that was working. Most acceptance criteria are specific absence checks (does function X still exist?) which are best validated by compilation and test execution rather than property-based tests.

After prework analysis and reflection, the following properties were identified:

### Property 1: Retained exports remain functional

_For any_ non-backfill export from `shared.ts` and `index.ts` (e.g., `validateDistrictId`, `getValidDistrictId`, `validateDateFormat`, `snapshotStore`, `districtDataAggregator`, `getRefreshService`, `getTimeSeriesIndexService`), the export SHALL still be accessible and importable after cleanup.

**Validates: Requirements 1.8, 2.4**

### Property 2: Retained tests pass after cleanup

_For any_ non-backfill test in the three affected test files, the test SHALL continue to pass with the same behavior after the backfill test blocks are removed.

**Validates: Requirements 3.4, 3.5, 3.6**

### Property 3: No dangling references to useContrastCheck

_For any_ file in the frontend source tree, the file SHALL NOT contain an import statement referencing `useContrastCheck`.

**Validates: Requirements 4.2**

Note: Properties 1 and 2 are most naturally validated by compilation (TypeScript will catch dangling references) and running the existing test suite. Property 3 is validated by a grep/search across the frontend codebase. Given the testing steering document's guidance to "prefer the simplest test that provides confidence," these properties do not warrant new property-based tests — compilation and existing test execution provide sufficient confidence for a subtractive change.

## Error Handling

No new error handling is introduced. The cleanup removes error handling code (the `validateBackfillRequest` function) that was already orphaned.

The only error scenario is if the cleanup accidentally removes code that is still referenced. This is caught by:

1. TypeScript compilation (dangling imports/references)
2. Existing test suite execution (behavioral regressions)

## Testing Strategy

### Approach

This is a subtractive change. The testing strategy follows the testing steering document's principle: "prefer the simplest test that provides confidence."

**No new tests are needed.** The correctness of this cleanup is validated by:

1. **TypeScript compilation**: Running `tsc --noEmit` on both backend and frontend. If any removed code was still referenced, compilation will fail with clear errors.
2. **Existing test suite**: Running the existing tests (minus the removed backfill test blocks). If any removed code was still needed by retained tests, those tests will fail.
3. **Static analysis**: Verifying via grep that no import references remain for removed symbols.

### What is NOT tested

- The removed backfill test blocks themselves — they were testing deleted endpoints and would produce 404s. Their removal is the fix.
- The deleted `useContrastCheck.ts` — it had no tests and no consumers.

### Verification Steps

1. `npx tsc --noEmit` in `backend/` — zero errors
2. `npx tsc --noEmit` in `frontend/` — zero errors
3. `npx vitest --run` in `backend/` — all retained tests pass
4. Grep for `validateBackfillRequest`, `estimateCompletionTime`, `startBackfillCleanupInterval`, `stopBackfillCleanupInterval`, `useContrastCheck` across the codebase — zero hits in source files (excluding docs/reports)
