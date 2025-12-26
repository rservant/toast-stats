/**
 * Manual test script for the Toastmasters scraper
 * Run with: npx tsx src/services/__test-scraper.ts
 */

import { RealToastmastersAPIService } from './RealToastmastersAPIService.js'

async function testScraper() {
  const service = new RealToastmastersAPIService()

  try {
    console.log('Testing Toastmasters Scraper...\n')

    // Test 1: Get all districts
    console.log('1. Fetching all districts...')
    const districts = await service.getDistricts()
    console.log(`   ✓ Found ${districts.districts.length} districts`)
    console.log(`   Sample: ${districts.districts.slice(0, 3).map((d: any) => `${d.id}: ${d.name}`).join(', ')}\n`)

    // Test 2: Get district statistics (using first district)
    if (districts.districts.length > 0) {
      const testDistrictId = districts.districts[0].id
      console.log(`2. Fetching statistics for District ${testDistrictId}...`)
      const stats = await service.getDistrictStatistics(testDistrictId)
      console.log(`   ✓ Total Members: ${stats.membership.total}`)
      console.log(`   ✓ Total Clubs: ${stats.clubs.total}`)
      console.log(`   ✓ Active Clubs: ${stats.clubs.active}`)
      console.log(`   ✓ Distinguished Clubs: ${stats.clubs.distinguished}\n`)

      // Test 3: Get clubs
      console.log(`3. Fetching clubs for District ${testDistrictId}...`)
      const clubs = await service.getClubs(testDistrictId)
      console.log(`   ✓ Found ${clubs.clubs.length} clubs`)
      if (clubs.clubs.length > 0) {
        const sampleClub = clubs.clubs[0]
        console.log(`   Sample: ${sampleClub.name} (${sampleClub.memberCount} members)\n`)
      }
    }

    console.log('✓ All tests passed!')
  } catch (_error) {
    console.error('✗ Test failed:', error)
  } finally {
    // Clean up
    await service.cleanup()
  }
}

testScraper()
