/**
 * Snapshot Discovery
 *
 * Pointer management and directory scanning to locate the latest successful snapshot.
 * Uses a two-phase approach: O(1) pointer fast path, then fallback directory scan.
 */

import fs from 'fs/promises'
import path from 'path'
import { logger } from '../../utils/logger.js'
import { resolvePathUnderBase } from './SnapshotPathUtils.js'
import type { Snapshot } from '../../types/snapshots.js'
import type { SnapshotPointer } from '@toastmasters/shared-contracts'
import {
  validateSnapshotPointer,
  SCHEMA_VERSION,
} from '@toastmasters/shared-contracts'

/**
 * Function signature for reading a snapshot from its directory.
 * Injected by FileSnapshotStore to avoid circular dependencies.
 */
export type ReadSnapshotFn = (snapshotId: string) => Promise<Snapshot | null>

/**
 * Attempt to find the latest successful snapshot via the pointer file (O(1) fast path).
 * Reads `latest-successful.json` from the snapshots directory, validates it against
 * the Zod schema, and verifies the referenced snapshot directory exists with status "success".
 * Returns null on any failure (missing file, invalid JSON, bad reference), logging warnings
 * for each failure mode.
 *
 * Requirements: 2.1, 2.3, 3.1, 3.2, 3.3
 */
