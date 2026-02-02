/**
 * TransformService - Transforms raw CSV files into snapshot format.
 *
 * This service reads raw CSV files from the cache directory and transforms
 * them into the snapshot format used by the backend for analytics computation.
 *
 * Requirements:
 * - 2.2: WHEN transforming raw CSVs, THE Scraper_CLI SHALL use the same
 *        DataTransformationService logic as the Backend
 * - 2.3: THE Scraper_CLI SHALL store snapshots in the same directory structure
 *        as the Backend expects: `CACHE_DIR/snapshots/{date}/`
 * - 2.4: WHEN a snapshot is created, THE Scraper_CLI SHALL write district JSON
 *        files, metadata.json, manifest.json, and all-districts-rankings.json
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { parse } from 'csv-parse/sync'
import {
  DataTransformer,
  ANALYTICS_SCHEMA_VERSION,
  type Logger,
  type RawCSVData,
} from '@toastmasters/analytics-core'
import {
  RANKING_VERSION,
  validatePerDistrictData,
  validateAllDistrictsRankings,
  validateSnapshotMetadata,
  validateSnapshotManifest,
  type PerDistrictData,
  type AllDistrictsRankingsData,
  type DistrictRanking,
  type SnapshotMetadataFile,
  type SnapshotManifest,
  type DistrictManifestEntry,
} from '@toastmasters/shared-contracts'
import type { AllDistrictsCSVRecord } from '../types/scraper.js'

/**
 * Internal structure for ranking metrics extraction
 */
interface RankingMetrics {
  districtId: string
  districtName: string
  region: string
  clubGrowthPercent: number
  paymentGrowthPercent: number
  distinguishedPercent: number
  paidClubs: number
  paidClubBase: number
  totalPayments: number
  paymentBase: number
  distinguishedClubs: number
  activeClubs: number
  selectDistinguished: number
  presidentsDistinguished: number
}

/**
 * Category ranking result
 */
interface CategoryRanking {
  districtId: string
  rank: number
  bordaPoints: number
  value: number
}

/**
 * Aggregate ranking result
 */
interface AggregateRanking {
  districtId: string
  clubsRank: number
  paymentsRank: number
  distinguishedRank: number
  aggregateScore: number
}

/**
 * Configuration for TransformService
 */
export interface TransformServiceConfig {
  /** Base cache directory */
  cacheDir: string
  /** Optional logger for diagnostic output */
  logger?: Logger
}

/**
 * Options for transform operation
 */
export interface TransformOperationOptions {
  /** Target date in YYYY-MM-DD format */
  date: string
  /** Specific districts to transform (if not provided, transforms all available) */
  districts?: string[]
  /** Force re-transform even if snapshots exist */
  force?: boolean
  /** Enable verbose logging */
  verbose?: boolean
}

/**
 * Result of transforming a single district
 */
export interface DistrictTransformResult {
  districtId: string
  success: boolean
  snapshotPath?: string
  error?: string
  skipped?: boolean
}

/**
 * Result of the transform operation
 */
export interface TransformOperationResult {
  success: boolean
  date: string
  districtsProcessed: string[]
  districtsSucceeded: string[]
  districtsFailed: string[]
  districtsSkipped: string[]
  snapshotLocations: string[]
  errors: Array<{
    districtId: string
    error: string
    timestamp: string
  }>
  duration_ms: number
}

/**
 * Default no-op logger
 */
const noopLogger: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
}

/**
 * TransformService transforms raw CSV files into snapshot format.
 *
 * The service reads CSV files from the raw-csv cache directory structure:
 *   CACHE_DIR/raw-csv/{date}/district-{id}/club-performance.csv
 *   CACHE_DIR/raw-csv/{date}/district-{id}/division-performance.csv
 *   CACHE_DIR/raw-csv/{date}/district-{id}/district-performance.csv
 *
 * And writes snapshots to:
 *   CACHE_DIR/snapshots/{date}/district_{id}.json
 *   CACHE_DIR/snapshots/{date}/metadata.json
 *   CACHE_DIR/snapshots/{date}/manifest.json
 */
export class TransformService {
  private readonly cacheDir: string
  private readonly logger: Logger
  private readonly dataTransformer: DataTransformer

