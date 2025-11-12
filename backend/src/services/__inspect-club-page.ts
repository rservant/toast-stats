/**
 * Inspect a district club page
 */

import { chromium } from 'playwright'

async function inspectClubPage() {
  const browser = await chromium.launch({ headless: false })
  const page = await browser.newPage()

  try {
    console.log('Loading club page...')
    await page.goto('https://dashboards.toastmasters.org/Club.aspx?id=61', { 
      waitUntil: 'networkidle',
      timeout: 60000 
    })

    console.log('Page loaded.\n')

    // Look for export-related elements
    const exportElements = await page.$$eval('*', elements =>
      elements
        .filter(el => {
          const text = el.textContent?.toLowerCase() || ''
          const id = el.id?.toLowerCase() || ''
          const className = (el as HTMLElement).className?.toLowerCase() || ''
          return text.includes('export') || text.includes('csv') || id.includes('export') || className.includes('export')
        })
        .map(el => ({
          tag: el.tagName,
          text: el.textContent?.trim().substring(0, 100),
          id: el.id,
          class: (el as HTMLElement).className,
        }))
    )

    console.log('Elements with "export" or "csv":')
    exportElements.forEach(el => {
      console.log(`- [${el.tag}] "${el.text}" (id: ${el.id}, class: ${el.class})`)
    })

    // Take screenshot
    await page.screenshot({ path: 'club-page-screenshot.png', fullPage: true })
    console.log('\nScreenshot saved to club-page-screenshot.png')

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await browser.close()
  }
}

inspectClubPage()
