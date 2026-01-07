/**
 * RefreshService Cache Integration Tests
 *
 * Tests for Raw CSV Cache integration in scrapeData method
 * Property 2: Cache Consistency
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { RefreshService } from '../RefreshService.js'
import { FileSnapshotStore } from '../FileSnapshotStore.js'
import { ToastmastersScraper } from '../ToastmastersScraper.js'
import { RawCSVCacheService } from '../RawCSVCacheService.js'
import { DistrictConfigurationService } from '../DistrictConfigurationService.js'
import type { ScrapedRecord } from '../../types/districts.js'

describe('RefreshService - Cache Integration', () => {
  let refreshService: RefreshService
  let mockSnapshotStore: FileSnapshotStore
  let mockScraper: ToastmastersScraper
  let mockRawCSVCache: RawCSVCacheService
  let mockDistrictConfigService: DistrictConfigurationService

  beforeEach(() => {
    // Create mock instances
    mockSnapshotStore = {
      writeSnapshot: vi.fn(),
      getLatestSuccessful: vi.fn(),
      getLatest: vi.fn(),
      listSnapshots: vi.fn(),
      getSnapshot: vi.fn(),
      isReady: vi.fn().mockResolvedValue(true),
    } as unknown as FileSnapshotStore

    mockScraper = {
      getAllDistricts: vi.fn(),
      getDistrictPerformance: vi.fn(),
      getDivisionPerformance: vi.fn(),
      getClubPerformance: vi.fn(),
      closeBrowser: vi.fn(),
    } as unknown as ToastmastersScraper

    mockRawCSVCache = {
      getAllDistrictsCached: vi.fn(),
      cacheAllDistricts: vi.fn(),
    } as unknown as RawCSVCacheService

    mockDistrictConfigService = {
      getConfiguredDistricts: vi.fn().mockResolvedValue(['42', '15']),
      hasConfiguredDistricts: vi.fn().mockResolvedValue(true),
      validateConfiguration: vi.fn().mockResolvedValue({
        isValid: true,
        configuredDistricts: ['42', '15'],
        validDistricts: ['42', '15'],
        invalidDistricts: [],
        warnings: [],
        suggestions: [],
        lastCollectionInfo: [],
      }),
    } as unknown as DistrictConfigurationService

    refreshService = new RefreshService(
      mockSnapshotStore,
      mockScraper,
      mockRawCSVCache,
      undefined,
      mockDistrictConfigService,
      undefined
    )
  })

  describe('scrapeData - Cache Integration', () => {
    it('should use cache when available - Property 2', async () => {
      // Arrange
      const cachedData: ScrapedRecord[] = [
        {
          DISTRICT: '42',
          REGION: 'Region 5',
          'Paid Clubs': '245',
        },
        {
          DISTRICT: '15',
          REGION: 'Region 2',
          'Paid Clubs': '200',
        },
      ]

      const cacheMetadata = {
        fileName: 'all-districts-2025-01-07.csv',
        date: '2025-01-07',
        fetchedAt: '2025-01-07T10:00:00.000Z',
        fileSize: 1024,
        checksum: 'abc123',
      }

      // Mock cache hit
      vi.mocked(mockRawCSVCache.getAllDistrictsCached).mockResolvedValue({
        data: cachedData,
        fromCache: true,
        metadata: cacheMetadata,
      })

      // Mock district data fetching - return minimal valid data
      vi.mocked(mockScraper.getDistrictPerformance).mockResolvedValue([
        { DISTRICT: '42', 'District Name': 'Test District 42' },
      ])
      vi.mocked(mockScraper.getDivisionPerformance).mockResolvedValue([
        { DIVISION: 'A', DISTRICT: '42' },
      ])
      vi.mocked(mockScraper.getClubPerformance).mockResolvedValue([
        { 'Club Number': '12345', 'Club Name': 'Test Club', DISTRICT: '42' },
      ])

      // Act
      const result = await (refreshService as any).scrapeData()

      // Assert - Property 2: Cache Consistency
      // Validates: Requirements 2.1, 2.2, 2.5, 5.2
      expect(mockRawCSVCache.getAllDistrictsCached).toHaveBeenCalled()
      expect(mockScraper.getAllDistricts).not.toHaveBeenCalled() // Should not download
      expect(result.allDistricts).toEqual(cachedData)
      expect(result.allDistrictsMetadata.fromCache).toBe(true)
      expect(result.allDistrictsMetadata.csvDate).toBe('2025-01-07')
      expect(result.allDistrictsMetadata.fetchedAt).toBe(
        '2025-01-07T10:00:00.000Z'
      )
    })

    it('should download when cache miss', async () => {
      // Arrange
      const downloadedData: ScrapedRecord[] = [
        {
          DISTRICT: '42',
          REGION: 'Region 5',
          'Paid Clubs': '245',
        },
        {
          DISTRICT: '15',
          REGION: 'Region 2',
          'Paid Clubs': '200',
        },
      ]

      // Mock cache miss
      vi.mocked(mockRawCSVCache.getAllDistrictsCached).mockResolvedValue(null)

      // Mock download
      vi.mocked(mockScraper.getAllDistricts).mockResolvedValue(downloadedData)

      // Mock district data fetching - return minimal valid data
      vi.mocked(mockScraper.getDistrictPerformance).mockResolvedValue([
        { DISTRICT: '42', 'District Name': 'Test District 42' },
      ])
      vi.mocked(mockScraper.getDivisionPerformance).mockResolvedValue([
        { DIVISION: 'A', DISTRICT: '42' },
      ])
      vi.mocked(mockScraper.getClubPerformance).mockResolvedValue([
        { 'Club Number': '12345', 'Club Name': 'Test Club', DISTRICT: '42' },
      ])

      // Act
      const result = await (refreshService as any).scrapeData()

      // Assert
      expect(mockRawCSVCache.getAllDistrictsCached).toHaveBeenCalled()
      expect(mockScraper.getAllDistricts).toHaveBeenCalled() // Should download
      expect(result.allDistricts).toEqual(downloadedData)
      expect(result.allDistrictsMetadata.fromCache).toBe(false)
    })

    it('should include cache metadata in RawData', async () => {
      // Arrange
      const cachedData: ScrapedRecord[] = [
        {
          DISTRICT: '42',
          REGION: 'Region 5',
        },
      ]

      const cacheMetadata = {
        fileName: 'all-districts-2025-01-07.csv',
        date: '2025-01-07',
        fetchedAt: '2025-01-07T08:30:00.000Z',
        fileSize: 2048,
        checksum: 'xyz789',
      }

      vi.mocked(mockRawCSVCache.getAllDistrictsCached).mockResolvedValue({
        data: cachedData,
        fromCache: true,
        metadata: cacheMetadata,
      })

      // Mock district data fetching - return minimal valid data
      vi.mocked(mockScraper.getDistrictPerformance).mockResolvedValue([
        { DISTRICT: '42', 'District Name': 'Test District 42' },
      ])
      vi.mocked(mockScraper.getDivisionPerformance).mockResolvedValue([
        { DIVISION: 'A', DISTRICT: '42' },
      ])
      vi.mocked(mockScraper.getClubPerformance).mockResolvedValue([
        { 'Club Number': '12345', 'Club Name': 'Test Club', DISTRICT: '42' },
      ])

      // Act
      const result = await (refreshService as any).scrapeData()

      // Assert
      expect(result.allDistrictsMetadata).toBeDefined()
      expect(result.allDistrictsMetadata.fromCache).toBe(true)
      expect(result.allDistrictsMetadata.csvDate).toBe('2025-01-07')
      expect(result.allDistrictsMetadata.fetchedAt).toBe(
        '2025-01-07T08:30:00.000Z'
      )
    })

    it('should still fetch all 3 CSV files for configured districts', async () => {
      // Arrange
      const cachedData: ScrapedRecord[] = [
        {
          DISTRICT: '42',
          REGION: 'Region 5',
        },
        {
          DISTRICT: '15',
          REGION: 'Region 2',
        },
      ]

      vi.mocked(mockRawCSVCache.getAllDistrictsCached).mockResolvedValue({
        data: cachedData,
        fromCache: true,
        metadata: {
          fileName: 'all-districts-2025-01-07.csv',
          date: '2025-01-07',
          fetchedAt: '2025-01-07T10:00:00.000Z',
          fileSize: 1024,
          checksum: 'abc123',
        },
      })

      // Mock district data fetching
      vi.mocked(mockScraper.getDistrictPerformance).mockResolvedValue([
        { DISTRICT: '42' },
      ])
      vi.mocked(mockScraper.getDivisionPerformance).mockResolvedValue([
        { DIVISION: 'A' },
      ])
      vi.mocked(mockScraper.getClubPerformance).mockResolvedValue([
        { 'Club Number': '12345' },
      ])

      // Act
      const result = await (refreshService as any).scrapeData()

      // Assert - Validates: Requirements 2.1, 2.2, 2.5, 5.2
      // Even with cache hit for All Districts, should still fetch detailed data for configured districts
      expect(mockScraper.getDistrictPerformance).toHaveBeenCalledTimes(2) // Called for each configured district
      expect(mockScraper.getDivisionPerformance).toHaveBeenCalledTimes(2)
      expect(mockScraper.getClubPerformance).toHaveBeenCalledTimes(2)

      // Verify we have data for both configured districts
      expect(result.districtData.size).toBe(2)
      expect(result.districtData.has('42')).toBe(true)
      expect(result.districtData.has('15')).toBe(true)
    })
  })
})
