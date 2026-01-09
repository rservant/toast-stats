/**
 * Unit Tests for AnalyticsUtils
 *
 * Tests shared utility functions used across analytics modules.
 *
 * Requirements: 5.2
 */

import { describe, it, expect } from 'vitest'
import {
  parseIntSafe,
  ensureString,
  getDCPCheckpoint,
  getCurrentProgramMonth,
  getMonthName,
  findPreviousProgramYearDate,
  calculatePercentageChange,
  determineTrend,
} from '../AnalyticsUtils.js'

describe('AnalyticsUtils', () => {
  describe('parseIntSafe', () => {
    it('should parse a valid integer string', () => {
      expect(parseIntSafe('42')).toBe(42)
      expect(parseIntSafe('0')).toBe(0)
      expect(parseIntSafe('-10')).toBe(-10)
    })

    it('should return the number when given a number', () => {
      expect(parseIntSafe(42)).toBe(42)
      expect(parseIntSafe(0)).toBe(0)
      expect(parseIntSafe(-10)).toBe(-10)
    })

    it('should floor floating point numbers', () => {
      expect(parseIntSafe(42.9)).toBe(42)
      expect(parseIntSafe(42.1)).toBe(42)
      expect(parseIntSafe(-10.9)).toBe(-11)
    })

    it('should return default value for null', () => {
      expect(parseIntSafe(null)).toBe(0)
      expect(parseIntSafe(null, 5)).toBe(5)
    })

    it('should return default value for undefined', () => {
      expect(parseIntSafe(undefined)).toBe(0)
      expect(parseIntSafe(undefined, 10)).toBe(10)
    })

    it('should return default value for invalid strings', () => {
      expect(parseIntSafe('abc')).toBe(0)
      expect(parseIntSafe('abc', 99)).toBe(99)
      expect(parseIntSafe('')).toBe(0)
    })

    it('should parse strings with leading numbers', () => {
      expect(parseIntSafe('42abc')).toBe(42)
    })
  })

  describe('ensureString', () => {
    it('should return string as-is', () => {
      expect(ensureString('hello')).toBe('hello')
      expect(ensureString('')).toBe('')
    })

    it('should convert number to string', () => {
      expect(ensureString(42)).toBe('42')
      expect(ensureString(0)).toBe('0')
      expect(ensureString(-10)).toBe('-10')
    })

    it('should return empty string for null', () => {
      expect(ensureString(null)).toBe('')
    })

    it('should return empty string for undefined', () => {
      expect(ensureString(undefined)).toBe('')
    })
  })

  describe('getDCPCheckpoint', () => {
    it('should return 0 for July (administrative checkpoint)', () => {
      expect(getDCPCheckpoint(7)).toBe(0)
    })

    it('should return 1 for August-September', () => {
      expect(getDCPCheckpoint(8)).toBe(1)
      expect(getDCPCheckpoint(9)).toBe(1)
    })

    it('should return 2 for October-November', () => {
      expect(getDCPCheckpoint(10)).toBe(2)
      expect(getDCPCheckpoint(11)).toBe(2)
    })

    it('should return 3 for December-January', () => {
      expect(getDCPCheckpoint(12)).toBe(3)
      expect(getDCPCheckpoint(1)).toBe(3)
    })

    it('should return 4 for February-March', () => {
      expect(getDCPCheckpoint(2)).toBe(4)
      expect(getDCPCheckpoint(3)).toBe(4)
    })

    it('should return 5 for April-June', () => {
      expect(getDCPCheckpoint(4)).toBe(5)
      expect(getDCPCheckpoint(5)).toBe(5)
      expect(getDCPCheckpoint(6)).toBe(5)
    })

    it('should throw error for invalid months', () => {
      expect(() => getDCPCheckpoint(0)).toThrow('Invalid month: 0')
      expect(() => getDCPCheckpoint(13)).toThrow('Invalid month: 13')
      expect(() => getDCPCheckpoint(-1)).toThrow('Invalid month: -1')
    })

    it('should have monotonically non-decreasing checkpoints through program year', () => {
      // Program year order: July(7) → Aug(8) → Sep(9) → Oct(10) → Nov(11) → Dec(12) → Jan(1) → Feb(2) → Mar(3) → Apr(4) → May(5) → Jun(6)
      const programYearOrder = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6]
      const checkpoints = programYearOrder.map(getDCPCheckpoint)

      for (let i = 1; i < checkpoints.length; i++) {
        expect(checkpoints[i]).toBeGreaterThanOrEqual(checkpoints[i - 1])
      }
    })
  })

  describe('getCurrentProgramMonth', () => {
    it('should return correct month for valid date strings', () => {
      // Note: Date parsing can be affected by timezone, so we test mid-month dates
      // to avoid edge cases at month boundaries
      expect(getCurrentProgramMonth('2024-01-15')).toBe(1)
      expect(getCurrentProgramMonth('2024-07-15')).toBe(7)
      expect(getCurrentProgramMonth('2024-12-15')).toBe(12)
    })

    it('should return current month when no date provided', () => {
      const result = getCurrentProgramMonth()
      expect(result).toBeGreaterThanOrEqual(1)
      expect(result).toBeLessThanOrEqual(12)
    })

    it('should throw error for invalid date strings', () => {
      expect(() => getCurrentProgramMonth('invalid')).toThrow(
        'Invalid date string'
      )
      expect(() => getCurrentProgramMonth('2024-13-01')).toThrow(
        'Invalid date string'
      )
    })
  })

  describe('getMonthName', () => {
    it('should return correct month names for all months', () => {
      expect(getMonthName(1)).toBe('January')
      expect(getMonthName(2)).toBe('February')
      expect(getMonthName(3)).toBe('March')
      expect(getMonthName(4)).toBe('April')
      expect(getMonthName(5)).toBe('May')
      expect(getMonthName(6)).toBe('June')
      expect(getMonthName(7)).toBe('July')
      expect(getMonthName(8)).toBe('August')
      expect(getMonthName(9)).toBe('September')
      expect(getMonthName(10)).toBe('October')
      expect(getMonthName(11)).toBe('November')
      expect(getMonthName(12)).toBe('December')
    })

    it('should return Unknown for invalid months', () => {
      expect(getMonthName(0)).toBe('Unknown')
      expect(getMonthName(13)).toBe('Unknown')
      expect(getMonthName(-1)).toBe('Unknown')
    })
  })

  describe('findPreviousProgramYearDate', () => {
    it('should return same date in previous year', () => {
      expect(findPreviousProgramYearDate('2024-07-15')).toBe('2023-07-15')
      expect(findPreviousProgramYearDate('2024-01-01')).toBe('2023-01-01')
      expect(findPreviousProgramYearDate('2024-12-31')).toBe('2023-12-31')
    })

    it('should handle leap year dates', () => {
      expect(findPreviousProgramYearDate('2024-02-29')).toBe('2023-02-29')
    })
  })

  describe('calculatePercentageChange', () => {
    it('should calculate positive percentage change', () => {
      expect(calculatePercentageChange(100, 150)).toBe(50)
      expect(calculatePercentageChange(50, 75)).toBe(50)
    })

    it('should calculate negative percentage change', () => {
      expect(calculatePercentageChange(100, 50)).toBe(-50)
      expect(calculatePercentageChange(200, 100)).toBe(-50)
    })

    it('should return 0 for no change', () => {
      expect(calculatePercentageChange(100, 100)).toBe(0)
    })

    it('should return 100 when previous is 0 and current is positive', () => {
      expect(calculatePercentageChange(0, 50)).toBe(100)
    })

    it('should return 0 when both values are 0', () => {
      expect(calculatePercentageChange(0, 0)).toBe(0)
    })

    it('should round to 1 decimal place', () => {
      expect(calculatePercentageChange(100, 133)).toBe(33)
      expect(calculatePercentageChange(3, 4)).toBe(33.3)
    })
  })

  describe('determineTrend', () => {
    it('should return stable for single value', () => {
      expect(determineTrend([100])).toBe('stable')
    })

    it('should return stable for empty array', () => {
      expect(determineTrend([])).toBe('stable')
    })

    it('should return increasing for clearly increasing values', () => {
      expect(determineTrend([100, 150, 200, 250])).toBe('increasing')
      expect(determineTrend([10, 20, 30])).toBe('increasing')
    })

    it('should return decreasing for clearly decreasing values', () => {
      expect(determineTrend([250, 200, 150, 100])).toBe('decreasing')
      expect(determineTrend([30, 20, 10])).toBe('decreasing')
    })

    it('should return stable for flat values', () => {
      expect(determineTrend([100, 100, 100, 100])).toBe('stable')
      expect(determineTrend([50, 50])).toBe('stable')
    })

    it('should return stable for small fluctuations', () => {
      expect(determineTrend([100, 101, 99, 100])).toBe('stable')
    })
  })
})
