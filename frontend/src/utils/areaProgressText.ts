/**
 * Area Progress Text Generation Module
 *
 * This module provides functions for generating concise English paragraphs
 * describing an area's progress toward Distinguished Area recognition.
 *
 * The generated text includes:
 * - Current recognition level achieved (or that it's not yet distinguished)
 * - Current metrics (paid clubs, distinguished clubs)
 * - What's needed to reach the next achievable level
 * - Incremental differences for higher levels (building on previous requirements)
 * - Club visit status when available
 *
 * Requirements: 5.1, 5.2, 5.3, 5.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7
 */

import { AreaWithDivision } from '../components/DivisionAreaProgressSummary'
import { GapAnalysis, RecognitionLevel } from './areaGapAnalysis'

/**
 * Result of generating progress text for an area
 */
export interface AreaProgressText {
  /** Area identifier with division context (e.g., "Area A1 (Division A)") */
  areaLabel: string
  /** Current recognition level achieved */
  currentLevel: RecognitionLevel
  /** Concise paragraph describing progress and gaps */
  progressText: string
}

/**
 * Club visit information for an area
 *
 * When visit data is available, contains completion counts.
 * When unavailable, the entire object should be undefined.
 */
export interface ClubVisitInfo {
  /** Number of first-round visits completed */
  firstRoundCompleted: number
  /** Number of second-round visits completed */
  secondRoundCompleted: number
  /** Total clubs in the area (club base) */
  totalClubs: number
}

/**
 * Get human-readable label for recognition level
 *
 * @param level - Recognition level
 * @returns Human-readable label
 */
function getRecognitionLevelLabel(level: RecognitionLevel): string {
  switch (level) {
    case 'presidents':
      return "President's Distinguished"
    case 'select':
      return 'Select Distinguished'
    case 'distinguished':
      return 'Distinguished'
    default:
      return 'not yet distinguished'
  }
}

/**
 * Generate the area label with division context
 *
 * @param area - Area with division information
 * @returns Formatted area label (e.g., "Area A1 (Division A)")
 */
function generateAreaLabel(area: AreaWithDivision): string {
  return `Area ${area.areaId} (Division ${area.divisionId})`
}

/**
 * Generate the current metrics description
 *
 * @param area - Area performance data
 * @returns Metrics string (e.g., "4 of 4 clubs paid, 2 of 4 distinguished")
 */
function generateMetricsDescription(area: AreaWithDivision): string {
  return `${area.paidClubs} of ${area.clubBase} clubs paid, ${area.distinguishedClubs} of ${area.clubBase} distinguished`
}

/**
 * Generate club visit status text in terms of qualification requirements
 *
 * Club visits require 75% of club base for each round to qualify for distinguished status.
 * This function communicates progress toward that threshold.
 *
 * Requirements: 6.7, 6.8, 6.9
 *
 * @param visitInfo - Club visit information (undefined if unavailable)
 * @returns Club visit status text describing qualification progress
 */
function generateClubVisitText(visitInfo: ClubVisitInfo | undefined): string {
  // Requirement 6.9: When visit data unavailable, show "status unknown"
  if (visitInfo === undefined) {
    return 'Club visits: status unknown.'
  }

  const { firstRoundCompleted, secondRoundCompleted, totalClubs } = visitInfo

  // Handle edge case of zero clubs
  if (totalClubs === 0) {
    return 'Club visits: no clubs in area.'
  }

  // Calculate 75% threshold (required for qualification)
  const requiredVisits = Math.ceil(totalClubs * 0.75)

  // Check if thresholds are met
  const firstRoundMet = firstRoundCompleted >= requiredVisits
  const secondRoundMet = secondRoundCompleted >= requiredVisits

  // Both rounds meet threshold
  if (firstRoundMet && secondRoundMet) {
    return 'Club visits: both rounds meet 75% threshold.'
  }

  // Build status text describing progress toward 75% threshold
  const parts: string[] = []

  // First round status
  if (firstRoundMet) {
    parts.push('first-round meets 75% threshold')
  } else {
    const firstRoundNeeded = requiredVisits - firstRoundCompleted
    if (firstRoundCompleted === 0) {
      parts.push(`first-round needs ${requiredVisits} visits for 75%`)
    } else {
      parts.push(
        `first-round ${firstRoundCompleted}/${requiredVisits} (need ${firstRoundNeeded} more for 75%)`
      )
    }
  }

  // Second round status
  if (secondRoundMet) {
    parts.push('second-round meets 75% threshold')
  } else {
    const secondRoundNeeded = requiredVisits - secondRoundCompleted
    if (secondRoundCompleted === 0) {
      parts.push(`second-round needs ${requiredVisits} visits for 75%`)
    } else {
      parts.push(
        `second-round ${secondRoundCompleted}/${requiredVisits} (need ${secondRoundNeeded} more for 75%)`
      )
    }
  }

  return `Club visits: ${parts.join(', ')}.`
}

