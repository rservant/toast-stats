import { describe, it, expect, vi } from 'vitest'
import { generateFilename } from '../csvExport'

describe('csvExport', () => {
  describe('generateFilename', () => {
    it('should generate filename with data type, district ID, and date', () => {
      // Mock Date to return consistent value
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'))

      const filename = generateFilename('membership_history', 'D123')

      expect(filename).toBe('membership_history_district_D123_2024-01-15.csv')

      vi.useRealTimers()
    })

    it('should generate filename for clubs export', () => {
      // Mock Date to return consistent value
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'))

      const filename = generateFilename('clubs', 'D456')

      expect(filename).toBe('clubs_district_D456_2024-01-15.csv')

      vi.useRealTimers()
    })

    it('should generate filename for educational awards', () => {
      // Mock Date to return consistent value
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'))

      const filename = generateFilename('educational_awards', 'D789')

      expect(filename).toBe('educational_awards_district_D789_2024-01-15.csv')

      vi.useRealTimers()
    })

    it('should generate filename for daily reports', () => {
      // Mock Date to return consistent value
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'))

      const filename = generateFilename('daily_reports', 'D101')

      expect(filename).toBe('daily_reports_district_D101_2024-01-15.csv')

      vi.useRealTimers()
    })
  })
})
