/**
 * The suspension column, as ten published year-ends actually carry it (#1514).
 *
 * `v1/global-history.json` published `suspendedClubs: 0` for eight of its ten
 * program years while `newClubsStillActive` stayed healthy in every one of
 * them. The census below is the evidence that settled which defect that was:
 * the eight zero years carry **no `Susp` value on any districtPerformance row
 * of any in-scope district** — 0 of 15,261 rows at 2025-06-30, 0 of 16,203 at
 * 2023-06-30, and so on — while the CHARTER branch of the very same
 * `Charter Date/Suspend Date` column is populated on all ten dates. For those
 * eight years the datum is absent, and absence is not zero.
 *
 * **Overturned in part by #1540.** "The parse was right" held only for the
 * eight empty years. On the two POPULATED dates the parse was wrong: 19 rows
 * at 2026-06-30 and 5 at 2022-06-30 carry BOTH branches in one cell
 * (`Charter 09/30/25 Susp 03/31/26`), and both `^`-anchored parsers dropped
 * them, so each of those dates under-reported BOTH movement counts. The
 * expected values below are the corrected measurement, taken from the same
 * frozen capture — the fixture never moved, the reading of it did.
 *
 * These assertions run against a frozen capture, never the network. See the
 * fixture README for its shape and why it must not be regenerated.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  rollUpGlobal,
  type GlobalRollup,
} from '../../../packages/analytics-core/src/rollup/globalRollup.js'

interface Census {
  readonly capturedAt: string
  readonly source: string
  readonly dates: ReadonlyArray<{
    readonly date: string
    readonly rankingsDistrictIds: string[]
    readonly clubRowsInFiles: number
    readonly districtsMissingFiles: string[]
    readonly districts: Array<{
      readonly districtId: string
      /** `[club id, Charter Date/Suspend Date]`, non-empty values only. */
      readonly clubs: Array<[string, string]>
    }>
  }>
}

const census = JSON.parse(
  readFileSync(
    join(
      __dirname,
      'fixtures',
      'global-rollup',
      'suspension-column-census.json'
    ),
    'utf-8'
  )
) as Census

const byDate = new Map(census.dates.map(entry => [entry.date, entry]))

function rollup(date: string): GlobalRollup {
  const entry = byDate.get(date)
  if (!entry) throw new Error(`no captured census for ${date}`)
  return rollUpGlobal({
    snapshotDate: date,
    rankingsDistrictIds: entry.rankingsDistrictIds,
    districts: entry.districts.map(d => ({
      districtId: d.districtId,
      clubs: d.clubs.map(([clubId, clubStatusField]) => ({
        clubId,
        payments: 0,
        clubStatusField,
      })),
    })),
  })
}

/** The eight years `global-history.json` published as a literal 0. */
const YEARS_WITH_NO_SUSPENSION_DATA = [
  '2025-06-30',
  '2024-06-30',
  '2023-06-30',
  '2021-06-30',
  '2020-06-30',
  '2019-06-30',
  '2018-06-30',
  '2017-06-30',
] as const

/**
 * The two years whose Susp branch was collected, with their CORRECTED counts
 * (#1540) — the anchored parse published 716 and 1014 respectively, losing
 * every suspension that sat behind a leading `Charter` in the same cell.
 */
const YEARS_WITH_SUSPENSION_DATA = [
  ['2026-06-30', 733],
  ['2022-06-30', 1019],
] as const

describe('the published year-ends’ suspension column (#1514)', () => {
  it('captured every district the ten dates’ rankings list', () => {
    for (const entry of census.dates) {
      expect(entry.districtsMissingFiles).toEqual([])
      expect(entry.districts).toHaveLength(entry.rankingsDistrictIds.length)
    }
  })

  it.each(YEARS_WITH_NO_SUSPENSION_DATA)(
    '%s carries no Susp value at all, so suspendedClubs is null',
    date => {
      const result = rollup(date)

      expect(result.clubsWithSuspensionDate).toBe(0)
      expect(result.suspendedClubs).toBeNull()
      // Not an empty directory and not an empty column: the CHARTER branch of
      // the same field is populated, which is what makes the missing Susp
      // branch a collection gap rather than a quiet year.
      expect(result.newClubsStillActive).toBeGreaterThan(0)
    }
  )

  it.each(YEARS_WITH_SUSPENSION_DATA)(
    '%s keeps its measured count of %i',
    (date, expected) => {
      const result = rollup(date)

      expect(result.clubsWithSuspensionDate).toBeGreaterThan(0)
      expect(result.suspendedClubs).toBe(expected)
    }
  )

  it('counts only in-window suspensions on a date whose column is populated', () => {
    // 2022-06-30 carries four Susp rows stamped JULY 2022 — after its own
    // snapshot date, the later-rewrite shape of #1465. They prove the branch
    // was collected without being counted, which is exactly why the presence
    // signal is window-independent and the count is not.
    const result = rollup('2022-06-30')

    expect(result.clubsWithSuspensionDate).toBe(1023)
    expect(result.suspendedClubs).toBe(1019)
  })

  describe('cells carrying both branches (#1540)', () => {
    // Counted straight off the frozen capture: the rows whose single
    // `Charter Date/Suspend Date` cell holds a Charter stamp AND a Susp
    // stamp. Both `^`-anchored parsers dropped every one of them, so each
    // was invisible to BOTH counts.
    const bothBranchRows = (date: string) =>
      (byDate.get(date)?.districts ?? []).flatMap(d =>
        d.clubs.filter(
          ([, value]) =>
            /(?:^|\s)Charter\s/i.test(value) && /\sSusp\s/i.test(value)
        )
      )

    it('the capture really carries them — 19 at 2026-06-30, 5 at 2022-06-30', () => {
      expect(bothBranchRows('2026-06-30')).toHaveLength(19)
      expect(bothBranchRows('2022-06-30')).toHaveLength(5)
    })

    it('recovers 19 charters and 17 suspensions at 2026-06-30', () => {
      const result = rollup('2026-06-30')

      // 913 → 932 and 716 → 733. Every one of the 19 charter dates is in
      // window; two of the 19 suspension dates are not (`Susp 07/01/26` is
      // the next program year), which is why the two deltas differ — each
      // date is window-tested on its own.
      expect(result.newClubsStillActive).toBe(932)
      expect(result.suspendedClubs).toBe(733)
      // Window-independent, so it takes all 19 (#1514).
      expect(result.clubsWithSuspensionDate).toBe(735)
    })

    it('recovers 5 charters and 5 suspensions at 2022-06-30', () => {
      const result = rollup('2022-06-30')

      expect(result.newClubsStillActive).toBe(697)
      expect(result.suspendedClubs).toBe(1019)
    })

    it('leaves the eight absent years untouched — they carry no such cell', () => {
      for (const date of YEARS_WITH_NO_SUSPENSION_DATA) {
        expect(bothBranchRows(date)).toHaveLength(0)
      }
    })
  })
})
