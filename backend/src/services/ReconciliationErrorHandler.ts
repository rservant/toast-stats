/**
 * Reconciliation Error Handler
 * 
 * Centralized error handling service for reconciliation operations.
 * Integrates retry logic, circuit breakers, and alerting for comprehensive
 * error management during month-end data reconciliation.
 */

import { logger } from '../utils/logger.js'
import { RetryManager, RetryOptions } from '../utils/RetryManager.js'
import { CircuitBreaker, CircuitBreakerManager, CircuitState } from '../utils/CircuitBreaker.js'
import { AlertManager, AlertSeverity, AlertCategory } from '../utils/AlertManager.js'
import { DistrictBackfillService } from './DistrictBackfillService.js'
import type { DistrictStatistics } from '../types/districts.js'
import type { ReconciliationDataFetchResult } from './DistrictBackfillService.js'

export interface ErrorHandlingConfig {
  dashboardRetry: Partial<RetryOptions>
  cacheRetry: Partial<RetryOptions>
  circuitBreakerEnabled: boolean
  alertingEnabled: boolean
  maxConsecutiveFailures: number
  failureTimeoutMs: number
}

export interface ReconciliationErrorContext {
  jobId?: string
  districtId: string
  targetMonth?: string
  operation: string
  attempt?: number
}

export class ReconciliationErrorHandler {
  private static instance: ReconciliationErrorHandler
  private alertManager: AlertManager
  private circuitManager: CircuitBreakerManager
  private dashboardCircuitBreaker: CircuitBreaker
  private cacheCircuitBreaker: CircuitBreaker
  private config: ErrorHandlingConfig
  private failureTracker: Map<string, { count: number; lastFailure: Date }> = new Map()

  private constructor(config: Partial<ErrorHandlingConfig> = {}) {
    this.config = {
      dashboardRetry: RetryManager.getDashboardRetryOptions(),
      cacheRetry: RetryManager.getCacheRetryOptions(),
      circuitBreakerEnabled: true,
      alertingEnabled: true,
      maxConsecutiveFailures: 5,
      failureTimeoutMs: 300000, // 5 minutes
      ...config
    }

    this.alertManager = AlertManager.getInstance()
    this.circuitManager = CircuitBreakerManager.getInstance()
    
    // Initialize circuit breakers
    this.dashboardCircuitBreaker = this.circuitManager.getCircuitBreaker(
      'reconciliation-dashboard',
      CircuitBreaker.createDashboardCircuitBreaker('reconciliation-dashboard').getStats()
    )
    
    this.cacheCircuitBreaker = this.circuitManager.getCircuitBreaker(
      'reconciliation-cache',
      CircuitBreaker.createCacheCircuitBreaker('reconciliation-cache').getStats()
    )

    logger.info('ReconciliationErrorHandler initialized', { config: this.config })
  }

  static getInstance(config?: Partial<ErrorHandlingConfig>): ReconciliationErrorHandler {
    if (!ReconciliationErrorHandler.instance) {
      ReconciliationErrorHandler.instance = new ReconciliationErrorHandler(config)
    }
    return ReconciliationErrorHandler.instance
  }

  /**
   * Execute dashboard data fetch with comprehensive error handling
   */
  async executeDashboardFetch(
    backfillService: DistrictBackfillService,
    districtId: string,
    targetDate: string,
    context: ReconciliationErrorContext
  ): Promise<ReconciliationDataFetchResult> {
    const operationKey = `dashboard-${districtId}-${targetDate}`
    
    try {
      if (!this.config.circuitBreakerEnabled) {
        // Direct execution without circuit breaker
        return await this.executeWithRetryOnly(
          () => backfillService.fetchReconciliationData(districtId, targetDate),
          this.config.dashboardRetry,
          context
        )
      }

      // Execute with circuit breaker
      const result = await this.dashboardCircuitBreaker.execute(async () => {
        const retryResult = await RetryManager.executeWithRetry(
          () => backfillService.fetchReconciliationData(districtId, targetDate),
          this.config.dashboardRetry,
          context
        )

        if (!retryResult.success) {
          throw retryResult.error || new Error('Dashboard fetch failed')
        }

        return retryResult.result!
      }, context)

      // Track success
      this.trackOperationSuccess(operationKey)
      
      return result

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      // Track failure
      await this.trackOperationFailure(operationKey, errorMessage, context)
      
      // Return error result
      return {
        success: false,
        isDataAvailable: false,
        error: errorMessage
      }
    }
  }

