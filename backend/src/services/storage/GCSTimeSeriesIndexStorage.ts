/**
 * GCS Time-Series Index Storage Implementation
 *
 * Implements the ITimeSeriesIndexStorage interface using Google Cloud Storage.
 * Reads pre-computed time-series data from JSON files in the bucket.
 *
 * File Structure in GCS:
 *   gs://{bucket}/time-series/district_{id}/{programYear}.json
 *
 * Example:
 *   gs://toast-stats-data/time-series/district_42/2023-2024.json
 */

import { Storage } from '@google-cloud/storage'
import type { Bucket } from '@google-cloud/storage'
import type { ITimeSeriesIndexStorage } from '../../types/storageInterfaces.js'
import { StorageOperationError } from '../../types/storageInterfaces.js'
import type {
  TimeSeriesDataPoint,
  ProgramYearIndex,
  ProgramYearIndexFile,
} from '../../types/precomputedAnalytics.js'
import { logger } from '../../utils/logger.js'
import { CircuitBreaker } from '../../utils/CircuitBreaker.js'

// ============================================================================
// Configuration Types
// ============================================================================

export interface GCSTimeSeriesIndexStorageConfig {
  projectId: string
  bucketName: string
  prefix?: string
  storage?: Storage
}

// ============================================================================
// Error Classification
// ============================================================================

interface ErrorClassification {
  retryable: boolean
  is404: boolean
}

function getStatusCode(error: unknown): number {
  if (error && typeof error === 'object') {
    if (
      'code' in error &&
      typeof (error as { code: unknown }).code === 'number'
    )
      return (error as { code: number }).code
    if (
      'statusCode' in error &&
      typeof (error as { statusCode: unknown }).statusCode === 'number'
    )
      return (error as { statusCode: number }).statusCode
  }
  return 0
}

function getErrorCode(error: unknown): string {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  )
    return (error as { code: string }).code
  return ''
}

// ============================================================================
// Validation Patterns
// ============================================================================

const VALID_DISTRICT_ID_PATTERN = /^[A-Za-z0-9]+$/
const VALID_PROGRAM_YEAR_PATTERN = /^\d{4}-\d{4}$/

// ============================================================================
// GCSTimeSeriesIndexStorage Implementation
// ============================================================================

export class GCSTimeSeriesIndexStorage implements ITimeSeriesIndexStorage {
  private readonly bucket: Bucket
  private readonly prefix: string
  private readonly circuitBreaker: CircuitBreaker

  constructor(config: GCSTimeSeriesIndexStorageConfig) {
    const storage =
      config.storage ?? new Storage({ projectId: config.projectId })
    this.bucket = storage.bucket(config.bucketName)
    this.prefix = config.prefix ?? 'time-series'

    this.circuitBreaker = new CircuitBreaker('gcs-time-series', {
      failureThreshold: 5,
      recoveryTimeout: 60000,
      monitoringPeriod: 180000,
      expectedErrors: (error: Error) => {
        const classification = this.classifyError(error)
        if (classification.is404) return false
        if (classification.retryable) return true
        return false
      },
    })

    logger.info('GCSTimeSeriesIndexStorage initialized', {
      operation: 'constructor',
      projectId: config.projectId,
      bucketName: config.bucketName,
      prefix: this.prefix,
    })
  }

  // ============================================================================
  // Core Time-Series Operations
  // ============================================================================

  async getTrendData(
    districtId: string,
    startDate: string,
    endDate: string
  ): Promise<TimeSeriesDataPoint[]> {
    const operationId = `trend_${Date.now()}`

    try {
      this.validateDistrictId(districtId)

      const programYears = this.getProgramYearsInRange(startDate, endDate)
      const allDataPoints: TimeSeriesDataPoint[] = []

      for (const programYear of programYears) {
        const indexFile = await this.readProgramYearIndex(
          districtId,
          programYear
        )

        if (indexFile) {
          const filteredPoints = indexFile.dataPoints.filter(
            dp => dp.date >= startDate && dp.date <= endDate
          )
          allDataPoints.push(...filteredPoints)
        }
      }

      allDataPoints.sort((a, b) => a.date.localeCompare(b.date))

      logger.info('Retrieved trend data from GCS', {
        operation: 'getTrendData',
        operationId,
        districtId,
        startDate,
        endDate,
        programYearsQueried: programYears.length,
        dataPointsReturned: allDataPoints.length,
      })

      return allDataPoints
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      if (errorMessage.includes('Invalid district ID')) {
        logger.debug('No trend data available', {
          operation: 'getTrendData',
          operationId,
          districtId,
          reason: errorMessage,
        })
      } else {
        logger.error('Failed to get trend data from GCS', {
          operation: 'getTrendData',
          operationId,
          districtId,
          error: errorMessage,
        })
      }

      return []
    }
  }

