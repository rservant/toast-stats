import CacheIntegrationService from './cacheIntegrationService.js'
import {
  saveMonthlyAssessment,
  getMonthlyAssessment,
} from '../storage/assessmentStore.js'
import { calculateAllGoals } from './assessmentCalculator.js'
import { loadConfig } from './configService.js'
import { CalculatedAssessment } from '../types/assessment.js'

export class AssessmentGenerationService {
  private cacheService: CacheIntegrationService

  constructor(cacheService?: CacheIntegrationService) {
    this.cacheService = cacheService ?? new CacheIntegrationService()
  }

  /**
   * Generate a monthly assessment from cache for district/programYear/month
   * Will throw if no cache found or an assessment already exists.
   */
  async generateMonthlyAssessment(params: {
    district_number: number | string
    program_year: string
    month: string
    cache_date?: string
  }): Promise<CalculatedAssessment & { generated_at: string; generated_from_cache_date: string }> {
    const district_number = Number(params.district_number)
    const program_year = params.program_year
    const month = params.month

    // Determine cache date
    let cacheDate = params.cache_date
    if (!cacheDate) {
      const latest = await this.cacheService.getLatestCacheDate(
        String(district_number)
      )
      if (!latest) throw new Error('No cache data available for district')
      cacheDate = latest
    }

    // Ensure assessment does not already exist
    const existing = await getMonthlyAssessment(
      district_number,
      program_year,
      month
    )
    if (existing) {
      throw new Error(
        'Assessment already exists for district/programYear/month - delete first to regenerate'
      )
    }

    // Pull data from cache
    const complete = await this.cacheService.getCompleteAssessmentDataByDate(
      String(district_number),
      cacheDate
    )
    if (!complete) {
      throw new Error('Unable to load cache data for requested date')
    }

    // Build assessment object - follow existing types while adding generation metadata
    const now = new Date().toISOString()

    const assessment: CalculatedAssessment & {
      generated_at: string
      generated_from_cache_date: string
    } = {
      district_number,
      program_year,
      month,
      membership_payments_ytd: complete.membership_payments_ytd,
      paid_clubs_ytd: complete.paid_clubs_ytd,
      distinguished_clubs_ytd: complete.distinguished_clubs_ytd,
      csp_submissions_ytd: complete.csp_submissions_ytd,
      // generation metadata
      generated_at: now,
      generated_from_cache_date: cacheDate,
      data_sources: {
        membership_payments: {
          source: 'DistrictBackfillService',
          cache_file: complete.cache_file ?? null,
        },
        paid_clubs: {
          source: 'DistrictBackfillService',
          cache_file: complete.cache_file ?? null,
        },
        distinguished_clubs: {
          source: 'DistrictBackfillService',
          cache_file: complete.cache_file ?? null,
        },
        csp_submissions: {
          source: 'DistrictBackfillService (Club.aspx CSV)',
          csv_row_count: complete.csv_row_count ?? 0,
        },
      },
      // Initialize goal statuses - will be calculated below
      goal_1_status: {
        goal_number: 1,
        status: 'Pending Data',
        actual: 0,
        target: 0,
        delta: 0,
      },
      goal_2_status: {
        goal_number: 2,
        status: 'Pending Data',
        actual: 0,
        target: 0,
        delta: 0,
      },
      goal_3_status: {
        goal_number: 3,
        status: 'Pending Data',
        actual: 0,
        target: 0,
        delta: 0,
      },
      read_only: true,
      created_at: now,
      updated_at: now,
    }

    // Calculate goals using assessmentCalculator
    try {
      const config = await loadConfig(district_number, program_year)
      if (config) {
        const goals = calculateAllGoals(assessment, config)
        assessment.goal_1_status = goals.goal_1_status
        assessment.goal_2_status = goals.goal_2_status
        assessment.goal_3_status = goals.goal_3_status
      }
    } catch (err) {
      // If config loading fails, log but continue - goals will be empty
      console.warn(
        'Failed to calculate goals during assessment generation:',
        err
      )
    }

    await saveMonthlyAssessment(assessment)

    return assessment
  }
}

export default AssessmentGenerationService
