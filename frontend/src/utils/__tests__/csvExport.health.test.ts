import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { exportClubPerformance } from '../csvExport'

/**
 * Tests for CSV export functionality with health data integration
 * **Feature: club-health-table-integration, Property 10: Export Data Integrity**
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6**
 */

// Mock the download functionality to capture CSV content
let capturedCsvContent = ''
let capturedFilename = ''

// Mock DOM methods for CSV download
const mockCreateElement = vi.fn()
const mockCreateObjectURL = vi.fn()
const mockRevokeObjectURL = vi.fn()
const mockAppendChild = vi.fn()
const mockRemoveChild = vi.fn()
const mockClick = vi.fn()

beforeEach(() => {
  // Reset captured content
  capturedCsvContent = ''
  capturedFilename = ''

  // Mock document.createElement
  mockCreateElement.mockReturnValue({
    setAttribute: vi.fn((attr, value) => {
      if (attr === 'download') {
        capturedFilename = value
      }
    }),
    click: mockClick,
    style: {},
  })

  // Mock URL methods
  mockCreateObjectURL.mockReturnValue('mock-url')

  // Setup DOM mocks
  Object.defineProperty(document, 'createElement', {
    value: mockCreateElement,
    writable: true,
  })

  Object.defineProperty(document.body, 'appendChild', {
    value: mockAppendChild,
    writable: true,
  })

  Object.defineProperty(document.body, 'removeChild', {
    value: mockRemoveChild,
    writable: true,
  })

  Object.defineProperty(window, 'URL', {
    value: {
      createObjectURL: mockCreateObjectURL,
      revokeObjectURL: mockRevokeObjectURL,
    },
    writable: true,
  })

  // Mock Blob constructor to capture content
  global.Blob = class MockBlob {
    constructor(content: string[]) {
      capturedCsvContent = content[0]
      return this
    }
  } as unknown as typeof Blob
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('CSV Export with Health Data', () => {
  const mockClubsWithHealthData = [
    {
      clubId: 'club-1',
      clubName: 'Alpha Toastmasters',
      divisionName: 'Division A',
      areaName: 'Area 1',
      membershipTrend: [{ date: '2024-01-01', count: 25 }],
      dcpGoalsTrend: [{ date: '2024-01-01', goalsAchieved: 8 }],
      currentStatus: 'healthy',
      distinguishedLevel: 'Distinguished',
      riskFactors: [],
      // Health data
      healthStatus: 'Thriving',
      trajectory: 'Recovering',
      healthReasons: ['Strong membership', 'Meeting DCP goals'],
      trajectoryReasons: ['Increasing membership', 'Improving goal completion'],
      healthDataAge: 2.5,
      healthDataTimestamp: '2024-01-15T10:00:00Z',
    },
    {
      clubId: 'club-2',
      clubName: 'Beta Speakers',
      divisionName: 'Division B',
      areaName: 'Area 2',
      membershipTrend: [{ date: '2024-01-01', count: 15 }],
      dcpGoalsTrend: [{ date: '2024-01-01', goalsAchieved: 3 }],
      currentStatus: 'at-risk',
      distinguishedLevel: undefined,
      riskFactors: ['low-membership'],
      // Missing health data
      healthStatus: undefined,
      trajectory: undefined,
      healthReasons: undefined,
      trajectoryReasons: undefined,
      healthDataAge: undefined,
      healthDataTimestamp: undefined,
    },
    {
      clubId: 'club-3',
      clubName: 'Gamma Club',
      divisionName: 'Division C',
      areaName: 'Area 3',
      membershipTrend: [{ date: '2024-01-01', count: 12 }],
      dcpGoalsTrend: [{ date: '2024-01-01', goalsAchieved: 2 }],
      currentStatus: 'critical',
      distinguishedLevel: 'Select',
      riskFactors: ['low-membership', 'low-goals'],
      // Partial health data
      healthStatus: 'Intervention Required',
      trajectory: 'Declining',
      healthReasons: ['Low membership', 'Missing DCP goals'],
      trajectoryReasons: ['Declining membership trend'],
      healthDataAge: 48.2,
      healthDataTimestamp: '2024-01-13T14:30:00Z',
    },
  ]

  it('should include health status and trajectory columns in CSV export', () => {
    /**
     * **Validates: Requirements 7.1**
     * Tests that health status and trajectory columns are included in CSV export
     */

    exportClubPerformance(mockClubsWithHealthData, 'D123')

    // Verify health data is included in the CSV content
    expect(capturedCsvContent).toContain('Health Status')
    expect(capturedCsvContent).toContain('Trajectory')
    expect(capturedCsvContent).toContain('Health Classification Reasons')
    expect(capturedCsvContent).toContain('Trajectory Reasons')
    expect(capturedCsvContent).toContain('Health Data Age (hours)')
    expect(capturedCsvContent).toContain('Health Data Timestamp')
  })

  it('should export health data with human-readable labels', () => {
    /**
     * **Validates: Requirements 7.5**
     * Tests that exported health data uses human-readable labels
     */

    exportClubPerformance(mockClubsWithHealthData, 'D123')

    // Should contain human-readable health status values
    expect(capturedCsvContent).toContain('Thriving')
    expect(capturedCsvContent).toContain('Intervention Required')

    // Should contain human-readable trajectory values
    expect(capturedCsvContent).toContain('Recovering')
    expect(capturedCsvContent).toContain('Declining')

    // Should not contain internal codes or IDs
    expect(capturedCsvContent).not.toContain('THRIVING')
    expect(capturedCsvContent).not.toContain('INTERVENTION_REQUIRED')
    expect(capturedCsvContent).not.toContain('health_status_1')
    expect(capturedCsvContent).not.toContain('trajectory_2')
  })

  it('should handle missing health data with "Unknown" labels', () => {
    /**
     * **Validates: Requirements 7.4**
     * Tests that missing health data is clearly indicated with "Unknown" or "Not Available"
     */

    exportClubPerformance(mockClubsWithHealthData, 'D123')

    // Should contain "Unknown" for missing health status and trajectory
    expect(capturedCsvContent).toContain('Unknown')

    // Should contain "N/A" for missing reasons and timestamps
    expect(capturedCsvContent).toContain('N/A')

    // Verify specific club with missing data
    const lines = capturedCsvContent.split('\n')
    const betaSpeakersLine = lines.find((line: string) =>
      line.includes('Beta Speakers')
    )
    expect(betaSpeakersLine).toBeDefined()
    expect(betaSpeakersLine).toContain('Unknown') // Health status
    expect(betaSpeakersLine).toContain('Unknown') // Trajectory
    expect(betaSpeakersLine).toContain('N/A') // Health reasons
    expect(betaSpeakersLine).toContain('N/A') // Trajectory reasons
    expect(betaSpeakersLine).toContain('N/A') // Health data age
    expect(betaSpeakersLine).toContain('N/A') // Health data timestamp
  })

  it('should include health classification timestamps for data freshness tracking', () => {
    /**
     * **Validates: Requirements 7.3**
     * Tests that health classification timestamps are included for data freshness tracking
     */

    exportClubPerformance(mockClubsWithHealthData, 'D123')

    // Should include timestamp column header
    expect(capturedCsvContent).toContain('Health Data Timestamp')

    // Should include actual timestamps
    expect(capturedCsvContent).toContain('2024-01-15T10:00:00Z')
    expect(capturedCsvContent).toContain('2024-01-13T14:30:00Z')

    // Should include data age column header
    expect(capturedCsvContent).toContain('Health Data Age (hours)')

    // Should include actual data ages
    expect(capturedCsvContent).toContain('2.5') // Alpha Toastmasters
    expect(capturedCsvContent).toContain('48.2') // Gamma Club
  })

  it('should include comprehensive health classification reasoning', () => {
    /**
     * **Validates: Requirements 7.1, 7.3**
     * Tests that health classification reasoning is included in export
     */

    exportClubPerformance(mockClubsWithHealthData, 'D123')

    // Should include reasoning column headers
    expect(capturedCsvContent).toContain('Health Classification Reasons')
    expect(capturedCsvContent).toContain('Trajectory Reasons')

    // Should include actual reasoning text
    expect(capturedCsvContent).toContain('Strong membership; Meeting DCP goals')
    expect(capturedCsvContent).toContain(
      'Increasing membership; Improving goal completion'
    )
    expect(capturedCsvContent).toContain('Low membership; Missing DCP goals')
    expect(capturedCsvContent).toContain('Declining membership trend')
  })

  it('should generate appropriate filename for health data export', () => {
    /**
     * **Validates: Requirements 7.1**
     * Tests that the export generates an appropriate filename indicating health data inclusion
     */

    exportClubPerformance(mockClubsWithHealthData, 'D123')

    // Verify link element was created with correct download attribute
    expect(mockCreateElement).toHaveBeenCalledWith('a')

    expect(capturedFilename).toMatch(
      /club_performance_with_health_district_D123_\d{4}-\d{2}-\d{2}\.csv/
    )
  })

  it('should export all required club data fields along with health data', () => {
    /**
     * **Validates: Requirements 7.1, 7.5**
     * Tests that all required club data fields are included along with health data
     */

    exportClubPerformance(mockClubsWithHealthData, 'D123')

    // Should include all standard club data columns
    expect(capturedCsvContent).toContain('Club ID')
    expect(capturedCsvContent).toContain('Club Name')
    expect(capturedCsvContent).toContain('Division')
    expect(capturedCsvContent).toContain('Area')
    expect(capturedCsvContent).toContain('Current Membership')
    expect(capturedCsvContent).toContain('Current DCP Goals')
    expect(capturedCsvContent).toContain('Status')
    expect(capturedCsvContent).toContain('Distinguished Level')
    expect(capturedCsvContent).toContain('Risk Factors')

    // Should include health data columns
    expect(capturedCsvContent).toContain('Health Status')
    expect(capturedCsvContent).toContain('Trajectory')
    expect(capturedCsvContent).toContain('Health Classification Reasons')
    expect(capturedCsvContent).toContain('Trajectory Reasons')
    expect(capturedCsvContent).toContain('Health Data Age (hours)')
    expect(capturedCsvContent).toContain('Health Data Timestamp')

    // Should include actual club data
    expect(capturedCsvContent).toContain('Alpha Toastmasters')
    expect(capturedCsvContent).toContain('Beta Speakers')
    expect(capturedCsvContent).toContain('Gamma Club')
  })

  it('should handle edge cases in health data export', () => {
    /**
     * **Validates: Requirements 7.4, 7.5**
     * Tests edge cases like empty arrays, null values, and special characters
     */

    const edgeCaseClubs = [
      {
        clubId: 'club-edge',
        clubName: 'Edge Case Club, "Special" Characters',
        divisionName: 'Division "A"',
        areaName: 'Area, 1',
        membershipTrend: [{ date: '2024-01-01', count: 0 }],
        dcpGoalsTrend: [{ date: '2024-01-01', goalsAchieved: 0 }],
        currentStatus: 'critical',
        distinguishedLevel: undefined,
        riskFactors: [],
        // Edge case health data
        healthStatus: 'Vulnerable',
        trajectory: 'Stable',
        healthReasons: [], // Empty array
        trajectoryReasons: ['Reason with, comma', 'Reason with "quotes"'],
        healthDataAge: 0, // Zero age
        healthDataTimestamp: '', // Empty string
      },
    ]

    exportClubPerformance(edgeCaseClubs, 'D123')

    // Should handle special characters in club names
    expect(capturedCsvContent).toContain(
      '"Edge Case Club, ""Special"" Characters"'
    )

    // Should handle empty health reasons array
    expect(capturedCsvContent).toContain('N/A') // For empty healthReasons

    // Should handle reasons with special characters
    expect(capturedCsvContent).toContain(
      '"Reason with, comma; Reason with ""quotes"""'
    )

    // Should handle zero data age
    expect(capturedCsvContent).toContain('0.0')

    // Should handle empty timestamp
    expect(capturedCsvContent).toContain('N/A') // For empty healthDataTimestamp
  })

  it('should complete export within performance requirements', () => {
    /**
     * **Validates: Requirements 7.6**
     * Tests that export completes within 5 seconds for up to 1000 clubs
     */

    // Create a large dataset (simulating 1000 clubs)
    const largeClubSet = Array.from({ length: 1000 }, (_, i) => ({
      clubId: `club-${i}`,
      clubName: `Club ${i}`,
      divisionName: `Division ${i % 10}`,
      areaName: `Area ${i % 5}`,
      membershipTrend: [{ date: '2024-01-01', count: 20 + (i % 30) }],
      dcpGoalsTrend: [{ date: '2024-01-01', goalsAchieved: i % 11 }],
      currentStatus: (['healthy', 'at-risk', 'critical'] as const)[i % 3],
      distinguishedLevel: i % 4 === 0 ? 'Distinguished' : undefined,
      riskFactors: i % 3 === 2 ? ['low-membership'] : [],
      // Health data
      healthStatus: (
        ['Thriving', 'Vulnerable', 'Intervention Required'] as const
      )[i % 3],
      trajectory: (['Recovering', 'Stable', 'Declining'] as const)[i % 3],
      healthReasons: [`Reason ${i % 5}`, `Factor ${i % 3}`],
      trajectoryReasons: [`Trend ${i % 4}`],
      healthDataAge: (i % 100) / 10,
      healthDataTimestamp: `2024-01-${String((i % 28) + 1).padStart(2, '0')}T10:00:00Z`,
    }))

    const startTime = performance.now()

    exportClubPerformance(largeClubSet, 'D123')

    const endTime = performance.now()
    const executionTime = endTime - startTime

    // Should complete within 5 seconds (5000ms)
    expect(executionTime).toBeLessThan(5000)

    // Verify the export was successful
    expect(capturedCsvContent).toBeTruthy()
    expect(mockClick).toHaveBeenCalled()
  })

  it('should respect health status and trajectory filters when exporting', () => {
    /**
     * **Validates: Requirements 7.2**
     * Tests that export respects health status and trajectory filters
     * Note: This test verifies the export function works with filtered data,
     * the actual filtering is handled by the ClubsTable component
     */

    // Create a filtered subset (simulating what ClubsTable would pass after filtering)
    const filteredClubs = mockClubsWithHealthData.filter(
      club =>
        club.healthStatus === 'Thriving' ||
        club.healthStatus === 'Intervention Required'
    )

    exportClubPerformance(filteredClubs, 'D123')

    // Should only include the filtered clubs
    expect(capturedCsvContent).toContain('Alpha Toastmasters') // Thriving
    expect(capturedCsvContent).toContain('Gamma Club') // Intervention Required
    expect(capturedCsvContent).not.toContain('Beta Speakers') // Was filtered out (no health status)

    // Should include the correct count in the header
    expect(capturedCsvContent).toContain('Total Clubs: 2')

    // Should still include all health data columns
    expect(capturedCsvContent).toContain('Health Status')
    expect(capturedCsvContent).toContain('Trajectory')
    expect(capturedCsvContent).toContain('Health Classification Reasons')
    expect(capturedCsvContent).toContain('Trajectory Reasons')
  })
})
