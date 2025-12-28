import { describe, it, expect, vi } from 'vitest'
import { AlertManager, AlertSeverity, AlertCategory } from '../AlertManager.ts'
import { createTestSelfCleanup } from '../test-self-cleanup.ts'

describe('AlertManager', () => {
  // Self-cleanup setup - each test manages its own cleanup
  const { cleanup, afterEach: performCleanup } = createTestSelfCleanup({
    verbose: false,
  })

  // Each test cleans up after itself
  afterEach(performCleanup)

  function setupAlertManager() {
    vi.useFakeTimers()
    // Reset singleton instance for testing
    ;(AlertManager as unknown as { instance?: AlertManager }).instance =
      undefined
    const alertManager = AlertManager.getInstance()

    // Register cleanup for timers
    cleanup(() => {
      vi.useRealTimers()
    })

    return alertManager
  }

  describe('singleton behavior', () => {
    it('should return the same instance', () => {
      const alertManager = setupAlertManager()

      const instance1 = AlertManager.getInstance()
      const instance2 = AlertManager.getInstance()

      expect(instance1).toBe(instance2)
    })
  })

  describe('sendAlert', () => {
    it('should send an alert successfully', async () => {
      const alertManager = setupAlertManager()

      const alertId = await alertManager.sendAlert(
        AlertSeverity.HIGH,
        AlertCategory.RECONCILIATION,
        'Test Alert',
        'This is a test alert',
        { testData: 'value' }
      )

      expect(alertId).toBeDefined()
      expect(typeof alertId).toBe('string')

      const activeAlerts = alertManager.getActiveAlerts()
      expect(activeAlerts).toHaveLength(1)
      expect(activeAlerts[0].title).toBe('Test Alert')
      expect(activeAlerts[0].severity).toBe(AlertSeverity.HIGH)
      expect(activeAlerts[0].category).toBe(AlertCategory.RECONCILIATION)
    })

    it('should throttle duplicate alerts', async () => {
      const alertManager = setupAlertManager()

      // Send first alert
      const alertId1 = await alertManager.sendAlert(
        AlertSeverity.HIGH,
        AlertCategory.RECONCILIATION,
        'Duplicate Alert',
        'First message'
      )

      // Send duplicate alert immediately
      const alertId2 = await alertManager.sendAlert(
        AlertSeverity.HIGH,
        AlertCategory.RECONCILIATION,
        'Duplicate Alert',
        'Second message'
      )

      expect(alertId1).toBeDefined()
      expect(alertId2).toBeNull() // Should be throttled

      const activeAlerts = alertManager.getActiveAlerts()
      expect(activeAlerts).toHaveLength(1)
    })

    it('should allow alerts after throttle period', async () => {
      const alertManager = setupAlertManager()

      // Send first alert
      const alertId1 = await alertManager.sendAlert(
        AlertSeverity.HIGH,
        AlertCategory.RECONCILIATION,
        'Throttle Test',
        'First message'
      )

      // Fast-forward past throttle period (30 minutes for reconciliation alerts)
      vi.advanceTimersByTime(31 * 60 * 1000)

      // Send same alert again
      const alertId2 = await alertManager.sendAlert(
        AlertSeverity.HIGH,
        AlertCategory.RECONCILIATION,
        'Throttle Test',
        'Second message'
      )

      expect(alertId1).toBeDefined()
      expect(alertId2).toBeDefined()
      expect(alertId1).not.toBe(alertId2)

      const activeAlerts = alertManager.getActiveAlerts()
      expect(activeAlerts).toHaveLength(2)
    })
  })

  describe('specialized alert methods', () => {
    it('should send reconciliation failure alert', async () => {
      const alertManager = setupAlertManager()

      const alertId = await alertManager.sendReconciliationFailureAlert(
        'D123',
        '2024-01',
        'Test error message',
        'job-123'
      )

      expect(alertId).toBeDefined()

      const activeAlerts = alertManager.getActiveAlerts()
      expect(activeAlerts).toHaveLength(1)
      expect(activeAlerts[0].category).toBe(AlertCategory.RECONCILIATION)
      expect(activeAlerts[0].severity).toBe(AlertSeverity.HIGH)
      expect(activeAlerts[0].context.districtId).toBe('D123')
      expect(activeAlerts[0].context.targetMonth).toBe('2024-01')
    })

    it('should send circuit breaker alert', async () => {
      const alertManager = setupAlertManager()

      const alertId = await alertManager.sendCircuitBreakerAlert(
        'dashboard-api',
        'OPEN',
        5,
        new Date()
      )

      expect(alertId).toBeDefined()

      const activeAlerts = alertManager.getActiveAlerts()
      expect(activeAlerts).toHaveLength(1)
      expect(activeAlerts[0].category).toBe(AlertCategory.CIRCUIT_BREAKER)
      expect(activeAlerts[0].severity).toBe(AlertSeverity.HIGH)
    })

    it('should send dashboard unavailable alert', async () => {
      const alertManager = setupAlertManager()

      const alertId = await alertManager.sendDashboardUnavailableAlert(
        120000, // 2 minutes
        'Connection timeout',
        ['reconciliation']
      )

      expect(alertId).toBeDefined()

      const activeAlerts = alertManager.getActiveAlerts()
      expect(activeAlerts).toHaveLength(1)
      expect(activeAlerts[0].category).toBe(AlertCategory.NETWORK)
      expect(activeAlerts[0].severity).toBe(AlertSeverity.HIGH)
    })

    it('should send data quality alert', async () => {
      const alertManager = setupAlertManager()

      const alertId = await alertManager.sendDataQualityAlert(
        'D123',
        '2024-01-31',
        'Suspicious membership count',
        { memberCount: 50, clubCount: 100 }
      )

      expect(alertId).toBeDefined()

      const activeAlerts = alertManager.getActiveAlerts()
      expect(activeAlerts).toHaveLength(1)
      expect(activeAlerts[0].category).toBe(AlertCategory.DATA_QUALITY)
      expect(activeAlerts[0].severity).toBe(AlertSeverity.MEDIUM)
    })

    it('should send reconciliation timeout alert', async () => {
      const alertManager = setupAlertManager()

      const alertId = await alertManager.sendReconciliationTimeoutAlert(
        'D123',
        '2024-01',
        20,
        15
      )

      expect(alertId).toBeDefined()

      const activeAlerts = alertManager.getActiveAlerts()
      expect(activeAlerts).toHaveLength(1)
      expect(activeAlerts[0].category).toBe(AlertCategory.RECONCILIATION)
      expect(activeAlerts[0].severity).toBe(AlertSeverity.MEDIUM)
    })
  })

  describe('alert resolution', () => {
    it('should resolve an alert', async () => {
      const alertManager = setupAlertManager()

      const alertId = await alertManager.sendAlert(
        AlertSeverity.HIGH,
        AlertCategory.RECONCILIATION,
        'Test Alert',
        'Test message'
      )

      expect(alertId).toBeDefined()

      const resolved = await alertManager.resolveAlert(alertId!, 'admin')
      expect(resolved).toBe(true)

      const activeAlerts = alertManager.getActiveAlerts()
      expect(activeAlerts).toHaveLength(0)
    })

    it('should not resolve non-existent alert', async () => {
      const alertManager = setupAlertManager()

      const resolved = await alertManager.resolveAlert('non-existent-id')
      expect(resolved).toBe(false)
    })

    it('should not resolve already resolved alert', async () => {
      const alertManager = setupAlertManager()

      const alertId = await alertManager.sendAlert(
        AlertSeverity.HIGH,
        AlertCategory.RECONCILIATION,
        'Test Alert',
        'Test message'
      )

      expect(alertId).toBeDefined()

      // Resolve once
      const resolved1 = await alertManager.resolveAlert(alertId!)
      expect(resolved1).toBe(true)

      // Try to resolve again
      const resolved2 = await alertManager.resolveAlert(alertId!)
      expect(resolved2).toBe(false)
    })
  })

  describe('alert filtering', () => {
    it('should filter alerts by category', async () => {
      const alertManager = setupAlertManager()

      await alertManager.sendAlert(
        AlertSeverity.HIGH,
        AlertCategory.RECONCILIATION,
        'Reconciliation Alert',
        'Test message'
      )

      await alertManager.sendAlert(
        AlertSeverity.MEDIUM,
        AlertCategory.CIRCUIT_BREAKER,
        'Circuit Breaker Alert',
        'Test message'
      )

      const reconciliationAlerts = alertManager.getActiveAlerts(
        AlertCategory.RECONCILIATION
      )
      const circuitBreakerAlerts = alertManager.getActiveAlerts(
        AlertCategory.CIRCUIT_BREAKER
      )
      const allAlerts = alertManager.getActiveAlerts()

      expect(reconciliationAlerts).toHaveLength(1)
      expect(circuitBreakerAlerts).toHaveLength(1)
      expect(allAlerts).toHaveLength(2)

      expect(reconciliationAlerts[0].category).toBe(
        AlertCategory.RECONCILIATION
      )
      expect(circuitBreakerAlerts[0].category).toBe(
        AlertCategory.CIRCUIT_BREAKER
      )
    })
  })

  describe('alert statistics', () => {
    it('should provide accurate statistics', async () => {
      const alertManager = setupAlertManager()

      // Send various alerts with unique titles to avoid throttling
      const alert1Id = await alertManager.sendAlert(
        AlertSeverity.HIGH,
        AlertCategory.RECONCILIATION,
        'Unique Alert 1',
        'Message'
      )

      // Advance time to avoid throttling for the second RECONCILIATION alert
      vi.advanceTimersByTime(31 * 60 * 1000) // 31 minutes

      await alertManager.sendAlert(
        AlertSeverity.MEDIUM,
        AlertCategory.RECONCILIATION,
        'Unique Alert 2',
        'Message'
      )
      await alertManager.sendAlert(
        AlertSeverity.CRITICAL,
        AlertCategory.CIRCUIT_BREAKER,
        'Unique Alert 3',
        'Message'
      )

      // Resolve the HIGH severity alert specifically
      await alertManager.resolveAlert(alert1Id!)

      const stats = alertManager.getAlertStats()

      expect(stats.total).toBe(3)
      expect(stats.active).toBe(2)
      expect(stats.resolved).toBe(1)
      expect(stats.bySeverity[AlertSeverity.HIGH]).toBe(0) // The HIGH alert was resolved
      expect(stats.bySeverity[AlertSeverity.MEDIUM]).toBe(1)
      expect(stats.bySeverity[AlertSeverity.CRITICAL]).toBe(1)
      expect(stats.byCategory[AlertCategory.RECONCILIATION]).toBe(1)
      expect(stats.byCategory[AlertCategory.CIRCUIT_BREAKER]).toBe(1)
    })
  })

  describe('cleanup', () => {
    it('should clean up old resolved alerts', async () => {
      const alertManager = setupAlertManager()

      // Send and resolve an alert
      const alertId = await alertManager.sendAlert(
        AlertSeverity.HIGH,
        AlertCategory.RECONCILIATION,
        'Old Alert',
        'Test message'
      )

      expect(alertId).toBeDefined()
      await alertManager.resolveAlert(alertId!)

      // Fast-forward 8 days
      vi.advanceTimersByTime(8 * 24 * 60 * 60 * 1000)

      const cleanedCount = await alertManager.cleanupOldAlerts()

      expect(cleanedCount).toBe(1)

      const stats = alertManager.getAlertStats()
      expect(stats.total).toBe(0)
    })

    it('should not clean up recent resolved alerts', async () => {
      const alertManager = setupAlertManager()

      // Send and resolve an alert
      const alertId = await alertManager.sendAlert(
        AlertSeverity.HIGH,
        AlertCategory.RECONCILIATION,
        'Recent Alert',
        'Test message'
      )

      expect(alertId).toBeDefined()
      await alertManager.resolveAlert(alertId!)

      // Fast-forward only 1 day
      vi.advanceTimersByTime(24 * 60 * 60 * 1000)

      const cleanedCount = await alertManager.cleanupOldAlerts()

      expect(cleanedCount).toBe(0)

      const stats = alertManager.getAlertStats()
      expect(stats.total).toBe(1)
    })
  })
})
