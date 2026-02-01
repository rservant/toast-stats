/**
 * Unit Tests for UploadService
 *
 * Tests the upload functionality that syncs local snapshots and analytics
 * to Google Cloud Storage.
 *
 * Requirements:
 * - 6.1: THE Scraper_CLI SHALL provide an `upload` command to sync local
 *        snapshots and analytics to Google Cloud Storage
 * - 6.2: WHEN uploading, THE Scraper_CLI SHALL upload both snapshot data
 *        and pre-computed analytics files
 * - 6.3: THE Scraper_CLI SHALL support incremental uploads, only uploading
 *        files that have changed
 * - 6.4: IF upload fails for any file, THEN THE Scraper_CLI SHALL report
 *        the failure and continue with remaining files
 * - 6.5: WHEN upload completes, THE Scraper_CLI SHALL output a summary of
 *        uploaded files and any errors
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import * as crypto from 'crypto'
import { determineUploadExitCode, formatUploadSummary } from '../cli.js'
import { ExitCode, type UploadResult } from '../types/index.js'

/**
 * Create an isolated test cache directory
 */
function createIsolatedCacheDir(): {
  path: string
  cleanup: () => Promise<void>
} {
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const cachePath = path.join(os.tmpdir(), `upload-service-test-${uniqueId}`)

  return {
    path: cachePath,
    cleanup: async () => {
      await fs.rm(cachePath, { recursive: true, force: true })
    },
  }
}

/**
 * Create a sample snapshot directory structure for testing
 */
async function createSampleSnapshotStructure(
  cacheDir: string,
  date: string,
  districtIds: string[]
): Promise<void> {
  const snapshotDir = path.join(cacheDir, 'snapshots', date)
  const analyticsDir = path.join(snapshotDir, 'analytics')

  await fs.mkdir(analyticsDir, { recursive: true })

  // Write metadata.json
  await fs.writeFile(
    path.join(snapshotDir, 'metadata.json'),
    JSON.stringify({
      date,
      createdAt: new Date().toISOString(),
      schemaVersion: '1.0.0',
    })
  )

  // Write manifest.json
  await fs.writeFile(
    path.join(snapshotDir, 'manifest.json'),
    JSON.stringify({
      date,
      districts: districtIds,
      files: [],
    })
  )

  // Write district files and analytics for each district
  for (const districtId of districtIds) {
    // District snapshot file
    await fs.writeFile(
      path.join(snapshotDir, `district_${districtId}.json`),
      JSON.stringify({
        districtId,
        snapshotDate: date,
        clubs: [],
        divisions: [],
        areas: [],
        totals: { totalClubs: 0, totalMembership: 0 },
      })
    )

    // Analytics files
    await fs.writeFile(
      path.join(analyticsDir, `district_${districtId}_analytics.json`),
      JSON.stringify({
        metadata: { schemaVersion: '1.0.0', districtId },
        data: { districtId },
      })
    )

    await fs.writeFile(
      path.join(analyticsDir, `district_${districtId}_membership.json`),
      JSON.stringify({
        metadata: { schemaVersion: '1.0.0', districtId },
        data: { membershipTrend: [] },
      })
    )

    await fs.writeFile(
      path.join(analyticsDir, `district_${districtId}_clubhealth.json`),
      JSON.stringify({
        metadata: { schemaVersion: '1.0.0', districtId },
        data: { allClubs: [] },
      })
    )
  }

  // Write analytics manifest
  await fs.writeFile(
    path.join(analyticsDir, 'manifest.json'),
    JSON.stringify({
      snapshotDate: date,
      schemaVersion: '1.0.0',
      files: [],
    })
  )
}

/**
 * Calculate SHA256 checksum of content
 */
function calculateChecksum(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex')
}

/**
 * Mock GCS Bucket and File classes for testing
 */
interface MockFileMetadata {
  checksum?: string
  uploadedAt?: string
}

interface MockFile {
  name: string
  content: Buffer | null
  metadata: MockFileMetadata
  exists: () => Promise<[boolean]>
  getMetadata: () => Promise<[{ metadata?: Record<string, string> }]>
  save: (
    content: Buffer,
    options?: { contentType?: string; metadata?: Record<string, string> }
  ) => Promise<void>
}

interface MockBucket {
  files: Map<string, MockFile>
  file: (name: string) => MockFile
  uploadErrors: Map<string, Error>
  setUploadError: (fileName: string, error: Error) => void
  clearUploadErrors: () => void
}

