import NodeCache from 'node-cache'

export interface CacheOptions {
  ttl?: number // Time to live in seconds
  checkperiod?: number // Period in seconds for automatic delete check
}

export class CacheService {
  private cache: NodeCache
  private defaultTTL: number

  constructor(options: CacheOptions = {}) {
    // Default TTL is 15 minutes (900 seconds)
    this.defaultTTL = options.ttl || 900

    // Initialize node-cache with configuration
    this.cache = new NodeCache({
      stdTTL: this.defaultTTL,
      checkperiod: options.checkperiod || 120, // Check for expired keys every 2 minutes
      useClones: false, // Don't clone objects for better performance
    })
  }

  /**
   * Get value from cache by key
   * @param key Cache key
   * @returns Cached value or undefined if not found or expired
   */
  get<T>(key: string): T | undefined {
    return this.cache.get<T>(key)
  }

  /**
   * Set value in cache with optional TTL
   * @param key Cache key
   * @param value Value to cache
   * @param ttl Optional time to live in seconds (defaults to 15 minutes)
   * @returns true if successful
   */
  set<T>(key: string, value: T, ttl?: number): boolean {
    const timeToLive = ttl !== undefined ? ttl : this.defaultTTL
    return this.cache.set(key, value, timeToLive)
  }

  /**
   * Invalidate (delete) a specific cache entry
   * @param key Cache key to invalidate
   * @returns Number of deleted entries (0 or 1)
   */
  invalidate(key: string): number {
    return this.cache.del(key)
  }

  /**
   * Invalidate multiple cache entries by keys
   * @param keys Array of cache keys to invalidate
   * @returns Number of deleted entries
   */
  invalidateMultiple(keys: string[]): number {
    return this.cache.del(keys)
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.flushAll()
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
    return this.cache.keys()
  }

  /**
   * Get cache statistics
   * @returns Cache statistics object
   */
  getStats() {
    return this.cache.getStats()
  }
}

// Export singleton instance
export const cacheService = new CacheService()
