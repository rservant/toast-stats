/**
 * AvailableProgramYearsService
 *
 * Service for querying available program years with ranking data from the SnapshotStore.
 * This service encapsulates the logic for determining which program years have ranking
 * snapshots available for a specific district.
 *
 * Requirements:
 * - 2.1: Display program year selector showing all available program years with ranking data
 * - 2.3: Default to current or most recent program year with available data
 */

import { logger } from '../utils/logger.js'
import type { ISnapshotStorage } from '../types/storageInterfaces.js'
import type {
  ProgramYearWithData,
  AvailableRankingYearsResponse,
} from '../types/districts.js'
import type { IAvailableProgramYearsService } from '../types/serviceInterfaces.js'

// Re-export types for backward compatibility
export type { ProgramYearWithData, AvailableRankingYearsResponse }
export type { IAvailableProgramYearsService }

/**
 * Helper function to calculate program year info from a date
 * Toastmasters program year runs July 1 to June 30
 */
function getProgramYearInfo(dateStr: string): {
  startDate: string
  endDate: string
  year: string
} {
  const date = new Date(dateStr)
  const month = date.getMonth() // 0-indexed (0 = January, 6 = July)
  const year = date.getFullYear()

  // If July or later, program year is current year to next year
  // If before July, program year is previous year to current year
  const programYearStart = month >= 6 ? year : year - 1
  const programYearEnd = programYearStart + 1

  return {
    startDate: `${programYearStart}-07-01`,
    endDate: `${programYearEnd}-06-30`,
    year: `${programYearStart}-${programYearEnd}`,
  }
}

/**
 * Internal structure for tracking program year data during aggregation
 */
interface ProgramYearAggregation {
  year: string
  startDate: string
  endDate: string
  snapshotDates: string[]
  hasDistrictData: boolean
}

/**
 * AvailableProgramYearsService implementation
 *
 * Queries the SnapshotStore to determine which program years have ranking
 * snapshots containing data for a specific district.
 */
export class AvailableProgramYearsService implements IAvailableProgramYearsService {
  private readonly snapshotStore: ISnapshotStorage

  constructor(snapshotStore: ISnapshotStorage) {
    this.snapshotStore = snapshotStore
  }

  /**
   * Get all program years with ranking data available for a district
   *
   * This method:
   * 1. Lists all snapshot IDs (fast prefix listing, ~1s)
   * 2. Checks each for rankings data existence (fast file check)
   * 3. Reads rankings and filters to those containing the specified district
   * 4. Groups by program year and calculates metadata
   *
   * @param districtId - The district ID to query
   * @returns Promise resolving to available program years result
   */
  async getAvailableProgramYears(
    districtId: string
  ): Promise<AvailableRankingYearsResponse> {
    const requestId = `available_years_svc_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`

    logger.info('Querying available program years for district', {
      operation: 'AvailableProgramYearsService.getAvailableProgramYears',
      request_id: requestId,
      district_id: districtId,
    })

    // Use fast prefix listing (~1s) instead of listSnapshots (~91s with 2,370 snapshots)
    const allSnapshotIds = await this.snapshotStore.listSnapshotIds()

    if (allSnapshotIds.length === 0) {
      logger.info('No snapshots available for program years query', {
        operation: 'AvailableProgramYearsService.getAvailableProgramYears',
        request_id: requestId,
        district_id: districtId,
      })

      return {
        districtId,
        programYears: [],
      }
    }

    // Group snapshots by program year and check for district data
    const programYearMap = new Map<string, ProgramYearAggregation>()

    for (const snapshotId of allSnapshotIds) {
      try {
        // Fast existence check — skip snapshots without rankings files
        const hasRankings =
          await this.snapshotStore.hasAllDistrictsRankings(snapshotId)
        if (!hasRankings) {
          continue
        }

        // Read rankings data from snapshot
        const rankings =
          await this.snapshotStore.readAllDistrictsRankings(snapshotId)

        if (!rankings) {
          continue
        }

        // Check if this district exists in the rankings
        const districtRanking = rankings.rankings.find(
          r => r.districtId === districtId
        )

        if (!districtRanking) {
          continue
        }

        // Determine program year for this snapshot
        // Snapshot IDs are YYYY-MM-DD date strings matching sourceCsvDate
        const snapshotDate = rankings.metadata.sourceCsvDate
        const programYearInfo = getProgramYearInfo(snapshotDate)
        const programYearKey = programYearInfo.year

        // Add to program year map
        const existing = programYearMap.get(programYearKey)
        if (existing) {
          existing.snapshotDates.push(snapshotDate)
          existing.hasDistrictData = true
        } else {
          programYearMap.set(programYearKey, {
            year: programYearInfo.year,
            startDate: programYearInfo.startDate,
            endDate: programYearInfo.endDate,
            snapshotDates: [snapshotDate],
            hasDistrictData: true,
          })
        }
      } catch (error) {
        // Log but continue processing other snapshots
        logger.warn('Failed to read rankings from snapshot', {
          operation: 'AvailableProgramYearsService.getAvailableProgramYears',
          request_id: requestId,
          snapshot_id: snapshotId,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // Convert map to array and determine completeness
    const programYears = this.buildProgramYearsResult(programYearMap)

    logger.info('Successfully queried available program years', {
      operation: 'AvailableProgramYearsService.getAvailableProgramYears',
      request_id: requestId,
      district_id: districtId,
      program_years_count: programYears.length,
      program_years: programYears.map(py => py.year),
    })

    return {
      districtId,
      programYears,
    }
  }

  /**
   * Build the final program years result from the aggregation map
   * Determines completeness and sorts by year descending
   */
  private buildProgramYearsResult(
    programYearMap: Map<string, ProgramYearAggregation>
  ): ProgramYearWithData[] {
    const today = new Date()
    const programYears: ProgramYearWithData[] = []

    for (const [, data] of programYearMap) {
      // Sort snapshot dates to find the latest
      const sortedDates = data.snapshotDates.sort((a, b) => b.localeCompare(a))
      const latestSnapshotDate = sortedDates[0] ?? data.startDate

      // Determine if program year is complete
      const hasCompleteData = this.isProgramYearComplete(
        data.endDate,
        sortedDates,
        today
      )

      programYears.push({
        year: data.year,
        startDate: data.startDate,
        endDate: data.endDate,
        hasCompleteData,
        snapshotCount: data.snapshotDates.length,
        latestSnapshotDate,
      })
    }

    // Sort by program year descending (most recent first)
    programYears.sort((a, b) => b.year.localeCompare(a.year))

    return programYears
  }

  /**
   * Determine if a program year has complete data
   *
   * A program year is complete if:
   * 1. The end date has passed (program year has ended)
   * 2. We have at least one snapshot from the final month (June)
   */
  private isProgramYearComplete(
    endDateStr: string,
    sortedDates: string[],
    today: Date
  ): boolean {
    const endDate = new Date(endDateStr)
    const hasEnded = today > endDate

    // Check if we have a snapshot from June of the end year
    const endYear = parseInt(endDateStr.split('-')[0] ?? '0', 10)
    const hasJuneSnapshot = sortedDates.some(date => {
      const [year, month] = date.split('-')
      return year === String(endYear) && month === '06'
    })

    return hasEnded && hasJuneSnapshot
  }
}
