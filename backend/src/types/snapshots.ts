/**
 * Type definitions for snapshot-based data architecture
 *
 * This module defines the core types for the snapshot system that decouples
 * data refresh operations from read operations, ensuring consistent performance
 * and reliability.
 */

import type { DistrictStatistics } from './districts.js'

/**
 * Status of a snapshot indicating whether it was successfully created
 */
export type SnapshotStatus = 'success' | 'partial' | 'failed'

/**
 * Normalized application data structure contained within snapshots
 */
export interface NormalizedData {
  /** District-level statistics and performance data */
  districts: DistrictStatistics[]

  /** Metadata about the data source and collection process */
  metadata: {
    /** Source system identifier */
    source: string
    /** Timestamp when data was fetched from source */
    fetchedAt: string
    /** Date that the source data represents (business date) */
    dataAsOfDate: string
    /** Total number of districts processed */
    districtCount: number
    /** Processing duration in milliseconds */
    processingDurationMs: number
    /** Backfill job ID (optional, for backfill operations) */
    backfillJobId?: string
    /** List of districts configured for collection (optional) */
    configuredDistricts?: string[]
    /** List of districts that were successfully processed (optional) */
    successfulDistricts?: string[]
    /** List of districts that failed processing (optional) */
    failedDistricts?: string[]
    /** Detailed error information per district (optional) */
    districtErrors?: Array<{
      districtId: string
      districtName?: string
      error: string
      errorType:
        | 'fetch_failed'
        | 'validation_failed'
        | 'processing_failed'
        | 'scope_violation'
      timestamp: string
    }>
    /** Extended metadata for RefreshService compatibility and enhanced tracking */
    extendedMetadata?: {
      /** Collection method used (for RefreshService compatibility) */
      collectionMethod?: string
      /** Collection scope type (for RefreshService compatibility) */
      collectionScope?: string
      /** RefreshService method used (for RefreshService compatibility) */
      refreshMethod?: string
      /** Target districts for the operation (for RefreshService compatibility) */
      targetDistricts?: string[]
    }
  }
}

/**
 * Immutable, versioned snapshot of normalized application data
 */
export interface Snapshot {
  /** Unique identifier for this snapshot (timestamp-based) */
  snapshot_id: string

  /** ISO timestamp when this snapshot was created */
  created_at: string

  /** Version of the data structure schema */
  schema_version: string

  /** Version of the calculation/scoring logic applied */
  calculation_version: string

  /** Status indicating success or failure of snapshot creation */
  status: SnapshotStatus

  /** Error messages if snapshot creation failed */
  errors: string[]

  /** The actual normalized application data */
  payload: NormalizedData
}

/**
 * Lightweight metadata about a snapshot for listing and debugging
 */
export interface SnapshotMetadata {
  /** Unique identifier for this snapshot */
  snapshot_id: string

  /** ISO timestamp when this snapshot was created */
  created_at: string

  /** Status indicating success or failure */
  status: SnapshotStatus

  /** Version of the data structure schema */
  schema_version: string

  /** Version of the calculation/scoring logic applied */
  calculation_version: string

  /** Approximate size of the snapshot in bytes */
  size_bytes: number

  /** Number of errors recorded in this snapshot */
  error_count: number

  /** Number of districts included in this snapshot */
  district_count: number
}

/**
 * Filters for querying snapshots during debugging and analysis
 */
export interface SnapshotFilters {
  /** Filter by snapshot status */
  status?: SnapshotStatus

  /** Filter by schema version */
  schema_version?: string

  /** Filter by calculation version */
  calculation_version?: string

  /** Filter snapshots created after this date (ISO string) */
  created_after?: string

  /** Filter snapshots created before this date (ISO string) */
  created_before?: string

  /** Filter by minimum district count */
  min_district_count?: number
}

/**
 * Core interface for snapshot persistence and retrieval
 *
 * Provides a clean abstraction that enables future storage mechanism changes
 * without affecting business logic.
 */
export interface SnapshotStore {
  /**
   * Get the most recent successful snapshot
   * @returns Latest successful snapshot or null if none exists
   */
  getLatestSuccessful(): Promise<Snapshot | null>

  /**
   * Get the most recent snapshot regardless of status
   * @returns Latest snapshot or null if none exists
   */
  getLatest(): Promise<Snapshot | null>

  /**
   * Write a new snapshot atomically
   * @param snapshot The snapshot to persist
   */
  writeSnapshot(snapshot: Snapshot): Promise<void>

  /**
   * List snapshots with optional filtering and limiting
   * @param limit Maximum number of snapshots to return
   * @param filters Optional filters for debugging and analysis
   * @returns Array of snapshot metadata sorted by creation date (newest first)
   */
  listSnapshots(
    limit?: number,
    filters?: SnapshotFilters
  ): Promise<SnapshotMetadata[]>

  /**
   * Get a specific snapshot by ID
   * @param snapshotId The unique identifier of the snapshot
   * @returns The snapshot or null if not found
   */
  getSnapshot(snapshotId: string): Promise<Snapshot | null>

  /**
   * Check if the snapshot store is properly initialized and accessible
   * @returns True if the store is ready for operations
   */
  isReady(): Promise<boolean>
}

/**
 * Current snapshot pointer file content
 *
 * This file maintains an atomic reference to the latest successful snapshot
 */
export interface CurrentSnapshotPointer {
  /** ID of the current successful snapshot */
  snapshot_id: string

  /** Timestamp when this pointer was last updated */
  updated_at: string

  /** Schema version of the current snapshot */
  schema_version: string

  /** Calculation version of the current snapshot */
  calculation_version: string
}

/**
 * Configuration for snapshot storage
 */
export interface SnapshotStoreConfig {
  /** Base cache directory path */
  cacheDir: string

  /** Maximum number of snapshots to retain */
  maxSnapshots?: number

  /** Maximum age of snapshots to retain (in days) */
  maxAgeDays?: number

  /** Whether to compress snapshot files */
  enableCompression?: boolean
}

/**
 * Result of a snapshot validation operation
 */
export interface SnapshotValidationResult {
  /** Whether the snapshot is valid */
  isValid: boolean

  /** Validation error messages */
  errors: string[]

  /** Validation warning messages */
  warnings: string[]

  /** Metadata about the validation process */
  validationMetadata: {
    /** Timestamp when validation was performed */
    validatedAt: string
    /** Version of the validation rules used */
    validatorVersion: string
    /** Duration of validation in milliseconds */
    validationDurationMs: number
  }
}

/**
 * Service token for dependency injection of SnapshotStore
 */
export const SNAPSHOT_STORE_TOKEN = {
  name: 'SnapshotStore',
  interfaceType: 'ISnapshotStore',
} as const

/**
 * Current schema version for snapshots
 *
 * This should be incremented when the NormalizedData structure changes
 * in a way that affects compatibility.
 */
export const CURRENT_SCHEMA_VERSION = '1.0.0'

/**
 * Current calculation version for snapshots
 *
 * This should be incremented when the business logic for computing
 * derived metrics changes.
 */
export const CURRENT_CALCULATION_VERSION = '1.0.0'
