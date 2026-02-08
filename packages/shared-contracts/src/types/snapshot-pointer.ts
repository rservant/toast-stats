/**
 * Snapshot pointer file structure.
 * File location: snapshots/latest-successful.json
 *
 * This file contains a pointer to the most recent successful snapshot,
 * allowing the backend to resolve the latest snapshot in constant time
 * on startup instead of scanning all snapshot directories.
 */

/**
 * Snapshot pointer file structure.
 * Contains the snapshot ID of the most recent successful snapshot,
 * along with metadata for validation and compatibility checking.
 */
export interface SnapshotPointer {
  /** Snapshot ID (date in YYYY-MM-DD format) */
  snapshotId: string
  /** ISO timestamp when the pointer was last updated */
  updatedAt: string
  /** Schema version of the referenced snapshot */
  schemaVersion: string
}
