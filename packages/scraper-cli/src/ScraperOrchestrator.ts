/**
 * Scraper Orchestrator
 *
 * Orchestrates scraping operations across multiple districts with resilient
 * error handling and partial failure support.
 *
 * Requirements:
 * - 1.2: WHEN the Scraper_CLI is invoked, THE Scraper_CLI SHALL scrape data
 *        from the Toastmasters dashboard and store it in the Raw_CSV_Cache
 * - 1.10: IF scraping fails for any district, THEN THE Scraper_CLI SHALL
 *         continue processing remaining districts and report failures in the summary
 * - 6.1: IF the Scraper_CLI encounters a network error, THEN THE Scraper_CLI SHALL
 *        retry with exponential backoff before failing
 * - 7.1: THE Scraper_CLI SHALL read district configuration from the same source as the Backend
 * - 7.2: THE Scraper_CLI SHALL use the same cache directory configuration as the Backend
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { logger } from './utils/logger.js'
import { CircuitBreaker, CircuitState } from './utils/CircuitBreaker.js'
import { RetryManager } from './utils/RetryManager.js'
import { ToastmastersScraper } from './services/ToastmastersScraper.js'
import type {
  ScraperOrchestratorConfig,
  ScrapeOptions,
  ScrapeResult,
  ConfigValidationResult,
  CacheStatus,
} from './types/index.js'
import { CSVType, IScraperCache, CacheMetadata } from './types/scraper.js'

/**
 * District configuration file structure
 * Matches the backend's DistrictConfigurationService format
 */
interface DistrictConfiguration {
  configuredDistricts: string[]
  lastUpdated: string
  updatedBy: string
  version: number
}

/**
 * Result of scraping a single district
 */
interface DistrictScrapeResult {
  districtId: string
  success: boolean
  cacheLocations: string[]
  error?: string
  timestamp: string
  duration_ms: number
}

/**
 * Simple cache adapter that implements IScraperCache for the orchestrator
 */
class OrchestratorCacheAdapter implements IScraperCache {
  private readonly cacheDir: string
  private readonly metadataCache: Map<string, CacheMetadata> = new Map()

  constructor(cacheDir: string) {
    this.cacheDir = cacheDir
  }

  private buildFilePath(
    date: string,
    type: CSVType,
    districtId?: string
  ): string {
    // Match backend's RawCSVCacheService file path convention:
    // - ALL_DISTRICTS: raw-csv/{date}/all-districts.csv
    // - District-specific: raw-csv/{date}/district-{districtId}/{type}.csv
    if (type === CSVType.ALL_DISTRICTS) {
      return path.join(this.cacheDir, 'raw-csv', date, `${type}.csv`)
    } else {
      if (!districtId) {
        throw new Error(`District ID required for CSV type: ${type}`)
      }
      const districtPath = path.join(
        this.cacheDir,
        'raw-csv',
        date,
        `district-${districtId}`
      )
      return path.join(districtPath, `${type}.csv`)
    }
  }

  private buildMetadataPath(date: string): string {
    return path.join(this.cacheDir, 'raw-csv', date, 'metadata.json')
  }

