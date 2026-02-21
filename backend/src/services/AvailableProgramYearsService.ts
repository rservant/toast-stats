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

    // Phase 1: Group snapshot IDs by program year using just the date string (no GCS reads)
    // Then count which snapshots have rankings files per program year
    const programYearSnapshots = new Map<
      string,
      { info: ReturnType<typeof getProgramYearInfo>; snapshotIds: string[] }
    >()

    for (const snapshotId of allSnapshotIds) {
      const programYearInfo = getProgramYearInfo(snapshotId)
      const key = programYearInfo.year
      const existing = programYearSnapshots.get(key)
      if (existing) {
        existing.snapshotIds.push(snapshotId)
      } else {
        programYearSnapshots.set(key, {
          info: programYearInfo,
          snapshotIds: [snapshotId],
        })
      }
    }

    // Phase 2: For each program year, count snapshots with rankings and verify district exists
    // This reads only ~1 full rankings file per program year (~10 reads instead of ~2000)
    const programYearMap = new Map<string, ProgramYearAggregation>()

    for (const [
      programYearKey,
      { info, snapshotIds },
    ] of programYearSnapshots) {
      try {
        // Count how many snapshots have rankings files (fast existence checks)
        const rankingsExistence = await Promise.all(
          snapshotIds.map(id => this.snapshotStore.hasAllDistrictsRankings(id))
        )
        const snapshotIdsWithRankings = snapshotIds.filter(
          (_, i) => rankingsExistence[i]
        )

        if (snapshotIdsWithRankings.length === 0) {
          continue
        }

        // Read ONE snapshot to verify the district exists in this program year
        // Try the latest snapshot first (most likely to have the district)
        let districtFound = false
        for (const sampleId of snapshotIdsWithRankings) {
          try {
            const rankings =
              await this.snapshotStore.readAllDistrictsRankings(sampleId)
            if (!rankings) continue

            const districtRanking = rankings.rankings.find(
              r => r.districtId === districtId
            )
            if (districtRanking) {
              districtFound = true
              break
            }
            // District not in this snapshot — try next (rare edge case)
          } catch {
            // Try next snapshot
            continue
          }
        }

        if (!districtFound) {
          continue
        }

        // District verified — record all snapshot dates with rankings
        programYearMap.set(programYearKey, {
          year: info.year,
          startDate: info.startDate,
          endDate: info.endDate,
          snapshotDates: snapshotIdsWithRankings,
          hasDistrictData: true,
        })
      } catch (error) {
        logger.warn('Failed to process program year', {
          operation: 'AvailableProgramYearsService.getAvailableProgramYears',
          request_id: requestId,
          program_year: programYearKey,
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
