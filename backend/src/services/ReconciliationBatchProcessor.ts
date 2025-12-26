/**
 * Batch processor for handling multiple district reconciliations efficiently
 * Implements parallel processing, resource management, and progress tracking
 */

import { logger } from '../utils/logger.js'
import { ReconciliationOrchestrator } from './ReconciliationOrchestrator.js'
import { ReconciliationCacheService } from './ReconciliationCacheService.js'
import { ReconciliationStorageOptimizer } from './ReconciliationStorageOptimizer.js'
import type {
  ReconciliationConfig,
  ReconciliationStatus,
  DistrictStatistics
} from '../types/reconciliation.js'

export interface BatchProcessingConfig {
  maxConcurrentJobs: number
  batchSize: number
  retryAttempts: number
  retryDelayMs: number
  timeoutMs: number
  enableResourceThrottling: boolean
  memoryThresholdMB: number
}

export interface BatchJob {
  districtId: string
  targetMonth: string
  priority: number
  configOverride?: Partial<ReconciliationConfig>
  currentData?: DistrictStatistics
  cachedData?: DistrictStatistics
}

export interface BatchResult {
  districtId: string
  targetMonth: string
  success: boolean
  jobId?: string
  status?: ReconciliationStatus
  error?: Error
  processingTimeMs: number
  retryCount: number
}

export interface BatchProgress {
  totalJobs: number
  completedJobs: number
  failedJobs: number
  activeJobs: number
  queuedJobs: number
  estimatedCompletionMs: number
  averageProcessingTimeMs: number
}

export class ReconciliationBatchProcessor {
  private orchestrator: ReconciliationOrchestrator
  private cacheService: ReconciliationCacheService
  private storageOptimizer: ReconciliationStorageOptimizer
  private config: BatchProcessingConfig
  
  private activeJobs = new Map<string, Promise<BatchResult>>()
  private jobQueue: BatchJob[] = []
  private results: BatchResult[] = []
  private isProcessing = false
  private startTime: number = 0

  constructor(
    orchestrator?: ReconciliationOrchestrator,
    cacheService?: ReconciliationCacheService,
    storageOptimizer?: ReconciliationStorageOptimizer,
    config: Partial<BatchProcessingConfig> = {}
  ) {
    this.orchestrator = orchestrator || new ReconciliationOrchestrator()
    this.cacheService = cacheService || new ReconciliationCacheService()
    this.storageOptimizer = storageOptimizer || new ReconciliationStorageOptimizer()
    
    this.config = {
      maxConcurrentJobs: 5,
      batchSize: 20,
      retryAttempts: 3,
      retryDelayMs: 5000,
      timeoutMs: 300000, // 5 minutes per job
      enableResourceThrottling: true,
      memoryThresholdMB: 1024, // 1GB
      ...config
    }
  }

