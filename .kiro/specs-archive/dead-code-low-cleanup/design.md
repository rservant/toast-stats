# Design Document: Dead Code Low-Priority Cleanup

## Overview

This cleanup removes six low-priority dead code items identified in the dead code report (items 4–9). These are deprecated aliases consumed only by tests, an unused type alias, a legacy factory method, and an unnecessary re-export shim. The work is purely subtractive for most items, with mechanical find-and-replace updates for consumers that reference deprecated names.

Three categories of work:

1. **Alias removal with consumer updates** (items 4, 5, 7): Remove deprecated aliases and update all consumers (test files, scripts) to use the canonical names
2. **Pure alias removal** (items 6, 8): Remove deprecated aliases that have zero external consumers
3. **Indirection removal** (item 9): Delete a re-export shim file and update the single import

No new functionality is introduced. No API endpoints are added or modified.

## Architecture

No architectural changes. The two-process architecture (scraper-cli for computation, backend for serving) is unaffected. No API routes change — this cleanup only touches internal module exports, test files, and one CLI script.

### Affected Files Summary

| Item | Files Modified                                                                               | Files Deleted                 | Category                          |
| ---- | -------------------------------------------------------------------------------------------- | ----------------------------- | --------------------------------- |
| 4    | `SnapshotStore.ts` + 8 test files                                                            | —                             | Backend alias + test updates      |
| 5    | `DivisionAreaProgressSummary.tsx`, `components/index.ts`, `AreaProgressSummary.test.tsx`     | —                             | Frontend alias + test updates     |
| 6    | `DivisionAreaRecognitionPanel.tsx`, `components/index.ts`                                    | —                             | Frontend pure alias removal       |
| 7    | `ProductionServiceFactory.ts`, `TestServiceFactory.ts`, `snapshot-debug.ts` + ~10 test files | —                             | Backend method + consumer updates |
| 8    | `AvailableProgramYearsService.ts`                                                            | —                             | Backend pure alias removal        |
| 9    | `backend/src/index.ts`                                                                       | `backend/src/routes/admin.ts` | Backend indirection removal       |

## Components and Interfaces

### Item 4: `PerDistrictFileSnapshotStore` alias in `SnapshotStore.ts`

**Remove:**

```typescript
// Remove from backend/src/services/SnapshotStore.ts:
export const PerDistrictFileSnapshotStore = FileSnapshotStore
```

**Update consumers** — 8 test files import `PerDistrictFileSnapshotStore` alongside `FileSnapshotStore`. In each file:

- Remove `PerDistrictFileSnapshotStore` from the import
- Replace all type annotations `PerDistrictFileSnapshotStore` → `FileSnapshotStore`
- Replace all constructor calls `new PerDistrictFileSnapshotStore(` → `new FileSnapshotStore(`

Affected test files:

- `SnapshotBuilder.property.test.ts` — mock function return type + `as unknown as` cast
- `RefreshService.rankings.test.ts` — variable type annotation + `as unknown as` cast
- `RefreshService.precomputed-analytics.test.ts` — variable type annotation + constructor call
- `PerDistrictSnapshotStore.rankings-integration.test.ts` — variable type + constructor
- `PerDistrictSnapshotStore.ranking-version.test.ts` — variable type + constructor
- `PerDistrictSnapshotStore.iso-date-naming.test.ts` — variable type + constructor
- `PerDistrictSnapshotStore.newer-data-wins.property.test.ts` — variable type + constructor
- `PerDistrictSnapshotStore.rankings.test.ts` — variable type + constructor
- `PerDistrictSnapshotStore.closing-period.property.test.ts` — variable type + constructor
- `PerDistrictSnapshotStore.property.test.ts` — variable type + constructor
- `migration-iso-date-snapshots.test.ts` — variable type + constructor

### Item 5: `AreaProgressSummary` / `AreaProgressSummaryProps` / `AreaWithDivision` in `DivisionAreaProgressSummary.tsx`

**Remove from `DivisionAreaProgressSummary.tsx`:**

