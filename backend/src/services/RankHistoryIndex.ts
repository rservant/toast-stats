/**
 * RankHistoryIndex — In-memory index of all district rank history.
 *
 * Eliminates the O(N) GCS reads per rank-history request by building
 * a complete in-memory index. The index is built lazily on first request,
 * then cached for 1 hour. On refresh, it reads all snapshot rankings
 * in parallel and rebuilds the index.
 *
 * Performance: ~2,370 GCS reads per rebuild (once/hour) → O(1) per request.
 *
 * Compatible with the daily incremental pipeline: new snapshots are picked
 * up on the next index refresh (within 1 hour of pipeline completion).
 *
 * Issue: #115
 */

import { logger } from '../utils/logger.js'
import type { AllDistrictsRankingsData } from '../types/snapshots.js'

/**
 * A single historical rank data point for a district.
 */
export interface RankHistoryPoint {
  date: string
  aggregateScore: number
  clubsRank: number
  paymentsRank: number
  distinguishedRank: number
  totalDistricts: number
  overallRank: number
}

/**
 * Rank history for a single district across all snapshots.
 */
export interface DistrictRankHistory {
  districtId: string
  districtName: string
  /** Sorted chronologically (oldest first). */
  history: RankHistoryPoint[]
}

/**
 * Minimal interface for the snapshot store methods we need.
 * Avoids tight coupling to the full PerDistrictSnapshotStore.
 */
export interface RankHistorySnapshotStore {
  listSnapshotIds(): Promise<string[]>
  readAllDistrictsRankings(
    snapshotId: string
  ): Promise<AllDistrictsRankingsData | null>
}

export interface RankHistoryIndexConfig {
  /** Cache TTL in milliseconds (default: 1 hour). */
  cacheTtlMs?: number
  /** Max concurrent GCS reads during rebuild (default: 25). */
  concurrencyLimit?: number
}

export class RankHistoryIndex {
  private readonly store: RankHistorySnapshotStore
  private readonly cacheTtlMs: number
  private readonly concurrencyLimit: number

  /** Per-district rank history, keyed by districtId. */
  private index: Map<string, DistrictRankHistory> | null = null
  /** All snapshot IDs that have been indexed. */
  private indexedSnapshotIds: Set<string> = new Set()
  /** When the index was last built. */
  private lastBuiltAt: number = 0
  /** Whether a build is currently in progress (prevents concurrent rebuilds). */
  private buildPromise: Promise<void> | null = null

  constructor(
    store: RankHistorySnapshotStore,
    config?: RankHistoryIndexConfig
  ) {
    this.store = store
    this.cacheTtlMs = config?.cacheTtlMs ?? 60 * 60 * 1000 // 1 hour
    this.concurrencyLimit = config?.concurrencyLimit ?? 25
  }

  /**
   * Get rank history for specific districts within an optional date range.
   * Builds the index lazily on first call.
   */
  async getRankHistory(
    districtIds: string[],
    startDate?: string,
    endDate?: string
  ): Promise<DistrictRankHistory[]> {
    await this.ensureIndex()

    return districtIds.map(id => {
      const entry = this.index!.get(id)
      if (!entry) {
        return {
          districtId: id,
          districtName: `District ${id}`,
          history: [],
        }
      }

      // Filter by date range if specified
      if (startDate || endDate) {
        const filtered = entry.history.filter(point => {
          if (startDate && point.date < startDate) return false
          if (endDate && point.date > endDate) return false
          return true
        })
        return { ...entry, history: filtered }
      }

      return entry
    })
  }

  /**
   * Get all snapshot IDs that the index knows about (for available-years queries).
   */
  async getSnapshotIds(): Promise<string[]> {
    await this.ensureIndex()
    return Array.from(this.indexedSnapshotIds).sort()
  }

