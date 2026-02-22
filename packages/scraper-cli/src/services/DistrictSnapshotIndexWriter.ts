/**
 * DistrictSnapshotIndexWriter
 *
 * Updates a pre-computed JSON index file that maps district IDs to their
 * available snapshot dates. This index is stored at:
 *   config/district-snapshot-index.json
 *
 * The writer reads the existing index (or starts empty), adds new snapshot
 * dates for the given districts, deduplicates, sorts, and writes back.
 *
 * Used by the scraper pipeline after uploading per-district snapshot files.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * Structure of the district-snapshot index file.
 * Matches the DistrictSnapshotIndex type in the backend.
 */
export interface DistrictSnapshotIndex {
  generatedAt: string
  districts: Record<string, string[]>
}

/**
 * Storage interface for reading/writing the index file.
 * Implementations exist for GCS and local filesystem.
 */
export interface IndexStorage {
  readIndex(): Promise<DistrictSnapshotIndex | null>
  writeIndex(index: DistrictSnapshotIndex): Promise<void>
}

// ─── Writer ─────────────────────────────────────────────────────────────────

export class DistrictSnapshotIndexWriter {
  private readonly storage: IndexStorage

  constructor(storage: IndexStorage) {
    this.storage = storage
  }

  /**
   * Update the index with a new snapshot date for the given districts.
   *
   * - Creates the index if it doesn't exist
   * - Merges new dates into existing entries
   * - Deduplicates and sorts dates ascending
   * - Preserves existing districts not in the update
   */
  async updateIndex(
    snapshotDate: string,
    districtIds: string[]
  ): Promise<void> {
    // Read existing index or start fresh
    const existing = await this.storage.readIndex()
    const districts: Record<string, string[]> = existing?.districts
      ? { ...existing.districts }
      : {}

    // Add snapshotDate to each district
    for (const districtId of districtIds) {
      const existingDates = districts[districtId] ?? []
      const dateSet = new Set(existingDates)
      dateSet.add(snapshotDate)
      districts[districtId] = [...dateSet].sort()
    }

    const updatedIndex: DistrictSnapshotIndex = {
      generatedAt: new Date().toISOString(),
      districts,
    }

    await this.storage.writeIndex(updatedIndex)
  }
}