- The `AreaProgressSummaryProps` interface (deprecated alias)
- The `AreaProgressSummary` component (backward-compat wrapper that converts `AreaWithDivision[]` to `DivisionPerformance[]`)

**Keep in `DivisionAreaProgressSummary.tsx`:**

- The `AreaWithDivision` interface — still actively used internally by the component and by `areaProgressText.ts`. The `@deprecated` annotation can remain as a signal that new code should prefer `DivisionPerformance[]`, but the interface itself is not dead code.

**Remove from `components/index.ts`:**

- `AreaProgressSummary` re-export
- `AreaProgressSummaryProps` re-export
- `AreaWithDivision` re-export (nobody imports it from the barrel; `areaProgressText.ts` imports directly from the module)

**Update `AreaProgressSummary.test.tsx`:**

- Rename import from `AreaProgressSummary` → `DivisionAreaProgressSummary`
- Update component usage in test renders
- The test already imports `AreaWithDivision` directly from `DivisionAreaProgressSummary` module, so that import stays
- The test uses the old `AreaProgressSummary` API (passing `areas` prop with `AreaWithDivision[]`). Since we're removing the backward-compat wrapper, the test needs to be updated to use the new `DivisionAreaProgressSummary` API (passing `divisions` prop with `DivisionPerformance[]`). This requires converting the test's `AreaWithDivision[]` test data to `DivisionPerformance[]` format.

### Item 6: `AreaRecognitionPanel` / `AreaRecognitionPanelProps` in `DivisionAreaRecognitionPanel.tsx`

**Remove from `DivisionAreaRecognitionPanel.tsx`:**

```typescript
// Remove:
export const AreaRecognitionPanel = DivisionAreaRecognitionPanel
export type AreaRecognitionPanelProps = DivisionAreaRecognitionPanelProps
```

**Remove from `components/index.ts`:**

- `AreaRecognitionPanel` re-export
- `AreaRecognitionPanelProps` re-export

No consumer updates needed — no production code or test file imports these aliases. The `DivisionAreaRecognitionPanel.test.tsx` file has a test that dynamically imports `AreaRecognitionPanel` to verify the alias exists; that test block should be removed.

### Item 7: `createSnapshotStore()` on `ProductionServiceFactory`

**Remove from `ProductionServiceFactory.ts`:**

- `createSnapshotStore` method from the `ProductionServiceFactory` interface
- `createSnapshotStore` method implementation from `DefaultProductionServiceFactory`

**Remove from `TestServiceFactory.ts`:**

- `createSnapshotStore` method from the test factory interface
- `createSnapshotStore` method implementation
- Update internal callers within `TestServiceFactory` that call `this.createSnapshotStore()` to call `this.createSnapshotStorage()` instead (need to verify return type compatibility)

**Update `snapshot-debug.ts`:**

- Replace all 5 occurrences of `factory.createSnapshotStore()` with `factory.createSnapshotStorage()`
- Note: `createSnapshotStorage()` returns `ISnapshotStorage` while `createSnapshotStore()` returns `SnapshotStore` (which is `FileSnapshotStore`). The script uses methods like `getSnapshot`, `listSnapshots`, `isReady`, `validateIntegrity` — need to verify these exist on `ISnapshotStorage`. If not, the script may need to cast or use a different approach.

**Update test mock objects:**

- ~10 test files provide `createSnapshotStore` in mock factory objects
- Each needs to be renamed to `createSnapshotStorage`
- The mock return values stay the same (mock snapshot store objects)

### Item 8: `AvailableProgramYearsResult` type alias

**Remove from `AvailableProgramYearsService.ts`:**

```typescript
// Remove:
export type AvailableProgramYearsResult = AvailableRankingYearsResponse
```

No consumer updates needed — the type is not imported anywhere outside its definition file.

### Item 9: `admin.ts` re-export shim

**Delete:** `backend/src/routes/admin.ts`

**Update `backend/src/index.ts`:**

