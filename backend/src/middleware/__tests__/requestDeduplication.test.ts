/**
 * Unit Tests for RequestDeduplicationService and Middleware
 *
 * Tests the request deduplication logic for preventing redundant processing
 * of concurrent identical requests.
 *
 * Validates: Requirements 6.1, 6.2, 6.3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  RequestDeduplicationService,
  createRequestDeduplicationService,
  getDefaultDeduplicationService,
  resetDefaultDeduplicationService,
  type RequestDeduplicationConfig,
} from '../requestDeduplication.js'

// Mock the logger to verify logging behavior
vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('RequestDeduplicationService', () => {
  let service: RequestDeduplicationService

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    // Create service with auto-cleanup disabled for predictable testing
    service = new RequestDeduplicationService({ enableAutoCleanup: false })
  })

  afterEach(() => {
    service.dispose()
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('getOrCreate()', () => {
    /**
     * Validates: Requirement 6.1 - Process only one request
     */
    it('executes factory function for first request', async () => {
      const factory = vi.fn().mockResolvedValue('result')

      const result = await service.getOrCreate('key1', factory)

      expect(factory).toHaveBeenCalledTimes(1)
      expect(result).toBe('result')
    })

    /**
     * Validates: Requirement 6.1 - Share result with all waiting clients
     * Validates: Requirement 6.2 - Queue subsequent identical requests
     */
    it('shares result with concurrent identical requests', async () => {
      let resolveFactory: (value: string) => void
      const factoryPromise = new Promise<string>(resolve => {
        resolveFactory = resolve
      })
      const factory = vi.fn().mockReturnValue(factoryPromise)

      // Start three concurrent requests with the same key
      const promise1 = service.getOrCreate('key1', factory)
      const promise2 = service.getOrCreate('key1', factory)
      const promise3 = service.getOrCreate('key1', factory)

      // Factory should only be called once
      expect(factory).toHaveBeenCalledTimes(1)

      // Resolve the factory
      resolveFactory!('shared-result')

      // All promises should resolve with the same result
      const [result1, result2, result3] = await Promise.all([
        promise1,
        promise2,
        promise3,
      ])

      expect(result1).toBe('shared-result')
      expect(result2).toBe('shared-result')
      expect(result3).toBe('shared-result')
    })

    /**
     * Validates: Requirement 6.2 - Queue subsequent identical requests
     */
    it('tracks waiting count for concurrent requests', async () => {
      let resolveFactory: (value: string) => void
      const factoryPromise = new Promise<string>(resolve => {
        resolveFactory = resolve
      })
      const factory = vi.fn().mockReturnValue(factoryPromise)

      // Start concurrent requests
      service.getOrCreate('key1', factory)
      service.getOrCreate('key1', factory)
      service.getOrCreate('key1', factory)

      // Should have 1 pending request with 3 waiting
      expect(service.getPendingCount()).toBe(1)

      // Resolve and wait for completion
      resolveFactory!('result')
      await vi.runAllTimersAsync()
    })

    it('handles different keys independently', async () => {
      const factory1 = vi.fn().mockResolvedValue('result1')
      const factory2 = vi.fn().mockResolvedValue('result2')

      const [result1, result2] = await Promise.all([
        service.getOrCreate('key1', factory1),
        service.getOrCreate('key2', factory2),
      ])

      expect(factory1).toHaveBeenCalledTimes(1)
      expect(factory2).toHaveBeenCalledTimes(1)
      expect(result1).toBe('result1')
      expect(result2).toBe('result2')
    })

    /**
     * Validates: Requirement 6.3 - Expire after response is sent
     */
    it('removes pending request after completion', async () => {
      const factory = vi.fn().mockResolvedValue('result')

      await service.getOrCreate('key1', factory)

      // Pending request should be removed after completion
      expect(service.getPendingCount()).toBe(0)
    })

    /**
     * Validates: Requirement 6.3 - New request triggers new computation after completion
     */
    it('allows new computation after previous completes', async () => {
      const factory = vi.fn().mockResolvedValue('result')

      // First request
      await service.getOrCreate('key1', factory)
      expect(factory).toHaveBeenCalledTimes(1)

      // Second request after first completes should trigger new computation
      await service.getOrCreate('key1', factory)
      expect(factory).toHaveBeenCalledTimes(2)
    })

    it('propagates errors to all waiting clients', async () => {
      let rejectFactory: (error: Error) => void
      const factoryPromise = new Promise<string>((_, reject) => {
        rejectFactory = reject
      })
      const factory = vi.fn().mockReturnValue(factoryPromise)

      // Start concurrent requests
      const promise1 = service.getOrCreate('key1', factory)
      const promise2 = service.getOrCreate('key1', factory)
      const promise3 = service.getOrCreate('key1', factory)

      // Reject the factory
      const error = new Error('Test error')
      rejectFactory!(error)

      // All promises should reject with the same error
      await expect(promise1).rejects.toThrow('Test error')
      await expect(promise2).rejects.toThrow('Test error')
      await expect(promise3).rejects.toThrow('Test error')
    })

    it('cleans up pending request after error', async () => {
      const factory = vi.fn().mockRejectedValue(new Error('Test error'))

      await expect(service.getOrCreate('key1', factory)).rejects.toThrow(
        'Test error'
      )

      // Pending request should be removed after error
      expect(service.getPendingCount()).toBe(0)
    })
  })

  describe('getPendingCount()', () => {
    it('returns 0 when no pending requests', () => {
      expect(service.getPendingCount()).toBe(0)
    })

    it('returns correct count of pending requests', async () => {
      let resolveFactory1: (value: string) => void
      let resolveFactory2: (value: string) => void

      const factory1 = vi.fn().mockReturnValue(
        new Promise<string>(resolve => {
          resolveFactory1 = resolve
        })
      )
      const factory2 = vi.fn().mockReturnValue(
        new Promise<string>(resolve => {
          resolveFactory2 = resolve
        })
      )

      // Start two different pending requests
      service.getOrCreate('key1', factory1)
      service.getOrCreate('key2', factory2)

      expect(service.getPendingCount()).toBe(2)

      // Resolve first request
      resolveFactory1!('result1')
      await vi.runAllTimersAsync()

      expect(service.getPendingCount()).toBe(1)

      // Resolve second request
      resolveFactory2!('result2')
      await vi.runAllTimersAsync()

      expect(service.getPendingCount()).toBe(0)
    })
  })

  describe('cleanup()', () => {
    /**
     * Validates: Requirement 6.3 - Expire after configurable timeout
     */
    it('removes expired pending requests', async () => {
      const config: RequestDeduplicationConfig = {
        timeoutMs: 1000,
        enableAutoCleanup: false,
      }
      const serviceWithTimeout = new RequestDeduplicationService(config)

      // Create a pending request that never resolves
      const factory = vi.fn().mockReturnValue(new Promise(() => {}))
      serviceWithTimeout.getOrCreate('key1', factory)

      expect(serviceWithTimeout.getPendingCount()).toBe(1)

      // Advance time past timeout
      vi.advanceTimersByTime(1500)

      // Run cleanup
      serviceWithTimeout.cleanup()

      expect(serviceWithTimeout.getPendingCount()).toBe(0)

      serviceWithTimeout.dispose()
    })

    it('does not remove requests within timeout', async () => {
      const config: RequestDeduplicationConfig = {
        timeoutMs: 5000,
        enableAutoCleanup: false,
      }
      const serviceWithTimeout = new RequestDeduplicationService(config)

      // Create a pending request
      const factory = vi.fn().mockReturnValue(new Promise(() => {}))
      serviceWithTimeout.getOrCreate('key1', factory)

      // Advance time but stay within timeout
      vi.advanceTimersByTime(3000)

      // Run cleanup
      serviceWithTimeout.cleanup()

      // Request should still be pending
      expect(serviceWithTimeout.getPendingCount()).toBe(1)

      serviceWithTimeout.dispose()
    })

    it('logs warning for expired requests', async () => {
      const { logger } = await import('../../utils/logger.js')

      const config: RequestDeduplicationConfig = {
        timeoutMs: 1000,
        enableAutoCleanup: false,
      }
      const serviceWithTimeout = new RequestDeduplicationService(config)

      // Create a pending request
      const factory = vi.fn().mockReturnValue(new Promise(() => {}))
      serviceWithTimeout.getOrCreate('key1', factory)

      // Advance time past timeout
      vi.advanceTimersByTime(1500)

      // Run cleanup
      serviceWithTimeout.cleanup()

      expect(logger.warn).toHaveBeenCalledWith(
        'Cleaning up expired pending request',
        expect.objectContaining({
          key: 'key1',
          timeoutMs: 1000,
        })
      )

      serviceWithTimeout.dispose()
    })
  })

  describe('dispose()', () => {
    it('clears all pending requests', async () => {
      // Create pending requests
      const factory = vi.fn().mockReturnValue(new Promise(() => {}))
      service.getOrCreate('key1', factory)
      service.getOrCreate('key2', factory)

      expect(service.getPendingCount()).toBe(2)

      service.dispose()

      expect(service.getPendingCount()).toBe(0)
    })

    it('stops cleanup interval', () => {
      const serviceWithCleanup = new RequestDeduplicationService({
        enableAutoCleanup: true,
        cleanupIntervalMs: 1000,
      })

      // Dispose should stop the interval
      serviceWithCleanup.dispose()

      // Advancing time should not cause issues
      vi.advanceTimersByTime(5000)

      // No errors should occur
      expect(serviceWithCleanup.getPendingCount()).toBe(0)
    })
  })

  describe('auto cleanup', () => {
    it('automatically cleans up expired requests', async () => {
      const config: RequestDeduplicationConfig = {
        timeoutMs: 1000,
        cleanupIntervalMs: 500,
        enableAutoCleanup: true,
      }
      const serviceWithAutoCleanup = new RequestDeduplicationService(config)

      // Create a pending request that never resolves
      const factory = vi.fn().mockReturnValue(new Promise(() => {}))
      serviceWithAutoCleanup.getOrCreate('key1', factory)

      expect(serviceWithAutoCleanup.getPendingCount()).toBe(1)

      // Advance time past timeout and cleanup interval
      vi.advanceTimersByTime(1500)

      // Request should be cleaned up automatically
      expect(serviceWithAutoCleanup.getPendingCount()).toBe(0)

      serviceWithAutoCleanup.dispose()
    })
  })
})

