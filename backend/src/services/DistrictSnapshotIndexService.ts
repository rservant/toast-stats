/**
 * DistrictSnapshotIndexService
 *
 * Reads a pre-computed JSON index that maps district IDs to their available
 * snapshot dates. The index is stored at config/district-snapshot-index.json
 * in the storage backend (GCS in production, local filesystem in development).
 *
 * This service provides a fast O(1) lookup for available dates per district,
 * replacing the previous approach of ~2,370 GCS HEAD requests.
 *
 * The index is cached in memory with a configurable TTL (default 1 hour).
 * If the index is missing or malformed, methods return null to signal
 * that callers should fall back to the slow HEAD-request approach.
 */

import { logger } from '../utils/logger.js'

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * Structure of the district-snapshot index file.
 */
export interface DistrictSnapshotIndex {
  generatedAt: string
  districts: Record<string, string[]>
}

/**
 * Storage reader interface for the index file.
 * Implementations exist for GCS and local filesystem.
 */
export interface IndexStorageReader {
  /**
   * Read the index file from storage.
   * Returns the parsed index, or null if the file does not exist.
   */
  readIndex(): Promise<DistrictSnapshotIndex | null>
}

// ─── Configuration ──────────────────────────────────────────────────────────

export interface DistrictSnapshotIndexServiceOptions {
  /** Cache TTL in milliseconds. Default: 1 hour. */
  ttlMs?: number
}

// ─── Service ────────────────────────────────────────────────────────────────

export class DistrictSnapshotIndexService {
  private readonly reader: IndexStorageReader
  private readonly ttlMs: number

  private cachedIndex: DistrictSnapshotIndex | null = null
  private cachedAt: number = 0

  constructor(
    reader: IndexStorageReader,
    options?: DistrictSnapshotIndexServiceOptions
  ) {
    this.reader = reader
    this.ttlMs = options?.ttlMs ?? 60 * 60 * 1000 // 1 hour default
  }

  /**
   * Get the available snapshot dates for a district.
   *
   * @returns Sorted array of date strings, empty array if district not in index,
   *          or null if the index is unavailable (missing/malformed/error).
   */
  async getDatesForDistrict(districtId: string): Promise<string[] | null> {
    const index = await this.loadIndex()

    if (index === null) {
      return null
    }

    const dates = index.districts[districtId]
    if (!dates) {
      return []
    }

    // Return a sorted copy
    return [...dates].sort()
  }

  /**
   * Load the index from cache or storage.
   * Returns null if the index is unavailable.
   */
  private async loadIndex(): Promise<DistrictSnapshotIndex | null> {
    // Check cache
    if (this.cachedIndex && Date.now() - this.cachedAt < this.ttlMs) {
      return this.cachedIndex
    }

    try {
      const index = await this.reader.readIndex()

      if (!this.isValidIndex(index)) {
        logger.warn('District snapshot index is missing or malformed', {
          operation: 'DistrictSnapshotIndexService.loadIndex',
        })
        // Don't cache null — allow retry on next call
        this.cachedIndex = null
        return null
      }

      // Cache the valid index
      this.cachedIndex = index
      this.cachedAt = Date.now()

      logger.info('District snapshot index loaded', {
        operation: 'DistrictSnapshotIndexService.loadIndex',
        generatedAt: index.generatedAt,
        districtCount: Object.keys(index.districts).length,
      })

      return index
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      logger.warn('Failed to read district snapshot index', {
        operation: 'DistrictSnapshotIndexService.loadIndex',
        error: message,
      })
      // Don't cache errors — allow retry on next call
      this.cachedIndex = null
      return null
    }
  }

  /**
   * Validate the index structure.
   */
  private isValidIndex(
    index: DistrictSnapshotIndex | null
  ): index is DistrictSnapshotIndex {
    if (!index) return false
    if (typeof index !== 'object') return false
    if (!index.districts || typeof index.districts !== 'object') return false
    return true
  }
}
