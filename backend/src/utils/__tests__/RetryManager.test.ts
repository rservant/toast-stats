import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RetryManager } from '../RetryManager.js'

describe('RetryManager', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('executeWithRetry', () => {
    it('should succeed on first attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success')
      
      const result = await RetryManager.executeWithRetry(operation)
      
      expect(result.success).toBe(true)
      expect(result.result).toBe('success')
      expect(result.attempts).toBe(1)
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should retry on retryable errors', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('network timeout'))
        .mockResolvedValue('success')
      
      const promise = RetryManager.executeWithRetry(operation, {
        maxAttempts: 3,
        baseDelayMs: 1000
      })
      
      // Fast-forward through the delay
      await vi.advanceTimersByTimeAsync(1000)
      
      const result = await promise
      
      expect(result.success).toBe(true)
      expect(result.result).toBe('success')
      expect(result.attempts).toBe(2)
      expect(operation).toHaveBeenCalledTimes(2)
    })

    it('should not retry on non-retryable errors', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('400 Bad Request'))
      
      const result = await RetryManager.executeWithRetry(operation, {
        maxAttempts: 3,
        retryableErrors: (error) => !error.message.includes('400')
      })
      
      expect(result.success).toBe(false)
      expect(result.attempts).toBe(1)
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should fail after max attempts', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('network timeout'))
      
      const promise = RetryManager.executeWithRetry(operation, {
        maxAttempts: 2,
        baseDelayMs: 1000
      })
      
      // Fast-forward through the delay
      await vi.advanceTimersByTimeAsync(1000)
      
      const result = await promise
      
      expect(result.success).toBe(false)
      expect(result.attempts).toBe(2)
      expect(result.error?.message).toBe('network timeout')
      expect(operation).toHaveBeenCalledTimes(2)
    })

    it('should apply exponential backoff', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('network timeout'))
        .mockRejectedValueOnce(new Error('network timeout'))
        .mockResolvedValue('success')
      
      const promise = RetryManager.executeWithRetry(operation, {
        maxAttempts: 3,
        baseDelayMs: 1000,
        backoffMultiplier: 2
      })
      
      // First retry after 1000ms
      await vi.advanceTimersByTimeAsync(1000)
      // Second retry after 2000ms
      await vi.advanceTimersByTimeAsync(2000)
      
      const result = await promise
      
      expect(result.success).toBe(true)
      expect(result.attempts).toBe(3)
    })

    it('should respect max delay', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('network timeout'))
        .mockResolvedValue('success')
      
      const promise = RetryManager.executeWithRetry(operation, {
        maxAttempts: 2,
        baseDelayMs: 10000,
        maxDelayMs: 5000,
        backoffMultiplier: 2
      })
      
      // Should use maxDelayMs (5000) instead of calculated delay (10000)
      await vi.advanceTimersByTimeAsync(5000)
      
      const result = await promise
      
      expect(result.success).toBe(true)
      expect(result.attempts).toBe(2)
    })
  })

  describe('createRetryableFunction', () => {
    it('should create a retryable version of a function', async () => {
      const originalFunction = vi.fn()
        .mockRejectedValueOnce(new Error('network timeout'))
        .mockResolvedValue('success')
      
      const retryableFunction = RetryManager.createRetryableFunction(
        originalFunction,
        { maxAttempts: 2, baseDelayMs: 1000 }
      )
      
      const promise = retryableFunction('arg1', 'arg2')
      
      // Fast-forward through the delay
      await vi.advanceTimersByTimeAsync(1000)
      
      const result = await promise
      
      expect(result).toBe('success')
      expect(originalFunction).toHaveBeenCalledTimes(2)
      expect(originalFunction).toHaveBeenCalledWith('arg1', 'arg2')
    })

    it('should throw error if all retries fail', async () => {
      const originalFunction = vi.fn().mockRejectedValue(new Error('network timeout'))
      
      const retryableFunction = RetryManager.createRetryableFunction(
        originalFunction,
        { maxAttempts: 2, baseDelayMs: 1000 }
      )
      
      const promise = retryableFunction()
      
      // Fast-forward through the delay
      await vi.advanceTimersByTimeAsync(1000)
      
      try {
        await promise
        expect.fail('Expected promise to reject')
      } catch (_error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toBe('network timeout')
      }
    })
  })

  describe('getDashboardRetryOptions', () => {
    it('should return appropriate options for dashboard requests', () => {
      const options = RetryManager.getDashboardRetryOptions()
      
      expect(options.maxAttempts).toBe(3)
      expect(options.baseDelayMs).toBe(2000)
      expect(options.maxDelayMs).toBe(30000)
      expect(options.backoffMultiplier).toBe(2)
      expect(options.retryableErrors).toBeDefined()
    })

    it('should not retry on client errors', () => {
      const options = RetryManager.getDashboardRetryOptions()
      
      expect(options.retryableErrors!(new Error('400 Bad Request'))).toBe(false)
      expect(options.retryableErrors!(new Error('404 Not Found'))).toBe(false)
    })

    it('should retry on server errors and network issues', () => {
      const options = RetryManager.getDashboardRetryOptions()
      
      expect(options.retryableErrors!(new Error('500 Internal Server Error'))).toBe(true)
      expect(options.retryableErrors!(new Error('network timeout'))).toBe(true)
      expect(options.retryableErrors!(new Error('ECONNRESET'))).toBe(true)
    })
  })

  describe('getCacheRetryOptions', () => {
    it('should return appropriate options for cache operations', () => {
      const options = RetryManager.getCacheRetryOptions()
      
      expect(options.maxAttempts).toBe(2)
      expect(options.baseDelayMs).toBe(500)
      expect(options.maxDelayMs).toBe(5000)
      expect(options.retryableErrors).toBeDefined()
    })

    it('should retry on file system errors', () => {
      const options = RetryManager.getCacheRetryOptions()
      
      expect(options.retryableErrors!(new Error('ENOENT'))).toBe(true)
      expect(options.retryableErrors!(new Error('EACCES'))).toBe(true)
      expect(options.retryableErrors!(new Error('EBUSY'))).toBe(true)
    })
  })
})