  /**
   * Execute cache operation with comprehensive error handling
   */
  async executeCacheOperation<T>(
    operation: () => Promise<T>,
    context: ReconciliationErrorContext
  ): Promise<{ success: boolean; result?: T; error?: string }> {
    const operationKey = `cache-${context.operation}-${context.districtId}`
    
    try {
      if (!this.config.circuitBreakerEnabled) {
        // Direct execution without circuit breaker
        const retryResult = await RetryManager.executeWithRetry(
          operation,
          this.config.cacheRetry,
          context
        )

        if (!retryResult.success) {
          throw retryResult.error || new Error('Cache operation failed')
        }

        return { success: true, result: retryResult.result }
      }

      // Execute with circuit breaker
      const result = await this.cacheCircuitBreaker.execute(async () => {
        const retryResult = await RetryManager.executeWithRetry(
          operation,
          this.config.cacheRetry,
          context
        )

        if (!retryResult.success) {
          throw retryResult.error || new Error('Cache operation failed')
        }

        return retryResult.result!
      }, context)

      // Track success
      this.trackOperationSuccess(operationKey)
      
      return { success: true, result }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      // Track failure
      await this.trackOperationFailure(operationKey, errorMessage, context)
      
      return { success: false, error: errorMessage }
    }
  }

  /**
   * Handle reconciliation job failure
   */
  async handleReconciliationJobFailure(
    jobId: string,
    districtId: string,
    targetMonth: string,
    error: Error | string,
    context: Partial<ReconciliationErrorContext> = {}
  ): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    logger.error('Reconciliation job failure', {
      jobId,
      districtId,
      targetMonth,
      error: errorMessage,
      context
    })

    if (this.config.alertingEnabled) {
      await this.alertManager.sendReconciliationFailureAlert(
        districtId,
        targetMonth,
        errorMessage,
        jobId
      )
    }

