/**
 * Snapshot metadata file structure.
 * File location: snapshots/{date}/metadata.json
 *
 * This file contains metadata about a snapshot, including processing status,
 * version information, and optional closing period fields.
 */

/**
 * Snapshot metadata file structure.
 * Contains information about the snapshot creation, processing status,
 * and version compatibility.
 */
export interface SnapshotMetadataFile {
  /** Snapshot ID (date in YYYY-MM-DD format) */
  snapshotId: string
  /** ISO timestamp when snapshot was created */
  createdAt: string
  /** Schema version for data structure compatibility */
  schemaVersion: string
  /** Calculation version for business logic compatibility */
  calculationVersion: string
  /** Status of the snapshot */
  status: 'success' | 'partial' | 'failed'
  /** Districts that were configured for processing */
  configuredDistricts: string[]
  /** Districts that were successfully processed */
  successfulDistricts: string[]
  /** Districts that failed processing */
  failedDistricts: string[]
  /** Error messages (empty array for success) */
  errors: string[]
  /** Processing duration in milliseconds */
  processingDuration: number
  /** Source of the snapshot */
  source: string
  /** Date the data represents */
  dataAsOfDate: string

  // Optional closing period fields
  /** Whether this is closing period data */
  isClosingPeriodData?: boolean
  /** Actual collection date */
  collectionDate?: string
  /** Logical date for the snapshot */
  logicalDate?: string
}
