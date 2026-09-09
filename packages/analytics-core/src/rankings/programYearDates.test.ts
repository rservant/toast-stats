/**
 * Unit tests for shared program-year date helpers (#306).
 *
 * Previously duplicated verbatim between BordaCountRankingCalculator
 * (analytics-core) and TransformService (collector-cli).
 */

import { describe, it, expect } from 'vitest'
import {
  parseDateFlexible,
  getProgramYearStartDate,
  parseCharterDateFromStatusField,
  parseSuspendDateFromStatusField,
} from './programYearDates.js'

describe('parseDateFlexible', () => {
  it('parses ISO YYYY-MM-DD as UTC', () => {
    expect(parseDateFlexible('2026-04-15')?.toISOString()).toBe(
      '2026-04-15T00:00:00.000Z'
    )
  })

  it('parses US M/D/YYYY', () => {
    expect(parseDateFlexible('4/15/2026')?.toISOString()).toBe(
      '2026-04-15T00:00:00.000Z'
    )
  })

  it('parses US M/D/YY as 20YY', () => {
    expect(parseDateFlexible('4/15/26')?.toISOString()).toBe(
      '2026-04-15T00:00:00.000Z'
    )
  })

  it('returns null for empty or unparseable input', () => {
    expect(parseDateFlexible('')).toBeNull()
    expect(parseDateFlexible('not a date')).toBeNull()
  })
})

describe('getProgramYearStartDate', () => {
  it('returns July 1 of the same calendar year for a date in/after July', () => {
    expect(getProgramYearStartDate('2025-09-15')?.toISOString()).toBe(
      '2025-07-01T00:00:00.000Z'
    )
  })

  it('returns July 1 of the previous calendar year for a date before July', () => {
    expect(getProgramYearStartDate('2026-04-15')?.toISOString()).toBe(
      '2025-07-01T00:00:00.000Z'
    )
  })

  it('returns null for an unparseable date', () => {
    expect(getProgramYearStartDate('garbage')).toBeNull()
  })
})

describe('parseCharterDateFromStatusField', () => {
  it('extracts the date from a Charter entry', () => {
    expect(
      parseCharterDateFromStatusField('Charter 04/15/26')?.toISOString()
    ).toBe('2026-04-15T00:00:00.000Z')
  })

  it('returns null for a Susp entry', () => {
    expect(parseCharterDateFromStatusField('Susp 09/30/25')).toBeNull()
  })

  it('returns null for empty or non-string input', () => {
    expect(parseCharterDateFromStatusField('')).toBeNull()
    expect(parseCharterDateFromStatusField(null)).toBeNull()
    expect(parseCharterDateFromStatusField(42)).toBeNull()
  })
})

describe('parseSuspendDateFromStatusField (#1497)', () => {
  // Values captured live 2026-08-31 from
  // cdn.taverns.red/snapshots/2026-06-30/district_61.json →
  // data.districtPerformance[]['Charter Date/Suspend Date'].
  // Suspension values carry a LEADING SPACE; charter values do not.
  it('extracts the date from a live Susp entry (leading space and all)', () => {
    expect(
      parseSuspendDateFromStatusField(' Susp 03/31/26')?.toISOString()
    ).toBe('2026-03-31T00:00:00.000Z')
  })

  it('extracts the date from a Susp entry without the leading space', () => {
    expect(
      parseSuspendDateFromStatusField('Susp 09/30/25')?.toISOString()
    ).toBe('2025-09-30T00:00:00.000Z')
  })

  it('matches the prefix case-insensitively', () => {
    expect(
      parseSuspendDateFromStatusField('susp 09/30/25')?.toISOString()
    ).toBe('2025-09-30T00:00:00.000Z')
    expect(
      parseSuspendDateFromStatusField('SUSP 09/30/25')?.toISOString()
    ).toBe('2025-09-30T00:00:00.000Z')
  })

  it('parses a 4-digit year per parseDateFlexible semantics', () => {
    expect(
      parseSuspendDateFromStatusField('Susp 3/1/2026')?.toISOString()
    ).toBe('2026-03-01T00:00:00.000Z')
  })

  it('returns null for a Charter entry (wrong prefix)', () => {
    expect(parseSuspendDateFromStatusField('Charter 04/15/26')).toBeNull()
    expect(parseSuspendDateFromStatusField('Charter 05/22/26')).toBeNull()
  })

  it('returns null for a Susp prefix with no date', () => {
    expect(parseSuspendDateFromStatusField('Susp')).toBeNull()
    expect(parseSuspendDateFromStatusField('Susp ')).toBeNull()
    expect(parseSuspendDateFromStatusField('Susp not a date')).toBeNull()
  })

  it('returns null for empty, missing, or non-string input', () => {
    expect(parseSuspendDateFromStatusField('')).toBeNull()
    expect(parseSuspendDateFromStatusField('   ')).toBeNull()
    expect(parseSuspendDateFromStatusField(undefined)).toBeNull()
    expect(parseSuspendDateFromStatusField(null)).toBeNull()
    expect(parseSuspendDateFromStatusField(42)).toBeNull()
  })
})

