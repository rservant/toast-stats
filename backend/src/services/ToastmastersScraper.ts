/**
 * Toastmasters Dashboard Scraper
 * Uses Playwright to scrape data from https://dashboards.toastmasters.org
 */

import { chromium, Browser, Page } from 'playwright'
import { parse } from 'csv-parse/sync'
import { logger } from '../utils/logger.js'

interface ScraperConfig {
  baseUrl: string
  headless: boolean
  timeout: number
}

export class ToastmastersScraper {
  private config: ScraperConfig
  private browser: Browser | null = null

  constructor() {
    this.config = {
      baseUrl: process.env.TOASTMASTERS_DASHBOARD_URL || 'https://dashboards.toastmasters.org',
      headless: process.env.NODE_ENV === 'production',
      timeout: 30000,
    }
  }

  /**
   * Initialize browser instance
   */
  private async initBrowser(): Promise<Browser> {
    if (!this.browser) {
      logger.info('Launching Playwright browser', { headless: this.config.headless })
      this.browser = await chromium.launch({
        headless: this.config.headless,
      })
    }
    return this.browser
  }

  /**
   * Close browser instance
   */
  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
      logger.info('Browser closed')
    }
  }

  /**
   * Download CSV from a page by selecting CSV from export dropdown
   */
  private async downloadCsv(page: Page): Promise<string> {
    try {
      // Wait for page to be fully loaded
      await page.waitForLoadState('networkidle', { timeout: this.config.timeout })
      
      // Look for the export dropdown (select element with id containing 'Export')
      const exportSelect = await page.waitForSelector('select[id*="Export"], select[id*="export"]', { 
        timeout: this.config.timeout 
      })

      if (!exportSelect) {
        throw new Error('Export dropdown not found')
      }

      logger.info('Found export dropdown')

      // Select the CSV option and wait for download
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: this.config.timeout }),
        exportSelect.selectOption({ label: 'CSV' }),
      ])

      // Read the downloaded file content
      const stream = await download.createReadStream()
      const chunks: Buffer[] = []
      
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk))
      }
      
      const csvContent = Buffer.concat(chunks).toString('utf-8')
      logger.info('CSV downloaded successfully', { size: csvContent.length })
      
      return csvContent
    } catch (error) {
      logger.error('Failed to download CSV', error)
      throw new Error(`CSV download failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Parse CSV content into array of objects
   */
  private parseCsv(csvContent: string): any[] {
    try {
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true, // Allow inconsistent column counts
        relax_quotes: true, // Be lenient with quotes
      })
      return records
    } catch (error) {
      logger.error('Failed to parse CSV', error)
      throw new Error(`CSV parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Fetch all districts list (just names and IDs from dropdown)
   */
  async getAllDistrictsList(): Promise<any[]> {
    const browser = await this.initBrowser()
    const page = await browser.newPage()

    try {
      logger.info('Fetching all districts from dropdown')
      await page.goto(this.config.baseUrl, { waitUntil: 'networkidle', timeout: this.config.timeout })
      
      // Find the district dropdown/select element
      const districtOptions = await page.$$eval('select option, option', options =>
        options
          .map(opt => opt.textContent?.trim() || '')
          .filter(text => text.match(/^District\s+(\d+|[A-Z])$/i))
      )

      const districts = districtOptions.map(text => {
        const match = text.match(/^District\s+(\d+|[A-Z])$/i)
        if (match) {
          return {
            id: match[1],
            name: text,
          }
        }
        return null
      }).filter(d => d !== null)
      
      logger.info('Districts fetched from dropdown', { count: districts.length })
      return districts
    } finally {
      await page.close()
    }
  }

  /**
   * Fetch all districts with performance data from CSV export
   */
  async getAllDistricts(): Promise<any[]> {
    const browser = await this.initBrowser()
    const page = await browser.newPage()

    try {
      logger.info('Fetching all districts summary with performance data')
      await page.goto(this.config.baseUrl, { waitUntil: 'networkidle', timeout: this.config.timeout })
      
      const csvContent = await this.downloadCsv(page)
      const records = this.parseCsv(csvContent)
      
      logger.info('All districts performance data fetched', { count: records.length })
      return records
    } finally {
      await page.close()
    }
  }

  /**
   * Fetch district performance data
   */
  async getDistrictPerformance(districtId: string): Promise<any[]> {
    const browser = await this.initBrowser()
    const page = await browser.newPage()

    try {
      const url = `${this.config.baseUrl}/District.aspx?id=${districtId}`
      logger.info('Fetching district performance', { districtId, url })
      
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.config.timeout })
      
      const csvContent = await this.downloadCsv(page)
      const records = this.parseCsv(csvContent)
      
      logger.info('District performance fetched', { districtId, count: records.length })
      return records
    } finally {
      await page.close()
    }
  }

  /**
   * Fetch division and area performance
   */
  async getDivisionPerformance(districtId: string): Promise<any[]> {
    const browser = await this.initBrowser()
    const page = await browser.newPage()

    try {
      const url = `${this.config.baseUrl}/Division.aspx?id=${districtId}`
      logger.info('Fetching division performance', { districtId, url })
      
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.config.timeout })
      
      const csvContent = await this.downloadCsv(page)
      const records = this.parseCsv(csvContent)
      
      logger.info('Division performance fetched', { districtId, count: records.length })
      return records
    } finally {
      await page.close()
    }
  }

  /**
   * Fetch club performance data
   */
  async getClubPerformance(districtId: string): Promise<any[]> {
    const browser = await this.initBrowser()
    const page = await browser.newPage()

    try {
      const url = `${this.config.baseUrl}/Club.aspx?id=${districtId}`
      logger.info('Fetching club performance', { districtId, url })
      
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.config.timeout })
      
      const csvContent = await this.downloadCsv(page)
      const records = this.parseCsv(csvContent)
      
      logger.info('Club performance fetched', { districtId, count: records.length })
      return records
    } finally {
      await page.close()
    }
  }

  /**
   * Scrape page content directly (for pages without CSV export)
   */
  async scrapePage(url: string, selector: string): Promise<string> {
    const browser = await this.initBrowser()
    const page = await browser.newPage()

    try {
      logger.info('Scraping page', { url, selector })
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.config.timeout })
      
      const content = await page.textContent(selector)
      return content || ''
    } finally {
      await page.close()
    }
  }
}
