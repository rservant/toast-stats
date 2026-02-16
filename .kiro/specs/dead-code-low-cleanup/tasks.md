# Implementation Plan: Dead Code Low-Priority Cleanup

## Overview

Incrementally remove six low-priority dead code items (deprecated aliases, unused types, legacy methods, and an unnecessary re-export shim). Each task targets one item from the dead code report, with checkpoints after groups of related changes. Items are ordered from simplest (pure removal, zero consumers) to most complex (many consumer updates).

## Tasks

- [x] 1. Remove `AvailableProgramYearsResult` type alias from `AvailableProgramYearsService.ts`
  - Remove the `export type AvailableProgramYearsResult = AvailableRankingYearsResponse` line and its `@deprecated` JSDoc comment
  - No consumer updates needed — zero importers outside the definition file
  - _Requirements: 5.1, 5.2_

- [x] 2. Remove `AreaRecognitionPanel` / `AreaRecognitionPanelProps` deprecated aliases
  - [x] 2.1 Remove aliases from `frontend/src/components/DivisionAreaRecognitionPanel.tsx`
    - Remove the `export const AreaRecognitionPanel = DivisionAreaRecognitionPanel` line and its `@deprecated` JSDoc
    - Remove the `export type AreaRecognitionPanelProps = DivisionAreaRecognitionPanelProps` line and its `@deprecated` JSDoc
    - _Requirements: 3.1, 3.2_
  - [x] 2.2 Remove re-exports from `frontend/src/components/index.ts`
    - Remove `AreaRecognitionPanel` from the value re-export block
    - Remove `AreaRecognitionPanelProps` from the type re-export block
    - _Requirements: 3.3_
  - [x] 2.3 Remove alias verification test from `DivisionAreaRecognitionPanel.test.tsx`
    - Remove the test block that dynamically imports `AreaRecognitionPanel` to verify the alias exists
    - _Requirements: 3.4, 3.5_

- [x] 3. Remove `admin.ts` re-export shim and update import
  - [x] 3.1 Update `backend/src/index.ts` to import from `./routes/admin/index.js` directly
    - Change `import adminRoutes from './routes/admin.js'` to `import adminRoutes from './routes/admin/index.js'`
    - _Requirements: 6.2, 6.3_
  - [x] 3.2 Delete `backend/src/routes/admin.ts`
    - _Requirements: 6.1_

- [x] 4. Checkpoint — Verify frontend and backend compile after simple removals
  - Run TypeScript compilation on frontend and backend
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Remove `PerDistrictFileSnapshotStore` alias and update test consumers
  - [x] 5.1 Remove alias from `backend/src/services/SnapshotStore.ts`
    - Remove the `export const PerDistrictFileSnapshotStore = FileSnapshotStore` line and its `@deprecated` JSDoc
    - _Requirements: 1.1_
  - [x] 5.2 Update test files to use `FileSnapshotStore` directly
    - In each of the ~11 test files that import `PerDistrictFileSnapshotStore`:
      - Remove `PerDistrictFileSnapshotStore` from the import statement
      - Replace all type annotations `PerDistrictFileSnapshotStore` → `FileSnapshotStore`
      - Replace all constructor calls `new PerDistrictFileSnapshotStore(` → `new FileSnapshotStore(`
      - Replace all `as unknown as PerDistrictFileSnapshotStore` casts → `as unknown as FileSnapshotStore`
    - _Requirements: 1.2, 1.3, 1.4, 1.5_

- [x] 6. Remove `AreaProgressSummary` / `AreaProgressSummaryProps` deprecated aliases and update test
  - [x] 6.1 Remove aliases from `frontend/src/components/DivisionAreaProgressSummary.tsx`
    - Remove the `AreaProgressSummaryProps` interface and its `@deprecated` JSDoc
    - Remove the `AreaProgressSummary` component (the entire backward-compat wrapper function)
    - Keep the `AreaWithDivision` interface (still actively used by `areaProgressText.ts`)
    - _Requirements: 2.1, 2.2_
  - [x] 6.2 Remove re-exports from `frontend/src/components/index.ts`
    - Remove `AreaProgressSummary` from the value re-export block
    - Remove `AreaProgressSummaryProps` from the type re-export block
    - Remove `AreaWithDivision` from the type re-export block (no barrel consumers)
    - _Requirements: 2.3_
  - [x] 6.3 Update `AreaProgressSummary.test.tsx` to use `DivisionAreaProgressSummary` directly
    - Change import from `AreaProgressSummary` to `DivisionAreaProgressSummary`
    - Convert test data from `AreaWithDivision[]` format to `DivisionPerformance[]` format
    - Update component renders to pass `divisions` prop instead of `areas` prop
    - _Requirements: 2.4, 2.5, 2.7_

- [x] 7. Remove `createSnapshotStore()` method and update consumers
  - [x] 7.1 Remove `createSnapshotStore` from `ProductionServiceFactory.ts`
    - Remove the method from the `ProductionServiceFactory` interface
    - Remove the method implementation from `DefaultProductionServiceFactory`
    - _Requirements: 4.1, 4.2_
  - [x] 7.2 Remove `createSnapshotStore` from `TestServiceFactory.ts`
    - Remove the method from the test factory interface
    - Remove the method implementation
    - Update any internal callers (`this.createSnapshotStore()` → `this.createSnapshotStorage()`)
    - _Requirements: 4.3_
  - [x] 7.3 Update `snapshot-debug.ts` to use `createSnapshotStorage()`
    - Replace all 5 occurrences of `factory.createSnapshotStore()` with `factory.createSnapshotStorage()`
    - Verify API compatibility — `ISnapshotStorage` may have different methods than `SnapshotStore`; adjust usage if needed
    - _Requirements: 4.4_
  - [x] 7.4 Update test mock objects to provide `createSnapshotStorage` instead of `createSnapshotStore`
    - Update mock factory objects in ~10 test files
    - Rename `createSnapshotStore` property to `createSnapshotStorage` in each mock
    - _Requirements: 4.5, 4.6, 4.7_

- [x] 8. Final checkpoint — Verify full codebase integrity
  - Run TypeScript compilation on both backend and frontend with zero errors
  - Run backend and frontend test suites and verify all tests pass
  - Grep for removed symbols to confirm zero remaining references in source files
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 7.1, 7.2, 7.3_

## Notes

- Tasks are ordered from simplest (zero-consumer removals) to most complex (many-consumer updates)
- Items 1–3 (tasks 1–3) are pure removals or single-file updates with minimal risk
- Items 4–5 (tasks 5–6) require updating multiple test files but are mechanical find-and-replace
- Item 7 (task 7) is the most complex — touches the factory interface, a CLI script, and many test mocks
- The intermediate checkpoint (task 4) catches issues early before tackling the larger consumer updates
- No new tests are needed — compilation and existing test execution validate the cleanup
