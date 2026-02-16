# Dead Code Report

**Generated:** 2026-02-16
**Scope:** Full codebase (backend, frontend, packages)

---

## Summary

| Priority | Items | Description                                            |
| -------- | ----- | ------------------------------------------------------ |
| High     | 1     | No-op transformer functions, safe to remove            |
| Medium   | 3     | Cascading dead code from backfill.ts removal + orphan  |
| Low      | 6     | Deprecated aliases still consumed by tests             |

---

## High Priority — Safe to Remove

### 1. `backend/src/utils/transformers.ts` — Most functions are no-op pass-throughs

The following exported functions accept `unknown`, do no transformation, and `return apiResponse` unchanged:

- `transformDistrictsResponse`
- `transformDistrictStatisticsResponse`
- `transformMembershipHistoryResponse`
- `transformClubsResponse`

They are imported and called in `backend/src/routes/districts/core.ts`, but they do nothing. They were placeholder implementations that were never completed because the architecture shifted to pre-computed data served from files.

`transformDailyReportsResponse` and `transformDailyReportDetailResponse` have partial logic but follow the same pattern.

Only `transformErrorResponse` and `transformEducationalAwardsResponse` do real work.

**Recommendation:** Remove the no-op functions and their imports from `core.ts`. Keep `transformErrorResponse` and `transformEducationalAwardsResponse`.

---

## Medium Priority — Cascading Dead Code & Orphans

### 2. `backend/src/routes/districts/shared.ts` — Backfill-related functions now orphaned

The removal of `backfill.ts` left several functions in `shared.ts` with zero importers:

- `validateBackfillRequest()` — was only called by the deleted `backfill.ts`
- `estimateCompletionTime()` — was only called by the deleted `backfill.ts`
- `startBackfillCleanupInterval()` / `stopBackfillCleanupInterval()` — re-exported from `index.ts` but never imported by any other module

The corresponding re-exports in `backend/src/routes/districts/index.ts` (`getBackfillService`, `startBackfillCleanupInterval`, `stopBackfillCleanupInterval`) are also unused — no file imports them from the districts index.

**Recommendation:** Remove the orphaned functions from `shared.ts` and their re-exports from `index.ts`.

### 3. Test files reference deleted `/api/districts/backfill` endpoints

Two test files still exercise the now-removed deprecated district backfill endpoints:

- `backend/src/__tests__/districts.integration.test.ts` — "Unified Backfill Endpoints" describe block tests `POST /api/districts/backfill`, `GET /api/districts/backfill/:backfillId`, `DELETE /api/districts/backfill/:backfillId`
- `backend/src/__tests__/functionality-preservation.property.test.ts` — references `/api/districts/backfill` in property tests

These tests will now get 404s since the routes no longer exist. The admin backfill endpoints at `/api/admin/unified-backfill` are the active replacement and have their own tests.

**Recommendation:** Remove the test blocks that exercise the deleted district backfill endpoints.

### 4. `frontend/src/hooks/useContrastCheck.ts` — No longer imported by anything

With the removal of `useResponsiveDesign.ts` (which was its only consumer), `useContrastCheck` is now completely orphaned. No component, hook, or test file imports it.

**Recommendation:** Delete the file.

---

## Low Priority — Deprecated Aliases (Still Used in Tests)

These items are properly marked `@deprecated` and still consumed by test files. They are not urgent but represent cleanup debt.

### 5. `PerDistrictFileSnapshotStore` alias in `SnapshotStore.ts`

Alias for `FileSnapshotStore`. Used extensively in test files (8+ test files reference it). Removing it requires updating all those test imports to use `FileSnapshotStore` directly.

### 6. `AreaProgressSummary` / `AreaProgressSummaryProps` / `AreaWithDivision` in `DivisionAreaProgressSummary.tsx`

Deprecated aliases for the renamed component. `AreaProgressSummary` is used in `AreaProgressSummary.test.tsx` and `AreaWithDivision` is used in `areaProgressText.ts` and its tests. Production code uses the new names.

### 7. `AreaRecognitionPanel` / `AreaRecognitionPanelProps` in `DivisionAreaRecognitionPanel.tsx`

Deprecated aliases exported from `components/index.ts`. No production page imports them — only the new `DivisionAreaRecognitionPanel` name is used.

### 8. `createSnapshotStore()` on `ProductionServiceFactory`

Not deprecated in code but has a comment saying `createSnapshotStorage()` should be preferred. Still used in test mocks and the `snapshot-debug.ts` script.

### 9. `AvailableProgramYearsResult` type alias

Deprecated alias for `AvailableRankingYearsResponse` in `AvailableProgramYearsService.ts`. Not imported anywhere outside its definition file.

### 10. `backend/src/routes/admin.ts` — Deprecated re-export shim

Re-exports `default` from `./admin/index.js`. Still imported by `backend/src/index.ts` as `adminRoutes`. Functional but unnecessary indirection — `index.ts` could import from `./routes/admin/index.js` directly.

---

## Not Dead Code (False Positives Investigated)

The following were investigated and confirmed to be in active use:

- `useTouchTarget` — tested directly in `designCompliance.test.ts`
- `transformErrorResponse` — imported by 6 route files
- `transformEducationalAwardsResponse` — imported by `core.ts`
- `PerDistrictSnapshotStore` type alias — used in test type annotations

---

## Resolved

The following items were identified and removed on 2026-02-16:

**High priority (first pass):**

1. ~~`backend/src/utils/routeValidation.ts`~~ — Deleted (entirely unused)
2. ~~`backend/src/services/MockToastmastersAPIService.ts`~~ — Deleted along with its test file (only self-referencing)
3. ~~`backend/src/services/SCRAPER_README.md`~~ — Deleted (referenced deleted files)
4. ~~`createPerDistrictSnapshotStore()` in `SnapshotStore.ts`~~ — Removed (zero callers)

**Medium priority (second pass):**

5. ~~`frontend/src/hooks/useIntegratedData.ts`~~ — Deleted (entire file dead)
6. ~~`frontend/src/hooks/useDailyReports.ts`~~ — Deleted (only consumer was dead)
7. ~~`frontend/src/hooks/useResponsiveDesign.ts`~~ — Deleted (not used by any component)
8. ~~`backend/src/routes/districts/backfill.ts`~~ — Deleted along with OpenAPI entries in both `backend/openapi.yaml` and `docs/openapi.yaml`
