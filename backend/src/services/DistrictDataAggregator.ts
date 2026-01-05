/**
 * District Data Aggregator Service
 *
 * Efficiently reads and combines per-district data for API responses.
 * Provides caching for frequently accessed district files and performance
 * optimization for selective file access.
 */

import { logger } from '../utils/logger.js'
import { DistrictStatistics } from '../types/districts.js'
import { PerDistrictSnapshotStore } from './PerDistrictSnapshotStore.js'

/**
 * Configuration for the district data aggregator
 */
export interface DistrictDataAggregatorConfig {
  /** Maximum number of district files to cache in memory */
  maxCacheSize?: number
  /** Cache expiration time in milliseconds */
  cacheExpirationMs?: number
  /** Whether to enable performance metrics collection */
  enableMetrics?: boolean
}

/**
 * Cache entry for district data
 */
interface DistrictCacheEntry {
  data: DistrictStatistics
  cachedAt: number
  accessCount: number
  lastAccessed: number
}

/**
 * Performance metrics for monitoring
 */
interface AggregatorMetrics {
  totalRequests: number
  cacheHits: number
  cacheMisses: number
  averageResponseTime: number
  districtFileReads: number
  concurrentRequests: number
  maxConcurrentRequests: number
  evictions: number
}

/**
 * District summary information
 */
export interface DistrictSummary {
  districtId: string
  districtName: string
  status: 'success' | 'failed'
  lastUpdated: string
  memberCount?: number
  clubCount?: number
  distinguishedClubs?: number
}

/**
 * District Data Aggregator
 *
 * Provides efficient access to per-district snapshot data with caching
 * and performance optimization for API responses.
 */
export class DistrictDataAggregator {
  private readonly snapshotStore: PerDistrictSnapshotStore
  private readonly config: Required<DistrictDataAggregatorConfig>
  private readonly cache = new Map<string, DistrictCacheEntry>()
  private readonly metrics: AggregatorMetrics = {
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageResponseTime: 0,
    districtFileReads: 0,
    concurrentRequests: 0,
    maxConcurrentRequests: 0,
    evictions: 0,
  }

  constructor(
    snapshotStore: PerDistrictSnapshotStore,
    config: DistrictDataAggregatorConfig = {}
  ) {
    this.snapshotStore = snapshotStore
    this.config = {
      maxCacheSize: config.maxCacheSize ?? 50,
      cacheExpirationMs: config.cacheExpirationMs ?? 300000, // 5 minutes
      enableMetrics: config.enableMetrics ?? true,
    }

    logger.info('District Data Aggregator initialized', {
      operation: 'constructor',
      maxCacheSize: this.config.maxCacheSize,
      cacheExpirationMs: this.config.cacheExpirationMs,
      enableMetrics: this.config.enableMetrics,
    })
  }

