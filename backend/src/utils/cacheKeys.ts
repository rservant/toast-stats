import crypto from 'crypto'

/**
 * Generate a cache key based on endpoint and parameters
 * @param endpoint API endpoint path
 * @param params Optional parameters object
 * @returns Cache key string
 */
export function generateCacheKey(
  endpoint: string,
  params?: Record<string, any>
): string {
  // Start with the endpoint
  let key = `cache:${endpoint}`

  // If parameters exist, create a deterministic hash
  if (params && Object.keys(params).length > 0) {
    // Sort keys to ensure consistent ordering
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        acc[key] = params[key]
        return acc
      }, {} as Record<string, any>)

    // Create hash of parameters
    const paramsString = JSON.stringify(sortedParams)
    const hash = crypto.createHash('md5').update(paramsString).digest('hex')

    key += `:${hash}`
  }

  return key
}

/**
 * Generate cache key for district-related endpoints
 * @param districtId District identifier
 * @param endpoint Endpoint name
 * @param params Optional parameters
 * @returns Cache key string
 */
export function generateDistrictCacheKey(
  districtId: string,
  endpoint: string,
  params?: Record<string, any>
): string {
  return generateCacheKey(`/districts/${districtId}/${endpoint}`, params)
}

/**
 * Generate cache key pattern for invalidating multiple related keys
 * @param pattern Pattern to match (e.g., 'districts/123/*')
 * @returns Cache key pattern string
 */
export function generateCacheKeyPattern(pattern: string): string {
  return `cache:${pattern}`
}

/**
 * Extract district ID from cache key
 * @param key Cache key
 * @returns District ID or null if not found
 */
export function extractDistrictIdFromKey(key: string): string | null {
  const match = key.match(/cache:\/districts\/([^/]+)/)
  return match ? match[1] : null
}

/**
 * Check if cache key matches pattern
 * @param key Cache key to check
 * @param pattern Pattern to match against
 * @returns true if key matches pattern
 */
export function matchesCacheKeyPattern(key: string, pattern: string): boolean {
  // Convert pattern to regex (simple wildcard support)
  const regexPattern = pattern
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')
    .replace(/\//g, '\\/')

  const regex = new RegExp(`^${regexPattern}$`)
  return regex.test(key)
}
