/**
 * Firestore Snapshot Storage Types
 *
 * Type definitions for the Firestore snapshot storage implementation.
 * Extracted from FirestoreSnapshotStorage.ts for modularity.
 *
 * Includes:
 * - Firestore document structures
 * - Configuration types
 * - Batch write configuration and result types
 * - Index health result types
 */

import type { AllDistrictsRankingsData } from '../../../types/snapshots.js'
import type {
  SnapshotManifest,
  PerDistrictSnapshotMetadata,
} from '../../SnapshotStore.js'
import type { DistrictStatistics } from '../../../types/districts.js'

// ============================================================================
// Firestore Document Types
// ============================================================================

/**
 * Root snapshot document structure in Firestore
 */
export interface FirestoreSnapshotDocument {
  metadata: PerDistrictSnapshotMetadata
  manifest: SnapshotManifest
  rankings?: AllDistrictsRankingsData
}

/**
 * District subdocument structure in Firestore
 */
export interface FirestoreDistrictDocument {
  districtId: string
  districtName: string
  collectedAt: string
  status: 'success' | 'failed'
  errorMessage?: string
  data: DistrictStatistics
}

// ============================================================================
// Configuration Types
// ============================================================================

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

// ============================================================================
// Batch Write Result Types
// ============================================================================

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