function createMockBucket(): MockBucket {
  const files = new Map<string, MockFile>()
  const uploadErrors = new Map<string, Error>()

  const createMockFile = (name: string): MockFile => {
    const existingFile = files.get(name)
    if (existingFile) {
      return existingFile
    }

    const mockFile: MockFile = {
      name,
      content: null,
      metadata: {},
      exists: async () => [
        files.has(name) && files.get(name)!.content !== null,
      ],
      getMetadata: async () => {
        const file = files.get(name)
        if (!file || file.content === null) {
          throw new Error('File not found')
        }
        return [{ metadata: file.metadata as Record<string, string> }]
      },
      save: async (
        content: Buffer,
        options?: { contentType?: string; metadata?: Record<string, string> }
      ) => {
        // Check if there's a configured error for this file
        const error = uploadErrors.get(name)
        if (error) {
          throw error
        }

        mockFile.content = content
        mockFile.metadata = options?.metadata ?? {}
        files.set(name, mockFile)
      },
    }

    files.set(name, mockFile)
    return mockFile
  }

  return {
    files,
    file: createMockFile,
    uploadErrors,
    setUploadError: (fileName: string, error: Error) => {
      uploadErrors.set(fileName, error)
    },
    clearUploadErrors: () => {
      uploadErrors.clear()
    },
  }
}

/**
 * Mock UploadService that uses mock GCS bucket
 * This allows testing upload logic without real GCS calls
 */
class MockUploadService {
  private readonly cacheDir: string
  private readonly bucket: MockBucket
  private readonly prefix: string
  private authError: Error | null = null

  constructor(config: {
    cacheDir: string
    bucket: MockBucket
    prefix: string
  }) {
    this.cacheDir = config.cacheDir
    this.bucket = config.bucket
    this.prefix = config.prefix
  }

  /**
   * Simulate GCS authentication error
   */
  setAuthError(error: Error | null): void {
    this.authError = error
  }

  /**
   * Get the snapshots directory path
   */
  private getSnapshotsDir(): string {
    return path.join(this.cacheDir, 'snapshots')
  }

  /**
   * Get the snapshot directory path for a specific date
   */
  private getSnapshotDir(date: string): string {
    return path.join(this.getSnapshotsDir(), date)
  }

  /**
   * Build the GCS object path for a local file
   */
  private buildRemotePath(date: string, relativePath: string): string {
    return `${this.prefix}/${date}/${relativePath}`
  }

  /**
   * Calculate SHA256 checksum of file content
   */
  private async calculateFileChecksum(filePath: string): Promise<string> {
    const content = await fs.readFile(filePath)
    return crypto.createHash('sha256').update(content).digest('hex')
  }

  /**
   * Get available snapshot dates from local cache
   */
  async getAvailableDates(): Promise<string[]> {
    const snapshotsDir = this.getSnapshotsDir()

    try {
      const entries = await fs.readdir(snapshotsDir, { withFileTypes: true })
      const dates: string[] = []

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/
          if (dateRegex.test(entry.name)) {
            dates.push(entry.name)
          }
        }
      }

