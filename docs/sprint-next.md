# Sprint 19 Plan — Performance & Reliability

**Planned start:** April 2026
**Theme:** Performance gates, code splitting, and data quality hardening

---

## Context

The product is feature-complete for its core use case. All major features are shipped (product-spec: "Decided — Not Yet Shipped: empty", "Known Issues: none"). The backend has been fully deleted in favor of CDN-only architecture. Recent sprints (15-18) focused on UX polish, data accuracy fixes, accessibility, URL-synced state, and the "members to distinguished" feature.

Five specs remain in `.kiro/specs/` — all NOT STARTED. Three open doc-specs exist in `docs/specs/` (graceful district coverage, optimize cached-dates, statistics response optimization). The cached-dates and statistics-response specs reference the deleted Express backend, making them **obsolete**. The graceful-district-coverage spec is partially done (detail page handled) but needs landing page indicators.

All 2,801 tests pass (1,994 frontend + 680 analytics-core + 127 shared-contracts). Test coverage is healthy.

---

## Sprint Goals

### 1. CI Performance Gates (from spec: `ci-performance-gates`)

**Priority: High** — No performance regression detection exists today. Bundle sizes and Lighthouse scores can silently degrade.

- Add bundle size enforcement to CI (main JS < 100KB gzip, vendor < 100KB gzip, CSS < 50KB gzip)
- Add Lighthouse CI with minimum score thresholds
- Report sizes in GitHub step summary on each PR

**Why now:** The CDN-only architecture means frontend bundle size IS the performance story. With no backend to optimize, catching frontend regressions is the highest-leverage quality gate to add.

**Estimated scope:** 1-2 days

---

### 2. Route-Based Code Splitting (from spec: `frontend-code-splitting`)

**Priority: High** — Direct prerequisite for passing the bundle size gates above.

- Convert LandingPage, DistrictDetailPage, ClubDetailPage to `React.lazy()` + `Suspense`
- Lessons learned from Sprint 11 (`LazyCharts` barrel) already established the pattern
- Verify each route chunk is independently loadable

**Why now:** The lazy chart splitting is done, but full route splitting isn't. This is the remaining low-hanging fruit for initial load performance and pairs naturally with the CI gates.

**Estimated scope:** 1 day

---

### 3. Graceful District Coverage (from spec: `docs/specs/graceful-district-coverage.md`)

**Priority: Medium** — Only 6 of 128 districts have detailed analytics. Users clicking untracked districts get a confusing experience on the landing page.

- Add visual indicator (icon/badge) in rankings table for districts with detailed analytics
- Default untracked districts to Global Rankings tab
- Add banner: "This district has limited data. Global rankings are available."
- Detail page fallback already implemented (commit `d04d6df`)

**Why now:** This is user-facing friction that's been documented but not fully addressed. Small scope, high UX impact.

**Estimated scope:** 1 day

---

### 4. Test Consolidation (from spec: `test-consolidation`)

**Priority: Medium** — 71 property test files exist; several are over-engineered per the PBT steering guidance.

- Convert over-engineered property tests to simpler unit tests (concurrent-execution-safety, resource-isolation, etc.)
- Remove redundant coverage between unit and property tests
- Target: reduce property test file count by ~30% while maintaining confidence

**Why now:** Test suite runs ~90s for frontend alone. Removing redundant PBT tests will improve CI cycle time and maintainability. Pairs well with the CI performance gates work.

**Estimated scope:** 2 days

---

### 5. Housekeeping: Archive Obsolete Specs

**Priority: Low** — Cleanup task.

- Move `docs/specs/optimize-cached-dates.md` to archive (references deleted Express backend)
- Move `docs/specs/statistics-response-optimization.md` to archive (references deleted Express backend)
- Update `.kiro/specs/README.md` last-updated date
- Evaluate `bounded-lru-cache` and `real-user-monitoring` specs for relevance (both reference backend `CacheService` which no longer exists)

**Estimated scope:** < 1 hour

---

## Deferred to Future Sprints

| Item                                  | Reason to Defer                                                                                                                                                                  |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Real User Monitoring**              | Spec references backend analytics endpoint that no longer exists. Needs redesign for CDN-only architecture (e.g., send metrics to a serverless function or third-party service). |
| **Bounded LRU Cache**                 | Spec references backend `CacheService` that was deleted. No longer applicable in current architecture. Candidate for archival.                                                   |
| **Expand district coverage beyond 6** | Product decision: requires more pipeline compute budget. Not a code task.                                                                                                        |

---

## Success Criteria

- [ ] CI fails on PRs that exceed bundle size limits
- [ ] Lighthouse CI runs on every PR with minimum score thresholds
- [ ] Route-based code splitting reduces initial bundle by 30%+
- [ ] Untracked districts show clear messaging and default to Global Rankings
- [ ] Property test count reduced by ~30% without losing test confidence
- [ ] All obsolete specs archived
