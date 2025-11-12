/**
 * Inspect all unique club statuses in the CSV data
 */

import { ToastmastersScraper } from './ToastmastersScraper.js'

async function inspectStatuses() {
  const scraper = new ToastmastersScraper()

  try {
    console.log('Fetching club data from multiple districts...\n')
    
    const districtIds = ['01', '61', '46', '101', '25'] // Sample various districts
    const allStatuses = new Set<string>()
    
    for (const districtId of districtIds) {
      console.log(`Fetching District ${districtId}...`)
      const clubs = await scraper.getClubPerformance(districtId)
      
      clubs.forEach((club: any) => {
        const status = club['Club Status']
        if (status) {
          allStatuses.add(status.trim())
        }
      })
      
      console.log(`  Found ${clubs.length} clubs`)
    }
    
    console.log('\n=== All Unique Club Statuses ===')
    const statusArray = Array.from(allStatuses).sort()
    statusArray.forEach((status, i) => {
      console.log(`${i + 1}. "${status}"`)
    })
    
    console.log(`\nTotal unique statuses: ${statusArray.length}`)
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await scraper.closeBrowser()
  }
}

inspectStatuses()