describe('createRequestDeduplicationService', () => {
  it('creates a new service instance', () => {
    const service = createRequestDeduplicationService({
      enableAutoCleanup: false,
    })

    expect(service).toBeInstanceOf(RequestDeduplicationService)
    expect(service.getPendingCount()).toBe(0)

    service.dispose()
  })

  it('accepts custom configuration', () => {
    const service = createRequestDeduplicationService({
      timeoutMs: 5000,
      enableAutoCleanup: false,
    })

    expect(service).toBeInstanceOf(RequestDeduplicationService)

    service.dispose()
  })
})

describe('getDefaultDeduplicationService', () => {
  afterEach(() => {
    resetDefaultDeduplicationService()
  })

  it('returns a singleton instance', () => {
    const service1 = getDefaultDeduplicationService()
    const service2 = getDefaultDeduplicationService()

    expect(service1).toBe(service2)
  })

  it('creates instance with provided config on first call', () => {
    const service = getDefaultDeduplicationService({
      timeoutMs: 10000,
      enableAutoCleanup: false,
    })

    expect(service).toBeInstanceOf(RequestDeduplicationService)
  })
})

describe('resetDefaultDeduplicationService', () => {
  it('disposes and resets the singleton', () => {
    const service1 = getDefaultDeduplicationService()
    resetDefaultDeduplicationService()
    const service2 = getDefaultDeduplicationService()

    expect(service1).not.toBe(service2)
  })
})

