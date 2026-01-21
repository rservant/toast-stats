/**
 * Area Gap Analysis Calculation Module
 *
 * This module provides functions for calculating gap analysis for areas
 * in the Distinguished Area Program (DAP). It determines what an area
 * needs to achieve each recognition level.
 *
 * Requirements: 5.4, 5.5, 5.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */

/**
 * Recognition levels for areas in the Distinguished Area Program
 *
 * - 'none': Does not meet any recognition level criteria
 * - 'distinguished': Meets Distinguished Area criteria (≥50% of paid clubs distinguished)
 * - 'select': Meets Select Distinguished Area criteria (≥75% of paid clubs distinguished)
 * - 'presidents': Meets President's Distinguished Area criteria (100% of paid clubs distinguished)
 */
export type RecognitionLevel =
  | 'none'
  | 'distinguished'
  | 'select'
  | 'presidents'

/**
 * Gap information for achieving a specific recognition level
 */
export interface GapToLevel {
  /** Whether this level is already achieved */
  achieved: boolean
  /** Number of additional distinguished clubs needed (0 if achieved) */
  clubsNeeded: number
  /** Whether this level is achievable (paid threshold met) */
  achievable: boolean
}

/**
 * Complete gap analysis for an area
 *
 * Contains the current recognition level achieved and the gaps
 * to each recognition level, including whether the paid clubs
 * threshold is met.
 */
export interface GapAnalysis {
  /** Current recognition level achieved */
  currentLevel: RecognitionLevel
  /** Whether paid clubs threshold (75%) is met */
  meetsPaidThreshold: boolean
  /** Number of additional paid clubs needed (0 if threshold met) */
  paidClubsNeeded: number
  /** Gap to Distinguished level */
  distinguishedGap: GapToLevel
  /** Gap to Select Distinguished level */
  selectGap: GapToLevel
  /** Gap to President's Distinguished level */
  presidentsGap: GapToLevel
}

/**
 * Input parameters for gap analysis calculation
 */
export interface AreaMetrics {
  /** Number of clubs at the start of the program year (club base) */
  clubBase: number
  /** Current number of clubs that have met membership payment requirements */
  paidClubs: number
  /** Current number of clubs that have achieved Distinguished status */
  distinguishedClubs: number
}

/**
 * DAP threshold constants
 */
const PAID_CLUBS_THRESHOLD = 0.75 // 75% of clubs must be paid
const DISTINGUISHED_THRESHOLD = 0.5 // 50% for Distinguished
const SELECT_THRESHOLD = 0.75 // 75% for Select Distinguished
const PRESIDENTS_THRESHOLD = 1.0 // 100% for President's Distinguished

/**
 * Calculates the number of paid clubs needed to meet the 75% threshold
 *
 * Property 6: Paid Clubs Gap = max(0, Math.ceil(clubBase * 0.75) - paidClubs)
 *
 * @param clubBase - Number of clubs at the start of the program year
 * @param paidClubs - Current number of paid clubs
 * @returns Number of additional paid clubs needed (0 if threshold met)
 *
 * @example
 * calculatePaidClubsGap(4, 2) // Returns 1 (need 3 paid clubs, have 2)
 * calculatePaidClubsGap(4, 3) // Returns 0 (threshold met)
 * calculatePaidClubsGap(0, 0) // Returns 0 (edge case: no clubs)
 *
 * Requirements: 6.1
 */
export function calculatePaidClubsGap(
  clubBase: number,
  paidClubs: number
): number {
  // Edge case: zero clubs means no gap
  if (clubBase === 0) {
    return 0
  }

  const requiredPaidClubs = Math.ceil(clubBase * PAID_CLUBS_THRESHOLD)
  return Math.max(0, requiredPaidClubs - paidClubs)
}

/**
 * Calculates the paid clubs percentage
 *
 * Property 3: Paid Clubs Percentage = Math.round((paidClubs / clubBase) * 100)
 *
 * @param clubBase - Number of clubs at the start of the program year
 * @param paidClubs - Current number of paid clubs
 * @returns Paid clubs percentage (0-100), 0 when clubBase is 0
 *
 * Requirements: 5.4
 */
