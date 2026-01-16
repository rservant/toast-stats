/**
 * Payment Trend Utilities
 * Functions for building and transforming payment trend data from snapshots
 *
 * Requirements: 3.1, 3.2, 3.3
 */

import { calculateProgramYearDay } from './programYear'

/**
 * A single data point in the payment trend
 */
export interface PaymentTrendDataPoint {
  /** ISO date string (YYYY-MM-DD) */
  date: string
  /** YTD payment count */
  payments: number
  /** Days since July 1 (for multi-year alignment) */
  programYearDay: number
}

/**
 * Snapshot data containing payment information
 * This interface represents the minimal data needed from a snapshot
 */
export interface PaymentSnapshotData {
  /** ISO date string of the snapshot */
  date: string
  /** Total YTD payments (may be undefined/null if unavailable) */
  totalPayments?: number | null
  /** Payment base value (optional) */
  paymentBase?: number | null
}

/**
 * Build a payment trend from an array of snapshot data.
 *
 * - Extracts totalPayments from each snapshot
 * - Sorts by date ascending
 * - Calculates programYearDay for each data point
 * - Excludes snapshots with missing payment data (undefined, null)
 *
 * @param snapshots - Array of snapshot data containing payment information
 * @returns Array of PaymentTrendDataPoint sorted by date ascending
 *
 * Requirements:
 * - 3.1: Retrieve YTD payment data from District_Ranking totalPayments field
 * - 3.2: Build a payment trend from historical snapshots within the date range
 * - 3.3: Exclude data points where payment data is unavailable
 */
export function buildPaymentTrend(
  snapshots: PaymentSnapshotData[]
): PaymentTrendDataPoint[] {
  return snapshots
    .filter(
      (snapshot): snapshot is PaymentSnapshotData & { totalPayments: number } =>
        snapshot.totalPayments !== undefined && snapshot.totalPayments !== null
    )
    .map(snapshot => ({
      date: snapshot.date,
      payments: snapshot.totalPayments,
      programYearDay: calculateProgramYearDay(snapshot.date),
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
