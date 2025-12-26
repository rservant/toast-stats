import { DistrictCacheManager } from '../../../services/DistrictCacheManager.js'
import fs from 'fs'
import path from 'path'
import { CspExtractorService } from './cspExtractorService.js'

export interface CompleteAssessmentData {
  membership_payments_ytd: number
  paid_clubs_ytd: number
  distinguished_clubs_ytd: number
  csp_submissions_ytd: number
  csv_row_count?: number
  cache_file?: string
}

export class CacheIntegrationService {
  private cacheManager: DistrictCacheManager
  private cspExtractor: CspExtractorService

  constructor(
    cacheManager?: DistrictCacheManager,
    cspExtractor?: CspExtractorService
  ) {
    if (cacheManager) {
      this.cacheManager = cacheManager
    } else {
      // Choose the cache path using a single helper so it's testable.
      const cachePath = CacheIntegrationService.selectCachePath()
      this.cacheManager = new DistrictCacheManager(cachePath)
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

  /**
   * choose the cache path string used when no explicit
   * DistrictCacheManager is provided. Honors DISTRICT_CACHE_DIR, then checks
   * for process.cwd()/cache and process.cwd()/backend/cache before falling
   * back to './cache'. Returns an absolute path.
   */
  static selectCachePath(): string {
    const envPath = process.env.DISTRICT_CACHE_DIR
    if (envPath) return path.resolve(envPath)

    try {
      const cwdCache = path.resolve(process.cwd(), 'cache')
      const repoCache = path.resolve(process.cwd(), 'backend', 'cache')

      if (fs.existsSync(cwdCache)) return cwdCache
      if (fs.existsSync(repoCache)) return repoCache
    } catch {
      // ignore errors
    }

    return path.resolve('./cache')
  }
}

export default CacheIntegrationService
