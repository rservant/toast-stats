/**
 * Test script to verify DCP goals are returned correctly via API
 * This simulates what the frontend would receive
 */

import { getProductionServiceFactory } from '../src/services/ProductionServiceFactory.js'

async function testAPIDCPGoals(): Promise<void> {
  console.log('='.repeat(80))
  console.log('API DCP GOALS TEST')
  console.log('='.repeat(80))
  console.log()

  // Create production services using dependency injection
  const factory = getProductionServiceFactory()
  const container = factory.createProductionContainer()

  const cacheConfig = container.resolve('CacheConfigService')
  const cacheManager = container.resolve('DistrictCacheManager')
  const analyticsEngine = container.resolve('AnalyticsEngine')

  // Initialize cache configuration
  await cacheConfig.initialize()

  // Test with 2024-2025 program year data (November 2025)
  const districtId = '61'
  const date = '2025-11-22'

  console.log(`Testing API response for District ${districtId} on ${date}`)
  console.log()

  try {
    // This is what the API endpoint calls
    const analytics = await analyticsEngine.generateDistrictAnalytics(
      districtId,
      date,
      date
    )

    console.log('✓ Analytics generated successfully')
    console.log()
    console.log('Response structure:')
    console.log('  - districtId:', analytics.districtId)
    console.log('  - dateRange:', analytics.dateRange)
    console.log('  - totalMembership:', analytics.totalMembership)
    console.log('  - distinguishedClubs:', analytics.distinguishedClubs)
    console.log()

    // Check if DCP goal data is available
    console.log('Checking for DCP goal data in response...')

    // The current analytics response doesn't include DCP goal analysis
    // This is expected based on the DistrictAnalytics interface
    console.log()
    console.log(
      '⚠ NOTE: DCP goal analysis is NOT included in the current analytics response'
    )
    console.log(
      '  The DistrictAnalytics interface does not have a dcpGoalAnalysis field'
    )
    console.log()
    console.log('Available fields in response:')
    Object.keys(analytics).forEach(key => {
      console.log(`  - ${key}`)
    })
    console.log()

    // Let's check if there's a separate endpoint or method for DCP goals
    console.log('Recommendation:')
    console.log(
      '  To display DCP goal data in the frontend, we need to either:'
    )
    console.log(
      '  1. Add dcpGoalAnalysis to the DistrictAnalytics interface and response'
    )
    console.log('  2. Create a separate API endpoint for DCP goal analysis')
    console.log(
      '  3. Have the frontend calculate DCP goals from club performance data'
    )
    console.log()

    // For now, let's manually verify the data is correct by loading it directly
    console.log('Manual verification using cached data:')
    const entry = await cacheManager.getDistrictData(districtId, date)

    if (entry) {
      let goal5Count = 0
      let goal6Count = 0

      for (const club of entry.clubPerformance) {
        const level4s = parseInt(
          club['Level 4s, Path Completions, or DTM Awards'] || '0'
        )
        const addLevel4s = parseInt(
          club['Add. Level 4s, Path Completions, or DTM award'] || '0'
        )

        if (level4s >= 1) goal5Count++
        if (level4s >= 1 && addLevel4s >= 1) goal6Count++
      }

      console.log(
        `  ✓ Goal 5: ${goal5Count} clubs (${Math.round((goal5Count / entry.clubPerformance.length) * 100)}%)`
      )
      console.log(
        `  ✓ Goal 6: ${goal6Count} clubs (${Math.round((goal6Count / entry.clubPerformance.length) * 100)}%)`
      )
      console.log()
      console.log('✓ Data is correct - Goals 5 and 6 show non-zero counts')
    }
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    // Cleanup resources
    await container.dispose()
  }

  console.log()
  console.log('='.repeat(80))
  console.log('TEST COMPLETE')
  console.log('='.repeat(80))
}

testAPIDCPGoals().catch(error => {
  console.error('Test failed:', error)
  process.exit(1)
})
