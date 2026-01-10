/**
 * Area/Division Recognition Module
 *
 * Implements Distinguished Area Program (DAP) and Distinguished Division Program (DDP)
 * recognition calculations per steering document dap-ddp-recognition.md.
 *
 * Key rules:
 * - Eligibility gates hard-block recognition
 * - Distinguished percentages use paid units as denominator
 * - Recognition levels are ordinal: Distinguished < Select < Presidents
 */

import type { IAnalyticsDataSource } from '../../types/serviceInterfaces.js'
import type {
  AreaRecognition,
  DivisionRecognition,
  AreaDivisionRecognitionLevel,
  RecognitionEligibility,
} from '../../types/analytics.js'
import type {
  DistrictCacheEntry,
  ScrapedRecord,
} from '../../types/districts.js'
import { ensureString } from './AnalyticsUtils.js'
import { logger } from '../../utils/logger.js'

// ========== DAP Thresholds (from steering document) ==========
const DAP_PAID_CLUBS_THRESHOLD = 75 // ≥75% of clubs must be paid
const DAP_DISTINGUISHED_THRESHOLD = 50 // ≥50% for Distinguished
const DAP_SELECT_THRESHOLD = 75 // ≥75% for Select Distinguished
const DAP_PRESIDENTS_THRESHOLD = 100 // 100% for President's Distinguished

// ========== DDP Thresholds (from steering document) ==========
const DDP_PAID_AREAS_THRESHOLD = 85 // ≥85% of areas must be paid
const DDP_DISTINGUISHED_THRESHOLD = 50 // ≥50% for Distinguished
const DDP_SELECT_THRESHOLD = 75 // ≥75% for Select Distinguished
const DDP_PRESIDENTS_THRESHOLD = 100 // 100% for President's Distinguished

/**
 * AreaDivisionRecognitionModule
 *
 * Calculates DAP and DDP recognition status for areas and divisions.
 * Accepts dependencies via constructor injection for testability.
 */
export class AreaDivisionRecognitionModule {
  private readonly dataSource: IAnalyticsDataSource

  constructor(dataSource: IAnalyticsDataSource) {
    this.dataSource = dataSource
  }

  /**
   * Calculate area recognition for all areas in a district
   */
  async calculateAreaRecognition(
    districtId: string,
    date: string
  ): Promise<AreaRecognition[]> {
    try {
      const entry = await this.getDistrictDataForDate(districtId, date)
      if (!entry) {
        throw new Error(`No data found for district ${districtId} on ${date}`)
      }
      return this.analyzeAreaRecognition(entry)
    } catch (error) {
      logger.error('Failed to calculate area recognition', {
        districtId,
        date,
        error,
      })
      throw error
    }
  }

  /**
   * Calculate division recognition for all divisions in a district
   */
  async calculateDivisionRecognition(
    districtId: string,
    date: string
  ): Promise<DivisionRecognition[]> {
    try {
      const entry = await this.getDistrictDataForDate(districtId, date)
      if (!entry) {
        throw new Error(`No data found for district ${districtId} on ${date}`)
      }
      return this.analyzeDivisionRecognition(entry)
    } catch (error) {
      logger.error('Failed to calculate division recognition', {
        districtId,
        date,
        error,
      })
      throw error
    }
  }

  // ========== Area Recognition Analysis ==========

  /**
   * Analyze area recognition from district cache entry
   */
  analyzeAreaRecognition(entry: DistrictCacheEntry): AreaRecognition[] {
    // Group clubs by area
    const areaMap = new Map<
      string,
      {
        areaId: string
        areaName: string
        divisionId: string
        clubs: ScrapedRecord[]
      }
    >()

    for (const club of entry.clubPerformance) {
      const areaId = ensureString(club['Area'])
      if (!areaId) continue

      if (!areaMap.has(areaId)) {
        areaMap.set(areaId, {
          areaId,
          areaName: ensureString(club['Area Name']) || areaId,
          divisionId: ensureString(club['Division']),
          clubs: [],
        })
      }
      areaMap.get(areaId)!.clubs.push(club)
    }

    // Calculate recognition for each area
    return Array.from(areaMap.values()).map(area =>
      this.calculateSingleAreaRecognition(
        area.areaId,
        area.areaName,
        area.divisionId,
        area.clubs
      )
    )
  }

