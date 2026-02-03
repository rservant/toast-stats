/**
 * AnalyticsComputeService - Computes analytics from snapshot data.
 *
 * This service loads snapshot data from disk, uses the shared AnalyticsComputer
 * from analytics-core to compute analytics, and writes the results using
 * AnalyticsWriter.
 *
 * Requirements:
 * - 1.2: WHEN snapshots are created, THE Scraper_CLI SHALL compute analytics
 *        for each district using the same algorithms as the Analytics_Engine
 * - 1.3: WHEN computing analytics, THE Scraper_CLI SHALL generate membership
 *        trends, club health scores, distinguished club projections,
 *        division/area comparisons, and year-over-year metrics
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import * as crypto from 'crypto'
import {
  AnalyticsComputer,
  type Logger,
  type DistrictStatistics,
  type AnalyticsManifestEntry,
  type PreComputedAnalyticsFile,
  type DistrictAnalytics,
} from '@toastmasters/analytics-core'
import type {
  DistrictStatisticsInput,
  ScrapedRecord,
} from '@toastmasters/analytics-core'
import type { AllDistrictsRankingsData } from '@toastmasters/shared-contracts'
import { AnalyticsWriter } from './AnalyticsWriter.js'
import { TimeSeriesIndexWriter } from './TimeSeriesIndexWriter.js'

/**
 * Configuration for AnalyticsComputeService
 */
export interface AnalyticsComputeServiceConfig {
  /** Base cache directory */
  cacheDir: string
  /** Optional logger for diagnostic output */
  logger?: Logger
}

/**
 * Options for compute operation
 */
export interface ComputeOperationOptions {
  /** Target date in YYYY-MM-DD format */
  date: string
  /** Specific districts to compute analytics for (if not provided, computes for all available) */
  districts?: string[]
  /** Force re-compute even if analytics exist */
  force?: boolean
  /** Enable verbose logging */
  verbose?: boolean
}

/**
 * Result of computing analytics for a single district
 */
export interface DistrictComputeResult {
  districtId: string
  success: boolean
  analyticsPath?: string
  membershipPath?: string
  clubHealthPath?: string
  /** Path to membership analytics file (NEW - Requirement 1.1) */
  membershipAnalyticsPath?: string
  /** Path to vulnerable clubs file (NEW - Requirement 3.1) */
  vulnerableClubsPath?: string
  /** Path to leadership insights file (NEW - Requirement 4.1) */
  leadershipInsightsPath?: string
  /** Path to distinguished club analytics file (NEW - Requirement 5.1) */
  distinguishedAnalyticsPath?: string
  /** Path to year-over-year file (NEW - Requirement 6.1) */
  yearOverYearPath?: string
  /** Path to performance targets file (NEW - Requirement 7.1) */
  performanceTargetsPath?: string
  /** Path to club trends index file (NEW - Requirement 2.1) */
  clubTrendsIndexPath?: string
  /** Whether time-series data point was written (NEW - Requirement 4.1, 9.1) */
  timeSeriesWritten?: boolean
  /** Error message if time-series write failed (non-fatal) */
  timeSeriesError?: string
  error?: string
  skipped?: boolean
}

/**
 * Result of the compute operation
 */
export interface ComputeOperationResult {
  success: boolean
  date: string
  districtsProcessed: string[]
  districtsSucceeded: string[]
  districtsFailed: string[]
  districtsSkipped: string[]
  analyticsLocations: string[]
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
 * Result of checking if analytics need recomputation
 */
interface AnalyticsCheckResult {
  /** Whether analytics exist for this district */
  exists: boolean
  /** Whether recomputation is needed (checksum changed) */
  needsRecomputation: boolean
  /** The stored source snapshot checksum (if analytics exist) */
  storedChecksum?: string
  /** The current source snapshot checksum */
  currentChecksum?: string
}

/**
 * AnalyticsComputeService computes analytics from snapshot data.
 *
 * The service reads snapshot files from:
 *   CACHE_DIR/snapshots/{date}/district_{id}.json
 *
 * And writes analytics to:
 *   CACHE_DIR/snapshots/{date}/analytics/district_{id}_analytics.json
 *   CACHE_DIR/snapshots/{date}/analytics/district_{id}_membership.json
 *   CACHE_DIR/snapshots/{date}/analytics/district_{id}_clubhealth.json
 *   CACHE_DIR/snapshots/{date}/analytics/manifest.json
 *
 * And writes time-series data to:
 *   CACHE_DIR/time-series/district_{id}/{program-year}.json
 *   CACHE_DIR/time-series/district_{id}/index-metadata.json
 *
 * Requirements:
 * - 4.1: Generate time-series data points for each district
 * - 9.1: Integrate time-series generation with analytics pipeline
 * - 9.2: Use same snapshot data as other analytics
 * - 9.4: If time-series fails for a district, log error and continue
 */
export class AnalyticsComputeService {
  private readonly cacheDir: string
  private readonly logger: Logger
  private readonly analyticsComputer: AnalyticsComputer
  private readonly analyticsWriter: AnalyticsWriter
  private readonly timeSeriesWriter: TimeSeriesIndexWriter

