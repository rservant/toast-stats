/**
 * PreComputedAnalyticsService
 *
 * Computes and stores analytics summaries during snapshot creation.
 * This enables fast retrieval of analytics data without on-demand computation.
 *
 * Requirements:
 * - 1.1: Compute and store analytics summaries for each district in the snapshot
 * - 1.5: Store pre-computed analytics in a dedicated analytics summary file within the snapshot directory
 */

import fs from 'fs/promises'
import path from 'path'
import { logger } from '../utils/logger.js'
import type { DistrictStatistics, ScrapedRecord } from '../types/districts.js'
import type {
  PreComputedAnalyticsSummary,
  AnalyticsSummaryFile,
  ClubHealthCounts,
  DistinguishedClubCounts,
  TrendDataPoint,
  ValidationSummary,
  RejectionReason,
} from '../types/precomputedAnalytics.js'
import { ANALYTICS_SUMMARY_SCHEMA_VERSION } from '../types/precomputedAnalytics.js'

/**
 * Configuration for PreComputedAnalyticsService
 */
export interface PreComputedAnalyticsServiceConfig {
  /** Base directory for snapshot storage */
  snapshotsDir: string
}

/**
 * Result of computing analytics for a single district
 */
interface DistrictComputationResult {
  success: boolean
  districtId: string
  summary?: PreComputedAnalyticsSummary
  error?: string
}

/**
 * Service for computing and storing pre-computed analytics summaries.
 *
 * This service is called during snapshot creation to generate analytics
 * that can be quickly retrieved without expensive on-demand computation.
 */
export class PreComputedAnalyticsService {
  private readonly snapshotsDir: string

  constructor(config: PreComputedAnalyticsServiceConfig) {
    this.snapshotsDir = config.snapshotsDir
  }

