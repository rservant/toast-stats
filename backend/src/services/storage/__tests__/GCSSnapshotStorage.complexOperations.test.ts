/**
 * GCSSnapshotStorage Unit Tests — Complex Operations (Task 6.5)
 *
 * Tests getLatestSuccessful, getLatest, getSnapshot, listSnapshots, isReady.
 *
 * Requirements: 1.1, 1.2, 1.7, 8.1, 8.2, 9.4, 9.5, 10.2
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
  const MockCircuitBreaker = function (this: Record<string, unknown>) {
    this.execute = vi.fn(async <T>(operation: () => Promise<T>) => operation())
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

function makeManifestBuffer(
  snapshotId: string,
  writeComplete?: boolean,
  districts: Array<{ districtId: string; status: string }> = [
    { districtId: '42', status: 'success' },
  ]
): Buffer {
  const manifest: Record<string, unknown> = {
    snapshotId,
    createdAt: `${snapshotId}T10:00:00Z`,
    districts: districts.map(d => ({
      districtId: d.districtId,
      fileName: `district_${d.districtId}.json`,
      status: d.status,
      fileSize: 1024,
      lastModified: `${snapshotId}T10:00:00Z`,
    })),
    totalDistricts: districts.length,
    successfulDistricts: districts.filter(d => d.status === 'success').length,
    failedDistricts: districts.filter(d => d.status !== 'success').length,
  }
  if (writeComplete !== undefined) {
    manifest['writeComplete'] = writeComplete
  }
  return Buffer.from(JSON.stringify(manifest))
}

function makeMetadataBuffer(
  snapshotId: string,
  status: string = 'success',
  districtIds: string[] = ['42']
): Buffer {
  return Buffer.from(
    JSON.stringify({
      snapshotId,
      createdAt: `${snapshotId}T10:00:00Z`,
      schemaVersion: '1.0.0',
      calculationVersion: '1.0.0',
      status,
      configuredDistricts: districtIds,
      successfulDistricts: status === 'success' ? districtIds : [],
      failedDistricts: status === 'failed' ? districtIds : [],
      errors: status === 'failed' ? ['Processing failed'] : [],
      processingDuration: 5000,
      source: 'scraper-cli',
      dataAsOfDate: snapshotId,
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

function make404Error(): Error {
  const err = new Error('Not Found')
  Object.assign(err, { code: 404 })
  return err
}

/**
 * Sets up mockBucket.getFiles to return the given snapshot prefixes in a single page.
 */
function setupPrefixListing(
  mockBucket: MockBucket,
  snapshotIds: string[]
): void {
  mockBucket.getFiles.mockResolvedValue([
    [],
    null,
    {
      prefixes: snapshotIds.map(id => `snapshots/${id}/`),
    },
  ])
}

// ============================================================================
// Tests
// ============================================================================

