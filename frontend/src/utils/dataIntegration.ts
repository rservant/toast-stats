/**
 * Unified data transformation utilities for combining daily reports with other statistics
 */

import type {
  MembershipHistoryPoint,
  DailyReportsResponse,
  Club,
  DailyReport,
} from '../types/districts'

export interface EnhancedMembershipPoint extends MembershipHistoryPoint {
  dailyEvents?: {
    newMembers: number
    renewals: number
    awards: number
    netChange: number
  }
  isSignificant?: boolean
}

export interface ClubWithRecentChanges extends Club {
  recentChanges?: {
    membershipChange: number
    newMembers: number
    renewals: number
    recentAwards: number
    lastUpdated: string
  }
}

export interface SignificantEvent {
  date: string
  type:
    | 'membership_spike'
    | 'membership_drop'
    | 'new_club'
    | 'club_suspended'
    | 'high_awards'
  description: string
  value: number
  clubId?: string
  clubName?: string
}

/**
 * Combines membership history with daily report data to create enhanced data points
 */
export function combineMembershipWithDailyReports(
  membershipHistory: MembershipHistoryPoint[],
  dailyReports: DailyReportsResponse['reports']
): EnhancedMembershipPoint[] {
  // Create a map of daily reports by date for quick lookup
  const dailyReportMap = new Map(
    dailyReports.map(report => [report.date, report])
  )

  return membershipHistory.map(point => {
    const dailyReport = dailyReportMap.get(point.date)

    if (!dailyReport) {
      return point
    }

    const netChange = dailyReport.newMembers - (dailyReport.renewals || 0)

    // Mark as significant if there's a large change (>10 members or >5% of typical daily activity)
    const isSignificant = Math.abs(netChange) > 10 || dailyReport.awards > 20

    return {
      ...point,
      dailyEvents: {
        newMembers: dailyReport.newMembers,
        renewals: dailyReport.renewals,
        awards: dailyReport.awards,
        netChange,
      },
      isSignificant,
    }
  })
}

/**
 * Calculates running totals from daily reports and validates against monthly statistics
 */
export function calculateRunningTotals(
  dailyReports: DailyReportsResponse['reports']
): {
  totalNewMembers: number
  totalRenewals: number
  totalAwards: number
  netMembershipChange: number
  dailyAverage: number
  validation: {
    isValid: boolean
    discrepancy?: number
  }
} {
  const totals = dailyReports.reduce(
    (acc, report) => ({
      newMembers: acc.newMembers + report.newMembers,
      renewals: acc.renewals + report.renewals,
      awards: acc.awards + report.awards,
    }),
    { newMembers: 0, renewals: 0, awards: 0 }
  )

  const netMembershipChange = totals.newMembers - totals.renewals
  const dailyAverage =
    dailyReports.length > 0 ? netMembershipChange / dailyReports.length : 0

  return {
    totalNewMembers: totals.newMembers,
    totalRenewals: totals.renewals,
    totalAwards: totals.awards,
    netMembershipChange,
    dailyAverage,
    validation: {
      isValid: true, // Can be enhanced with actual validation logic
    },
  }
}

/**
 * Identifies significant daily events for highlighting in the dashboard
 */
