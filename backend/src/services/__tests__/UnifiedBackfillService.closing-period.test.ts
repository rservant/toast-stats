/**
 * Tests for UnifiedBackfillService closing period detection
 *
 * These tests verify that the backfill service correctly handles month-end
 * reconciliation CSVs by detecting closing periods and using the appropriate
 * snapshot date (last day of the data month) instead of the collection date.
 *
 * Feature: Month-end reconciliation CSV processing
 * Requirement: When a CSV is for a prior month with an "as of" date in the next month,
 *              the snapshot should be dated as the last day of the prior month.
 *
 * Strategy: Month-end dates (last day of month) are SKIPPED during backfill.
 *           Closing period data from the following month naturally fills in the month-end snapshot.
 *           Example: 2026-01-06 CSV with dataMonth="2025-12" creates the 2025-12-31 snapshot.
 */

import { describe, it, expect } from 'vitest'
import { BackfillService } from '../UnifiedBackfillService.js'

describe('UnifiedBackfillService Closing Period Detection', () => {
  /**
   * Access the private detectClosingPeriodFromMetadata method for testing
   */
  function getDetectClosingPeriodMethod(service: BackfillService) {
    return (
      service as unknown as {
        detectClosingPeriodFromMetadata: (
          requestedDate: string,
          actualCsvDate: string,
          dataMonth?: string,
          isClosingPeriod?: boolean
        ) => {
          isClosingPeriod: boolean
          dataMonth: string
          snapshotDate: string
          collectionDate: string
        }
      }
    ).detectClosingPeriodFromMetadata.bind(service)
  }

  /**
   * Access the private isLastDayOfMonth method for testing
   */
  function getIsLastDayOfMonthMethod(service: BackfillService) {
    return (
      service as unknown as {
        isLastDayOfMonth: (dateString: string) => boolean
      }
    ).isLastDayOfMonth.bind(service)
  }

  // Create a minimal mock service for testing the detection method
  function createMockService(): BackfillService {
    // We need to create a minimal instance to access the method
    // The method doesn't use any instance state, so we can use a partial mock
    const mockRefreshService = {} as Parameters<
      (typeof BackfillService)['prototype']['constructor']
    >[0]
    const mockSnapshotStore = {} as Parameters<
      (typeof BackfillService)['prototype']['constructor']
    >[1]
    const mockConfigService = {
      getConfiguration: async () => ({ districts: [] }),
    } as Parameters<(typeof BackfillService)['prototype']['constructor']>[2]

    // Create service with minimal mocks - the method we're testing doesn't use these
    return new BackfillService(
      mockRefreshService,
      mockSnapshotStore,
      mockConfigService
    )
  }

  describe('isLastDayOfMonth', () => {
    it('should return true for December 31', () => {
      const service = createMockService()
      const isLastDayOfMonth = getIsLastDayOfMonthMethod(service)
      expect(isLastDayOfMonth('2025-12-31')).toBe(true)
    })

    it('should return true for November 30', () => {
      const service = createMockService()
      const isLastDayOfMonth = getIsLastDayOfMonthMethod(service)
      expect(isLastDayOfMonth('2025-11-30')).toBe(true)
    })

    it('should return true for February 28 (non-leap year)', () => {
      const service = createMockService()
      const isLastDayOfMonth = getIsLastDayOfMonthMethod(service)
      expect(isLastDayOfMonth('2025-02-28')).toBe(true)
    })

    it('should return true for February 29 (leap year)', () => {
      const service = createMockService()
      const isLastDayOfMonth = getIsLastDayOfMonthMethod(service)
      expect(isLastDayOfMonth('2024-02-29')).toBe(true)
    })

    it('should return false for mid-month dates', () => {
      const service = createMockService()
      const isLastDayOfMonth = getIsLastDayOfMonthMethod(service)
      expect(isLastDayOfMonth('2025-12-15')).toBe(false)
      expect(isLastDayOfMonth('2025-01-01')).toBe(false)
      expect(isLastDayOfMonth('2025-06-15')).toBe(false)
    })

    it('should return false for February 28 in leap year', () => {
      const service = createMockService()
      const isLastDayOfMonth = getIsLastDayOfMonthMethod(service)
      expect(isLastDayOfMonth('2024-02-28')).toBe(false) // 2024 is a leap year
    })
  })

  describe('detectClosingPeriodFromMetadata', () => {
    describe('with explicit closing period metadata', () => {
      it('should detect closing period when cache metadata indicates closing period', () => {
        const service = createMockService()
        const detectClosingPeriod = getDetectClosingPeriodMethod(service)

        // Scenario: December 2025 data collected on January 3, 2026
        const result = detectClosingPeriod(
          '2025-12-31', // requested date
          '2026-01-03', // actual CSV date (collection date)
          '2025-12', // data month from cache metadata
          true // isClosingPeriod from cache metadata
        )

        expect(result.isClosingPeriod).toBe(true)
        expect(result.dataMonth).toBe('2025-12')
        expect(result.snapshotDate).toBe('2025-12-31') // Last day of December
        expect(result.collectionDate).toBe('2026-01-03')
      })

      it('should use last day of data month for closing period snapshot date', () => {
        const service = createMockService()
        const detectClosingPeriod = getDetectClosingPeriodMethod(service)

        // Scenario: November 2025 data collected on December 2, 2025
        const result = detectClosingPeriod(
          '2025-11-30', // requested date
          '2025-12-02', // actual CSV date
          '2025-11', // data month
          true // isClosingPeriod
        )

        expect(result.isClosingPeriod).toBe(true)
        expect(result.snapshotDate).toBe('2025-11-30') // Last day of November
      })

      it('should handle February correctly (non-leap year)', () => {
        const service = createMockService()
        const detectClosingPeriod = getDetectClosingPeriodMethod(service)

        // Scenario: February 2025 data (non-leap year)
        const result = detectClosingPeriod(
          '2025-02-28',
          '2025-03-02',
          '2025-02',
          true
        )

        expect(result.isClosingPeriod).toBe(true)
        expect(result.snapshotDate).toBe('2025-02-28')
      })

      it('should handle February correctly (leap year)', () => {
        const service = createMockService()
        const detectClosingPeriod = getDetectClosingPeriodMethod(service)

        // Scenario: February 2024 data (leap year)
        const result = detectClosingPeriod(
          '2024-02-29',
          '2024-03-02',
          '2024-02',
          true
        )

        expect(result.isClosingPeriod).toBe(true)
        expect(result.snapshotDate).toBe('2024-02-29')
      })
    })

    describe('with implicit closing period detection (no cache metadata)', () => {
      it('should detect closing period when CSV date is in a later month than requested', () => {
        const service = createMockService()
        const detectClosingPeriod = getDetectClosingPeriodMethod(service)

        // Scenario: Requested December 31, but CSV is from January
        const result = detectClosingPeriod(
          '2025-12-31', // requested date
          '2026-01-05', // actual CSV date (in January)
          undefined, // no dataMonth metadata
          undefined // no isClosingPeriod metadata
        )

        expect(result.isClosingPeriod).toBe(true)
        expect(result.snapshotDate).toBe('2025-12-31') // Last day of requested month
      })

      it('should detect closing period across year boundary', () => {
        const service = createMockService()
        const detectClosingPeriod = getDetectClosingPeriodMethod(service)

        // Scenario: December 2025 data collected in January 2026
        const result = detectClosingPeriod(
          '2025-12-15', // requested date in December 2025
          '2026-01-03', // actual CSV date in January 2026
          undefined,
          undefined
        )

        expect(result.isClosingPeriod).toBe(true)
        expect(result.dataMonth).toBe('2025-12')
        expect(result.snapshotDate).toBe('2025-12-31')
      })
    })

    describe('non-closing period scenarios', () => {
      it('should not detect closing period when dates are in same month', () => {
        const service = createMockService()
        const detectClosingPeriod = getDetectClosingPeriodMethod(service)

        // Scenario: Normal data collection within the same month
        const result = detectClosingPeriod(
          '2025-12-15',
          '2025-12-17',
          undefined,
          undefined
        )

        expect(result.isClosingPeriod).toBe(false)
        expect(result.snapshotDate).toBe('2025-12-17') // Use actual CSV date
      })

      it('should not detect closing period when explicitly marked as not closing period', () => {
        const service = createMockService()
        const detectClosingPeriod = getDetectClosingPeriodMethod(service)

        const result = detectClosingPeriod(
          '2025-12-31',
          '2025-12-31',
          '2025-12',
          false // explicitly not a closing period
        )

        expect(result.isClosingPeriod).toBe(false)
        expect(result.snapshotDate).toBe('2025-12-31')
      })
    })

    describe('edge cases', () => {
      it('should handle same date for requested and actual', () => {
        const service = createMockService()
        const detectClosingPeriod = getDetectClosingPeriodMethod(service)

        const result = detectClosingPeriod(
          '2025-12-31',
          '2025-12-31',
          undefined,
          undefined
        )

        expect(result.isClosingPeriod).toBe(false)
        expect(result.snapshotDate).toBe('2025-12-31')
      })

      it('should handle months with 31 days', () => {
        const service = createMockService()
        const detectClosingPeriod = getDetectClosingPeriodMethod(service)

        const result = detectClosingPeriod(
          '2025-01-31',
          '2025-02-02',
          '2025-01',
          true
        )

        expect(result.snapshotDate).toBe('2025-01-31')
      })

      it('should handle months with 30 days', () => {
        const service = createMockService()
        const detectClosingPeriod = getDetectClosingPeriodMethod(service)

        const result = detectClosingPeriod(
          '2025-04-30',
          '2025-05-02',
          '2025-04',
          true
        )

        expect(result.snapshotDate).toBe('2025-04-30')
      })
    })
  })

  describe('Month-end snapshot strategy', () => {
    /**
     * These tests document the expected behavior for month-end snapshots:
     *
     * 1. Month-end dates (last day of month) are SKIPPED during backfill
     * 2. Closing period data from the following month creates the month-end snapshot
     * 3. Existing snapshots with newer collection dates are NOT overwritten
     *
     * Example flow:
     * - Backfill requests 2025-12-30 through 2026-01-07
     * - 2025-12-31 is skipped (last day of month)
     * - 2026-01-06 has closing period data (dataMonth: "2025-12")
     * - 2026-01-06 creates snapshot for 2025-12-31 (if no newer exists)
     */

    it('should skip month-end dates during backfill', () => {
      const service = createMockService()
      const isLastDayOfMonth = getIsLastDayOfMonthMethod(service)

      // These dates should be skipped
      expect(isLastDayOfMonth('2025-12-31')).toBe(true)
      expect(isLastDayOfMonth('2025-11-30')).toBe(true)
      expect(isLastDayOfMonth('2025-02-28')).toBe(true)

      // These dates should NOT be skipped
      expect(isLastDayOfMonth('2025-12-30')).toBe(false)
      expect(isLastDayOfMonth('2026-01-06')).toBe(false)
    })

    it('should map closing period data to month-end snapshot date', () => {
      const service = createMockService()
      const detectClosingPeriod = getDetectClosingPeriodMethod(service)

      // 2026-01-06 CSV with December 2025 data should create 2025-12-31 snapshot
      const result = detectClosingPeriod(
        '2026-01-06', // requested date
        '2026-01-06', // actual CSV date
        '2025-12', // data month from cache metadata
        true // is closing period
      )

      expect(result.isClosingPeriod).toBe(true)
      expect(result.snapshotDate).toBe('2025-12-31')
      expect(result.dataMonth).toBe('2025-12')
      expect(result.collectionDate).toBe('2026-01-06')
    })
  })
})
