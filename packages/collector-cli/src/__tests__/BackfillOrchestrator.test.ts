/**
 * Unit Tests for BackfillOrchestrator (#123)
 *
 * Tests the 3-phase backfill orchestration logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  BackfillOrchestrator,
  type BackfillConfig,
} from '../services/BackfillOrchestrator.js'
import type { BackfillDateSpec } from '../services/HttpCsvDownloader.js'

describe('BackfillOrchestrator (#123)', () => {
  const defaultConfig: BackfillConfig = {
    startYear: 2024,
    endYear: 2024,
    frequency: 'monthly',
    ratePerSecond: 10,
    outputDir: '/tmp/backfill-test',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('constructor', () => {
    it('should create orchestrator with valid config', () => {
      const orchestrator = new BackfillOrchestrator(defaultConfig)
      expect(orchestrator).toBeDefined()
    })
  })

  describe('calculateScope', () => {
    it('should calculate total requests for single year monthly', () => {
      const orchestrator = new BackfillOrchestrator(defaultConfig)
      const scope = orchestrator.calculateScope()

      // 1 program year, monthly dates ≈ 12-15 dates
      expect(scope.programYears).toEqual(['2024-2025'])
      expect(scope.datesPerYear).toBeGreaterThanOrEqual(12)
      expect(scope.datesPerYear).toBeLessThanOrEqual(15)

      // Phase 1: 1 request per date (districtsummary)
      expect(scope.phase1Requests).toBe(scope.datesPerYear)

      // Per district: 3 report types × dates per year
      expect(scope.requestsPerDistrict).toBe(scope.datesPerYear * 3)
    })

    it('should calculate scope for multi-year range', () => {
      const orchestrator = new BackfillOrchestrator({
        ...defaultConfig,
        startYear: 2017,
        endYear: 2024,
      })
      const scope = orchestrator.calculateScope()

      expect(scope.programYears).toHaveLength(8)
      expect(scope.phase1Requests).toBe(scope.datesPerYear * 8)
    })
  })

  describe('phase 1: discovery', () => {
    it('should discover districts from summary CSVs', async () => {
      const orchestrator = new BackfillOrchestrator({
        ...defaultConfig,
        frequency: 'monthly',
      })

      // Replace the downloader's downloadCsv with a mock
      const mockDownload = vi.fn().mockResolvedValue({
        url: 'https://test.example.com',
        content: `"REGION","DISTRICT","DSP","Training"
"01","02","Y","Y"
"01","09","Y","Y"
"02","42","Y","Y"
`,
        statusCode: 200,
        byteSize: 100,
      })

      orchestrator.downloader.downloadCsv = mockDownload

      const result = await orchestrator.runPhase1Discovery()

      // Should have made requests for each date in the program year
      expect(mockDownload).toHaveBeenCalled()

      // Each call should be for 'districtsummary' report
      for (const call of mockDownload.mock.calls) {
        const spec = call[0] as BackfillDateSpec
        expect(spec.reportType).toBe('districtsummary')
        expect(spec.programYear).toBe('2024-2025')
      }

      // Should have discovered 3 districts
      expect(result.districtsPerYear['2024-2025']).toEqual(['02', '09', '42'])
    })
  })

  describe('estimateTime', () => {
    it('should estimate completion time based on rate and count', () => {
      const orchestrator = new BackfillOrchestrator(defaultConfig)

      // 1000 requests at 2/s = 500 seconds ≈ 8 min
      const estimate = orchestrator.estimateTime(1000, 2)
      expect(estimate.totalSeconds).toBeCloseTo(500, -1)
      expect(estimate.humanReadable).toContain('min')
    })

    it('should format hours for large request counts', () => {
      const orchestrator = new BackfillOrchestrator(defaultConfig)

      // 72000 requests at 2/s = 36000 seconds = 10 hours
      const estimate = orchestrator.estimateTime(72000, 2)
      expect(estimate.totalSeconds).toBeCloseTo(36000, -1)
      expect(estimate.humanReadable).toContain('h')
    })
  })
})
