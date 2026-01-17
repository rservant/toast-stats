/**
 * Data Extraction Module for Division and Area Performance
 *
 * This module provides functions to extract division and area performance data
 * from district snapshot JSON structures. It transforms raw snapshot data into
 * typed performance structures suitable for rendering in the UI.
 *
 * Requirements: 1.4, 7.1, 7.2
 */

import type {
  DivisionPerformance,
  AreaPerformance,
  VisitStatus,
} from './divisionStatus.js'
import {
  calculateRequiredDistinguishedClubs,
  calculateNetGrowth,
  calculateVisitStatus,
  calculateDivisionStatus,
  calculateAreaStatus,
  checkAreaQualifying,
} from './divisionStatus.js'

/**
 * Extracts area visit data from snapshot JSON
 *
 * Retrieves first round visits from "Nov Visit award" field and second round
 * visits from "May visit award" field. Handles missing visit data gracefully
 * by treating missing values as zero completed visits.
 *
 * @param areaData - Raw area data from district snapshot (unknown type for safety)
 * @param clubBase - Number of clubs at the start of the program year
 * @returns Object containing first round and second round visit status
 *
 * @example
 * const areaData = { "Nov Visit award": "3", "May visit award": "4" }
 * const result = extractVisitData(areaData, 4)
 * // Returns: {
 * //   firstRound: { completed: 3, required: 3, percentage: 75, meetsThreshold: true },
 * //   secondRound: { completed: 4, required: 3, percentage: 100, meetsThreshold: true }
 * // }
 *
 * Requirements: 7.1, 7.2, 7.5
 */
export function extractVisitData(
  areaData: unknown,
  clubBase: number
): { firstRound: VisitStatus; secondRound: VisitStatus } {
  // Type guard: ensure areaData is an object
  if (typeof areaData !== 'object' || areaData === null) {
    // Missing area data - return zero visits for both rounds
    return {
      firstRound: calculateVisitStatus(0, clubBase),
      secondRound: calculateVisitStatus(0, clubBase),
    }
  }

  // Cast to record type for property access
  const data = areaData as Record<string, unknown>

  // Extract first round visits from "Nov Visit award"
  const novVisitRaw = data['Nov Visit award']
  const firstRoundCompleted =
    typeof novVisitRaw === 'string' || typeof novVisitRaw === 'number'
      ? Number(novVisitRaw)
      : 0

  // Extract second round visits from "May visit award"
  const mayVisitRaw = data['May visit award']
  const secondRoundCompleted =
    typeof mayVisitRaw === 'string' || typeof mayVisitRaw === 'number'
      ? Number(mayVisitRaw)
      : 0

  // Calculate visit status for both rounds
  const firstRound = calculateVisitStatus(
    isNaN(firstRoundCompleted) ? 0 : firstRoundCompleted,
    clubBase
  )
  const secondRound = calculateVisitStatus(
    isNaN(secondRoundCompleted) ? 0 : secondRoundCompleted,
    clubBase
  )

  return { firstRound, secondRound }
}

/**
 * Extracts division and area performance data from district snapshot
 *
 * Processes the district snapshot JSON to extract all divisions and their
 * constituent areas, calculating performance metrics and status classifications
 * for each. Divisions and areas are sorted by their identifiers.
 *
 * @param districtSnapshot - Raw district snapshot data (unknown type for safety)
 * @returns Array of DivisionPerformance objects, sorted by division identifier
 *
 * @example
 * const snapshot = {
 *   divisionPerformance: [
 *     { Division: "A", "Club Base": "10", "Paid Clubs": "12", "Distinguished Clubs": "6" }
 *   ]
 * }
 * const divisions = extractDivisionPerformance(snapshot)
 * // Returns array of DivisionPerformance objects with calculated metrics
 *
 * Requirements: 1.1, 1.3, 1.4, 6.8
 */
