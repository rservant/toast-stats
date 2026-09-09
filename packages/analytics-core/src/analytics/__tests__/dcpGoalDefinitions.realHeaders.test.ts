/**
 * Captured-header tests for the DCP goal columns (#1399, #1539).
 *
 * TI has renamed the club-performance education columns three times, and
 * every rename resolves by exact key lookup — so a rename we do not carry an
 * alias for reads as "this export has no goal columns" for every club in
 * every district until someone notices. #1399 was one such rename caught in
 * weeks; #1539 was the next one back, unnoticed for five program years.
 *
 * Synthetic fixtures validate the code; only a captured real export validates
 * the policy (Lesson 154). `HEADER_ERAS` below is the census of every header
 * era the published archive actually contains, each pinned to a real District
 * 61 export, and the exhaustiveness test makes adding an era a deliberate act
 * rather than something a future reader has to infer.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ScrapedRecord } from '@taverns-red/shared-contracts'
import {
  DCP_GOAL_DEFINITIONS,
  computeDcpGoalsAchieved,
  hasDcpGoalColumns,
  missingDcpGoalHeaders,
  readDcpGoalColumn,
  type DcpGoalColumn,
} from '../dcpGoalDefinitions.js'

const FIXTURE_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'transformation',
  '__tests__',
  'fixtures'
)

/**
 * Load a captured club-performance export as records. TI appends a two-cell
 * "Month of …, As of …" footer row to the CSV; the collector's parser drops
 * short rows, so drop it here too rather than emit a junk record.
 */
const loadRecords = (capture: string): ScrapedRecord[] => {
  const rows = JSON.parse(
    readFileSync(join(FIXTURE_DIR, capture, 'club-performance.json'), 'utf-8')
  ) as string[][]
  const header = rows[0]!
  return rows
    .slice(1)
    .filter(row => row.length === header.length)
    .map(
      row =>
        Object.fromEntries(
          header.map((key, index) => [key, row[index] ?? ''])
        ) as ScrapedRecord
    )
}

const goalColumn = (goalNumber: number): DcpGoalColumn =>
  DCP_GOAL_DEFINITIONS.find(d => d.goal === goalNumber)!.requirements[0]!
    .anyOf[0]!

const tally = (records: ScrapedRecord[], column: DcpGoalColumn) => {
  const values = records.map(record => readDcpGoalColumn(record, column))
  return {
    awards: values.reduce((sum, value) => sum + value, 0),
    clubs: values.filter(value => value > 0).length,
  }
}

/** How many of the ten goals a record's own columns say it achieved. */
const goalsAchievedCount = (record: ScrapedRecord): number =>
  computeDcpGoalsAchieved(record).filter(Boolean).length

/**
 * Every club-performance header era in the published archive, newest first.
 *
 * Swept 2026-09-09 over all 182 snapshot dates on cdn.taverns.red
 * (`snapshots/<date>/district_61.json` → `data.clubPerformance`); the header
 * set changes at exactly three dates and is identical across districts at
 * each of them (spot-checked on districts 21, 42, 116 and Undistricted).
 *
 * `missingGoals` is what `missingDcpGoalHeaders` must return for that era —
 * `[]` for every era whose export actually carries the ten-goal Pathways DCP,
 * and a documented non-empty list where the era's rules genuinely differ.
 */
const HEADER_ERAS = [
  {
    capture: 'd61-2026-08-01',
    span: '2026-07-26 → now (PY 2026-27)',
    goal5Header: 'Level 4s, Path Completions, or DTM Awards',
    goal6Header: 'Add. Level 4s, Path Completions, or DTM award',
    missingGoals: [] as number[],
    note: 'goals 2-3 renamed to "… or EOM" (#1399); education columns unchanged',
  },
  {
    capture: 'd61-2026-06-09',
    span: '2025-07-31 → 2026-06-30 (PY 2025-26)',
    goal5Header: 'Level 4s, Path Completions, or DTM Awards',
    goal6Header: 'Add. Level 4s, Path Completions, or DTM award',
    missingGoals: [] as number[],
    note: '"Level 5s" became "Path Completions" in both education columns',
  },
  {
    capture: 'd61-2025-06-30',
    span: '2020-07-31 → 2025-06-30',
    goal5Header: 'Level 4s, Level 5s, or DTM award',
    goal6Header: 'Add. Level 4s, Level 5s, or DTM award',
    missingGoals: [] as number[],
    note: 'the five program years #1539 restored — no alias existed for either column',
  },
  {
    capture: 'd61-2020-06-30',
    span: 'archive start (2017-01-31) → 2020-06-30',
    goal5Header: 'Level 4s',
    goal6Header: null,
    missingGoals: [6],
    note:
      'the Pathways TRANSITION DCP: the export carries the traditional-education ' +
      'columns (CCs, ACs, CL/AL/DTMs and their "Add." twins) alongside Level 1s-5s, ' +
      'and TI scored the goals as either-route. There is no additional-Level-4 ' +
      "column and no ten-goal reading of that era that matches TI's own Goals Met " +
      '(measured: 123/202 clubs diverge on D61 2020-06-30 under the closest ' +
      'mapping), so goal 6 must stay unresolvable rather than be guessed at.',
  },
] as const

