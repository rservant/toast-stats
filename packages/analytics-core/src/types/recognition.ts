/**
 * Area/Division recognition types.
 *
 * Types for DAP (Distinguished Area Program) and DDP (Distinguished Division Program)
 * recognition levels, eligibility, and metrics.
 */

/**
 * Recognition level for Areas and Divisions
 * Ordinal: NotDistinguished < Distinguished < Select < Presidents
 *
 * Moved from backend/src/types/analytics.ts to preserve hardened logic.
 *
 * Requirements: 7.1
 */
export type AreaDivisionRecognitionLevel =
  | 'NotDistinguished'
  | 'Distinguished'
  | 'Select'
  | 'Presidents'

/**
 * Eligibility status for DAP/DDP recognition
 * - 'eligible': All eligibility gates passed
 * - 'ineligible': One or more eligibility gates failed
 * - 'unknown': Cannot determine eligibility (missing data, e.g., club visits)
 *
 * Moved from backend/src/types/analytics.ts to preserve hardened logic.
 *
 * Requirements: 7.1
 */
export type RecognitionEligibility = 'eligible' | 'ineligible' | 'unknown'

/**
 * Distinguished Area Program (DAP) metrics and recognition
 *
 * Per steering document dap-ddp-recognition.md:
 * - Eligibility requires club visits (2 per club) - currently unavailable from dashboard
 * - Paid clubs threshold: ≥75%
 * - Distinguished clubs calculated against paid clubs only
 *
 * Moved from backend/src/types/analytics.ts to preserve hardened logic.
 *
 * Requirements: 7.1
 */
export interface AreaRecognition {
  areaId: string
  areaName: string
  divisionId: string

  // Club counts
  totalClubs: number
  paidClubs: number
  distinguishedClubs: number // Clubs at any distinguished level (Distinguished, Select, Presidents, Smedley)

  // Percentages (0-100 scale)
  paidClubsPercent: number // paidClubs / totalClubs * 100
  distinguishedClubsPercent: number // distinguishedClubs / paidClubs * 100 (denominator is paid clubs)

  // Eligibility and recognition
  eligibility: RecognitionEligibility
  eligibilityReason?: string // Explanation when ineligible or unknown
  recognitionLevel: AreaDivisionRecognitionLevel

  // Threshold status for UI display
  meetsPaidThreshold: boolean // paidClubsPercent >= 75
  meetsDistinguishedThreshold: boolean // Based on recognition level requirements
}

/**
 * Distinguished Division Program (DDP) metrics and recognition
 *
 * Per steering document dap-ddp-recognition.md:
 * - Eligibility requires area club visits completion - currently unavailable from dashboard
 * - Paid areas threshold: ≥85%
 * - Distinguished areas calculated against paid areas only
 *
 * Moved from backend/src/types/analytics.ts to preserve hardened logic.
 *
 * Requirements: 7.1
 */
export interface DivisionRecognition {
  divisionId: string
  divisionName: string

  // Area counts
  totalAreas: number
  paidAreas: number
  distinguishedAreas: number // Areas at any distinguished level

  // Percentages (0-100 scale)
  paidAreasPercent: number // paidAreas / totalAreas * 100
  distinguishedAreasPercent: number // distinguishedAreas / paidAreas * 100 (denominator is paid areas)

  // Eligibility and recognition
  eligibility: RecognitionEligibility
  eligibilityReason?: string // Explanation when ineligible or unknown
  recognitionLevel: AreaDivisionRecognitionLevel

  // Threshold status for UI display
  meetsPaidThreshold: boolean // paidAreasPercent >= 85
  meetsDistinguishedThreshold: boolean // Based on recognition level requirements

  // Nested area recognition data
  areas: AreaRecognition[]
}
