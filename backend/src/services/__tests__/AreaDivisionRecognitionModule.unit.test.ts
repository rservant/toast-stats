/**
 * Unit Tests for AreaDivisionRecognitionModule
 *
 * Tests Distinguished Area Program (DAP) and Distinguished Division Program (DDP)
 * recognition calculations per steering document dap-ddp-recognition.md.
 *
 * Key rules tested:
 * - Eligibility gates hard-block recognition
 * - Distinguished percentages use paid units as denominator
 * - Recognition levels are ordinal: Distinguished < Select < Presidents
 * - Paid clubs threshold: ≥75% for areas
 * - Paid areas threshold: ≥85% for divisions
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { AreaDivisionRecognitionModule, DAP_THRESHOLDS, DDP_THRESHOLDS } from '../analytics/AreaDivisionRecognitionModule.js'
import type { DistrictCacheEntry, ScrapedRecord } from '../../types/districts.js'
import type { IAnalyticsDataSource } from '../../types/serviceInterfaces.js'

describe('AreaDivisionRecognitionModule - Unit Tests', () => {
  let module: AreaDivisionRecognitionModule
  let mockDataSource: IAnalyticsDataSource

  beforeEach(() => {
    // Create mock data source
    mockDataSource = {
      getDistrictData: async () => null,
      getAvailableDates: async () => [],
      getLatestDate: async () => null,
    }
    module = new AreaDivisionRecognitionModule(mockDataSource)
  })

  afterEach(() => {
    // No cleanup needed for unit tests
  })

  // ========== Helper Functions ==========

  /**
   * Create a mock club record
   */
  function createClub(options: {
    clubId: string
    division: string
    area: string
    status?: string
    distinguishedStatus?: string
  }): ScrapedRecord {
    return {
      'Club Number': options.clubId,
      'Club Name': `Club ${options.clubId}`,
      'Division': options.division,
      'Division Name': `Division ${options.division}`,
      'Area': options.area,
      'Area Name': `Area ${options.area}`,
      'Club Status': options.status ?? 'Active',
      'Club Distinguished Status': options.distinguishedStatus ?? '',
      'Active Members': 20,
      'Goals Met': 5,
    }
  }

  /**
   * Create a mock district cache entry with specified clubs
   */
  function createEntry(clubs: ScrapedRecord[]): DistrictCacheEntry {
    return {
      districtId: 'test-district',
      date: '2026-01-15',
      districtPerformance: [],
      divisionPerformance: [],
      clubPerformance: clubs,
      fetchedAt: '2026-01-15T00:00:00Z',
    }
  }

  // ========== DAP Threshold Constants Tests ==========

  describe('DAP Threshold Constants', () => {
    it('should have correct paid clubs threshold (75%)', () => {
      expect(DAP_THRESHOLDS.PAID_CLUBS).toBe(75)
    })

    it('should have correct distinguished threshold (50%)', () => {
      expect(DAP_THRESHOLDS.DISTINGUISHED).toBe(50)
    })

    it('should have correct select threshold (75%)', () => {
      expect(DAP_THRESHOLDS.SELECT).toBe(75)
    })

    it('should have correct presidents threshold (100%)', () => {
      expect(DAP_THRESHOLDS.PRESIDENTS).toBe(100)
    })
  })

  // ========== DDP Threshold Constants Tests ==========

  describe('DDP Threshold Constants', () => {
    it('should have correct paid areas threshold (85%)', () => {
      expect(DDP_THRESHOLDS.PAID_AREAS).toBe(85)
    })

    it('should have correct distinguished threshold (50%)', () => {
      expect(DDP_THRESHOLDS.DISTINGUISHED).toBe(50)
    })

    it('should have correct select threshold (75%)', () => {
      expect(DDP_THRESHOLDS.SELECT).toBe(75)
    })

    it('should have correct presidents threshold (100%)', () => {
      expect(DDP_THRESHOLDS.PRESIDENTS).toBe(100)
    })
  })

  // ========== Area Recognition Tests ==========

  describe('Area Recognition - Paid Clubs Calculation', () => {
    it('should count Active clubs as paid', () => {
      const entry = createEntry([
        createClub({ clubId: '1', division: 'A', area: '1', status: 'Active' }),
        createClub({ clubId: '2', division: 'A', area: '1', status: 'Active' }),
      ])

      const results = module.analyzeAreaRecognition(entry)
      const area = results.find(a => a.areaId === '1')

      expect(area?.totalClubs).toBe(2)
      expect(area?.paidClubs).toBe(2)
      expect(area?.paidClubsPercent).toBe(100)
    })

    it('should NOT count Suspended clubs as paid', () => {
      const entry = createEntry([
        createClub({ clubId: '1', division: 'A', area: '1', status: 'Active' }),
        createClub({ clubId: '2', division: 'A', area: '1', status: 'Suspended' }),
      ])

      const results = module.analyzeAreaRecognition(entry)
      const area = results.find(a => a.areaId === '1')

      expect(area?.totalClubs).toBe(2)
      expect(area?.paidClubs).toBe(1)
      expect(area?.paidClubsPercent).toBe(50)
    })

    it('should NOT count Ineligible clubs as paid', () => {
      const entry = createEntry([
        createClub({ clubId: '1', division: 'A', area: '1', status: 'Active' }),
        createClub({ clubId: '2', division: 'A', area: '1', status: 'Ineligible' }),
      ])

      const results = module.analyzeAreaRecognition(entry)
      const area = results.find(a => a.areaId === '1')

      expect(area?.paidClubs).toBe(1)
      expect(area?.paidClubsPercent).toBe(50)
    })

    it('should NOT count Low status clubs as paid', () => {
      const entry = createEntry([
        createClub({ clubId: '1', division: 'A', area: '1', status: 'Active' }),
        createClub({ clubId: '2', division: 'A', area: '1', status: 'Low' }),
      ])

      const results = module.analyzeAreaRecognition(entry)
      const area = results.find(a => a.areaId === '1')

      expect(area?.paidClubs).toBe(1)
    })
  })


  describe('Area Recognition - Distinguished Clubs Calculation', () => {
    it('should count Distinguished clubs (only from paid clubs)', () => {
      const entry = createEntry([
        createClub({ clubId: '1', division: 'A', area: '1', status: 'Active', distinguishedStatus: 'Distinguished' }),
        createClub({ clubId: '2', division: 'A', area: '1', status: 'Active', distinguishedStatus: '' }),
      ])

      const results = module.analyzeAreaRecognition(entry)
      const area = results.find(a => a.areaId === '1')

      expect(area?.distinguishedClubs).toBe(1)
      expect(area?.distinguishedClubsPercent).toBe(50) // 1/2 paid clubs
    })

    it('should count Select Distinguished clubs', () => {
      const entry = createEntry([
        createClub({ clubId: '1', division: 'A', area: '1', status: 'Active', distinguishedStatus: 'Select Distinguished' }),
        createClub({ clubId: '2', division: 'A', area: '1', status: 'Active', distinguishedStatus: '' }),
      ])

      const results = module.analyzeAreaRecognition(entry)
      const area = results.find(a => a.areaId === '1')

      expect(area?.distinguishedClubs).toBe(1)
    })

    it('should count Presidents Distinguished clubs', () => {
      const entry = createEntry([
        createClub({ clubId: '1', division: 'A', area: '1', status: 'Active', distinguishedStatus: 'Presidents Distinguished' }),
        createClub({ clubId: '2', division: 'A', area: '1', status: 'Active', distinguishedStatus: '' }),
      ])

      const results = module.analyzeAreaRecognition(entry)
      const area = results.find(a => a.areaId === '1')

      expect(area?.distinguishedClubs).toBe(1)
    })

    it('should count Smedley Distinguished clubs', () => {
      const entry = createEntry([
        createClub({ clubId: '1', division: 'A', area: '1', status: 'Active', distinguishedStatus: 'Smedley Distinguished' }),
        createClub({ clubId: '2', division: 'A', area: '1', status: 'Active', distinguishedStatus: '' }),
      ])

      const results = module.analyzeAreaRecognition(entry)
      const area = results.find(a => a.areaId === '1')

      expect(area?.distinguishedClubs).toBe(1)
    })

    it('should NOT count distinguished clubs that are not paid', () => {
      const entry = createEntry([
        createClub({ clubId: '1', division: 'A', area: '1', status: 'Suspended', distinguishedStatus: 'Distinguished' }),
        createClub({ clubId: '2', division: 'A', area: '1', status: 'Active', distinguishedStatus: '' }),
      ])

      const results = module.analyzeAreaRecognition(entry)
      const area = results.find(a => a.areaId === '1')

      // Distinguished club is suspended, so not counted
      expect(area?.distinguishedClubs).toBe(0)
      expect(area?.paidClubs).toBe(1)
    })

    it('should calculate distinguished percentage against paid clubs only', () => {
      // 4 clubs total: 3 paid (2 distinguished), 1 suspended (distinguished)
      const entry = createEntry([
        createClub({ clubId: '1', division: 'A', area: '1', status: 'Active', distinguishedStatus: 'Distinguished' }),
        createClub({ clubId: '2', division: 'A', area: '1', status: 'Active', distinguishedStatus: 'Select Distinguished' }),
        createClub({ clubId: '3', division: 'A', area: '1', status: 'Active', distinguishedStatus: '' }),
        createClub({ clubId: '4', division: 'A', area: '1', status: 'Suspended', distinguishedStatus: 'Distinguished' }),
      ])

      const results = module.analyzeAreaRecognition(entry)
      const area = results.find(a => a.areaId === '1')

      expect(area?.totalClubs).toBe(4)
      expect(area?.paidClubs).toBe(3)
      expect(area?.distinguishedClubs).toBe(2) // Only paid distinguished clubs
      // Distinguished % = 2/3 = 66.67%
      expect(area?.distinguishedClubsPercent).toBeCloseTo(66.67, 1)
    })
  })

  describe('Area Recognition - Paid Threshold (75%)', () => {
    it('should meet paid threshold at exactly 75%', () => {
      // 4 clubs: 3 paid = 75%
      const entry = createEntry([
        createClub({ clubId: '1', division: 'A', area: '1', status: 'Active' }),
        createClub({ clubId: '2', division: 'A', area: '1', status: 'Active' }),
        createClub({ clubId: '3', division: 'A', area: '1', status: 'Active' }),
        createClub({ clubId: '4', division: 'A', area: '1', status: 'Suspended' }),
      ])

      const results = module.analyzeAreaRecognition(entry)
      const area = results.find(a => a.areaId === '1')

      expect(area?.paidClubsPercent).toBe(75)
      expect(area?.meetsPaidThreshold).toBe(true)
    })

    it('should NOT meet paid threshold below 75%', () => {
      // 4 clubs: 2 paid = 50%
      const entry = createEntry([
        createClub({ clubId: '1', division: 'A', area: '1', status: 'Active' }),
        createClub({ clubId: '2', division: 'A', area: '1', status: 'Active' }),
        createClub({ clubId: '3', division: 'A', area: '1', status: 'Suspended' }),
        createClub({ clubId: '4', division: 'A', area: '1', status: 'Suspended' }),
      ])

      const results = module.analyzeAreaRecognition(entry)
      const area = results.find(a => a.areaId === '1')

      expect(area?.paidClubsPercent).toBe(50)
      expect(area?.meetsPaidThreshold).toBe(false)
    })
  })

  describe('Area Recognition - Recognition Levels', () => {
    it('should be NotDistinguished when paid threshold not met', () => {
      // 50% paid, 100% distinguished of paid
      const entry = createEntry([
        createClub({ clubId: '1', division: 'A', area: '1', status: 'Active', distinguishedStatus: 'Distinguished' }),
        createClub({ clubId: '2', division: 'A', area: '1', status: 'Suspended' }),
      ])

      const results = module.analyzeAreaRecognition(entry)
      const area = results.find(a => a.areaId === '1')

      expect(area?.meetsPaidThreshold).toBe(false)
      expect(area?.recognitionLevel).toBe('NotDistinguished')
    })

    it('should be Distinguished at 50% distinguished clubs', () => {
      // 4 clubs: 4 paid (75%+), 2 distinguished = 50%
      const entry = createEntry([
        createClub({ clubId: '1', division: 'A', area: '1', status: 'Active', distinguishedStatus: 'Distinguished' }),
        createClub({ clubId: '2', division: 'A', area: '1', status: 'Active', distinguishedStatus: 'Distinguished' }),
        createClub({ clubId: '3', division: 'A', area: '1', status: 'Active', distinguishedStatus: '' }),
        createClub({ clubId: '4', division: 'A', area: '1', status: 'Active', distinguishedStatus: '' }),
      ])

      const results = module.analyzeAreaRecognition(entry)
      const area = results.find(a => a.areaId === '1')

      expect(area?.paidClubsPercent).toBe(100)
      expect(area?.distinguishedClubsPercent).toBe(50)
      expect(area?.recognitionLevel).toBe('Distinguished')
    })

    it('should be Select at 75% distinguished clubs', () => {
      // 4 clubs: 4 paid, 3 distinguished = 75%
      const entry = createEntry([
        createClub({ clubId: '1', division: 'A', area: '1', status: 'Active', distinguishedStatus: 'Distinguished' }),
        createClub({ clubId: '2', division: 'A', area: '1', status: 'Active', distinguishedStatus: 'Distinguished' }),
        createClub({ clubId: '3', division: 'A', area: '1', status: 'Active', distinguishedStatus: 'Distinguished' }),
        createClub({ clubId: '4', division: 'A', area: '1', status: 'Active', distinguishedStatus: '' }),
      ])

      const results = module.analyzeAreaRecognition(entry)
      const area = results.find(a => a.areaId === '1')

      expect(area?.distinguishedClubsPercent).toBe(75)
      expect(area?.recognitionLevel).toBe('Select')
    })

    it('should be Presidents at 100% distinguished clubs', () => {
      // 4 clubs: 4 paid, 4 distinguished = 100%
      const entry = createEntry([
        createClub({ clubId: '1', division: 'A', area: '1', status: 'Active', distinguishedStatus: 'Distinguished' }),
        createClub({ clubId: '2', division: 'A', area: '1', status: 'Active', distinguishedStatus: 'Select Distinguished' }),
        createClub({ clubId: '3', division: 'A', area: '1', status: 'Active', distinguishedStatus: 'Presidents Distinguished' }),
        createClub({ clubId: '4', division: 'A', area: '1', status: 'Active', distinguishedStatus: 'Smedley Distinguished' }),
      ])

      const results = module.analyzeAreaRecognition(entry)
      const area = results.find(a => a.areaId === '1')

      expect(area?.distinguishedClubsPercent).toBe(100)
      expect(area?.recognitionLevel).toBe('Presidents')
    })

    it('should be NotDistinguished below 50% distinguished', () => {
      // 4 clubs: 4 paid, 1 distinguished = 25%
      const entry = createEntry([
        createClub({ clubId: '1', division: 'A', area: '1', status: 'Active', distinguishedStatus: 'Distinguished' }),
        createClub({ clubId: '2', division: 'A', area: '1', status: 'Active', distinguishedStatus: '' }),
        createClub({ clubId: '3', division: 'A', area: '1', status: 'Active', distinguishedStatus: '' }),
        createClub({ clubId: '4', division: 'A', area: '1', status: 'Active', distinguishedStatus: '' }),
      ])

      const results = module.analyzeAreaRecognition(entry)
      const area = results.find(a => a.areaId === '1')

      expect(area?.distinguishedClubsPercent).toBe(25)
      expect(area?.recognitionLevel).toBe('NotDistinguished')
    })
  })

  describe('Area Recognition - Eligibility', () => {
    it('should have unknown eligibility (club visits not available)', () => {
      const entry = createEntry([
        createClub({ clubId: '1', division: 'A', area: '1', status: 'Active' }),
      ])

      const results = module.analyzeAreaRecognition(entry)
      const area = results.find(a => a.areaId === '1')

      expect(area?.eligibility).toBe('unknown')
      expect(area?.eligibilityReason).toContain('Club visit data not available')
    })
  })


  // ========== Division Recognition Tests ==========

  describe('Division Recognition - Area Aggregation', () => {
    it('should aggregate areas by division', () => {
      const entry = createEntry([
        // Division A, Area 1: 2 clubs
        createClub({ clubId: '1', division: 'A', area: '1', status: 'Active' }),
        createClub({ clubId: '2', division: 'A', area: '1', status: 'Active' }),
        // Division A, Area 2: 2 clubs
        createClub({ clubId: '3', division: 'A', area: '2', status: 'Active' }),
        createClub({ clubId: '4', division: 'A', area: '2', status: 'Active' }),
        // Division B, Area 3: 2 clubs
        createClub({ clubId: '5', division: 'B', area: '3', status: 'Active' }),
        createClub({ clubId: '6', division: 'B', area: '3', status: 'Active' }),
      ])

      const results = module.analyzeDivisionRecognition(entry)

      expect(results).toHaveLength(2)
      
      const divA = results.find(d => d.divisionId === 'A')
      expect(divA?.totalAreas).toBe(2)
      expect(divA?.areas).toHaveLength(2)

      const divB = results.find(d => d.divisionId === 'B')
      expect(divB?.totalAreas).toBe(1)
      expect(divB?.areas).toHaveLength(1)
    })
  })

  describe('Division Recognition - Paid Areas Calculation', () => {
    it('should count areas with at least one paid club as paid', () => {
      const entry = createEntry([
        // Area 1: has paid clubs
        createClub({ clubId: '1', division: 'A', area: '1', status: 'Active' }),
        // Area 2: has paid clubs
        createClub({ clubId: '2', division: 'A', area: '2', status: 'Active' }),
      ])

      const results = module.analyzeDivisionRecognition(entry)
      const division = results.find(d => d.divisionId === 'A')

      expect(division?.totalAreas).toBe(2)
      expect(division?.paidAreas).toBe(2)
      expect(division?.paidAreasPercent).toBe(100)
    })

    it('should NOT count areas with zero paid clubs as paid', () => {
      const entry = createEntry([
        // Area 1: has paid clubs
        createClub({ clubId: '1', division: 'A', area: '1', status: 'Active' }),
        // Area 2: no paid clubs (all suspended)
        createClub({ clubId: '2', division: 'A', area: '2', status: 'Suspended' }),
        createClub({ clubId: '3', division: 'A', area: '2', status: 'Suspended' }),
      ])

      const results = module.analyzeDivisionRecognition(entry)
      const division = results.find(d => d.divisionId === 'A')

      expect(division?.totalAreas).toBe(2)
      expect(division?.paidAreas).toBe(1)
      expect(division?.paidAreasPercent).toBe(50)
    })
  })

  describe('Division Recognition - Distinguished Areas Calculation', () => {
    it('should count distinguished areas (only from paid areas)', () => {
      const entry = createEntry([
        // Area 1: Distinguished (100% paid, 100% distinguished)
        createClub({ clubId: '1', division: 'A', area: '1', status: 'Active', distinguishedStatus: 'Distinguished' }),
        createClub({ clubId: '2', division: 'A', area: '1', status: 'Active', distinguishedStatus: 'Distinguished' }),
        // Area 2: Not distinguished (100% paid, 0% distinguished)
        createClub({ clubId: '3', division: 'A', area: '2', status: 'Active', distinguishedStatus: '' }),
        createClub({ clubId: '4', division: 'A', area: '2', status: 'Active', distinguishedStatus: '' }),
      ])

      const results = module.analyzeDivisionRecognition(entry)
      const division = results.find(d => d.divisionId === 'A')

      expect(division?.paidAreas).toBe(2)
      expect(division?.distinguishedAreas).toBe(1) // Only Area 1 is distinguished
      expect(division?.distinguishedAreasPercent).toBe(50)
    })

    it('should calculate distinguished areas percentage against paid areas only', () => {
      const entry = createEntry([
        // Area 1: Distinguished (paid)
        createClub({ clubId: '1', division: 'A', area: '1', status: 'Active', distinguishedStatus: 'Distinguished' }),
        createClub({ clubId: '2', division: 'A', area: '1', status: 'Active', distinguishedStatus: 'Distinguished' }),
        // Area 2: Not paid (all suspended)
        createClub({ clubId: '3', division: 'A', area: '2', status: 'Suspended', distinguishedStatus: 'Distinguished' }),
        createClub({ clubId: '4', division: 'A', area: '2', status: 'Suspended', distinguishedStatus: 'Distinguished' }),
      ])

      const results = module.analyzeDivisionRecognition(entry)
      const division = results.find(d => d.divisionId === 'A')

      expect(division?.totalAreas).toBe(2)
      expect(division?.paidAreas).toBe(1) // Only Area 1 is paid
      expect(division?.distinguishedAreas).toBe(1)
      // Distinguished % = 1/1 = 100% (against paid areas only)
      expect(division?.distinguishedAreasPercent).toBe(100)
    })
  })

  describe('Division Recognition - Paid Threshold (85%)', () => {
    it('should meet paid threshold at 85% or above', () => {
      // Create 20 areas: 17 paid = 85%
      const clubs: ScrapedRecord[] = []
      for (let i = 1; i <= 17; i++) {
        clubs.push(createClub({ clubId: `${i}`, division: 'A', area: `${i}`, status: 'Active' }))
      }
      for (let i = 18; i <= 20; i++) {
        clubs.push(createClub({ clubId: `${i}`, division: 'A', area: `${i}`, status: 'Suspended' }))
      }

      const entry = createEntry(clubs)
      const results = module.analyzeDivisionRecognition(entry)
      const division = results.find(d => d.divisionId === 'A')

      expect(division?.paidAreasPercent).toBe(85)
      expect(division?.meetsPaidThreshold).toBe(true)
    })

    it('should NOT meet paid threshold below 85%', () => {
      // Create 20 areas: 16 paid = 80%
      const clubs: ScrapedRecord[] = []
      for (let i = 1; i <= 16; i++) {
        clubs.push(createClub({ clubId: `${i}`, division: 'A', area: `${i}`, status: 'Active' }))
      }
      for (let i = 17; i <= 20; i++) {
        clubs.push(createClub({ clubId: `${i}`, division: 'A', area: `${i}`, status: 'Suspended' }))
      }

      const entry = createEntry(clubs)
      const results = module.analyzeDivisionRecognition(entry)
      const division = results.find(d => d.divisionId === 'A')

      expect(division?.paidAreasPercent).toBe(80)
      expect(division?.meetsPaidThreshold).toBe(false)
    })
  })

  describe('Division Recognition - Recognition Levels', () => {
    it('should be NotDistinguished when paid threshold not met', () => {
      // 2 areas: 1 paid (50%), 1 distinguished
      const entry = createEntry([
        createClub({ clubId: '1', division: 'A', area: '1', status: 'Active', distinguishedStatus: 'Distinguished' }),
        createClub({ clubId: '2', division: 'A', area: '1', status: 'Active', distinguishedStatus: 'Distinguished' }),
        createClub({ clubId: '3', division: 'A', area: '2', status: 'Suspended' }),
      ])

      const results = module.analyzeDivisionRecognition(entry)
      const division = results.find(d => d.divisionId === 'A')

      expect(division?.meetsPaidThreshold).toBe(false)
      expect(division?.recognitionLevel).toBe('NotDistinguished')
    })

    it('should be Distinguished at 50% distinguished areas', () => {
      // 2 areas: 2 paid (100%), 1 distinguished = 50%
      const entry = createEntry([
        // Area 1: Distinguished
        createClub({ clubId: '1', division: 'A', area: '1', status: 'Active', distinguishedStatus: 'Distinguished' }),
        createClub({ clubId: '2', division: 'A', area: '1', status: 'Active', distinguishedStatus: 'Distinguished' }),
        // Area 2: Not distinguished
        createClub({ clubId: '3', division: 'A', area: '2', status: 'Active', distinguishedStatus: '' }),
        createClub({ clubId: '4', division: 'A', area: '2', status: 'Active', distinguishedStatus: '' }),
      ])

      const results = module.analyzeDivisionRecognition(entry)
      const division = results.find(d => d.divisionId === 'A')

      expect(division?.paidAreasPercent).toBe(100)
      expect(division?.distinguishedAreasPercent).toBe(50)
      expect(division?.recognitionLevel).toBe('Distinguished')
    })

    it('should be Select at 75% distinguished areas', () => {
      // 4 areas: 4 paid, 3 distinguished = 75%
      const entry = createEntry([
        // Area 1: Distinguished
        createClub({ clubId: '1', division: 'A', area: '1', status: 'Active', distinguishedStatus: 'Distinguished' }),
        createClub({ clubId: '2', division: 'A', area: '1', status: 'Active', distinguishedStatus: 'Distinguished' }),
        // Area 2: Distinguished
        createClub({ clubId: '3', division: 'A', area: '2', status: 'Active', distinguishedStatus: 'Distinguished' }),
        createClub({ clubId: '4', division: 'A', area: '2', status: 'Active', distinguishedStatus: 'Distinguished' }),
        // Area 3: Distinguished
        createClub({ clubId: '5', division: 'A', area: '3', status: 'Active', distinguishedStatus: 'Distinguished' }),
        createClub({ clubId: '6', division: 'A', area: '3', status: 'Active', distinguishedStatus: 'Distinguished' }),
        // Area 4: Not distinguished
        createClub({ clubId: '7', division: 'A', area: '4', status: 'Active', distinguishedStatus: '' }),
        createClub({ clubId: '8', division: 'A', area: '4', status: 'Active', distinguishedStatus: '' }),
      ])

      const results = module.analyzeDivisionRecognition(entry)
      const division = results.find(d => d.divisionId === 'A')

      expect(division?.distinguishedAreasPercent).toBe(75)
      expect(division?.recognitionLevel).toBe('Select')
    })

    it('should be Presidents at 100% distinguished areas', () => {
      // 2 areas: 2 paid, 2 distinguished = 100%
      const entry = createEntry([
        // Area 1: Distinguished
        createClub({ clubId: '1', division: 'A', area: '1', status: 'Active', distinguishedStatus: 'Distinguished' }),
        createClub({ clubId: '2', division: 'A', area: '1', status: 'Active', distinguishedStatus: 'Distinguished' }),
        // Area 2: Distinguished
        createClub({ clubId: '3', division: 'A', area: '2', status: 'Active', distinguishedStatus: 'Distinguished' }),
        createClub({ clubId: '4', division: 'A', area: '2', status: 'Active', distinguishedStatus: 'Distinguished' }),
      ])

      const results = module.analyzeDivisionRecognition(entry)
      const division = results.find(d => d.divisionId === 'A')

      expect(division?.distinguishedAreasPercent).toBe(100)
      expect(division?.recognitionLevel).toBe('Presidents')
    })
  })

  describe('Division Recognition - Eligibility', () => {
    it('should have unknown eligibility (club visits not available)', () => {
      const entry = createEntry([
        createClub({ clubId: '1', division: 'A', area: '1', status: 'Active' }),
      ])

      const results = module.analyzeDivisionRecognition(entry)
      const division = results.find(d => d.divisionId === 'A')

      expect(division?.eligibility).toBe('unknown')
      expect(division?.eligibilityReason).toContain('club visit data not available')
    })
  })

  // ========== Edge Cases ==========

  describe('Edge Cases', () => {
    it('should handle empty club list', () => {
      const entry = createEntry([])

      const areaResults = module.analyzeAreaRecognition(entry)
      const divisionResults = module.analyzeDivisionRecognition(entry)

      expect(areaResults).toHaveLength(0)
      expect(divisionResults).toHaveLength(0)
    })

    it('should handle area with zero clubs (edge case)', () => {
      // This shouldn't happen in practice, but test defensive behavior
      const entry = createEntry([
        createClub({ clubId: '1', division: 'A', area: '1', status: 'Active' }),
      ])

      const results = module.analyzeAreaRecognition(entry)
      expect(results).toHaveLength(1)
    })

    it('should handle division with zero paid areas', () => {
      const entry = createEntry([
        createClub({ clubId: '1', division: 'A', area: '1', status: 'Suspended' }),
        createClub({ clubId: '2', division: 'A', area: '2', status: 'Suspended' }),
      ])

      const results = module.analyzeDivisionRecognition(entry)
      const division = results.find(d => d.divisionId === 'A')

      expect(division?.paidAreas).toBe(0)
      expect(division?.paidAreasPercent).toBe(0)
      expect(division?.distinguishedAreasPercent).toBe(0) // 0/0 = 0
      expect(division?.recognitionLevel).toBe('NotDistinguished')
    })

    it('should handle clubs with missing status (default to Active)', () => {
      const entry = createEntry([
        { ...createClub({ clubId: '1', division: 'A', area: '1' }), 'Club Status': '' },
      ])

      const results = module.analyzeAreaRecognition(entry)
      const area = results.find(a => a.areaId === '1')

      // Empty status should be treated as Active (paid)
      expect(area?.paidClubs).toBe(1)
    })

    it('should handle case-insensitive status matching', () => {
      const entry = createEntry([
        { ...createClub({ clubId: '1', division: 'A', area: '1' }), 'Club Status': 'ACTIVE' },
        { ...createClub({ clubId: '2', division: 'A', area: '1' }), 'Club Status': 'active' },
        { ...createClub({ clubId: '3', division: 'A', area: '1' }), 'Club Status': 'Active' },
      ])

      const results = module.analyzeAreaRecognition(entry)
      const area = results.find(a => a.areaId === '1')

      expect(area?.paidClubs).toBe(3)
    })

    it('should handle case-insensitive distinguished status matching', () => {
      const entry = createEntry([
        { ...createClub({ clubId: '1', division: 'A', area: '1', status: 'Active' }), 'Club Distinguished Status': 'DISTINGUISHED' },
        { ...createClub({ clubId: '2', division: 'A', area: '1', status: 'Active' }), 'Club Distinguished Status': 'distinguished' },
      ])

      const results = module.analyzeAreaRecognition(entry)
      const area = results.find(a => a.areaId === '1')

      expect(area?.distinguishedClubs).toBe(2)
    })
  })
})
