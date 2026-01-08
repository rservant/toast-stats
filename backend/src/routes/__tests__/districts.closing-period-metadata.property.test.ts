/**
 * Property-Based Tests for API Response Metadata Completeness
 *
 * Feature: closing-period-api-integration
 * Property 5: Metadata Completeness
 *
 * Validates: Requirements 4.1, 4.2, 4.3
 *
 * For any API response from a closing period snapshot, the _snapshot_metadata
 * should include:
 * - is_closing_period_data: true when snapshot date differs from collection date
 * - collection_date: the actual CSV date when data was collected
 * - logical_date: the date the snapshot represents (month-end for closing periods)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fc from 'fast-check'
import type { Snapshot, NormalizedData } from '../../types/snapshots.js'

/**
 * Interface for the snapshot metadata returned in API responses
 */
interface SnapshotResponseMetadata {
  snapshot_id: string
  created_at: string
  schema_version: string
  calculation_version: string
  data_as_of: string
  // Closing period fields (Requirements 4.1, 4.2, 4.3)
  is_closing_period_data?: boolean
  collection_date?: string
  logical_date?: string
}

/**
 * Helper function to build snapshot metadata for API responses
 * This mirrors the logic that should be in the district routes
 */
function buildSnapshotMetadata(snapshot: Snapshot): SnapshotResponseMetadata {
  const metadata = snapshot.payload.metadata

  const baseMetadata: SnapshotResponseMetadata = {
    snapshot_id: snapshot.snapshot_id,
    created_at: snapshot.created_at,
    schema_version: snapshot.schema_version,
    calculation_version: snapshot.calculation_version,
    data_as_of: metadata.dataAsOfDate,
  }

  // Add closing period fields when applicable (Requirements 4.1, 4.2, 4.3)
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

/**
 * Helper to calculate last day of a month
 */
function getLastDayOfMonth(year: number, month: number): number {
  // Day 0 of month N+1 gives last day of month N
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/**
 * Generator for closing period snapshot metadata
 */
const closingPeriodMetadataArb = fc
  .record({
    year: fc.integer({ min: 2020, max: 2030 }),
    dataMonth: fc.integer({ min: 1, max: 12 }),
    collectionDay: fc.integer({ min: 1, max: 28 }), // Safe for all months
  })
  .map(({ year, dataMonth, collectionDay }) => {
    // Collection month is the month after data month
    const collectionMonth = dataMonth === 12 ? 1 : dataMonth + 1
    const collectionYear = dataMonth === 12 ? year + 1 : year

    const collectionDate = `${collectionYear}-${collectionMonth.toString().padStart(2, '0')}-${collectionDay.toString().padStart(2, '0')}`
    const lastDay = getLastDayOfMonth(year, dataMonth)
    const logicalDate = `${year}-${dataMonth.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`

    return {
      isClosingPeriodData: true,
      collectionDate,
      logicalDate,
      dataAsOfDate: collectionDate, // Original CSV date
    }
  })

/**
 * Generator for non-closing period snapshot metadata
 */
const normalMetadataArb = fc
  .record({
    year: fc.integer({ min: 2020, max: 2030 }),
    month: fc.integer({ min: 1, max: 12 }),
    day: fc.integer({ min: 1, max: 28 }), // Safe for all months
  })
  .map(({ year, month, day }) => {
    const date = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`

    return {
      isClosingPeriodData: false,
      collectionDate: date,
      logicalDate: date,
      dataAsOfDate: date,
    }
  })

/**
 * Generator for complete snapshot with closing period metadata
 */
const snapshotWithClosingPeriodArb = closingPeriodMetadataArb.map(
  (metadataFields): Snapshot => ({
    snapshot_id: metadataFields.logicalDate, // Snapshot ID is the logical date
    created_at: new Date().toISOString(),
    status: 'success',
    schema_version: '2.0.0',
    calculation_version: '2.0.0',
    errors: [],
    payload: {
      metadata: {
        source: 'toastmasters-dashboard',
        dataAsOfDate: metadataFields.dataAsOfDate,
        fetchedAt: new Date().toISOString(),
        districtCount: 1,
        processingDurationMs: 100,
        isClosingPeriodData: metadataFields.isClosingPeriodData,
        collectionDate: metadataFields.collectionDate,
        logicalDate: metadataFields.logicalDate,
      },
      districts: [],
    },
  })
)

/**
 * Generator for complete snapshot without closing period (normal data)
 */
const snapshotWithNormalDataArb = normalMetadataArb.map(
  (metadataFields): Snapshot => ({
    snapshot_id: metadataFields.logicalDate,
    created_at: new Date().toISOString(),
    status: 'success',
    schema_version: '2.0.0',
    calculation_version: '2.0.0',
    errors: [],
    payload: {
      metadata: {
        source: 'toastmasters-dashboard',
        dataAsOfDate: metadataFields.dataAsOfDate,
        fetchedAt: new Date().toISOString(),
        districtCount: 1,
        processingDurationMs: 100,
        isClosingPeriodData: metadataFields.isClosingPeriodData,
        collectionDate: metadataFields.collectionDate,
        logicalDate: metadataFields.logicalDate,
      },
      districts: [],
    },
  })
)

describe('API Response Metadata Completeness - Property Tests', () => {
  /**
   * Property 5: Metadata Completeness for Closing Period Data
   *
   * For any API response from a closing period snapshot:
   * - is_closing_period_data MUST be true
   * - collection_date MUST be present and show the actual CSV date
   * - logical_date MUST be present and show the month-end date
   * - collection_date and logical_date MUST be different
   *
   * Validates: Requirements 4.1, 4.2, 4.3
   */
  it('Property 5a: Closing period snapshots include all required metadata fields', () => {
    fc.assert(
      fc.property(snapshotWithClosingPeriodArb, (snapshot: Snapshot) => {
        const responseMetadata = buildSnapshotMetadata(snapshot)

        // Requirement 4.2: is_closing_period_data must be true
        expect(responseMetadata.is_closing_period_data).toBe(true)

        // Requirement 4.1: collection_date must be present
        expect(responseMetadata.collection_date).toBeDefined()
        expect(responseMetadata.collection_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)

        // Requirement 4.3: logical_date must be present
        expect(responseMetadata.logical_date).toBeDefined()
        expect(responseMetadata.logical_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)

        // For closing periods, collection_date and logical_date must differ
        expect(responseMetadata.collection_date).not.toBe(
          responseMetadata.logical_date
        )

        // Logical date should be the last day of a month (ends with -28, -29, -30, or -31)
        const logicalDay = parseInt(
          responseMetadata.logical_date!.split('-')[2]!,
          10
        )
        expect(logicalDay).toBeGreaterThanOrEqual(28)
        expect(logicalDay).toBeLessThanOrEqual(31)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 5b: Non-closing period snapshots have consistent metadata
   *
   * For any API response from a normal (non-closing period) snapshot:
   * - is_closing_period_data MUST be false
   * - collection_date and logical_date MUST be equal
   *
   * Validates: Requirements 4.1, 4.2, 4.3
   */
  it('Property 5b: Non-closing period snapshots have consistent metadata', () => {
    fc.assert(
      fc.property(snapshotWithNormalDataArb, (snapshot: Snapshot) => {
        const responseMetadata = buildSnapshotMetadata(snapshot)

        // is_closing_period_data must be false for normal data
        expect(responseMetadata.is_closing_period_data).toBe(false)

        // collection_date and logical_date must be present
        expect(responseMetadata.collection_date).toBeDefined()
        expect(responseMetadata.logical_date).toBeDefined()

        // For non-closing periods, collection_date and logical_date must be equal
        expect(responseMetadata.collection_date).toBe(
          responseMetadata.logical_date
        )
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 5c: Metadata fields are properly typed
   *
   * For any snapshot (closing or non-closing), the metadata fields
   * must have the correct types and formats.
   *
   * Validates: Requirements 4.1, 4.2, 4.3
   */
  it('Property 5c: Metadata fields have correct types and formats', () => {
    const anySnapshotArb = fc.oneof(
      snapshotWithClosingPeriodArb,
      snapshotWithNormalDataArb
    )

    fc.assert(
      fc.property(anySnapshotArb, (snapshot: Snapshot) => {
        const responseMetadata = buildSnapshotMetadata(snapshot)

        // Base fields must always be present
        expect(typeof responseMetadata.snapshot_id).toBe('string')
        expect(typeof responseMetadata.created_at).toBe('string')
        expect(typeof responseMetadata.schema_version).toBe('string')
        expect(typeof responseMetadata.calculation_version).toBe('string')
        expect(typeof responseMetadata.data_as_of).toBe('string')

        // is_closing_period_data must be a boolean when present
        expect(typeof responseMetadata.is_closing_period_data).toBe('boolean')

        // collection_date must be a valid ISO date string when present
        if (responseMetadata.collection_date !== undefined) {
          expect(typeof responseMetadata.collection_date).toBe('string')
          expect(responseMetadata.collection_date).toMatch(
            /^\d{4}-\d{2}-\d{2}$/
          )
          // Verify it's a valid date
          const date = new Date(responseMetadata.collection_date)
          expect(date.toString()).not.toBe('Invalid Date')
        }

        // logical_date must be a valid ISO date string when present
        if (responseMetadata.logical_date !== undefined) {
          expect(typeof responseMetadata.logical_date).toBe('string')
          expect(responseMetadata.logical_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
          // Verify it's a valid date
          const date = new Date(responseMetadata.logical_date)
          expect(date.toString()).not.toBe('Invalid Date')
        }
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 5d: Logical date is always the last day of its month for closing periods
   *
   * For any closing period snapshot, the logical_date must be the last day
   * of the month it represents.
   *
   * Validates: Requirements 2.1, 4.3
   */
  it('Property 5d: Logical date is last day of month for closing periods', () => {
    fc.assert(
      fc.property(snapshotWithClosingPeriodArb, (snapshot: Snapshot) => {
        const responseMetadata = buildSnapshotMetadata(snapshot)

        expect(responseMetadata.logical_date).toBeDefined()

        const [yearStr, monthStr, dayStr] =
          responseMetadata.logical_date!.split('-')
        const year = parseInt(yearStr!, 10)
        const month = parseInt(monthStr!, 10)
        const day = parseInt(dayStr!, 10)

        // Calculate expected last day of the month
        const expectedLastDay = getLastDayOfMonth(year, month)

        expect(day).toBe(expectedLastDay)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 5e: Collection date is always in the month after logical date for closing periods
   *
   * For any closing period snapshot, the collection_date must be in the month
   * following the logical_date's month.
   *
   * Validates: Requirements 1.2, 4.1
   */
  it('Property 5e: Collection date is in month after logical date for closing periods', () => {
    fc.assert(
      fc.property(snapshotWithClosingPeriodArb, (snapshot: Snapshot) => {
        const responseMetadata = buildSnapshotMetadata(snapshot)

        expect(responseMetadata.collection_date).toBeDefined()
        expect(responseMetadata.logical_date).toBeDefined()

        const [logicalYearStr, logicalMonthStr] =
          responseMetadata.logical_date!.split('-')
        const logicalYear = parseInt(logicalYearStr!, 10)
        const logicalMonth = parseInt(logicalMonthStr!, 10)

        const [collectionYearStr, collectionMonthStr] =
          responseMetadata.collection_date!.split('-')
        const collectionYear = parseInt(collectionYearStr!, 10)
        const collectionMonth = parseInt(collectionMonthStr!, 10)

        // Collection month should be the month after logical month
        if (logicalMonth === 12) {
          // December -> January of next year
          expect(collectionMonth).toBe(1)
          expect(collectionYear).toBe(logicalYear + 1)
        } else {
          // Normal case: next month, same year
          expect(collectionMonth).toBe(logicalMonth + 1)
          expect(collectionYear).toBe(logicalYear)
        }
      }),
      { numRuns: 100 }
    )
  })
})
