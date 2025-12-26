/**
 * Change Detection Engine for Month-End Data Reconciliation
 *
 * This service compares district data to detect changes during reconciliation periods.
 * It implements significance threshold checking and change metrics calculation.
 */

import { logger } from '../utils/logger'
import type {
  DataChanges,
  ChangeThresholds,
  ChangeMetrics,
  DistinguishedCounts,
} from '../types/reconciliation'
import type { DistrictStatistics } from '../types/districts'

export class ChangeDetectionEngine {
  /**
   * Detects changes between cached and current district data
   *
   * @param districtId - The district ID being compared
   * @param cachedData - Previously cached district statistics
   * @param currentData - Current district statistics from dashboard
   * @returns DataChanges object with detailed change information
   */
  detectChanges(
    districtId: string,
    cachedData: DistrictStatistics,
    currentData: DistrictStatistics
  ): DataChanges {
    logger.debug('Detecting changes for district', {
      districtId,
      cachedDate: cachedData.asOfDate,
      currentDate: currentData.asOfDate,
    })

    const changedFields: string[] = []
    const changes: DataChanges = {
      hasChanges: false,
      changedFields,
      timestamp: new Date(),
      sourceDataDate: currentData.asOfDate,
    }

    // Check membership changes
    const membershipChange = this.detectMembershipChanges(
      cachedData,
      currentData
    )
    if (membershipChange) {
      changes.membershipChange = membershipChange
      changedFields.push('membership')
    }

    // Check club count changes
    const clubCountChange = this.detectClubCountChanges(cachedData, currentData)
    if (clubCountChange) {
      changes.clubCountChange = clubCountChange
      changedFields.push('clubCount')
    }

    // Check distinguished club changes
    const distinguishedChange = this.detectDistinguishedChanges(
      cachedData,
      currentData
    )
    if (distinguishedChange) {
      changes.distinguishedChange = distinguishedChange
      changedFields.push('distinguished')
    }

    changes.hasChanges = changedFields.length > 0

    logger.debug('Change detection completed', {
      districtId,
      hasChanges: changes.hasChanges,
      changedFields: changes.changedFields,
    })

    return changes
  }

  /**
   * Determines if detected changes meet significance thresholds
   *
   * @param changes - The detected changes
   * @param thresholds - Significance thresholds to check against
   * @returns true if changes are significant, false otherwise
   */
  isSignificantChange(
    changes: DataChanges,
    thresholds: ChangeThresholds
  ): boolean {
    if (!changes.hasChanges) {
      return false
    }

    // Check membership significance
    if (changes.membershipChange) {
      const membershipPercent = Math.abs(changes.membershipChange.percentChange)
      if (membershipPercent >= thresholds.membershipPercent) {
        logger.debug('Significant membership change detected', {
          percentChange: membershipPercent,
          threshold: thresholds.membershipPercent,
        })
        return true
      }
    }

    // Check club count significance
    if (changes.clubCountChange) {
      const clubCountChange = Math.abs(changes.clubCountChange.absoluteChange)
      if (clubCountChange >= thresholds.clubCountAbsolute) {
        logger.debug('Significant club count change detected', {
          absoluteChange: clubCountChange,
          threshold: thresholds.clubCountAbsolute,
        })
        return true
      }
    }

    // Check distinguished club significance
    if (changes.distinguishedChange) {
      const distinguishedPercent = Math.abs(
        changes.distinguishedChange.percentChange
      )
      if (distinguishedPercent >= thresholds.distinguishedPercent) {
        logger.debug('Significant distinguished change detected', {
          percentChange: distinguishedPercent,
          threshold: thresholds.distinguishedPercent,
        })
        return true
      }
    }

    return false
  }

