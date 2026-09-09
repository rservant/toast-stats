# `2026-06-30-club-payments.json` — the double-counted snapshot, frozen

A byte-frozen reduction of the real `snapshots/2026-06-30/` directory, read
from `gs://toast-stats-data-ca` on 2026-08-31.

**Why it exists.** That directory holds 158 district files: the 128 districts
that existed at the 2025-26 close plus 30 renumbered PY 2026-27 districts a
rewrite stamped onto it (#1465). 4,673 clubs appear under two districts, so a
rollup that trusts the directory listing overcounts — and the CORRECT total has
an externally published expected value, which makes this a free regression case
(#1466):

| scope                                                           | payments    |
| --------------------------------------------------------------- | ----------- |
| The 128 districts `all-districts-rankings.json` lists (correct) | **548,483** |
| Naive sum over all 158 files                                    | 575,954     |

548,483 is the TI CEO Report's published 2025-26 membership-payments figure
(`docs/investigations/1426-ceo-report-data-coverage.md` §2), asserted in the
test via `CEO_REPORT_MEMBERSHIP_PAYMENTS` — the report is the source, not our
own output.

**Frozen on purpose.** #1465 leaves the archived directory as it is, and even
if it is ever corrected this fixture must not move: a guard whose expected
value depends on the archive being mutated is not a guard. Do not regenerate it
from the live bucket.

**Shape.** Reduced to what the rollup reads — nothing else:

```jsonc
{
  "snapshotDate": "2026-06-30",
  "rankingsDistrictIds": ["130", "109", ...],  // from all-districts-rankings.json
  "districts": [
    { "districtId": "01", "clubs": [["00000977", 42], ...] }  // [club id, payments]
  ]
}
```

`clubs` entries are `districtPerformance` rows: the club id **verbatim**
(padding preserved — it is what `normalizeClubId` exists to reconcile) and
`Total to Date`, which reconciles exactly with each district's
`totals.totalPayments`. District order is the directory's own file order, which
is what makes club-id deduplication alone order-dependent — see the test.

Excluded from Prettier (`.prettierignore`): reformatting a frozen capture would
triple its size and obscure any real diff.

---

## `2026-06-30-global-rollup.json` — the same directory, the whole rollup

A **sibling** capture of the same `snapshots/2026-06-30/` directory, read from
`gs://toast-stats-data-ca` on 2026-08-31 for #1498. Sibling rather than an
extension of the file above, because that one is frozen and stays byte-exact.

**Why it exists.** The worldwide scoreboard (`global-totals.json`, epic #1496)
is more than payments, and every one of its numbers has the same
double-counting hazard. This capture pins the whole table on the same hard
date. Live-verified values, all reproduced by
`scripts/lib/__tests__/globalTotals.test.ts`:

| metric                          | value                 |
| ------------------------------- | --------------------- |
| districts in the date's set     | 128 (127 + `U`)       |
| stray PY 2026-27 district files | 30 (excluded)         |
| clubs counted once              | 15,016                |
| membership payments             | **548,483**           |
| Active Members                  | 257,398               |
| paid clubs / active clubs       | 13,708 / 14,282       |
| distinguished or better         | 6,587                 |
| select / president's / Smedley  | 1,037 / 1,289 / 1,912 |
| derived base tier               | 2,349                 |
| distinguished districts         | 42                    |
| new clubs still active          | 932 (was 913, #1540)  |
| suspended clubs                 | 733 (was 716, #1540)  |
| countries / unknown country     | 94 / 6,786            |

548,483 and the four-way tier split are TI CEO Report figures — an external
oracle, not our own output. TI's 265,512 Mar-31 membership is a DIFFERENT
basis and is deliberately not asserted: the ruling is publish ours, state our
basis, never calibrate (#1426).

**The movement pair moved without the capture moving (#1540).** 913 and 716
were this fixture read through two `^`-anchored parsers that dropped the 19
rows carrying BOTH branches in one cell. Reading the same frozen bytes
correctly gives 932 and 733. TI publishes 932 and 733 for the same year —
noted here as corroboration found afterwards, never as a target. The #1426
ruling stands: had the two disagreed, ours would still be what we publish.
The prior reading of that gap ("our basis runs low, the expected shape") was
wrong; all of it was a parse defect.

**Shape.** A country dictionary plus the rankings rows verbatim, so the
distinguished-district calculator can be exercised on real inputs:

```jsonc
{
  "snapshotDate": "2026-06-30",
  "countries": ["United States", "China", ...],
  "rankings": [ /* all-districts-rankings.json rows, verbatim */ ],
  "districts": [
    {
      "districtId": "01",
      // [club id VERBATIM, Total to Date, Active Members,
      //  Charter Date/Suspend Date, index into `countries` (-1 = unmatched)]
      "clubs": [["00000977", 42, 20, "", 0], ...]
    }
  ]
}
```

`Active Members` is joined from `clubPerformance` and the country from
`clubs[].address.country` — three arrays inside one district file, joined on
the canonical club id. Frozen for the same reason as its sibling: do not
regenerate it from the live bucket.

---

# `suspension-column-census.json` — what ten year-ends carry in the Susp branch

A frozen capture of the `Charter Date/Suspend Date` column across **every**
in-scope district of **all ten** published program-year ends
(2017-06-30 → 2026-06-30), read from `https://cdn.taverns.red/snapshots/{date}/`
on 2026-09-01.

**Why it exists.** `v1/global-history.json` published `suspendedClubs: 0` for
eight of its ten years while `newClubsStillActive` stayed healthy in all ten
(#1514). This census settled which defect that was:

`Susp` rows counts every row carrying a parseable suspension date, in window
or not; the parenthesised figure is what the `^`-anchored parse saw before
#1540.

| year-end   | club rows | `Susp` rows           | `Charter` rows | published `suspendedClubs` |
| ---------- | --------- | --------------------- | -------------- | -------------------------- |
| 2026-06-30 | 15,016    | **735** (was 716)     | 932            | 716 ← undercount (#1540)   |
| 2025-06-30 | 15,261    | **0**                 | 951            | 0 ← absence                |
| 2024-06-30 | 15,679    | **0**                 | 958            | 0 ← absence                |
| 2023-06-30 | 16,203    | **0**                 | 817            | 0 ← absence                |
| 2022-06-30 | 17,033    | **1,023** (was 1,018) | 697            | 1,014 ← undercount (#1540) |
| 2021-06-30 | 18,798    | **0**                 | 1,224          | 0 ← absence                |
| 2020-06-30 | 18,337    | **0**                 | 1,236          | 0 ← absence                |
| 2019-06-30 | 18,402    | **0**                 | 1,496          | 0 ← absence                |
| 2018-06-30 | 18,125    | **0**                 | 1,481          | 0 ← absence                |
| 2017-06-30 | 17,690    | **0**                 | 1,539          | 0 ← absence                |

The eight zero years carry no suspension datum, while the charter branch of
the same column is populated on all ten. Absence, not zero — that half stands.

**Corrected 2026-09-09 (#1540).** This section used to claim "every row on
every date is exactly one of empty, `Charter …` or `Susp …` — there is no
third encoding anywhere, so the parse (#1497) was never the problem." A third
encoding does exist in this very capture: **19 rows at 2026-06-30 and 5 at
2022-06-30 carry BOTH branches in one cell** (`Charter 09/30/25 Susp
03/31/26`) — a club chartered and then suspended inside one program year,
which #1514 had ruled could not happen. Both `^`-anchored parsers dropped
those cells entirely, so on the two POPULATED dates the parse WAS the
problem, and both movement counts under-reported:

| year-end   | `newClubsStillActive` | `suspendedClubs`  |
| ---------- | --------------------- | ----------------- |
| 2026-06-30 | 913 → **932**         | 716 → **733**     |
| 2022-06-30 | 692 → **697**         | 1,014 → **1,019** |

The charter deltas (+19, +5) and the suspension deltas (+17, +5) differ at
2026-06-30 because two of those 19 suspensions are stamped `Susp 07/01/26` —
the NEXT program year. Both branches must be parsed AND each date
window-tested on its own; a combined cell is not a promise that its two dates
share a window.

The two populated dates also show why the presence signal must be
window-independent: 2022-06-30's 1,018 `Susp` rows include four stamped **July
2022**, after its own snapshot date (the later-rewrite shape of #1465). They
prove the branch was collected without being counted — which is what makes
that date's 1,014 a measurement.

**Frozen on purpose.** If TI ever backfills the missing years the artifact
should change and this fixture must not: a guard whose expected values move
with the archive is not a guard. Do not regenerate it from the live CDN.

**Shape.** Reduced to the column under test — rows with an EMPTY status field
are elided, because an empty field cannot carry a suspension date and keeping
15,000 `""` per date would quadruple the file for no assertion:

```jsonc
{
  "capturedAt": "2026-09-01",
  "source": "https://cdn.taverns.red/snapshots/{date}/ read 2026-09-01",
  "dates": [
    {
      "date": "2026-06-30",
      "rankingsDistrictIds": ["130", "109", ...], // all-districts-rankings.json
      "clubRowsInFiles": 15016,                   // BEFORE the elision
      "districtsMissingFiles": [],                // empty on all ten dates
      "districts": [
        // [club id VERBATIM, Charter Date/Suspend Date VERBATIM]
        { "districtId": "01", "clubs": [["00000977", " Susp 03/31/26"], ...] }
      ]
    }
  ]
}
```

Asserted by `scripts/lib/__tests__/globalRollupSuspensionColumn.test.ts`.