  /**
   * Calculate recognition for a single area
   */
  private calculateSingleAreaRecognition(
    areaId: string,
    areaName: string,
    divisionId: string,
    clubs: ScrapedRecord[]
  ): AreaRecognition {
    const totalClubs = clubs.length
    const paidClubs = clubs.filter(club => this.isClubPaid(club)).length
    const distinguishedClubs = clubs.filter(
      club => this.isClubPaid(club) && this.isClubDistinguished(club)
    ).length

    // Calculate percentages
    const paidClubsPercent =
      totalClubs > 0
        ? Math.round((paidClubs / totalClubs) * 100 * 100) / 100
        : 0
    const distinguishedClubsPercent =
      paidClubs > 0
        ? Math.round((distinguishedClubs / paidClubs) * 100 * 100) / 100
        : 0

    // Check thresholds
    const meetsPaidThreshold = paidClubsPercent >= DAP_PAID_CLUBS_THRESHOLD

    // Determine eligibility (club visits not available from dashboard)
    const eligibility: RecognitionEligibility = 'unknown'
    const eligibilityReason = 'Club visit data not available from dashboard'

    // Determine recognition level based on thresholds
    const recognitionLevel = this.determineAreaRecognitionLevel(
      meetsPaidThreshold,
      distinguishedClubsPercent
    )

    const meetsDistinguishedThreshold = this.checkDistinguishedThreshold(
      recognitionLevel,
      distinguishedClubsPercent,
      DAP_DISTINGUISHED_THRESHOLD
    )

    return {
      areaId,
      areaName,
      divisionId,
      totalClubs,
      paidClubs,
      distinguishedClubs,
      paidClubsPercent,
      distinguishedClubsPercent,
      eligibility,
      eligibilityReason,
      recognitionLevel,
      meetsPaidThreshold,
      meetsDistinguishedThreshold,
    }
  }

  /**
   * Determine area recognition level based on DAP thresholds
   */
  private determineAreaRecognitionLevel(
    meetsPaidThreshold: boolean,
    distinguishedPercent: number
  ): AreaDivisionRecognitionLevel {
    if (!meetsPaidThreshold) {
      return 'NotDistinguished'
    }

    // Check from highest to lowest (ordinal)
    if (distinguishedPercent >= DAP_PRESIDENTS_THRESHOLD) {
      return 'Presidents'
    }
    if (distinguishedPercent >= DAP_SELECT_THRESHOLD) {
      return 'Select'
    }
    if (distinguishedPercent >= DAP_DISTINGUISHED_THRESHOLD) {
      return 'Distinguished'
    }

    return 'NotDistinguished'
  }

  // ========== Division Recognition Analysis ==========

  /**
   * Analyze division recognition from district cache entry
   */
  analyzeDivisionRecognition(entry: DistrictCacheEntry): DivisionRecognition[] {
    // First calculate area recognition
    const areaRecognitions = this.analyzeAreaRecognition(entry)

    // Group areas by division
    const divisionMap = new Map<
      string,
      {
        divisionId: string
        divisionName: string
        areas: AreaRecognition[]
      }
    >()

    for (const area of areaRecognitions) {
      if (!divisionMap.has(area.divisionId)) {
        // Get division name from first club in this division
        const divisionClub = entry.clubPerformance.find(
          club => ensureString(club['Division']) === area.divisionId
        )
        divisionMap.set(area.divisionId, {
          divisionId: area.divisionId,
          divisionName:
            ensureString(divisionClub?.['Division Name']) || area.divisionId,
          areas: [],
        })
      }
      divisionMap.get(area.divisionId)!.areas.push(area)
    }

    // Calculate recognition for each division
    return Array.from(divisionMap.values()).map(division =>
      this.calculateSingleDivisionRecognition(
        division.divisionId,
        division.divisionName,
        division.areas
      )
    )
  }

  /**
   * Calculate recognition for a single division
   */
  private calculateSingleDivisionRecognition(
    divisionId: string,
    divisionName: string,
    areas: AreaRecognition[]
  ): DivisionRecognition {
    const totalAreas = areas.length
    const paidAreas = areas.filter(area => this.isAreaPaid(area)).length
    const distinguishedAreas = areas.filter(
      area =>
        this.isAreaPaid(area) && area.recognitionLevel !== 'NotDistinguished'
    ).length

    // Calculate percentages
    const paidAreasPercent =
      totalAreas > 0
        ? Math.round((paidAreas / totalAreas) * 100 * 100) / 100
        : 0
    const distinguishedAreasPercent =
      paidAreas > 0
        ? Math.round((distinguishedAreas / paidAreas) * 100 * 100) / 100
        : 0

    // Check thresholds
    const meetsPaidThreshold = paidAreasPercent >= DDP_PAID_AREAS_THRESHOLD

    // Determine eligibility (club visits not available from dashboard)
    const eligibility: RecognitionEligibility = 'unknown'
    const eligibilityReason =
      'Area club visit data not available from dashboard'

    // Determine recognition level based on thresholds
    const recognitionLevel = this.determineDivisionRecognitionLevel(
      meetsPaidThreshold,
      distinguishedAreasPercent
    )

    const meetsDistinguishedThreshold = this.checkDistinguishedThreshold(
      recognitionLevel,
      distinguishedAreasPercent,
      DDP_DISTINGUISHED_THRESHOLD
    )

    return {
      divisionId,
      divisionName,
      totalAreas,
      paidAreas,
      distinguishedAreas,
      paidAreasPercent,
      distinguishedAreasPercent,
      eligibility,
      eligibilityReason,
      recognitionLevel,
      meetsPaidThreshold,
      meetsDistinguishedThreshold,
      areas,
    }
  }

