import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  CircuitBreaker,
  CircuitState,
  CircuitBreakerError,
  CircuitBreakerManager,
} from '../CircuitBreaker'

describe('CircuitBreaker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('basic functionality', () => {
    it('should start in CLOSED state', () => {
      const breaker = new CircuitBreaker('test', { failureThreshold: 3 })
      const stats = breaker.getStats()

      expect(stats.state).toBe(CircuitState.CLOSED)
      expect(stats.failureCount).toBe(0)
      expect(stats.successCount).toBe(0)
    })

    it('should execute operation successfully in CLOSED state', async () => {
      const breaker = new CircuitBreaker('test', { failureThreshold: 3 })
      const operation = vi.fn().mockResolvedValue('success')

      const result = await breaker.execute(operation)

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(1)

      const stats = breaker.getStats()
      expect(stats.state).toBe(CircuitState.CLOSED)
      expect(stats.successCount).toBe(1)
      expect(stats.failureCount).toBe(0)
    })

    it('should track failures in CLOSED state', async () => {
      const breaker = new CircuitBreaker('test', { failureThreshold: 3 })
      const operation = vi.fn().mockRejectedValue(new Error('test error'))

      await expect(breaker.execute(operation)).rejects.toThrow('test error')

      const stats = breaker.getStats()
      expect(stats.state).toBe(CircuitState.CLOSED)
      expect(stats.failureCount).toBe(1)
      expect(stats.successCount).toBe(0)
    })

    it('should open circuit after failure threshold', async () => {
      const breaker = new CircuitBreaker('test', {
        failureThreshold: 2,
        recoveryTimeout: 60000,
      })
      const operation = vi.fn().mockRejectedValue(new Error('test error'))

      // First failure
      await expect(breaker.execute(operation)).rejects.toThrow('test error')
      expect(breaker.getStats().state).toBe(CircuitState.CLOSED)

      // Second failure - should open circuit
      await expect(breaker.execute(operation)).rejects.toThrow('test error')
      expect(breaker.getStats().state).toBe(CircuitState.OPEN)
    })

    it('should reject requests immediately when OPEN', async () => {
      const breaker = new CircuitBreaker('test', {
        failureThreshold: 1,
        recoveryTimeout: 60000,
      })
      const operation = vi.fn().mockRejectedValue(new Error('test error'))

      // Trigger circuit to open
      await expect(breaker.execute(operation)).rejects.toThrow('test error')
      expect(breaker.getStats().state).toBe(CircuitState.OPEN)

      // Next request should be rejected immediately
      const fastOperation = vi.fn().mockResolvedValue('success')
      await expect(breaker.execute(fastOperation)).rejects.toThrow(
        CircuitBreakerError
      )
      expect(fastOperation).not.toHaveBeenCalled()
    })

    it('should transition to HALF_OPEN after recovery timeout', async () => {
      const breaker = new CircuitBreaker('test', {
        failureThreshold: 1,
        recoveryTimeout: 60000,
      })
      const failingOperation = vi
        .fn()
        .mockRejectedValue(new Error('test error'))
      const successOperation = vi.fn().mockResolvedValue('success')

      // Open the circuit
      await expect(breaker.execute(failingOperation)).rejects.toThrow(
        'test error'
      )
      expect(breaker.getStats().state).toBe(CircuitState.OPEN)

      // Fast-forward past recovery timeout
      vi.advanceTimersByTime(60001)

      // Next request should transition to HALF_OPEN and succeed
      const result = await breaker.execute(successOperation)
      expect(result).toBe('success')
      expect(breaker.getStats().state).toBe(CircuitState.CLOSED)
    })

    it('should return to OPEN if operation fails in HALF_OPEN', async () => {
      const breaker = new CircuitBreaker('test', {
        failureThreshold: 1,
        recoveryTimeout: 60000,
      })
      const failingOperation = vi
        .fn()
        .mockRejectedValue(new Error('test error'))

      // Open the circuit
      await expect(breaker.execute(failingOperation)).rejects.toThrow(
        'test error'
      )
      expect(breaker.getStats().state).toBe(CircuitState.OPEN)

      // Fast-forward past recovery timeout
      vi.advanceTimersByTime(60001)

      // Next request should transition to HALF_OPEN but fail
      await expect(breaker.execute(failingOperation)).rejects.toThrow(
        'test error'
      )
      expect(breaker.getStats().state).toBe(CircuitState.OPEN)
    })
  })

  describe('error filtering', () => {
    it('should not count filtered errors as failures', async () => {
      const breaker = new CircuitBreaker('test', {
        failureThreshold: 2,
        expectedErrors: error => !error.message.includes('client error'),
      })

      const clientErrorOperation = vi
        .fn()
        .mockRejectedValue(new Error('client error'))
      const serverErrorOperation = vi
        .fn()
        .mockRejectedValue(new Error('server error'))

      // Client error should not count
      await expect(breaker.execute(clientErrorOperation)).rejects.toThrow(
        'client error'
      )
      expect(breaker.getStats().state).toBe(CircuitState.CLOSED)
      expect(breaker.getStats().failureCount).toBe(0)

      // Server error should count
      await expect(breaker.execute(serverErrorOperation)).rejects.toThrow(
        'server error'
      )
      expect(breaker.getStats().state).toBe(CircuitState.CLOSED)
      expect(breaker.getStats().failureCount).toBe(1)
    })
  })

  describe('reset functionality', () => {
    it('should reset circuit to CLOSED state', async () => {
      const breaker = new CircuitBreaker('test', { failureThreshold: 1 })
      const operation = vi.fn().mockRejectedValue(new Error('test error'))

      // Open the circuit
      await expect(breaker.execute(operation)).rejects.toThrow('test error')
      expect(breaker.getStats().state).toBe(CircuitState.OPEN)

      // Reset the circuit
      breaker.reset()

      const stats = breaker.getStats()
      expect(stats.state).toBe(CircuitState.CLOSED)
      expect(stats.failureCount).toBe(0)
      expect(stats.successCount).toBe(0)
    })
  })

  describe('factory methods', () => {
    it('should create dashboard circuit breaker with appropriate settings', () => {
      const breaker =
        CircuitBreaker.createDashboardCircuitBreaker('test-dashboard')
      const stats = breaker.getStats()

      expect(breaker.getName()).toBe('test-dashboard')
      expect(stats.state).toBe(CircuitState.CLOSED)
    })

    it('should create cache circuit breaker with appropriate settings', () => {
      const breaker = CircuitBreaker.createCacheCircuitBreaker('test-cache')
      const stats = breaker.getStats()

      expect(breaker.getName()).toBe('test-cache')
      expect(stats.state).toBe(CircuitState.CLOSED)
    })
  })
})

