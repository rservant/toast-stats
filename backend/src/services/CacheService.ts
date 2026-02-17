import { LRUCache } from 'lru-cache'

export interface CacheOptions {
  ttl?: number // Time to live in seconds (default: 900 = 15 minutes)
  max?: number // Maximum number of entries (default: 1000)
  maxSize?: number // Maximum total size in bytes (default: 50MB)
}

// Type alias that satisfies lru-cache's non-nullable value constraint
type CacheValue = object | string | number | boolean

export class CacheService {
  private cache: LRUCache<string, CacheValue>
  private defaultTTL: number
  private hits: number = 0
  private misses: number = 0

  constructor(options: CacheOptions = {}) {
    this.defaultTTL = options.ttl ?? 900

    this.cache = new LRUCache<string, CacheValue>({
      max: options.max ?? 1000,
      maxSize: options.maxSize ?? 50 * 1024 * 1024,
      sizeCalculation: (value: unknown): number => {
        try {
          return JSON.stringify(value).length
        } catch {
          return 1024 // 1KB fallback for non-serializable values
        }
      },
      ttl: this.defaultTTL * 1000, // Convert seconds to milliseconds
      updateAgeOnGet: true,
      allowStale: false,
    })
  }

  /**
   * Get value from cache by key
   * @param key Cache key
   * @returns Cached value or undefined if not found or expired
   */
  get<T extends CacheValue>(key: string): T | undefined {
    const value = this.cache.get(key) as T | undefined
    if (value !== undefined) {
      this.hits++
    } else {
      this.misses++
    }
    return value
  }

  /**
   * Set value in cache with optional TTL
   * @param key Cache key
   * @param value Value to cache
   * @param ttl Optional time to live in seconds (defaults to 15 minutes)
   * @returns true if successful
   */
  set<T extends CacheValue>(key: string, value: T, ttl?: number): boolean {
    const options = ttl !== undefined ? { ttl: ttl * 1000 } : undefined
    this.cache.set(key, value, options)
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
    return keys.reduce((count, key) => count + this.invalidate(key), 0)
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
  getStats(): {
    hits: number
    misses: number
    keys: number
    size: number
    maxEntries: number
    maxSize: number
  } {
    return {
      hits: this.hits,
      misses: this.misses,
      keys: this.cache.size,
      size: this.cache.calculatedSize ?? 0,
      maxEntries: this.cache.max,
      maxSize: this.cache.maxSize,
    }
  }
}

// Export singleton instance
export const cacheService = new CacheService()
