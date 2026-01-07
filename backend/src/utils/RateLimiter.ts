/**
 * Rate Limiter Utility
 *
 * Provides rate limiting functionality to protect external data sources
 * from being overwhelmed by too many requests in a short time period.
 *
 * Implements Requirements 9.1: Rate limiting to avoid overwhelming data sources
 */

import { logger } from './logger.js'

export interface RateLimiterOptions {
  /** Maximum number of requests allowed per window */
  maxRequests: number
  /** Time window in milliseconds */
  windowMs: number
  /** Minimum delay between requests in milliseconds */
  minDelayMs?: number
  /** Maximum delay for backoff in milliseconds */
  maxDelayMs?: number
  /** Backoff multiplier when rate limit is hit */
  backoffMultiplier?: number
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean
  /** Delay in milliseconds before next request should be made */
  delayMs: number
  /** Current request count in the window */
  currentCount: number
  /** Time until window resets in milliseconds */
  resetTimeMs: number
}

/**
 * Token bucket rate limiter implementation
 * Provides smooth rate limiting with burst capability
 */
export class RateLimiter {
  private tokens: number
  private lastRefill: number
  private requestHistory: number[] = []
  private consecutiveRateLimits: number = 0

  constructor(private options: RateLimiterOptions) {
    this.tokens = options.maxRequests
    this.lastRefill = Date.now()

    // Set defaults
    this.options.minDelayMs = options.minDelayMs || 100
    this.options.maxDelayMs = options.maxDelayMs || 30000
    this.options.backoffMultiplier = options.backoffMultiplier || 2

    logger.debug('Rate limiter initialized', {
      maxRequests: options.maxRequests,
      windowMs: options.windowMs,
      minDelayMs: this.options.minDelayMs,
      operation: 'RateLimiter.constructor',
    })
  }

  /**
   * Check if a request is allowed and get delay information
   */
  checkRequest(): RateLimitResult {
    const now = Date.now()
    this.refillTokens(now)
    this.cleanupHistory(now)

    const currentCount = this.requestHistory.length
    const allowed = this.tokens > 0

    let delayMs = this.options.minDelayMs || 0

    if (!allowed) {
      // Calculate backoff delay based on consecutive rate limits
      this.consecutiveRateLimits++
      delayMs = Math.min(
        (this.options.minDelayMs || 100) *
          Math.pow(
            this.options.backoffMultiplier || 2,
            this.consecutiveRateLimits - 1
          ),
        this.options.maxDelayMs || 30000
      )

      logger.warn('Rate limit exceeded - request denied', {
        currentCount,
        maxRequests: this.options.maxRequests,
        consecutiveRateLimits: this.consecutiveRateLimits,
        delayMs,
        operation: 'RateLimiter.checkRequest',
      })
    } else {
      // Reset consecutive rate limits on successful request
      this.consecutiveRateLimits = 0
    }

    const resetTimeMs =
      this.options.windowMs - (now - this.getOldestRequestTime())

    return {
      allowed,
      delayMs,
      currentCount,
      resetTimeMs: Math.max(0, resetTimeMs),
    }
  }

  /**
   * Consume a token for an allowed request
   */
  consumeToken(): void {
    if (this.tokens > 0) {
      this.tokens--
      this.requestHistory.push(Date.now())

      logger.debug('Token consumed', {
        remainingTokens: this.tokens,
        requestCount: this.requestHistory.length,
        operation: 'RateLimiter.consumeToken',
      })
    }
  }

  /**
   * Wait for rate limit to allow the next request
   */
  async waitForNext(): Promise<void> {
    const result = this.checkRequest()

    if (!result.allowed && result.delayMs > 0) {
      logger.info('Waiting for rate limit', {
        delayMs: result.delayMs,
        currentCount: result.currentCount,
        maxRequests: this.options.maxRequests,
        operation: 'RateLimiter.waitForNext',
      })

      await new Promise(resolve => setTimeout(resolve, result.delayMs))
    }
  }

  /**
   * Execute a function with rate limiting
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.waitForNext()
    this.consumeToken()
    return await fn()
  }

  /**
   * Get current rate limiter status
   */
  getStatus(): {
    availableTokens: number
    maxTokens: number
    requestCount: number
    consecutiveRateLimits: number
    windowMs: number
  } {
    this.refillTokens(Date.now())
    this.cleanupHistory(Date.now())

    return {
      availableTokens: this.tokens,
      maxTokens: this.options.maxRequests,
      requestCount: this.requestHistory.length,
      consecutiveRateLimits: this.consecutiveRateLimits,
      windowMs: this.options.windowMs,
    }
  }

  /**
   * Reset the rate limiter state
   */
  reset(): void {
    this.tokens = this.options.maxRequests
    this.lastRefill = Date.now()
    this.requestHistory = []
    this.consecutiveRateLimits = 0

    logger.debug('Rate limiter reset', {
      operation: 'RateLimiter.reset',
    })
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refillTokens(now: number): void {
    const timeSinceRefill = now - this.lastRefill
    const tokensToAdd = Math.floor(
      (timeSinceRefill / this.options.windowMs) * this.options.maxRequests
    )

    if (tokensToAdd > 0) {
      this.tokens = Math.min(
        this.options.maxRequests,
        this.tokens + tokensToAdd
      )
      this.lastRefill = now
    }
  }

  /**
   * Clean up old requests from history
   */
  private cleanupHistory(now: number): void {
    const cutoff = now - this.options.windowMs
    this.requestHistory = this.requestHistory.filter(time => time > cutoff)
  }

  /**
   * Get the timestamp of the oldest request in the current window
   */
  private getOldestRequestTime(): number {
    return this.requestHistory.length > 0
      ? (this.requestHistory[0] ?? Date.now())
      : Date.now()
  }
}

/**
 * Global rate limiter instances for different services
 */
export class RateLimiterManager {
  private static limiters: Map<string, RateLimiter> = new Map()

  /**
   * Get or create a rate limiter for a specific service
   */
  static getRateLimiter(
    serviceName: string,
    options: RateLimiterOptions
  ): RateLimiter {
    if (!this.limiters.has(serviceName)) {
      this.limiters.set(serviceName, new RateLimiter(options))

      logger.info('Rate limiter created for service', {
        serviceName,
        maxRequests: options.maxRequests,
        windowMs: options.windowMs,
        operation: 'RateLimiterManager.getRateLimiter',
      })
    }

    return this.limiters.get(serviceName)!
  }

  /**
   * Get status of all rate limiters
   */
  static getAllStatus(): Record<string, ReturnType<RateLimiter['getStatus']>> {
    const status: Record<string, ReturnType<RateLimiter['getStatus']>> = {}

    for (const [serviceName, limiter] of this.limiters.entries()) {
      status[serviceName] = limiter.getStatus()
    }

    return status
  }

  /**
   * Reset all rate limiters
   */
  static resetAll(): void {
    for (const limiter of this.limiters.values()) {
      limiter.reset()
    }

    logger.info('All rate limiters reset', {
      count: this.limiters.size,
      operation: 'RateLimiterManager.resetAll',
    })
  }

  /**
   * Remove a rate limiter
   */
  static removeLimiter(serviceName: string): boolean {
    const removed = this.limiters.delete(serviceName)

    if (removed) {
      logger.info('Rate limiter removed', {
        serviceName,
        operation: 'RateLimiterManager.removeLimiter',
      })
    }

    return removed
  }
}
