#!/usr/bin/env node
/**
 * Cache Migration Script
 * 
 * Automatically clears cache entries that don't match the current cache version.
 * This is necessary when the cache format or calculation methodology changes.
 * 
 * Usage:
 *   npm run migrate-cache
 *   or
 *   node dist/scripts/migrate-cache.js
 */

import { CacheManager } from '../services/CacheManager.js'
import { logger } from '../utils/logger.js'

async function main() {
  console.log('='.repeat(60))
  console.log('Cache Migration Script')
  console.log('='.repeat(60))
  console.log()

  try {
    const cacheManager = new CacheManager()
    
    // Check current version
    const currentVersion = CacheManager.getCacheVersion()
    console.log(`Current cache version: v${currentVersion}`)
    console.log()

    // Get all cached dates before migration
    const datesBefore = await cacheManager.getCachedDates('districts')
    console.log(`Found ${datesBefore.length} cached date(s):`)
    if (datesBefore.length > 0) {
      datesBefore.forEach(date => console.log(`  - ${date}`))
      console.log()
    } else {
      console.log('  (no cached dates found)')
      console.log()
      console.log('✓ No migration needed - cache is empty')
      return
    }

    // Check compatibility for each date
    console.log('Checking cache compatibility...')
    const incompatibleDates: string[] = []
    for (const date of datesBefore) {
      const isCompatible = await cacheManager.isCacheVersionCompatible(date)
      const metadata = await cacheManager.getMetadata(date)
      const version = metadata?.cacheVersion || 1
      
      if (!isCompatible) {
        console.log(`  ✗ ${date} - v${version} (incompatible)`)
        incompatibleDates.push(date)
      } else {
        console.log(`  ✓ ${date} - v${version} (compatible)`)
      }
    }
    console.log()

    if (incompatibleDates.length === 0) {
      console.log('✓ All cached dates are compatible - no migration needed')
      return
    }

    // Perform migration
    console.log(`Found ${incompatibleDates.length} incompatible cache entries`)
    console.log('Starting automatic migration...')
    console.log()

    const clearedCount = await cacheManager.clearIncompatibleCache()
    
    console.log()
    console.log('='.repeat(60))
    console.log('Migration Complete')
    console.log('='.repeat(60))
    console.log(`✓ Cleared ${clearedCount} incompatible cache entries`)
    console.log()
    console.log('Next steps:')
    console.log('  1. Cache will regenerate automatically on next request')
    console.log('  2. First request may be slower while fetching fresh data')
    console.log('  3. New cache will use v' + currentVersion + ' format')
    console.log()

  } catch (error) {
    console.error()
    console.error('✗ Migration failed:', error)
    logger.error('Cache migration failed', error)
    process.exit(1)
  }
}

// Run migration
main().catch(error => {
  console.error('Unexpected error:', error)
  process.exit(1)
})
