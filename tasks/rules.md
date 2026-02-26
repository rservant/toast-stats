# ⚡ Engineering Rules

<!-- Read this COMPLETELY before every task. Keep it under 60 seconds to read. -->
<!-- When you add a lesson to lessons.md, update this file if it changes a rule. -->
<!-- Ordered by blast radius: most dangerous mistakes first. -->

---

## 🔴 Never Do These

**R1 — Never bypass failing tests.**
`--no-verify`, `--skip-tests`, commenting out assertions, or pinning expectations to match a bug are all forbidden. If pre-existing tests are red, fix them before adding new code.

**R2 — Never assume data exists on the ephemeral runner.**
The GitHub Actions runner starts empty. Every piece of data a compute step needs must be explicitly synced from GCS first (snapshots, time-series, club-trends). "It works locally" does not count.

**R3 — Never infer context a parent already has.**
If a parent component manages program year, date range, or filter state, pass it as a prop. Never re-derive it from API response data inside a child component — the first data point's date is not the current year.

**R4 — Never use stdout for logs in a CLI.**
`console.log()` in shared package fallback loggers contaminates the JSON output that `| tee | jq` expects. All log levels go to `console.error()` (stderr). Stdout is for structured data only.

---

## 🟡 Always Do These Before Starting

**R5 — Read the last 5 entries in lessons.md before starting any task.**
`tail -n 120 tasks/lessons.md`

**R6 — Trace the actual call graph before refactoring.**
An issue description can overstate the problem. Before a cross-module consolidation, verify actual code overlap — not just similar names. Check whether `SnapshotBuilder` truly duplicates `DataTransformer` or just delegates to it.

**R7 — Inventory existing fields before designing new backend work.**
When a frontend feature needs "new" data, grep the existing types first. Pre-computed fields are often already computed, served, and typed — just not yet wired into the UI.

**R8 — When deleting a service, audit its entire write AND read path.**
`grep -r "ServiceName" .` including `.github/workflows/`. Removing a reader doesn't remove the writer. Removing a gate doesn't remove hidden secondary gates (e.g., `CollectorOrchestrator` validating against the same config file the pipeline was still reading).

---

## 🟢 Architecture Patterns That Are Proven Here

**R9 — Multi-run aggregation needs a persistent GCS-backed store, not history re-loading.**
Pattern: sync store from GCS → upsert today's data → save → push back. The `ClubTrendsStore` and `TimeSeriesIndexWriter` are reference implementations. "Load all history" approaches produce 1 data point on ephemeral runners.

**R10 — CSS-level overrides beat component-level changes for cross-cutting concerns.**
Dark mode, theme tokens, brand colors — override at `[data-theme='dark']` scope in CSS. But: Tailwind opacity-variant classes (`-80`, `-70`) bake in hardcoded `rgba()` and must also be overridden explicitly.

**R11 — Insert into existing filter pipelines, don't replace.**
`original → filtered → searchFiltered → sorted` is correct. Adding a new filter is a new step, not a replacement of an existing one. Keeps existing test coverage intact.

**R12 — Batch independent, same-breakpoint CSS fixes.**
When multiple issues touch the same root cause (e.g., responsive table at 375px), write all failing tests first, apply all fixes, verify once. This is not batching unrelated changes — it's one logical fix at one level.

---

## ⚠️ Active Tripwires

- `SnapshotBuilder.build()` has **two** district-tracking code paths (success + validation-failure). Changing district discovery must update both.
- DCP goals are **independent** (not sequential). Never approximate `dcpGoals` count as Goals 1-N achieved in order. Use `clubPerformance` raw fields.
- Any chart with `|| 1` range fallback is a y-axis inversion bug waiting to happen. Pad symmetrically when `range === 0`.
- Tailwind opacity variants (`text-tm-*-80`) don't inherit CSS variable overrides. Audit on every new brand token.
- `Path.join()` with raw user input = path traversal. Always call `validateDistrictId()` before constructing paths from request params.
