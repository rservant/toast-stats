/**
 * Unit Tests for ClosingPeriodDetector
 *
 * Tests the closing period detection logic for Toastmasters month-end data.
 * Validates: Requirements 1.1, 1.2, 1.3, 5.4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  ClosingPeriodDetector,
  type Logger,
  type ClosingPeriodDetectorDependencies,
} from '../ClosingPeriodDetector.js'

describe('ClosingPeriodDetector', () => {
  let mockLogger: Logger
  let detector: ClosingPeriodDetector

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }

    const dependencies: ClosingPeriodDetectorDependencies = {
      logger: mockLogger,
    }

    detector = new ClosingPeriodDetector(dependencies)
  })

  describe('detect', () => {
    describe('normal data (same month) detection', () => {
      it('returns isClosingPeriod: false when data month equals CSV month', () => {
        const result = detector.detect('2024-03-15', '2024-03')

        expect(result.isClosingPeriod).toBe(false)
        expect(result.dataMonth).toBe('2024-03')
        expect(result.asOfDate).toBe('2024-03-15')
        expect(result.snapshotDate).toBe('2024-03-15')
        expect(result.collectionDate).toBe('2024-03-15')
      })

      it('returns isClosingPeriod: false for same month at month start', () => {
        const result = detector.detect('2024-06-01', '2024-06')

        expect(result.isClosingPeriod).toBe(false)
        expect(result.snapshotDate).toBe('2024-06-01')
      })

      it('returns isClosingPeriod: false for same month at month end', () => {
        const result = detector.detect('2024-06-30', '2024-06')

        expect(result.isClosingPeriod).toBe(false)
        expect(result.snapshotDate).toBe('2024-06-30')
      })
    })

    describe('closing period detection (data month < CSV month)', () => {
      it('detects closing period when data month is previous month', () => {
        const result = detector.detect('2024-03-05', '2024-02')

        expect(result.isClosingPeriod).toBe(true)
        expect(result.dataMonth).toBe('2024-02')
        expect(result.asOfDate).toBe('2024-03-05')
        expect(result.snapshotDate).toBe('2024-02-29') // 2024 is leap year
        expect(result.collectionDate).toBe('2024-03-05')
      })

      it('detects closing period when data month is two months prior', () => {
        const result = detector.detect('2024-05-10', '2024-03')

        expect(result.isClosingPeriod).toBe(true)
        expect(result.dataMonth).toBe('2024-03')
        expect(result.snapshotDate).toBe('2024-03-31')
      })

      it('logs closing period detection', () => {
        detector.detect('2024-03-05', '2024-02')

        expect(mockLogger.info).toHaveBeenCalledWith(
          'Closing period detected',
          expect.objectContaining({
            isClosingPeriod: true,
            csvDate: '2024-03-05',
            dataMonth: '2024-02',
          })
        )
      })
    })

    describe('cross-year boundary handling (December data in January)', () => {
      it('detects closing period for December data in January', () => {
        const result = detector.detect('2024-01-05', '2023-12')

        expect(result.isClosingPeriod).toBe(true)
        expect(result.dataMonth).toBe('2023-12')
        expect(result.snapshotDate).toBe('2023-12-31')
      })

      it('handles cross-year with MM format data month', () => {
        // When data month is "12" and CSV is January, should infer previous year
        const result = detector.detect('2024-01-05', '12')

        expect(result.isClosingPeriod).toBe(true)
        expect(result.dataMonth).toBe('2023-12')
        expect(result.snapshotDate).toBe('2023-12-31')
      })

      it('handles November data in January (two months prior, cross-year)', () => {
        const result = detector.detect('2024-01-15', '2023-11')

        expect(result.isClosingPeriod).toBe(true)
        expect(result.dataMonth).toBe('2023-11')
        expect(result.snapshotDate).toBe('2023-11-30')
      })
    })

    describe('February handling for leap year and non-leap year', () => {
      it('returns February 29 for leap year (2024)', () => {
        const result = detector.detect('2024-03-05', '2024-02')

        expect(result.isClosingPeriod).toBe(true)
        expect(result.snapshotDate).toBe('2024-02-29')
      })

      it('returns February 28 for non-leap year (2023)', () => {
        const result = detector.detect('2023-03-05', '2023-02')

        expect(result.isClosingPeriod).toBe(true)
        expect(result.snapshotDate).toBe('2023-02-28')
      })

      it('returns February 29 for leap year (2020)', () => {
        const result = detector.detect('2020-03-05', '2020-02')

        expect(result.isClosingPeriod).toBe(true)
        expect(result.snapshotDate).toBe('2020-02-29')
      })

      it('returns February 28 for century non-leap year (2100)', () => {
        const result = detector.detect('2100-03-05', '2100-02')

        expect(result.isClosingPeriod).toBe(true)
        expect(result.snapshotDate).toBe('2100-02-28')
      })

      it('returns February 29 for century leap year (2000)', () => {
        const result = detector.detect('2000-03-05', '2000-02')

        expect(result.isClosingPeriod).toBe(true)
        expect(result.snapshotDate).toBe('2000-02-29')
      })
    })

    describe('months with 30 and 31 days', () => {
      it('returns 30 for April', () => {
        const result = detector.detect('2024-05-05', '2024-04')

        expect(result.snapshotDate).toBe('2024-04-30')
      })

      it('returns 30 for June', () => {
        const result = detector.detect('2024-07-05', '2024-06')

        expect(result.snapshotDate).toBe('2024-06-30')
      })

      it('returns 30 for September', () => {
        const result = detector.detect('2024-10-05', '2024-09')

        expect(result.snapshotDate).toBe('2024-09-30')
      })

      it('returns 30 for November', () => {
        const result = detector.detect('2024-12-05', '2024-11')

        expect(result.snapshotDate).toBe('2024-11-30')
      })

      it('returns 31 for January', () => {
        const result = detector.detect('2024-02-05', '2024-01')

        expect(result.snapshotDate).toBe('2024-01-31')
      })

      it('returns 31 for March', () => {
        const result = detector.detect('2024-04-05', '2024-03')

        expect(result.snapshotDate).toBe('2024-03-31')
      })

      it('returns 31 for May', () => {
        const result = detector.detect('2024-06-05', '2024-05')

        expect(result.snapshotDate).toBe('2024-05-31')
      })

      it('returns 31 for July', () => {
        const result = detector.detect('2024-08-05', '2024-07')

        expect(result.snapshotDate).toBe('2024-07-31')
      })

      it('returns 31 for August', () => {
        const result = detector.detect('2024-09-05', '2024-08')

        expect(result.snapshotDate).toBe('2024-08-31')
      })

      it('returns 31 for October', () => {
        const result = detector.detect('2024-11-05', '2024-10')

        expect(result.snapshotDate).toBe('2024-10-31')
      })

      it('returns 31 for December', () => {
        const result = detector.detect('2025-01-05', '2024-12')

        expect(result.snapshotDate).toBe('2024-12-31')
      })
    })

    describe('invalid date format handling', () => {
      it('returns safe fallback for invalid CSV date', () => {
        const result = detector.detect('invalid-date', '2024-03')

        expect(result.isClosingPeriod).toBe(false)
        expect(result.asOfDate).toBe('invalid-date')
        expect(result.snapshotDate).toBe('invalid-date')
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Invalid CSV date format',
          expect.objectContaining({ csvDate: 'invalid-date' })
        )
      })

      it('returns safe fallback for empty CSV date', () => {
        const result = detector.detect('', '2024-03')

        expect(result.isClosingPeriod).toBe(false)
        expect(mockLogger.warn).toHaveBeenCalled()
      })
    })

    describe('invalid data month format handling', () => {
      it('returns safe fallback for invalid data month', () => {
        const result = detector.detect('2024-03-15', 'invalid')

        expect(result.isClosingPeriod).toBe(false)
        expect(result.dataMonth).toBe('invalid')
        expect(result.snapshotDate).toBe('2024-03-15')
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Invalid data month format, treating as non-closing period',
          expect.objectContaining({ dataMonth: 'invalid' })
        )
      })

      it('returns safe fallback for month 0', () => {
        const result = detector.detect('2024-03-15', '00')

        expect(result.isClosingPeriod).toBe(false)
        expect(mockLogger.warn).toHaveBeenCalled()
      })

      it('returns safe fallback for month 13', () => {
        const result = detector.detect('2024-03-15', '13')

        expect(result.isClosingPeriod).toBe(false)
        expect(mockLogger.warn).toHaveBeenCalled()
      })

      it('returns safe fallback for empty data month', () => {
        const result = detector.detect('2024-03-15', '')

        expect(result.isClosingPeriod).toBe(false)
        expect(mockLogger.warn).toHaveBeenCalled()
      })

      it('returns safe fallback for malformed YYYY-MM format', () => {
        const result = detector.detect('2024-03-15', '2024-')

        expect(result.isClosingPeriod).toBe(false)
        expect(mockLogger.warn).toHaveBeenCalled()
      })
    })

    describe('MM format data month handling', () => {
      it('infers same year when data month <= CSV month', () => {
        const result = detector.detect('2024-06-15', '05')

        expect(result.isClosingPeriod).toBe(true)
        expect(result.dataMonth).toBe('2024-05')
      })

      it('infers previous year when data month > CSV month', () => {
        const result = detector.detect('2024-02-15', '11')

        expect(result.isClosingPeriod).toBe(true)
        expect(result.dataMonth).toBe('2023-11')
      })
    })
  })

  describe('getLastDayOfMonth', () => {
    it('returns 31 for January', () => {
      expect(detector.getLastDayOfMonth(2024, 1)).toBe(31)
    })

    it('returns 29 for February in leap year', () => {
      expect(detector.getLastDayOfMonth(2024, 2)).toBe(29)
    })

    it('returns 28 for February in non-leap year', () => {
      expect(detector.getLastDayOfMonth(2023, 2)).toBe(28)
    })

    it('returns 31 for March', () => {
      expect(detector.getLastDayOfMonth(2024, 3)).toBe(31)
    })

    it('returns 30 for April', () => {
      expect(detector.getLastDayOfMonth(2024, 4)).toBe(30)
    })

    it('returns 31 for May', () => {
      expect(detector.getLastDayOfMonth(2024, 5)).toBe(31)
    })

    it('returns 30 for June', () => {
      expect(detector.getLastDayOfMonth(2024, 6)).toBe(30)
    })

    it('returns 31 for July', () => {
      expect(detector.getLastDayOfMonth(2024, 7)).toBe(31)
    })

    it('returns 31 for August', () => {
      expect(detector.getLastDayOfMonth(2024, 8)).toBe(31)
    })

    it('returns 30 for September', () => {
      expect(detector.getLastDayOfMonth(2024, 9)).toBe(30)
    })

    it('returns 31 for October', () => {
      expect(detector.getLastDayOfMonth(2024, 10)).toBe(31)
    })

    it('returns 30 for November', () => {
      expect(detector.getLastDayOfMonth(2024, 11)).toBe(30)
    })

    it('returns 31 for December', () => {
      expect(detector.getLastDayOfMonth(2024, 12)).toBe(31)
    })
  })

  describe('parseDataMonth', () => {
    it('parses YYYY-MM format correctly', () => {
      const result = detector.parseDataMonth('2024-03', 2024, 4)

      expect(result).toEqual({ year: 2024, month: 3 })
    })

    it('parses MM format with same year', () => {
      const result = detector.parseDataMonth('03', 2024, 4)

      expect(result).toEqual({ year: 2024, month: 3 })
    })

    it('parses MM format with previous year when data month > reference month', () => {
      const result = detector.parseDataMonth('12', 2024, 1)

      expect(result).toEqual({ year: 2023, month: 12 })
    })

    it('returns null for invalid month number', () => {
      expect(detector.parseDataMonth('13', 2024, 4)).toBeNull()
      expect(detector.parseDataMonth('00', 2024, 4)).toBeNull()
    })

    it('returns null for non-numeric input', () => {
      expect(detector.parseDataMonth('abc', 2024, 4)).toBeNull()
    })

    it('returns null for malformed YYYY-MM', () => {
      expect(detector.parseDataMonth('2024-', 2024, 4)).toBeNull()
      expect(detector.parseDataMonth('-03', 2024, 4)).toBeNull()
    })
  })
})
