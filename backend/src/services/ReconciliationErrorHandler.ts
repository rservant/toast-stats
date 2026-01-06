/**
 * Reconciliation Error Handler
 *
 * Centralized error handling service for reconciliation operations.
 * Integrates retry logic, circuit breakers, and alerting for comprehensive
 * error management during month-end data reconciliation.
 */

import { logger } from '../utils/logger.js'
import { RetryManager, RetryOptions } from '../utils/RetryManager.js'
import {
  CircuitBreaker,
  CircuitBreakerManager,
  ICircuitBreakerManager,
  CircuitState,
  CircuitBreakerStats,
} from '../utils/CircuitBreaker.js'
import {
  AlertManager,
  AlertSeverity,
  AlertCategory,
} from '../utils/AlertManager.js'
import { ToastmastersScraper } from './ToastmastersScraper.js'
import type { DistrictStatistics } from '../types/districts.js'

export interface ReconciliationDataFetchResult {
  success: boolean
  data?: DistrictStatistics
  sourceDataDate?: string
  error?: string
  isDataAvailable: boolean
}

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
  [key: string]: unknown
}

export class ReconciliationErrorHandler {
  private alertManager: AlertManager
  private circuitManager: ICircuitBreakerManager
  private dashboardCircuitBreaker: CircuitBreaker
  private cacheCircuitBreaker: CircuitBreaker
  private config: ErrorHandlingConfig
  private failureTracker: Map<string, { count: number; lastFailure: Date }> =
    new Map()

  constructor(
    config: Partial<ErrorHandlingConfig> = {},
    alertManager?: AlertManager,
    circuitBreakerManager?: ICircuitBreakerManager
  ) {
    this.config = {
      dashboardRetry: RetryManager.getDashboardRetryOptions(),
      cacheRetry: RetryManager.getCacheRetryOptions(),
      circuitBreakerEnabled: true,
      alertingEnabled: true,
      maxConsecutiveFailures: 5,
      failureTimeoutMs: 300000, // 5 minutes
      ...config,
    }

    this.alertManager = alertManager || new AlertManager()
    this.circuitManager = circuitBreakerManager || new CircuitBreakerManager()

    // Initialize circuit breakers
    this.dashboardCircuitBreaker = this.circuitManager.getCircuitBreaker(
      'reconciliation-dashboard',
      {
        failureThreshold: 5,
        recoveryTimeout: 60000,
        monitoringPeriod: 300000,
      }
    )

    this.cacheCircuitBreaker = this.circuitManager.getCircuitBreaker(
      'reconciliation-cache',
      {
        failureThreshold: 3,
        recoveryTimeout: 30000,
        monitoringPeriod: 120000,
      }
    )

    logger.info('ReconciliationErrorHandler initialized', {
      config: this.config,
    })
  }