export function calculatePaidClubsPercentage(
  clubBase: number,
  paidClubs: number
): number {
  if (clubBase === 0) {
    return 0
  }
  return Math.round((paidClubs / clubBase) * 100)
}

/**
 * Calculates the distinguished clubs percentage (of paid clubs)
 *
 * Property 4: Distinguished Clubs Percentage = Math.round((distinguishedClubs / paidClubs) * 100),
 * 0 when paidClubs = 0
 *
 * @param paidClubs - Current number of paid clubs
 * @param distinguishedClubs - Current number of distinguished clubs
 * @returns Distinguished clubs percentage (0-100), 0 when paidClubs is 0
 *
 * Requirements: 5.5
 */
export function calculateDistinguishedPercentage(
  paidClubs: number,
  distinguishedClubs: number
): number {
  if (paidClubs === 0) {
    return 0
  }
  return Math.round((distinguishedClubs / paidClubs) * 100)
}

/**
 * Determines the current recognition level based on metrics
 *
 * Property 5: Recognition Level Classification based on thresholds:
 * - If paidClubs/clubBase < 0.75: "none" (paid threshold not met)
 * - Else if distinguishedClubs/paidClubs >= 1.0: "presidents"
 * - Else if distinguishedClubs/paidClubs >= 0.75: "select"
 * - Else if distinguishedClubs/paidClubs >= 0.50: "distinguished"
 * - Else: "none"
 *
 * @param metrics - Area metrics (clubBase, paidClubs, distinguishedClubs)
 * @returns Current recognition level achieved
 *
 * Requirements: 5.6, 6.5
 */
export function determineRecognitionLevel(
  metrics: AreaMetrics
): RecognitionLevel {
  const { clubBase, paidClubs, distinguishedClubs } = metrics

  // Edge case: zero clubs means no recognition possible
  if (clubBase === 0) {
    return 'none'
  }

  // Check paid threshold first (75% of clubs must be paid)
  const paidRatio = paidClubs / clubBase
  if (paidRatio < PAID_CLUBS_THRESHOLD) {
    return 'none'
  }

  // Edge case: zero paid clubs means no recognition possible
  if (paidClubs === 0) {
    return 'none'
  }

  // Calculate distinguished ratio (of paid clubs)
  const distinguishedRatio = distinguishedClubs / paidClubs

  // Check recognition levels in descending order
  if (distinguishedRatio >= PRESIDENTS_THRESHOLD) {
    return 'presidents'
  }
  if (distinguishedRatio >= SELECT_THRESHOLD) {
    return 'select'
  }
  if (distinguishedRatio >= DISTINGUISHED_THRESHOLD) {
    return 'distinguished'
  }

  return 'none'
}

/**
 * Calculates the gap to a specific recognition level
 *
 * Property 7: Distinguished Clubs Gap Calculation
 * - Distinguished gap = max(0, Math.ceil(paidClubs * 0.50) - distinguishedClubs)
 * - Select Distinguished gap = max(0, Math.ceil(paidClubs * 0.75) - distinguishedClubs)
 * - President's Distinguished gap = max(0, paidClubs - distinguishedClubs)
 *
 * @param paidClubs - Current number of paid clubs
 * @param distinguishedClubs - Current number of distinguished clubs
 * @param threshold - The threshold ratio for the level (0.5, 0.75, or 1.0)
 * @param meetsPaidThreshold - Whether the paid clubs threshold is met
 * @returns Gap information for the level
 *
 * Requirements: 6.2, 6.3, 6.4, 6.6
 */
