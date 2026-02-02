/**
 * Firestore Time-Series Index Storage Implementation
 *
 * Implements the ITimeSeriesIndexStorage interface using Google Cloud Firestore
 * for storing time-series data in a document database.
 *
 * Document Structure:
 * Collection: time-series (configurable)
 * Document ID: {districtId}
 *
 * Subcollection: program-years
 * Document ID: {programYear} (e.g., "2023-2024")
 * {
 *   districtId: string,
 *   programYear: string,
 *   startDate: string,
 *   endDate: string,
 *   lastUpdated: string,
 *   dataPoints: TimeSeriesDataPoint[],
 *   summary: ProgramYearSummary
 * }
 *
 * Requirements: 4.5
 */

import {
  Firestore,
  CollectionReference,
  DocumentReference,
} from '@google-cloud/firestore'
import { logger } from '../../utils/logger.js'
import { CircuitBreaker } from '../../utils/CircuitBreaker.js'
import type { ITimeSeriesIndexStorage } from '../../types/storageInterfaces.js'
import { StorageOperationError } from '../../types/storageInterfaces.js'
import type {
  TimeSeriesDataPoint,
  ProgramYearIndex,
  ProgramYearSummary,
} from '../../types/precomputedAnalytics.js'

// ============================================================================
// Firestore Document Types
// ============================================================================

/**
 * Program year document structure in Firestore
 */
interface FirestoreProgramYearDocument {
  districtId: string
  programYear: string
  startDate: string
  endDate: string
  lastUpdated: string
  dataPoints: TimeSeriesDataPoint[]
  summary: ProgramYearSummary
}

/**
 * Configuration for FirestoreTimeSeriesIndexStorage
 */
export interface FirestoreTimeSeriesIndexStorageConfig {
  projectId: string
  collectionName?: string // defaults to 'time-series'
}

// ============================================================================
// Validation Patterns
// ============================================================================

/**
 * Pattern for valid district IDs - only alphanumeric characters allowed
 */
const VALID_DISTRICT_ID_PATTERN = /^[A-Za-z0-9]+$/

/**
 * Pattern for valid program year format (e.g., "2023-2024")
 */
const VALID_PROGRAM_YEAR_PATTERN = /^\d{4}-\d{4}$/

/**
 * Pattern for valid ISO date format (YYYY-MM-DD)
 */
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

// ============================================================================
// FirestoreTimeSeriesIndexStorage Implementation
// ============================================================================

/**
 * Cloud Firestore time-series index storage implementation
 *
 * Stores time-series data in Firestore with the following structure:
 * - Root collection contains district documents
 * - Each district has a 'program-years' subcollection
 * - Program year documents contain dataPoints array and metadata
 *
 * Features:
 * - Circuit breaker integration for resilience
 * - Proper error handling with StorageOperationError
 * - Efficient batched deletes for snapshot entry removal
 * - Program year partitioning for scalable data storage
 *
 * Requirements: 4.5
 */
export class FirestoreTimeSeriesIndexStorage implements ITimeSeriesIndexStorage {
  private readonly firestore: Firestore
  private readonly collectionName: string
  private readonly circuitBreaker: CircuitBreaker

