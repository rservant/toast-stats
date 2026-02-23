/**
 * Unit Tests for ClosingPeriodDetector
 *
 * Tests the closing period detection and snapshot date calculation functionality
 * using well-chosen examples rather than property-based testing.
 *
 * Requirements:
 * - 1.3: WHEN cache metadata does not exist THEN the TransformService SHALL treat
 *        the data as non-closing-period data
 * - 2.1: WHEN `isClosingPeriod` is true THEN the TransformService SHALL calculate
 *        the last day of the data month
 * - 2.3: WHEN the data month is December and the collection date is in January
 *        THEN the snapshot SHALL be dated December 31 of the prior year
 * - 2.4: WHEN `isClosingPeriod` is false or undefined THEN the TransformService
 *        SHALL use the requested date as the snapshot date
 */

import { describe, it, expect } from 'vitest'
import { ClosingPeriodDetector } from '../utils/ClosingPeriodDetector.js'
import type { CacheMetadata } from '../types/index.js'

describe('ClosingPeriodDetector', () => {
  const detector = new ClosingPeriodDetector()

  describe('detect() with closing period metadata', () => {
    /**
     * Test valid metadata with isClosingPeriod: true and dataMonth: "2024-12"
     *
     * Requirements: 2.1
     */
    it('should detect closing period and calculate last day of December 2024', () => {
      const requestedDate = '2025-01-05'
      const metadata: CacheMetadata = {
        date: requestedDate,
        isClosingPeriod: true,
        dataMonth: '2024-12',
      }

      const result = detector.detect(requestedDate, metadata)

      expect(result.isClosingPeriod).toBe(true)
      expect(result.dataMonth).toBe('2024-12')
      expect(result.collectionDate).toBe('2025-01-05')
      expect(result.snapshotDate).toBe('2024-12-31')
      expect(result.logicalDate).toBe('2024-12-31')
    })

    /**
     * Test closing period for November data collected in December
     *
     * Requirements: 2.1
     */
    it('should detect closing period and calculate last day of November 2024', () => {
      const requestedDate = '2024-12-03'
      const metadata: CacheMetadata = {
        date: requestedDate,
        isClosingPeriod: true,
        dataMonth: '2024-11',
      }

      const result = detector.detect(requestedDate, metadata)

      expect(result.isClosingPeriod).toBe(true)
      expect(result.dataMonth).toBe('2024-11')
      expect(result.collectionDate).toBe('2024-12-03')
      expect(result.snapshotDate).toBe('2024-11-30')
      expect(result.logicalDate).toBe('2024-11-30')
    })

    /**
     * Test closing period for February data in a leap year
     *
     * Requirements: 2.1
     */
    it('should calculate February 29 for leap year closing period', () => {
      const requestedDate = '2024-03-02'
      const metadata: CacheMetadata = {
        date: requestedDate,
        isClosingPeriod: true,
        dataMonth: '2024-02',
      }

      const result = detector.detect(requestedDate, metadata)

      expect(result.isClosingPeriod).toBe(true)
      expect(result.dataMonth).toBe('2024-02')
      expect(result.snapshotDate).toBe('2024-02-29')
    })

    /**
     * Test closing period for February data in a non-leap year
     *
     * Requirements: 2.1
     */
    it('should calculate February 28 for non-leap year closing period', () => {
      const requestedDate = '2023-03-02'
      const metadata: CacheMetadata = {
        date: requestedDate,
        isClosingPeriod: true,
        dataMonth: '2023-02',
      }

      const result = detector.detect(requestedDate, metadata)

      expect(result.isClosingPeriod).toBe(true)
      expect(result.dataMonth).toBe('2023-02')
      expect(result.snapshotDate).toBe('2023-02-28')
    })
  })

  describe('detect() with non-closing period metadata', () => {
    /**
     * Test valid metadata with isClosingPeriod: false
     *
     * Requirements: 2.4
     */
    it('should use requested date when isClosingPeriod is false', () => {
      const requestedDate = '2024-06-15'
      const metadata: CacheMetadata = {
        date: requestedDate,
        isClosingPeriod: false,
        dataMonth: '2024-06',
      }

      const result = detector.detect(requestedDate, metadata)

      expect(result.isClosingPeriod).toBe(false)
      expect(result.dataMonth).toBe('2024-06')
      expect(result.collectionDate).toBe('2024-06-15')
      expect(result.snapshotDate).toBe('2024-06-15')
      expect(result.logicalDate).toBe('2024-06-15')
    })

    /**
     * Test metadata with isClosingPeriod: undefined
     *
     * Requirements: 2.4
     */
    it('should use requested date when isClosingPeriod is undefined', () => {
      const requestedDate = '2024-07-20'
      const metadata: CacheMetadata = {
        date: requestedDate,
        // isClosingPeriod is undefined
        dataMonth: '2024-07',
      }

      const result = detector.detect(requestedDate, metadata)

      expect(result.isClosingPeriod).toBe(false)
      expect(result.snapshotDate).toBe('2024-07-20')
      expect(result.logicalDate).toBe('2024-07-20')
    })

    /**
     * Test metadata with isClosingPeriod: true but missing dataMonth
     *
     * Requirements: 2.4 (falls back to non-closing period behavior)
     */
    it('should use requested date when isClosingPeriod is true but dataMonth is missing', () => {
      const requestedDate = '2024-08-10'
      const metadata: CacheMetadata = {
        date: requestedDate,
        isClosingPeriod: true,
        // dataMonth is missing
      }

      const result = detector.detect(requestedDate, metadata)

      expect(result.isClosingPeriod).toBe(false)
      expect(result.snapshotDate).toBe('2024-08-10')
    })
  })

  describe('detect() with null/missing metadata', () => {
    /**
     * Test with null metadata
     *
     * Requirements: 1.3
     */
    it('should treat null metadata as non-closing period', () => {
      const requestedDate = '2024-05-15'

      const result = detector.detect(requestedDate, null)

      expect(result.isClosingPeriod).toBe(false)
      expect(result.dataMonth).toBe('2024-05')
      expect(result.collectionDate).toBe('2024-05-15')
      expect(result.snapshotDate).toBe('2024-05-15')
      expect(result.logicalDate).toBe('2024-05-15')
    })

    /**
     * Test with empty metadata object (no fields set)
     *
     * Requirements: 1.3
     */
    it('should treat empty metadata as non-closing period', () => {
      const requestedDate = '2024-09-25'
      const metadata: CacheMetadata = {
        date: requestedDate,
      }

      const result = detector.detect(requestedDate, metadata)

      expect(result.isClosingPeriod).toBe(false)
      expect(result.snapshotDate).toBe('2024-09-25')
    })
  })

  describe('detect() cross-year scenario (December → January)', () => {
    /**
     * Test December data collected in January (cross-year scenario)
     *
     * Requirements: 2.3
     */
    it('should date snapshot as December 31 of prior year when December data collected in January', () => {
      const requestedDate = '2025-01-05'
      const metadata: CacheMetadata = {
        date: requestedDate,
        isClosingPeriod: true,
        dataMonth: '2024-12',
      }

      const result = detector.detect(requestedDate, metadata)

      expect(result.isClosingPeriod).toBe(true)
      expect(result.dataMonth).toBe('2024-12')
      expect(result.collectionDate).toBe('2025-01-05')
      expect(result.snapshotDate).toBe('2024-12-31')
      expect(result.logicalDate).toBe('2024-12-31')
    })

    /**
     * Test December data collected later in January
     *
     * Requirements: 2.3
     */
    it('should handle December data collected on January 15', () => {
      const requestedDate = '2025-01-15'
      const metadata: CacheMetadata = {
        date: requestedDate,
        isClosingPeriod: true,
        dataMonth: '2024-12',
      }

      const result = detector.detect(requestedDate, metadata)

      expect(result.snapshotDate).toBe('2024-12-31')
      expect(result.collectionDate).toBe('2025-01-15')
    })

    /**
     * Test cross-year with MM format dataMonth (December = 12)
     *
     * Requirements: 2.3
     */
    it('should handle MM format dataMonth for cross-year scenario', () => {
      const requestedDate = '2025-01-03'
      const metadata: CacheMetadata = {
        date: requestedDate,
        isClosingPeriod: true,
        dataMonth: '12', // MM format instead of YYYY-MM
      }

      const result = detector.detect(requestedDate, metadata)

      expect(result.isClosingPeriod).toBe(true)
      // When dataMonth is "12" and collection is in January 2025,
      // the detector should infer December 2024
      expect(result.snapshotDate).toBe('2024-12-31')
    })

    /**
     * Test multiple years - December 2023 collected in January 2024
     *
     * Requirements: 2.3
     */
    it('should handle December 2023 data collected in January 2024', () => {
      const requestedDate = '2024-01-08'
      const metadata: CacheMetadata = {
        date: requestedDate,
        isClosingPeriod: true,
        dataMonth: '2023-12',
      }

      const result = detector.detect(requestedDate, metadata)

      expect(result.snapshotDate).toBe('2023-12-31')
      expect(result.dataMonth).toBe('2023-12')
    })
  })

  describe('getLastDayOfMonth()', () => {
    /**
     * Test 31-day months
     */
    it('should return 31 for January', () => {
      expect(detector.getLastDayOfMonth(2024, 1)).toBe(31)
    })

    it('should return 31 for March', () => {
      expect(detector.getLastDayOfMonth(2024, 3)).toBe(31)
    })

    it('should return 31 for December', () => {
      expect(detector.getLastDayOfMonth(2024, 12)).toBe(31)
    })

    /**
     * Test 30-day months
     */
    it('should return 30 for April', () => {
      expect(detector.getLastDayOfMonth(2024, 4)).toBe(30)
    })

    it('should return 30 for November', () => {
      expect(detector.getLastDayOfMonth(2024, 11)).toBe(30)
    })

    /**
     * Test February in leap years
     */
    it('should return 29 for February 2024 (leap year)', () => {
      expect(detector.getLastDayOfMonth(2024, 2)).toBe(29)
    })

    it('should return 29 for February 2000 (leap year - divisible by 400)', () => {
      expect(detector.getLastDayOfMonth(2000, 2)).toBe(29)
    })

    /**
     * Test February in non-leap years
     */
    it('should return 28 for February 2023 (non-leap year)', () => {
      expect(detector.getLastDayOfMonth(2023, 2)).toBe(28)
    })

    it('should return 28 for February 1900 (non-leap year - divisible by 100 but not 400)', () => {
      expect(detector.getLastDayOfMonth(1900, 2)).toBe(28)
    })
  })

  describe('parseDataMonth()', () => {
    /**
     * Test YYYY-MM format parsing
     */
    it('should parse YYYY-MM format correctly', () => {
      const result = detector.parseDataMonth('2024-06', 2024, 7)

      expect(result).toEqual({ year: 2024, month: 6 })
    })

    it('should parse YYYY-MM format with different year', () => {
      const result = detector.parseDataMonth('2023-12', 2024, 1)

      expect(result).toEqual({ year: 2023, month: 12 })
    })

    /**
     * Test MM format parsing with cross-year detection
     */
    it('should infer previous year when MM format month > reference month', () => {
      // December (12) data collected in January (1) of 2025
      const result = detector.parseDataMonth('12', 2025, 1)

      expect(result).toEqual({ year: 2024, month: 12 })
    })

    it('should use same year when MM format month <= reference month', () => {
      // June (6) data collected in July (7) of 2024
      const result = detector.parseDataMonth('06', 2024, 7)

      expect(result).toEqual({ year: 2024, month: 6 })
    })

    /**
     * Test invalid inputs
     */
    it('should return null for invalid month number', () => {
      const result = detector.parseDataMonth('13', 2024, 1)

      expect(result).toBeNull()
    })

    it('should return null for month 0', () => {
      const result = detector.parseDataMonth('00', 2024, 1)

      expect(result).toBeNull()
    })

    it('should return null for non-numeric input', () => {
      const result = detector.parseDataMonth('abc', 2024, 1)

      expect(result).toBeNull()
    })

    it('should return null for empty string', () => {
      const result = detector.parseDataMonth('', 2024, 1)

      expect(result).toBeNull()
    })

    it('should return null for malformed YYYY-MM format', () => {
      const result = detector.parseDataMonth('2024-', 2024, 1)

      expect(result).toBeNull()
    })
  })

  describe('edge cases and error handling', () => {
    /**
     * Test invalid requested date handling
     */
    it('should fall back to non-closing period for invalid requested date', () => {
      const requestedDate = 'invalid-date'
      const metadata: CacheMetadata = {
        date: requestedDate,
        isClosingPeriod: true,
        dataMonth: '2024-12',
      }

      const result = detector.detect(requestedDate, metadata)

      expect(result.isClosingPeriod).toBe(false)
      expect(result.snapshotDate).toBe('invalid-date')
    })

    /**
     * Test invalid dataMonth format handling
     */
    it('should fall back to non-closing period for invalid dataMonth format', () => {
      const requestedDate = '2024-06-15'
      const metadata: CacheMetadata = {
        date: requestedDate,
        isClosingPeriod: true,
        dataMonth: 'invalid-month',
      }

      const result = detector.detect(requestedDate, metadata)

      expect(result.isClosingPeriod).toBe(false)
      expect(result.snapshotDate).toBe('2024-06-15')
    })

    /**
     * Test consistency: logicalDate always equals snapshotDate
     */
    it('should always have logicalDate equal to snapshotDate for closing periods', () => {
      const requestedDate = '2024-12-05'
      const metadata: CacheMetadata = {
        date: requestedDate,
        isClosingPeriod: true,
        dataMonth: '2024-11',
      }

      const result = detector.detect(requestedDate, metadata)

      expect(result.logicalDate).toBe(result.snapshotDate)
    })

    it('should always have logicalDate equal to snapshotDate for non-closing periods', () => {
      const requestedDate = '2024-06-15'
      const metadata: CacheMetadata = {
        date: requestedDate,
        isClosingPeriod: false,
      }

      const result = detector.detect(requestedDate, metadata)

      expect(result.logicalDate).toBe(result.snapshotDate)
    })
  })
})
