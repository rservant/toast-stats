/**
 * Unit tests for DataValidator class
 *
 * Tests the comprehensive schema validation and business rule validation
 * for normalized data structures.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { DataValidator } from '../services/DataValidator.js'
import type { NormalizedData } from '../types/snapshots.js'

describe('DataValidator', () => {
  let validator: DataValidator

  beforeEach(() => {
    validator = new DataValidator()
  })

  describe('validate()', () => {
    it('should validate correct normalized data successfully', async () => {
      const validData: NormalizedData = {
        districts: [
          {
            districtId: '123',
            asOfDate: '2024-01-01',
            membership: {
              total: 100,
              change: 5,
              changePercent: 5.0,
              byClub: [
                { clubId: 'club1', clubName: 'Test Club 1', memberCount: 50 },
                { clubId: 'club2', clubName: 'Test Club 2', memberCount: 50 },
              ],
            },
            clubs: {
              total: 2,
              active: 2,
              suspended: 0,
              ineligible: 0,
              low: 0,
              distinguished: 1,
            },
            education: {
              totalAwards: 10,
              byType: [
                { type: 'CC', count: 5 },
                { type: 'CL', count: 5 },
              ],
              topClubs: [
                { clubId: 'club1', clubName: 'Test Club 1', awards: 6 },
                { clubId: 'club2', clubName: 'Test Club 2', awards: 4 },
              ],
            },
          },
        ],
        metadata: {
          source: 'toastmasters-dashboard',
          fetchedAt: new Date().toISOString(),
          dataAsOfDate: '2024-01-01',
          districtCount: 1,
          processingDurationMs: 5000,
        },
      }

      const result = await validator.validate(validData)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.validationMetadata.validatorVersion).toBe('1.0.0')
      expect(result.validationMetadata.validationDurationMs).toBeGreaterThan(0)
    })

    it('should reject data with missing required fields', async () => {
      const invalidData = {
        districts: [
          {
            // Missing districtId
            asOfDate: '2024-01-01',
            membership: {
              total: 100,
              change: 5,
              changePercent: 5.0,
              byClub: [],
            },
            clubs: {
              total: 2,
              active: 2,
              suspended: 0,
              ineligible: 0,
              low: 0,
              distinguished: 1,
            },
            education: {
              totalAwards: 10,
              byType: [{ type: 'CC', count: 10 }],
              topClubs: [],
            },
          },
        ],
        metadata: {
          source: 'toastmasters-dashboard',
          fetchedAt: new Date().toISOString(),
          dataAsOfDate: '2024-01-01',
          districtCount: 1,
          processingDurationMs: 5000,
        },
      } as NormalizedData

      const result = await validator.validate(invalidData)

      expect(result.isValid).toBe(false)
      expect(
        result.errors.some(error =>
          error.includes('expected string, received undefined')
        )
      ).toBe(true)
    })

    it('should reject data with invalid data types', async () => {
      const invalidData = {
        districts: [
          {
            districtId: '123',
            asOfDate: '2024-01-01',
            membership: {
              total: 'invalid', // Should be number
              change: 5,
              changePercent: 5.0,
              byClub: [],
            },
            clubs: {
              total: 2,
              active: 2,
              suspended: 0,
              ineligible: 0,
              low: 0,
              distinguished: 1,
            },
            education: {
              totalAwards: 10,
              byType: [{ type: 'CC', count: 10 }],
              topClubs: [],
            },
          },
        ],
        metadata: {
          source: 'toastmasters-dashboard',
          fetchedAt: new Date().toISOString(),
          dataAsOfDate: '2024-01-01',
          districtCount: 1,
          processingDurationMs: 5000,
        },
      } as NormalizedData

      const result = await validator.validate(invalidData)

      expect(result.isValid).toBe(false)
      expect(
        result.errors.some(error =>
          error.includes('expected number, received string')
        )
      ).toBe(true)
    })

    it('should validate district count matches actual districts', async () => {
      const invalidData: NormalizedData = {
        districts: [
          {
            districtId: '123',
            asOfDate: '2024-01-01',
            membership: {
              total: 100,
              change: 5,
              changePercent: 5.0,
              byClub: [
                { clubId: 'club1', clubName: 'Test Club', memberCount: 100 },
              ],
            },
            clubs: {
              total: 2,
              active: 2,
              suspended: 0,
              ineligible: 0,
              low: 0,
              distinguished: 1,
            },
            education: {
              totalAwards: 10,
              byType: [{ type: 'CC', count: 10 }],
              topClubs: [],
            },
          },
        ],
        metadata: {
          source: 'toastmasters-dashboard',
          fetchedAt: new Date().toISOString(),
          dataAsOfDate: '2024-01-01',
          districtCount: 2, // Says 2 but only 1 district in array
          processingDurationMs: 5000,
        },
      }

      const result = await validator.validate(invalidData)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain(
        'District count in metadata must match actual districts array length'
      )
    })

    it('should detect duplicate district IDs', async () => {
      const invalidData: NormalizedData = {
        districts: [
          {
            districtId: '123',
            asOfDate: '2024-01-01',
            membership: {
              total: 50,
              change: 5,
              changePercent: 5.0,
              byClub: [
                { clubId: 'club1', clubName: 'Test Club 1', memberCount: 50 },
              ],
            },
            clubs: {
              total: 1,
              active: 1,
              suspended: 0,
              ineligible: 0,
              low: 0,
              distinguished: 0,
            },
            education: {
              totalAwards: 5,
              byType: [{ type: 'CC', count: 5 }],
              topClubs: [],
            },
          },
          {
            districtId: '123', // Duplicate ID
            asOfDate: '2024-01-01',
            membership: {
              total: 50,
              change: 5,
              changePercent: 5.0,
              byClub: [
                { clubId: 'club2', clubName: 'Test Club 2', memberCount: 50 },
              ],
            },
            clubs: {
              total: 1,
              active: 1,
              suspended: 0,
              ineligible: 0,
              low: 0,
              distinguished: 0,
            },
            education: {
              totalAwards: 5,
              byType: [{ type: 'CC', count: 5 }],
              topClubs: [],
            },
          },
        ],
        metadata: {
          source: 'toastmasters-dashboard',
          fetchedAt: new Date().toISOString(),
          dataAsOfDate: '2024-01-01',
          districtCount: 2,
          processingDurationMs: 5000,
        },
      }

      const result = await validator.validate(invalidData)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain(
        'District IDs must be unique across all districts'
      )
    })

    it('should warn about old data', async () => {
      const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0] // 10 days ago

      const dataWithOldDate: NormalizedData = {
        districts: [
          {
            districtId: '123',
            asOfDate: '2024-01-01',
            membership: {
              total: 100,
              change: 5,
              changePercent: 5.0,
              byClub: [
                { clubId: 'club1', clubName: 'Test Club', memberCount: 100 },
              ],
            },
            clubs: {
              total: 2,
              active: 2,
              suspended: 0,
              ineligible: 0,
              low: 0,
              distinguished: 1,
            },
            education: {
              totalAwards: 10,
              byType: [{ type: 'CC', count: 10 }],
              topClubs: [],
            },
          },
        ],
        metadata: {
          source: 'toastmasters-dashboard',
          fetchedAt: new Date().toISOString(),
          dataAsOfDate: oldDate,
          districtCount: 1,
          processingDurationMs: 5000,
        },
      }

      const result = await validator.validate(dataWithOldDate)

      expect(result.isValid).toBe(true)
      expect(
        result.warnings.some(warning =>
          warning.includes('Data is older than 7 days')
        )
      ).toBe(true)
    })

    it('should warn about long processing duration', async () => {
      const dataWithLongProcessing: NormalizedData = {
        districts: [
          {
            districtId: '123',
            asOfDate: '2024-01-01',
            membership: {
              total: 100,
              change: 5,
              changePercent: 5.0,
              byClub: [
                { clubId: 'club1', clubName: 'Test Club', memberCount: 100 },
              ],
            },
            clubs: {
              total: 2,
              active: 2,
              suspended: 0,
              ineligible: 0,
              low: 0,
              distinguished: 1,
            },
            education: {
              totalAwards: 10,
              byType: [{ type: 'CC', count: 10 }],
              topClubs: [],
            },
          },
        ],
        metadata: {
          source: 'toastmasters-dashboard',
          fetchedAt: new Date().toISOString(),
          dataAsOfDate: '2024-01-01',
          districtCount: 1,
          processingDurationMs: 400000, // > 5 minutes
        },
      }

      const result = await validator.validate(dataWithLongProcessing)

      expect(result.isValid).toBe(true)
      expect(
        result.warnings.some(warning =>
          warning.includes('Processing duration was unusually long')
        )
      ).toBe(true)
    })

    it('should handle validation errors gracefully', async () => {
      const result = await validator.validate(null as unknown as NormalizedData)

      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain(
        'Validation failed with unexpected error'
      )
    })
  })

  describe('validatePartial()', () => {
    it('should validate partial district statistics', async () => {
      const partialData = {
        districtId: '123',
        asOfDate: '2024-01-01',
        membership: {
          total: 100,
          change: 5,
          changePercent: 5.0,
          byClub: [
            { clubId: 'club1', clubName: 'Test Club', memberCount: 100 },
          ],
        },
        clubs: {
          total: 2,
          active: 2,
          suspended: 0,
          ineligible: 0,
          low: 0,
          distinguished: 1,
        },
        education: {
          totalAwards: 10,
          byType: [{ type: 'CC', count: 10 }],
          topClubs: [],
        },
      }

      const result = await validator.validatePartial(
        partialData,
        'DistrictStatistics'
      )

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject invalid partial data', async () => {
      const invalidPartialData = {
        total: 'invalid', // Should be number
        change: 5,
        changePercent: 5.0,
        byClub: [],
      }

      const result = await validator.validatePartial(
        invalidPartialData,
        'MembershipStats'
      )

      expect(result.isValid).toBe(false)
      expect(
        result.errors.some(error =>
          error.includes('expected number, received string')
        )
      ).toBe(true)
    })

    it('should handle unknown schema names', async () => {
      const result = await validator.validatePartial({}, 'UnknownSchema')

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain(
        'Partial validation failed: Unknown schema name: UnknownSchema'
      )
    })
  })

  describe('getValidatorVersion()', () => {
    it('should return the current validator version', () => {
      const version = validator.getValidatorVersion()
      expect(version).toBe('1.0.0')
    })
  })

  describe('business rule validations', () => {
    it('should warn when membership total does not match sum of club memberships', async () => {
      const dataWithMismatch: NormalizedData = {
        districts: [
          {
            districtId: '123',
            asOfDate: '2024-01-01',
            membership: {
              total: 100,
              change: 5,
              changePercent: 5.0,
              byClub: [
                { clubId: 'club1', clubName: 'Test Club 1', memberCount: 30 },
                { clubId: 'club2', clubName: 'Test Club 2', memberCount: 30 },
                // Sum is 60, but total is 100 - difference > 1% tolerance
              ],
            },
            clubs: {
              total: 2,
              active: 2,
              suspended: 0,
              ineligible: 0,
              low: 0,
              distinguished: 1,
            },
            education: {
              totalAwards: 10,
              byType: [{ type: 'CC', count: 10 }],
              topClubs: [],
            },
          },
        ],
        metadata: {
          source: 'toastmasters-dashboard',
          fetchedAt: new Date().toISOString(),
          dataAsOfDate: '2024-01-01',
          districtCount: 1,
          processingDurationMs: 5000,
        },
      }

      const result = await validator.validate(dataWithMismatch)

      expect(result.isValid).toBe(true)
      expect(
        result.warnings.some(warning =>
          warning.includes("doesn't match total membership")
        )
      ).toBe(true)
    })

    it('should error when district has membership but no clubs', async () => {
      const invalidData: NormalizedData = {
        districts: [
          {
            districtId: '123',
            asOfDate: '2024-01-01',
            membership: {
              total: 100,
              change: 5,
              changePercent: 5.0,
              byClub: [],
            },
            clubs: {
              total: 0, // No clubs but has membership
              active: 0,
              suspended: 0,
              ineligible: 0,
              low: 0,
              distinguished: 0,
            },
            education: {
              totalAwards: 0,
              byType: [],
              topClubs: [],
            },
          },
        ],
        metadata: {
          source: 'toastmasters-dashboard',
          fetchedAt: new Date().toISOString(),
          dataAsOfDate: '2024-01-01',
          districtCount: 1,
          processingDurationMs: 5000,
        },
      }

      const result = await validator.validate(invalidData)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain(
        'District 123: Has membership but no clubs'
      )
    })
  })
})