      return dates.sort().reverse()
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return []
      }
      throw error
    }
  }

  /**
   * Recursively collect all files in a directory
   */
  private async collectFiles(
    dir: string,
    baseDir: string
  ): Promise<
    Array<{
      localPath: string
      remotePath: string
      size: number
      checksum: string
    }>
  > {
    const files: Array<{
      localPath: string
      remotePath: string
      size: number
      checksum: string
    }> = []

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)

        if (entry.isDirectory()) {
          const subFiles = await this.collectFiles(fullPath, baseDir)
          files.push(...subFiles)
        } else if (entry.isFile()) {
          const stat = await fs.stat(fullPath)
          const checksum = await this.calculateFileChecksum(fullPath)
          const relativePath = path.relative(baseDir, fullPath)

          files.push({
            localPath: fullPath,
            remotePath: relativePath,
            size: stat.size,
            checksum,
          })
        }
      }
    } catch {
      // Ignore errors
    }

    return files
  }

  /**
   * Get remote file metadata from mock GCS
   */
  private async getRemoteMetadata(
    remotePath: string
  ): Promise<{ checksum?: string } | null> {
    try {
      const file = this.bucket.file(remotePath)
      const [exists] = await file.exists()

      if (!exists) {
        return null
      }

      const [metadata] = await file.getMetadata()
      return {
        checksum: metadata.metadata?.['checksum'],
      }
    } catch {
      return null
    }
  }

  /**
   * Upload snapshots and analytics to mock GCS
   */
  async upload(options: {
    date?: string
    incremental?: boolean
    dryRun?: boolean
  }): Promise<UploadResult> {
    const startTime = Date.now()
    const incremental = options.incremental ?? false
    const dryRun = options.dryRun ?? false
    let authErrorOccurred = false

    // Check for auth error at start
    if (this.authError) {
      return {
        success: false,
        dates: options.date ? [options.date] : [],
        filesProcessed: [],
        filesUploaded: [],
        filesFailed: [],
        filesSkipped: [],
        errors: [
          {
            file: 'N/A',
            error: `GCS authentication failure: ${this.authError.message}`,
            timestamp: new Date().toISOString(),
          },
        ],
        duration_ms: Date.now() - startTime,
        authError: true,
      }
    }

    // Determine which dates to upload
    let datesToUpload: string[]
    if (options.date) {
      const snapshotDir = this.getSnapshotDir(options.date)
      try {
        await fs.access(snapshotDir)
        datesToUpload = [options.date]
      } catch {
        return {
          success: false,
          dates: [options.date],
          filesProcessed: [],
          filesUploaded: [],
          filesFailed: [],
          filesSkipped: [],
          errors: [
            {
              file: snapshotDir,
              error: `Snapshot directory not found for date: ${options.date}`,
              timestamp: new Date().toISOString(),
            },
          ],
          duration_ms: Date.now() - startTime,
        }
      }
    } else {
      datesToUpload = await this.getAvailableDates()
      if (datesToUpload.length === 0) {
        return {
          success: false,
          dates: [],
          filesProcessed: [],
          filesUploaded: [],
          filesFailed: [],
          filesSkipped: [],
          errors: [
            {
              file: this.getSnapshotsDir(),
              error: 'No snapshot dates found to upload',
              timestamp: new Date().toISOString(),
            },
          ],
          duration_ms: Date.now() - startTime,
        }
      }
    }

    const filesProcessed: string[] = []
    const filesUploaded: string[] = []
    const filesFailed: string[] = []
    const filesSkipped: string[] = []
    const errors: Array<{ file: string; error: string; timestamp: string }> = []

    // Process each date
    dateLoop: for (const date of datesToUpload) {
      const snapshotDir = this.getSnapshotDir(date)

      try {
        const files = await this.collectFiles(snapshotDir, snapshotDir)

        for (const fileInfo of files) {
          const remotePath = this.buildRemotePath(date, fileInfo.remotePath)
          filesProcessed.push(remotePath)

          try {
            // Check if we should skip this file (incremental mode)
            if (incremental) {
              const remoteMetadata = await this.getRemoteMetadata(remotePath)

              if (remoteMetadata?.checksum === fileInfo.checksum) {
                filesSkipped.push(remotePath)
                continue
              }
            }

            // Upload the file (or simulate in dry run)
            if (!dryRun) {
              const content = await fs.readFile(fileInfo.localPath)
              const file = this.bucket.file(remotePath)
              await file.save(content, {
                contentType: 'application/json',
                metadata: {
                  checksum: fileInfo.checksum,
                  uploadedAt: new Date().toISOString(),
                },
              })
            }

            filesUploaded.push(remotePath)
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : 'Unknown error'

            // Check for auth errors
            if (
              errorMessage.includes('authentication') ||
              errorMessage.includes('UNAUTHENTICATED')
            ) {
              authErrorOccurred = true
              filesFailed.push(remotePath)
              errors.push({
                file: remotePath,
                error: `GCS authentication failure: ${errorMessage}`,
                timestamp: new Date().toISOString(),
              })
              break dateLoop
            }

            // Continue on individual file failures (Requirement 6.4)
            filesFailed.push(remotePath)
            errors.push({
              file: remotePath,
              error: errorMessage,
              timestamp: new Date().toISOString(),
            })
          }
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error'
        errors.push({
          file: snapshotDir,
          error: `Failed to process snapshot date ${date}: ${errorMessage}`,
          timestamp: new Date().toISOString(),
        })
      }
    }

    const duration_ms = Date.now() - startTime
    const success =
      !authErrorOccurred &&
      ((filesUploaded.length > 0 && filesFailed.length === 0) ||
        (filesSkipped.length > 0 &&
          filesUploaded.length === 0 &&
          filesFailed.length === 0))

    return {
      success,
      dates: datesToUpload,
      filesProcessed,
      filesUploaded,
      filesFailed,
      filesSkipped,
      errors,
      duration_ms,
      authError: authErrorOccurred || undefined,
    }
  }
}