  /**
   * Determine division recognition level based on DDP thresholds
   */
  private determineDivisionRecognitionLevel(
    meetsPaidThreshold: boolean,
    distinguishedPercent: number
  ): AreaDivisionRecognitionLevel {
    if (!meetsPaidThreshold) {
      return 'NotDistinguished'
    }

    // Check from highest to lowest (ordinal)
    if (distinguishedPercent >= DDP_PRESIDENTS_THRESHOLD) {
      return 'Presidents'
    }
    if (distinguishedPercent >= DDP_SELECT_THRESHOLD) {
      return 'Select'
    }
    if (distinguishedPercent >= DDP_DISTINGUISHED_THRESHOLD) {
      return 'Distinguished'
    }

    return 'NotDistinguished'
  }

  // ========== Helper Methods ==========

  /**
   * Check if a club is paid (in good standing)
   * Per steering: Active = paid; Suspended/Ineligible/Low = not paid
   */
  private isClubPaid(club: ScrapedRecord): boolean {
    const status = ensureString(
      club['Club Status'] || club['Status']
    ).toLowerCase()

    // Active clubs are paid
    if (status === 'active' || status === '') {
      return true
    }

    // Suspended, Ineligible, Low are not paid
    return false
  }

  /**
   * Check if a club has achieved any distinguished level
   * Includes: Distinguished, Select, Presidents, Smedley
   */
  private isClubDistinguished(club: ScrapedRecord): boolean {
    const distinguishedStatus = ensureString(
      club['Club Distinguished Status'] || club['Distinguished Status']
    ).toLowerCase()

    // Check for any distinguished level
    return (
      distinguishedStatus.includes('distinguished') ||
      distinguishedStatus.includes('select') ||
      distinguishedStatus.includes('president') ||
      distinguishedStatus.includes('smedley')
    )
  }

  /**
   * Check if an area is paid (not suspended due to unpaid clubs)
   * An area is considered paid if it has at least one paid club
   */
  private isAreaPaid(area: AreaRecognition): boolean {
    return area.paidClubs > 0
  }

  /**
   * Check if distinguished threshold is met for the given recognition level
   */
  private checkDistinguishedThreshold(
    recognitionLevel: AreaDivisionRecognitionLevel,
    distinguishedPercent: number,
    baseThreshold: number
  ): boolean {
    if (recognitionLevel === 'NotDistinguished') {
      return false
    }
    return distinguishedPercent >= baseThreshold
  }

  // ========== Data Loading ==========

  /**
   * Get district data for a specific date
   */
  private async getDistrictDataForDate(
    districtId: string,
    date: string
  ): Promise<DistrictCacheEntry | null> {
    try {
      const districtData = await this.dataSource.getDistrictData(
        date,
        districtId
      )
      if (!districtData) {
        return null
      }

      return {
        districtId: districtData.districtId,
        date,
        districtPerformance: districtData.districtPerformance ?? [],
        divisionPerformance: districtData.divisionPerformance ?? [],
        clubPerformance: districtData.clubPerformance ?? [],
        fetchedAt: districtData.asOfDate,
      }
    } catch (error) {
      logger.warn('Failed to get district data for date', {
        districtId,
        date,
        error,
      })
      return null
    }
  }
}

// ========== Exported Threshold Constants ==========
export const DAP_THRESHOLDS = {
  PAID_CLUBS: DAP_PAID_CLUBS_THRESHOLD,
  DISTINGUISHED: DAP_DISTINGUISHED_THRESHOLD,
  SELECT: DAP_SELECT_THRESHOLD,
  PRESIDENTS: DAP_PRESIDENTS_THRESHOLD,
} as const

export const DDP_THRESHOLDS = {
  PAID_AREAS: DDP_PAID_AREAS_THRESHOLD,
  DISTINGUISHED: DDP_DISTINGUISHED_THRESHOLD,
  SELECT: DDP_SELECT_THRESHOLD,
  PRESIDENTS: DDP_PRESIDENTS_THRESHOLD,
} as const
