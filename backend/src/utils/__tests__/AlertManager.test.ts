import { describe, it, expect, vi, afterEach } from 'vitest'
import { AlertManager, AlertSeverity, AlertCategory } from '../AlertManager'
import { createTestSelfCleanup } from '../test-self-cleanup'

describe('AlertManager', () => {
  // Self-cleanup setup - each test manages its own cleanup
  const { cleanup, afterEach: performCleanup } = createTestSelfCleanup({
    verbose: false,
  })

  // Each test cleans up after itself
  afterEach(performCleanup)

  function setupAlertManager() {
    vi.useFakeTimers()
    // Create new instance for testing (no singleton pattern)
    const instance = new AlertManager()

    // Register cleanup for timers
    cleanup.addCleanupFunction(async () => {
      vi.useRealTimers()
    })

    return instance
  }

  describe('instance creation', () => {
    it('should create new instances independently', () => {
      const instance1 = new AlertManager()
      const instance2 = new AlertManager()

      expect(instance1).not.toBe(instance2)
      expect(instance1).toBeInstanceOf(AlertManager)
      expect(instance2).toBeInstanceOf(AlertManager)
    })
  })

  describe('sendAlert', () => {
    it('should send an alert successfully', async () => {
      const alertManager = setupAlertManager()

      const alertId = await alertManager.sendAlert(
        AlertSeverity.HIGH,
        AlertCategory.CIRCUIT_BREAKER,
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
      expect(activeAlerts[0].category).toBe(AlertCategory.CIRCUIT_BREAKER)
    })

    it('should throttle duplicate alerts', async () => {
      const alertManager = setupAlertManager()

      // Send first alert
      const alertId1 = await alertManager.sendAlert(
        AlertSeverity.HIGH,
        AlertCategory.CIRCUIT_BREAKER,
        'Duplicate Alert',
        'First message'
      )

      // Send duplicate alert immediately
      const alertId2 = await alertManager.sendAlert(
        AlertSeverity.HIGH,
        AlertCategory.CIRCUIT_BREAKER,
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
        AlertCategory.CIRCUIT_BREAKER,
        'Throttle Test',
        'First message'
      )

      // Fast-forward past throttle period (15 minutes for circuit breaker alerts)
      vi.advanceTimersByTime(16 * 60 * 1000)

      // Send same alert again
      const alertId2 = await alertManager.sendAlert(
        AlertSeverity.HIGH,
        AlertCategory.CIRCUIT_BREAKER,
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
        ['data-refresh']
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
  })

  describe('alert resolution', () => {
    it('should resolve an alert', async () => {
      const alertManager = setupAlertManager()

      const alertId = await alertManager.sendAlert(
        AlertSeverity.HIGH,
        AlertCategory.CIRCUIT_BREAKER,
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
        AlertCategory.CIRCUIT_BREAKER,
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
        AlertCategory.CIRCUIT_BREAKER,
        'Circuit Breaker Alert',
        'Test message'
      )

      await alertManager.sendAlert(
        AlertSeverity.MEDIUM,
        AlertCategory.DATA_QUALITY,
        'Data Quality Alert',
        'Test message'
      )

      const circuitBreakerAlerts = alertManager.getActiveAlerts(
        AlertCategory.CIRCUIT_BREAKER
      )
      const dataQualityAlerts = alertManager.getActiveAlerts(
        AlertCategory.DATA_QUALITY
      )
      const allAlerts = alertManager.getActiveAlerts()

      expect(circuitBreakerAlerts).toHaveLength(1)
      expect(dataQualityAlerts).toHaveLength(1)
      expect(allAlerts).toHaveLength(2)

      expect(circuitBreakerAlerts[0].category).toBe(
        AlertCategory.CIRCUIT_BREAKER
      )
      expect(dataQualityAlerts[0].category).toBe(AlertCategory.DATA_QUALITY)
    })
  })

  describe('alert statistics', () => {
    it('should provide accurate statistics', async () => {
      const alertManager = setupAlertManager()

      // Send various alerts with unique titles to avoid throttling
      const alert1Id = await alertManager.sendAlert(
        AlertSeverity.HIGH,
        AlertCategory.CIRCUIT_BREAKER,
        'Unique Alert 1',
        'Message'
      )

      // Advance time to avoid throttling for the second CIRCUIT_BREAKER alert
      vi.advanceTimersByTime(16 * 60 * 1000) // 16 minutes

      await alertManager.sendAlert(
        AlertSeverity.MEDIUM,
        AlertCategory.CIRCUIT_BREAKER,
        'Unique Alert 2',
        'Message'
      )
      await alertManager.sendAlert(
        AlertSeverity.CRITICAL,
        AlertCategory.DATA_QUALITY,
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
      expect(stats.byCategory[AlertCategory.CIRCUIT_BREAKER]).toBe(1)
      expect(stats.byCategory[AlertCategory.DATA_QUALITY]).toBe(1)
    })
  })

  describe('cleanup', () => {
    it('should clean up old resolved alerts', async () => {
      const alertManager = setupAlertManager()

      // Send and resolve an alert
      const alertId = await alertManager.sendAlert(
        AlertSeverity.HIGH,
        AlertCategory.CIRCUIT_BREAKER,
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
        AlertCategory.CIRCUIT_BREAKER,
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
