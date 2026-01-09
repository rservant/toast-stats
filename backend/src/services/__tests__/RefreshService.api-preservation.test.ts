/**
 * API Preservation Verification Tests for RefreshService
 *
 * Feature: refresh-service-refactor
 * Task: 7.1 Verify public API signatures unchanged
 *
 * This test verifies that the RefreshService public API remains unchanged
 * after the refactoring to extract ClosingPeriodDetector and DataNormalizer.
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import { RefreshService, type RefreshResult } from '../RefreshService.js'
import { DistrictConfigurationService } from '../DistrictConfigurationService.js'
import { FileSnapshotStore } from '../FileSnapshotStore.js'
import { ToastmastersScraper } from '../ToastmastersScraper.js'
import { DataValidator } from '../DataValidator.js'
import { createMockCacheService } from '../../__tests__/utils/mockCacheService.js'
import type { ScrapedRecord } from '../../types/districts.js'

// Mock the scraper to simulate network operations
vi.mock('../ToastmastersScraper.ts')

describe('RefreshService API Preservation - Task 7.1', () => {
  let testCacheDir: string
  let refreshService: RefreshService
  let mockScraper: ToastmastersScraper
  let mockRawCSVCache: ReturnType<typeof createMockCacheService>
  let snapshotStore: FileSnapshotStore
  let configService: DistrictConfigurationService

  beforeEach(async () => {
    // Create a unique test cache directory
    testCacheDir = path.join(
      process.cwd(),
      'test-cache',
      `refresh-service-api-${Date.now()}-${Math.random().toString(36).slice(2)}`
    )
    await fs.mkdir(testCacheDir, { recursive: true })

    // Create service instances
    configService = new DistrictConfigurationService(testCacheDir)
    snapshotStore = new FileSnapshotStore({ cacheDir: testCacheDir })
    mockScraper = vi.mocked(new ToastmastersScraper())
    mockRawCSVCache = createMockCacheService()

    refreshService = new RefreshService(
      snapshotStore,
      mockScraper,
      mockRawCSVCache,
      new DataValidator(),
      configService
    )
  })

  afterEach(async () => {
    // Clean up test cache directory
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
    vi.clearAllMocks()
  })

  describe('executeRefresh() API Contract - Requirement 3.2', () => {
    it('should return RefreshResult with all required fields on success', async () => {
      // Configure a district
      await configService.addDistrict('42', 'test-admin')

      // Mock scraper responses
      const mockAllDistricts: ScrapedRecord[] = [
        { DISTRICT: '42', 'District Name': 'Test District 42' },
      ]
      const mockDistrictData: ScrapedRecord[] = [
        {
          'Club Number': '12345',
          'Club Name': 'Test Club',
          'Active Members': '25',
        },
      ]

      mockScraper.getAllDistricts.mockResolvedValue(mockAllDistricts)
      mockScraper.getDistrictPerformance.mockResolvedValue(mockDistrictData)
      mockScraper.getDivisionPerformance.mockResolvedValue(mockDistrictData)
      mockScraper.getClubPerformance.mockResolvedValue(mockDistrictData)
      mockScraper.closeBrowser.mockResolvedValue()

      // Execute refresh
      const result = await refreshService.executeRefresh()

      // Verify RefreshResult structure - Requirement 3.2
      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('duration_ms')
      expect(result).toHaveProperty('errors')
      expect(result).toHaveProperty('status')
      expect(result).toHaveProperty('metadata')

      // Verify types
      expect(typeof result.success).toBe('boolean')
      expect(typeof result.duration_ms).toBe('number')
      expect(Array.isArray(result.errors)).toBe(true)
      expect(['success', 'partial', 'failed']).toContain(result.status)

      // Verify metadata structure
      expect(result.metadata).toHaveProperty('districtCount')
      expect(result.metadata).toHaveProperty('startedAt')
      expect(result.metadata).toHaveProperty('completedAt')
      expect(result.metadata).toHaveProperty('schemaVersion')
      expect(result.metadata).toHaveProperty('calculationVersion')

      // Verify metadata types
      expect(typeof result.metadata.districtCount).toBe('number')
      expect(typeof result.metadata.startedAt).toBe('string')
      expect(typeof result.metadata.completedAt).toBe('string')
      expect(typeof result.metadata.schemaVersion).toBe('string')
      expect(typeof result.metadata.calculationVersion).toBe('string')

      // Verify snapshot_id is present on success
      if (result.success) {
        expect(result).toHaveProperty('snapshot_id')
        expect(typeof result.snapshot_id).toBe('string')
      }
    })

    it('should return RefreshResult with identical structure on failure', async () => {
      // Don't configure any districts - this should cause a validation failure
      const result = await refreshService.executeRefresh()

      // Verify RefreshResult structure is identical even on failure
      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('duration_ms')
      expect(result).toHaveProperty('errors')
      expect(result).toHaveProperty('status')
      expect(result).toHaveProperty('metadata')

      // Verify types remain consistent
      expect(typeof result.success).toBe('boolean')
      expect(typeof result.duration_ms).toBe('number')
      expect(Array.isArray(result.errors)).toBe(true)
      expect(['success', 'partial', 'failed']).toContain(result.status)

      // Verify metadata structure is present even on failure
      expect(result.metadata).toHaveProperty('districtCount')
      expect(result.metadata).toHaveProperty('startedAt')
      expect(result.metadata).toHaveProperty('completedAt')
      expect(result.metadata).toHaveProperty('schemaVersion')
      expect(result.metadata).toHaveProperty('calculationVersion')
    })

    it('should return partial status when some districts fail', async () => {
      // Configure multiple districts
      await configService.addDistrict('42', 'test-admin')
      await configService.addDistrict('43', 'test-admin')

      // Mock scraper responses - one district succeeds, one fails
      const mockAllDistricts: ScrapedRecord[] = [
        { DISTRICT: '42', 'District Name': 'Test District 42' },
        { DISTRICT: '43', 'District Name': 'Test District 43' },
      ]
      const mockDistrictData: ScrapedRecord[] = [
        {
          'Club Number': '12345',
          'Club Name': 'Test Club',
          'Active Members': '25',
        },
      ]

      mockScraper.getAllDistricts.mockResolvedValue(mockAllDistricts)
      mockScraper.getDistrictPerformance.mockImplementation(
        async (districtId: string) => {
          if (districtId === '43') {
            throw new Error('Simulated failure for district 43')
          }
          return mockDistrictData
        }
      )
      mockScraper.getDivisionPerformance.mockImplementation(
        async (districtId: string) => {
          if (districtId === '43') {
            throw new Error('Simulated failure for district 43')
          }
          return mockDistrictData
        }
      )
      mockScraper.getClubPerformance.mockImplementation(
        async (districtId: string) => {
          if (districtId === '43') {
            throw new Error('Simulated failure for district 43')
          }
          return mockDistrictData
        }
      )
      mockScraper.closeBrowser.mockResolvedValue()

      // Execute refresh
      const result = await refreshService.executeRefresh()

      // Verify partial status
      expect(result.success).toBe(true)
      expect(result.status).toBe('partial')
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result).toHaveProperty('snapshot_id')
    })
  })

  describe('validateConfiguration() API Contract - Requirement 3.3', () => {
    it('should return ConfigurationValidationResult with all required fields', async () => {
      // Configure a district
      await configService.addDistrict('42', 'test-admin')

      // Execute validation
      const result = await refreshService.validateConfiguration()

      // Verify ConfigurationValidationResult structure - Requirement 3.3
      expect(result).toHaveProperty('isValid')
      expect(result).toHaveProperty('configuredDistricts')
      expect(result).toHaveProperty('validDistricts')
      expect(result).toHaveProperty('invalidDistricts')
      expect(result).toHaveProperty('warnings')
      expect(result).toHaveProperty('suggestions')
      expect(result).toHaveProperty('lastCollectionInfo')

      // Verify types
      expect(typeof result.isValid).toBe('boolean')
      expect(Array.isArray(result.configuredDistricts)).toBe(true)
      expect(Array.isArray(result.validDistricts)).toBe(true)
      expect(Array.isArray(result.invalidDistricts)).toBe(true)
      expect(Array.isArray(result.warnings)).toBe(true)
      expect(Array.isArray(result.suggestions)).toBe(true)
      expect(Array.isArray(result.lastCollectionInfo)).toBe(true)
    })

    it('should return invalid result when no districts configured', async () => {
      // Don't configure any districts
      const result = await refreshService.validateConfiguration()

      // Verify structure is consistent
      expect(result).toHaveProperty('isValid')
      expect(result.isValid).toBe(false)
      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.configuredDistricts).toEqual([])
    })

    it('should return valid result when districts are configured', async () => {
      // Configure a district
      await configService.addDistrict('42', 'test-admin')

      const result = await refreshService.validateConfiguration()

      // Verify valid configuration
      expect(result.isValid).toBe(true)
      expect(result.configuredDistricts).toContain('42')
    })
  })

  describe('getCircuitBreakerStats() API Contract - Requirement 3.4', () => {
    it('should return object with scraping property', () => {
      const stats = refreshService.getCircuitBreakerStats()

      // Verify structure - Requirement 3.4
      expect(stats).toHaveProperty('scraping')
      expect(typeof stats.scraping).toBe('object')
    })

    it('should return circuit breaker stats with expected properties', () => {
      const stats = refreshService.getCircuitBreakerStats()

      // Verify scraping stats structure
      const scrapingStats = stats.scraping as Record<string, unknown>
      expect(scrapingStats).toHaveProperty('state')
      expect(scrapingStats).toHaveProperty('failureCount')
    })
  })

  describe('resetCircuitBreaker() API Contract - Requirement 3.4', () => {
    it('should reset circuit breaker without throwing', () => {
      // Verify resetCircuitBreaker doesn't throw
      expect(() => refreshService.resetCircuitBreaker()).not.toThrow()
    })

    it('should reset circuit breaker state', () => {
      // Get initial stats
      const initialStats = refreshService.getCircuitBreakerStats()
      const initialState = (initialStats.scraping as Record<string, unknown>)
        .state

      // Reset circuit breaker
      refreshService.resetCircuitBreaker()

      // Get stats after reset
      const afterStats = refreshService.getCircuitBreakerStats()
      const afterState = (afterStats.scraping as Record<string, unknown>).state

      // State should be CLOSED after reset
      expect(afterState).toBe('CLOSED')
    })
  })

  describe('Constructor API - Requirement 3.1', () => {
    it('should accept all documented constructor parameters', () => {
      // Verify constructor accepts all parameters without throwing
      const service = new RefreshService(
        snapshotStore,
        mockScraper,
        mockRawCSVCache,
        new DataValidator(),
        configService,
        undefined, // rankingCalculator (optional)
        undefined, // closingPeriodDetector (optional)
        undefined // dataNormalizer (optional)
      )

      expect(service).toBeInstanceOf(RefreshService)
    })

    it('should work with minimal required parameters', () => {
      // Verify constructor works with minimal parameters
      const service = new RefreshService(
        snapshotStore,
        mockScraper,
        mockRawCSVCache
      )

      expect(service).toBeInstanceOf(RefreshService)
    })

    it('should expose all public methods', () => {
      // Verify all public methods exist
      expect(typeof refreshService.executeRefresh).toBe('function')
      expect(typeof refreshService.validateConfiguration).toBe('function')
      expect(typeof refreshService.getCircuitBreakerStats).toBe('function')
      expect(typeof refreshService.resetCircuitBreaker).toBe('function')
    })
  })
})
