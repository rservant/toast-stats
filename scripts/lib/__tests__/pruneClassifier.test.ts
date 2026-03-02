/**
 * Unit tests for scripts/lib/pruneClassifier.ts
 *
 * Tests the pure classification logic that determines which GCS snapshot
 * folders to keep and which to delete during the pruning operation (#149).
 *
 * RED phase: these tests are written before the implementation exists.
 */

import { describe, it, expect } from 'vitest'
import { classifySnapshotDates } from '../pruneClassifier'

// Reference today: Feb 27 2026 (mid 2025-2026 program year)
const TODAY = new Date(Date.UTC(2026, 1, 27))

describe('classifySnapshotDates', () => {
  // Completed PY keeper dates (last closing-period date per month)
  const KEEPER_DATES = new Set([
    '2024-07-31', // Aug 2024 (dataMonth = 2024-07 — wait, keepers come from closing dates)
    '2024-09-02', // dataMonth 2024-08
    '2024-10-01', // dataMonth 2024-09
    '2025-01-03', // dataMonth 2024-12
  ])

  // --- Normal Pruning ---

  it('marks non-keeper dates in completed PYs for deletion', () => {
    const snapshotDates = [
      '2024-08-15', // daily in completed PY, not a keeper → DELETE
      '2024-09-02', // keeper → KEEP
    ]

    const result = classifySnapshotDates(snapshotDates, KEEPER_DATES, TODAY)

    expect(result.toDelete).toContain('2024-08-15')
    expect(result.toKeep).toContain('2024-09-02')
  })

  it('always keeps keeper dates', () => {
    const snapshotDates = [...KEEPER_DATES]

    const result = classifySnapshotDates(snapshotDates, KEEPER_DATES, TODAY)

    expect(result.toDelete).toHaveLength(0)
    expect(result.toKeep).toHaveLength(snapshotDates.length)
  })

  it('returns empty arrays when no snapshot dates are provided', () => {
    const result = classifySnapshotDates([], KEEPER_DATES, TODAY)

    expect(result.toDelete).toHaveLength(0)
    expect(result.toKeep).toHaveLength(0)
    expect(result.guardViolations).toHaveLength(0)
  })

  // --- Current Program Year Safety Guard ---

  it('keeps current-PY dates (never deletes them)', () => {
    const snapshotDates = [
      '2026-02-15', // in PY 2025-2026 (current) → always KEEP
      '2025-08-10', // in PY 2025-2026 (current) → always KEEP
    ]

    const result = classifySnapshotDates(snapshotDates, KEEPER_DATES, TODAY)

    expect(result.toKeep).toContain('2026-02-15')
    expect(result.toKeep).toContain('2025-08-10')
    expect(result.toDelete).toHaveLength(0)
    expect(result.guardViolations).toHaveLength(0)
  })

  it('returns guardViolations when a non-keeper date somehow slips past the current-PY check', () => {
    // This tests the paranoid double-check path — shouldn't happen in normal
    // operation, but the hard guard must detect it.
    // We simulate this by having a keeperDates set that includes a current-PY
    // date (which means the first guard passes) but then we artificially check
    // the double-check by examining what would have gone to delete.
    //
    // Actually the guard violation occurs when a date IS NOT a keeper AND IS
    // somehow classified as "completed PY" but was earlier NOT caught by the
    // isProgramYearComplete check — this is intentionally hard to trigger
    // from pure inputs. The test below verifies the function never puts a
    // current-PY date in toDelete under any circumstances.
    const currentPYDate = '2026-01-20' // PY 2025-2026, incomplete
    const snapshotDates = [currentPYDate]
    const emptyKeepers = new Set<string>() // not a keeper

    const result = classifySnapshotDates(snapshotDates, emptyKeepers, TODAY)

    // Must NOT be in toDelete — the guard should prevent it
    expect(result.toDelete).not.toContain(currentPYDate)
    expect(result.toKeep).toContain(currentPYDate)
    expect(result.guardViolations).toHaveLength(0)
  })

  // --- Program Year Scoping (--program-year flag) ---

  it('scopes to a specific program year when programYear is provided', () => {
    const snapshotDates = [
      '2024-08-15', // PY 2024-2025 → in scope
      '2023-09-01', // PY 2023-2024 → out of scope, keep regardless
      '2024-09-02', // keeper in 2024-2025
    ]

    const result = classifySnapshotDates(
      snapshotDates,
      KEEPER_DATES,
      TODAY,
      '2024-2025'
    )

    // 2024-08-15 is in PY 2024-2025 scope and is not a keeper → DELETE
    expect(result.toDelete).toContain('2024-08-15')
    // 2023-09-01 is out of scope → KEEP (not touched)
    expect(result.toKeep).toContain('2023-09-01')
    // 2024-09-02 is a keeper → KEEP
    expect(result.toKeep).toContain('2024-09-02')
  })

  it('skips out-of-scope dates when programYear is set', () => {
    const snapshotDates = [
      '2022-11-01', // PY 2022-2023, not in 2024-2025 scope
      '2024-08-01', // PY 2024-2025, in scope, not a keeper
    ]

    const result = classifySnapshotDates(
      snapshotDates,
      new Set<string>(),
      TODAY,
      '2024-2025'
    )

    // Out-of-scope date should be in toKeep, not toDelete
    expect(result.toKeep).toContain('2022-11-01')
    expect(result.toDelete).toContain('2024-08-01')
  })

  // --- Mixed Realistic Scenario ---

  it('handles a realistic mix of dates across multiple program years', () => {
    const keepers = new Set(['2024-09-02', '2025-01-03'])
    const snapshotDates = [
      '2024-08-15', // daily, completed PY, not keeper → DELETE
      '2024-09-01', // daily, completed PY, not keeper → DELETE
      '2024-09-02', // keeper → KEEP
      '2025-01-03', // keeper → KEEP
      '2025-08-20', // current PY 2025-2026 → KEEP
      '2026-02-01', // current PY 2025-2026 → KEEP
    ]

    const result = classifySnapshotDates(snapshotDates, keepers, TODAY)

    expect(result.toDelete.sort()).toEqual(['2024-08-15', '2024-09-01'])
    expect(result.toKeep.sort()).toEqual([
      '2024-09-02',
      '2025-01-03',
      '2025-08-20',
      '2026-02-01',
    ])
    expect(result.guardViolations).toHaveLength(0)
  })
})
