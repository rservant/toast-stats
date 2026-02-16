/**
 * GCS Snapshot Storage Implementation
 *
 * Read-only implementation of ISnapshotStorage that reads pre-computed
 * snapshot data from a Google Cloud Storage bucket. All write and delete
 * operations throw StorageOperationError unconditionally.
 *
 * Object Path Structure:
 * {prefix}/{snapshotId}/metadata.json
 * {prefix}/{snapshotId}/manifest.json
 * {prefix}/{snapshotId}/district_{id}.json
 * {prefix}/{snapshotId}/all-districts-rankings.json
 *
 * Requirements: 1.1-1.8, 2.1-2.4, 3.1-3.4, 4.1-4.6, 5.1-5.4, 6.1-6.3, 7.1-7.3, 8.1-8.2, 9.1-9.5, 10.1-10.4
 */

import { Storage, Bucket } from '@google-cloud/storage'
import type { ZodSchema } from 'zod'
import { logger } from '../../utils/logger.js'
import { CircuitBreaker } from '../../utils/CircuitBreaker.js'
import type { ISnapshotStorage } from '../../types/storageInterfaces.js'
import { StorageOperationError } from '../../types/storageInterfaces.js'
import type {
  Snapshot,
  SnapshotMetadata,
  SnapshotFilters,
} from '../../types/snapshots.js'
import type { DistrictStatistics } from '../../types/districts.js'
import type {
  PerDistrictSnapshotMetadata,
  WriteSnapshotOptions,
} from '../SnapshotStore.js'
import type {
  SnapshotManifest,
  AllDistrictsRankingsData,
  SnapshotMetadataFile,
} from '@toastmasters/shared-contracts'
import {
  SnapshotManifestSchema,
  SnapshotMetadataFileSchema,
  PerDistrictDataSchema,
  AllDistrictsRankingsDataSchema,
} from '@toastmasters/shared-contracts'
import type { PerDistrictData } from '@toastmasters/shared-contracts'
import { adaptDistrictStatisticsFileToBackend } from '../../adapters/district-statistics-adapter.js'

// ============================================================================
// Configuration Types
// ============================================================================

export interface GCSSnapshotStorageConfig {
  projectId: string
  bucketName: string
  prefix?: string
  storage?: Storage
}

// ============================================================================
// Error Classification Helpers
// ============================================================================

interface ErrorClassification {
  retryable: boolean
  is404: boolean
}

function hasStatusCode(
  error: unknown
): error is { code: number } | { statusCode: number } {
  if (typeof error !== 'object' || error === null) return false
  const e = error as Record<string, unknown>
  return typeof e['code'] === 'number' || typeof e['statusCode'] === 'number'
}

function getStatusCode(error: unknown): number {
  const e = error as Record<string, unknown>
  return (
    typeof e['statusCode'] === 'number' ? e['statusCode'] : e['code']
  ) as number
}

function hasErrorCode(error: unknown): error is { code: string } {
  if (typeof error !== 'object' || error === null) return false
  return typeof (error as Record<string, unknown>)['code'] === 'string'
}

function getErrorCode(error: unknown): string {
  return (error as Record<string, unknown>)['code'] as string
}

// ============================================================================
// Metadata Mapping
// ============================================================================

function mapMetadataFileToPerDistrictMetadata(
  file: SnapshotMetadataFile
): PerDistrictSnapshotMetadata {
  return {
    snapshotId: file.snapshotId,
    createdAt: file.createdAt,
    schemaVersion: file.schemaVersion,
    calculationVersion: file.calculationVersion,
    status: file.status,
    configuredDistricts: file.configuredDistricts,
    successfulDistricts: file.successfulDistricts,
    failedDistricts: file.failedDistricts,
    errors: file.errors,
    processingDuration: file.processingDuration,
    source: file.source,
    dataAsOfDate: file.dataAsOfDate,
    isClosingPeriodData: file.isClosingPeriodData,
    collectionDate: file.collectionDate,
    logicalDate: file.logicalDate,
  }
}

function mapMetadataFileToSnapshotMetadata(
  file: SnapshotMetadataFile,
  manifest: SnapshotManifest | null
): SnapshotMetadata {
  return {
    snapshot_id: file.snapshotId,
    created_at: file.createdAt,
    status: file.status,
    schema_version: file.schemaVersion,
    calculation_version: file.calculationVersion,
    size_bytes: 0, // Not tracked in GCS metadata files
    error_count: file.errors.length,
    district_count:
      manifest?.totalDistricts ??
      file.successfulDistricts.length + file.failedDistricts.length,
  }
}

