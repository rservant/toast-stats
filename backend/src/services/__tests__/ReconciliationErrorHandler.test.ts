import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ReconciliationErrorHandler } from '../ReconciliationErrorHandler.js'
import { AlertManager } from '../../utils/AlertManager.js'
import {
  CircuitBreakerManager,
  CircuitState,
} from '../../utils/CircuitBreaker.js'

// Mock dependencies
vi.mock('../DistrictBackfillService.js')
vi.mock('../../utils/AlertManager.js')
vi.mock('../../utils/CircuitBreaker.js')

// Interface for mock backfill service
interface MockBackfillService {
  fetchReconciliationData: ReturnType<typeof vi.fn>
}

// Interface for mock alert manager
interface MockAlertManager {
  sendAlert: ReturnType<typeof vi.fn>
  sendReconciliationFailureAlert: ReturnType<typeof vi.fn>
  sendReconciliationTimeoutAlert: ReturnType<typeof vi.fn>
  sendDashboardUnavailableAlert: ReturnType<typeof vi.fn>
  sendDataQualityAlert: ReturnType<typeof vi.fn>
}

// Interface for mock circuit breaker
interface MockCircuitBreaker {
  execute: ReturnType<typeof vi.fn>
  getStats: ReturnType<typeof vi.fn>
}

// Interface for mock circuit manager
interface MockCircuitManager {
  getCircuitBreaker: ReturnType<typeof vi.fn>
  getAllStats: ReturnType<typeof vi.fn>
  resetAll: ReturnType<typeof vi.fn>
}

// Interface for reconciliation data
interface ReconciliationData {
  districtId: string
  [key: string]: unknown
}

