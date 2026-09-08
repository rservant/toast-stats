/**
 * Absence-as-zero census — unit tests for the pure classifier (#1534).
 *
 * Two absence-as-zero defects shipped and were each found by accident:
 * #1501 (a rankings rebuild without raw CSVs zeroed `newCharteredClubs`) and
 * #1514 (`suspendedClubs: 0` for eight program years because the `Susp`
 * branch carries zero values in 138,000 rows). Both had one signature: a
 * source column absent for a whole population is defaulted to `0` and
 * published as a measured zero.
 *
 * These tests pin the decision rule that finds that signature deliberately.
 * They encode BOTH directions, because guarding one only ships the opposite
 * bug (the #1514 mutation lesson):
 *
 *   - a phantom zero must be flagged, and
 *   - a real zero must NEVER be reported as an absence.
 *
 * Everything here is fixture-driven. The classifier does no I/O; the archive
 * sweep lives in `scripts/absence-as-zero-census.ts`.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  CENSUS_ROW_FLOOR,
  classifyAbsenceAsZero,
  correlateTypedFieldAbsence,
  EXTRACT_NUMBER_SOURCE_KEYS,
  formatCoverageTable,
  formatFindings,
  sourceFieldName,
  suspectedAbsences,
  typedFieldName,
  type FieldPopulationStats,
} from '../absenceAsZeroCensus.js'

/** Shorthand for one (date, field) population measurement. */
function stat(
  date: string,
  field: string,
  rowsTotal: number,
  rowsCarryingField: number,
  rowsNonZero: number
): FieldPopulationStats {
  return { date, field, rowsTotal, rowsCarryingField, rowsNonZero }
}

/** The verdict for one (date, field) pair, or undefined if not classified. */
function verdictFor(
  verdicts: ReturnType<typeof classifyAbsenceAsZero>,
  date: string,
  field: string
): string | undefined {
  return verdicts.find(v => v.date === date && v.field === field)?.verdict
}