  constructor(config: TransformServiceConfig) {
    this.cacheDir = config.cacheDir
    this.logger = config.logger ?? noopLogger
    this.dataTransformer = new DataTransformer({ logger: this.logger })
  }

  /**
   * Get the raw CSV directory path for a date
   */
  private getRawCsvDir(date: string): string {
    return path.join(this.cacheDir, 'raw-csv', date)
  }

  /**
   * Get the snapshot directory path for a date
   */
  private getSnapshotDir(date: string): string {
    return path.join(this.cacheDir, 'snapshots', date)
  }

  /**
   * Get the district snapshot file path
   */
  private getDistrictSnapshotPath(date: string, districtId: string): string {
    return path.join(this.getSnapshotDir(date), `district_${districtId}.json`)
  }

  /**
   * Parse CSV content into 2D array format expected by DataTransformer
   */
  private parseCSVToArray(csvContent: string): string[][] {
    try {
      const records = parse(csvContent, {
        skip_empty_lines: false,
        trim: true,
        relax_column_count: true,
        relax_quotes: true,
      }) as string[][]
      return records
    } catch (error) {
      this.logger.error('Failed to parse CSV content', error)
      throw new Error(
        `CSV parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Parse CSV content into records with headers
   */
  private parseCSVToRecords(csvContent: string): AllDistrictsCSVRecord[] {
    try {
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
        relax_quotes: true,
      }) as AllDistrictsCSVRecord[]

      // Filter out footer rows containing "Month of" (metadata lines from dashboard)
      const filteredRecords = records.filter(record => {
        const hasMonthOf = Object.values(record).some(
          value => typeof value === 'string' && value.includes('Month of')
        )
        return !hasMonthOf
      })

      return filteredRecords
    } catch (error) {
      this.logger.error('Failed to parse CSV to records', error)
      throw new Error(
        `CSV parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Read all-districts CSV file for a date
   */
  private async readAllDistrictsCSV(
    date: string
  ): Promise<AllDistrictsCSVRecord[] | null> {
    const csvPath = path.join(this.getRawCsvDir(date), 'all-districts.csv')

    const content = await this.readCSVFile(csvPath)
    if (!content) {
      this.logger.debug('All-districts CSV not found', { date, csvPath })
      return null
    }

    return this.parseCSVToRecords(content)
  }

  /**
   * Extract ranking metrics from all-districts CSV records
   *
   * Filters out invalid district IDs (empty, date patterns, invalid characters)
   * before extracting metrics. This matches the backend's DistrictIdValidator behavior.
   */
  private extractRankingMetrics(
    records: AllDistrictsCSVRecord[]
  ): RankingMetrics[] {
    const metrics: RankingMetrics[] = []
    const rejected: Array<{ districtId: string; reason: string }> = []

    for (const record of records) {
      try {
        const districtId = record.DISTRICT

        // Validate district ID using same rules as backend
        if (!this.isValidDistrictId(districtId)) {
          const reason = this.getDistrictIdRejectionReason(districtId)
          rejected.push({ districtId: districtId || '(empty)', reason })
          this.logger.debug('Rejected invalid district ID', {
            districtId: districtId || '(empty)',
            reason,
          })
          continue
        }

        const metric: RankingMetrics = {
          districtId,
          districtName: record.DISTRICT,
          region: record.REGION || 'Unknown',
          clubGrowthPercent: this.parsePercentage(record['% Club Growth']),
          paymentGrowthPercent: this.parsePercentage(
            record['% Payment Growth']
          ),
          distinguishedPercent: this.calculateDistinguishedPercent(record),
          paidClubs: this.parseNumber(record['Paid Clubs']),
          paidClubBase: this.parseNumber(record['Paid Club Base']),
          totalPayments: this.parseNumber(record['Total YTD Payments']),
          paymentBase: this.parseNumber(record['Payment Base']),
          distinguishedClubs: this.parseNumber(
            record['Total Distinguished Clubs']
          ),
          activeClubs: this.parseNumber(record['Active Clubs']),
          selectDistinguished: this.parseNumber(
            record['Select Distinguished Clubs']
          ),
          presidentsDistinguished: this.parseNumber(
            record['Presidents Distinguished Clubs']
          ),
        }

        metrics.push(metric)
      } catch (error) {
        this.logger.warn('Failed to extract metrics for record', {
          district: record.DISTRICT,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // Log summary if any records were rejected
    if (rejected.length > 0) {
      // Summarize rejection reasons
      const reasonCounts: Record<string, number> = {}
      for (const r of rejected) {
        reasonCounts[r.reason] = (reasonCounts[r.reason] || 0) + 1
      }

      this.logger.info('District ID validation summary', {
        totalRecords: records.length,
        validRecords: metrics.length,
        rejectedRecords: rejected.length,
        rejectionReasons: reasonCounts,
      })
    }

    return metrics
  }

  /**
   * Validate district ID format
   *
   * Validation Rules (ported from backend DistrictIdValidator):
   * 1. Not empty, null, or whitespace-only
   * 2. Does not match date pattern (e.g., "As of MM/DD/YYYY")
   * 3. Contains only alphanumeric characters
   */
  private isValidDistrictId(districtId: string | undefined): boolean {
    // Rule 1: Check for empty or null
    if (!districtId || districtId.trim() === '') {
      return false
    }

    // Rule 2: Check for date pattern (from CSV footers)
    // Pattern matches "As of MM/DD/YYYY" or "As of M/D/YYYY" (case-insensitive)
    const datePattern = /^As of \d{1,2}\/\d{1,2}\/\d{4}$/i
    if (datePattern.test(districtId)) {
      return false
    }

    // Rule 3: Check for valid characters - alphanumeric only
    const validPattern = /^[A-Za-z0-9]+$/
    if (!validPattern.test(districtId)) {
      return false
    }

    return true
  }

  /**
   * Get rejection reason for invalid district ID (for logging)
   */
  private getDistrictIdRejectionReason(districtId: string | undefined): string {
    if (!districtId || districtId.trim() === '') {
      return 'District ID is empty or whitespace-only'
    }

    const datePattern = /^As of \d{1,2}\/\d{1,2}\/\d{4}$/i
    if (datePattern.test(districtId)) {
      return 'District ID matches date pattern (e.g., "As of MM/DD/YYYY")'
    }

    const validPattern = /^[A-Za-z0-9]+$/
    if (!validPattern.test(districtId)) {
      return 'District ID contains invalid characters (only alphanumeric allowed)'
    }

    return 'Unknown validation error'
  }

  /**
   * Calculate distinguished club percentage from raw data
   */
  private calculateDistinguishedPercent(record: AllDistrictsCSVRecord): number {
    const distinguishedClubs = this.parseNumber(
      record['Total Distinguished Clubs']
    )
    const activeClubs = this.parseNumber(record['Active Clubs'])

    if (activeClubs === 0) {
      return 0
    }

    return (distinguishedClubs / activeClubs) * 100
  }

  /**
   * Parse percentage string to number
   */
  private parsePercentage(value: string | undefined): number {
    if (!value) return 0

    // Remove % sign and parse as float
    const cleaned = value.replace('%', '').trim()
    const parsed = parseFloat(cleaned)
    return isNaN(parsed) ? 0 : parsed
  }

  /**
   * Parse number from string (handles commas)
   */
  private parseNumber(value: string | undefined): number {
    if (!value) return 0

    // Remove commas and parse as integer
    const cleaned = value.replace(/,/g, '').trim()
    const parsed = parseInt(cleaned, 10)
    return isNaN(parsed) ? 0 : parsed
  }

  /**
   * Calculate ranking for a single category using Borda count
   *
   * Borda count scoring:
   * - Ranks districts by value (highest first)
   * - Handles ties by assigning the same rank
   * - Borda points = total districts - rank + 1
   */
  private calculateCategoryRanking(
    metrics: RankingMetrics[],
    valueField: keyof RankingMetrics,
    category: string
  ): CategoryRanking[] {
    // Sort districts by value (highest first)
    const sortedMetrics = [...metrics].sort((a, b) => {
      const aValue = a[valueField] as number
      const bValue = b[valueField] as number
      return bValue - aValue
    })

    const rankings: CategoryRanking[] = []
    let currentRank = 1

    for (let i = 0; i < sortedMetrics.length; i++) {
      const metric = sortedMetrics[i]
      if (!metric) continue

      const value = metric[valueField] as number

      // Handle ties: if current value equals previous value, use same rank
      if (i > 0) {
        const previousMetric = sortedMetrics[i - 1]
        if (previousMetric) {
          const previousValue = previousMetric[valueField] as number
          if (value !== previousValue) {
            currentRank = i + 1
          }
        }
      }

      // Calculate Borda points: total districts - rank + 1
      const bordaPoints = metrics.length - currentRank + 1

      rankings.push({
        districtId: metric.districtId,
        rank: currentRank,
        bordaPoints,
        value,
      })
    }

    this.logger.debug('Calculated category ranking', {
      category,
      totalDistricts: metrics.length,
      uniqueRanks: new Set(rankings.map(r => r.rank)).size,
    })

    return rankings
  }

  /**
   * Calculate aggregate rankings by summing Borda points across categories
   */
  private calculateAggregateRankings(
    clubRankings: CategoryRanking[],
    paymentRankings: CategoryRanking[],
    distinguishedRankings: CategoryRanking[]
  ): AggregateRanking[] {
    const aggregateMap = new Map<string, AggregateRanking>()

    // Initialize aggregate rankings from club rankings
    for (const ranking of clubRankings) {
      aggregateMap.set(ranking.districtId, {
        districtId: ranking.districtId,
        clubsRank: ranking.rank,
        paymentsRank: 0,
        distinguishedRank: 0,
        aggregateScore: ranking.bordaPoints,
      })
    }

    // Add payment rankings
    for (const ranking of paymentRankings) {
      const aggregate = aggregateMap.get(ranking.districtId)
      if (aggregate) {
        aggregate.paymentsRank = ranking.rank
        aggregate.aggregateScore += ranking.bordaPoints
      }
    }

    // Add distinguished rankings
    for (const ranking of distinguishedRankings) {
      const aggregate = aggregateMap.get(ranking.districtId)
      if (aggregate) {
        aggregate.distinguishedRank = ranking.rank
        aggregate.aggregateScore += ranking.bordaPoints
      }
    }

    // Sort by aggregate score (highest first)
    return Array.from(aggregateMap.values()).sort(
      (a, b) => b.aggregateScore - a.aggregateScore
    )
  }

  /**
   * Calculate all-districts rankings using Borda count algorithm
   *
   * Requirements:
   * - 2.4: Write all-districts-rankings.json to snapshot directory
   */
  private async calculateAllDistrictsRankings(
    date: string
  ): Promise<AllDistrictsRankingsData | null> {
    this.logger.info('Calculating all-districts rankings', { date })

    // Read all-districts CSV
    const records = await this.readAllDistrictsCSV(date)
    if (!records || records.length === 0) {
      this.logger.warn('No all-districts CSV data found', { date })
      return null
    }

    // Extract ranking metrics
    const metrics = this.extractRankingMetrics(records)
    if (metrics.length === 0) {
      this.logger.warn('No valid district metrics extracted', { date })
      return null
    }

    this.logger.debug('Extracted ranking metrics', {
      date,
      metricsCount: metrics.length,
    })

    // Calculate category rankings
    const clubRankings = this.calculateCategoryRanking(
      metrics,
      'clubGrowthPercent',
      'clubs'
    )
    const paymentRankings = this.calculateCategoryRanking(
      metrics,
      'paymentGrowthPercent',
      'payments'
    )
    const distinguishedRankings = this.calculateCategoryRanking(
      metrics,
      'distinguishedPercent',
      'distinguished'
    )

    // Calculate aggregate rankings
    const aggregateRankings = this.calculateAggregateRankings(
      clubRankings,
      paymentRankings,
      distinguishedRankings
    )

    // Build rankings data structure
    const metricsMap = new Map(metrics.map(m => [m.districtId, m]))
    const rankingsMap = new Map(aggregateRankings.map(r => [r.districtId, r]))

    const rankings: DistrictRanking[] = []
    for (const [districtId, aggregate] of rankingsMap) {
      const metric = metricsMap.get(districtId)
      if (!metric) continue

      rankings.push({
        districtId,
        districtName: metric.districtName,
        region: metric.region,
        paidClubs: metric.paidClubs,
        paidClubBase: metric.paidClubBase,
        clubGrowthPercent: metric.clubGrowthPercent,
        totalPayments: metric.totalPayments,
        paymentBase: metric.paymentBase,
        paymentGrowthPercent: metric.paymentGrowthPercent,
        activeClubs: metric.activeClubs,
        distinguishedClubs: metric.distinguishedClubs,
        selectDistinguished: metric.selectDistinguished,
        presidentsDistinguished: metric.presidentsDistinguished,
        distinguishedPercent: metric.distinguishedPercent,
        clubsRank: aggregate.clubsRank,
        paymentsRank: aggregate.paymentsRank,
        distinguishedRank: aggregate.distinguishedRank,
        aggregateScore: aggregate.aggregateScore,
      })
    }

    // Sort by aggregate score (highest first)
    rankings.sort((a, b) => b.aggregateScore - a.aggregateScore)

    const calculatedAt = new Date().toISOString()

    return {
      metadata: {
        snapshotId: date,
        calculatedAt,
        schemaVersion: ANALYTICS_SCHEMA_VERSION,
        calculationVersion: ANALYTICS_SCHEMA_VERSION,
        rankingVersion: RANKING_VERSION,
        sourceCsvDate: date,
        csvFetchedAt: calculatedAt,
        totalDistricts: rankings.length,
        fromCache: false,
      },
      rankings,
    }
  }

  /**
   * Write all-districts rankings to snapshot directory
   */
  private async writeAllDistrictsRankings(
    date: string,
    rankings: AllDistrictsRankingsData
  ): Promise<string> {
    const snapshotDir = this.getSnapshotDir(date)
    const rankingsPath = path.join(snapshotDir, 'all-districts-rankings.json')

    await fs.mkdir(snapshotDir, { recursive: true })

    // Validate data before writing (Requirement 7.4, 7.5)
    const validationResult = validateAllDistrictsRankings(rankings)
    if (!validationResult.success) {
      this.logger.error('Validation failed for all-districts rankings', {
        error: validationResult.error,
      })
      throw new Error(
        `Validation failed for all-districts rankings: ${validationResult.error}`
      )
    }

    const content = JSON.stringify(validationResult.data, null, 2)
    const tempPath = `${rankingsPath}.tmp.${Date.now()}`
    await fs.writeFile(tempPath, content, 'utf-8')
    await fs.rename(tempPath, rankingsPath)

    this.logger.info('All-districts rankings written', {
      date,
      path: rankingsPath,
      totalDistricts: rankings.rankings.length,
    })

    return rankingsPath
  }

  /**
   * Read raw CSV file and return content
   */
  private async readCSVFile(filePath: string): Promise<string | null> {
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

  /**
   * Load raw CSV data for a district
   */
  private async loadRawCSVData(
    date: string,
    districtId: string
  ): Promise<RawCSVData | null> {
    const districtDir = path.join(
      this.getRawCsvDir(date),
      `district-${districtId}`
    )

    // Check if district directory exists
    try {
      await fs.access(districtDir)
    } catch {
      this.logger.debug('District directory not found', {
        date,
        districtId,
        districtDir,
      })
      return null
    }

    // Read CSV files
    const clubPerformancePath = path.join(districtDir, 'club-performance.csv')
    const divisionPerformancePath = path.join(
      districtDir,
      'division-performance.csv'
    )
    const districtPerformancePath = path.join(
      districtDir,
      'district-performance.csv'
    )

    const clubContent = await this.readCSVFile(clubPerformancePath)
    const divisionContent = await this.readCSVFile(divisionPerformancePath)
    const districtContent = await this.readCSVFile(districtPerformancePath)

    // At minimum, we need club performance data
    if (!clubContent) {
      this.logger.warn('Club performance CSV not found', {
        date,
        districtId,
        path: clubPerformancePath,
      })
      return null
    }

    const rawData: RawCSVData = {
      clubPerformance: this.parseCSVToArray(clubContent),
    }

    if (divisionContent) {
      rawData.divisionPerformance = this.parseCSVToArray(divisionContent)
    }

    if (districtContent) {
      rawData.districtPerformance = this.parseCSVToArray(districtContent)
    }

    return rawData
  }

  /**
   * Discover available districts from raw CSV cache
   */
  async discoverAvailableDistricts(date: string): Promise<string[]> {
    const rawCsvDir = this.getRawCsvDir(date)
    const districts: string[] = []

    try {
      const entries = await fs.readdir(rawCsvDir, { withFileTypes: true })

      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith('district-')) {
          const districtId = entry.name.replace('district-', '')
          districts.push(districtId)
        }
      }

      districts.sort((a, b) => {
        const numA = parseInt(a, 10)
        const numB = parseInt(b, 10)
        if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB
        }
        return a.localeCompare(b)
      })

      return districts
    } catch (error) {
      const err = error as { code?: string }
      if (err.code === 'ENOENT') {
        this.logger.warn('Raw CSV directory not found', { date, rawCsvDir })
        return []
      }
      throw error
    }
  }

  /**
   * Check if snapshot already exists for a district
   */
  async snapshotExists(date: string, districtId: string): Promise<boolean> {
    const snapshotPath = this.getDistrictSnapshotPath(date, districtId)
    try {
      await fs.access(snapshotPath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Transform a single district's raw CSV data into snapshot format
   */
  async transformDistrict(
    date: string,
    districtId: string,
    options?: { force?: boolean }
  ): Promise<DistrictTransformResult> {
    const force = options?.force ?? false

    this.logger.info('Transforming district', { date, districtId, force })

    // Check if snapshot already exists (unless force is true)
    if (!force) {
      const exists = await this.snapshotExists(date, districtId)
      if (exists) {
        this.logger.info('Snapshot already exists, skipping', {
          date,
          districtId,
        })
        return {
          districtId,
          success: true,
          skipped: true,
        }
      }
    }

    // Load raw CSV data
    const rawData = await this.loadRawCSVData(date, districtId)
    if (!rawData) {
      return {
        districtId,
        success: false,
        error: `Raw CSV data not found for district ${districtId} on ${date}`,
      }
    }

    try {
      // Transform using shared DataTransformer
      const districtStats = await this.dataTransformer.transformRawCSV(
        date,
        districtId,
        rawData
      )

      // Write district snapshot file
      const snapshotPath = this.getDistrictSnapshotPath(date, districtId)
      const snapshotDir = path.dirname(snapshotPath)

      await fs.mkdir(snapshotDir, { recursive: true })

      // Wrap district data in PerDistrictData format expected by backend
      const perDistrictData: PerDistrictData = {
        districtId,
        districtName: `District ${districtId}`,
        collectedAt: new Date().toISOString(),
        status: 'success',
        data: districtStats,
      }

      // Validate data before writing (Requirement 7.4, 7.5)
      const validationResult = validatePerDistrictData(perDistrictData)
      if (!validationResult.success) {
        this.logger.error(`Validation failed for district ${districtId}`, {
          error: validationResult.error,
        })
        throw new Error(
          `Validation failed for district ${districtId}: ${validationResult.error}`
        )
      }

      const snapshotContent = JSON.stringify(validationResult.data, null, 2)
      const tempPath = `${snapshotPath}.tmp.${Date.now()}`
      await fs.writeFile(tempPath, snapshotContent, 'utf-8')
      await fs.rename(tempPath, snapshotPath)

      this.logger.info('District snapshot written', {
        date,
        districtId,
        path: snapshotPath,
        clubCount: districtStats.clubs.length,
      })

      return {
        districtId,
        success: true,
        snapshotPath,
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      this.logger.error('Failed to transform district', {
        date,
        districtId,
        error: errorMessage,
      })
      return {
        districtId,
        success: false,
        error: errorMessage,
      }
    }
  }

  /**
   * Write snapshot metadata file
   */
  private async writeMetadata(
    date: string,
    successfulDistricts: string[],
    failedDistricts: string[],
    errors: string[],
    processingDuration: number
  ): Promise<void> {
    const snapshotDir = this.getSnapshotDir(date)
    const metadataPath = path.join(snapshotDir, 'metadata.json')

    // Determine status based on results
    let status: 'success' | 'partial' | 'failed'
    if (failedDistricts.length === 0) {
      status = 'success'
    } else if (successfulDistricts.length > 0) {
      status = 'partial'
    } else {
      status = 'failed'
    }

    const allDistricts = [...successfulDistricts, ...failedDistricts]

    const metadata: SnapshotMetadataFile = {
      snapshotId: date,
      createdAt: new Date().toISOString(),
      schemaVersion: ANALYTICS_SCHEMA_VERSION,
      calculationVersion: ANALYTICS_SCHEMA_VERSION,
      status,
      configuredDistricts: allDistricts,
      successfulDistricts,
      failedDistricts,
      errors,
      processingDuration,
      source: 'scraper-cli',
      dataAsOfDate: date,
    }

    // Validate data before writing (Requirement 7.4, 7.5)
    const validationResult = validateSnapshotMetadata(metadata)
    if (!validationResult.success) {
      this.logger.error('Validation failed for snapshot metadata', {
        error: validationResult.error,
      })
      throw new Error(
        `Validation failed for snapshot metadata: ${validationResult.error}`
      )
    }

    const content = JSON.stringify(validationResult.data, null, 2)
    const tempPath = `${metadataPath}.tmp.${Date.now()}`
    await fs.writeFile(tempPath, content, 'utf-8')
    await fs.rename(tempPath, metadataPath)

    this.logger.info('Metadata file written', { date, path: metadataPath })
  }

  /**
   * Write snapshot manifest file
   */
  private async writeManifest(
    date: string,
    districtEntries: DistrictManifestEntry[],
    failedDistrictIds: string[]
  ): Promise<void> {
    const snapshotDir = this.getSnapshotDir(date)
    const manifestPath = path.join(snapshotDir, 'manifest.json')

    const manifest: SnapshotManifest = {
      snapshotId: date,
      createdAt: new Date().toISOString(),
      districts: districtEntries,
      totalDistricts: districtEntries.length + failedDistrictIds.length,
      successfulDistricts: districtEntries.length,
      failedDistricts: failedDistrictIds.length,
    }

    // Validate data before writing (Requirement 7.4, 7.5)
    const validationResult = validateSnapshotManifest(manifest)
    if (!validationResult.success) {
      this.logger.error('Validation failed for snapshot manifest', {
        error: validationResult.error,
      })
      throw new Error(
        `Validation failed for snapshot manifest: ${validationResult.error}`
      )
    }

    const content = JSON.stringify(validationResult.data, null, 2)
    const tempPath = `${manifestPath}.tmp.${Date.now()}`
    await fs.writeFile(tempPath, content, 'utf-8')
    await fs.rename(tempPath, manifestPath)

    this.logger.info('Manifest file written', {
      date,
      path: manifestPath,
      totalDistricts: manifest.totalDistricts,
      successfulDistricts: manifest.successfulDistricts,
    })
  }

  /**
   * Get manifest entry for a district snapshot file
   */
  private async getDistrictManifestEntry(
    date: string,
    districtId: string
  ): Promise<DistrictManifestEntry | null> {
    const snapshotPath = this.getDistrictSnapshotPath(date, districtId)

    try {
      const stat = await fs.stat(snapshotPath)

      return {
        districtId,
        fileName: `district_${districtId}.json`,
        status: 'success',
        fileSize: stat.size,
        lastModified: stat.mtime.toISOString(),
      }
    } catch {
      return null
    }
  }

  /**
   * Transform all available districts for a date
   *
   * Requirements:
   * - 2.2: Use the same DataTransformationService logic as the Backend
   * - 2.3: Store snapshots in CACHE_DIR/snapshots/{date}/
   * - 2.4: Write district JSON files, metadata.json, and manifest.json
   */
  async transform(
    options: TransformOperationOptions
  ): Promise<TransformOperationResult> {
    const startTime = Date.now()
    const { date, districts: requestedDistricts, force, verbose } = options

    if (verbose) {
      this.logger.info('Starting transform operation', {
        date,
        requestedDistricts,
        force,
      })
    }

    // Discover available districts if not specified
    let districtsToTransform: string[]
    if (requestedDistricts && requestedDistricts.length > 0) {
      districtsToTransform = requestedDistricts
    } else {
      districtsToTransform = await this.discoverAvailableDistricts(date)
    }

    if (districtsToTransform.length === 0) {
      this.logger.warn('No districts found to transform', { date })
      return {
        success: false,
        date,
        districtsProcessed: [],
        districtsSucceeded: [],
        districtsFailed: [],
        districtsSkipped: [],
        snapshotLocations: [],
        errors: [
          {
            districtId: 'N/A',
            error: `No raw CSV data found for date ${date}`,
            timestamp: new Date().toISOString(),
          },
        ],
        duration_ms: Date.now() - startTime,
      }
    }

    // Transform each district
    const results: DistrictTransformResult[] = []
    const errors: Array<{
      districtId: string
      error: string
      timestamp: string
    }> = []
    const snapshotLocations: string[] = []
    const successfulDistricts: string[] = []

    for (const districtId of districtsToTransform) {
      const result = await this.transformDistrict(date, districtId, { force })
      results.push(result)

      if (result.success) {
        if (!result.skipped) {
          successfulDistricts.push(districtId)
          if (result.snapshotPath) {
            snapshotLocations.push(result.snapshotPath)
          }
        }
      } else if (result.error) {
        errors.push({
          districtId,
          error: result.error,
          timestamp: new Date().toISOString(),
        })
      }
    }

    // Collect manifest entries for all district files (including previously existing ones)
    const districtEntries: DistrictManifestEntry[] = []
    const allSuccessfulDistricts: string[] = []

    for (const districtId of districtsToTransform) {
      const entry = await this.getDistrictManifestEntry(date, districtId)
      if (entry) {
        districtEntries.push(entry)
        allSuccessfulDistricts.push(districtId)
      }
    }

    // Write metadata and manifest if we have any successful districts
    if (allSuccessfulDistricts.length > 0) {
      try {
        // Collect failed districts and error messages for metadata
        const failedDistrictIds = results
          .filter(r => !r.success)
          .map(r => r.districtId)
        const errorMessages = errors.map(e => `${e.districtId}: ${e.error}`)
        const processingDuration = Date.now() - startTime

        await this.writeMetadata(
          date,
          allSuccessfulDistricts,
          failedDistrictIds,
          errorMessages,
          processingDuration
        )
        await this.writeManifest(date, districtEntries, failedDistrictIds)

        // Add metadata and manifest to snapshot locations
        const snapshotDir = this.getSnapshotDir(date)
        snapshotLocations.push(path.join(snapshotDir, 'metadata.json'))
        snapshotLocations.push(path.join(snapshotDir, 'manifest.json'))

        // Calculate and write all-districts rankings (Requirement 2.4)
        try {
          const rankings = await this.calculateAllDistrictsRankings(date)
          if (rankings) {
            const rankingsPath = await this.writeAllDistrictsRankings(
              date,
              rankings
            )
            snapshotLocations.push(rankingsPath)
          } else {
            this.logger.warn(
              'Could not calculate all-districts rankings (no CSV data)',
              { date }
            )
          }
        } catch (rankingsError) {
          const rankingsErrorMessage =
            rankingsError instanceof Error
              ? rankingsError.message
              : 'Unknown error'
          this.logger.error(
            'Failed to calculate/write all-districts rankings',
            {
              date,
              error: rankingsErrorMessage,
            }
          )
          // Don't fail the entire transform for rankings failure
          errors.push({
            districtId: 'all-districts-rankings',
            error: `Failed to calculate rankings: ${rankingsErrorMessage}`,
            timestamp: new Date().toISOString(),
          })
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error'
        this.logger.error('Failed to write metadata/manifest', {
          date,
          error: errorMessage,
        })
        errors.push({
          districtId: 'N/A',
          error: `Failed to write metadata/manifest: ${errorMessage}`,
          timestamp: new Date().toISOString(),
        })
      }
    }

    // Calculate result statistics
    const districtsProcessed = districtsToTransform
    const districtsSucceeded = results
      .filter(r => r.success && !r.skipped)
      .map(r => r.districtId)
    const districtsFailed = results
      .filter(r => !r.success)
      .map(r => r.districtId)
    const districtsSkipped = results
      .filter(r => r.success && r.skipped)
      .map(r => r.districtId)

    const success = districtsFailed.length === 0 && errors.length === 0

    if (verbose) {
      this.logger.info('Transform operation completed', {
        date,
        success,
        processed: districtsProcessed.length,
        succeeded: districtsSucceeded.length,
        failed: districtsFailed.length,
        skipped: districtsSkipped.length,
      })
    }

    return {
      success,
      date,
      districtsProcessed,
      districtsSucceeded,
      districtsFailed,
      districtsSkipped,
      snapshotLocations,
      errors,
      duration_ms: Date.now() - startTime,
    }
  }
}
