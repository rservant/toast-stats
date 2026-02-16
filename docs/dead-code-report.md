# Dead Code Report

**Generated:** 2026-02-16
**Scope:** Full codebase (backend, frontend, packages)

---

## Summary

| Priority | Items | Description                                            |
| -------- | ----- | ------------------------------------------------------ |
| Low      | 6     | Deprecated aliases still consumed by tests             |

---

## Low Priority — Deprecated Aliases (Still Used in Tests)

These items are properly marked `@deprecated` and still consumed by test files. They are not urgent but represent cleanup debt.

### 4. `PerDistrictFileSnapshotStore` alias in `SnapshotStore.ts`

Alias for `FileSnapshotStore`. Used extensively in test files (8+ test files reference it). Removing it requires updating all those test imports to use `FileSnapshotStore` directly.

### 5. `AreaProgressSummary` / `AreaProgressSummaryProps` / `AreaWithDivision` in `DivisionAreaProgressSummary.tsx`

Deprecated aliases for the renamed component. `AreaProgressSummary` is used in `AreaProgressSummary.test.tsx` and `AreaWithDivision` is used in `areaProgressText.ts` and its tests. Production code uses the new names.

### 6. `AreaRecognitionPanel` / `AreaRecognitionPanelProps` in `DivisionAreaRecognitionPanel.tsx`

Deprecated aliases exported from `components/index.ts`. No production page imports them — only the new `DivisionAreaRecognitionPanel` name is used.

### 7. `createSnapshotStore()` on `ProductionServiceFactory`

Not deprecated in code but has a comment saying `createSnapshotStorage()` should be preferred. Still used in test mocks and the `snapshot-debug.ts` script.

### 8. `AvailableProgramYearsResult` type alias

Deprecated alias for `AvailableRankingYearsResponse` in `AvailableProgramYearsService.ts`. Not imported anywhere outside its definition file.

### 9. `backend/src/routes/admin.ts` — Deprecated re-export shim

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

**High priority (third pass):**

9. ~~No-op transformer functions in `backend/src/utils/transformers.ts`~~ — Removed `transformDistrictsResponse`, `transformDistrictStatisticsResponse`, `transformMembershipHistoryResponse`, `transformClubsResponse`, `transformDailyReportsResponse`, `transformDailyReportDetailResponse` and their imports from `core.ts`

**Medium priority (fourth pass):**

10. ~~Orphaned backfill functions in `backend/src/routes/districts/shared.ts`~~ — Removed `validateBackfillRequest()`, `estimateCompletionTime()`, `startBackfillCleanupInterval()`, `stopBackfillCleanupInterval()`, `BackfillValidationResult` interface, `cleanupIntervalId` variable, auto-start call, and `BackfillRequest` import
11. ~~Orphaned backfill re-exports in `backend/src/routes/districts/index.ts`~~ — Removed `getBackfillService`, `startBackfillCleanupInterval`, `stopBackfillCleanupInterval` re-exports
12. ~~Orphaned backfill test blocks~~ — Removed "Unified Backfill Endpoints" describe block from `districts.integration.test.ts`, two backfill tests from `functionality-preservation.property.test.ts`, two backfill tests from `route-composition.property.test.ts`
13. ~~`frontend/src/hooks/useContrastCheck.ts`~~ — Deleted (no importers after `useResponsiveDesign.ts` removal)
