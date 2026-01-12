/**
 * Property-Based Tests for ScraperOrchestrator
 *
 * Feature: scraper-cli-separation
 * Property 3: Partial Failure Resilience
 *
 * Validates: Requirements 1.10
 *
 * This test validates that when scraping fails for some districts,
 * the orchestrator continues processing remaining districts and
 * reports all failures in the summary output.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import * as fs from 'fs/promises'
import * as path from 'path'
import { ScraperOrchestrator } from '../ScraperOrchestrator.js'
import type { ScraperOrchestratorConfig } from '../types/index.js'

// Store the mock scraper instance for test configuration
let mockScraperInstance: {
  getClubPerformance: ReturnType<typeof vi.fn>
  getDivisionPerformance: ReturnType<typeof vi.fn>
  getDistrictPerformance: ReturnType<typeof vi.fn>
  closeBrowser: ReturnType<typeof vi.fn>
} | null = null

// Mock the ToastmastersScraper to control success/failure behavior
vi.mock('../services/ToastmastersScraper.js', () => {
  return {
    ToastmastersScraper: class MockToastmastersScraper {
      constructor() {
        // Use the pre-configured mock instance
        if (mockScraperInstance) {
          Object.assign(this, mockScraperInstance)
        }
      }
      getClubPerformance = vi.fn()
      getDivisionPerformance = vi.fn()
      getDistrictPerformance = vi.fn()
      closeBrowser = vi.fn().mockResolvedValue(undefined)
    },
  }
})

describe('ScraperOrchestrator - Property-Based Tests', () => {
  let testCacheDir: string
  let testConfigPath: string
  let testId: string

  beforeEach(async () => {
    // Create a unique test directory
    testId = `scraper-orchestrator-pbt-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
    testCacheDir = path.join(process.cwd(), 'test-cache', testId)
    testConfigPath = path.join(testCacheDir, 'config', 'districts.json')

    await fs.mkdir(path.dirname(testConfigPath), { recursive: true })
  })

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
    vi.clearAllMocks()
  })

  /**
   * Generator for valid district IDs
   */
  const generateValidDistrictId = (): fc.Arbitrary<string> =>
    fc.oneof(
      // Numeric district IDs (1-999)
      fc.integer({ min: 1, max: 999 }).map(n => n.toString()),
      // Alphabetic district IDs (A-Z)
      fc.constantFrom(
        'A',
        'B',
        'C',
        'D',
        'E',
        'F',
        'G',
        'H',
        'I',
        'J',
        'K',
        'L',
        'M',
        'N',
        'O',
        'P',
        'Q',
        'R',
        'S',
        'T',
        'U',
        'V',
        'W',
        'X',
        'Y',
        'Z'
      )
    )

  /**
   * Generator for a list of unique district IDs
   */
  const generateDistrictList = (
    minLength: number,
    maxLength: number
  ): fc.Arbitrary<string[]> =>
    fc
      .array(generateValidDistrictId(), { minLength, maxLength })
      .map(ids => [...new Set(ids)]) // Ensure uniqueness
      .filter(ids => ids.length >= minLength)

  /**
   * Generator for a set of districts that should fail
   * Takes a list of districts and returns a subset that should fail
   */
  const generateFailingDistricts = (
    districts: string[]
  ): fc.Arbitrary<Set<string>> =>
    fc
      .subarray(districts, { minLength: 0, maxLength: districts.length })
      .map(arr => new Set(arr))

  /**
   * Helper to create a district configuration file
   */
  async function createDistrictConfig(districts: string[]): Promise<void> {
    const config = {
      configuredDistricts: districts,
      lastUpdated: new Date().toISOString(),
      updatedBy: 'test',
      version: 1,
    }
    await fs.writeFile(testConfigPath, JSON.stringify(config, null, 2), 'utf-8')
  }

  /**
   * Helper to create orchestrator config
   */
  function createOrchestratorConfig(): ScraperOrchestratorConfig {
    return {
      cacheDir: testCacheDir,
      districtConfigPath: testConfigPath,
      timeout: 30,
      verbose: false,
    }
  }

  /**
   * Property 3: Partial Failure Resilience
   *
   * For any scrape operation where at least one district fails,
   * the Scraper CLI SHALL continue processing remaining districts
   * and include all failures in the summary output.
   *
   * **Validates: Requirements 1.10**
   */
  it('Property 3: Partial Failure Resilience - continues processing after failures and reports all failures', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate 2-5 districts to keep test fast
        generateDistrictList(2, 5),
        async districts => {
          // Skip if we don't have enough unique districts
          if (districts.length < 2) {
            return true
          }

          // Generate a random subset of districts that should fail
          const failingDistrictsArray = await fc.sample(
            generateFailingDistricts(districts),
            1
          )
          const failingDistricts = failingDistrictsArray[0] ?? new Set<string>()

          // Create district configuration
          await createDistrictConfig(districts)

          // Configure the mock scraper instance before creating orchestrator
          mockScraperInstance = {
            getClubPerformance: vi
              .fn()
              .mockImplementation(async (districtId: string) => {
                if (failingDistricts.has(districtId)) {
                  throw new Error(
                    `Simulated failure for district ${districtId}`
                  )
                }
                return [{ 'Club Number': '123', 'Club Name': 'Test Club' }]
              }),
            getDivisionPerformance: vi
              .fn()
              .mockImplementation(async (districtId: string) => {
                if (failingDistricts.has(districtId)) {
                  throw new Error(
                    `Simulated failure for district ${districtId}`
                  )
                }
                return [{ Division: 'A', 'Total Clubs': '10' }]
              }),
            getDistrictPerformance: vi
              .fn()
              .mockImplementation(async (districtId: string) => {
                if (failingDistricts.has(districtId)) {
                  throw new Error(
                    `Simulated failure for district ${districtId}`
                  )
                }
                return [{ District: districtId, 'Total Clubs': '50' }]
              }),
            closeBrowser: vi.fn().mockResolvedValue(undefined),
          }

          // Create orchestrator and run scrape
          const config = createOrchestratorConfig()
          const orchestrator = new ScraperOrchestrator(config)

          const result = await orchestrator.scrape({
            date: '2026-01-11',
            force: true,
          })

          // Property assertions:

          // 1. All districts should be processed (attempted)
          expect(result.districtsProcessed.length).toBe(districts.length)
          expect(new Set(result.districtsProcessed)).toEqual(new Set(districts))

          // 2. Succeeded districts should be those not in failingDistricts
          const expectedSucceeded = districts.filter(
            d => !failingDistricts.has(d)
          )
          expect(new Set(result.districtsSucceeded)).toEqual(
            new Set(expectedSucceeded)
          )

          // 3. Failed districts should match failingDistricts
          expect(new Set(result.districtsFailed)).toEqual(failingDistricts)

          // 4. Errors array should contain one entry per failed district
          expect(result.errors.length).toBe(failingDistricts.size)

          // 5. Each failed district should have an error entry
          for (const failedDistrict of failingDistricts) {
            const errorEntry = result.errors.find(
              e => e.districtId === failedDistrict
            )
            expect(errorEntry).toBeDefined()
            expect(errorEntry?.error).toContain(failedDistrict)
          }

          // 6. Success should be true only if no districts failed
          if (failingDistricts.size === 0) {
            expect(result.success).toBe(true)
          } else if (failingDistricts.size === districts.length) {
            // All failed
            expect(result.success).toBe(false)
          } else {
            // Partial failure
            expect(result.success).toBe(false)
          }

          // 7. Duration should be recorded
          expect(result.duration_ms).toBeGreaterThanOrEqual(0)

          // Clean up for next iteration
          await orchestrator.close()
          mockScraperInstance = null

          return true
        }
      ),
      {
        numRuns: 100,
        verbose: true,
      }
    )
  }, 120000) // 2 minute timeout for property test
})