describe('classifyAbsenceAsZero', () => {
  describe('the phantom-zero signature (#1534 AC1)', () => {
    it('flags a whole population that carries the field nowhere, when the field is non-zero elsewhere in the archive', () => {
      const verdicts = classifyAbsenceAsZero([
        stat('2022-06-30', 'districtPerformance.Susp', 17_000, 1018, 1018),
        stat('2023-06-30', 'districtPerformance.Susp', 17_250, 0, 0),
      ])

      expect(
        verdictFor(verdicts, '2023-06-30', 'districtPerformance.Susp')
      ).toBe('suspected-absence')
      expect(
        verdictFor(verdicts, '2022-06-30', 'districtPerformance.Susp')
      ).toBe('populated')
    })

    it('carries the evidence a follow-up issue needs: date, field and population size', () => {
      const verdicts = classifyAbsenceAsZero([
        stat('2022-06-30', 'districtPerformance.Susp', 17_000, 1018, 1018),
        stat('2023-06-30', 'districtPerformance.Susp', 17_250, 0, 0),
      ])

      expect(suspectedAbsences(verdicts)).toEqual([
        {
          date: '2023-06-30',
          field: 'districtPerformance.Susp',
          rowsTotal: 17_250,
          rowsCarryingField: 0,
          rowsNonZero: 0,
          verdict: 'suspected-absence',
        },
      ])
    })
  })

  describe('the census floor (#1534 AC2 — the #1501 limit)', () => {
    it('does not flag the same all-zero population below the row floor', () => {
      const verdicts = classifyAbsenceAsZero([
        stat('2022-06-30', 'districtPerformance.Susp', 17_000, 1018, 1018),
        stat(
          '2023-06-30',
          'districtPerformance.Susp',
          CENSUS_ROW_FLOOR - 1,
          0,
          0
        ),
      ])

      expect(
        verdictFor(verdicts, '2023-06-30', 'districtPerformance.Susp')
      ).toBe('below-floor')
      expect(suspectedAbsences(verdicts)).toEqual([])
    })

    it('flags exactly at the floor — the floor is inclusive', () => {
      const verdicts = classifyAbsenceAsZero([
        stat('2022-06-30', 'districtPerformance.Susp', 17_000, 1018, 1018),
        stat('2023-06-30', 'districtPerformance.Susp', CENSUS_ROW_FLOOR, 0, 0),
      ])

      expect(
        verdictFor(verdicts, '2023-06-30', 'districtPerformance.Susp')
      ).toBe('suspected-absence')
    })

    it('honours an explicitly calibrated floor over the default', () => {
      const verdicts = classifyAbsenceAsZero(
        [
          stat('2022-06-30', 'clubPerformance.Level 2s', 17_000, 17_000, 9_000),
          stat('2023-06-30', 'clubPerformance.Level 2s', 900, 0, 0),
        ],
        { rowFloor: 1000 }
      )

      expect(
        verdictFor(verdicts, '2023-06-30', 'clubPerformance.Level 2s')
      ).toBe('below-floor')
    })
  })

  describe('a per-row zero is never a finding (#1534 AC3 — the #1501 rule)', () => {
    it('never flags a date where any row carries a non-zero value, however few', () => {
      const verdicts = classifyAbsenceAsZero([
        stat('2022-06-30', 'clubs.membershipCount', 17_000, 17_000, 16_999),
        // 16,999 clubs at zero and exactly one populated: still populated.
        stat('2023-06-30', 'clubs.membershipCount', 17_000, 17_000, 1),
      ])

      expect(verdictFor(verdicts, '2023-06-30', 'clubs.membershipCount')).toBe(
        'populated'
      )
      expect(suspectedAbsences(verdicts)).toEqual([])
    })
  })

  describe('an always-zero field is no-signal, not a defect (#1534 AC4)', () => {
    it('reports no-signal when the field is zero at every date in the archive', () => {
      const verdicts = classifyAbsenceAsZero([
        stat('2022-06-30', 'clubPerformance.Add. Level 2s', 17_000, 17_000, 0),
        stat('2023-06-30', 'clubPerformance.Add. Level 2s', 17_250, 17_250, 0),
      ])

      expect(verdicts.map(v => v.verdict)).toEqual(['no-signal', 'no-signal'])
      expect(suspectedAbsences(verdicts)).toEqual([])
    })

    it('reports no-signal even when the field is carried nowhere at any date — a never-present column is not evidence of a defect', () => {
      const verdicts = classifyAbsenceAsZero([
        stat('2022-06-30', 'clubPerformance.Ghost Column', 17_000, 0, 0),
        stat('2023-06-30', 'clubPerformance.Ghost Column', 17_250, 0, 0),
      ])

      expect(verdicts.map(v => v.verdict)).toEqual(['no-signal', 'no-signal'])
    })
  })

  describe('a measured zero is not an absence (#1534 AC5 — the #1514 middle case)', () => {
    it('does not flag a population that CARRIES the field with every value zero — the presence signal is wider than the count', () => {
      const verdicts = classifyAbsenceAsZero([
        // April renewals are genuinely zero at a September month-end: the
        // column is present on every row, the world just has not had April.
        stat('2017-09-30', 'clubs.aprilRenewals', 16_000, 16_000, 0),
        stat('2018-06-30', 'clubs.aprilRenewals', 16_100, 16_100, 15_400),
      ])

      expect(verdictFor(verdicts, '2017-09-30', 'clubs.aprilRenewals')).toBe(
        'all-zero-carried'
      )
      expect(suspectedAbsences(verdicts)).toEqual([])
    })

    it('separates the two zero shapes at the same date — carried-but-zero is not the same verdict as carried-nowhere', () => {
      const verdicts = classifyAbsenceAsZero([
        stat('2017-09-30', 'clubs.aprilRenewals', 16_000, 16_000, 0),
        stat('2017-09-30', 'districtPerformance.Susp', 16_000, 0, 0),
        stat('2018-06-30', 'clubs.aprilRenewals', 16_100, 16_100, 15_400),
        stat('2018-06-30', 'districtPerformance.Susp', 16_100, 900, 900),
      ])

      expect(verdictFor(verdicts, '2017-09-30', 'clubs.aprilRenewals')).toBe(
        'all-zero-carried'
      )
      expect(
        verdictFor(verdicts, '2017-09-30', 'districtPerformance.Susp')
      ).toBe('suspected-absence')
    })
  })

  describe('input integrity', () => {
    it('rejects stats where more rows carry the field than exist', () => {
      expect(() =>
        classifyAbsenceAsZero([stat('2022-06-30', 'f', 10, 11, 0)])
      ).toThrow(/rowsCarryingField/)
    })

    it('rejects stats where more rows are non-zero than carry the field', () => {
      expect(() =>
        classifyAbsenceAsZero([stat('2022-06-30', 'f', 10, 2, 3)])
      ).toThrow(/rowsNonZero/)
    })

    it('rejects negative counts', () => {
      expect(() =>
        classifyAbsenceAsZero([stat('2022-06-30', 'f', -1, 0, 0)])
      ).toThrow(/negative/)
    })
  })

  it('returns verdicts in a stable order — field, then date', () => {
    const verdicts = classifyAbsenceAsZero([
      stat('2023-06-30', 'b', 100, 100, 1),
      stat('2022-06-30', 'b', 100, 100, 1),
      stat('2023-06-30', 'a', 100, 100, 1),
    ])

    expect(verdicts.map(v => `${v.field}@${v.date}`)).toEqual([
      'a@2023-06-30',
      'b@2022-06-30',
      'b@2023-06-30',
    ])
  })
})