  /**
   * Get data for a specific district from a snapshot
   */
  async getDistrictData(
    snapshotId: string,
    districtId: string
  ): Promise<DistrictStatistics | null> {
    const startTime = Date.now()
    const operationId = `get_district_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

    if (this.config.enableMetrics) {
      this.metrics.totalRequests++
      this.metrics.concurrentRequests++
      this.metrics.maxConcurrentRequests = Math.max(
        this.metrics.maxConcurrentRequests,
        this.metrics.concurrentRequests
      )
    }

    logger.debug('Starting district data retrieval', {
      operation: 'getDistrictData',
      operation_id: operationId,
      snapshot_id: snapshotId,
      district_id: districtId,
    })

    try {
      // Check cache first
      const cacheKey = `${snapshotId}:${districtId}`
      const cachedEntry = this.getCachedEntry(cacheKey)

      if (cachedEntry) {
        const duration = Date.now() - startTime
        this.updateMetrics(duration, true)

        logger.debug('Served district data from cache', {
          operation: 'getDistrictData',
          operation_id: operationId,
          snapshot_id: snapshotId,
          district_id: districtId,
          cache_age_ms: Date.now() - cachedEntry.cachedAt,
          duration_ms: duration,
          cache_hit: true,
        })

        return cachedEntry.data
      }

      // Read from snapshot store
      const data = await this.snapshotStore.readDistrictData(
        snapshotId,
        districtId
      )

      if (this.config.enableMetrics) {
        this.metrics.districtFileReads++
      }

      if (data) {
        // Cache the data
        this.cacheDistrictData(cacheKey, data)

        logger.debug('Retrieved and cached district data', {
          operation: 'getDistrictData',
          operation_id: operationId,
          snapshot_id: snapshotId,
          district_id: districtId,
          cached: true,
        })
      } else {
        logger.debug('District data not found', {
          operation: 'getDistrictData',
          operation_id: operationId,
          snapshot_id: snapshotId,
          district_id: districtId,
        })
      }

      const duration = Date.now() - startTime
      this.updateMetrics(duration, false)

      return data
    } catch (error) {
      const duration = Date.now() - startTime
      this.updateMetrics(duration, false)

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to get district data', {
        operation: 'getDistrictData',
        operation_id: operationId,
        snapshot_id: snapshotId,
        district_id: districtId,
        error: errorMessage,
        duration_ms: duration,
      })

      throw new Error(
        `Failed to get district data for ${districtId}: ${errorMessage}`
      )
    } finally {
      if (this.config.enableMetrics) {
        this.metrics.concurrentRequests--
      }
    }
  }

  /**
   * Get data for multiple districts from a snapshot
   */
  async getMultipleDistricts(
    snapshotId: string,
    districtIds: string[]
  ): Promise<DistrictStatistics[]> {
    const startTime = Date.now()
    const operationId = `get_multiple_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

    logger.info('Starting multiple district data retrieval', {
      operation: 'getMultipleDistricts',
      operation_id: operationId,
      snapshot_id: snapshotId,
      district_count: districtIds.length,
      district_ids: districtIds.slice(0, 10), // Log first 10 IDs
    })

    try {
      const results: DistrictStatistics[] = []
      const promises = districtIds.map(async districtId => {
        const data = await this.getDistrictData(snapshotId, districtId)
        return { districtId, data }
      })

      const districtResults = await Promise.all(promises)

      for (const { districtId, data } of districtResults) {
        if (data) {
          results.push(data)
        } else {
          logger.warn('District data not found in multiple retrieval', {
            operation: 'getMultipleDistricts',
            operation_id: operationId,
            snapshot_id: snapshotId,
            district_id: districtId,
          })
        }
      }

      const duration = Date.now() - startTime
      logger.info('Multiple district data retrieval completed', {
        operation: 'getMultipleDistricts',
        operation_id: operationId,
        snapshot_id: snapshotId,
        requested_count: districtIds.length,
        retrieved_count: results.length,
        duration_ms: duration,
      })

      return results
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to get multiple district data', {
        operation: 'getMultipleDistricts',
        operation_id: operationId,
        snapshot_id: snapshotId,
        district_count: districtIds.length,
        error: errorMessage,
        duration_ms: duration,
      })