/**
 * Applies SnapshotFilters to a SnapshotMetadata entry.
 * Returns true if the entry passes all provided filters.
 */
function matchesFilters(
  metadata: SnapshotMetadata,
  filters: SnapshotFilters
): boolean {
  if (filters.status !== undefined && metadata.status !== filters.status) {
    return false
  }
  if (
    filters.schema_version !== undefined &&
    metadata.schema_version !== filters.schema_version
  ) {
    return false
  }
  if (
    filters.calculation_version !== undefined &&
    metadata.calculation_version !== filters.calculation_version
  ) {
    return false
  }
  if (
    filters.created_after !== undefined &&
    metadata.created_at < filters.created_after
  ) {
    return false
  }
  if (
    filters.created_before !== undefined &&
    metadata.created_at > filters.created_before
  ) {
    return false
  }
  if (
    filters.min_district_count !== undefined &&
    metadata.district_count < filters.min_district_count
  ) {
    return false
  }
  return true
}

// ============================================================================
// GCSSnapshotStorage Implementation
// ============================================================================

export class GCSSnapshotStorage implements ISnapshotStorage {
  private readonly bucket: Bucket
  private readonly prefix: string
  private readonly circuitBreaker: CircuitBreaker

  constructor(config: GCSSnapshotStorageConfig) {
    const storage =
      config.storage ?? new Storage({ projectId: config.projectId })
    this.bucket = storage.bucket(config.bucketName)
    this.prefix = config.prefix ?? 'snapshots'

    this.circuitBreaker = new CircuitBreaker('gcs-snapshot', {
      failureThreshold: 5,
      recoveryTimeout: 60000,
      monitoringPeriod: 180000,
      expectedErrors: (error: Error) => {
        const classification = this.classifyError(error)
        // Only transient infra errors count toward threshold
        if (classification.is404) return false
        if (classification.retryable) return true
        return false
      },
    })

    logger.info('GCSSnapshotStorage initialized', {
      operation: 'constructor',
      projectId: config.projectId,
      bucketName: config.bucketName,
      prefix: this.prefix,
    })
  }

  // ==========================================================================
  // Path Construction
  // ==========================================================================

  private buildObjectPath(snapshotId: string, filename: string): string {
    return `${this.prefix}/${snapshotId}/${filename}`
  }

  // ==========================================================================
  // Input Validation
  // ==========================================================================

