import { IDistrictCacheManager } from '../../../types/serviceInterfaces.js'
import { CspExtractorService } from './cspExtractorService.js'
import { getTestServiceFactory } from '../../../services/TestServiceFactory.js'
import { getProductionServiceFactory } from '../../../services/ProductionServiceFactory.js'

export interface CompleteAssessmentData {
  membership_payments_ytd: number
  paid_clubs_ytd: number
  distinguished_clubs_ytd: number
  csp_submissions_ytd: number
  csv_row_count?: number
  cache_file?: string
}

export class CacheIntegrationService {
  private cacheManager: IDistrictCacheManager
  private cspExtractor: CspExtractorService

  constructor(
    cacheManager?: IDistrictCacheManager,
    cspExtractor?: CspExtractorService
  ) {
    if (cacheManager) {
      this.cacheManager = cacheManager
    } else {
      // Use dependency injection instead of singleton
      const isTestEnvironment = process.env.NODE_ENV === 'test'

      if (isTestEnvironment) {
        const testFactory = getTestServiceFactory()
        const cacheConfig = testFactory.createCacheConfigService()
        this.cacheManager = testFactory.createDistrictCacheManager(cacheConfig)
      } else {
        const productionFactory = getProductionServiceFactory()
        const cacheConfig = productionFactory.createCacheConfigService()
        this.cacheManager =
          productionFactory.createDistrictCacheManager(cacheConfig)
      }
    }
    this.cspExtractor = cspExtractor ?? new CspExtractorService()
  }

  /**
   * Get latest cache date for district or null
   */
  async getLatestCacheDate(districtId: string): Promise<string | null> {
    const range = await this.cacheManager.getDistrictDataRange(districtId)
    return range ? range.endDate : null
  }

  /**
   * Get all assessment data from cache for a district on date
   */
  async getCompleteAssessmentDataByDate(
    districtId: string,
    date: string
  ): Promise<CompleteAssessmentData | null> {
    const data = await this.cacheManager.getDistrictData(districtId, date)
    if (!data) return null

    // districtPerformance expected to contain totals - fallback handles shape differences
    const districtRow =
      Array.isArray(data.districtPerformance) &&
      data.districtPerformance.length > 0
        ? data.districtPerformance[0]
        : null

    const membership_payments_ytd =
      districtRow?.totalPayments ?? districtRow?.membershipPayments ?? 0
    const paid_clubs_ytd = districtRow?.paidClubs ?? 0
    const distinguished_clubs_ytd = districtRow?.distinguishedClubs ?? 0

    // Club performance is cached as array of club records
    const clubRecords = Array.isArray(data.clubPerformance)
      ? data.clubPerformance
      : []
    const cspResult = this.cspExtractor.extractCspCount(clubRecords)

    return {
      membership_payments_ytd: Number(membership_payments_ytd) || 0,
      paid_clubs_ytd: Number(paid_clubs_ytd) || 0,
      distinguished_clubs_ytd: Number(distinguished_clubs_ytd) || 0,
      csp_submissions_ytd: Number(cspResult.csp_count) || 0,
      csv_row_count: cspResult.total_clubs,
      cache_file: `${districtId}_${date}.json`,
    }
  }

  /**
   * Extract CSP count directly from club records (exposed for tests)
   */
  async extractCspCount(districtId: string, date: string) {
    const data = await this.cacheManager.getDistrictData(districtId, date)
    if (!data) return { csp_count: 0, total_clubs: 0, csp_field_name: null }

    return this.cspExtractor.extractCspCount(
      Array.isArray(data.clubPerformance) ? data.clubPerformance : []
    )
  }

  /**
   * Get list of available dates for district with basic completeness info
   */
  async getAvailableDates(districtId: string): Promise<
    Array<{
      date: string
      has_district_data: boolean
      has_club_data: boolean
      club_count: number
      data_completeness: 'complete' | 'partial' | 'missing'
    }>
  > {
    const dates = await this.cacheManager.getCachedDatesForDistrict(districtId)
    const out: Array<{
      date: string
      has_district_data: boolean
      has_club_data: boolean
      club_count: number
      data_completeness: 'complete' | 'partial' | 'missing'
    }> = []

    for (const d of dates) {
      const data = await this.cacheManager.getDistrictData(districtId, d)
      const dataWithClubs = data as { clubPerformance?: unknown[] } | null
      const has_club_data = !!(
        dataWithClubs &&
        Array.isArray(dataWithClubs.clubPerformance) &&
        dataWithClubs.clubPerformance.length > 0
      )
      const club_count = has_club_data
        ? dataWithClubs.clubPerformance!.length
        : 0
      const completeness = has_club_data ? 'complete' : 'partial'

      out.push({
        date: d,
        has_district_data: true,
        has_club_data,
        club_count,
        data_completeness: completeness,
      })
    }

    return out
  }
}

export default CacheIntegrationService
