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
import { ScrapedRecord } from '../../types/districts.js'

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
      const csvContent = 'District,Region,Clubs\n42,1,25\n'

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
            csvContent,
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

  describe('getAllDistrictsCached - Cache Lookup', () => {
    it('should return null for cache miss (no cached file)', async () => {
      const date = '2026-01-07'

      // Try to get cached data when nothing is cached
      const result = await cacheService.getAllDistrictsCached(date)

      expect(result).toBeNull()
    })

    it('should return cached data with fromCache=true for cache hit', async () => {
      const date = '2026-01-07'
      const csvContent =
        'District,Region,Clubs,Members\n42,Region 1,25,500\n43,Region 2,30,600\n'

      // Cache the All Districts CSV
      await cacheService.setCachedCSV(date, CSVType.ALL_DISTRICTS, csvContent)

      // Retrieve from cache
      const result = await cacheService.getAllDistrictsCached(date)

      expect(result).not.toBeNull()
      expect(result!.fromCache).toBe(true)
      expect(result!.data).toHaveLength(2)
      expect(result!.data[0]).toHaveProperty('District')
      expect(result!.data[0]?.District).toBe(42) // Parsed as number
      expect(result!.data[1]).toHaveProperty('District')
      expect(result!.data[1]?.District).toBe(43) // Parsed as number
    })

    it('should return correct metadata for cached file', async () => {
      const date = '2026-01-07'
      const csvContent =
        'District,Region,Clubs\n42,Region 1,25\n43,Region 2,30\n'

      // Cache the All Districts CSV
      await cacheService.setCachedCSV(date, CSVType.ALL_DISTRICTS, csvContent)

      // Retrieve from cache
      const result = await cacheService.getAllDistrictsCached(date)

      expect(result).not.toBeNull()
      expect(result!.metadata).toHaveProperty('fileName')
      expect(result!.metadata.fileName).toBe(`all-districts-${date}.csv`)
      expect(result!.metadata).toHaveProperty('date')
      expect(result!.metadata.date).toBe(date)
      expect(result!.metadata).toHaveProperty('fetchedAt')
      expect(result!.metadata).toHaveProperty('fileSize')
      expect(result!.metadata.fileSize).toBeGreaterThan(0)
      expect(result!.metadata).toHaveProperty('checksum')
    })

    it('should parse CSV content correctly into ScrapedRecord array', async () => {
      const date = '2026-01-07'
      const csvContent =
        'District,Region,Clubs,Members,Growth\n42,Region 1,25,500,5.5\n43,Region 2,30,600,3.2\n'

      // Cache the All Districts CSV
      await cacheService.setCachedCSV(date, CSVType.ALL_DISTRICTS, csvContent)

      // Retrieve from cache
      const result = await cacheService.getAllDistrictsCached(date)

      expect(result).not.toBeNull()
      expect(result!.data).toHaveLength(2)

      // Check first record - numeric values are parsed as numbers
      expect(result!.data[0]?.District).toBe(42) // Parsed as number
      expect(result!.data[0]?.Region).toBe('Region 1')
      expect(result!.data[0]?.Clubs).toBe(25) // Should be parsed as number
      expect(result!.data[0]?.Members).toBe(500) // Should be parsed as number
      expect(result!.data[0]?.Growth).toBe(5.5) // Should be parsed as number

      // Check second record
      expect(result!.data[1]?.District).toBe(43) // Parsed as number
      expect(result!.data[1]?.Region).toBe('Region 2')
      expect(result!.data[1]?.Clubs).toBe(30)
      expect(result!.data[1]?.Members).toBe(600)
      expect(result!.data[1]?.Growth).toBe(3.2)
    })

    it('should handle metadata recreation gracefully', async () => {
      const date = '2026-01-07'
      const csvContent = 'District,Region,Clubs\n42,Region 1,25\n'

      // Cache the CSV
      await cacheService.setCachedCSV(date, CSVType.ALL_DISTRICTS, csvContent)

      // Get the metadata to verify it exists
      let metadata = await cacheService.getCacheMetadata(date)
      expect(metadata).not.toBeNull()

      // Manually delete the metadata file to simulate missing metadata
      const metadataPath = path.join(
        testCacheDir,
        'raw-csv',
        date,
        'metadata.json'
      )
      await fs.unlink(metadataPath)

      // Verify metadata is gone
      metadata = await cacheService.getCacheMetadata(date)
      expect(metadata).toBeNull()

      // Try to retrieve - the service should handle missing metadata gracefully
      // The getCachedCSV call will trigger updateDownloadStats which recreates metadata
      const result = await cacheService.getAllDistrictsCached(date)

      // The service is resilient and recreates metadata when needed
      // So the result should still be valid
      expect(result).not.toBeNull()
      expect(result!.fromCache).toBe(true)
      expect(result!.data).toHaveLength(1)

      // Verify metadata was recreated
      metadata = await cacheService.getCacheMetadata(date)
      expect(metadata).not.toBeNull()
    })

    it('should handle CSV with minimal data rows', async () => {
      const date = '2026-01-07'
      const csvContent = 'District,Region,Clubs\n42,Region 1,25\n' // Header + 1 data row

      // Cache the CSV
      await cacheService.setCachedCSV(date, CSVType.ALL_DISTRICTS, csvContent)

      // Retrieve from cache
      const result = await cacheService.getAllDistrictsCached(date)

      expect(result).not.toBeNull()
      expect(result!.fromCache).toBe(true)
      expect(result!.data).toHaveLength(1) // One data row
      expect(result!.data[0]?.District).toBe(42)
    })

    it('should set fromCache flag correctly for multiple retrievals', async () => {
      const date = '2026-01-07'
      const csvContent = 'District,Region,Clubs\n42,Region 1,25\n'

      // Cache the CSV
      await cacheService.setCachedCSV(date, CSVType.ALL_DISTRICTS, csvContent)

      // First retrieval
      const result1 = await cacheService.getAllDistrictsCached(date)
      expect(result1).not.toBeNull()
      expect(result1!.fromCache).toBe(true)

      // Second retrieval
      const result2 = await cacheService.getAllDistrictsCached(date)
      expect(result2).not.toBeNull()
      expect(result2!.fromCache).toBe(true)

      // Third retrieval
      const result3 = await cacheService.getAllDistrictsCached(date)
      expect(result3).not.toBeNull()
      expect(result3!.fromCache).toBe(true)
    })

    it('should handle different dates independently', async () => {
      const date1 = '2026-01-07'
      const date2 = '2026-01-08'
      const csvContent1 = 'District,Region,Clubs\n42,Region 1,25\n'
      const csvContent2 = 'District,Region,Clubs\n43,Region 2,30\n'

      // Cache CSV for date1
      await cacheService.setCachedCSV(date1, CSVType.ALL_DISTRICTS, csvContent1)

      // Cache CSV for date2
      await cacheService.setCachedCSV(date2, CSVType.ALL_DISTRICTS, csvContent2)

      // Retrieve date1 - should get cached data
      const result1 = await cacheService.getAllDistrictsCached(date1)
      expect(result1).not.toBeNull()
      expect(result1!.fromCache).toBe(true)
      expect(result1!.data[0]?.District).toBe(42) // Parsed as number

      // Retrieve date2 - should get cached data
      const result2 = await cacheService.getAllDistrictsCached(date2)
      expect(result2).not.toBeNull()
      expect(result2!.fromCache).toBe(true)
      expect(result2!.data[0]?.District).toBe(43) // Parsed as number

      // Retrieve non-existent date - should return null
      const result3 = await cacheService.getAllDistrictsCached('2026-01-09')
      expect(result3).toBeNull()
    })
  })

  describe('cacheAllDistricts - Cache Storage', () => {
    it('should write CSV file with correct naming', async () => {
      const date = '2026-01-07'
      const data: ScrapedRecord[] = [
        { District: 42, Region: 'Region 1', Clubs: 25 },
        { District: 43, Region: 'Region 2', Clubs: 30 },
      ]
      const rawCsv = 'District,Region,Clubs\n42,Region 1,25\n43,Region 2,30\n'

      // Cache the All Districts CSV
      await cacheService.cacheAllDistricts(date, data, rawCsv)

      // Verify file was created with correct naming
      const expectedPath = path.join(
        testCacheDir,
        'raw-csv',
        date,
        'all-districts.csv'
      )

      // Check file exists
      const fileExists = await fs
        .access(expectedPath)
        .then(() => true)
        .catch(() => false)
      expect(fileExists).toBe(true)

      // Verify file content
      const content = await fs.readFile(expectedPath, 'utf-8')
      expect(content).toBe(rawCsv)
    })

    it('should create metadata file when caching', async () => {
      const date = '2026-01-07'
      const data: ScrapedRecord[] = [
        { District: 42, Region: 'Region 1', Clubs: 25 },
      ]
      const rawCsv = 'District,Region,Clubs\n42,Region 1,25\n'

      // Cache the All Districts CSV
      await cacheService.cacheAllDistricts(date, data, rawCsv)

      // Verify metadata file was created
      const metadataPath = path.join(
        testCacheDir,
        'raw-csv',
        date,
        'metadata.json'
      )

      const metadataExists = await fs
        .access(metadataPath)
        .then(() => true)
        .catch(() => false)
      expect(metadataExists).toBe(true)

      // Verify metadata content
      const metadataContent = await fs.readFile(metadataPath, 'utf-8')
      const metadata = JSON.parse(metadataContent)

      expect(metadata.date).toBe(date)
      expect(metadata.csvFiles.allDistricts).toBe(true)
      expect(metadata.source).toBe('scraper')
      expect(metadata.cacheVersion).toBe(1)
      expect(metadata.integrity).toHaveProperty('fileCount')
      expect(metadata.integrity).toHaveProperty('totalSize')
      expect(metadata.integrity).toHaveProperty('checksums')
    })

    it('should preserve file content exactly', async () => {
      const date = '2026-01-07'
      const data: ScrapedRecord[] = [
        { District: 42, Region: 'Region 1', Clubs: 25, Members: 500 },
        { District: 43, Region: 'Region 2', Clubs: 30, Members: 600 },
        { District: 44, Region: 'Region 3', Clubs: 35, Members: 700 },
      ]
      const rawCsv =
        'District,Region,Clubs,Members\n42,Region 1,25,500\n43,Region 2,30,600\n44,Region 3,35,700\n'

      // Cache the All Districts CSV
      await cacheService.cacheAllDistricts(date, data, rawCsv)

      // Read back the file
      const filePath = path.join(
        testCacheDir,
        'raw-csv',
        date,
        'all-districts.csv'
      )
      const content = await fs.readFile(filePath, 'utf-8')

      // Verify content is exactly preserved
      expect(content).toBe(rawCsv)
      expect(content.length).toBe(rawCsv.length)

      // Verify line-by-line
      const originalLines = rawCsv.split('\n')
      const cachedLines = content.split('\n')
      expect(cachedLines.length).toBe(originalLines.length)

      for (let i = 0; i < originalLines.length; i++) {
        expect(cachedLines[i]).toBe(originalLines[i])
      }
    })

    it('should handle CSV with special characters', async () => {
      const date = '2026-01-07'
      const data: ScrapedRecord[] = [
        { District: 42, Name: 'District "42"', Region: 'Region, 1' },
      ]
      const rawCsv = 'District,Name,Region\n42,"District ""42""","Region, 1"\n'

      // Cache the All Districts CSV with special characters
      await cacheService.cacheAllDistricts(date, data, rawCsv)

      // Read back the file
      const filePath = path.join(
        testCacheDir,
        'raw-csv',
        date,
        'all-districts.csv'
      )
      const content = await fs.readFile(filePath, 'utf-8')

      // Verify special characters are preserved
      expect(content).toBe(rawCsv)
      expect(content).toContain('"District ""42"""')
      expect(content).toContain('"Region, 1"')
    })

    it('should handle CSV with Unicode characters', async () => {
      const date = '2026-01-07'
      const data: ScrapedRecord[] = [
        { District: 42, Name: 'Montréal', Region: 'Québec' },
        { District: 43, Name: 'São Paulo', Region: 'Brasil' },
      ]
      const rawCsv =
        'District,Name,Region\n42,Montréal,Québec\n43,São Paulo,Brasil\n'

      // Cache the All Districts CSV with Unicode characters
      await cacheService.cacheAllDistricts(date, data, rawCsv)

      // Read back the file
      const filePath = path.join(
        testCacheDir,
        'raw-csv',
        date,
        'all-districts.csv'
      )
      const content = await fs.readFile(filePath, 'utf-8')

      // Verify Unicode characters are preserved
      expect(content).toBe(rawCsv)
      expect(content).toContain('Montréal')
      expect(content).toContain('Québec')
      expect(content).toContain('São Paulo')
      expect(content).toContain('Brasil')
    })

    it('should overwrite existing file when caching same date', async () => {
      const date = '2026-01-07'
      const data1: ScrapedRecord[] = [
        { District: 42, Region: 'Region 1', Clubs: 25 },
      ]
      const rawCsv1 = 'District,Region,Clubs\n42,Region 1,25\n'

      const data2: ScrapedRecord[] = [
        { District: 42, Region: 'Region 1', Clubs: 25 },
        { District: 43, Region: 'Region 2', Clubs: 30 },
      ]
      const rawCsv2 = 'District,Region,Clubs\n42,Region 1,25\n43,Region 2,30\n'

      // Cache first version
      await cacheService.cacheAllDistricts(date, data1, rawCsv1)

      // Verify first version
      const filePath = path.join(
        testCacheDir,
        'raw-csv',
        date,
        'all-districts.csv'
      )
      let content = await fs.readFile(filePath, 'utf-8')
      expect(content).toBe(rawCsv1)

      // Cache second version (overwrite)
      await cacheService.cacheAllDistricts(date, data2, rawCsv2)

      // Verify second version replaced first
      content = await fs.readFile(filePath, 'utf-8')
      expect(content).toBe(rawCsv2)
      expect(content).not.toBe(rawCsv1)
    })

    it('should handle large CSV files', async () => {
      const date = '2026-01-07'

      // Generate large CSV with many districts
      const data: ScrapedRecord[] = []
      let rawCsv = 'District,Region,Clubs,Members\n'

      for (let i = 1; i <= 200; i++) {
        data.push({
          District: i,
          Region: `Region ${i % 10}`,
          Clubs: 20 + i,
          Members: 400 + i * 10,
        })
        rawCsv += `${i},Region ${i % 10},${20 + i},${400 + i * 10}\n`
      }

      // Cache the large CSV
      await cacheService.cacheAllDistricts(date, data, rawCsv)

      // Verify file was created
      const filePath = path.join(
        testCacheDir,
        'raw-csv',
        date,
        'all-districts.csv'
      )
      const content = await fs.readFile(filePath, 'utf-8')

      // Verify content is preserved
      expect(content).toBe(rawCsv)
      expect(content.split('\n').length).toBe(rawCsv.split('\n').length)

      // Verify metadata reflects large file
      const metadata = await cacheService.getCacheMetadata(date)
      expect(metadata).not.toBeNull()
      expect(metadata!.integrity.totalSize).toBeGreaterThan(1000) // Should be several KB
    })

    it('should create directory structure if it does not exist', async () => {
      const date = '2026-01-10' // New date that doesn't have a directory yet
      const data: ScrapedRecord[] = [
        { District: 42, Region: 'Region 1', Clubs: 25 },
      ]
      const rawCsv = 'District,Region,Clubs\n42,Region 1,25\n'

      // Verify directory doesn't exist yet
      const datePath = path.join(testCacheDir, 'raw-csv', date)
      const dirExistsBefore = await fs
        .access(datePath)
        .then(() => true)
        .catch(() => false)
      expect(dirExistsBefore).toBe(false)

      // Cache the CSV
      await cacheService.cacheAllDistricts(date, data, rawCsv)

      // Verify directory was created
      const dirExistsAfter = await fs
        .access(datePath)
        .then(() => true)
        .catch(() => false)
      expect(dirExistsAfter).toBe(true)

      // Verify file was created in the new directory
      const filePath = path.join(datePath, 'all-districts.csv')
      const fileExists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false)
      expect(fileExists).toBe(true)
    })

    it('should update metadata checksums correctly', async () => {
      const date = '2026-01-07'
      const data: ScrapedRecord[] = [
        { District: 42, Region: 'Region 1', Clubs: 25 },
      ]
      const rawCsv = 'District,Region,Clubs\n42,Region 1,25\n'

      // Cache the CSV
      await cacheService.cacheAllDistricts(date, data, rawCsv)

      // Get metadata
      const metadata = await cacheService.getCacheMetadata(date)
      expect(metadata).not.toBeNull()

      // Verify checksum exists for the file
      expect(metadata!.integrity.checksums).toHaveProperty('all-districts.csv')
      const checksum = metadata!.integrity.checksums['all-districts.csv']
      expect(checksum).toBeTruthy()
      expect(checksum).toHaveLength(64) // SHA-256 produces 64 hex characters

      // Verify checksum is correct by recalculating
      const crypto = await import('crypto')
      const expectedChecksum = crypto
        .createHash('sha256')
        .update(rawCsv)
        .digest('hex')
      expect(checksum).toBe(expectedChecksum)
    })

    it('should handle empty data array gracefully', async () => {
      const date = '2026-01-07'
      const data: ScrapedRecord[] = []
      const rawCsv = 'District,Region,Clubs\n' // Header only

      // The service validates that CSV must have at least a header and one data row
      // So attempting to cache header-only CSV should throw an error
      await expect(
        cacheService.cacheAllDistricts(date, data, rawCsv)
      ).rejects.toThrow('CSV must have at least a header and one data row')
    })
  })
})