  private validateSnapshotId(snapshotId: string): void {
    // Regex format check
    if (!/^\d{4}-\d{2}-\d{2}$/.test(snapshotId)) {
      throw new StorageOperationError(
        `Invalid snapshot ID format: "${snapshotId}". Expected YYYY-MM-DD.`,
        'validateSnapshotId',
        'gcs',
        false
      )
    }

    // Path traversal check
    if (snapshotId.includes('..') || snapshotId.includes('\\')) {
      throw new StorageOperationError(
        `Invalid snapshot ID: "${snapshotId}" contains path traversal sequences.`,
        'validateSnapshotId',
        'gcs',
        false
      )
    }

    // Unicode separator and percent-encoding check
    if (/[\u2028\u2029]/.test(snapshotId) || /%[0-9A-Fa-f]{2}/.test(snapshotId)) {
      throw new StorageOperationError(
        `Invalid snapshot ID: "${snapshotId}" contains unicode separators or percent-encoded characters.`,
        'validateSnapshotId',
        'gcs',
        false
      )
    }

    // Calendar date validation
    const [yearStr, monthStr, dayStr] = snapshotId.split('-')
    const year = Number(yearStr)
    const month = Number(monthStr)
    const day = Number(dayStr)
    const date = new Date(year, month - 1, day)

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      throw new StorageOperationError(
        `Invalid snapshot ID: "${snapshotId}" is not a valid calendar date.`,
        'validateSnapshotId',
        'gcs',
        false
      )
    }
  }

  private validateDistrictId(districtId: string): void {
    if (!districtId || districtId.trim().length === 0) {
      throw new StorageOperationError(
        'Invalid district ID: must not be empty.',
        'validateDistrictId',
        'gcs',
        false
      )
    }

    if (!/^[A-Za-z0-9]+$/.test(districtId)) {
      throw new StorageOperationError(
        `Invalid district ID: "${districtId}" must be alphanumeric only.`,
        'validateDistrictId',
        'gcs',
        false
      )
    }
  }

  // ==========================================================================
  // Error Classification
  // ==========================================================================

  private classifyError(error: unknown): ErrorClassification {
    // 1. Check structured status code (highest priority)
    if (hasStatusCode(error)) {
      const code = getStatusCode(error)
      if (code === 404) return { retryable: false, is404: true }
      if ([408, 429, 500, 502, 503, 504].includes(code))
        return { retryable: true, is404: false }
      if ([400, 401, 403].includes(code))
        return { retryable: false, is404: false }
    }

    // 2. Check string error code (network-level errors)
    if (hasErrorCode(error)) {
      const code = getErrorCode(error)
      if (
        ['ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT'].includes(code)
      ) {
        return { retryable: true, is404: false }
      }
    }

    // 3. Fallback: message pattern matching (lowest priority)
    if (error instanceof Error) {
      const msg = error.message.toLowerCase()
      if (msg.includes('not found') || msg.includes('no such object')) {
        return { retryable: false, is404: true }
      }
      const transientPatterns = [
        'network',
        'timeout',
        'unavailable',
        'deadline',
        'internal',
      ]
      if (transientPatterns.some((p) => msg.includes(p))) {
        return { retryable: true, is404: false }
      }
      const permanentPatterns = [
        'permission denied',
        'forbidden',
        'invalid argument',
      ]
      if (permanentPatterns.some((p) => msg.includes(p))) {
        return { retryable: false, is404: false }
      }
    }

    // 4. Unknown errors default to non-retryable
    return { retryable: false, is404: false }
  }

  // ==========================================================================
  // Core Read Helpers
  // ==========================================================================

  private async readObject<T>(
    objectPath: string,
    schema: ZodSchema<T>,
    operation: string
  ): Promise<T | null> {
    try {
      const content = await this.circuitBreaker.execute(async () => {
        const file = this.bucket.file(objectPath)
        const [buffer] = await file.download()
        return buffer.toString('utf-8')
      })

      // JSON parse — failure is permanent corruption, not 404
      let parsed: unknown
      try {
        parsed = JSON.parse(content)
      } catch (parseError) {
        throw new StorageOperationError(
          `Failed to parse JSON from ${objectPath}: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
          operation,
          'gcs',
          false,
          parseError instanceof Error ? parseError : undefined
        )
      }

      // Zod validation — failure is permanent, not retryable
      const result = schema.safeParse(parsed)
      if (!result.success) {
        throw new StorageOperationError(
          `Schema validation failed for ${objectPath}: ${result.error.message}`,
          operation,
          'gcs',
          false
        )
      }

      return result.data
    } catch (error) {
      // Re-throw StorageOperationError as-is
      if (error instanceof StorageOperationError) {
        throw error
      }

      const classification = this.classifyError(error)

      // 404 → return null
      if (classification.is404) {
        return null
      }

      throw new StorageOperationError(
        `GCS ${operation} failed for ${objectPath}: ${error instanceof Error ? error.message : String(error)}`,
        operation,
        'gcs',
        classification.retryable,
        error instanceof Error ? error : undefined
      )
    }
  }

  private async checkObjectExists(
    objectPath: string,
    operation: string
  ): Promise<boolean> {
    try {
      return await this.circuitBreaker.execute(async () => {
        const file = this.bucket.file(objectPath)
        const [exists] = await file.exists()
        return exists
      })
    } catch (error) {
      if (error instanceof StorageOperationError) {
        throw error
      }

      const classification = this.classifyError(error)
      throw new StorageOperationError(
        `GCS ${operation} failed for ${objectPath}: ${error instanceof Error ? error.message : String(error)}`,
        operation,
        'gcs',
        classification.retryable,
        error instanceof Error ? error : undefined
      )
    }
  }

  // ==========================================================================
  // Paginated Prefix Iteration (Async Generators)
  // ==========================================================================

  private async *iterateSnapshotPrefixes(): AsyncGenerator<string> {
    let pageToken: string | undefined
    const prefix = `${this.prefix}/`

    do {
      const [, , apiResponse] = await this.bucket.getFiles({
        prefix,
        delimiter: '/',
        maxResults: 100,
        pageToken,
        autoPaginate: false,
      })
      const prefixes: string[] =
        ((apiResponse as Record<string, unknown> | undefined)?.prefixes as string[] | undefined) ?? []
      for (const p of prefixes) {
        const snapshotId = p.replace(prefix, '').replace(/\/$/, '')
        if (snapshotId) yield snapshotId
      }
      pageToken = (apiResponse as Record<string, unknown> | undefined)
        ?.nextPageToken as string | undefined
    } while (pageToken)
  }

  private async *iterateDistrictKeys(
    snapshotId: string
  ): AsyncGenerator<string> {
    let pageToken: string | undefined
    const prefix = `${this.prefix}/${snapshotId}/district_`

    do {
      const [files, , apiResponse] = await this.bucket.getFiles({
        prefix,
        maxResults: 100,
        pageToken,
        autoPaginate: false,
      })
      for (const file of files) {
        const match = (file.name as string).match(
          /district_([A-Za-z0-9]+)\.json$/
        )
        if (match?.[1]) {
          // Validate extracted district ID before yielding
          try {
            this.validateDistrictId(match[1])
            yield match[1]
          } catch {
            // Skip invalid district IDs silently
            logger.warn('Skipping invalid district ID from GCS key', {
              operation: 'iterateDistrictKeys',
              fileName: file.name,
              extractedId: match[1],
            })
          }
        }
      }
      pageToken = (apiResponse as Record<string, unknown> | undefined)
        ?.nextPageToken as string | undefined
    } while (pageToken)
  }

  // ==========================================================================
  // Write/Delete Rejection (Read-Only Contract)
  // ==========================================================================

  async writeSnapshot(
    _snapshot: Snapshot,
    _allDistrictsRankings?: AllDistrictsRankingsData,
    _options?: WriteSnapshotOptions
  ): Promise<void> {
    throw new StorageOperationError(
      'Write operations are not supported on the read-only GCS backend.',
      'writeSnapshot',
      'gcs',
      false
    )
  }

  async writeDistrictData(
    _snapshotId: string,
    _districtId: string,
    _data: DistrictStatistics
  ): Promise<void> {
    throw new StorageOperationError(
      'Write operations are not supported on the read-only GCS backend.',
      'writeDistrictData',
      'gcs',
      false
    )
  }

  async writeAllDistrictsRankings(
    _snapshotId: string,
    _rankingsData: AllDistrictsRankingsData
  ): Promise<void> {
    throw new StorageOperationError(
      'Write operations are not supported on the read-only GCS backend.',
      'writeAllDistrictsRankings',
      'gcs',
      false
    )
  }

  async deleteSnapshot(_snapshotId: string): Promise<boolean> {
    throw new StorageOperationError(
      'Delete operations are not supported on the read-only GCS backend.',
      'deleteSnapshot',
      'gcs',
      false
    )
  }

  // ==========================================================================
  // Read Operations
  // ==========================================================================

  async getLatestSuccessful(): Promise<Snapshot | null> {
    // Requirement 1.1: Enumerate prefixes in reverse lexical order,
    // return first snapshot with status "success" and writeComplete === true
    // Requirement 10.4: Lexical string comparison for chronological ordering

    // Step 1: Collect all snapshot prefixes (bounded materialization — short strings only)
    const snapshotIds: string[] = []
    for await (const id of this.iterateSnapshotPrefixes()) {
      snapshotIds.push(id)
    }

    // Step 2: Sort in reverse lexical order (newest first)
    snapshotIds.sort((a, b) => b.localeCompare(a))

    // Step 3: Iterate and find first qualifying snapshot
    for (const snapshotId of snapshotIds) {
      // Step 3a: Read metadata, check status === "success"
      const metadataPath = this.buildObjectPath(snapshotId, 'metadata.json')
      const metadataFile = await this.readObject<SnapshotMetadataFile>(
        metadataPath,
        SnapshotMetadataFileSchema,
        'getLatestSuccessful'
      )

      if (metadataFile === null || metadataFile.status !== 'success') {
        continue
      }

      // Step 3b: Check writeComplete (Requirement 9.5)
      const writeComplete = await this.isSnapshotWriteComplete(snapshotId)
      if (!writeComplete) {
        continue
      }

      // Step 3c: Assemble full Snapshot via getSnapshot
      const snapshot = await this.getSnapshot(snapshotId)
      if (snapshot !== null) {
        return snapshot
      }
    }

    // Step 4: No qualifying snapshot found
    return null
  }

  async getLatest(): Promise<Snapshot | null> {
    // Same algorithm as getLatestSuccessful but skip status check
    // Requirement 9.5: Still check writeComplete
    // Requirement 10.4: Lexical string comparison for chronological ordering

    // Step 1: Collect all snapshot prefixes
    const snapshotIds: string[] = []
    for await (const id of this.iterateSnapshotPrefixes()) {
      snapshotIds.push(id)
    }

    // Step 2: Sort in reverse lexical order (newest first)
    snapshotIds.sort((a, b) => b.localeCompare(a))

    // Step 3: Iterate and find first writeComplete snapshot (no status check)
    for (const snapshotId of snapshotIds) {
      // Check writeComplete (Requirement 9.5)
      const writeComplete = await this.isSnapshotWriteComplete(snapshotId)
      if (!writeComplete) {
        continue
      }

      // Assemble full Snapshot via getSnapshot
      const snapshot = await this.getSnapshot(snapshotId)
      if (snapshot !== null) {
        return snapshot
      }
    }

    // No qualifying snapshot found
    return null
  }

  async getSnapshot(snapshotId: string): Promise<Snapshot | null> {
      this.validateSnapshotId(snapshotId)

      // Step 1: Read manifest once, check writeComplete
      const manifestPath = this.buildObjectPath(snapshotId, 'manifest.json')
      const manifest = await this.readObject<SnapshotManifest>(
        manifestPath,
        SnapshotManifestSchema,
        'getSnapshot'
      )

      if (manifest === null) {
        return null
      }

      if (manifest.writeComplete !== true) {
        logger.info('Snapshot manifest writeComplete is not true, skipping', {
          operation: 'getSnapshot',
          snapshot_id: snapshotId,
        })
        return null
      }

      // Step 2: Read metadata
      const metadataPath = this.buildObjectPath(snapshotId, 'metadata.json')
      const metadataFile = await this.readObject<SnapshotMetadataFile>(
        metadataPath,
        SnapshotMetadataFileSchema,
        'getSnapshot'
      )

      if (metadataFile === null) {
        return null
      }

      // Step 3: Read all district files where status === "success"
      const districts: DistrictStatistics[] = []
      for (const entry of manifest.districts) {
        if (entry.status !== 'success') {
          continue
        }

        const districtPath = this.buildObjectPath(
          snapshotId,
          `district_${entry.districtId}.json`
        )
        const perDistrictData = await this.readObject<PerDistrictData>(
          districtPath,
          PerDistrictDataSchema,
          'getSnapshot'
        )

        if (perDistrictData !== null) {
          districts.push(
            adaptDistrictStatisticsFileToBackend(perDistrictData.data)
          )
        }
      }

      // Step 4: Re-read manifest to confirm writeComplete still true
      const reReadManifest = await this.readObject<SnapshotManifest>(
        manifestPath,
        SnapshotManifestSchema,
        'getSnapshot'
      )

      if (reReadManifest === null || reReadManifest.writeComplete !== true) {
        logger.info(
          'Snapshot writeComplete changed during read, discarding snapshot',
          {
            operation: 'getSnapshot',
            snapshot_id: snapshotId,
          }
        )
        return null
      }

      // Step 5: Assemble Snapshot object
      const snapshot: Snapshot = {
        snapshot_id: snapshotId,
        created_at: metadataFile.createdAt,
        schema_version: metadataFile.schemaVersion,
        calculation_version: metadataFile.calculationVersion,
        status: metadataFile.status,
        errors: metadataFile.errors,
        payload: {
          districts,
          metadata: {
            source: metadataFile.source,
            fetchedAt: metadataFile.createdAt,
            dataAsOfDate: metadataFile.dataAsOfDate,
            districtCount: districts.length,
            processingDurationMs: metadataFile.processingDuration,
            configuredDistricts: metadataFile.configuredDistricts,
            successfulDistricts: metadataFile.successfulDistricts,
            failedDistricts: metadataFile.failedDistricts,
            isClosingPeriodData: metadataFile.isClosingPeriodData,
            collectionDate: metadataFile.collectionDate,
            logicalDate: metadataFile.logicalDate,
          },
        },
      }

      return snapshot
    }


  async listSnapshots(
    limit?: number,
    filters?: SnapshotFilters
  ): Promise<SnapshotMetadata[]> {
    // Requirement 1.7: Enumerate prefixes, read metadata, apply filters, return sorted
    // Requirement 10.2: Short-circuit at limit
    // Requirement 10.4: Reverse lexical ordering (newest first)

    // Step 1: Collect all snapshot prefixes (bounded materialization)
    const snapshotIds: string[] = []
    for await (const id of this.iterateSnapshotPrefixes()) {
      snapshotIds.push(id)
    }

    // Step 2: Sort in reverse lexical order (newest first)
    snapshotIds.sort((a, b) => b.localeCompare(a))

    // Step 3: Read metadata for each, apply filters, collect up to limit
    const results: SnapshotMetadata[] = []
    for (const snapshotId of snapshotIds) {
      const metadataPath = this.buildObjectPath(snapshotId, 'metadata.json')
      const metadataFile = await this.readObject<SnapshotMetadataFile>(
        metadataPath,
        SnapshotMetadataFileSchema,
        'listSnapshots'
      )

      if (metadataFile === null) {
        continue
      }

      // Map to SnapshotMetadata — do NOT read manifest (performance, Req 10.2)
      const snapshotMetadata = mapMetadataFileToSnapshotMetadata(
        metadataFile,
        null
      )

      // Apply filters if provided
      if (filters !== undefined && !matchesFilters(snapshotMetadata, filters)) {
        continue
      }

      results.push(snapshotMetadata)

      // Short-circuit at limit (Requirement 10.2)
      if (limit !== undefined && results.length >= limit) {
        break
      }
    }

    return results
  }

  async readDistrictData(
    snapshotId: string,
    districtId: string
  ): Promise<DistrictStatistics | null> {
    this.validateSnapshotId(snapshotId)
    this.validateDistrictId(districtId)
    const objectPath = this.buildObjectPath(snapshotId, `district_${districtId}.json`)
    const perDistrictData = await this.readObject<PerDistrictData>(
      objectPath,
      PerDistrictDataSchema,
      'readDistrictData'
    )

    if (perDistrictData === null) {
      return null
    }

    return adaptDistrictStatisticsFileToBackend(perDistrictData.data)
  }

  async listDistrictsInSnapshot(snapshotId: string): Promise<string[]> {
      this.validateSnapshotId(snapshotId)
      const districtIds: string[] = []
      for await (const districtId of this.iterateDistrictKeys(snapshotId)) {
        districtIds.push(districtId)
      }
      return districtIds
    }

  async getSnapshotManifest(
    snapshotId: string
  ): Promise<SnapshotManifest | null> {
    this.validateSnapshotId(snapshotId)
    const objectPath = this.buildObjectPath(snapshotId, 'manifest.json')
    return this.readObject<SnapshotManifest>(
      objectPath,
      SnapshotManifestSchema,
      'getSnapshotManifest'
    )
  }

  async getSnapshotMetadata(
    snapshotId: string
  ): Promise<PerDistrictSnapshotMetadata | null> {
    this.validateSnapshotId(snapshotId)
    const objectPath = this.buildObjectPath(snapshotId, 'metadata.json')
    const metadataFile = await this.readObject<SnapshotMetadataFile>(
      objectPath,
      SnapshotMetadataFileSchema,
      'getSnapshotMetadata'
    )

    if (metadataFile === null) {
      return null
    }

    return mapMetadataFileToPerDistrictMetadata(metadataFile)
  }

  async readAllDistrictsRankings(
    snapshotId: string
  ): Promise<AllDistrictsRankingsData | null> {
    this.validateSnapshotId(snapshotId)

    const writeComplete = await this.isSnapshotWriteComplete(snapshotId)
    if (!writeComplete) {
      return null
    }

    const objectPath = this.buildObjectPath(
      snapshotId,
      'all-districts-rankings.json'
    )
    return this.readObject<AllDistrictsRankingsData>(
      objectPath,
      AllDistrictsRankingsDataSchema,
      'readAllDistrictsRankings'
    )
  }

  async hasAllDistrictsRankings(snapshotId: string): Promise<boolean> {
    this.validateSnapshotId(snapshotId)
    const objectPath = this.buildObjectPath(
      snapshotId,
      'all-districts-rankings.json'
    )
    return this.checkObjectExists(objectPath, 'hasAllDistrictsRankings')
  }

  async isSnapshotWriteComplete(snapshotId: string): Promise<boolean> {
      this.validateSnapshotId(snapshotId)
      const objectPath = this.buildObjectPath(snapshotId, 'manifest.json')
      const manifest = await this.readObject<SnapshotManifest>(
        objectPath,
        SnapshotManifestSchema,
        'isSnapshotWriteComplete'
      )

      if (manifest === null) {
        return false
      }

      return manifest.writeComplete === true
    }

  async isReady(): Promise<boolean> {
      try {
        await this.bucket.getFiles({
          prefix: `${this.prefix}/`,
          delimiter: '/',
          maxResults: 1,
          autoPaginate: false,
        })
        return true
      } catch {
        return false
      }
    }
}
