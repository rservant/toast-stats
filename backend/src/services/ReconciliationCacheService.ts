/**
 * High-performance caching service for reconciliation data
 * Implements LRU cache with TTL and intelligent prefetching
 */

import { logger } from '../utils/logger.js'
import type {
  ReconciliationJob,
  ReconciliationTimeline,
  ReconciliationStatus,
  ReconciliationConfig
} from '../types/reconciliation.js'

export interface CacheEntry<T> {
  data: T
  timestamp: number
  accessCount: number
  lastAccessed: number
}

export interface CacheConfig {
  maxSize: number
  ttlMs: number
  enablePrefetch: boolean
  prefetchThreshold: number
  cleanupIntervalMs: number
}

export interface CacheStats {
  size: number
  maxSize: number
  hitRate: number
  totalHits: number
  totalMisses: number
  evictions: number
  prefetches: number
}

export class ReconciliationCacheService {
  private jobCache = new Map<string, CacheEntry<ReconciliationJob>>()
  private timelineCache = new Map<string, CacheEntry<ReconciliationTimeline>>()
  private statusCache = new Map<string, CacheEntry<ReconciliationStatus>>()
  private configCache: CacheEntry<ReconciliationConfig> | null = null
  
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    prefetches: 0
  }
  
  private cleanupTimer: NodeJS.Timeout | null = null
  private config: CacheConfig

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: 500,
      ttlMs: 300000, // 5 minutes
      enablePrefetch: true,
      prefetchThreshold: 10, // Prefetch after 10 accesses
      cleanupIntervalMs: 60000, // 1 minute
      ...config
    }

    this.startCleanupTimer()
  }

  /**
   * Get cached reconciliation job
   */
  getJob(jobId: string): ReconciliationJob | null {
    const entry = this.jobCache.get(jobId)
    
    if (!entry) {
      this.stats.misses++
      return null
    }

    if (this.isExpired(entry)) {
      this.jobCache.delete(jobId)
      this.stats.misses++
      return null
    }

    // Update access statistics
    entry.accessCount++
    entry.lastAccessed = Date.now()
    this.stats.hits++

    logger.debug('Job cache hit', { jobId, accessCount: entry.accessCount })
    return entry.data
  }

  /**
   * Cache reconciliation job
   */
  setJob(jobId: string, job: ReconciliationJob): void {
    this.ensureCapacity(this.jobCache)
    
    const entry: CacheEntry<ReconciliationJob> = {
      data: { ...job }, // Deep copy to prevent mutations
      timestamp: Date.now(),
      accessCount: 1,
      lastAccessed: Date.now()
    }

    this.jobCache.set(jobId, entry)
    logger.debug('Job cached', { jobId, cacheSize: this.jobCache.size })
  }

  /**
   * Get cached reconciliation timeline
   */
  getTimeline(jobId: string): ReconciliationTimeline | null {
    const entry = this.timelineCache.get(jobId)
    
    if (!entry) {
      this.stats.misses++
      return null
    }

    if (this.isExpired(entry)) {
      this.timelineCache.delete(jobId)
      this.stats.misses++
      return null
    }

    // Update access statistics
    entry.accessCount++
    entry.lastAccessed = Date.now()
    this.stats.hits++

    logger.debug('Timeline cache hit', { jobId, accessCount: entry.accessCount })
    return entry.data
  }

  /**
   * Cache reconciliation timeline
   */
  setTimeline(jobId: string, timeline: ReconciliationTimeline): void {
    this.ensureCapacity(this.timelineCache)
    
    const entry: CacheEntry<ReconciliationTimeline> = {
      data: { 
        ...timeline,
        entries: timeline.entries.map(e => ({ ...e })) // Deep copy entries
      },
      timestamp: Date.now(),
      accessCount: 1,
      lastAccessed: Date.now()
    }

    this.timelineCache.set(jobId, entry)
    logger.debug('Timeline cached', { jobId, cacheSize: this.timelineCache.size })
  }

  /**
   * Get cached reconciliation status
   */
  getStatus(jobId: string): ReconciliationStatus | null {
    const entry = this.statusCache.get(jobId)
    
    if (!entry) {
      this.stats.misses++
      return null
    }

    if (this.isExpired(entry)) {
      this.statusCache.delete(jobId)
      this.stats.misses++
      return null
    }

    // Update access statistics
    entry.accessCount++
    entry.lastAccessed = Date.now()
    this.stats.hits++

    logger.debug('Status cache hit', { jobId, accessCount: entry.accessCount })
    return entry.data
  }

  /**
   * Cache reconciliation status
   */
  setStatus(jobId: string, status: ReconciliationStatus): void {
    this.ensureCapacity(this.statusCache)
    
    const entry: CacheEntry<ReconciliationStatus> = {
      data: { ...status }, // Deep copy
      timestamp: Date.now(),
      accessCount: 1,
      lastAccessed: Date.now()
    }

    this.statusCache.set(jobId, entry)
    logger.debug('Status cached', { jobId, cacheSize: this.statusCache.size })
  }

  /**
   * Get cached reconciliation configuration
   */
  getConfig(): ReconciliationConfig | null {
    if (!this.configCache) {
      this.stats.misses++
      return null
    }

    if (this.isExpired(this.configCache)) {
      this.configCache = null
      this.stats.misses++
      return null
    }

    // Update access statistics
    this.configCache.accessCount++
    this.configCache.lastAccessed = Date.now()
    this.stats.hits++

    logger.debug('Config cache hit', { accessCount: this.configCache.accessCount })
    return this.configCache.data
  }

  /**
   * Cache reconciliation configuration
   */
  setConfig(config: ReconciliationConfig): void {
    this.configCache = {
      data: { ...config }, // Deep copy
      timestamp: Date.now(),
      accessCount: 1,
      lastAccessed: Date.now()
    }

    logger.debug('Config cached')
  }

  /**
   * Invalidate cache entries for a specific job
   */
  invalidateJob(jobId: string): void {
    this.jobCache.delete(jobId)
    this.timelineCache.delete(jobId)
    this.statusCache.delete(jobId)
    
    logger.debug('Job cache invalidated', { jobId })
  }

  /**
   * Invalidate all cache entries for a district
   */
  invalidateDistrict(districtId: string): void {
    let invalidatedCount = 0

    // Check job cache for district matches
    for (const [jobId, entry] of this.jobCache.entries()) {
      if (entry.data.districtId === districtId) {
        this.invalidateJob(jobId)
        invalidatedCount++
      }
    }

    logger.debug('District cache invalidated', { districtId, invalidatedCount })
  }

  /**
   * Prefetch related data based on access patterns
   */
  async prefetchRelated(jobId: string, prefetchCallback: (jobIds: string[]) => Promise<void>): Promise<void> {
    if (!this.config.enablePrefetch) {
      return
    }

    const jobEntry = this.jobCache.get(jobId)
    if (!jobEntry || jobEntry.accessCount < this.config.prefetchThreshold) {
      return
    }

    // Find related jobs (same district, recent months)
    const relatedJobIds: string[] = []
    const targetDistrict = jobEntry.data.districtId

    for (const [otherJobId, otherEntry] of this.jobCache.entries()) {
      if (otherJobId !== jobId && 
          otherEntry.data.districtId === targetDistrict &&
          !this.timelineCache.has(otherJobId)) {
        relatedJobIds.push(otherJobId)
      }
    }

    if (relatedJobIds.length > 0) {
      try {
        await prefetchCallback(relatedJobIds)
        this.stats.prefetches += relatedJobIds.length
        
        logger.debug('Prefetch completed', { 
          triggerJobId: jobId,
          prefetchedCount: relatedJobIds.length
        })
      } catch (error) {
        logger.warn('Prefetch failed', { jobId, error })
      }
    }
  }

  /**
   * Get frequently accessed jobs for optimization
   */
  getHotJobs(limit: number = 10): Array<{ jobId: string; accessCount: number; lastAccessed: number }> {
    const hotJobs = Array.from(this.jobCache.entries())
      .map(([jobId, entry]) => ({
        jobId,
        accessCount: entry.accessCount,
        lastAccessed: entry.lastAccessed
      }))
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, limit)

    return hotJobs
  }

  /**
   * Ensure cache capacity by evicting LRU entries
   */
  private ensureCapacity<T>(cache: Map<string, CacheEntry<T>>): void {
    if (cache.size >= this.config.maxSize) {
      // Find LRU entry
      let lruKey: string | null = null
      let lruTime = Date.now()

      for (const [key, entry] of cache.entries()) {
        if (entry.lastAccessed < lruTime) {
          lruTime = entry.lastAccessed
          lruKey = key
        }
      }

      if (lruKey) {
        cache.delete(lruKey)
        this.stats.evictions++
        logger.debug('Cache entry evicted (LRU)', { key: lruKey, cacheSize: cache.size })
      }
    }
  }

  /**
   * Check if cache entry is expired
   */
  private isExpired<T>(entry: CacheEntry<T>): boolean {
    return (Date.now() - entry.timestamp) > this.config.ttlMs
  }

  /**
   * Start periodic cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup()
    }, this.config.cleanupIntervalMs)
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    let cleanedCount = 0

    // Clean job cache
    for (const [key, entry] of this.jobCache.entries()) {
      if (this.isExpired(entry)) {
        this.jobCache.delete(key)
        cleanedCount++
      }
    }

    // Clean timeline cache
    for (const [key, entry] of this.timelineCache.entries()) {
      if (this.isExpired(entry)) {
        this.timelineCache.delete(key)
        cleanedCount++
      }
    }

    // Clean status cache
    for (const [key, entry] of this.statusCache.entries()) {
      if (this.isExpired(entry)) {
        this.statusCache.delete(key)
        cleanedCount++
      }
    }

    // Clean config cache
    if (this.configCache && this.isExpired(this.configCache)) {
      this.configCache = null
      cleanedCount++
    }

    if (cleanedCount > 0) {
      logger.debug('Cache cleanup completed', { cleanedCount })
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0

    return {
      size: this.jobCache.size + this.timelineCache.size + this.statusCache.size,
      maxSize: this.config.maxSize * 3, // Three caches
      hitRate,
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses,
      evictions: this.stats.evictions,
      prefetches: this.stats.prefetches
    }
  }

  /**
   * Clear all caches
   */
  clear(): void {
    this.jobCache.clear()
    this.timelineCache.clear()
    this.statusCache.clear()
    this.configCache = null
    
    // Reset stats
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      prefetches: 0
    }

    logger.info('All caches cleared')
  }

  /**
   * Shutdown cache service
   */
  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
    
    this.clear()
    logger.info('Cache service shutdown')
  }
}