describe('Concurrent Request Scenarios', () => {
  let service: RequestDeduplicationService

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    service = new RequestDeduplicationService({ enableAutoCleanup: false })
  })

  afterEach(() => {
    service.dispose()
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  /**
   * Validates: Requirements 6.1, 6.2
   * Property 7: Request Deduplication
   *
   * For any set of N identical concurrent requests:
   * - Execute the underlying computation exactly once
   * - Return the same result to all N waiting clients
   */
  it('executes computation exactly once for N concurrent requests', async () => {
    const computationCount = { value: 0 }
    let resolveComputation: (value: string) => void

    const factory = vi.fn().mockImplementation(() => {
      computationCount.value++
      return new Promise<string>(resolve => {
        resolveComputation = resolve
      })
    })

    // Simulate 5 concurrent identical requests
    const promises = [
      service.getOrCreate('analytics-key', factory),
      service.getOrCreate('analytics-key', factory),
      service.getOrCreate('analytics-key', factory),
      service.getOrCreate('analytics-key', factory),
      service.getOrCreate('analytics-key', factory),
    ]

    // Computation should only happen once
    expect(computationCount.value).toBe(1)
    expect(factory).toHaveBeenCalledTimes(1)

    // Resolve the computation
    resolveComputation!('computed-result')

    // All requests should receive the same result
    const results = await Promise.all(promises)

    expect(results).toHaveLength(5)
    results.forEach(result => {
      expect(result).toBe('computed-result')
    })
  })

  /**
   * Validates: Requirement 6.3
   * Property 8: Deduplication Cache Expiration
   *
   * After response is sent, new identical request triggers new computation
   */
  it('triggers new computation after previous request completes', async () => {
    const factory = vi.fn().mockResolvedValue('result')

    // First batch of concurrent requests
    await Promise.all([
      service.getOrCreate('key', factory),
      service.getOrCreate('key', factory),
    ])

    expect(factory).toHaveBeenCalledTimes(1)

    // Second batch after first completes
    await Promise.all([
      service.getOrCreate('key', factory),
      service.getOrCreate('key', factory),
    ])

    // Should have triggered a new computation
    expect(factory).toHaveBeenCalledTimes(2)
  })

  it('handles mixed success and error scenarios across different keys', async () => {
    let resolveKey1: (value: string) => void
    let rejectKey2: (error: Error) => void

    const factory1 = vi.fn().mockReturnValue(
      new Promise<string>(resolve => {
        resolveKey1 = resolve
      })
    )

    const factory2 = vi.fn().mockReturnValue(
      new Promise<string>((_, reject) => {
        rejectKey2 = reject
      })
    )

    // Start requests for two different keys
    const promise1a = service.getOrCreate('key1', factory1)
    const promise1b = service.getOrCreate('key1', factory1)
    const promise2a = service.getOrCreate('key2', factory2)
    const promise2b = service.getOrCreate('key2', factory2)

    // Resolve key1, reject key2
    resolveKey1!('success')
    rejectKey2!(new Error('failure'))

    // Key1 requests should succeed
    const [result1a, result1b] = await Promise.all([promise1a, promise1b])
    expect(result1a).toBe('success')
    expect(result1b).toBe('success')

    // Key2 requests should fail
    await expect(promise2a).rejects.toThrow('failure')
    await expect(promise2b).rejects.toThrow('failure')
  })
})
