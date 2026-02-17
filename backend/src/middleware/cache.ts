import { Request, Response, NextFunction } from 'express'
import { cacheService } from '../services/CacheService.js'
import { generateCacheKey } from '../utils/cacheKeys.js'

export interface CacheMiddlewareOptions {
  ttl?: number // Time to live in seconds
  keyGenerator?: (req: Request) => string // Custom key generator function
}

/**
 * Cache middleware for Express routes
 * Caches GET request responses and serves from cache when available
 * Supports cache bypass via query parameter or header
 */
export function cacheMiddleware(options: CacheMiddlewareOptions = {}) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next()
    }

    // Check for cache bypass mechanisms
    const bypassCache =
      req.query['refresh'] === 'true' ||
      req.query['bypass_cache'] === 'true' ||
      req.headers['x-bypass-cache'] === 'true'

    if (bypassCache) {
      // Skip cache and continue to route handler
      return next()
    }

    // Generate cache key
    const cacheKey = options.keyGenerator
      ? options.keyGenerator(req)
      : generateCacheKey(req.path, {
        ...req.query,
        ...req.params,
      })

    // Try to get cached response
    const cachedResponse = cacheService.get<object>(cacheKey)

    if (cachedResponse !== undefined) {
      // Serve from cache
      return res.json(cachedResponse)
    }

    // Store original res.json function
    const originalJson = res.json.bind(res)

    // Override res.json to cache the response
    res.json = function (body: unknown) {
      // Only cache successful responses (2xx status codes)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const ttl = options.ttl
        cacheService.set(cacheKey, body as object, ttl)
      }

      // Call original json function
      return originalJson(body)
    }

    // Continue to route handler
    next()
  }
}

/**
 * Middleware to invalidate cache for specific patterns
 * Useful for POST, PUT, DELETE requests that modify data
 */
export function invalidateCacheMiddleware(
  keyPattern: string | ((req: Request) => string)
) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Store original res.json function
    const originalJson = res.json.bind(res)

    // Override res.json to invalidate cache after successful response
    res.json = function (body: unknown) {
      // Only invalidate on successful responses (2xx status codes)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const pattern =
          typeof keyPattern === 'function' ? keyPattern(req) : keyPattern

        // Get all cache keys
        const allKeys = cacheService.keys()

        // Find keys matching the pattern
        const keysToInvalidate = allKeys.filter(key => {
          // Simple wildcard matching: escape regex metacharacters, then expand * and ?
          const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          const regexPattern = escapedPattern
            .replace(/\\\*/g, '.*') // * => any sequence of characters
            .replace(/\\\?/g, '.') // ? => any single character
            .replace(/\//g, '\\/')
          const regex = new RegExp(`^${regexPattern}$`)
          return regex.test(key)
        })

        // Invalidate matching keys
        if (keysToInvalidate.length > 0) {
          cacheService.invalidateMultiple(keysToInvalidate)
        }
      }

      // Call original json function
      return originalJson(body)
    }

    next()
  }
}

/**
 * Middleware to clear all cache on logout
 */
export function clearCacheOnLogout() {
  return (_req: Request, res: Response, next: NextFunction) => {
    // Store original res.json function
    const originalJson = res.json.bind(res)

    // Override res.json to clear cache after successful logout
    res.json = function (body: unknown) {
      // Only clear cache on successful logout (2xx status codes)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cacheService.clear()
      }

      // Call original json function
      return originalJson(body)
    }

    next()
  }
}