  /**
   * Calculates comprehensive change metrics for analysis
   *
   * @param changes - The detected changes
   * @returns ChangeMetrics with calculated impact scores
   */
  calculateChangeMetrics(changes: DataChanges): ChangeMetrics {
    const metrics: ChangeMetrics = {
      totalChanges: changes.changedFields.length,
      significantChanges: 0,
      membershipImpact: 0,
      clubCountImpact: 0,
      distinguishedImpact: 0,
      overallSignificance: 0,
    }

    // Calculate membership impact
    if (changes.membershipChange) {
      metrics.membershipImpact = Math.abs(
        changes.membershipChange.percentChange
      )
      if (metrics.membershipImpact >= 1.0) {
        // Default threshold
        metrics.significantChanges++
      }
    }

    // Calculate club count impact
    if (changes.clubCountChange) {
      // Normalize club count change to percentage-like scale
      const clubCountPercent =
        changes.clubCountChange.previous > 0
          ? Math.abs(
              changes.clubCountChange.absoluteChange /
                changes.clubCountChange.previous
            ) * 100
          : Math.abs(changes.clubCountChange.absoluteChange) * 10 // Arbitrary scaling for zero base

      metrics.clubCountImpact = clubCountPercent
      if (Math.abs(changes.clubCountChange.absoluteChange) >= 1) {
        // Default threshold
        metrics.significantChanges++
      }
    }

    // Calculate distinguished impact
    if (changes.distinguishedChange) {
      metrics.distinguishedImpact = Math.abs(
        changes.distinguishedChange.percentChange
      )
      if (metrics.distinguishedImpact >= 2.0) {
        // Default threshold
        metrics.significantChanges++
      }
    }

    // Calculate overall significance score (weighted average)
    const weights = {
      membership: 0.4,
      clubCount: 0.3,
      distinguished: 0.3,
    }

    metrics.overallSignificance =
      metrics.membershipImpact * weights.membership +
      metrics.clubCountImpact * weights.clubCount +
      metrics.distinguishedImpact * weights.distinguished

    logger.debug('Change metrics calculated', { metrics })

    return metrics
  }

  /**
   * Detects membership-related changes
   */
  private detectMembershipChanges(
    cachedData: DistrictStatistics,
    currentData: DistrictStatistics
  ) {
    const previous = cachedData.membership.total
    const current = currentData.membership.total

    if (previous === current) {
      return null
    }

    const percentChange =
      previous > 0 ? ((current - previous) / previous) * 100 : 0

    return {
      previous,
      current,
      percentChange: parseFloat(percentChange.toFixed(2)),
    }
  }

  /**
   * Detects club count changes
   */
  private detectClubCountChanges(
    cachedData: DistrictStatistics,
    currentData: DistrictStatistics
  ) {
    const previous = cachedData.clubs.total
    const current = currentData.clubs.total

    if (previous === current) {
      return null
    }

    return {
      previous,
      current,
      absoluteChange: current - previous,
    }
  }

  /**
   * Detects distinguished club changes
   */
  private detectDistinguishedChanges(
    cachedData: DistrictStatistics,
    currentData: DistrictStatistics
  ) {
    // Extract distinguished counts from club data
    const previousCounts = this.extractDistinguishedCounts(cachedData)
    const currentCounts = this.extractDistinguishedCounts(currentData)

    // Check if any distinguished metrics changed
    const hasChanges =
      previousCounts.select !== currentCounts.select ||
      previousCounts.distinguished !== currentCounts.distinguished ||
      previousCounts.president !== currentCounts.president ||
      previousCounts.total !== currentCounts.total

    if (!hasChanges) {
      return null
    }

    // Calculate percentage change based on total distinguished clubs
    const percentChange =
      previousCounts.total > 0
        ? ((currentCounts.total - previousCounts.total) /
            previousCounts.total) *
          100
        : 0

    return {
      previous: previousCounts,
      current: currentCounts,
      percentChange: parseFloat(percentChange.toFixed(2)),
    }
  }

  /**
   * Extracts distinguished club counts from district statistics
   * Note: This is a simplified implementation. In a real system, you would
   * need to parse the actual distinguished status data from the clubs.
   */
  private extractDistinguishedCounts(
    data: DistrictStatistics
  ): DistinguishedCounts {
    // For now, we'll use the total distinguished count and estimate breakdowns
    const total = data.clubs.distinguished

    // These would need to be calculated from actual club data in a real implementation
    // For now, we'll use reasonable estimates based on typical distributions
    const select = Math.floor(total * 0.15) // ~15% are typically Select Distinguished
    const president = Math.floor(total * 0.05) // ~5% are typically President's Distinguished
    const distinguished = total - select - president // Remainder are Distinguished

    return {
      select,
      distinguished: Math.max(0, distinguished),
      president,
      total,
    }
  }
}