describe('EXTRACT_NUMBER_SOURCE_KEYS', () => {
  it('covers every typed clubs[] field that DataTransformer feeds through extractNumber', () => {
    expect(Object.keys(EXTRACT_NUMBER_SOURCE_KEYS).sort()).toEqual([
      'aprilRenewals',
      'dcpGoals',
      'membershipBase',
      'membershipCount',
      'newMembers',
      'octoberRenewals',
      'paymentsCount',
    ])
  })

  it('names the populations each field can be sourced from', () => {
    // Payment/renewal fields prefer districtPerformance and fall back to the
    // clubPerformance row (DataTransformer's `paymentSource`).
    expect(EXTRACT_NUMBER_SOURCE_KEYS.octoberRenewals.populations).toEqual([
      'districtPerformance',
      'clubPerformance',
    ])
    expect(EXTRACT_NUMBER_SOURCE_KEYS.membershipCount.populations).toEqual([
      'clubPerformance',
    ])
  })

  it('lists the candidate column keys in the order extractNumber tries them', () => {
    expect(EXTRACT_NUMBER_SOURCE_KEYS.membershipCount.keys).toEqual([
      'Active Members',
      'Membership',
      'Members',
    ])
  })

  /**
   * Drift guard. The map is a transcription of DataTransformer's argument
   * lists; if TI renames a column and the transformer follows, the census
   * must not keep sweeping a key that no longer exists — that would narrow
   * the audit silently, which is the exact failure mode this issue is about.
   *
   * Proven load-bearing by mutation: changing 'Active Members' to
   * 'Active Member' turns this test red.
   */
  it('every candidate key is still a literal in DataTransformer.ts', () => {
    const transformer = readFileSync(
      join(
        __dirname,
        '../../../packages/analytics-core/src/transformation/DataTransformer.ts'
      ),
      'utf-8'
    )

    const missing = Object.values(EXTRACT_NUMBER_SOURCE_KEYS)
      .flatMap(source => source.keys)
      .filter(key => !transformer.includes(`'${key}'`))

    expect(missing).toEqual([])
  })
})