export async function findLatestSuccessfulViaPointer(
  snapshotsDir: string,
  readSnapshot: ReadSnapshotFn
): Promise<Snapshot | null> {
  const pointerPath = resolvePathUnderBase(
    snapshotsDir,
    'latest-successful.json'
  )

  try {
    const raw = await fs.readFile(pointerPath, 'utf-8')
    const parsed: unknown = JSON.parse(raw)
    const validation = validateSnapshotPointer(parsed)

    if (!validation.success) {
      logger.warn('Invalid snapshot pointer file', {
        operation: 'findLatestSuccessfulViaPointer',
        error: validation.error,
      })
      return null
    }

    const { snapshotId } = validation.data!
    const snapshot = await readSnapshot(snapshotId)

    if (snapshot && snapshot.status === 'success') {
      logger.info('Resolved latest successful snapshot via pointer', {
        operation: 'findLatestSuccessfulViaPointer',
        snapshot_id: snapshotId,
      })
      return snapshot
    }

    logger.warn('Snapshot pointer references non-success snapshot', {
      operation: 'findLatestSuccessfulViaPointer',
      snapshotId,
      status: snapshot?.status ?? 'not_found',
    })
    return null
  } catch (error: unknown) {
    const fsError = error as { code?: string }
    if (fsError.code === 'ENOENT') {
      logger.warn('Snapshot pointer file not found, will fall back to scan', {
        operation: 'findLatestSuccessfulViaPointer',
      })
    } else if (error instanceof SyntaxError) {
      logger.warn('Snapshot pointer file contains invalid JSON', {
        operation: 'findLatestSuccessfulViaPointer',
        error: error.message,
      })
    } else {
      logger.error('Failed to read snapshot pointer', {
        operation: 'findLatestSuccessfulViaPointer',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
    return null
  }
}

/**
 * Repair the snapshot pointer file after a successful fallback directory scan.
 * This writes a valid pointer file so that subsequent cold starts can use the
 * fast path instead of repeating the full directory scan.
 *
 * This is a narrow exception to the "backend is read-only" rule, justified as
 * cache/index repair — the data written is derived from what was just read,
 * not computed.
 *
 * Non-fatal: catches and logs all errors without propagating.
 *
 * Requirements: 3.4
 */
export async function repairSnapshotPointer(
  snapshotsDir: string,
  snapshotId: string
): Promise<void> {
  try {
    const pointer: SnapshotPointer = {
      snapshotId,
      updatedAt: new Date().toISOString(),
      schemaVersion: SCHEMA_VERSION,
    }
    const validated = validateSnapshotPointer(pointer)
    if (!validated.success) return

    const pointerPath = resolvePathUnderBase(
      snapshotsDir,
      'latest-successful.json'
    )
    const tempPath = `${pointerPath}.tmp.${Date.now()}`
    await fs.writeFile(
      tempPath,
      JSON.stringify(validated.data, null, 2),
      'utf-8'
    )
    await fs.rename(tempPath, pointerPath)

    logger.info('Repaired snapshot pointer after fallback scan', {
      operation: 'repairSnapshotPointer',
      snapshotId,
    })
  } catch (error: unknown) {
    // Non-fatal: log and continue
    logger.warn('Failed to repair snapshot pointer', {
      operation: 'repairSnapshotPointer',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * Find the latest successful snapshot by scanning the directory.
 */
export async function findLatestSuccessfulByScanning(
  snapshotsDir: string,
  readSnapshot: ReadSnapshotFn
): Promise<Snapshot | null> {
  const startTime = Date.now()

  logger.debug('Starting directory scan for latest successful snapshot', {
    operation: 'findLatestSuccessfulByScanning',
  })

  // Handle missing directory gracefully (Requirements 3.1, 3.3, 3.4)
  try {
    await fs.access(snapshotsDir)
  } catch (error: unknown) {
    const fsError = error as { code?: string }
    if (fsError.code === 'ENOENT') {
      logger.debug('Snapshots directory does not exist, returning null', {
        operation: 'findLatestSuccessfulByScanning',
        snapshotsDir,
      })
      return null
    }
    throw error
  }

  const files = await fs.readdir(snapshotsDir)

  // Get directories and sort by date (newest first)
  const snapshotDirs: string[] = []
  for (const file of files) {
    const filePath = path.join(snapshotsDir, file)
    const stats = await fs.stat(filePath)
    if (stats.isDirectory()) {
      snapshotDirs.push(file)
    }
  }

  snapshotDirs.sort((a, b) => b.localeCompare(a))

  logger.debug('Scanning snapshot directories for successful status', {
    operation: 'findLatestSuccessfulByScanning',
    total_dirs: snapshotDirs.length,
    dirs_to_scan: snapshotDirs.slice(0, 10),
  })

  for (const dir of snapshotDirs) {
    try {
      const snapshot = await readSnapshot(dir)

      logger.debug('Checking snapshot status', {
        operation: 'findLatestSuccessfulByScanning',
        snapshot_id: dir,
        status: snapshot?.status,
      })

      if (snapshot && snapshot.status === 'success') {
        const duration = Date.now() - startTime
        logger.info('Found latest successful snapshot by scanning', {
          operation: 'findLatestSuccessfulByScanning',
          snapshot_id: snapshot.snapshot_id,
          created_at: snapshot.created_at,
          schema_version: snapshot.schema_version,
          calculation_version: snapshot.calculation_version,
          district_count: snapshot.payload.districts.length,
          scanned_dirs: snapshotDirs.indexOf(dir) + 1,
          duration_ms: duration,
        })

        return snapshot
      }
    } catch (error) {
      logger.warn('Failed to read snapshot during scanning', {
        operation: 'findLatestSuccessfulByScanning',
        dir,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      continue
    }
  }

  const duration = Date.now() - startTime
  logger.info('No successful snapshot found during directory scan', {
    operation: 'findLatestSuccessfulByScanning',
    scanned_dirs: snapshotDirs.length,
    duration_ms: duration,
  })

  return null
}

/**
 * Find the latest successful snapshot using a two-phase approach:
 *
 * Phase 1 (fast path): Try reading the snapshot pointer file for O(1) resolution.
 * Phase 2 (fallback): Fall back to the full directory scan if the pointer is
 *   missing, invalid, or references a non-success snapshot.
 *
 * After a successful fallback scan, the pointer file is repaired so that
 * subsequent cold starts can use the fast path.
 *
 * Requirements: 2.1, 2.4, 3.4
 */
export async function findLatestSuccessful(
  snapshotsDir: string,
  readSnapshot: ReadSnapshotFn
): Promise<Snapshot | null> {
  // Phase 1: Try pointer (fast path)
  const viaPointer = await findLatestSuccessfulViaPointer(
    snapshotsDir,
    readSnapshot
  )
  if (viaPointer) {
    return viaPointer
  }

  // Phase 2: Fall back to directory scan (slow path)
  const viaScanning = await findLatestSuccessfulByScanning(
    snapshotsDir,
    readSnapshot
  )

  // Repair: Write pointer for future fast starts
  if (viaScanning) {
    await repairSnapshotPointer(snapshotsDir, viaScanning.snapshot_id)
  }

  return viaScanning
}
