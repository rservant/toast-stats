/**
 * Circuit Breaker Pattern Implementation
 *
 * Provides circuit breaker functionality for external API calls to prevent
 * cascading failures and provide fast failure when external services are down.
 *
 * Requirements:
 * - 6.2: IF the Collector_CLI circuit breaker opens, THEN the Collector_CLI SHALL
 *        report the circuit breaker status and exit gracefully
 */

import { logger } from './logger.js'

export interface CircuitBreakerOptions {
  failureThreshold: number
  recoveryTimeout: number
  monitoringPeriod: number
  expectedErrors?: (error: Error) => boolean
}

export enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Failing fast
  HALF_OPEN = 'HALF_OPEN', // Testing recovery
}

export interface CircuitBreakerStats {
  state: CircuitState
  failureCount: number
  successCount: number
  lastFailureTime?: Date
  lastSuccessTime?: Date
  nextRetryTime?: Date
  totalRequests: number
  totalFailures: number
  totalSuccesses: number
}

export class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public readonly circuitState: CircuitState
  ) {
    super(message)
    this.name = 'CircuitBreakerError'
  }
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED
  private failureCount: number = 0
  private successCount: number = 0
  private lastFailureTime?: Date
  private lastSuccessTime?: Date
  private nextRetryTime?: Date
  private totalRequests: number = 0
  private totalFailures: number = 0
  private totalSuccesses: number = 0

  private static readonly DEFAULT_OPTIONS: CircuitBreakerOptions = {
    failureThreshold: 5,
    recoveryTimeout: 60000, // 1 minute
    monitoringPeriod: 300000, // 5 minutes
    expectedErrors: () => true, // All errors count as failures by default
  }

  constructor(
    private readonly name: string,
    private readonly options: Partial<CircuitBreakerOptions> = {}
  ) {
    this.options = { ...CircuitBreaker.DEFAULT_OPTIONS, ...options }

    logger.debug('Circuit breaker created', {
      name: this.name,
      options: this.options,
    })
  }

  /**
   * Execute an operation through the circuit breaker
   */
  async execute<T>(
    operation: () => Promise<T>,
    context: Record<string, unknown> = {}
  ): Promise<T> {
    this.totalRequests++

    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN
        logger.info('Circuit breaker transitioning to HALF_OPEN', {
          name: this.name,
          context,
        })
      } else {
        const error = new CircuitBreakerError(
          `Circuit breaker is OPEN for ${this.name}. Next retry at ${this.nextRetryTime?.toISOString()}`,
          CircuitState.OPEN
        )

        logger.warn('Circuit breaker rejecting request', {
          name: this.name,
          context,
          nextRetryTime: this.nextRetryTime?.toISOString(),
        })

        throw error
      }
    }

    try {
      const result = await operation()
      this.onSuccess(context)
      return result
    } catch (error) {
      this.onFailure(
        error instanceof Error ? error : new Error(String(error)),
        context
      )
      throw error
    }
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextRetryTime: this.nextRetryTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
    }
  }

  /**
   * Reset the circuit breaker to CLOSED state
   */
  reset(): void {
    logger.info('Circuit breaker manually reset', { name: this.name })

    this.state = CircuitState.CLOSED
    this.failureCount = 0
    this.successCount = 0
    this.nextRetryTime = undefined
  }

  /**
   * Manually record a failure
   */
  recordFailure(error: Error, context: Record<string, unknown> = {}): void {
    this.onFailure(error, context)
  }

  /**
   * Manually record a success
   */
  recordSuccess(context: Record<string, unknown> = {}): void {
    this.onSuccess(context)
  }

  /**
   * Get the circuit breaker name
   */
  getName(): string {
    return this.name
  }

  private shouldAttemptReset(): boolean {
    return this.nextRetryTime !== undefined && new Date() >= this.nextRetryTime
  }

  private onSuccess(context: Record<string, unknown>): void {
    this.totalSuccesses++
    this.lastSuccessTime = new Date()

    if (this.state === CircuitState.HALF_OPEN) {
      logger.info('Circuit breaker reset to CLOSED after successful test', {
        name: this.name,
        context,
      })

      this.state = CircuitState.CLOSED
      this.failureCount = 0
      this.successCount = 0
      this.nextRetryTime = undefined
    } else {
      this.failureCount = 0
      this.successCount++
    }
  }

  private onFailure(error: Error, context: Record<string, unknown>): void {
    const expectedErrors = this.options.expectedErrors ?? (() => true)
    if (!expectedErrors(error)) {
      logger.debug('Error not counted as circuit breaker failure', {
        name: this.name,
        error: error.message,
        context,
      })
      return
    }

    this.totalFailures++
    this.failureCount++
    this.lastFailureTime = new Date()

    logger.warn('Circuit breaker recorded failure', {
      name: this.name,
      failureCount: this.failureCount,
      threshold: this.options.failureThreshold,
      error: error.message,
      context,
    })

    if (this.state === CircuitState.HALF_OPEN) {
      this.openCircuit()
    } else if (
      this.options.failureThreshold !== undefined &&
      this.failureCount >= this.options.failureThreshold
    ) {
      this.openCircuit()
    }
  }

  private openCircuit(): void {
    this.state = CircuitState.OPEN
    const recoveryTimeout = this.options.recoveryTimeout ?? 60000
    this.nextRetryTime = new Date(Date.now() + recoveryTimeout)

    logger.error('Circuit breaker opened', {
      name: this.name,
      failureCount: this.failureCount,
      threshold: this.options.failureThreshold,
      nextRetryTime: this.nextRetryTime.toISOString(),
    })
  }

  /**
   * Create a circuit breaker for dashboard operations
   */
  static createDashboardCircuitBreaker(name: string): CircuitBreaker {
    return new CircuitBreaker(name, {
      failureThreshold: 5,
      recoveryTimeout: 120000, // 2 minutes
      monitoringPeriod: 300000, // 5 minutes
      expectedErrors: (error: Error) => {
        const message = error.message.toLowerCase()

        // Don't count client errors as circuit breaker failures
        if (
          message.includes('400') ||
          message.includes('401') ||
          message.includes('403') ||
          message.includes('404')
        ) {
          return false
        }

        // Count server errors and network issues
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
    })
  }
}
