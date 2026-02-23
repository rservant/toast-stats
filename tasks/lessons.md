# 📚 Lessons Learned

<!-- Each lesson follows this structure. Newest entries go at the top. -->
<!-- The agent reads the last 5 entries before starting any task. -->

### Lesson 09 — Batch Similar Mobile Issues for Efficient CSS-Only Fixes (#85, #86, #87)

**Date**: 2026-02-23  
**Context**: Three mobile UX issues — sticky table columns, tab overflow indicator, and oversized export button — were all CSS/markup-only fixes touching 4 files. Combining them into a single TDD cycle (8 tests, one commit) was faster than three separate issue branches.  
**Lesson**: When multiple issues share the same root cause (responsive CSS gaps at a specific breakpoint), batch them. Write all failing tests first, then implement all fixes, then verify once. This avoids redundant test suite runs and context switches.  
**Future Warning**: Batching only works for independent, non-overlapping fixes. If two issues modify the same component in conflicting ways, handle them sequentially.

---

### Lesson 08 — Pre-computed Type Contracts Must Mirror Frontend Expectations (Issue #84)

**Date**: 2026-02-22  
**Context**: `topGrowthClubs` and `dcpGoalAnalysis` were **computed** correctly by `MembershipAnalyticsModule` and `DistinguishedClubAnalyticsModule` respectively, but never included in the pre-computed JSON types (`DistrictAnalytics`, `DistinguishedClubAnalyticsData`). The data was there internally but never surfaced to the JSON files that the backend serves.  
**Root Cause**: When `AnalyticsComputer` was designed, these fields were placed in separate extended analytics types but omitted from the base types that map to the actual JSON files served by the API. The frontend types expected them, but the backend pipeline didn't produce them.  
**Fix**: Added the fields to the pre-computed types and wired the already-computed data into the output objects.  
**Lesson**: When adding a new field to the frontend, always trace the data through to the pre-computed type that backs the API endpoint. The type contracts at the serialization boundary (JSON files) are what matter, not just the internal computation types.

<!--
## 🗓️ [YYYY-MM-DD] — Lesson NN: [Title]

**The Discovery**: [What unexpected behavior or coupling was found]

**The Scientific Proof**: [How the hypothesis was tested — link to experiment if applicable]

**The Farley Principle Applied**: [Which engineering principle this reinforces]

**The Resulting Rule**: [The new rule or constraint going forward]

**Future Warning**: [What to watch for — a tripwire for the agent]
-->

---

## 🗓️ 2026-02-22 — Lesson 07: Pure Frontend Projections Can Reuse Backend Tier Logic