describe('correlateTypedFieldAbsence', () => {
  const populated = (date: string, field: string) =>
    stat(date, field, 17_000, 17_000, 16_000)

  it('confirms an extractNumber phantom when the typed field is all-zero and NO candidate source column is carried', () => {
    const verdicts = classifyAbsenceAsZero([
      populated('2022-06-30', typedFieldName('membershipCount')),
      populated(
        '2022-06-30',
        sourceFieldName('clubPerformance', 'Active Members')
      ),
      stat('2023-06-30', typedFieldName('membershipCount'), 17_000, 17_000, 0),
      stat(
        '2023-06-30',
        sourceFieldName('clubPerformance', 'Active Members'),
        17_000,
        0,
        0
      ),
    ])

    expect(correlateTypedFieldAbsence(verdicts)).toEqual([
      {
        date: '2023-06-30',
        typedField: 'membershipCount',
        rowsTotal: 17_000,
        sourceEvidence: 'source-absent',
        carriedSourceFields: [],
      },
    ])
  })

  it('contradicts the phantom reading when a candidate source column IS populated — the zero came from somewhere else', () => {
    const verdicts = classifyAbsenceAsZero([
      populated('2022-06-30', typedFieldName('membershipCount')),
      populated(
        '2022-06-30',
        sourceFieldName('clubPerformance', 'Active Members')
      ),
      stat('2023-06-30', typedFieldName('membershipCount'), 17_000, 17_000, 0),
      populated(
        '2023-06-30',
        sourceFieldName('clubPerformance', 'Active Members')
      ),
    ])

    expect(correlateTypedFieldAbsence(verdicts)).toEqual([
      {
        date: '2023-06-30',
        typedField: 'membershipCount',
        rowsTotal: 17_000,
        sourceEvidence: 'source-populated',
        carriedSourceFields: ['clubPerformance.Active Members'],
      },
    ])
  })

  it('calls a carried-but-all-zero source a real zero, not an absence', () => {
    const verdicts = classifyAbsenceAsZero([
      populated('2022-06-30', typedFieldName('aprilRenewals')),
      populated(
        '2022-06-30',
        sourceFieldName('districtPerformance', 'Apr. Ren.')
      ),
      stat('2017-09-30', typedFieldName('aprilRenewals'), 16_000, 16_000, 0),
      stat(
        '2017-09-30',
        sourceFieldName('districtPerformance', 'Apr. Ren.'),
        16_000,
        16_000,
        0
      ),
    ])

    expect(correlateTypedFieldAbsence(verdicts)).toEqual([
      {
        date: '2017-09-30',
        typedField: 'aprilRenewals',
        rowsTotal: 16_000,
        sourceEvidence: 'source-all-zero',
        carriedSourceFields: ['districtPerformance.Apr. Ren.'],
      },
    ])
  })

  it('says nothing about a typed field that is populated', () => {
    const verdicts = classifyAbsenceAsZero([
      populated('2022-06-30', typedFieldName('membershipCount')),
      populated('2023-06-30', typedFieldName('membershipCount')),
    ])

    expect(correlateTypedFieldAbsence(verdicts)).toEqual([])
  })
})

describe('reporting', () => {
  const verdicts = classifyAbsenceAsZero([
    stat('2022-06-30', 'districtPerformance.Susp', 17_000, 1018, 1018),
    stat('2023-06-30', 'districtPerformance.Susp', 17_250, 0, 0),
    stat('2022-06-30', 'clubs.membershipCount', 17_000, 17_000, 16_800),
    stat('2023-06-30', 'clubs.membershipCount', 17_250, 17_250, 17_000),
  ])

  it('renders a field × date coverage table with one row per field', () => {
    const table = formatCoverageTable(verdicts)

    expect(table).toContain('2022-06-30')
    expect(table).toContain('2023-06-30')
    expect(table).toContain('districtPerformance.Susp')
    expect(table).toContain('clubs.membershipCount')
  })

  it('reports zero findings explicitly rather than printing nothing', () => {
    const clean = classifyAbsenceAsZero([
      stat('2022-06-30', 'clubs.membershipCount', 17_000, 17_000, 16_800),
    ])

    expect(formatFindings(clean)).toContain('No suspected-absence findings')
  })

  it('names each finding with its date, field and population size', () => {
    const findings = formatFindings(verdicts)

    expect(findings).toContain('districtPerformance.Susp')
    expect(findings).toContain('2023-06-30')
    expect(findings).toContain('17250')
  })
})
