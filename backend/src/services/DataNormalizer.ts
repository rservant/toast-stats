/**
 * DataNormalizer - Transforms raw scraped data into normalized snapshot format
 *
 * This module encapsulates the transformation logic for converting raw CSV data
 * from the Toastmasters dashboard into the structured NormalizedData format
 * used by the snapshot system.
 *
 * @module DataNormalizer
 */

import type {
  ClosingPeriodDetector,
  ClosingPeriodResult,
} from './ClosingPeriodDetector.js'
import type { NormalizedData } from '../types/snapshots.js'
import type { DistrictStatistics, ScrapedRecord } from '../types/districts.js'

/**
 * Logger interface for dependency injection
 * Allows for flexible logging implementations in production and testing
 */
export interface Logger {
  info(message: string, data?: unknown): void
  warn(message: string, data?: unknown): void
  error(message: string, error?: Error | unknown): void
  debug(message: string, data?: unknown): void
}

/**
 * Raw district data from scraping operations
 */
export interface RawDistrictData {
  /** District performance records from District.aspx */
  districtPerformance: ScrapedRecord[]
  /** Division performance records from Division.aspx */
  divisionPerformance: ScrapedRecord[]
  /** Club performance records from Club.aspx */
  clubPerformance: ScrapedRecord[]
}

/**
 * Raw data collected from scraping operations
 * This interface matches the RawData structure from RefreshService
 */
export interface RawData {
  /** All districts summary data */
  allDistricts: ScrapedRecord[]

  /** Metadata about all districts data source */
  allDistrictsMetadata: {
    fromCache: boolean
    csvDate: string
    fetchedAt: string
    /** Data month from cache metadata (YYYY-MM format), if available */
    dataMonth?: string
    /** Whether this is closing period data from cache metadata */
    isClosingPeriod?: boolean
  }

  /** District-specific performance data (configured districts only) */
  districtData: Map<string, RawDistrictData>

  /** Metadata about the scraping operation */
  scrapingMetadata: {
    startTime: string
    endTime: string
    durationMs: number
    districtCount: number
    errors: string[]
    /** Per-district error tracking */
    districtErrors: Map<string, DistrictError[]>
    /** Successfully processed districts */
    successfulDistricts: string[]
    /** Failed districts */
    failedDistricts: string[]
  }
}

/**
 * Error information for a specific district
 */
export interface DistrictError {
  /** District ID that failed */
  districtId: string
  /** Type of operation that failed */
  operation: 'districtPerformance' | 'divisionPerformance' | 'clubPerformance'
  /** Error message */
  error: string
  /** Timestamp when error occurred */
  timestamp: string
  /** Whether this district should be retried in next refresh */
  shouldRetry: boolean
}

/**
 * Dependencies required by DataNormalizer
 */
export interface DataNormalizerDependencies {
  /** Logger instance for diagnostic output */
  logger: Logger
  /** Closing period detector for date handling */
  closingPeriodDetector: ClosingPeriodDetector
}

/**
 * Result of normalization including closing period info
 */
export interface NormalizationResult {
  /** The normalized data */
  normalizedData: NormalizedData
  /** Closing period detection result */
  closingPeriodInfo: ClosingPeriodResult
}

/**
 * Transforms raw scraped data into normalized snapshot format
 *
 * This class handles the conversion of raw CSV data from the Toastmasters
 * dashboard into the structured NormalizedData format. It extracts membership
 * totals, club counts, and other statistics from the raw records.
 */
export class DataNormalizer {
  private readonly logger: Logger
  private readonly closingPeriodDetector: ClosingPeriodDetector

  constructor(dependencies: DataNormalizerDependencies) {
    this.logger = dependencies.logger
    this.closingPeriodDetector = dependencies.closingPeriodDetector
  }

