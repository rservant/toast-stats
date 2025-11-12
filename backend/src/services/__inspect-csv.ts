/**
 * Inspect the actual CSV columns
 */

import { ToastmastersScraper } from './ToastmastersScraper.js'

async function inspectCsv() {
  const scraper = new ToastmastersScraper()

  try {
    console.log('Fetching club performance CSV for District 61...\n')
    const clubs = await scraper.getClubPerformance('61')

    if (clubs.length > 0) {
      console.log('CSV Columns:')
      console.log(Object.keys(clubs[0]).join(', '))
      console.log('\n')

      console.log('First 3 rows:')
      clubs.slice(0, 3).forEach((club, i) => {
        console.log(`\nRow ${i + 1}:`)
        Object.entries(club).forEach(([key, value]) => {
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

inspectCsv()