  /**
   * Execute dashboard data fetch with comprehensive error handling
   */
  async executeDashboardFetch(
    scraper: ToastmastersScraper,
    districtId: string,
    targetDate: string,
    context: ReconciliationErrorContext
  ): Promise<ReconciliationDataFetchResult> {
    const operationKey = `dashboard-${districtId}-${targetDate}`

    try {
      if (!this.config.circuitBreakerEnabled) {
        // Direct execution without circuit breaker
        return await this.executeWithRetryOnly(
          () =>
            this.fetchReconciliationDataDirect(scraper, districtId, targetDate),
          this.config.dashboardRetry,
          context
        )
      }

      // Execute with circuit breaker
      const result = await this.dashboardCircuitBreaker.execute(async () => {
        const retryResult = await RetryManager.executeWithRetry(
          () =>
            this.fetchReconciliationDataDirect(scraper, districtId, targetDate),
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
      const errorMessage =
        error instanceof Error ? error.message : String(error)

      // Track failure
      await this.trackOperationFailure(operationKey, errorMessage, context)

      // Return error result
      return {
        success: false,
        isDataAvailable: false,
        error: errorMessage,
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
      const errorMessage =
        error instanceof Error ? error.message : String(error)

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
      context,
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
      ...context,
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
      maxDays,
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
    stats: CircuitBreakerStats
  ): Promise<void> {
    logger.info('Circuit breaker state changed', {
      circuitName,
      newState,
      failureCount: stats.failureCount,
      nextRetryTime: stats.nextRetryTime,
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
    circuitBreakers: Record<string, CircuitBreakerStats>
    failureTracking: Record<string, { count: number; lastFailure: string }>
    config: ErrorHandlingConfig
  } {
    const failureTracking: Record<
      string,
      { count: number; lastFailure: string }
    > = {}

    for (const [key, value] of this.failureTracker.entries()) {
      failureTracking[key] = {
        count: value.count,
        lastFailure: value.lastFailure.toISOString(),
      }
    }

    return {
      circuitBreakers: this.circuitManager.getAllStats(),
      failureTracking,
      config: this.config,
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
      fullConfig: this.config,
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
        context,
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
            context,
          }
        )
      }
    }
  }

  /**
   * Fetch reconciliation data directly using ToastmastersScraper
   */
  private async fetchReconciliationDataDirect(
    scraper: ToastmastersScraper,
    districtId: string,
    targetDate: string
  ): Promise<ReconciliationDataFetchResult> {
    logger.info('Fetching reconciliation data directly', {
      districtId,
      targetDate,
    })

    try {
      // Fetch all three report types for the specific date
      const [districtPerformance, divisionPerformance, clubPerformance] =
        await Promise.all([
          scraper.getDistrictPerformance(districtId, targetDate),
          scraper.getDivisionPerformance(districtId, targetDate),
          scraper.getClubPerformance(districtId, targetDate),
        ])

      // Check if we got valid data
      if (
        districtPerformance.length === 0 &&
        divisionPerformance.length === 0 &&
        clubPerformance.length === 0
      ) {
        logger.info('No data available for reconciliation date', {
          districtId,
          targetDate,
        })
        return {
          success: true,
          isDataAvailable: false,
          error: 'No data available for the specified date',
        }
      }

      // Extract source data date from the dashboard (simplified version)
      const sourceDataDate = targetDate // Use target date as fallback

      // Convert raw data to DistrictStatistics format (simplified)
      const districtStats = this.convertToDistrictStatistics(
        districtId,
        sourceDataDate,
        districtPerformance,
        divisionPerformance,
        clubPerformance
      )

      logger.info('Reconciliation data fetched successfully', {
        districtId,
        targetDate,
        sourceDataDate,
        districtRecords: districtPerformance.length,
        divisionRecords: divisionPerformance.length,
        clubRecords: clubPerformance.length,
        totalMembers: districtStats.membership.total,
      })

      return {
        success: true,
        data: districtStats,
        sourceDataDate,
        isDataAvailable: true,
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)

      // Check if it's a "date not available" error vs actual failure
      if (this.isDateUnavailableError(errorMessage)) {
        logger.info('No data available for reconciliation date', {
          districtId,
          targetDate,
        })
        return {
          success: true,
          isDataAvailable: false,
          error: 'No data available for the specified date',
        }
      }

      logger.error('Critical error in reconciliation data fetch', {
        districtId,
        targetDate,
        error: errorMessage,
      })

      return {
        success: false,
        isDataAvailable: false,
        error: errorMessage,
      }
    }
  }

  /**
   * Check if an error indicates date unavailability vs actual failure
   */
  private isDateUnavailableError(errorMessage: string): boolean {
    const message = errorMessage.toLowerCase()
    return (
      message.includes('not available') ||
      message.includes('dashboard returned') ||
      message.includes('date selection failed') ||
      message.includes('not found') ||
      message.includes('404')
    )
  }

  /**
   * Convert raw dashboard data to DistrictStatistics format (simplified)
   */
  private convertToDistrictStatistics(
    districtId: string,
    asOfDate: string,
    _districtPerformance: unknown[],
    _divisionPerformance: unknown[],
    clubPerformance: Record<string, unknown>[]
  ): DistrictStatistics {
    // Calculate membership statistics from club data
    const totalMembers = clubPerformance.reduce((sum, club) => {
      const members = parseInt(
        (club['Active Members'] || club['Membership'] || '0').toString()
      )
      return sum + (isNaN(members) ? 0 : members)
    }, 0)

    // Calculate club statistics
    const totalClubs = clubPerformance.length
    const activeClubs = clubPerformance.filter(
      club =>
        club['Status'] === 'Active' || !club['Status'] || club['Status'] === ''
    ).length

    const suspendedClubs = clubPerformance.filter(
      club => club['Status'] === 'Suspended'
    ).length

    const ineligibleClubs = clubPerformance.filter(
      club => club['Status'] === 'Ineligible'
    ).length

    const lowClubs = clubPerformance.filter(club => {
      const members = parseInt(
        (club['Active Members'] || club['Membership'] || '0').toString()
      )
      return !isNaN(members) && members < 20 // Typically low membership threshold
    }).length

    // Calculate distinguished clubs
    const distinguishedClubs = clubPerformance.filter(club => {
      // Look for distinguished status indicators
      return (
        club['Distinguished Status'] === 'Distinguished' ||
        club['Distinguished Status'] === 'Select Distinguished' ||
        club['Distinguished Status'] === "President's Distinguished" ||
        club['DCP Status'] === 'Distinguished' ||
        club['DCP Status'] === 'Select Distinguished' ||
        club['DCP Status'] === "President's Distinguished"
      )
    }).length

    // Calculate education statistics (simplified)
    const totalAwards = clubPerformance.reduce((sum, club) => {
      const awards = parseInt(
        (club['Awards'] || club['Total Awards'] || '0').toString()
      )
      return sum + (isNaN(awards) ? 0 : awards)
    }, 0)

    return {
      districtId,
      asOfDate,
      membership: {
        total: totalMembers,
        change: 0, // Would need historical data to calculate
        changePercent: 0, // Would need historical data to calculate
        byClub: clubPerformance.map(club => ({
          clubId: (club['Club Number'] || club['Club ID'] || '').toString(),
          clubName: (club['Club Name'] || '').toString(),
          memberCount:
            parseInt(
              (club['Active Members'] || club['Membership'] || '0').toString()
            ) || 0,
        })),
      },
      clubs: {
        total: totalClubs,
        active: activeClubs,
        suspended: suspendedClubs,
        ineligible: ineligibleClubs,
        low: lowClubs,
        distinguished: distinguishedClubs,
      },
      education: {
        totalAwards,
        byType: [], // Would need more detailed parsing
        topClubs: [], // Would need more detailed parsing
        byMonth: [], // Would need historical data
      },
    }
  }
}
