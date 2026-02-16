/**
 * GCSSnapshotStorage Unit Tests — Snapshot Read Operations (Task 5.6)
 *
 * Tests getSnapshotMetadata, getSnapshotManifest, readDistrictData,
 * readAllDistrictsRankings, hasAllDistrictsRankings, listDistrictsInSnapshot.
 *
 * isSnapshotWriteComplete is tested separately in GCSSnapshotStorage.writeComplete.test.ts.
 *
 * Requirements: 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 9.1, 9.2, 9.3
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { StorageOperationError } from '../../../types/storageInterfaces.js'

// Mock logger
vi.mock('../../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// Mock CircuitBreaker to pass operations through directly
vi.mock('../../../utils/CircuitBreaker.js', () => {
  const MockCircuitBreaker = function (
    this: Record<string, unknown>
  ) {
    this.execute = vi.fn(
      async <T>(operation: () => Promise<T>) => operation()
    )
    this.getStats = vi.fn(() => ({
      state: 'CLOSED',
      failureCount: 0,
      successCount: 0,
      totalRequests: 0,
      totalFailures: 0,
      totalSuccesses: 0,
    }))
    this.reset = vi.fn()
  }
  return { CircuitBreaker: MockCircuitBreaker }
})

import { GCSSnapshotStorage } from '../GCSSnapshotStorage.js'
import type { GCSSnapshotStorageConfig } from '../GCSSnapshotStorage.js'

// ============================================================================
// Mock Helpers
// ============================================================================

interface MockFile {
  download: ReturnType<typeof vi.fn>
  exists: ReturnType<typeof vi.fn>
  name: string
}

interface MockBucket {
  file: ReturnType<typeof vi.fn>
  getFiles: ReturnType<typeof vi.fn>
}

function createMockFile(name: string): MockFile {
  return {
    download: vi.fn(),
    exists: vi.fn(),
    name,
  }
}

function createMockBucket(): MockBucket {
  return {
    file: vi.fn(),
    getFiles: vi.fn(),
  }
}

function createMockStorage(bucket: MockBucket) {
  return {
    bucket: vi.fn().mockReturnValue(bucket),
  }
}

function createStorage(bucket: MockBucket): GCSSnapshotStorage {
  const mockStorage = createMockStorage(bucket)
  const config: GCSSnapshotStorageConfig = {
    projectId: 'test-project',
    bucketName: 'test-bucket',
    prefix: 'snapshots',
    storage: mockStorage as unknown as import('@google-cloud/storage').Storage,
  }
  return new GCSSnapshotStorage(config)
}

// ============================================================================
// Test Fixture Factories
// ============================================================================

function makeManifestBuffer(writeComplete?: boolean): Buffer {
  const manifest: Record<string, unknown> = {
    snapshotId: '2024-01-15',
    createdAt: '2024-01-15T10:00:00Z',
    districts: [
      {
        districtId: '42',
        fileName: 'district_42.json',
        status: 'success',
        fileSize: 1024,
        lastModified: '2024-01-15T10:00:00Z',
      },
    ],
    totalDistricts: 1,
    successfulDistricts: 1,
    failedDistricts: 0,
  }
  if (writeComplete !== undefined) {
    manifest['writeComplete'] = writeComplete
  }
  return Buffer.from(JSON.stringify(manifest))
}

function makeMetadataBuffer(): Buffer {
  return Buffer.from(
    JSON.stringify({
      snapshotId: '2024-01-15',
      createdAt: '2024-01-15T10:00:00Z',
      schemaVersion: '1.0.0',
      calculationVersion: '1.0.0',
      status: 'success',
      configuredDistricts: ['42'],
      successfulDistricts: ['42'],
      failedDistricts: [],
      errors: [],
      processingDuration: 5000,
      source: 'scraper-cli',
      dataAsOfDate: '2024-01-15',
    })
  )
}

function makePerDistrictDataBuffer(districtId = '42'): Buffer {
  return Buffer.from(
    JSON.stringify({
      districtId,
      districtName: `District ${districtId}`,
      collectedAt: '2024-01-15T10:00:00Z',
      status: 'success',
      data: {
        districtId,
        snapshotDate: '2024-01-15',
        clubs: [
          {
            clubId: '1001',
            clubName: 'Test Club',
            divisionId: 'A',
            areaId: '1',
            membershipCount: 20,
            paymentsCount: 20,
            dcpGoals: 5,
            status: 'Active',
            divisionName: 'Division A',
            areaName: 'Area 1',
            octoberRenewals: 10,
            aprilRenewals: 5,
            newMembers: 5,
            membershipBase: 18,
          },
        ],
        divisions: [
          {
            divisionId: 'A',
            divisionName: 'Division A',
            clubCount: 1,
            membershipTotal: 20,
            paymentsTotal: 20,
          },
        ],
        areas: [
          {
            areaId: '1',
            areaName: 'Area 1',
            divisionId: 'A',
            clubCount: 1,
            membershipTotal: 20,
            paymentsTotal: 20,
          },
        ],
        totals: {
          totalClubs: 1,
          totalMembership: 20,
          totalPayments: 20,
          distinguishedClubs: 0,
          selectDistinguishedClubs: 0,
          presidentDistinguishedClubs: 0,
        },
        divisionPerformance: [],
        clubPerformance: [],
        districtPerformance: [],
      },
    })
  )
}

function makeRankingsBuffer(): Buffer {
  return Buffer.from(
    JSON.stringify({
      metadata: {
        snapshotId: '2024-01-15',
        calculatedAt: '2024-01-15T10:00:00Z',
        schemaVersion: '1.0.0',
        calculationVersion: '1.0.0',
        rankingVersion: '1.0.0',
        sourceCsvDate: '2024-01-15',
        csvFetchedAt: '2024-01-15T10:00:00Z',
        totalDistricts: 1,
        fromCache: false,
      },
      rankings: [
        {
          districtId: '42',
          districtName: 'District 42',
          region: 'Region 1',
          paidClubs: 50,
          paidClubBase: 48,
          clubGrowthPercent: 4.17,
          totalPayments: 1000,
          paymentBase: 950,
          paymentGrowthPercent: 5.26,
          activeClubs: 48,
          distinguishedClubs: 10,
          selectDistinguished: 5,
          presidentsDistinguished: 3,
          distinguishedPercent: 37.5,
          clubsRank: 1,
          paymentsRank: 1,
          distinguishedRank: 1,
          aggregateScore: 100,
          overallRank: 1,
        },
      ],
    })
  )
}

function make404Error(): Error {
  const err = new Error('Not Found')
  Object.assign(err, { code: 404 })
  return err
}

// ============================================================================
// Tests
// ============================================================================

describe('GCSSnapshotStorage — Snapshot Read Operations', () => {
  let mockBucket: MockBucket

  beforeEach(() => {
    mockBucket = createMockBucket()
  })

  // ==========================================================================
  // getSnapshotMetadata (Req 1.5)
  // ==========================================================================

  describe('getSnapshotMetadata', () => {
    it('should return mapped PerDistrictSnapshotMetadata for valid metadata file', async () => {
      const mockFile = createMockFile('snapshots/2024-01-15/metadata.json')
      mockFile.download.mockResolvedValue([makeMetadataBuffer()])
      mockBucket.file.mockReturnValue(mockFile)

      const storage = createStorage(mockBucket)
      const result = await storage.getSnapshotMetadata('2024-01-15')

      expect(result).not.toBeNull()
      expect(result?.snapshotId).toBe('2024-01-15')
      expect(result?.status).toBe('success')
      expect(result?.schemaVersion).toBe('1.0.0')
      expect(result?.successfulDistricts).toEqual(['42'])
      expect(result?.failedDistricts).toEqual([])
      expect(result?.errors).toEqual([])
      expect(result?.processingDuration).toBe(5000)
      expect(result?.source).toBe('scraper-cli')
      expect(mockBucket.file).toHaveBeenCalledWith(
        'snapshots/2024-01-15/metadata.json'
      )
    })

    it('should return null when metadata file does not exist (404)', async () => {
      const mockFile = createMockFile('snapshots/2024-01-15/metadata.json')
      mockFile.download.mockRejectedValue(make404Error())
      mockBucket.file.mockReturnValue(mockFile)

      const storage = createStorage(mockBucket)
      const result = await storage.getSnapshotMetadata('2024-01-15')

      expect(result).toBeNull()
    })

    it('should throw StorageOperationError for invalid snapshot ID', async () => {
      const storage = createStorage(mockBucket)

      await expect(
        storage.getSnapshotMetadata('not-a-date')
      ).rejects.toThrow(StorageOperationError)

      expect(mockBucket.file).not.toHaveBeenCalled()
    })
  })

  // ==========================================================================
  // getSnapshotManifest (Req 1.4)
  // ==========================================================================

  describe('getSnapshotManifest', () => {
    it('should return validated SnapshotManifest for valid manifest file', async () => {
      const mockFile = createMockFile('snapshots/2024-01-15/manifest.json')
      mockFile.download.mockResolvedValue([makeManifestBuffer(true)])
      mockBucket.file.mockReturnValue(mockFile)

      const storage = createStorage(mockBucket)
      const result = await storage.getSnapshotManifest('2024-01-15')

      expect(result).not.toBeNull()
      expect(result?.snapshotId).toBe('2024-01-15')
      expect(result?.writeComplete).toBe(true)
      expect(result?.totalDistricts).toBe(1)
      expect(result?.districts).toHaveLength(1)
      expect(result?.districts[0]?.districtId).toBe('42')
      expect(mockBucket.file).toHaveBeenCalledWith(
        'snapshots/2024-01-15/manifest.json'
      )
    })

    it('should return null when manifest file does not exist (404)', async () => {
      const mockFile = createMockFile('snapshots/2024-01-15/manifest.json')
      mockFile.download.mockRejectedValue(make404Error())
      mockBucket.file.mockReturnValue(mockFile)

      const storage = createStorage(mockBucket)
      const result = await storage.getSnapshotManifest('2024-01-15')

      expect(result).toBeNull()
    })
  })

  // ==========================================================================
  // readDistrictData (Req 1.3, 6.1, 6.3)
  // ==========================================================================

  describe('readDistrictData', () => {
    it('should return adapted DistrictStatistics for valid district data', async () => {
      const mockFile = createMockFile('snapshots/2024-01-15/district_42.json')
      mockFile.download.mockResolvedValue([makePerDistrictDataBuffer('42')])
      mockBucket.file.mockReturnValue(mockFile)

      const storage = createStorage(mockBucket)
      const result = await storage.readDistrictData('2024-01-15', '42')

      expect(result).not.toBeNull()
      expect(result?.districtId).toBe('42')
      expect(result?.asOfDate).toBe('2024-01-15')
      // Verify adapter ran — membership stats should be computed
      expect(result?.membership.total).toBe(20)
      expect(result?.clubs.total).toBe(1)
      expect(mockBucket.file).toHaveBeenCalledWith(
        'snapshots/2024-01-15/district_42.json'
      )
    })

    it('should return null when district file does not exist (404)', async () => {
      const mockFile = createMockFile('snapshots/2024-01-15/district_99.json')
      mockFile.download.mockRejectedValue(make404Error())
      mockBucket.file.mockReturnValue(mockFile)

      const storage = createStorage(mockBucket)
      const result = await storage.readDistrictData('2024-01-15', '99')

      expect(result).toBeNull()
    })

    it('should throw StorageOperationError for invalid snapshot ID', async () => {
      const storage = createStorage(mockBucket)

      await expect(
        storage.readDistrictData('2024-13-01', '42')
      ).rejects.toThrow(StorageOperationError)

      expect(mockBucket.file).not.toHaveBeenCalled()
    })

    it('should throw StorageOperationError for invalid district ID', async () => {
      const storage = createStorage(mockBucket)

      await expect(
        storage.readDistrictData('2024-01-15', '')
      ).rejects.toThrow(StorageOperationError)

      expect(mockBucket.file).not.toHaveBeenCalled()
    })
  })


  // ==========================================================================
  // readAllDistrictsRankings (Req 2.1, 2.3, 2.4)
  // ==========================================================================

  describe('readAllDistrictsRankings', () => {
    it('should return rankings data when writeComplete is true and rankings exist', async () => {
      // First call: isSnapshotWriteComplete reads manifest
      // Second call: readObject reads rankings file
      const manifestFile = createMockFile('snapshots/2024-01-15/manifest.json')
      manifestFile.download.mockResolvedValue([makeManifestBuffer(true)])

      const rankingsFile = createMockFile(
        'snapshots/2024-01-15/all-districts-rankings.json'
      )
      rankingsFile.download.mockResolvedValue([makeRankingsBuffer()])

      mockBucket.file.mockImplementation((path: string) => {
        if (path.endsWith('manifest.json')) return manifestFile
        if (path.endsWith('all-districts-rankings.json')) return rankingsFile
        return createMockFile(path)
      })

      const storage = createStorage(mockBucket)
      const result = await storage.readAllDistrictsRankings('2024-01-15')

      expect(result).not.toBeNull()
      expect(result?.metadata.snapshotId).toBe('2024-01-15')
      expect(result?.rankings).toHaveLength(1)
      expect(result?.rankings[0]?.districtId).toBe('42')
    })

    it('should return null when writeComplete is false (Req 2.4)', async () => {
      const manifestFile = createMockFile('snapshots/2024-01-15/manifest.json')
      manifestFile.download.mockResolvedValue([makeManifestBuffer(false)])
      mockBucket.file.mockReturnValue(manifestFile)

      const storage = createStorage(mockBucket)
      const result = await storage.readAllDistrictsRankings('2024-01-15')

      expect(result).toBeNull()
    })

    it('should return null when manifest is missing (writeComplete check fails)', async () => {
      const manifestFile = createMockFile('snapshots/2024-01-15/manifest.json')
      manifestFile.download.mockRejectedValue(make404Error())
      mockBucket.file.mockReturnValue(manifestFile)

      const storage = createStorage(mockBucket)
      const result = await storage.readAllDistrictsRankings('2024-01-15')

      expect(result).toBeNull()
    })

    it('should return null when writeComplete is true but rankings file is 404 (Req 2.3)', async () => {
      const manifestFile = createMockFile('snapshots/2024-01-15/manifest.json')
      manifestFile.download.mockResolvedValue([makeManifestBuffer(true)])

      const rankingsFile = createMockFile(
        'snapshots/2024-01-15/all-districts-rankings.json'
      )
      rankingsFile.download.mockRejectedValue(make404Error())

      mockBucket.file.mockImplementation((path: string) => {
        if (path.endsWith('manifest.json')) return manifestFile
        if (path.endsWith('all-districts-rankings.json')) return rankingsFile
        return createMockFile(path)
      })

      const storage = createStorage(mockBucket)
      const result = await storage.readAllDistrictsRankings('2024-01-15')

      expect(result).toBeNull()
    })
  })

  // ==========================================================================
  // hasAllDistrictsRankings (Req 2.2)
  // ==========================================================================

  describe('hasAllDistrictsRankings', () => {
    it('should return true when rankings file exists', async () => {
      const mockFile = createMockFile(
        'snapshots/2024-01-15/all-districts-rankings.json'
      )
      mockFile.exists.mockResolvedValue([true])
      mockBucket.file.mockReturnValue(mockFile)

      const storage = createStorage(mockBucket)
      const result = await storage.hasAllDistrictsRankings('2024-01-15')

      expect(result).toBe(true)
      expect(mockBucket.file).toHaveBeenCalledWith(
        'snapshots/2024-01-15/all-districts-rankings.json'
      )
    })

    it('should return false when rankings file is missing (no throw)', async () => {
      const mockFile = createMockFile(
        'snapshots/2024-01-15/all-districts-rankings.json'
      )
      mockFile.exists.mockResolvedValue([false])
      mockBucket.file.mockReturnValue(mockFile)

      const storage = createStorage(mockBucket)
      const result = await storage.hasAllDistrictsRankings('2024-01-15')

      expect(result).toBe(false)
    })

    it('should throw StorageOperationError for invalid snapshot ID', async () => {
      const storage = createStorage(mockBucket)

      await expect(
        storage.hasAllDistrictsRankings('../etc/passwd')
      ).rejects.toThrow(StorageOperationError)

      expect(mockBucket.file).not.toHaveBeenCalled()
    })
  })

  // ==========================================================================
  // listDistrictsInSnapshot (Req 1.6)
  // ==========================================================================

  describe('listDistrictsInSnapshot', () => {
    it('should return correct district IDs from known district files', async () => {
      const districtFiles = [
        { name: 'snapshots/2024-01-15/district_42.json' },
        { name: 'snapshots/2024-01-15/district_61.json' },
        { name: 'snapshots/2024-01-15/district_F.json' },
      ]

      mockBucket.getFiles.mockResolvedValue([
        districtFiles,
        null,
        {}, // no nextPageToken
      ])

      const storage = createStorage(mockBucket)
      const result = await storage.listDistrictsInSnapshot('2024-01-15')

      expect(result).toEqual(['42', '61', 'F'])
      expect(mockBucket.getFiles).toHaveBeenCalledWith(
        expect.objectContaining({
          prefix: 'snapshots/2024-01-15/district_',
          autoPaginate: false,
        })
      )
    })

    it('should return empty array when no district files exist', async () => {
      mockBucket.getFiles.mockResolvedValue([
        [],
        null,
        {},
      ])

      const storage = createStorage(mockBucket)
      const result = await storage.listDistrictsInSnapshot('2024-01-15')

      expect(result).toEqual([])
    })

    it('should throw StorageOperationError for invalid snapshot ID', async () => {
      const storage = createStorage(mockBucket)

      await expect(
        storage.listDistrictsInSnapshot('bad-id')
      ).rejects.toThrow(StorageOperationError)

      expect(mockBucket.getFiles).not.toHaveBeenCalled()
    })
  })
})
