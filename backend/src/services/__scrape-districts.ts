/**
 * Scrape districts directly from the page HTML
 */

import { chromium } from 'playwright'

async function scrapeDistricts() {
  const browser = await chromium.launch({ headless: false })
  const page = await browser.newPage()

  try {
    console.log('Loading page...')
    await page.goto('https://dashboards.toastmasters.org/', { 
      waitUntil: 'networkidle',
      timeout: 60000 
    })

    console.log('Page loaded. Looking for district data...\n')

    // Look for tables
    const tables = await page.$$('table')
    console.log(`Found ${tables.length} tables on the page\n`)

    // Get table data
    for (let i = 0; i < tables.length; i++) {
      const table = tables[i]
      const rows = await table.$$('tr')
      console.log(`Table ${i + 1}: ${rows.length} rows`)
      
      if (rows.length > 0) {
        // Get first few rows to see structure
        for (let j = 0; j < Math.min(3, rows.length); j++) {
          const cells = await rows[j].$$('td, th')
          const cellTexts = await Promise.all(
            cells.map(cell => cell.textContent())
          )
          console.log(`  Row ${j + 1}:`, cellTexts.map(t => t?.trim()).join(' | '))
        }
        console.log()
      }
    }

    // Look for district links
    const districtLinks = await page.$$eval('a[href*="District.aspx"]', links =>
      links.map(link => ({
        text: link.textContent?.trim(),
        href: link.getAttribute('href'),
      }))
    )

    if (districtLinks.length > 0) {
      console.log(`\nFound ${districtLinks.length} district links:`)
      districtLinks.slice(0, 10).forEach(link => {
        console.log(`  - ${link.text}: ${link.href}`)
      })
    }

    // Look for any element containing "District" followed by a number
    const pageContent = await page.content()
    const districtMatches = pageContent.match(/District\s+(\d+)/gi)
    if (districtMatches) {
      console.log(`\nFound district mentions: ${districtMatches.slice(0, 20).join(', ')}`)
    }

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await browser.close()
  }
}

scrapeDistricts()
