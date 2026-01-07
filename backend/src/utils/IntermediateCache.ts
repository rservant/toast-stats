/**
 * Intermediate Cache Utility
 *
 * Provides caching for intermediate results during backfill operations
 * to avoid redundant API calls and improve performance.
 *
 * Implements Requirements 9.3: Caching for intermediate results to avoid redundant operations
 */

import { logger } from './logger.js'

export interface CacheEntry<T> {
  /** The cached data */
  data: T
  /** When this entry was created */
  createdAt: number
  /** When this entry expires (0 = never) */
  expiresAt: number
  /** Number of times this entry has been accessed */
  accessCount: number
  /** Last time this entry was accessed */
  lastAccessedAt: number
  /** Size of the cached data in bytes (estimated) */
  sizeBytes: number
  /** Optional metadata */
  metadata?: Record<string, unknown>
}

export interface CacheOptions {
  /** Default TTL in milliseconds (0 = never expire) */
  defaultTtlMs?: number
  /** Maximum number of entries to keep in cache */
  maxEntries?: number
  /** Maximum total size in bytes */
  maxSizeBytes?: number
  /** Whether to use LRU eviction when limits are reached */
  useLruEviction?: boolean
  /** Cleanup interval in milliseconds */
  cleanupIntervalMs?: number
}

export interface CacheStats {
  /** Total number of entries in cache */
  totalEntries: number
  /** Total size of cached data in bytes */
  totalSizeBytes: number
  /** Number of cache hits */
  hits: number
  /** Number of cache misses */
  misses: number
  /** Hit rate percentage */
  hitRate: number
  /** Number of expired entries removed */
  expiredRemoved: number
  /** Number of entries evicted due to size limits */
  evicted: number
  /** Average entry size in bytes */
  averageEntrySize: number
}

/**
 * In-memory cache with TTL, size limits, and LRU eviction
 */
export class IntermediateCache<T = unknown> {
  private cache: Map<string, CacheEntry<T>> = new Map()
  private stats: CacheStats = {
    totalEntries: 0,
    totalSizeBytes: 0,
    hits: 0,
    misses: 0,
    hitRate: 0,
    expiredRemoved: 0,
    evicted: 0,
    averageEntrySize: 0,
  }
  private cleanupTimer?: ReturnType<typeof setTimeout>

  constructor(private options: CacheOptions = {}) {
    // Set defaults
    this.options.defaultTtlMs = options.defaultTtlMs || 0
    this.options.maxEntries = options.maxEntries || 1000
    this.options.maxSizeBytes = options.maxSizeBytes || 100 * 1024 * 1024 // 100MB
    this.options.useLruEviction = options.useLruEviction !== false
    this.options.cleanupIntervalMs = options.cleanupIntervalMs || 60000 // 1 minute

    // Start cleanup timer
    if (this.options.cleanupIntervalMs > 0) {
      this.startCleanupTimer()
    }

    logger.debug('Intermediate cache initialized', {
      defaultTtlMs: this.options.defaultTtlMs,
      maxEntries: this.options.maxEntries,
      maxSizeBytes: this.options.maxSizeBytes,
      useLruEviction: this.options.useLruEviction,
      operation: 'IntermediateCache.constructor',
    })
  }

  /**
   * Get an item from the cache
   */
  get(key: string): T | null {
    const entry = this.cache.get(key)

    if (!entry) {
      this.stats.misses++
      this.updateHitRate()
      return null
    }

    // Check if expired
    if (entry.expiresAt > 0 && Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      this.stats.totalEntries--
      this.stats.totalSizeBytes -= entry.sizeBytes
      this.stats.expiredRemoved++
      this.stats.misses++
      this.updateHitRate()

      logger.debug('Cache entry expired', {
        key,
        expiresAt: entry.expiresAt,
        operation: 'IntermediateCache.get',
      })

      return null
    }

    // Update access tracking
    entry.accessCount++
    entry.lastAccessedAt = Date.now()
    this.stats.hits++
    this.updateHitRate()

    logger.debug('Cache hit', {
      key,
      accessCount: entry.accessCount,
      operation: 'IntermediateCache.get',
    })

    return entry.data
  }

