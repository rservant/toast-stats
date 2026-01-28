/**
 * Firestore Snapshot Storage Implementation
 *
 * Implements the ISnapshotStorage interface using Google Cloud Firestore
 * for storing snapshot data in a document database.
 *
 * Document Structure:
 * Collection: snapshots (configurable)
 * Document ID: YYYY-MM-DD (ISO date)
 *
 * Root Document:
 * {
 *   metadata: PerDistrictSnapshotMetadata,
 *   manifest: SnapshotManifest,
 *   rankings?: AllDistrictsRankingsData
 * }
 *
 * Subcollection: districts
 * Document ID: district_{id}
 * {
 *   districtId: string,
 *   districtName: string,
 *   collectedAt: string,
 *   status: 'success' | 'failed',
 *   errorMessage?: string,
 *   data: DistrictStatistics
 * }
 *
 * Requirements: 2.1-2.6, 7.1-7.4
 */

import {
  Firestore,
  CollectionReference,
  DocumentReference,
  WriteBatch,
} from '@google-cloud/firestore'
import { logger } from '../../utils/logger.js'
import { CircuitBreaker } from '../../utils/CircuitBreaker.js'
import type { DistrictStatistics } from '../../types/districts.js'
import type {
  Snapshot,
  SnapshotMetadata,
  SnapshotFilters,
  AllDistrictsRankingsData,
} from '../../types/snapshots.js'
import type {
  SnapshotManifest,
  PerDistrictSnapshotMetadata,
  WriteSnapshotOptions,
  DistrictManifestEntry,
} from '../SnapshotStore.js'
import type { ISnapshotStorage } from '../../types/storageInterfaces.js'
import { StorageOperationError } from '../../types/storageInterfaces.js'

// ============================================================================
// Firestore Document Types
// ============================================================================

/**
 * Root snapshot document structure in Firestore
 */
interface FirestoreSnapshotDocument {
  metadata: PerDistrictSnapshotMetadata
  manifest: SnapshotManifest
  rankings?: AllDistrictsRankingsData
}

/**
 * District subdocument structure in Firestore
 */
interface FirestoreDistrictDocument {
  districtId: string
  districtName: string
  collectedAt: string
  status: 'success' | 'failed'
  errorMessage?: string
  data: DistrictStatistics
}

/**
 * Configuration for FirestoreSnapshotStorage
 *
 * @example
 * ```typescript
 * const config: FirestoreSnapshotStorageConfig = {
 *   projectId: 'my-project',
 *   collectionName: 'snapshots',
 *   batchWriteConfig: {
 *     maxOperationsPerBatch: 25,  // Override default of 50
 *     maxRetries: 5,              // Override default of 3
 *   },
 * }
 * ```
 *
 * Requirements: 4.4, 6.1
 */
export interface FirestoreSnapshotStorageConfig {
  projectId: string
  collectionName?: string // defaults to 'snapshots'

  /**
   * Batch write configuration (optional, uses defaults if not provided).
   * Partial configuration is merged with DEFAULT_BATCH_WRITE_CONFIG.
   * This allows callers to override specific settings while keeping
   * sensible defaults for unspecified options.
   *
   * Requirements: 4.4, 6.1
   */
  batchWriteConfig?: Partial<BatchWriteConfig>
}

// ============================================================================
// Batch Write Configuration Types
// ============================================================================

/**
 * Configuration for chunked batch write operations
 *
 * Controls how large snapshot writes are split into smaller batches
 * to avoid Firestore DEADLINE_EXCEEDED errors. Each property has a
 * sensible default that can be overridden for specific use cases.
 *
 * @example
 * ```typescript
 * const config: BatchWriteConfig = {
 *   maxOperationsPerBatch: 50,
 *   maxConcurrentBatches: 3,
 *   batchTimeoutMs: 30000,
 *   totalTimeoutMs: 300000,
 *   maxRetries: 3,
 *   initialBackoffMs: 1000,
 *   maxBackoffMs: 30000,
 *   jitterFactor: 0.2,
 * }
 * ```
 *
 * Requirements: 4.1, 4.2, 4.4
 */
export interface BatchWriteConfig {
  /**
   * Maximum number of write operations per Firestore batch.
   * Smaller batches complete faster and are less likely to timeout.
   * Firestore allows up to 500 operations per batch, but 50 is
   * recommended to ensure completion within deadline limits.
   *
   * @default 50
   */
  maxOperationsPerBatch: number

  /**
   * Maximum number of batches to process concurrently.
   * Higher concurrency speeds up writes but increases load on Firestore.
   * The root document batch always completes before district batches begin.
   *
   * @default 3
   */
  maxConcurrentBatches: number

  /**
   * Timeout for each individual batch operation in milliseconds.
   * Should be less than Firestore's RPC deadline (~60 seconds).
   *
   * @default 30000 (30 seconds)
   */
  batchTimeoutMs: number

  /**
   * Total timeout for the entire write operation in milliseconds.
   * If exceeded, remaining operations are aborted and partial
   * completion status is reported.
   *
   * @default 300000 (5 minutes)
   */
  totalTimeoutMs: number

  /**
   * Maximum number of retry attempts per batch on retryable errors.
   * Retryable errors include DEADLINE_EXCEEDED, UNAVAILABLE,
   * INTERNAL, and ABORTED.
   *
   * @default 3
   */
  maxRetries: number

  /**
   * Initial backoff delay in milliseconds for retry attempts.
   * Subsequent retries use exponential backoff: delay * 2^attempt.
   *
   * @default 1000 (1 second)
   */
  initialBackoffMs: number

  /**
   * Maximum backoff delay in milliseconds.
   * Caps the exponential backoff to prevent excessively long waits.
   *
   * @default 30000 (30 seconds)
   */
  maxBackoffMs: number

  /**
   * Jitter factor for backoff delays (0.0 to 1.0).
   * Adds randomness to prevent thundering herd effects when
   * multiple operations retry simultaneously.
   * A value of 0.2 means ±20% variation in delay.
   *
   * @default 0.2
   */
  jitterFactor: number
}

/**
 * Default configuration values for batch write operations.
 *
 * These defaults are tuned for typical production workloads with
 * 100-150 districts per snapshot. Adjust based on observed
 * performance and Firestore quotas.
 *
 * Requirements: 4.1, 4.2, 4.4
 */
export const DEFAULT_BATCH_WRITE_CONFIG: BatchWriteConfig = {
  maxOperationsPerBatch: 50,
  maxConcurrentBatches: 3,
  batchTimeoutMs: 30000,
  totalTimeoutMs: 300000,
  maxRetries: 3,
  initialBackoffMs: 1000,
  maxBackoffMs: 30000,
  jitterFactor: 0.2,
}

/**
 * Result of a batch write operation
 *
 * Captures the outcome of a single batch write including timing,
 * retry information, and any errors encountered. Used to build
 * aggregate results for the overall snapshot write operation.
 *
 * @example
 * ```typescript
 * const result: BatchWriteResult = {
 *   batchIndex: 0,
 *   operationCount: 50,
 *   success: true,
 *   retryAttempts: 0,
 *   durationMs: 1234,
 *   districtIds: ['1', '2', '3'],
 * }
 * ```
 *
 * Requirements: 3.3, 5.1, 5.2, 5.3
 */
export interface BatchWriteResult {
  /** Batch index (0-based) */
  batchIndex: number

  /** Number of operations in this batch */
  operationCount: number

  /** Whether the batch succeeded */
  success: boolean

  /** Number of retry attempts made */
  retryAttempts: number

  /** Duration in milliseconds */
  durationMs: number

  /** Error message if failed */
  error?: string

  /** District IDs in this batch (for district batches) */
  districtIds?: string[]
}

/**
 * Aggregate result of a snapshot write operation
 *
 * Provides a comprehensive summary of a chunked snapshot write,
 * including success/failure counts, timing, and detailed results
 * for each batch. Used to determine if a write completed fully
 * or partially, and to identify which districts failed.
 *
 * @example
 * ```typescript
 * const result: SnapshotWriteResult = {
 *   snapshotId: '2024-01-15',
 *   complete: true,
 *   totalBatches: 3,
 *   successfulBatches: 3,
 *   failedBatches: 0,
 *   districtsWritten: 132,
 *   failedDistricts: [],
 *   totalDurationMs: 5678,
 *   batchResults: [...],
 * }
 * ```
 *
 * Requirements: 3.3, 5.1, 5.2, 5.3
 */
export interface SnapshotWriteResult {
  /** Snapshot ID that was written */
  snapshotId: string

  /** Whether all operations succeeded */
  complete: boolean

  /** Total batches processed */
  totalBatches: number

  /** Successful batch count */
  successfulBatches: number

  /** Failed batch count */
  failedBatches: number

  /** Total districts written */
  districtsWritten: number

  /** Districts that failed to write */
  failedDistricts: string[]

  /** Total duration in milliseconds */
  totalDurationMs: number

  /** Individual batch results */
  batchResults: BatchWriteResult[]
}

/**
 * Result of an index health check operation
 *
 * Provides diagnostic information about the availability of required
 * Firestore composite indexes. When indexes are missing, includes
 * URLs to the Firebase console for creating them.
 *
 * @example
 * ```typescript
 * const result = await storage.isIndexHealthy()
 * if (!result.healthy) {
 *   console.log('Missing indexes:', result.missingIndexes)
 *   console.log('Create them at:', result.indexCreationUrls)
 * }
 * ```
 *
 * Validates: Requirements 5.5
 */
export interface IndexHealthResult {
  /** Whether all required indexes are available and functional */
  healthy: boolean
  /** List of index descriptions that are missing or unavailable */
  missingIndexes: string[]
  /** Firebase console URLs for creating missing indexes */
  indexCreationUrls: string[]
}

// ============================================================================
// Index Error Detection Utilities
// ============================================================================