export function extractDivisionPerformance(
  districtSnapshot: unknown
): DivisionPerformance[] {
  // Type guard: ensure districtSnapshot is an object
  if (typeof districtSnapshot !== 'object' || districtSnapshot === null) {
    return []
  }

  const snapshot = districtSnapshot as Record<string, unknown>

  // The divisionPerformance array contains club-level data organized by division/area
  // The clubPerformance array contains club status and distinguished status
  // We need to merge these two data sources
  const clubDataRaw = snapshot['divisionPerformance']
  const clubPerformanceRaw = snapshot['clubPerformance']

  if (!Array.isArray(clubDataRaw)) {
    return []
  }

  // Create a map of club performance data by club identifier for quick lookup
  const clubPerformanceMap = new Map<string, Record<string, unknown>>()
  if (Array.isArray(clubPerformanceRaw)) {
    for (const clubPerfRaw of clubPerformanceRaw) {
      if (typeof clubPerfRaw !== 'object' || clubPerfRaw === null) {
        continue
      }
      const clubPerf = clubPerfRaw as Record<string, unknown>
      // Use Club Number as the key (or Club Name if Number not available)
      const clubKey =
        (typeof clubPerf['Club Number'] === 'string' ||
        typeof clubPerf['Club Number'] === 'number'
          ? String(clubPerf['Club Number'])
          : '') ||
        (typeof clubPerf['Club Name'] === 'string' ? clubPerf['Club Name'] : '')

      if (clubKey) {
        clubPerformanceMap.set(clubKey, clubPerf)
      }
    }
  }

  // Group clubs by division to aggregate metrics
  const divisionMap = new Map<string, unknown[]>()

  for (const clubRaw of clubDataRaw) {
    if (typeof clubRaw !== 'object' || clubRaw === null) {
      continue
    }

    const clubData = clubRaw as Record<string, unknown>
    const divisionId =
      typeof clubData['Division'] === 'string' ? clubData['Division'] : ''

    if (!divisionId) {
      continue
    }

    if (!divisionMap.has(divisionId)) {
      divisionMap.set(divisionId, [])
    }
    divisionMap.get(divisionId)!.push(clubData)
  }

  // Process each division
  const divisions: DivisionPerformance[] = []

  for (const [divisionId, clubs] of divisionMap.entries()) {
    // Aggregate division metrics from club data
    let clubBase = 0
    let paidClubs = 0
    let distinguishedClubs = 0

    for (const clubRaw of clubs) {
      const clubData = clubRaw as Record<string, unknown>

      // Club Base: count all clubs (this represents the starting number)
      clubBase++

      // Get the club identifier to look up performance data
      const clubKey =
        (typeof clubData['Club'] === 'string' ||
        typeof clubData['Club'] === 'number'
          ? String(clubData['Club'])
          : '') ||
        (typeof clubData['Club Name'] === 'string' ? clubData['Club Name'] : '')

      // Look up club performance data
      const clubPerf = clubKey ? clubPerformanceMap.get(clubKey) : undefined

      if (clubPerf) {
        // Paid Clubs: count clubs with "Active" status
        const status =
          typeof clubPerf['Club Status'] === 'string'
            ? clubPerf['Club Status']
            : ''
        if (status === 'Active') {
          paidClubs++
        }

        // Distinguished Clubs: count clubs with distinguished status
        const distinguishedStatus =
          typeof clubPerf['Club Distinguished Status'] === 'string'
            ? clubPerf['Club Distinguished Status']
            : ''
        if (
          distinguishedStatus === 'Distinguished' ||
          distinguishedStatus === 'Select Distinguished' ||
          distinguishedStatus === 'Presidents Distinguished' ||
          distinguishedStatus === 'Smedley Distinguished'
        ) {
          distinguishedClubs++
        }
      }
    }

    // Calculate derived metrics
    const netGrowth = calculateNetGrowth(paidClubs, clubBase)
    const requiredDistinguishedClubs =
      calculateRequiredDistinguishedClubs(clubBase)

    // Calculate division status
    const status = calculateDivisionStatus(
      distinguishedClubs,
      requiredDistinguishedClubs,
      paidClubs,
      clubBase,
      netGrowth
    )

    // Extract areas for this division
    const areas = extractAreasForDivision(
      divisionId,
      clubDataRaw,
      clubPerformanceMap
    )

    // Add division to results
    divisions.push({
      divisionId,
      status,
      clubBase,
      paidClubs,
      netGrowth,
      distinguishedClubs,
      requiredDistinguishedClubs,
      areas,
    })
  }

  // Sort divisions by identifier
  divisions.sort((a, b) => a.divisionId.localeCompare(b.divisionId))

  return divisions
}