  async getCachedCSV(
    date: string,
    type: CSVType,
    districtId?: string
  ): Promise<string | null> {
    const filePath = this.buildFilePath(date, type, districtId)
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return content
    } catch (error) {
      const err = error as { code?: string }
      if (err.code === 'ENOENT') {
        return null
      }
      throw error
    }
  }

  async setCachedCSVWithMetadata(
    date: string,
    type: CSVType,
    csvContent: string,
    districtId?: string,
    additionalMetadata?: {
      requestedDate?: string
      isClosingPeriod?: boolean
      dataMonth?: string
    }
  ): Promise<void> {
    const filePath = this.buildFilePath(date, type, districtId)
    const dirPath = path.dirname(filePath)

    // Ensure directory exists
    await fs.mkdir(dirPath, { recursive: true })

    // Write file atomically
    const tempFilePath = `${filePath}.tmp.${Date.now()}`
    await fs.writeFile(tempFilePath, csvContent, 'utf-8')
    await fs.rename(tempFilePath, filePath)

    // Update metadata
    await this.updateMetadata(date, csvContent, additionalMetadata)

    logger.debug('CSV cached successfully', {
      date,
      type,
      districtId,
      filePath,
      size: csvContent.length,
    })
  }

  async getCacheMetadata(date: string): Promise<CacheMetadata | null> {
    // Check in-memory cache first
    const cached = this.metadataCache.get(date)
    if (cached) {
      return cached
    }

    const metadataPath = this.buildMetadataPath(date)
    try {
      const content = await fs.readFile(metadataPath, 'utf-8')
      const metadata = JSON.parse(content) as CacheMetadata
      this.metadataCache.set(date, metadata)
      return metadata
    } catch (error) {
      const err = error as { code?: string }
      if (err.code === 'ENOENT') {
        return null
      }
      throw error
    }
  }

  private async updateMetadata(
    date: string,
    _csvContent: string,
    additionalMetadata?: {
      requestedDate?: string
      isClosingPeriod?: boolean
      dataMonth?: string
    }
  ): Promise<void> {
    const metadataPath = this.buildMetadataPath(date)
    const dirPath = path.dirname(metadataPath)

    await fs.mkdir(dirPath, { recursive: true })

    let existingMetadata = await this.getCacheMetadata(date)
    if (!existingMetadata) {
      existingMetadata = {
        date,
        isClosingPeriod: false,
        dataMonth: undefined,
      }
    }

    const updatedMetadata: CacheMetadata = {
      ...existingMetadata,
      date,
      isClosingPeriod:
        additionalMetadata?.isClosingPeriod ?? existingMetadata.isClosingPeriod,
      dataMonth: additionalMetadata?.dataMonth ?? existingMetadata.dataMonth,
    }

    const tempPath = `${metadataPath}.tmp.${Date.now()}`
    await fs.writeFile(
      tempPath,
      JSON.stringify(updatedMetadata, null, 2),
      'utf-8'
    )
    await fs.rename(tempPath, metadataPath)

    this.metadataCache.set(date, updatedMetadata)
  }

  /**
   * Check if cache exists for a specific date and type
   */
  async hasCachedCSV(
    date: string,
    type: CSVType,
    districtId?: string
  ): Promise<boolean> {
    const filePath = this.buildFilePath(date, type, districtId)
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get list of cached files for a date
   */
  async getCachedFilesForDate(date: string): Promise<string[]> {
    const datePath = path.join(this.cacheDir, 'raw-csv', date)
    const csvFiles: string[] = []

    try {
      const entries = await fs.readdir(datePath, { withFileTypes: true })

      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.csv')) {
          // Top-level CSV files (e.g., all-districts.csv)
          csvFiles.push(entry.name)
        } else if (entry.isDirectory() && entry.name.startsWith('district-')) {
          // District subdirectories - list CSV files within
          const districtPath = path.join(datePath, entry.name)
          try {
            const districtFiles = await fs.readdir(districtPath)
            for (const file of districtFiles) {
              if (file.endsWith('.csv')) {
                csvFiles.push(path.join(entry.name, file))
              }
            }
          } catch {
            // Ignore errors reading district subdirectories
          }
        }
      }

      return csvFiles
    } catch (error) {
      const err = error as { code?: string }
      if (err.code === 'ENOENT') {
        return []
      }
      throw error
    }
  }
}

/**
 * Scraper Orchestrator
 *
 * Coordinates scraping operations across multiple districts with:
 * - Configuration loading from district config file
 * - Cache directory resolution
 * - Resilient processing with error isolation
 * - Circuit breaker integration
 * - Retry logic with exponential backoff
 */
export class ScraperOrchestrator {
  private readonly config: ScraperOrchestratorConfig
  private readonly circuitBreaker: CircuitBreaker
  private readonly cacheAdapter: OrchestratorCacheAdapter
  private scraper: ToastmastersScraper | null = null

  constructor(config: ScraperOrchestratorConfig) {
    this.config = config
    this.circuitBreaker = CircuitBreaker.createDashboardCircuitBreaker(
      'scraper-orchestrator'
    )
    this.cacheAdapter = new OrchestratorCacheAdapter(config.cacheDir)

    logger.debug('ScraperOrchestrator initialized', {
      cacheDir: config.cacheDir,
      districtConfigPath: config.districtConfigPath,
      timeout: config.timeout,
      verbose: config.verbose,
    })
  }

