import { describe, it, expect } from 'vitest'
import CacheIntegrationService from '../services/cacheIntegrationService.js'
import { CspExtractorService } from '../services/cspExtractorService.js'

interface MockCacheManagerInterface {
  getDistrictData(districtId: string, date: string): Promise<unknown>;
  getDistrictDataRange(): Promise<{ startDate: string; endDate: string }>;
}

class MockCacheManager implements MockCacheManagerInterface {
  private data: unknown
  constructor(data: unknown) { this.data = data }
  async getDistrictData(_districtId: string, _date: string) { return this.data }
  async getDistrictDataRange() { return { startDate: '2024-07-30', endDate: '2024-07-31' } }
}

describe('CacheIntegrationService', () => {
  it('returns mapped assessment data from cache (including CSP)', async () => {
    const sample = {
      districtPerformance: [ { totalPayments: 1000, paidClubs: 5, distinguishedClubs: 2 } ],
      clubPerformance: [ { name: 'A', 'CSP Achieved': 'Yes' }, { name: 'B', 'CSP Achieved': 'No' } ],
      date: '2024-07-31'
    }

    const mockManager = new MockCacheManager(sample)
    const cspSvc = new CspExtractorService()
    const svc = new CacheIntegrationService(mockManager as any, cspSvc)

    const data = await svc.getCompleteAssessmentDataByDate('61', '2024-07-31')

    expect(data).not.toBeNull()
    expect(data?.membership_payments_ytd).toBe(1000)
    expect(data?.paid_clubs_ytd).toBe(5)
    expect(data?.distinguished_clubs_ytd).toBe(2)
    expect(data?.csp_submissions_ytd).toBe(1)
    expect(data?.csv_row_count).toBe(2)
  })

  it('getLatestCacheDate returns end date', async () => {
    const mockManager = new MockCacheManager({})
    const svc = new CacheIntegrationService(mockManager as any, new CspExtractorService())
    const latest = await svc.getLatestCacheDate('61')
    expect(latest).toBe('2024-07-31')
  })
})