  constructor(config: AnalyticsComputeServiceConfig) {
    this.cacheDir = config.cacheDir
    this.logger = config.logger ?? noopLogger
    this.analyticsComputer = new AnalyticsComputer()
    this.analyticsWriter = new AnalyticsWriter({
      cacheDir: config.cacheDir,
      logger: config.logger,
    })
    this.timeSeriesWriter = new TimeSeriesIndexWriter({
      cacheDir: config.cacheDir,
      logger: config.logger,
    })
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
   * Get the analytics directory path for a date
   */
  getAnalyticsDir(date: string): string {
    return this.analyticsWriter.getAnalyticsDir(date)
  }

  /**
   * Convert DistrictStatistics to DistrictStatisticsInput format.
   *
   * The TimeSeriesDataPointBuilder expects raw CSV-like data with clubPerformance array.
   * This method converts the transformed ClubStatistics[] to ScrapedRecord[] format.
   *
   * @param snapshot - The district statistics in transformed format
   * @returns DistrictStatisticsInput for TimeSeriesDataPointBuilder
   *
   * @see Requirements 9.2: Use same snapshot data as other analytics
   */
  private convertToDistrictStatisticsInput(
    snapshot: DistrictStatistics
  ): DistrictStatisticsInput {
    // Convert ClubStatistics[] to ScrapedRecord[] format
    // Map the transformed fields back to the raw CSV column names
    const clubPerformance: ScrapedRecord[] = snapshot.clubs.map(club => ({
      // Membership fields
      'Active Members': club.membershipCount,
      'Active Membership': club.membershipCount,
      Membership: club.membershipCount,
      'Mem. Base': club.membershipBase,

      // Payment fields
      'Oct. Ren.': club.octoberRenewals,
      'Oct. Ren': club.octoberRenewals,
      'Apr. Ren.': club.aprilRenewals,
      'Apr. Ren': club.aprilRenewals,
      'New Members': club.newMembers,
      New: club.newMembers,

      // DCP Goals
      'Goals Met': club.dcpGoals,

      // Club identification
      'Club Number': club.clubId,
      'Club ID': club.clubId,
      ClubID: club.clubId,
      'Club Name': club.clubName,

      // Status fields - map clubStatus to distinguished status if available
      'Club Distinguished Status': club.clubStatus ?? '',

      // CSP field - assume submitted if not explicitly marked otherwise
      // Historical data compatibility: if field doesn't exist, assume submitted
      CSP: 'Yes',
    }))

    // Calculate total membership from totals if available
    const membershipTotal = snapshot.totals?.totalMembership ?? 0

    return {
      districtId: snapshot.districtId,
      asOfDate: snapshot.snapshotDate,
      membership: {
        total: membershipTotal,
      },
      clubPerformance,
    }
  }

  /**
   * Check if snapshot exists for a date
   */
  async snapshotExists(date: string): Promise<boolean> {
    const snapshotDir = this.getSnapshotDir(date)
    try {
      await fs.access(snapshotDir)
      return true
    } catch {
      return false
    }
  }

  /**
   * Check if analytics already exist for a district
   */
  async analyticsExist(date: string, districtId: string): Promise<boolean> {
    const analyticsDir = this.getAnalyticsDir(date)
    const analyticsPath = path.join(
      analyticsDir,
      `district_${districtId}_analytics.json`
    )
    try {
      await fs.access(analyticsPath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Calculate SHA256 checksum of a file's content
   *
   * Requirement 5.1: Track checksums of source snapshot files
   */
  private calculateChecksum(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex')
  }

  /**
   * Calculate the checksum of a snapshot file
   *
   * Requirement 5.1: Track checksums of source snapshot files
   */
  async calculateSnapshotChecksum(
    date: string,
    districtId: string
  ): Promise<string | null> {
    const snapshotPath = this.getDistrictSnapshotPath(date, districtId)
    try {
      const content = await fs.readFile(snapshotPath, 'utf-8')
      return this.calculateChecksum(content)
    } catch {
      return null
    }
  }

  /**
   * Get the stored source snapshot checksum from existing analytics
   *
   * Requirement 5.2: Compare the current snapshot checksum with the checksum
   * used in the last computation
   */
  async getStoredSnapshotChecksum(
    date: string,
    districtId: string
  ): Promise<string | null> {
    const analyticsDir = this.getAnalyticsDir(date)
    const analyticsPath = path.join(
      analyticsDir,
      `district_${districtId}_analytics.json`
    )

    try {
      const content = await fs.readFile(analyticsPath, 'utf-8')
      const parsed = JSON.parse(
        content
      ) as PreComputedAnalyticsFile<DistrictAnalytics>
      return parsed.metadata.sourceSnapshotChecksum ?? null
    } catch {
      return null
    }
  }

  /**
   * Check if analytics need recomputation based on snapshot checksum
   *
   * Requirements:
   * - 5.1: Track checksums of source snapshot files
   * - 5.2: Compare the current snapshot checksum with the checksum used in the last computation
   * - 5.3: Skip analytics recomputation if snapshot checksum is unchanged
   */
  async checkAnalyticsStatus(
    date: string,
    districtId: string
  ): Promise<AnalyticsCheckResult> {
    const exists = await this.analyticsExist(date, districtId)

    if (!exists) {
      // Analytics don't exist, need to compute
      const currentChecksum = await this.calculateSnapshotChecksum(
        date,
        districtId
      )
      return {
        exists: false,
        needsRecomputation: true,
        currentChecksum: currentChecksum ?? undefined,
      }
    }

    // Analytics exist, check if snapshot has changed
    const currentChecksum = await this.calculateSnapshotChecksum(
      date,
      districtId
    )
    const storedChecksum = await this.getStoredSnapshotChecksum(
      date,
      districtId
    )

    // If we can't calculate current checksum, something is wrong
    if (!currentChecksum) {
      return {
        exists: true,
        needsRecomputation: false, // Can't recompute without snapshot
        storedChecksum: storedChecksum ?? undefined,
      }
    }

    // If no stored checksum (legacy analytics), need to recompute to add it
    if (!storedChecksum) {
      this.logger.debug('No stored checksum found, recomputation needed', {
        date,
        districtId,
      })
      return {
        exists: true,
        needsRecomputation: true,
        currentChecksum,
      }
    }

    // Compare checksums
    const needsRecomputation = currentChecksum !== storedChecksum

    if (needsRecomputation) {
      this.logger.debug('Snapshot checksum changed, recomputation needed', {
        date,
        districtId,
        storedChecksum,
        currentChecksum,
      })
    }

    return {
      exists: true,
      needsRecomputation,
      storedChecksum,
      currentChecksum,
    }
  }

  /**
   * Load district snapshot from disk
   *
   * Handles both formats:
   * - PerDistrictData wrapper format (from TransformService): { districtId, data: DistrictStatistics }
   * - Direct DistrictStatistics format (legacy/test format): { districtId, snapshotDate, clubs, ... }
   */
  async loadDistrictSnapshot(
    date: string,
    districtId: string
  ): Promise<DistrictStatistics | null> {
    const snapshotPath = this.getDistrictSnapshotPath(date, districtId)

    try {
      const content = await fs.readFile(snapshotPath, 'utf-8')
      const parsed = JSON.parse(content) as Record<string, unknown>

      // Check if this is a PerDistrictData wrapper (has 'data' field with nested structure)
      // or direct DistrictStatistics format (has 'snapshotDate' at top level)
      const dataField = parsed['data']
      if (
        'data' in parsed &&
        typeof dataField === 'object' &&
        dataField !== null
      ) {
        // PerDistrictData wrapper format - extract the nested data
        const wrapper = parsed as { data: DistrictStatistics }
        return wrapper.data
      } else if ('snapshotDate' in parsed) {
        // Direct DistrictStatistics format
        return parsed as unknown as DistrictStatistics
      } else {
        // Unknown format - log warning and try to use as-is
        this.logger.warn(
          'Unknown snapshot format, attempting to use as DistrictStatistics',
          {
            date,
            districtId,
            hasData: 'data' in parsed,
            hasSnapshotDate: 'snapshotDate' in parsed,
          }
        )
        return parsed as unknown as DistrictStatistics
      }
    } catch (error) {
      const err = error as { code?: string }
      if (err.code === 'ENOENT') {
        this.logger.debug('District snapshot not found', {
          date,
          districtId,
          path: snapshotPath,
        })
        return null
      }
      // Re-throw other errors (including JSON parse errors)
      throw error
    }
  }

  /**
   * Load all-districts rankings from disk
   *
   * Requirements:
   * - 5.1: Load the all-districts-rankings.json file for the snapshot date
   * - 5.3: If the all-districts-rankings.json file is not available, log a warning
   *        and compute performance targets with null rankings
   * - 5.4: The Analytics_Compute_Service SHALL NOT fail if all-districts-rankings.json is missing
   *
   * @param date - Snapshot date in YYYY-MM-DD format
   * @returns AllDistrictsRankingsData or null if not found
   */
  async loadAllDistrictsRankings(
    date: string
  ): Promise<AllDistrictsRankingsData | null> {
    const rankingsPath = path.join(
      this.getSnapshotDir(date),
      'all-districts-rankings.json'
    )

    try {
      const content = await fs.readFile(rankingsPath, 'utf-8')
      return JSON.parse(content) as AllDistrictsRankingsData
    } catch (error) {
      const err = error as { code?: string }
      if (err.code === 'ENOENT') {
        // Requirement 5.3: Log warning when file not found
        this.logger.warn('All-districts rankings not found', {
          date,
          path: rankingsPath,
        })
        return null
      }
      // Re-throw other errors (e.g., JSON parse errors, permission errors)
      throw error
    }
  }

  /**
   * Discover available districts from snapshot directory
   */
  async discoverAvailableDistricts(date: string): Promise<string[]> {
    const snapshotDir = this.getSnapshotDir(date)
    const districts: string[] = []

    try {
      const entries = await fs.readdir(snapshotDir)

      for (const entry of entries) {
        // Match district_*.json files
        const match = entry.match(/^district_(.+)\.json$/)
        if (match?.[1]) {
          districts.push(match[1])
        }
      }

      // Sort districts numerically if possible, otherwise alphabetically
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
        this.logger.warn('Snapshot directory not found', { date, snapshotDir })
        return []
      }
      throw error
    }
  }

  /**
   * Compute analytics for a single district
   *
   * Requirements:
   * - 1.2: Compute analytics using the same algorithms as the Analytics_Engine
   * - 1.3: Generate membership trends, club health scores, etc.
   * - 5.1: Track checksums of source snapshot files
   * - 5.2: Compare the current snapshot checksum with the checksum used in the last computation
   * - 5.3: Skip analytics recomputation if snapshot checksum is unchanged
   * - 5.4: Store the source snapshot checksum in the analytics metadata
   * - 5.5: The `--force-analytics` flag bypasses checksum comparison
   * - 5.2 (per-metric-rankings): Pass all-districts rankings data to computePerformanceTargets
   */
  async computeDistrictAnalytics(
    date: string,
    districtId: string,
    options?: {
      force?: boolean
      allDistrictsRankings?: AllDistrictsRankingsData | null
    }
  ): Promise<DistrictComputeResult> {
    const force = options?.force ?? false

    this.logger.info('Computing analytics for district', {
      date,
      districtId,
      force,
    })

    // Check analytics status (existence and checksum comparison)
    const status = await this.checkAnalyticsStatus(date, districtId)

    // Requirement 5.5: --force-analytics bypasses checksum comparison
    if (!force) {
      // Requirement 5.3: Skip if analytics exist and snapshot unchanged
      if (status.exists && !status.needsRecomputation) {
        this.logger.info('Analytics exist and snapshot unchanged, skipping', {
          date,
          districtId,
          storedChecksum: status.storedChecksum,
        })
        return {
          districtId,
          success: true,
          skipped: true,
        }
      }

      // Log why we're recomputing
      if (status.exists && status.needsRecomputation) {
        this.logger.info('Snapshot changed, recomputing analytics', {
          date,
          districtId,
          storedChecksum: status.storedChecksum,
          currentChecksum: status.currentChecksum,
        })
      }
    }

    try {
      // Load district snapshot
      const snapshot = await this.loadDistrictSnapshot(date, districtId)
      if (!snapshot) {
        return {
          districtId,
          success: false,
          error: `Snapshot not found for district ${districtId} on ${date}`,
        }
      }

      // Requirement 5.1: Calculate checksum of source snapshot
      const sourceSnapshotChecksum =
        status.currentChecksum ??
        (await this.calculateSnapshotChecksum(date, districtId))

      // Requirement 5.2 (per-metric-rankings): Load all-districts rankings if not provided
      // Rankings are loaded once per compute operation and passed to each district computation
      let allDistrictsRankings = options?.allDistrictsRankings
      if (allDistrictsRankings === undefined) {
        // Load rankings if not already provided (for single-district computation)
        allDistrictsRankings = await this.loadAllDistrictsRankings(date)
        if (!allDistrictsRankings) {
          this.logger.warn(
            'All-districts rankings not available, rankings will be null',
            {
              date,
              districtId,
            }
          )
        }
      }

      // Compute analytics using shared AnalyticsComputer
      // Note: AnalyticsComputer expects an array of snapshots for trend analysis
      // For single-date computation, we pass an array with one snapshot
      // Requirement 5.2 (per-metric-rankings): Pass allDistrictsRankings via options
      const computationResult =
        await this.analyticsComputer.computeDistrictAnalytics(
          districtId,
          [snapshot],
          {
            allDistrictsRankings: allDistrictsRankings ?? undefined,
          }
        )

      // Requirement 5.4: Pass source snapshot checksum to AnalyticsWriter
      const writeOptions = sourceSnapshotChecksum
        ? { sourceSnapshotChecksum }
        : undefined

      // Write analytics files using AnalyticsWriter
      // Base analytics files (existing)
      const analyticsPath = await this.analyticsWriter.writeDistrictAnalytics(
        date,
        districtId,
        computationResult.districtAnalytics,
        writeOptions
      )

      const membershipPath = await this.analyticsWriter.writeMembershipTrends(
        date,
        districtId,
        computationResult.membershipTrends,
        writeOptions
      )

      const clubHealthPath = await this.analyticsWriter.writeClubHealth(
        date,
        districtId,
        computationResult.clubHealth,
        writeOptions
      )

      // NEW: Write extended analytics files (Requirements 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1)
      const membershipAnalyticsPath =
        await this.analyticsWriter.writeMembershipAnalytics(
          date,
          districtId,
          computationResult.membershipAnalytics,
          writeOptions
        )

      const vulnerableClubsPath =
        await this.analyticsWriter.writeVulnerableClubs(
          date,
          districtId,
          computationResult.vulnerableClubs,
          writeOptions
        )

      const leadershipInsightsPath =
        await this.analyticsWriter.writeLeadershipInsights(
          date,
          districtId,
          computationResult.leadershipInsights,
          writeOptions
        )

      const distinguishedAnalyticsPath =
        await this.analyticsWriter.writeDistinguishedClubAnalytics(
          date,
          districtId,
          computationResult.distinguishedClubAnalytics,
          writeOptions
        )

      const yearOverYearPath = await this.analyticsWriter.writeYearOverYear(
        date,
        districtId,
        computationResult.yearOverYear,
        writeOptions
      )

      const performanceTargetsPath =
        await this.analyticsWriter.writePerformanceTargets(
          date,
          districtId,
          computationResult.performanceTargets,
          writeOptions
        )

      const clubTrendsIndexPath =
        await this.analyticsWriter.writeClubTrendsIndex(
          date,
          districtId,
          computationResult.clubTrendsIndex,
          writeOptions
        )

      // NEW: Write time-series data point (Requirements 4.1, 9.1, 9.2, 9.4)
      // Build and write time-series data point using the same snapshot data
      // Errors are handled gracefully - log and continue, don't fail the whole operation
      let timeSeriesWritten = false
      let timeSeriesError: string | undefined

      try {
        // Get the builder from TimeSeriesIndexWriter
        const builder = this.timeSeriesWriter.getBuilder()

        // Convert the DistrictStatistics to DistrictStatisticsInput format
        // The builder expects raw CSV-like data with clubPerformance array
        const districtInput = this.convertToDistrictStatisticsInput(snapshot)

        // Build the time-series data point
        const dataPoint = builder.build(date, districtInput)

        // Write the data point to the time-series index
        await this.timeSeriesWriter.writeDataPoint(districtId, dataPoint)

        // Update the index metadata for this district
        await this.timeSeriesWriter.updateMetadata(districtId)

        timeSeriesWritten = true

        this.logger.info('Time-series data point written', {
          date,
          districtId,
          membership: dataPoint.membership,
          payments: dataPoint.payments,
          dcpGoals: dataPoint.dcpGoals,
          distinguishedTotal: dataPoint.distinguishedTotal,
        })
      } catch (error) {
        // Requirement 9.4: Log error and continue with other districts
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error'
        timeSeriesError = errorMessage
        this.logger.error(
          'Failed to write time-series data point (continuing)',
          {
            date,
            districtId,
            error: errorMessage,
          }
        )
      }

      this.logger.info('Analytics computed and written', {
        date,
        districtId,
        analyticsPath,
        membershipPath,
        clubHealthPath,
        membershipAnalyticsPath,
        vulnerableClubsPath,
        leadershipInsightsPath,
        distinguishedAnalyticsPath,
        yearOverYearPath,
        performanceTargetsPath,
        clubTrendsIndexPath,
        timeSeriesWritten,
        sourceSnapshotChecksum,
      })

      return {
        districtId,
        success: true,
        analyticsPath,
        membershipPath,
        clubHealthPath,
        membershipAnalyticsPath,
        vulnerableClubsPath,
        leadershipInsightsPath,
        distinguishedAnalyticsPath,
        yearOverYearPath,
        performanceTargetsPath,
        clubTrendsIndexPath,
        timeSeriesWritten,
        timeSeriesError,
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      this.logger.error('Failed to compute analytics for district', {
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
   * Compute analytics for all available districts
   *
   * Requirements:
   * - 1.2: Compute analytics for each district
   * - 1.3: Generate all analytics types
   * - 1.5: IF analytics computation fails for a district, THEN continue processing
   */
  async compute(
    options: ComputeOperationOptions
  ): Promise<ComputeOperationResult> {
    const startTime = Date.now()
    const { date, districts: requestedDistricts, force, verbose } = options

    if (verbose) {
      this.logger.info('Starting compute-analytics operation', {
        date,
        requestedDistricts,
        force,
      })
    }

    // Check if snapshot exists for the date
    const snapshotExists = await this.snapshotExists(date)
    if (!snapshotExists) {
      this.logger.error('Snapshot not found for date', { date })
      return {
        success: false,
        date,
        districtsProcessed: [],
        districtsSucceeded: [],
        districtsFailed: [],
        districtsSkipped: [],
        analyticsLocations: [],
        errors: [
          {
            districtId: 'N/A',
            error: `Snapshot not found for date ${date}`,
            timestamp: new Date().toISOString(),
          },
        ],
        duration_ms: Date.now() - startTime,
      }
    }

    // Discover available districts if not specified
    let districtsToCompute: string[]
    if (requestedDistricts && requestedDistricts.length > 0) {
      districtsToCompute = requestedDistricts
    } else {
      districtsToCompute = await this.discoverAvailableDistricts(date)
    }

    if (districtsToCompute.length === 0) {
      this.logger.warn('No districts found to compute analytics for', { date })
      return {
        success: false,
        date,
        districtsProcessed: [],
        districtsSucceeded: [],
        districtsFailed: [],
        districtsSkipped: [],
        analyticsLocations: [],
        errors: [
          {
            districtId: 'N/A',
            error: `No district snapshots found for date ${date}`,
            timestamp: new Date().toISOString(),
          },
        ],
        duration_ms: Date.now() - startTime,
      }
    }

    // Compute analytics for each district
    const results: DistrictComputeResult[] = []
    const errors: Array<{
      districtId: string
      error: string
      timestamp: string
    }> = []
    const analyticsLocations: string[] = []
    const manifestEntries: AnalyticsManifestEntry[] = []

    // Requirement 5.2 (per-metric-rankings): Load rankings once per compute operation
    // This is more efficient than loading for each district
    const allDistrictsRankings = await this.loadAllDistrictsRankings(date)
    if (!allDistrictsRankings) {
      this.logger.warn(
        'All-districts rankings not available, per-metric rankings will be null',
        { date }
      )
    }

    for (const districtId of districtsToCompute) {
      const result = await this.computeDistrictAnalytics(date, districtId, {
        force,
        allDistrictsRankings,
      })
      results.push(result)

      if (result.success && !result.skipped) {
        // Collect analytics file paths
        // Base analytics files (existing)
        if (result.analyticsPath) {
          analyticsLocations.push(result.analyticsPath)
          const entry = await this.analyticsWriter.createManifestEntry(
            result.analyticsPath,
            districtId,
            'analytics'
          )
          manifestEntries.push(entry)
        }
        if (result.membershipPath) {
          analyticsLocations.push(result.membershipPath)
          const entry = await this.analyticsWriter.createManifestEntry(
            result.membershipPath,
            districtId,
            'membership'
          )
          manifestEntries.push(entry)
        }
        if (result.clubHealthPath) {
          analyticsLocations.push(result.clubHealthPath)
          const entry = await this.analyticsWriter.createManifestEntry(
            result.clubHealthPath,
            districtId,
            'clubhealth'
          )
          manifestEntries.push(entry)
        }

        // NEW: Extended analytics files (Requirements 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1, 12.3)
        if (result.membershipAnalyticsPath) {
          analyticsLocations.push(result.membershipAnalyticsPath)
          const entry = await this.analyticsWriter.createManifestEntry(
            result.membershipAnalyticsPath,
            districtId,
            'membership-analytics'
          )
          manifestEntries.push(entry)
        }
        if (result.vulnerableClubsPath) {
          analyticsLocations.push(result.vulnerableClubsPath)
          const entry = await this.analyticsWriter.createManifestEntry(
            result.vulnerableClubsPath,
            districtId,
            'vulnerable-clubs'
          )
          manifestEntries.push(entry)
        }
        if (result.leadershipInsightsPath) {
          analyticsLocations.push(result.leadershipInsightsPath)
          const entry = await this.analyticsWriter.createManifestEntry(
            result.leadershipInsightsPath,
            districtId,
            'leadership-insights'
          )
          manifestEntries.push(entry)
        }
        if (result.distinguishedAnalyticsPath) {
          analyticsLocations.push(result.distinguishedAnalyticsPath)
          const entry = await this.analyticsWriter.createManifestEntry(
            result.distinguishedAnalyticsPath,
            districtId,
            'distinguished-analytics'
          )
          manifestEntries.push(entry)
        }
        if (result.yearOverYearPath) {
          analyticsLocations.push(result.yearOverYearPath)
          const entry = await this.analyticsWriter.createManifestEntry(
            result.yearOverYearPath,
            districtId,
            'year-over-year'
          )
          manifestEntries.push(entry)
        }
        if (result.performanceTargetsPath) {
          analyticsLocations.push(result.performanceTargetsPath)
          const entry = await this.analyticsWriter.createManifestEntry(
            result.performanceTargetsPath,
            districtId,
            'performance-targets'
          )
          manifestEntries.push(entry)
        }
        if (result.clubTrendsIndexPath) {
          analyticsLocations.push(result.clubTrendsIndexPath)
          const entry = await this.analyticsWriter.createManifestEntry(
            result.clubTrendsIndexPath,
            districtId,
            'club-trends-index'
          )
          manifestEntries.push(entry)
        }
      } else if (!result.success && result.error) {
        // Requirement 1.5: Log error and continue processing
        errors.push({
          districtId,
          error: result.error,
          timestamp: new Date().toISOString(),
        })
      }
    }

    // Write analytics manifest if we have any successful computations
    const successfulResults = results.filter(r => r.success && !r.skipped)
    if (successfulResults.length > 0 && manifestEntries.length > 0) {
      try {
        await this.analyticsWriter.writeAnalyticsManifest(date, manifestEntries)
        const manifestPath = path.join(
          this.getAnalyticsDir(date),
          'manifest.json'
        )
        analyticsLocations.push(manifestPath)
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error'
        this.logger.error('Failed to write analytics manifest', {
          date,
          error: errorMessage,
        })
        errors.push({
          districtId: 'N/A',
          error: `Failed to write analytics manifest: ${errorMessage}`,
          timestamp: new Date().toISOString(),
        })
      }
    }

    // Calculate result statistics
    const districtsProcessed = districtsToCompute
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
      this.logger.info('Compute-analytics operation completed', {
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
      analyticsLocations,
      errors,
      duration_ms: Date.now() - startTime,
    }
  }
}
