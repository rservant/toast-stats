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
 * This transformation maps the analytics-core computed data to the frontend format:
 * - Maps base values (paidClubBase, paymentBase) to the appropriate metrics
 * - Maps recognition targets for each metric
 * - Maps achieved recognition levels for each metric
 * - Maps rankings from the analytics-core format
 *
 * Note: Distinguished clubs use paidClubBase (Club_Base) for their base value,
 * as distinguished club targets are calculated as percentages of the club base.
 *
 * @param performanceTargets - PerformanceTargetsData from analytics-core
 * @returns DistrictPerformanceTargets for frontend consumption
 *
 * Requirements: 7.1-7.9
 */
export function transformPerformanceTargets(
  performanceTargets: PerformanceTargetsData
): DistrictPerformanceTargets {
  return {
    paidClubs: {
      current: performanceTargets.paidClubsCount,
      base: performanceTargets.paidClubBase,
      targets: performanceTargets.paidClubsTargets,
      achievedLevel: performanceTargets.paidClubsAchievedLevel,
      rankings: performanceTargets.paidClubsRankings ?? NULL_RANKINGS,
    },
    membershipPayments: {
      current: performanceTargets.currentProgress.membership,
      base: performanceTargets.paymentBase,
      targets: performanceTargets.membershipPaymentsTargets,
      achievedLevel: performanceTargets.membershipPaymentsAchievedLevel,
      rankings: performanceTargets.membershipPaymentsRankings ?? NULL_RANKINGS,
    },
    distinguishedClubs: {
      current: performanceTargets.currentProgress.distinguished,
      base: performanceTargets.paidClubBase, // Distinguished uses Club_Base
      targets: performanceTargets.distinguishedClubsTargets,
      achievedLevel: performanceTargets.distinguishedClubsAchievedLevel,
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