/**
 * Generate text describing what's needed for Distinguished level
 *
 * @param gapAnalysis - Gap analysis for the area
 * @returns Text describing gap to Distinguished, or empty string if achieved
 */
function generateDistinguishedGapText(gapAnalysis: GapAnalysis): string {
  if (gapAnalysis.distinguishedGap.achieved) {
    return ''
  }

  const clubsNeeded = gapAnalysis.distinguishedGap.distinguishedClubsNeeded
  const clubWord = clubsNeeded === 1 ? 'club needs' : 'clubs need'

  return `For Distinguished, ${clubsNeeded} ${clubWord} to become distinguished.`
}

/**
 * Generate text describing what's needed for Select Distinguished level
 * (incremental from Distinguished)
 *
 * @param gapAnalysis - Gap analysis for the area
 * @returns Text describing incremental gap to Select, or empty string if achieved
 */
function generateSelectGapText(gapAnalysis: GapAnalysis): string {
  if (gapAnalysis.selectGap.achieved) {
    return ''
  }

  // Calculate incremental clubs needed beyond Distinguished
  const distinguishedClubsForDistinguished =
    gapAnalysis.distinguishedGap.distinguishedClubsNeeded
  const distinguishedClubsForSelect =
    gapAnalysis.selectGap.distinguishedClubsNeeded

  // If Distinguished is already achieved, show full gap to Select
  if (gapAnalysis.distinguishedGap.achieved) {
    const clubWord =
      distinguishedClubsForSelect === 1 ? 'club needs' : 'clubs need'
    return `For Select Distinguished, ${distinguishedClubsForSelect} more ${clubWord} to become distinguished.`
  }

  // Otherwise, show incremental difference
  const incrementalClubs =
    distinguishedClubsForSelect - distinguishedClubsForDistinguished

  if (incrementalClubs <= 0) {
    // Select requires same distinguished clubs as Distinguished (just different threshold calculation)
    // This shouldn't happen with correct DAP rules, but handle gracefully
    return 'For Select Distinguished, 1 additional club.'
  }

  const clubWord = incrementalClubs === 1 ? 'club' : 'clubs'
  return `For Select Distinguished, ${incrementalClubs} additional ${clubWord}.`
}

/**
 * Generate text describing what's needed for President's Distinguished level
 * (incremental from Select)
 *
 * @param gapAnalysis - Gap analysis for the area
 * @returns Text describing incremental gap to President's, or empty string if achieved
 */
function generatePresidentsGapText(gapAnalysis: GapAnalysis): string {
  if (gapAnalysis.presidentsGap.achieved) {
    return ''
  }

  const parts: string[] = []

  // Check if additional paid clubs are needed (beyond Select)
  const paidClubsNeeded = gapAnalysis.presidentsGap.paidClubsNeeded

  // Check if additional distinguished clubs are needed (beyond Select)
  const selectDistinguishedNeeded =
    gapAnalysis.selectGap.distinguishedClubsNeeded
  const presidentsDistinguishedNeeded =
    gapAnalysis.presidentsGap.distinguishedClubsNeeded
  const incrementalDistinguished =
    presidentsDistinguishedNeeded - selectDistinguishedNeeded

  // If Select is achieved, we only need to mention paid clubs
  if (gapAnalysis.selectGap.achieved) {
    if (paidClubsNeeded > 0) {
      const clubWord = paidClubsNeeded === 1 ? 'paid club' : 'paid clubs'
      parts.push(`add ${paidClubsNeeded} ${clubWord}`)
    }
  } else {
    // Build incremental description
    if (paidClubsNeeded > 0) {
      const clubWord = paidClubsNeeded === 1 ? 'paid club' : 'paid clubs'
      parts.push(`add ${paidClubsNeeded} ${clubWord}`)
    }

    // Only mention distinguished clubs if there's an increment beyond Select
    if (incrementalDistinguished > 0) {
      const clubWord =
        incrementalDistinguished === 1
          ? 'distinguished club'
          : 'distinguished clubs'
      parts.push(`${incrementalDistinguished} more ${clubWord}`)
    }
  }

  if (parts.length === 0) {
    return ''
  }

  // Use "also" to indicate this builds on previous requirements
  const prefix =
    gapAnalysis.distinguishedGap.achieved || gapAnalysis.selectGap.achieved
      ? "For President's Distinguished, "
      : "For President's Distinguished, also "

  return `${prefix}${parts.join(' and ')}.`
}

