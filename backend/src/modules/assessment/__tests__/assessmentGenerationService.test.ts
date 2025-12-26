import { describe, it, expect, vi } from 'vitest'
import AssessmentGenerationService from '../services/assessmentGenerationService.js'
import type { MonthlyAssessment } from '../types/assessment.js'

interface MockCacheService {
  getLatestCacheDate: (id: string) => Promise<string>;
  getCompleteAssessmentDataByDate?: (id: string, date: string) => Promise<{
    membership_payments_ytd: number;
    paid_clubs_ytd: number;
    distinguished_clubs_ytd: number;
    csp_submissions_ytd: number;
    csv_row_count: number;
    cache_file: string;
  }>;
}

describe('AssessmentGenerationService', () => {
  it('generates assessment when cache available and no existing assessment', async () => {
    // Mock cache service
    const mockCacheSvc: MockCacheService = {
      getLatestCacheDate: async (_id: string) => '2024-07-31',
      getCompleteAssessmentDataByDate: async (_id: string, _date: string) => ({
        membership_payments_ytd: 1000,
        paid_clubs_ytd: 10,
        distinguished_clubs_ytd: 3,
        csp_submissions_ytd: 4,
        csv_row_count: 10,
        cache_file: 'districts_2024-07-31.json'
      })
    }

    // Stub storage functions
    const mod = await import('../storage/assessmentStore.js')
    const saveSpy = vi.spyOn(mod, 'saveMonthlyAssessment').mockImplementation(async () => {})
    const getSpy = vi.spyOn(mod, 'getMonthlyAssessment').mockImplementation(async () => null)

    const svc = new AssessmentGenerationService(mockCacheSvc as any)

    const result = await svc.generateMonthlyAssessment({ district_number: 61, program_year: '2024-2025', month: 'July' })

    expect(result.district_number).toBe(61)
    expect(result.csp_submissions_ytd).toBe(4)
    expect(saveSpy).toHaveBeenCalled()

    // restore
    saveSpy.mockRestore()
    getSpy.mockRestore()
  })

  it('throws when assessment already exists', async () => {
    const mockCacheSvc: MockCacheService = { getLatestCacheDate: async ()=>'2024-07-31' }
    const mod = await import('../storage/assessmentStore.js')
    const getSpy = vi.spyOn(mod, 'getMonthlyAssessment').mockImplementation(async (): Promise<MonthlyAssessment | null> => ({ 
      district_number: 61, 
      program_year: '2024-2025', 
      month: 'July',
      membership_payments_ytd: 1000,
      paid_clubs_ytd: 10,
      distinguished_clubs_ytd: 3,
      csp_submissions_ytd: 4,
      created_at: '2024-07-31T00:00:00Z',
      updated_at: '2024-07-31T00:00:00Z'
    }))

    const svc = new AssessmentGenerationService(mockCacheSvc as any)

    await expect(svc.generateMonthlyAssessment({ district_number: 61, program_year: '2024-2025', month: 'July' })).rejects.toThrow()

    getSpy.mockRestore()
  })
})