  /**
   * Normalize all raw data into NormalizedData format
   *
   * @param rawData - Raw data from scraping operations
   * @returns Normalization result with normalized data and closing period info
   */
  async normalize(rawData: RawData): Promise<NormalizationResult> {
    const startTime = Date.now()
    this.logger.info('Starting data normalization', {
      districtCount: rawData.districtData.size,
    })

    try {
      const districts: DistrictStatistics[] = []

      // Process each district's data
      // Use the csvDate from allDistrictsMetadata as the authoritative "as of" date
      const dataAsOfDate = rawData.allDistrictsMetadata.csvDate
      for (const [districtId, data] of Array.from(
        rawData.districtData.entries()
      )) {
        try {
          const districtStats = await this.normalizeDistrictData(
            districtId,
            data,
            dataAsOfDate
          )
          districts.push(districtStats)
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error'
          this.logger.warn('Failed to normalize district data', {
            districtId,
            error: errorMessage,
          })
          // Continue with other districts rather than failing completely
        }
      }

      if (districts.length === 0) {
        throw new Error('No districts were successfully normalized')
      }

      const processingDurationMs = Date.now() - startTime

      // Detect closing period using cache metadata or derive from csvDate
      // dataMonth comes from cache metadata if available, otherwise derive from csvDate
      const dataMonth =
        rawData.allDistrictsMetadata.dataMonth ??
        rawData.allDistrictsMetadata.csvDate.substring(0, 7) // Extract YYYY-MM from csvDate

      const closingPeriodInfo = this.closingPeriodDetector.detect(
        rawData.allDistrictsMetadata.csvDate,
        dataMonth
      )

      this.logger.info('Closing period detection completed', {
        csvDate: rawData.allDistrictsMetadata.csvDate,
        dataMonth,
        isClosingPeriod: closingPeriodInfo.isClosingPeriod,
        snapshotDate: closingPeriodInfo.snapshotDate,
        collectionDate: closingPeriodInfo.collectionDate,
      })

      // Build normalized data structure
      const normalizedData: NormalizedData = {
        districts,
        metadata: {
          source: 'toastmasters-dashboard',
          fetchedAt: rawData.scrapingMetadata.startTime,
          dataAsOfDate: rawData.allDistrictsMetadata.csvDate,
          districtCount: districts.length,
          processingDurationMs,
          // Closing period tracking fields
          isClosingPeriodData: closingPeriodInfo.isClosingPeriod,
          collectionDate: closingPeriodInfo.collectionDate,
          logicalDate: closingPeriodInfo.snapshotDate,
        },
      }

      this.logger.info('Completed data normalization', {
        inputDistricts: rawData.districtData.size,
        outputDistricts: districts.length,
        processingDurationMs,
        isClosingPeriodData: closingPeriodInfo.isClosingPeriod,
      })

      return {
        normalizedData,
        closingPeriodInfo,
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      this.logger.error('Data normalization failed', { error: errorMessage })
      throw new Error(`Normalization failed: ${errorMessage}`)
    }
  }

  /**
   * Normalize data for a single district
   *
   * @param districtId - The district ID
   * @param data - Raw scraped data for the district
   * @param asOfDate - The actual "as of" date from the CSV data (not today's date)
   * @returns Normalized district statistics
   */
  async normalizeDistrictData(
    districtId: string,
    data: RawDistrictData,
    asOfDate: string
  ): Promise<DistrictStatistics> {
    // Transform raw CSV data into structured DistrictStatistics format
    const districtStats: DistrictStatistics = {
      districtId,
      asOfDate,
      membership: {
        total: this.extractMembershipTotal(data.clubPerformance),
        change: 0,
        changePercent: 0,
        byClub: this.extractClubMembership(data.clubPerformance),
      },
      clubs: {
        total: data.clubPerformance.length,
        active: this.countActiveClubs(data.clubPerformance),
        suspended: this.countSuspendedClubs(data.clubPerformance),
        ineligible: this.countIneligibleClubs(data.clubPerformance),
        low: this.countLowClubs(data.clubPerformance),
        distinguished: this.countDistinguishedClubs(data.clubPerformance),
      },
      education: {
        totalAwards: 0,
        byType: [],
        topClubs: [],
      },
      // Preserve raw data for caching purposes
      districtPerformance: data.districtPerformance,
      divisionPerformance: data.divisionPerformance,
      clubPerformance: data.clubPerformance,
    }

    return districtStats
  }

  /**
   * Extract total membership from club performance data
   *
   * @param clubPerformance - Array of club performance records
   * @returns Total membership count
   */
  extractMembershipTotal(clubPerformance: ScrapedRecord[]): number {
    let total = 0
    for (const club of clubPerformance) {
      const members =
        club['Active Members'] || club['Membership'] || club['Members']
      if (typeof members === 'string') {
        const parsed = parseInt(members, 10)
        if (!isNaN(parsed)) {
          total += parsed
        }
      } else if (typeof members === 'number') {
        total += members
      }
    }
    return total
  }

  /**
   * Extract club membership details
   *
   * @param clubPerformance - Array of club performance records
   * @returns Array of club membership details
   */
  extractClubMembership(clubPerformance: ScrapedRecord[]): Array<{
    clubId: string
    clubName: string
    memberCount: number
  }> {
    return clubPerformance
      .map(club => ({
        clubId: String(club['Club Number'] || club['ClubId'] || ''),
        clubName: String(club['Club Name'] || club['ClubName'] || ''),
        memberCount: this.parseNumber(
          club['Active Members'] || club['Membership'] || club['Members'] || 0
        ),
      }))
      .filter(club => club.clubId && club.clubName)
  }

  /**
   * Count active clubs from performance data
   * Active clubs are those with "Active" status (or no status specified)
   *
   * @param clubPerformance - Array of club performance records
   * @returns Count of active clubs
   */
  countActiveClubs(clubPerformance: ScrapedRecord[]): number {
    return clubPerformance.filter(club => {
      const status = club['Club Status'] || club['Status']
      if (!status) return true // No status means active
      const statusLower = String(status).toLowerCase()
      return statusLower === 'active' || statusLower === ''
    }).length
  }

  /**
   * Count suspended clubs from performance data
   *
   * @param clubPerformance - Array of club performance records
   * @returns Count of suspended clubs
   */
  countSuspendedClubs(clubPerformance: ScrapedRecord[]): number {
    return clubPerformance.filter(club => {
      const status = club['Club Status'] || club['Status']
      return status && String(status).toLowerCase() === 'suspended'
    }).length
  }

  /**
   * Count ineligible clubs from performance data
   *
   * @param clubPerformance - Array of club performance records
   * @returns Count of ineligible clubs
   */
  countIneligibleClubs(clubPerformance: ScrapedRecord[]): number {
    return clubPerformance.filter(club => {
      const status = club['Club Status'] || club['Status']
      return status && String(status).toLowerCase() === 'ineligible'
    }).length
  }

  /**
   * Count low membership clubs from performance data
   *
   * @param clubPerformance - Array of club performance records
   * @returns Count of low membership clubs
   */
  countLowClubs(clubPerformance: ScrapedRecord[]): number {
    return clubPerformance.filter(club => {
      const status = club['Club Status'] || club['Status']
      return status && String(status).toLowerCase() === 'low'
    }).length
  }

  /**
   * Count distinguished clubs from performance data
   *
   * @param clubPerformance - Array of club performance records
   * @returns Count of distinguished clubs
   */
  countDistinguishedClubs(clubPerformance: ScrapedRecord[]): number {
    return clubPerformance.filter(club => {
      const distinguished =
        club['Club Distinguished Status'] || club['Distinguished']
      return (
        distinguished &&
        String(distinguished).toLowerCase().includes('distinguished')
      )
    }).length
  }

  /**
   * Parse a number from various input types
   *
   * @param value - Value to parse (string, number, or other)
   * @returns Parsed number or 0 if parsing fails
   */
  parseNumber(value: unknown): number {
    if (typeof value === 'number') return value
    if (typeof value === 'string') {
      const parsed = parseInt(value, 10)
      return isNaN(parsed) ? 0 : parsed
    }
    return 0
  }
}
