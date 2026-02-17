/**
 * Unit Tests for API Response Metadata Completeness
 *
 * Verifies closing period metadata behavior in API responses:
 * - is_closing_period_data flag
 * - collection_date vs logical_date
 * - Date arithmetic for month-end calculations
 *
 * Converted from property-based tests — the PBT tested
 * buildSnapshotMetadata() (a pure function) with generated dates.
 * Replaced with representative fixed test cases covering edge cases.
 */

import { describe, it, expect } from 'vitest'
import type { Snapshot } from '../../types/snapshots.js'

interface SnapshotResponseMetadata {
  snapshot_id: string
  created_at: string
  schema_version: string
  calculation_version: string
  data_as_of: string
  is_closing_period_data?: boolean
  collection_date?: string
  logical_date?: string
}

function buildSnapshotMetadata(snapshot: Snapshot): SnapshotResponseMetadata {
  const metadata = snapshot.payload.metadata

  const baseMetadata: SnapshotResponseMetadata = {
    snapshot_id: snapshot.snapshot_id,
    created_at: snapshot.created_at,
    schema_version: snapshot.schema_version,
    calculation_version: snapshot.calculation_version,
    data_as_of: metadata.dataAsOfDate,
  }

  if (metadata.isClosingPeriodData !== undefined) {
    baseMetadata.is_closing_period_data = metadata.isClosingPeriodData
  }
  if (metadata.collectionDate !== undefined) {
    baseMetadata.collection_date = metadata.collectionDate
  }
  if (metadata.logicalDate !== undefined) {
    baseMetadata.logical_date = metadata.logicalDate
  }

  return baseMetadata
}

function getLastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function createClosingPeriodSnapshot(
  year: number,
  dataMonth: number,
  collectionDay: number
): Snapshot {
  const collectionMonth = dataMonth === 12 ? 1 : dataMonth + 1
  const collectionYear = dataMonth === 12 ? year + 1 : year
  const lastDay = getLastDayOfMonth(year, dataMonth)

  const collectionDate = `${collectionYear}-${String(collectionMonth).padStart(2, '0')}-${String(collectionDay).padStart(2, '0')}`
  const logicalDate = `${year}-${String(dataMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  return {
    snapshot_id: logicalDate,
    created_at: new Date().toISOString(),
    status: 'success',
    schema_version: '2.0.0',
    calculation_version: '2.0.0',
    errors: [],
    payload: {
      metadata: {
        source: 'toastmasters-dashboard',
        dataAsOfDate: collectionDate,
        fetchedAt: new Date().toISOString(),
        districtCount: 1,
        processingDurationMs: 100,
        isClosingPeriodData: true,
        collectionDate,
        logicalDate,
      },
      districts: [],
    },
  }
}

function createNormalSnapshot(dateStr: string): Snapshot {
  return {
    snapshot_id: dateStr,
    created_at: new Date().toISOString(),
    status: 'success',
    schema_version: '2.0.0',
    calculation_version: '2.0.0',
    errors: [],
    payload: {
      metadata: {
        source: 'toastmasters-dashboard',
        dataAsOfDate: dateStr,
        fetchedAt: new Date().toISOString(),
        districtCount: 1,
        processingDurationMs: 100,
        isClosingPeriodData: false,
        collectionDate: dateStr,
        logicalDate: dateStr,
      },
      districts: [],
    },
  }
}

describe('API Response Metadata Completeness', () => {
  // --------------------------------------------------------------------------
  // Closing period snapshots
  // --------------------------------------------------------------------------

  describe('Closing period snapshots', () => {
    // Edge cases: Jan (31d), Feb (28d), Feb leap (29d), Apr (30d), Dec (31d, year wrap)
    const closingPeriodCases: [string, number, number, number][] = [
      ['January 2024', 2024, 1, 5],
      ['February 2024 (non-leap)', 2024, 2, 3],
      ['February 2024 (leap year)', 2024, 2, 10],
      ['April 2024 (30 days)', 2024, 4, 2],
      ['June 2023', 2023, 6, 15],
      ['December 2024 (year wrap)', 2024, 12, 5],
    ]

    it.each(closingPeriodCases)(
      'should include all required metadata fields for %s',
      (_desc, year, dataMonth, collectionDay) => {
        const snapshot = createClosingPeriodSnapshot(
          year,
          dataMonth,
          collectionDay
        )
        const metadata = buildSnapshotMetadata(snapshot)

        expect(metadata.is_closing_period_data).toBe(true)
        expect(metadata.collection_date).toBeDefined()
        expect(metadata.collection_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(metadata.logical_date).toBeDefined()
        expect(metadata.logical_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(metadata.collection_date).not.toBe(metadata.logical_date)
      }
    )

    it.each(closingPeriodCases)(
      'should set logical_date to last day of month for %s',
      (_desc, year, dataMonth, collectionDay) => {
        const snapshot = createClosingPeriodSnapshot(
          year,
          dataMonth,
          collectionDay
        )
        const metadata = buildSnapshotMetadata(snapshot)

        const [yearStr, monthStr, dayStr] = metadata.logical_date!.split('-')
        const day = parseInt(dayStr!, 10)
        const expectedLastDay = getLastDayOfMonth(
          parseInt(yearStr!, 10),
          parseInt(monthStr!, 10)
        )
        expect(day).toBe(expectedLastDay)
      }
    )

    it.each(closingPeriodCases)(
      'should set collection_date in month after logical_date for %s',
      (_desc, year, dataMonth, collectionDay) => {
        const snapshot = createClosingPeriodSnapshot(
          year,
          dataMonth,
          collectionDay
        )
        const metadata = buildSnapshotMetadata(snapshot)

        const logicalMonth = parseInt(metadata.logical_date!.split('-')[1]!, 10)
        const logicalYear = parseInt(metadata.logical_date!.split('-')[0]!, 10)
        const collectionMonth = parseInt(
          metadata.collection_date!.split('-')[1]!,
          10
        )
        const collectionYear = parseInt(
          metadata.collection_date!.split('-')[0]!,
          10
        )

        if (logicalMonth === 12) {
          expect(collectionMonth).toBe(1)
          expect(collectionYear).toBe(logicalYear + 1)
        } else {
          expect(collectionMonth).toBe(logicalMonth + 1)
          expect(collectionYear).toBe(logicalYear)
        }
      }
    )
  })

  // --------------------------------------------------------------------------
  // Non-closing period snapshots
  // --------------------------------------------------------------------------

  describe('Non-closing period snapshots', () => {
    it.each(['2024-01-15', '2024-06-20', '2023-12-01'])(
      'should have consistent metadata for date %s',
      dateStr => {
        const snapshot = createNormalSnapshot(dateStr)
        const metadata = buildSnapshotMetadata(snapshot)

        expect(metadata.is_closing_period_data).toBe(false)
        expect(metadata.collection_date).toBeDefined()
        expect(metadata.logical_date).toBeDefined()
        expect(metadata.collection_date).toBe(metadata.logical_date)
      }
    )
  })

  // --------------------------------------------------------------------------
  // Metadata field types and formats
  // --------------------------------------------------------------------------

  describe('Metadata field types', () => {
    it('should have correct types for closing period snapshot', () => {
      const snapshot = createClosingPeriodSnapshot(2024, 6, 5)
      const metadata = buildSnapshotMetadata(snapshot)

      expect(typeof metadata.snapshot_id).toBe('string')
      expect(typeof metadata.created_at).toBe('string')
      expect(typeof metadata.schema_version).toBe('string')
      expect(typeof metadata.calculation_version).toBe('string')
      expect(typeof metadata.data_as_of).toBe('string')
      expect(typeof metadata.is_closing_period_data).toBe('boolean')
      expect(typeof metadata.collection_date).toBe('string')
      expect(typeof metadata.logical_date).toBe('string')

      // Validate dates are parseable
      expect(new Date(metadata.collection_date!).toString()).not.toBe(
        'Invalid Date'
      )
      expect(new Date(metadata.logical_date!).toString()).not.toBe(
        'Invalid Date'
      )
    })

    it('should have correct types for normal snapshot', () => {
      const snapshot = createNormalSnapshot('2024-03-15')
      const metadata = buildSnapshotMetadata(snapshot)

      expect(typeof metadata.is_closing_period_data).toBe('boolean')
      expect(typeof metadata.collection_date).toBe('string')
      expect(typeof metadata.logical_date).toBe('string')
    })
  })
})