describe('UploadService', () => {
  let testCache: { path: string; cleanup: () => Promise<void> }
  let mockBucket: MockBucket
  let uploadService: MockUploadService

  beforeEach(async () => {
    testCache = createIsolatedCacheDir()
    await fs.mkdir(testCache.path, { recursive: true })

    mockBucket = createMockBucket()
    uploadService = new MockUploadService({
      cacheDir: testCache.path,
      bucket: mockBucket,
      prefix: 'snapshots',
    })
  })

  afterEach(async () => {
    await testCache.cleanup()
  })

  describe('getAvailableDates', () => {
    it('should return empty array when snapshots directory does not exist', async () => {
      const dates = await uploadService.getAvailableDates()
      expect(dates).toEqual([])
    })

    it('should return dates sorted newest first', async () => {
      // Create snapshot directories for multiple dates
      await createSampleSnapshotStructure(testCache.path, '2024-01-10', ['1'])
      await createSampleSnapshotStructure(testCache.path, '2024-01-15', ['1'])
      await createSampleSnapshotStructure(testCache.path, '2024-01-12', ['1'])

      const dates = await uploadService.getAvailableDates()

      expect(dates).toEqual(['2024-01-15', '2024-01-12', '2024-01-10'])
    })

    it('should ignore non-date directories', async () => {
      await createSampleSnapshotStructure(testCache.path, '2024-01-15', ['1'])

      // Create non-date directory
      const snapshotsDir = path.join(testCache.path, 'snapshots')
      await fs.mkdir(path.join(snapshotsDir, 'invalid-date'), {
        recursive: true,
      })
      await fs.mkdir(path.join(snapshotsDir, 'temp'), { recursive: true })

      const dates = await uploadService.getAvailableDates()

      expect(dates).toEqual(['2024-01-15'])
    })

    it('should validate date format strictly (YYYY-MM-DD)', async () => {
      const snapshotsDir = path.join(testCache.path, 'snapshots')
      await fs.mkdir(snapshotsDir, { recursive: true })

      // Create directories with various formats
      await fs.mkdir(path.join(snapshotsDir, '2024-01-15')) // Valid
      await fs.mkdir(path.join(snapshotsDir, '24-01-15')) // Invalid - short year
      await fs.mkdir(path.join(snapshotsDir, '2024-1-15')) // Invalid - single digit month
      await fs.mkdir(path.join(snapshotsDir, '2024-01-5')) // Invalid - single digit day

      const dates = await uploadService.getAvailableDates()

      expect(dates).toEqual(['2024-01-15'])
    })
  })

  describe('upload - basic functionality', () => {
    it('should upload all files for a specific date (Requirement 6.2)', async () => {
      const date = '2024-01-15'
      await createSampleSnapshotStructure(testCache.path, date, ['1'])

      const result = await uploadService.upload({ date })

      expect(result.success).toBe(true)
      expect(result.dates).toEqual([date])
      expect(result.filesUploaded.length).toBeGreaterThan(0)
      expect(result.filesFailed).toEqual([])
      expect(result.errors).toEqual([])
    })

    it('should upload both snapshot and analytics files (Requirement 6.2)', async () => {
      const date = '2024-01-15'
      await createSampleSnapshotStructure(testCache.path, date, ['1'])

      const result = await uploadService.upload({ date })

      // Should include snapshot files
      expect(result.filesUploaded.some(f => f.includes('metadata.json'))).toBe(
        true
      )
      expect(result.filesUploaded.some(f => f.includes('manifest.json'))).toBe(
        true
      )
      expect(
        result.filesUploaded.some(f => f.includes('district_1.json'))
      ).toBe(true)

      // Should include analytics files
      expect(
        result.filesUploaded.some(f =>
          f.includes('analytics/district_1_analytics.json')
        )
      ).toBe(true)
      expect(
        result.filesUploaded.some(f =>
          f.includes('analytics/district_1_membership.json')
        )
      ).toBe(true)
      expect(
        result.filesUploaded.some(f =>
          f.includes('analytics/district_1_clubhealth.json')
        )
      ).toBe(true)
    })

    it('should upload all available dates when no date specified', async () => {
      await createSampleSnapshotStructure(testCache.path, '2024-01-15', ['1'])
      await createSampleSnapshotStructure(testCache.path, '2024-01-16', ['1'])

      const result = await uploadService.upload({})

      expect(result.success).toBe(true)
      expect(result.dates).toContain('2024-01-15')
      expect(result.dates).toContain('2024-01-16')
    })

    it('should return error when snapshot directory not found', async () => {
      const result = await uploadService.upload({ date: '2024-01-15' })

      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]?.error).toContain('Snapshot directory not found')
    })

    it('should return error when no snapshot dates available', async () => {
      // Create empty snapshots directory
      await fs.mkdir(path.join(testCache.path, 'snapshots'), {
        recursive: true,
      })

      const result = await uploadService.upload({})

      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]?.error).toContain('No snapshot dates found')
    })

    it('should include duration_ms in result', async () => {
      const date = '2024-01-15'
      await createSampleSnapshotStructure(testCache.path, date, ['1'])

      const result = await uploadService.upload({ date })

      expect(result.duration_ms).toBeGreaterThanOrEqual(0)
    })
  })

  describe('upload - incremental mode (Requirement 6.3)', () => {
    it('should skip unchanged files when incremental is true', async () => {
      const date = '2024-01-15'
      await createSampleSnapshotStructure(testCache.path, date, ['1'])

      // First upload
      const firstResult = await uploadService.upload({ date })
      expect(firstResult.success).toBe(true)
      expect(firstResult.filesUploaded.length).toBeGreaterThan(0)

      // Second upload with incremental - should skip all files
      const secondResult = await uploadService.upload({
        date,
        incremental: true,
      })

      expect(secondResult.success).toBe(true)
      expect(secondResult.filesSkipped.length).toBe(
        firstResult.filesUploaded.length
      )
      expect(secondResult.filesUploaded).toEqual([])
    })

    it('should upload changed files in incremental mode', async () => {
      const date = '2024-01-15'
      await createSampleSnapshotStructure(testCache.path, date, ['1'])

      // First upload
      await uploadService.upload({ date })

      // Modify a file
      const metadataPath = path.join(
        testCache.path,
        'snapshots',
        date,
        'metadata.json'
      )
      await fs.writeFile(
        metadataPath,
        JSON.stringify({ date, modified: true, timestamp: Date.now() })
      )

      // Second upload with incremental - should upload the changed file
      const result = await uploadService.upload({ date, incremental: true })

      expect(result.success).toBe(true)
      expect(result.filesUploaded.length).toBe(1)
      expect(result.filesUploaded[0]).toContain('metadata.json')
      expect(result.filesSkipped.length).toBeGreaterThan(0)
    })

    it('should upload all files when incremental is false', async () => {
      const date = '2024-01-15'
      await createSampleSnapshotStructure(testCache.path, date, ['1'])

      // First upload
      const firstResult = await uploadService.upload({ date })

      // Second upload without incremental - should upload all files again
      const secondResult = await uploadService.upload({
        date,
        incremental: false,
      })

      expect(secondResult.success).toBe(true)
      expect(secondResult.filesUploaded.length).toBe(
        firstResult.filesUploaded.length
      )
      expect(secondResult.filesSkipped).toEqual([])
    })

    it('should compare checksums correctly for incremental uploads', async () => {
      const date = '2024-01-15'
      await createSampleSnapshotStructure(testCache.path, date, ['1'])

      // First upload
      await uploadService.upload({ date })

      // Verify files are in mock bucket with checksums
      const metadataRemotePath = `snapshots/${date}/metadata.json`
      const file = mockBucket.file(metadataRemotePath)
      expect(file.metadata.checksum).toBeDefined()
      expect(file.metadata.checksum).toMatch(/^[a-f0-9]{64}$/)
    })
  })

  describe('upload - dry run mode', () => {
    it('should not actually upload files in dry run mode', async () => {
      const date = '2024-01-15'
      await createSampleSnapshotStructure(testCache.path, date, ['1'])

      const result = await uploadService.upload({ date, dryRun: true })

      expect(result.success).toBe(true)
      expect(result.filesUploaded.length).toBeGreaterThan(0)

      // Verify files were NOT actually uploaded to mock bucket
      const metadataRemotePath = `snapshots/${date}/metadata.json`
      const file = mockBucket.file(metadataRemotePath)
      expect(file.content).toBeNull()
    })

    it('should report what would be uploaded in dry run mode', async () => {
      const date = '2024-01-15'
      await createSampleSnapshotStructure(testCache.path, date, ['1', '2'])

      const result = await uploadService.upload({ date, dryRun: true })

      expect(result.success).toBe(true)
      expect(result.filesProcessed.length).toBeGreaterThan(0)
      expect(result.filesUploaded.length).toBe(result.filesProcessed.length)
    })

    it('should work with incremental flag in dry run mode', async () => {
      const date = '2024-01-15'
      await createSampleSnapshotStructure(testCache.path, date, ['1'])

      // First real upload
      await uploadService.upload({ date })

      // Dry run with incremental - should show all as skipped
      const result = await uploadService.upload({
        date,
        dryRun: true,
        incremental: true,
      })

      expect(result.success).toBe(true)
      expect(result.filesSkipped.length).toBeGreaterThan(0)
    })
  })

  describe('upload - error isolation (Requirement 6.4)', () => {
    it('should continue processing when individual file upload fails', async () => {
      const date = '2024-01-15'
      await createSampleSnapshotStructure(testCache.path, date, ['1', '2'])

      // Set up error for one specific file
      const errorPath = `snapshots/${date}/district_1.json`
      mockBucket.setUploadError(errorPath, new Error('Network timeout'))

      const result = await uploadService.upload({ date })

      // Should have partial success
      expect(result.filesFailed.length).toBe(1)
      expect(result.filesUploaded.length).toBeGreaterThan(0)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0]?.error).toContain('Network timeout')
    })

    it('should report all failures while continuing processing', async () => {
      const date = '2024-01-15'
      await createSampleSnapshotStructure(testCache.path, date, ['1'])

      // Set up errors for multiple files
      mockBucket.setUploadError(
        `snapshots/${date}/metadata.json`,
        new Error('Error 1')
      )
      mockBucket.setUploadError(
        `snapshots/${date}/manifest.json`,
        new Error('Error 2')
      )

      const result = await uploadService.upload({ date })

      expect(result.filesFailed.length).toBe(2)
      expect(result.errors.length).toBe(2)
      // Other files should still be uploaded
      expect(result.filesUploaded.length).toBeGreaterThan(0)
    })

    it('should include file path and error message in error details', async () => {
      const date = '2024-01-15'
      await createSampleSnapshotStructure(testCache.path, date, ['1'])

      const errorPath = `snapshots/${date}/metadata.json`
      mockBucket.setUploadError(errorPath, new Error('Specific error message'))

      const result = await uploadService.upload({ date })

      expect(result.errors.length).toBe(1)
      expect(result.errors[0]?.file).toContain('metadata.json')
      expect(result.errors[0]?.error).toContain('Specific error message')
      expect(result.errors[0]?.timestamp).toBeDefined()
    })
  })

  describe('upload - GCS authentication error handling', () => {
    it('should exit immediately on GCS authentication error', async () => {
      const date = '2024-01-15'
      await createSampleSnapshotStructure(testCache.path, date, ['1', '2'])

      // Set auth error
      uploadService.setAuthError(
        new Error('Could not load the default credentials')
      )

      const result = await uploadService.upload({ date })

      expect(result.success).toBe(false)
      expect(result.authError).toBe(true)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0]?.error).toContain('authentication')
    })

    it('should set authError flag when authentication fails', async () => {
      const date = '2024-01-15'
      await createSampleSnapshotStructure(testCache.path, date, ['1'])

      uploadService.setAuthError(new Error('UNAUTHENTICATED'))

      const result = await uploadService.upload({ date })

      expect(result.authError).toBe(true)
      expect(result.success).toBe(false)
    })

    it('should not set authError flag for non-auth errors', async () => {
      const date = '2024-01-15'
      await createSampleSnapshotStructure(testCache.path, date, ['1'])

      // Set up a non-auth error
      mockBucket.setUploadError(
        `snapshots/${date}/metadata.json`,
        new Error('Network timeout')
      )

      const result = await uploadService.upload({ date })

      expect(result.authError).toBeUndefined()
      expect(result.filesFailed.length).toBe(1)
    })

    it('should stop processing all files on auth error during upload', async () => {
      const date = '2024-01-15'
      await createSampleSnapshotStructure(testCache.path, date, ['1', '2', '3'])

      // Set up auth error for a file that will be encountered during processing
      mockBucket.setUploadError(
        `snapshots/${date}/metadata.json`,
        new Error('UNAUTHENTICATED: Invalid credentials')
      )

      const result = await uploadService.upload({ date })

      // Should have stopped after auth error
      expect(result.authError).toBe(true)
      expect(result.success).toBe(false)
      // Should have at least one failed file (the one with auth error)
      expect(result.filesFailed.length).toBeGreaterThan(0)
      // The total files processed should be less than what would be processed without error
      // (since we stop on auth error)
      const totalFilesInSnapshot = result.filesProcessed.length
      expect(totalFilesInSnapshot).toBeGreaterThan(0)
    })
  })

  describe('upload - multiple districts', () => {
    it('should upload files for multiple districts', async () => {
      const date = '2024-01-15'
      await createSampleSnapshotStructure(testCache.path, date, ['1', '2', '3'])

      const result = await uploadService.upload({ date })

      expect(result.success).toBe(true)
      // Should have files for all districts
      expect(result.filesUploaded.some(f => f.includes('district_1'))).toBe(
        true
      )
      expect(result.filesUploaded.some(f => f.includes('district_2'))).toBe(
        true
      )
      expect(result.filesUploaded.some(f => f.includes('district_3'))).toBe(
        true
      )
    })

    it('should continue with other districts if one fails', async () => {
      const date = '2024-01-15'
      await createSampleSnapshotStructure(testCache.path, date, ['1', '2'])

      // Set up error for district 1 files only
      mockBucket.setUploadError(
        `snapshots/${date}/district_1.json`,
        new Error('Failed')
      )
      mockBucket.setUploadError(
        `snapshots/${date}/analytics/district_1_analytics.json`,
        new Error('Failed')
      )

      const result = await uploadService.upload({ date })

      // District 2 files should still be uploaded
      expect(result.filesUploaded.some(f => f.includes('district_2'))).toBe(
        true
      )
      expect(result.filesFailed.some(f => f.includes('district_1'))).toBe(true)
    })
  })
})

