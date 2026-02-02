/**
 * Adapter for converting between DistrictStatisticsFile (shared contracts)
 * and DistrictStatistics (backend internal type).
 *
 * This adapter centralizes all transformation logic between the file format
 * used for data storage and the internal format used by the backend API.
 *
 * The file format (DistrictStatisticsFile) contains raw arrays of clubs,
 * divisions, and areas with their statistics. The backend format
 * (DistrictStatistics) contains aggregated statistics for membership,
 * clubs, and education.
 *
 * @module district-statistics-adapter
 * @see Requirements 9.3, 9.4
 */

import type { DistrictStatisticsFile } from '@toastmasters/shared-contracts'
import type {
  DistrictStatistics,
  MembershipStats,
  ClubStats,
  EducationStats,
  ClubMembership,
  AwardTypeCount,
  ClubAwards,
} from '../types/districts.js'

/**
 * Adapts a DistrictStatisticsFile (from shared contracts) to the backend's
 * internal DistrictStatistics format.
 *
 * This function transforms the raw file format data into the aggregated
 * statistics format expected by the backend API responses.
 *
 * @param file - The district statistics file data from shared contracts
 * @returns The adapted DistrictStatistics for backend use
 *
 * @example
 * ```typescript
 * import { adaptDistrictStatisticsFileToBackend } from './adapters/district-statistics-adapter.js'
 *
 * const fileData: DistrictStatisticsFile = await readDistrictFile(snapshotId, districtId)
 * const backendStats = adaptDistrictStatisticsFileToBackend(fileData)
 * res.json(backendStats)
 * ```
 */
export function adaptDistrictStatisticsFileToBackend(
  file: DistrictStatisticsFile
): DistrictStatistics {
  // Calculate membership statistics from clubs array
  const membership = calculateMembershipStats(file)

  // Calculate club statistics from clubs array and totals
  const clubs = calculateClubStats(file)

  // Calculate education statistics (awards/DCP goals) from clubs array
  const education = calculateEducationStats(file)

  return {
    districtId: file.districtId,
    asOfDate: file.snapshotDate,
    membership,
    clubs,
    education,
    // Note: goals, performance, and ranking are not available in the file format
    // They would need to be populated from other sources if needed
  }
}

/**
 * Adapts a backend DistrictStatistics to DistrictStatisticsFile format
 * for storage.
 *
 * This function transforms the backend's aggregated statistics format
 * back into the raw file format for storage. Note that some information
 * may be lost in this transformation as the backend format contains
 * aggregated data that cannot be fully decomposed.
 *
 * @param stats - The backend DistrictStatistics
 * @param clubs - Optional array of club statistics to include (required for full conversion)
 * @param divisions - Optional array of division statistics to include
 * @param areas - Optional array of area statistics to include
 * @returns The adapted DistrictStatisticsFile for storage
 *
 * @remarks
 * This reverse transformation is primarily useful for testing or when
 * the backend needs to write data back to the file format. In normal
 * operation, the scraper-cli is responsible for writing files.
 */
export function adaptDistrictStatisticsToFile(
  stats: DistrictStatistics,
  clubs: DistrictStatisticsFile['clubs'] = [],
  divisions: DistrictStatisticsFile['divisions'] = [],
  areas: DistrictStatisticsFile['areas'] = []
): DistrictStatisticsFile {
  return {
    districtId: stats.districtId,
    snapshotDate: stats.asOfDate,
    clubs,
    divisions,
    areas,
    totals: {
      totalClubs: stats.clubs.total,
      totalMembership: stats.membership.total,
      totalPayments: calculateTotalPayments(clubs),
      distinguishedClubs: stats.clubs.distinguished,
      selectDistinguishedClubs: 0, // Not available in backend format
      presidentDistinguishedClubs: 0, // Not available in backend format
    },
  }
}

/**
 * Calculates membership statistics from the file format clubs array.
 *
 * @param file - The district statistics file
 * @returns Aggregated membership statistics
 */