  /**
   * Set an item in the cache
   */
  set(
    key: string,
    data: T,
    ttlMs?: number,
    metadata?: Record<string, unknown>
  ): void {
    const now = Date.now()
    const sizeBytes = this.estimateSize(data)
    const expiresAt = ttlMs
      ? now + ttlMs
      : this.options.defaultTtlMs
        ? now + this.options.defaultTtlMs
        : 0

    // Check if we need to make space
    this.ensureSpace(sizeBytes)

    const entry: CacheEntry<T> = {
      data,
      createdAt: now,
      expiresAt,
      accessCount: 0,
      lastAccessedAt: now,
      sizeBytes,
      metadata,
    }

    // Remove existing entry if it exists
    const existingEntry = this.cache.get(key)
    if (existingEntry) {
      this.stats.totalSizeBytes -= existingEntry.sizeBytes
      this.stats.totalEntries--
    }

    this.cache.set(key, entry)
    this.stats.totalEntries++
    this.stats.totalSizeBytes += sizeBytes
    this.updateAverageEntrySize()

    logger.debug('Cache entry set', {
      key,
      sizeBytes,
      expiresAt,
      totalEntries: this.stats.totalEntries,
      totalSizeBytes: this.stats.totalSizeBytes,
      operation: 'IntermediateCache.set',
    })
  }

  /**
   * Get or compute a value (cache-aside pattern)
   */
  async getOrCompute<R extends T>(
    key: string,
    computeFn: () => Promise<R>,
    ttlMs?: number,
    metadata?: Record<string, unknown>
  ): Promise<R> {
    const cached = this.get(key) as R | null

    if (cached !== null) {
      return cached
    }

    logger.debug('Cache miss - computing value', {
      key,
      operation: 'IntermediateCache.getOrCompute',
    })

    const computed = await computeFn()
    this.set(key, computed, ttlMs, metadata)

    return computed
  }

  /**
   * Check if a key exists in the cache (without updating access stats)
   */
  has(key: string): boolean {
    const entry = this.cache.get(key)

    if (!entry) {
      return false
    }

    // Check if expired
    if (entry.expiresAt > 0 && Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      this.stats.totalEntries--
      this.stats.totalSizeBytes -= entry.sizeBytes
      this.stats.expiredRemoved++
      return false
    }

    return true
  }

  /**
   * Delete an item from the cache
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key)

    if (entry) {
      this.cache.delete(key)
      this.stats.totalEntries--
      this.stats.totalSizeBytes -= entry.sizeBytes
      this.updateAverageEntrySize()

      logger.debug('Cache entry deleted', {
        key,
        sizeBytes: entry.sizeBytes,
        operation: 'IntermediateCache.delete',
      })

      return true
    }

    return false
  }

  /**
   * Clear all entries from the cache
   */
  clear(): void {
    const entriesCleared = this.cache.size
    const sizeCleared = this.stats.totalSizeBytes

    this.cache.clear()
    this.stats.totalEntries = 0
    this.stats.totalSizeBytes = 0
    this.updateAverageEntrySize()

    logger.info('Cache cleared', {
      entriesCleared,
      sizeCleared,
      operation: 'IntermediateCache.clear',
    })
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats }
  }

  /**
   * Get all cache keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys())
  }

  /**
   * Get cache entries with metadata
   */
  entries(): Array<{ key: string; entry: CacheEntry<T> }> {
    return Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      entry,
    }))
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): number {
    const now = Date.now()
    let removedCount = 0

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt > 0 && now > entry.expiresAt) {
        this.cache.delete(key)
        this.stats.totalEntries--
        this.stats.totalSizeBytes -= entry.sizeBytes
        this.stats.expiredRemoved++
        removedCount++
      }
    }

    if (removedCount > 0) {
      this.updateAverageEntrySize()

      logger.debug('Cache cleanup completed', {
        removedCount,
        totalEntries: this.stats.totalEntries,
        operation: 'IntermediateCache.cleanup',
      })
    }

    return removedCount
  }

  /**
   * Destroy the cache and cleanup resources
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = undefined
    }

    this.clear()

    logger.debug('Cache destroyed', {
      operation: 'IntermediateCache.destroy',
    })
  }

  /**
   * Ensure there's enough space for a new entry
   */
  private ensureSpace(newEntrySize: number): void {
    // Check entry count limit
    if (this.options.maxEntries && this.cache.size >= this.options.maxEntries) {
      this.evictEntries(1)
    }

    // Check size limit
    if (
      this.options.maxSizeBytes &&
      this.stats.totalSizeBytes + newEntrySize > this.options.maxSizeBytes
    ) {
      const targetSize = this.options.maxSizeBytes - newEntrySize
      this.evictToSize(targetSize)
    }
  }

  /**
   * Evict entries using LRU strategy
   */
  private evictEntries(count: number): void {
    if (!this.options.useLruEviction) {
      return
    }

    // Sort by last accessed time (oldest first)
    const entries = Array.from(this.cache.entries()).sort(
      ([, a], [, b]) => a.lastAccessedAt - b.lastAccessedAt
    )

    for (let i = 0; i < Math.min(count, entries.length); i++) {
      const entry = entries[i]
      if (!entry) continue

      const [key, entryData] = entry
      this.cache.delete(key)
      this.stats.totalEntries--
      this.stats.totalSizeBytes -= entryData.sizeBytes
      this.stats.evicted++
    }

    if (count > 0) {
      this.updateAverageEntrySize()

      logger.debug('Entries evicted due to count limit', {
        evicted: Math.min(count, entries.length),
        totalEntries: this.stats.totalEntries,
        operation: 'IntermediateCache.evictEntries',
      })
    }
  }

  /**
   * Evict entries to reach target size
   */
  private evictToSize(targetSize: number): void {
    if (!this.options.useLruEviction) {
      return
    }

    // Sort by last accessed time (oldest first)
    const entries = Array.from(this.cache.entries()).sort(
      ([, a], [, b]) => a.lastAccessedAt - b.lastAccessedAt
    )

    let evicted = 0
    for (const [key, entry] of entries) {
      if (this.stats.totalSizeBytes <= targetSize) {
        break
      }

      this.cache.delete(key)
      this.stats.totalEntries--
      this.stats.totalSizeBytes -= entry.sizeBytes
      this.stats.evicted++
      evicted++
    }

    if (evicted > 0) {
      this.updateAverageEntrySize()

      logger.debug('Entries evicted due to size limit', {
        evicted,
        targetSize,
        currentSize: this.stats.totalSizeBytes,
        operation: 'IntermediateCache.evictToSize',
      })
    }
  }

  /**
   * Estimate the size of data in bytes
   */
  private estimateSize(data: T): number {
    try {
      return JSON.stringify(data).length * 2 // Rough estimate (UTF-16)
    } catch {
      return 1024 // Default size if serialization fails
    }
  }

  /**
   * Update hit rate calculation
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0
  }

  /**
   * Update average entry size calculation
   */
  private updateAverageEntrySize(): void {
    this.stats.averageEntrySize =
      this.stats.totalEntries > 0
        ? this.stats.totalSizeBytes / this.stats.totalEntries
        : 0
  }

  /**
   * Start the cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup()
    }, this.options.cleanupIntervalMs)
  }
}

/**
 * Global cache manager for different cache instances
 */
