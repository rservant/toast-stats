# 📚 Lessons Learned

<!-- Each lesson follows this structure. Newest entries go at the top. -->
<!-- The agent reads the last 5 entries before starting any task. -->

<!--
## 🗓️ [YYYY-MM-DD] — Lesson NN: [Title]

**The Discovery**: [What unexpected behavior or coupling was found]

**The Scientific Proof**: [How the hypothesis was tested — link to experiment if applicable]

**The Farley Principle Applied**: [Which engineering principle this reinforces]

**The Resulting Rule**: [The new rule or constraint going forward]

**Future Warning**: [What to watch for — a tripwire for the agent]
-->

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

---

## 🗓️ 2026-02-22 — Lesson 03: Date-Aware Charts Beat Index-Based Positioning

**The Discovery**: The Membership Trend chart positioned data points using array index (`index / (length - 1) * width`), making the x-axis span only the data range. With sparse data (e.g., 2 points), the chart showed "Feb 21 – Feb 21" with no program year context.

**The Fix**: Use `calculateProgramYearDay()` to map dates to their position within the July 1 – June 30 program year. This ensures the x-axis always represents the full 365-day program year, and data points cluster where they actually occurred in time.

**The Resulting Rule**: Time-series visualizations should always use date-based positioning, not array-index-based. Pair with reference lines for domain-significant dates to give users context about what happened when.

**Future Warning**: If a new method is added to `SnapshotStore` that accepts `districtId` or `snapshotId` and constructs paths inline, it must validate inputs. Audit all `path.join` calls using user-supplied values.
