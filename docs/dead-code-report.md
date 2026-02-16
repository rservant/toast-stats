# Dead Code Report

**Generated:** 2026-02-16
**Scope:** Full codebase (backend, frontend, packages)

---

## Summary

| Priority | Items | Description                                |
| -------- | ----- | ------------------------------------------ |
| —        | 0     | All identified dead code has been resolved |

---

## Not Dead Code (False Positives Investigated)

The following were investigated and confirmed to be in active use:

- `useTouchTarget` — tested directly in `designCompliance.test.ts`
- `transformErrorResponse` — imported by 6 route files
- `transformEducationalAwardsResponse` — imported by `core.ts`
- `PerDistrictSnapshotStore` type alias — used in test type annotations

---

## Resolved

The following items were identified and removed on 2026-02-16.

**Low priority (fifth pass — dead-code-low-cleanup spec):**

14. ~~`AvailableProgramYearsResult` type alias in `AvailableProgramYearsService.ts`~~ — Removed (zero consumers)
15. ~~`AreaRecognitionPanel` / `AreaRecognitionPanelProps` aliases in `DivisionAreaRecognitionPanel.tsx`~~ — Removed aliases, re-exports from `components/index.ts`, and alias verification test
16. ~~`backend/src/routes/admin.ts` re-export shim~~ — Deleted; `backend/src/index.ts` updated to import from `./routes/admin/index.js` directly
17. ~~`PerDistrictFileSnapshotStore` alias in `SnapshotStore.ts`~~ — Removed alias and updated ~11 test files to use `FileSnapshotStore` directly
18. ~~`AreaProgressSummary` / `AreaProgressSummaryProps` aliases in `DivisionAreaProgressSummary.tsx`~~ — Removed aliases, re-exports from `components/index.ts`, and updated `AreaProgressSummary.test.tsx` to use `DivisionAreaProgressSummary` directly with `DivisionPerformance[]` data format
19. ~~`createSnapshotStore()` on `ProductionServiceFactory` / `TestServiceFactory`~~ — Removed method from both factory interfaces, updated `snapshot-debug.ts` (5 occurrences) and ~10 test mock objects to use `createSnapshotStorage()`

**Previously resolved:**

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
