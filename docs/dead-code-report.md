# Dead Code Report

**Generated:** 2026-02-16  
**Scope:** Full codebase (backend, frontend, packages)

---

## Summary

| Priority | Items | Description |
|----------|-------|-------------|
| High | 5 | Completely unused code, safe to remove |
| Medium | 4 | Orphaned hook chains and stale documentation |
| Low | 6 | Deprecated aliases still consumed by tests |

---

## High Priority — Safe to Remove

### 1. `backend/src/utils/routeValidation.ts` — Entirely unused

Exports `validateRouteParams`, `DistrictRouteParams`, and `MonthlyRouteParams`. None are imported anywhere in the codebase.

### 2. `backend/src/services/MockToastmastersAPIService.ts` — Only referenced by its own test

`MockToastmastersAPIService` is not imported by any production code. Its only consumer is `backend/src/services/__tests__/MockToastmastersAPIService.test.ts`. The `RealToastmastersAPIService` it was designed to mirror was already deleted during the codebase cleanup spec.

Also remove: `backend/src/services/__tests__/MockToastmastersAPIService.test.ts`

### 3. `backend/src/services/SCRAPER_README.md` — References deleted files

This README documents `RealToastmastersAPIService`, `MockToastmastersAPIService`, and `ToastmastersScraper` as if they still live in the backend. All three were moved or deleted during the scraper-cli separation. The file is misleading and should be removed or rewritten.

### 4. `backend/src/utils/transformers.ts` — Most functions are no-op pass-throughs

The following exported functions accept `unknown`, do no transformation, and `return apiResponse` unchanged:

- `transformDistrictsResponse`
- `transformDistrictStatisticsResponse`
- `transformMembershipHistoryResponse`
- `transformClubsResponse`

They are imported and called in `backend/src/routes/districts/core.ts`, but they do nothing. They were placeholder implementations that were never completed because the architecture shifted to pre-computed data served from files.

`transformDailyReportsResponse` and `transformDailyReportDetailResponse` have partial logic but follow the same pattern.

Only `transformErrorResponse` and `transformEducationalAwardsResponse` do real work.

**Recommendation:** Remove the no-op functions and their imports from `core.ts`. Keep `transformErrorResponse` and `transformEducationalAwardsResponse`.

### 5. `createPerDistrictSnapshotStore()` factory — Zero callers

Defined in `backend/src/services/SnapshotStore.ts`, marked `@deprecated`, and never imported anywhere.

---

## Medium Priority — Orphaned Hook Chains & Stale Docs

### 6. `frontend/src/hooks/useIntegratedData.ts` — Entire file is dead

Exports multiple hooks (`useEnhancedMembershipData`, `useSignificantEvents`, `useRealTimeMembership`, `useDailyReportTotals`). None are imported by any component or test file. The file imports `useDailyReports`, making that hook appear used when it is not.

### 7. `frontend/src/hooks/useDailyReports.ts` — Only consumer is dead

`useDailyReports` is only imported by `useIntegratedData.ts` (item 6 above). No component or test imports it directly. If `useIntegratedData.ts` is removed, this file becomes completely orphaned.

### 8. `frontend/src/hooks/useResponsiveDesign.ts` — Not used by any component

`useResponsiveDesign` is defined and internally references `useTouchTarget` and `useContrastCheck`, but no component or test file imports it. It was created for the brand-compliance spec but never wired into the UI.

### 9. `backend/src/routes/districts/backfill.ts` — Deprecated endpoint file

The entire file is deprecated with a message directing users to `/api/admin/unified-backfill`. The frontend does not call these endpoints. The file adds deprecation middleware and logging overhead for endpoints that appear to have no active consumers.

---

## Low Priority — Deprecated Aliases (Still Used in Tests)

These items are properly marked `@deprecated` and still consumed by test files. They are not urgent but represent cleanup debt.

### 10. `PerDistrictFileSnapshotStore` alias in `SnapshotStore.ts`

Alias for `FileSnapshotStore`. Used extensively in test files (8+ test files reference it). Removing it requires updating all those test imports to use `FileSnapshotStore` directly.

### 11. `AreaProgressSummary` / `AreaProgressSummaryProps` / `AreaWithDivision` in `DivisionAreaProgressSummary.tsx`

Deprecated aliases for the renamed component. `AreaProgressSummary` is used in `AreaProgressSummary.test.tsx` and `AreaWithDivision` is used in `areaProgressText.ts` and its tests. Production code uses the new names.

### 12. `AreaRecognitionPanel` / `AreaRecognitionPanelProps` in `DivisionAreaRecognitionPanel.tsx`

Deprecated aliases exported from `components/index.ts`. No production page imports them — only the new `DivisionAreaRecognitionPanel` name is used.

### 13. `createSnapshotStore()` on `ProductionServiceFactory`

Not deprecated in code but has a comment saying `createSnapshotStorage()` should be preferred. Still used in test mocks and the `snapshot-debug.ts` script.

### 14. `AvailableProgramYearsResult` type alias

Deprecated alias for `AvailableRankingYearsResponse` in `AvailableProgramYearsService.ts`. Not imported anywhere outside its definition file.

### 15. `backend/src/routes/admin.ts` — Deprecated re-export shim

Re-exports `default` from `./admin/index.js`. Still imported by `backend/src/index.ts` as `adminRoutes`. Functional but unnecessary indirection — `index.ts` could import from `./routes/admin/index.js` directly.

---

## Not Dead Code (False Positives Investigated)

The following were investigated and confirmed to be in active use:

- `useTouchTarget` — imported by `useResponsiveDesign.ts` and tested directly
- `useContrastCheck` — imported by `useResponsiveDesign.ts` and tested directly
- `transformErrorResponse` — imported by 6 route files
- `transformEducationalAwardsResponse` — imported by `core.ts`
- `PerDistrictSnapshotStore` type alias — used in test type annotations
