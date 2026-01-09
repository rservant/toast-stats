/**
 * Concurrency Limiter Utility
 *
 * Provides concurrency control to limit the number of simultaneous operations
 * running at any given time. Implements a semaphore-like pattern to prevent
 * overwhelming system resources.
 *
 * Implements Requirements 9.2: Configurable concurrency limits for district processing
 */

import { logger } from './logger.js'

export interface ConcurrencyLimiterOptions {
  /** Maximum number of concurrent operations */
  maxConcurrent: number
  /** Timeout for acquiring a slot in milliseconds */
  timeoutMs?: number
  /** Queue size limit (0 = unlimited) */
  queueLimit?: number
}

export interface ConcurrencySlot {
  /** Unique identifier for this slot */
  id: string
  /** When this slot was acquired */
  acquiredAt: number
  /** Optional context information */
  context?: Record<string, unknown>
}

export interface ConcurrencyStatus {
  /** Current number of active operations */
  active: number
  /** Maximum concurrent operations allowed */
  maxConcurrent: number
  /** Number of operations waiting in queue */
  queued: number
  /** Maximum queue size (0 = unlimited) */
  queueLimit: number
  /** Average wait time in milliseconds */
  averageWaitTime: number
  /** Total operations processed */
  totalProcessed: number
}

/**
 * Semaphore-based concurrency limiter
 * Controls the number of simultaneous operations
 */
export class ConcurrencyLimiter {
  private activeSlots: Map<string, ConcurrencySlot> = new Map()
  private waitingQueue: Array<{
    resolve: (slot: ConcurrencySlot) => void
    reject: (error: Error) => void
    enqueuedAt: number
    context?: Record<string, unknown>
  }> = []
  private totalProcessed: number = 0
  private totalWaitTime: number = 0
  private slotIdCounter: number = 0

  constructor(private options: ConcurrencyLimiterOptions) {
    this.options.timeoutMs = options.timeoutMs || 30000
    this.options.queueLimit = options.queueLimit || 0

    logger.debug('Concurrency limiter initialized', {
      maxConcurrent: options.maxConcurrent,
      timeoutMs: this.options.timeoutMs,
      queueLimit: this.options.queueLimit,
      operation: 'ConcurrencyLimiter.constructor',
    })
  }

  /**
   * Acquire a concurrency slot
   * Returns a promise that resolves when a slot is available
   */
  async acquire(context?: Record<string, unknown>): Promise<ConcurrencySlot> {
    // Check if we can immediately acquire a slot
    if (this.activeSlots.size < this.options.maxConcurrent) {
      return this.createSlot(context)
    }

    // Check queue limit
    if (
      this.options.queueLimit &&
      this.options.queueLimit > 0 &&
      this.waitingQueue.length >= this.options.queueLimit
    ) {
      throw new Error(
        `Concurrency queue limit exceeded: ${this.options.queueLimit}`
      )
    }

    // Add to waiting queue
    return new Promise((resolve, reject) => {
      const enqueuedAt = Date.now()

      // Set up timeout
      const timeoutId = setTimeout(() => {
        // Remove from queue
        const index = this.waitingQueue.findIndex(
          item => item.resolve === resolve
        )
        if (index >= 0) {
          this.waitingQueue.splice(index, 1)
        }

        reject(
          new Error(
            `Concurrency slot acquisition timeout after ${this.options.timeoutMs}ms`
          )
        )
      }, this.options.timeoutMs)

      this.waitingQueue.push({
        resolve: (slot: ConcurrencySlot) => {
          clearTimeout(timeoutId)

          // Track wait time
          const waitTime = Date.now() - enqueuedAt
          this.totalWaitTime += waitTime

          logger.debug('Concurrency slot acquired from queue', {
            slotId: slot.id,
            waitTime,
            queueLength: this.waitingQueue.length,
            operation: 'ConcurrencyLimiter.acquire',
          })

          resolve(slot)
        },
        reject: (error: Error) => {
          clearTimeout(timeoutId)
          reject(error)
        },
        enqueuedAt,
        context,
      })

      logger.debug('Added to concurrency queue', {
        queueLength: this.waitingQueue.length,
        activeSlots: this.activeSlots.size,
        maxConcurrent: this.options.maxConcurrent,
        operation: 'ConcurrencyLimiter.acquire',
      })
    })
  }

