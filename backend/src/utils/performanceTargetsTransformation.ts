/**
 * Performance targets transformation utilities.
 *
 * Transforms PerformanceTargetsData from analytics-core into the
 * DistrictPerformanceTargets format expected by the frontend.
 *
 * The analytics-core PerformanceTargetsData contains:
 * - Rankings for each metric (worldRank, worldPercentile, regionRank)
 * - Current progress values
 * - Target values
 *
 * The frontend DistrictPerformanceTargets expects:
 * - current, base, targets, achievedLevel, rankings for each metric
 *
 * This transformation bridges the gap between the two formats.
 */

import type { PerformanceTargetsData } from '@toastmasters/analytics-core'
import type {
  DistrictPerformanceTargets,
  MetricRankings,
} from '../types/analytics.js'

/**
 * Default null rankings for when data is unavailable
 */
const NULL_RANKINGS: MetricRankings = {
  worldRank: null,
  worldPercentile: null,
  regionRank: null,
  totalDistricts: 0,
  totalInRegion: 0,
  region: null,
}

/**
 * Transforms PerformanceTargetsData from analytics-core into DistrictPerformanceTargets
 * format expected by the frontend.
 *
 * Note: The analytics-core PerformanceTargetsData doesn't include base values or
 * recognition targets (distinguished/select/presidents/smedley thresholds).
 * These would need to be computed from additional data sources or added to
 * the analytics-core computation.
 *
 * For now, this transformation:
 * - Maps rankings from the analytics-core format
 * - Uses currentProgress values for current
 * - Sets base and targets to null (not available in current analytics-core output)
 * - Sets achievedLevel to null (not computed in current analytics-core output)
 *
 * @param performanceTargets - PerformanceTargetsData from analytics-core
 * @returns DistrictPerformanceTargets for frontend consumption
 */
export function transformPerformanceTargets(
  performanceTargets: PerformanceTargetsData
): DistrictPerformanceTargets {
  return {
    paidClubs: {
      current: performanceTargets.paidClubsCount,
      base: null,
      targets: null,
      achievedLevel: null,
      rankings: performanceTargets.paidClubsRankings ?? NULL_RANKINGS,
    },
    membershipPayments: {
      current: performanceTargets.currentProgress.membership,
      base: null,
      targets: null,
      achievedLevel: null,
      rankings: performanceTargets.membershipPaymentsRankings ?? NULL_RANKINGS,
    },
    distinguishedClubs: {
      current: performanceTargets.currentProgress.distinguished,
      base: null,
      targets: null,
      achievedLevel: null,
      rankings: performanceTargets.distinguishedClubsRankings ?? NULL_RANKINGS,
    },
  }
}

/**
 * Creates a null/empty DistrictPerformanceTargets for when data is unavailable.
 *
 * @returns DistrictPerformanceTargets with all null values
 */
export function createNullPerformanceTargets(): DistrictPerformanceTargets {
  return {
    paidClubs: {
      current: 0,
      base: null,
      targets: null,
      achievedLevel: null,
      rankings: NULL_RANKINGS,
    },
    membershipPayments: {
      current: 0,
      base: null,
      targets: null,
      achievedLevel: null,
      rankings: NULL_RANKINGS,
    },
    distinguishedClubs: {
      current: 0,
      base: null,
      targets: null,
      achievedLevel: null,
      rankings: NULL_RANKINGS,
    },
  }
}