/**
 * Extracts areas for a specific division from club performance data
 *
 * @param divisionId - Division identifier to filter areas
 * @param clubData - Array of club-level records
 * @param clubPerformanceMap - Map of club performance data by club identifier
 * @returns Array of AreaPerformance objects, sorted by area identifier
 */
function extractAreasForDivision(
  divisionId: string,
  clubData: unknown[],
  clubPerformanceMap: Map<string, Record<string, unknown>>
): AreaPerformance[] {
  // Group clubs by area
  const areaMap = new Map<string, unknown[]>()

  for (const clubRaw of clubData) {
    if (typeof clubRaw !== 'object' || clubRaw === null) {
      continue
    }

    const club = clubRaw as Record<string, unknown>

    // Check if club belongs to this division
    const clubDivision =
      typeof club['Division'] === 'string' ? club['Division'] : ''
    if (clubDivision !== divisionId) {
      continue
    }

    // Extract area identifier
    const areaId = typeof club['Area'] === 'string' ? club['Area'] : ''
    if (!areaId) {
      continue
    }

    // Add club to area group
    if (!areaMap.has(areaId)) {
      areaMap.set(areaId, [])
    }
    areaMap.get(areaId)!.push(club)
  }

  // Process each area
  const areas: AreaPerformance[] = []

  for (const [areaId, clubs] of areaMap.entries()) {
    // Calculate area metrics from clubs
    const clubBase = clubs.length
    let paidClubs = 0
    let distinguishedClubs = 0

    // Get visit data from first club (area-level data is same across all clubs in area)
    const firstClub = clubs[0] as Record<string, unknown>
    const { firstRound, secondRound } = extractVisitData(firstClub, clubBase)

    for (const clubRaw of clubs) {
      const club = clubRaw as Record<string, unknown>

      // Get the club identifier to look up performance data
      const clubKey =
        (typeof club['Club'] === 'string' || typeof club['Club'] === 'number'
          ? String(club['Club'])
          : '') ||
        (typeof club['Club Name'] === 'string' ? club['Club Name'] : '')

      // Look up club performance data
      const clubPerf = clubKey ? clubPerformanceMap.get(clubKey) : undefined

      if (clubPerf) {
        // Count paid clubs (clubs with "Active" status)
        const status =
          typeof clubPerf['Club Status'] === 'string'
            ? clubPerf['Club Status']
            : ''
        if (status === 'Active') {
          paidClubs++
        }

        // Count distinguished clubs
        const distinguishedStatus =
          typeof clubPerf['Club Distinguished Status'] === 'string'
            ? clubPerf['Club Distinguished Status']
            : ''
        if (
          distinguishedStatus === 'Distinguished' ||
          distinguishedStatus === 'Select Distinguished' ||
          distinguishedStatus === 'Presidents Distinguished' ||
          distinguishedStatus === 'Smedley Distinguished'
        ) {
          distinguishedClubs++
        }
      }
    }

    // Calculate derived metrics
    const netGrowth = calculateNetGrowth(paidClubs, clubBase)
    const requiredDistinguishedClubs =
      calculateRequiredDistinguishedClubs(clubBase)

    // Check if area is qualified
    const isQualified = checkAreaQualifying(netGrowth, firstRound, secondRound)

    // Calculate area status
    const status = calculateAreaStatus(
      isQualified,
      distinguishedClubs,
      requiredDistinguishedClubs,
      paidClubs,
      clubBase,
      netGrowth
    )

    // Add area to results
    areas.push({
      areaId,
      status,
      clubBase,
      paidClubs,
      netGrowth,
      distinguishedClubs,
      requiredDistinguishedClubs,
      firstRoundVisits: firstRound,
      secondRoundVisits: secondRound,
      isQualified,
    })
  }

  // Sort areas by identifier
  areas.sort((a, b) => a.areaId.localeCompare(b.areaId))

  return areas
}