export class IntermediateCacheManager {
  private static caches: Map<string, IntermediateCache> = new Map()

  /**
   * Get or create a cache instance
   */
  static getCache<T = unknown>(
    cacheName: string,
    options?: CacheOptions
  ): IntermediateCache<T> {
    if (!this.caches.has(cacheName)) {
      this.caches.set(cacheName, new IntermediateCache<T>(options))

      logger.info('Intermediate cache created', {
        cacheName,
        options,
        operation: 'IntermediateCacheManager.getCache',
      })
    }

    return this.caches.get(cacheName) as IntermediateCache<T>
  }

  /**
   * Get stats for all caches
   */
  static getAllStats(): Record<string, CacheStats> {
    const stats: Record<string, CacheStats> = {}

    for (const [cacheName, cache] of this.caches.entries()) {
      stats[cacheName] = cache.getStats()
    }

    return stats
  }

  /**
   * Cleanup all caches
   */
  static cleanupAll(): Record<string, number> {
    const results: Record<string, number> = {}

    for (const [cacheName, cache] of this.caches.entries()) {
      results[cacheName] = cache.cleanup()
    }

    return results
  }

  /**
   * Clear all caches
   */
  static clearAll(): void {
    for (const cache of this.caches.values()) {
      cache.clear()
    }

    logger.info('All intermediate caches cleared', {
      count: this.caches.size,
      operation: 'IntermediateCacheManager.clearAll',
    })
  }

  /**
   * Destroy all caches
   */
  static destroyAll(): void {
    for (const cache of this.caches.values()) {
      cache.destroy()
    }

    this.caches.clear()

    logger.info('All intermediate caches destroyed', {
      operation: 'IntermediateCacheManager.destroyAll',
    })
  }

  /**
   * Remove a specific cache
   */
  static removeCache(cacheName: string): boolean {
    const cache = this.caches.get(cacheName)
    if (cache) {
      cache.destroy()
      this.caches.delete(cacheName)

      logger.info('Intermediate cache removed', {
        cacheName,
        operation: 'IntermediateCacheManager.removeCache',
      })

      return true
    }
    return false
  }
}
