# Sprint 20 Plan — Deep Linking & Navigation

**Planned start:** April 2026
**Theme:** Make every view shareable and bookmarkable

---

## Context

Sprint 19 shipped bug fixes (#277, #278), removed ~85K lines of dead code from the backend deletion, and cleaned up obsolete documentation. The codebase is now lean and accurate.

The main UX gap remaining is **deep linking** (#272). The `useUrlState` hook exists and 7 params are already synced (tab, sort, dir, page on ClubsTable; sort/dir/status/page on ClubPerformanceTable; rank metric on GlobalRankingsTab). But key state is still lost on navigation: program year, date selection, column filters, and DCP projections filters.

### Open Issues

| #    | Title                          | Labels               | Status                                 |
| ---- | ------------------------------ | -------------------- | -------------------------------------- |
| #277 | Data freshness banner bug      | bug                  | **Fixed in Sprint 19** — needs closing |
| #278 | CSV month-end detection bug    | —                    | **Fixed in Sprint 19** — needs closing |
| #272 | Deep links for full navigation | enhancement          | Partially done                         |
| #259 | PWA for offline field use      | needs-product-review | Deferred                               |
| #258 | Exportable PDF/CSV reports     | needs-product-review | Deferred                               |
| #257 | Weekly email digest            | needs-product-review | Deferred                               |
| #256 | Club comparison tool           | needs-product-review | Deferred                               |
| #255 | CDN cache monitoring           | observability        | Deferred                               |
| #253 | DORA metrics tracking          | observability        | Deferred                               |

---

## Sprint Goals

### 1. Close fixed issues (#277, #278)

**Priority: Housekeeping** — Both were fixed in Sprint 19 PR #279.

---

### 2. Deep link: program year and date selection (#272)

**Priority: High** — Currently stored only in React context/localStorage. Lost on page refresh when navigating directly to a URL.

- Sync `selectedProgramYear` to URL param `py` (e.g., `?py=2025-2026`)
- Sync `selectedDate` to URL param `date` (e.g., `?date=2026-03-25`)
- Remove localStorage persistence of program year (URL is the source of truth)
- Preserve both on browser back/forward navigation

**Scope:** `ProgramYearContext.tsx`, `DistrictDetailPage.tsx`
**Estimated:** 1 day

---

### 3. Deep link: ClubsTable column filters (#272)

**Priority: Medium** — Users can't share a filtered clubs view.

- Sync active column filters to URL (e.g., `?filter_health=vulnerable&filter_name=sunrise`)
- Use `useUrlState` for each filter that `useColumnFilters` manages
- Clear filters clears URL params

**Scope:** `useColumnFilters.ts`, `ClubsTable.tsx`, `ColumnHeader.tsx`
**Estimated:** 1-2 days

---

### 4. Deep link: DCP projections table filters (#272)

**Priority: Medium** — Tier/division/close-only filters are local state.

- Sync `filterTier`, `filterDivision`, `showCloseOnly` to URL params
- Sync sort state to URL params (prefixed to avoid collision with ClubsTable)

**Scope:** `DCPProjectionsTable.tsx`
**Estimated:** < 1 day

---

### 5. Graceful district coverage — landing page indicators

**Priority: Medium** — 6 of 128 districts have detailed analytics. No visual indicator on the landing page.

- Add icon/badge in rankings table for districts with detailed data
- Default untracked districts to Global Rankings tab on detail page
- Show banner: "Limited data. Global rankings are available."

**Estimated:** 1 day

---

## Deferred

| Item                            | Reason                                                             |
| ------------------------------- | ------------------------------------------------------------------ |
| **PWA (#259)**                  | Needs product review                                               |
| **PDF/CSV reports (#258)**      | Needs product review                                               |
| **Email digest (#257)**         | Needs product review                                               |
| **Club comparison (#256)**      | Needs product review                                               |
| **CDN cache monitoring (#255)** | Observability — no user-facing impact                              |
| **DORA metrics (#253)**         | Observability — no user-facing impact                              |
| **Route-based code splitting**  | Charts chunk is 119KB gzip but Lighthouse CI monitors this already |

---

## Success Criteria

- [ ] #277 and #278 closed on GitHub
- [ ] Program year and date selection preserved in URL
- [ ] ClubsTable filters preserved in URL
- [ ] DCP projections filters preserved in URL
- [ ] Shared URLs reproduce the exact view (tab, sort, page, filters, date)
- [ ] Browser back/forward preserves all state
- [ ] Rankings table indicates which districts have detailed analytics
