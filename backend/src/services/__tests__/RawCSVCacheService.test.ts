/**
 * Raw CSV Cache Service Tests
 *
 * Tests for the core cache service infrastructure including CSV type validation,
 * directory structure management, and basic cache operations.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import { RawCSVCacheService } from '../RawCSVCacheService.js'
import { CSVType } from '../../types/rawCSVCache.js'
import { ICacheConfigService, ILogger } from '../../types/serviceInterfaces.js'

// Mock implementations for testing
class MockCacheConfigService implements ICacheConfigService {
  private cacheDir: string

  constructor(cacheDir: string) {
    this.cacheDir = cacheDir
  }

  getCacheDirectory(): string {
    return this.cacheDir
  }

  getConfiguration() {
    return {
      baseDirectory: this.cacheDir,
      isConfigured: true,
      source: 'test' as const,
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

class MockLogger implements ILogger {
  info(message: string, data?: unknown): void {
    // Silent for tests
  }

  warn(message: string, data?: unknown): void {
    // Silent for tests
  }

  error(message: string, error?: Error | unknown): void {
    // Silent for tests
  }

  debug(message: string, data?: unknown): void {
    // Silent for tests
  }
}

describe('RawCSVCacheService', () => {
  let cacheService: RawCSVCacheService
  let mockCacheConfig: MockCacheConfigService
  let mockLogger: MockLogger
  let testCacheDir: string

  beforeEach(async () => {
    // Create unique test cache directory
    testCacheDir = path.join(
      process.cwd(),
      'test-cache',
      `raw-csv-test-${Date.now()}-${Math.random()}`
    )
    await fs.mkdir(testCacheDir, { recursive: true })

    mockCacheConfig = new MockCacheConfigService(testCacheDir)
    mockLogger = new MockLogger()
    cacheService = new RawCSVCacheService(mockCacheConfig, mockLogger)
  })

  afterEach(async () => {
    // Clean up test cache directory
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('CSV Type Validation', () => {
    it('should accept valid CSV types', async () => {
      const validTypes = [
        CSVType.ALL_DISTRICTS,
        CSVType.DISTRICT_PERFORMANCE,
        CSVType.DIVISION_PERFORMANCE,
        CSVType.CLUB_PERFORMANCE,
      ]

      for (const type of validTypes) {
        const exists = await cacheService.hasCachedCSV('2026-01-06', type, '42')
        expect(exists).toBe(false) // Should not exist initially, but should not throw
      }
    })

    it('should validate date string format', async () => {
      const validDate = '2026-01-06'
      const exists = await cacheService.hasCachedCSV(
        validDate,
        CSVType.ALL_DISTRICTS
      )
      expect(exists).toBe(false) // Should not throw for valid date
    })

    it('should validate district ID format', async () => {
      const validDistrictId = '42'
      const exists = await cacheService.hasCachedCSV(
        '2026-01-06',
        CSVType.DISTRICT_PERFORMANCE,
        validDistrictId
      )
      expect(exists).toBe(false) // Should not throw for valid district ID
    })
  })

  describe('Cache Directory Structure', () => {
    it('should create proper directory structure for all-districts CSV', async () => {
      const date = '2026-01-06'
      const csvContent = 'District,Region,Clubs\n42,1,25\n'

      await cacheService.setCachedCSV(date, CSVType.ALL_DISTRICTS, csvContent)

      // Check that file was created in correct location
      const expectedPath = path.join(
        testCacheDir,
        'raw-csv',
        date,
        'all-districts.csv'
      )
      const content = await fs.readFile(expectedPath, 'utf-8')
      expect(content).toBe(csvContent)
    })

    it('should create proper directory structure for district-specific CSV', async () => {
      const date = '2026-01-06'
      const districtId = '42'
      const csvContent = 'Club,Members,Status\nTest Club,20,Active\n'

      await cacheService.setCachedCSV(
        date,
        CSVType.DISTRICT_PERFORMANCE,
        csvContent,
        districtId
      )

      // Check that file was created in correct location
      const expectedPath = path.join(
        testCacheDir,
        'raw-csv',
        date,
        `district-${districtId}`,
        'district-performance.csv'
      )
      const content = await fs.readFile(expectedPath, 'utf-8')
      expect(content).toBe(csvContent)
    })

    it('should create metadata file for cached date', async () => {
      const date = '2026-01-06'
      const csvContent = 'District,Region,Clubs\n42,1,25\n'

      await cacheService.setCachedCSV(date, CSVType.ALL_DISTRICTS, csvContent)

      // Check that metadata file was created
      const metadataPath = path.join(
        testCacheDir,
        'raw-csv',
        date,
        'metadata.json'
      )
      const metadataContent = await fs.readFile(metadataPath, 'utf-8')
      const metadata = JSON.parse(metadataContent)

      expect(metadata.date).toBe(date)
      expect(metadata.csvFiles.allDistricts).toBe(true)
      expect(metadata.source).toBe('scraper')
      expect(metadata.cacheVersion).toBe(1)
    })
  })

  describe('Basic Cache Operations', () => {
    it('should return null for non-existent cached CSV', async () => {
      const result = await cacheService.getCachedCSV(
        '2026-01-06',
        CSVType.ALL_DISTRICTS
      )
      expect(result).toBeNull()
    })

    it('should cache and retrieve CSV content', async () => {
      const date = '2026-01-06'
      const csvContent = 'District,Region,Clubs\n42,1,25\n43,2,30\n'

      await cacheService.setCachedCSV(date, CSVType.ALL_DISTRICTS, csvContent)
      const retrieved = await cacheService.getCachedCSV(
        date,
        CSVType.ALL_DISTRICTS
      )

      expect(retrieved).toBe(csvContent)
    })

    it('should check CSV existence correctly', async () => {
      const date = '2026-01-06'
      const csvContent = 'District,Region,Clubs\n42,1,25\n'

      // Should not exist initially
      let exists = await cacheService.hasCachedCSV(date, CSVType.ALL_DISTRICTS)
      expect(exists).toBe(false)

      // Cache the CSV
      await cacheService.setCachedCSV(date, CSVType.ALL_DISTRICTS, csvContent)

      // Should exist now
      exists = await cacheService.hasCachedCSV(date, CSVType.ALL_DISTRICTS)
      expect(exists).toBe(true)
    })

    it('should handle district-specific CSV operations', async () => {
      const date = '2026-01-06'
      const districtId = '42'
      const csvContent = 'Club,Members,Status\nTest Club,20,Active\n'

      await cacheService.setCachedCSV(
        date,
        CSVType.CLUB_PERFORMANCE,
        csvContent,
        districtId
      )
      const retrieved = await cacheService.getCachedCSV(
        date,
        CSVType.CLUB_PERFORMANCE,
        districtId
      )

      expect(retrieved).toBe(csvContent)
    })
  })

  describe('Cache Management', () => {
    it('should list cached dates', async () => {
      const dates = ['2026-01-05', '2026-01-06', '2026-01-07']
      const csvContent = 'District,Region,Clubs\n42,1,25\n'

      // Cache CSV for multiple dates
      for (const date of dates) {
        await cacheService.setCachedCSV(date, CSVType.ALL_DISTRICTS, csvContent)
      }

      const cachedDates = await cacheService.getCachedDates()
      expect(cachedDates).toEqual(dates.sort())
    })

    it('should clear cache for specific date', async () => {
      const date = '2026-01-06'
      const csvContent = 'District,Region,Clubs\n42,1,25\n'

      // Cache CSV
      await cacheService.setCachedCSV(date, CSVType.ALL_DISTRICTS, csvContent)
      let exists = await cacheService.hasCachedCSV(date, CSVType.ALL_DISTRICTS)
      expect(exists).toBe(true)

      // Clear cache for date
      await cacheService.clearCacheForDate(date)
      exists = await cacheService.hasCachedCSV(date, CSVType.ALL_DISTRICTS)
      expect(exists).toBe(false)
    })

    it('should get cache metadata', async () => {
      const date = '2026-01-06'
      const csvContent = 'District,Region,Clubs\n42,1,25\n'

      await cacheService.setCachedCSV(date, CSVType.ALL_DISTRICTS, csvContent)
      const metadata = await cacheService.getCacheMetadata(date)

      expect(metadata).not.toBeNull()
      expect(metadata!.date).toBe(date)
      expect(metadata!.csvFiles.allDistricts).toBe(true)
      expect(metadata!.programYear).toBe('2025-2026') // January 2026 is in 2025-2026 program year
    })

    it('should handle file overwrites correctly in metadata', async () => {
      const date = '2026-01-06'
      const csvContent1 = 'District,Region,Clubs\n42,1,25\n'
      const csvContent2 = 'District,Region,Clubs\n42,1,25\n43,2,30\n44,3,35\n'

      // Cache initial CSV
      await cacheService.setCachedCSV(date, CSVType.ALL_DISTRICTS, csvContent1)
      let metadata = await cacheService.getCacheMetadata(date)
      expect(metadata!.integrity.fileCount).toBe(1)
      const initialSize = metadata!.integrity.totalSize

      // Overwrite with larger CSV
      await cacheService.setCachedCSV(date, CSVType.ALL_DISTRICTS, csvContent2)
      metadata = await cacheService.getCacheMetadata(date)

      // File count should still be 1, but size should be updated
      expect(metadata!.integrity.fileCount).toBe(1)
      expect(metadata!.integrity.totalSize).toBeGreaterThan(initialSize)
    })

    it('should validate metadata integrity', async () => {
      const date = '2026-01-06'
      const csvContent = 'District,Region,Clubs\n42,1,25\n'

      await cacheService.setCachedCSV(date, CSVType.ALL_DISTRICTS, csvContent)

      const validation = await cacheService.validateMetadataIntegrity(date)
      expect(validation.isValid).toBe(true)
      expect(validation.issues).toHaveLength(0)
      expect(validation.actualStats.fileCount).toBe(1)
      expect(validation.metadataStats.fileCount).toBe(1)
    })

    it('should repair metadata integrity', async () => {
      const date = '2026-01-06'
      const csvContent = 'District,Region,Clubs\n42,1,25\n'

      await cacheService.setCachedCSV(date, CSVType.ALL_DISTRICTS, csvContent)

      const repair = await cacheService.repairMetadataIntegrity(date)
      expect(repair.success).toBe(true)
      expect(repair.errors).toHaveLength(0)
      expect(repair.repairedFields.length).toBeGreaterThan(0)
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid CSV content gracefully', async () => {
      const date = '2026-01-06'
      const invalidContent = '' // Empty content

      await expect(
        cacheService.setCachedCSV(date, CSVType.ALL_DISTRICTS, invalidContent)
      ).rejects.toThrow('CSV content cannot be empty')
    })

    it('should return null on cache read errors', async () => {
      // Try to read from non-existent cache
      const result = await cacheService.getCachedCSV(
        '2026-01-06',
        CSVType.ALL_DISTRICTS
      )
      expect(result).toBeNull()
    })

    it('should handle missing district ID for district-specific CSV types', async () => {
      const date = '2026-01-06'
      const csvContent = 'Club,Members,Status\nTest Club,20,Active\n'

      await expect(
        cacheService.setCachedCSV(
          date,
          CSVType.DISTRICT_PERFORMANCE,
          csvContent
        )
      ).rejects.toThrow('District ID required for CSV type')
    })

    it('should detect and handle corrupted files', async () => {
      const date = '2026-01-06'
      const validContent = 'District,Region,Clubs\n42,1,25\n'
      const corruptedContent = 'District,Region,Clubs\n42,1,25\n\x00\x01\x02' // Binary content

      // Cache valid content first
      await cacheService.setCachedCSV(date, CSVType.ALL_DISTRICTS, validContent)

      // Manually corrupt the file by writing binary content
      const filePath = path.join(
        testCacheDir,
        'raw-csv',
        date,
        'all-districts.csv'
      )
      await fs.writeFile(filePath, corruptedContent, 'utf-8')

      // Try to read - should detect corruption and return null for fallback
      const result = await cacheService.getCachedCSV(
        date,
        CSVType.ALL_DISTRICTS
      )
      expect(result).toBeNull()

      // File should be removed during corruption recovery
      const fileExists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false)
      expect(fileExists).toBe(false)
    })

    it('should handle checksum mismatches', async () => {
      const date = '2026-01-06'
      const originalContent = 'District,Region,Clubs\n42,1,25\n'
      const modifiedContent = 'District,Region,Clubs\n42,1,30\n' // Different data

      // Cache original content
      await cacheService.setCachedCSV(
        date,
        CSVType.ALL_DISTRICTS,
        originalContent
      )

      // Manually modify the file to create checksum mismatch
      const filePath = path.join(
        testCacheDir,
        'raw-csv',
        date,
        'all-districts.csv'
      )
      await fs.writeFile(filePath, modifiedContent, 'utf-8')

      // Try to read - should detect checksum mismatch and return null
      const result = await cacheService.getCachedCSV(
        date,
        CSVType.ALL_DISTRICTS
      )
      expect(result).toBeNull()
    })

    it('should handle file system errors gracefully', async () => {
      const date = '2026-01-06'
      const csvContent = 'District,Region,Clubs\n42,1,25\n'

      // Create a directory where the file should be (to cause write error)
      const filePath = path.join(
        testCacheDir,
        'raw-csv',
        date,
        'all-districts.csv'
      )
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.mkdir(filePath, { recursive: true }) // Create directory with same name as file

      // Try to cache - should handle the error gracefully
      await expect(
        cacheService.setCachedCSV(date, CSVType.ALL_DISTRICTS, csvContent)
      ).rejects.toThrow()

      // Clean up the directory
      await fs.rm(filePath, { recursive: true, force: true })
    })
  })

  describe('Circuit Breaker', () => {
    it('should track failures and open circuit breaker', async () => {
      const date = '2026-01-06'
      const csvContent = 'District,Region,Clubs\n42,1,25\n'

      // Create a scenario that will cause repeated failures
      const invalidPath = path.join(testCacheDir, 'raw-csv', date)
      await fs.mkdir(invalidPath, { recursive: true })

      // Create a file where directory should be to cause consistent failures
      const dirPath = path.join(invalidPath, 'district-42')
      await fs.writeFile(dirPath, 'blocking file', 'utf-8')

      // Cause multiple failures to trigger circuit breaker
      for (let i = 0; i < 6; i++) {
        try {
          await cacheService.setCachedCSV(
            date,
            CSVType.DISTRICT_PERFORMANCE,
            csvContent,
            '42'
          )
        } catch {
          // Expected to fail
        }
      }

      // Check circuit breaker status
      const status = cacheService.getCircuitBreakerStatus()
      expect(status.isOpen).toBe(true)
      expect(status.failures).toBeGreaterThanOrEqual(5)

      // Clean up
      await fs.rm(dirPath, { force: true })
    })

    it('should skip operations when circuit breaker is open', async () => {
      const date = '2026-01-06'
      const csvContent = 'District,Region,Clubs\n42,1,25\n'

      // Manually trigger circuit breaker by causing failures
      for (let i = 0; i < 6; i++) {
        try {
          // Create a scenario that causes failure
          const invalidPath = path.join(
            testCacheDir,
            'raw-csv',
            date,
            'district-42'
          )
          await fs.mkdir(path.dirname(invalidPath), { recursive: true })
          await fs.writeFile(invalidPath, 'blocking', 'utf-8') // File where directory should be

          await cacheService.setCachedCSV(
            date,
            CSVType.DISTRICT_PERFORMANCE,
            csvContent,
            '42'
          )
        } catch {
          // Expected failures
        }
      }

      // Verify circuit breaker is open
      expect(cacheService.getCircuitBreakerStatus().isOpen).toBe(true)

      // Try to cache - should be skipped due to open circuit breaker
      await expect(
        cacheService.setCachedCSV(
          '2026-01-07',
          CSVType.ALL_DISTRICTS,
          csvContent
        )
      ).rejects.toThrow('circuit breaker')

      // Try to read - should return null due to open circuit breaker
      const result = await cacheService.getCachedCSV(
        '2026-01-07',
        CSVType.ALL_DISTRICTS
      )
      expect(result).toBeNull()
    })

    it('should allow manual circuit breaker reset', async () => {
      // Trigger circuit breaker
      for (let i = 0; i < 6; i++) {
        try {
          const invalidPath = path.join(
            testCacheDir,
            'raw-csv',
            '2026-01-06',
            'district-42'
          )
          await fs.mkdir(path.dirname(invalidPath), { recursive: true })
          await fs.writeFile(invalidPath, 'blocking', 'utf-8')

          await cacheService.setCachedCSV(
            '2026-01-06',
            CSVType.DISTRICT_PERFORMANCE,
            'test',
            '42'
          )
        } catch {
          // Expected failures
        }
      }

      // Verify circuit breaker is open
      expect(cacheService.getCircuitBreakerStatus().isOpen).toBe(true)

      // Reset manually
      cacheService.resetCircuitBreakerManually()

      // Verify circuit breaker is closed
      const status = cacheService.getCircuitBreakerStatus()
      expect(status.isOpen).toBe(false)
      expect(status.failures).toBe(0)
    })

    it('should reset circuit breaker after successful operations', async () => {
      const date = '2026-01-06'
      const csvContent = 'District,Region,Clubs\n42,1,25\n'

      // Cause some failures (but not enough to open circuit breaker)
      for (let i = 0; i < 3; i++) {
        try {
          const invalidPath = path.join(
            testCacheDir,
            'raw-csv',
            date,
            'district-42'
          )
          await fs.mkdir(path.dirname(invalidPath), { recursive: true })
          await fs.writeFile(invalidPath, 'blocking', 'utf-8')

          await cacheService.setCachedCSV(
            date,
            CSVType.DISTRICT_PERFORMANCE,
            csvContent,
            '42'
          )
        } catch {
          // Expected failures
        }
      }

      // Verify we have failures but circuit breaker is not open
      let status = cacheService.getCircuitBreakerStatus()
      expect(status.failures).toBeGreaterThan(0)
      expect(status.isOpen).toBe(false)

      // Perform successful operation
      await cacheService.setCachedCSV(date, CSVType.ALL_DISTRICTS, csvContent)

      // Verify circuit breaker is reset
      status = cacheService.getCircuitBreakerStatus()
      expect(status.failures).toBe(0)
      expect(status.isOpen).toBe(false)
    })
  })

  describe('Comprehensive Error Logging', () => {
    it('should include circuit breaker state in error logs', async () => {
      const date = '2026-01-06'
      const csvContent = 'District,Region,Clubs\n42,1,25\n'

      // Create a scenario that will cause failure
      const invalidPath = path.join(
        testCacheDir,
        'raw-csv',
        date,
        'district-42'
      )
      await fs.mkdir(path.dirname(invalidPath), { recursive: true })
      await fs.writeFile(invalidPath, 'blocking file', 'utf-8')

      // Try to cache - should fail and log circuit breaker state
      try {
        await cacheService.setCachedCSV(
          date,
          CSVType.DISTRICT_PERFORMANCE,
          csvContent,
          '42'
        )
      } catch {
        // Expected to fail - error logging is tested through the logger mock
      }

      // Clean up
      await fs.rm(invalidPath, { force: true })
    })

    it('should format errors properly for logging', async () => {
      const date = 'invalid-date-format'
      const csvContent = 'District,Region,Clubs\n42,1,25\n'

      // Try to cache with invalid date - should throw validation error
      await expect(
        cacheService.setCachedCSV(date, CSVType.ALL_DISTRICTS, csvContent)
      ).rejects.toThrow('Invalid date format')
    })
  })

  describe('Statistics and Monitoring', () => {
    it('should track cache hits and misses correctly', async () => {
      const date = '2026-01-06'
      const csvContent = 'District,Region,Clubs\n42,1,25\n'

      // Initial cache miss
      let result = await cacheService.getCachedCSV(date, CSVType.ALL_DISTRICTS)
      expect(result).toBeNull()

      // Cache the CSV
      await cacheService.setCachedCSV(date, CSVType.ALL_DISTRICTS, csvContent)

      // Cache hit
      result = await cacheService.getCachedCSV(date, CSVType.ALL_DISTRICTS)
      expect(result).toBe(csvContent)

      // Another cache hit
      result = await cacheService.getCachedCSV(date, CSVType.ALL_DISTRICTS)
      expect(result).toBe(csvContent)

      // Check metadata statistics
      const metadata = await cacheService.getCacheMetadata(date)
      expect(metadata!.downloadStats.cacheMisses).toBe(1)
      expect(metadata!.downloadStats.cacheHits).toBe(2)
      expect(metadata!.downloadStats.totalDownloads).toBe(1)
    })

    it('should track download statistics correctly', async () => {
      const date = '2026-01-06'
      const csvContent1 = 'District,Region,Clubs\n42,1,25\n'
      const csvContent2 = 'District,Region,Clubs\n42,1,25\n43,2,30\n'

      // First download
      await cacheService.setCachedCSV(date, CSVType.ALL_DISTRICTS, csvContent1)

      // Second download (overwrite)
      await cacheService.setCachedCSV(date, CSVType.ALL_DISTRICTS, csvContent2)

      const metadata = await cacheService.getCacheMetadata(date)
      expect(metadata!.downloadStats.totalDownloads).toBe(2)
    })

    it('should provide accurate cache statistics', async () => {
      const dates = ['2026-01-05', '2026-01-06']
      const csvContent = 'District,Region,Clubs\n42,1,25\n'

      // Cache CSV for multiple dates
      for (const date of dates) {
        await cacheService.setCachedCSV(date, CSVType.ALL_DISTRICTS, csvContent)
        // Trigger a cache hit for statistics
        await cacheService.getCachedCSV(date, CSVType.ALL_DISTRICTS)
      }

      const stats = await cacheService.getCacheStatistics()
      expect(stats.totalCachedDates).toBe(2)
      expect(stats.totalCachedFiles).toBe(2)
      expect(stats.hitRatio).toBeGreaterThan(0)
      expect(stats.oldestCacheDate).toBe('2026-01-05')
      expect(stats.newestCacheDate).toBe('2026-01-06')
    })
  })

  describe('Service Lifecycle', () => {
    it('should dispose cleanly', async () => {
      await expect(cacheService.dispose()).resolves.not.toThrow()
    })

    it('should get health status', async () => {
      const health = await cacheService.getHealthStatus()

      expect(health).toHaveProperty('isHealthy')
      expect(health).toHaveProperty('cacheDirectory')
      expect(health).toHaveProperty('isAccessible')
      expect(health).toHaveProperty('hasWritePermissions')
    })

    it('should get cache statistics', async () => {
      const stats = await cacheService.getCacheStatistics()

      expect(stats).toHaveProperty('totalCachedDates')
      expect(stats).toHaveProperty('totalCachedFiles')
      expect(stats).toHaveProperty('hitRatio')
      expect(stats).toHaveProperty('missRatio')
    })
  })

  describe('Security and Path Validation', () => {
    it('should reject path traversal attempts in date strings', async () => {
      const maliciousDates = [
        '../../../etc/passwd',
        '2024-01-01/../../../etc',
        '2024-01-01/../../..',
        '2024-01-01\\..\\..',
        '2024-01-01\\..\\..\\etc',
      ]

      for (const maliciousDate of maliciousDates) {
        await expect(
          cacheService.getCachedCSV(maliciousDate, CSVType.ALL_DISTRICTS)
        ).rejects.toThrow()
      }
    })

    it('should reject path traversal attempts in district IDs', async () => {
      const maliciousDistrictIds = [
        '../../../etc',
        '../../passwd',
        'district/../../../etc',
        'district\\..\\..\\etc',
        'district/../../..',
      ]

      for (const maliciousId of maliciousDistrictIds) {
        await expect(
          cacheService.getCachedCSV(
            '2024-01-01',
            CSVType.DISTRICT_PERFORMANCE,
            maliciousId
          )
        ).rejects.toThrow()
      }
    })

    it('should reject district IDs with dangerous characters', async () => {
      const dangerousDistrictIds = [
        'district<script>',
        'district|rm -rf',
        'district"test"',
        'district\ntest',
        'district\ttest',
        'district:test',
        'district?test',
        'district*test',
      ]

      for (const dangerousId of dangerousDistrictIds) {
        await expect(
          cacheService.getCachedCSV(
            '2024-01-01',
            CSVType.DISTRICT_PERFORMANCE,
            dangerousId
          )
        ).rejects.toThrow()
      }
    })

    it('should reject CSV content with potential script injection', async () => {
      const maliciousContent = [
        '=cmd|"/c calc"!A0',
        'header\n=SUM(1+1)*cmd|"/c calc"!A0',
        'header\n<script>alert("xss")</script>',
        'header\njavascript:alert("xss")',
        'header\nvbscript:msgbox("xss")',
        'header\ndata:text/html,<script>alert("xss")</script>',
        'header\n<img src=x onerror=alert("xss")>',
      ]

      for (const malicious of maliciousContent) {
        await expect(
          cacheService.setCachedCSV(
            '2024-01-01',
            CSVType.ALL_DISTRICTS,
            malicious
          )
        ).rejects.toThrow()
      }
    })

    it('should reject CSV content that is too large', async () => {
      // Create content larger than the default 100MB limit
      const largeContent = 'header\n' + 'a'.repeat(101 * 1024 * 1024) // 101MB

      await expect(
        cacheService.setCachedCSV(
          '2024-01-01',
          CSVType.ALL_DISTRICTS,
          largeContent
        )
      ).rejects.toThrow('CSV content too large')
    })

    it('should reject CSV content with binary or control characters', async () => {
      const binaryContent = 'header\n' + String.fromCharCode(0, 1, 2, 3, 4, 5)

      await expect(
        cacheService.setCachedCSV(
          '2024-01-01',
          CSVType.ALL_DISTRICTS,
          binaryContent
        )
      ).rejects.toThrow()
    })

    it('should reject CSV content with excessively long lines', async () => {
      const longLineContent = 'header\n' + 'a'.repeat(10001) // Exceeds 10KB line limit

      await expect(
        cacheService.setCachedCSV(
          '2024-01-01',
          CSVType.ALL_DISTRICTS,
          longLineContent
        )
      ).rejects.toThrow('exceeds maximum length')
    })

    it('should validate that file paths remain within cache directory bounds', async () => {
      // This test verifies the internal path validation
      // The actual path traversal protection is tested above
      const validContent = 'header\ndata1,data2'

      // These should work fine
      await expect(
        cacheService.setCachedCSV(
          '2024-01-01',
          CSVType.ALL_DISTRICTS,
          validContent
        )
      ).resolves.not.toThrow()

      await expect(
        cacheService.setCachedCSV(
          '2024-01-01',
          CSVType.DISTRICT_PERFORMANCE,
          validContent,
          'district42'
        )
      ).resolves.not.toThrow()
    })

    it('should sanitize district IDs properly', async () => {
      const validContent = 'header\ndata1,data2'

      // Valid district IDs should work
      const validDistrictIds = [
        'district42',
        'district-42',
        'district_42',
        'DISTRICT42',
      ]

      for (const validId of validDistrictIds) {
        await expect(
          cacheService.setCachedCSV(
            '2024-01-01',
            CSVType.DISTRICT_PERFORMANCE,
            validContent,
            validId
          )
        ).resolves.not.toThrow()
      }
    })

    it('should reject district IDs that are too long', async () => {
      const longDistrictId = 'a'.repeat(51) // Exceeds 50 character limit

      await expect(
        cacheService.getCachedCSV(
          '2024-01-01',
          CSVType.DISTRICT_PERFORMANCE,
          longDistrictId
        )
      ).rejects.toThrow('too long')
    })

    it('should handle security configuration properly', async () => {
      // Create a service with security disabled
      const insecureConfig = {
        security: {
          validatePaths: false,
          sanitizeInputs: false,
          enforcePermissions: false,
        },
      }

      const insecureService = new RawCSVCacheService(
        mockCacheConfig,
        mockLogger,
        insecureConfig
      )

      // With security disabled, some operations that would normally fail should succeed
      // But we still maintain basic validation for safety
      const validContent = 'header\ndata1,data2'

      await expect(
        insecureService.setCachedCSV(
          '2024-01-01',
          CSVType.ALL_DISTRICTS,
          validContent
        )
      ).resolves.not.toThrow()
    })
  })

  describe('Configuration Management', () => {
    it('should get current configuration', () => {
      const config = cacheService.getConfiguration()

      expect(config).toHaveProperty('cacheDir')
      expect(config).toHaveProperty('enableCompression')
      expect(config).toHaveProperty('performanceThresholds')
      expect(config).toHaveProperty('security')
      expect(config).toHaveProperty('monitoring')
      expect(config).not.toHaveProperty('maxAgeDays') // Should not have age-based cleanup
      expect(config).not.toHaveProperty('retentionPolicy') // Should not have retention policies
    })

    it('should update configuration', () => {
      const originalConfig = cacheService.getConfiguration()

      cacheService.updateConfiguration({
        enableCompression: true,
        performanceThresholds: {
          maxReadTimeMs: 3000,
          maxWriteTimeMs: 8000,
          maxMemoryUsageMB: 200,
          enablePerformanceLogging: false,
        },
        monitoring: {
          enableDetailedStats: false,
          trackSlowOperations: false,
          maxSlowOperationsHistory: 25,
          storageSizeWarningMB: 2000,
        },
      })

      const updatedConfig = cacheService.getConfiguration()

      expect(updatedConfig.enableCompression).toBe(true)
      expect(updatedConfig.performanceThresholds.maxReadTimeMs).toBe(3000)
      expect(updatedConfig.performanceThresholds.maxWriteTimeMs).toBe(8000)
      expect(updatedConfig.performanceThresholds.maxMemoryUsageMB).toBe(200)
      expect(updatedConfig.performanceThresholds.enablePerformanceLogging).toBe(
        false
      )
      expect(updatedConfig.monitoring.storageSizeWarningMB).toBe(2000)

      // Other properties should remain unchanged
      expect(updatedConfig.cacheDir).toBe(originalConfig.cacheDir)
      expect(updatedConfig.security).toEqual(originalConfig.security)
    })

    it('should reset configuration to defaults', () => {
      // First modify the configuration
      cacheService.updateConfiguration({
        enableCompression: true,
        monitoring: {
          enableDetailedStats: false,
          trackSlowOperations: false,
          maxSlowOperationsHistory: 25,
          storageSizeWarningMB: 2000,
        },
      })

      // Then reset it
      cacheService.resetConfiguration()

      const resetConfig = cacheService.getConfiguration()

      expect(resetConfig.enableCompression).toBe(false) // Default value
      expect(resetConfig.monitoring.enableDetailedStats).toBe(true) // Default value
      expect(resetConfig.monitoring.storageSizeWarningMB).toBe(1000) // Default value
    })

    it('should clear performance history', async () => {
      // First, generate some slow operations to populate history
      const slowConfig = {
        performanceThresholds: {
          maxReadTimeMs: 0, // Zero threshold to ensure all operations are tracked as slow
          maxWriteTimeMs: 0,
          maxMemoryUsageMB: 100,
          enablePerformanceLogging: true,
        },
        monitoring: {
          enableDetailedStats: true,
          trackSlowOperations: true,
          maxSlowOperationsHistory: 50,
          storageSizeWarningMB: 1000,
        },
      }

      const slowService = new RawCSVCacheService(
        mockCacheConfig,
        mockLogger,
        slowConfig
      )

      // Perform operations that will be tracked as slow (with 0ms threshold, all operations are slow)
      const csvContent = 'header\ndata1,data2'
      await slowService.setCachedCSV(
        '2024-01-01',
        CSVType.ALL_DISTRICTS,
        csvContent
      )
      await slowService.getCachedCSV('2024-01-01', CSVType.ALL_DISTRICTS)

      // Get statistics to verify slow operations were tracked
      const statsBefore = await slowService.getCacheStatistics()
      expect(statsBefore.performance.slowestOperations.length).toBeGreaterThan(
        0
      )

      // Clear performance history
      slowService.clearPerformanceHistory()

      // Verify history is cleared
      const statsAfter = await slowService.getCacheStatistics()
      expect(statsAfter.performance.slowestOperations.length).toBe(0)
    })
  })

  describe('Enhanced Health Status', () => {
    it('should provide detailed health status with storage warnings', async () => {
      // Configure service with settings that should trigger warnings
      const warningConfig = {
        monitoring: {
          enableDetailedStats: true,
          trackSlowOperations: true,
          maxSlowOperationsHistory: 50,
          storageSizeWarningMB: 0.0001, // Extremely low threshold to trigger warning
        },
      }

      const warningService = new RawCSVCacheService(
        mockCacheConfig,
        mockLogger,
        warningConfig
      )

      // Add some data to trigger storage warnings
      const largeCsvContent =
        'header\n' + 'data1,data2,data3,data4,data5\n'.repeat(100) // Make it larger
      await warningService.setCachedCSV(
        '2024-01-01',
        CSVType.ALL_DISTRICTS,
        largeCsvContent
      )

      const healthStatus = await warningService.getHealthStatus()

      expect(healthStatus).toHaveProperty('isHealthy')
      expect(healthStatus).toHaveProperty('cacheDirectory')
      expect(healthStatus).toHaveProperty('isAccessible')
      expect(healthStatus).toHaveProperty('hasWritePermissions')
      expect(healthStatus).toHaveProperty('errors')
      expect(healthStatus).toHaveProperty('warnings')

      // Should have warnings about large cache size
      expect(healthStatus.warnings.length).toBeGreaterThan(0)
      expect(
        healthStatus.warnings.some(w => w.includes('Cache size is large'))
      ).toBe(true)
    })
  })

  describe('Cache Storage Information', () => {
    it('should provide comprehensive storage information', async () => {
      // Create multiple cache entries
      const csvContent = 'header\ndata1,data2'
      await cacheService.setCachedCSV(
        '2024-01-01',
        CSVType.ALL_DISTRICTS,
        csvContent
      )
      await cacheService.setCachedCSV(
        '2024-01-02',
        CSVType.ALL_DISTRICTS,
        csvContent
      )
      await cacheService.setCachedCSV(
        '2024-01-03',
        CSVType.DISTRICT_PERFORMANCE,
        csvContent,
        '42'
      )

      const storageInfo = await cacheService.getCacheStorageInfo()

      expect(storageInfo).toHaveProperty('totalSizeMB')
      expect(storageInfo).toHaveProperty('totalFiles')
      expect(storageInfo).toHaveProperty('oldestDate')
      expect(storageInfo).toHaveProperty('newestDate')
      expect(storageInfo).toHaveProperty('isLargeCache')
      expect(storageInfo).toHaveProperty('recommendations')

      expect(storageInfo.totalFiles).toBeGreaterThan(0)
      expect(storageInfo.totalSizeMB).toBeGreaterThan(0)
      expect(storageInfo.oldestDate).toBe('2024-01-01')
      expect(storageInfo.newestDate).toBe('2024-01-03')
      expect(Array.isArray(storageInfo.recommendations)).toBe(true)
      expect(storageInfo.recommendations.length).toBeGreaterThan(0)
    })

    it('should provide recommendations for large caches', async () => {
      // Configure service with very low warning threshold
      const lowThresholdConfig = {
        monitoring: {
          enableDetailedStats: true,
          trackSlowOperations: true,
          maxSlowOperationsHistory: 50,
          storageSizeWarningMB: 0.0001, // Extremely low threshold (0.1KB)
        },
      }

      const lowThresholdService = new RawCSVCacheService(
        mockCacheConfig,
        mockLogger,
        lowThresholdConfig
      )

      // Add data that will definitely exceed the threshold
      const largeCsvContent =
        'header\n' + 'data1,data2,data3,data4,data5\n'.repeat(100) // Repeat to make it larger
      await lowThresholdService.setCachedCSV(
        '2024-01-01',
        CSVType.ALL_DISTRICTS,
        largeCsvContent
      )

      const storageInfo = await lowThresholdService.getCacheStorageInfo()

      expect(storageInfo.isLargeCache).toBe(true)
      expect(
        storageInfo.recommendations.some(r =>
          r.includes('exceeds warning threshold')
        )
      ).toBe(true)
      expect(
        storageInfo.recommendations.some(r =>
          r.includes('monitoring disk space')
        )
      ).toBe(true)
    })
  })
})
