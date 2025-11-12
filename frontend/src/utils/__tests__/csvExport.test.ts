import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateFilename } from '../csvExport'

describe('csvExport', () => {
  describe('generateFilename', () => {
    beforeEach(() => {
      // Mock Date to return consistent value
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should generate filename with data type, district ID, and date', () => {
      const filename = generateFilename('membership_history', 'D123')

      expect(filename).toBe('membership_history_district_D123_2024-01-15.csv')
    })

    it('should generate filename for clubs export', () => {
      const filename = generateFilename('clubs', 'D456')

      expect(filename).toBe('clubs_district_D456_2024-01-15.csv')
    })

    it('should generate filename for educational awards', () => {
      const filename = generateFilename('educational_awards', 'D789')

      expect(filename).toBe('educational_awards_district_D789_2024-01-15.csv')
    })

    it('should generate filename for daily reports', () => {
      const filename = generateFilename('daily_reports', 'D101')

      expect(filename).toBe('daily_reports_district_D101_2024-01-15.csv')
    })
  })
})