describe('a cell carrying BOTH branches (#1540)', () => {
  // Verbatim `Charter Date/Suspend Date` values from the frozen
  // 2026-06-30 / 2022-06-30 captures in
  // `scripts/lib/__tests__/fixtures/global-rollup/suspension-column-census.json`.
  // A club that charters and is then suspended inside the same program year
  // gets BOTH stamps in the one column. 19 rows carry this shape at
  // 2026-06-30 and 5 at 2022-06-30 — and because both parsers anchored at
  // `^`, every one of them was lost by BOTH: the Susp parser never matched,
  // and the Charter parser matched but handed `parseDateFlexible` the whole
  // tail `"09/30/25 Susp 03/31/26"`, which does not parse.
  const COMBINED: ReadonlyArray<
    readonly [cell: string, charterIso: string, suspIso: string, where: string]
  > = [
    [
      'Charter 09/10/25 Susp 03/31/26',
      '2025-09-10T00:00:00.000Z',
      '2026-03-31T00:00:00.000Z',
      'D04 club 28678849 @ 2026-06-30',
    ],
    [
      'Charter 09/30/25 Susp 03/31/26',
      '2025-09-30T00:00:00.000Z',
      '2026-03-31T00:00:00.000Z',
      'D121 club 28679251 @ 2026-06-30',
    ],
    [
      'Charter 07/15/25 Susp 03/31/26',
      '2025-07-15T00:00:00.000Z',
      '2026-03-31T00:00:00.000Z',
      'D116 club 28678480 @ 2026-06-30',
    ],
    [
      'Charter 01/29/26 Susp 07/01/26',
      '2026-01-29T00:00:00.000Z',
      '2026-07-01T00:00:00.000Z',
      'D04 club 28679626 @ 2026-06-30 — the two dates land in DIFFERENT ' +
        'program years, which is why each must be window-tested on its own',
    ],
    [
      'Charter 09/22/21 Susp 04/13/22',
      '2021-09-22T00:00:00.000Z',
      '2022-04-13T00:00:00.000Z',
      'D112 club 07935701 @ 2022-06-30',
    ],
  ]

  it.each(COMBINED)(
    '%s yields BOTH dates (%s / %s) — %s',
    (cell, charterIso, suspIso) => {
      expect(parseCharterDateFromStatusField(cell)?.toISOString()).toBe(
        charterIso
      )
      expect(parseSuspendDateFromStatusField(cell)?.toISOString()).toBe(suspIso)
    }
  )

  it('reads the branch behind a leading space, as live rows carry it', () => {
    expect(
      parseCharterDateFromStatusField(
        ' Charter 09/30/25 Susp 03/31/26'
      )?.toISOString()
    ).toBe('2025-09-30T00:00:00.000Z')
    expect(
      parseSuspendDateFromStatusField(
        ' Charter 09/30/25 Susp 03/31/26'
      )?.toISOString()
    ).toBe('2026-03-31T00:00:00.000Z')
  })

  it('keeps each branch keyed on its own whole-word literal', () => {
    // Synthetic adversarial cells, not observed in the archive: the guard
    // that stops the unanchored search from over-firing on a token that
    // merely CONTAINS the literal. Drop the `(?:^|\s)` boundary and these
    // start matching — which is the other half of the #1540 mutation proof.
    expect(parseCharterDateFromStatusField('Recharter 05/22/26')).toBeNull()
    expect(parseSuspendDateFromStatusField('Unsusp 03/31/26')).toBeNull()
    expect(parseCharterDateFromStatusField('Susp 03/31/26')).toBeNull()
    expect(parseSuspendDateFromStatusField('Charter 09/30/25')).toBeNull()
  })

  it('does not let the sibling branch poison the captured date', () => {
    // The `(.+)` capture is what made the Charter parser return null here:
    // it swallowed ` Susp 03/31/26` into the date string. Capturing a single
    // token is the fix, so a trailing branch is inert to the leading one.
    expect(
      parseCharterDateFromStatusField('Charter 09/30/25 Susp 03/31/26')
    ).not.toBeNull()
    expect(
      parseSuspendDateFromStatusField(
        'Susp 03/31/26 Charter 09/30/25'
      )?.toISOString()
    ).toBe('2026-03-31T00:00:00.000Z')
  })
})