describe('ReconciliationErrorHandler', () => {
  let errorHandler: ReconciliationErrorHandler
  let mockBackfillService: MockBackfillService
  let mockAlertManager: MockAlertManager

  beforeEach(() => {
    vi.useFakeTimers()

    // Reset singleton instances
    ;(
      ReconciliationErrorHandler as unknown as { instance: undefined }
    ).instance = undefined
    ;(AlertManager as unknown as { instance: undefined }).instance = undefined
    ;(CircuitBreakerManager as unknown as { instance: undefined }).instance =
      undefined

    // Create mocks
    mockBackfillService = {
      fetchReconciliationData: vi.fn(),
    }

    mockAlertManager = {
      sendAlert: vi.fn().mockResolvedValue('alert-id'),
      sendReconciliationFailureAlert: vi.fn().mockResolvedValue('alert-id'),
      sendReconciliationTimeoutAlert: vi.fn().mockResolvedValue('alert-id'),
      sendDashboardUnavailableAlert: vi.fn().mockResolvedValue('alert-id'),
      sendDataQualityAlert: vi.fn().mockResolvedValue('alert-id'),
    }

    // Mock AlertManager.getInstance
    vi.mocked(AlertManager.getInstance).mockReturnValue(
      mockAlertManager as unknown as AlertManager
    )

    // Mock CircuitBreakerManager
    const mockCircuitBreaker: MockCircuitBreaker = {
      execute: vi.fn(),
      getStats: vi.fn().mockReturnValue({
        state: CircuitState.CLOSED,
        failureCount: 0,
        successCount: 0,
      }),
    }

    const mockCircuitManager: MockCircuitManager = {
      getCircuitBreaker: vi.fn().mockReturnValue(mockCircuitBreaker),
      getAllStats: vi.fn().mockReturnValue({}),
      resetAll: vi.fn(),
    }

    vi.mocked(CircuitBreakerManager.getInstance).mockReturnValue(
      mockCircuitManager as unknown as CircuitBreakerManager
    )

    errorHandler = ReconciliationErrorHandler.getInstance({
      circuitBreakerEnabled: true,
      alertingEnabled: true,
      maxConsecutiveFailures: 3,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('singleton behavior', () => {
    it('should return the same instance', () => {
      const instance1 = ReconciliationErrorHandler.getInstance()
      const instance2 = ReconciliationErrorHandler.getInstance()

      expect(instance1).toBe(instance2)
    })
  })

  describe('executeDashboardFetch', () => {
    it('should execute successful dashboard fetch', async () => {
      const mockResult = {
        success: true,
        data: { districtId: 'D123' } as ReconciliationData,
        sourceDataDate: '2024-01-31',
        isDataAvailable: true,
      }

      mockBackfillService.fetchReconciliationData.mockResolvedValue(mockResult)

      // Mock circuit breaker to execute operation directly
      const mockCircuitManager = vi.mocked(CircuitBreakerManager.getInstance)()
      const mockCircuitBreaker = mockCircuitManager.getCircuitBreaker(
        'reconciliation-dashboard'
      )
      vi.mocked(mockCircuitBreaker.execute).mockImplementation(
        async operation => {
          return await operation()
        }
      )

      const result = await errorHandler.executeDashboardFetch(
        mockBackfillService as unknown as Parameters<
          typeof errorHandler.executeDashboardFetch
        >[0],
        'D123',
        '2024-01-31',
        { districtId: 'D123', operation: 'test-fetch' }
      )

      expect(result).toEqual(mockResult)
      expect(mockBackfillService.fetchReconciliationData).toHaveBeenCalledWith(
        'D123',
        '2024-01-31'
      )
    })

    it('should handle dashboard fetch failure with alerting', async () => {
      const mockError = new Error('Dashboard unavailable')
      mockBackfillService.fetchReconciliationData.mockRejectedValue(mockError)

      // Mock circuit breaker to throw error
      const mockCircuitManager = vi.mocked(CircuitBreakerManager.getInstance)()
      const mockCircuitBreaker = mockCircuitManager.getCircuitBreaker(
        'reconciliation-dashboard'
      )
      vi.mocked(mockCircuitBreaker.execute).mockRejectedValue(mockError)

      const result = await errorHandler.executeDashboardFetch(
        mockBackfillService as unknown as Parameters<
          typeof errorHandler.executeDashboardFetch
        >[0],
        'D123',
        '2024-01-31',
        { districtId: 'D123', operation: 'test-fetch' }
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Dashboard unavailable')
    })

    it('should work without circuit breaker when disabled', async () => {
      // Create error handler with circuit breaker disabled
      ;(
        ReconciliationErrorHandler as unknown as { instance: undefined }
      ).instance = undefined
      const errorHandlerNoCircuit = ReconciliationErrorHandler.getInstance({
        circuitBreakerEnabled: false,
        alertingEnabled: true,
      })

      const mockResult = {
        success: true,
        data: { districtId: 'D123' } as ReconciliationData,
        sourceDataDate: '2024-01-31',
        isDataAvailable: true,
      }

      mockBackfillService.fetchReconciliationData.mockResolvedValue(mockResult)

      const result = await errorHandlerNoCircuit.executeDashboardFetch(
        mockBackfillService as unknown as Parameters<
          typeof errorHandlerNoCircuit.executeDashboardFetch
        >[0],
        'D123',
        '2024-01-31',
        { districtId: 'D123', operation: 'test-fetch' }
      )

      expect(result).toEqual(mockResult)
    })
  })

  describe('executeCacheOperation', () => {
    it('should execute successful cache operation', async () => {
      const mockOperation = vi.fn().mockResolvedValue('cache-result')

      // Mock circuit breaker to execute operation directly
      const mockCircuitManager = vi.mocked(CircuitBreakerManager.getInstance)()
      const mockCircuitBreaker = mockCircuitManager.getCircuitBreaker(
        'reconciliation-cache'
      )
      vi.mocked(mockCircuitBreaker.execute).mockImplementation(
        async operation => {
          return await operation()
        }
      )

      const result = await errorHandler.executeCacheOperation(mockOperation, {
        districtId: 'D123',
        operation: 'cache-test',
      })

      expect(result.success).toBe(true)
      expect(result.result).toBe('cache-result')
      expect(mockOperation).toHaveBeenCalled()
    })

    it('should handle cache operation failure', async () => {
      const mockOperation = vi
        .fn()
        .mockRejectedValue(new Error('Cache write failed'))

      // Mock circuit breaker to throw error
      const mockCircuitManager = vi.mocked(CircuitBreakerManager.getInstance)()
      const mockCircuitBreaker = mockCircuitManager.getCircuitBreaker(
        'reconciliation-cache'
      )
      vi.mocked(mockCircuitBreaker.execute).mockRejectedValue(
        new Error('Cache write failed')
      )

      const result = await errorHandler.executeCacheOperation(mockOperation, {
        districtId: 'D123',
        operation: 'cache-test',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Cache write failed')
    })
  })

  describe('error tracking and alerting', () => {
    it('should handle reconciliation job failure', async () => {
      await errorHandler.handleReconciliationJobFailure(
        'job-123',
        'D123',
        '2024-01',
        new Error('Job processing failed')
      )

      expect(
        mockAlertManager.sendReconciliationFailureAlert
      ).toHaveBeenCalledWith(
        'D123',
        '2024-01',
        'Job processing failed',
        'job-123'
      )
    })

    it('should handle reconciliation timeout', async () => {
      await errorHandler.handleReconciliationTimeout(
        'job-123',
        'D123',
        '2024-01',
        20,
        15
      )

      expect(
        mockAlertManager.sendReconciliationTimeoutAlert
      ).toHaveBeenCalledWith('D123', '2024-01', 20, 15)
    })

    it('should track consecutive failures and send alerts', async () => {
      const mockOperation = vi
        .fn()
        .mockRejectedValue(new Error('Persistent failure'))

      // Mock circuit breaker to always fail
      const mockCircuitManager = vi.mocked(CircuitBreakerManager.getInstance)()
      const mockCircuitBreaker = mockCircuitManager.getCircuitBreaker(
        'reconciliation-cache'
      )
      vi.mocked(mockCircuitBreaker.execute).mockRejectedValue(
        new Error('Persistent failure')
      )

      // Execute operation multiple times to trigger consecutive failure alert
      for (let i = 0; i < 4; i++) {
        await errorHandler.executeCacheOperation(mockOperation, {
          districtId: 'D123',
          operation: 'failing-operation',
        })
      }

      // Should have sent an alert for consecutive failures
      expect(mockAlertManager.sendAlert).toHaveBeenCalledWith(
        expect.any(String), // AlertSeverity.HIGH
        expect.any(String), // AlertCategory.SYSTEM
        'Consecutive Failure Threshold Exceeded',
        expect.stringContaining('has failed'),
        expect.objectContaining({
          failureCount: expect.any(Number),
          threshold: 3,
        })
      )
    })
  })

  describe('configuration and statistics', () => {
    it('should return error statistics', () => {
      const stats = errorHandler.getErrorStats()

      expect(stats).toHaveProperty('circuitBreakers')
      expect(stats).toHaveProperty('failureTracking')
      expect(stats).toHaveProperty('config')
      expect(stats.config.maxConsecutiveFailures).toBe(3)
    })

    it('should update configuration', () => {
      errorHandler.updateConfig({
        maxConsecutiveFailures: 5,
        alertingEnabled: false,
      })

      const stats = errorHandler.getErrorStats()
      expect(stats.config.maxConsecutiveFailures).toBe(5)
      expect(stats.config.alertingEnabled).toBe(false)
    })

    it('should reset error state', async () => {
      await errorHandler.resetErrorState()

      const mockCircuitManager = vi.mocked(CircuitBreakerManager.getInstance)()
      expect(mockCircuitManager.resetAll).toHaveBeenCalled()

      expect(mockAlertManager.sendAlert).toHaveBeenCalledWith(
        expect.any(String), // AlertSeverity.LOW
        expect.any(String), // AlertCategory.SYSTEM
        'Error Handling Reset',
        'Error handling state has been manually reset',
        expect.objectContaining({
          timestamp: expect.any(String),
        })
      )
    })
  })

  describe('alerting configuration', () => {
    it('should not send alerts when alerting is disabled', async () => {
      // Create error handler with alerting disabled
      ;(
        ReconciliationErrorHandler as unknown as { instance: undefined }
      ).instance = undefined
      const errorHandlerNoAlerts = ReconciliationErrorHandler.getInstance({
        alertingEnabled: false,
      })

      await errorHandlerNoAlerts.handleReconciliationJobFailure(
        'job-123',
        'D123',
        '2024-01',
        new Error('Job processing failed')
      )

      // Should not have called alert manager since alerting is disabled
      expect(
        mockAlertManager.sendReconciliationFailureAlert
      ).not.toHaveBeenCalled()
    })
  })
})