  async getProgramYearData(
    districtId: string,
    programYear: string
  ): Promise<ProgramYearIndex | null> {
    try {
      this.validateDistrictId(districtId)
      this.validateProgramYear(programYear)

      const indexFile = await this.readProgramYearIndex(districtId, programYear)
      if (!indexFile) return null

      // Convert ProgramYearIndexFile to ProgramYearIndex
      return {
        programYear: indexFile.programYear,
        startDate: indexFile.startDate,
        endDate: indexFile.endDate,
        dataPoints: indexFile.dataPoints,
        lastUpdated: indexFile.lastUpdated,
      }
    } catch (error) {
      if (error instanceof StorageOperationError) throw error

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to get program year data from GCS', {
        operation: 'getProgramYearData',
        districtId,
        programYear,
        error: errorMessage,
      })

      return null
    }
  }

  // ============================================================================
  // Deletion Operations
  // ============================================================================

  async deleteSnapshotEntries(snapshotId: string): Promise<number> {
    let totalRemoved = 0

    try {
      // List all district directories by listing objects with the prefix
      const [files] = await this.bucket.getFiles({
        prefix: `${this.prefix}/district_`,
      })

      // Group files by district
      const districtFiles = new Map<string, string[]>()
      for (const file of files) {
        const match = file.name.match(
          new RegExp(`^${this.prefix}/district_([^/]+)/(.+\\.json)$`)
        )
        if (match) {
          const districtId = match[1]!
          const existing = districtFiles.get(districtId) ?? []
          existing.push(file.name)
          districtFiles.set(districtId, existing)
        }
      }

      // Process each district's files
      for (const [districtId, filePaths] of districtFiles) {
        for (const filePath of filePaths) {
          const removed = await this.deleteSnapshotEntriesFromFile(
            filePath,
            snapshotId,
            districtId
          )
          totalRemoved += removed
        }
      }

      logger.info('Deleted snapshot entries from GCS time-series', {
        operation: 'deleteSnapshotEntries',
        snapshotId,
        totalRemoved,
      })

      return totalRemoved
    } catch (error) {
      if (error instanceof StorageOperationError) throw error

      throw new StorageOperationError(
        `Failed to delete snapshot entries: ${error instanceof Error ? error.message : String(error)}`,
        'deleteSnapshotEntries',
        'gcs',
        false,
        error instanceof Error ? error : undefined
      )
    }
  }

  // ============================================================================
  // Health Check
  // ============================================================================

  async isReady(): Promise<boolean> {
    try {
      const [exists] = await this.bucket.exists()
      return exists
    } catch (error) {
      logger.warn('GCS time-series storage ready check failed', {
        error: error instanceof Error ? error.message : String(error),
        provider: 'gcs',
        operation: 'isReady',
      })
      return false
    }
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private async readProgramYearIndex(
    districtId: string,
    programYear: string
  ): Promise<ProgramYearIndexFile | null> {
    const objectPath = `${this.prefix}/district_${districtId}/${programYear}.json`

    try {
      const content = await this.circuitBreaker.execute(async () => {
        const file = this.bucket.file(objectPath)
        const [buffer] = await file.download()
        return buffer.toString('utf-8')
      })

      const indexFile: ProgramYearIndexFile = JSON.parse(content)

      logger.debug('Read program year index from GCS', {
        operation: 'readProgramYearIndex',
        districtId,
        programYear,
        objectPath,
        dataPointCount: indexFile.dataPoints.length,
      })

      return indexFile
    } catch (error) {
      const classification = this.classifyError(error)

      if (classification.is404) {
        logger.debug('Program year index not found in GCS', {
          operation: 'readProgramYearIndex',
          districtId,
          programYear,
          objectPath,
        })
        return null
      }

      logger.error('Failed to read program year index from GCS', {
        operation: 'readProgramYearIndex',
        districtId,
        programYear,
        objectPath,
        error: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }

  private async deleteSnapshotEntriesFromFile(
    objectPath: string,
    snapshotId: string,
    districtId: string
  ): Promise<number> {
    try {
      const content = await this.circuitBreaker.execute(async () => {
        const file = this.bucket.file(objectPath)
        const [buffer] = await file.download()
        return buffer.toString('utf-8')
      })

      const indexFile: ProgramYearIndexFile = JSON.parse(content)
      const originalCount = indexFile.dataPoints.length
      indexFile.dataPoints = indexFile.dataPoints.filter(
        dp => dp.snapshotId !== snapshotId
      )
      const removed = originalCount - indexFile.dataPoints.length

      if (removed > 0) {
        // Write back the updated file
        await this.circuitBreaker.execute(async () => {
          const file = this.bucket.file(objectPath)
          await file.save(JSON.stringify(indexFile, null, 2), {
            contentType: 'application/json',
          })
        })

        logger.debug('Removed snapshot entries from GCS time-series file', {
          operation: 'deleteSnapshotEntriesFromFile',
          objectPath,
          snapshotId,
          districtId,
          removed,
        })
      }

      return removed
    } catch (error) {
      const classification = this.classifyError(error)
      if (classification.is404) return 0
      throw error
    }
  }

  // ── Program Year Logic (reused from TimeSeriesIndexService) ──

  private getProgramYearForDate(dateStr: string): string {
    const parts = dateStr.split('-')
    const year = parseInt(parts[0] ?? '0', 10)
    const month = parseInt(parts[1] ?? '0', 10)

    if (month >= 7) {
      return `${year}-${year + 1}`
    } else {
      return `${year - 1}-${year}`
    }
  }

  private getProgramYearsInRange(startDate: string, endDate: string): string[] {
    const programYears: string[] = []

    const startProgramYear = this.getProgramYearForDate(startDate)
    const endProgramYear = this.getProgramYearForDate(endDate)

    const startYearNum = parseInt(startProgramYear.split('-')[0] ?? '0', 10)
    const endYearNum = parseInt(endProgramYear.split('-')[0] ?? '0', 10)

    for (let year = startYearNum; year <= endYearNum; year++) {
      programYears.push(`${year}-${year + 1}`)
    }

    return programYears
  }

  private validateDistrictId(districtId: string): void {
    if (!districtId || !VALID_DISTRICT_ID_PATTERN.test(districtId)) {
      throw new Error(`Invalid district ID: "${districtId}"`)
    }
  }

  private validateProgramYear(programYear: string): void {
    if (!programYear || !VALID_PROGRAM_YEAR_PATTERN.test(programYear)) {
      throw new Error(`Invalid program year: "${programYear}"`)
    }
  }

  private classifyError(error: unknown): ErrorClassification {
    const statusCode = getStatusCode(error)
    if (statusCode === 404) return { retryable: false, is404: true }
    if ([408, 429, 500, 502, 503, 504].includes(statusCode))
      return { retryable: true, is404: false }
    if ([400, 401, 403].includes(statusCode))
      return { retryable: false, is404: false }

    const errorCode = getErrorCode(error)
    if (
      ['ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT'].includes(
        errorCode
      )
    )
      return { retryable: true, is404: false }

    if (error instanceof Error) {
      const msg = error.message.toLowerCase()
      if (msg.includes('not found') || msg.includes('no such object'))
        return { retryable: false, is404: true }
      if (
        ['network', 'timeout', 'unavailable', 'deadline'].some(p =>
          msg.includes(p)
        )
      )
        return { retryable: true, is404: false }
    }

    return { retryable: false, is404: false }
  }
}
