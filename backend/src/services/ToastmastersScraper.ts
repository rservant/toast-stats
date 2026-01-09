/**
 * Toastmasters Dashboard Scraper
 * Uses Playwright to scrape data from https://dashboards.toastmasters.org
 */

import { chromium, Browser, Page } from 'playwright'
import { parse } from 'csv-parse/sync'
import { logger } from '../utils/logger.js'
import { ScrapedRecord, DistrictInfo } from '../types/districts.js'
import { IRawCSVCacheService } from '../types/serviceInterfaces.js'
import { CSVType } from '../types/rawCSVCache.js'

interface ScraperConfig {
  baseUrl: string
  headless: boolean
  timeout: number
}

export class ToastmastersScraper {
  private config: ScraperConfig
  private browser: Browser | null = null
  private rawCSVCache: IRawCSVCacheService

  constructor(rawCSVCache: IRawCSVCacheService) {
    this.config = {
      baseUrl:
        process.env['TOASTMASTERS_DASHBOARD_URL'] ||
        'https://dashboards.toastmasters.org',
      headless: true, // Always run in headless mode
      timeout: 30000,
    }
    this.rawCSVCache = rawCSVCache

    logger.debug('ToastmastersScraper initialized with cache service')
  }

  /**
   * Get current date string in YYYY-MM-DD format
   */
  private getCurrentDateString(): string {
    const now = new Date()
    const dateString = now.toISOString().split('T')[0]
    if (!dateString) {
      throw new Error('Failed to generate current date string')
    }
    return dateString
  }

  /**
   * Try to get CSV content from cache first, fallback to download if not found
   * Returns both the content and the actual "As of" date from the dashboard
   */
  private async getCachedOrDownloadWithDate(
    csvType: CSVType,
    downloadFn: () => Promise<{ content: string; actualDate: string }>,
    dateString?: string,
    districtId?: string
  ): Promise<{ content: string; actualDate: string }> {
    const requestedDate = dateString || this.getCurrentDateString()

    try {
      // Check cache first
      const cachedContent = await this.rawCSVCache.getCachedCSV(
        requestedDate,
        csvType,
        districtId
      )

      if (cachedContent) {
        // Get the actual date from cache metadata
        const cacheMetadata =
          await this.rawCSVCache.getCacheMetadata(requestedDate)
        let actualDate = cacheMetadata?.date || requestedDate

        // Always extract closing period info from CSV footer (most reliable source)
        // This ensures we detect closing periods even if metadata was incorrectly set
        const footerInfo = this.extractClosingPeriodFromCSV(cachedContent)

        if (footerInfo && footerInfo.dataMonth) {
          // Check if the collection date is in a different month than the data month
          // Use the collection date from the footer if available, otherwise use actualDate
          const collectionDateStr = footerInfo.collectionDate || actualDate
          const collectionDateObj = new Date(collectionDateStr + 'T00:00:00')
          const collectionMonth = `${collectionDateObj.getFullYear()}-${String(collectionDateObj.getMonth() + 1).padStart(2, '0')}`
          const isClosingPeriod = collectionMonth !== footerInfo.dataMonth

          // Check if metadata needs to be updated (missing or incorrect)
          const metadataNeedsUpdate =
            !cacheMetadata ||
            cacheMetadata.isClosingPeriod !== isClosingPeriod ||
            cacheMetadata.dataMonth !== footerInfo.dataMonth

          if (metadataNeedsUpdate) {
            // Update cache metadata with correct closing period info from CSV footer
            await this.rawCSVCache.setCachedCSVWithMetadata(
              requestedDate,
              csvType,
              cachedContent,
              districtId,
              {
                requestedDate,
                isClosingPeriod,
                dataMonth: footerInfo.dataMonth,
              }
            )

            logger.info(
              'Updated cache metadata with closing period info from CSV footer',
              {
                csvType,
                requestedDate,
                actualDate,
                dataMonth: footerInfo.dataMonth,
                isClosingPeriod,
                collectionDate: collectionDateStr,
                previousIsClosingPeriod: cacheMetadata?.isClosingPeriod,
                previousDataMonth: cacheMetadata?.dataMonth,
              }
            )
          }
        }

        logger.info('Cache hit - returning cached CSV content', {
          csvType,
          requestedDate,
          actualDate,
          districtId,
          contentLength: cachedContent.length,
        })
        return { content: cachedContent, actualDate }
      }

      logger.info('Cache miss - downloading and caching CSV content', {
        csvType,
        date: requestedDate,
        districtId,
      })

      // Cache miss - download and cache
      const { content: downloadedContent, actualDate } = await downloadFn()

      // Extract closing period information from CSV footer if available
      const footerInfo = this.extractClosingPeriodFromCSV(downloadedContent)

      // Determine if this is a month-end closing period
      // Method 1: Check if requested date differs from actual date
      const datesDiffer = requestedDate !== actualDate

      // Method 2: Check if CSV footer indicates a different data month
      let isClosingPeriod = datesDiffer
      let dataMonth: string

      if (footerInfo && footerInfo.dataMonth) {
        // Use the data month from the CSV footer (most reliable)
        dataMonth = footerInfo.dataMonth

        // Check if the collection date is in a different month than the data month
        const actualDateObj = new Date(actualDate + 'T00:00:00')
        const actualMonth = `${actualDateObj.getFullYear()}-${String(actualDateObj.getMonth() + 1).padStart(2, '0')}`

        if (actualMonth !== dataMonth) {
          isClosingPeriod = true
          logger.info('Closing period detected from CSV footer', {
            requestedDate,
            actualDate,
            dataMonth,
            actualMonth,
          })
        }
      } else {
        // Fallback: use requested date's month
        const requestedDateObj = new Date(requestedDate + 'T00:00:00')
        dataMonth = `${requestedDateObj.getFullYear()}-${String(requestedDateObj.getMonth() + 1).padStart(2, '0')}`
      }

      // Cache the downloaded content with enhanced metadata
      await this.rawCSVCache.setCachedCSVWithMetadata(
        actualDate, // Store by actual dashboard date
        csvType,
        downloadedContent,
        districtId,
        {
          requestedDate,
          isClosingPeriod,
          dataMonth,
        }
      )

      logger.info('CSV content downloaded and cached successfully', {
        csvType,
        requestedDate,
        actualDate,
        districtId,
        isClosingPeriod,
        dataMonth,
        contentLength: downloadedContent.length,
      })

      return { content: downloadedContent, actualDate }
    } catch (cacheError) {
      // Cache operation failed - log error and fallback to direct download
      logger.warn('Cache operation failed, falling back to direct download', {
        csvType,
        date: requestedDate,
        districtId,
        error:
          cacheError instanceof Error ? cacheError.message : 'Unknown error',
      })

      const { content, actualDate } = await downloadFn()
      return { content, actualDate }
    }
  }

