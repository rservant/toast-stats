/**
 * CDN Cache Monitor Hook (#224)
 *
 * Tracks CDN cache HIT/MISS ratios from fetch response headers.
 * Logs to console in development mode; no-op in production.
 *
 * Monitors headers: x-cache, cf-cache-status, x-goog-cache-control
 */

import { useRef, useCallback } from 'react'

export interface CacheStats {
  hits: number
  misses: number
  total: number
  hitRatio: number
}

/**
 * Parse cache status from common CDN response headers.
 * Returns 'hit', 'miss', or null if no cache header found.
 */
export function parseCacheStatus(headers: Headers): 'hit' | 'miss' | null {
  // Check common CDN cache headers in priority order
  const xCache = headers.get('x-cache')
  if (xCache) {
    return xCache.toLowerCase().includes('hit') ? 'hit' : 'miss'
  }

  const cfCache = headers.get('cf-cache-status')
  if (cfCache) {
    const status = cfCache.toLowerCase()
    return status === 'hit' || status === 'revalidated' ? 'hit' : 'miss'
  }

  const googCache = headers.get('x-goog-cache-control')
  if (googCache) {
    return googCache.toLowerCase().includes('hit') ? 'hit' : 'miss'
  }

  return null
}

/**
 * Hook that tracks CDN cache effectiveness.
 *
 * Call `recordResponse(response)` after each fetch to track cache stats.
 * Call `getStats()` to retrieve aggregate HIT/MISS ratio.
 *
 * In development, logs warnings when MISS ratio exceeds 50%.
 */
export function useCdnCacheMonitor() {
  const hitsRef = useRef(0)
  const missesRef = useRef(0)

  const recordResponse = useCallback((response: Response) => {
    const status = parseCacheStatus(response.headers)
    if (status === null) return

    if (status === 'hit') {
      hitsRef.current++
    } else {
      missesRef.current++
    }

    // Dev-only: warn when MISS ratio exceeds 50%
    if (import.meta.env.DEV) {
      const total = hitsRef.current + missesRef.current
      if (total >= 5) {
        const missRatio = missesRef.current / total
        if (missRatio > 0.5) {
          console.warn(
            `[CDN Cache] High MISS ratio: ${(missRatio * 100).toFixed(0)}% (${missesRef.current}/${total})`
          )
        }
      }
    }
  }, [])

  const getStats = useCallback((): CacheStats => {
    const total = hitsRef.current + missesRef.current
    return {
      hits: hitsRef.current,
      misses: missesRef.current,
      total,
      hitRatio: total > 0 ? hitsRef.current / total : 0,
    }
  }, [])

  const reset = useCallback(() => {
    hitsRef.current = 0
    missesRef.current = 0
  }, [])

  return { recordResponse, getStats, reset }
}
