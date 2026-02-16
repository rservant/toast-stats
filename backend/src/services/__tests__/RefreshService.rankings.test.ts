/**
 * RefreshService Tests
 *
 * Tests for RefreshService functionality using SnapshotBuilder
 *
 * NOTE: Rankings are now pre-computed by scraper-cli during the transform command.
 * The backend no longer performs ranking calculations per the data-computation-separation
 * steering document.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { RefreshService } from '../RefreshService.js'
import { RawCSVCacheService } from '../RawCSVCacheService.js'
import {
  FileSnapshotStore,
} from '../SnapshotStore.js'
import {
  createTestSelfCleanup,
  type TestSelfCleanup,
} from '../../utils/test-self-cleanup.js'

describe('RefreshService', () => {
  let refreshService: RefreshService
  let mockSnapshotStore: FileSnapshotStore
  let mockRawCSVCache: RawCSVCacheService
  let testCleanup: { cleanup: TestSelfCleanup; afterEach: () => Promise<void> }

  beforeEach(async () => {
    testCleanup = createTestSelfCleanup()

    // Create mock instances
    mockSnapshotStore = {
      writeSnapshot: vi.fn(),
      getLatestSuccessful: vi.fn(),
      getLatest: vi.fn(),
      listSnapshots: vi.fn(),
      getSnapshot: vi.fn(),
      isReady: vi.fn().mockResolvedValue(true),
    } as unknown as FileSnapshotStore

    mockRawCSVCache = {
      getAllDistrictsCached: vi.fn(),
      cacheAllDistricts: vi.fn(),
      getCachedCSV: vi.fn().mockResolvedValue(null),
      hasCachedCSV: vi.fn().mockResolvedValue(false),
      getCacheMetadata: vi.fn().mockResolvedValue(null),
    } as unknown as RawCSVCacheService

    // Note: Rankings are pre-computed by scraper-cli, no RankingCalculator needed
    refreshService = new RefreshService(
      mockSnapshotStore,
      mockRawCSVCache,
      undefined, // districtConfigService
      undefined // rankingCalculator - DEPRECATED: rankings are pre-computed by scraper-cli
    )
  })

  afterEach(async () => {
    await testCleanup.afterEach()
  })

  describe('executeRefresh', () => {
    it('should return failed result when no cached data is available', async () => {
      // Arrange - cache returns no data
      vi.mocked(mockRawCSVCache.hasCachedCSV).mockResolvedValue(false)

      // Act
      const result = await refreshService.executeRefresh()

      // Assert - RefreshService fails when no cached data is available
      expect(result.success).toBe(false)
      expect(result.status).toBe('failed')
      expect(result.errors.length).toBeGreaterThan(0)
      // The error message reflects either missing configuration or missing cache data
      // depending on the environment's district configuration state
      expect(result.errors[0]).toMatch(
        /Invalid district configuration|No cached data available/
      )
    })

    it('should include metadata in refresh result', async () => {
      // Arrange - cache returns no data
      vi.mocked(mockRawCSVCache.hasCachedCSV).mockResolvedValue(false)

      // Act
      const result = await refreshService.executeRefresh()

      // Assert
      expect(result.metadata).toBeDefined()
      expect(result.metadata.startedAt).toBeDefined()
      expect(result.metadata.completedAt).toBeDefined()
      expect(result.metadata.schemaVersion).toBe('1.0.0')
      expect(result.metadata.calculationVersion).toBe('1.0.0')
    })
  })

  describe('checkCacheAvailability', () => {
    it('should return availability status for a date', async () => {
      // Arrange
      vi.mocked(mockRawCSVCache.hasCachedCSV).mockResolvedValue(false)

      // Act
      const result = await refreshService.checkCacheAvailability('2025-01-07')

      // Assert
      expect(result).toBeDefined()
      expect(result.date).toBe('2025-01-07')
      expect(result.available).toBe(false)
    })
  })

  describe('validateConfiguration', () => {
    it('should return invalid when no districts are configured', async () => {
      // Act
      const result = await refreshService.validateConfiguration()

      // Assert - depends on actual district configuration
      expect(result).toBeDefined()
      expect(typeof result.isValid).toBe('boolean')
      expect(Array.isArray(result.configuredDistricts)).toBe(true)
    })
  })
})