  /**
   * Process multiple district reconciliations in batches
   */
  async processBatch(jobs: BatchJob[]): Promise<BatchResult[]> {
    if (this.isProcessing) {
      throw new Error('Batch processing already in progress')
    }

    this.isProcessing = true
    this.startTime = Date.now()
    this.results = []
    this.jobQueue = [...jobs].sort((a, b) => b.priority - a.priority) // Sort by priority

    logger.info('Starting batch reconciliation processing', {
      totalJobs: jobs.length,
      maxConcurrent: this.config.maxConcurrentJobs,
      batchSize: this.config.batchSize
    })

    try {
      // Process jobs in batches
      while (this.jobQueue.length > 0 || this.activeJobs.size > 0) {
        // Start new jobs up to concurrency limit
        await this.startPendingJobs()
        
        // Wait for at least one job to complete
        if (this.activeJobs.size > 0) {
          await this.waitForJobCompletion()
        }

        // Check resource usage and throttle if necessary
        if (this.config.enableResourceThrottling) {
          await this.checkResourceUsage()
        }
      }

      // Flush any pending storage operations
      await this.storageOptimizer.flush()

      const totalTime = Date.now() - this.startTime
      const successCount = this.results.filter(r => r.success).length
      const failureCount = this.results.filter(r => !r.success).length

      logger.info('Batch reconciliation processing completed', {
        totalJobs: this.results.length,
        successful: successCount,
        failed: failureCount,
        totalTimeMs: totalTime,
        averageTimeMs: totalTime / this.results.length
      })

      return this.results

    } catch (error) {
      logger.error('Batch processing failed', { error })
      throw error
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Start pending jobs up to concurrency limit
   */
  private async startPendingJobs(): Promise<void> {
    while (this.jobQueue.length > 0 && this.activeJobs.size < this.config.maxConcurrentJobs) {
      const job = this.jobQueue.shift()!
      const jobKey = `${job.districtId}-${job.targetMonth}`
      
      // Check if job is already cached
      const cachedJob = this.cacheService.getJob(jobKey)
      if (cachedJob && cachedJob.status === 'completed') {
        logger.debug('Skipping completed job from cache', { districtId: job.districtId, targetMonth: job.targetMonth })
        
        this.results.push({
          districtId: job.districtId,
          targetMonth: job.targetMonth,
          success: true,
          jobId: cachedJob.id,
          processingTimeMs: 0,
          retryCount: 0
        })
        continue
      }

      // Start the job
      const jobPromise = this.processJob(job)
      this.activeJobs.set(jobKey, jobPromise)
      
      logger.debug('Started reconciliation job', { 
        districtId: job.districtId, 
        targetMonth: job.targetMonth,
        activeJobs: this.activeJobs.size,
        queuedJobs: this.jobQueue.length
      })
    }
  }

  /**
   * Wait for at least one job to complete
   */
  private async waitForJobCompletion(): Promise<void> {
    if (this.activeJobs.size === 0) {
      return
    }

    // Wait for the first job to complete
    const jobPromises = Array.from(this.activeJobs.values())
    const result = await Promise.race(jobPromises)
    
    // Find and remove the completed job
    for (const [key, promise] of this.activeJobs.entries()) {
      try {
        const promiseResult = await Promise.race([promise, Promise.resolve(null)])
        if (promiseResult === result) {
          this.activeJobs.delete(key)
          this.results.push(result)
          break
        }
      } catch {
        // Job is still pending
      }
    }
  }

  /**
   * Process a single reconciliation job with retry logic
   */
  private async processJob(job: BatchJob): Promise<BatchResult> {
    const startTime = Date.now()
    let retryCount = 0
    let lastError: Error | undefined

    while (retryCount <= this.config.retryAttempts) {
      try {
        const result = await this.executeJobWithTimeout(job)
        
        // Cache successful result
        if (result.success && result.jobId) {
          const reconciliationJob = await this.storageOptimizer.getJob(result.jobId)
          if (reconciliationJob) {
            this.cacheService.setJob(result.jobId, reconciliationJob)
          }
        }

        return {
          ...result,
          processingTimeMs: Date.now() - startTime,
          retryCount
        }

      } catch (error) {
        lastError = error as Error
        retryCount++
        
        logger.warn('Job execution failed, retrying', {
          districtId: job.districtId,
          targetMonth: job.targetMonth,
          attempt: retryCount,
          maxAttempts: this.config.retryAttempts,
          error: lastError.message
        })

        if (retryCount <= this.config.retryAttempts) {
          await this.delay(this.config.retryDelayMs * retryCount) // Exponential backoff
        }
      }
    }

    // All retries exhausted
    return {
      districtId: job.districtId,
      targetMonth: job.targetMonth,
      success: false,
      error: lastError,
      processingTimeMs: Date.now() - startTime,
      retryCount
    }
  }

  /**
   * Execute job with timeout protection
   */
  private async executeJobWithTimeout(job: BatchJob): Promise<BatchResult> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Job timeout after ${this.config.timeoutMs}ms`))
      }, this.config.timeoutMs)

      this.executeJob(job)
        .then(result => {
          clearTimeout(timeout)
          resolve(result)
        })
        .catch(error => {
          clearTimeout(timeout)
          reject(error)
        })
    })
  }

  /**
   * Execute the actual reconciliation job
   */
  private async executeJob(job: BatchJob): Promise<BatchResult> {
    logger.debug('Executing reconciliation job', {
      districtId: job.districtId,
      targetMonth: job.targetMonth
    })

    try {
      // Start reconciliation
      const reconciliationJob = await this.orchestrator.startReconciliation(
        job.districtId,
        job.targetMonth,
        job.configOverride,
        'automatic'
      )

      // If we have current and cached data, process a cycle immediately
      if (job.currentData && job.cachedData) {
        const status = await this.orchestrator.processReconciliationCycle(
          reconciliationJob.id,
          job.currentData,
          job.cachedData
        )

        return {
          districtId: job.districtId,
          targetMonth: job.targetMonth,
          success: true,
          jobId: reconciliationJob.id,
          status,
          processingTimeMs: 0,
          retryCount: 0
        }
      }

      return {
        districtId: job.districtId,
        targetMonth: job.targetMonth,
        success: true,
        jobId: reconciliationJob.id,
        processingTimeMs: 0,
        retryCount: 0
      }

    } catch (error) {
      logger.error('Job execution failed', {
        districtId: job.districtId,
        targetMonth: job.targetMonth,
        error
      })

      throw error
    }
  }

  /**
   * Check system resource usage and throttle if necessary
   */
  private async checkResourceUsage(): Promise<void> {
    if (!this.config.enableResourceThrottling) {
      return
    }

    try {
      const memoryUsage = process.memoryUsage()
      const memoryUsageMB = memoryUsage.heapUsed / 1024 / 1024

      if (memoryUsageMB > this.config.memoryThresholdMB) {
        logger.warn('High memory usage detected, throttling batch processing', {
          memoryUsageMB,
          threshold: this.config.memoryThresholdMB,
          activeJobs: this.activeJobs.size
        })

        // Force garbage collection if available
        if (global.gc) {
          global.gc()
        }

        // Clear caches to free memory
        this.cacheService.clear()
        this.storageOptimizer.clearCache()

        // Wait for memory to stabilize
        await this.delay(2000)
      }
    } catch (error) {
      logger.warn('Resource usage check failed', { error })
    }
  }

  /**
   * Get current batch processing progress
   */
  getProgress(): BatchProgress {
    const totalJobs = this.results.length + this.activeJobs.size + this.jobQueue.length
    const completedJobs = this.results.length
    const failedJobs = this.results.filter(r => !r.success).length
    const activeJobs = this.activeJobs.size
    const queuedJobs = this.jobQueue.length

    // Calculate average processing time
    const successfulResults = this.results.filter(r => r.success && r.processingTimeMs > 0)
    const averageProcessingTimeMs = successfulResults.length > 0
      ? successfulResults.reduce((sum, r) => sum + r.processingTimeMs, 0) / successfulResults.length
      : 0

    // Estimate completion time
    const remainingJobs = activeJobs + queuedJobs
    const estimatedCompletionMs = remainingJobs > 0 && averageProcessingTimeMs > 0
      ? (remainingJobs / this.config.maxConcurrentJobs) * averageProcessingTimeMs
      : 0

    return {
      totalJobs,
      completedJobs,
      failedJobs,
      activeJobs,
      queuedJobs,
      estimatedCompletionMs,
      averageProcessingTimeMs
    }
  }

  /**
   * Cancel all pending jobs
   */
  async cancelBatch(): Promise<void> {
    logger.info('Cancelling batch processing', {
      activeJobs: this.activeJobs.size,
      queuedJobs: this.jobQueue.length
    })

    // Clear the queue
    this.jobQueue = []

    // Wait for active jobs to complete (they can't be cancelled mid-execution)
    if (this.activeJobs.size > 0) {
      logger.info('Waiting for active jobs to complete before cancellation')
      await Promise.allSettled(Array.from(this.activeJobs.values()))
    }

    this.isProcessing = false
  }

  /**
   * Get batch processing statistics
   */
  getStatistics(): {
    totalProcessed: number
    successRate: number
    averageProcessingTime: number
    totalProcessingTime: number
    cacheStats: any
  } {
    const totalProcessed = this.results.length
    const successful = this.results.filter(r => r.success).length
    const successRate = totalProcessed > 0 ? successful / totalProcessed : 0
    
    const processingTimes = this.results.map(r => r.processingTimeMs)
    const averageProcessingTime = processingTimes.length > 0
      ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
      : 0
    
    const totalProcessingTime = this.startTime > 0 ? Date.now() - this.startTime : 0

    return {
      totalProcessed,
      successRate,
      averageProcessingTime,
      totalProcessingTime,
      cacheStats: this.cacheService.getStats()
    }
  }

  /**
   * Utility method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.cancelBatch()
    await this.storageOptimizer.cleanup()
    this.cacheService.shutdown()
  }
}