/**
 * UploadService - Uploads snapshots and analytics to Google Cloud Storage.
 *
 * This service handles uploading local snapshot and analytics files to GCS,
 * supporting incremental uploads by comparing local file checksums with
 * remote metadata.
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
 *
 * Error Handling (from design.md):
 * - Upload failure (single file): Log error, continue with others, exit code 1 (partial)
 * - GCS authentication failure: Log error, exit code 2 (complete failure)
 */

import { Storage, Bucket } from '@google-cloud/storage'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as crypto from 'crypto'
import type { Logger } from '@toastmasters/analytics-core'
import type { UploadResult } from '../types/index.js'

/**
 * Error codes that indicate GCS authentication/authorization failures.
 * These errors should cause immediate termination with exit code 2.
 */
const GCS_AUTH_ERROR_CODES = [
  'UNAUTHENTICATED',
  'PERMISSION_DENIED',
  'INVALID_ARGUMENT', // Often indicates credential issues
]

/**
 * Error message patterns that indicate authentication failures
 */
const GCS_AUTH_ERROR_PATTERNS = [
  /authentication/i,
  /credential/i,
  /permission denied/i,
  /unauthenticated/i,
  /unauthorized/i,
  /access denied/i,
  /invalid.*token/i,
  /could not load the default credentials/i,
  /application default credentials/i,
]

/**
 * Check if an error is a GCS authentication/authorization failure
 */
function isGCSAuthError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  // Check error code property (GCS errors often have this)
  const errorWithCode = error as Error & { code?: string | number }
  if (errorWithCode.code) {
    const codeStr = String(errorWithCode.code).toUpperCase()
    if (GCS_AUTH_ERROR_CODES.some(authCode => codeStr.includes(authCode))) {
      return true
    }
    // GCS uses numeric codes: 7 = PERMISSION_DENIED, 16 = UNAUTHENTICATED
    if (errorWithCode.code === 7 || errorWithCode.code === 16) {
      return true
    }
  }

  // Check error message patterns
  const message = error.message
  return GCS_AUTH_ERROR_PATTERNS.some(pattern => pattern.test(message))
}

/**
 * Configuration for UploadService
 */
export interface UploadServiceConfig {
  /** Base cache directory containing snapshots */
  cacheDir: string
  /** GCS bucket name */
  bucket: string
  /** GCS object prefix (e.g., 'snapshots') */
  prefix: string
  /** Optional GCP project ID */
  projectId?: string
  /** Optional logger for diagnostic output */
  logger?: Logger
}

/**
 * Options for upload operations
 */
export interface UploadOperationOptions {
  /** Target date in YYYY-MM-DD format, if not specified uploads all available dates */
  date?: string
  /** Only upload files that have changed (compare checksums) */
  incremental?: boolean
  /** Show what would be uploaded without actually uploading */
  dryRun?: boolean
  /** Enable verbose logging */
  verbose?: boolean
}

/**
 * Information about a file to be uploaded
 */
interface FileInfo {
  /** Local file path */
  localPath: string
  /** GCS object path */
  remotePath: string
  /** File size in bytes */
  size: number
  /** SHA256 checksum of file content */
  checksum: string
}

/**
 * Remote file metadata stored in GCS custom metadata
 */
interface RemoteFileMetadata {
  /** SHA256 checksum of the file content */
  checksum?: string
  /** Upload timestamp */
  uploadedAt?: string
}

/**
 * Default no-op logger
 */
const noopLogger: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
}

/**
 * Interface for upload service operations.
 */
export interface IUploadService {
  /**
   * Upload snapshots and analytics to GCS.
   *
   * @param options - Upload operation options
   * @returns Promise resolving to the upload result
   */
  upload(options: UploadOperationOptions): Promise<UploadResult>

  /**
   * Get available snapshot dates from local cache.
   *
   * @returns Promise resolving to array of dates in YYYY-MM-DD format
   */
  getAvailableDates(): Promise<string[]>
}

/**
 * UploadService uploads snapshots and analytics to Google Cloud Storage.
 *
 * The service uploads files from:
 *   CACHE_DIR/snapshots/{date}/
 *     ├── metadata.json
 *     ├── manifest.json
 *     ├── district_{id}.json
 *     └── analytics/
 *         ├── manifest.json
 *         ├── district_{id}_analytics.json
 *         ├── district_{id}_membership.json
 *         └── district_{id}_clubhealth.json
 *
 * To GCS with the structure:
 *   {prefix}/{date}/...
 *
 * Supports incremental uploads by comparing local checksums with remote metadata.
 */