    // Track failure for pattern analysis
    const failureKey = `job-${districtId}-${targetMonth}`
    await this.trackOperationFailure(failureKey, errorMessage, {
      jobId,
      districtId,
      targetMonth,
      operation: 'reconciliation-job',
      ...context
    })
  }

  /**
   * Handle reconciliation timeout
   */
  async handleReconciliationTimeout(
    jobId: string,
    districtId: string,
    targetMonth: string,
    daysActive: number,
    maxDays: number
  ): Promise<void> {
    logger.warn('Reconciliation timeout detected', {
      jobId,
      districtId,
      targetMonth,
      daysActive,
      maxDays
    })

    if (this.config.alertingEnabled) {
      await this.alertManager.sendReconciliationTimeoutAlert(
        districtId,
        targetMonth,
        daysActive,
        maxDays
      )
    }
  }

  /**
   * Handle circuit breaker state changes
   */
  async handleCircuitBreakerStateChange(
    circuitName: string,
    newState: CircuitState,
    stats: any
  ): Promise<void> {
    logger.info('Circuit breaker state changed', {
      circuitName,
      newState,
      failureCount: stats.failureCount,
      nextRetryTime: stats.nextRetryTime
    })

    if (this.config.alertingEnabled && newState === CircuitState.OPEN) {
      await this.alertManager.sendCircuitBreakerAlert(
        circuitName,
        newState,
        stats.failureCount,
        stats.nextRetryTime
      )
    }
  }

  /**
   * Get error handling statistics
   */
  getErrorStats(): {
    circuitBreakers: Record<string, any>
    failureTracking: Record<string, { count: number; lastFailure: string }>
    config: ErrorHandlingConfig
  } {
    const failureTracking: Record<string, { count: number; lastFailure: string }> = {}
    
    for (const [key, value] of this.failureTracker.entries()) {
      failureTracking[key] = {
        count: value.count,
        lastFailure: value.lastFailure.toISOString()
      }
    }

    return {
      circuitBreakers: this.circuitManager.getAllStats(),
      failureTracking,
      config: this.config
    }
  }

  /**
   * Reset error handling state
   */
  async resetErrorState(): Promise<void> {
    logger.info('Resetting error handling state')
    
    // Reset circuit breakers
    this.circuitManager.resetAll()
    
    // Clear failure tracking
    this.failureTracker.clear()
    
    // Send notification
    if (this.config.alertingEnabled) {
      await this.alertManager.sendAlert(
        AlertSeverity.LOW,
        AlertCategory.SYSTEM,
        'Error Handling Reset',
        'Error handling state has been manually reset',
        { timestamp: new Date().toISOString() }
      )
    }
  }

  /**
   * Update error handling configuration
   */
  updateConfig(newConfig: Partial<ErrorHandlingConfig>): void {
    this.config = { ...this.config, ...newConfig }
    
    logger.info('Error handling configuration updated', { 
      newConfig,
      fullConfig: this.config 
    })
  }

  /**
   * Execute operation with retry only (no circuit breaker)
   */
  private async executeWithRetryOnly<T>(
    operation: () => Promise<T>,
    retryOptions: Partial<RetryOptions>,
    context: ReconciliationErrorContext
  ): Promise<T> {
    const result = await RetryManager.executeWithRetry(
      operation,
      retryOptions,
      context
    )

    if (!result.success) {
      throw result.error || new Error('Operation failed after retries')
    }

    return result.result!
  }

  /**
   * Track operation success
   */
  private trackOperationSuccess(operationKey: string): void {
    // Remove from failure tracker on success
    this.failureTracker.delete(operationKey)
  }

  /**
   * Track operation failure
   */
  private async trackOperationFailure(
    operationKey: string,
    errorMessage: string,
    context: ReconciliationErrorContext
  ): Promise<void> {
    const now = new Date()
    const existing = this.failureTracker.get(operationKey)
    
    if (existing) {
      existing.count++
      existing.lastFailure = now
    } else {
      this.failureTracker.set(operationKey, { count: 1, lastFailure: now })
    }

    const failureInfo = this.failureTracker.get(operationKey)!
    
    // Check if we've exceeded consecutive failure threshold
    if (failureInfo.count >= this.config.maxConsecutiveFailures) {
      logger.error('Consecutive failure threshold exceeded', {
        operationKey,
        failureCount: failureInfo.count,
        threshold: this.config.maxConsecutiveFailures,
        context
      })

      if (this.config.alertingEnabled) {
        await this.alertManager.sendAlert(
          AlertSeverity.HIGH,
          AlertCategory.SYSTEM,
          'Consecutive Failure Threshold Exceeded',
          `Operation ${operationKey} has failed ${failureInfo.count} consecutive times`,
          { 
            operationKey, 
            failureCount: failureInfo.count, 
            threshold: this.config.maxConsecutiveFailures,
            lastError: errorMessage,
            context 
          }
        )
      }
    }
  }

  /**
   * Clean up old failure tracking entries
   */
  private cleanupFailureTracking(): void {
    const cutoff = new Date(Date.now() - this.config.failureTimeoutMs)
    
    for (const [key, value] of this.failureTracker.entries()) {
      if (value.lastFailure < cutoff) {
        this.failureTracker.delete(key)
      }
    }
  }
}