describe('DCP goal header eras — archive census (#1539)', () => {
  it('the era table covers every captured export (no unclassified fixture)', () => {
    // Sourced from the fixture directory itself, not a hand-kept list: a new
    // capture that nobody classified fails here rather than going unnoticed.
    const captured = readdirSync(FIXTURE_DIR, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort()
    expect([...HEADER_ERAS.map(era => era.capture)].sort()).toEqual(captured)
  })

  for (const era of HEADER_ERAS) {
    describe(`${era.capture} — ${era.span}`, () => {
      const records = loadRecords(era.capture)

      it('carries the era header this table claims it does', () => {
        expect(Object.keys(records[0]!)).toContain(era.goal5Header)
        if (era.goal6Header === null) {
          expect(
            Object.keys(records[0]!).filter(key => /^add\./i.test(key)),
            'this era is claimed to have no additional-Level-4 column'
          ).not.toContain('Add. Level 4s')
        } else {
          expect(Object.keys(records[0]!)).toContain(era.goal6Header)
        }
      })

      it(`resolves every goal except ${JSON.stringify(era.missingGoals)} — for every club, not just the first`, () => {
        for (const record of records) {
          expect(
            missingDcpGoalHeaders(record),
            `club ${String(record['Club Number'])}: ${era.note}`
          ).toEqual(era.missingGoals)
        }
      })

      it(`hasDcpGoalColumns is ${era.missingGoals.length === 0}`, () => {
        expect(hasDcpGoalColumns(records[0]!)).toBe(
          era.missingGoals.length === 0
        )
      })
    })
  }
})

describe('DCP middle era, 2020-07 → 2025-06 (d61-2025-06-30, #1539)', () => {
  const records = loadRecords('d61-2025-06-30')

  it('loads the captured export', () => {
    expect(records).toHaveLength(170)
    expect(records[0]).toHaveProperty('Level 4s, Level 5s, or DTM award')
    expect(records[0]).toHaveProperty('Add. Level 4s, Level 5s, or DTM award')
  })

  it('reads goal 5 from "Level 4s, Level 5s, or DTM award" — 109 clubs', () => {
    expect(tally(records, goalColumn(5))).toEqual({ awards: 109, clubs: 109 })
  })

  it('reads goal 6 from "Add. Level 4s, Level 5s, or DTM award" — 194 across 82 clubs', () => {
    expect(tally(records, goalColumn(6))).toEqual({ awards: 194, clubs: 82 })
  })

  /**
   * Parity against TI's own `Goals Met`, the way #1118 validated the current
   * era. Four of 170 clubs diverge and all four carry the SAME pre-existing
   * signature — `Off. Trained Round 1` reads 0 while TI still credits goal 9
   * — so grant goal 9 to those four and parity is exact. Goals 5 and 6
   * contribute no divergence at all, which is the claim this fix has to earn.
   *
   * Measured across 25 district-years of the middle era (districts 61, 21, 42,
   * 116 and Undistricted at each PY end, 2021-06-30 … 2025-06-30): every one
   * of the 48 divergences is that same goal-9 signature. It is not a #1539
   * defect and is deliberately not fixed here.
   */
  describe("parity against TI's Goals Met (#1118 method)", () => {
    const divergent = records.filter(
      record => goalsAchievedCount(record) !== Number(record['Goals Met'])
    )

    it('diverges on exactly the four known officer-training records', () => {
      expect(divergent.map(record => String(record['Club Number']))).toEqual([
        '28678043',
        '28678196',
        '28677884',
        '28678212',
      ])
    })

    it('every divergence is goal 9 alone — goals 5 and 6 are exact', () => {
      for (const record of divergent) {
        const achieved = computeDcpGoalsAchieved(record)
        expect(achieved[8], 'goal 9 is the one we score as unmet').toBe(false)
        expect(
          readDcpGoalColumn(record, goalColumn(9)),
          'and it is unmet because round 1 reads 0'
        ).toBe(0)
        // Grant goal 9 and the club agrees with TI exactly.
        expect(achieved.filter(Boolean).length + 1).toBe(
          Number(record['Goals Met'])
        )
      }
    })

    it('agrees with TI on all 166 other clubs', () => {
      expect(records.length - divergent.length).toBe(166)
    })
  })
})

describe('DCP goal columns against captured District 61 exports (#1399)', () => {
  describe('PY 2026-27 header (raw-csv/2026-08-01, "… or EOM")', () => {
    const records = loadRecords('d61-2026-08-01')

    it('loads the captured export', () => {
      expect(records).toHaveLength(161)
      expect(records[0]).toHaveProperty('Level 2s or EOM')
      expect(records[0]).toHaveProperty('Add. Level 2s or EOM')
    })

    it('reads goal 2 from "Level 2s or EOM" — 14 awards across 13 clubs', () => {
      expect(tally(records, goalColumn(2))).toEqual({ awards: 14, clubs: 13 })
    })

    it('recognises the goal 3 header "Add. Level 2s or EOM"', () => {
      const column = goalColumn(3)
      for (const record of records) {
        expect(
          column.aliases.some(alias => alias in record),
          `no known goal 3 alias in ${JSON.stringify(Object.keys(record))}`
        ).toBe(true)
      }
      // Legitimately zero this early in the program year — the point is that
      // the column resolves at all, not that anyone has earned one yet.
      expect(tally(records, column)).toEqual({ awards: 0, clubs: 0 })
    })

    it('detects that the record carries per-goal columns', () => {
      expect(hasDcpGoalColumns(records[0]!)).toBe(true)
    })
  })

  describe('PY 2025-26 header (raw-csv/2026-06-09, "Level 2s")', () => {
    const records = loadRecords('d61-2026-06-09')

    it('still reads goal 2 from the historical header', () => {
      expect(tally(records, goalColumn(2))).toEqual({ awards: 161, clubs: 102 })
    })

    it('still reads goal 3 from the historical header', () => {
      expect(tally(records, goalColumn(3))).toEqual({ awards: 97, clubs: 37 })
    })

    it('detects that the record carries per-goal columns', () => {
      expect(hasDcpGoalColumns(records[0]!)).toBe(true)
    })
  })
})
