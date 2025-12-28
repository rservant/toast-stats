import { describe, it, expect, beforeEach } from 'vitest'
import { CacheService } from '../CacheService.ts'

describe('CacheService', () => {
  let cacheService: CacheService

  beforeEach(() => {
    cacheService = new CacheService({ ttl: 1 }) // 1 second TTL for testing
  })

  describe('set and get', () => {
    it('should store and retrieve string values', () => {
      const key = 'test-key'
      const value = 'test-value'

      const setResult = cacheService.set(key, value)
      expect(setResult).toBe(true)

      const retrieved = cacheService.get<string>(key)
      expect(retrieved).toBe(value)
    })

    it('should store and retrieve object values', () => {
      const key = 'test-object'
      const value = { name: 'Test', count: 42 }

      cacheService.set(key, value)
      const retrieved = cacheService.get<typeof value>(key)

      expect(retrieved).toEqual(value)
    })

    it('should store and retrieve array values', () => {
      const key = 'test-array'
      const value = [1, 2, 3, 4, 5]

      cacheService.set(key, value)
      const retrieved = cacheService.get<typeof value>(key)

      expect(retrieved).toEqual(value)
    })

    it('should return undefined for non-existent key', () => {
      const retrieved = cacheService.get('non-existent-key')
      expect(retrieved).toBeUndefined()
    })

    it('should respect custom TTL', async () => {
      const key = 'ttl-test'
      const value = 'expires-soon'

      cacheService.set(key, value, 0.1) // 100ms TTL

      // Should exist immediately
      expect(cacheService.get(key)).toBe(value)

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150))

      // Should be expired
      expect(cacheService.get(key)).toBeUndefined()
    })
  })

  describe('has', () => {
    it('should return true for existing key', () => {
      const key = 'exists'
      cacheService.set(key, 'value')

      expect(cacheService.has(key)).toBe(true)
    })

    it('should return false for non-existent key', () => {
      expect(cacheService.has('does-not-exist')).toBe(false)
    })
  })

  describe('invalidate', () => {
    it('should delete single cache entry', () => {
      const key = 'to-delete'
      cacheService.set(key, 'value')

      expect(cacheService.has(key)).toBe(true)

      const deleteCount = cacheService.invalidate(key)
      expect(deleteCount).toBe(1)
      expect(cacheService.has(key)).toBe(false)
    })

    it('should return 0 when deleting non-existent key', () => {
      const deleteCount = cacheService.invalidate('non-existent')
      expect(deleteCount).toBe(0)
    })
  })

  describe('invalidateMultiple', () => {
    it('should delete multiple cache entries', () => {
      cacheService.set('key1', 'value1')
      cacheService.set('key2', 'value2')
      cacheService.set('key3', 'value3')

      const deleteCount = cacheService.invalidateMultiple(['key1', 'key2'])
      expect(deleteCount).toBe(2)

      expect(cacheService.has('key1')).toBe(false)
      expect(cacheService.has('key2')).toBe(false)
      expect(cacheService.has('key3')).toBe(true)
    })
  })

  describe('clear', () => {
    it('should clear all cache entries', () => {
      cacheService.set('key1', 'value1')
      cacheService.set('key2', 'value2')
      cacheService.set('key3', 'value3')

      expect(cacheService.keys().length).toBe(3)

      cacheService.clear()

      expect(cacheService.keys().length).toBe(0)
      expect(cacheService.has('key1')).toBe(false)
      expect(cacheService.has('key2')).toBe(false)
      expect(cacheService.has('key3')).toBe(false)
    })
  })

  describe('keys', () => {
    it('should return all cache keys', () => {
      cacheService.set('key1', 'value1')
      cacheService.set('key2', 'value2')
      cacheService.set('key3', 'value3')

      const keys = cacheService.keys()
      expect(keys).toHaveLength(3)
      expect(keys).toContain('key1')
      expect(keys).toContain('key2')
      expect(keys).toContain('key3')
    })

    it('should return empty array when cache is empty', () => {
      const keys = cacheService.keys()
      expect(keys).toEqual([])
    })
  })

  describe('getStats', () => {
    it('should return cache statistics', () => {
      cacheService.set('key1', 'value1')
      cacheService.set('key2', 'value2')

      const stats = cacheService.getStats()

      expect(stats).toHaveProperty('keys')
      expect(stats).toHaveProperty('hits')
      expect(stats).toHaveProperty('misses')
      expect(stats.keys).toBe(2)
    })
  })
})
