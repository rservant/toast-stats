/**
 * HTTP-based CSV Downloader for Toastmasters Dashboard
 *
 * Downloads CSV exports directly via HTTP GET requests to the dashboard's
 * export.aspx endpoint, bypassing the need for Playwright browser automation.
 *
 * URL pattern:
 *   https://dashboards.toastmasters.org/{programYear}/export.aspx?type=CSV&report={reportName}
 *
 * Report name patterns:
 *   - districtsummary~{date}~~{programYear}
 *   - districtperformance~{districtId}~{date}~~{programYear}
 *   - divisionperformance~{districtId}~{date}~~{programYear}
 *   - clubperformance~{districtId}~{date}~~{programYear}
 *
 * Requirements (#123):
 *   - Direct HTTP GET (no auth, no cookies, no session)
 *   - Configurable rate limiting
 *   - Resume-capable (skip already-cached files)
 *   - Parse district list from summary CSV
 */

import { parse } from 'csv-parse/sync'
import { logger } from '../utils/logger.js'

const BASE_URL = 'https://dashboards.toastmasters.org'

export type ReportType =
  | 'districtsummary'
  | 'districtperformance'
  | 'divisionperformance'
  | 'clubperformance'

export type DateFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly'

export interface BackfillDateSpec {
  programYear: string
  reportType: ReportType
  districtId?: string
  date: Date
}

export interface HttpCsvDownloaderConfig {
  ratePerSecond: number
  cooldownEvery?: number // pause after this many requests
  cooldownMs?: number // pause duration in ms
  maxRetries?: number
}

interface DownloadResult {
  url: string
  content: string
  statusCode: number
  byteSize: number
}

/**
 * Format a Date as M/D/YYYY (no zero-padding) for the dashboard URL.
 */
function formatDateForUrl(date: Date): string {
  const month = date.getMonth() + 1
  const day = date.getDate()
  const year = date.getFullYear()
  return `${month}/${day}/${year}`
}

/**
 * Build the full export URL for a given report specification.
 */
export function buildExportUrl(spec: BackfillDateSpec): string {
  const dateStr = formatDateForUrl(spec.date)
  let reportName: string

  if (spec.reportType === 'districtsummary') {
    reportName = `districtsummary~${dateStr}~~${spec.programYear}`
  } else {
    if (!spec.districtId) {
      throw new Error(
        `districtId is required for report type: ${spec.reportType}`
      )
    }
    reportName = `${spec.reportType}~${spec.districtId}~${dateStr}~~${spec.programYear}`
  }

  return `${BASE_URL}/${spec.programYear}/export.aspx?type=CSV&report=${reportName}`
}

/**
 * HTTP-based CSV downloader with rate limiting and retry logic.
 */
export class HttpCsvDownloader {
  private readonly config: HttpCsvDownloaderConfig
  private requestCount = 0
  private lastRequestTime = 0

  constructor(config: HttpCsvDownloaderConfig) {
    this.config = {
      cooldownEvery: 100,
      cooldownMs: 5000,
      maxRetries: 3,
      ...config,
    }
  }

  /**
   * Generate a range of program year strings (e.g., ['2017-2018', '2018-2019', ...]).
   */
  getProgramYearRange(startYear: number, endYear: number): string[] {
    const years: string[] = []
    for (let y = startYear; y <= endYear; y++) {
      years.push(`${y}-${y + 1}`)
    }
    return years
  }

