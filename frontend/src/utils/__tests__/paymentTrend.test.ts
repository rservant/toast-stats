/**
 * Unit Tests for buildPaymentTrend
 *
 * Verifies date sorting, payment value preservation, null/undefined
 * filtering, and programYearDay calculation.
 *
 * Converted from property-based tests — PBT generated random dates and
 * payment values; replaced with representative fixed test cases.
 */

import { describe, it, expect } from 'vitest'
import { buildPaymentTrend, PaymentSnapshotData } from '../paymentTrend'

describe('buildPaymentTrend', () => {
  it('should return empty array for empty input', () => {
    expect(buildPaymentTrend([])).toEqual([])
  })

  it('should produce a trend array sorted by date ascending', () => {
    const snapshots: PaymentSnapshotData[] = [
      { date: '2024-06-15', totalPayments: 50 },
      { date: '2024-01-01', totalPayments: 100 },
      { date: '2024-12-31', totalPayments: 25 },
      { date: '2024-03-10', totalPayments: 75 },
    ]

    const result = buildPaymentTrend(snapshots)

    for (let i = 1; i < result.length; i++) {
      expect(
        result[i].date.localeCompare(result[i - 1].date)
      ).toBeGreaterThanOrEqual(0)
    }
  })

  it('should preserve payment values from source snapshots', () => {
    const snapshots: PaymentSnapshotData[] = [
      { date: '2024-01-15', totalPayments: 100 },
      { date: '2024-02-20', totalPayments: 200 },
      { date: '2024-03-25', totalPayments: 0 },
    ]

    const result = buildPaymentTrend(snapshots)

    const sourcePayments = new Map(
      snapshots.map(s => [s.date, s.totalPayments])
    )
    for (const point of result) {
      expect(sourcePayments.get(point.date)).toBe(point.payments)
    }
  })

  it('should exclude snapshots with undefined totalPayments', () => {
    const snapshots: PaymentSnapshotData[] = [
      { date: '2024-01-01', totalPayments: 100 },
      { date: '2024-02-01', totalPayments: undefined },
      { date: '2024-03-01', totalPayments: 200 },
    ]

    const result = buildPaymentTrend(snapshots)

    expect(result.length).toBe(2)
    for (const point of result) {
      expect(typeof point.payments).toBe('number')
      expect(Number.isFinite(point.payments)).toBe(true)
    }
  })

  it('should exclude snapshots with null totalPayments', () => {
    const snapshots: PaymentSnapshotData[] = [
      { date: '2024-01-01', totalPayments: null },
      { date: '2024-02-01', totalPayments: 50 },
    ]

    const result = buildPaymentTrend(snapshots)

    expect(result.length).toBe(1)
    expect(result[0].payments).toBe(50)
  })

  it('should return empty array when all snapshots have missing payments', () => {
    const snapshots: PaymentSnapshotData[] = [
      { date: '2024-01-01', totalPayments: undefined },
      { date: '2024-02-01', totalPayments: null },
      { date: '2024-03-01', totalPayments: undefined },
    ]

    expect(buildPaymentTrend(snapshots)).toEqual([])
  })

  it('should calculate programYearDay for each data point', () => {
    const snapshots: PaymentSnapshotData[] = [
      { date: '2024-07-01', totalPayments: 10 }, // Start of program year
      { date: '2024-12-15', totalPayments: 20 },
      { date: '2025-06-30', totalPayments: 30 }, // End of program year
    ]

    const result = buildPaymentTrend(snapshots)

    for (const point of result) {
      expect(point.programYearDay).toBeDefined()
      expect(typeof point.programYearDay).toBe('number')
      expect(point.programYearDay).toBeGreaterThanOrEqual(0)
      expect(point.programYearDay).toBeLessThanOrEqual(365)
    }
  })

  it('should handle single snapshot', () => {
    const snapshots: PaymentSnapshotData[] = [
      { date: '2024-06-15', totalPayments: 500 },
    ]

    const result = buildPaymentTrend(snapshots)

    expect(result.length).toBe(1)
    expect(result[0].payments).toBe(500)
    expect(result[0].date).toBe('2024-06-15')
  })

  it('should handle snapshots with paymentBase', () => {
    const snapshots: PaymentSnapshotData[] = [
      { date: '2024-01-01', totalPayments: 100, paymentBase: 80 },
      { date: '2024-02-01', totalPayments: 120, paymentBase: undefined },
    ]

    const result = buildPaymentTrend(snapshots)
    expect(result.length).toBe(2)
  })

  it('should handle large number of snapshots', () => {
    const snapshots: PaymentSnapshotData[] = Array.from(
      { length: 50 },
      (_, i) => ({
        date: `2024-${String(Math.floor(i / 28) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
        totalPayments: i * 10,
      })
    )

    const result = buildPaymentTrend(snapshots)

    expect(result.length).toBeGreaterThan(0)
    for (let i = 1; i < result.length; i++) {
      expect(
        result[i].date.localeCompare(result[i - 1].date)
      ).toBeGreaterThanOrEqual(0)
    }
  })
})
