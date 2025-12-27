#!/usr/bin/env tsx

/**
 * Cache Clearing Script for District Rankings
 *
 * This script clears cached district rankings data to ensure fresh rankings
 * are calculated using the new Borda count scoring system.
 *
 * IMPORTANT: Run this script after deploying ranking system changes.
 *
 * The script clears:
 * - District rankings cache files (districts_*.json)
 * - Metadata cache files (metadata_*.json)
 * - Historical index (historical_index.json)
 *
 * The script preserves:
 * - Individual district performance data (cache/districts/{districtId}/ subdirectories)
 * - Any other cache files not related to rankings
 *
 * Usage:
 *   npm run clear-rankings-cache
 *   # or directly:
 *   npx tsx scripts/clear-rankings-cache.ts
 */

import { CacheManager } from '../src/services/CacheManager.js'
import { CacheConfigService } from '../src/services/CacheConfigService.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function clearRankingsCache() {
  try {
    console.log('🧹 Clearing district rankings cache...')
    console.log('')

    // Use configured cache directory
    const cacheConfig = CacheConfigService.getInstance()
    await cacheConfig.initialize()
    const cacheDir = cacheConfig.getCacheDirectory()

    const cacheManager = new CacheManager(cacheDir)

    console.log(`📁 Cache directory: ${cacheDir}`)

    // Get cache statistics before clearing
    const statsBefore = await cacheManager.getCacheStatistics()
    console.log('📊 Cache statistics before clearing:')
    console.log(`   - Total dates: ${statsBefore.totalDates}`)
    console.log(`   - Total districts: ${statsBefore.totalDistricts}`)
    console.log(
      `   - Cache size: ${(statsBefore.cacheSize / 1024 / 1024).toFixed(2)} MB`
    )
    console.log('')

    // Check for incompatible cache versions
    console.log('🔍 Checking for incompatible cache versions...')
    const clearedIncompatible = await cacheManager.clearIncompatibleCache()
    if (clearedIncompatible > 0) {
      console.log(
        `   ✅ Cleared ${clearedIncompatible} incompatible cache entries`
      )
    } else {
      console.log('   ℹ️  No incompatible cache entries found')
    }
    console.log('')

    // Clear all rankings cache
    console.log('🗑️  Clearing district rankings cache...')
    await cacheManager.clearCache()
    console.log('   ✅ District rankings cache cleared successfully')
    console.log('')

    // Get cache statistics after clearing
    const statsAfter = await cacheManager.getCacheStatistics()
    console.log('📊 Cache statistics after clearing:')
    console.log(`   - Total dates: ${statsAfter.totalDates}`)
    console.log(`   - Total districts: ${statsAfter.totalDistricts}`)
    console.log(
      `   - Cache size: ${(statsAfter.cacheSize / 1024 / 1024).toFixed(2)} MB`
    )
    console.log('')

    console.log('✅ Cache clearing completed successfully!')
    console.log('')
    console.log('📝 Next steps:')
    console.log("   1. Restart the application if it's currently running")
    console.log('   2. Access the rankings page to trigger fresh data fetch')
    console.log('   3. Verify new rankings display correctly with Borda scores')
    console.log('')
    console.log('ℹ️  Note: Individual district performance data was preserved')
  } catch (error) {
    console.error('❌ Failed to clear rankings cache:', error)
    process.exit(1)
  }
}

// Run the script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  clearRankingsCache()
}

export { clearRankingsCache }
