/**
 * Utility functions for snapshot operations
 */

import {
  CURRENT_SCHEMA_VERSION,
  CURRENT_CALCULATION_VERSION,
} from '../types/snapshots.js'

/**
 * Generate a unique snapshot ID based on current timestamp
 * @returns Timestamp-based snapshot ID
 */
export function generateSnapshotId(): string {
  return Date.now().toString()
}

/**
 * Generate a snapshot ID for a specific timestamp
 * @param timestamp Unix timestamp in milliseconds
 * @returns Timestamp-based snapshot ID
 */
export function generateSnapshotIdForTimestamp(timestamp: number): string {
  return timestamp.toString()
}

/**
 * Parse a snapshot ID to extract the timestamp
 * @param snapshotId The snapshot ID to parse
 * @returns Unix timestamp in milliseconds, or null if invalid
 */
export function parseSnapshotTimestamp(snapshotId: string): number | null {
  const timestamp = parseInt(snapshotId, 10)
  return isNaN(timestamp) ? null : timestamp
}

/**
 * Get the current schema version
 * @returns Current schema version string
 */
export function getCurrentSchemaVersion(): string {
  return CURRENT_SCHEMA_VERSION
}

/**
 * Get the current calculation version
 * @returns Current calculation version string
 */
export function getCurrentCalculationVersion(): string {
  return CURRENT_CALCULATION_VERSION
}

/**
 * Create a snapshot creation timestamp
 * @returns ISO timestamp string
 */
export function createSnapshotTimestamp(): string {
  return new Date().toISOString()
}

/**
 * Validate a snapshot ID format
 * @param snapshotId The snapshot ID to validate
 * @returns True if the snapshot ID is valid
 */
export function isValidSnapshotId(snapshotId: string): boolean {
  if (!snapshotId || typeof snapshotId !== 'string') {
    return false
  }

  const timestamp = parseInt(snapshotId, 10)
  return !isNaN(timestamp) && timestamp > 0
}

/**
 * Sort snapshot IDs by timestamp (newest first)
 * @param snapshotIds Array of snapshot IDs to sort
 * @returns Sorted array with newest snapshots first
 */
export function sortSnapshotIds(snapshotIds: string[]): string[] {
  return snapshotIds.filter(isValidSnapshotId).sort((a, b) => {
    const timestampA = parseInt(a, 10)
    const timestampB = parseInt(b, 10)
    return timestampB - timestampA // Newest first
  })
}

/**
 * Calculate the age of a snapshot in milliseconds
 * @param snapshotId The snapshot ID
 * @returns Age in milliseconds, or null if invalid
 */
export function getSnapshotAge(snapshotId: string): number | null {
  const timestamp = parseSnapshotTimestamp(snapshotId)
  if (timestamp === null) {
    return null
  }

  return Date.now() - timestamp
}

/**
 * Check if a snapshot is older than the specified age
 * @param snapshotId The snapshot ID
 * @param maxAgeMs Maximum age in milliseconds
 * @returns True if the snapshot is older than maxAgeMs
 */
export function isSnapshotOlderThan(
  snapshotId: string,
  maxAgeMs: number
): boolean {
  const age = getSnapshotAge(snapshotId)
  return age !== null && age > maxAgeMs
}