/**
 * Generate text for an area with net club loss
 *
 * Requirements: 6.1, 6.6
 *
 * @param area - Area performance data
 * @param gapAnalysis - Gap analysis for the area
 * @returns Text describing eligibility requirement and subsequent gaps
 */
function generateNetLossText(
  area: AreaWithDivision,
  gapAnalysis: GapAnalysis
): string {
  const paidClubsNeeded = gapAnalysis.paidClubsNeeded
  const clubWord = paidClubsNeeded === 1 ? 'paid club' : 'paid clubs'

  const parts: string[] = []

  // First explain the eligibility requirement
  parts.push(`To become eligible, add ${paidClubsNeeded} ${clubWord}.`)

  // Then describe what's needed for each level after eligibility
  // Calculate what would be needed once eligibility is met
  const clubBase = area.clubBase
  const distinguishedClubs = area.distinguishedClubs

  // Distinguished requires 50% of club base
  const distinguishedThreshold = Math.ceil(clubBase * 0.5)
  const distinguishedNeeded = Math.max(
    0,
    distinguishedThreshold - distinguishedClubs
  )

  if (distinguishedNeeded > 0) {
    const dClubWord = distinguishedNeeded === 1 ? 'club needs' : 'clubs need'
    parts.push(
      `Then for Distinguished, ${distinguishedNeeded} ${dClubWord} to become distinguished.`
    )
  } else {
    parts.push('Then Distinguished requirements would be met.')
  }

  return parts.join(' ')
}

/**
 * Generate text for an area that has achieved a recognition level
 *
 * Requirements: 6.5, 6.6
 *
 * @param area - Area performance data
 * @param gapAnalysis - Gap analysis for the area
 * @param visitInfo - Club visit information (undefined if unavailable)
 * @returns Text describing achievement and any remaining gaps
 */
function generateAchievedText(
  area: AreaWithDivision,
  gapAnalysis: GapAnalysis,
  visitInfo: ClubVisitInfo | undefined
): string {
  const levelLabel = getRecognitionLevelLabel(gapAnalysis.currentLevel)
  const metrics = generateMetricsDescription(area)

  // President's Distinguished - no further gaps to mention
  if (gapAnalysis.currentLevel === 'presidents') {
    const visitText = generateClubVisitText(visitInfo)
    // Check if both visit rounds meet 75% threshold for special message
    if (visitInfo) {
      const requiredVisits = Math.ceil(visitInfo.totalClubs * 0.75)
      const bothRoundsMet =
        visitInfo.firstRoundCompleted >= requiredVisits &&
        visitInfo.secondRoundCompleted >= requiredVisits
      if (bothRoundsMet) {
        return `has achieved ${levelLabel} status with club visits meeting 75% threshold.`
      }
    }
    return `has achieved ${levelLabel} status. ${visitText}`
  }

  // Select Distinguished - mention gap to President's
  if (gapAnalysis.currentLevel === 'select') {
    const presidentsGap = generatePresidentsGapText(gapAnalysis)
    const visitText = generateClubVisitText(visitInfo)
    return `has achieved ${levelLabel} status (${metrics}). ${presidentsGap} ${visitText}`
  }

  // Distinguished - mention gaps to Select and President's
  if (gapAnalysis.currentLevel === 'distinguished') {
    const selectGap = generateSelectGapText(gapAnalysis)
    const presidentsGap = generatePresidentsGapText(gapAnalysis)
    const visitText = generateClubVisitText(visitInfo)
    return `has achieved ${levelLabel} status (${metrics}). ${selectGap} ${presidentsGap} ${visitText}`
  }

  // Should not reach here, but handle gracefully
  return `has achieved ${levelLabel} status.`
}

