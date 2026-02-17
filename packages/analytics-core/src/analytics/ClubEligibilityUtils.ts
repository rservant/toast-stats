/**
 * Club Eligibility Utility Functions
 *
 * Single source of truth for club eligibility calculations used across
 * ClubHealthAnalyticsModule, DistinguishedClubAnalyticsModule, and
 * AreaDivisionRecognitionModule.
 *
 * These functions were extracted to eliminate duplication and fix Bug 1:
 * inconsistent 'Presidents' vs 'President' return values.
 *
 * Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 5.3, 5.4, 5.5
 */

import type { ClubStatistics } from '../interfaces.js'
import type { DistinguishedLevel } from '../types.js'

/**
 * Calculate net growth for a club.
 *
 * Net growth = Active Members - Membership Base
 * Handles missing or zero membershipBase gracefully (defaults to 0).
 *
 * Requirements: 2.1, 2.2
 *
 * @param club - Club statistics data
 * @returns Net growth value (can be negative if membership declined)
 */
export function calculateNetGrowth(club: ClubStatistics): number {
  const currentMembers = club.membershipCount
  const membershipBase = club.membershipBase ?? 0
  return currentMembers - membershipBase
}

/**
 * Determine the distinguished level for a club based on DCP goals,
 * membership, and net growth.
 *
 * Per Toastmasters Distinguished Club Program (§3.2):
 * - Smedley Distinguished:     10 goals + 25 members
 * - President's Distinguished:  9 goals + 20 members
 * - Select Distinguished:       7 goals + (20 members OR net growth >= 5)
 * - Distinguished:              5 goals + (20 members OR net growth >= 3)
 *
 * Returns the HIGHEST applicable level. Levels are evaluated top-down
 * so Smedley (most restrictive) is checked first.
 *
 * Returns values matching the DistinguishedLevel type:
 * 'Smedley' | 'President' | 'Select' | 'Distinguished' | 'NotDistinguished'
 *
 * NOTE: The canonical return value for President's Distinguished is 'President'
 * (without trailing 's') to match the DistinguishedLevel type union.
 *
 * @param dcpGoals - Number of DCP goals achieved
 * @param membership - Current membership count
 * @param netGrowth - Net membership growth (current - base)
 * @returns Distinguished level classification
 */
export function determineDistinguishedLevel(
  dcpGoals: number,
  membership: number,
  netGrowth: number
): DistinguishedLevel {
  // Smedley Distinguished: 10 goals + 25 members
  if (dcpGoals >= 10 && membership >= 25) {
    return 'Smedley'
  }
  // President's Distinguished: 9 goals + 20 members
  if (dcpGoals >= 9 && membership >= 20) {
    return 'President'
  }
  // Select Distinguished: 7 goals + (20 members OR net growth of 5+)
  if (dcpGoals >= 7 && (membership >= 20 || netGrowth >= 5)) {
    return 'Select'
  }
  // Distinguished: 5 goals + (20 members OR net growth of 3+)
  if (dcpGoals >= 5 && (membership >= 20 || netGrowth >= 3)) {
    return 'Distinguished'
  }

  return 'NotDistinguished'
}

/**
 * Get CSP (Club Success Plan) submission status from club data.
 *
 * CSP data availability by program year:
 * - 2025-2026 and later: CSP field is present in CSV data → cspSubmitted is boolean
 * - Prior to 2025-2026: CSP column did not exist → cspSubmitted is undefined
 *
 * When cspSubmitted is undefined (pre-2025 data), we assume CSP was submitted
 * for backward compatibility — CSP was not a requirement before 2025-2026.
 *
 * @param club - Club statistics data
 * @returns true if CSP is submitted or field is absent (historical data), false otherwise
 */
export function getCSPStatus(club: ClubStatistics): boolean {
  // If cspSubmitted is undefined, this is pre-2025 data — assume submitted
  return club.cspSubmitted ?? true
}