  /**
   * Release a concurrency slot
   */
  release(slot: ConcurrencySlot): void {
    if (!this.activeSlots.has(slot.id)) {
      logger.warn('Attempted to release unknown slot', {
        slotId: slot.id,
        operation: 'ConcurrencyLimiter.release',
      })
      return
    }

    // Remove from active slots
    this.activeSlots.delete(slot.id)
    this.totalProcessed++

    logger.debug('Concurrency slot released', {
      slotId: slot.id,
      duration: Date.now() - slot.acquiredAt,
      activeSlots: this.activeSlots.size,
      operation: 'ConcurrencyLimiter.release',
    })

    // Process waiting queue
    this.processQueue()
  }

  /**
   * Execute a function with concurrency control
   */
  async execute<T>(
    fn: (slot: ConcurrencySlot) => Promise<T>,
    context?: Record<string, unknown>
  ): Promise<T> {
    const slot = await this.acquire(context)

    try {
      return await fn(slot)
    } finally {
      this.release(slot)
    }
  }

  /**
   * Execute multiple functions with concurrency control
   * Returns results in the same order as input functions
   */
  async executeAll<T>(
    functions: Array<(slot: ConcurrencySlot) => Promise<T>>,
    context?: Record<string, unknown>
  ): Promise<T[]> {
    const results: T[] = new Array(functions.length)
    const promises = functions.map(async (fn, index) => {
      const result = await this.execute(fn, { ...context, index })
      results[index] = result
      return result
    })

    await Promise.all(promises)
    return results
  }

  /**
   * Execute functions with concurrency control, allowing some to fail
   * Returns PromiseSettledResult array
   *
   * IMPORTANT: This method processes functions in batches to respect the queue limit.
   * It does NOT create all promises upfront, which would exceed the queue limit
   * and cause silent rejections for functions beyond (maxConcurrent + queueLimit).
   */
  async executeAllSettled<T>(
    functions: Array<(slot: ConcurrencySlot) => Promise<T>>,
    context?: Record<string, unknown>
  ): Promise<PromiseSettledResult<T>[]> {
    const results: PromiseSettledResult<T>[] = new Array(functions.length)
    const maxInFlight =
      this.options.maxConcurrent + (this.options.queueLimit || 0)

    // Process functions in batches to avoid exceeding queue limit
    let nextIndex = 0
    const inFlight: Map<number, Promise<void>> = new Map()

    const startNext = async (): Promise<void> => {
      if (nextIndex >= functions.length) return

      const index = nextIndex++
      const fn = functions[index]

      if (!fn) return

      const promise = this.execute(fn, context)
        .then(value => {
          results[index] = { status: 'fulfilled' as const, value }
        })
        .catch(reason => {
          results[index] = { status: 'rejected' as const, reason }
        })
        .finally(() => {
          inFlight.delete(index)
          // Start next function when this one completes
          if (nextIndex < functions.length && inFlight.size < maxInFlight) {
            startNext()
          }
        })

      inFlight.set(index, promise)
    }

    // Start initial batch up to maxInFlight
    const initialBatchSize = Math.min(maxInFlight, functions.length)
    for (let i = 0; i < initialBatchSize; i++) {
      startNext()
    }

    // Wait for all to complete
    while (inFlight.size > 0) {
      await Promise.race(inFlight.values())
    }

    return results
  }

  /**
   * Get current concurrency status
   */
  getStatus(): ConcurrencyStatus {
    return {
      active: this.activeSlots.size,
      maxConcurrent: this.options.maxConcurrent,
      queued: this.waitingQueue.length,
      queueLimit: this.options.queueLimit || 0,
      averageWaitTime:
        this.totalProcessed > 0 ? this.totalWaitTime / this.totalProcessed : 0,
      totalProcessed: this.totalProcessed,
    }
  }

  /**
   * Get detailed information about active slots
   */
  getActiveSlots(): ConcurrencySlot[] {
    return Array.from(this.activeSlots.values())
  }

  /**
   * Check if the limiter is at capacity
   */
  isAtCapacity(): boolean {
    return this.activeSlots.size >= this.options.maxConcurrent
  }

