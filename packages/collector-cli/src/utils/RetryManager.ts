/**
 * Retry Manager with Exponential Backoff
 *
 * Provides configurable retry logic with exponential backoff for dashboard requests
 * and other external API calls.
 *
 * Requirements:
 * - 6.1: IF the Collector_CLI encounters a network error, THEN the Collector_CLI SHALL
 *        retry with exponential backoff before failing
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
    },
  }

  /**
   * Execute a function with retry logic and exponential backoff
   */
  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {},
    context: Record<string, unknown> = {}
  ): Promise<RetryResult<T>> {
    const config = { ...RetryManager.DEFAULT_OPTIONS, ...options }
    const startTime = Date.now()
    let lastError: Error | undefined
    let attempts: number

    logger.debug('Starting retry operation', {
      context,
      maxAttempts: config.maxAttempts,
      baseDelayMs: config.baseDelayMs,
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
            success: true,
          })
        }

        return {
          success: true,
          result,
          attempts,
          totalDuration,
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        const totalDuration = Date.now() - startTime

        const retryableErrors =
          config.retryableErrors ?? RetryManager.DEFAULT_OPTIONS.retryableErrors
        const isRetryable = retryableErrors?.(lastError) ?? false
        const isLastAttempt = attempts >= config.maxAttempts

        logger.warn('Retry operation failed', {
          context,
          attempt: attempts,
          maxAttempts: config.maxAttempts,
          error: lastError.message,
          isRetryable,
          isLastAttempt,
          totalDuration,
        })

        if (!isRetryable || isLastAttempt) {
          break
        }

        const delay = Math.min(
          config.baseDelayMs * Math.pow(config.backoffMultiplier, attempts - 1),
          config.maxDelayMs
        )

        logger.debug('Waiting before retry', {
          context,
          attempt: attempts,
          delayMs: delay,
        })

        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    const totalDuration = Date.now() - startTime

    logger.error('Retry operation failed after all attempts', {
      context,
      attempts,
      totalDuration,
      finalError: lastError?.message,
    })

    return {
      success: false,
      error: lastError,
      attempts,
      totalDuration,
    }
  }

  /**
   * Create a retryable version of an async function
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

      if (result.success && result.result !== undefined) {
        return result.result
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
        if (
          message.includes('400') ||
          message.includes('401') ||
          message.includes('403') ||
          message.includes('404')
        ) {
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
      },
    }
  }
}