  /**
   * Get current date string in YYYY-MM-DD format
   */
  private getCurrentDateString(): string {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  /**
   * Load district configuration from file
   * Requirement 7.1: Read district configuration from the same source as the Backend
   */
  private async loadDistrictConfiguration(): Promise<DistrictConfiguration> {
    try {
      const configContent = await fs.readFile(
        this.config.districtConfigPath,
        'utf-8'
      )
      const config = JSON.parse(configContent) as DistrictConfiguration

      // Validate configuration structure
      if (!Array.isArray(config.configuredDistricts)) {
        throw new Error(
          'Invalid configuration: configuredDistricts must be an array'
        )
      }

      logger.info('District configuration loaded', {
        districtCount: config.configuredDistricts.length,
        lastUpdated: config.lastUpdated,
        configPath: this.config.districtConfigPath,
      })

      return config
    } catch (error) {
      const err = error as { code?: string }
      if (err.code === 'ENOENT') {
        logger.warn(
          'District configuration file not found, using empty configuration',
          {
            configPath: this.config.districtConfigPath,
          }
        )
        return {
          configuredDistricts: [],
          lastUpdated: new Date().toISOString(),
          updatedBy: 'system',
          version: 1,
        }
      }
      throw error
    }
  }

  /**
   * Validate the orchestrator configuration
   */
  async validateConfiguration(): Promise<ConfigValidationResult> {
    const errors: string[] = []

    // Check cache directory
    try {
      await fs.access(this.config.cacheDir)
    } catch {
      // Try to create it
      try {
        await fs.mkdir(this.config.cacheDir, { recursive: true })
        logger.info('Created cache directory', {
          cacheDir: this.config.cacheDir,
        })
      } catch (_mkdirError) {
        errors.push(
          `Cannot access or create cache directory: ${this.config.cacheDir}`
        )
      }
    }

    // Check district configuration file
    try {
      const config = await this.loadDistrictConfiguration()
      if (config.configuredDistricts.length === 0) {
        errors.push('No districts configured in district configuration file')
      }
    } catch (error) {
      errors.push(
        `Cannot load district configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }

  /**
   * Get cache status for a specific date
   */
  async getCacheStatus(date: string): Promise<CacheStatus> {
    const config = await this.loadDistrictConfiguration()
    const configuredDistricts = config.configuredDistricts

    const cachedDistricts: string[] = []
    const missingDistricts: string[] = []

    for (const districtId of configuredDistricts) {
      // Check if club performance CSV exists (primary indicator of cached data)
      const hasCached = await this.cacheAdapter.hasCachedCSV(
        date,
        CSVType.CLUB_PERFORMANCE,
        districtId
      )

      if (hasCached) {
        cachedDistricts.push(districtId)
      } else {
        missingDistricts.push(districtId)
      }
    }

    return {
      date,
      cachedDistricts,
      missingDistricts,
    }
  }

  /**
   * Initialize the scraper instance
   */
  private async initScraper(): Promise<ToastmastersScraper> {
    if (!this.scraper) {
      this.scraper = new ToastmastersScraper(this.cacheAdapter)
      logger.debug('Scraper instance created')
    }
    return this.scraper
  }

  /**
   * Close the scraper and release resources
   */
  async close(): Promise<void> {
    if (this.scraper) {
      await this.scraper.closeBrowser()
      this.scraper = null
      logger.debug('Scraper resources released')
    }
  }

  /**
   * Scrape a single district with retry logic
   * Requirement 6.1: Retry with exponential backoff before failing
   */
  private async scrapeDistrict(
    scraper: ToastmastersScraper,
    districtId: string,
    date: string,
    force: boolean
  ): Promise<DistrictScrapeResult> {
    const startTime = Date.now()
    const timestamp = new Date().toISOString()
    const cacheLocations: string[] = []

    logger.info('Starting district scrape', { districtId, date, force })

    try {
      // Check if cache already exists (unless force is true)
      if (!force) {
        const hasCached = await this.cacheAdapter.hasCachedCSV(
          date,
          CSVType.CLUB_PERFORMANCE,
          districtId
        )

        if (hasCached) {
          logger.info('Cache already exists, skipping scrape', {
            districtId,
            date,
          })

          return {
            districtId,
            success: true,
            cacheLocations: [],
            timestamp,
            duration_ms: Date.now() - startTime,
          }
        }
      }

      // Execute scraping with retry logic
      const retryResult = await RetryManager.executeWithRetry(
        async () => {
          // Scrape club performance data (primary data)
          const clubData = await scraper.getClubPerformance(districtId, date)
          cacheLocations.push(
            path.join(
              this.config.cacheDir,
              'raw-csv',
              date,
              `district-${districtId}`,
              `${CSVType.CLUB_PERFORMANCE}.csv`
            )
          )

          // Scrape division performance data
          const divisionData = await scraper.getDivisionPerformance(
            districtId,
            date
          )
          cacheLocations.push(
            path.join(
              this.config.cacheDir,
              'raw-csv',
              date,
              `district-${districtId}`,
              `${CSVType.DIVISION_PERFORMANCE}.csv`
            )
          )

          // Scrape district performance data
          const districtData = await scraper.getDistrictPerformance(
            districtId,
            date
          )
          cacheLocations.push(
            path.join(
              this.config.cacheDir,
              'raw-csv',
              date,
              `district-${districtId}`,
              `${CSVType.DISTRICT_PERFORMANCE}.csv`
            )
          )

          return {
            clubRecords: clubData.length,
            divisionRecords: divisionData.length,
            districtRecords: districtData.length,
          }
        },
        RetryManager.getDashboardRetryOptions(),
        { districtId, date, operation: 'scrapeDistrict' }
      )

      if (!retryResult.success) {
        throw retryResult.error ?? new Error('Scraping failed after retries')
      }

      const duration_ms = Date.now() - startTime

      logger.info('District scrape completed successfully', {
        districtId,
        date,
        duration_ms,
        attempts: retryResult.attempts,
        records: retryResult.result,
      })

      return {
        districtId,
        success: true,
        cacheLocations,
        timestamp,
        duration_ms,
      }
    } catch (error) {
      const duration_ms = Date.now() - startTime
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logger.error('District scrape failed', {
        districtId,
        date,
        duration_ms,
        error: errorMessage,
      })

      return {
        districtId,
        success: false,
        cacheLocations: [],
        error: errorMessage,
        timestamp,
        duration_ms,
      }
    }
  }

  /**
   * Main scrape method - orchestrates scraping across all districts
   *
   * Requirements:
   * - 1.2: Scrape data and store in Raw_CSV_Cache
   * - 1.10: Continue on individual district failures
   * - 6.1: Retry with exponential backoff
   * - 6.2: Report circuit breaker status and exit gracefully
   */
  async scrape(options: ScrapeOptions): Promise<ScrapeResult> {
    const startTime = Date.now()
    const date = options.date ?? this.getCurrentDateString()
    const force = options.force ?? false

    logger.info('Starting scrape operation', {
      date,
      force,
      requestedDistricts: options.districts ?? 'all configured',
    })

    // Check circuit breaker state
    const cbStats = this.circuitBreaker.getStats()
    if (cbStats.state === CircuitState.OPEN) {
      logger.error('Circuit breaker is open, aborting scrape', {
        failureCount: cbStats.failureCount,
        nextRetryTime: cbStats.nextRetryTime?.toISOString(),
      })

      return {
        success: false,
        date,
        districtsProcessed: [],
        districtsSucceeded: [],
        districtsFailed: [],
        cacheLocations: [],
        errors: [
          {
            districtId: 'N/A',
            error: `Circuit breaker is open. Next retry at ${cbStats.nextRetryTime?.toISOString() ?? 'unknown'}`,
            timestamp: new Date().toISOString(),
          },
        ],
        duration_ms: Date.now() - startTime,
      }
    }

    // Load district configuration
    let districtsToScrape: string[]
    try {
      const config = await this.loadDistrictConfiguration()

      if (options.districts && options.districts.length > 0) {
        // Use specified districts, but validate they exist in configuration
        districtsToScrape = options.districts.filter(d =>
          config.configuredDistricts.includes(d)
        )

        const invalidDistricts = options.districts.filter(
          d => !config.configuredDistricts.includes(d)
        )

        if (invalidDistricts.length > 0) {
          logger.warn('Some requested districts are not in configuration', {
            invalidDistricts,
            configuredDistricts: config.configuredDistricts,
          })
        }
      } else {
        // Use all configured districts
        districtsToScrape = config.configuredDistricts
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to load district configuration', {
        error: errorMessage,
      })

      return {
        success: false,
        date,
        districtsProcessed: [],
        districtsSucceeded: [],
        districtsFailed: [],
        cacheLocations: [],
        errors: [
          {
            districtId: 'N/A',
            error: `Failed to load district configuration: ${errorMessage}`,
            timestamp: new Date().toISOString(),
          },
        ],
        duration_ms: Date.now() - startTime,
      }
    }

    if (districtsToScrape.length === 0) {
      logger.warn('No districts to scrape')

      return {
        success: false,
        date,
        districtsProcessed: [],
        districtsSucceeded: [],
        districtsFailed: [],
        cacheLocations: [],
        errors: [
          {
            districtId: 'N/A',
            error: 'No districts configured or specified for scraping',
            timestamp: new Date().toISOString(),
          },
        ],
        duration_ms: Date.now() - startTime,
      }
    }

    // Initialize scraper
    const scraper = await this.initScraper()

    // Process districts sequentially with error isolation
    const results: DistrictScrapeResult[] = []
    const errors: Array<{
      districtId: string
      error: string
      timestamp: string
    }> = []
    const allCacheLocations: string[] = []

    for (const districtId of districtsToScrape) {
      // Check circuit breaker before each district
      const currentCbStats = this.circuitBreaker.getStats()
      if (currentCbStats.state === CircuitState.OPEN) {
        logger.warn('Circuit breaker opened during scrape, stopping', {
          districtId,
          processedCount: results.length,
          remainingCount: districtsToScrape.length - results.length,
        })

        // Add remaining districts as failed
        const remainingDistricts = districtsToScrape.slice(results.length)
        for (const remaining of remainingDistricts) {
          errors.push({
            districtId: remaining,
            error: 'Skipped due to circuit breaker opening',
            timestamp: new Date().toISOString(),
          })
        }
        break
      }

      try {
        const result = await this.circuitBreaker.execute(
          () => this.scrapeDistrict(scraper, districtId, date, force),
          { districtId, date }
        )

        results.push(result)

        if (result.success) {
          allCacheLocations.push(...result.cacheLocations)
        } else if (result.error) {
          errors.push({
            districtId: result.districtId,
            error: result.error,
            timestamp: result.timestamp,
          })
        }
      } catch (error) {
        // Circuit breaker error or unexpected error
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error'

        results.push({
          districtId,
          success: false,
          cacheLocations: [],
          error: errorMessage,
          timestamp: new Date().toISOString(),
          duration_ms: 0,
        })

        errors.push({
          districtId,
          error: errorMessage,
          timestamp: new Date().toISOString(),
        })

        logger.error('Unexpected error during district scrape', {
          districtId,
          error: errorMessage,
        })
      }
    }

    // Close scraper resources
    await this.close()

    // Calculate results
    const districtsProcessed = results.map(r => r.districtId)
    const districtsSucceeded = results
      .filter(r => r.success)
      .map(r => r.districtId)
    const districtsFailed = results
      .filter(r => !r.success)
      .map(r => r.districtId)
    const duration_ms = Date.now() - startTime

    // Determine overall success
    const success =
      districtsFailed.length === 0 && districtsSucceeded.length > 0

    logger.info('Scrape operation completed', {
      date,
      duration_ms,
      totalDistricts: districtsToScrape.length,
      succeeded: districtsSucceeded.length,
      failed: districtsFailed.length,
      success,
    })

    return {
      success,
      date,
      districtsProcessed,
      districtsSucceeded,
      districtsFailed,
      cacheLocations: allCacheLocations,
      errors,
      duration_ms,
    }
  }
}
