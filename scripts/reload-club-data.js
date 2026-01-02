#!/usr/bin/env node

/**
 * Script to trigger a reload of club health data by calling the refresh endpoint
 * This will reload all historical data from disk with the improved JSON parsing
 */

import fetch from 'node-fetch'

const API_BASE = 'http://localhost:3001'

async function reloadClubData() {
  try {
    console.log('🔄 Triggering district 61 data refresh...')

    // Call the district refresh endpoint to reload data
    const response = await fetch(
      `${API_BASE}/api/club-health/districts/61/refresh`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const result = await response.json()

    console.log('✅ Data refresh completed!')
    console.log(
      `📊 Clubs refreshed: ${result.metadata?.clubs_refreshed || result.data?.length || 'unknown'}`
    )

    // Now check the debug endpoint to see current state
    console.log('\n🔍 Checking current data state...')

    const debugResponse = await fetch(`${API_BASE}/api/club-health/debug`)

    if (debugResponse.ok) {
      const debugData = await debugResponse.json()

      console.log('📈 Current Status:')
      console.log(
        `  • Historical data size: ${debugData.data.historicalDataSize}`
      )
      console.log(
        `  • District 61 clubs: ${debugData.data.district61Clubs.length}`
      )
      console.log(`  • Data directory: ${debugData.data.dataDirectory}`)

      if (debugData.data.district61Clubs.length < 166) {
        console.log(
          `\n⚠️  Still missing ${166 - debugData.data.district61Clubs.length} clubs`
        )
        console.log('💡 This might be due to:')
        console.log("   - Malformed JSON files that couldn't be parsed")
        console.log('   - Files with incorrect district_id')
        console.log('   - Missing or corrupted data files')
      } else {
        console.log('\n🎉 All 166 clubs are now loaded!')
      }
    } else {
      console.log('⚠️  Could not fetch debug info')
    }
  } catch (error) {
    console.error('💥 Failed to reload club data:', error.message)

    if (error.code === 'ECONNREFUSED') {
      console.log('🔌 Make sure the server is running on port 3001')
    }

    process.exit(1)
  }
}

// Run the script
reloadClubData()