function calculateGapToLevel(
  paidClubs: number,
  distinguishedClubs: number,
  threshold: number,
  meetsPaidThreshold: boolean
): GapToLevel {
  // Property 8: If paid threshold not met, level is not achievable
  if (!meetsPaidThreshold) {
    return {
      achieved: false,
      clubsNeeded: 0,
      achievable: false,
    }
  }

  // Edge case: zero paid clubs
  if (paidClubs === 0) {
    return {
      achieved: false,
      clubsNeeded: 0,
      achievable: false,
    }
  }

  // Calculate required distinguished clubs for this level
  // For President's Distinguished (100%), we need exactly paidClubs
  // For other levels, we use Math.ceil to round up
  const requiredDistinguished =
    threshold === PRESIDENTS_THRESHOLD
      ? paidClubs
      : Math.ceil(paidClubs * threshold)

  const clubsNeeded = Math.max(0, requiredDistinguished - distinguishedClubs)
  const achieved = clubsNeeded === 0

  return {
    achieved,
    clubsNeeded,
    achievable: true,
  }
}

/**
 * Calculates complete gap analysis for an area
 *
 * This function determines the current recognition level and calculates
 * the gaps to each recognition level (Distinguished, Select Distinguished,
 * President's Distinguished).
 *
 * Properties implemented:
 * - Property 3: Paid Clubs Percentage calculation
 * - Property 4: Distinguished Clubs Percentage calculation
 * - Property 5: Recognition Level Classification
 * - Property 6: Paid Clubs Gap calculation
 * - Property 7: Distinguished Clubs Gaps for each level
 * - Property 8: Paid Threshold Blocker Display
 *
 * @param metrics - Area metrics (clubBase, paidClubs, distinguishedClubs)
 * @returns Complete gap analysis for the area
 *
 * @example
 * // Area with 4 clubs, 3 paid, 2 distinguished
 * calculateAreaGapAnalysis({ clubBase: 4, paidClubs: 3, distinguishedClubs: 2 })
 * // Returns: {
 * //   currentLevel: 'distinguished',
 * //   meetsPaidThreshold: true,
 * //   paidClubsNeeded: 0,
 * //   distinguishedGap: { achieved: true, clubsNeeded: 0, achievable: true },
 * //   selectGap: { achieved: false, clubsNeeded: 1, achievable: true },
 * //   presidentsGap: { achieved: false, clubsNeeded: 1, achievable: true }
 * // }
 *
 * @example
 * // Area below paid threshold
 * calculateAreaGapAnalysis({ clubBase: 4, paidClubs: 2, distinguishedClubs: 2 })
 * // Returns: {
 * //   currentLevel: 'none',
 * //   meetsPaidThreshold: false,
 * //   paidClubsNeeded: 1,
 * //   distinguishedGap: { achieved: false, clubsNeeded: 0, achievable: false },
 * //   selectGap: { achieved: false, clubsNeeded: 0, achievable: false },
 * //   presidentsGap: { achieved: false, clubsNeeded: 0, achievable: false }
 * // }
 *
 * Requirements: 5.4, 5.5, 5.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */
export function calculateAreaGapAnalysis(metrics: AreaMetrics): GapAnalysis {
  const { clubBase, paidClubs, distinguishedClubs } = metrics

  // Calculate paid clubs gap (Property 6)
  const paidClubsNeeded = calculatePaidClubsGap(clubBase, paidClubs)

  // Determine if paid threshold is met
  const meetsPaidThreshold = paidClubsNeeded === 0 && clubBase > 0

  // Determine current recognition level (Property 5)
  const currentLevel = determineRecognitionLevel(metrics)

  // Calculate gaps to each level (Property 7, Property 8)
  const distinguishedGap = calculateGapToLevel(
    paidClubs,
    distinguishedClubs,
    DISTINGUISHED_THRESHOLD,
    meetsPaidThreshold
  )

  const selectGap = calculateGapToLevel(
    paidClubs,
    distinguishedClubs,
    SELECT_THRESHOLD,
    meetsPaidThreshold
  )

  const presidentsGap = calculateGapToLevel(
    paidClubs,
    distinguishedClubs,
    PRESIDENTS_THRESHOLD,
    meetsPaidThreshold
  )

  return {
    currentLevel,
    meetsPaidThreshold,
    paidClubsNeeded,
    distinguishedGap,
    selectGap,
    presidentsGap,
  }
}
