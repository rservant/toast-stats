/**
 * Legacy transformation utilities for backward compatibility.
 *
 * These utilities handle transformation of legacy pre-computed analytics files
 * that use the old array format for distinguishedClubs to the new counts object format.
 *
 * Requirements:
 * - 4.1: IF the backend reads a pre-computed analytics file with `distinguishedClubs` as an array,
 *        THEN THE Backend SHALL transform it to the expected object format before serving
 * - 4.2: WHEN transforming legacy data, THE Backend SHALL count clubs by their status field
 *        to populate the counts object
 */

import { DistinguishedClubCounts } from '../types/precomputedAnalytics.js'

/**
 * Legacy distinguished club summary format.
 * This represents the old array item format that was used before the type fix.
 */
export interface LegacyDistinguishedClubSummary {
  clubId: string
  clubName: string
  status: 'smedley' | 'president' | 'select' | 'distinguished' | 'none'
  dcpPoints: number
  goalsCompleted: number
}

/**
 * Type guard to detect legacy array format for distinguishedClubs.
 *
 * The legacy format stored distinguishedClubs as an array of DistinguishedClubSummary objects.
 * The new format stores it as a DistinguishedClubCounts object with count properties.
 *
 * @param data - Unknown data to check
 * @returns true if data is in legacy array format
 *
 * Requirements: 4.1
 */
export function isLegacyDistinguishedClubsFormat(
  data: unknown
): data is LegacyDistinguishedClubSummary[] {
  // Must be an array
  if (!Array.isArray(data)) {
    return false
  }

  // Empty array is considered legacy format (valid edge case)
  if (data.length === 0) {
    return true
  }

  // Check if first element looks like a DistinguishedClubSummary
  const firstItem: unknown = data[0]
  if (typeof firstItem !== 'object' || firstItem === null) {
    return false
  }

  const item = firstItem as Record<string, unknown>

  // Check for required properties of DistinguishedClubSummary
  const hasClubId = typeof item['clubId'] === 'string'
  const hasClubName = typeof item['clubName'] === 'string'
  const hasStatus =
    typeof item['status'] === 'string' &&
    ['smedley', 'president', 'select', 'distinguished', 'none'].includes(
      item['status']
    )

  return hasClubId && hasClubName && hasStatus
}

/**
 * Transform legacy distinguishedClubs array to counts object.
 *
 * Counts clubs by their status field to populate the DistinguishedClubCounts object.
 * Each club is counted in exactly one category based on its status.
 *
 * @param legacyData - Array of LegacyDistinguishedClubSummary objects
 * @returns DistinguishedClubCounts object with counts for each level and total
 *
 * Requirements: 4.1, 4.2
 */
export function transformLegacyDistinguishedClubs(
  legacyData: LegacyDistinguishedClubSummary[]
): DistinguishedClubCounts {
  const counts: DistinguishedClubCounts = {
    smedley: 0,
    presidents: 0,
    select: 0,
    distinguished: 0,
    total: 0,
  }

  for (const club of legacyData) {
    switch (club.status) {
      case 'smedley':
        counts.smedley++
        counts.total++
        break
      case 'president':
        counts.presidents++
        counts.total++
        break
      case 'select':
        counts.select++
        counts.total++
        break
      case 'distinguished':
        counts.distinguished++
        counts.total++
        break
      case 'none':
        // Clubs with 'none' status are not counted as distinguished
        break
    }
  }

  return counts
}
