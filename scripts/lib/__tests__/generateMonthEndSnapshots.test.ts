/**
 * Unit tests for the date-selection logic used in
 * scripts/generate-month-end-snapshots.ts (#148).
 *
 * Tests a pure `selectDatesToProcess` helper that encapsulates:
 * - Filtering summaries to completed program years only
 * - Optional --program-year scoping
 * - Safety guard: skip any date whose dataMonth belongs to an incomplete PY
 *
 * RED phase: written before the implementation exists.
 */

import { describe, it, expect } from 'vitest'
import { selectDatesToProcess } from '../generateMonthEndSnapshots'
import type { ProgramYearSummary, MonthEndResult } from '../monthEndDates'

// Reference today: Feb 27 2026 (mid PY 2025-2026)
const TODAY = new Date(Date.UTC(2026, 1, 27))

// A realistic summary fixture: one completed PY and one current PY
const SUMMARIES: ProgramYearSummary[] = [
  {
    year: '2024-2025',
    isComplete: true,
    monthResults: [
      {
        dataMonth: '2024-07',
        lastClosingDate: '2024-08-02',
        allClosingDates: ['2024-08-01', '2024-08-02'],
        programYear: '2024-2025',
      },
      {
        dataMonth: '2024-08',
        lastClosingDate: '2024-09-03',
        allClosingDates: ['2024-09-01', '2024-09-02', '2024-09-03'],
        programYear: '2024-2025',
      },
      {
        dataMonth: '2025-06',
        lastClosingDate: '2025-07-01',
        allClosingDates: ['2025-07-01'],
        programYear: '2024-2025',
      },
    ],
    missingMonths: [],
  },
  {
    year: '2025-2026',
    isComplete: false,
    monthResults: [], // current PY — no results
    missingMonths: [],
  },
]

describe('selectDatesToProcess', () => {
  it('returns only dates from completed program years', () => {
    const dates = selectDatesToProcess(SUMMARIES, TODAY)
    // All 3 dates from 2024-2025 should be included
    expect(dates).toHaveLength(3)
    expect(dates.map((d: MonthEndResult) => d.lastClosingDate).sort()).toEqual([
      '2024-08-02',
      '2024-09-03',
      '2025-07-01',
    ])
  })

  it('excludes incomplete (current) program year', () => {
    const dates = selectDatesToProcess(SUMMARIES, TODAY)
    // PY 2025-2026 isComplete=false — nothing from current PY
    const programYears = dates.map((d: MonthEndResult) => d.programYear)
    expect(programYears).not.toContain('2025-2026')
  })

  it('filters to a specific program year when programYear is provided', () => {
    const dates = selectDatesToProcess(SUMMARIES, TODAY, '2024-2025')
    expect(dates).toHaveLength(3)
    expect(
      dates.every((d: MonthEndResult) => d.programYear === '2024-2025')
    ).toBe(true)
  })

  it('returns empty array when programYear matches no completed PY', () => {
    // 2025-2026 is not complete — scoping to it should yield nothing
    const dates = selectDatesToProcess(SUMMARIES, TODAY, '2025-2026')
    expect(dates).toHaveLength(0)
  })

  it('returns empty array when no completed program years exist', () => {
    const onlyCurrent: ProgramYearSummary[] = [SUMMARIES[1]!]
    const dates = selectDatesToProcess(onlyCurrent, TODAY)
    expect(dates).toHaveLength(0)
  })

  it('safety guard: never returns dates whose dataMonth belongs to incomplete PY', () => {
    // Build a fixture where a "completed" PY result has a dataMonth in the current PY
    // (edge case: e.g. June 2026 closing period collected in Jul 2026)
    const edgeSummaries: ProgramYearSummary[] = [
      {
        year: '2024-2025',
        isComplete: true,
        monthResults: [
          {
            dataMonth: '2025-12', // belongs to PY 2025-2026 — current, incomplete
            lastClosingDate: '2026-01-05',
            allClosingDates: ['2026-01-05'],
            programYear: '2024-2025', // mislabeled — shouldn't survive guard
          },
        ],
        missingMonths: [],
      },
    ]

    const dates = selectDatesToProcess(edgeSummaries, TODAY)
    // The date's actual dataMonth 2025-12 belongs to PY 2025-2026 (incomplete)
    // The safety guard should filter it out
    expect(dates).toHaveLength(0)
  })
})
