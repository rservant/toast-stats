/**
 * Unit Tests for CollectorOrchestrator Partial Failure Resilience
 *
 * Verifies that when scraping fails for some districts, the orchestrator
 * continues processing remaining districts and reports all failures.
 *
 * Converted from property-based tests — PBT generated random district
 * lists and failure subsets; replaced with representative fixed cases.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { CollectorOrchestrator } from '../CollectorOrchestrator.js'
import type { CollectorOrchestratorConfig } from '../types/index.js'

let mockCollectorInstance: {
  getClubPerformance: ReturnType<typeof vi.fn>
  getDivisionPerformance: ReturnType<typeof vi.fn>
  getDistrictPerformance: ReturnType<typeof vi.fn>
  getAllDistrictsWithMetadata: ReturnType<typeof vi.fn>
  closeBrowser: ReturnType<typeof vi.fn>
  getFallbackMetrics: ReturnType<typeof vi.fn>
} | null = null

vi.mock('../services/ToastmastersCollector.js', () => {
  return {
    ToastmastersCollector: class MockToastmastersCollector {
      constructor() {
        if (mockCollectorInstance) Object.assign(this, mockCollectorInstance)
      }
      getClubPerformance = vi.fn()
      getDivisionPerformance = vi.fn()
      getDistrictPerformance = vi.fn()
      getAllDistrictsWithMetadata = vi.fn()
      closeBrowser = vi.fn().mockResolvedValue(undefined)
      getFallbackMetrics = vi.fn().mockReturnValue({
        cacheHits: 0,
        cacheMisses: 0,
        fallbackDatesDiscovered: 0,
      })
    },
  }
})

describe('CollectorOrchestrator - Partial Failure Resilience', () => {
  let testCacheDir: string
  let testConfigPath: string

  beforeEach(async () => {
    const testId = `collector-test-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
    testCacheDir = path.join(process.cwd(), 'test-cache', testId)
    testConfigPath = path.join(testCacheDir, 'config', 'districts.json')
    await fs.mkdir(path.dirname(testConfigPath), { recursive: true })
  })

  afterEach(async () => {
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true })
    } catch {
      // Ignore
    }
    vi.clearAllMocks()
  })

  async function createDistrictConfig(districts: string[]): Promise<void> {
    const config = {
      configuredDistricts: districts,
      lastUpdated: new Date().toISOString(),
      updatedBy: 'test',
      version: 1,
    }
    await fs.writeFile(testConfigPath, JSON.stringify(config, null, 2), 'utf-8')
  }

  function createConfig(): CollectorOrchestratorConfig {
    return {
      cacheDir: testCacheDir,
      districtConfigPath: testConfigPath,
      timeout: 30,
      verbose: false,
    }
  }

  function setupMockCollector(failingDistricts: Set<string>) {
    mockCollectorInstance = {
      getClubPerformance: vi
        .fn()
        .mockImplementation(async (districtId: string) => {
          if (failingDistricts.has(districtId))
            throw new Error(`Simulated failure for district ${districtId}`)
          return [{ 'Club Number': '123', 'Club Name': 'Test Club' }]
        }),
      getDivisionPerformance: vi
        .fn()
        .mockImplementation(async (districtId: string) => {
          if (failingDistricts.has(districtId))
            throw new Error(`Simulated failure for district ${districtId}`)
          return [{ Division: 'A', 'Total Clubs': '10' }]
        }),
      getDistrictPerformance: vi
        .fn()
        .mockImplementation(async (districtId: string) => {
          if (failingDistricts.has(districtId))
            throw new Error(`Simulated failure for district ${districtId}`)
          return [{ District: districtId, 'Total Clubs': '50' }]
        }),
      getAllDistrictsWithMetadata: vi
        .fn()
        .mockImplementation(async (date: string) => ({
          records: [{ District: '1', 'Total Clubs': '100' }],
          actualDate: date,
        })),
      closeBrowser: vi.fn().mockResolvedValue(undefined),
      getFallbackMetrics: vi.fn().mockReturnValue({
        cacheHits: 0,
        cacheMisses: 0,
        fallbackDatesDiscovered: 0,
      }),
    }
  }

  async function runScrapeTest(
    districts: string[],
    failingDistricts: Set<string>
  ) {
    await createDistrictConfig(districts)
    setupMockCollector(failingDistricts)
    const orchestrator = new CollectorOrchestrator(createConfig())
    const result = await orchestrator.scrape({
      date: '2026-01-11',
      force: true,
    })
    await orchestrator.close()
    mockCollectorInstance = null
    return result
  }

  it('should process all districts when none fail', async () => {
    const districts = ['42', '101', 'F']
    const result = await runScrapeTest(districts, new Set())

    expect(result.districtsProcessed.length).toBe(3)
    expect(new Set(result.districtsSucceeded)).toEqual(new Set(districts))
    expect(result.districtsFailed.length).toBe(0)
    expect(result.errors.length).toBe(0)
    expect(result.success).toBe(true)
    expect(result.duration_ms).toBeGreaterThanOrEqual(0)
  })

  it('should continue processing when one district fails', async () => {
    const districts = ['42', '101', 'F']
    const failing = new Set(['101'])
    const result = await runScrapeTest(districts, failing)

    expect(result.districtsProcessed.length).toBe(3)
    expect(new Set(result.districtsSucceeded)).toEqual(new Set(['42', 'F']))
    expect(new Set(result.districtsFailed)).toEqual(failing)
    expect(result.errors.length).toBe(1)
    expect(result.errors[0].districtId).toBe('101')
    expect(result.errors[0].error).toContain('101')
    expect(result.success).toBe(false)
  })

  it('should continue processing when multiple districts fail', async () => {
    const districts = ['1', '42', '101', 'A', 'F']
    const failing = new Set(['42', 'A'])
    const result = await runScrapeTest(districts, failing)

    expect(result.districtsProcessed.length).toBe(5)
    expect(new Set(result.districtsSucceeded)).toEqual(
      new Set(['1', '101', 'F'])
    )
    expect(new Set(result.districtsFailed)).toEqual(failing)
    expect(result.errors.length).toBe(2)
    expect(result.success).toBe(false)

    for (const failedId of failing) {
      const errorEntry = result.errors.find(e => e.districtId === failedId)
      expect(errorEntry).toBeDefined()
      expect(errorEntry?.error).toContain(failedId)
    }
  })

  it('should report all failures when every district fails', async () => {
    const districts = ['42', '101']
    const failing = new Set(districts)
    const result = await runScrapeTest(districts, failing)

    expect(result.districtsProcessed.length).toBe(2)
    expect(result.districtsSucceeded.length).toBe(0)
    expect(new Set(result.districtsFailed)).toEqual(failing)
    expect(result.errors.length).toBe(2)
    expect(result.success).toBe(false)
  })

  it('should handle alphabetic district IDs', async () => {
    const districts = ['A', 'F', 'U']
    const failing = new Set(['F'])
    const result = await runScrapeTest(districts, failing)

    expect(result.districtsProcessed.length).toBe(3)
    expect(new Set(result.districtsSucceeded)).toEqual(new Set(['A', 'U']))
    expect(result.errors.length).toBe(1)
  })
})