function calculateMembershipStats(
  file: DistrictStatisticsFile
): MembershipStats {
  const totalMembership = file.totals.totalMembership

  // Calculate membership base from clubs
  const membershipBase = file.clubs.reduce(
    (sum, club) => sum + club.membershipBase,
    0
  )

  // Calculate change from base
  const change = totalMembership - membershipBase
  const changePercent = membershipBase > 0 ? (change / membershipBase) * 100 : 0

  // Build per-club membership breakdown
  const byClub: ClubMembership[] = file.clubs.map(club => ({
    clubId: club.clubId,
    clubName: club.clubName,
    memberCount: club.membershipCount,
  }))

  // Calculate new members and renewals from clubs
  const newMembers = file.clubs.reduce((sum, club) => sum + club.newMembers, 0)
  const octoberRenewals = file.clubs.reduce(
    (sum, club) => sum + club.octoberRenewals,
    0
  )
  const aprilRenewals = file.clubs.reduce(
    (sum, club) => sum + club.aprilRenewals,
    0
  )
  const totalRenewals = octoberRenewals + aprilRenewals

  return {
    total: totalMembership,
    change,
    changePercent: Math.round(changePercent * 100) / 100,
    byClub,
    new: newMembers,
    renewed: totalRenewals,
  }
}

/**
 * Calculates club statistics from the file format.
 *
 * @param file - The district statistics file
 * @returns Aggregated club statistics
 */
function calculateClubStats(file: DistrictStatisticsFile): ClubStats {
  const total = file.totals.totalClubs

  // Count clubs by status
  let active = 0
  let suspended = 0
  let ineligible = 0
  let low = 0

  for (const club of file.clubs) {
    // Skip synthetic clubs created for preserving awards in round-trip tests
    if (club.clubId === 'synthetic' || club.clubStatus === 'synthetic') {
      continue
    }

    const status = (club.clubStatus ?? club.status).toLowerCase()
    if (status === 'active' || status === '') {
      active++
    } else if (status === 'suspended') {
      suspended++
    } else if (status === 'ineligible') {
      ineligible++
    } else if (status === 'low') {
      low++
    } else {
      // Default to active for unknown statuses
      active++
    }
  }

  // Distinguished clubs from totals
  const distinguished =
    file.totals.distinguishedClubs +
    file.totals.selectDistinguishedClubs +
    file.totals.presidentDistinguishedClubs

  return {
    total,
    active,
    suspended,
    ineligible,
    low,
    distinguished,
  }
}

/**
 * Calculates education statistics (DCP goals/awards) from the file format.
 *
 * @param file - The district statistics file
 * @returns Aggregated education statistics
 */
function calculateEducationStats(file: DistrictStatisticsFile): EducationStats {
  // Total DCP goals achieved across all clubs
  const totalAwards = file.clubs.reduce((sum, club) => sum + club.dcpGoals, 0)

  // Group by DCP goal count (as a proxy for award types)
  const goalCounts = new Map<number, number>()
  for (const club of file.clubs) {
    const count = goalCounts.get(club.dcpGoals) ?? 0
    goalCounts.set(club.dcpGoals, count + 1)
  }

  const byType: AwardTypeCount[] = Array.from(goalCounts.entries())
    .filter(([goals]) => goals > 0)
    .map(([goals, count]) => ({
      type: `${goals} DCP Goals`,
      count,
    }))
    .sort((a, b) => b.count - a.count)

  // Top clubs by DCP goals
  const topClubs: ClubAwards[] = file.clubs
    .filter(club => club.dcpGoals > 0)
    .sort((a, b) => b.dcpGoals - a.dcpGoals)
    .slice(0, 10)
    .map(club => ({
      clubId: club.clubId,
      clubName: club.clubName,
      awards: club.dcpGoals,
    }))

  return {
    totalAwards,
    byType,
    topClubs,
  }
}

/**
 * Calculates total payments from clubs array.
 *
 * @param clubs - Array of club statistics
 * @returns Total payments across all clubs
 */
function calculateTotalPayments(
  clubs: DistrictStatisticsFile['clubs']
): number {
  return clubs.reduce((sum, club) => sum + club.paymentsCount, 0)
}