/**
 * Determines if an error is a Firestore index error (FAILED_PRECONDITION)
 *
 * Firestore queries that require composite indexes will fail with
 * FAILED_PRECONDITION errors when the required index does not exist.
 * These errors are non-retryable configuration issues.
 *
 * @param error - The error to check (can be any type)
 * @returns True if the error is a Firestore index error
 *
 * @example
 * ```typescript
 * try {
 *   await query.get()
 * } catch (error) {
 *   if (isIndexError(error)) {
 *     // Handle missing index - return safe default
 *     return []
 *   }
 *   throw error
 * }
 * ```
 *
 * Validates: Requirements 2.5
 */
export function isIndexError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes('FAILED_PRECONDITION') &&
      error.message.includes('index')
    )
  }
  return false
}

/**
 * Extracts the Firebase console URL from a Firestore index error message
 *
 * When Firestore throws an index error, the error message typically includes
 * a URL to the Firebase console where the index can be created. This function
 * extracts that URL for logging and operator guidance.
 *
 * @param error - The error containing the index creation URL
 * @returns The Firebase console URL or null if not found
 *
 * @example
 * ```typescript
 * const url = extractIndexUrl(error)
 * if (url) {
 *   logger.warn('Missing index. Create it at:', { indexUrl: url })
 * }
 * ```
 *
 * Validates: Requirements 2.6
 */
export function extractIndexUrl(error: Error): string | null {
  const urlMatch = error.message.match(
    /https:\/\/console\.firebase\.google\.com[^\s]+/
  )
  return urlMatch ? urlMatch[0] : null
}

// ============================================================================
// FirestoreSnapshotStorage Implementation
// ============================================================================

/**
 * Cloud Firestore snapshot storage implementation
 *
 * Stores snapshots in Firestore with the following structure:
 * - Root document contains metadata, manifest, and optional rankings
 * - District data stored in 'districts' subcollection for efficient per-district access
 * - Document IDs use ISO date format (YYYY-MM-DD) for natural ordering
 *
 * Features:
 * - Circuit breaker integration for resilience
 * - Proper error handling with StorageOperationError
 * - Efficient queries for latest snapshot lookup
 * - Subcollection pattern for scalable district data storage
 */
export class FirestoreSnapshotStorage implements ISnapshotStorage {
  private readonly firestore: Firestore
  private readonly collectionName: string
  private readonly circuitBreaker: CircuitBreaker
  private readonly batchWriteConfig: BatchWriteConfig

  /**
   * Creates a new FirestoreSnapshotStorage instance
   *
   * @param config - Configuration containing projectId, optional collectionName, and optional batchWriteConfig
   */
  constructor(config: FirestoreSnapshotStorageConfig) {
    this.firestore = new Firestore({
      projectId: config.projectId,
    })
    this.collectionName = config.collectionName ?? 'snapshots'
    this.circuitBreaker = CircuitBreaker.createCacheCircuitBreaker(
      'firestore-snapshots'
    )

    // Merge provided batch write config with defaults
    // This ensures all properties have values while allowing callers to override specific settings
    // Requirements: 4.4, 6.1
    this.batchWriteConfig = {
      ...DEFAULT_BATCH_WRITE_CONFIG,
      ...config.batchWriteConfig,
    }

    logger.info('FirestoreSnapshotStorage initialized', {
      operation: 'constructor',
      projectId: config.projectId,
      collectionName: this.collectionName,
      batchWriteConfig: this.batchWriteConfig,
    })
  }

  /**
   * Get the snapshots collection reference
   */
  private get snapshotsCollection(): CollectionReference {
    return this.firestore.collection(this.collectionName)
  }

  /**
   * Get a snapshot document reference by ID
   */
  private getSnapshotDocRef(snapshotId: string): DocumentReference {
    return this.snapshotsCollection.doc(snapshotId)
  }

  /**
   * Get the districts subcollection for a snapshot
   */
  private getDistrictsCollection(snapshotId: string): CollectionReference {
    return this.getSnapshotDocRef(snapshotId).collection('districts')
  }

  /**
   * Validate snapshot ID format (YYYY-MM-DD)
   */
  private validateSnapshotId(snapshotId: string): void {
    if (typeof snapshotId !== 'string' || snapshotId.length === 0) {
      throw new StorageOperationError(
        'Invalid snapshot ID: empty or non-string value',
        'validateSnapshotId',
        'firestore',
        false
      )
    }

    // ISO date format: YYYY-MM-DD
    const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
    if (!ISO_DATE_PATTERN.test(snapshotId)) {
      throw new StorageOperationError(
        `Invalid snapshot ID format: ${snapshotId}. Expected YYYY-MM-DD`,
        'validateSnapshotId',
        'firestore',
        false
      )
    }
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

    // Allow alphanumeric characters only
    const DISTRICT_ID_PATTERN = /^[A-Za-z0-9]+$/
    if (!DISTRICT_ID_PATTERN.test(districtId)) {
      throw new StorageOperationError(
        `Invalid district ID format: ${districtId}`,
        'validateDistrictId',
        'firestore',
        false
      )
    }
  }

  /**
   * Generate snapshot directory name from date
   */
  private generateSnapshotId(dataAsOfDate: string): string {
    // Extract just the date portion (YYYY-MM-DD) from ISO timestamp or date string
    const dateMatch = dataAsOfDate.match(/^\d{4}-\d{2}-\d{2}/)
    if (!dateMatch || !dateMatch[0]) {
      throw new StorageOperationError(
        `Invalid date format: ${dataAsOfDate}. Expected YYYY-MM-DD or ISO timestamp`,
        'generateSnapshotId',
        'firestore',
        false
      )
    }
    return dateMatch[0]
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
   * gRPC status codes for retryable write errors
   *
   * These codes indicate transient failures that may succeed on retry:
   * - DEADLINE_EXCEEDED (4): Operation took too long
   * - UNAVAILABLE (14): Service temporarily unavailable
   * - INTERNAL (13): Internal server error
   * - ABORTED (10): Operation was aborted (e.g., due to concurrency)
   * - RESOURCE_EXHAUSTED (8): Quota exceeded, retry with backoff
   *
   * @see https://grpc.github.io/grpc/core/md_doc_statuscodes.html
   */
  private static readonly RETRYABLE_GRPC_CODES = new Set([
    4, // DEADLINE_EXCEEDED
    14, // UNAVAILABLE
    13, // INTERNAL
    10, // ABORTED
    8, // RESOURCE_EXHAUSTED
  ])

  /**
   * Check if an error is a retryable write error based on gRPC status code
   *
   * This method examines the error's gRPC status code to determine if the
   * operation should be retried. It safely handles errors that don't have
   * a code property by returning false.
   *
   * Retryable errors (gRPC codes):
   * - DEADLINE_EXCEEDED (4): Operation took too long
   * - UNAVAILABLE (14): Service temporarily unavailable
   * - INTERNAL (13): Internal server error
   * - ABORTED (10): Operation was aborted
   * - RESOURCE_EXHAUSTED (8): Quota exceeded
   *
   * Non-retryable errors include:
   * - PERMISSION_DENIED (7): Authentication/authorization failure
   * - NOT_FOUND (5): Resource doesn't exist
   * - INVALID_ARGUMENT (3): Bad request data
   * - All other error types
   *
   * @param error - The error to check (can be any type)
   * @returns true if the error is retryable, false otherwise
   *
   * @example
   * ```typescript
   * try {
   *   await batch.commit()
   * } catch (error) {
   *   if (this.isRetryableWriteError(error)) {
   *     // Retry with exponential backoff
   *   } else {
   *     // Fail immediately
   *   }
   * }
   * ```
   *
   * Requirements: 2.1
   */
  private isRetryableWriteError(error: unknown): boolean {
    // Handle null/undefined
    if (error == null) {
      return false
    }

    // Check if error has a numeric code property (gRPC errors)
    // Google Cloud libraries expose gRPC status codes via error.code
    const errorWithCode = error as { code?: unknown }

    if (typeof errorWithCode.code === 'number') {
      return FirestoreSnapshotStorage.RETRYABLE_GRPC_CODES.has(errorWithCode.code)
    }

    // For errors without a numeric code, return false
    // The caller can fall back to isRetryableError for message-based detection
    return false
  }

  /**
   * Calculate backoff delay with jitter for retry attempts
   *
   * Uses exponential backoff with configurable jitter to prevent
   * thundering herd effects when multiple operations retry simultaneously.
   *
   * Formula:
   * 1. Base delay = initialBackoffMs * 2^attempt
   * 2. Capped delay = min(base delay, maxBackoffMs)
   * 3. Jittered delay = capped delay * (1 + randomValue)
   *    where randomValue is uniformly distributed in [-jitterFactor, +jitterFactor]
   *
   * @param attempt - The retry attempt number (0-indexed)
   * @param randomFn - Optional random function for deterministic testing (defaults to Math.random)
   * @returns The calculated backoff delay in milliseconds
   *
   * @example
   * ```typescript
   * // With defaults (initialBackoffMs=1000, maxBackoffMs=30000, jitterFactor=0.2)
   * calculateBackoffDelay(0) // ~1000ms (800-1200ms with jitter)
   * calculateBackoffDelay(1) // ~2000ms (1600-2400ms with jitter)
   * calculateBackoffDelay(2) // ~4000ms (3200-4800ms with jitter)
   * calculateBackoffDelay(5) // ~30000ms (capped, 24000-36000ms with jitter)
   * ```
   *
   * Requirements: 2.2, 2.4
   */
  private calculateBackoffDelay(
    attempt: number,
    randomFn: () => number = Math.random
  ): number {
    const { initialBackoffMs, maxBackoffMs, jitterFactor } =
      this.batchWriteConfig

    // Calculate base delay with exponential backoff: initialBackoffMs * 2^attempt
    const baseDelay = initialBackoffMs * Math.pow(2, attempt)

    // Cap at maxBackoffMs to prevent excessively long waits
    const cappedDelay = Math.min(baseDelay, maxBackoffMs)

    // Apply jitter: delay * (1 + randomValue)
    // where randomValue is uniformly distributed in [-jitterFactor, +jitterFactor]
    // randomFn() returns [0, 1), so we transform to [-jitterFactor, +jitterFactor]
    const randomValue = (randomFn() * 2 - 1) * jitterFactor
    const jitteredDelay = cappedDelay * (1 + randomValue)

    return jitteredDelay
  }

  /**
   * Execute a batch write with retry logic
   *
   * Attempts to commit a Firestore WriteBatch with timeout protection and
   * automatic retry on transient failures. Uses exponential backoff with
   * jitter to prevent thundering herd effects.
   *
   * The method:
   * 1. Tracks start time for duration calculation
   * 2. Attempts batch.commit() with a timeout (batchTimeoutMs)
   * 3. On success: returns BatchWriteResult with success=true
   * 4. On retryable error: logs, calculates backoff, waits, retries up to maxRetries
   * 5. On non-retryable error or exhausted retries: returns BatchWriteResult with success=false
   *
   * @param batch - The Firestore WriteBatch to commit
   * @param batchIndex - The 0-based index of this batch in the overall operation
   * @param districtIds - Optional array of district IDs included in this batch (for logging and result tracking)
   * @returns BatchWriteResult with success/failure details, timing, and retry information
   *
   * @example
   * ```typescript
   * const batch = this.firestore.batch()
   * batch.set(docRef, data)
   * const result = await this.executeBatchWithRetry(batch, 0, ['1', '2', '3'])
   * if (!result.success) {
   *   console.error(`Batch failed: ${result.error}`)
   * }
   * ```
   *
   * Requirements: 2.1, 2.3, 2.5, 2.6, 1.4, 1.5
   */
  private async executeBatchWithRetry(
    batch: WriteBatch,
    batchIndex: number,
    districtIds?: string[]
  ): Promise<BatchWriteResult> {
    const startTime = Date.now()
    const { batchTimeoutMs, maxRetries } = this.batchWriteConfig
    const operationCount = districtIds?.length ?? 1 // Estimate; root batch has 1 if no districtIds

    let retryAttempts = 0
    let lastError: Error | undefined

    while (retryAttempts <= maxRetries) {
      try {
        // Create a timeout promise that rejects after batchTimeoutMs
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            const timeoutError = new Error(
              `Batch ${batchIndex} timed out after ${batchTimeoutMs}ms`
            )
            // Add a code property to make it identifiable as a timeout
            ;(timeoutError as Error & { code?: number }).code = 4 // DEADLINE_EXCEEDED
            reject(timeoutError)
          }, batchTimeoutMs)
        })

