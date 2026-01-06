/**
 * Inspect the All Districts CSV structure
 */

import { ToastmastersScraper } from './ToastmastersScraper.js'
import { getProductionServiceFactory } from './ProductionServiceFactory.js'

async function inspectAllDistricts() {
  // Get cache service from production factory
  const serviceFactory = getProductionServiceFactory()
  const rawCSVCacheService = serviceFactory.createRawCSVCacheService()
  const scraper = new ToastmastersScraper(rawCSVCacheService)

  try {
    console.log('Fetching All Districts CSV...\n')
    const districts = await scraper.getAllDistricts()

    if (districts.length > 0) {
      console.log('CSV Columns:')
      console.log(Object.keys(districts[0]).join(', '))
      console.log('\n')

      console.log('First 3 districts:')
      districts.slice(0, 3).forEach((district, i) => {
        console.log(`\nDistrict ${i + 1}:`)
        Object.entries(district).forEach(([key, value]) => {
          console.log(`  ${key}: ${value}`)
        })
      })
    }
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await scraper.closeBrowser()
  }
}

inspectAllDistricts()
