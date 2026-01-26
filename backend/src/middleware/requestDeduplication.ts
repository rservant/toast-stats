/**
 * Request Deduplication Middleware
 *
 * Prevents redundant processing of concurrent identical requests by tracking
 * in-flight requests and sharing results with waiting clients.
 *
 * Requirements:
 * - 6.1: Process only one request and share result with all waiting clients
 * - 6.2: Queue subsequent identical requests instead of starting new processing
 * - 6.3: Expire deduplication cache after response or configurable timeout
 */

import { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger.js'
import { generateCacheKey } from '../utils/cacheKeys.js'

/**
 * Represents a pending request being processed
 */
export interface PendingRequest<T = unknown> {
  /** Unique cache key identifying this request */
  key: string
  /** Promise that resolves when the request completes */
  promise: Promise<T>
  /** Timestamp when the request started */
  startedAt: number
  /** Number of clients waiting for this result */
  waitingCount: number
}

/**
 * Configuration options for the request deduplication service
 */
export interface RequestDeduplicationConfig {
  /** Timeout in milliseconds after which pending requests are cleaned up (default: 30000) */
  timeoutMs?: number
  /** Interval in milliseconds for cleanup of expired requests (default: 10000) */
  cleanupIntervalMs?: number
  /** Whether to enable automatic cleanup (default: true) */
  enableAutoCleanup?: boolean
}

/**
 * Interface for the request deduplication service
 */
export interface IRequestDeduplicationService {
  /**
   * Get or create a pending request
   * If request is already in progress, returns existing promise
   */
  getOrCreate<T>(key: string, factory: () => Promise<T>): Promise<T>

  /**
   * Get current pending request count
   */
  getPendingCount(): number

  /**
   * Clear expired pending requests
   */
  cleanup(): void

  /**
   * Stop the cleanup interval (for graceful shutdown)
   */
  dispose(): void
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<RequestDeduplicationConfig> = {
  timeoutMs: 30000, // 30 seconds
  cleanupIntervalMs: 10000, // 10 seconds
  enableAutoCleanup: true,
}

/**
 * Service for deduplicating concurrent identical requests.
 *
 * When multiple identical requests arrive concurrently, only the first
 * request is processed. Subsequent requests wait for and share the
 * result of the first request.
 *
 * Requirement 6.1: Process only one request and share result with all waiting clients
 * Requirement 6.2: Queue subsequent identical requests instead of starting new processing
 * Requirement 6.3: Expire deduplication cache after response or configurable timeout
 */
export class RequestDeduplicationService implements IRequestDeduplicationService {
  private readonly pendingRequests: Map<string, PendingRequest> = new Map()
  private readonly config: Required<RequestDeduplicationConfig>
  private cleanupInterval: ReturnType<typeof setInterval> | null = null

  constructor(config: RequestDeduplicationConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }

    if (this.config.enableAutoCleanup) {
      this.startCleanupInterval()
    }
  }

  /**
   * Get or create a pending request
   *
   * If a request with the same key is already in progress, returns the
   * existing promise and increments the waiting count. Otherwise, creates
   * a new pending request using the factory function.
   *
   * Requirement 6.1: Share result with all waiting clients
   * Requirement 6.2: Queue subsequent identical requests
   *
   * @param key - Unique identifier for the request
   * @param factory - Function that creates the promise for the request
   * @returns Promise that resolves with the request result
   */
  getOrCreate<T>(key: string, factory: () => Promise<T>): Promise<T> {
    const existing = this.pendingRequests.get(key)

    if (existing) {
      // Increment waiting count for existing request
      existing.waitingCount++

      logger.debug('Request deduplicated - joining existing request', {
        operation: 'getOrCreate',
        key,
        waitingCount: existing.waitingCount,
        elapsedMs: Date.now() - existing.startedAt,
      })

      // Return the existing promise (type assertion is safe here)
      return existing.promise as Promise<T>
    }

    // Create new pending request
    const startedAt = Date.now()

    logger.debug('Starting new deduplicated request', {
      operation: 'getOrCreate',
      key,
    })

    // Create the promise and wrap it to handle cleanup
    const promise = this.executeWithCleanup(key, factory, startedAt)

    // Store the pending request
    const pendingRequest: PendingRequest<T> = {
      key,
      promise,
      startedAt,
      waitingCount: 1,
    }

    this.pendingRequests.set(key, pendingRequest as PendingRequest)

    return promise
  }

  /**
   * Get current pending request count
   */
  getPendingCount(): number {
    return this.pendingRequests.size
  }

  /**
   * Clear expired pending requests
   *
   * Removes requests that have exceeded the configured timeout.
   * This is a safety mechanism to prevent memory leaks from
   * requests that never complete.
   *
   * Requirement 6.3: Expire after configurable timeout
   */
  cleanup(): void {
    const now = Date.now()
    const expiredKeys: string[] = []

    for (const [key, request] of this.pendingRequests) {
      const elapsed = now - request.startedAt

      if (elapsed > this.config.timeoutMs) {
        expiredKeys.push(key)

        logger.warn('Cleaning up expired pending request', {
          operation: 'cleanup',
          key,
          elapsedMs: elapsed,
          timeoutMs: this.config.timeoutMs,
          waitingCount: request.waitingCount,
        })
      }
    }

    for (const key of expiredKeys) {
      this.pendingRequests.delete(key)
    }

    if (expiredKeys.length > 0) {
      logger.info('Cleaned up expired pending requests', {
        operation: 'cleanup',
        expiredCount: expiredKeys.length,
        remainingCount: this.pendingRequests.size,
      })
    }
  }

  /**
   * Stop the cleanup interval (for graceful shutdown)
   */
  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }

    // Clear all pending requests
    this.pendingRequests.clear()

    logger.debug('RequestDeduplicationService disposed', {
      operation: 'dispose',
    })
  }

  /**
   * Execute the factory function and clean up when complete
   *
   * Requirement 6.3: Expire after response is sent
   */
  private async executeWithCleanup<T>(
    key: string,
    factory: () => Promise<T>,
    startedAt: number
  ): Promise<T> {
    try {
      const result = await factory()

      const elapsed = Date.now() - startedAt
      const pendingRequest = this.pendingRequests.get(key)

      logger.debug('Deduplicated request completed successfully', {
        operation: 'executeWithCleanup',
        key,
        elapsedMs: elapsed,
        waitingCount: pendingRequest?.waitingCount ?? 0,
      })

      return result
    } catch (error) {
      const elapsed = Date.now() - startedAt
      const pendingRequest = this.pendingRequests.get(key)

      logger.debug('Deduplicated request failed', {
        operation: 'executeWithCleanup',
        key,
        elapsedMs: elapsed,
        waitingCount: pendingRequest?.waitingCount ?? 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      // Re-throw to propagate error to all waiting clients
      throw error
    } finally {
      // Always clean up the pending request after completion
      this.pendingRequests.delete(key)
    }
  }

  /**
   * Start the automatic cleanup interval
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, this.config.cleanupIntervalMs)

    // Ensure the interval doesn't prevent process exit
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref()
    }
  }
}

/**
 * Middleware options for request deduplication
 */
export interface RequestDeduplicationMiddlewareOptions {
  /** Custom key generator function (default: uses path + query params) */
  keyGenerator?: (req: Request) => string
  /** Request deduplication service instance (default: creates new instance) */
  service?: IRequestDeduplicationService
  /** Timeout in milliseconds (default: 30000) */
  timeoutMs?: number
}

/**
 * Create request deduplication middleware for Express routes
 *
 * This middleware wraps route handlers to deduplicate concurrent identical
 * requests. When multiple requests with the same cache key arrive, only
 * the first is processed and the result is shared with all waiting clients.
 *
 * Requirements:
 * - 6.1: Process only one request and share result with all waiting clients
 * - 6.2: Queue subsequent identical requests instead of starting new processing
 * - 6.3: Expire deduplication cache after response or configurable timeout
 *
 * @param options - Middleware configuration options
 * @returns Express middleware function
 */
export function requestDeduplicationMiddleware(
  options: RequestDeduplicationMiddlewareOptions = {}
): (req: Request, res: Response, next: NextFunction) => void {
  const service =
    options.service ??
    new RequestDeduplicationService({ timeoutMs: options.timeoutMs })

  const keyGenerator =
    options.keyGenerator ??
    ((req: Request) =>
      generateCacheKey(`dedup:${req.path}`, {
        ...req.query,
        ...req.params,
      }))

  return (req: Request, res: Response, next: NextFunction): void => {
    // Only deduplicate GET requests
    if (req.method !== 'GET') {
      next()
      return
    }

    // Check for deduplication bypass
    const bypassDedup =
      req.query['bypass_dedup'] === 'true' ||
      req.headers['x-bypass-dedup'] === 'true'

    if (bypassDedup) {
      next()
      return
    }

    const cacheKey = keyGenerator(req)

    // Store original res.json to capture the response
    const originalJson = res.json.bind(res)
    let responseData: unknown
    let responseStatusCode: number = 200

    // Override res.json to capture the response data
    res.json = function (body: unknown) {
      responseData = body
      responseStatusCode = res.statusCode
      return originalJson(body)
    }

    // Create a factory function that processes the request
    const factory = (): Promise<{ data: unknown; statusCode: number }> => {
      return new Promise((resolve, reject) => {
        // Store original end to detect when response is complete
        const originalEnd = res.end.bind(res)

        // Override res.end to resolve the promise
        res.end = function (
          chunk?: Buffer | string | (() => void),
          encodingOrCallback?: BufferEncoding | (() => void),
          callback?: () => void
        ): Response {
          // Resolve with captured response data
          resolve({ data: responseData, statusCode: responseStatusCode })

          // Call original end with proper type handling
          if (typeof chunk === 'function') {
            return originalEnd(chunk)
          } else if (typeof encodingOrCallback === 'function') {
            return originalEnd(chunk, encodingOrCallback)
          } else if (encodingOrCallback !== undefined) {
            return originalEnd(chunk, encodingOrCallback, callback)
          } else {
            return originalEnd(chunk)
          }
        }

        // Handle errors
        res.on('error', (error: Error) => {
          reject(error)
        })

        // Continue to the actual route handler
        next()
      })
    }

    // Use the deduplication service
    service
      .getOrCreate(cacheKey, factory)
      .then(result => {
        // If this is a waiting request (not the primary), send the cached response
        // The primary request already sent its response via the factory
        if (!res.headersSent) {
          res.status(result.statusCode).json(result.data)
        }
      })
      .catch((error: unknown) => {
        // If headers not sent, send error response
        if (!res.headersSent) {
          const errorMessage =
            error instanceof Error ? error.message : 'Internal server error'
          res.status(500).json({ error: errorMessage })
        }
      })
  }
}

/**
 * Factory function to create a RequestDeduplicationService instance
 *
 * @param config - Optional configuration
 * @returns New RequestDeduplicationService instance
 */
export function createRequestDeduplicationService(
  config?: RequestDeduplicationConfig
): RequestDeduplicationService {
  return new RequestDeduplicationService(config)
}

/**
 * Default singleton instance for simple use cases
 * Note: For production use, prefer creating instances with explicit configuration
 */
let defaultService: RequestDeduplicationService | null = null

/**
 * Get or create the default singleton service instance
 *
 * @param config - Optional configuration (only used on first call)
 * @returns The default RequestDeduplicationService instance
 */
export function getDefaultDeduplicationService(
  config?: RequestDeduplicationConfig
): RequestDeduplicationService {
  if (!defaultService) {
    defaultService = new RequestDeduplicationService(config)
  }
  return defaultService
}

/**
 * Reset the default singleton service (primarily for testing)
 */
export function resetDefaultDeduplicationService(): void {
  if (defaultService) {
    defaultService.dispose()
    defaultService = null
  }
}