**The Discovery**: The per-club DCP projections feature (#6) required zero backend changes. All data (`dcpGoals`, `membership`, `aprilRenewals`) was already surfaced via `analytics.allClubs` in the frontend. The tier thresholds from `ClubEligibilityUtils` could be duplicated as simple constants in a pure utility module, keeping the projection calculation entirely client-side.

**The Resulting Rule**: Before designing a backend API extension, verify whether the data is already available in existing frontend payloads. Pure frontend features ship faster and have simpler blast radius.

**Future Warning**: If the Toastmasters tier thresholds change, they must be updated in both `ClubEligibilityUtils.ts` (analytics-core) and `dcpProjections.ts` (frontend). Consider extracting thresholds into shared-contracts to avoid drift.

---

## 🗓️ 2026-02-22 — Lesson 06: Identify the Correct Component Before Writing Code

**The Discovery**: Issue #83 was about the _landing page_ (`LandingPage.tsx`) — the page with 15 region checkboxes and sort buttons. I incorrectly modified the _district detail page_'s `GlobalRankingsTab.tsx` instead, had to revert, and start over. Reading the issue carefully and matching UI elements (region checkboxes, sort buttons) to the correct component would have saved ~40 minutes.

**The Resulting Rule**: Before implementing any layout issue, open the live page, visually confirm which component owns the UI described in the issue, and trace that component in the codebase. Never assume from the issue title alone.

**Secondary Lesson**: When "above the fold" is the goal, prioritize content reordering and progressive disclosure (`<details>`) over size tweaks. Native HTML `<details>` provides collapse behavior with zero JS overhead and built-in accessibility.

---

## 🗓️ 2026-02-22 — Lesson 05: Sparse Input = Sparse Output in Pre-computed Analytics

**The Discovery**: The club-trends-index only had 2 data points per club because `AnalyticsComputeService` loads exactly 2 snapshots (current + previous year) for YoY computation. The `AnalyticsComputer` faithfully copies this sparsity into all derived data including club trends.

**The Scientific Proof**: Downloaded `district_61_club-trends-index.json` from GCS — all 167 clubs had exactly 2 `membershipTrend` points (Feb 2025 + Feb 2026), confirming the pipeline only uses 2 snapshots.

**The Farley Principle Applied**: Root cause analysis before implementing — the bug wasn't in the frontend or endpoint, but in the compute pipeline's input scope.

**The Resulting Rule**: When pre-computed data appears sparse, trace the sparsity back to the compute pipeline's input scope, not just the output format. The frontend and backend endpoints may be correct but starved of data.

**Future Warning**: Adding new snapshot-derived metrics? Check how many snapshots `AnalyticsComputeService.computeDistrictAnalytics` loads — the enrichment step at line ~894 now supplements this, but new features may need similar treatment.

---

## 🗓️ 2026-02-22 — Lesson 04: Summary vs Full Analytics Have Different Data Granularity

**The Discovery**: The membership badge on the Overview tab showed +61 instead of -66. Root cause: `DistrictOverview` called `/analytics` (which returns a **sparse 2-point** `membershipTrend` spanning Feb 2025 → Feb 2026), while the correct value came from `/analytics-summary` (134-point `trends.membership` scoped to Jul 2025 → Feb 2026). The two endpoints return the same field name but with vastly different data ranges and granularity.

**The Resulting Rule**: When a component needs derived values, always verify which API endpoint provides the data and whether the data range matches the intended scope (program year vs. calendar year). Never assume two endpoints with similar field names return equivalent data.

**Future Warning**: Any new component that derives statistics from trend data must confirm it's using the aggregated summary (program-year scoped) rather than the full analytics endpoint (which may span multiple years with sparse points).

---

## 🗓️ 2026-02-22 — Lesson 03: Date-Aware Charts Beat Index-Based Positioning

**The Discovery**: The Membership Trend chart positioned data points using array index (`index / (length - 1) * width`), making the x-axis span only the data range. With sparse data (e.g., 2 points), the chart showed "Feb 21 – Feb 21" with no program year context.

**The Fix**: Use `calculateProgramYearDay()` to map dates to their position within the July 1 – June 30 program year. This ensures the x-axis always represents the full 365-day program year, and data points cluster where they actually occurred in time.

**The Resulting Rule**: Time-series visualizations should always use date-based positioning, not array-index-based. Pair with reference lines for domain-significant dates to give users context about what happened when.

---

## 🗓️ 2026-02-22 — Lesson 02: Ephemeral Runners Need Explicit Cross-Date Data Syncs

**The Discovery**: The YoY comparison showed "No Historical Data" even though 9 years of snapshots existed in GCS. The `AnalyticsComputeService.computeDistrictAnalytics()` calls `loadDistrictSnapshot(previousYearDate)` from the local filesystem, but the ephemeral GitHub Actions runner only has today's scraped data. Previous year snapshots were never synced down.

**The Resulting Rule**: Any analytics computation that references data from a **different date** than the current run must have an explicit sync step in the pipeline. The time-series sync (Step 3) was already doing this correctly; the previous-year snapshot sync was simply missing.

**Future Warning**: When adding new cross-date analytics (e.g., multi-year trends, seasonal patterns), always verify the pipeline downloads the required historical data before compute. Check `AnalyticsComputeService` for any `loadDistrictSnapshot()` calls with non-current dates.

---

## 🗓️ 2026-02-22 — Lesson 01: Validation Gaps in Façade Layers

**The Discovery**: `SnapshotStore.hasDistrictInSnapshot` used `path.join` with raw `districtId` input, creating a path traversal vulnerability (CodeQL #57). The downstream modules (`SnapshotReader`, `SnapshotWriter`) already validated `districtId`, but the façade method bypassed them with inline `path.join`.

**The Scientific Proof**: A test with 7 malicious `districtId` values (e.g., `../../etc/passwd`) was not rejected — all resolved to `false` instead of throwing, proving the vulnerability existed.

**The Farley Principle Applied**: Defense in Depth. Validation must happen at every layer that constructs paths, not just internal modules.

**The Resulting Rule**: When a façade delegates to sub-modules, any method that constructs paths directly (rather than delegating) must also call the shared validation utilities (`validateDistrictId`, `resolvePathUnderBase`).

**Future Warning**: If a new method is added to `SnapshotStore` that accepts `districtId` or `snapshotId` and constructs paths inline, it must validate inputs. Audit all `path.join` calls using user-supplied values.
