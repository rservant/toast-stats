/**
 * Snapshot Path Utilities
 *
 * Shared validation and path resolution utilities used by all snapshot modules.
 * Provides security-hardened path resolution to prevent directory traversal attacks.
 */

import fs from 'fs/promises'
import path from 'path'
import { logger } from '../../utils/logger.js'

/**
 * Resolve a path under a base directory, ensuring it doesn't escape via traversal.
 * Returns the sanitized path for use in file operations.
 * This is CodeQL-friendly because it returns a new sanitized value.
 * @throws Error if the path would escape the base directory
 */
export function resolvePathUnderBase(
  baseDir: string,
  ...parts: string[]
): string {
  const base = path.resolve(baseDir)
  const candidate = path.resolve(baseDir, ...parts)

  const rel = path.relative(base, candidate)

  // Must not be outside base, and must not be absolute (Windows safety)
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`Path traversal attempt detected: ${candidate}`)
  }

  return candidate
}

/**
 * Resolve an existing path under a base directory with symlink protection.
 * Uses realpath to resolve symlinks and ensure the actual file is within base.
 * Use this for reads where the file is expected to exist.
 * @throws Error if the path would escape the base directory or file doesn't exist
 */
export async function resolveExistingPathUnderBase(
  baseDir: string,
  ...parts: string[]
): Promise<string> {
  const baseReal = await fs.realpath(baseDir)

  // Resolve the target path lexically first
  const candidate = path.resolve(baseDir, ...parts)

  // realpath resolves symlinks - prevents "symlink escapes base" attacks
  const candidateReal = await fs.realpath(candidate)

  const rel = path.relative(baseReal, candidateReal)
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`Path traversal attempt detected: ${candidateReal}`)
  }

  return candidateReal
}

/**
 * Validate a district ID to ensure it is safe to use in file paths.
 * District IDs are typically numeric (e.g., "42", "15") or alphanumeric (e.g., "F", "NONEXISTENT1").
 * The pattern prevents path traversal by rejecting special characters like /, \, .., etc.
 * @throws Error if the district ID format is invalid
 */
export function validateDistrictId(districtId: string): void {
  if (typeof districtId !== 'string' || districtId.length === 0) {
    throw new Error('Invalid district ID: empty or non-string value')
  }

  // Allow alphanumeric characters only (no path separators, dots, or special chars)
  // This prevents path traversal while allowing valid district IDs
  const DISTRICT_ID_PATTERN = /^[A-Za-z0-9]+$/
  if (!DISTRICT_ID_PATTERN.test(districtId)) {
    logger.warn('Rejected district ID with invalid characters', {
      operation: 'validateDistrictId',
      district_id: districtId,
    })
    throw new Error('Invalid district ID format')
  }
}

/**
 * Validate a snapshot ID to ensure it is safe to use in file paths.
 * @throws Error if the snapshot ID format is invalid
 */
export function validateSnapshotId(snapshotId: string): void {
  if (typeof snapshotId !== 'string' || snapshotId.length === 0) {
    throw new Error('Invalid snapshot ID: empty or non-string value')
  }

  // Allow alphanumeric, underscore, hyphen (for ISO dates like 2024-01-01)
  const SNAPSHOT_ID_PATTERN = /^[A-Za-z0-9_-]+$/
  if (!SNAPSHOT_ID_PATTERN.test(snapshotId)) {
    logger.warn('Rejected snapshot ID with invalid characters', {
      operation: 'validateSnapshotId',
      snapshot_id: snapshotId,
    })
    throw new Error('Invalid snapshot ID format')
  }
}

/**
 * Ensure the snapshots directory exists.
 * @throws Error if directory creation fails
 */
export async function ensureDirectoryExists(
  snapshotsDir: string
): Promise<void> {
  try {
    await fs.mkdir(snapshotsDir, { recursive: true })
  } catch (error) {
    throw new Error(
      `Failed to create snapshots directory: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}