export class UploadService implements IUploadService {
  private readonly cacheDir: string
  private readonly bucket: Bucket
  private readonly prefix: string
  private readonly logger: Logger
  private readonly storage: Storage

  constructor(config: UploadServiceConfig) {
    this.cacheDir = config.cacheDir
    this.prefix = config.prefix
    this.logger = config.logger ?? noopLogger

    // Initialize GCS client
    this.storage = new Storage({
      projectId: config.projectId,
    })
    this.bucket = this.storage.bucket(config.bucket)

    this.logger.info('UploadService initialized', {
      cacheDir: config.cacheDir,
      bucket: config.bucket,
      prefix: config.prefix,
    })
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
   *
   * @returns Array of dates in YYYY-MM-DD format, sorted newest first
   */
  async getAvailableDates(): Promise<string[]> {
    const snapshotsDir = this.getSnapshotsDir()

    try {
      const entries = await fs.readdir(snapshotsDir, { withFileTypes: true })
      const dates: string[] = []

      for (const entry of entries) {
        if (entry.isDirectory()) {
          // Validate date format (YYYY-MM-DD)
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/
          if (dateRegex.test(entry.name)) {
            dates.push(entry.name)
          }
        }
      }

      // Sort newest first
      return dates.sort().reverse()
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.logger.warn('Snapshots directory does not exist', {
          snapshotsDir,
        })
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
  ): Promise<FileInfo[]> {
    const files: FileInfo[] = []

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)

        if (entry.isDirectory()) {
          // Recursively collect files from subdirectories
          const subFiles = await this.collectFiles(fullPath, baseDir)
          files.push(...subFiles)
        } else if (entry.isFile()) {
          // Get file info
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
    } catch (error) {
      this.logger.error('Failed to collect files from directory', {
        dir,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      throw error
    }

    return files
  }

  /**
   * Get remote file metadata from GCS
   *
   * @returns Metadata if file exists, null otherwise
   */
  private async getRemoteMetadata(
    remotePath: string
  ): Promise<RemoteFileMetadata | null> {
    try {
      const file = this.bucket.file(remotePath)
      const [exists] = await file.exists()

      if (!exists) {
        return null
      }

      const [metadata] = await file.getMetadata()
      const customMetadata = metadata.metadata as Record<string, string> | undefined

      return {
        checksum: customMetadata?.['checksum'],
        uploadedAt: customMetadata?.['uploadedAt'],
      }
    } catch (error) {
      this.logger.debug('Failed to get remote metadata', {
        remotePath,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      return null
    }
  }

  /**
   * Upload a single file to GCS
   */
  private async uploadFile(
    fileInfo: FileInfo,
    date: string,
    dryRun: boolean
  ): Promise<void> {
    const remotePath = this.buildRemotePath(date, fileInfo.remotePath)

    if (dryRun) {
      this.logger.info('Would upload file (dry run)', {
        localPath: fileInfo.localPath,
        remotePath,
        size: fileInfo.size,
        checksum: fileInfo.checksum,
      })
      return
    }

    const file = this.bucket.file(remotePath)

    // Read file content
    const content = await fs.readFile(fileInfo.localPath)

    // Determine content type based on file extension
    const ext = path.extname(fileInfo.localPath).toLowerCase()
    let contentType = 'application/octet-stream'
    if (ext === '.json') {
      contentType = 'application/json'
    } else if (ext === '.csv') {
      contentType = 'text/csv'
    }

    // Upload with metadata
    await file.save(content, {
      contentType,
      metadata: {
        checksum: fileInfo.checksum,
        uploadedAt: new Date().toISOString(),
        localPath: fileInfo.remotePath,
      },
    })

    this.logger.info('File uploaded successfully', {
      localPath: fileInfo.localPath,
      remotePath,
      size: fileInfo.size,
    })
  }

  /**
   * Upload snapshots and analytics to GCS.
   *
   * Requirements:
   * - 6.2: Upload both snapshot data and pre-computed analytics files
   * - 6.3: Support incremental uploads (compare checksums)
   * - 6.4: Continue on individual file failures, but exit on auth failures
   * - 6.5: Output summary of uploaded files and errors
   *
   * Error Handling (from design.md):
   * - Upload failure (single file): Log error, continue with others, exit code 1
   * - GCS authentication failure: Log error, exit immediately, exit code 2
   */
  async upload(options: UploadOperationOptions): Promise<UploadResult> {
    const startTime = Date.now()
    const incremental = options.incremental ?? false
    const dryRun = options.dryRun ?? false
    let authError = false

    this.logger.info('Starting upload operation', {
      date: options.date ?? 'all',
      incremental,
      dryRun,
    })

    // Determine which dates to upload
    let datesToUpload: string[]
    if (options.date) {
      // Verify the specified date exists
      const snapshotDir = this.getSnapshotDir(options.date)
      try {
        await fs.access(snapshotDir)
        datesToUpload = [options.date]
      } catch {
        this.logger.error('Snapshot directory not found for date', {
          date: options.date,
          snapshotDir,
        })
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
      // Get all available dates
      datesToUpload = await this.getAvailableDates()
      if (datesToUpload.length === 0) {
        this.logger.warn('No snapshot dates found to upload')
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

      this.logger.info('Processing snapshot date', { date, snapshotDir })

      try {
        // Collect all files for this date
        const files = await this.collectFiles(snapshotDir, snapshotDir)

        for (const fileInfo of files) {
          const remotePath = this.buildRemotePath(date, fileInfo.remotePath)
          filesProcessed.push(remotePath)

          try {
            // Check if we should skip this file (incremental mode)
            if (incremental) {
              const remoteMetadata = await this.getRemoteMetadata(remotePath)

              if (
                remoteMetadata?.checksum &&
                remoteMetadata.checksum === fileInfo.checksum
              ) {
                this.logger.debug('Skipping unchanged file', {
                  localPath: fileInfo.localPath,
                  remotePath,
                  checksum: fileInfo.checksum,
                })
                filesSkipped.push(remotePath)
                continue
              }
            }

            // Upload the file
            await this.uploadFile(fileInfo, date, dryRun)

            if (dryRun) {
              // In dry run mode, count as "would be uploaded"
              filesUploaded.push(remotePath)
            } else {
              filesUploaded.push(remotePath)
            }
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : 'Unknown error'

            // Check if this is a GCS authentication/authorization failure
            // Requirement 6.4: GCS authentication failure should exit with code 2
            if (isGCSAuthError(error)) {
              this.logger.error('GCS authentication/authorization failure', {
                localPath: fileInfo.localPath,
                remotePath,
                error: errorMessage,
              })
              authError = true
              filesFailed.push(remotePath)
              errors.push({
                file: remotePath,
                error: `GCS authentication failure: ${errorMessage}`,
                timestamp: new Date().toISOString(),
              })
              // Break out of all loops - auth errors are fatal
              break dateLoop
            }

            // Requirement 6.4: Continue on individual file failures
            this.logger.error('Failed to upload file', {
              localPath: fileInfo.localPath,
              remotePath,
              error: errorMessage,
            })
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

        // Check if this is a GCS authentication/authorization failure
        if (isGCSAuthError(error)) {
          this.logger.error('GCS authentication/authorization failure during date processing', {
            date,
            error: errorMessage,
          })
          authError = true
          errors.push({
            file: snapshotDir,
            error: `GCS authentication failure: ${errorMessage}`,
            timestamp: new Date().toISOString(),
          })
          // Break out - auth errors are fatal
          break dateLoop
        }

        // Error collecting files for this date
        this.logger.error('Failed to process snapshot date', {
          date,
          error: errorMessage,
        })
        errors.push({
          file: snapshotDir,
          error: `Failed to process snapshot date ${date}: ${errorMessage}`,
          timestamp: new Date().toISOString(),
        })
      }
    }

    const duration_ms = Date.now() - startTime

    // Determine overall success
    // Success if at least one file was uploaded and no failures
    // Or if all files were skipped (nothing to do)
    // Auth errors always mean failure
    const success =
      !authError &&
      ((filesUploaded.length > 0 && filesFailed.length === 0) ||
        (filesSkipped.length > 0 &&
          filesUploaded.length === 0 &&
          filesFailed.length === 0))

    this.logger.info('Upload operation completed', {
      success,
      authError,
      dates: datesToUpload,
      filesProcessed: filesProcessed.length,
      filesUploaded: filesUploaded.length,
      filesFailed: filesFailed.length,
      filesSkipped: filesSkipped.length,
      duration_ms,
    })

    return {
      success,
      dates: datesToUpload,
      filesProcessed,
      filesUploaded,
      filesFailed,
      filesSkipped,
      errors,
      duration_ms,
      authError,
    }
  }
}
