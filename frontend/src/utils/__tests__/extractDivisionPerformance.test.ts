/**
 * Unit Tests for Division and Area Performance Data Extraction
 *
 * These tests verify specific examples and edge cases for data extraction
 * functions that transform district snapshot JSON into typed performance data.
 *
 * Requirements: 1.4, 7.1, 7.2, 7.5
 */

import { describe, it, expect, vi } from 'vitest'
import {
  extractVisitData,
  extractDivisionPerformance,
} from '../extractDivisionPerformance.js'

describe('extractVisitData', () => {
  /**
   * Test missing "Nov Visit award" field
   * Requirements: 7.5
   */
  it('should handle missing "Nov Visit award" field', () => {
    // Arrange: Area data without Nov Visit award
    const areaData = {
      'May visit award': '4',
      Area: 'A1',
    }
    const clubBase = 4

    // Act: Extract visit data
    const result = extractVisitData(areaData, clubBase)

    // Assert: First round should default to zero visits
    expect(result.firstRound.completed).toBe(0)
    expect(result.firstRound.required).toBe(3) // 75% of 4 = 3
    expect(result.firstRound.percentage).toBe(0)
    expect(result.firstRound.meetsThreshold).toBe(false)

    // Second round should be extracted correctly
    expect(result.secondRound.completed).toBe(4)
    expect(result.secondRound.meetsThreshold).toBe(true)
  })

  /**
   * Test missing "May visit award" field
   * Requirements: 7.5
   */
  it('should handle missing "May visit award" field', () => {
    // Arrange: Area data without May Visit award
    const areaData = {
      'Nov Visit award': '3',
      Area: 'A1',
    }
    const clubBase = 4

    // Act: Extract visit data
    const result = extractVisitData(areaData, clubBase)

    // Assert: First round should be extracted correctly
    expect(result.firstRound.completed).toBe(3)
    expect(result.firstRound.meetsThreshold).toBe(true)

    // Second round should default to zero visits
    expect(result.secondRound.completed).toBe(0)
    expect(result.secondRound.required).toBe(3) // 75% of 4 = 3
    expect(result.secondRound.percentage).toBe(0)
    expect(result.secondRound.meetsThreshold).toBe(false)
  })

  /**
   * Test missing both visit fields
   * Requirements: 7.5
   */
  it('should handle missing both visit award fields', () => {
    // Arrange: Area data without any visit awards
    const areaData = {
      Area: 'A1',
      Division: 'A',
    }
    const clubBase = 5

    // Act: Extract visit data
    const result = extractVisitData(areaData, clubBase)

    // Assert: Both rounds should default to zero visits
    expect(result.firstRound.completed).toBe(0)
    expect(result.firstRound.required).toBe(4) // 75% of 5 = 3.75, rounded up to 4
    expect(result.firstRound.meetsThreshold).toBe(false)

    expect(result.secondRound.completed).toBe(0)
    expect(result.secondRound.required).toBe(4)
    expect(result.secondRound.meetsThreshold).toBe(false)
  })

  /**
   * Test null area data
   * Requirements: 7.5
   */
  it('should handle null area data', () => {
    // Arrange: Null area data
    const areaData = null
    const clubBase = 4

    // Act: Extract visit data
    const result = extractVisitData(areaData, clubBase)

    // Assert: Both rounds should default to zero visits
    expect(result.firstRound.completed).toBe(0)
    expect(result.secondRound.completed).toBe(0)
  })

  /**
   * Test undefined area data
   * Requirements: 7.5
   */
  it('should handle undefined area data', () => {
    // Arrange: Undefined area data
    const areaData = undefined
    const clubBase = 4

    // Act: Extract visit data
    const result = extractVisitData(areaData, clubBase)

    // Assert: Both rounds should default to zero visits
    expect(result.firstRound.completed).toBe(0)
    expect(result.secondRound.completed).toBe(0)
  })

  /**
   * Test empty object area data
   * Requirements: 7.5
   */
  it('should handle empty object area data', () => {
    // Arrange: Empty object
    const areaData = {}
    const clubBase = 4

    // Act: Extract visit data
    const result = extractVisitData(areaData, clubBase)

    // Assert: Both rounds should default to zero visits
    expect(result.firstRound.completed).toBe(0)
    expect(result.secondRound.completed).toBe(0)
  })

  /**
   * Test invalid visit values (non-numeric strings)
   * Requirements: 7.5
   */
  it('should handle invalid visit values', () => {
    // Arrange: Area data with invalid visit values
    const areaData = {
      'Nov Visit award': 'invalid',
      'May visit award': 'not-a-number',
    }
    const clubBase = 4

    // Act: Extract visit data
    const result = extractVisitData(areaData, clubBase)

    // Assert: Invalid values should be treated as zero
    expect(result.firstRound.completed).toBe(0)
    expect(result.secondRound.completed).toBe(0)
  })

  /**
   * Test valid visit data extraction
   * Requirements: 7.1, 7.2
   */
  it('should extract valid visit data correctly', () => {
    // Arrange: Area data with valid visit awards
    const areaData = {
      'Nov Visit award': '3',
      'May visit award': '4',
    }
    const clubBase = 4

    // Act: Extract visit data
    const result = extractVisitData(areaData, clubBase)

    // Assert: Both rounds should be extracted correctly
    expect(result.firstRound.completed).toBe(3)
    expect(result.firstRound.required).toBe(3) // 75% of 4 = 3
    expect(result.firstRound.percentage).toBe(75)
    expect(result.firstRound.meetsThreshold).toBe(true)

    expect(result.secondRound.completed).toBe(4)
    expect(result.secondRound.required).toBe(3)
    expect(result.secondRound.percentage).toBe(100)
    expect(result.secondRound.meetsThreshold).toBe(true)
  })

  /**
   * Test numeric visit values (not strings)
   * Requirements: 7.1, 7.2
   */
  it('should handle numeric visit values', () => {
    // Arrange: Area data with numeric visit values
    const areaData = {
      'Nov Visit award': 3,
      'May visit award': 4,
    }
    const clubBase = 4

    // Act: Extract visit data
    const result = extractVisitData(areaData, clubBase)

    // Assert: Numeric values should be handled correctly
    expect(result.firstRound.completed).toBe(3)
    expect(result.secondRound.completed).toBe(4)
  })
})

