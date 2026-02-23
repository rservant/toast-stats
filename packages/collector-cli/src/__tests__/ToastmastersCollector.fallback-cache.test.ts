/**
 * Unit Tests for ToastmastersCollector Fallback Cache
 *
 * Verifies cache entry completeness, cache isolation between instances,
 * cache population on fallback success, cache hit/miss behavior, and
 * no cache modification on standard success.
 *
 * Converted from property-based tests — PBT generated random dates
 * and fallback params; replaced with representative fixed test cases.
 */

import { describe, it, expect } from 'vitest'
import { ToastmastersCollector } from '../services/ToastmastersCollector.js'

describe('ToastmastersCollector Fallback Cache', () => {
  // ---------- Cache entry completeness ----------

  describe('Cache entry completeness', () => {
    it.each([
      {
        date: '2024-01-15',
        params: {
          fallbackMonth: 12,
          fallbackYear: 2023,
          crossedProgramYearBoundary: false,
          actualDateString: '2023-12-15',
        },
      },
      {
        date: '2024-07-01',
        params: {
          fallbackMonth: 6,
          fallbackYear: 2024,
          crossedProgramYearBoundary: true,
          actualDateString: '2024-06-30',
        },
      },
      {
        date: '2025-12-28',
        params: {
          fallbackMonth: 11,
          fallbackYear: 2025,
          crossedProgramYearBoundary: false,
          actualDateString: '2025-11-28',
        },
      },
    ])(
      'should contain all required fields for date $date',
      async ({ date, params }) => {
        const collector = new ToastmastersCollector()

        collector.testCacheFallbackKnowledge(date, params)

        expect(collector.hasCachedFallback(date)).toBe(true)

        const cached = collector.getCachedFallbackInfo(date)
        expect(cached).toBeDefined()
        expect(cached!.requestedDate).toBe(date)
        expect(cached!.fallbackMonth).toBe(params.fallbackMonth)
        expect(cached!.fallbackMonth).toBeGreaterThanOrEqual(1)
        expect(cached!.fallbackMonth).toBeLessThanOrEqual(12)
        expect(cached!.crossedProgramYearBoundary).toBe(
          params.crossedProgramYearBoundary
        )
        expect(typeof cached!.crossedProgramYearBoundary).toBe('boolean')
        expect(cached!.actualDateString).toBe(params.actualDateString)
        expect(cached!.actualDateString.length).toBeGreaterThan(0)
        expect(cached!.fallbackYear).toBe(params.fallbackYear)
        expect(typeof cached!.cachedAt).toBe('number')
        expect(cached!.cachedAt).toBeGreaterThan(0)

        const metrics = collector.getFallbackMetrics()
        expect(metrics.fallbackDatesDiscovered).toBe(1)

        await collector.closeBrowser()
      }
    )

    it('should maintain integrity across multiple cache entries', async () => {
      const collector = new ToastmastersCollector()
      const entries = [
        {
          date: '2024-01-15',
          params: {
            fallbackMonth: 12,
            fallbackYear: 2023,
            crossedProgramYearBoundary: false,
            actualDateString: '2023-12-15',
          },
        },
        {
          date: '2024-06-20',
          params: {
            fallbackMonth: 5,
            fallbackYear: 2024,
            crossedProgramYearBoundary: false,
            actualDateString: '2024-05-20',
          },
        },
        {
          date: '2024-07-01',
          params: {
            fallbackMonth: 6,
            fallbackYear: 2024,
            crossedProgramYearBoundary: true,
            actualDateString: '2024-06-30',
          },
        },
      ]

      for (const { date, params } of entries) {
        collector.testCacheFallbackKnowledge(date, params)
      }

      for (const { date, params } of entries) {
        expect(collector.hasCachedFallback(date)).toBe(true)
        const cached = collector.getCachedFallbackInfo(date)
        expect(cached!.requestedDate).toBe(date)
        expect(cached!.fallbackMonth).toBe(params.fallbackMonth)
        expect(cached!.crossedProgramYearBoundary).toBe(
          params.crossedProgramYearBoundary
        )
        expect(cached!.actualDateString).toBe(params.actualDateString)
      }

      expect(collector.getFallbackMetrics().fallbackDatesDiscovered).toBe(3)
      await collector.closeBrowser()
    })
  })

  // ---------- Cache isolation ----------

  describe('Cache isolation between instances', () => {
    it('should have independent caches between instances', async () => {
      const collector1 = new ToastmastersCollector()
      const collector2 = new ToastmastersCollector()
      const dates = ['2024-01-15', '2024-02-20', '2024-03-25']

      for (const date of dates) {
        expect(collector1.hasCachedFallback(date)).toBe(false)
        expect(collector2.hasCachedFallback(date)).toBe(false)
      }

      const m1 = collector1.getFallbackMetrics()
      const m2 = collector2.getFallbackMetrics()
      expect(m1.cacheHits).toBe(0)
      expect(m2.cacheHits).toBe(0)

      // Metrics should be independent copies
      expect(collector1.getFallbackMetrics()).not.toBe(m1)
      expect(collector2.getFallbackMetrics()).not.toBe(m2)

      await collector1.closeBrowser()
      await collector2.closeBrowser()
    })
  })

  // ---------- getFallbackMetrics returns copy ----------

  describe('Metrics immutability', () => {
    it('should return independent copy of metrics', async () => {
      const collector = new ToastmastersCollector()

      const m1 = collector.getFallbackMetrics()
      const m2 = collector.getFallbackMetrics()

      expect(m1).toEqual(m2)
      expect(m1).not.toBe(m2)

      // Modifying returned copy should not affect internal state
      m1.cacheHits = 999
      m1.cacheMisses = 888
      m1.fallbackDatesDiscovered = 777

      const m3 = collector.getFallbackMetrics()
      expect(m3.cacheHits).toBe(0)
      expect(m3.cacheMisses).toBe(0)
      expect(m3.fallbackDatesDiscovered).toBe(0)

      await collector.closeBrowser()
    })
  })

  // ---------- New instance has empty cache ----------

  describe('New instance initialization', () => {
    it.each(['2024-01-15', '2024-07-01', '2025-12-28'])(
      'should return false for hasCachedFallback(%s) on new instance',
      async date => {
        const collector = new ToastmastersCollector()
        expect(collector.hasCachedFallback(date)).toBe(false)
        await collector.closeBrowser()
      }
    )
  })

  // ---------- Cache population on fallback success ----------

  describe('Cache population on fallback success', () => {
    it.each(['2024-01-15', '2024-07-01', '2025-03-10'])(
      'should populate cache when fallback succeeds for %s',
      async dateString => {
        const collector = new ToastmastersCollector()

        expect(collector.hasCachedFallback(dateString)).toBe(false)

        const result = collector.testSimulateNavigation(
          dateString,
          'fallback-success'
        )

        expect(result.cacheWasPopulated).toBe(true)
        expect(result.usedFallback).toBe(true)
        expect(result.usedCachedFallback).toBe(false)
        expect(result.success).toBe(true)

        expect(collector.hasCachedFallback(dateString)).toBe(true)

        const cached = collector.getCachedFallbackInfo(dateString)
        expect(cached).toBeDefined()
        expect(cached!.requestedDate).toBe(dateString)
        expect(cached!.fallbackMonth).toBeGreaterThanOrEqual(1)
        expect(cached!.fallbackMonth).toBeLessThanOrEqual(12)
        expect(typeof cached!.crossedProgramYearBoundary).toBe('boolean')
        expect(cached!.actualDateString.length).toBeGreaterThan(0)
        expect(typeof cached!.cachedAt).toBe('number')

        const metrics = collector.getFallbackMetrics()
        expect(metrics.fallbackDatesDiscovered).toBe(1)
        expect(metrics.cacheMisses).toBe(1)

        await collector.closeBrowser()
      }
    )
  })

  // ---------- Cache hit behavior ----------

  describe('Direct fallback on cache hit', () => {
    it('should use cached parameters directly on cache hit', async () => {
      const collector = new ToastmastersCollector()
      const date = '2024-06-15'
      const params = {
        fallbackMonth: 5,
        fallbackYear: 2024,
        crossedProgramYearBoundary: false,
        actualDateString: '2024-05-15',
      }

      collector.testCacheFallbackKnowledge(date, params)
      expect(collector.hasCachedFallback(date)).toBe(true)

      collector.testResetMetrics()

      const result = collector.testSimulateNavigation(date, 'standard-success')

      expect(result.usedCachedFallback).toBe(true)
      expect(result.usedFallback).toBe(true)
      expect(result.success).toBe(true)
      expect(result.cacheWasPopulated).toBe(false)

      const metrics = collector.getFallbackMetrics()
      expect(metrics.cacheHits).toBe(1)
      expect(metrics.cacheMisses).toBe(0)

      await collector.closeBrowser()
    })
  })

  // ---------- Cache miss behavior ----------

  describe('Standard navigation on cache miss', () => {
    it('should attempt standard navigation first when cache misses', async () => {
      const collector = new ToastmastersCollector()
      const date = '2024-06-15'

      expect(collector.hasCachedFallback(date)).toBe(false)

      const result = collector.testSimulateNavigation(date, 'standard-success')

      expect(result.usedCachedFallback).toBe(false)
      expect(result.usedFallback).toBe(false)
      expect(result.success).toBe(true)
      expect(result.cacheWasPopulated).toBe(false)

      expect(collector.getFallbackMetrics().cacheMisses).toBe(1)
      expect(collector.getFallbackMetrics().cacheHits).toBe(0)
      expect(collector.hasCachedFallback(date)).toBe(false)

      await collector.closeBrowser()
    })
  })

  // ---------- No cache modification on standard success ----------

  describe('No cache modification on standard success', () => {
    it('should not modify cache when standard navigation succeeds', async () => {
      const collector = new ToastmastersCollector()
      const existingDate = '2024-01-15'
      const navigateDate = '2024-06-15'
      const existingParams = {
        fallbackMonth: 12,
        fallbackYear: 2023,
        crossedProgramYearBoundary: false,
        actualDateString: '2023-12-15',
      }

      collector.testCacheFallbackKnowledge(existingDate, existingParams)
      const initialMetrics = collector.getFallbackMetrics()

      const result = collector.testSimulateNavigation(
        navigateDate,
        'standard-success'
      )

      expect(result.usedCachedFallback).toBe(false)
      expect(result.usedFallback).toBe(false)
      expect(result.cacheWasPopulated).toBe(false)

      // Navigated date NOT added to cache
      expect(collector.hasCachedFallback(navigateDate)).toBe(false)
      // Existing entry unchanged
      expect(collector.hasCachedFallback(existingDate)).toBe(true)

      const existing = collector.getCachedFallbackInfo(existingDate)
      expect(existing!.fallbackMonth).toBe(existingParams.fallbackMonth)
      expect(existing!.fallbackYear).toBe(existingParams.fallbackYear)

      const finalMetrics = collector.getFallbackMetrics()
      expect(finalMetrics.fallbackDatesDiscovered).toBe(
        initialMetrics.fallbackDatesDiscovered
      )
      expect(finalMetrics.cacheMisses).toBe(initialMetrics.cacheMisses + 1)

      await collector.closeBrowser()
    })
  })
})
