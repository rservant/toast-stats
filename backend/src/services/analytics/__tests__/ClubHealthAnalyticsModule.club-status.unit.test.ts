/**
 * Unit Tests for Club Status Parsing
 *
 * Feature: club-status-field
 * Task: 1.4 Write unit tests for club status parsing
 *
 * Validates: Requirements 1.2, 1.3, 1.4
 *
 * This test verifies that the club status extraction from CSV records
 * correctly handles various input scenarios including valid values,
 * missing/empty/null values, and whitespace trimming.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import { ClubHealthAnalyticsModule } from '../ClubHealthAnalyticsModule.js'
import type { IAnalyticsDataSource } from '../../../types/serviceInterfaces.js'
import type { ScrapedRecord } from '../../../types/districts.js'
import type { DistrictCacheEntry } from '../../../types/districts.js'

describe('ClubHealthAnalyticsModule - Club Status Parsing Unit Tests', () => {
  let testCacheDir: string
  let clubHealthModule: ClubHealthAnalyticsModule

  beforeEach(async () => {
    // Create a unique test cache directory
    testCacheDir = path.join(
      process.cwd(),
      'test-cache',
      `club-status-unit-${Date.now()}-${Math.random().toString(36).substring(7)}`
    )
    await fs.mkdir(testCacheDir, { recursive: true })

    // Create a minimal mock data source for the module
    const mockDataSource: IAnalyticsDataSource = {
      async getDistrictData() {
        return null
      },
      async getSnapshotsInRange() {
        return []
      },
      async getLatestSnapshot() {
        return null
      },
      async getSnapshotMetadata() {
        return null
      },
      async getAllDistrictsRankings() {
        return null
      },
    }

    clubHealthModule = new ClubHealthAnalyticsModule(mockDataSource)
  })

  afterEach(async () => {
    // Clean up test cache directory
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  /**
   * Helper function to create a minimal DistrictCacheEntry with a single club
   * for testing club status extraction through analyzeClubTrends
   */
  function createDistrictCacheEntry(
    clubRecord: ScrapedRecord
  ): DistrictCacheEntry {
    return {
      districtId: 'test-district',
      date: '2026-01-15',
      districtPerformance: [],
      divisionPerformance: [],
      clubPerformance: [clubRecord],
      fetchedAt: '2026-01-15T00:00:00Z',
    }
  }

  /**
   * Helper function to create a basic club record with required fields
   */
  function createClubRecord(
    clubStatusValue?: string | null | undefined,
    useStatusField: boolean = false
  ): ScrapedRecord {
    const record: ScrapedRecord = {
      'Club Number': '1234',
      'Club Name': 'Test Club',
      Division: 'A',
      Area: '1',
      'Active Members': '20',
      'Goals Met': '5',
      'Mem. Base': '15',
    }

    // Add the club status field based on the test scenario
    if (useStatusField) {
      // Use "Status" field instead of "Club Status"
      if (clubStatusValue !== undefined) {
        record['Status'] = clubStatusValue
      }
    } else {
      // Use "Club Status" field
      if (clubStatusValue !== undefined) {
        record['Club Status'] = clubStatusValue
      }
    }

    return record
  }

  /**
   * Helper function to extract club status from a club record via analyzeClubTrends
   */
  async function extractClubStatusViaAnalyze(
    clubRecord: ScrapedRecord
  ): Promise<string | undefined> {
    const entry = createDistrictCacheEntry(clubRecord)
    const trends = await clubHealthModule.analyzeClubTrends('test-district', [
      entry,
    ])
    return trends[0]?.clubStatus
  }

  describe('Valid Status Values', () => {
    /**
     * Test: Valid "Active" status is preserved
     * Validates: Requirement 1.4 - System SHALL preserve the exact string value from the CSV
     */
    it('should preserve "Active" status value', async () => {
      const clubRecord = createClubRecord('Active')
      const clubStatus = await extractClubStatusViaAnalyze(clubRecord)
      expect(clubStatus).toBe('Active')
    })

    /**
     * Test: Valid "Suspended" status is preserved
     * Validates: Requirement 1.4 - System SHALL preserve the exact string value from the CSV
     */
    it('should preserve "Suspended" status value', async () => {
      const clubRecord = createClubRecord('Suspended')
      const clubStatus = await extractClubStatusViaAnalyze(clubRecord)
      expect(clubStatus).toBe('Suspended')
    })

    /**
     * Test: Valid "Ineligible" status is preserved
     * Validates: Requirement 1.4 - System SHALL preserve the exact string value from the CSV
     */
    it('should preserve "Ineligible" status value', async () => {
      const clubRecord = createClubRecord('Ineligible')
      const clubStatus = await extractClubStatusViaAnalyze(clubRecord)
      expect(clubStatus).toBe('Ineligible')
    })

    /**
     * Test: Valid "Low" status is preserved
     * Validates: Requirement 1.4 - System SHALL preserve the exact string value from the CSV
     */
    it('should preserve "Low" status value', async () => {
      const clubRecord = createClubRecord('Low')
      const clubStatus = await extractClubStatusViaAnalyze(clubRecord)
      expect(clubStatus).toBe('Low')
    })

    /**
     * Test: Fallback to "Status" field when "Club Status" is not present
     * Validates: Requirement 1.2 - System SHALL read the "Club Status" field value
     */
    it('should read from "Status" field when "Club Status" is not present', async () => {
      const clubRecord = createClubRecord('Active', true) // Use "Status" field
      const clubStatus = await extractClubStatusViaAnalyze(clubRecord)
      expect(clubStatus).toBe('Active')
    })
  })

  describe('Missing/Empty/Null Values', () => {
    /**
     * Test: Empty string returns undefined
     * Validates: Requirement 1.3 - IF the "Club Status" field is missing or empty, THEN THE System SHALL treat the value as undefined
     */
    it('should return undefined for empty string', async () => {
      const clubRecord = createClubRecord('')
      const clubStatus = await extractClubStatusViaAnalyze(clubRecord)
      expect(clubStatus).toBeUndefined()
    })

    /**
     * Test: Null value returns undefined
     * Validates: Requirement 1.3 - IF the "Club Status" field is missing or empty, THEN THE System SHALL treat the value as undefined
     */
    it('should return undefined for null value', async () => {
      const clubRecord = createClubRecord(null)
      const clubStatus = await extractClubStatusViaAnalyze(clubRecord)
      expect(clubStatus).toBeUndefined()
    })

    /**
     * Test: Missing field returns undefined
     * Validates: Requirement 1.3 - IF the "Club Status" field is missing or empty, THEN THE System SHALL treat the value as undefined
     */
    it('should return undefined for missing field', async () => {
      // Create a record without the Club Status field
      const clubRecord: ScrapedRecord = {
        'Club Number': '1234',
        'Club Name': 'Test Club',
        Division: 'A',
        Area: '1',
        'Active Members': '20',
        'Goals Met': '5',
        'Mem. Base': '15',
        // No "Club Status" or "Status" field
      }
      const clubStatus = await extractClubStatusViaAnalyze(clubRecord)
      expect(clubStatus).toBeUndefined()
    })

    /**
     * Test: Undefined value returns undefined
     * Validates: Requirement 1.3 - IF the "Club Status" field is missing or empty, THEN THE System SHALL treat the value as undefined
     */
    it('should return undefined for undefined value', async () => {
      const clubRecord = createClubRecord(undefined)
      const clubStatus = await extractClubStatusViaAnalyze(clubRecord)
      expect(clubStatus).toBeUndefined()
    })
  })

  describe('Whitespace Trimming', () => {
    /**
     * Test: Leading whitespace is trimmed
     * Validates: Requirement 1.4 - System SHALL preserve the exact string value from the CSV (after trimming)
     */
    it('should trim leading whitespace from status value', async () => {
      const clubRecord = createClubRecord('  Active')
      const clubStatus = await extractClubStatusViaAnalyze(clubRecord)
      expect(clubStatus).toBe('Active')
    })

    /**
     * Test: Trailing whitespace is trimmed
     * Validates: Requirement 1.4 - System SHALL preserve the exact string value from the CSV (after trimming)
     */
    it('should trim trailing whitespace from status value', async () => {
      const clubRecord = createClubRecord('Active  ')
      const clubStatus = await extractClubStatusViaAnalyze(clubRecord)
      expect(clubStatus).toBe('Active')
    })

    /**
     * Test: Both leading and trailing whitespace is trimmed
     * Validates: Requirement 1.4 - System SHALL preserve the exact string value from the CSV (after trimming)
     */
    it('should trim both leading and trailing whitespace', async () => {
      const clubRecord = createClubRecord('  Suspended  ')
      const clubStatus = await extractClubStatusViaAnalyze(clubRecord)
      expect(clubStatus).toBe('Suspended')
    })

    /**
     * Test: Whitespace-only string returns undefined
     * Validates: Requirement 1.3 - IF the "Club Status" field is missing or empty, THEN THE System SHALL treat the value as undefined
     */
    it('should return undefined for whitespace-only string', async () => {
      const clubRecord = createClubRecord('   ')
      const clubStatus = await extractClubStatusViaAnalyze(clubRecord)
      // After trimming, whitespace-only becomes empty string, which should be undefined
      expect(clubStatus).toBeUndefined()
    })

    /**
     * Test: Tab characters are trimmed
     * Validates: Requirement 1.4 - System SHALL preserve the exact string value from the CSV (after trimming)
     */
    it('should trim tab characters from status value', async () => {
      const clubRecord = createClubRecord('\tActive\t')
      const clubStatus = await extractClubStatusViaAnalyze(clubRecord)
      expect(clubStatus).toBe('Active')
    })

    /**
     * Test: Newline characters are trimmed
     * Validates: Requirement 1.4 - System SHALL preserve the exact string value from the CSV (after trimming)
     */
    it('should trim newline characters from status value', async () => {
      const clubRecord = createClubRecord('\nActive\n')
      const clubStatus = await extractClubStatusViaAnalyze(clubRecord)
      expect(clubStatus).toBe('Active')
    })
  })

  describe('Unexpected Values', () => {
    /**
     * Test: Unknown status values are preserved as-is
     * Validates: Requirement 1.4 - System SHALL preserve the exact string value from the CSV
     * Note: The design specifies no validation - unexpected values are preserved
     */
    it('should preserve unknown status values as-is', async () => {
      const clubRecord = createClubRecord('Unknown')
      const clubStatus = await extractClubStatusViaAnalyze(clubRecord)
      expect(clubStatus).toBe('Unknown')
    })

    /**
     * Test: Numeric values are converted to string and preserved
     * Validates: Requirement 1.4 - System SHALL preserve the exact string value from the CSV
     */
    it('should convert numeric values to string', async () => {
      // Create a record with a numeric value (simulating CSV parsing edge case)
      const clubRecord: ScrapedRecord = {
        'Club Number': '1234',
        'Club Name': 'Test Club',
        Division: 'A',
        Area: '1',
        'Active Members': '20',
        'Goals Met': '5',
        'Mem. Base': '15',
        'Club Status': 123 as unknown as string, // Simulate numeric value
      }
      const clubStatus = await extractClubStatusViaAnalyze(clubRecord)
      expect(clubStatus).toBe('123')
    })

    /**
     * Test: Case is preserved (not normalized)
     * Validates: Requirement 1.4 - System SHALL preserve the exact string value from the CSV
     */
    it('should preserve case of status value', async () => {
      const clubRecord = createClubRecord('ACTIVE')
      const clubStatus = await extractClubStatusViaAnalyze(clubRecord)
      expect(clubStatus).toBe('ACTIVE')
    })

    /**
     * Test: Mixed case is preserved
     * Validates: Requirement 1.4 - System SHALL preserve the exact string value from the CSV
     */
    it('should preserve mixed case of status value', async () => {
      const clubRecord = createClubRecord('AcTiVe')
      const clubStatus = await extractClubStatusViaAnalyze(clubRecord)
      expect(clubStatus).toBe('AcTiVe')
    })
  })
})