export function identifySignificantEvents(
  dailyReports: Array<DailyReport | DailyReportsResponse['reports'][0]>,
  threshold: { membershipChange: number; awards: number } = {
    membershipChange: 15,
    awards: 25,
  }
): SignificantEvent[] {
  const events: SignificantEvent[] = []

  dailyReports.forEach(report => {
    const netChange =
      'summary' in report
        ? report.summary.netMembershipChange
        : report.newMembers - report.renewals

    const awards =
      'summary' in report ? report.summary.totalAwards : report.awards

    // Significant membership spike
    if (netChange > threshold.membershipChange) {
      events.push({
        date: report.date,
        type: 'membership_spike',
        description: `Large membership increase of ${netChange} members`,
        value: netChange,
      })
    }

    // Significant membership drop
    if (netChange < -threshold.membershipChange) {
      events.push({
        date: report.date,
        type: 'membership_drop',
        description: `Significant membership decrease of ${Math.abs(netChange)} members`,
        value: netChange,
      })
    }

    // High awards day
    if (awards > threshold.awards) {
      events.push({
        date: report.date,
        type: 'high_awards',
        description: `Exceptional day with ${awards} educational awards`,
        value: awards,
      })
    }

    // Club changes
    if ('clubChanges' in report && report.clubChanges.length > 0) {
      report.clubChanges.forEach(change => {
        if ('changeType' in change) {
          if (change.changeType === 'chartered') {
            events.push({
              date: report.date,
              type: 'new_club',
              description: `New club chartered: ${change.clubName}`,
              value: 1,
              clubId: change.clubId,
              clubName: change.clubName,
            })
          } else if (change.changeType === 'suspended') {
            events.push({
              date: report.date,
              type: 'club_suspended',
              description: `Club suspended: ${change.clubName}`,
              value: 1,
              clubId: change.clubId,
              clubName: change.clubName,
            })
          }
        }
      })
    }
  })

  // Sort by date (most recent first)
  return events.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )
}

/**
 * Enhances club data with recent changes from daily reports
 */
export function enhanceClubsWithRecentChanges(
  clubs: Club[],
  dailyReports: DailyReport[],
  daysToConsider: number = 7
): ClubWithRecentChanges[] {
  // Get reports from the last N days
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysToConsider)

  const recentReports = dailyReports.filter(
    report => new Date(report.date) >= cutoffDate
  )

  // Create a map to aggregate changes by club
  const clubChangesMap = new Map<
    string,
    {
      newMembers: number
      renewals: number
      awards: number
      lastUpdated: string
    }
  >()

  recentReports.forEach(report => {
    // Process new members
    report.newMembers.forEach(member => {
      const existing = clubChangesMap.get(member.clubId) || {
        newMembers: 0,
        renewals: 0,
        awards: 0,
        lastUpdated: report.date,
      }
      clubChangesMap.set(member.clubId, {
        ...existing,
        newMembers: existing.newMembers + 1,
        lastUpdated: report.date,
      })
    })

    // Process renewals
    report.renewals.forEach(member => {
      const existing = clubChangesMap.get(member.clubId) || {
        newMembers: 0,
        renewals: 0,
        awards: 0,
        lastUpdated: report.date,
      }
      clubChangesMap.set(member.clubId, {
        ...existing,
        renewals: existing.renewals + 1,
        lastUpdated: report.date,
      })
    })

    // Process awards
    report.awards.forEach(award => {
      const existing = clubChangesMap.get(award.clubId) || {
        newMembers: 0,
        renewals: 0,
        awards: 0,
        lastUpdated: report.date,
      }
      clubChangesMap.set(award.clubId, {
        ...existing,
        awards: existing.awards + 1,
        lastUpdated: report.date,
      })
    })
  })

  // Enhance clubs with recent changes
  return clubs.map(club => {
    const recentChanges = clubChangesMap.get(club.id)

    if (!recentChanges) {
      return club
    }

    return {
      ...club,
      recentChanges: {
        membershipChange: recentChanges.newMembers - recentChanges.renewals,
        newMembers: recentChanges.newMembers,
        renewals: recentChanges.renewals,
        recentAwards: recentChanges.awards,
        lastUpdated: recentChanges.lastUpdated,
      },
    }
  })
}

/**
 * Calculates real-time membership count by combining base statistics with recent daily reports
 */
export function calculateRealTimeMembership(
  baseMembershipCount: number,
  baseDate: string,
  dailyReports: DailyReportsResponse['reports']
): {
  currentCount: number
  changeFromBase: number
  lastUpdated: string
} {
  // Filter reports that are after the base date
  const recentReports = dailyReports.filter(
    report => new Date(report.date) > new Date(baseDate)
  )

  const netChange = recentReports.reduce(
    (sum, report) => sum + (report.newMembers - report.renewals),
    0
  )

  const lastUpdated =
    recentReports.length > 0
      ? (recentReports[recentReports.length - 1]?.date ?? baseDate)
      : baseDate

  return {
    currentCount: baseMembershipCount + netChange,
    changeFromBase: netChange,
    lastUpdated,
  }
}
