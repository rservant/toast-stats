/**
 * Retry Manager with Exponential Backoff
 * 
 * Provides configurable retry logic with exponential backoff for dashboard requests
 * and other external API calls during reconciliation processes.
 */

import { logger } from './logger.js'

export interface RetryOptions {
  maxAttempts: number
  baseDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
  retryableErrors?: (error: Error) => boolean
}

export interface RetryResult<T> {
  success: boolean
  result?: T
  error?: Error
  attempts: number
  totalDuration: number
}

export class RetryManager {
  private static readonly DEFAULT_OPTIONS: RetryOptions = {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    retryableErrors: (error: Error) => {
      // Default: retry on network errors, timeouts, and 5xx server errors
      const message = error.message.toLowerCase()
      return (
        message.includes('network') ||
        message.includes('timeout') ||
        message.includes('econnreset') ||
        message.includes('enotfound') ||
        message.includes('econnrefused') ||
        message.includes('500') ||
        message.includes('502') ||
        message.includes('503') ||
        message.includes('504')
      )
    }
  }

  /**
   * Execute a function with retry logic and exponential backoff
   * 
   * @param operation - The async operation to retry
   * @param options - Retry configuration options
   * @param context - Context information for logging
   * @returns RetryResult with success status, result, and metadata
   */
  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {},
    context: Record<string, unknown> = {}
  ): Promise<RetryResult<T>> {
    const config = { ...RetryManager.DEFAULT_OPTIONS, ...options }
    const startTime = Date.now()
    let lastError: Error | undefined
    let attempts = 0

    logger.debug('Starting retry operation', { 
      context, 
      maxAttempts: config.maxAttempts,
      baseDelayMs: config.baseDelayMs 
    })

    for (attempts = 1; attempts <= config.maxAttempts; attempts++) {
      try {
        const result = await operation()
        const totalDuration = Date.now() - startTime

        if (attempts > 1) {
          logger.info('Retry operation succeeded', {
            context,
            attempts,
            totalDuration,
            success: true
          })
        }

        return {
          success: true,
          result,
          attempts,
          totalDuration
        }

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        const totalDuration = Date.now() - startTime

        // Check if this error is retryable
        const isRetryable = config.retryableErrors!(lastError)
        const isLastAttempt = attempts >= config.maxAttempts

        logger.warn('Retry operation failed', {
          context,
          attempt: attempts,
          maxAttempts: config.maxAttempts,
          error: lastError.message,
          isRetryable,
          isLastAttempt,
          totalDuration
        })

        // If not retryable or last attempt, fail immediately
        if (!isRetryable || isLastAttempt) {
          break
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          config.baseDelayMs * Math.pow(config.backoffMultiplier, attempts - 1),
          config.maxDelayMs
        )

        logger.debug('Waiting before retry', {
          context,
          attempt: attempts,
          delayMs: delay
        })

        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    // All attempts failed
    const totalDuration = Date.now() - startTime

    logger.error('Retry operation failed after all attempts', {
      context,
      attempts,
      totalDuration,
      finalError: lastError?.message
    })

    return {
      success: false,
      error: lastError,
      attempts,
      totalDuration
    }
  }

  /**
   * Create a retryable version of an async function
   * 
   * @param operation - The async operation to make retryable
   * @param options - Retry configuration options
   * @returns A function that executes with retry logic
   */
  static createRetryableFunction<T extends unknown[], R>(
    operation: (...args: T) => Promise<R>,
    options: Partial<RetryOptions> = {}
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      const result = await RetryManager.executeWithRetry(
        () => operation(...args),
        options,
        { functionName: operation.name || 'anonymous' }
      )

      if (result.success) {
        return result.result!
      } else {
        throw result.error || new Error('Retry operation failed')
      }
    }
  }

  /**
   * Create retry options for dashboard requests
   */
  static getDashboardRetryOptions(): RetryOptions {
    return {
      maxAttempts: 3,
      baseDelayMs: 2000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      retryableErrors: (error: Error) => {
        const message = error.message.toLowerCase()
        
        // Don't retry on client errors (4xx) except for rate limiting
        if (message.includes('400') || message.includes('401') || 
            message.includes('403') || message.includes('404')) {
          return false
        }

        // Retry on rate limiting
        if (message.includes('429') || message.includes('rate limit')) {
          return true
        }

        // Retry on server errors and network issues
        return (
          message.includes('network') ||
          message.includes('timeout') ||
          message.includes('econnreset') ||
          message.includes('enotfound') ||
          message.includes('econnrefused') ||
          message.includes('500') ||
          message.includes('502') ||
          message.includes('503') ||
          message.includes('504') ||
          message.includes('dashboard returned') ||
          message.includes('scraping failed')
        )
      }
    }
  }

  /**
   * Create retry options for cache operations
   */
  static getCacheRetryOptions(): RetryOptions {
    return {
      maxAttempts: 2,
      baseDelayMs: 500,
      maxDelayMs: 5000,
      backoffMultiplier: 2,
      retryableErrors: (error: Error) => {
        const message = error.message.toLowerCase()
        
        // Retry on file system errors and temporary issues
        return (
          message.includes('enoent') ||
          message.includes('eacces') ||
          message.includes('emfile') ||
          message.includes('enfile') ||
          message.includes('ebusy') ||
          message.includes('eagain') ||
          message.includes('temporary') ||
          message.includes('lock')
        )
      }
    }
  }
}