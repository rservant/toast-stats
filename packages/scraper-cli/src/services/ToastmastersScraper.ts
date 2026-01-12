/**
 * Toastmasters Dashboard Scraper
 *
 * Standalone scraper for the Scraper CLI package.
 * Uses Playwright to scrape data from https://dashboards.toastmasters.org
 *
 * Requirements:
 * - 8.3: THE ToastmastersScraper class SHALL be moved to the Scraper_CLI package
 * - 5.1: THE Scraper_CLI SHALL operate without requiring the backend to be running
 */

import { chromium, Browser, Page } from 'playwright'
import { parse } from 'csv-parse/sync'
import { logger } from '../utils/logger.js'
import type {
  ScrapedRecord,
  DistrictInfo,
  CSVType,
  IScraperCache,
} from '../types/scraper.js'

interface ScraperConfig {
  baseUrl: string
  headless: boolean
  timeout: number
}

export class ToastmastersScraper {
  private config: ScraperConfig
  private browser: Browser | null = null
  private cache: IScraperCache | null

  constructor(cache?: IScraperCache) {
    this.config = {
      baseUrl:
        process.env['TOASTMASTERS_DASHBOARD_URL'] ||
        'https://dashboards.toastmasters.org',
      headless: true,
      timeout: 30000,
    }
    this.cache = cache ?? null

    logger.debug('ToastmastersScraper initialized', {
      hasCache: !!cache,
    })
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

    // If no cache is configured, just download
    if (!this.cache) {
      logger.info('No cache configured - downloading directly', {
        csvType,
        date: requestedDate,
        districtId,
      })
      return downloadFn()
    }

    try {
      // Check cache first
      const cachedContent = await this.cache.getCachedCSV(
        requestedDate,
        csvType,
        districtId
      )

      if (cachedContent) {
        // Get the actual date from cache metadata
        const cacheMetadata = await this.cache.getCacheMetadata(requestedDate)
        const actualDate = cacheMetadata?.date || requestedDate

        // Always extract closing period info from CSV footer (most reliable source)
        const footerInfo = this.extractClosingPeriodFromCSV(cachedContent)

        if (footerInfo && footerInfo.dataMonth) {
          const collectionDateStr = footerInfo.collectionDate || actualDate
          const collectionDateObj = new Date(collectionDateStr + 'T00:00:00')
          const collectionMonth = `${collectionDateObj.getFullYear()}-${String(collectionDateObj.getMonth() + 1).padStart(2, '0')}`
          const isClosingPeriod = collectionMonth !== footerInfo.dataMonth

          const metadataNeedsUpdate =
            !cacheMetadata ||
            cacheMetadata.isClosingPeriod !== isClosingPeriod ||
            cacheMetadata.dataMonth !== footerInfo.dataMonth

          if (metadataNeedsUpdate) {
            await this.cache.setCachedCSVWithMetadata(
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
      const datesDiffer = requestedDate !== actualDate

      let isClosingPeriod = datesDiffer
      let dataMonth: string

      if (footerInfo && footerInfo.dataMonth) {
        dataMonth = footerInfo.dataMonth

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
        const requestedDateObj = new Date(requestedDate + 'T00:00:00')
        dataMonth = `${requestedDateObj.getFullYear()}-${String(requestedDateObj.getMonth() + 1).padStart(2, '0')}`
      }

      // Cache the downloaded content with enhanced metadata
      await this.cache.setCachedCSVWithMetadata(
        actualDate,
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
   */
  private getProgramYear(dateString: string): string {
    const date = new Date(dateString + 'T00:00:00')
    const year = date.getFullYear()
    const month = date.getMonth() + 1

    if (month >= 7) {
      return `${year}-${year + 1}`
    } else {
      return `${year - 1}-${year}`
    }
  }

  /**
   * Build the base URL with program year
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
    const month = dateObj.getMonth() + 1
    const day = dateObj.getDate()
    const year = dateObj.getFullYear()
    const formattedDate = `${month}/${day}/${year}`

    const districtParam = districtId ? `id=${districtId}&` : ''
    const url = `${baseUrl}/${pageName}?${districtParam}month=${month}&day=${formattedDate}`

    logger.info('Navigating to URL for date', { url, dateString })
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: this.config.timeout,
    })

    const actualDate = await this.getSelectedDate(page)
    if (!actualDate) {
      logger.warn('Could not verify date from dropdown', { dateString })
      return {
        success: true,
        actualDateString: dateString,
        usedFallback: false,
      }
    }

    const {
      month: actualMonth,
      day: actualDay,
      year: actualYear,
      dateString: dashboardDateString,
    } = actualDate

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

    const prevMonth = month === 1 ? 12 : month - 1
    const prevMonthYear = month === 1 ? year - 1 : year
    const crossesProgramYearBoundary = month === 7

    let fallbackBaseUrl = baseUrl
    if (crossesProgramYearBoundary) {
      const prevMonthDateString = `${prevMonthYear}-${String(prevMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      fallbackBaseUrl = this.buildBaseUrl(prevMonthDateString)
      logger.info(
        'Crossing program year boundary - using previous program year URL',
        {
          originalBaseUrl: baseUrl,
          fallbackBaseUrl,
          prevMonthDateString,
        }
      )
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
        return {
          success: true,
          actualDateString: fbDateString,
          usedFallback: true,
        }
      }
    }

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
      await page.waitForLoadState('networkidle', {
        timeout: this.config.timeout,
      })

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

      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: this.config.timeout }),
        exportSelect.selectOption({ label: 'CSV' }),
      ])

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
        relax_column_count: true,
        relax_quotes: true,
      }) as ScrapedRecord[]

      const filteredRecords = records.filter((record: ScrapedRecord) => {
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
   */
  private extractClosingPeriodFromCSV(csvContent: string): {
    dataMonth?: string
    collectionDate?: string
  } | null {
    try {
      const lines = csvContent.trim().split('\n')
      const lastLine = lines[lines.length - 1]

      if (!lastLine) {
        return null
      }

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

      const districtOptions = await page.$$eval(
        'select option',
        (options: Element[]) =>
          options
            .map(
              (opt: Element) =>
                (opt as HTMLOptionElement).textContent?.trim() || ''
            )
            .filter((text: string) => text.match(/^District\s+(\d+|[A-Z])$/i))
      )

      const districts = districtOptions
        .map((text: string) => {
          const match = text.match(/^District\s+(\d+|[A-Z])$/i)
          if (match) {
            return {
              id: match[1] ?? '',
              name: text,
            }
          }
          return null
        })
        .filter((d): d is DistrictInfo => d !== null)

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
          return await this.downloadAllDistrictsForDate(page, dateString)
        } else {
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
      'all-districts' as CSVType,
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
          return await this.downloadAllDistrictsForDate(page, dateString)
        } else {
          logger.info('Fetching all districts summary with performance data')
          await page.goto(this.config.baseUrl, {
            waitUntil: 'networkidle',
            timeout: this.config.timeout,
          })

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
      'all-districts' as CSVType,
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
   */
  private async downloadAllDistrictsForDate(
    page: Page,
    dateString: string
  ): Promise<{ content: string; actualDate: string }> {
    const dateObj = new Date(dateString + 'T00:00:00')
    const month = dateObj.getMonth() + 1
    const day = dateObj.getDate()
    const year = dateObj.getFullYear()
    const formattedDate = `${month}/${day}/${year}`

    logger.info('Fetching all districts summary for specific date', {
      dateString,
      formattedDate,
    })

    const baseUrl = this.buildBaseUrl(dateString)
    const url = `${baseUrl}/Default.aspx?month=${month}&day=${formattedDate}`
    logger.info('Navigating to URL', { url })
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: this.config.timeout,
    })

    const title = await page.title()
    logger.info('Page loaded', { title, url: page.url() })

    const actualDate = await this.getSelectedDate(page)
    let actualDateString = dateString

    if (actualDate) {
      const {
        month: actualMonth,
        day: actualDay,
        year: actualYear,
        dateString: dashboardDateString,
      } = actualDate

      actualDateString = dashboardDateString

      if (actualMonth === month && actualDay === day && actualYear === year) {
        logger.info('Date verification successful', {
          requested: dateString,
          actual: actualDateString,
        })
      } else {
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

        const prevMonth = month === 1 ? 12 : month - 1
        const prevMonthYear = month === 1 ? year - 1 : year
        const crossesProgramYearBoundary = month === 7

        let fallbackBaseUrl = baseUrl
        if (crossesProgramYearBoundary) {
          const prevMonthDateString = `${prevMonthYear}-${String(prevMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          fallbackBaseUrl = this.buildBaseUrl(prevMonthDateString)
          logger.info(
            'Crossing program year boundary - using previous program year URL',
            {
              originalBaseUrl: baseUrl,
              fallbackBaseUrl,
              prevMonthDateString,
            }
          )
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

    const content = await this.downloadCsv(page)
    return { content, actualDate: actualDateString }
  }

  /**
   * Fetch all districts with performance data for a specific date
   */
  async getAllDistrictsForDate(dateString: string): Promise<ScrapedRecord[]> {
    const browser = await this.initBrowser()
    const page = await browser.newPage()

    try {
      const dateObj = new Date(dateString + 'T00:00:00')
      const month = dateObj.getMonth() + 1
      const day = dateObj.getDate()
      const year = dateObj.getFullYear()
      const formattedDate = `${month}/${day}/${year}`

      logger.info('Fetching all districts summary for specific date', {
        dateString,
        formattedDate,
      })

      const baseUrl = this.buildBaseUrl(dateString)
      const url = `${baseUrl}/Default.aspx?month=${month}&day=${formattedDate}`
      logger.info('Navigating to URL', { url })
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: this.config.timeout,
      })

      const title = await page.title()
      logger.info('Page loaded', { title, url: page.url() })

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
   */
  private async getSelectedDate(page: Page): Promise<{
    month: number
    day: number
    year: number
    dateString: string
  } | null> {
    try {
      const allSelects = await page.$$('select')
      logger.info('Found select elements on page', { count: allSelects.length })

      let daySelect = null

      for (const select of allSelects) {
        const selectedText = await select.evaluate(el => {
          const selectElement = el as HTMLSelectElement
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

      const selectedText = await daySelect.evaluate(select => {
        const selectElement = select as HTMLSelectElement
        const selectedOption =
          selectElement.options[selectElement.selectedIndex]
        return selectedOption ? selectedOption.text : null
      })

      if (!selectedText) {
        logger.warn('No selected text in day dropdown')
        return null
      }

      logger.info('Day dropdown selected text', { selectedText })

      let match = selectedText.match(/As of (\d+)-([A-Za-z]+)-(\d{4})/)
      if (!match) {
        match = selectedText.match(/(\d+)-([A-Za-z]+)-(\d{4})/)
      }
      if (!match) {
        match = selectedText.match(/(\d+)\/(\d+)\/(\d{4})/)
        if (match) {
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
          const baseUrl = this.buildBaseUrl(dateString)
          const navResult = await this.navigateToDateWithFallback(
            page,
            baseUrl,
            'District.aspx',
            dateString,
            districtId
          )

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
      'district-performance' as CSVType,
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
          const baseUrl = this.buildBaseUrl(dateString)
          const navResult = await this.navigateToDateWithFallback(
            page,
            baseUrl,
            'Division.aspx',
            dateString,
            districtId
          )

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
      'division-performance' as CSVType,
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
          const baseUrl = this.buildBaseUrl(dateString)
          const navResult = await this.navigateToDateWithFallback(
            page,
            baseUrl,
            'Club.aspx',
            dateString,
            districtId
          )

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
      'club-performance' as CSVType,
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
