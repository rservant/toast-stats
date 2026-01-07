import { describe, it, expect } from 'vitest'
import {
  parseLocalDate,
  formatDisplayDate,
  formatShortDate,
  formatLongDate,
} from '../dateFormatting'

describe('dateFormatting', () => {
  describe('parseLocalDate', () => {
    it('parses ISO date string as local date, not UTC', () => {
      // This is the core bug fix: "2025-07-23" should parse as July 23, not July 22
      const date = parseLocalDate('2025-07-23')

      // The date should be July 23 regardless of timezone
      expect(date.getDate()).toBe(23)
      expect(date.getMonth()).toBe(6) // July is month 6 (0-indexed)
      expect(date.getFullYear()).toBe(2025)
    })

    it('handles year boundaries correctly', () => {
      const date = parseLocalDate('2025-01-01')
      expect(date.getDate()).toBe(1)
      expect(date.getMonth()).toBe(0) // January
      expect(date.getFullYear()).toBe(2025)
    })

    it('handles end of month correctly', () => {
      const date = parseLocalDate('2025-07-31')
      expect(date.getDate()).toBe(31)
      expect(date.getMonth()).toBe(6) // July
    })
  })

  describe('formatDisplayDate', () => {
    it('formats date correctly without timezone shift', () => {
      // The formatted date should show July 23, not July 22
      const formatted = formatDisplayDate('2025-07-23')
      expect(formatted).toContain('Jul')
      expect(formatted).toContain('23')
      expect(formatted).toContain('2025')
    })

    it('accepts custom format options', () => {
      const formatted = formatDisplayDate('2025-07-23', {
        month: 'long',
        day: 'numeric',
      })
      expect(formatted).toContain('July')
      expect(formatted).toContain('23')
    })
  })

  describe('formatShortDate', () => {
    it('formats as month and day only', () => {
      const formatted = formatShortDate('2025-07-23')
      expect(formatted).toContain('Jul')
      expect(formatted).toContain('23')
      expect(formatted).not.toContain('2025')
    })
  })

  describe('formatLongDate', () => {
    it('formats with full month name', () => {
      const formatted = formatLongDate('2025-07-23')
      expect(formatted).toContain('July')
      expect(formatted).toContain('23')
      expect(formatted).toContain('2025')
    })
  })
})
