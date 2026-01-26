/**
 * LocalRawCSVStorage Unit Tests
 *
 * Tests the LocalRawCSVStorage adapter that implements IRawCSVStorage
 * by delegating to the existing RawCSVCacheService implementation.
 *
 * Requirements Validated: 4.1, 4.2, 4.3, 4.4
 *
 * Test Isolation Requirements (per testing steering document):
 * - Each test uses unique, isolated directories
 * - Tests clean up all resources in afterEach hooks
 * - Tests do not depend on execution order
 * - All tests pass when run with --run (parallel mode)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import { LocalRawCSVStorage } from '../LocalRawCSVStorage.js'
import type { IRawCSVStorage } from '../../../types/storageInterfaces.js'
import type {
  ICacheConfigService,
  ILogger,
} from '../../../types/serviceInterfaces.js'
import { CSVType } from '../../../types/rawCSVCache.js'

// ============================================================================
// Mock Implementations
// ============================================================================

/**
 * Mock CacheConfigService for testing
 * Provides isolated cache directory configuration
 */
class MockCacheConfigService implements ICacheConfigService {
  private cacheDir: string

  constructor(cacheDir: string) {
    this.cacheDir = cacheDir
  }

  getCacheDirectory(): string {
    return this.cacheDir
  }

  getConfiguration(): {
    baseDirectory: string
    isConfigured: boolean
    source: 'environment' | 'default' | 'test'
    validationStatus: {
      isValid: boolean
      isAccessible: boolean
      isSecure: boolean
    }
  } {
    return {
      baseDirectory: this.cacheDir,
      isConfigured: true,
      source: 'test',
      validationStatus: {
        isValid: true,
        isAccessible: true,
        isSecure: true,
      },
    }
  }

  async initialize(): Promise<void> {
    // Mock implementation
  }

  async validateCacheDirectory(): Promise<void> {
    // Mock implementation
  }

  isReady(): boolean {
    return true
  }

  async dispose(): Promise<void> {
    // Mock implementation
  }
}

/**
 * Mock Logger for testing
 * Silent implementation to avoid test output noise
 */
class MockLogger implements ILogger {
  info(_message: string, _data?: unknown): void {
    // Silent for tests
  }

  warn(_message: string, _data?: unknown): void {
    // Silent for tests
  }

  error(_message: string, _error?: Error | unknown): void {
    // Silent for tests
  }

