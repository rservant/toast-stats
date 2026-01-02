/**
 * HealthDataMerger Service
 *
 * Merges club performance data with health classification data using sophisticated
 * club name matching strategies. Handles data age calculation and health status
 * determination for the club health table integration.
 */

import type {
  ClubHealthResult,
  HealthStatus,
  Trajectory,
} from '../types/clubHealth'
import type {
  EnhancedClubTrend,
  HealthDataStatus,
  ProcessedClubTrend,
} from '../components/filters/types'

/**
 * Interface for club name matching result
 */
interface NameMatchResult {
  healthData: ClubHealthResult
  matchType: 'exact' | 'normalized' | 'fuzzy' | 'none'
  confidence: number
}

/**
 * Service for merging club performance data with health classification data
 */
export class HealthDataMerger {
  /**
   * Merges club performance data with health classification data
   *
   * @param clubTrends - Array of club performance data (already processed)
   * @param healthResults - Array of health classification results
   * @returns Enhanced club data with health information
   */
  static mergeClubData(
    clubTrends: ProcessedClubTrend[],
    healthResults: ClubHealthResult[]
  ): EnhancedClubTrend[] {
    // Create a map of health results by normalized club name for efficient lookup
    const healthMap = new Map<string, ClubHealthResult>()
    const healthByExactName = new Map<string, ClubHealthResult>()

    // Index health results by both exact and normalized names
    healthResults.forEach(health => {
      const exactName = health.club_name.toLowerCase().trim()
      const normalizedName = this.normalizeClubName(health.club_name)

      healthByExactName.set(exactName, health)
      healthMap.set(normalizedName, health)
    })

    return clubTrends.map(club => {
      const matchResult = this.findBestMatch(
        club.clubName,
        healthResults,
        healthByExactName,
        healthMap
      )

      if (matchResult.matchType === 'none') {
        // No health data found - return with unknown status
        return this.createEnhancedClubTrend(club, null)
      }

      return this.createEnhancedClubTrend(club, matchResult.healthData)
    })
  }

  /**
   * Normalizes club names for matching by removing special characters and extra spaces
   *
   * @param name - Original club name
   * @returns Normalized club name
   */
  private static normalizeClubName(name: string): string {
    return (
      name
        .toLowerCase()
        .trim()
        // Remove common prefixes and suffixes
        .replace(/^(the\s+|club\s+)/i, '')
        .replace(/(\s+club|\s+toastmasters?|\s+tm)$/i, '')
        // Remove special characters and extra spaces
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    )
  }

  /**
   * Finds the best matching health data for a club name using multiple strategies
   *
   * @param clubName - Club name to match
   * @param healthResults - All health results for fuzzy matching
   * @param healthByExactName - Map of health results by exact name
   * @param healthMap - Map of health results by normalized name
   * @returns Best match result
   */
  private static findBestMatch(
    clubName: string,
    healthResults: ClubHealthResult[],
    healthByExactName: Map<string, ClubHealthResult>,
    healthMap: Map<string, ClubHealthResult>
  ): NameMatchResult {
    const exactName = clubName.toLowerCase().trim()
    const normalizedName = this.normalizeClubName(clubName)

    // Strategy 1: Exact name match (case-insensitive)
    const exactMatch = healthByExactName.get(exactName)
    if (exactMatch) {
      return {
        healthData: exactMatch,
        matchType: 'exact',
        confidence: 1.0,
      }
    }

    // Strategy 2: Normalized name match
    const normalizedMatch = healthMap.get(normalizedName)
    if (normalizedMatch) {
      return {
        healthData: normalizedMatch,
        matchType: 'normalized',
        confidence: 0.9,
      }
    }

    // Strategy 3: Fuzzy matching for common variations
    const fuzzyMatch = this.findFuzzyMatch(clubName, healthResults)
    if (fuzzyMatch) {
      return fuzzyMatch
    }

    // No match found
    return {
      healthData: {} as ClubHealthResult,
      matchType: 'none',
      confidence: 0,
    }
  }

  /**
   * Performs fuzzy matching for common club name variations
   *
   * @param clubName - Club name to match
   * @param healthResults - All health results to search
   * @returns Best fuzzy match or null
   */
  private static findFuzzyMatch(
    clubName: string,
    healthResults: ClubHealthResult[]
  ): NameMatchResult | null {
    const normalizedTarget = this.normalizeClubName(clubName)
    let bestMatch: NameMatchResult | null = null
    let bestScore = 0

    for (const health of healthResults) {
      const normalizedHealth = this.normalizeClubName(health.club_name)
      const similarity = this.calculateStringSimilarity(
        normalizedTarget,
        normalizedHealth
      )

      // Consider it a match if similarity is above 80%
      if (similarity > 0.8 && similarity > bestScore) {
        bestMatch = {
          healthData: health,
          matchType: 'fuzzy',
          confidence: similarity,
        }
        bestScore = similarity
      }
    }

    return bestMatch
  }

  /**
   * Calculates string similarity using Levenshtein distance
   *
   * @param str1 - First string
   * @param str2 - Second string
   * @returns Similarity score between 0 and 1
   */
  private static calculateStringSimilarity(str1: string, str2: string): number {
    const maxLength = Math.max(str1.length, str2.length)
    if (maxLength === 0) return 1.0

    const distance = this.levenshteinDistance(str1, str2)
    return (maxLength - distance) / maxLength
  }

