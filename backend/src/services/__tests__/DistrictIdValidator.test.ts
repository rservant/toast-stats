/**
 * Unit Tests for DistrictIdValidator
 *
 * Tests the district ID validation logic for filtering out invalid records
 * during snapshot creation. This addresses data quality issues where malformed
 * records (e.g., "As of MM/DD/YYYY" stored as district IDs) corrupt analytics data.
 *
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  DistrictIdValidator,
  RejectionReasons,
  createDistrictIdValidator,
} from '../DistrictIdValidator.js'
import type {
  DistrictStatistics,
  ScrapedRecord,
} from '../../types/districts.js'

// Mock the logger to verify logging behavior
vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('DistrictIdValidator', () => {
  let validator: DistrictIdValidator

  beforeEach(() => {
    validator = new DistrictIdValidator()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  /**
   * Helper to create a minimal DistrictStatistics object for testing
   */
  function createDistrictStats(
    districtId: string,
    asOfDate = '2024-01-15'
  ): DistrictStatistics {
    return {
      districtId,
      asOfDate,
      membership: {
        total: 100,
        change: 5,
        changePercent: 5.0,
        byClub: [],
      },
      clubs: {
        total: 5,
        active: 4,
        suspended: 1,
        ineligible: 0,
        low: 0,
        distinguished: 2,
      },
      education: {
        totalAwards: 10,
        byType: [],
        topClubs: [],
      },
    }
  }

  describe('validate()', () => {
    describe('valid district IDs', () => {
      /**
       * Validates: Requirement 9.3 - alphanumeric characters allowed
       */
      it('accepts numeric district ID "42"', () => {
        const result = validator.validate('42')

        expect(result.isValid).toBe(true)
        expect(result.reason).toBeUndefined()
      })

      it('accepts single letter district ID "F"', () => {
        const result = validator.validate('F')

        expect(result.isValid).toBe(true)
        expect(result.reason).toBeUndefined()
      })

      it('accepts alphanumeric district ID "D42"', () => {
        const result = validator.validate('D42')

        expect(result.isValid).toBe(true)
        expect(result.reason).toBeUndefined()
      })

      it('accepts lowercase alphanumeric district ID "d42"', () => {
        const result = validator.validate('d42')

        expect(result.isValid).toBe(true)
        expect(result.reason).toBeUndefined()
      })

      it('accepts multi-digit district ID "123"', () => {
        const result = validator.validate('123')

        expect(result.isValid).toBe(true)
        expect(result.reason).toBeUndefined()
      })

      it('accepts mixed case alphanumeric "District42"', () => {
        const result = validator.validate('District42')

        expect(result.isValid).toBe(true)
        expect(result.reason).toBeUndefined()
      })
    })

    describe('empty/whitespace rejection', () => {
      /**
       * Validates: Requirement 9.2 - reject empty, null, or whitespace-only
       */
      it('rejects empty string ""', () => {
        const result = validator.validate('')

        expect(result.isValid).toBe(false)
        expect(result.reason).toBe(RejectionReasons.EMPTY)
      })

      it('rejects whitespace-only string "   "', () => {
        const result = validator.validate('   ')

        expect(result.isValid).toBe(false)
        expect(result.reason).toBe(RejectionReasons.WHITESPACE_ONLY)
      })

      it('rejects single space " "', () => {
        const result = validator.validate(' ')

        expect(result.isValid).toBe(false)
        expect(result.reason).toBe(RejectionReasons.WHITESPACE_ONLY)
      })

      it('rejects tab character', () => {
        const result = validator.validate('\t')

        expect(result.isValid).toBe(false)
        expect(result.reason).toBe(RejectionReasons.WHITESPACE_ONLY)
      })

      it('rejects newline character', () => {
        const result = validator.validate('\n')

        expect(result.isValid).toBe(false)
        expect(result.reason).toBe(RejectionReasons.WHITESPACE_ONLY)
      })

      it('rejects mixed whitespace', () => {
        const result = validator.validate(' \t\n ')

        expect(result.isValid).toBe(false)
        expect(result.reason).toBe(RejectionReasons.WHITESPACE_ONLY)
      })
    })

    describe('date pattern rejection', () => {
      /**
       * Validates: Requirement 9.1 - reject date patterns like "As of MM/DD/YYYY"
       */
      it('rejects "As of 01/20/2026"', () => {
        const result = validator.validate('As of 01/20/2026')

        expect(result.isValid).toBe(false)
        expect(result.reason).toBe(RejectionReasons.DATE_PATTERN)
      })

      it('rejects "As of 1/20/2026" (single digit month)', () => {
        const result = validator.validate('As of 1/20/2026')

        expect(result.isValid).toBe(false)
        expect(result.reason).toBe(RejectionReasons.DATE_PATTERN)
      })

      it('rejects "As of 12/31/2024"', () => {
        const result = validator.validate('As of 12/31/2024')

        expect(result.isValid).toBe(false)
        expect(result.reason).toBe(RejectionReasons.DATE_PATTERN)
      })

      it('rejects "As of 1/1/2024" (single digit month and day)', () => {
        const result = validator.validate('As of 1/1/2024')

        expect(result.isValid).toBe(false)
        expect(result.reason).toBe(RejectionReasons.DATE_PATTERN)
      })

      it('rejects case-insensitive "as of 01/20/2026"', () => {
        const result = validator.validate('as of 01/20/2026')

        expect(result.isValid).toBe(false)
        expect(result.reason).toBe(RejectionReasons.DATE_PATTERN)
      })

      it('rejects case-insensitive "AS OF 01/20/2026"', () => {
        const result = validator.validate('AS OF 01/20/2026')

        expect(result.isValid).toBe(false)
        expect(result.reason).toBe(RejectionReasons.DATE_PATTERN)
      })

      it('rejects mixed case "As Of 01/20/2026"', () => {
        const result = validator.validate('As Of 01/20/2026')

        expect(result.isValid).toBe(false)
        expect(result.reason).toBe(RejectionReasons.DATE_PATTERN)
      })
    })

    describe('invalid character rejection', () => {
      /**
       * Validates: Requirement 9.3 - only alphanumeric characters allowed
       */
      it('rejects "district-42" (hyphen)', () => {
        const result = validator.validate('district-42')

        expect(result.isValid).toBe(false)
        expect(result.reason).toBe(RejectionReasons.INVALID_CHARACTERS)
      })

      it('rejects "district_42" (underscore)', () => {
        const result = validator.validate('district_42')

        expect(result.isValid).toBe(false)
        expect(result.reason).toBe(RejectionReasons.INVALID_CHARACTERS)
      })

      it('rejects "district 42" (space in middle)', () => {
        const result = validator.validate('district 42')

        expect(result.isValid).toBe(false)
        expect(result.reason).toBe(RejectionReasons.INVALID_CHARACTERS)
      })

      it('rejects "42!" (exclamation mark)', () => {
        const result = validator.validate('42!')

        expect(result.isValid).toBe(false)
        expect(result.reason).toBe(RejectionReasons.INVALID_CHARACTERS)
      })

      it('rejects "42@district" (at symbol)', () => {
        const result = validator.validate('42@district')

        expect(result.isValid).toBe(false)
        expect(result.reason).toBe(RejectionReasons.INVALID_CHARACTERS)
      })

      it('rejects "42.0" (period)', () => {
        const result = validator.validate('42.0')

        expect(result.isValid).toBe(false)
        expect(result.reason).toBe(RejectionReasons.INVALID_CHARACTERS)
      })

      it('rejects "#42" (hash)', () => {
        const result = validator.validate('#42')

        expect(result.isValid).toBe(false)
        expect(result.reason).toBe(RejectionReasons.INVALID_CHARACTERS)
      })

      it('rejects "42/43" (slash)', () => {
        const result = validator.validate('42/43')

        expect(result.isValid).toBe(false)
        expect(result.reason).toBe(RejectionReasons.INVALID_CHARACTERS)
      })
    })

    describe('edge cases', () => {
      it('accepts single digit "1"', () => {
        const result = validator.validate('1')

        expect(result.isValid).toBe(true)
      })

      it('accepts single character "A"', () => {
        const result = validator.validate('A')

        expect(result.isValid).toBe(true)
      })

      it('accepts long alphanumeric string', () => {
        const result = validator.validate('District42Region1')

        expect(result.isValid).toBe(true)
      })

      it('accepts "0" (zero)', () => {
        const result = validator.validate('0')

        expect(result.isValid).toBe(true)
      })

      it('accepts leading zeros "007"', () => {
        const result = validator.validate('007')

        expect(result.isValid).toBe(true)
      })
    })
  })

  describe('filterValid()', () => {
    /**
     * Validates: Requirements 9.1, 9.2, 9.3, 9.4
     */
    it('returns all districts when all are valid', () => {
      const districts = [
        createDistrictStats('42'),
        createDistrictStats('61'),
        createDistrictStats('F'),
      ]

      const result = validator.filterValid(districts)

      expect(result.valid).toHaveLength(3)
      expect(result.rejected).toHaveLength(0)
    })

    it('filters out invalid districts and keeps valid ones', () => {
      const districts = [
        createDistrictStats('42'),
        createDistrictStats('As of 1/20/2026'),
        createDistrictStats('61'),
      ]

      const result = validator.filterValid(districts)

      expect(result.valid).toHaveLength(2)
      expect(result.valid[0]?.districtId).toBe('42')
      expect(result.valid[1]?.districtId).toBe('61')
      expect(result.rejected).toHaveLength(1)
      expect(result.rejected[0]?.districtId).toBe('As of 1/20/2026')
      expect(result.rejected[0]?.reason).toBe(RejectionReasons.DATE_PATTERN)
    })

    it('handles multiple invalid districts with different reasons', () => {
      const districts = [
        createDistrictStats('42'),
        createDistrictStats('As of 1/20/2026'),
        createDistrictStats(''),
        createDistrictStats('district-42'),
        createDistrictStats('61'),
      ]

      const result = validator.filterValid(districts)

      expect(result.valid).toHaveLength(2)
      expect(result.rejected).toHaveLength(3)

      const rejectedIds = result.rejected.map(r => r.districtId)
      expect(rejectedIds).toContain('As of 1/20/2026')
      expect(rejectedIds).toContain('')
      expect(rejectedIds).toContain('district-42')
    })

    it('returns empty valid array when all districts are invalid', () => {
      const districts = [
        createDistrictStats('As of 1/20/2026'),
        createDistrictStats(''),
        createDistrictStats('   '),
      ]

      const result = validator.filterValid(districts)

      expect(result.valid).toHaveLength(0)
      expect(result.rejected).toHaveLength(3)
    })

    it('handles empty input array', () => {
      const result = validator.filterValid([])

      expect(result.valid).toHaveLength(0)
      expect(result.rejected).toHaveLength(0)
    })

    it('preserves district data in valid results', () => {
      const district = createDistrictStats('42', '2024-03-15')
      district.membership.total = 500

      const result = validator.filterValid([district])

      expect(result.valid).toHaveLength(1)
      expect(result.valid[0]?.membership.total).toBe(500)
      expect(result.valid[0]?.asOfDate).toBe('2024-03-15')
    })

    it('logs warnings for rejected records', async () => {
      const { logger } = await import('../../utils/logger.js')

      const districts = [
        createDistrictStats('42'),
        createDistrictStats('As of 1/20/2026'),
      ]

      validator.filterValid(districts)

      expect(logger.warn).toHaveBeenCalledWith(
        'Rejected invalid district ID during snapshot creation',
        expect.objectContaining({
          districtId: 'As of 1/20/2026',
          reason: RejectionReasons.DATE_PATTERN,
        })
      )
    })

    it('logs summary when records are rejected', async () => {
      const { logger } = await import('../../utils/logger.js')

      const districts = [
        createDistrictStats('42'),
        createDistrictStats('As of 1/20/2026'),
        createDistrictStats(''),
      ]

      validator.filterValid(districts)

      expect(logger.info).toHaveBeenCalledWith(
        'District ID validation summary',
        expect.objectContaining({
          totalRecords: 3,
          validRecords: 1,
          rejectedRecords: 2,
        })
      )
    })

    it('does not log summary when no records are rejected', async () => {
      const { logger } = await import('../../utils/logger.js')

      const districts = [createDistrictStats('42'), createDistrictStats('61')]

      validator.filterValid(districts)

      expect(logger.info).not.toHaveBeenCalled()
    })
  })

  describe('filterValidRecords()', () => {
    /**
     * Helper to create a minimal ScrapedRecord for testing
     */
    function createScrapedRecord(
      districtId: string,
      useUpperCase = true
    ): ScrapedRecord {
      const key = useUpperCase ? 'DISTRICT' : 'District'
      return {
        [key]: districtId,
        REGION: 'Test Region',
        'Paid Clubs': '10',
        'Total Payments': '100',
      }
    }

    /**
     * Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5
     */
    it('returns all records when all have valid district IDs', () => {
      const records = [
        createScrapedRecord('42'),
        createScrapedRecord('61'),
        createScrapedRecord('F'),
      ]

      const result = validator.filterValidRecords(records)

      expect(result.valid).toHaveLength(3)
      expect(result.rejected).toHaveLength(0)
    })

    it('filters out records with invalid district IDs', () => {
      const records = [
        createScrapedRecord('42'),
        createScrapedRecord('As of 1/20/2026'),
        createScrapedRecord('61'),
      ]

      const result = validator.filterValidRecords(records)

      expect(result.valid).toHaveLength(2)
      expect(result.rejected).toHaveLength(1)
      expect(result.rejected[0]?.districtId).toBe('As of 1/20/2026')
      expect(result.rejected[0]?.reason).toBe(RejectionReasons.DATE_PATTERN)
    })

    it('extracts district ID from DISTRICT field (uppercase)', () => {
      const records = [createScrapedRecord('42', true)]

      const result = validator.filterValidRecords(records)

      expect(result.valid).toHaveLength(1)
      expect(result.valid[0]?.['DISTRICT']).toBe('42')
    })

    it('extracts district ID from District field (mixed case)', () => {
      const records = [createScrapedRecord('42', false)]

      const result = validator.filterValidRecords(records)

      expect(result.valid).toHaveLength(1)
      expect(result.valid[0]?.['District']).toBe('42')
    })

    it('handles records with missing district ID field', () => {
      const records: ScrapedRecord[] = [
        { REGION: 'Test Region', 'Paid Clubs': '10' },
      ]

      const result = validator.filterValidRecords(records)

      expect(result.valid).toHaveLength(0)
      expect(result.rejected).toHaveLength(1)
      expect(result.rejected[0]?.districtId).toBe('')
      expect(result.rejected[0]?.reason).toBe(RejectionReasons.EMPTY)
    })

    it('handles multiple invalid records with different reasons', () => {
      const records = [
        createScrapedRecord('42'),
        createScrapedRecord('As of 1/20/2026'),
        createScrapedRecord(''),
        createScrapedRecord('district-42'),
        createScrapedRecord('61'),
      ]

      const result = validator.filterValidRecords(records)

      expect(result.valid).toHaveLength(2)
      expect(result.rejected).toHaveLength(3)

      const rejectedIds = result.rejected.map(r => r.districtId)
      expect(rejectedIds).toContain('As of 1/20/2026')
      expect(rejectedIds).toContain('')
      expect(rejectedIds).toContain('district-42')
    })

    it('returns empty valid array when all records are invalid', () => {
      const records = [
        createScrapedRecord('As of 1/20/2026'),
        createScrapedRecord(''),
        createScrapedRecord('   '),
      ]

      const result = validator.filterValidRecords(records)

      expect(result.valid).toHaveLength(0)
      expect(result.rejected).toHaveLength(3)
    })

    it('handles empty input array', () => {
      const result = validator.filterValidRecords([])

      expect(result.valid).toHaveLength(0)
      expect(result.rejected).toHaveLength(0)
    })

    it('preserves all record data in valid results', () => {
      const record: ScrapedRecord = {
        DISTRICT: '42',
        REGION: 'Test Region',
        'Paid Clubs': '15',
        'Total Payments': '200',
        'Custom Field': 'custom value',
      }

      const result = validator.filterValidRecords([record])

      expect(result.valid).toHaveLength(1)
      expect(result.valid[0]?.['REGION']).toBe('Test Region')
      expect(result.valid[0]?.['Paid Clubs']).toBe('15')
      expect(result.valid[0]?.['Custom Field']).toBe('custom value')
    })

    it('logs warnings for rejected records', async () => {
      const { logger } = await import('../../utils/logger.js')

      const records = [
        createScrapedRecord('42'),
        createScrapedRecord('As of 1/20/2026'),
      ]

      validator.filterValidRecords(records)

      expect(logger.warn).toHaveBeenCalledWith(
        'Rejected invalid district ID during snapshot creation',
        expect.objectContaining({
          districtId: 'As of 1/20/2026',
          reason: RejectionReasons.DATE_PATTERN,
        })
      )
    })

    it('logs summary when records are rejected', async () => {
      const { logger } = await import('../../utils/logger.js')

      const records = [
        createScrapedRecord('42'),
        createScrapedRecord('As of 1/20/2026'),
        createScrapedRecord(''),
      ]

      validator.filterValidRecords(records)

      expect(logger.info).toHaveBeenCalledWith(
        'District ID validation summary for scraped records',
        expect.objectContaining({
          totalRecords: 3,
          validRecords: 1,
          rejectedRecords: 2,
        })
      )
    })

    it('does not log summary when no records are rejected', async () => {
      const { logger } = await import('../../utils/logger.js')
      vi.clearAllMocks()

      const records = [createScrapedRecord('42'), createScrapedRecord('61')]

      validator.filterValidRecords(records)

      // Should not have called info with the summary message
      const infoCalls = vi.mocked(logger.info).mock.calls
      const summaryCall = infoCalls.find(
        call => call[0] === 'District ID validation summary for scraped records'
      )
      expect(summaryCall).toBeUndefined()
    })
  })

  describe('createDistrictIdValidator factory', () => {
    it('creates a valid DistrictIdValidator instance', () => {
      const instance = createDistrictIdValidator()

      expect(instance).toBeInstanceOf(DistrictIdValidator)
      expect(instance.validate('42').isValid).toBe(true)
    })
  })

  describe('RejectionReasons constants', () => {
    it('has all expected rejection reasons', () => {
      expect(RejectionReasons.EMPTY).toBe('District ID is empty or null')
      expect(RejectionReasons.WHITESPACE_ONLY).toBe(
        'District ID contains only whitespace'
      )
      expect(RejectionReasons.DATE_PATTERN).toBe(
        'District ID matches date pattern (e.g., "As of MM/DD/YYYY")'
      )
      expect(RejectionReasons.INVALID_CHARACTERS).toBe(
        'District ID contains invalid characters (only alphanumeric allowed)'
      )
    })
  })
})