```typescript
// Before:
import adminRoutes from './routes/admin.js'

// After:
import adminRoutes from './routes/admin/index.js'
```

The shim also re-exports named utilities (`logAdminAccess`, `generateOperationId`, `getServiceFactory`, `AdminErrorResponse`, `AdminResponseMetadata`), but no file imports these from the shim path — they're imported directly from `./admin/index.js` or `./admin/shared.js` by the files that need them.

## Data Models

No data model changes. This is purely a code removal and renaming operation.

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

This cleanup is purely subtractive — removing deprecated aliases, unused types, and unnecessary indirection. After prework analysis of all 30 acceptance criteria across 7 requirements, every testable criterion is a specific absence check (does symbol X still exist? does file Y still exist?) rather than a universal property over generated inputs.

All correctness is validated by:

1. **TypeScript compilation** — if a removed export was still referenced, `tsc --noEmit` will fail with a clear error
2. **Existing test suite** — if removing an alias breaks behavior, the existing tests that exercise that behavior will fail
3. **Static analysis (grep)** — confirming zero remaining references to removed symbols

Per the testing steering document's guidance to "prefer the simplest test that provides confidence" and that "property tests are a tool, not a default," no new property-based tests or unit tests are warranted for this subtractive change. The existing compilation and test infrastructure provides complete coverage.

No testable properties identified.

## Error Handling

No new error handling is introduced. The cleanup removes deprecated code that was already orphaned or only consumed by tests.

The only error scenario is accidental removal of code that is still referenced. This is caught by:

1. TypeScript compilation (dangling imports/references produce compile errors)
2. Existing test suite execution (behavioral regressions cause test failures)

### Risk Assessment per Item

| Item | Risk   | Rationale                                                                                                                                                                                                                      |
| ---- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 4    | Low    | Mechanical rename in test files; `FileSnapshotStore` is the canonical name already imported alongside the alias                                                                                                                |
| 5    | Medium | `AreaProgressSummary.test.tsx` uses the old wrapper API (`areas` prop); needs conversion to new API (`divisions` prop)                                                                                                         |
| 6    | Low    | Zero consumers outside the definition file; one test block to remove                                                                                                                                                           |
| 7    | Medium | Touches ~10 test mock objects and a CLI script; `createSnapshotStorage()` returns `ISnapshotStorage` (different type than `createSnapshotStore()`'s `SnapshotStore`) — need to verify API compatibility in `snapshot-debug.ts` |
| 8    | Low    | Zero consumers; single line removal                                                                                                                                                                                            |
| 9    | Low    | Single import path change in `backend/src/index.ts`                                                                                                                                                                            |

## Testing Strategy

### Approach

This is a subtractive change. The testing strategy follows the testing steering document's principle: "prefer the simplest test that provides confidence."

**No new tests are needed.** The correctness of this cleanup is validated by:

1. **TypeScript compilation**: Running `tsc --noEmit` on both backend and frontend. If any removed code was still referenced, compilation will fail with clear errors.
2. **Existing test suite**: Running the existing tests. If any removed code was still needed by retained tests, those tests will fail.
3. **Static analysis**: Verifying via grep that no import references remain for removed symbols.

### Verification Steps

1. `npx tsc --noEmit` in `backend/` — zero errors
2. `npx tsc --noEmit` in `frontend/` — zero errors
3. `npx vitest --run` in `backend/` — all tests pass
4. `npx vitest --run` in `frontend/` — all tests pass
5. Grep for removed symbols (`PerDistrictFileSnapshotStore`, `AreaProgressSummary`, `AreaRecognitionPanel`, `createSnapshotStore`, `AvailableProgramYearsResult`, `routes/admin.js`) — zero hits in source files (excluding docs/reports)

### What is NOT tested

- The removed `AreaProgressSummary` backward-compat wrapper — it was a shim that converted old API to new API. Its removal is the goal.
- The removed `AreaRecognitionPanel` alias test block — it only verified the alias existed.
- The `AvailableProgramYearsResult` type — it had zero consumers.