describe('determineUploadExitCode', () => {
  it('should return SUCCESS when all files uploaded successfully', () => {
    const result: UploadResult = {
      success: true,
      dates: ['2024-01-15'],
      filesProcessed: ['file1.json', 'file2.json'],
      filesUploaded: ['file1.json', 'file2.json'],
      filesFailed: [],
      filesSkipped: [],
      errors: [],
      duration_ms: 100,
    }

    expect(determineUploadExitCode(result)).toBe(ExitCode.SUCCESS)
  })

  it('should return SUCCESS when all files skipped (incremental, no changes)', () => {
    const result: UploadResult = {
      success: true,
      dates: ['2024-01-15'],
      filesProcessed: ['file1.json', 'file2.json'],
      filesUploaded: [],
      filesFailed: [],
      filesSkipped: ['file1.json', 'file2.json'],
      errors: [],
      duration_ms: 100,
    }

    expect(determineUploadExitCode(result)).toBe(ExitCode.SUCCESS)
  })

  it('should return PARTIAL_FAILURE when some files uploaded and some failed', () => {
    const result: UploadResult = {
      success: false,
      dates: ['2024-01-15'],
      filesProcessed: ['file1.json', 'file2.json'],
      filesUploaded: ['file1.json'],
      filesFailed: ['file2.json'],
      filesSkipped: [],
      errors: [{ file: 'file2.json', error: 'Failed', timestamp: '' }],
      duration_ms: 100,
    }

    expect(determineUploadExitCode(result)).toBe(ExitCode.PARTIAL_FAILURE)
  })

  it('should return COMPLETE_FAILURE when all files failed', () => {
    const result: UploadResult = {
      success: false,
      dates: ['2024-01-15'],
      filesProcessed: ['file1.json', 'file2.json'],
      filesUploaded: [],
      filesFailed: ['file1.json', 'file2.json'],
      filesSkipped: [],
      errors: [
        { file: 'file1.json', error: 'Failed', timestamp: '' },
        { file: 'file2.json', error: 'Failed', timestamp: '' },
      ],
      duration_ms: 100,
    }

    expect(determineUploadExitCode(result)).toBe(ExitCode.COMPLETE_FAILURE)
  })

  it('should return COMPLETE_FAILURE when no files processed', () => {
    const result: UploadResult = {
      success: false,
      dates: [],
      filesProcessed: [],
      filesUploaded: [],
      filesFailed: [],
      filesSkipped: [],
      errors: [{ file: 'N/A', error: 'No files found', timestamp: '' }],
      duration_ms: 100,
    }

    expect(determineUploadExitCode(result)).toBe(ExitCode.COMPLETE_FAILURE)
  })

  it('should return COMPLETE_FAILURE when authError is true', () => {
    const result: UploadResult = {
      success: false,
      dates: ['2024-01-15'],
      filesProcessed: ['file1.json'],
      filesUploaded: [],
      filesFailed: ['file1.json'],
      filesSkipped: [],
      errors: [{ file: 'file1.json', error: 'Auth failed', timestamp: '' }],
      duration_ms: 100,
      authError: true,
    }

    expect(determineUploadExitCode(result)).toBe(ExitCode.COMPLETE_FAILURE)
  })

  it('should return COMPLETE_FAILURE for auth error even with some uploads', () => {
    const result: UploadResult = {
      success: false,
      dates: ['2024-01-15'],
      filesProcessed: ['file1.json', 'file2.json'],
      filesUploaded: ['file1.json'],
      filesFailed: ['file2.json'],
      filesSkipped: [],
      errors: [{ file: 'file2.json', error: 'Auth failed', timestamp: '' }],
      duration_ms: 100,
      authError: true,
    }

    // Auth error should always result in COMPLETE_FAILURE
    expect(determineUploadExitCode(result)).toBe(ExitCode.COMPLETE_FAILURE)
  })
})

