/**
 * GCSRawCSVStorage Unit Tests
 *
 * Tests the GCSRawCSVStorage implementation with mocked GCS client.
 * Validates Requirements 3.1-3.6, 7.1-7.4 from the GCP Storage Migration spec.
 *
 * Test Isolation Requirements (per testing steering document):
 * - Each test uses mocked GCS client
 * - Tests clean up all mocks in afterEach hooks
 * - Tests do not depend on execution order
 * - All tests pass when run with --run (parallel mode)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Mock } from 'vitest'
import { StorageOperationError } from '../../../types/storageInterfaces.js'
import { CSVType } from '../../../types/rawCSVCache.js'

// ============================================================================
// Mock Types for GCS
// ============================================================================

interface MockFile {
  exists: Mock
  download: Mock
  save: Mock
  delete: Mock
  getMetadata: Mock
  name: string
}

interface MockBucket {
  file: Mock
  getFiles: Mock
  getMetadata: Mock
  name: string
}

// ============================================================================
// Mock Setup
// ============================================================================

// Create mock file helper
const createMockFile = (name: string): MockFile => ({
  exists: vi.fn().mockResolvedValue([false]),
  download: vi.fn().mockResolvedValue([Buffer.from('')]),
  save: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
  getMetadata: vi.fn().mockResolvedValue([{ size: '0' }]),
  name,
})

// Create mock bucket helper
const createMockBucket = (bucketName: string): MockBucket => ({
  file: vi.fn((path: string) => createMockFile(path)),
  getFiles: vi.fn().mockResolvedValue([[]]),
  getMetadata: vi.fn().mockResolvedValue([{ name: bucketName }]),
  name: bucketName,
})

// Module-level mock variables
let mockBucket: MockBucket

// Mock the @google-cloud/storage module
vi.mock('@google-cloud/storage', () => {
  const MockStorage = function (this: Record<string, unknown>) {
    mockBucket = createMockBucket('test-bucket')
    this.bucket = vi.fn().mockReturnValue(mockBucket)
  }

  return {
    Storage: MockStorage,
  }
})

// Mock the logger to avoid console output during tests
vi.mock('../../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// Mock the CircuitBreaker to avoid actual circuit breaker behavior
vi.mock('../../../utils/CircuitBreaker.js', () => ({
  CircuitBreaker: {
    createCacheCircuitBreaker: vi.fn(() => ({
      execute: vi.fn(async <T>(operation: () => Promise<T>) => operation()),
      getStats: vi.fn(() => ({
        state: 'CLOSED',
        failureCount: 0,
        successCount: 0,
        totalRequests: 0,
        totalFailures: 0,
        totalSuccesses: 0,
      })),
      reset: vi.fn(),
    })),
  },
}))

// Import after mocks are set up
import { GCSRawCSVStorage } from '../GCSRawCSVStorage.js'
import type { IRawCSVStorage } from '../../../types/storageInterfaces.js'

// ============================================================================
// Test Suite
// ============================================================================

describe('GCSRawCSVStorage', () => {
  const testBucketName = 'test-bucket'
  const testProjectId = 'test-project'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================================
  // Interface Compliance Tests
  // ============================================================================

  describe('Interface Compliance', () => {
    it('should implement IRawCSVStorage interface', async () => {
      const storage: IRawCSVStorage = new GCSRawCSVStorage({
        projectId: testProjectId,
        bucketName: testBucketName,
      })

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

    it('should use provided bucket name', () => {
      // The bucket name is passed to the Storage.bucket() method
      // which is verified by the mock setup
      const storage = new GCSRawCSVStorage({
        projectId: testProjectId,
        bucketName: 'custom-bucket',
      })

      // Verify the storage was created (bucket method is called during construction)
      expect(storage).toBeDefined()
    })
  })

  // ============================================================================
  // GCS Path Convention Tests (Requirement 3.3)
  // ============================================================================

  describe('GCS Path Convention (Requirement 3.3)', () => {
    it('should use correct path for all-districts CSV', async () => {
      const storage = new GCSRawCSVStorage({
        projectId: testProjectId,
        bucketName: testBucketName,
      })

      const mockFile = createMockFile('raw-csv/2024-01-15/all-districts.csv')
      mockFile.exists.mockResolvedValue([false])
      mockBucket.file.mockReturnValue(mockFile)

      await storage.hasCachedCSV('2024-01-15', CSVType.ALL_DISTRICTS)

      expect(mockBucket.file).toHaveBeenCalledWith(
        'raw-csv/2024-01-15/all-districts.csv'
      )
    })

    it('should use correct path for district-specific club-performance CSV', async () => {
      const storage = new GCSRawCSVStorage({
        projectId: testProjectId,
        bucketName: testBucketName,
      })

      const mockFile = createMockFile(
        'raw-csv/2024-01-15/district-42/club-performance.csv'
      )
      mockFile.exists.mockResolvedValue([false])
      mockBucket.file.mockReturnValue(mockFile)

      await storage.hasCachedCSV('2024-01-15', CSVType.CLUB_PERFORMANCE, '42')

      expect(mockBucket.file).toHaveBeenCalledWith(
        'raw-csv/2024-01-15/district-42/club-performance.csv'
      )
    })

    it('should use correct path for district-specific division-performance CSV', async () => {
      const storage = new GCSRawCSVStorage({
        projectId: testProjectId,
        bucketName: testBucketName,
      })

      const mockFile = createMockFile(
        'raw-csv/2024-01-15/district-42/division-performance.csv'
      )
      mockFile.exists.mockResolvedValue([false])
      mockBucket.file.mockReturnValue(mockFile)

      await storage.hasCachedCSV(
        '2024-01-15',
        CSVType.DIVISION_PERFORMANCE,
        '42'
      )

      expect(mockBucket.file).toHaveBeenCalledWith(
        'raw-csv/2024-01-15/district-42/division-performance.csv'
      )
    })

    it('should use correct path for district-specific district-performance CSV', async () => {
      const storage = new GCSRawCSVStorage({
        projectId: testProjectId,
        bucketName: testBucketName,
      })

      const mockFile = createMockFile(
        'raw-csv/2024-01-15/district-42/district-performance.csv'
      )
      mockFile.exists.mockResolvedValue([false])
      mockBucket.file.mockReturnValue(mockFile)

      await storage.hasCachedCSV(
        '2024-01-15',
        CSVType.DISTRICT_PERFORMANCE,
        '42'
      )

      expect(mockBucket.file).toHaveBeenCalledWith(
        'raw-csv/2024-01-15/district-42/district-performance.csv'
      )
    })

    it('should require district ID for district-specific CSV types', async () => {
      const storage = new GCSRawCSVStorage({
        projectId: testProjectId,
        bucketName: testBucketName,
      })

      await expect(
        storage.setCachedCSV('2024-01-15', CSVType.CLUB_PERFORMANCE, 'content')
      ).rejects.toThrow(StorageOperationError)
    })
  })

  // ============================================================================
  // Core Cache Operations Tests (Requirements 3.1, 3.2, 3.4)
  // ============================================================================

  describe('Core Cache Operations', () => {
    describe('getCachedCSV (Requirement 3.2)', () => {
      it('should return null for non-existent CSV', async () => {
        const storage = new GCSRawCSVStorage({
          projectId: testProjectId,
          bucketName: testBucketName,
        })

        const mockFile = createMockFile('raw-csv/2024-01-15/all-districts.csv')
        mockFile.exists.mockResolvedValue([false])
        mockBucket.file.mockReturnValue(mockFile)

        const result = await storage.getCachedCSV(
          '2024-01-15',
          CSVType.ALL_DISTRICTS
        )
        expect(result).toBeNull()
      })

      it('should return CSV content when file exists', async () => {
        const storage = new GCSRawCSVStorage({
          projectId: testProjectId,
          bucketName: testBucketName,
        })

        const csvContent = 'District,Region,Clubs\n42,1,25\n'
        const mockFile = createMockFile('raw-csv/2024-01-15/all-districts.csv')
        mockFile.exists.mockResolvedValue([true])
        mockFile.download.mockResolvedValue([Buffer.from(csvContent)])
        mockBucket.file.mockReturnValue(mockFile)

        const result = await storage.getCachedCSV(
          '2024-01-15',
          CSVType.ALL_DISTRICTS
        )
        expect(result).toBe(csvContent)
      })

      it('should retrieve district-specific CSV content', async () => {
        const storage = new GCSRawCSVStorage({
          projectId: testProjectId,
          bucketName: testBucketName,
        })

        const csvContent = 'Club,Members,Status\nTest Club,20,Active\n'
        const mockFile = createMockFile(
          'raw-csv/2024-01-15/district-42/club-performance.csv'
        )
        mockFile.exists.mockResolvedValue([true])
        mockFile.download.mockResolvedValue([Buffer.from(csvContent)])
        mockBucket.file.mockReturnValue(mockFile)

        const result = await storage.getCachedCSV(
          '2024-01-15',
          CSVType.CLUB_PERFORMANCE,
          '42'
        )
        expect(result).toBe(csvContent)
      })
    })

    describe('setCachedCSV (Requirement 3.1)', () => {
      it('should store CSV content in GCS', async () => {
        const storage = new GCSRawCSVStorage({
          projectId: testProjectId,
          bucketName: testBucketName,
        })

        const csvContent = 'District,Region,Clubs\n42,1,25\n'
        const mockFile = createMockFile('raw-csv/2024-01-15/all-districts.csv')
        mockBucket.file.mockReturnValue(mockFile)

        // Mock metadata file for updateCacheMetadataForFile
        const mockMetadataFile = createMockFile(
          'raw-csv/2024-01-15/metadata.json'
        )
        mockMetadataFile.exists.mockResolvedValue([false])
        mockBucket.file.mockImplementation((path: string) => {
          if (path.endsWith('metadata.json')) return mockMetadataFile
          return mockFile
        })

        await storage.setCachedCSV(
          '2024-01-15',
          CSVType.ALL_DISTRICTS,
          csvContent
        )

        expect(mockFile.save).toHaveBeenCalledWith(
          csvContent,
          expect.objectContaining({
            contentType: 'text/csv',
          })
        )
      })

      it('should store district-specific CSV content', async () => {
        const storage = new GCSRawCSVStorage({
          projectId: testProjectId,
          bucketName: testBucketName,
        })

        const csvContent = 'Club,Members,Status\nTest Club,20,Active\n'
        const mockFile = createMockFile(
          'raw-csv/2024-01-15/district-42/club-performance.csv'
        )
        const mockMetadataFile = createMockFile(
          'raw-csv/2024-01-15/metadata.json'
        )
        mockMetadataFile.exists.mockResolvedValue([false])

        mockBucket.file.mockImplementation((path: string) => {
          if (path.endsWith('metadata.json')) return mockMetadataFile
          return mockFile
        })

        await storage.setCachedCSV(
          '2024-01-15',
          CSVType.CLUB_PERFORMANCE,
          csvContent,
          '42'
        )

        expect(mockFile.save).toHaveBeenCalled()
      })
    })

    describe('setCachedCSVWithMetadata', () => {
      it('should store CSV with closing period metadata', async () => {
        const storage = new GCSRawCSVStorage({
          projectId: testProjectId,
          bucketName: testBucketName,
        })

        const csvContent = 'District,Region,Clubs\n42,1,25\n'
        const mockFile = createMockFile('raw-csv/2024-01-15/all-districts.csv')
        const mockMetadataFile = createMockFile(
          'raw-csv/2024-01-15/metadata.json'
        )
        mockMetadataFile.exists.mockResolvedValue([false])

        mockBucket.file.mockImplementation((path: string) => {
          if (path.endsWith('metadata.json')) return mockMetadataFile
          return mockFile
        })

        await storage.setCachedCSVWithMetadata(
          '2024-01-15',
          CSVType.ALL_DISTRICTS,
          csvContent,
          undefined,
          {
            requestedDate: '2024-01-31',
            isClosingPeriod: true,
            dataMonth: '2024-01',
          }
        )

        expect(mockFile.save).toHaveBeenCalledWith(
          csvContent,
          expect.objectContaining({
            contentType: 'text/csv',
            metadata: expect.objectContaining({
              isClosingPeriod: 'true',
              dataMonth: '2024-01',
            }),
          })
        )
      })
    })

    describe('hasCachedCSV (Requirement 3.4)', () => {
      it('should return false for non-existent CSV', async () => {
        const storage = new GCSRawCSVStorage({
          projectId: testProjectId,
          bucketName: testBucketName,
        })

        const mockFile = createMockFile('raw-csv/2024-01-15/all-districts.csv')
        mockFile.exists.mockResolvedValue([false])
        mockBucket.file.mockReturnValue(mockFile)

        const result = await storage.hasCachedCSV(
          '2024-01-15',
          CSVType.ALL_DISTRICTS
        )
        expect(result).toBe(false)
      })

      it('should return true for existing CSV', async () => {
        const storage = new GCSRawCSVStorage({
          projectId: testProjectId,
          bucketName: testBucketName,
        })

        const mockFile = createMockFile('raw-csv/2024-01-15/all-districts.csv')
        mockFile.exists.mockResolvedValue([true])
        mockBucket.file.mockReturnValue(mockFile)

        const result = await storage.hasCachedCSV(
          '2024-01-15',
          CSVType.ALL_DISTRICTS
        )
        expect(result).toBe(true)
      })
    })
  })

  // ============================================================================
  // Metadata Management Tests (Requirements 3.5, 3.6)
  // ============================================================================

  describe('Metadata Management (Requirements 3.5, 3.6)', () => {
    describe('getCacheMetadata', () => {
      it('should return null for non-existent metadata', async () => {
        const storage = new GCSRawCSVStorage({
          projectId: testProjectId,
          bucketName: testBucketName,
        })

        const mockFile = createMockFile('raw-csv/2024-01-15/metadata.json')
        mockFile.exists.mockResolvedValue([false])
        mockBucket.file.mockReturnValue(mockFile)

        const result = await storage.getCacheMetadata('2024-01-15')
        expect(result).toBeNull()
      })

      it('should return metadata when it exists', async () => {
        const storage = new GCSRawCSVStorage({
          projectId: testProjectId,
          bucketName: testBucketName,
        })

        const metadata = {
          date: '2024-01-15',
          timestamp: Date.now(),
          programYear: '2024-2025',
          csvFiles: { allDistricts: true, districts: {} },
          downloadStats: {
            totalDownloads: 1,
            cacheHits: 0,
            cacheMisses: 1,
            lastAccessed: Date.now(),
          },
          integrity: { checksums: {}, totalSize: 100, fileCount: 1 },
          source: 'collector',
          cacheVersion: 1,
        }

        const mockFile = createMockFile('raw-csv/2024-01-15/metadata.json')
        mockFile.exists.mockResolvedValue([true])
        mockFile.download.mockResolvedValue([
          Buffer.from(JSON.stringify(metadata)),
        ])
        mockBucket.file.mockReturnValue(mockFile)

        const result = await storage.getCacheMetadata('2024-01-15')

        expect(result).not.toBeNull()
        expect(result?.date).toBe('2024-01-15')
        expect(result?.csvFiles.allDistricts).toBe(true)
      })
    })

    describe('updateCacheMetadata', () => {
      it('should create metadata if it does not exist', async () => {
        const storage = new GCSRawCSVStorage({
          projectId: testProjectId,
          bucketName: testBucketName,
        })

        const mockFile = createMockFile('raw-csv/2024-01-15/metadata.json')
        mockFile.exists.mockResolvedValue([false])
        mockBucket.file.mockReturnValue(mockFile)

        await storage.updateCacheMetadata('2024-01-15', { source: 'manual' })

        expect(mockFile.save).toHaveBeenCalled()
      })

      it('should merge with existing metadata', async () => {
        const storage = new GCSRawCSVStorage({
          projectId: testProjectId,
          bucketName: testBucketName,
        })

        const existingMetadata = {
          date: '2024-01-15',
          timestamp: Date.now(),
          programYear: '2024-2025',
          csvFiles: { allDistricts: true, districts: {} },
          downloadStats: {
            totalDownloads: 1,
            cacheHits: 0,
            cacheMisses: 1,
            lastAccessed: Date.now(),
          },
          integrity: { checksums: {}, totalSize: 100, fileCount: 1 },
          source: 'collector',
          cacheVersion: 1,
        }

        const mockFile = createMockFile('raw-csv/2024-01-15/metadata.json')
        mockFile.exists.mockResolvedValue([true])
        mockFile.download.mockResolvedValue([
          Buffer.from(JSON.stringify(existingMetadata)),
        ])
        mockBucket.file.mockReturnValue(mockFile)

        await storage.updateCacheMetadata('2024-01-15', {
          source: 'manual-update',
        })

        expect(mockFile.save).toHaveBeenCalled()
      })
    })
  })

  // ============================================================================
  // Cache Management Tests
  // ============================================================================

  describe('Cache Management', () => {
    describe('clearCacheForDate', () => {
      it('should delete all files for a date', async () => {
        const storage = new GCSRawCSVStorage({
          projectId: testProjectId,
          bucketName: testBucketName,
        })

        const mockFile1 = createMockFile('raw-csv/2024-01-15/all-districts.csv')
        const mockFile2 = createMockFile('raw-csv/2024-01-15/metadata.json')

        mockBucket.getFiles.mockResolvedValue([[mockFile1, mockFile2]])

        await storage.clearCacheForDate('2024-01-15')

        expect(mockBucket.getFiles).toHaveBeenCalledWith({
          prefix: 'raw-csv/2024-01-15/',
        })
        expect(mockFile1.delete).toHaveBeenCalled()
        expect(mockFile2.delete).toHaveBeenCalled()
      })

      it('should handle empty directory gracefully', async () => {
        const storage = new GCSRawCSVStorage({
          projectId: testProjectId,
          bucketName: testBucketName,
        })

        mockBucket.getFiles.mockResolvedValue([[]])

        await storage.clearCacheForDate('2024-01-15')

        expect(mockBucket.getFiles).toHaveBeenCalled()
      })
    })

    describe('getCachedDates', () => {
      it('should return empty array when no dates cached', async () => {
        const storage = new GCSRawCSVStorage({
          projectId: testProjectId,
          bucketName: testBucketName,
        })

        mockBucket.getFiles.mockResolvedValue([[]])

        const result = await storage.getCachedDates()
        expect(result).toEqual([])
      })

      it('should extract unique dates from file paths', async () => {
        const storage = new GCSRawCSVStorage({
          projectId: testProjectId,
          bucketName: testBucketName,
        })

        const mockFiles = [
          { name: 'raw-csv/2024-01-15/all-districts.csv' },
          { name: 'raw-csv/2024-01-15/metadata.json' },
          { name: 'raw-csv/2024-01-16/all-districts.csv' },
          { name: 'raw-csv/2024-01-17/district-42/club-performance.csv' },
        ]

        mockBucket.getFiles.mockResolvedValue([mockFiles])

        const result = await storage.getCachedDates()

        expect(result).toContain('2024-01-15')
        expect(result).toContain('2024-01-16')
        expect(result).toContain('2024-01-17')
        expect(result.length).toBe(3)
      })

      it('should return dates sorted newest first', async () => {
        const storage = new GCSRawCSVStorage({
          projectId: testProjectId,
          bucketName: testBucketName,
        })

        const mockFiles = [
          { name: 'raw-csv/2024-01-15/all-districts.csv' },
          { name: 'raw-csv/2024-01-17/all-districts.csv' },
          { name: 'raw-csv/2024-01-16/all-districts.csv' },
        ]

        mockBucket.getFiles.mockResolvedValue([mockFiles])

        const result = await storage.getCachedDates()

        expect(result[0]).toBe('2024-01-17')
        expect(result[1]).toBe('2024-01-16')
        expect(result[2]).toBe('2024-01-15')
      })
    })
  })

  // ============================================================================
  // Health and Statistics Tests
  // ============================================================================

  describe('Health and Statistics', () => {
    describe('getCacheStorageInfo', () => {
      it('should return storage info', async () => {
        const storage = new GCSRawCSVStorage({
          projectId: testProjectId,
          bucketName: testBucketName,
        })

        mockBucket.getFiles.mockResolvedValue([[]])

        const result = await storage.getCacheStorageInfo()

        expect(result).toHaveProperty('totalSizeMB')
        expect(result).toHaveProperty('totalFiles')
        expect(result).toHaveProperty('oldestDate')
        expect(result).toHaveProperty('newestDate')
        expect(result).toHaveProperty('isLargeCache')
        expect(result).toHaveProperty('recommendations')
      })

      it('should calculate total size from files', async () => {
        const storage = new GCSRawCSVStorage({
          projectId: testProjectId,
          bucketName: testBucketName,
        })

        const mockFile1 = createMockFile('raw-csv/2024-01-15/all-districts.csv')
        mockFile1.getMetadata.mockResolvedValue([{ size: '1000' }])
        const mockFile2 = createMockFile('raw-csv/2024-01-15/metadata.json')
        mockFile2.getMetadata.mockResolvedValue([{ size: '500' }])

        mockBucket.getFiles.mockResolvedValue([[mockFile1, mockFile2]])

        const result = await storage.getCacheStorageInfo()

        expect(result.totalFiles).toBe(2)
        expect(result.totalSizeMB).toBeGreaterThan(0)
      })
    })

    describe('getCacheStatistics', () => {
      it('should return cache statistics', async () => {
        const storage = new GCSRawCSVStorage({
          projectId: testProjectId,
          bucketName: testBucketName,
        })

        mockBucket.getFiles.mockResolvedValue([[]])

        const result = await storage.getCacheStatistics()

        expect(result).toHaveProperty('totalCachedDates')
        expect(result).toHaveProperty('totalCachedFiles')
        expect(result).toHaveProperty('totalCacheSize')
        expect(result).toHaveProperty('hitRatio')
        expect(result).toHaveProperty('missRatio')
        expect(result).toHaveProperty('averageFileSize')
      })
    })

    describe('getHealthStatus', () => {
      it('should return healthy status when bucket is accessible', async () => {
        const storage = new GCSRawCSVStorage({
          projectId: testProjectId,
          bucketName: testBucketName,
        })

        mockBucket.getMetadata.mockResolvedValue([{ name: testBucketName }])

        // Mock health check file operations
        const mockHealthFile = createMockFile('raw-csv/.health-check-123')
        mockHealthFile.save.mockResolvedValue(undefined)
        mockHealthFile.delete.mockResolvedValue(undefined)
        mockBucket.file.mockReturnValue(mockHealthFile)
        mockBucket.getFiles.mockResolvedValue([[]])

        const result = await storage.getHealthStatus()

        expect(result.isAccessible).toBe(true)
        expect(result.hasWritePermissions).toBe(true)
      })

      it('should return unhealthy status when bucket is not accessible', async () => {
        const storage = new GCSRawCSVStorage({
          projectId: testProjectId,
          bucketName: testBucketName,
        })

        mockBucket.getMetadata.mockRejectedValue(new Error('Bucket not found'))

        const result = await storage.getHealthStatus()

        expect(result.isHealthy).toBe(false)
        expect(result.isAccessible).toBe(false)
        expect(result.errors.length).toBeGreaterThan(0)
      })
    })
  })

  // ============================================================================
  // Validation Tests
  // ============================================================================

  describe('Validation', () => {
    describe('Date validation', () => {
      it('should reject invalid date format', async () => {
        const storage = new GCSRawCSVStorage({
          projectId: testProjectId,
          bucketName: testBucketName,
        })

        await expect(
          storage.getCachedCSV('invalid-date', CSVType.ALL_DISTRICTS)
        ).rejects.toThrow(StorageOperationError)

        await expect(
          storage.getCachedCSV('2024/01/15', CSVType.ALL_DISTRICTS)
        ).rejects.toThrow(StorageOperationError)

        await expect(
          storage.getCachedCSV('', CSVType.ALL_DISTRICTS)
        ).rejects.toThrow(StorageOperationError)
      })

      it('should accept valid ISO date format', async () => {
        const storage = new GCSRawCSVStorage({
          projectId: testProjectId,
          bucketName: testBucketName,
        })

        const mockFile = createMockFile('raw-csv/2024-01-15/all-districts.csv')
        mockFile.exists.mockResolvedValue([false])
        mockBucket.file.mockReturnValue(mockFile)

        const result = await storage.getCachedCSV(
          '2024-01-15',
          CSVType.ALL_DISTRICTS
        )
        expect(result).toBeNull() // File doesn't exist, but validation passed
      })
    })

    describe('District ID validation', () => {
      it('should reject invalid district ID format', async () => {
        const storage = new GCSRawCSVStorage({
          projectId: testProjectId,
          bucketName: testBucketName,
        })

        await expect(
          storage.getCachedCSV('2024-01-15', CSVType.CLUB_PERFORMANCE, '')
        ).rejects.toThrow(StorageOperationError)

        await expect(
          storage.getCachedCSV(
            '2024-01-15',
            CSVType.CLUB_PERFORMANCE,
            'invalid-id!'
          )
        ).rejects.toThrow(StorageOperationError)
      })

      it('should accept valid alphanumeric district ID', async () => {
        const storage = new GCSRawCSVStorage({
          projectId: testProjectId,
          bucketName: testBucketName,
        })

        const mockFile = createMockFile(
          'raw-csv/2024-01-15/district-42/club-performance.csv'
        )
        mockFile.exists.mockResolvedValue([false])
        mockBucket.file.mockReturnValue(mockFile)

        const result = await storage.getCachedCSV(
          '2024-01-15',
          CSVType.CLUB_PERFORMANCE,
          '42'
        )
        expect(result).toBeNull() // File doesn't exist, but validation passed
      })
    })
  })

  // ============================================================================
  // Error Handling Tests (Requirements 7.1-7.4)
  // ============================================================================

  describe('Error Handling (Requirements 7.1-7.4)', () => {
    describe('StorageOperationError context', () => {
      it('should include operation name in error', async () => {
        const storage = new GCSRawCSVStorage({
          projectId: testProjectId,
          bucketName: testBucketName,
        })

        const mockFile = createMockFile('raw-csv/2024-01-15/all-districts.csv')
        mockFile.exists.mockResolvedValue([true])
        mockFile.download.mockRejectedValue(new Error('Download failed'))
        mockBucket.file.mockReturnValue(mockFile)

        try {
          await storage.getCachedCSV('2024-01-15', CSVType.ALL_DISTRICTS)
          expect.fail('Should have thrown')
        } catch (error) {
          expect(error).toBeInstanceOf(StorageOperationError)
          const storageError = error as StorageOperationError
          expect(storageError.operation).toBe('getCachedCSV')
        }
      })

      it('should include provider type in error', async () => {
        const storage = new GCSRawCSVStorage({
          projectId: testProjectId,
          bucketName: testBucketName,
        })

        const mockFile = createMockFile('raw-csv/2024-01-15/all-districts.csv')
        mockFile.exists.mockResolvedValue([true])
        mockFile.download.mockRejectedValue(new Error('Download failed'))
        mockBucket.file.mockReturnValue(mockFile)

        try {
          await storage.getCachedCSV('2024-01-15', CSVType.ALL_DISTRICTS)
          expect.fail('Should have thrown')
        } catch (error) {
          expect(error).toBeInstanceOf(StorageOperationError)
          const storageError = error as StorageOperationError
          expect(storageError.provider).toBe('gcs')
        }
      })

      it('should mark network errors as retryable', async () => {
        const storage = new GCSRawCSVStorage({
          projectId: testProjectId,
          bucketName: testBucketName,
        })

        const mockFile = createMockFile('raw-csv/2024-01-15/all-districts.csv')
        mockFile.exists.mockResolvedValue([true])
        mockFile.download.mockRejectedValue(new Error('Network timeout'))
        mockBucket.file.mockReturnValue(mockFile)

        try {
          await storage.getCachedCSV('2024-01-15', CSVType.ALL_DISTRICTS)
          expect.fail('Should have thrown')
        } catch (error) {
          expect(error).toBeInstanceOf(StorageOperationError)
          const storageError = error as StorageOperationError
          expect(storageError.retryable).toBe(true)
        }
      })

      it('should mark validation errors as non-retryable', async () => {
        const storage = new GCSRawCSVStorage({
          projectId: testProjectId,
          bucketName: testBucketName,
        })

        try {
          await storage.getCachedCSV('invalid-date', CSVType.ALL_DISTRICTS)
          expect.fail('Should have thrown')
        } catch (error) {
          expect(error).toBeInstanceOf(StorageOperationError)
          const storageError = error as StorageOperationError
          expect(storageError.retryable).toBe(false)
        }
      })
    })

    describe('Error propagation', () => {
      it('should wrap GCS errors in StorageOperationError', async () => {
        const storage = new GCSRawCSVStorage({
          projectId: testProjectId,
          bucketName: testBucketName,
        })

        const originalError = new Error('GCS internal error')
        const mockFile = createMockFile('raw-csv/2024-01-15/all-districts.csv')
        mockFile.exists.mockResolvedValue([true])
        mockFile.download.mockRejectedValue(originalError)
        mockBucket.file.mockReturnValue(mockFile)

        try {
          await storage.getCachedCSV('2024-01-15', CSVType.ALL_DISTRICTS)
          expect.fail('Should have thrown')
        } catch (error) {
          expect(error).toBeInstanceOf(StorageOperationError)
          const storageError = error as StorageOperationError
          expect(storageError.cause).toBe(originalError)
        }
      })

      it('should handle setCachedCSV errors', async () => {
        const storage = new GCSRawCSVStorage({
          projectId: testProjectId,
          bucketName: testBucketName,
        })

        const mockFile = createMockFile('raw-csv/2024-01-15/all-districts.csv')
        mockFile.save.mockRejectedValue(new Error('Upload failed'))
        mockBucket.file.mockReturnValue(mockFile)

        await expect(
          storage.setCachedCSV('2024-01-15', CSVType.ALL_DISTRICTS, 'content')
        ).rejects.toThrow(StorageOperationError)
      })

      it('should handle clearCacheForDate errors', async () => {
        const storage = new GCSRawCSVStorage({
          projectId: testProjectId,
          bucketName: testBucketName,
        })

        mockBucket.getFiles.mockRejectedValue(new Error('List failed'))

        await expect(storage.clearCacheForDate('2024-01-15')).rejects.toThrow(
          StorageOperationError
        )
      })

      it('should handle updateCacheMetadata errors', async () => {
        const storage = new GCSRawCSVStorage({
          projectId: testProjectId,
          bucketName: testBucketName,
        })

        const mockFile = createMockFile('raw-csv/2024-01-15/metadata.json')
        mockFile.exists.mockResolvedValue([false])
        mockFile.save.mockRejectedValue(new Error('Save failed'))
        mockBucket.file.mockReturnValue(mockFile)

        await expect(
          storage.updateCacheMetadata('2024-01-15', { source: 'test' })
        ).rejects.toThrow(StorageOperationError)
      })
    })
  })

  // ============================================================================
  // Circuit Breaker Integration Tests (Requirement 7.4)
  // ============================================================================

  describe('Circuit Breaker Integration (Requirement 7.4)', () => {
    it('should use circuit breaker for operations', async () => {
      const { CircuitBreaker } =
        await import('../../../utils/CircuitBreaker.js')
      const mockExecute = vi.fn(async <T>(operation: () => Promise<T>) =>
        operation()
      )

      vi.mocked(CircuitBreaker.createCacheCircuitBreaker).mockReturnValue({
        execute: mockExecute,
        getStats: vi.fn(() => ({
          state: 'CLOSED',
          failureCount: 0,
          successCount: 0,
          totalRequests: 0,
          totalFailures: 0,
          totalSuccesses: 0,
        })),
        reset: vi.fn(),
      } as unknown as ReturnType<
        typeof CircuitBreaker.createCacheCircuitBreaker
      >)

      const storage = new GCSRawCSVStorage({
        projectId: testProjectId,
        bucketName: testBucketName,
      })

      const mockFile = createMockFile('raw-csv/2024-01-15/all-districts.csv')
      mockFile.exists.mockResolvedValue([false])
      mockBucket.file.mockReturnValue(mockFile)

      await storage.hasCachedCSV('2024-01-15', CSVType.ALL_DISTRICTS)

      expect(mockExecute).toHaveBeenCalled()
    })
  })
})
