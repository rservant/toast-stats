/**
 * Manual test script for CacheService
 * Run with: tsx src/services/__test-cache.ts
 */

import { CacheService } from './CacheService.js'
import { generateCacheKey, generateDistrictCacheKey } from '../utils/cacheKeys.js'

console.log('🧪 Testing CacheService...\n')

// Create cache instance
const cache = new CacheService({ ttl: 5 }) // 5 seconds for testing

// Test 1: Basic set and get
console.log('Test 1: Basic set and get')
cache.set('test-key', { data: 'test-value' })
const value1 = cache.get('test-key')
console.log('✓ Set and get:', value1)
console.log('')

// Test 2: Check if key exists
console.log('Test 2: Check if key exists')
console.log('✓ Key exists:', cache.has('test-key'))
console.log('✓ Non-existent key:', cache.has('non-existent'))
console.log('')

// Test 3: Custom TTL
console.log('Test 3: Custom TTL (2 seconds)')
cache.set('short-ttl', { data: 'expires-soon' }, 2)
console.log('✓ Value set with 2s TTL')
console.log('')

// Test 4: Cache key generation
console.log('Test 4: Cache key generation')
const key1 = generateCacheKey('/api/districts')
const key2 = generateCacheKey('/api/districts', { region: 'west' })
const key3 = generateDistrictCacheKey('123', 'statistics')
console.log('✓ Basic key:', key1)
console.log('✓ Key with params:', key2)
console.log('✓ District key:', key3)
console.log('')

// Test 5: Get all keys
console.log('Test 5: Get all keys')
const keys = cache.keys()
console.log('✓ All keys:', keys)
console.log('')

// Test 6: Invalidate single key
console.log('Test 6: Invalidate single key')
cache.invalidate('test-key')
console.log('✓ Key invalidated, exists:', cache.has('test-key'))
console.log('')

// Test 7: Invalidate multiple keys
console.log('Test 7: Invalidate multiple keys')
cache.set('key1', 'value1')
cache.set('key2', 'value2')
cache.set('key3', 'value3')
const deleted = cache.invalidateMultiple(['key1', 'key2'])
console.log('✓ Deleted count:', deleted)
console.log('✓ Remaining keys:', cache.keys())
console.log('')

// Test 8: Cache statistics
console.log('Test 8: Cache statistics')
const stats = cache.getStats()
console.log('✓ Stats:', stats)
console.log('')

// Test 9: Wait for TTL expiration
console.log('Test 9: Wait for TTL expiration (3 seconds)...')
setTimeout(() => {
  const expired = cache.get('short-ttl')
  console.log('✓ Value after TTL:', expired === undefined ? 'expired ✓' : 'still exists ✗')
  console.log('')

  // Test 10: Clear all cache
  console.log('Test 10: Clear all cache')
  cache.clear()
  console.log('✓ Cache cleared, keys:', cache.keys())
  console.log('')

  console.log('✅ All tests completed!')
}, 3000)