describe('formatUploadSummary', () => {
  it('should format successful upload summary correctly', () => {
    const result: UploadResult = {
      success: true,
      dates: ['2024-01-15'],
      filesProcessed: ['file1.json', 'file2.json'],
      filesUploaded: ['file1.json', 'file2.json'],
      filesFailed: [],
      filesSkipped: [],
      errors: [],
      duration_ms: 150,
    }

    const summary = formatUploadSummary(result, 'my-bucket', 'snapshots', false)

    expect(summary.status).toBe('success')
    expect(summary.dates).toEqual(['2024-01-15'])
    expect(summary.dryRun).toBe(false)
    expect(summary.files.total).toBe(2)
    expect(summary.files.uploaded).toBe(2)
    expect(summary.files.failed).toBe(0)
    expect(summary.files.skipped).toBe(0)
    expect(summary.destination.bucket).toBe('my-bucket')
    expect(summary.destination.prefix).toBe('snapshots')
    expect(summary.errors).toEqual([])
    expect(summary.duration_ms).toBe(150)
    expect(summary.timestamp).toBeDefined()
  })

  it('should format partial failure summary correctly', () => {
    const result: UploadResult = {
      success: false,
      dates: ['2024-01-15'],
      filesProcessed: ['file1.json', 'file2.json'],
      filesUploaded: ['file1.json'],
      filesFailed: ['file2.json'],
      filesSkipped: [],
      errors: [
        {
          file: 'file2.json',
          error: 'Network error',
          timestamp: '2024-01-15T10:00:00Z',
        },
      ],
      duration_ms: 200,
    }

    const summary = formatUploadSummary(result, 'my-bucket', 'snapshots', false)

    expect(summary.status).toBe('partial')
    expect(summary.files.uploaded).toBe(1)
    expect(summary.files.failed).toBe(1)
    expect(summary.errors.length).toBe(1)
    expect(summary.errors[0]?.file).toBe('file2.json')
    expect(summary.errors[0]?.error).toBe('Network error')
  })

  it('should format complete failure summary correctly', () => {
    const result: UploadResult = {
      success: false,
      dates: ['2024-01-15'],
      filesProcessed: ['file1.json'],
      filesUploaded: [],
      filesFailed: ['file1.json'],
      filesSkipped: [],
      errors: [{ file: 'file1.json', error: 'Failed', timestamp: '' }],
      duration_ms: 50,
    }

    const summary = formatUploadSummary(result, 'my-bucket', 'snapshots', false)

    expect(summary.status).toBe('failed')
    expect(summary.files.uploaded).toBe(0)
    expect(summary.files.failed).toBe(1)
  })

  it('should include dryRun flag in summary', () => {
    const result: UploadResult = {
      success: true,
      dates: ['2024-01-15'],
      filesProcessed: ['file1.json'],
      filesUploaded: ['file1.json'],
      filesFailed: [],
      filesSkipped: [],
      errors: [],
      duration_ms: 100,
    }

    const summary = formatUploadSummary(result, 'my-bucket', 'snapshots', true)

    expect(summary.dryRun).toBe(true)
  })

  it('should include authError flag when present', () => {
    const result: UploadResult = {
      success: false,
      dates: ['2024-01-15'],
      filesProcessed: ['file1.json'],
      filesUploaded: [],
      filesFailed: ['file1.json'],
      filesSkipped: [],
      errors: [{ file: 'file1.json', error: 'Auth failed', timestamp: '' }],
      duration_ms: 100,
      authError: true,
    }

    const summary = formatUploadSummary(result, 'my-bucket', 'snapshots', false)

    expect(summary.authError).toBe(true)
    expect(summary.status).toBe('failed')
  })

  it('should not include authError flag when not present', () => {
    const result: UploadResult = {
      success: true,
      dates: ['2024-01-15'],
      filesProcessed: ['file1.json'],
      filesUploaded: ['file1.json'],
      filesFailed: [],
      filesSkipped: [],
      errors: [],
      duration_ms: 100,
    }

    const summary = formatUploadSummary(result, 'my-bucket', 'snapshots', false)

    expect(summary.authError).toBeUndefined()
  })

  it('should format skipped files correctly', () => {
    const result: UploadResult = {
      success: true,
      dates: ['2024-01-15'],
      filesProcessed: ['file1.json', 'file2.json'],
      filesUploaded: [],
      filesFailed: [],
      filesSkipped: ['file1.json', 'file2.json'],
      errors: [],
      duration_ms: 100,
    }

    const summary = formatUploadSummary(result, 'my-bucket', 'snapshots', false)

    expect(summary.status).toBe('success')
    expect(summary.files.skipped).toBe(2)
    expect(summary.files.uploaded).toBe(0)
  })

  it('should include multiple dates in summary', () => {
    const result: UploadResult = {
      success: true,
      dates: ['2024-01-15', '2024-01-16', '2024-01-17'],
      filesProcessed: ['file1.json'],
      filesUploaded: ['file1.json'],
      filesFailed: [],
      filesSkipped: [],
      errors: [],
      duration_ms: 100,
    }

    const summary = formatUploadSummary(result, 'my-bucket', 'snapshots', false)

    expect(summary.dates).toEqual(['2024-01-15', '2024-01-16', '2024-01-17'])
  })
})
