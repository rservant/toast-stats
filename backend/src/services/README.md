# Cache Service Documentation

## Overview

The CacheService provides in-memory caching functionality using the `node-cache` library to improve application performance by reducing redundant API calls to the Toastmasters dashboard.

## Features

- **15-minute default TTL**: Cached data expires after 15 minutes by default
- **Flexible TTL**: Custom TTL can be specified per cache entry
- **Cache bypass**: Support for refresh requests that bypass the cache
- **Automatic cleanup**: Expired entries are automatically removed
- **Cache invalidation**: Individual or bulk cache entry removal
- **Express middleware**: Easy integration with Express routes

## Usage

### Basic Cache Operations

```typescript
import { cacheService } from '../services/CacheService.js'

// Set a value in cache
cacheService.set('my-key', { data: 'value' })

// Set with custom TTL (5 minutes)
cacheService.set('my-key', { data: 'value' }, 300)

// Get a value from cache
const data = cacheService.get('my-key')

// Check if key exists
if (cacheService.has('my-key')) {
  // Key exists
}

// Invalidate a single key
cacheService.invalidate('my-key')

// Invalidate multiple keys
cacheService.invalidateMultiple(['key1', 'key2'])

// Clear all cache
cacheService.clear()
```

### Cache Middleware

The cache middleware automatically caches GET request responses:

```typescript
import { Router } from 'express'
import { cacheMiddleware } from '../middleware/cache.js'

const router = Router()

// Basic usage with default 15-minute TTL
router.get('/data', cacheMiddleware(), async (req, res) => {
  const data = await fetchData()
  res.json(data)
})

// Custom TTL (5 minutes)
router.get('/data', cacheMiddleware({ ttl: 300 }), async (req, res) => {
  const data = await fetchData()
  res.json(data)
})

// Custom cache key generator
router.get(
  '/districts/:id',
  cacheMiddleware({
    keyGenerator: (req) => `district:${req.params.id}`,
  }),
  async (req, res) => {
    const data = await fetchDistrictData(req.params.id)
    res.json(data)
  }
)
```

### Cache Bypass

Users can bypass the cache using query parameters or headers:

```bash
# Using query parameter
GET /api/districts?refresh=true
GET /api/districts?bypass_cache=true

# Using header
GET /api/districts
X-Bypass-Cache: true
```

### Cache Key Generation

Use the utility functions to generate consistent cache keys:

```typescript
import { generateCacheKey, generateDistrictCacheKey } from '../utils/cacheKeys.js'

// Basic cache key
const key1 = generateCacheKey('/api/districts')
// Result: "cache:/api/districts"

// Cache key with parameters
const key2 = generateCacheKey('/api/districts', { region: 'west', active: true })
// Result: "cache:/api/districts:abc123..." (with MD5 hash of params)

// District-specific cache key
const key3 = generateDistrictCacheKey('123', 'statistics')
// Result: "cache:/districts/123/statistics"

// With parameters
const key4 = generateDistrictCacheKey('123', 'clubs', { status: 'active' })
// Result: "cache:/districts/123/clubs:def456..."
```

### Cache Invalidation Middleware

Automatically invalidate cache entries when data is modified:

```typescript
import { invalidateCacheMiddleware } from '../middleware/cache.js'

// Invalidate all district cache entries when district is updated
router.put(
  '/districts/:id',
  invalidateCacheMiddleware('cache:/districts/*'),
  async (req, res) => {
    await updateDistrict(req.params.id, req.body)
    res.json({ success: true })
  }
)

// Dynamic pattern based on request
router.put(
  '/districts/:id/clubs/:clubId',
  invalidateCacheMiddleware((req) => `cache:/districts/${req.params.id}/*`),
  async (req, res) => {
    await updateClub(req.params.id, req.params.clubId, req.body)
    res.json({ success: true })
  }
)
```

### Clear Cache on Logout

The `clearCacheOnLogout` middleware automatically clears all cache when a user logs out:

```typescript
import { clearCacheOnLogout } from '../middleware/cache.js'

router.post('/logout', clearCacheOnLogout(), async (req, res) => {
  await authService.logout(req.body.token)
  res.json({ success: true })
})
```

## Cache Statistics

Get cache statistics for monitoring:

```typescript
const stats = cacheService.getStats()
console.log(stats)
// {
//   keys: 10,      // Number of cached keys
//   hits: 150,     // Number of cache hits
//   misses: 25,    // Number of cache misses
//   ksize: 1024,   // Approximate key size in bytes
//   vsize: 51200   // Approximate value size in bytes
// }
```

## Configuration

The CacheService can be configured when creating a new instance:

```typescript
import { CacheService } from '../services/CacheService.js'

const customCache = new CacheService({
  ttl: 1800, // 30 minutes default TTL
  checkperiod: 300, // Check for expired keys every 5 minutes
})
```

## Best Practices

1. **Use appropriate TTL**: Set shorter TTL for frequently changing data, longer for static data
2. **Bypass cache for refresh**: Always support cache bypass for user-initiated refreshes
3. **Invalidate on updates**: Clear related cache entries when data is modified
4. **Clear on logout**: Always clear cache when users log out for security
5. **Monitor cache stats**: Regularly check cache statistics to optimize performance
6. **Use consistent keys**: Use the provided utility functions for cache key generation

## Requirements Satisfied

This implementation satisfies the following requirements:

- **7.1**: Caches district statistics with 15-minute TTL
- **7.2**: Retrieves data from cache when available and not expired
- **7.3**: Provides refresh button functionality via cache bypass
- **7.4**: Automatically fetches updated data when cache expires
- **7.5**: Clears all cached data on user logout