      throw new Error(`Failed to get multiple district data: ${errorMessage}`)
    }
  }

  /**
   * Get all districts from a snapshot
   */
  async getAllDistricts(snapshotId: string): Promise<DistrictStatistics[]> {
    const startTime = Date.now()
    const operationId = `get_all_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

    logger.info('Starting all districts data retrieval', {
      operation: 'getAllDistricts',
      operation_id: operationId,
      snapshot_id: snapshotId,
    })

    try {
      // Get list of districts in the snapshot
      const districtIds =
        await this.snapshotStore.listDistrictsInSnapshot(snapshotId)

      if (districtIds.length === 0) {
        logger.info('No districts found in snapshot', {
          operation: 'getAllDistricts',
          operation_id: operationId,
          snapshot_id: snapshotId,
        })
        return []
      }

      // Get data for all districts
      const results = await this.getMultipleDistricts(snapshotId, districtIds)

      const duration = Date.now() - startTime
      logger.info('All districts data retrieval completed', {
        operation: 'getAllDistricts',
        operation_id: operationId,
        snapshot_id: snapshotId,
        district_count: results.length,
        duration_ms: duration,
      })

      return results
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to get all districts data', {
        operation: 'getAllDistricts',
        operation_id: operationId,
        snapshot_id: snapshotId,
        error: errorMessage,
        duration_ms: duration,
      })

      throw new Error(`Failed to get all districts data: ${errorMessage}`)
    }
  }

  /**
   * Get district summary information from a snapshot
   */
  async getDistrictSummary(snapshotId: string): Promise<DistrictSummary[]> {
    const startTime = Date.now()
    const operationId = `get_summary_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

    logger.info('Starting district summary retrieval', {
      operation: 'getDistrictSummary',
      operation_id: operationId,
      snapshot_id: snapshotId,
    })

    try {
      // Get snapshot manifest for summary information
      const manifest = await this.snapshotStore.getSnapshotManifest(snapshotId)
      if (!manifest) {
        logger.warn('Snapshot manifest not found', {
          operation: 'getDistrictSummary',
          operation_id: operationId,
          snapshot_id: snapshotId,
        })
        return []
      }

      // Get metadata for additional information (not used currently but available for future use)
      await this.snapshotStore.getSnapshotMetadata(snapshotId)

      const summaries: DistrictSummary[] = []

      // For each district in the manifest, get additional data if successful
      for (const entry of manifest.districts) {
        const summary: DistrictSummary = {
          districtId: entry.districtId,
          districtName: `District ${entry.districtId}`,
          status: entry.status,
          lastUpdated: entry.lastModified,
        }

        // If the district was successful, try to get additional data
        if (entry.status === 'success') {
          try {
            const districtData = await this.getDistrictData(
              snapshotId,
              entry.districtId
            )
            if (districtData) {
              // Extract additional fields from district data
              summary.memberCount = districtData.membership?.total || 0
              summary.clubCount = districtData.clubs?.total || 0
              summary.distinguishedClubs =
                districtData.clubs?.distinguished || 0
            }
          } catch (error) {
            // If we can't get the data, just use the basic summary
            logger.debug('Could not get additional data for district summary', {
              operation: 'getDistrictSummary',
              operation_id: operationId,
              district_id: entry.districtId,
              error: error instanceof Error ? error.message : 'Unknown error',
            })
          }
        }

        summaries.push(summary)
      }

      const duration = Date.now() - startTime
      logger.info('District summary retrieval completed', {
        operation: 'getDistrictSummary',
        operation_id: operationId,
        snapshot_id: snapshotId,
        summary_count: summaries.length,
        successful_districts: manifest.successfulDistricts,
        failed_districts: manifest.failedDistricts,
        duration_ms: duration,
      })

      return summaries
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to get district summary', {
        operation: 'getDistrictSummary',
        operation_id: operationId,
        snapshot_id: snapshotId,
        error: errorMessage,
        duration_ms: duration,
      })

      throw new Error(`Failed to get district summary: ${errorMessage}`)
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics(): AggregatorMetrics & { cacheSize: number } {
    return {
      ...this.metrics,
      cacheSize: this.cache.size,
    }
  }

  /**
   * Preload districts into cache
   */
  async preloadDistricts(
    snapshotId: string,
    districtIds: string[]
  ): Promise<void> {
    const startTime = Date.now()
    const operationId = `preload_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

    logger.info('Starting district preload operation', {
      operation: 'preloadDistricts',
      operation_id: operationId,
      snapshot_id: snapshotId,
      district_count: districtIds.length,
    })

    try {
      // Load all districts in parallel
      const promises = districtIds.map(districtId =>
        this.getDistrictData(snapshotId, districtId)
      )

      await Promise.all(promises)

      const duration = Date.now() - startTime
      logger.info('District preload operation completed', {
        operation: 'preloadDistricts',
        operation_id: operationId,
        snapshot_id: snapshotId,
        district_count: districtIds.length,
        cache_size: this.cache.size,
        duration_ms: duration,
      })
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('District preload operation failed', {
        operation: 'preloadDistricts',
        operation_id: operationId,
        snapshot_id: snapshotId,
        district_count: districtIds.length,
        error: errorMessage,
        duration_ms: duration,
      })
      throw error
    }
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    const evictedCount = this.cache.size
    this.cache.clear()
    if (this.config.enableMetrics) {
      this.metrics.evictions += evictedCount
    }
    logger.info('District data cache cleared', {
      operation: 'clearCache',
      evicted_count: evictedCount,
    })
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number
    maxSize: number
    hitRate: number
    entries: Array<{
      key: string
      accessCount: number
      lastAccessed: string
      cacheAge: number
    }>
  } {
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      accessCount: entry.accessCount,
      lastAccessed: new Date(entry.lastAccessed).toISOString(),
      cacheAge: Date.now() - entry.cachedAt,
    }))

    const hitRate =
      this.metrics.totalRequests > 0
        ? (this.metrics.cacheHits / this.metrics.totalRequests) * 100
        : 0

    return {
      size: this.cache.size,
      maxSize: this.config.maxCacheSize,
      hitRate,
      entries,
    }
  }

  /**
   * Get cached entry if valid
   */
  private getCachedEntry(cacheKey: string): DistrictCacheEntry | null {
    const entry = this.cache.get(cacheKey)
    if (!entry) {
      return null
    }

    // Check if entry has expired
    const age = Date.now() - entry.cachedAt
    if (age > this.config.cacheExpirationMs) {
      this.cache.delete(cacheKey)
      return null
    }

    // Update access information
    entry.accessCount++
    entry.lastAccessed = Date.now()

    return entry
  }

  /**
   * Cache district data with LRU eviction
   */
  private cacheDistrictData(cacheKey: string, data: DistrictStatistics): void {
    // If cache is full, evict least recently used entry
    if (this.cache.size >= this.config.maxCacheSize) {
      let lruKey: string | null = null
      let lruTime = Infinity

      for (const [key, entry] of this.cache.entries()) {
        if (entry.lastAccessed < lruTime) {
          lruTime = entry.lastAccessed
          lruKey = key
        }
      }

      if (lruKey) {
        this.cache.delete(lruKey)
        if (this.config.enableMetrics) {
          this.metrics.evictions++
        }
        logger.debug('Evicted LRU cache entry', {
          operation: 'cacheDistrictData',
          evicted_key: lruKey,
          cache_size: this.cache.size,
        })
      }
    }

    // Add new entry
    const now = Date.now()
    this.cache.set(cacheKey, {
      data,
      cachedAt: now,
      accessCount: 1,
      lastAccessed: now,
    })

    logger.debug('Cached district data', {
      operation: 'cacheDistrictData',
      cache_key: cacheKey,
      cache_size: this.cache.size,
    })
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(duration: number, cacheHit: boolean): void {
    if (!this.config.enableMetrics) {
      return
    }

    if (cacheHit) {
      this.metrics.cacheHits++
    } else {
      this.metrics.cacheMisses++
    }

    // Update average response time using exponential moving average
    const alpha = 0.1 // Smoothing factor
    this.metrics.averageResponseTime =
      alpha * duration + (1 - alpha) * this.metrics.averageResponseTime
  }
}

/**
 * Factory function to create a DistrictDataAggregator
 */
export function createDistrictDataAggregator(
  snapshotStore: PerDistrictSnapshotStore,
  config?: DistrictDataAggregatorConfig
): DistrictDataAggregator {
  return new DistrictDataAggregator(snapshotStore, config)
}
