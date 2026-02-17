import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { CacheService } from '../CacheService'

describe('CacheService Property-Based Tests', () => {
  describe('Property 1: Cache Round-Trip Consistency', () => {
    it('set then get returns equivalent value for JSON-serializable data', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.oneof(
            fc.string(),
            fc.integer(),
            fc.boolean(),
            fc.dictionary(
              fc.string({ minLength: 1, maxLength: 10 }),
              fc.string()
            )
          ),
          (key, value) => {
            const cache = new CacheService({
              max: 100,
              maxSize: 10 * 1024 * 1024,
            })
            cache.set(key, value)
            const retrieved = cache.get(key)
            expect(retrieved).toEqual(value)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Property 2: Entry Limit Enforcement', () => {
    it('cache never exceeds max entry count', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 20 }),
          fc.integer({ min: 1, max: 30 }),
          (maxEntries, totalInserts) => {
            const cache = new CacheService({
              max: maxEntries,
              maxSize: 100 * 1024 * 1024, // Large enough to not be the limiting factor
            })

            for (let i = 0; i < totalInserts; i++) {
              cache.set(`key-${i}`, `value-${i}`)
            }

            const stats = cache.getStats()
            expect(stats.keys).toBeLessThanOrEqual(maxEntries)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Property 3: Size Limit Enforcement', () => {
    it('total calculated size never exceeds maxSize', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 5000 }),
          fc.array(
            fc.record({
              key: fc.string({ minLength: 1, maxLength: 20 }),
              value: fc.string({ minLength: 1, maxLength: 200 }),
            }),
            { minLength: 1, maxLength: 50 }
          ),
          (maxSize, entries) => {
            const cache = new CacheService({
              max: 1000,
              maxSize,
            })

            for (const entry of entries) {
              cache.set(entry.key, entry.value)
            }

            const stats = cache.getStats()
            expect(stats.size).toBeLessThanOrEqual(maxSize)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Property 4: LRU Access Ordering', () => {
    it('accessed entry survives eviction when new entries are added', () => {
      fc.assert(
        fc.property(fc.integer({ min: 3, max: 10 }), maxEntries => {
          const cache = new CacheService({
            max: maxEntries,
            maxSize: 100 * 1024 * 1024,
          })

          // Fill cache to capacity
          for (let i = 0; i < maxEntries; i++) {
            cache.set(`key-${i}`, `value-${i}`)
          }

          // Access the first entry (making it recently used)
          const accessed = cache.get('key-0')
          expect(accessed).toBe('value-0')

          // Add new entries to trigger eviction
          cache.set('new-key', 'new-value')

          // The accessed entry should still be present (LRU protects it)
          expect(cache.has('key-0')).toBe(true)
          // The second entry (least recently used) should have been evicted
          expect(cache.has('key-1')).toBe(false)
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('Property 5: Statistics Accuracy', () => {
    it('hits + misses equals total get calls', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              action: fc.constantFrom('set', 'get') as fc.Arbitrary<
                'set' | 'get'
              >,
              key: fc.constantFrom('a', 'b', 'c', 'd', 'e'),
              value: fc.string({ minLength: 1, maxLength: 10 }),
            }),
            { minLength: 1, maxLength: 50 }
          ),
          operations => {
            const cache = new CacheService({
              max: 100,
              maxSize: 10 * 1024 * 1024,
            })
            let getCalls = 0

            for (const op of operations) {
              if (op.action === 'set') {
                cache.set(op.key, op.value)
              } else {
                cache.get(op.key)
                getCalls++
              }
            }

            const stats = cache.getStats()
            expect(stats.hits + stats.misses).toBe(getCalls)
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
