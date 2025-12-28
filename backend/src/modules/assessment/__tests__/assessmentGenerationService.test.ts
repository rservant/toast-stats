import { describe, it, expect, vi } from 'vitest'
import AssessmentGenerationService from '../services/assessmentGenerationService'
import CacheIntegrationService from '../services/cacheIntegrationService'
import type { MonthlyAssessment } from '../types/assessment'
import type { CompleteAssessmentData } from '../services/cacheIntegrationService'

class MockCacheIntegrationService extends CacheIntegrationService {
  private mockLatestDate: string | null
  private mockCompleteData: CompleteAssessmentData | null

  constructor(
    latestDate: string | null = '2024-07-31',
    completeData: CompleteAssessmentData | null = null
  ) {
    super()
    this.mockLatestDate = latestDate
    this.mockCompleteData = completeData
  }

  async getLatestCacheDate(_id: string): Promise<string | null> {
    return this.mockLatestDate
  }

  async getCompleteAssessmentDataByDate(
    _id: string,
    _date: string
  ): Promise<CompleteAssessmentData | null> {
    return this.mockCompleteData
  }
}

describe('AssessmentGenerationService', () => {
  it('generates assessment when cache available and no existing assessment', async () => {
    // Mock cache service with complete data
    const mockCompleteData: CompleteAssessmentData = {
      membership_payments_ytd: 1000,
      paid_clubs_ytd: 10,
      distinguished_clubs_ytd: 3,
      csp_submissions_ytd: 4,
      csv_row_count: 10,
      cache_file: 'districts_2024-07-31.json',
    }
    const mockCacheSvc = new MockCacheIntegrationService(
      '2024-07-31',
      mockCompleteData
    )

    // Stub storage functions
    const mod = await import('../storage/assessmentStore')
    const saveSpy = vi
      .spyOn(mod, 'saveMonthlyAssessment')
      .mockImplementation(async () => {})
    const getSpy = vi
      .spyOn(mod, 'getMonthlyAssessment')
      .mockImplementation(async () => null)

    const svc = new AssessmentGenerationService(mockCacheSvc)

    const result = await svc.generateMonthlyAssessment({
      district_number: 61,
      program_year: '2024-2025',
      month: 'July',
    })

    expect(result.district_number).toBe(61)
    expect(result.csp_submissions_ytd).toBe(4)
    expect(saveSpy).toHaveBeenCalled()

    // restore
    saveSpy.mockRestore()
    getSpy.mockRestore()
  })

  it('throws when assessment already exists', async () => {
    const mockCacheSvc = new MockCacheIntegrationService('2024-07-31', null)
    const mod = await import('../storage/assessmentStore')
    const getSpy = vi.spyOn(mod, 'getMonthlyAssessment').mockImplementation(
      async (): Promise<MonthlyAssessment | null> => ({
        district_number: 61,
        program_year: '2024-2025',
        month: 'July',
        membership_payments_ytd: 1000,
        paid_clubs_ytd: 10,
        distinguished_clubs_ytd: 3,
        csp_submissions_ytd: 4,
        created_at: '2024-07-31T00:00:00Z',
        updated_at: '2024-07-31T00:00:00Z',
      })
    )

    const svc = new AssessmentGenerationService(mockCacheSvc)

    await expect(
      svc.generateMonthlyAssessment({
        district_number: 61,
        program_year: '2024-2025',
        month: 'July',
      })
    ).rejects.toThrow()

    getSpy.mockRestore()
  })
})
