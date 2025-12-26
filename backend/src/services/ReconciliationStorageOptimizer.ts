/**
 * Performance-optimized storage manager for reconciliation data
 * Implements caching, indexing, and batch operations for better performance
 */

import { logger } from '../utils/logger.js'
import { ReconciliationStorageManager } from './ReconciliationStorageManager.js'
import type {
  ReconciliationJob,
  ReconciliationTimeline,
  ReconciliationIndex,
} from '../types/reconciliation.js'

export interface StorageOptimizationConfig {
  enableInMemoryCache: boolean
  cacheMaxSize: number
  batchSize: number
  indexCacheTimeout: number // milliseconds
}

export interface BatchOperation<T> {
  type: 'save' | 'delete'
  data: T
  key: string
}

export class ReconciliationStorageOptimizer extends ReconciliationStorageManager {
  private jobCache = new Map<string, ReconciliationJob>()
  private timelineCache = new Map<string, ReconciliationTimeline>()
  private indexCacheTimestamp: number = 0
  private config: StorageOptimizationConfig
  private pendingOperations = new Map<string, BatchOperation<unknown>>()
  private batchTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    storageDir: string = './cache/reconciliation',
    config: Partial<StorageOptimizationConfig> = {}
  ) {
    super(storageDir)

    this.config = {
      enableInMemoryCache: true,
      cacheMaxSize: 1000,
      batchSize: 10,
      indexCacheTimeout: 30000, // 30 seconds
      ...config,
    }
  }

  /**
   * Optimized job retrieval with caching
   */
  async getJob(jobId: string): Promise<ReconciliationJob | null> {
    // Check cache first if enabled
    if (this.config.enableInMemoryCache && this.jobCache.has(jobId)) {
      logger.debug('Job cache hit', { jobId })
      return this.jobCache.get(jobId)!
    }

    // Fallback to parent implementation
    const job = await super.getJob(jobId)

    // Cache the result if enabled and cache has space
    if (
      job &&
      this.config.enableInMemoryCache &&
      this.jobCache.size < this.config.cacheMaxSize
    ) {
      this.jobCache.set(jobId, job)
      logger.debug('Job cached', { jobId, cacheSize: this.jobCache.size })
    }

    return job
  }

  /**
   * Optimized timeline retrieval with caching
   */
  async getTimeline(jobId: string): Promise<ReconciliationTimeline | null> {
    // Check cache first if enabled
    if (this.config.enableInMemoryCache && this.timelineCache.has(jobId)) {
      logger.debug('Timeline cache hit', { jobId })
      return this.timelineCache.get(jobId)!
    }

    // Fallback to parent implementation
    const timeline = await super.getTimeline(jobId)

    // Cache the result if enabled and cache has space
    if (
      timeline &&
      this.config.enableInMemoryCache &&
      this.timelineCache.size < this.config.cacheMaxSize
    ) {
      this.timelineCache.set(jobId, timeline)
      logger.debug('Timeline cached', {
        jobId,
        cacheSize: this.timelineCache.size,
      })
    }

    return timeline
  }

  /**
   * Batch save job with deferred write
   */
  async saveJob(job: ReconciliationJob): Promise<void> {
    // Update cache immediately
    if (this.config.enableInMemoryCache) {
      this.jobCache.set(job.id, { ...job })
    }

    // Add to batch operations
    this.pendingOperations.set(`job-${job.id}`, {
      type: 'save',
      data: job,
      key: job.id,
    })

    // Schedule batch processing
    this.scheduleBatchProcessing()
  }

  /**
   * Batch save timeline with deferred write
   */
  async saveTimeline(timeline: ReconciliationTimeline): Promise<void> {
    // Update cache immediately
    if (this.config.enableInMemoryCache) {
      this.timelineCache.set(timeline.jobId, { ...timeline })
    }

    // Add to batch operations
    this.pendingOperations.set(`timeline-${timeline.jobId}`, {
      type: 'save',
      data: timeline,
      key: timeline.jobId,
    })

    // Schedule batch processing
    this.scheduleBatchProcessing()
  }

  /**
   * Schedule batch processing of pending operations
   */
  private scheduleBatchProcessing(): void {
    if (this.batchTimer) {
      return // Already scheduled
    }

    // Process immediately if batch size reached
    if (this.pendingOperations.size >= this.config.batchSize) {
      this.processBatch()
      return
    }

    // Otherwise schedule for later
    this.batchTimer = setTimeout(() => {
      this.processBatch()
    }, 100) // 100ms delay for batching
  }

  /**
   * Force immediate processing of all pending operations
   */
  async flush(): Promise<void> {
    await this.processBatch()
  }

  /**
   * Process batch of pending operations
   */
  private async processBatch(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }

    if (this.pendingOperations.size === 0) {
      return
    }

    const operations = Array.from(this.pendingOperations.entries()) // Get [key, operation] pairs
    this.pendingOperations.clear()

    logger.debug('Processing batch operations', { count: operations.length })

    try {
      // Ensure storage is initialized before processing operations
      await this.init()

      // Group operations by type for efficient processing
      const jobOperations = operations.filter(([mapKey, _op]) =>
        mapKey.startsWith('job-')
      )
      const timelineOperations = operations.filter(([mapKey, _op]) =>
        mapKey.startsWith('timeline-')
      )

      // Process jobs in parallel
      if (jobOperations.length > 0) {
        await Promise.all(
          jobOperations.map(([_mapKey, op]) =>
            op.type === 'save'
              ? super.saveJob(op.data as ReconciliationJob)
              : super.deleteJob(op.key)
          )
        )
      }

      // Process timelines in parallel
      if (timelineOperations.length > 0) {
        await Promise.all(
          timelineOperations.map(
            ([_mapKey, op]) =>
              op.type === 'save'
                ? super.saveTimeline(op.data as ReconciliationTimeline)
                : Promise.resolve() // No delete timeline method in parent
          )
        )
      }

      // Invalidate index cache after batch operations to ensure fresh data
      if (jobOperations.length > 0) {
        this.indexCache = null
        this.indexCacheTimestamp = 0
      }

      logger.debug('Batch operations completed', {
        jobs: jobOperations.length,
        timelines: timelineOperations.length,
      })
    } catch (error) {
      logger.error('Batch processing failed', {
        error,
        operationCount: operations.length,
      })
      throw error
    }
  }

  /**
   * Optimized index loading with caching and timeout
   */
  protected async loadIndex(): Promise<ReconciliationIndex> {
    const now = Date.now()

    // Check if cached index is still valid
    if (
      this.indexCache &&
      now - this.indexCacheTimestamp < this.config.indexCacheTimeout
    ) {
      return this.indexCache
    }

    // Load fresh index
    const index = await super.loadIndex()
    this.indexCache = index
    this.indexCacheTimestamp = now

    logger.debug('Index refreshed', {
      totalJobs: Object.keys(index.jobs).length,
      cacheTimeout: this.config.indexCacheTimeout,
    })

    return index
  }

  /**
   * Bulk load multiple jobs efficiently
   */
  async getJobsBulk(jobIds: string[]): Promise<Map<string, ReconciliationJob>> {
    const results = new Map<string, ReconciliationJob>()
    const uncachedIds: string[] = []

    // Check cache for existing jobs
    if (this.config.enableInMemoryCache) {
      for (const jobId of jobIds) {
        const cachedJob = this.jobCache.get(jobId)
        if (cachedJob) {
          results.set(jobId, cachedJob)
        } else {
          uncachedIds.push(jobId)
        }
      }
    } else {
      uncachedIds.push(...jobIds)
    }

    // Load uncached jobs in parallel
    if (uncachedIds.length > 0) {
      const loadPromises = uncachedIds.map(async jobId => {
        const job = await super.getJob(jobId)
        if (job) {
          results.set(jobId, job)

          // Cache if enabled and space available
          if (
            this.config.enableInMemoryCache &&
            this.jobCache.size < this.config.cacheMaxSize
          ) {
            this.jobCache.set(jobId, job)
          }
        }
      })

      await Promise.all(loadPromises)
    }

    logger.debug('Bulk job load completed', {
      requested: jobIds.length,
      found: results.size,
      cached: jobIds.length - uncachedIds.length,
      loaded: uncachedIds.length,
    })

    return results
  }

  /**
   * Bulk load multiple timelines efficiently
   */
  async getTimelinesBulk(
    jobIds: string[]
  ): Promise<Map<string, ReconciliationTimeline>> {
    const results = new Map<string, ReconciliationTimeline>()
    const uncachedIds: string[] = []

    // Check cache for existing timelines
    if (this.config.enableInMemoryCache) {
      for (const jobId of jobIds) {
        const cachedTimeline = this.timelineCache.get(jobId)
        if (cachedTimeline) {
          results.set(jobId, cachedTimeline)
        } else {
          uncachedIds.push(jobId)
        }
      }
    } else {
      uncachedIds.push(...jobIds)
    }

    // Load uncached timelines in parallel
    if (uncachedIds.length > 0) {
      const loadPromises = uncachedIds.map(async jobId => {
        const timeline = await super.getTimeline(jobId)
        if (timeline) {
          results.set(jobId, timeline)

          // Cache if enabled and space available
          if (
            this.config.enableInMemoryCache &&
            this.timelineCache.size < this.config.cacheMaxSize
          ) {
            this.timelineCache.set(jobId, timeline)
          }
        }
      })

      await Promise.all(loadPromises)
    }

    logger.debug('Bulk timeline load completed', {
      requested: jobIds.length,
      found: results.size,
      cached: jobIds.length - uncachedIds.length,
      loaded: uncachedIds.length,
    })

    return results
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.jobCache.clear()
    this.timelineCache.clear()
    this.indexCache = null
    this.indexCacheTimestamp = 0

    logger.info('All caches cleared')
  }

  /**
   * Override getAllJobs to include both cached and persisted jobs
   */
  async getAllJobs(): Promise<ReconciliationJob[]> {
    // First flush any pending operations to ensure all jobs are persisted
    await this.flush()

    // Force index cache invalidation to ensure fresh data
    this.indexCache = null
    this.indexCacheTimestamp = 0

    // Then get all jobs from parent (which will use fresh index after flush)
    return super.getAllJobs()
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    jobCacheSize: number
    timelineCacheSize: number
    pendingOperations: number
    indexCacheAge: number
  } {
    return {
      jobCacheSize: this.jobCache.size,
      timelineCacheSize: this.timelineCache.size,
      pendingOperations: this.pendingOperations.size,
      indexCacheAge:
        this.indexCacheTimestamp > 0
          ? Date.now() - this.indexCacheTimestamp
          : -1,
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }

    await this.flush()
    this.clearCache()
  }
}
