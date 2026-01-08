/**
 * Tests for ToastmastersScraper.extractClosingPeriodFromCSV
 *
 * These tests verify that the scraper correctly extracts closing period
 * information from CSV footer lines like "Month of Dec, As of 01/06/2026"
 *
 * Bug fix: Ensures that cached CSV files with incorrect metadata are
 * corrected by re-parsing the CSV footer on cache hit.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ToastmastersScraper } from '../ToastmastersScraper.js'
import { IRawCSVCacheService } from '../../types/serviceInterfaces.js'
import { CSVType, CacheMetadata } from '../../types/rawCSVCache.js'

describe('ToastmastersScraper.extractClosingPeriodFromCSV', () => {
  /**
   * Access the private extractClosingPeriodFromCSV method for testing
   */
  function getExtractMethod(scraper: ToastmastersScraper) {
    return (
      scraper as unknown as {
        extractClosingPeriodFromCSV: (csvContent: string) => {
          dataMonth?: string
          collectionDate?: string
        } | null
      }
    ).extractClosingPeriodFromCSV.bind(scraper)
  }

  // Create a minimal mock cache service
  function createMockCacheService(): IRawCSVCacheService {
    return {
      getCachedCSV: async () => null,
      setCachedCSV: async () => {},
      setCachedCSVWithMetadata: async () => {},
      getCacheMetadata: async () => null,
      listCachedDates: async () => [],
      deleteCachedDate: async () => false,
      getCacheStats: async () => ({
        totalDates: 0,
        totalFiles: 0,
        totalSizeBytes: 0,
        oldestDate: null,
        newestDate: null,
      }),
    }
  }

  let scraper: ToastmastersScraper

  beforeEach(() => {
    scraper = new ToastmastersScraper(createMockCacheService())
  })

  afterEach(async () => {
    await scraper.closeBrowser()
  })

  describe('December closing period (year boundary)', () => {
    it('should extract December 2025 data from January 2026 collection', () => {
      const extractClosingPeriod = getExtractMethod(scraper)

      // This is the exact scenario from the bug report
      // CSV footer: "Month of Dec, As of 01/06/2026"
      const csvContent = `"Region","District","Paid","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar","Apr","May","Jun","Total","Payments Base","Payments Growth","Payments Growth %","Clubs Base","Clubs Current","Clubs Growth","Clubs Growth %"
"1","1","Y","Y","Y","Y","N","1234","567","8901","0","123","4567","8901","-12.34%","100","95","-5%","105","0","0","0","0","0","0%"
Month of Dec, As of 01/06/2026`

      const result = extractClosingPeriod(csvContent)

      expect(result).not.toBeNull()
      expect(result?.dataMonth).toBe('2025-12') // December 2025
      expect(result?.collectionDate).toBe('2026-01-06') // January 6, 2026
    })

    it('should handle December data collected on January 1', () => {
      const extractClosingPeriod = getExtractMethod(scraper)

      const csvContent = `"data","row"
Month of Dec, As of 01/01/2026`

      const result = extractClosingPeriod(csvContent)

      expect(result).not.toBeNull()
      expect(result?.dataMonth).toBe('2025-12')
      expect(result?.collectionDate).toBe('2026-01-01')
    })

    it('should handle December data collected on January 7', () => {
      const extractClosingPeriod = getExtractMethod(scraper)

      const csvContent = `"data","row"
Month of Dec, As of 01/07/2026`

      const result = extractClosingPeriod(csvContent)

      expect(result).not.toBeNull()
      expect(result?.dataMonth).toBe('2025-12')
      expect(result?.collectionDate).toBe('2026-01-07')
    })
  })

  describe('same-year closing periods', () => {
    it('should extract November data from December collection', () => {
      const extractClosingPeriod = getExtractMethod(scraper)

      const csvContent = `"data","row"
Month of Nov, As of 12/03/2025`

      const result = extractClosingPeriod(csvContent)

      expect(result).not.toBeNull()
      expect(result?.dataMonth).toBe('2025-11')
      expect(result?.collectionDate).toBe('2025-12-03')
    })

    it('should extract June data from July collection', () => {
      const extractClosingPeriod = getExtractMethod(scraper)

      const csvContent = `"data","row"
Month of Jun, As of 07/05/2025`

      const result = extractClosingPeriod(csvContent)

      expect(result).not.toBeNull()
      expect(result?.dataMonth).toBe('2025-06')
      expect(result?.collectionDate).toBe('2025-07-05')
    })
  })

  describe('non-closing period scenarios', () => {
    it('should extract same-month data correctly', () => {
      const extractClosingPeriod = getExtractMethod(scraper)

      // Data for January collected in January
      const csvContent = `"data","row"
Month of Jan, As of 01/15/2026`

      const result = extractClosingPeriod(csvContent)

      expect(result).not.toBeNull()
      expect(result?.dataMonth).toBe('2026-01')
      expect(result?.collectionDate).toBe('2026-01-15')
    })
  })

  describe('edge cases', () => {
    it('should return null for CSV without footer', () => {
      const extractClosingPeriod = getExtractMethod(scraper)

      const csvContent = `"Region","District","Data"
"1","1","value"
"1","2","value"`

      const result = extractClosingPeriod(csvContent)

      expect(result).toBeNull()
    })

    it('should return null for empty CSV', () => {
      const extractClosingPeriod = getExtractMethod(scraper)

      const result = extractClosingPeriod('')

      expect(result).toBeNull()
    })

    it('should handle footer with extra whitespace', () => {
      const extractClosingPeriod = getExtractMethod(scraper)

      const csvContent = `"data","row"
Month of Dec,  As of 01/06/2026`

      const result = extractClosingPeriod(csvContent)

      expect(result).not.toBeNull()
      expect(result?.dataMonth).toBe('2025-12')
    })

    it('should handle all month abbreviations', () => {
      const extractClosingPeriod = getExtractMethod(scraper)
      const months = [
        { abbr: 'Jan', num: '01', year: '2026' },
        { abbr: 'Feb', num: '02', year: '2026' },
        { abbr: 'Mar', num: '03', year: '2026' },
        { abbr: 'Apr', num: '04', year: '2026' },
        { abbr: 'May', num: '05', year: '2026' },
        { abbr: 'Jun', num: '06', year: '2026' },
        { abbr: 'Jul', num: '07', year: '2026' },
        { abbr: 'Aug', num: '08', year: '2026' },
        { abbr: 'Sep', num: '09', year: '2026' },
        { abbr: 'Oct', num: '10', year: '2026' },
        { abbr: 'Nov', num: '11', year: '2026' },
        { abbr: 'Dec', num: '12', year: '2025' }, // Dec collected in Jan = previous year
      ]

      for (const month of months) {
        const csvContent = `"data"
Month of ${month.abbr}, As of 01/15/2026`

        const result = extractClosingPeriod(csvContent)

        expect(result).not.toBeNull()
        expect(result?.dataMonth).toBe(`${month.year}-${month.num}`)
      }
    })
  })

  describe('bug fix verification: 2026-01-01 scenario', () => {
    /**
     * This test verifies the specific bug scenario:
     * - Cache has CSV for 2026-01-01 with footer "Month of Dec, As of 01/06/2026"
     * - Metadata incorrectly has isClosingPeriod: false, dataMonth: "2026-01"
     * - The fix should detect this is actually December 2025 closing period data
     */
    it('should correctly identify December 2025 closing period from 2026-01-01 cached CSV', () => {
      const extractClosingPeriod = getExtractMethod(scraper)

      // Simulated CSV content from 2026-01-01 cache
      // Footer indicates this is December 2025 data collected on January 6, 2026
      const csvContent = `"Region","District","Paid","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar","Apr","May","Jun","Total","Payments Base","Payments Growth","Payments Growth %","Clubs Base","Clubs Current","Clubs Growth","Clubs Growth %"
"13","120","Y","Y","Y","Y","N","1073","213","2924","0","130","4340","8748","-50.39%","182","174","-4.4%","187","0","0","0","0","0","0%"
"13","121","Y","Y","Y","Y","N","1087","106","2700","2","190","4085","8416","-51.46%","174","154","-11.49%","181","0","0","0","0","0","0%"
"14","67","Y","Y","Y","Y","N","438","534","2081","0","40","3093","5377","-42.48%","172","161","-6.4%","173","0","0","0","0","0","0%"
"DNAR","U","N","N","N","N","N","177","77","408","5","20","687","1512","-54.56%","43","34","-20.93%","43","0","0","0","0","0","0%"
Month of Dec, As of 01/06/2026`

      const result = extractClosingPeriod(csvContent)

      // The fix should correctly extract:
      expect(result).not.toBeNull()
      expect(result?.dataMonth).toBe('2025-12') // December 2025, NOT January 2026
      expect(result?.collectionDate).toBe('2026-01-06')

      // Verify the closing period detection logic
      // Collection month (2026-01) !== data month (2025-12) => isClosingPeriod = true
      const collectionDateObj = new Date(result!.collectionDate! + 'T00:00:00')
      const collectionMonth = `${collectionDateObj.getFullYear()}-${String(collectionDateObj.getMonth() + 1).padStart(2, '0')}`

      expect(collectionMonth).toBe('2026-01')
      expect(collectionMonth).not.toBe(result?.dataMonth)
      // Therefore isClosingPeriod should be true
    })
  })
})
