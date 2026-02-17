/**
 * Risk Factors Conversion Utilities
 *
 * Provides functions to convert between ClubRiskFactors object format
 * and string array format used by the frontend.
 *
 * Requirements: 2.6
 */

import type { ClubRiskFactors } from '../types.js'

/**
 * Risk factor labels used in string array format.
 * These are the human-readable strings that appear in the riskFactors array.
 */
export const RISK_FACTOR_LABELS = {
  lowMembership: 'Low membership',
  decliningMembership: 'Declining membership',
  lowPayments: 'Low payments',
  inactiveOfficers: 'Inactive officers',
  noRecentMeetings: 'No recent meetings',
} as const

/**
 * Convert ClubRiskFactors object to string array format.
 *
 * This function takes a ClubRiskFactors object with boolean flags and
 * converts it to an array of human-readable risk factor strings.
 *
 * @param factors - ClubRiskFactors object with boolean flags
 * @returns Array of risk factor strings for each true flag
 *
 * Requirements: 2.6
 */
export function riskFactorsToStringArray(factors: ClubRiskFactors): string[] {
  const result: string[] = []

  if (factors.lowMembership) {
    result.push(RISK_FACTOR_LABELS.lowMembership)
  }
  if (factors.decliningMembership) {
    result.push(RISK_FACTOR_LABELS.decliningMembership)
  }
  if (factors.lowPayments) {
    result.push(RISK_FACTOR_LABELS.lowPayments)
  }
  if (factors.inactiveOfficers) {
    result.push(RISK_FACTOR_LABELS.inactiveOfficers)
  }
  if (factors.noRecentMeetings) {
    result.push(RISK_FACTOR_LABELS.noRecentMeetings)
  }

  return result
}

/**
 * Convert string array back to ClubRiskFactors object format.
 *
 * This function takes an array of risk factor strings and converts it
 * back to a ClubRiskFactors object with boolean flags.
 *
 * @param riskFactorStrings - Array of risk factor strings
 * @returns ClubRiskFactors object with boolean flags set based on string presence
 *
 * Requirements: 2.6
 */
export function stringArrayToRiskFactors(
  riskFactorStrings: string[]
): ClubRiskFactors {
  return {
    lowMembership: riskFactorStrings.includes(RISK_FACTOR_LABELS.lowMembership),
    decliningMembership: riskFactorStrings.includes(
      RISK_FACTOR_LABELS.decliningMembership
    ),
    lowPayments: riskFactorStrings.includes(RISK_FACTOR_LABELS.lowPayments),
    inactiveOfficers: riskFactorStrings.includes(
      RISK_FACTOR_LABELS.inactiveOfficers
    ),
    noRecentMeetings: riskFactorStrings.includes(
      RISK_FACTOR_LABELS.noRecentMeetings
    ),
  }
}