  /**
   * Ensure the index is built and up-to-date.
   * Coalesces concurrent build requests.
   */
  private async ensureIndex(): Promise<void> {
    const now = Date.now()
    const isExpired = now - this.lastBuiltAt > this.cacheTtlMs

    if (this.index && !isExpired) return

    // If a build is already in progress, wait for it
    if (this.buildPromise) {
      await this.buildPromise
      return
    }

    this.buildPromise = this.buildIndex()
    try {
      await this.buildPromise
    } finally {
      this.buildPromise = null
    }
  }

  /**
   * Build the complete index by reading all snapshot rankings.
   */
  private async buildIndex(): Promise<void> {
    const startTime = Date.now()

    const allSnapshotIds = await this.store.listSnapshotIds()

    logger.info('RankHistoryIndex: building index', {
      totalSnapshots: allSnapshotIds.length,
      previouslyIndexed: this.indexedSnapshotIds.size,
    })

    // Determine which snapshots are new (for incremental updates)
    const newSnapshotIds = allSnapshotIds.filter(
      id => !this.indexedSnapshotIds.has(id)
    )

    // If no new snapshots and index exists, just refresh the timestamp
    if (newSnapshotIds.length === 0 && this.index) {
      this.lastBuiltAt = Date.now()
      logger.info('RankHistoryIndex: no new snapshots, refreshed timestamp', {
        durationMs: Date.now() - startTime,
      })
      return
    }

    // Build or extend the index
    const index = this.index ?? new Map<string, DistrictRankHistory>()
    let readCount = 0
    let errorCount = 0

    // Process snapshots in parallel batches
    for (let i = 0; i < newSnapshotIds.length; i += this.concurrencyLimit) {
      const batch = newSnapshotIds.slice(i, i + this.concurrencyLimit)
      const results = await Promise.all(
        batch.map(async snapshotId => {
          try {
            return await this.store.readAllDistrictsRankings(snapshotId)
          } catch {
            errorCount++
            return null
          }
        })
      )

      for (const rankings of results) {
        if (!rankings) continue
        readCount++

        const date = rankings.metadata.sourceCsvDate

        for (const ranking of rankings.rankings) {
          let entry = index.get(ranking.districtId)
          if (!entry) {
            entry = {
              districtId: ranking.districtId,
              districtName: ranking.districtName,
              history: [],
            }
            index.set(ranking.districtId, entry)
          }

          // Update district name if we have a better one
          if (entry.districtName === `District ${ranking.districtId}`) {
            entry.districtName = ranking.districtName
          }

          entry.history.push({
            date,
            aggregateScore: ranking.aggregateScore,
            clubsRank: ranking.clubsRank,
            paymentsRank: ranking.paymentsRank,
            distinguishedRank: ranking.distinguishedRank,
            totalDistricts: rankings.metadata.totalDistricts,
            overallRank: ranking.overallRank ?? 0,
          })
        }
      }
    }

    // Sort each district's history chronologically & deduplicate by date
    for (const entry of index.values()) {
      // Sort by date
      entry.history.sort((a, b) => a.date.localeCompare(b.date))

      // Deduplicate: keep only the first entry per date
      const seen = new Set<string>()
      entry.history = entry.history.filter(point => {
        if (seen.has(point.date)) return false
        seen.add(point.date)
        return true
      })
    }

    // Update state
    this.index = index
    this.indexedSnapshotIds = new Set(allSnapshotIds)
    this.lastBuiltAt = Date.now()

    const durationMs = Date.now() - startTime
    logger.info('RankHistoryIndex: build complete', {
      durationMs,
      totalSnapshots: allSnapshotIds.length,
      newSnapshots: newSnapshotIds.length,
      districtsIndexed: index.size,
      totalHistoryPoints: Array.from(index.values()).reduce(
        (sum, e) => sum + e.history.length,
        0
      ),
      readCount,
      errorCount,
    })
  }

  /**
   * Force a cache invalidation. Called when the backend detects new data.
   */
  invalidate(): void {
    this.lastBuiltAt = 0
  }

  /**
   * Check whether the index is loaded.
   */
  isLoaded(): boolean {
    return this.index !== null
  }
}