        // Race the batch commit against the timeout
        await Promise.race([batch.commit(), timeoutPromise])

        // Success - return result
        const durationMs = Date.now() - startTime

        logger.info('Batch write succeeded', {
          operation: 'executeBatchWithRetry',
          batchIndex,
          operationCount,
          retryAttempts,
          durationMs,
          districtIds: districtIds?.slice(0, 5), // Log first 5 for brevity
          districtCount: districtIds?.length,
        })

        return {
          batchIndex,
          operationCount,
          success: true,
          retryAttempts,
          durationMs,
          districtIds,
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        // Check if error is retryable
        const isRetryable = this.isRetryableWriteError(error)

        if (!isRetryable) {
          // Non-retryable error - fail immediately
          const durationMs = Date.now() - startTime

          logger.error('Batch write failed with non-retryable error', {
            operation: 'executeBatchWithRetry',
            batchIndex,
            operationCount,
            retryAttempts,
            durationMs,
            error: lastError.message,
            errorCode: (error as { code?: number }).code,
            districtIds: districtIds?.slice(0, 5),
            districtCount: districtIds?.length,
          })

          return {
            batchIndex,
            operationCount,
            success: false,
            retryAttempts,
            durationMs,
            error: lastError.message,
            districtIds,
          }
        }

        // Retryable error - check if we have retries remaining
        if (retryAttempts >= maxRetries) {
          // Exhausted all retries
          const durationMs = Date.now() - startTime

          logger.error('Batch write failed after exhausting all retries', {
            operation: 'executeBatchWithRetry',
            batchIndex,
            operationCount,
            retryAttempts,
            maxRetries,
            durationMs,
            error: lastError.message,
            errorCode: (error as { code?: number }).code,
            districtIds: districtIds?.slice(0, 5),
            districtCount: districtIds?.length,
          })

          return {
            batchIndex,
            operationCount,
            success: false,
            retryAttempts,
            durationMs,
            error: `Failed after ${retryAttempts} retries: ${lastError.message}`,
            districtIds,
          }
        }

        // Calculate backoff delay for next retry
        const backoffDelay = this.calculateBackoffDelay(retryAttempts)

        // Log retry attempt with error type, attempt number, and next delay
        logger.warn('Batch write failed, retrying with backoff', {
          operation: 'executeBatchWithRetry',
          batchIndex,
          operationCount,
          retryAttempt: retryAttempts + 1,
          maxRetries,
          nextDelayMs: Math.round(backoffDelay),
          error: lastError.message,
          errorCode: (error as { code?: number }).code,
          districtIds: districtIds?.slice(0, 5),
          districtCount: districtIds?.length,
        })

        // Wait for backoff delay before retrying
        await new Promise(resolve => setTimeout(resolve, backoffDelay))

        retryAttempts++
      }
    }

    // This should not be reached, but TypeScript needs a return
    const durationMs = Date.now() - startTime
    return {
      batchIndex,
      operationCount,
      success: false,
      retryAttempts,
      durationMs,
      error: lastError?.message ?? 'Unknown error',
      districtIds,
    }
  }

  /**
   * Process batches with controlled concurrency
   *
   * Processes an array of batches with a configurable level of parallelism,
   * ensuring that no more than `maxConcurrentBatches` are in flight at once.
   * Uses Promise.allSettled to ensure all batches are attempted even if some fail.
   *
   * The method processes batches in chunks:
   * 1. Take up to maxConcurrentBatches from the queue
   * 2. Execute them in parallel using Promise.allSettled
   * 3. Collect results (both fulfilled and rejected)
   * 4. Repeat until all batches are processed
   *
   * This approach provides:
   * - Controlled parallelism to avoid overwhelming Firestore
   * - Resilience: failures in one batch don't prevent others from being attempted
   * - Complete result tracking for partial success reporting
   *
   * @param batches - Array of batch objects from chunkDistrictDocuments
   * @param startIndex - Starting index for batch numbering (used in BatchWriteResult.batchIndex)
   * @returns Array of BatchWriteResult objects, one per batch
   *
   * @example
   * ```typescript
   * // With maxConcurrentBatches = 3 and 7 batches:
   * // Round 1: Process batches 0, 1, 2 in parallel
   * // Round 2: Process batches 3, 4, 5 in parallel
   * // Round 3: Process batch 6
   * const results = await this.processBatchesWithConcurrency(batches, 1)
   * // results.length === 7
   * ```
   *
   * Requirements: 3.1, 3.4
   */
  private async processBatchesWithConcurrency(
    batches: Array<{ batch: WriteBatch; districtIds: string[] }>,
    startIndex: number
  ): Promise<BatchWriteResult[]> {
    const { maxConcurrentBatches } = this.batchWriteConfig
    const results: BatchWriteResult[] = []

    logger.info('Starting concurrent batch processing', {
      operation: 'processBatchesWithConcurrency',
      totalBatches: batches.length,
      maxConcurrentBatches,
      startIndex,
    })

    // Process batches in chunks of maxConcurrentBatches
    for (let i = 0; i < batches.length; i += maxConcurrentBatches) {
      // Get the current chunk of batches to process
      const chunk = batches.slice(i, i + maxConcurrentBatches)

      logger.debug('Processing batch chunk', {
        operation: 'processBatchesWithConcurrency',
        chunkStart: i,
        chunkSize: chunk.length,
        batchIndices: chunk.map((_, idx) => startIndex + i + idx),
      })

      // Execute all batches in this chunk in parallel
      // Promise.allSettled ensures we get results for all batches,
      // even if some fail
      const chunkPromises = chunk.map((batchInfo, chunkIdx) => {
        const batchIndex = startIndex + i + chunkIdx
        return this.executeBatchWithRetry(
          batchInfo.batch,
          batchIndex,
          batchInfo.districtIds
        )
      })

      const settledResults = await Promise.allSettled(chunkPromises)

      // Process settled results
      for (let j = 0; j < settledResults.length; j++) {
        const settled = settledResults[j]
        const batchIndex = startIndex + i + j
        const batchInfo = chunk[j]

        if (settled?.status === 'fulfilled') {
          // executeBatchWithRetry returned a BatchWriteResult
          results.push(settled.value)
        } else if (settled?.status === 'rejected') {
          // This shouldn't normally happen since executeBatchWithRetry
          // catches errors and returns a BatchWriteResult with success=false.
          // But we handle it for robustness.
          const errorMessage =
            settled.reason instanceof Error
              ? settled.reason.message
              : String(settled.reason)

          logger.error('Unexpected batch rejection', {
            operation: 'processBatchesWithConcurrency',
            batchIndex,
            error: errorMessage,
          })

          results.push({
            batchIndex,
            operationCount: batchInfo?.districtIds.length ?? 0,
            success: false,
            retryAttempts: 0,
            durationMs: 0,
            error: `Unexpected rejection: ${errorMessage}`,
            districtIds: batchInfo?.districtIds,
          })
        }
      }

      logger.debug('Completed batch chunk', {
        operation: 'processBatchesWithConcurrency',
        chunkStart: i,
        chunkSize: chunk.length,
        successCount: settledResults.filter(
          r => r.status === 'fulfilled' && r.value.success
        ).length,
        failureCount: settledResults.filter(
          r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)
        ).length,
      })
    }

    // Log summary
    const successCount = results.filter(r => r.success).length
    const failureCount = results.filter(r => !r.success).length

    logger.info('Completed concurrent batch processing', {
      operation: 'processBatchesWithConcurrency',
      totalBatches: batches.length,
      successCount,
      failureCount,
      totalDurationMs: results.reduce((sum, r) => sum + r.durationMs, 0),
    })

    return results
  }

  // ============================================================================
  // Core Snapshot Operations
  // ============================================================================

  /**
   * Get the most recent successful snapshot
   *
   * Queries Firestore for snapshots with status 'success', ordered by
   * document ID (ISO date) descending, and returns the first result.
   *
   * @returns Latest successful snapshot or null if none exists
   */
  async getLatestSuccessful(): Promise<Snapshot | null> {
    const startTime = Date.now()

    logger.info('Starting getLatestSuccessful operation', {
      operation: 'getLatestSuccessful',
      collection: this.collectionName,
    })

    try {
      return await this.circuitBreaker.execute(
        async () => {
          // Query for successful snapshots, ordered by ID (date) descending
          const querySnapshot = await this.snapshotsCollection
            .where('metadata.status', '==', 'success')
            .orderBy('__name__', 'desc')
            .limit(1)
            .get()

          if (querySnapshot.empty) {
            logger.info('No successful snapshots found', {
              operation: 'getLatestSuccessful',
              duration_ms: Date.now() - startTime,
            })
            return null
          }

          const doc = querySnapshot.docs[0]
          if (!doc) {
            return null
          }

          const snapshot = await this.buildSnapshotFromDocument(doc.id)

          logger.info('Successfully retrieved latest successful snapshot', {
            operation: 'getLatestSuccessful',
            snapshot_id: doc.id,
            duration_ms: Date.now() - startTime,
          })

          return snapshot
        },
        { operation: 'getLatestSuccessful' }
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      // Handle index errors gracefully - return null instead of throwing
      // This allows the application to continue operating with reduced functionality
      // when Firestore indexes are not yet deployed
      if (isIndexError(error)) {
        const indexUrl = error instanceof Error ? extractIndexUrl(error) : null
        logger.warn('Firestore query failed due to missing index', {
          operation: 'getLatestSuccessful',
          error: errorMessage,
          indexUrl,
          recommendation:
            'Deploy indexes using: firebase deploy --only firestore:indexes',
        })
        return null
      }

      logger.error('Failed to get latest successful snapshot', {
        operation: 'getLatestSuccessful',
        error: errorMessage,
        duration_ms: Date.now() - startTime,
      })

      throw new StorageOperationError(
        `Failed to get latest successful snapshot: ${errorMessage}`,
        'getLatestSuccessful',
        'firestore',
        this.isRetryableError(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Get the most recent snapshot regardless of status
   *
   * @returns Latest snapshot or null if none exists
   */
  async getLatest(): Promise<Snapshot | null> {
    const startTime = Date.now()

    logger.info('Starting getLatest operation', {
      operation: 'getLatest',
      collection: this.collectionName,
    })

    try {
      return await this.circuitBreaker.execute(
        async () => {
          // Query all snapshots, ordered by ID (date) descending
          const querySnapshot = await this.snapshotsCollection
            .orderBy('__name__', 'desc')
            .limit(1)
            .get()

          if (querySnapshot.empty) {
            logger.info('No snapshots found', {
              operation: 'getLatest',
              duration_ms: Date.now() - startTime,
            })
            return null
          }

          const doc = querySnapshot.docs[0]
          if (!doc) {
            return null
          }

          const snapshot = await this.buildSnapshotFromDocument(doc.id)

          logger.info('Successfully retrieved latest snapshot', {
            operation: 'getLatest',
            snapshot_id: doc.id,
            status: snapshot?.status,
            duration_ms: Date.now() - startTime,
          })

          return snapshot
        },
        { operation: 'getLatest' }
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      // Handle index errors gracefully - return null instead of throwing
      // This allows the application to continue operating with reduced functionality
      // when Firestore indexes are not yet deployed
      if (isIndexError(error)) {
        const indexUrl = error instanceof Error ? extractIndexUrl(error) : null
        logger.warn('Firestore query failed due to missing index', {
          operation: 'getLatest',
          error: errorMessage,
          indexUrl,
          recommendation:
            'Deploy indexes using: firebase deploy --only firestore:indexes',
        })
        return null
      }

      logger.error('Failed to get latest snapshot', {
        operation: 'getLatest',
        error: errorMessage,
        duration_ms: Date.now() - startTime,
      })

      throw new StorageOperationError(
        `Failed to get latest snapshot: ${errorMessage}`,
        'getLatest',
        'firestore',
        this.isRetryableError(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Write a new snapshot using chunked batch writes with retry logic
   *
   * This method implements a multi-batch write strategy to avoid Firestore
   * DEADLINE_EXCEEDED errors when writing large snapshots. The operation:
   *
   * 1. Builds root document with metadata, manifest, and optional rankings
   * 2. Writes root document in a separate batch with retry (fail fast if root fails)
   * 3. Chunks district documents into batches respecting maxOperationsPerBatch
   * 4. Processes district batches with controlled concurrency
   * 5. Aggregates results and handles partial success scenarios
   *
   * The root document MUST be written before any district documents to ensure
   * the snapshot exists before districts are added (Requirement 3.2).
   *
   * @param snapshot - The snapshot to persist
   * @param allDistrictsRankings - Optional rankings data to store with the snapshot
   * @param options - Optional write options (e.g., override snapshot date)
   *
   * Requirements: 1.1, 1.2, 1.3, 3.2, 3.3, 3.5, 5.4, 6.1, 6.2
   */
  async writeSnapshot(
    snapshot: Snapshot,
    allDistrictsRankings?: AllDistrictsRankingsData,
    options?: WriteSnapshotOptions
  ): Promise<void> {
    const startTime = Date.now()

    // Determine snapshot ID (document ID)
    const snapshotId = options?.overrideSnapshotDate
      ? this.generateSnapshotId(options.overrideSnapshotDate)
      : this.generateSnapshotId(snapshot.payload.metadata.dataAsOfDate)

    logger.info('Starting writeSnapshot operation (chunked)', {
      operation: 'writeSnapshot',
      snapshot_id: snapshotId,
      status: snapshot.status,
      district_count: snapshot.payload.districts.length,
      has_rankings: !!allDistrictsRankings,
      batchConfig: {
        maxOperationsPerBatch: this.batchWriteConfig.maxOperationsPerBatch,
        maxConcurrentBatches: this.batchWriteConfig.maxConcurrentBatches,
        maxRetries: this.batchWriteConfig.maxRetries,
      },
    })

    try {
      await this.circuitBreaker.execute(
        async () => {
          // ================================================================
          // Phase 1: Build root document and manifest
          // ================================================================
          const phase1Start = Date.now()

          // Build manifest entries for all districts (initially all marked as success)
          const manifestEntries: DistrictManifestEntry[] =
            snapshot.payload.districts.map(district => ({
              districtId: district.districtId,
              fileName: `district_${district.districtId}`,
              status: 'success' as const,
              fileSize: 0, // Not applicable for Firestore
              lastModified: new Date().toISOString(),
            }))

          // Build metadata - only include defined values to avoid Firestore undefined errors
          const metadata: PerDistrictSnapshotMetadata = {
            snapshotId,
            createdAt: snapshot.created_at,
            schemaVersion: snapshot.schema_version,
            calculationVersion: snapshot.calculation_version,
            rankingVersion: allDistrictsRankings?.metadata.rankingVersion,
            status: snapshot.status,
            configuredDistricts: snapshot.payload.districts.map(
              d => d.districtId
            ),
            successfulDistricts: snapshot.payload.districts.map(
              d => d.districtId
            ),
            failedDistricts: [],
            errors: snapshot.errors,
            processingDuration: snapshot.payload.metadata.processingDurationMs,
            source: snapshot.payload.metadata.source,
            dataAsOfDate: snapshot.payload.metadata.dataAsOfDate,
            // Only include closing period fields if they have defined values
            ...(snapshot.payload.metadata.isClosingPeriodData !== undefined && {
              isClosingPeriodData:
                snapshot.payload.metadata.isClosingPeriodData,
            }),
            ...(snapshot.payload.metadata.collectionDate !== undefined && {
              collectionDate: snapshot.payload.metadata.collectionDate,
            }),
            ...(snapshot.payload.metadata.logicalDate !== undefined && {
              logicalDate: snapshot.payload.metadata.logicalDate,
            }),
          }

          // Build manifest
          const manifest: SnapshotManifest = {
            snapshotId,
            createdAt: snapshot.created_at,
            districts: manifestEntries,
            totalDistricts: snapshot.payload.districts.length,
            successfulDistricts: snapshot.payload.districts.length,
            failedDistricts: 0,
            allDistrictsRankings: allDistrictsRankings
              ? {
                  filename: 'rankings',
                  size: 0,
                  status: 'present' as const,
                }
              : {
                  filename: 'rankings',
                  size: 0,
                  status: 'missing' as const,
                },
          }

          // Build root document
          const rootDocument: FirestoreSnapshotDocument = {
            metadata,
            manifest,
            rankings: allDistrictsRankings,
          }

          const phase1Duration = Date.now() - phase1Start

          logger.debug('Phase 1 complete: Built root document and manifest', {
            operation: 'writeSnapshot',
            snapshot_id: snapshotId,
            phase: 'build',
            duration_ms: phase1Duration,
          })

          // ================================================================
          // Phase 2: Write root document batch with retry (fail fast)
          // ================================================================
          const phase2Start = Date.now()

          // Create batch with only the root document
          const rootBatch = this.firestore.batch()
          const snapshotDocRef = this.getSnapshotDocRef(snapshotId)
          rootBatch.set(snapshotDocRef, rootDocument)

          // Execute root batch with retry - this MUST succeed before district writes
          // Requirement 3.2: Root document must complete before district batches begin
          // Requirement 5.4: If root fails, fail the entire operation
          const rootBatchResult = await this.executeBatchWithRetry(
            rootBatch,
            0 // Batch index 0 for root
          )

          const phase2Duration = Date.now() - phase2Start

          if (!rootBatchResult.success) {
            // Root batch failed - fail fast without writing any districts
            logger.error('Root document batch failed - aborting snapshot write', {
              operation: 'writeSnapshot',
              snapshot_id: snapshotId,
              phase: 'root',
              duration_ms: phase2Duration,
              retryAttempts: rootBatchResult.retryAttempts,
              error: rootBatchResult.error,
            })

            throw new StorageOperationError(
              `Failed to write snapshot ${snapshotId}: Root document batch failed after ${rootBatchResult.retryAttempts} retries (batch 0, phase: root) - ${rootBatchResult.error}`,
              'writeSnapshot',
              'firestore',
              false // Not retryable at this level - retries already exhausted
            )
          }

          logger.info('Phase 2 complete: Root document written successfully', {
            operation: 'writeSnapshot',
            snapshot_id: snapshotId,
            phase: 'root',
            duration_ms: phase2Duration,
            retryAttempts: rootBatchResult.retryAttempts,
          })

          // ================================================================
          // Phase 3: Chunk and write district documents with concurrency
          // ================================================================
          const phase3Start = Date.now()

          // Collect all batch results for aggregation
          const allBatchResults: BatchWriteResult[] = [rootBatchResult]

          // Only process districts if there are any
          if (snapshot.payload.districts.length > 0) {
            // Chunk districts into batches for parallel processing
            const districtBatches = this.chunkDistrictDocumentsOnly(
              snapshot.payload.districts,
              snapshotId
            )

            logger.info('Phase 3: Processing district batches with concurrency', {
              operation: 'writeSnapshot',
              snapshot_id: snapshotId,
              phase: 'districts',
              totalDistricts: snapshot.payload.districts.length,
              totalBatches: districtBatches.length,
              maxConcurrentBatches: this.batchWriteConfig.maxConcurrentBatches,
            })

            // Process district batches with controlled concurrency
            // Start index is 1 since batch 0 was the root document
            const districtBatchResults = await this.processBatchesWithConcurrency(
              districtBatches,
              1 // Start at batch index 1
            )

            allBatchResults.push(...districtBatchResults)
          }

          const phase3Duration = Date.now() - phase3Start

          // ================================================================
          // Phase 4: Aggregate results into SnapshotWriteResult
          // ================================================================
          const totalDuration = Date.now() - startTime

          // Calculate success/failure counts
          const successfulBatches = allBatchResults.filter(r => r.success).length
          const failedBatches = allBatchResults.filter(r => !r.success).length

          // Collect district IDs from successful and failed batches
          const successfulDistrictIds: string[] = []
          const failedDistrictIds: string[] = []

          for (const result of allBatchResults) {
            // Skip root batch (no districtIds)
            if (result.districtIds) {
              if (result.success) {
                successfulDistrictIds.push(...result.districtIds)
              } else {
                failedDistrictIds.push(...result.districtIds)
              }
            }
          }

          // Build aggregate result
          const writeResult: SnapshotWriteResult = {
            snapshotId,
            complete: failedBatches === 0,
            totalBatches: allBatchResults.length,
            successfulBatches,
            failedBatches,
            districtsWritten: successfulDistrictIds.length,
            failedDistricts: failedDistrictIds,
            totalDurationMs: totalDuration,
            batchResults: allBatchResults,
          }

          // ================================================================
          // Phase 5: Handle partial success (update manifest if needed)
          // Requirements: 5.1, 5.2, 5.3
          // ================================================================
          if (!writeResult.complete) {
            // Some district batches failed - update the root document to reflect partial success
            logger.warn('Snapshot write completed with partial success', {
              operation: 'writeSnapshot',
              snapshot_id: snapshotId,
              complete: false,
              totalBatches: writeResult.totalBatches,
              successfulBatches: writeResult.successfulBatches,
              failedBatches: writeResult.failedBatches,
              districtsWritten: writeResult.districtsWritten,
              failedDistricts: writeResult.failedDistricts,
              totalDuration_ms: totalDuration,
              phase1Duration_ms: phase1Duration,
              phase2Duration_ms: phase2Duration,
              phase3Duration_ms: phase3Duration,
            })

            // Build updated manifest entries with failed status for failed districts
            // Requirement 5.1: Update manifest to reflect actual successful districts
            const failedDistrictSet = new Set(writeResult.failedDistricts)
            const updatedManifestEntries: DistrictManifestEntry[] =
              manifestEntries.map(entry => {
                if (failedDistrictSet.has(entry.districtId)) {
                  return {
                    ...entry,
                    status: 'failed' as const,
                    errorMessage: 'Failed to write district document after retries',
                  }
                }
                return entry
              })

            // Build partial update for the root document
            // Using Firestore update() to only modify changed fields
            const partialUpdate = {
              // Update manifest with failed district statuses
              // Requirement 5.1: Update manifest.districts to reflect actual successes
              'manifest.districts': updatedManifestEntries,
              'manifest.successfulDistricts': writeResult.districtsWritten,
              'manifest.failedDistricts': writeResult.failedDistricts.length,

              // Update metadata to indicate partial write
              // Requirement 5.2: Set metadata.writeComplete = false if any failures
              'metadata.writeComplete': false,

              // Requirement 5.3: Set metadata.writeFailedDistricts with failed IDs
              'metadata.writeFailedDistricts': writeResult.failedDistricts,

              // Update metadata.failedDistricts to include write failures
              'metadata.failedDistricts': writeResult.failedDistricts,

              // Update metadata.successfulDistricts to reflect actual successes
              'metadata.successfulDistricts': successfulDistrictIds,
            }

            // Write the partial update to Firestore
            try {
              await snapshotDocRef.update(partialUpdate)

              logger.info('Updated root document with partial success status', {
                operation: 'writeSnapshot',
                snapshot_id: snapshotId,
                phase: 'partial-update',
                failedDistrictCount: writeResult.failedDistricts.length,
                successfulDistrictCount: writeResult.districtsWritten,
              })
            } catch (updateError) {
              // Log the update failure but don't throw - the snapshot is still partially written
              // The original manifest/metadata in Firestore may not reflect the actual state
              logger.error('Failed to update root document with partial success status', {
                operation: 'writeSnapshot',
                snapshot_id: snapshotId,
                phase: 'partial-update',
                error: updateError instanceof Error ? updateError.message : 'Unknown error',
                failedDistricts: writeResult.failedDistricts,
              })
            }
          } else {
            // All batches succeeded - update metadata to indicate complete write
            // For successful writes, we set writeComplete = true explicitly
            // This provides a clear signal that the write completed fully
            try {
              await snapshotDocRef.update({
                'metadata.writeComplete': true,
              })
            } catch (updateError) {
              // Log but don't fail - the snapshot is fully written, just metadata flag missing
              logger.warn('Failed to set writeComplete flag on successful write', {
                operation: 'writeSnapshot',
                snapshot_id: snapshotId,
                error: updateError instanceof Error ? updateError.message : 'Unknown error',
              })
            }

            // All batches succeeded
            logger.info('Snapshot write completed successfully', {
              operation: 'writeSnapshot',
              snapshot_id: snapshotId,
              complete: true,
              totalBatches: writeResult.totalBatches,
              districtsWritten: writeResult.districtsWritten,
              totalDuration_ms: totalDuration,
              phase1Duration_ms: phase1Duration,
              phase2Duration_ms: phase2Duration,
              phase3Duration_ms: phase3Duration,
            })
          }
        },
        { operation: 'writeSnapshot', snapshotId }
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      const totalDuration = Date.now() - startTime

      logger.error('Failed to write snapshot', {
        operation: 'writeSnapshot',
        snapshot_id: snapshotId,
        error: errorMessage,
        duration_ms: totalDuration,
      })

      // Re-throw StorageOperationError as-is, wrap other errors
      if (error instanceof StorageOperationError) {
        throw error
      }

      throw new StorageOperationError(
        `Failed to write snapshot ${snapshotId}: ${errorMessage}`,
        'writeSnapshot',
        'firestore',
        this.isRetryableError(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Chunk district documents into batches for writing (districts only, no root document)
   *
   * This is a variant of chunkDistrictDocuments that does NOT reserve space
   * for the root document. It's used when the root document is written in a
   * separate batch before district batches.
   *
   * Each batch can hold up to maxOperationsPerBatch district documents.
   *
   * @param districts - Array of district statistics to write
   * @param snapshotId - The snapshot ID (used for document paths)
   * @returns Array of batch objects with their associated district IDs
   *
   * @example
   * ```typescript
   * // With maxOperationsPerBatch = 50 and 132 districts:
   * // Batch 0: 50 districts
   * // Batch 1: 50 districts
   * // Batch 2: 32 districts
   * const batches = this.chunkDistrictDocumentsOnly(districts, '2024-01-15')
   * // batches.length === 3
   * ```
   *
   * Requirements: 1.1, 1.2
   */
  private chunkDistrictDocumentsOnly(
    districts: DistrictStatistics[],
    snapshotId: string
  ): Array<{ batch: WriteBatch; districtIds: string[] }> {
    const { maxOperationsPerBatch } = this.batchWriteConfig
    const result: Array<{ batch: WriteBatch; districtIds: string[] }> = []

    // Get the districts subcollection reference
    const districtsCollection = this.getDistrictsCollection(snapshotId)

    // Track current position in the districts array
    let currentIndex = 0

    // Create batches of maxOperationsPerBatch districts each
    while (currentIndex < districts.length) {
      const batch = this.firestore.batch()
      const batchDistrictIds: string[] = []

      const batchEnd = Math.min(
        currentIndex + maxOperationsPerBatch,
        districts.length
      )

      for (let i = currentIndex; i < batchEnd; i++) {
        const district = districts[i]
        if (district) {
          const districtDoc: FirestoreDistrictDocument = {
            districtId: district.districtId,
            districtName: `District ${district.districtId}`,
            collectedAt: new Date().toISOString(),
            status: 'success',
            data: district,
          }
          const districtDocRef = districtsCollection.doc(
            `district_${district.districtId}`
          )
          batch.set(districtDocRef, districtDoc)
          batchDistrictIds.push(district.districtId)
        }
      }

      result.push({ batch, districtIds: batchDistrictIds })
      currentIndex = batchEnd
    }

    logger.debug('Chunked districts into batches (districts only)', {
      operation: 'chunkDistrictDocumentsOnly',
      snapshotId,
      totalDistricts: districts.length,
      totalBatches: result.length,
      maxOperationsPerBatch,
      batchSizes: result.map(b => b.districtIds.length),
    })

    return result
  }

  /**
   * List snapshots with optional filtering and limiting
   *
   * @param limit - Maximum number of snapshots to return
   * @param filters - Optional filters for status, version, date range, etc.
   * @returns Array of snapshot metadata sorted by creation date (newest first)
   */
  async listSnapshots(
    limit?: number,
    filters?: SnapshotFilters
  ): Promise<SnapshotMetadata[]> {
    const startTime = Date.now()

    logger.info('Starting listSnapshots operation', {
      operation: 'listSnapshots',
      limit,
      filters,
    })

    try {
      return await this.circuitBreaker.execute(
        async () => {
          let query = this.snapshotsCollection.orderBy('__name__', 'desc')

          // Apply filters
          if (filters?.status) {
            query = query.where('metadata.status', '==', filters.status)
          }
          if (filters?.schema_version) {
            query = query.where(
              'metadata.schemaVersion',
              '==',
              filters.schema_version
            )
          }
          if (filters?.calculation_version) {
            query = query.where(
              'metadata.calculationVersion',
              '==',
              filters.calculation_version
            )
          }

          // Apply limit
          if (limit && limit > 0) {
            query = query.limit(limit)
          }

          const querySnapshot = await query.get()

          const metadataList: SnapshotMetadata[] = []

          for (const doc of querySnapshot.docs) {
            const data = doc.data() as FirestoreSnapshotDocument
            const metadata = data.metadata

            // Apply date filters (can't be done in Firestore query easily)
            if (
              filters?.created_after &&
              metadata.createdAt < filters.created_after
            ) {
              continue
            }
            if (
              filters?.created_before &&
              metadata.createdAt > filters.created_before
            ) {
              continue
            }

            const districtCount = metadata.successfulDistricts.length
            if (
              filters?.min_district_count &&
              districtCount < filters.min_district_count
            ) {
              continue
            }

            metadataList.push({
              snapshot_id: doc.id,
              created_at: metadata.createdAt,
              status: metadata.status,
              schema_version: metadata.schemaVersion,
              calculation_version: metadata.calculationVersion,
              size_bytes: 0, // Not tracked in Firestore
              error_count: metadata.errors.length,
              district_count: districtCount,
            })
          }

          logger.info('Successfully listed snapshots', {
            operation: 'listSnapshots',
            count: metadataList.length,
            duration_ms: Date.now() - startTime,
          })

          return metadataList
        },
        { operation: 'listSnapshots' }
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      // Handle index errors gracefully - return empty array instead of throwing
      // This allows the application to continue operating with reduced functionality
      // when Firestore indexes are not yet deployed
      if (isIndexError(error)) {
        const indexUrl = error instanceof Error ? extractIndexUrl(error) : null
        logger.warn('Firestore query failed due to missing index', {
          operation: 'listSnapshots',
          error: errorMessage,
          indexUrl,
          recommendation:
            'Deploy indexes using: firebase deploy --only firestore:indexes',
        })
        return []
      }

      logger.error('Failed to list snapshots', {
        operation: 'listSnapshots',
        error: errorMessage,
        duration_ms: Date.now() - startTime,
      })

      throw new StorageOperationError(
        `Failed to list snapshots: ${errorMessage}`,
        'listSnapshots',
        'firestore',
        this.isRetryableError(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Get a specific snapshot by ID
   *
   * @param snapshotId - The unique identifier of the snapshot (YYYY-MM-DD)
   * @returns The snapshot or null if not found
   */
  async getSnapshot(snapshotId: string): Promise<Snapshot | null> {
    const startTime = Date.now()
    this.validateSnapshotId(snapshotId)

    logger.info('Starting getSnapshot operation', {
      operation: 'getSnapshot',
      snapshot_id: snapshotId,
    })

    try {
      return await this.circuitBreaker.execute(
        async () => {
          const snapshot = await this.buildSnapshotFromDocument(snapshotId)

          if (snapshot) {
            logger.info('Successfully retrieved snapshot', {
              operation: 'getSnapshot',
              snapshot_id: snapshotId,
              status: snapshot.status,
              district_count: snapshot.payload.districts.length,
              duration_ms: Date.now() - startTime,
            })
          } else {
            logger.info('Snapshot not found', {
              operation: 'getSnapshot',
              snapshot_id: snapshotId,
              duration_ms: Date.now() - startTime,
            })
          }

          return snapshot
        },
        { operation: 'getSnapshot', snapshotId }
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to get snapshot', {
        operation: 'getSnapshot',
        snapshot_id: snapshotId,
        error: errorMessage,
        duration_ms: Date.now() - startTime,
      })

      throw new StorageOperationError(
        `Failed to get snapshot ${snapshotId}: ${errorMessage}`,
        'getSnapshot',
        'firestore',
        this.isRetryableError(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Delete a snapshot and all its associated data
   *
   * Removes the snapshot document and all district documents in the
   * districts subcollection. Uses batched deletes for efficiency when
   * there are many district documents (max 500 operations per batch).
   *
   * Does NOT handle cascading deletion of time-series or analytics data -
   * that responsibility belongs to the calling code (e.g., admin routes).
   *
   * @param snapshotId - The snapshot ID (ISO date format: YYYY-MM-DD)
   * @returns true if the snapshot was successfully deleted, false if it didn't exist
   * @throws StorageOperationError on deletion failure
   *
   * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
   */
  async deleteSnapshot(snapshotId: string): Promise<boolean> {
    const startTime = Date.now()
    this.validateSnapshotId(snapshotId)

    logger.info('Starting deleteSnapshot operation', {
      operation: 'deleteSnapshot',
      snapshot_id: snapshotId,
    })

    try {
      return await this.circuitBreaker.execute(
        async () => {
          const snapshotDocRef = this.getSnapshotDocRef(snapshotId)
          const docSnapshot = await snapshotDocRef.get()

          if (!docSnapshot.exists) {
            logger.info('Snapshot not found for deletion', {
              operation: 'deleteSnapshot',
              snapshot_id: snapshotId,
              duration_ms: Date.now() - startTime,
            })
            return false
          }

          // Delete all documents in the districts subcollection
          const districtsCollection = this.getDistrictsCollection(snapshotId)
          const districtsSnapshot = await districtsCollection.get()

          // Use batched deletes for efficiency (max 500 operations per batch)
          const batchSize = 500
          let deletedCount = 0

          for (let i = 0; i < districtsSnapshot.docs.length; i += batchSize) {
            const batch = this.firestore.batch()
            const chunk = districtsSnapshot.docs.slice(i, i + batchSize)

            for (const doc of chunk) {
              batch.delete(doc.ref)
              deletedCount++
            }

            await batch.commit()
          }

          // Delete the root snapshot document
          await snapshotDocRef.delete()

          logger.info('Successfully deleted snapshot', {
            operation: 'deleteSnapshot',
            snapshot_id: snapshotId,
            districts_deleted: deletedCount,
            duration_ms: Date.now() - startTime,
          })

          return true
        },
        { operation: 'deleteSnapshot', snapshotId }
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to delete snapshot', {
        operation: 'deleteSnapshot',
        snapshot_id: snapshotId,
        error: errorMessage,
        duration_ms: Date.now() - startTime,
      })

      throw new StorageOperationError(
        `Failed to delete snapshot ${snapshotId}: ${errorMessage}`,
        'deleteSnapshot',
        'firestore',
        this.isRetryableError(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Check if the storage is properly initialized and accessible
   *
   * Performs two checks:
   * 1. Basic connectivity - verifies Firestore is reachable
   * 2. Index health - verifies required composite indexes are available
   *
   * Both checks must pass for the storage to be considered ready.
   *
   * @returns True if the storage is ready for operations (connectivity + indexes)
   *
   * Validates: Requirements 5.6
   */
  async isReady(): Promise<boolean> {
    try {
      // Step 1: Attempt a simple read operation to verify connectivity
      await this.snapshotsCollection.limit(1).get()

      // Step 2: Verify index health
      const indexHealth = await this.isIndexHealthy()
      if (!indexHealth.healthy) {
        logger.warn('Firestore storage not ready - indexes unhealthy', {
          operation: 'isReady',
          missingIndexes: indexHealth.missingIndexes,
          indexCreationUrls: indexHealth.indexCreationUrls,
          recommendation:
            'Deploy indexes using: firebase deploy --only firestore:indexes',
        })
        return false
      }

      return true
    } catch (error) {
      logger.warn('Firestore storage not ready', {
        operation: 'isReady',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      return false
    }
  }

  /**
   * Validates that required Firestore composite indexes are available
   *
   * Executes a minimal query that requires the composite index to verify
   * index availability. This allows proactive detection of missing indexes
   * before they affect user-facing operations.
   *
   * @returns IndexHealthResult with diagnostic information
   *
   * @example
   * ```typescript
   * const result = await storage.isIndexHealthy()
   * if (!result.healthy) {
   *   console.log('Missing indexes:', result.missingIndexes)
   *   console.log('Create them at:', result.indexCreationUrls)
   * }
   * ```
   *
   * Validates: Requirements 5.1, 5.2, 5.3, 5.4
   */
  async isIndexHealthy(): Promise<IndexHealthResult> {
    const startTime = Date.now()

    logger.info('Starting isIndexHealthy operation', {
      operation: 'isIndexHealthy',
      collection: this.collectionName,
    })

    try {
      // Execute a minimal query that requires the composite index
      // This query uses orderBy __name__ desc which requires an index
      await this.snapshotsCollection.orderBy('__name__', 'desc').limit(1).get()

      logger.info('Index health check passed', {
        operation: 'isIndexHealthy',
        healthy: true,
        duration_ms: Date.now() - startTime,
      })

      return {
        healthy: true,
        missingIndexes: [],
        indexCreationUrls: [],
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      // Check if this is an index error
      if (isIndexError(error)) {
        const indexUrl = error instanceof Error ? extractIndexUrl(error) : null

        logger.warn('Index health check failed - missing index detected', {
          operation: 'isIndexHealthy',
          healthy: false,
          error: errorMessage,
          indexUrl,
          recommendation:
            'Deploy indexes using: firebase deploy --only firestore:indexes',
          duration_ms: Date.now() - startTime,
        })

        return {
          healthy: false,
          missingIndexes: ['snapshots collection index'],
          indexCreationUrls: indexUrl ? [indexUrl] : [],
        }
      }

      // For non-index errors, log and return unhealthy
      // This follows the graceful degradation pattern
      logger.error('Index health check failed with unexpected error', {
        operation: 'isIndexHealthy',
        healthy: false,
        error: errorMessage,
        duration_ms: Date.now() - startTime,
      })

      return {
        healthy: false,
        missingIndexes: ['snapshots collection index (check failed)'],
        indexCreationUrls: [],
      }
    }
  }

  // ============================================================================
  // Per-District Operations
  // ============================================================================

  /**
   * Write district data to a snapshot
   *
   * @param snapshotId - The snapshot ID (ISO date format: YYYY-MM-DD)
   * @param districtId - The district identifier
   * @param data - The district statistics to store
   */
  async writeDistrictData(
    snapshotId: string,
    districtId: string,
    data: DistrictStatistics
  ): Promise<void> {
    const startTime = Date.now()
    this.validateSnapshotId(snapshotId)
    this.validateDistrictId(districtId)

    logger.debug('Starting writeDistrictData operation', {
      operation: 'writeDistrictData',
      snapshot_id: snapshotId,
      district_id: districtId,
    })

    try {
      await this.circuitBreaker.execute(
        async () => {
          const districtDoc: FirestoreDistrictDocument = {
            districtId,
            districtName: `District ${districtId}`,
            collectedAt: new Date().toISOString(),
            status: 'success',
            data,
          }

          const districtDocRef = this.getDistrictsCollection(snapshotId).doc(
            `district_${districtId}`
          )
          await districtDocRef.set(districtDoc)

          logger.debug('Successfully wrote district data', {
            operation: 'writeDistrictData',
            snapshot_id: snapshotId,
            district_id: districtId,
            duration_ms: Date.now() - startTime,
          })
        },
        { operation: 'writeDistrictData', snapshotId, districtId }
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to write district data', {
        operation: 'writeDistrictData',
        snapshot_id: snapshotId,
        district_id: districtId,
        error: errorMessage,
        duration_ms: Date.now() - startTime,
      })

      throw new StorageOperationError(
        `Failed to write district data for ${districtId}: ${errorMessage}`,
        'writeDistrictData',
        'firestore',
        this.isRetryableError(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Read district data from a snapshot
   *
   * @param snapshotId - The snapshot ID (ISO date format: YYYY-MM-DD)
   * @param districtId - The district identifier
   * @returns District statistics or null if not found
   */
  async readDistrictData(
    snapshotId: string,
    districtId: string
  ): Promise<DistrictStatistics | null> {
    const startTime = Date.now()
    this.validateSnapshotId(snapshotId)
    this.validateDistrictId(districtId)

    logger.debug('Starting readDistrictData operation', {
      operation: 'readDistrictData',
      snapshot_id: snapshotId,
      district_id: districtId,
    })

    try {
      return await this.circuitBreaker.execute(
        async () => {
          const districtDocRef = this.getDistrictsCollection(snapshotId).doc(
            `district_${districtId}`
          )
          const docSnapshot = await districtDocRef.get()

          if (!docSnapshot.exists) {
            logger.debug('District data not found', {
              operation: 'readDistrictData',
              snapshot_id: snapshotId,
              district_id: districtId,
              duration_ms: Date.now() - startTime,
            })
            return null
          }

          const districtDoc = docSnapshot.data() as FirestoreDistrictDocument

          if (districtDoc.status !== 'success') {
            logger.debug('District data exists but status is not success', {
              operation: 'readDistrictData',
              snapshot_id: snapshotId,
              district_id: districtId,
              status: districtDoc.status,
              duration_ms: Date.now() - startTime,
            })
            return null
          }

          logger.debug('Successfully read district data', {
            operation: 'readDistrictData',
            snapshot_id: snapshotId,
            district_id: districtId,
            duration_ms: Date.now() - startTime,
          })

          return districtDoc.data
        },
        { operation: 'readDistrictData', snapshotId, districtId }
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to read district data', {
        operation: 'readDistrictData',
        snapshot_id: snapshotId,
        district_id: districtId,
        error: errorMessage,
        duration_ms: Date.now() - startTime,
      })

      throw new StorageOperationError(
        `Failed to read district data for ${districtId}: ${errorMessage}`,
        'readDistrictData',
        'firestore',
        this.isRetryableError(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * List all districts in a snapshot
   *
   * @param snapshotId - The snapshot ID (ISO date format: YYYY-MM-DD)
   * @returns Array of district IDs
   */
  async listDistrictsInSnapshot(snapshotId: string): Promise<string[]> {
    const startTime = Date.now()
    this.validateSnapshotId(snapshotId)

    logger.debug('Starting listDistrictsInSnapshot operation', {
      operation: 'listDistrictsInSnapshot',
      snapshot_id: snapshotId,
    })

    try {
      return await this.circuitBreaker.execute(
        async () => {
          const manifest = await this.getSnapshotManifest(snapshotId)
          if (!manifest) {
            return []
          }

          const districtIds = manifest.districts
            .filter(d => d.status === 'success')
            .map(d => d.districtId)

          logger.debug('Successfully listed districts in snapshot', {
            operation: 'listDistrictsInSnapshot',
            snapshot_id: snapshotId,
            district_count: districtIds.length,
            duration_ms: Date.now() - startTime,
          })

          return districtIds
        },
        { operation: 'listDistrictsInSnapshot', snapshotId }
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to list districts in snapshot', {
        operation: 'listDistrictsInSnapshot',
        snapshot_id: snapshotId,
        error: errorMessage,
        duration_ms: Date.now() - startTime,
      })

      // Return empty array on error (consistent with LocalSnapshotStorage)
      return []
    }
  }

  /**
   * Get snapshot manifest
   *
   * @param snapshotId - The snapshot ID (ISO date format: YYYY-MM-DD)
   * @returns Snapshot manifest or null if not found
   */
  async getSnapshotManifest(
    snapshotId: string
  ): Promise<SnapshotManifest | null> {
    const startTime = Date.now()
    this.validateSnapshotId(snapshotId)

    logger.debug('Starting getSnapshotManifest operation', {
      operation: 'getSnapshotManifest',
      snapshot_id: snapshotId,
    })

    try {
      return await this.circuitBreaker.execute(
        async () => {
          const docSnapshot = await this.getSnapshotDocRef(snapshotId).get()

          if (!docSnapshot.exists) {
            logger.debug('Snapshot manifest not found', {
              operation: 'getSnapshotManifest',
              snapshot_id: snapshotId,
              duration_ms: Date.now() - startTime,
            })
            return null
          }

          const data = docSnapshot.data() as FirestoreSnapshotDocument

          logger.debug('Successfully retrieved snapshot manifest', {
            operation: 'getSnapshotManifest',
            snapshot_id: snapshotId,
            total_districts: data.manifest.totalDistricts,
            duration_ms: Date.now() - startTime,
          })

          return data.manifest
        },
        { operation: 'getSnapshotManifest', snapshotId }
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to get snapshot manifest', {
        operation: 'getSnapshotManifest',
        snapshot_id: snapshotId,
        error: errorMessage,
        duration_ms: Date.now() - startTime,
      })

      throw new StorageOperationError(
        `Failed to get snapshot manifest for ${snapshotId}: ${errorMessage}`,
        'getSnapshotManifest',
        'firestore',
        this.isRetryableError(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Get snapshot metadata
   *
   * @param snapshotId - The snapshot ID (ISO date format: YYYY-MM-DD)
   * @returns Snapshot metadata or null if not found
   */
  async getSnapshotMetadata(
    snapshotId: string
  ): Promise<PerDistrictSnapshotMetadata | null> {
    const startTime = Date.now()
    this.validateSnapshotId(snapshotId)

    logger.debug('Starting getSnapshotMetadata operation', {
      operation: 'getSnapshotMetadata',
      snapshot_id: snapshotId,
    })

    try {
      return await this.circuitBreaker.execute(
        async () => {
          const docSnapshot = await this.getSnapshotDocRef(snapshotId).get()

          if (!docSnapshot.exists) {
            logger.debug('Snapshot metadata not found', {
              operation: 'getSnapshotMetadata',
              snapshot_id: snapshotId,
              duration_ms: Date.now() - startTime,
            })
            return null
          }

          const data = docSnapshot.data() as FirestoreSnapshotDocument

          logger.debug('Successfully retrieved snapshot metadata', {
            operation: 'getSnapshotMetadata',
            snapshot_id: snapshotId,
            status: data.metadata.status,
            duration_ms: Date.now() - startTime,
          })

          return data.metadata
        },
        { operation: 'getSnapshotMetadata', snapshotId }
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to get snapshot metadata', {
        operation: 'getSnapshotMetadata',
        snapshot_id: snapshotId,
        error: errorMessage,
        duration_ms: Date.now() - startTime,
      })

      throw new StorageOperationError(
        `Failed to get snapshot metadata for ${snapshotId}: ${errorMessage}`,
        'getSnapshotMetadata',
        'firestore',
        this.isRetryableError(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  // ============================================================================
  // Rankings Operations
  // ============================================================================

  /**
   * Write all-districts rankings data to a snapshot
   *
   * @param snapshotId - The snapshot ID (ISO date format: YYYY-MM-DD)
   * @param rankingsData - The rankings data to store
   */
  async writeAllDistrictsRankings(
    snapshotId: string,
    rankingsData: AllDistrictsRankingsData
  ): Promise<void> {
    const startTime = Date.now()
    this.validateSnapshotId(snapshotId)

    logger.info('Starting writeAllDistrictsRankings operation', {
      operation: 'writeAllDistrictsRankings',
      snapshot_id: snapshotId,
      rankings_count: rankingsData.rankings.length,
    })

    try {
      await this.circuitBreaker.execute(
        async () => {
          const snapshotDocRef = this.getSnapshotDocRef(snapshotId)
          const docSnapshot = await snapshotDocRef.get()

          if (!docSnapshot.exists) {
            throw new StorageOperationError(
              `Snapshot ${snapshotId} does not exist`,
              'writeAllDistrictsRankings',
              'firestore',
              false
            )
          }

          // Update the rankings field and manifest
          const updatedRankingsData = {
            ...rankingsData,
            metadata: {
              ...rankingsData.metadata,
              snapshotId,
            },
          }

          await snapshotDocRef.update({
            rankings: updatedRankingsData,
            'manifest.allDistrictsRankings': {
              filename: 'rankings',
              size: 0,
              status: 'present',
            },
          })

          logger.info('Successfully wrote all-districts rankings', {
            operation: 'writeAllDistrictsRankings',
            snapshot_id: snapshotId,
            rankings_count: rankingsData.rankings.length,
            duration_ms: Date.now() - startTime,
          })
        },
        { operation: 'writeAllDistrictsRankings', snapshotId }
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to write all-districts rankings', {
        operation: 'writeAllDistrictsRankings',
        snapshot_id: snapshotId,
        error: errorMessage,
        duration_ms: Date.now() - startTime,
      })

      throw new StorageOperationError(
        `Failed to write all-districts rankings for ${snapshotId}: ${errorMessage}`,
        'writeAllDistrictsRankings',
        'firestore',
        this.isRetryableError(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Read all-districts rankings data from a snapshot
   *
   * @param snapshotId - The snapshot ID (ISO date format: YYYY-MM-DD)
   * @returns Rankings data or null if not found
   */
  async readAllDistrictsRankings(
    snapshotId: string
  ): Promise<AllDistrictsRankingsData | null> {
    const startTime = Date.now()
    this.validateSnapshotId(snapshotId)

    logger.debug('Starting readAllDistrictsRankings operation', {
      operation: 'readAllDistrictsRankings',
      snapshot_id: snapshotId,
    })

    try {
      return await this.circuitBreaker.execute(
        async () => {
          const docSnapshot = await this.getSnapshotDocRef(snapshotId).get()

          if (!docSnapshot.exists) {
            logger.debug('Snapshot not found for rankings read', {
              operation: 'readAllDistrictsRankings',
              snapshot_id: snapshotId,
              duration_ms: Date.now() - startTime,
            })
            return null
          }

          const data = docSnapshot.data() as FirestoreSnapshotDocument

          if (!data.rankings) {
            logger.debug('Rankings data not found in snapshot', {
              operation: 'readAllDistrictsRankings',
              snapshot_id: snapshotId,
              duration_ms: Date.now() - startTime,
            })
            return null
          }

          logger.debug('Successfully read all-districts rankings', {
            operation: 'readAllDistrictsRankings',
            snapshot_id: snapshotId,
            rankings_count: data.rankings.rankings.length,
            duration_ms: Date.now() - startTime,
          })

          return data.rankings
        },
        { operation: 'readAllDistrictsRankings', snapshotId }
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to read all-districts rankings', {
        operation: 'readAllDistrictsRankings',
        snapshot_id: snapshotId,
        error: errorMessage,
        duration_ms: Date.now() - startTime,
      })

      throw new StorageOperationError(
        `Failed to read all-districts rankings for ${snapshotId}: ${errorMessage}`,
        'readAllDistrictsRankings',
        'firestore',
        this.isRetryableError(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Check if all-districts rankings exist for a snapshot
   *
   * @param snapshotId - The snapshot ID (ISO date format: YYYY-MM-DD)
   * @returns True if rankings data exists
   */
  async hasAllDistrictsRankings(snapshotId: string): Promise<boolean> {
    const startTime = Date.now()
    this.validateSnapshotId(snapshotId)

    logger.debug('Starting hasAllDistrictsRankings operation', {
      operation: 'hasAllDistrictsRankings',
      snapshot_id: snapshotId,
    })

    try {
      return await this.circuitBreaker.execute(
        async () => {
          const docSnapshot = await this.getSnapshotDocRef(snapshotId).get()

          if (!docSnapshot.exists) {
            return false
          }

          const data = docSnapshot.data() as FirestoreSnapshotDocument
          const hasRankings = !!data.rankings

          logger.debug('Checked for all-districts rankings', {
            operation: 'hasAllDistrictsRankings',
            snapshot_id: snapshotId,
            has_rankings: hasRankings,
            duration_ms: Date.now() - startTime,
          })

          return hasRankings
        },
        { operation: 'hasAllDistrictsRankings', snapshotId }
      )
    } catch (error) {
      logger.warn('Failed to check for all-districts rankings', {
        operation: 'hasAllDistrictsRankings',
        snapshot_id: snapshotId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration_ms: Date.now() - startTime,
      })
      return false
    }
  }

  // ============================================================================
  // Write Completion Check
  // ============================================================================

  /**
   * Check if a snapshot write completed fully
   *
   * Determines whether a snapshot was fully written or if some districts
   * failed during the chunked write process. This method reads the snapshot's
   * metadata and checks the `writeComplete` field.
   *
   * Return value logic:
   * - Returns `true` if `writeComplete` is `true` (fully written)
   * - Returns `true` if `writeComplete` is `undefined` (backward compatibility for legacy snapshots)
   * - Returns `false` if `writeComplete` is `false` (partial write)
   * - Returns `false` if the snapshot doesn't exist
   *
   * @param snapshotId - The snapshot ID to check (ISO date format: YYYY-MM-DD)
   * @returns true if the write completed fully (or for legacy snapshots without the field),
   *          false if the write was partial or snapshot doesn't exist
   *
   * @example
   * ```typescript
   * const isComplete = await storage.isSnapshotWriteComplete('2024-01-15')
   * if (!isComplete) {
   *   console.log('Snapshot has partial data - some districts may be missing')
   * }
   * ```
   *
   * Requirements: 5.5
   */
  async isSnapshotWriteComplete(snapshotId: string): Promise<boolean> {
    const startTime = Date.now()
    this.validateSnapshotId(snapshotId)

    logger.debug('Starting isSnapshotWriteComplete operation', {
      operation: 'isSnapshotWriteComplete',
      snapshot_id: snapshotId,
    })

    try {
      return await this.circuitBreaker.execute(
        async () => {
          // Read the snapshot metadata
          const metadata = await this.getSnapshotMetadata(snapshotId)

          if (!metadata) {
            // Snapshot doesn't exist - return false
            logger.debug('Snapshot not found for write completion check', {
              operation: 'isSnapshotWriteComplete',
              snapshot_id: snapshotId,
              result: false,
              reason: 'snapshot_not_found',
              duration_ms: Date.now() - startTime,
            })
            return false
          }

          // Check the writeComplete field
          // - true: write completed fully
          // - undefined: legacy snapshot (backward compatibility) - treat as complete
          // - false: partial write
          const writeComplete = metadata.writeComplete

          // For backward compatibility, undefined is treated as true
          // This handles legacy snapshots that don't have the writeComplete field
          const isComplete = writeComplete !== false

          logger.debug('Checked snapshot write completion', {
            operation: 'isSnapshotWriteComplete',
            snapshot_id: snapshotId,
            writeComplete,
            result: isComplete,
            reason: writeComplete === undefined ? 'legacy_snapshot' : 'explicit_value',
            duration_ms: Date.now() - startTime,
          })

          return isComplete
        },
        { operation: 'isSnapshotWriteComplete', snapshotId }
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logger.error('Failed to check snapshot write completion', {
        operation: 'isSnapshotWriteComplete',
        snapshot_id: snapshotId,
        error: errorMessage,
        duration_ms: Date.now() - startTime,
      })

      // On error, return false to be safe - caller should handle this case
      // This follows the pattern of graceful degradation
      return false
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Build a complete Snapshot object from a Firestore document
   *
   * Reads the root document and all district documents from the subcollection
   * to reconstruct the full Snapshot object.
   *
   * @param snapshotId - The snapshot document ID
   * @returns Complete Snapshot object or null if not found
   */
  private async buildSnapshotFromDocument(
    snapshotId: string
  ): Promise<Snapshot | null> {
    const docSnapshot = await this.getSnapshotDocRef(snapshotId).get()

    if (!docSnapshot.exists) {
      return null
    }

    const data = docSnapshot.data() as FirestoreSnapshotDocument
    const metadata = data.metadata

    // Read all district documents from subcollection
    const districtsSnapshot =
      await this.getDistrictsCollection(snapshotId).get()
    const districts: DistrictStatistics[] = []

    for (const districtDoc of districtsSnapshot.docs) {
      const districtData = districtDoc.data() as FirestoreDistrictDocument
      if (districtData.status === 'success') {
        districts.push(districtData.data)
      }
    }

    // Build the Snapshot object
    const snapshot: Snapshot = {
      snapshot_id: snapshotId,
      created_at: metadata.createdAt,
      schema_version: metadata.schemaVersion,
      calculation_version: metadata.calculationVersion,
      status: metadata.status,
      errors: metadata.errors,
      payload: {
        districts,
        metadata: {
          source: metadata.source,
          fetchedAt: metadata.createdAt,
          dataAsOfDate: metadata.dataAsOfDate,
          districtCount: districts.length,
          processingDurationMs: metadata.processingDuration,
          configuredDistricts: metadata.configuredDistricts,
          successfulDistricts: metadata.successfulDistricts,
          failedDistricts: metadata.failedDistricts,
          isClosingPeriodData: metadata.isClosingPeriodData,
          collectionDate: metadata.collectionDate,
          logicalDate: metadata.logicalDate,
        },
      },
    }

    return snapshot
  }
}
