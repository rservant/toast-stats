/**
 * Tests for ToastmastersScraper program year boundary handling
 *
 * These tests verify that the scraper correctly handles the program year
 * boundary (June 30 / July 1) when falling back from July to June.
 *
 * Bug fix: When requesting July data but the dashboard returns June data
 * (closing period), the fallback URL must use the previous program year
 * (e.g., 2024-2025 instead of 2025-2026) because June belongs to the
 * previous program year.
 *
 * Toastmasters program year: July 1 to June 30
 * - July 2025 is in program year 2025-2026
 * - June 2025 is in program year 2024-2025
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { ToastmastersScraper } from '../ToastmastersScraper.js'
import { IRawCSVCacheService } from '../../types/serviceInterfaces.js'

describe('ToastmastersScraper.programYearBoundary', () => {
  /**
   * Access the private getProgramYear method for testing
   */
  function getGetProgramYearMethod(scraper: ToastmastersScraper) {
    return (
      scraper as unknown as {
        getProgramYear: (dateString: string) => string
      }
    ).getProgramYear.bind(scraper)
  }

  /**
   * Access the private buildBaseUrl method for testing
   */
  function getBuildBaseUrlMethod(scraper: ToastmastersScraper) {
    return (
      scraper as unknown as {
        buildBaseUrl: (dateString: string) => string
      }
    ).buildBaseUrl.bind(scraper)
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

  describe('getProgramYear', () => {
    it('should return 2025-2026 for July 2025 dates', () => {
      const getProgramYear = getGetProgramYearMethod(scraper)

      expect(getProgramYear('2025-07-01')).toBe('2025-2026')
      expect(getProgramYear('2025-07-15')).toBe('2025-2026')
      expect(getProgramYear('2025-12-31')).toBe('2025-2026')
    })

    it('should return 2024-2025 for June 2025 dates', () => {
      const getProgramYear = getGetProgramYearMethod(scraper)

      expect(getProgramYear('2025-06-01')).toBe('2024-2025')
      expect(getProgramYear('2025-06-15')).toBe('2024-2025')
      expect(getProgramYear('2025-06-30')).toBe('2024-2025')
    })

    it('should return 2024-2025 for January 2025 dates', () => {
      const getProgramYear = getGetProgramYearMethod(scraper)

      expect(getProgramYear('2025-01-01')).toBe('2024-2025')
      expect(getProgramYear('2025-01-15')).toBe('2024-2025')
    })

    it('should handle the exact boundary dates correctly', () => {
      const getProgramYear = getGetProgramYearMethod(scraper)

      // June 30 is the last day of the program year
      expect(getProgramYear('2025-06-30')).toBe('2024-2025')

      // July 1 is the first day of the new program year
      expect(getProgramYear('2025-07-01')).toBe('2025-2026')
    })
  })

  describe('buildBaseUrl', () => {
    it('should build correct URL for July 2025 (program year 2025-2026)', () => {
      const buildBaseUrl = getBuildBaseUrlMethod(scraper)

      const url = buildBaseUrl('2025-07-01')
      expect(url).toContain('2025-2026')
    })

    it('should build correct URL for June 2025 (program year 2024-2025)', () => {
      const buildBaseUrl = getBuildBaseUrlMethod(scraper)

      const url = buildBaseUrl('2025-06-30')
      expect(url).toContain('2024-2025')
    })

    it('should use different program years for July vs June of same calendar year', () => {
      const buildBaseUrl = getBuildBaseUrlMethod(scraper)

      const julyUrl = buildBaseUrl('2025-07-01')
      const juneUrl = buildBaseUrl('2025-06-30')

      expect(julyUrl).toContain('2025-2026')
      expect(juneUrl).toContain('2024-2025')
      expect(julyUrl).not.toBe(juneUrl)
    })
  })

  describe('program year boundary fallback logic', () => {
    /**
     * This test documents the expected behavior when falling back from July to June.
     *
     * Scenario:
     * - Request: 2025-07-05 (program year 2025-2026)
     * - Dashboard doesn't have July data yet (new program year just started)
     * - Fallback to June (month 6)
     * - June 2025 is in program year 2024-2025
     * - Fallback URL must use 2024-2025, not 2025-2026
     */
    it('should recognize that July to June fallback crosses program year boundary', () => {
      const getProgramYear = getGetProgramYearMethod(scraper)

      // July 2025 is in 2025-2026
      const julyProgramYear = getProgramYear('2025-07-05')
      expect(julyProgramYear).toBe('2025-2026')

      // When falling back to June, we need to use June's program year
      // June 2025 is in 2024-2025
      const juneProgramYear = getProgramYear('2025-06-05')
      expect(juneProgramYear).toBe('2024-2025')

      // They should be different program years
      expect(julyProgramYear).not.toBe(juneProgramYear)
    })

    it('should NOT cross program year boundary for other month fallbacks', () => {
      const getProgramYear = getGetProgramYearMethod(scraper)

      // August to July - both in same program year
      expect(getProgramYear('2025-08-01')).toBe('2025-2026')
      expect(getProgramYear('2025-07-01')).toBe('2025-2026')

      // February to January - both in same program year
      expect(getProgramYear('2025-02-01')).toBe('2024-2025')
      expect(getProgramYear('2025-01-01')).toBe('2024-2025')

      // January to December - crosses calendar year but same program year
      expect(getProgramYear('2025-01-01')).toBe('2024-2025')
      expect(getProgramYear('2024-12-01')).toBe('2024-2025')
    })
  })
})