  /**
   * Try to get CSV content from cache first, fallback to download if not found
   * Legacy method that only returns content (for backward compatibility)
   */
  private async getCachedOrDownload(
    csvType: CSVType,
    downloadFn: () => Promise<{ content: string; actualDate: string }>,
    dateString?: string,
    districtId?: string
  ): Promise<string> {
    const result = await this.getCachedOrDownloadWithDate(
      csvType,
      downloadFn,
      dateString,
      districtId
    )
    return result.content
  }

  /**
   * Determine the program year for a given date
   * Toastmasters program year runs from July 1 to June 30
   * Returns format like "2024-2025" for dates between July 1, 2024 and June 30, 2025
   */
  private getProgramYear(dateString: string): string {
    const date = new Date(dateString + 'T00:00:00')
    const year = date.getFullYear()
    const month = date.getMonth() + 1 // 1-12

    // If month is July (7) or later, program year starts this year
    // If month is June (6) or earlier, program year started last year
    if (month >= 7) {
      return `${year}-${year + 1}`
    } else {
      return `${year - 1}-${year}`
    }
  }

  /**
   * Build the base URL with program year
   * Format: https://dashboards.toastmasters.org/YYYY-YYYY/
   * This format works for all program years including the current one
   */
  private buildBaseUrl(dateString: string): string {
    const programYear = this.getProgramYear(dateString)
    return `${this.config.baseUrl}/${programYear}`
  }