  /**
   * Creates a new FirestoreTimeSeriesIndexStorage instance
   *
   * @param config - Configuration containing projectId and optional collectionName
   */
  constructor(config: FirestoreTimeSeriesIndexStorageConfig) {
    this.firestore = new Firestore({
      projectId: config.projectId,
    })
    this.collectionName = config.collectionName ?? 'time-series'
    this.circuitBreaker = CircuitBreaker.createCacheCircuitBreaker(
      'firestore-timeseries'
    )

    logger.info('FirestoreTimeSeriesIndexStorage initialized', {
      operation: 'constructor',
      projectId: config.projectId,
      collectionName: this.collectionName,
    })
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Get the time-series collection reference
   */
  private get timeSeriesCollection(): CollectionReference {
    return this.firestore.collection(this.collectionName)
  }

  /**
   * Get a district document reference
   */
  private getDistrictDocRef(districtId: string): DocumentReference {
    return this.timeSeriesCollection.doc(districtId)
  }

  /**
   * Get the program-years subcollection for a district
   */
  private getProgramYearsCollection(districtId: string): CollectionReference {
    return this.getDistrictDocRef(districtId).collection('program-years')
  }

  /**
   * Get a program year document reference
   */
  private getProgramYearDocRef(
    districtId: string,
    programYear: string
  ): DocumentReference {
    return this.getProgramYearsCollection(districtId).doc(programYear)
  }

  /**
   * Validate district ID format
   */
  private validateDistrictId(districtId: string): void {
    if (typeof districtId !== 'string' || districtId.length === 0) {
      throw new StorageOperationError(
        'Invalid district ID: empty or non-string value',
        'validateDistrictId',
        'firestore',
        false
      )
    }

    if (!VALID_DISTRICT_ID_PATTERN.test(districtId)) {
      throw new StorageOperationError(
        `Invalid district ID format: ${districtId}. Only alphanumeric characters allowed`,
        'validateDistrictId',
        'firestore',
        false
      )
    }
  }

  /**
   * Validate program year format
   */
  private validateProgramYear(programYear: string): void {
    if (!VALID_PROGRAM_YEAR_PATTERN.test(programYear)) {
      throw new StorageOperationError(
        `Invalid program year format: ${programYear}. Expected YYYY-YYYY (e.g., "2023-2024")`,
        'validateProgramYear',
        'firestore',
        false
      )
    }

    const parts = programYear.split('-')
    const startYear = parseInt(parts[0] ?? '0', 10)
    const endYear = parseInt(parts[1] ?? '0', 10)

    if (endYear !== startYear + 1) {
      throw new StorageOperationError(
        `Invalid program year: ${programYear}. End year must be start year + 1`,
        'validateProgramYear',
        'firestore',
        false
      )
    }
  }

  /**
   * Validate date format (YYYY-MM-DD)
   */
  private validateDate(date: string, fieldName: string): void {
    if (typeof date !== 'string' || !ISO_DATE_PATTERN.test(date)) {
      throw new StorageOperationError(
        `Invalid ${fieldName} format: ${date}. Expected YYYY-MM-DD`,
        'validateDate',
        'firestore',
        false
      )
    }
  }

  /**
   * Determine if an error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      // Network errors, timeouts, and server errors are retryable
      return (
        message.includes('network') ||
        message.includes('timeout') ||
        message.includes('unavailable') ||
        message.includes('deadline') ||
        message.includes('internal') ||
        message.includes('aborted')
      )
    }
    return false
  }

  /**
   * Get the program year for a given date
   *
   * Toastmasters program years run from July 1 to June 30.
   * For example:
   * - 2023-07-01 to 2024-06-30 is program year "2023-2024"
   * - 2024-01-15 is in program year "2023-2024"
   * - 2024-07-01 is in program year "2024-2025"
   *
   * @param dateStr - Date string in YYYY-MM-DD format
   * @returns Program year string (e.g., "2023-2024")
   */
  private getProgramYearForDate(dateStr: string): string {
    const parts = dateStr.split('-')
    const year = parseInt(parts[0] ?? '0', 10)
    const month = parseInt(parts[1] ?? '0', 10)

    // If month is July (7) or later, program year starts this year
    // If month is before July, program year started last year
    if (month >= 7) {
      return `${year}-${year + 1}`
    } else {
      return `${year - 1}-${year}`
    }
  }

  /**
   * Get all program years that overlap with a date range
   *
   * @param startDate - Start date in YYYY-MM-DD format
   * @param endDate - End date in YYYY-MM-DD format
   * @returns Array of program year strings
   */
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

  // ============================================================================
  // Core Time-Series Operations (Read-Only)
  // ============================================================================

  /**
   * Get trend data for a date range
   *
   * Retrieves all time-series data points for a district within the
   * specified date range (inclusive). Results are returned in
   * chronological order.
   *
   * @param districtId - The district identifier (e.g., "42", "61", "F")
   * @param startDate - Start date in ISO format (YYYY-MM-DD)
   * @param endDate - End date in ISO format (YYYY-MM-DD)
   * @returns Array of time-series data points in chronological order
   * @throws StorageOperationError on read failure
   */
  async getTrendData(
    districtId: string,
    startDate: string,
    endDate: string
  ): Promise<TimeSeriesDataPoint[]> {
    const startTime = Date.now()
    this.validateDistrictId(districtId)
    this.validateDate(startDate, 'startDate')
    this.validateDate(endDate, 'endDate')

    const programYears = this.getProgramYearsInRange(startDate, endDate)

    logger.info('Starting getTrendData operation', {
      operation: 'getTrendData',
      districtId,
      startDate,
      endDate,
      programYears,
    })

    try {
      return await this.circuitBreaker.execute(
        async () => {
          const allDataPoints: TimeSeriesDataPoint[] = []

          // Query each program year that overlaps with the date range
          for (const programYear of programYears) {
            const programYearDocRef = this.getProgramYearDocRef(
              districtId,
              programYear
            )
            const docSnapshot = await programYearDocRef.get()

            if (docSnapshot.exists) {
              const doc = docSnapshot.data() as FirestoreProgramYearDocument

              // Filter data points within the date range
              const filteredPoints = doc.dataPoints.filter(
                dp => dp.date >= startDate && dp.date <= endDate
              )
              allDataPoints.push(...filteredPoints)
            }
          }

          // Sort by date (should already be sorted, but ensure consistency)
          allDataPoints.sort((a, b) => a.date.localeCompare(b.date))

          logger.info('Successfully retrieved trend data', {
            operation: 'getTrendData',
            districtId,
            startDate,
            endDate,
            programYearsQueried: programYears.length,
            dataPointsReturned: allDataPoints.length,
            duration_ms: Date.now() - startTime,
          })

          return allDataPoints
        },
        { operation: 'getTrendData', districtId, startDate, endDate }
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to get trend data', {
        operation: 'getTrendData',
        districtId,
        startDate,
        endDate,
        error: errorMessage,
        duration_ms: Date.now() - startTime,
      })

      throw new StorageOperationError(
        `Failed to get trend data for district ${districtId}: ${errorMessage}`,
        'getTrendData',
        'firestore',
        this.isRetryableError(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Get all data for a program year
   *
   * Retrieves the complete program year index for a district, including
   * all data points and summary statistics. Returns null if no data
   * exists for the specified program year.
   *
   * @param districtId - The district identifier (e.g., "42", "61", "F")
   * @param programYear - Program year identifier (e.g., "2023-2024")
   * @returns Program year index or null if not found
   * @throws StorageOperationError on read failure
   */
  async getProgramYearData(
    districtId: string,
    programYear: string
  ): Promise<ProgramYearIndex | null> {
    const startTime = Date.now()
    this.validateDistrictId(districtId)
    this.validateProgramYear(programYear)

    logger.info('Starting getProgramYearData operation', {
      operation: 'getProgramYearData',
      districtId,
      programYear,
    })

    try {
      return await this.circuitBreaker.execute(
        async () => {
          const programYearDocRef = this.getProgramYearDocRef(
            districtId,
            programYear
          )
          const docSnapshot = await programYearDocRef.get()

          if (!docSnapshot.exists) {
            logger.debug('Program year data not found', {
              operation: 'getProgramYearData',
              districtId,
              programYear,
              duration_ms: Date.now() - startTime,
            })
            return null
          }

          const doc = docSnapshot.data() as FirestoreProgramYearDocument

          // Convert to ProgramYearIndex interface
          const result: ProgramYearIndex = {
            programYear: doc.programYear,
            startDate: doc.startDate,
            endDate: doc.endDate,
            dataPoints: doc.dataPoints,
            lastUpdated: doc.lastUpdated,
          }

          logger.info('Successfully retrieved program year data', {
            operation: 'getProgramYearData',
            districtId,
            programYear,
            dataPointCount: result.dataPoints.length,
            duration_ms: Date.now() - startTime,
          })

          return result
        },
        { operation: 'getProgramYearData', districtId, programYear }
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to get program year data', {
        operation: 'getProgramYearData',
        districtId,
        programYear,
        error: errorMessage,
        duration_ms: Date.now() - startTime,
      })

      throw new StorageOperationError(
        `Failed to get program year data for district ${districtId}: ${errorMessage}`,
        'getProgramYearData',
        'firestore',
        this.isRetryableError(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  // ============================================================================
  // Deletion Operations
  // ============================================================================

  /**
   * Delete all time-series entries for a specific snapshot
   *
   * Removes all data points associated with a given snapshot ID across
   * all districts and program years. This is used during cascading
   * deletion to clean up time-series data when a snapshot is deleted.
   *
   * The operation:
   * 1. Lists all district documents in the time-series collection
   * 2. For each district, queries all program year documents
   * 3. Filters out entries matching snapshotId
   * 4. Uses batched writes to update documents (max 500 operations per batch)
   * 5. Returns the total count of removed entries
   *
   * @param snapshotId - The snapshot ID to remove entries for (ISO date format: YYYY-MM-DD)
   * @returns Number of entries removed across all districts
   * @throws StorageOperationError on deletion failure
   */
  async deleteSnapshotEntries(snapshotId: string): Promise<number> {
    const startTime = Date.now()
    this.validateDate(snapshotId, 'snapshotId')

    const operationId = `delete_entries_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    logger.info('Starting deleteSnapshotEntries operation', {
      operation: 'deleteSnapshotEntries',
      operationId,
      snapshotId,
    })

    try {
      return await this.circuitBreaker.execute(
        async () => {
          let totalRemoved = 0

          // List all district documents
          const districtsSnapshot = await this.timeSeriesCollection.get()

          if (districtsSnapshot.empty) {
            logger.info('No districts found in time-series collection', {
              operation: 'deleteSnapshotEntries',
              operationId,
              snapshotId,
              duration_ms: Date.now() - startTime,
            })
            return 0
          }

          logger.debug('Found districts to scan', {
            operation: 'deleteSnapshotEntries',
            operationId,
            snapshotId,
            districtCount: districtsSnapshot.docs.length,
          })

          // Process each district
          for (const districtDoc of districtsSnapshot.docs) {
            const districtId = districtDoc.id
            const removedFromDistrict =
              await this.deleteSnapshotEntriesFromDistrict(
                districtId,
                snapshotId,
                operationId
              )
            totalRemoved += removedFromDistrict
          }

          logger.info(
            'Successfully completed deleteSnapshotEntries operation',
            {
              operation: 'deleteSnapshotEntries',
              operationId,
              snapshotId,
              totalRemoved,
              districtsScanned: districtsSnapshot.docs.length,
              duration_ms: Date.now() - startTime,
            }
          )

          return totalRemoved
        },
        { operation: 'deleteSnapshotEntries', snapshotId }
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to delete snapshot entries', {
        operation: 'deleteSnapshotEntries',
        operationId,
        snapshotId,
        error: errorMessage,
        duration_ms: Date.now() - startTime,
      })

      throw new StorageOperationError(
        `Failed to delete snapshot entries for ${snapshotId}: ${errorMessage}`,
        'deleteSnapshotEntries',
        'firestore',
        this.isRetryableError(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Delete snapshot entries from a specific district
   *
   * @param districtId - The district ID to process
   * @param snapshotId - The snapshot ID to remove entries for
   * @param operationId - Operation ID for logging correlation
   * @returns Number of entries removed from this district
   */
  private async deleteSnapshotEntriesFromDistrict(
    districtId: string,
    snapshotId: string,
    operationId: string
  ): Promise<number> {
    let removedFromDistrict = 0

    try {
      // List all program year documents for this district
      const programYearsCollection = this.getProgramYearsCollection(districtId)
      const programYearsSnapshot = await programYearsCollection.get()

      if (programYearsSnapshot.empty) {
        return 0
      }

      // Collect documents that need updating
      const documentsToUpdate: Array<{
        docRef: DocumentReference
        doc: FirestoreProgramYearDocument
        removedCount: number
      }> = []

      for (const programYearDoc of programYearsSnapshot.docs) {
        const doc = programYearDoc.data() as FirestoreProgramYearDocument
        const originalCount = doc.dataPoints.length

        // Filter out entries matching the snapshotId
        const filteredDataPoints = doc.dataPoints.filter(
          dp => dp.snapshotId !== snapshotId
        )

        const removedCount = originalCount - filteredDataPoints.length

        if (removedCount > 0) {
          // Note: Summary is NOT recalculated here per data-computation-separation steering.
          // The summary will be stale until scraper-cli regenerates the index file.
          // This is acceptable because deletion is an admin operation and the summary
          // is informational only.
          documentsToUpdate.push({
            docRef: programYearDoc.ref,
            doc: {
              ...doc,
              dataPoints: filteredDataPoints,
              lastUpdated: new Date().toISOString(),
              // Keep existing summary - it will be stale but acceptable
            },
            removedCount,
          })
          removedFromDistrict += removedCount
        }
      }

      // Use batched writes for efficiency (max 500 operations per batch)
      const batchSize = 500
      for (let i = 0; i < documentsToUpdate.length; i += batchSize) {
        const batch = this.firestore.batch()
        const chunk = documentsToUpdate.slice(i, i + batchSize)

        for (const { docRef, doc } of chunk) {
          batch.set(docRef, doc)
        }

        await batch.commit()
      }

      if (removedFromDistrict > 0) {
        logger.debug('Removed entries from district', {
          operation: 'deleteSnapshotEntries',
          operationId,
          districtId,
          snapshotId,
          removedCount: removedFromDistrict,
          documentsUpdated: documentsToUpdate.length,
        })
      }

      return removedFromDistrict
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.warn('Failed to process district for snapshot entry deletion', {
        operation: 'deleteSnapshotEntries',
        operationId,
        districtId,
        snapshotId,
        error: errorMessage,
      })
      // Continue processing other districts
      return 0
    }
  }

  // ============================================================================
  // Health Check
  // ============================================================================

  /**
   * Check if the storage is properly initialized and accessible
   *
   * Verifies that the Firestore time-series collection is accessible.
   * Returns false without throwing when storage is unavailable.
   *
   * @returns True if the storage is ready for operations
   */
  async isReady(): Promise<boolean> {
    try {
      // Attempt a simple read operation to verify connectivity
      await this.timeSeriesCollection.limit(1).get()
      return true
    } catch (error) {
      logger.warn('Firestore time-series storage not ready', {
        operation: 'isReady',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      return false
    }
  }
}