describe('CircuitBreakerManager', () => {
  it('should create and manage circuit breakers', () => {
    const manager = new CircuitBreakerManager()

    const breaker1 = manager.getCircuitBreaker('test1')
    const breaker2 = manager.getCircuitBreaker('test1') // Same name
    const breaker3 = manager.getCircuitBreaker('test2') // Different name

    expect(breaker1).toBe(breaker2) // Should return same instance
    expect(breaker1).not.toBe(breaker3) // Should be different instances
  })

  it('should get stats for all circuit breakers', async () => {
    const manager = new CircuitBreakerManager()

    const breaker1 = manager.getCircuitBreaker('stats-test-1')
    manager.getCircuitBreaker('stats-test-2')

    // Execute some operations to generate stats
    await breaker1.execute(() => Promise.resolve('success'))

    const allStats = manager.getAllStats()

    expect(allStats['stats-test-1']).toBeDefined()
    expect(allStats['stats-test-2']).toBeDefined()
    expect(allStats['stats-test-1'].totalSuccesses).toBe(1)
  })

  it('should reset all circuit breakers', async () => {
    const manager = new CircuitBreakerManager()

    const breaker = manager.getCircuitBreaker('reset-test', {
      failureThreshold: 1,
    })

    // Open the circuit
    await expect(
      breaker.execute(() => Promise.reject(new Error('test')))
    ).rejects.toThrow()
    expect(breaker.getStats().state).toBe(CircuitState.OPEN)

    // Reset all
    manager.resetAll()

    expect(breaker.getStats().state).toBe(CircuitState.CLOSED)
  })
})