describe('extractDivisionPerformance', () => {
  /**
   * Test with empty divisions
   * Requirements: 1.4
   */
  it('should handle empty divisions array', () => {
    // Arrange: Snapshot with empty division performance
    const snapshot = {
      divisionPerformance: [],
      clubPerformance: [],
    }

    // Act: Extract division performance
    const result = extractDivisionPerformance(snapshot)

    // Assert: Should return empty array
    expect(result).toEqual([])
  })

  /**
   * Test with missing division performance
   * Requirements: 1.4
   */
  it('should handle missing divisionPerformance field', () => {
    // Arrange: Snapshot without divisionPerformance
    const snapshot = {
      clubPerformance: [],
    }

    // Act: Extract division performance
    const result = extractDivisionPerformance(snapshot)

    // Assert: Should return empty array
    expect(result).toEqual([])
  })

  /**
   * Test with null snapshot
   * Requirements: 1.4
   */
  it('should handle null snapshot', () => {
    // Arrange: Null snapshot
    const snapshot = null

    // Act: Extract division performance
    const result = extractDivisionPerformance(snapshot)

    // Assert: Should return empty array
    expect(result).toEqual([])
  })

  /**
   * Test with undefined snapshot
   * Requirements: 1.4
   */
  it('should handle undefined snapshot', () => {
    // Arrange: Undefined snapshot
    const snapshot = undefined

    // Act: Extract division performance
    const result = extractDivisionPerformance(snapshot)

    // Assert: Should return empty array
    expect(result).toEqual([])
  })

  /**
   * Test with missing area data
   * Requirements: 1.4
   */
  it('should handle missing area data', () => {
    // Arrange: Snapshot with division but no club performance
    const snapshot = {
      divisionPerformance: [
        {
          Division: 'A',
          'Club Base': '10',
          'Paid Clubs': '12',
          'Distinguished Clubs': '6',
        },
      ],
      clubPerformance: [],
    }

    // Act: Extract division performance
    const result = extractDivisionPerformance(snapshot)

    // Assert: Should return division with empty areas array
    expect(result).toHaveLength(1)
    expect(result[0].divisionId).toBe('A')
    expect(result[0].areas).toEqual([])
  })

  /**
   * Test with invalid numeric values
   * Requirements: 1.4
   */
  it('should handle invalid numeric values', () => {
    // Arrange: Snapshot with invalid numeric values
    const snapshot = {
      divisionPerformance: [
        {
          Division: 'A',
          'Club Base': 'invalid',
          'Paid Clubs': 'not-a-number',
          'Distinguished Clubs': '',
        },
      ],
      clubPerformance: [],
    }

    // Act: Extract division performance
    const result = extractDivisionPerformance(snapshot)

    // Assert: Invalid values should be treated as zero
    expect(result).toHaveLength(1)
    expect(result[0].clubBase).toBe(0)
    expect(result[0].paidClubs).toBe(0)
    expect(result[0].distinguishedClubs).toBe(0)
  })

  /**
   * Test division sorting by identifier
   * Requirements: 1.3
   */
  it('should sort divisions by identifier', () => {
    // Arrange: Snapshot with divisions in non-alphabetical order
    const snapshot = {
      divisionPerformance: [
        {
          Division: 'C',
          'Club Base': '10',
          'Paid Clubs': '10',
          'Distinguished Clubs': '5',
        },
        {
          Division: 'A',
          'Club Base': '10',
          'Paid Clubs': '10',
          'Distinguished Clubs': '5',
        },
        {
          Division: 'B',
          'Club Base': '10',
          'Paid Clubs': '10',
          'Distinguished Clubs': '5',
        },
      ],
      clubPerformance: [],
    }

    // Act: Extract division performance
    const result = extractDivisionPerformance(snapshot)

    // Assert: Divisions should be sorted alphabetically
    expect(result).toHaveLength(3)
    expect(result[0].divisionId).toBe('A')
    expect(result[1].divisionId).toBe('B')
    expect(result[2].divisionId).toBe('C')
  })

  /**
   * Test area sorting by identifier
   * Requirements: 6.8
   */
  it('should sort areas by identifier within each division', () => {
    // Arrange: Snapshot with areas in non-alphabetical order
    const snapshot = {
      divisionPerformance: [
        {
          Division: 'A',
          'Club Base': '12',
          'Paid Clubs': '12',
          'Distinguished Clubs': '6',
        },
      ],
      clubPerformance: [
        {
          Division: 'A',
          Area: '03',
          Status: 'Active',
          'Club Distinguished Status': 'Distinguished',
        },
        {
          Division: 'A',
          Area: '01',
          Status: 'Active',
          'Club Distinguished Status': 'Distinguished',
        },
        {
          Division: 'A',
          Area: '02',
          Status: 'Active',
          'Club Distinguished Status': 'Distinguished',
        },
      ],
    }

    // Act: Extract division performance
    const result = extractDivisionPerformance(snapshot)

    // Assert: Areas should be sorted alphabetically
    expect(result).toHaveLength(1)
    expect(result[0].areas).toHaveLength(3)
    expect(result[0].areas[0].areaId).toBe('01')
    expect(result[0].areas[1].areaId).toBe('02')
    expect(result[0].areas[2].areaId).toBe('03')
  })

  /**
   * Test duplicate division handling
   * Requirements: 11.1, 11.2, 11.3
   */
  it('should deduplicate divisions and retain first occurrence', () => {
    // Arrange: Snapshot with duplicate division entries
    const snapshot = {
      divisionPerformance: [
        {
          Division: 'A',
          'Club Base': '10',
          'Paid Clubs': '12',
          'Distinguished Clubs': '6',
        },
        {
          Division: 'B',
          'Club Base': '8',
          'Paid Clubs': '8',
          'Distinguished Clubs': '4',
        },
        {
          Division: 'A', // Duplicate
          'Club Base': '15',
          'Paid Clubs': '15',
          'Distinguished Clubs': '8',
        },
      ],
      clubPerformance: [],
    }

    // Spy on console.warn to verify warning is logged
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Act: Extract division performance
    const result = extractDivisionPerformance(snapshot)

    // Assert: Should only have 2 divisions (A and B)
    expect(result).toHaveLength(2)
    expect(result[0].divisionId).toBe('A')
    expect(result[1].divisionId).toBe('B')

    // Assert: First occurrence of Division A should be retained
    expect(result[0].clubBase).toBe(10)
    expect(result[0].paidClubs).toBe(12)
    expect(result[0].distinguishedClubs).toBe(6)

    // Assert: Warning should be logged for duplicate
    expect(warnSpy).toHaveBeenCalledWith(
      'Duplicate division detected: "A". Skipping duplicate entry.'
    )

    // Cleanup
    warnSpy.mockRestore()
  })

  /**
   * Test multiple duplicate divisions
   * Requirements: 11.1, 11.2, 11.3
   */
  it('should handle multiple duplicate divisions', () => {
    // Arrange: Snapshot with multiple duplicates
    const snapshot = {
      divisionPerformance: [
        {
          Division: 'A',
          'Club Base': '10',
          'Paid Clubs': '10',
          'Distinguished Clubs': '5',
        },
        {
          Division: 'A', // Duplicate 1
          'Club Base': '12',
          'Paid Clubs': '12',
          'Distinguished Clubs': '6',
        },
        {
          Division: 'B',
          'Club Base': '8',
          'Paid Clubs': '8',
          'Distinguished Clubs': '4',
        },
        {
          Division: 'A', // Duplicate 2
          'Club Base': '15',
          'Paid Clubs': '15',
          'Distinguished Clubs': '8',
        },
      ],
      clubPerformance: [],
    }

    // Spy on console.warn
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Act: Extract division performance
    const result = extractDivisionPerformance(snapshot)

    // Assert: Should only have 2 unique divisions
    expect(result).toHaveLength(2)
    expect(result[0].divisionId).toBe('A')
    expect(result[1].divisionId).toBe('B')

    // Assert: First occurrence values should be retained
    expect(result[0].clubBase).toBe(10)

    // Assert: Warning should be logged twice for Division A
    expect(warnSpy).toHaveBeenCalledTimes(2)

    // Cleanup
    warnSpy.mockRestore()
  })
})