  /**
   * Generate a grid of dates for a program year at the specified frequency.
   * The program year runs from July 1 to June 30.
   * The last date is always June 30 of the end year.
   */
  generateDateGrid(programYear: string, frequency: DateFrequency): Date[] {
    const startYear = parseInt(programYear.split('-')[0]!, 10)
    const start = new Date(startYear, 6, 1) // July 1
    const end = new Date(startYear + 1, 5, 30) // June 30

    const intervalDays =
      frequency === 'daily'
        ? 1
        : frequency === 'weekly'
          ? 7
          : frequency === 'biweekly'
            ? 14
            : 30 // monthly approximation

    const dates: Date[] = []
    const current = new Date(start)

    while (current <= end) {
      dates.push(new Date(current))
      current.setDate(current.getDate() + intervalDays)
    }

    // Always include the year-end date (June 30)
    const lastDate = dates[dates.length - 1]
    if (lastDate && (lastDate.getMonth() !== 5 || lastDate.getDate() !== 30)) {
      dates.push(new Date(end))
    }

    return dates
  }

  /**
   * Parse district IDs from an all-districts summary CSV.
   * The CSV has a "DISTRICT" column with district IDs.
   */
  parseDistrictsFromSummary(csvContent: string): string[] {
    if (!csvContent.trim()) return []

    try {
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
      }) as Record<string, string>[]

      const districtIds = new Set<string>()
      for (const record of records) {
        const districtId = record['DISTRICT']?.trim()
        if (districtId) {
          districtIds.add(districtId)
        }
      }

      return Array.from(districtIds).sort((a, b) => {
        const numA = parseInt(a, 10)
        const numB = parseInt(b, 10)
        if (isNaN(numA) && isNaN(numB)) return a.localeCompare(b)
        if (isNaN(numA)) return 1
        if (isNaN(numB)) return -1
        return numA - numB
      })
    } catch (error) {
      logger.error('Failed to parse districts from summary CSV', error)
      return []
    }
  }

  /**
   * Wait to respect rate limiting.
   */
  private async rateLimit(): Promise<void> {
    // Cooldown every N requests
    if (
      this.config.cooldownEvery &&
      this.requestCount > 0 &&
      this.requestCount % this.config.cooldownEvery === 0
    ) {
      logger.info(
        `Cooldown pause after ${this.requestCount} requests (${this.config.cooldownMs}ms)`
      )
      await this.sleep(this.config.cooldownMs ?? 5000)
    }

    // Per-request rate limiting
    const minInterval = 1000 / this.config.ratePerSecond
    const elapsed = Date.now() - this.lastRequestTime
    if (elapsed < minInterval) {
      await this.sleep(minInterval - elapsed)
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Download a single CSV from the dashboard.
   * Includes retry with exponential backoff.
   */
  async downloadCsv(spec: BackfillDateSpec): Promise<DownloadResult> {
    const url = buildExportUrl(spec)
    const maxRetries = this.config.maxRetries ?? 3

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      await this.rateLimit()

      try {
        this.lastRequestTime = Date.now()
        this.requestCount++

        const response = await fetch(url, {
          headers: {
            'User-Agent':
              'ToastStats-Backfill/1.0 (data collection for analytics)',
          },
        })

        if (!response.ok) {
          if (attempt < maxRetries) {
            const backoffMs = Math.pow(2, attempt) * 1000
            logger.warn(
              `HTTP ${response.status} for ${url}, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${maxRetries})`
            )
            await this.sleep(backoffMs)
            continue
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const content = await response.text()

        return {
          url,
          content,
          statusCode: response.status,
          byteSize: content.length,
        }
      } catch (error) {
        if (attempt < maxRetries) {
          const backoffMs = Math.pow(2, attempt) * 1000
          logger.warn(
            `Request failed for ${url}, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${maxRetries})`,
            error
          )
          await this.sleep(backoffMs)
          continue
        }
        throw error
      }
    }

    // Should never reach here due to throw above, but TypeScript needs it
    throw new Error(`Failed after ${maxRetries} retries: ${url}`)
  }

  /**
   * Get the total request count (for progress reporting).
   */
  getRequestCount(): number {
    return this.requestCount
  }

  /**
   * Reset request counter (for testing).
   */
  resetRequestCount(): void {
    this.requestCount = 0
    this.lastRequestTime = 0
  }
}
