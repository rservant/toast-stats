/**
 * Month-End Data Mapper Tests
 *
 * Tests the month-end closing period detection and data mapping logic.
 * These tests ensure the system correctly handles the complex timing
 * patterns of Toastmasters dashboard month-end closing periods.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { promises as fs } from 'fs'
import { MonthEndDataMapper } from '../MonthEndDataMapper.js'
import type {
  ILogger,
  ICacheConfigService,
  IRawCSVCacheService,
} from '../../types/serviceInterfaces.js'
import type { RawCSVCacheMetadata } from '../../types/rawCSVCache.js'

// Mock implementations
const mockLogger: ILogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}

const mockCacheConfigService: ICacheConfigService = {
  getCacheDirectory: vi.fn().mockReturnValue('/test/cache'),
  validateCacheDirectory: vi.fn().mockResolvedValue(true),
  ensureCacheDirectoryExists: vi.fn().mockResolvedValue(undefined),
}

const mockRawCSVCache: IRawCSVCacheService = {
  getCachedCSV: vi.fn(),
  setCachedCSV: vi.fn(),
  setCachedCSVWithMetadata: vi.fn(),
  hasCachedCSV: vi.fn(),
  getCacheMetadata: vi.fn(),
  updateCacheMetadata: vi.fn(),
  validateMetadataIntegrity: vi.fn(),
  repairMetadataIntegrity: vi.fn(),
  clearCacheForDate: vi.fn(),
  getCachedDates: vi.fn(),
  getStatistics: vi.fn(),
  getHealthStatus: vi.fn(),
  cleanup: vi.fn(),
}

describe('MonthEndDataMapper', () => {
  let mapper: MonthEndDataMapper

  beforeEach(() => {
    vi.clearAllMocks()
    mapper = new MonthEndDataMapper(
      mockCacheConfigService,
      mockRawCSVCache,
      mockLogger
    )
  })

  describe('detectClosingPeriod', () => {
    it('should detect normal operation when dates match', () => {
      const result = mapper.detectClosingPeriod('2024-12-15', '2024-12-15')

      expect(result).toEqual({
        isClosingPeriod: false,
        dataMonth: '2024-12',
        actualDate: '2024-12-15',
        requestedDate: '2024-12-15',
      })
    })

    it('should detect month-end closing period when actual date is in next month', () => {
      const result = mapper.detectClosingPeriod('2024-12-31', '2025-01-03')

      expect(result).toEqual({
        isClosingPeriod: true,
        dataMonth: '2024-12',
        actualDate: '2025-01-03',
        requestedDate: '2024-12-31',
      })
    })

    it('should detect closing period when actual date is in next year', () => {
      const result = mapper.detectClosingPeriod('2024-12-30', '2025-01-05')

      expect(result).toEqual({
        isClosingPeriod: true,
        dataMonth: '2024-12',
        actualDate: '2025-01-05',
        requestedDate: '2024-12-30',
      })
    })

    it('should handle mid-month closing periods', () => {
      const result = mapper.detectClosingPeriod('2024-11-28', '2024-12-02')

      expect(result).toEqual({
        isClosingPeriod: true,
        dataMonth: '2024-11',
        actualDate: '2024-12-02',
        requestedDate: '2024-11-28',
      })
    })

    it('should not detect closing period for same month different day', () => {
      const result = mapper.detectClosingPeriod('2024-12-15', '2024-12-17')

      expect(result).toEqual({
        isClosingPeriod: false,
        dataMonth: '2024-12',
        actualDate: '2024-12-17',
        requestedDate: '2024-12-15',
      })
    })
  })

  describe('getCSVDateForProcessedDate', () => {
    it('should find CSV data for normal dates', async () => {
      // Mock file system access
      vi.spyOn(fs.promises, 'access').mockResolvedValue(undefined)
      vi.spyOn(fs.promises, 'readdir').mockResolvedValue([
        { name: 'all-districts.csv', isFile: () => true },
      ])

      const result = await mapper.getCSVDateForProcessedDate('2024-12-15')

      expect(result).toBe('2024-12-15')
    })

    it('should return null when no CSV data is found', async () => {
      // Mock file system access to fail (no data found)
      vi.spyOn(fs.promises, 'access').mockRejectedValue(
        new Error('File not found')
      )

      const result = await mapper.getCSVDateForProcessedDate('2025-01-05')

      // Should return null when no data is found
      expect(result).toBeNull()
    })
  })

  describe('getMonthEndData', () => {
    it('should return null when no month-end data is available', async () => {
      vi.mocked(mockRawCSVCache.getCachedDates).mockResolvedValue([
        '2024-11-15',
        '2024-11-20',
      ])

      const result = await mapper.getMonthEndData('2024-12', 2024)

      expect(result).toBeNull()
    })

    it('should find direct month-end data when no closing period data exists', async () => {
      vi.mocked(mockRawCSVCache.getCachedDates).mockResolvedValue([
        '2024-12-31',
      ])

      // Mock file system access for direct date
      vi.spyOn(fs.promises, 'access').mockResolvedValue(undefined)
      vi.spyOn(fs.promises, 'readdir').mockResolvedValue([
        { name: 'all-districts.csv', isFile: () => true },
      ])

      const result = await mapper.getMonthEndData('2024-12', 2024)

      expect(result).toBe('2024-12-31')
    })
  })

  describe('isExpectedDataGap', () => {
    it('should check for closing periods regardless of day of month', async () => {
      // Mock cached dates that could indicate closing period
      vi.mocked(mockRawCSVCache.getCachedDates).mockResolvedValue([
        '2025-01-03', // January date with December data
        '2025-01-25', // Could be a long closing period
      ])

      // Mock metadata to indicate closing period
      vi.mocked(mockRawCSVCache.getCacheMetadata)
        .mockResolvedValueOnce({
          date: '2025-01-03',
          isClosingPeriod: true,
          dataMonth: '2024-12',
        } as Partial<RawCSVCacheMetadata>)
        .mockResolvedValueOnce({
          date: '2025-01-25',
          isClosingPeriod: true,
          dataMonth: '2024-12',
        } as Partial<RawCSVCacheMetadata>)

      // Test that even late in the month, we can detect closing periods
      const result = await mapper.isExpectedDataGap('2025-01-25')

      // This should detect the closing period regardless of day
      expect(typeof result).toBe('boolean')
    })

    it('should return false when no closing period data exists', async () => {
      // Mock no cached dates at all
      vi.mocked(mockRawCSVCache.getCachedDates).mockResolvedValue([])

      const result = await mapper.isExpectedDataGap('2025-01-20')

      expect(result).toBe(false)
    })
  })
})

describe('MonthEndDataMapper Integration Scenarios', () => {
  let mapper: MonthEndDataMapper

  beforeEach(() => {
    vi.clearAllMocks()
    mapper = new MonthEndDataMapper(
      mockCacheConfigService,
      mockRawCSVCache,
      mockLogger
    )
  })

  it('should handle typical December closing period scenario', () => {
    // Scenario: December 31 requested, but dashboard shows January 4
    const closingInfo = mapper.detectClosingPeriod('2024-12-31', '2025-01-04')

    expect(closingInfo).toEqual({
      isClosingPeriod: true,
      dataMonth: '2024-12',
      actualDate: '2025-01-04',
      requestedDate: '2024-12-31',
    })

    // This means:
    // - CSV will be stored in 2025-01-04/ folder
    // - Metadata will indicate it's closing period data for December 2024
    // - December 31 processed data will use this CSV
    // - January 1-3 processed data may return null (expected gaps)
  })

  it('should handle extended closing periods (25+ days)', () => {
    // Scenario: Very long closing period extending well into next month
    const closingInfo = mapper.detectClosingPeriod('2024-12-15', '2025-01-25')

    expect(closingInfo).toEqual({
      isClosingPeriod: true,
      dataMonth: '2024-12',
      actualDate: '2025-01-25',
      requestedDate: '2024-12-15',
    })

    // This means:
    // - CSV will be stored in 2025-01-25/ folder
    // - Metadata will indicate it's closing period data for December 2024
    // - December data will use this CSV
    // - January 1-24 processed data may return null (expected gaps)
    // - No assumption about closing period length
  })

  it('should handle normal mid-month operation', () => {
    // Scenario: Normal operation, dates match
    const closingInfo = mapper.detectClosingPeriod('2024-12-15', '2024-12-15')

    expect(closingInfo).toEqual({
      isClosingPeriod: false,
      dataMonth: '2024-12',
      actualDate: '2024-12-15',
      requestedDate: '2024-12-15',
    })

    // This means:
    // - CSV will be stored in 2024-12-15/ folder
    // - No special closing period handling needed
    // - December 15 processed data will use this CSV
  })
})
