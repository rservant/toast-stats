/**
 * Unit Tests for ReconciliationTestDataGenerator
 *
 * Tests test data generation for various reconciliation patterns,
 * property-based testing support, and edge case generation.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { ReconciliationTestDataGenerator } from '../ReconciliationTestDataGenerator.ts'
import { createTestSelfCleanup } from '../test-self-cleanup.ts'

// Mock logger
vi.mock('../logger.ts', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('ReconciliationTestDataGenerator', () => {
  // Self-cleanup setup - each test manages its own cleanup
  const { cleanup, afterEach: performCleanup } = createTestSelfCleanup({
    verbose: false,
  })

  // Each test cleans up after itself
  afterEach(performCleanup)

  function createGenerator() {
    const generator = new ReconciliationTestDataGenerator()

    // Register cleanup for the generator if it has cleanup methods
    cleanup(() => {
      // Add any cleanup needed for the generator
    })

    return generator
  }

  describe('initialization', () => {
    it('should initialize with default patterns', () => {
      const generator = createGenerator()
      const patterns = generator.getAvailablePatterns()

      expect(patterns).toHaveLength(7)
      expect(patterns).toContain('stable_no_changes')
      expect(patterns).toContain('gradual_growth')
      expect(patterns).toContain('sudden_change')
      expect(patterns).toContain('volatile_changes')
      expect(patterns).toContain('late_stabilization')
      expect(patterns).toContain('club_changes')
      expect(patterns).toContain('distinguished_changes')
    })
  })

  describe('generateTestData', () => {
    it('should generate stable_no_changes pattern correctly', () => {
      const generator = createGenerator()
      const testData = generator.generateTestData('stable_no_changes', 1000)

      expect(testData.districtData).toHaveLength(10)
      expect(testData.expectedChanges).toHaveLength(0) // No changes expected
      expect(testData.reconciliationJob.districtId).toBe('TEST-STABLE')
      expect(testData.config).toBeDefined()
      expect(testData.metadata.pattern).toBe('stable_no_changes')
      expect(testData.metadata.seed).toBe(1000)
      expect(testData.metadata.expectedOutcome).toBe('completed_quickly')

      // All data points should be identical
      const firstData = testData.districtData[0]
      testData.districtData.forEach(data => {
        expect(data.membership.total).toBe(firstData.membership.total)
        expect(data.clubs.total).toBe(firstData.clubs.total)
        expect(data.clubs.distinguished).toBe(firstData.clubs.distinguished)
      })
    })

    it('should generate gradual_growth pattern with changes', () => {
      const generator = createGenerator()
      const testData = generator.generateTestData('gradual_growth', 2000)

      expect(testData.districtData).toHaveLength(12)
      expect(testData.expectedChanges.length).toBeGreaterThan(0)
      expect(testData.reconciliationJob.districtId).toBe('TEST-GROWTH')
      expect(testData.metadata.pattern).toBe('gradual_growth')
      expect(testData.metadata.expectedOutcome).toBe('completed_with_changes')

      // Should have membership changes
      const membershipChanges = testData.expectedChanges.filter(
        c => c.membershipChange
      )
      expect(membershipChanges.length).toBeGreaterThan(0)

      membershipChanges.forEach(change => {
        expect(change.membershipChange!.current).toBeGreaterThan(
          change.membershipChange!.previous
        )
        expect(change.membershipChange!.percentChange).toBeGreaterThan(0)
        expect(change.changedFields).toContain('membership')
      })
    })

    it('should generate sudden_change pattern with significant change', () => {
      const generator = createGenerator()
      const testData = generator.generateTestData('sudden_change', 3000)

      expect(testData.districtData).toHaveLength(15)
      expect(testData.expectedChanges.length).toBeGreaterThan(0)
      expect(testData.reconciliationJob.districtId).toBe('TEST-SUDDEN')
      expect(testData.metadata.pattern).toBe('sudden_change')
      expect(testData.metadata.expectedOutcome).toBe(
        'extended_due_to_late_change'
      )

      // Should have both membership and club changes
      const changes = testData.expectedChanges[0]
      expect(changes.changedFields).toContain('membership')
      expect(changes.changedFields).toContain('clubCount')
      expect(changes.membershipChange).toBeDefined()
      expect(changes.clubCountChange).toBeDefined()
    })

    it('should generate volatile_changes pattern with frequent changes', () => {
      const generator = createGenerator()
      const testData = generator.generateTestData('volatile_changes', 4000)

      expect(testData.districtData).toHaveLength(18)
      expect(testData.expectedChanges.length).toBeGreaterThan(2) // Should have multiple changes
      expect(testData.reconciliationJob.districtId).toBe('TEST-VOLATILE')
      expect(testData.metadata.pattern).toBe('volatile_changes')
      expect(testData.metadata.expectedOutcome).toBe(
        'extended_due_to_volatility'
      )

      // Changes should be spread throughout the timeline
      testData.expectedChanges.forEach(change => {
        expect(change.hasChanges).toBe(true)
        expect(change.membershipChange).toBeDefined()
      })
    })

    it('should generate late_stabilization pattern', () => {
      const generator = createGenerator()
      const testData = generator.generateTestData('late_stabilization', 5000)

      expect(testData.districtData).toHaveLength(20)
      expect(testData.expectedChanges.length).toBeGreaterThan(0)
      expect(testData.reconciliationJob.districtId).toBe('TEST-LATE')
      expect(testData.metadata.pattern).toBe('late_stabilization')
      expect(testData.metadata.expectedOutcome).toBe(
        'completed_after_extension'
      )
    })

    it('should generate club_changes pattern', () => {
      const generator = createGenerator()
      const testData = generator.generateTestData('club_changes', 6000)

      expect(testData.districtData).toHaveLength(12)
      expect(testData.reconciliationJob.districtId).toBe('TEST-CLUBS')
      expect(testData.metadata.pattern).toBe('club_changes')
      expect(testData.metadata.expectedOutcome).toBe(
        'completed_with_club_changes'
      )

      // Should have club count changes
      const clubChanges = testData.expectedChanges.filter(
        c => c.clubCountChange
      )
      expect(clubChanges.length).toBeGreaterThan(0)

      clubChanges.forEach(change => {
        expect(change.clubCountChange).toBeDefined()
        expect(change.changedFields).toContain('clubCount')
      })
    })

    it('should generate distinguished_changes pattern', () => {
      const generator = createGenerator()
      const testData = generator.generateTestData('distinguished_changes', 7000)

      expect(testData.districtData).toHaveLength(14)
      expect(testData.reconciliationJob.districtId).toBe('TEST-DIST')
      expect(testData.metadata.pattern).toBe('distinguished_changes')
      expect(testData.metadata.expectedOutcome).toBe(
        'completed_with_distinguished_changes'
      )

      // Should have distinguished changes
      const distinguishedChanges = testData.expectedChanges.filter(
        c => c.distinguishedChange
      )
      expect(distinguishedChanges.length).toBeGreaterThan(0)

      distinguishedChanges.forEach(change => {
        expect(change.distinguishedChange).toBeDefined()
        expect(change.changedFields).toContain('distinguished')
      })
    })

    it('should throw error for unknown pattern', () => {
      const generator = createGenerator()
      expect(() => generator.generateTestData('unknown_pattern')).toThrow(
        'Test data pattern not found: unknown_pattern'
      )
    })

    it('should generate deterministic data with same seed', () => {
      const generator = createGenerator()
      const testData1 = generator.generateTestData('stable_no_changes', 12345)
      const testData2 = generator.generateTestData('stable_no_changes', 12345)

      expect(testData1.districtData[0].membership.total).toBe(
        testData2.districtData[0].membership.total
      )
      expect(testData1.districtData[0].clubs.total).toBe(
        testData2.districtData[0].clubs.total
      )
      expect(testData1.config.maxReconciliationDays).toBe(
        testData2.config.maxReconciliationDays
      )
    })

    it('should generate different data with different seeds', () => {
      const generator = createGenerator()
      const testData1 = generator.generateTestData('gradual_growth', 11111)
      const testData2 = generator.generateTestData('gradual_growth', 22222)

      // Should be different (very unlikely to be identical with different seeds)
      const different =
        testData1.districtData[0].membership.total !==
          testData2.districtData[0].membership.total ||
        testData1.districtData[0].clubs.total !==
          testData2.districtData[0].clubs.total
      expect(different).toBe(true)
    })
  })

  describe('generateBatchTestData', () => {
    it('should generate multiple test data sets', () => {
      const generator = createGenerator()
      const patterns = ['stable_no_changes', 'gradual_growth']
      const testSets = generator.generateBatchTestData(patterns, 3)

      expect(testSets).toHaveLength(6) // 2 patterns × 3 count

      // Should have 3 of each pattern
      const stableCount = testSets.filter(
        s => s.metadata.pattern === 'stable_no_changes'
      ).length
      const growthCount = testSets.filter(
        s => s.metadata.pattern === 'gradual_growth'
      ).length

      expect(stableCount).toBe(3)
      expect(growthCount).toBe(3)
    })

    it('should handle invalid patterns gracefully', () => {
      const generator = createGenerator()
      const patterns = [
        'stable_no_changes',
        'invalid_pattern',
        'gradual_growth',
      ]
      const testSets = generator.generateBatchTestData(patterns, 2)

      // Should only generate for valid patterns
      expect(testSets).toHaveLength(4) // 2 valid patterns × 2 count
      expect(
        testSets.every(s => s.metadata.pattern !== 'invalid_pattern')
      ).toBe(true)
    })

    it('should handle empty pattern list', () => {
      const generator = createGenerator()
      const testSets = generator.generateBatchTestData([], 5)
      expect(testSets).toHaveLength(0)
    })
  })

  describe('generatePropertyTestCases', () => {
    it('should generate change_detection_accuracy test cases', () => {
      const generator = createGenerator()
      const testCases = generator.generatePropertyTestCases(
        'change_detection_accuracy',
        10
      )

      expect(testCases).toHaveLength(10)

      testCases.forEach(testCase => {
        expect(testCase.name).toMatch(/change_detection_\d+/)
        expect(testCase.property).toBe('change_detection_accuracy')
        expect(testCase.inputs).toHaveLength(2)
        expect(testCase.expectedResult).toBe('should_detect_all_changes')
        expect(testCase.seed).toBeGreaterThan(0)

        // Inputs should be district statistics
        const [prevData, currData] = testCase.inputs as [
          { districtId: string; membership: unknown },
          { districtId: string; membership: unknown },
        ]
        expect(prevData.districtId).toBeTruthy()
        expect(currData.districtId).toBeTruthy()
        expect(prevData.membership).toBeDefined()
        expect(currData.membership).toBeDefined()
      })
    })

    it('should generate stability_period_calculation test cases', () => {
      const generator = createGenerator()
      const testCases = generator.generatePropertyTestCases(
        'stability_period_calculation',
        5
      )

      expect(testCases).toHaveLength(5)

      testCases.forEach(testCase => {
        expect(testCase.name).toMatch(/stability_\d+/)
        expect(testCase.property).toBe('stability_period_calculation')
        expect(testCase.inputs).toHaveLength(2)
        expect(testCase.expectedResult).toBe('correct_stability_count')

        const [timeline, stabilityDays] = testCase.inputs
        expect(Array.isArray(timeline)).toBe(true)
        expect(typeof stabilityDays).toBe('number')
        expect(stabilityDays).toBeGreaterThan(0)
      })
    })

    it('should generate configuration_validation test cases', () => {
      const generator = createGenerator()
      const testCases = generator.generatePropertyTestCases(
        'configuration_validation',
        8
      )

      expect(testCases).toHaveLength(8)

      testCases.forEach(testCase => {
        expect(testCase.name).toMatch(/config_\d+/)
        expect(testCase.property).toBe('configuration_validation')
        expect(testCase.inputs).toHaveLength(1)
        expect(testCase.expectedResult).toBe('valid_or_specific_error')

        const [config] = testCase.inputs
        expect(typeof config).toBe('object')
      })
    })

    it('should return empty array for unknown property', () => {
      const generator = createGenerator()
      const testCases = generator.generatePropertyTestCases(
        'unknown_property',
        5
      )
      expect(testCases).toHaveLength(0)
    })

    it('should generate unique seeds for each test case', () => {
      const generator = createGenerator()
      const testCases = generator.generatePropertyTestCases(
        'change_detection_accuracy',
        20
      )

      const seeds = testCases.map(tc => tc.seed)
      const uniqueSeeds = new Set(seeds)

      expect(uniqueSeeds.size).toBe(seeds.length) // All seeds should be unique
    })
  })

  describe('generateEdgeCases', () => {
    it('should generate all edge cases', () => {
      const generator = createGenerator()
      const edgeCases = generator.generateEdgeCases()

      expect(edgeCases).toHaveLength(5)

      const patterns = edgeCases.map(ec => ec.metadata.pattern)
      expect(patterns).toContain('edge_case_zero_membership')
      expect(patterns).toContain('edge_case_single_club')
      expect(patterns).toContain('edge_case_max_size')
      expect(patterns).toContain('edge_case_all_distinguished')
      expect(patterns).toContain('edge_case_no_distinguished')
    })

    it('should generate zero membership edge case correctly', () => {
      const generator = createGenerator()
      const edgeCases = generator.generateEdgeCases()
      const zeroCase = edgeCases.find(
        ec => ec.metadata.pattern === 'edge_case_zero_membership'
      )!

      expect(zeroCase).toBeDefined()
      expect(zeroCase.districtData[0].membership.total).toBe(0)
      expect(zeroCase.districtData[0].membership.new).toBe(0)
      expect(zeroCase.districtData[0].membership.renewed).toBe(0)
      expect(zeroCase.districtData[0].membership.dual).toBe(0)
      expect(zeroCase.reconciliationJob.districtId).toBe('EDGE-ZERO')
    })

    it('should generate single club edge case correctly', () => {
      const generator = createGenerator()
      const edgeCases = generator.generateEdgeCases()
      const singleCase = edgeCases.find(
        ec => ec.metadata.pattern === 'edge_case_single_club'
      )!

      expect(singleCase).toBeDefined()
      expect(singleCase.districtData[0].clubs.total).toBe(1)
      expect(singleCase.districtData[0].clubs.chartered).toBe(1)
      expect(singleCase.districtData[0].clubs.suspended).toBe(0)
      expect(singleCase.districtData[0].clubs.distinguished).toBe(0)
      expect(singleCase.reconciliationJob.districtId).toBe('EDGE-SINGLE')
    })

    it('should generate max size edge case correctly', () => {
      const generator = createGenerator()
      const edgeCases = generator.generateEdgeCases()
      const maxCase = edgeCases.find(
        ec => ec.metadata.pattern === 'edge_case_max_size'
      )!

      expect(maxCase).toBeDefined()
      expect(maxCase.districtData[0].clubs.total).toBe(100)
      expect(maxCase.districtData[0].membership.total).toBe(2500)
      expect(maxCase.districtData[0].clubs.distinguished).toBe(80)
      expect(maxCase.reconciliationJob.districtId).toBe('EDGE-MAX')
    })

    it('should generate all distinguished edge case correctly', () => {
      const generator = createGenerator()
      const edgeCases = generator.generateEdgeCases()
      const allDistCase = edgeCases.find(
        ec => ec.metadata.pattern === 'edge_case_all_distinguished'
      )!

      expect(allDistCase).toBeDefined()
      const data = allDistCase.districtData[0]
      expect(data.clubs.distinguished).toBe(data.clubs.total)
      expect(allDistCase.reconciliationJob.districtId).toBe('EDGE-ALL-DIST')
    })

    it('should generate no distinguished edge case correctly', () => {
      const generator = createGenerator()
      const edgeCases = generator.generateEdgeCases()
      const noDistCase = edgeCases.find(
        ec => ec.metadata.pattern === 'edge_case_no_distinguished'
      )!

      expect(noDistCase).toBeDefined()
      expect(noDistCase.districtData[0].clubs.distinguished).toBe(0)
      expect(noDistCase.reconciliationJob.districtId).toBe('EDGE-NO-DIST')
    })
  })

  describe('data validation', () => {
    it('should generate valid district statistics', () => {
      const generator = createGenerator()
      const testData = generator.generateTestData('gradual_growth', 8888)

      testData.districtData.forEach(data => {
        // Basic structure validation
        expect(data.districtId).toBeTruthy()
        expect(data.asOfDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)

        // Clubs validation
        expect(data.clubs.total).toBeGreaterThan(0)
        expect(data.clubs.chartered).toBeGreaterThanOrEqual(0)
        expect(data.clubs.suspended).toBeGreaterThanOrEqual(0)
        expect(data.clubs.distinguished).toBeGreaterThanOrEqual(0)
        expect(data.clubs.distinguished).toBeLessThanOrEqual(data.clubs.total)

        // Membership validation
        expect(data.membership.total).toBeGreaterThanOrEqual(0)
        expect(data.membership.new).toBeGreaterThanOrEqual(0)
        expect(data.membership.renewed).toBeGreaterThanOrEqual(0)
        expect(data.membership.dual).toBeGreaterThanOrEqual(0)

        // Goals validation
        if (data.goals) {
          expect(data.goals.clubsGoal).toBeGreaterThan(0)
          expect(data.goals.membershipGoal).toBeGreaterThan(0)
          expect(data.goals.distinguishedGoal).toBeGreaterThanOrEqual(0)
        }

        // Performance validation
        if (data.performance) {
          expect(data.performance.distinguishedPercent).toBeGreaterThanOrEqual(
            0
          )
          expect(data.performance.distinguishedPercent).toBeLessThanOrEqual(100)
        }
      })
    })

    it('should generate valid reconciliation jobs', () => {
      const generator = createGenerator()
      const testData = generator.generateTestData('sudden_change', 9999)
      const job = testData.reconciliationJob

      expect(job.id).toBeTruthy()
      expect(job.districtId).toBeTruthy()
      expect(job.targetMonth).toMatch(/^\d{4}-\d{2}$/)
      expect(job.status).toBe('active')
      expect(job.startDate).toBeInstanceOf(Date)
      expect(job.maxEndDate).toBeInstanceOf(Date)
      expect(job.maxEndDate.getTime()).toBeGreaterThan(job.startDate.getTime())
      expect(job.config).toBeDefined()
      expect(job.metadata).toBeDefined()
      expect(job.metadata.triggeredBy).toBe('manual')
    })

    it('should generate valid configurations', () => {
      const generator = createGenerator()
      const testData = generator.generateTestData('volatile_changes', 7777)
      const config = testData.config

      expect(config.maxReconciliationDays).toBeGreaterThan(0)
      expect(config.stabilityPeriodDays).toBeGreaterThan(0)
      expect(config.checkFrequencyHours).toBeGreaterThan(0)
      expect(
        config.significantChangeThresholds.membershipPercent
      ).toBeGreaterThan(0)
      expect(
        config.significantChangeThresholds.clubCountAbsolute
      ).toBeGreaterThan(0)
      expect(
        config.significantChangeThresholds.distinguishedPercent
      ).toBeGreaterThan(0)
      expect(typeof config.autoExtensionEnabled).toBe('boolean')
      expect(config.maxExtensionDays).toBeGreaterThanOrEqual(0)
    })

    it('should generate valid change events', () => {
      const generator = createGenerator()
      const testData = generator.generateTestData('gradual_growth', 6666)

      testData.expectedChanges.forEach(change => {
        expect(change.hasChanges).toBe(true)
        expect(change.changedFields.length).toBeGreaterThan(0)
        expect(change.timestamp).toBeInstanceOf(Date)
        expect(change.sourceDataDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)

        if (change.membershipChange) {
          expect(change.membershipChange.previous).toBeGreaterThan(0)
          expect(change.membershipChange.current).toBeGreaterThan(0)
          expect(typeof change.membershipChange.percentChange).toBe('number')
        }

        if (change.clubCountChange) {
          expect(change.clubCountChange.previous).toBeGreaterThan(0)
          expect(change.clubCountChange.current).toBeGreaterThan(0)
          expect(typeof change.clubCountChange.absoluteChange).toBe('number')
        }

        if (change.distinguishedChange) {
          expect(change.distinguishedChange.previous).toBeDefined()
          expect(change.distinguishedChange.current).toBeDefined()
          expect(typeof change.distinguishedChange.percentChange).toBe('number')
        }
      })
    })
  })

  describe('seeded random generation', () => {
    it('should produce consistent results with same seed', () => {
      const generator = createGenerator()
      const seed = 12345

      // Generate same pattern multiple times with same seed
      const results = []
      for (let i = 0; i < 5; i++) {
        results.push(generator.generateTestData('stable_no_changes', seed))
      }

      // All results should be identical
      const firstResult = results[0]
      results.slice(1).forEach(result => {
        expect(result.districtData[0].membership.total).toBe(
          firstResult.districtData[0].membership.total
        )
        expect(result.districtData[0].clubs.total).toBe(
          firstResult.districtData[0].clubs.total
        )
        expect(result.config.maxReconciliationDays).toBe(
          firstResult.config.maxReconciliationDays
        )
      })
    })

    it('should produce different results with different seeds', () => {
      const generator = createGenerator()
      const results = []
      for (let i = 0; i < 10; i++) {
        results.push(generator.generateTestData('gradual_growth', 1000 + i))
      }

      // Check that at least some results are different
      const membershipTotals = results.map(
        r => r.districtData[0].membership.total
      )
      const uniqueTotals = new Set(membershipTotals)

      expect(uniqueTotals.size).toBeGreaterThan(1) // Should have some variation
    })
  })
})
