import { LRUCache } from 'lru-cache'

export interface CacheOptions {
  ttl?: number // Time to live in seconds
  maxEntries?: number // Maximum number of entries (default: 1000)
}

/**
 * Non-null cache value type (lru-cache requires values extend {})
 */
type CacheValue = object | string | number | boolean

export class CacheService {
  private cache: LRUCache<string, CacheValue>
  private defaultTTL: number
  private hits = 0
  private misses = 0

  constructor(options: CacheOptions = {}) {
    // Default TTL is 15 minutes (900 seconds)
    this.defaultTTL = options.ttl || 900

    // Initialize lru-cache with configuration
    this.cache = new LRUCache<string, CacheValue>({
      max: options.maxEntries || 1000,
      ttl: this.defaultTTL * 1000, // Convert seconds to milliseconds
    })
  }

  /**
   * Get value from cache by key
   * @param key Cache key
   * @returns Cached value or undefined if not found or expired
   */
  get<T extends CacheValue>(key: string): T | undefined {
    const value = this.cache.get(key)
    if (value !== undefined) {
      this.hits++
      return value as T
    }
    this.misses++
    return undefined
  }

  /**
   * Set value in cache with optional TTL
   * @param key Cache key
   * @param value Value to cache
   * @param ttl Optional time to live in seconds (defaults to 15 minutes)
   * @returns true if successful
   */
  set<T extends CacheValue>(key: string, value: T, ttl?: number): boolean {
    const timeToLive = ttl !== undefined ? ttl : this.defaultTTL
    this.cache.set(key, value, { ttl: timeToLive * 1000 })
    return true
  }

  /**
   * Invalidate (delete) a specific cache entry
   * @param key Cache key to invalidate
   * @returns Number of deleted entries (0 or 1)
   */
  invalidate(key: string): number {
    return this.cache.delete(key) ? 1 : 0
  }

  /**
   * Invalidate multiple cache entries by keys
   * @param keys Array of cache keys to invalidate
   * @returns Number of deleted entries
   */
  invalidateMultiple(keys: string[]): number {
    let deleted = 0
    for (const key of keys) {
      if (this.cache.delete(key)) deleted++
    }
    return deleted
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Check if a key exists in cache
   * @param key Cache key
   * @returns true if key exists
   */
  has(key: string): boolean {
    return this.cache.has(key)
  }

  /**
   * Get all cache keys
   * @returns Array of all cache keys
   */
  keys(): string[] {
    return [...this.cache.keys()]
  }

  /**
   * Get cache statistics
   * @returns Cache statistics object
   */
  getStats(): { hits: number; misses: number; keys: number; size: number } {
    return {
      hits: this.hits,
      misses: this.misses,
      keys: this.cache.size,
      size: this.cache.size,
    }
  }
}

// Export singleton instance
export const cacheService = new CacheService()