  /**
   * Calculates Levenshtein distance between two strings
   *
   * @param str1 - First string
   * @param str2 - Second string
   * @returns Edit distance
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1)
      .fill(null)
      .map(() => Array(str1.length + 1).fill(null))

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        )
      }
    }

    return matrix[str2.length][str1.length]
  }

  /**
   * Creates an enhanced club trend with health data
   *
   * @param club - Original processed club trend data
   * @param healthData - Health classification data (null if not found)
   * @returns Enhanced club trend
   */
  private static createEnhancedClubTrend(
    club: ProcessedClubTrend,
    healthData: ClubHealthResult | null
  ): EnhancedClubTrend {
    const baseEnhanced: EnhancedClubTrend = {
      ...club, // This already includes latestMembership, latestDcpGoals, distinguishedOrder
      healthStatus: healthData?.health_status || undefined,
      trajectory: healthData?.trajectory || undefined,
      healthReasons: healthData?.reasons || undefined,
      trajectoryReasons: healthData?.trajectory_reasons || undefined,
      healthDataAge: healthData
        ? this.calculateDataAge(healthData.metadata.evaluation_date)
        : undefined,
      healthDataTimestamp: healthData?.metadata.evaluation_date || undefined,
      healthStatusOrder: this.getHealthStatusOrder(healthData?.health_status),
      trajectoryOrder: this.getTrajectoryOrder(healthData?.trajectory),
    }

    return baseEnhanced
  }

  /**
   * Calculates data age in hours from timestamp
   *
   * @param timestamp - ISO timestamp string
   * @returns Age in hours
   */
  static calculateDataAge(timestamp: string): number {
    try {
      // Handle missing or invalid timestamp data
      if (!timestamp || timestamp.trim() === '') {
        return 9999 // Very old data indicator
      }

      const evaluationDate = new Date(timestamp)

      // Check if the date is valid
      if (isNaN(evaluationDate.getTime())) {
        return 9999 // Invalid timestamp - return a large number to indicate very old data
      }

      const now = new Date()
      const diffMs = now.getTime() - evaluationDate.getTime()

      // Ensure we don't return negative values for future dates
      const ageHours = Math.floor(diffMs / (1000 * 60 * 60))
      return Math.max(0, ageHours) // Convert to hours, minimum 0
    } catch {
      // Invalid timestamp - return a large number to indicate very old data
      return 9999
    }
  }

  /**
   * Determines health data status based on age and availability
   *
   * @param healthResults - Health classification results
   * @param isLoading - Whether data is currently loading
   * @param error - Any error that occurred during loading
   * @returns Health data status
   */
  static getHealthDataStatus(
    healthResults: ClubHealthResult[],
    isLoading: boolean,
    error?: Error
  ): HealthDataStatus {
    if (isLoading) {
      return {
        isLoading: true,
        isError: false,
        isStale: false,
        isOutdated: false,
      }
    }

    if (error) {
      return {
        isLoading: false,
        isError: true,
        isStale: false,
        isOutdated: false,
        errorMessage: error.message,
      }
    }

    if (healthResults.length === 0) {
      return {
        isLoading: false,
        isError: false,
        isStale: false,
        isOutdated: false,
      }
    }

    // Find the most recent evaluation date, handling missing or invalid timestamps
    let mostRecentDate = new Date(0) // Start with epoch
    let hasValidTimestamp = false

    for (const result of healthResults) {
      try {
        const timestamp = result.metadata?.evaluation_date
        if (timestamp && timestamp.trim() !== '') {
          const resultDate = new Date(timestamp)
          if (!isNaN(resultDate.getTime())) {
            hasValidTimestamp = true
            if (resultDate > mostRecentDate) {
              mostRecentDate = resultDate
            }
          }
        }
      } catch {
        // Skip invalid timestamps
        continue
      }
    }

    // If no valid timestamps found, treat as outdated
    if (!hasValidTimestamp) {
      return {
        isLoading: false,
        isError: false,
        isStale: true,
        isOutdated: true,
        lastUpdated: undefined,
      }
    }

    const dataAge = this.calculateDataAge(mostRecentDate.toISOString())
    const isStale = dataAge > 24 // More than 24 hours old
    const isOutdated = dataAge > 168 // More than 7 days old (168 hours)

    return {
      isLoading: false,
      isError: false,
      isStale,
      isOutdated,
      lastUpdated: mostRecentDate.toISOString(),
    }
  }

  /**
   * Gets sort order for health status
   *
   * @param healthStatus - Health status value
   * @returns Sort order number (lower = higher priority)
   */
  private static getHealthStatusOrder(healthStatus?: HealthStatus): number {
    switch (healthStatus) {
      case 'Intervention Required':
        return 0
      case 'Vulnerable':
        return 1
      case 'Thriving':
        return 2
      default:
        return 3 // Unknown
    }
  }

  /**
   * Gets sort order for trajectory
   *
   * @param trajectory - Trajectory value
   * @returns Sort order number (lower = higher priority)
   */
  private static getTrajectoryOrder(trajectory?: Trajectory): number {
    switch (trajectory) {
      case 'Declining':
        return 0
      case 'Stable':
        return 1
      case 'Recovering':
        return 2
      default:
        return 3 // Unknown
    }
  }
}