  /**
   * Initialize browser instance
   */
  private async initBrowser(): Promise<Browser> {
    if (!this.browser) {
      logger.info('Launching Playwright browser', {
        headless: this.config.headless,
      })
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
   * Try to navigate to a date with month-end reconciliation fallback.
   * During month-end reconciliation, dates like Oct 1 may appear under September's data.
   * This method tries the requested month first, then falls back to the previous month.
   *
   * @param page - Playwright page instance
   * @param baseUrl - Base URL for the dashboard (includes program year)
   * @param pageName - Page name (e.g., 'Club.aspx', 'Division.aspx', 'District.aspx')
   * @param dateString - Requested date in YYYY-MM-DD format
   * @param districtId - Optional district ID for district-specific pages
   * @returns Object with success status, actual date string, and whether fallback was used
   */
  private async navigateToDateWithFallback(
    page: Page,
    baseUrl: string,
    pageName: string,
    dateString: string,
    districtId?: string
  ): Promise<{
    success: boolean
    actualDateString: string
    usedFallback: boolean
  }> {
    const dateObj = new Date(dateString + 'T00:00:00')
    const month = dateObj.getMonth() + 1 // 1-12
    const day = dateObj.getDate()
    const year = dateObj.getFullYear()
    const formattedDate = `${month}/${day}/${year}`

    // Build URL with district ID if provided
    const districtParam = districtId ? `id=${districtId}&` : ''
    const url = `${baseUrl}/${pageName}?${districtParam}month=${month}&day=${formattedDate}`

    logger.info('Navigating to URL for date', { url, dateString })
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: this.config.timeout,
    })

    // Verify the date
    const actualDate = await this.getSelectedDate(page)
    if (!actualDate) {
      logger.warn('Could not verify date from dropdown', { dateString })
      return { success: true, actualDateString: dateString, usedFallback: false }
    }

    const {
      month: actualMonth,
      day: actualDay,
      year: actualYear,
      dateString: dashboardDateString,
    } = actualDate

    // Check if we got the requested date
    if (actualMonth === month && actualDay === day && actualYear === year) {
      logger.info('Date verification successful', {
        requested: dateString,
        actual: dashboardDateString,
      })
      return {
        success: true,
        actualDateString: dashboardDateString,
        usedFallback: false,
      }
    }

    // Date mismatch - try previous month fallback for month-end reconciliation
    logger.info(
      'Date mismatch detected, trying previous month fallback for month-end reconciliation',
      {
        requested: { month, day, year, dateString },
        actual: {
          month: actualMonth,
          day: actualDay,
          year: actualYear,
          dateString: dashboardDateString,
        },
      }
    )

    // Calculate previous month and handle program year boundary
    // When falling back from July (month 7) to June (month 6), we cross the program year boundary
    // June belongs to the previous program year (e.g., July 2025 is in 2025-2026, but June 2025 is in 2024-2025)
    const prevMonth = month === 1 ? 12 : month - 1
    const prevMonthYear = month === 1 ? year - 1 : year
    const crossesProgramYearBoundary = month === 7 // July to June crosses program year boundary

    // Build fallback URL - use previous program year's base URL if crossing boundary
    let fallbackBaseUrl = baseUrl
    if (crossesProgramYearBoundary) {
      // Construct date string for previous month to get correct program year
      const prevMonthDateString = `${prevMonthYear}-${String(prevMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      fallbackBaseUrl = this.buildBaseUrl(prevMonthDateString)
      logger.info('Crossing program year boundary - using previous program year URL', {
        originalBaseUrl: baseUrl,
        fallbackBaseUrl,
        prevMonthDateString,
      })
    }

    const fallbackUrl = `${fallbackBaseUrl}/${pageName}?${districtParam}month=${prevMonth}&day=${formattedDate}`

    logger.info('Trying previous month fallback URL', {
      fallbackUrl,
      prevMonth,
      prevMonthYear,
      crossesProgramYearBoundary,
    })

    await page.goto(fallbackUrl, {
      waitUntil: 'domcontentloaded',
      timeout: this.config.timeout,
    })

    // Verify the date again
    const fallbackDate = await this.getSelectedDate(page)
    if (fallbackDate) {
      const {
        month: fbMonth,
        day: fbDay,
        year: fbYear,
        dateString: fbDateString,
      } = fallbackDate

      if (fbMonth === month && fbDay === day && fbYear === year) {
        logger.info(
          'Previous month fallback successful - found date in month-end reconciliation data',
          {
            requested: dateString,
            actual: fbDateString,
            usedMonth: prevMonth,
          }
        )
        return { success: true, actualDateString: fbDateString, usedFallback: true }
      }
    }

    // Fallback also didn't work - this date truly isn't available
    logger.warn(
      'Previous month fallback also failed - date not available on dashboard',
      {
        requested: dateString,
        dashboardReturned: dashboardDateString,
      }
    )
    return {
      success: false,
      actualDateString: dashboardDateString,
      usedFallback: true,
    }
  }

  /**
   * Download CSV from a page by selecting CSV from export dropdown
   */
  private async downloadCsv(page: Page): Promise<string> {
    try {
      // Wait for page to be fully loaded
      await page.waitForLoadState('networkidle', {
        timeout: this.config.timeout,
      })

      // Look for the export dropdown (select element with id containing 'Export')
      const exportSelect = await page.waitForSelector(
        'select[id*="Export"], select[id*="export"]',
        {
          timeout: this.config.timeout,
        }
      )

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
      throw new Error(
        `CSV download failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Parse CSV content into array of objects
   */
  private parseCsv(csvContent: string): ScrapedRecord[] {
    try {
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true, // Allow inconsistent column counts
        relax_quotes: true, // Be lenient with quotes
      }) as ScrapedRecord[]

      // Filter out "Month of" rows (summary/aggregate rows)
      const filteredRecords = records.filter((record: ScrapedRecord) => {
        // Check if any field contains "Month of"
        const hasMonthOf = Object.values(record).some(
          value => typeof value === 'string' && value.includes('Month of')
        )
        return !hasMonthOf
      })

      logger.info('CSV parsed and filtered', {
        totalRecords: records.length,
        filteredRecords: filteredRecords.length,
        removedRecords: records.length - filteredRecords.length,
      })

      return filteredRecords
    } catch (error) {
      logger.error('Failed to parse CSV', error)
      throw new Error(
        `CSV parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Extract closing period information from CSV footer line
   * Footer format: "Month of Dec, As of 01/06/2026"
   * Returns the data month and collection date if found
   */
  private extractClosingPeriodFromCSV(csvContent: string): {
    dataMonth?: string
    collectionDate?: string
  } | null {
    try {
      // Look for the footer line in the last few lines of the CSV
      const lines = csvContent.trim().split('\n')
      const lastLine = lines[lines.length - 1]

      if (!lastLine) {
        return null
      }

      // Match pattern: "Month of MMM, As of MM/DD/YYYY"
      const match = lastLine.match(
        /Month of ([A-Za-z]+),\s*As of (\d{2})\/(\d{2})\/(\d{4})/
      )

      if (!match) {
        return null
      }

      const monthName = match[1]
      const collectionMonth = match[2]
      const collectionDay = match[3]
      const collectionYear = match[4]

      if (!monthName || !collectionMonth || !collectionDay || !collectionYear) {
        return null
      }

      // Convert month name to number
      const monthMap: { [key: string]: number } = {
        Jan: 1,
        Feb: 2,
        Mar: 3,
        Apr: 4,
        May: 5,
        Jun: 6,
        Jul: 7,
        Aug: 8,
        Sep: 9,
        Oct: 10,
        Nov: 11,
        Dec: 12,
      }

      const dataMonthNum = monthMap[monthName]
      if (!dataMonthNum) {
        logger.warn('Could not parse month name from CSV footer', {
          monthName,
          lastLine,
        })
        return null
      }

      // Determine the year for the data month
      // If collection is in January and data is December, year is previous year
      const collectionMonthNum = parseInt(collectionMonth, 10)
      const collectionYearNum = parseInt(collectionYear, 10)
      const dataYear =
        collectionMonthNum === 1 && dataMonthNum === 12
          ? collectionYearNum - 1
          : collectionYearNum

      const dataMonth = `${dataYear}-${String(dataMonthNum).padStart(2, '0')}`
      const collectionDate = `${collectionYear}-${collectionMonth}-${collectionDay}`

      logger.info('Extracted closing period info from CSV footer', {
        dataMonth,
        collectionDate,
        footerLine: lastLine,
      })

      return { dataMonth, collectionDate }
    } catch (error) {
      logger.warn('Failed to extract closing period from CSV footer', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      return null
    }
  }

  /**
   * Fetch all districts list (just names and IDs from dropdown)
   */
  async getAllDistrictsList(): Promise<DistrictInfo[]> {
    const browser = await this.initBrowser()
    const page = await browser.newPage()

    try {
      logger.info('Fetching all districts from dropdown')
      await page.goto(this.config.baseUrl, {
        waitUntil: 'networkidle',
        timeout: this.config.timeout,
      })

      // Find the district dropdown/select element
      const districtOptions = await page.$$eval(
        'select option, option',
        options =>
          options
            .map(opt => opt.textContent?.trim() || '')
            .filter(text => text.match(/^District\s+(\d+|[A-Z])$/i))
      )

      const districts = districtOptions
        .map(text => {
          const match = text.match(/^District\s+(\d+|[A-Z])$/i)
          if (match) {
            return {
              id: match[1],
              name: text,
            }
          }
          return null
        })
        .filter(d => d !== null)

      logger.info('Districts fetched from dropdown', {
        count: districts.length,
      })
      return districts
    } finally {
      await page.close()
    }
  }

  /**
   * Fetch all districts with performance data from CSV export
   */
  async getAllDistricts(dateString?: string): Promise<ScrapedRecord[]> {
    const downloadFn = async (): Promise<{
      content: string
      actualDate: string
    }> => {
      const browser = await this.initBrowser()
      const page = await browser.newPage()

      try {
        if (dateString) {
          // Use the existing getAllDistrictsForDate logic for specific dates
          return await this.downloadAllDistrictsForDate(page, dateString)
        } else {
          // Use current data logic
          logger.info('Fetching all districts summary with performance data')
          await page.goto(this.config.baseUrl, {
            waitUntil: 'networkidle',
            timeout: this.config.timeout,
          })

          const content = await this.downloadCsv(page)
          const actualDate = this.getCurrentDateString()
          return { content, actualDate }
        }
      } finally {
        await page.close()
      }
    }

    const csvContent = await this.getCachedOrDownload(
      CSVType.ALL_DISTRICTS,
      downloadFn,
      dateString
    )

    const records = this.parseCsv(csvContent)
    logger.info('All districts performance data fetched', {
      dateString,
      count: records.length,
    })
    return records
  }

  /**
   * Fetch all districts with performance data from CSV export
   * Returns both the records and the actual "As of" date from the dashboard
   *
   * IMPORTANT: The actualDate is the date the dashboard data represents,
   * which is always 1-2 days behind the current date. Snapshots MUST be
   * stored using this actualDate, not the date the refresh was run.
   */
  async getAllDistrictsWithMetadata(dateString?: string): Promise<{
    records: ScrapedRecord[]
    actualDate: string
  }> {
    const downloadFn = async (): Promise<{
      content: string
      actualDate: string
    }> => {
      const browser = await this.initBrowser()
      const page = await browser.newPage()

      try {
        if (dateString) {
          // Use the existing getAllDistrictsForDate logic for specific dates
          return await this.downloadAllDistrictsForDate(page, dateString)
        } else {
          // Use current data logic - get the actual date from the dashboard
          logger.info('Fetching all districts summary with performance data')
          await page.goto(this.config.baseUrl, {
            waitUntil: 'networkidle',
            timeout: this.config.timeout,
          })

          // Get the actual "As of" date from the dashboard dropdown
          const selectedDate = await this.getSelectedDate(page)
          const actualDate =
            selectedDate?.dateString || this.getCurrentDateString()

          const content = await this.downloadCsv(page)
          return { content, actualDate }
        }
      } finally {
        await page.close()
      }
    }

    const { content, actualDate } = await this.getCachedOrDownloadWithDate(
      CSVType.ALL_DISTRICTS,
      downloadFn,
      dateString
    )

    const records = this.parseCsv(content)
    logger.info('All districts performance data fetched with metadata', {
      requestedDate: dateString,
      actualDate,
      count: records.length,
    })
    return { records, actualDate }
  }

  /**
   * Helper method to download all districts data for a specific date
   * Implements month-end reconciliation fallback: if the requested date isn't available
   * in the current month's dropdown, tries the previous month (since month-end data
   * often appears under the prior month during reconciliation periods).
   */
  private async downloadAllDistrictsForDate(
    page: Page,
    dateString: string
  ): Promise<{ content: string; actualDate: string }> {
    // Parse the date string (YYYY-MM-DD)
    const dateObj = new Date(dateString + 'T00:00:00')
    const month = dateObj.getMonth() + 1 // 1-12
    const day = dateObj.getDate()
    const year = dateObj.getFullYear()

    // Format as mm/dd/yyyy (no zero padding for month/day)
    const formattedDate = `${month}/${day}/${year}`

    logger.info('Fetching all districts summary for specific date', {
      dateString,
      formattedDate,
    })

    // Build URL with program year and date (no id = all districts)
    const baseUrl = this.buildBaseUrl(dateString)
    const url = `${baseUrl}/Default.aspx?month=${month}&day=${formattedDate}`
    logger.info('Navigating to URL', { url })
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: this.config.timeout,
    })

    // Log the page title for debugging
    const title = await page.title()
    logger.info('Page loaded', { title, url: page.url() })

    // Try to verify the date, but don't fail if we can't
    const actualDate = await this.getSelectedDate(page)
    let actualDateString = dateString // Default to requested date

    if (actualDate) {
      const {
        month: actualMonth,
        day: actualDay,
        year: actualYear,
        dateString: dashboardDateString,
      } = actualDate

      actualDateString = dashboardDateString

      // Check if we got the requested date
      if (actualMonth === month && actualDay === day && actualYear === year) {
        logger.info('Date verification successful', {
          requested: dateString,
          actual: actualDateString,
        })
      } else {
        // Date mismatch - try previous month fallback for month-end reconciliation
        // During month-end reconciliation, dates like Oct 1 may appear under September's data
        logger.info(
          'Date mismatch detected, trying previous month fallback for month-end reconciliation',
          {
            requested: { month, day, year, dateString },
            actual: {
              month: actualMonth,
              day: actualDay,
              year: actualYear,
              dateString: actualDateString,
            },
          }
        )

        // Calculate previous month and handle program year boundary
        // When falling back from July (month 7) to June (month 6), we cross the program year boundary
        // June belongs to the previous program year (e.g., July 2025 is in 2025-2026, but June 2025 is in 2024-2025)
        const prevMonth = month === 1 ? 12 : month - 1
        const prevMonthYear = month === 1 ? year - 1 : year
        const crossesProgramYearBoundary = month === 7 // July to June crosses program year boundary

        // Build fallback URL - use previous program year's base URL if crossing boundary
        let fallbackBaseUrl = baseUrl
        if (crossesProgramYearBoundary) {
          // Construct date string for previous month to get correct program year
          const prevMonthDateString = `${prevMonthYear}-${String(prevMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          fallbackBaseUrl = this.buildBaseUrl(prevMonthDateString)
          logger.info('Crossing program year boundary - using previous program year URL', {
            originalBaseUrl: baseUrl,
            fallbackBaseUrl,
            prevMonthDateString,
          })
        }

        const fallbackUrl = `${fallbackBaseUrl}/Default.aspx?month=${prevMonth}&day=${formattedDate}`

        logger.info('Trying previous month fallback URL', {
          fallbackUrl,
          prevMonth,
          prevMonthYear,
          crossesProgramYearBoundary,
        })

        await page.goto(fallbackUrl, {
          waitUntil: 'networkidle',
          timeout: this.config.timeout,
        })

        // Verify the date again
        const fallbackDate = await this.getSelectedDate(page)
        if (fallbackDate) {
          const {
            month: fbMonth,
            day: fbDay,
            year: fbYear,
            dateString: fbDateString,
          } = fallbackDate

          if (fbMonth === month && fbDay === day && fbYear === year) {
            logger.info(
              'Previous month fallback successful - found date in month-end reconciliation data',
              {
                requested: dateString,
                actual: fbDateString,
                usedMonth: prevMonth,
              }
            )
            actualDateString = fbDateString
          } else {
            // Fallback also didn't work - this date truly isn't available
            logger.warn(
              'Previous month fallback also returned different date - date not available',
              {
                requested: { month, day, year, dateString },
                fallbackActual: {
                  month: fbMonth,
                  day: fbDay,
                  year: fbYear,
                  dateString: fbDateString,
                },
              }
            )
            // Keep the original mismatch behavior - return what we got
            actualDateString = dashboardDateString
          }
        } else {
          logger.warn(
            'Could not verify date after fallback attempt, using original result',
            { dateString }
          )
        }
      }
    } else {
      logger.warn('Could not verify date from dropdown, proceeding anyway', {
        dateString,
      })
    }

    // Download CSV with the selected date
    const content = await this.downloadCsv(page)
    return { content, actualDate: actualDateString }
  }

  /**
   * Fetch all districts with performance data for a specific date
   * @param dateString Date in YYYY-MM-DD format
   */
  async getAllDistrictsForDate(dateString: string): Promise<ScrapedRecord[]> {
    const browser = await this.initBrowser()
    const page = await browser.newPage()

    try {
      // Parse the date string (YYYY-MM-DD)
      const dateObj = new Date(dateString + 'T00:00:00')
      const month = dateObj.getMonth() + 1 // 1-12
      const day = dateObj.getDate()
      const year = dateObj.getFullYear()

      // Format as mm/dd/yyyy (no zero padding for month/day)
      const formattedDate = `${month}/${day}/${year}`

      logger.info('Fetching all districts summary for specific date', {
        dateString,
        formattedDate,
      })

      // Build URL with program year and date (no id = all districts)
      const baseUrl = this.buildBaseUrl(dateString)
      const url = `${baseUrl}/Default.aspx?month=${month}&day=${formattedDate}`
      logger.info('Navigating to URL', { url })
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: this.config.timeout,
      })

      // Log the page title for debugging
      const title = await page.title()
      logger.info('Page loaded', { title, url: page.url() })

      // Try to verify the date, but don't fail if we can't
      const actualDate = await this.getSelectedDate(page)
      if (actualDate) {
        const {
          month: actualMonth,
          day: actualDay,
          year: actualYear,
          dateString: actualDateString,
        } = actualDate
        if (actualMonth !== month || actualDay !== day || actualYear !== year) {
          logger.warn(
            'Requested date not available, dashboard returned different date',
            {
              requested: { month, day, year, dateString },
              actual: {
                month: actualMonth,
                day: actualDay,
                year: actualYear,
                dateString: actualDateString,
              },
            }
          )
          throw new Error(
            `Date ${dateString} not available (dashboard returned ${actualDateString})`
          )
        }
        logger.info('Date verification successful', {
          requested: dateString,
          actual: actualDateString,
        })
      } else {
        logger.warn('Could not verify date from dropdown, proceeding anyway', {
          dateString,
        })
      }

      // Download CSV with the selected date
      const csvContent = await this.downloadCsv(page)
      const records = this.parseCsv(csvContent)

      logger.info('All districts performance data fetched for date', {
        dateString,
        count: records.length,
      })
      return records
    } finally {
      await page.close()
    }
  }

  /**
   * Get the currently selected date from the dashboard
   * Returns the date that's actually displayed (e.g., "As of 27-Jul-2025")
   */
  private async getSelectedDate(page: Page): Promise<{
    month: number
    day: number
    year: number
    dateString: string
  } | null> {
    try {
      // Get all select elements on the page
      const allSelects = await page.$$('select')
      logger.info('Found select elements on page', { count: allSelects.length })

      // The date dropdown is typically the last select element (after district, year, month)
      // Try to find it by looking for "As of" in the selected option text
      let daySelect = null

      for (const select of allSelects) {
        const selectedText = await select.evaluate(el => {
          const selectElement = el as {
            options: Array<{ text: string }>
            selectedIndex: number
          }
          const selectedOption =
            selectElement.options[selectElement.selectedIndex]
          return selectedOption ? selectedOption.text : null
        })

        if (selectedText && selectedText.includes('As of')) {
          daySelect = select
          logger.info('Found date dropdown', { selectedText })
          break
        }
      }

      if (!daySelect) {
        logger.warn('Day dropdown not found on page')
        return null
      }

      // Get the selected option text (e.g., "As of 10-Oct-2025")
      const selectedText = await daySelect.evaluate(select => {
        const selectElement = select as {
          options: Array<{ text: string }>
          selectedIndex: number
        }
        const selectedOption =
          selectElement.options[selectElement.selectedIndex]
        return selectedOption ? selectedOption.text : null
      })

      if (!selectedText) {
        logger.warn('No selected text in day dropdown')
        return null
      }

      logger.info('Day dropdown selected text', { selectedText })

      // Parse the date from "As of dd-MMM-yyyy" format
      // Try multiple patterns to be more flexible
      let match = selectedText.match(/As of (\d+)-([A-Za-z]+)-(\d{4})/)
      if (!match) {
        // Try without "As of" prefix
        match = selectedText.match(/(\d+)-([A-Za-z]+)-(\d{4})/)
      }
      if (!match) {
        // Try with slashes
        match = selectedText.match(/(\d+)\/(\d+)\/(\d{4})/)
        if (match) {
          // This is mm/dd/yyyy format
          const monthStr = match[1]
          const dayStr = match[2]
          const yearStr = match[3]
          if (!monthStr || !dayStr || !yearStr) {
            logger.warn('Invalid date components in slash format', {
              selectedText,
            })
            return null
          }
          const month = parseInt(monthStr, 10)
          const day = parseInt(dayStr, 10)
          const year = parseInt(yearStr, 10)
          // Format as ISO date string (YYYY-MM-DD)
          const isoDateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          return { month, day, year, dateString: isoDateString }
        }
      }

      if (!match) {
        logger.warn('Could not parse date from dropdown text', { selectedText })
        return null
      }

      const dayStr = match[1]
      const monthName = match[2]
      const yearStr = match[3]

      if (!dayStr || !monthName || !yearStr) {
        logger.warn('Invalid date components in match', { selectedText, match })
        return null
      }

      const day = parseInt(dayStr, 10)
      const year = parseInt(yearStr, 10)

      // Convert month name to number
      const monthMap: { [key: string]: number } = {
        Jan: 1,
        Feb: 2,
        Mar: 3,
        Apr: 4,
        May: 5,
        Jun: 6,
        Jul: 7,
        Aug: 8,
        Sep: 9,
        Oct: 10,
        Nov: 11,
        Dec: 12,
      }
      const month = monthMap[monthName]

      if (!month) {
        logger.warn('Could not parse month from dropdown text', {
          monthName,
          selectedText,
        })
        return null
      }

      // Format as ISO date string (YYYY-MM-DD)
      const isoDateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

      logger.info('Successfully parsed date', {
        month,
        day,
        year,
        selectedText,
        isoDateString,
      })
      return { month, day, year, dateString: isoDateString }
    } catch (error) {
      logger.error('Failed to get selected date', error)
      return null
    }
  }

  /**
   * Fetch district performance data
   */
  async getDistrictPerformance(
    districtId: string,
    dateString?: string
  ): Promise<ScrapedRecord[]> {
    const downloadFn = async (): Promise<{
      content: string
      actualDate: string
    }> => {
      const browser = await this.initBrowser()
      const page = await browser.newPage()

      try {
        let actualDateString = dateString || this.getCurrentDateString()

        if (dateString) {
          // Use the fallback-enabled navigation for historical dates
          const baseUrl = this.buildBaseUrl(dateString)
          const navResult = await this.navigateToDateWithFallback(
            page,
            baseUrl,
            'District.aspx',
            dateString,
            districtId
          )

          // For district performance, we accept the data even if date doesn't match
          // (closing period behavior) but log it
          actualDateString = navResult.actualDateString

          if (navResult.usedFallback) {
            logger.info(
              'District performance: used month-end reconciliation fallback',
              {
                districtId,
                requestedDate: dateString,
                actualDate: actualDateString,
                success: navResult.success,
              }
            )
          } else if (!navResult.success) {
            logger.info(
              'Month-end closing period detected - dashboard returned different date',
              {
                districtId,
                requestedDate: dateString,
                actualDate: actualDateString,
              }
            )
          }
        } else {
          // No date specified, use current data
          const url = `${this.config.baseUrl}/District.aspx?id=${districtId}`
          logger.info('Fetching district performance', {
            districtId,
            dateString,
            url,
          })

          await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: this.config.timeout,
          })
        }

        const content = await this.downloadCsv(page)
        return { content, actualDate: actualDateString }
      } finally {
        await page.close()
      }
    }

    const csvContent = await this.getCachedOrDownload(
      CSVType.DISTRICT_PERFORMANCE,
      downloadFn,
      dateString,
      districtId
    )

    const records = this.parseCsv(csvContent)
    logger.info('District performance fetched', {
      districtId,
      dateString,
      count: records.length,
    })
    return records
  }

  /**
   * Fetch division and area performance
   */
  async getDivisionPerformance(
    districtId: string,
    dateString?: string
  ): Promise<ScrapedRecord[]> {
    const downloadFn = async (): Promise<{
      content: string
      actualDate: string
    }> => {
      const browser = await this.initBrowser()
      const page = await browser.newPage()

      try {
        let actualDateString = dateString || this.getCurrentDateString()

        if (dateString) {
          // Use the fallback-enabled navigation for historical dates
          const baseUrl = this.buildBaseUrl(dateString)
          const navResult = await this.navigateToDateWithFallback(
            page,
            baseUrl,
            'Division.aspx',
            dateString,
            districtId
          )

          // Accept the data even if date doesn't match (closing period behavior)
          // The dashboard may return a different date during month-end reconciliation
          actualDateString = navResult.actualDateString

          if (navResult.usedFallback) {
            logger.info(
              'Division performance: used month-end reconciliation fallback',
              {
                districtId,
                requestedDate: dateString,
                actualDate: actualDateString,
                success: navResult.success,
              }
            )
          } else if (!navResult.success) {
            logger.info(
              'Division performance: month-end closing period detected - dashboard returned different date',
              {
                districtId,
                requestedDate: dateString,
                actualDate: actualDateString,
              }
            )
          }
        } else {
          // No date specified, use current data
          const url = `${this.config.baseUrl}/Division.aspx?id=${districtId}`
          logger.info('Fetching division performance', {
            districtId,
            dateString,
            url,
          })

          await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: this.config.timeout,
          })
        }

        const content = await this.downloadCsv(page)
        return { content, actualDate: actualDateString }
      } finally {
        await page.close()
      }
    }

    const csvContent = await this.getCachedOrDownload(
      CSVType.DIVISION_PERFORMANCE,
      downloadFn,
      dateString,
      districtId
    )

    const records = this.parseCsv(csvContent)
    logger.info('Division performance fetched', {
      districtId,
      dateString,
      count: records.length,
    })
    return records
  }

  /**
   * Fetch club performance data
   */
  async getClubPerformance(
    districtId: string,
    dateString?: string
  ): Promise<ScrapedRecord[]> {
    const downloadFn = async (): Promise<{
      content: string
      actualDate: string
    }> => {
      const browser = await this.initBrowser()
      const page = await browser.newPage()

      try {
        let actualDateString = dateString || this.getCurrentDateString()

        if (dateString) {
          // Use the fallback-enabled navigation for historical dates
          const baseUrl = this.buildBaseUrl(dateString)
          const navResult = await this.navigateToDateWithFallback(
            page,
            baseUrl,
            'Club.aspx',
            dateString,
            districtId
          )

          // Accept the data even if date doesn't match (closing period behavior)
          // The dashboard may return a different date during month-end reconciliation
          actualDateString = navResult.actualDateString

          if (navResult.usedFallback) {
            logger.info(
              'Club performance: used month-end reconciliation fallback',
              {
                districtId,
                requestedDate: dateString,
                actualDate: actualDateString,
                success: navResult.success,
              }
            )
          } else if (!navResult.success) {
            logger.info(
              'Club performance: month-end closing period detected - dashboard returned different date',
              {
                districtId,
                requestedDate: dateString,
                actualDate: actualDateString,
              }
            )
          }
        } else {
          // No date specified, use current data
          const url = `${this.config.baseUrl}/Club.aspx?id=${districtId}`
          logger.info('Fetching club performance', {
            districtId,
            dateString,
            url,
          })

          await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: this.config.timeout,
          })
        }

        const content = await this.downloadCsv(page)
        return { content, actualDate: actualDateString }
      } finally {
        await page.close()
      }
    }

    const csvContent = await this.getCachedOrDownload(
      CSVType.CLUB_PERFORMANCE,
      downloadFn,
      dateString,
      districtId
    )

    const records = this.parseCsv(csvContent)
    logger.info('Club performance fetched', {
      districtId,
      dateString,
      count: records.length,
    })
    return records
  }

  /**
   * Scrape page content directly (for pages without CSV export)
   */
  async scrapePage(url: string, selector: string): Promise<string> {
    const browser = await this.initBrowser()
    const page = await browser.newPage()

    try {
      logger.info('Scraping page', { url, selector })
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: this.config.timeout,
      })

      const content = await page.textContent(selector)
      return content || ''
    } finally {
      await page.close()
    }
  }
}
