/**
 * Local Filesystem Snapshot Storage
 *
 * Implements the ISnapshotStorage interface by delegating to the existing
 * FileSnapshotStore implementation. This adapter enables the storage
 * abstraction layer to use local filesystem storage for development
 * environments without requiring GCP credentials.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */

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
} from '../SnapshotStore.js'
import type {
  ISnapshotStorage,
  LocalStorageConfig,
} from '../../types/storageInterfaces.js'
import { FileSnapshotStore } from '../SnapshotStore.js'

/**
 * Local filesystem snapshot storage implementation
 *
 * Delegates all operations to the existing FileSnapshotStore implementation,
 * providing a consistent interface for the storage abstraction layer.
 *
 * This class acts as an adapter that:
 * - Implements the ISnapshotStorage interface
 * - Wraps the existing FileSnapshotStore
 * - Maintains full feature parity with cloud providers for testing
 * - Requires no GCP credentials or network connectivity
 *
 * @example
 * ```typescript
 * const storage = new LocalSnapshotStorage({ cacheDir: './data/cache' })
 * const snapshot = await storage.getLatestSuccessful()
 * ```
 */
export class LocalSnapshotStorage implements ISnapshotStorage {
  private readonly store: FileSnapshotStore

  /**
   * Creates a new LocalSnapshotStorage instance
   *
   * @param config - Configuration containing the cache directory path
   */
  constructor(config: LocalStorageConfig) {
    this.store = new FileSnapshotStore({
      cacheDir: config.cacheDir,
    })
  }

  // ============================================================================
  // Core Snapshot Operations
  // ============================================================================

  /**
   * Get the most recent successful snapshot
   *
   * @returns Latest successful snapshot or null if none exists
   */
  async getLatestSuccessful(): Promise<Snapshot | null> {
    return this.store.getLatestSuccessful()
  }

  /**
   * Get the most recent snapshot regardless of status
   *
   * @returns Latest snapshot or null if none exists
   */
  async getLatest(): Promise<Snapshot | null> {
    return this.store.getLatest()
  }

  /**
   * Write a new snapshot atomically
   *
   * @param snapshot - The snapshot to persist
   * @param allDistrictsRankings - Optional rankings data to store with the snapshot
   * @param options - Optional write options
   */
  async writeSnapshot(
    snapshot: Snapshot,
    allDistrictsRankings?: AllDistrictsRankingsData,
    options?: WriteSnapshotOptions
  ): Promise<void> {
    return this.store.writeSnapshot(snapshot, allDistrictsRankings, options)
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
    return this.store.listSnapshots(limit, filters)
  }

  /**
   * Get a specific snapshot by ID
   *
   * @param snapshotId - The unique identifier of the snapshot
   * @returns The snapshot or null if not found
   */
  async getSnapshot(snapshotId: string): Promise<Snapshot | null> {
    return this.store.getSnapshot(snapshotId)
  }

  /**
   * Check if the storage is properly initialized and accessible
   *
   * @returns True if the storage is ready for operations
   */
  async isReady(): Promise<boolean> {
    return this.store.isReady()
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
    return this.store.writeDistrictData(snapshotId, districtId, data)
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
    return this.store.readDistrictData(snapshotId, districtId)
  }

  /**
   * List all districts in a snapshot
   *
   * @param snapshotId - The snapshot ID (ISO date format: YYYY-MM-DD)
   * @returns Array of district IDs
   */
  async listDistrictsInSnapshot(snapshotId: string): Promise<string[]> {
    return this.store.listDistrictsInSnapshot(snapshotId)
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
    return this.store.getSnapshotManifest(snapshotId)
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
    return this.store.getSnapshotMetadata(snapshotId)
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
    return this.store.writeAllDistrictsRankings(snapshotId, rankingsData)
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
    return this.store.readAllDistrictsRankings(snapshotId)
  }

  /**
   * Check if all-districts rankings exist for a snapshot
   *
   * @param snapshotId - The snapshot ID (ISO date format: YYYY-MM-DD)
   * @returns True if rankings data exists
   */
  async hasAllDistrictsRankings(snapshotId: string): Promise<boolean> {
    return this.store.hasAllDistrictsRankings(snapshotId)
  }

  // ============================================================================
  // Write Completion Check
  // ============================================================================

  /**
   * Check if a snapshot write completed fully
   *
   * For local filesystem storage, writes are atomic (single operation),
   * so if a snapshot exists, it was written completely. This method
   * checks if the snapshot exists and returns true if it does.
   *
   * This differs from Firestore storage where chunked writes may result
   * in partial snapshots due to timeout failures.
   *
   * @param snapshotId - The snapshot ID (ISO date format: YYYY-MM-DD)
   * @returns true if the snapshot exists (local writes are always complete),
   *          false if the snapshot doesn't exist
   *
   * Requirements: 5.5
   */
  async isSnapshotWriteComplete(snapshotId: string): Promise<boolean> {
    // For local storage, if the snapshot exists, it was written completely
    // Local writes are atomic - they either succeed fully or fail completely
    const metadata = await this.store.getSnapshotMetadata(snapshotId)
    return metadata !== null
  }

  // ============================================================================
  // Deletion Operations
  // ============================================================================

  /**
   * Delete a snapshot and all its associated data
   *
   * Removes the snapshot directory and all district data.
   * Does NOT handle cascading deletion of time-series or analytics data.
   *
   * @param snapshotId - The snapshot ID (ISO date format: YYYY-MM-DD)
   * @returns true if snapshot was deleted, false if it didn't exist
   * @throws StorageOperationError on deletion failure
   */
  async deleteSnapshot(snapshotId: string): Promise<boolean> {
    return this.store.deleteSnapshot(snapshotId)
  }
}