/**
 * Generate text for an area that is not yet distinguished
 *
 * Requirements: 5.2, 5.3, 6.2, 6.3, 6.4
 *
 * @param area - Area performance data
 * @param gapAnalysis - Gap analysis for the area
 * @param visitInfo - Club visit information (undefined if unavailable)
 * @returns Text describing current status and all gaps
 */
function generateNotDistinguishedText(
  area: AreaWithDivision,
  gapAnalysis: GapAnalysis,
  visitInfo: ClubVisitInfo | undefined
): string {
  const metrics = generateMetricsDescription(area)

  const distinguishedGap = generateDistinguishedGapText(gapAnalysis)
  const selectGap = generateSelectGapText(gapAnalysis)
  const presidentsGap = generatePresidentsGapText(gapAnalysis)
  const visitText = generateClubVisitText(visitInfo)

  return `is not yet distinguished (${metrics}). ${distinguishedGap} ${selectGap} ${presidentsGap} ${visitText}`
}

/**
 * Generates a concise English paragraph describing an area's progress
 * toward Distinguished Area recognition.
 *
 * The generated text includes:
 * - Current status and recognition level achieved
 * - Current metrics (paid clubs, distinguished clubs)
 * - Eligibility requirements (no net club loss) if not met
 * - What's needed for the next level (building incrementally)
 * - Additional requirements for higher levels (only the differences)
 * - Club visit status when available
 *
 * Examples:
 * - "Area A1 (Division A) has achieved President's Distinguished status with all club visits complete."
 * - "Area A2 (Division A) has achieved Distinguished status (4 of 4 clubs paid, 2 of 4 distinguished).
 *    For Select Distinguished, 1 more club needs to become distinguished.
 *    For President's Distinguished, also add 1 paid club.
 *    Club visits: 4 of 4 first-round complete, 2 of 4 second-round complete."
 * - "Area B1 (Division B) has a net club loss (3 of 4 clubs paid). To become eligible,
 *    add 1 paid club. Then for Distinguished, 2 clubs need to become distinguished.
 *    Club visits: first-round 75% complete (3 of 4), second-round not started."
 * - "Area C1 (Division C) is not yet distinguished (4 of 4 clubs paid, 1 of 4 distinguished).
 *    For Distinguished, 1 more club needs to become distinguished.
 *    For Select Distinguished, 1 additional club. For President's Distinguished, also add 1 paid club.
 *    Club visits: status unknown."
 *
 * Requirements: 5.1, 5.2, 5.3, 5.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7
 *
 * @param area - Area with division information
 * @param gapAnalysis - Gap analysis for the area
 * @param visitInfo - Club visit information (undefined if unavailable)
 * @returns AreaProgressText with label, level, and progress paragraph
 */
export function generateAreaProgressText(
  area: AreaWithDivision,
  gapAnalysis: GapAnalysis,
  visitInfo?: ClubVisitInfo
): AreaProgressText {
  const areaLabel = generateAreaLabel(area)
  const currentLevel = gapAnalysis.currentLevel

  let progressText: string

  // Handle net club loss scenario first (Requirement 6.1)
  if (!gapAnalysis.meetsNoNetLossRequirement) {
    const metrics = generateMetricsDescription(area)
    const netLossText = generateNetLossText(area, gapAnalysis)
    const visitText = generateClubVisitText(visitInfo)
    progressText = `${areaLabel} has a net club loss (${metrics}). ${netLossText} ${visitText}`
  }
  // Handle achieved recognition levels (Requirement 6.5)
  else if (gapAnalysis.currentLevel !== 'none') {
    progressText = `${areaLabel} ${generateAchievedText(area, gapAnalysis, visitInfo)}`
  }
  // Handle not yet distinguished (Requirements 5.2, 5.3, 6.2, 6.3, 6.4)
  else {
    progressText = `${areaLabel} ${generateNotDistinguishedText(area, gapAnalysis, visitInfo)}`
  }

  // Clean up any double spaces
  progressText = progressText.replace(/\s+/g, ' ').trim()

  return {
    areaLabel,
    currentLevel,
    progressText,
  }
}
