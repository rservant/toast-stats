# Sprint 19 Plan — Bugs, Dead Code, and Deep Links

**Planned start:** April 2026
**Theme:** Fix active bugs, remove dead code from the backend deletion, finish deep linking

---

## Context

The project is feature-complete for its core use case. The Express backend was deleted in Sprint 12 (#173), but significant dead code, stale docs, and broken references remain from that deletion. Two open bugs need fixing. Deep linking (#272) is partially done.

All 3,464 tests pass. Lighthouse CI already runs on PRs (`.github/workflows/lighthouse-ci.yml`).

---

## Sprint Goals

### 1. Fix: CSV scrape bypasses month-end detection (#278)

**Priority: High** — Active data quality bug. April metrics will be misdated without this fix.

- Parse CSV footers (e.g., "Month of March, As of 04/01/2026") during `HttpCsvDownloader` fetch
- Use parsed `isClosingPeriod` and `dataMonth` in `CollectorOrchestrator` to populate `metadata.json`
- Pipeline sets correct snapshot date during month-end closing periods

**Estimated scope:** 1-2 days

---

### 2. Fix: Data freshness banner shows "historical" for current data (#277)

**Priority: High** — User-facing bug. The banner logic is inverted.

**Estimated scope:** < 1 day

---

### 3. Dead code removal — backend deletion cleanup

**Priority: High** — 30+ stale files and references from the deleted Express backend.

#### Dead frontend files (never imported anywhere):

- `frontend/src/utils/performanceMonitoring.ts` (529 lines, explicitly comments "Express backend was removed")
- `frontend/src/utils/performanceOptimizer.ts`
- `frontend/src/utils/tokenDocumentation.ts`
- `frontend/src/utils/brandConstants.ts`
- `frontend/src/utils/typographyStandardizer.ts`
- `frontend/src/utils/colorReplacementEngine.ts`
- `frontend/src/components/DivisionHeatmap.tsx` + `.css` + test
- `frontend/src/components/GrowthVelocityCard.tsx` + `.css` + test
- `frontend/src/components/brand/AccessibilityChecker.tsx` + test
- `frontend/src/components/brand/ThemeProvider.tsx`
- `frontend/src/components/index.ts` (barrel, never imported)
- `frontend/src/scripts/validate-brand-colors.ts`
- `frontend/src/scripts/validate-brand-compliance-preservation.ts`
- `frontend/src/scripts/validate-component-patterns.ts`
- `frontend/src/scripts/validate-typography.ts`

#### Stale migration docs in source tree:

- `frontend/src/__tests__/migration-analysis.md`
- `frontend/src/__tests__/phase1-completion-summary.md`
- `frontend/src/__tests__/phase1-risk-assessment.md`
- `frontend/src/__tests__/migration-metrics.json`

#### Unused dependency:

- `axios` in `frontend/package.json` — zero imports in all frontend source

#### Dead root package.json scripts:

- `"cleanup:backend"` — references `backend/scripts/cleanup-test-dirs.sh` (doesn't exist)
- `"docker:build"` — references a Dockerfile that doesn't exist

#### Stale env vars:

- `VITE_API_BASE_URL` in `frontend/.env.production` and `frontend/.env.example` — never read by any code

#### Stale `.agent/` workflows (tracked in git):

- `.agent/workflows/docker-build.md` — references deleted Dockerfile/backend
- Consider adding `.agent/` to `.gitignore` or reviewing all 6 workflow files

#### Stale `AGENTS.md` content:

- Lists `docker` for "Local backend container builds"
- Lists `backend/` as a workspace for "Express API server"
- Lists `gcloud` for "Cloud Run management" — no Cloud Run exists

#### Obsolete documentation:

- `DEPLOYMENT.md` (1,529 lines) — architecture shows Cloud Run + Express + API Gateway; none exists
- `docs/openapi.yaml` (10,544 lines) — documents deleted Express API
- `docs/API_COVERAGE_ANALYSIS.md` (200 lines) — frontend-to-backend alignment for deleted backend
- `docs/specs/optimize-cached-dates.md` — references deleted Express endpoint
- `docs/specs/statistics-response-optimization.md` — references deleted Express endpoint
- `docs/archive/` (18 implementation reports) — pre-CDN era reports
- `docs/deployment-examples/` — Kubernetes/production configs for deleted backend
- `firestore.indexes.json` — Firestore not used by any code
- `firebase.json` references Firestore indexes unnecessarily
- `scripts/cleanup-all-test-dirs.sh` — references `backend/scripts/cleanup-test-dirs.sh`

**Estimated scope:** 2-3 days (mostly deletion, some AGENTS.md and DEPLOYMENT.md rewriting)

---

### 4. Deep links for full navigation (#272)

**Priority: Medium** — Partially done (ClubsTable pagination syncs with URL). Expand to all tabs, sorts, filters.

**Estimated scope:** 2 days

---

### 5. Graceful district coverage (existing spec: `docs/specs/graceful-district-coverage.md`)

**Priority: Medium** — 6 of 128 districts have detailed data. Landing page doesn't indicate which.

- Add visual indicator in rankings table for districts with detailed analytics
- Default untracked districts to Global Rankings tab
- Detail page fallback already implemented

**Estimated scope:** 1 day

---

## Deferred

| Item                            | Reason                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------ |
| **CI bundle size gates**        | Lighthouse CI already runs. Bundle size enforcement is low risk — no regressions observed. |
| **Route-based code splitting**  | Nice-to-have for performance, not urgent. Lazy chart splitting already done.               |
| **Test consolidation**          | Low priority — tests pass, coverage is healthy.                                            |
| **PWA (#259)**                  | Needs product review.                                                                      |
| **PDF/CSV reports (#258)**      | Needs product review.                                                                      |
| **Email digest (#257)**         | Needs product review.                                                                      |
| **Club comparison (#256)**      | Needs product review.                                                                      |
| **CDN cache monitoring (#255)** | Observability nice-to-have.                                                                |
| **DORA metrics (#253)**         | Observability nice-to-have.                                                                |

---

## Success Criteria

- [ ] Month-end closing period detection works correctly in daily pipeline (#278)
- [ ] Data freshness banner shows correct status (#277)
- [ ] All dead backend references removed (0 references to Express/apiClient/Cloud Run in source)
- [ ] `axios` removed from frontend dependencies
- [ ] DEPLOYMENT.md rewritten for CDN-only architecture
- [ ] AGENTS.md updated to reflect current project state
- [ ] Deep linking works for all tabs, sorts, and filters (#272)
- [ ] Rankings table indicates which districts have detailed analytics