  /**
   * Check if the queue is full
   */
  isQueueFull(): boolean {
    return (
      (this.options?.queueLimit ?? 0) > 0 &&
      this.waitingQueue.length >= (this.options?.queueLimit ?? 0)
    )
  }

  /**
   * Clear all waiting operations (they will be rejected)
   */
  clearQueue(): void {
    const queueLength = this.waitingQueue.length

    while (this.waitingQueue.length > 0) {
      const item = this.waitingQueue.shift()!
      item.reject(new Error('Concurrency queue cleared'))
    }

    logger.info('Concurrency queue cleared', {
      clearedItems: queueLength,
      operation: 'ConcurrencyLimiter.clearQueue',
    })
  }

  /**
   * Update concurrency limit
   */
  updateLimit(newLimit: number): void {
    const oldLimit = this.options.maxConcurrent
    this.options.maxConcurrent = Math.max(1, newLimit)

    logger.info('Concurrency limit updated', {
      oldLimit,
      newLimit: this.options.maxConcurrent,
      activeSlots: this.activeSlots.size,
      operation: 'ConcurrencyLimiter.updateLimit',
    })

    // If limit increased, process more from queue
    if (this.options.maxConcurrent > oldLimit) {
      this.processQueue()
    }
  }

  /**
   * Create a new concurrency slot
   */
  private createSlot(context?: Record<string, unknown>): ConcurrencySlot {
    const slot: ConcurrencySlot = {
      id: `slot_${++this.slotIdCounter}_${Date.now()}`,
      acquiredAt: Date.now(),
      context,
    }

    this.activeSlots.set(slot.id, slot)

    logger.debug('Concurrency slot created', {
      slotId: slot.id,
      activeSlots: this.activeSlots.size,
      maxConcurrent: this.options.maxConcurrent,
      operation: 'ConcurrencyLimiter.createSlot',
    })

    return slot
  }

  /**
   * Process the waiting queue
   */
  private processQueue(): void {
    while (
      this.waitingQueue.length > 0 &&
      this.activeSlots.size < this.options.maxConcurrent
    ) {
      const item = this.waitingQueue.shift()!
      const slot = this.createSlot(item.context)
      item.resolve(slot)
    }
  }
}

/**
 * Global concurrency limiter manager
 */
export class ConcurrencyLimiterManager {
  private static limiters: Map<string, ConcurrencyLimiter> = new Map()

  /**
   * Get or create a concurrency limiter for a specific service
   */
  static getLimiter(
    serviceName: string,
    options: ConcurrencyLimiterOptions
  ): ConcurrencyLimiter {
    if (!this.limiters.has(serviceName)) {
      this.limiters.set(serviceName, new ConcurrencyLimiter(options))

      logger.info('Concurrency limiter created for service', {
        serviceName,
        maxConcurrent: options.maxConcurrent,
        timeoutMs: options.timeoutMs,
        queueLimit: options.queueLimit,
        operation: 'ConcurrencyLimiterManager.getLimiter',
      })
    }

    return this.limiters.get(serviceName)!
  }

  /**
   * Get status of all concurrency limiters
   */
  static getAllStatus(): Record<string, ConcurrencyStatus> {
    const status: Record<string, ConcurrencyStatus> = {}

    for (const [serviceName, limiter] of this.limiters.entries()) {
      status[serviceName] = limiter.getStatus()
    }

    return status
  }

  /**
   * Update concurrency limit for a service
   */
  static updateLimit(serviceName: string, newLimit: number): boolean {
    const limiter = this.limiters.get(serviceName)
    if (limiter) {
      limiter.updateLimit(newLimit)
      return true
    }
    return false
  }

  /**
   * Clear all queues
   */
  static clearAllQueues(): void {
    for (const limiter of this.limiters.values()) {
      limiter.clearQueue()
    }

    logger.info('All concurrency queues cleared', {
      count: this.limiters.size,
      operation: 'ConcurrencyLimiterManager.clearAllQueues',
    })
  }

  /**
   * Remove a concurrency limiter
   */
  static removeLimiter(serviceName: string): boolean {
    const limiter = this.limiters.get(serviceName)
    if (limiter) {
      limiter.clearQueue()
      this.limiters.delete(serviceName)

      logger.info('Concurrency limiter removed', {
        serviceName,
        operation: 'ConcurrencyLimiterManager.removeLimiter',
      })

      return true
    }
    return false
  }
}