  /**
   * Compute and store analytics for a snapshot
   *
   * Called during snapshot creation to pre-compute analytics summaries
   * for all districts in the snapshot.
   *
   * Requirement 1.1: Compute and store analytics summaries for each district
   * Requirement 1.4: Log errors and continue if individual district fails
   * Requirement 1.5: Store in analytics-summary.json within snapshot directory
   *
   * @param snapshotId - The snapshot ID (date string, e.g., "2024-01-15")
   * @param districtData - Array of district statistics to compute analytics for
   */
  async computeAndStore(
    snapshotId: string,
    districtData: DistrictStatistics[]
  ): Promise<void> {
    const startTime = Date.now()
    const operationId = `compute_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    logger.info('Starting pre-computed analytics computation', {
      operation: 'computeAndStore',
      operationId,
      snapshotId,
      districtCount: districtData.length,
    })

    const districts: Record<string, PreComputedAnalyticsSummary> = {}
    const rejectionReasons: RejectionReason[] = []
    let validRecords = 0
    let rejectedRecords = 0

    // Compute analytics for each district
    for (const district of districtData) {
      const result = this.computeDistrictAnalytics(snapshotId, district)

      if (result.success && result.summary) {
        districts[district.districtId] = result.summary
        validRecords++
      } else {
        rejectedRecords++
        rejectionReasons.push({
          districtId: district.districtId,
          reason: result.error ?? 'Unknown error during computation',
        })

        // Requirement 1.4: Log error and continue with other districts
        logger.warn('Failed to compute analytics for district', {
          operation: 'computeAndStore',
          operationId,
          snapshotId,
          districtId: district.districtId,
          error: result.error,
        })
      }
    }

    // Build validation summary
    const validation: ValidationSummary = {
      totalRecords: districtData.length,
      validRecords,
      rejectedRecords,
      rejectionReasons,
    }

    // Build the analytics summary file
    const analyticsSummaryFile: AnalyticsSummaryFile = {
      snapshotId,
      computedAt: new Date().toISOString(),
      schemaVersion: ANALYTICS_SUMMARY_SCHEMA_VERSION,
      districts,
      validation,
    }

    // Write to analytics-summary.json in snapshot directory
    await this.writeAnalyticsSummaryFile(snapshotId, analyticsSummaryFile)

    const duration = Date.now() - startTime
    logger.info('Completed pre-computed analytics computation', {
      operation: 'computeAndStore',
      operationId,
      snapshotId,
      totalDistricts: districtData.length,
      successfulDistricts: validRecords,
      failedDistricts: rejectedRecords,
      durationMs: duration,
    })
  }

  /**
   * Get pre-computed analytics for a specific district in a snapshot
   *
   * @param districtId - The district ID to retrieve analytics for
   * @param snapshotId - The snapshot ID (date string)
   * @returns Pre-computed analytics summary or null if not found
   */
  async getAnalyticsSummary(
    districtId: string,
    snapshotId: string
  ): Promise<PreComputedAnalyticsSummary | null> {
    try {
      const summaryFile = await this.readAnalyticsSummaryFile(snapshotId)

      if (!summaryFile) {
        logger.debug('Analytics summary file not found', {
          operation: 'getAnalyticsSummary',
          snapshotId,
          districtId,
        })
        return null
      }

      const districtSummary = summaryFile.districts[districtId]

      if (!districtSummary) {
        logger.debug('District not found in analytics summary', {
          operation: 'getAnalyticsSummary',
          snapshotId,
          districtId,
          availableDistricts: Object.keys(summaryFile.districts).length,
        })
        return null
      }

      return districtSummary
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to get analytics summary', {
        operation: 'getAnalyticsSummary',
        snapshotId,
        districtId,
        error: errorMessage,
      })
      return null
    }
  }

  /**
   * Get the latest analytics summary for a district
   *
   * Finds the most recent snapshot and returns the analytics summary
   * for the specified district.
   *
   * @param districtId - The district ID to retrieve analytics for
   * @returns Pre-computed analytics summary or null if not found
   */
  async getLatestSummary(
    districtId: string
  ): Promise<PreComputedAnalyticsSummary | null> {
    try {
      // Find the latest snapshot with analytics
      const latestSnapshotId = await this.findLatestSnapshotWithAnalytics()

      if (!latestSnapshotId) {
        logger.debug('No snapshots with analytics found', {
          operation: 'getLatestSummary',
          districtId,
        })
        return null
      }

      return this.getAnalyticsSummary(districtId, latestSnapshotId)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to get latest analytics summary', {
        operation: 'getLatestSummary',
        districtId,
        error: errorMessage,
      })
      return null
    }
  }

  // ========== Private Helper Methods ==========

  /**
   * Compute analytics for a single district
   *
   * Requirement 1.2: Include membership totals, club health counts, and distinguished club counts
   * Requirement 1.3: Include membership trend data points for the snapshot date
   */
  private computeDistrictAnalytics(
    snapshotId: string,
    district: DistrictStatistics
  ): DistrictComputationResult {
    try {
      // Calculate membership totals
      const totalMembership = this.calculateTotalMembership(district)

      // Calculate club health counts
      const clubCounts = this.calculateClubHealthCounts(district)

      // Calculate distinguished club counts
      const distinguishedClubs = this.calculateDistinguishedClubCounts(district)

      // Build trend data point for this snapshot
      const trendDataPoint = this.buildTrendDataPoint(district, totalMembership)

      // Build the summary
      const summary: PreComputedAnalyticsSummary = {
        snapshotId,
        districtId: district.districtId,
        computedAt: new Date().toISOString(),
        totalMembership,
        membershipChange: 0, // Will be calculated when comparing to previous snapshot
        clubCounts,
        distinguishedClubs,
        trendDataPoint,
      }

      return {
        success: true,
        districtId: district.districtId,
        summary,
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      return {
        success: false,
        districtId: district.districtId,
        error: errorMessage,
      }
    }
  }

  /**
   * Calculate total membership from district statistics
   *
   * Requirement 1.2: Include membership totals
   */
  private calculateTotalMembership(district: DistrictStatistics): number {
    // Primary: Use membership.total if available
    if (district.membership?.total !== undefined) {
      return district.membership.total
    }

    // Fallback: Sum from club performance data
    if (district.clubPerformance && district.clubPerformance.length > 0) {
      return district.clubPerformance.reduce((total, club) => {
        const membership = this.parseIntSafe(
          club['Active Members'] ??
            club['Active Membership'] ??
            club['Membership']
        )
        return total + membership
      }, 0)
    }

    return 0
  }

  /**
   * Calculate club health counts (thriving, vulnerable, intervention-required)
   *
   * Requirement 1.2: Include club health counts
   */
  private calculateClubHealthCounts(
    district: DistrictStatistics
  ): ClubHealthCounts {
    const clubs = district.clubPerformance ?? []
    const total = clubs.length

    let thriving = 0
    let vulnerable = 0
    let interventionRequired = 0

    for (const club of clubs) {
      const membership = this.parseIntSafe(
        club['Active Members'] ??
          club['Active Membership'] ??
          club['Membership']
      )
      const dcpGoals = this.parseIntSafe(club['Goals Met'])
      const memBase = this.parseIntSafe(club['Mem. Base'])
      const netGrowth = membership - memBase

      // Classification rules from ClubHealthAnalyticsModule:
      // 1. Intervention Required: membership < 12 AND net growth < 3
      // 2. Thriving: membership requirement met AND DCP checkpoint met
      // 3. Vulnerable: any requirement not met (but not intervention)

      if (membership < 12 && netGrowth < 3) {
        interventionRequired++
      } else {
        // Membership requirement: >= 20 OR net growth >= 3
        const membershipRequirementMet = membership >= 20 || netGrowth >= 3

        // DCP checkpoint: simplified check (dcpGoals > 0)
        const dcpCheckpointMet = dcpGoals > 0

        if (membershipRequirementMet && dcpCheckpointMet) {
          thriving++
        } else {
          vulnerable++
        }
      }
    }

    return {
      total,
      thriving,
      vulnerable,
      interventionRequired,
    }
  }

  /**
   * Calculate distinguished club counts by level
   *
   * Requirement 1.2: Include distinguished club counts
   */
  private calculateDistinguishedClubCounts(
    district: DistrictStatistics
  ): DistinguishedClubCounts {
    const clubs = district.clubPerformance ?? []

    let smedley = 0
    let presidents = 0
    let select = 0
    let distinguished = 0

    for (const club of clubs) {
      const level = this.determineDistinguishedLevel(club)

      switch (level) {
        case 'Smedley':
          smedley++
          break
        case 'Presidents':
          presidents++
          break
        case 'Select':
          select++
          break
        case 'Distinguished':
          distinguished++
          break
      }
    }

    return {
      smedley,
      presidents,
      select,
      distinguished,
      total: smedley + presidents + select + distinguished,
    }
  }

  /**
   * Determine distinguished level for a club
   *
   * Uses the same logic as DistinguishedClubAnalyticsModule:
   * - Primary: Use 'Club Distinguished Status' field
   * - Fallback: Calculate from DCP goals, membership, and net growth
   */
  private determineDistinguishedLevel(
    club: ScrapedRecord
  ): 'Smedley' | 'Presidents' | 'Select' | 'Distinguished' | null {
    // Check CSP status first (required for 2025-2026+)
    const cspSubmitted = this.getCSPStatus(club)
    if (!cspSubmitted) {
      return null
    }

    // Primary: Try to extract from Club Distinguished Status field
    const statusField = club['Club Distinguished Status']
    const levelFromStatus =
      this.extractDistinguishedLevelFromStatus(statusField)

    if (levelFromStatus) {
      return levelFromStatus
    }

    // Fallback: Calculate based on DCP goals, membership, and net growth
    const dcpGoals = this.parseIntSafe(club['Goals Met'])
    const membership = this.parseIntSafe(
      club['Active Members'] ?? club['Active Membership'] ?? club['Membership']
    )
    const memBase = this.parseIntSafe(club['Mem. Base'])
    const netGrowth = membership - memBase

    // Smedley Distinguished: 10 goals + 25 members
    if (dcpGoals >= 10 && membership >= 25) {
      return 'Smedley'
    }
    // President's Distinguished: 9 goals + 20 members
    if (dcpGoals >= 9 && membership >= 20) {
      return 'Presidents'
    }
    // Select Distinguished: 7 goals + (20 members OR net growth of 5)
    if (dcpGoals >= 7 && (membership >= 20 || netGrowth >= 5)) {
      return 'Select'
    }
    // Distinguished: 5 goals + (20 members OR net growth of 3)
    if (dcpGoals >= 5 && (membership >= 20 || netGrowth >= 3)) {
      return 'Distinguished'
    }

    return null
  }

  /**
   * Extract distinguished level from Club Distinguished Status field
   */
  private extractDistinguishedLevelFromStatus(
    statusField: string | number | null | undefined
  ): 'Smedley' | 'Presidents' | 'Select' | 'Distinguished' | null {
    if (statusField === null || statusField === undefined) {
      return null
    }

    const status = String(statusField).toLowerCase().trim()

    if (status === '' || status === 'none' || status === 'n/a') {
      return null
    }

    if (status.includes('smedley')) {
      return 'Smedley'
    }
    if (status.includes('president')) {
      return 'Presidents'
    }
    if (status.includes('select')) {
      return 'Select'
    }
    if (status.includes('distinguished')) {
      return 'Distinguished'
    }

    return null
  }

  /**
   * Get CSP (Club Success Plan) submission status from club data
   */
  private getCSPStatus(club: ScrapedRecord): boolean {
    const cspValue =
      club['CSP'] ??
      club['Club Success Plan'] ??
      club['CSP Submitted'] ??
      club['Club Success Plan Submitted']

    // Historical data compatibility: if field doesn't exist, assume submitted
    if (cspValue === undefined || cspValue === null) {
      return true
    }

    const cspString = String(cspValue).toLowerCase().trim()

    if (
      cspString === 'yes' ||
      cspString === 'true' ||
      cspString === '1' ||
      cspString === 'submitted' ||
      cspString === 'y'
    ) {
      return true
    }

    if (
      cspString === 'no' ||
      cspString === 'false' ||
      cspString === '0' ||
      cspString === 'not submitted' ||
      cspString === 'n'
    ) {
      return false
    }

    // Default to true for unknown values
    return true
  }

  /**
   * Build trend data point for this snapshot
   *
   * Requirement 1.3: Include membership trend data points for the snapshot date
   */
  private buildTrendDataPoint(
    district: DistrictStatistics,
    totalMembership: number
  ): TrendDataPoint {
    // Calculate total payments from club data
    const payments = this.calculateTotalPayments(district)

    // Calculate total DCP goals achieved
    const dcpGoals = this.calculateTotalDCPGoals(district)

    return {
      date: district.asOfDate,
      membership: totalMembership,
      payments,
      dcpGoals,
    }
  }

  /**
   * Calculate total membership payments from district data
   */
  private calculateTotalPayments(district: DistrictStatistics): number {
    const clubs = district.clubPerformance ?? []

    return clubs.reduce((total, club) => {
      // Sum October renewals, April renewals, and new members
      const octRenewals = this.parseIntSafe(
        club['Oct. Ren.'] ?? club['Oct. Ren']
      )
      const aprRenewals = this.parseIntSafe(
        club['Apr. Ren.'] ?? club['Apr. Ren']
      )
      const newMembers = this.parseIntSafe(club['New Members'] ?? club['New'])

      return total + octRenewals + aprRenewals + newMembers
    }, 0)
  }

  /**
   * Calculate total DCP goals achieved across all clubs
   */
  private calculateTotalDCPGoals(district: DistrictStatistics): number {
    const clubs = district.clubPerformance ?? []

    return clubs.reduce((total, club) => {
      const goals = this.parseIntSafe(club['Goals Met'])
      return total + goals
    }, 0)
  }

  /**
   * Parse an integer value safely, returning 0 for invalid values
   */
  private parseIntSafe(value: string | number | null | undefined): number {
    if (value === null || value === undefined || value === '') {
      return 0
    }
    if (typeof value === 'number') {
      return isNaN(value) ? 0 : Math.floor(value)
    }
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed === '') {
        return 0
      }
      const parsed = parseInt(trimmed, 10)
      return isNaN(parsed) ? 0 : parsed
    }
    return 0
  }

  // ========== File I/O Methods ==========

  /**
   * Write analytics summary file to snapshot directory
   *
   * Requirement 1.5: Store in analytics-summary.json within snapshot directory
   */
  private async writeAnalyticsSummaryFile(
    snapshotId: string,
    summaryFile: AnalyticsSummaryFile
  ): Promise<void> {
    const filePath = path.join(
      this.snapshotsDir,
      snapshotId,
      'analytics-summary.json'
    )

    try {
      await fs.writeFile(
        filePath,
        JSON.stringify(summaryFile, null, 2),
        'utf-8'
      )

      logger.debug('Wrote analytics summary file', {
        operation: 'writeAnalyticsSummaryFile',
        snapshotId,
        filePath,
        districtCount: Object.keys(summaryFile.districts).length,
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to write analytics summary file', {
        operation: 'writeAnalyticsSummaryFile',
        snapshotId,
        filePath,
        error: errorMessage,
      })
      throw new Error(`Failed to write analytics summary file: ${errorMessage}`)
    }
  }

  /**
   * Read analytics summary file from snapshot directory
   */
  private async readAnalyticsSummaryFile(
    snapshotId: string
  ): Promise<AnalyticsSummaryFile | null> {
    const filePath = path.join(
      this.snapshotsDir,
      snapshotId,
      'analytics-summary.json'
    )

    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const summaryFile: AnalyticsSummaryFile = JSON.parse(content)

      logger.debug('Read analytics summary file', {
        operation: 'readAnalyticsSummaryFile',
        snapshotId,
        filePath,
        districtCount: Object.keys(summaryFile.districts).length,
      })

      return summaryFile
    } catch (error) {
      if ((error as { code?: string }).code === 'ENOENT') {
        logger.debug('Analytics summary file not found', {
          operation: 'readAnalyticsSummaryFile',
          snapshotId,
          filePath,
        })
        return null
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to read analytics summary file', {
        operation: 'readAnalyticsSummaryFile',
        snapshotId,
        filePath,
        error: errorMessage,
      })
      throw new Error(`Failed to read analytics summary file: ${errorMessage}`)
    }
  }

  /**
   * Find the latest snapshot that has an analytics summary file
   */
  private async findLatestSnapshotWithAnalytics(): Promise<string | null> {
    try {
      // List all snapshot directories
      const entries = await fs.readdir(this.snapshotsDir, {
        withFileTypes: true,
      })

      // Filter to directories and sort by date (newest first)
      const snapshotDirs = entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)
        .sort((a, b) => b.localeCompare(a))

      // Find the first snapshot with an analytics summary file
      for (const snapshotId of snapshotDirs) {
        const analyticsPath = path.join(
          this.snapshotsDir,
          snapshotId,
          'analytics-summary.json'
        )

        try {
          await fs.access(analyticsPath)
          return snapshotId
        } catch {
          // File doesn't exist, continue to next snapshot
          continue
        }
      }

      return null
    } catch (error) {
      if ((error as { code?: string }).code === 'ENOENT') {
        logger.debug('Snapshots directory not found', {
          operation: 'findLatestSnapshotWithAnalytics',
          snapshotsDir: this.snapshotsDir,
        })
        return null
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to find latest snapshot with analytics', {
        operation: 'findLatestSnapshotWithAnalytics',
        error: errorMessage,
      })
      throw error
    }
  }
}
