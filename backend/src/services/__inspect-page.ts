/**
 * Inspect the Toastmasters dashboard page to find the export button
 */

import { chromium } from 'playwright'

async function inspectPage() {
  const browser = await chromium.launch({ headless: false })
  const page = await browser.newPage()

  try {
    console.log('Loading page...')
    await page.goto('https://dashboards.toastmasters.org/', { 
      waitUntil: 'networkidle',
      timeout: 60000 
    })

    console.log('Page loaded. Waiting 5 seconds for any dynamic content...')
    await page.waitForTimeout(5000)

    // Take a screenshot
    await page.screenshot({ path: 'dashboard-screenshot.png', fullPage: true })
    console.log('Screenshot saved to dashboard-screenshot.png')

    // Get all button and link text
    const buttons = await page.$$eval('button, a, input[type="button"], input[type="submit"]', elements =>
      elements.map(el => ({
        tag: el.tagName,
        text: el.textContent?.trim() || '',
        value: (el as HTMLInputElement).value || '',
        id: el.id,
        class: el.className,
      }))
    )

    console.log('\nAll buttons and links on the page:')
    buttons.forEach((btn, i) => {
      if (btn.text || btn.value) {
        console.log(`${i + 1}. [${btn.tag}] "${btn.text || btn.value}" (id: ${btn.id}, class: ${btn.class})`)
      }
    })

    // Look for anything with "export" or "csv" in it
    console.log('\n\nElements containing "export" or "csv":')
    const exportElements = buttons.filter(btn => 
      (btn.text + btn.value + btn.id + btn.class).toLowerCase().includes('export') ||
      (btn.text + btn.value + btn.id + btn.class).toLowerCase().includes('csv')
    )
    exportElements.forEach(el => {
      console.log(`- [${el.tag}] "${el.text || el.value}" (id: ${el.id}, class: ${el.class})`)
    })

    console.log('\n\nPress Ctrl+C to close the browser...')
    await page.waitForTimeout(300000) // Wait 5 minutes so you can inspect manually
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await browser.close()
  }
}

inspectPage()