describe('GCSSnapshotStorage — Complex Operations', () => {
  let mockBucket: MockBucket

  beforeEach(() => {
    mockBucket = createMockBucket()
  })

  // ==========================================================================
  // getLatestSuccessful (Req 1.1, 9.5)
  // ==========================================================================

  describe('getLatestSuccessful', () => {
    it('should return the newest snapshot with status "success" and writeComplete true', async () => {
      // Three snapshots: all success + writeComplete
      setupPrefixListing(mockBucket, ['2024-01-13', '2024-01-14', '2024-01-15'])

      mockBucket.file.mockImplementation((path: string) => {
        const file = createMockFile(path)

        if (path.endsWith('metadata.json')) {
          // Extract snapshotId from path
          const match = path.match(/snapshots\/([^/]+)\//)
          const snapshotId = match?.[1] ?? '2024-01-15'
          file.download.mockResolvedValue([
            makeMetadataBuffer(snapshotId, 'success'),
          ])
        } else if (path.endsWith('manifest.json')) {
          const match = path.match(/snapshots\/([^/]+)\//)
          const snapshotId = match?.[1] ?? '2024-01-15'
          file.download.mockResolvedValue([
            makeManifestBuffer(snapshotId, true),
          ])
        } else if (path.includes('district_')) {
          file.download.mockResolvedValue([makePerDistrictDataBuffer('42')])
        }

        return file
      })

      const storage = createStorage(mockBucket)
      const result = await storage.getLatestSuccessful()

      expect(result).not.toBeNull()
      // Should return the newest (2024-01-15) since it's sorted reverse-lexical
      expect(result?.snapshot_id).toBe('2024-01-15')
    })

    it('should skip failed snapshots and return the next successful one', async () => {
      // 2024-01-15 is failed, 2024-01-14 is success+writeComplete
      setupPrefixListing(mockBucket, ['2024-01-14', '2024-01-15'])

      mockBucket.file.mockImplementation((path: string) => {
        const file = createMockFile(path)
        const match = path.match(/snapshots\/([^/]+)\//)
        const snapshotId = match?.[1] ?? ''

        if (path.endsWith('metadata.json')) {
          const status = snapshotId === '2024-01-15' ? 'failed' : 'success'
          file.download.mockResolvedValue([
            makeMetadataBuffer(snapshotId, status),
          ])
        } else if (path.endsWith('manifest.json')) {
          file.download.mockResolvedValue([
            makeManifestBuffer(snapshotId, true),
          ])
        } else if (path.includes('district_')) {
          file.download.mockResolvedValue([makePerDistrictDataBuffer('42')])
        }

        return file
      })

      const storage = createStorage(mockBucket)
      const result = await storage.getLatestSuccessful()

      expect(result).not.toBeNull()
      expect(result?.snapshot_id).toBe('2024-01-14')
    })

    it('should skip snapshots where writeComplete is false (Req 9.5)', async () => {
      // 2024-01-15 is success but NOT writeComplete, 2024-01-14 is success+writeComplete
      setupPrefixListing(mockBucket, ['2024-01-14', '2024-01-15'])

      mockBucket.file.mockImplementation((path: string) => {
        const file = createMockFile(path)
        const match = path.match(/snapshots\/([^/]+)\//)
        const snapshotId = match?.[1] ?? ''

        if (path.endsWith('metadata.json')) {
          file.download.mockResolvedValue([
            makeMetadataBuffer(snapshotId, 'success'),
          ])
        } else if (path.endsWith('manifest.json')) {
          const wc = snapshotId === '2024-01-15' ? false : true
          file.download.mockResolvedValue([makeManifestBuffer(snapshotId, wc)])
        } else if (path.includes('district_')) {
          file.download.mockResolvedValue([makePerDistrictDataBuffer('42')])
        }

        return file
      })

      const storage = createStorage(mockBucket)
      const result = await storage.getLatestSuccessful()

      expect(result).not.toBeNull()
      expect(result?.snapshot_id).toBe('2024-01-14')
    })

    it('should return null when no qualifying snapshots exist', async () => {
      // All snapshots are failed
      setupPrefixListing(mockBucket, ['2024-01-14', '2024-01-15'])

      mockBucket.file.mockImplementation((path: string) => {
        const file = createMockFile(path)
        const match = path.match(/snapshots\/([^/]+)\//)
        const snapshotId = match?.[1] ?? ''

        if (path.endsWith('metadata.json')) {
          file.download.mockResolvedValue([
            makeMetadataBuffer(snapshotId, 'failed'),
          ])
        } else if (path.endsWith('manifest.json')) {
          file.download.mockResolvedValue([
            makeManifestBuffer(snapshotId, true),
          ])
        }

        return file
      })

      const storage = createStorage(mockBucket)
      const result = await storage.getLatestSuccessful()

      expect(result).toBeNull()
    })

    it('should return null when all snapshots are not write-complete', async () => {
      setupPrefixListing(mockBucket, ['2024-01-15'])

      mockBucket.file.mockImplementation((path: string) => {
        const file = createMockFile(path)

        if (path.endsWith('metadata.json')) {
          file.download.mockResolvedValue([
            makeMetadataBuffer('2024-01-15', 'success'),
          ])
        } else if (path.endsWith('manifest.json')) {
          file.download.mockResolvedValue([
            makeManifestBuffer('2024-01-15', false),
          ])
        }

        return file
      })

      const storage = createStorage(mockBucket)
      const result = await storage.getLatestSuccessful()

      expect(result).toBeNull()
    })

    it('should return null when no snapshots exist', async () => {
      setupPrefixListing(mockBucket, [])

      const storage = createStorage(mockBucket)
      const result = await storage.getLatestSuccessful()

      expect(result).toBeNull()
    })
  })

  // ==========================================================================
  // getLatest (Req 9.5)
  // ==========================================================================

  describe('getLatest', () => {
    it('should return most recent writeComplete snapshot regardless of status', async () => {
      // 2024-01-15 is failed but writeComplete — should still be returned
      setupPrefixListing(mockBucket, ['2024-01-14', '2024-01-15'])

      mockBucket.file.mockImplementation((path: string) => {
        const file = createMockFile(path)
        const match = path.match(/snapshots\/([^/]+)\//)
        const snapshotId = match?.[1] ?? ''

        if (path.endsWith('metadata.json')) {
          const status = snapshotId === '2024-01-15' ? 'failed' : 'success'
          file.download.mockResolvedValue([
            makeMetadataBuffer(snapshotId, status),
          ])
        } else if (path.endsWith('manifest.json')) {
          file.download.mockResolvedValue([
            makeManifestBuffer(snapshotId, true),
          ])
        } else if (path.includes('district_')) {
          file.download.mockResolvedValue([makePerDistrictDataBuffer('42')])
        }

        return file
      })

      const storage = createStorage(mockBucket)
      const result = await storage.getLatest()

      expect(result).not.toBeNull()
      expect(result?.snapshot_id).toBe('2024-01-15')
    })

    it('should skip snapshots where writeComplete is false', async () => {
      // 2024-01-15 is NOT writeComplete, 2024-01-14 IS writeComplete
      setupPrefixListing(mockBucket, ['2024-01-14', '2024-01-15'])

      mockBucket.file.mockImplementation((path: string) => {
        const file = createMockFile(path)
        const match = path.match(/snapshots\/([^/]+)\//)
        const snapshotId = match?.[1] ?? ''

        if (path.endsWith('metadata.json')) {
          file.download.mockResolvedValue([
            makeMetadataBuffer(snapshotId, 'success'),
          ])
        } else if (path.endsWith('manifest.json')) {
          const wc = snapshotId === '2024-01-15' ? false : true
          file.download.mockResolvedValue([makeManifestBuffer(snapshotId, wc)])
        } else if (path.includes('district_')) {
          file.download.mockResolvedValue([makePerDistrictDataBuffer('42')])
        }

        return file
      })

      const storage = createStorage(mockBucket)
      const result = await storage.getLatest()

      expect(result).not.toBeNull()
      expect(result?.snapshot_id).toBe('2024-01-14')
    })

    it('should return null when no writeComplete snapshots exist', async () => {
      setupPrefixListing(mockBucket, ['2024-01-15'])

      mockBucket.file.mockImplementation((path: string) => {
        const file = createMockFile(path)

        if (path.endsWith('manifest.json')) {
          file.download.mockResolvedValue([
            makeManifestBuffer('2024-01-15', false),
          ])
        }

        return file
      })

      const storage = createStorage(mockBucket)
      const result = await storage.getLatest()

      expect(result).toBeNull()
    })
  })

  // ==========================================================================
  // getSnapshot (Req 1.2, 9.4)
  // ==========================================================================

  describe('getSnapshot', () => {
    it('should assemble a complete Snapshot when writeComplete is true', async () => {
      const districts = [
        { districtId: '42', status: 'success' },
        { districtId: '61', status: 'success' },
      ]

      mockBucket.file.mockImplementation((path: string) => {
        const file = createMockFile(path)

        if (path.endsWith('manifest.json')) {
          file.download.mockResolvedValue([
            makeManifestBuffer('2024-01-15', true, districts),
          ])
        } else if (path.endsWith('metadata.json')) {
          file.download.mockResolvedValue([
            makeMetadataBuffer('2024-01-15', 'success', ['42', '61']),
          ])
        } else if (path.includes('district_42')) {
          file.download.mockResolvedValue([makePerDistrictDataBuffer('42')])
        } else if (path.includes('district_61')) {
          file.download.mockResolvedValue([makePerDistrictDataBuffer('61')])
        }

        return file
      })

      const storage = createStorage(mockBucket)
      const result = await storage.getSnapshot('2024-01-15')

      expect(result).not.toBeNull()
      expect(result?.snapshot_id).toBe('2024-01-15')
      expect(result?.status).toBe('success')
      expect(result?.payload.districts).toHaveLength(2)
    })

    it('should return null when writeComplete is false on initial read (Req 9.4)', async () => {
      mockBucket.file.mockImplementation((path: string) => {
        const file = createMockFile(path)

        if (path.endsWith('manifest.json')) {
          file.download.mockResolvedValue([
            makeManifestBuffer('2024-01-15', false),
          ])
        }

        return file
      })

      const storage = createStorage(mockBucket)
      const result = await storage.getSnapshot('2024-01-15')

      expect(result).toBeNull()
    })

    it('should return null when writeComplete changes to false during read (Req 9.4)', async () => {
      // First manifest read: writeComplete = true
      // Re-read manifest after district reads: writeComplete = false
      let manifestReadCount = 0

      mockBucket.file.mockImplementation((path: string) => {
        const file = createMockFile(path)

        if (path.endsWith('manifest.json')) {
          file.download.mockImplementation(() => {
            manifestReadCount++
            // First read: writeComplete true; second read: writeComplete false
            const wc = manifestReadCount <= 1
            return Promise.resolve([makeManifestBuffer('2024-01-15', wc)])
          })
        } else if (path.endsWith('metadata.json')) {
          file.download.mockResolvedValue([
            makeMetadataBuffer('2024-01-15', 'success'),
          ])
        } else if (path.includes('district_')) {
          file.download.mockResolvedValue([makePerDistrictDataBuffer('42')])
        }

        return file
      })

      const storage = createStorage(mockBucket)
      const result = await storage.getSnapshot('2024-01-15')

      expect(result).toBeNull()
    })

    it('should return null when metadata is missing', async () => {
      mockBucket.file.mockImplementation((path: string) => {
        const file = createMockFile(path)

        if (path.endsWith('manifest.json')) {
          file.download.mockResolvedValue([
            makeManifestBuffer('2024-01-15', true),
          ])
        } else if (path.endsWith('metadata.json')) {
          file.download.mockRejectedValue(make404Error())
        }

        return file
      })

      const storage = createStorage(mockBucket)
      const result = await storage.getSnapshot('2024-01-15')

      expect(result).toBeNull()
    })

    it('should return null when manifest is missing', async () => {
      mockBucket.file.mockImplementation((path: string) => {
        const file = createMockFile(path)

        if (path.endsWith('manifest.json')) {
          file.download.mockRejectedValue(make404Error())
        }

        return file
      })

      const storage = createStorage(mockBucket)
      const result = await storage.getSnapshot('2024-01-15')

      expect(result).toBeNull()
    })

    it('should throw StorageOperationError for invalid snapshot ID', async () => {
      const storage = createStorage(mockBucket)

      await expect(storage.getSnapshot('bad-id')).rejects.toThrow(
        StorageOperationError
      )

      expect(mockBucket.file).not.toHaveBeenCalled()
    })
  })

  // ==========================================================================
  // listSnapshots (Req 1.7, 10.2)
  // ==========================================================================

  describe('listSnapshots', () => {
    it('should return snapshots sorted newest-first', async () => {
      setupPrefixListing(mockBucket, ['2024-01-13', '2024-01-14', '2024-01-15'])

      mockBucket.file.mockImplementation((path: string) => {
        const file = createMockFile(path)
        const match = path.match(/snapshots\/([^/]+)\//)
        const snapshotId = match?.[1] ?? ''

        if (path.endsWith('metadata.json')) {
          file.download.mockResolvedValue([
            makeMetadataBuffer(snapshotId, 'success'),
          ])
        }

        return file
      })

      const storage = createStorage(mockBucket)
      const result = await storage.listSnapshots()

      expect(result).toHaveLength(3)
      expect(result[0]?.snapshot_id).toBe('2024-01-15')
      expect(result[1]?.snapshot_id).toBe('2024-01-14')
      expect(result[2]?.snapshot_id).toBe('2024-01-13')
    })

    it('should filter by status correctly', async () => {
      setupPrefixListing(mockBucket, ['2024-01-14', '2024-01-15'])

      mockBucket.file.mockImplementation((path: string) => {
        const file = createMockFile(path)
        const match = path.match(/snapshots\/([^/]+)\//)
        const snapshotId = match?.[1] ?? ''

        if (path.endsWith('metadata.json')) {
          const status = snapshotId === '2024-01-15' ? 'failed' : 'success'
          file.download.mockResolvedValue([
            makeMetadataBuffer(snapshotId, status),
          ])
        }

        return file
      })

      const storage = createStorage(mockBucket)
      const result = await storage.listSnapshots(undefined, {
        status: 'success',
      })

      expect(result).toHaveLength(1)
      expect(result[0]?.snapshot_id).toBe('2024-01-14')
    })

    it('should filter by date range (created_after / created_before)', async () => {
      setupPrefixListing(mockBucket, ['2024-01-13', '2024-01-14', '2024-01-15'])

      mockBucket.file.mockImplementation((path: string) => {
        const file = createMockFile(path)
        const match = path.match(/snapshots\/([^/]+)\//)
        const snapshotId = match?.[1] ?? ''

        if (path.endsWith('metadata.json')) {
          file.download.mockResolvedValue([
            makeMetadataBuffer(snapshotId, 'success'),
          ])
        }

        return file
      })

      const storage = createStorage(mockBucket)
      // Only snapshots created between 2024-01-13T12:00:00Z and 2024-01-14T12:00:00Z
      const result = await storage.listSnapshots(undefined, {
        created_after: '2024-01-13T12:00:00Z',
        created_before: '2024-01-14T12:00:00Z',
      })

      // 2024-01-13T10:00:00Z is before created_after, 2024-01-15T10:00:00Z is after created_before
      // Only 2024-01-14T10:00:00Z falls within the range
      expect(result).toHaveLength(1)
      expect(result[0]?.snapshot_id).toBe('2024-01-14')
    })

    it('should short-circuit at limit (Req 10.2)', async () => {
      setupPrefixListing(mockBucket, ['2024-01-13', '2024-01-14', '2024-01-15'])

      // Track which metadata files are read
      const metadataReads: string[] = []

      mockBucket.file.mockImplementation((path: string) => {
        const file = createMockFile(path)
        const match = path.match(/snapshots\/([^/]+)\//)
        const snapshotId = match?.[1] ?? ''

        if (path.endsWith('metadata.json')) {
          metadataReads.push(snapshotId)
          file.download.mockResolvedValue([
            makeMetadataBuffer(snapshotId, 'success'),
          ])
        }

        return file
      })

      const storage = createStorage(mockBucket)
      const result = await storage.listSnapshots(2)

      expect(result).toHaveLength(2)
      expect(result[0]?.snapshot_id).toBe('2024-01-15')
      expect(result[1]?.snapshot_id).toBe('2024-01-14')
      // Should have read at most 2 metadata files (short-circuit)
      expect(metadataReads).toHaveLength(2)
    })

    it('should not read manifest files (performance)', async () => {
      setupPrefixListing(mockBucket, ['2024-01-15'])

      const filesAccessed: string[] = []

      mockBucket.file.mockImplementation((path: string) => {
        filesAccessed.push(path)
        const file = createMockFile(path)

        if (path.endsWith('metadata.json')) {
          file.download.mockResolvedValue([
            makeMetadataBuffer('2024-01-15', 'success'),
          ])
        }

        return file
      })

      const storage = createStorage(mockBucket)
      await storage.listSnapshots()

      // Verify only metadata files were accessed, no manifest reads
      const manifestReads = filesAccessed.filter(p =>
        p.includes('manifest.json')
      )
      expect(manifestReads).toHaveLength(0)
    })

    it('should skip snapshots with missing metadata', async () => {
      setupPrefixListing(mockBucket, ['2024-01-14', '2024-01-15'])

      mockBucket.file.mockImplementation((path: string) => {
        const file = createMockFile(path)
        const match = path.match(/snapshots\/([^/]+)\//)
        const snapshotId = match?.[1] ?? ''

        if (path.endsWith('metadata.json')) {
          if (snapshotId === '2024-01-15') {
            file.download.mockRejectedValue(make404Error())
          } else {
            file.download.mockResolvedValue([
              makeMetadataBuffer(snapshotId, 'success'),
            ])
          }
        }

        return file
      })

      const storage = createStorage(mockBucket)
      const result = await storage.listSnapshots()

      expect(result).toHaveLength(1)
      expect(result[0]?.snapshot_id).toBe('2024-01-14')
    })
  })

  // ==========================================================================
  // isReady (Req 8.1, 8.2)
  // ==========================================================================

  describe('isReady', () => {
    it('should return true when bucket is accessible (Req 8.1)', async () => {
      mockBucket.getFiles.mockResolvedValue([[], null, {}])

      const storage = createStorage(mockBucket)
      const result = await storage.isReady()

      expect(result).toBe(true)
      expect(mockBucket.getFiles).toHaveBeenCalledWith(
        expect.objectContaining({
          prefix: 'snapshots/',
          delimiter: '/',
          maxResults: 1,
          autoPaginate: false,
        })
      )
    })

    it('should return false when bucket is not accessible (Req 8.2)', async () => {
      mockBucket.getFiles.mockRejectedValue(new Error('permission denied'))

      const storage = createStorage(mockBucket)
      const result = await storage.isReady()

      expect(result).toBe(false)
    })

    it('should return false on network error without throwing', async () => {
      const networkError = new Error('ECONNREFUSED')
      Object.assign(networkError, { code: 'ECONNREFUSED' })
      mockBucket.getFiles.mockRejectedValue(networkError)

      const storage = createStorage(mockBucket)
      const result = await storage.isReady()

      expect(result).toBe(false)
    })
  })
})
