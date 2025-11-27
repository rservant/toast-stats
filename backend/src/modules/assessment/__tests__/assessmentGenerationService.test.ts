import { describe, it, expect, vi } from 'vitest'
import AssessmentGenerationService from '../services/assessmentGenerationService.js'

describe('AssessmentGenerationService', () => {
  it('generates assessment when cache available and no existing assessment', async () => {
    // Mock cache service
    const mockCacheSvc: any = {
      getLatestCacheDate: async (id: string) => '2024-07-31',
      getCompleteAssessmentDataByDate: async (id:string, date:string) => ({
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

    const svc = new AssessmentGenerationService(mockCacheSvc)

    const result = await svc.generateMonthlyAssessment({ district_number: 61, program_year: '2024-2025', month: 'July' })

    expect(result.district_number).toBe(61)
    expect(result.csp_submissions_ytd).toBe(4)
    expect(saveSpy).toHaveBeenCalled()

    // restore
    saveSpy.mockRestore()
    getSpy.mockRestore()
  })

  it('throws when assessment already exists', async () => {
    const mockCacheSvc: any = { getLatestCacheDate: async ()=>'2024-07-31' }
    const mod = await import('../storage/assessmentStore.js')
    const getSpy = vi.spyOn(mod, 'getMonthlyAssessment').mockImplementation(async () => ({ district_number: 61, program_year: '2024-2025', month: 'July' } as any))

    const svc = new AssessmentGenerationService(mockCacheSvc)

    await expect(svc.generateMonthlyAssessment({ district_number: 61, program_year: '2024-2025', month: 'July' })).rejects.toThrow()

    getSpy.mockRestore()
  })
})
