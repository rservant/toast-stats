/**
 * Performance Optimizations Test Suite
 *
 * Tests for the performance optimization utilities:
 * - RateLimiter (Requirement 9.1)
 * - ConcurrencyLimiter (Requirement 9.2)
 * - IntermediateCache (Requirement 9.3)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { RateLimiter, RateLimiterManager } from '../RateLimiter.js'
import {
  ConcurrencyLimiter,
  ConcurrencyLimiterManager,
} from '../ConcurrencyLimiter.js'
import {
  IntermediateCache,
  IntermediateCacheManager,
} from '../IntermediateCache.js'

describe('Performance Optimizations', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    // Clean up managers
    RateLimiterManager.resetAll()
    ConcurrencyLimiterManager.clearAllQueues()
    IntermediateCacheManager.destroyAll()
  })

  describe('RateLimiter (Requirement 9.1)', () => {
    it('should allow requests within rate limit', async () => {
      const rateLimiter = new RateLimiter({
        maxRequests: 5,
        windowMs: 60000, // 1 minute
        minDelayMs: 100,
      })

      // First request should be allowed
      const result1 = rateLimiter.checkRequest()
      expect(result1.allowed).toBe(true)
      expect(result1.currentCount).toBe(0)

      rateLimiter.consumeToken()

      // Second request should be allowed
      const result2 = rateLimiter.checkRequest()
      expect(result2.allowed).toBe(true)
      expect(result2.currentCount).toBe(1)
    })

    it('should deny requests when rate limit exceeded', async () => {
      const rateLimiter = new RateLimiter({
        maxRequests: 2,
        windowMs: 60000,
        minDelayMs: 1000,
      })

      // Consume all tokens
      rateLimiter.consumeToken()
      rateLimiter.consumeToken()

      // Next request should be denied
      const result = rateLimiter.checkRequest()
      expect(result.allowed).toBe(false)
      expect(result.delayMs).toBeGreaterThan(0)
    })

    it('should execute function with rate limiting', async () => {
      const rateLimiter = new RateLimiter({
        maxRequests: 10,
        windowMs: 60000,
        minDelayMs: 50,
      })

      const mockFn = vi.fn().mockResolvedValue('success')

      const result = await rateLimiter.execute(mockFn)

      expect(result).toBe('success')
      expect(mockFn).toHaveBeenCalledOnce()
    })
  })

  describe('ConcurrencyLimiter (Requirement 9.2)', () => {
    it('should allow concurrent operations within limit', async () => {
      const limiter = new ConcurrencyLimiter({
        maxConcurrent: 3,
        timeoutMs: 5000,
      })

      const slot1 = await limiter.acquire({ operation: 'test1' })
      const slot2 = await limiter.acquire({ operation: 'test2' })
      const slot3 = await limiter.acquire({ operation: 'test3' })

      expect(slot1.id).toBeDefined()
      expect(slot2.id).toBeDefined()
      expect(slot3.id).toBeDefined()

      const status = limiter.getStatus()
      expect(status.active).toBe(3)
      expect(status.maxConcurrent).toBe(3)

      // Clean up
      limiter.release(slot1)
      limiter.release(slot2)
      limiter.release(slot3)
    })

    it('should queue operations when at capacity', async () => {
      const limiter = new ConcurrencyLimiter({
        maxConcurrent: 2,
        timeoutMs: 5000,
      })

      // Fill capacity
      const slot1 = await limiter.acquire()
      const slot2 = await limiter.acquire()

      expect(limiter.isAtCapacity()).toBe(true)

      // This should be queued
      const slot3Promise = limiter.acquire()

      // Advance timers to allow queuing
      await vi.advanceTimersByTimeAsync(10)

      const status = limiter.getStatus()
      expect(status.active).toBe(2)
      expect(status.queued).toBe(1)

      // Release one slot to allow queued operation
      limiter.release(slot1)

      const slot3 = await slot3Promise
      expect(slot3.id).toBeDefined()

      // Clean up
      limiter.release(slot2)
      limiter.release(slot3)
    })

    it('should execute function with concurrency control', async () => {
      const limiter = new ConcurrencyLimiter({
        maxConcurrent: 2,
        timeoutMs: 5000,
      })

      const mockFn = vi.fn().mockImplementation(async slot => {
        expect(slot.id).toBeDefined()
        return 'success'
      })

      const result = await limiter.execute(mockFn, { test: true })

      expect(result).toBe('success')
      expect(mockFn).toHaveBeenCalledOnce()
    })

    it('should process ALL functions in executeAllSettled even when count exceeds maxConcurrent + queueLimit', async () => {
      // This test protects against a bug where executeAllSettled would silently drop
      // functions beyond (maxConcurrent + queueLimit) because all promises were created
      // upfront, causing "queue limit exceeded" errors for excess functions.
      //
      // With maxConcurrent=3 and queueLimit=5, only 8 functions could be processed.
      // A backfill of 67 dates would silently drop 59 dates.

      vi.useRealTimers() // Need real timers for async processing

      const limiter = new ConcurrencyLimiter({
        maxConcurrent: 3,
        queueLimit: 5,
        timeoutMs: 30000,
      })

      const totalFunctions = 20 // More than maxConcurrent + queueLimit (8)
      const executionOrder: number[] = []

      const functions = Array.from({ length: totalFunctions }, (_, index) => {
        return async () => {
          executionOrder.push(index)
          // Small delay to simulate work
          await new Promise(resolve => setTimeout(resolve, 5))
          return index
        }
      })

      const results = await limiter.executeAllSettled(functions)

      // ALL functions must complete - this is the critical assertion
      expect(results).toHaveLength(totalFunctions)

      // All should be fulfilled (none rejected due to queue overflow)
      const fulfilled = results.filter(r => r.status === 'fulfilled')
      const rejected = results.filter(r => r.status === 'rejected')

      expect(fulfilled).toHaveLength(totalFunctions)
      expect(rejected).toHaveLength(0)

      // Verify all indices were processed
      expect(executionOrder.sort((a, b) => a - b)).toEqual(
        Array.from({ length: totalFunctions }, (_, i) => i)
      )

      // Verify results contain correct values
      const values = fulfilled.map(r => (r as PromiseFulfilledResult<number>).value)
      expect(values.sort((a, b) => a - b)).toEqual(
        Array.from({ length: totalFunctions }, (_, i) => i)
      )
    })

    it('should reject with queue limit error when using acquire() directly beyond capacity', async () => {
      // This test documents the expected behavior of acquire() - it SHOULD throw
      // when queue limit is exceeded. The fix is in executeAllSettled which must
      // batch function calls to avoid triggering this error.

      const limiter = new ConcurrencyLimiter({
        maxConcurrent: 2,
        queueLimit: 2,
        timeoutMs: 5000,
      })

      // Fill all slots and queue
      const slot1 = await limiter.acquire()
      const slot2 = await limiter.acquire()
      void limiter.acquire() // queued (intentionally not awaited)
      void limiter.acquire() // queued (intentionally not awaited)

      // Next acquire should throw - queue is full
      await expect(limiter.acquire()).rejects.toThrow('Concurrency queue limit exceeded')

      // Clean up
      limiter.release(slot1)
      limiter.release(slot2)
    })
  })

  describe('IntermediateCache (Requirement 9.3)', () => {
    it('should cache and retrieve values', () => {
      const cache = new IntermediateCache<string>({
        defaultTtlMs: 60000,
        maxEntries: 100,
      })

      // Set a value
      cache.set('key1', 'value1')

      // Retrieve the value
      const retrieved = cache.get('key1')
      expect(retrieved).toBe('value1')

      // Check stats
      const stats = cache.getStats()
      expect(stats.totalEntries).toBe(1)
      expect(stats.hits).toBe(1)
      expect(stats.misses).toBe(0)
    })

    it('should handle cache misses', () => {
      const cache = new IntermediateCache<string>()

      const result = cache.get('nonexistent')
      expect(result).toBeNull()

      const stats = cache.getStats()
      expect(stats.hits).toBe(0)
      expect(stats.misses).toBe(1)
    })

    it('should expire entries based on TTL', () => {
      const cache = new IntermediateCache<string>()

      // Set with 1 second TTL
      cache.set('key1', 'value1', 1000)

      // Should be available immediately
      expect(cache.get('key1')).toBe('value1')

      // Advance time past TTL
      vi.advanceTimersByTime(1500)

      // Should be expired
      expect(cache.get('key1')).toBeNull()
    })

    it('should compute and cache values', async () => {
      const cache = new IntermediateCache<string>()
      const computeFn = vi.fn().mockResolvedValue('computed-value')

      // First call should compute
      const result1 = await cache.getOrCompute('key1', computeFn)
      expect(result1).toBe('computed-value')
      expect(computeFn).toHaveBeenCalledOnce()

      // Second call should use cache
      const result2 = await cache.getOrCompute('key1', computeFn)
      expect(result2).toBe('computed-value')
      expect(computeFn).toHaveBeenCalledOnce() // Still only called once
    })

    it('should evict entries when size limit exceeded', () => {
      const cache = new IntermediateCache<string>({
        maxEntries: 2,
        useLruEviction: true,
      })

      // Add entries up to limit
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')

      expect(cache.getStats().totalEntries).toBe(2)

      // Add one more to trigger eviction
      cache.set('key3', 'value3')

      const stats = cache.getStats()
      expect(stats.totalEntries).toBe(2)
      expect(stats.evicted).toBe(1)
    })
  })

  describe('Manager Classes', () => {
    it('should manage multiple rate limiters', () => {
      const limiter1 = RateLimiterManager.getRateLimiter('service1', {
        maxRequests: 10,
        windowMs: 60000,
      })

      const limiter2 = RateLimiterManager.getRateLimiter('service2', {
        maxRequests: 5,
        windowMs: 30000,
      })

      expect(limiter1).toBeDefined()
      expect(limiter2).toBeDefined()
      expect(limiter1).not.toBe(limiter2)

      const allStatus = RateLimiterManager.getAllStatus()
      expect(Object.keys(allStatus)).toHaveLength(2)
      expect(allStatus.service1).toBeDefined()
      expect(allStatus.service2).toBeDefined()
    })

    it('should manage multiple concurrency limiters', () => {
      const limiter1 = ConcurrencyLimiterManager.getLimiter('service1', {
        maxConcurrent: 3,
      })

      const limiter2 = ConcurrencyLimiterManager.getLimiter('service2', {
        maxConcurrent: 5,
      })

      expect(limiter1).toBeDefined()
      expect(limiter2).toBeDefined()
      expect(limiter1).not.toBe(limiter2)

      const allStatus = ConcurrencyLimiterManager.getAllStatus()
      expect(Object.keys(allStatus)).toHaveLength(2)
    })

    it('should manage multiple caches', () => {
      const cache1 = IntermediateCacheManager.getCache('cache1', {
        maxEntries: 100,
      })

      const cache2 = IntermediateCacheManager.getCache('cache2', {
        maxEntries: 200,
      })

      expect(cache1).toBeDefined()
      expect(cache2).toBeDefined()
      expect(cache1).not.toBe(cache2)

      cache1.set('key1', 'value1')
      cache2.set('key2', 'value2')

      const allStats = IntermediateCacheManager.getAllStats()
      expect(Object.keys(allStats)).toHaveLength(2)
      expect(allStats.cache1.totalEntries).toBe(1)
      expect(allStats.cache2.totalEntries).toBe(1)
    })
  })
})