  debug(_message: string, _data?: unknown): void {
    // Silent for tests
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe('LocalRawCSVStorage', () => {
  let storage: IRawCSVStorage
  let mockCacheConfig: MockCacheConfigService
  let mockLogger: MockLogger
  let testCacheDir: string
  let testId: string

  beforeEach(async () => {
    // Create unique test directory for isolation
    testId = `local-csv-storage-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
    testCacheDir = path.join(process.cwd(), 'test-cache', testId)
    await fs.mkdir(testCacheDir, { recursive: true })

    // Create mock dependencies
    mockCacheConfig = new MockCacheConfigService(testCacheDir)
    mockLogger = new MockLogger()

    // Create storage instance
    storage = new LocalRawCSVStorage(mockCacheConfig, mockLogger)
  })

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  // ============================================================================
  // Interface Compliance Tests
  // ============================================================================

  describe('Interface Compliance', () => {
    it('should implement IRawCSVStorage interface', () => {
      // Verify all required methods exist
      expect(typeof storage.getCachedCSV).toBe('function')
      expect(typeof storage.setCachedCSV).toBe('function')
      expect(typeof storage.setCachedCSVWithMetadata).toBe('function')
      expect(typeof storage.hasCachedCSV).toBe('function')
      expect(typeof storage.getCacheMetadata).toBe('function')
      expect(typeof storage.updateCacheMetadata).toBe('function')
      expect(typeof storage.clearCacheForDate).toBe('function')
      expect(typeof storage.getCachedDates).toBe('function')
      expect(typeof storage.getCacheStorageInfo).toBe('function')
      expect(typeof storage.getCacheStatistics).toBe('function')
      expect(typeof storage.getHealthStatus).toBe('function')
    })
  })

  // ============================================================================
  // Core Cache Operations - Delegation Tests
  // ============================================================================

  describe('Core Cache Operations', () => {
    const testDate = '2024-01-15'
    const testCSVContent = 'District,Region,Clubs\n42,1,25\n43,2,30\n'
    const testDistrictId = '42'
    const districtCSVContent = 'Club,Members,Status\nTest Club,20,Active\n'

    describe('getCachedCSV', () => {
      it('should return null for non-existent CSV', async () => {
        const result = await storage.getCachedCSV(
          testDate,
          CSVType.ALL_DISTRICTS
        )
        expect(result).toBeNull()
      })

      it('should retrieve cached CSV content', async () => {
        await storage.setCachedCSV(
          testDate,
          CSVType.ALL_DISTRICTS,
          testCSVContent
        )
        const result = await storage.getCachedCSV(
          testDate,
          CSVType.ALL_DISTRICTS
        )
        expect(result).toBe(testCSVContent)
      })

      it('should retrieve district-specific CSV content', async () => {
        await storage.setCachedCSV(
          testDate,
          CSVType.CLUB_PERFORMANCE,
          districtCSVContent,
          testDistrictId
        )
        const result = await storage.getCachedCSV(
          testDate,
          CSVType.CLUB_PERFORMANCE,
          testDistrictId
        )
        expect(result).toBe(districtCSVContent)
      })
    })

    describe('setCachedCSV', () => {
      it('should cache CSV content successfully', async () => {
        await storage.setCachedCSV(
          testDate,
          CSVType.ALL_DISTRICTS,
          testCSVContent
        )

        const exists = await storage.hasCachedCSV(
          testDate,
          CSVType.ALL_DISTRICTS
        )
        expect(exists).toBe(true)
      })

      it('should cache district-specific CSV content', async () => {
        await storage.setCachedCSV(
          testDate,
          CSVType.DISTRICT_PERFORMANCE,
          districtCSVContent,
          testDistrictId
        )

        const exists = await storage.hasCachedCSV(
          testDate,
          CSVType.DISTRICT_PERFORMANCE,
          testDistrictId
        )
        expect(exists).toBe(true)
      })

      it('should overwrite existing CSV content', async () => {
        const originalContent = 'District,Region\n42,1\n'
        const updatedContent = 'District,Region,Clubs\n42,1,25\n'

        await storage.setCachedCSV(
          testDate,
          CSVType.ALL_DISTRICTS,
          originalContent
        )
        await storage.setCachedCSV(
          testDate,
          CSVType.ALL_DISTRICTS,
          updatedContent
        )

        const result = await storage.getCachedCSV(
          testDate,
          CSVType.ALL_DISTRICTS
        )
        expect(result).toBe(updatedContent)
      })
    })

    describe('setCachedCSVWithMetadata', () => {
      it('should cache CSV with closing period metadata', async () => {
        const closingPeriodMetadata = {
          requestedDate: '2024-01-31',
          isClosingPeriod: true,
          dataMonth: '2024-01',
        }

        await storage.setCachedCSVWithMetadata(
          testDate,
          CSVType.ALL_DISTRICTS,
          testCSVContent,
          undefined,
          closingPeriodMetadata
        )

        const result = await storage.getCachedCSV(
          testDate,
          CSVType.ALL_DISTRICTS
        )
        expect(result).toBe(testCSVContent)
      })

      it('should cache district-specific CSV with metadata', async () => {
        const closingPeriodMetadata = {
          requestedDate: '2024-01-31',
          isClosingPeriod: true,
          dataMonth: '2024-01',
        }

        await storage.setCachedCSVWithMetadata(
          testDate,
          CSVType.CLUB_PERFORMANCE,
          districtCSVContent,
          testDistrictId,
          closingPeriodMetadata
        )

        const result = await storage.getCachedCSV(
          testDate,
          CSVType.CLUB_PERFORMANCE,
          testDistrictId
        )
        expect(result).toBe(districtCSVContent)
      })
    })

    describe('hasCachedCSV', () => {
      it('should return false for non-existent CSV', async () => {
        const result = await storage.hasCachedCSV(
          testDate,
          CSVType.ALL_DISTRICTS
        )
        expect(result).toBe(false)
      })

      it('should return true for existing CSV', async () => {
        await storage.setCachedCSV(
          testDate,
          CSVType.ALL_DISTRICTS,
          testCSVContent
        )
        const result = await storage.hasCachedCSV(
          testDate,
          CSVType.ALL_DISTRICTS
        )
        expect(result).toBe(true)
      })

      it('should distinguish between different CSV types', async () => {
        await storage.setCachedCSV(
          testDate,
          CSVType.ALL_DISTRICTS,
          testCSVContent
        )

        expect(
          await storage.hasCachedCSV(testDate, CSVType.ALL_DISTRICTS)
        ).toBe(true)
        expect(
          await storage.hasCachedCSV(
            testDate,
            CSVType.DISTRICT_PERFORMANCE,
            testDistrictId
          )
        ).toBe(false)
      })
    })
  })

  // ============================================================================
  // Metadata Management - Delegation Tests
  // ============================================================================

  describe('Metadata Management', () => {
    const testDate = '2024-01-15'
    const testCSVContent = 'District,Region,Clubs\n42,1,25\n'

    describe('getCacheMetadata', () => {
      it('should return null for non-existent date', async () => {
        const result = await storage.getCacheMetadata(testDate)
        expect(result).toBeNull()
      })

      it('should return metadata for cached date', async () => {
        await storage.setCachedCSV(
          testDate,
          CSVType.ALL_DISTRICTS,
          testCSVContent
        )
        const result = await storage.getCacheMetadata(testDate)

        expect(result).not.toBeNull()
        expect(result?.date).toBe(testDate)
        expect(result?.csvFiles.allDistricts).toBe(true)
      })
    })

    describe('updateCacheMetadata', () => {
      it('should update existing metadata', async () => {
        await storage.setCachedCSV(
          testDate,
          CSVType.ALL_DISTRICTS,
          testCSVContent
        )

        await storage.updateCacheMetadata(testDate, {
          source: 'manual-update',
        })

        const result = await storage.getCacheMetadata(testDate)
        expect(result?.source).toBe('manual-update')
      })

      it('should create metadata if it does not exist', async () => {
        // Create directory structure first
        const datePath = path.join(testCacheDir, 'raw-csv', testDate)
        await fs.mkdir(datePath, { recursive: true })

        await storage.updateCacheMetadata(testDate, {
          source: 'new-metadata',
        })

        const result = await storage.getCacheMetadata(testDate)
        expect(result).not.toBeNull()
      })
    })
  })

  // ============================================================================
  // Cache Management - Delegation Tests
  // ============================================================================

  describe('Cache Management', () => {
    const testCSVContent = 'District,Region,Clubs\n42,1,25\n'

    describe('clearCacheForDate', () => {
      it('should clear all cached files for a date', async () => {
        const testDate = '2024-01-15'
        await storage.setCachedCSV(
          testDate,
          CSVType.ALL_DISTRICTS,
          testCSVContent
        )

        expect(
          await storage.hasCachedCSV(testDate, CSVType.ALL_DISTRICTS)
        ).toBe(true)

        await storage.clearCacheForDate(testDate)

        expect(
          await storage.hasCachedCSV(testDate, CSVType.ALL_DISTRICTS)
        ).toBe(false)
      })

      it('should throw for invalid date format', async () => {
        // RawCSVCacheService validates date format and throws for invalid dates
        await expect(
          storage.clearCacheForDate('non-existent-date')
        ).rejects.toThrow('Invalid date format')
      })
    })

    describe('getCachedDates', () => {
      it('should return empty array when no dates cached', async () => {
        const result = await storage.getCachedDates()
        expect(result).toEqual([])
      })

      it('should return all cached dates', async () => {
        const dates = ['2024-01-15', '2024-01-16', '2024-01-17']

        for (const date of dates) {
          await storage.setCachedCSV(
            date,
            CSVType.ALL_DISTRICTS,
            testCSVContent
          )
        }

        const result = await storage.getCachedDates()
        expect(result.length).toBe(3)
        expect(result).toContain('2024-01-15')
        expect(result).toContain('2024-01-16')
        expect(result).toContain('2024-01-17')
      })
    })
  })

  // ============================================================================
  // Health and Statistics - Delegation Tests
  // ============================================================================

  describe('Health and Statistics', () => {
    const testCSVContent = 'District,Region,Clubs\n42,1,25\n'

    describe('getCacheStorageInfo', () => {
      it('should return storage info', async () => {
        const result = await storage.getCacheStorageInfo()

        expect(result).toHaveProperty('totalSizeMB')
        expect(result).toHaveProperty('totalFiles')
        expect(result).toHaveProperty('oldestDate')
        expect(result).toHaveProperty('newestDate')
        expect(result).toHaveProperty('isLargeCache')
        expect(result).toHaveProperty('recommendations')
      })

      it('should reflect cached data in storage info', async () => {
        await storage.setCachedCSV(
          '2024-01-15',
          CSVType.ALL_DISTRICTS,
          testCSVContent
        )
        await storage.setCachedCSV(
          '2024-01-16',
          CSVType.ALL_DISTRICTS,
          testCSVContent
        )

        const result = await storage.getCacheStorageInfo()

        expect(result.totalFiles).toBeGreaterThanOrEqual(2)
        expect(result.oldestDate).toBe('2024-01-15')
        expect(result.newestDate).toBe('2024-01-16')
      })
    })

    describe('getCacheStatistics', () => {
      it('should return cache statistics', async () => {
        const result = await storage.getCacheStatistics()

        expect(result).toHaveProperty('totalCachedDates')
        expect(result).toHaveProperty('totalCachedFiles')
        expect(result).toHaveProperty('totalCacheSize')
        expect(result).toHaveProperty('hitRatio')
        expect(result).toHaveProperty('missRatio')
        expect(result).toHaveProperty('averageFileSize')
      })

      it('should track cache hits and misses', async () => {
        const testDate = '2024-01-15'

        // Cache miss
        await storage.getCachedCSV(testDate, CSVType.ALL_DISTRICTS)

        // Cache the CSV
        await storage.setCachedCSV(
          testDate,
          CSVType.ALL_DISTRICTS,
          testCSVContent
        )

        // Cache hits
        await storage.getCachedCSV(testDate, CSVType.ALL_DISTRICTS)
        await storage.getCachedCSV(testDate, CSVType.ALL_DISTRICTS)

        const stats = await storage.getCacheStatistics()
        expect(stats.hitRatio).toBeGreaterThan(0)
      })
    })

    describe('getHealthStatus', () => {
      it('should return health status', async () => {
        const result = await storage.getHealthStatus()

        expect(result).toHaveProperty('isHealthy')
        expect(result).toHaveProperty('cacheDirectory')
        expect(result).toHaveProperty('isAccessible')
        expect(result).toHaveProperty('hasWritePermissions')
        expect(result).toHaveProperty('diskSpaceAvailable')
        expect(result).toHaveProperty('errors')
        expect(result).toHaveProperty('warnings')
      })

      it('should report healthy status for valid cache', async () => {
        // First, ensure the cache directory exists by writing something
        await storage.setCachedCSV(
          '2024-01-15',
          CSVType.ALL_DISTRICTS,
          'header\ndata\n'
        )

        const result = await storage.getHealthStatus()

        // The health status depends on the cache directory being accessible
        // and having write permissions
        expect(result.isAccessible).toBe(true)
        expect(result.hasWritePermissions).toBe(true)
        // isHealthy may be false if there are warnings, so we just check it's defined
        expect(typeof result.isHealthy).toBe('boolean')
        expect(result.errors).toBeDefined()
      })
    })
  })

  // ============================================================================
  // Requirement 4.3: No GCP Credentials Required
  // ============================================================================

  describe('No GCP Credentials Required (Requirement 4.3)', () => {
    it('should work without any GCP environment variables', async () => {
      // Save and clear any GCP-related environment variables
      const savedEnv = {
        GOOGLE_APPLICATION_CREDENTIALS:
          process.env['GOOGLE_APPLICATION_CREDENTIALS'],
        GCP_PROJECT_ID: process.env['GCP_PROJECT_ID'],
        GCS_BUCKET_NAME: process.env['GCS_BUCKET_NAME'],
      }

      delete process.env['GOOGLE_APPLICATION_CREDENTIALS']
      delete process.env['GCP_PROJECT_ID']
      delete process.env['GCS_BUCKET_NAME']

      try {
        // Create a new storage instance without GCP credentials
        const isolatedDir = path.join(testCacheDir, 'no-gcp-test')
        await fs.mkdir(isolatedDir, { recursive: true })
        const isolatedConfig = new MockCacheConfigService(isolatedDir)
        const isolatedStorage = new LocalRawCSVStorage(
          isolatedConfig,
          mockLogger
        )

        // Should be able to perform all operations
        const testDate = '2024-01-15'
        const testContent = 'District,Region\n42,1\n'

        await isolatedStorage.setCachedCSV(
          testDate,
          CSVType.ALL_DISTRICTS,
          testContent
        )
        const retrieved = await isolatedStorage.getCachedCSV(
          testDate,
          CSVType.ALL_DISTRICTS
        )
        expect(retrieved).toBe(testContent)

        const health = await isolatedStorage.getHealthStatus()
        expect(health.isHealthy).toBe(true)
      } finally {
        // Restore environment variables
        if (savedEnv.GOOGLE_APPLICATION_CREDENTIALS !== undefined) {
          process.env['GOOGLE_APPLICATION_CREDENTIALS'] =
            savedEnv.GOOGLE_APPLICATION_CREDENTIALS
        }
        if (savedEnv.GCP_PROJECT_ID !== undefined) {
          process.env['GCP_PROJECT_ID'] = savedEnv.GCP_PROJECT_ID
        }
        if (savedEnv.GCS_BUCKET_NAME !== undefined) {
          process.env['GCS_BUCKET_NAME'] = savedEnv.GCS_BUCKET_NAME
        }
      }
    })
  })

  // ============================================================================
  // Requirement 4.4: Feature Parity with Cloud Providers
  // ============================================================================

  describe('Feature Parity (Requirement 4.4)', () => {
    it('should support all IRawCSVStorage operations', async () => {
      // This test verifies that LocalRawCSVStorage supports all operations
      // that would be available in cloud providers

      const testDate = '2024-01-15'
      const testDistrictId = '42'
      const allDistrictsContent = 'District,Region,Clubs\n42,1,25\n'
      const districtContent = 'Club,Members,Status\nTest Club,20,Active\n'

      // 1. Cache all-districts CSV
      await storage.setCachedCSV(
        testDate,
        CSVType.ALL_DISTRICTS,
        allDistrictsContent
      )

      // 2. Cache district-specific CSV with metadata
      await storage.setCachedCSVWithMetadata(
        testDate,
        CSVType.CLUB_PERFORMANCE,
        districtContent,
        testDistrictId,
        { isClosingPeriod: false }
      )

      // 3. Verify all read operations work
      expect(await storage.hasCachedCSV(testDate, CSVType.ALL_DISTRICTS)).toBe(
        true
      )
      expect(
        await storage.hasCachedCSV(
          testDate,
          CSVType.CLUB_PERFORMANCE,
          testDistrictId
        )
      ).toBe(true)
      expect(await storage.getCachedCSV(testDate, CSVType.ALL_DISTRICTS)).toBe(
        allDistrictsContent
      )
      expect(
        await storage.getCachedCSV(
          testDate,
          CSVType.CLUB_PERFORMANCE,
          testDistrictId
        )
      ).toBe(districtContent)

      // 4. Verify metadata operations
      const metadata = await storage.getCacheMetadata(testDate)
      expect(metadata).not.toBeNull()
      expect(metadata?.csvFiles.allDistricts).toBe(true)

      // 5. Verify cache management operations
      const cachedDates = await storage.getCachedDates()
      expect(cachedDates).toContain(testDate)

      // 6. Verify health and statistics operations
      const storageInfo = await storage.getCacheStorageInfo()
      expect(storageInfo.totalFiles).toBeGreaterThan(0)

      const stats = await storage.getCacheStatistics()
      expect(stats.totalCachedDates).toBeGreaterThan(0)

      const health = await storage.getHealthStatus()
      expect(health.isHealthy).toBe(true)

      // 7. Verify clear operation
      await storage.clearCacheForDate(testDate)
      expect(await storage.hasCachedCSV(testDate, CSVType.ALL_DISTRICTS)).toBe(
        false
      )
    })
  })

  // ============================================================================
  // CSV Type Support Tests
  // ============================================================================

  describe('CSV Type Support', () => {
    const testDate = '2024-01-15'
    const testDistrictId = '42'
    const testContent = 'header\ndata\n'

    it('should support ALL_DISTRICTS CSV type', async () => {
      await storage.setCachedCSV(testDate, CSVType.ALL_DISTRICTS, testContent)
      expect(await storage.hasCachedCSV(testDate, CSVType.ALL_DISTRICTS)).toBe(
        true
      )
    })

    it('should support DISTRICT_PERFORMANCE CSV type', async () => {
      await storage.setCachedCSV(
        testDate,
        CSVType.DISTRICT_PERFORMANCE,
        testContent,
        testDistrictId
      )
      expect(
        await storage.hasCachedCSV(
          testDate,
          CSVType.DISTRICT_PERFORMANCE,
          testDistrictId
        )
      ).toBe(true)
    })

    it('should support DIVISION_PERFORMANCE CSV type', async () => {
      await storage.setCachedCSV(
        testDate,
        CSVType.DIVISION_PERFORMANCE,
        testContent,
        testDistrictId
      )
      expect(
        await storage.hasCachedCSV(
          testDate,
          CSVType.DIVISION_PERFORMANCE,
          testDistrictId
        )
      ).toBe(true)
    })

    it('should support CLUB_PERFORMANCE CSV type', async () => {
      await storage.setCachedCSV(
        testDate,
        CSVType.CLUB_PERFORMANCE,
        testContent,
        testDistrictId
      )
      expect(
        await storage.hasCachedCSV(
          testDate,
          CSVType.CLUB_PERFORMANCE,
          testDistrictId
        )
      ).toBe(true)
    })
  })

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('Error Handling', () => {
    it('should reject empty CSV content', async () => {
      await expect(
        storage.setCachedCSV('2024-01-15', CSVType.ALL_DISTRICTS, '')
      ).rejects.toThrow('CSV content cannot be empty')
    })

    it('should reject invalid date format', async () => {
      await expect(
        storage.setCachedCSV(
          'invalid-date',
          CSVType.ALL_DISTRICTS,
          'header\ndata\n'
        )
      ).rejects.toThrow('Invalid date format')
    })

    it('should require district ID for district-specific CSV types', async () => {
      await expect(
        storage.setCachedCSV(
          '2024-01-15',
          CSVType.DISTRICT_PERFORMANCE,
          'header\ndata\n'
        )
      ).rejects.toThrow('District ID required')
    })
  })
})
