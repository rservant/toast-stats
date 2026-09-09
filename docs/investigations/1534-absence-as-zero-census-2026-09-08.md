# Absence-as-zero census — archive sweep, 2026-09-08

**Issue:** [#1534](https://github.com/taverns-red/toast-stats/issues/1534) ·
**Tool:** `scripts/absence-as-zero-census.ts` + `scripts/lib/absenceAsZeroCensus.ts` ·
**Scope:** read-only. Nothing was written to GCS and no workflow was dispatched.

## What was swept

Every snapshot date in `gs://toast-stats-data-ca/snapshots/` — **181 dates**,
2017-01-31 → 2026-09-07 — read one date at a time (sync → measure → delete),
covering every `district_NN.json` at each date. Five populations per date: the
typed `clubs[]` array, the three raw arrays (`clubPerformance`,
`districtPerformance`, `divisionPerformance`) and the per-district `totals`
block.

**113 fields × 181 dates = 20,453 measurements.**

| verdict             | count  | meaning                                                                                |
| ------------------- | ------ | -------------------------------------------------------------------------------------- |
| `populated`         | 14,559 | at least one row carries a non-zero value                                              |
| `suspected-absence` | 4,218  | **finding** — nothing in the population carries the field                              |
| `all-zero-carried`  | 952    | the field is carried and measures zero: a measured zero                                |
| `no-signal`         | 724    | zero at every date — a true constant is indistinguishable from a never-collected field |

The 4,218 findings collapse into **55 contiguous absence runs across 37
fields** — an era-wide column gap produces one run, not one finding per date,
which is the shape that makes them readable.

## How a real zero is kept out of the findings

Every measurement carries three numbers, not two:

- `rowsTotal` — the population at that date
- `rowsCarryingField` — rows carrying **any** parseable value, zero included
- `rowsNonZero` — rows carrying a non-zero value

`rowsCarryingField` is the presence signal and it is deliberately **wider than
the count it guards** (the #1514 design). A field carried on every row that
measures zero everywhere is `all-zero-carried` — a measured zero, never a
defect claim. Only a field that **nothing** carries, at a population above the
census floor, where the field is non-zero somewhere else in the archive, is a
`suspected-absence`.

That distinction is load-bearing, not decorative. `clubs.aprilRenewals` is
zero for every club in the world at a September month-end; a rule keyed on
"all zero above the floor" would report 952 measured zeros as defects. The
biggest block of them is the distinguished-club tier counts, which are
genuinely zero on all 125 pre-April dates in the archive because TI does not
assign tiers until the year closes.

### Floor calibration, measured not assumed

`CENSUS_ROW_FLOOR = 50` is reused from #1501. The archive's smallest observed
populations, per population type:

| population          | smallest observed | at date    |
| ------------------- | ----------------- | ---------- |
| clubPerformance     | 14,287            | 2026-07-26 |
| clubs               | 14,287            | 2026-07-26 |
| districtPerformance | 14,288            | 2026-07-26 |
| divisionPerformance | 14,288            | 2026-07-26 |
| totals              | 94                | 2026-07-26 |

Every real population clears the floor by 2 to 285×, so the floor excludes a
partial sync without ever suppressing a real date.

## Ground truth: the census rediscovers #1514 unaided

Run over the ten program-year-end snapshots, the census flags the `Susp`
branch of `Charter Date/Suspend Date` as `suspected-absence` on exactly the
eight years #1514 found, and `populated` on exactly the two it did not:

| PY-end         | `[Susp]` verdict    | `[Charter]` verdict | #1514 published `suspendedClubs` |
| -------------- | ------------------- | ------------------- | -------------------------------- |
| 2017-06-30     | `suspected-absence` | `populated`         | null                             |
| 2018-06-30     | `suspected-absence` | `populated`         | null                             |
| 2019-06-30     | `suspected-absence` | `populated`         | null                             |
| 2020-06-30     | `suspected-absence` | `populated`         | null                             |
| 2021-06-30     | `suspected-absence` | `populated`         | null                             |
| **2022-06-30** | **`populated`**     | `populated`         | **1014**                         |
| 2023-06-30     | `suspected-absence` | `populated`         | null                             |
| 2024-06-30     | `suspected-absence` | `populated`         | null                             |
| 2025-06-30     | `suspected-absence` | `populated`         | null                             |
| **2026-06-30** | **`populated`**     | `populated`         | **716**                          |

Ten for ten, on both branches, from population counts alone — the census was
given no knowledge of #1514. The same signature appears at month granularity
across the full archive as two runs: 2017-01-31 → 2021-06-30 (54 dates) and
2022-07-31 → 2025-06-30 (36 dates).

And it does **not** flag `clubs.newMembers`, `clubs.octoberRenewals` or
`clubs.aprilRenewals` at 2017-06-30, the control the issue named: all three
are `populated`.

### The first run did not find it — and that is the most useful thing here

The census's first archive run flagged nothing on the `Susp` branch, because
the branch tokenizer required a cell to be exactly two tokens. Live cells are
not: 19 rows at 2026-06-30 and 5 at 2022-06-30 carry
`Charter 09/30/25 Susp 03/31/26` — a club chartered and suspended inside one
program year. Those cells failed the "is this a branch encoding" test, which
switched branch detection off for the **whole column**, which dropped it out
of the census entirely, silently.

The detector built to find silent narrowing had silently narrowed itself. The
fix (`parseBranchTokens` + a 95% dominance rule instead of purity) is in
`scripts/lib/absenceAsZeroCensus.ts` and pinned by tests. It is also why the
ground-truth check had to be an acceptance criterion rather than a closing
sanity check.

## Findings

Two filed as their own issues, one recorded and not filed. This issue fixes
none of them — a sweep that finds five things is worth more than one fix that
muddies what the sweep proved.

### 1. DCP goals 5 and 6 have no matching header for PY 2020-21 … 2024-25 — `dcpGoalsAchieved` is absent from nine of ten program years

**Filed as [#1539](https://github.com/taverns-red/toast-stats/issues/1539).**

**The strongest finding, and squarely the #1399 class.** TI renamed the
education-award columns twice; `DCP_GOAL_DEFINITIONS`
(`packages/analytics-core/src/analytics/dcpGoalDefinitions.ts`) follows the
current and the oldest names but not the middle era's.

| era               | header in the CSV                                      | goal 5 alias present? | goal 6 alias present? |
| ----------------- | ------------------------------------------------------ | --------------------- | --------------------- |
| 2017-01 → 2020-06 | `Level 4s` / `Level 5s`                                | yes (`Level 4s`)      | **no column exists**  |
| 2020-07 → 2025-06 | `Level 4s, Level 5s, or DTM award` / `Add. …`          | **no**                | **no**                |
| 2025-07 → now     | `Level 4s, Path Completions, or DTM Awards` / `Add. …` | yes                   | yes                   |

Verified live on district 61 (`missingDcpGoalHeaders` run against archived
records):

```
2017-06-30 | missingGoals: [6]   | hasDcpGoalColumns: false | clubs w/ dcpGoalsAchieved: 0/207
2020-06-30 | missingGoals: [6]   | hasDcpGoalColumns: false | 0/202
2020-07-31 | missingGoals: [5,6] | hasDcpGoalColumns: false | 0/202
2023-06-30 | missingGoals: [5,6] | hasDcpGoalColumns: false | 0/181
2025-06-30 | missingGoals: [5,6] | hasDcpGoalColumns: false | 0/170
2025-07-31 | missingGoals: []    | hasDcpGoalColumns: true  | 0/164
2026-06-30 | missingGoals: []    | hasDcpGoalColumns: true  | 164/164
```

The #1399 all-ten-goals guard worked exactly as designed — this degrades to
`dcpGoalsAchieved: undefined`, **not** to a phantom zero, so nothing false was
ever published. But consumers then fall back to the sequential approximation
the tripwire forbids, and five program years of per-goal data that is sitting
in the archive is unreachable for want of two alias strings.

### 2. A cell carrying both branches loses **both** — 19 charters and 17 suspensions invisible at 2026-06-30

**Filed as [#1540](https://github.com/taverns-red/toast-stats/issues/1540).**

`parseCharterDateFromStatusField` and `parseSuspendDateFromStatusField`
(`packages/analytics-core/src/rankings/programYearDates.ts`) both anchor at
`^`. Against a combined cell, neither matches:

```
"Charter 09/30/25 Susp 03/31/26" → charter: null | susp: null
"Susp 03/31/26"                  → charter: null | susp: 2026-03-31
"Charter 09/30/25"               → charter: 2025-09-30 | susp: null
```

Measured over district-deduplicated `districtPerformance` rows at 2026-06-30
(14,887 distinct clubs): 709 anchored `Susp` cells, **19 more carrying a
`Susp` date behind a leading `Charter`**, 17 of them inside the PY 2025-26
window; all 19 also lose their charter date, every one of which is in-window.
So `suspendedClubs` and `newClubsStillActive` both under-report for the live
program year. 2022-06-30 carries 5 such cells.

This is the same class one layer over: not a missing column, a present fact
made unreadable by a parse that assumed one branch per cell.

**Status (2026-09-09): fixed by #1540.** Each branch is now matched as a whole
word anywhere in the cell, capturing exactly one token
(`/(?:^|\s)Susp\s+(\S+)/i` and its `Charter` twin). Corrected counts on the
frozen captures: 2026-06-30 **913 → 932** new-still-active and **716 → 733**
suspended; 2022-06-30 **692 → 697** and **1,014 → 1,019**. The two deltas
differ at 2026-06-30 because two of the 19 recovered suspensions are stamped
`Susp 07/01/26` — the next program year — so each date is window-tested on its
own. The corrected 2026-06-30 pair lands exactly on TI's published 932/733,
noted as corroboration and not as a target (#1426 ruling 2 is unchanged).

**Republish decision (operator, pending):** the fix changes only the READING
of stored rows — no snapshot is rewritten and nothing was dispatched with the
code change. Two published artifacts carry the old numbers and need a rebuild
before the corrected counts are visible:

| artifact                                                   | affected                                               |
| ---------------------------------------------------------- | ------------------------------------------------------ |
| `v1/global-history.json`                                   | PY 2025-26 and PY 2021-22 rows (both movement fields)  |
| `v1/global-totals.json`                                    | the live program year's `clubMovement` block           |
| per-district rankings `newCharteredClubs`/`suspendedClubs` | any district holding one of the 24 combined-cell clubs |

The eight absent years are untouched: they carry no combined cell, so their
`null` is unchanged.

### 3. Single-date anomaly — `totals.smedleyDistinguishedClubs` missing at 2026-04-10

The key is absent from the `totals` block of all 128 districts at 2026-04-10
and present on every other date in the archive, including 2026-03-31 and
2026-04-29 either side of it. The sibling tier counts are present-but-zero at
that date, which is seasonally normal (2026-04-29 is the first date they
populate). Most likely a snapshot written by a pre-#1409 build during a
backfill rather than a live defect — recorded here, not filed, because a
single date with an explicable cause does not warrant an issue on its own.

## Flagged but genuine — where the census is honestly wrong

Reported so the tool is not trusted further than it earns.

- **`Charter Date/Suspend Date[Charter]` at 2017-07-31 (one date).** The
  column exists across all 16,997 rows and is empty in every one of them: it
  is the first month-end of a program year and no club had chartered or been
  suspended yet. For a branch field the presence signal collapses onto the
  branch itself, so "no events this month" and "the branch was not collected"
  are the same measurement. A real zero, flagged.
- **`clubPerformance.` (the empty header) absent from 2020-07-31 onward.** A
  trailing-comma artifact in the pre-2020 CSV export that TI cleaned up. Not a
  metric, never consumed.
- **Find-a-Club enrichment fields** (`email`, `phone`, `website`,
  `facebookLink`, `meetingDay`, `meetingTime`, `charterDate`, on both `clubs`
  and `clubPerformance`) are absent for every date before 2026-06-10 and for
  2026-07-26 → 2026-07-29. Correct: the FAC merge is a recent feature, and the
  July gap is the program-year rollover before the first merge of the new
  year. They surface at all only because a handful of phone numbers parse as
  integers.
- **Pathways-era column replacements** — `CCs`, `ACs`, `CL/AL/DTMs` and their
  `Add.` siblings ending at 2020-07-31; `Level 2s` ↔ `Level 2s or EOM`
  swapping at 2026-06-30 (#1399); `Net Growth` starting 2025-07-31. Each is a
  retired or introduced column whose replacement is populated, which is what
  the coverage table is for: the successor's run is `.` exactly where the
  predecessor's is `X`.

## Every absence run in the sweep

`from`/`to` are inclusive snapshot dates; `dates` counts the snapshot dates in
the run; `rowsTotal` is the population at the run's first date.

| field                                                         | from       | to         | dates | rowsTotal |
| ------------------------------------------------------------- | ---------- | ---------- | ----- | --------- |
| clubPerformance.                                              | 2020-07-31 | 2026-09-07 | 139   | 17599     |
| clubPerformance.ACs                                           | 2020-07-31 | 2026-09-07 | 139   | 17599     |
| clubPerformance.Add. ACs                                      | 2020-07-31 | 2026-09-07 | 139   | 17599     |
| clubPerformance.Add. CCs                                      | 2020-07-31 | 2026-09-07 | 139   | 17599     |
| clubPerformance.Add. CL/AL/DTMs                               | 2020-07-31 | 2026-09-07 | 139   | 17599     |
| clubPerformance.Add. Level 2s                                 | 2026-07-26 | 2026-09-07 | 30    | 14287     |
| clubPerformance.Add. Level 2s or EOM                          | 2017-01-31 | 2026-06-29 | 150   | 17192     |
| clubPerformance.Add. Level 4s, Level 5s, or DTM award         | 2017-01-31 | 2020-06-30 | 42    | 17192     |
| clubPerformance.Add. Level 4s, Level 5s, or DTM award         | 2025-07-31 | 2026-09-07 | 79    | 14482     |
| clubPerformance.Add. Level 4s, Path Completions, or DTM award | 2017-01-31 | 2025-06-30 | 102   | 17192     |
| clubPerformance.CCs                                           | 2020-07-31 | 2026-09-07 | 139   | 17599     |
| clubPerformance.charterDate                                   | 2017-01-31 | 2026-06-09 | 130   | 17192     |
| clubPerformance.charterDate                                   | 2026-07-26 | 2026-07-29 | 4     | 14287     |
| clubPerformance.CL/AL/DTMs                                    | 2020-07-31 | 2026-09-07 | 139   | 17599     |
| clubPerformance.email                                         | 2017-01-31 | 2026-06-09 | 130   | 17192     |
| clubPerformance.email                                         | 2026-07-26 | 2026-07-29 | 4     | 14287     |
| clubPerformance.facebookLink                                  | 2017-01-31 | 2026-06-09 | 130   | 17192     |
| clubPerformance.facebookLink                                  | 2026-07-26 | 2026-07-29 | 4     | 14287     |
| clubPerformance.Level 2s                                      | 2026-07-26 | 2026-09-07 | 30    | 14287     |
| clubPerformance.Level 2s or EOM                               | 2017-01-31 | 2026-06-29 | 150   | 17192     |
| clubPerformance.Level 4s                                      | 2020-07-31 | 2026-09-07 | 139   | 17599     |
| clubPerformance.Level 4s, Level 5s, or DTM award              | 2017-01-31 | 2020-06-30 | 42    | 17192     |
| clubPerformance.Level 4s, Level 5s, or DTM award              | 2025-07-31 | 2026-09-07 | 79    | 14482     |
| clubPerformance.Level 4s, Path Completions, or DTM Awards     | 2017-01-31 | 2025-06-30 | 102   | 17192     |
| clubPerformance.Level 5s                                      | 2020-07-31 | 2026-09-07 | 139   | 17599     |
| clubPerformance.meetingDay                                    | 2017-01-31 | 2026-06-09 | 130   | 17192     |
| clubPerformance.meetingDay                                    | 2026-07-26 | 2026-07-29 | 4     | 14287     |
| clubPerformance.meetingTime                                   | 2017-01-31 | 2026-06-09 | 130   | 17192     |
| clubPerformance.meetingTime                                   | 2026-07-26 | 2026-07-29 | 4     | 14287     |
| clubPerformance.Net Growth                                    | 2017-01-31 | 2025-06-30 | 102   | 17192     |
| clubPerformance.phone                                         | 2017-01-31 | 2026-06-09 | 130   | 17192     |
| clubPerformance.phone                                         | 2026-07-26 | 2026-07-29 | 4     | 14287     |
| clubPerformance.website                                       | 2017-01-31 | 2026-06-09 | 130   | 17192     |
| clubPerformance.website                                       | 2026-07-26 | 2026-07-29 | 4     | 14287     |
| clubs.charterDate                                             | 2017-01-31 | 2026-06-09 | 130   | 16776     |
| clubs.charterDate                                             | 2026-07-26 | 2026-07-29 | 4     | 14287     |
| clubs.email                                                   | 2017-01-31 | 2026-06-09 | 130   | 16776     |
| clubs.email                                                   | 2026-07-26 | 2026-07-29 | 4     | 14287     |
| clubs.facebookLink                                            | 2017-01-31 | 2026-06-09 | 130   | 16776     |
| clubs.facebookLink                                            | 2026-07-26 | 2026-07-29 | 4     | 14287     |
| clubs.meetingDay                                              | 2017-01-31 | 2026-06-09 | 130   | 16776     |
| clubs.meetingDay                                              | 2026-07-26 | 2026-07-29 | 4     | 14287     |
| clubs.meetingTime                                             | 2017-01-31 | 2026-06-09 | 130   | 16776     |
| clubs.meetingTime                                             | 2026-07-26 | 2026-07-29 | 4     | 14287     |
| clubs.phone                                                   | 2017-01-31 | 2026-06-09 | 130   | 16776     |
| clubs.phone                                                   | 2026-07-26 | 2026-07-29 | 4     | 14287     |
| clubs.website                                                 | 2017-01-31 | 2026-06-09 | 130   | 16776     |
| clubs.website                                                 | 2026-07-26 | 2026-07-29 | 4     | 14287     |
| districtPerformance.Charter Date/Suspend Date[Charter]        | 2017-07-31 | 2017-07-31 | 1     | 16997     |
| districtPerformance.Charter Date/Suspend Date[Susp]           | 2017-01-31 | 2021-06-30 | 54    | 17096     |
| districtPerformance.Charter Date/Suspend Date[Susp]           | 2022-07-31 | 2025-06-30 | 36    | 16048     |
| divisionPerformance.Charter Date/Suspend Date[Charter]        | 2017-07-31 | 2017-07-31 | 1     | 16997     |
| divisionPerformance.Charter Date/Suspend Date[Susp]           | 2017-01-31 | 2021-06-30 | 54    | 17096     |
| divisionPerformance.Charter Date/Suspend Date[Susp]           | 2022-07-31 | 2025-06-30 | 36    | 16048     |
| totals.smedleyDistinguishedClubs                              | 2026-04-10 | 2026-04-10 | 1     | 128       |

## Reproducing

```bash
# read-only; needs GCS read access to the snapshot archive
gcloud storage cp "gs://toast-stats-data-ca/snapshots/<date>/district_*.json" ./cache/snapshots/<date>/
npx tsx scripts/absence-as-zero-census.ts measure --cache-dir ./cache --out ./census-stats
npx tsx scripts/absence-as-zero-census.ts report --stats-dir ./census-stats
```

`measure` is idempotent per date and reduces a ~78 MB snapshot date to a few
hundred KB of counters, so a full-archive sweep streams one date at a time
rather than needing ~14 GB on disk. `report` exits 1 when anything is
`suspected-absence`.

## Limitations worth knowing before trusting a clean run

- **A column that never appears anywhere in the archive is invisible.** It is
  `no-signal` by construction and is not even emitted as a field. Goal 6's
  `Add. Level 4s` alias, which matches no archived header in any era, would
  never have been found by the census alone — it took joining the census to
  `missingDcpGoalHeaders`. A census can only see fields that exist somewhere.
- **The census reads snapshots, not the CSVs behind them.** A column dropped
  before the snapshot was written is indistinguishable from one TI never sent.
- **Per-branch presence is the count.** For a branch field there is no signal
  wider than the branch itself, so a period with genuinely no events reads as
  an absence (the 2017-07-31 case above).
