/**
 * Test Data Generation for Reconciliation Testing
 * 
 * Generates realistic test data for various reconciliation patterns and scenarios.
 * Supports property-based testing and edge case generation.
 */

import { logger } from './logger.js'
import type { 
  ReconciliationJob,
  ReconciliationConfig,
  DataChanges,
  ReconciliationEntry,
  DistinguishedCounts
} from '../types/reconciliation.js'
import type { DistrictStatistics } from '../types/districts.js'

export interface TestDataPattern {
  name: string
  description: string
  generator: (seed?: number) => TestDataSet
}

export interface TestDataSet {
  districtData: DistrictStatistics[]
  expectedChanges: DataChanges[]
  reconciliationJob: ReconciliationJob
  config: ReconciliationConfig
  metadata: {
    pattern: string
    seed: number
    generatedAt: Date
    expectedOutcome: string
  }
}

export interface PropertyTestCase {
  name: string
  property: string
  inputs: any[]
  expectedResult: any
  seed: number
}

export class ReconciliationTestDataGenerator {
  private patterns: Map<string, TestDataPattern> = new Map()
  private seedCounter: number = 1000

  constructor() {
    this.initializePatterns()
  }

  /**
   * Generate test data for a specific pattern
   */
  generateTestData(patternName: string, seed?: number): TestDataSet {
    const pattern = this.patterns.get(patternName)
    if (!pattern) {
      throw new Error(`Test data pattern not found: ${patternName}`)
    }

    const actualSeed = seed ?? this.getNextSeed()
    logger.debug('Generating test data', { pattern: patternName, seed: actualSeed })

    return pattern.generator(actualSeed)
  }

  /**
   * Generate multiple test data sets for comprehensive testing
   */
  generateBatchTestData(patternNames: string[], count: number = 10): TestDataSet[] {
    const testSets: TestDataSet[] = []

    for (const patternName of patternNames) {
      for (let i = 0; i < count; i++) {
        try {
          const testData = this.generateTestData(patternName)
          testSets.push(testData)
        } catch (error) {
          logger.warn('Failed to generate test data', { 
            pattern: patternName, 
            iteration: i,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      }
    }

    return testSets
  }

  /**
   * Generate property-based test cases
   */
  generatePropertyTestCases(property: string, count: number = 100): PropertyTestCase[] {
    const testCases: PropertyTestCase[] = []

    for (let i = 0; i < count; i++) {
      const seed = this.getNextSeed()
      const testCase = this.generatePropertyTestCase(property, seed)
      if (testCase) {
        testCases.push(testCase)
      }
    }

    logger.debug('Generated property test cases', { property, count: testCases.length })
    return testCases
  }

  /**
   * Generate edge case test data
   */
  generateEdgeCases(): TestDataSet[] {
    const edgeCases: TestDataSet[] = []

    // Edge case 1: Zero membership district
    edgeCases.push(this.generateZeroMembershipCase())

    // Edge case 2: Single club district
    edgeCases.push(this.generateSingleClubCase())

    // Edge case 3: Maximum size district
    edgeCases.push(this.generateMaxSizeCase())

    // Edge case 4: All clubs distinguished
    edgeCases.push(this.generateAllDistinguishedCase())

    // Edge case 5: No distinguished clubs
    edgeCases.push(this.generateNoDistinguishedCase())

    logger.debug('Generated edge cases', { count: edgeCases.length })
    return edgeCases
  }

  /**
   * Get all available patterns
   */
  getAvailablePatterns(): string[] {
    return Array.from(this.patterns.keys())
  }

  /**
   * Initialize test data patterns
   */
  private initializePatterns(): void {
    // Pattern 1: Stable data with no changes
    this.patterns.set('stable_no_changes', {
      name: 'stable_no_changes',
      description: 'Data remains completely stable throughout reconciliation',
      generator: (seed = 1000) => this.generateStablePattern(seed)
    })

    // Pattern 2: Gradual membership growth
    this.patterns.set('gradual_growth', {
      name: 'gradual_growth',
      description: 'Gradual membership growth over reconciliation period',
      generator: (seed = 1000) => this.generateGradualGrowthPattern(seed)
    })

    // Pattern 3: Sudden significant change
    this.patterns.set('sudden_change', {
      name: 'sudden_change',
      description: 'Sudden significant change in the middle of reconciliation',
      generator: (seed = 1000) => this.generateSuddenChangePattern(seed)
    })

    // Pattern 4: Volatile data with frequent changes
    this.patterns.set('volatile_changes', {
      name: 'volatile_changes',
      description: 'Frequent small changes throughout reconciliation',
      generator: (seed = 1000) => this.generateVolatilePattern(seed)
    })

    // Pattern 5: Late stabilization
    this.patterns.set('late_stabilization', {
      name: 'late_stabilization',
      description: 'Changes continue until near the end, then stabilize',
      generator: (seed = 1000) => this.generateLateStabilizationPattern(seed)
    })

    // Pattern 6: Club count changes
    this.patterns.set('club_changes', {
      name: 'club_changes',
      description: 'Focus on club count changes (charter/suspend)',
      generator: (seed = 1000) => this.generateClubChangesPattern(seed)
    })

    // Pattern 7: Distinguished status changes
    this.patterns.set('distinguished_changes', {
      name: 'distinguished_changes',
      description: 'Focus on distinguished club status changes',
      generator: (seed = 1000) => this.generateDistinguishedChangesPattern(seed)
    })

    logger.debug('Test data patterns initialized', { count: this.patterns.size })
  }

  /**
   * Generate stable pattern (no changes)
   */
  private generateStablePattern(seed: number): TestDataSet {
    const rng = this.createSeededRNG(seed)
    const baseData = this.generateBaseDistrictData('TEST-STABLE', rng)
    
    // Generate 10 days of identical data
    const districtData: DistrictStatistics[] = []
    for (let day = 0; day < 10; day++) {
      districtData.push({
        ...baseData,
        asOfDate: this.addDays(baseData.asOfDate, day)
      })
    }

    return {
      districtData,
      expectedChanges: [], // No changes expected
      reconciliationJob: this.generateTestJob('stable-job', 'TEST-STABLE', seed),
      config: this.generateTestConfig(seed),
      metadata: {
        pattern: 'stable_no_changes',
        seed,
        generatedAt: new Date(),
        expectedOutcome: 'completed_quickly'
      }
    }
  }

  /**
   * Generate gradual growth pattern
   */
  private generateGradualGrowthPattern(seed: number): TestDataSet {
    const rng = this.createSeededRNG(seed)
    const baseData = this.generateBaseDistrictData('TEST-GROWTH', rng)
    
    const districtData: DistrictStatistics[] = []
    const expectedChanges: DataChanges[] = []
    let currentData = { ...baseData }

    for (let day = 0; day < 12; day++) {
      if (day > 0 && day % 2 === 0) {
        // Gradual membership increase every 2 days
        const membershipIncrease = Math.floor(rng() * 5) + 1
        const previousData = { ...currentData }
        
        currentData = {
          ...currentData,
          membership: {
            ...currentData.membership,
            total: currentData.membership.total + membershipIncrease
          }
        }

        // Record expected change
        expectedChanges.push({
          hasChanges: true,
          changedFields: ['membership'],
          membershipChange: {
            previous: previousData.membership.total,
            current: currentData.membership.total,
            percentChange: (membershipIncrease / previousData.membership.total) * 100
          },
          timestamp: new Date(),
          sourceDataDate: this.addDays(baseData.asOfDate, day)
        })
      }

      districtData.push({
        ...currentData,
        asOfDate: this.addDays(baseData.asOfDate, day)
      })
    }

    return {
      districtData,
      expectedChanges,
      reconciliationJob: this.generateTestJob('growth-job', 'TEST-GROWTH', seed),
      config: this.generateTestConfig(seed),
      metadata: {
        pattern: 'gradual_growth',
        seed,
        generatedAt: new Date(),
        expectedOutcome: 'completed_with_changes'
      }
    }
  }

  /**
   * Generate sudden change pattern
   */
  private generateSuddenChangePattern(seed: number): TestDataSet {
    const rng = this.createSeededRNG(seed)
    const baseData = this.generateBaseDistrictData('TEST-SUDDEN', rng)
    
    const districtData: DistrictStatistics[] = []
    const expectedChanges: DataChanges[] = []
    let currentData = { ...baseData }

    for (let day = 0; day < 15; day++) {
      if (day === 8) {
        // Sudden significant change on day 8
        const previousData = { ...currentData }
        const membershipChange = Math.floor(rng() * 20) + 10 // 10-30 member change
        const clubChange = Math.floor(rng() * 3) + 1 // 1-3 club change

        currentData = {
          ...currentData,
          membership: {
            ...currentData.membership,
            total: currentData.membership.total + membershipChange
          },
          clubs: {
            ...currentData.clubs,
            total: currentData.clubs.total + clubChange
          }
        }

        // Record expected change
        expectedChanges.push({
          hasChanges: true,
          changedFields: ['membership', 'clubCount'],
          membershipChange: {
            previous: previousData.membership.total,
            current: currentData.membership.total,
            percentChange: (membershipChange / previousData.membership.total) * 100
          },
          clubCountChange: {
            previous: previousData.clubs.total,
            current: currentData.clubs.total,
            absoluteChange: clubChange
          },
          timestamp: new Date(),
          sourceDataDate: this.addDays(baseData.asOfDate, day)
        })
      }

      districtData.push({
        ...currentData,
        asOfDate: this.addDays(baseData.asOfDate, day)
      })
    }

    return {
      districtData,
      expectedChanges,
      reconciliationJob: this.generateTestJob('sudden-job', 'TEST-SUDDEN', seed),
      config: this.generateTestConfig(seed),
      metadata: {
        pattern: 'sudden_change',
        seed,
        generatedAt: new Date(),
        expectedOutcome: 'extended_due_to_late_change'
      }
    }
  }

  /**
   * Generate volatile pattern with frequent changes
   */
  private generateVolatilePattern(seed: number): TestDataSet {
    const rng = this.createSeededRNG(seed)
    const baseData = this.generateBaseDistrictData('TEST-VOLATILE', rng)
    
    const districtData: DistrictStatistics[] = []
    const expectedChanges: DataChanges[] = []
    let currentData = { ...baseData }

    for (let day = 0; day < 18; day++) {
      if (day > 0 && rng() < 0.6) { // 60% chance of change each day
        const previousData = { ...currentData }
        const membershipChange = Math.floor(rng() * 6) - 3 // -3 to +3 change
        
        if (membershipChange !== 0) {
          currentData = {
            ...currentData,
            membership: {
              ...currentData.membership,
              total: Math.max(1, currentData.membership.total + membershipChange)
            }
          }

          expectedChanges.push({
            hasChanges: true,
            changedFields: ['membership'],
            membershipChange: {
              previous: previousData.membership.total,
              current: currentData.membership.total,
              percentChange: (membershipChange / previousData.membership.total) * 100
            },
            timestamp: new Date(),
            sourceDataDate: this.addDays(baseData.asOfDate, day)
          })
        }
      }

      districtData.push({
        ...currentData,
        asOfDate: this.addDays(baseData.asOfDate, day)
      })
    }

    return {
      districtData,
      expectedChanges,
      reconciliationJob: this.generateTestJob('volatile-job', 'TEST-VOLATILE', seed),
      config: this.generateTestConfig(seed),
      metadata: {
        pattern: 'volatile_changes',
        seed,
        generatedAt: new Date(),
        expectedOutcome: 'extended_due_to_volatility'
      }
    }
  }

  /**
   * Generate late stabilization pattern
   */
  private generateLateStabilizationPattern(seed: number): TestDataSet {
    const rng = this.createSeededRNG(seed)
    const baseData = this.generateBaseDistrictData('TEST-LATE', rng)
    
    const districtData: DistrictStatistics[] = []
    const expectedChanges: DataChanges[] = []
    let currentData = { ...baseData }

    for (let day = 0; day < 20; day++) {
      // Changes occur until day 15, then stabilize
      if (day > 0 && day <= 15 && day % 3 === 0) {
        const previousData = { ...currentData }
        const membershipChange = Math.floor(rng() * 8) + 1
        
        currentData = {
          ...currentData,
          membership: {
            ...currentData.membership,
            total: currentData.membership.total + membershipChange
          }
        }

        expectedChanges.push({
          hasChanges: true,
          changedFields: ['membership'],
          membershipChange: {
            previous: previousData.membership.total,
            current: currentData.membership.total,
            percentChange: (membershipChange / previousData.membership.total) * 100
          },
          timestamp: new Date(),
          sourceDataDate: this.addDays(baseData.asOfDate, day)
        })
      }

      districtData.push({
        ...currentData,
        asOfDate: this.addDays(baseData.asOfDate, day)
      })
    }

    return {
      districtData,
      expectedChanges,
      reconciliationJob: this.generateTestJob('late-job', 'TEST-LATE', seed),
      config: this.generateTestConfig(seed),
      metadata: {
        pattern: 'late_stabilization',
        seed,
        generatedAt: new Date(),
        expectedOutcome: 'completed_after_extension'
      }
    }
  }

  /**
   * Generate club changes pattern
   */
  private generateClubChangesPattern(seed: number): TestDataSet {
    const rng = this.createSeededRNG(seed)
    const baseData = this.generateBaseDistrictData('TEST-CLUBS', rng)
    
    const districtData: DistrictStatistics[] = []
    const expectedChanges: DataChanges[] = []
    let currentData = { ...baseData }

    for (let day = 0; day < 12; day++) {
      if (day > 0 && day % 4 === 0) {
        const previousData = { ...currentData }
        const clubChange = Math.floor(rng() * 3) - 1 // -1, 0, or +1
        
        if (clubChange !== 0) {
          const newTotal = Math.max(1, currentData.clubs.total + clubChange)
          // Ensure distinguished count doesn't exceed new total
          const adjustedDistinguished = Math.min(currentData.clubs.distinguished, newTotal)
          
          currentData = {
            ...currentData,
            clubs: {
              ...currentData.clubs,
              total: newTotal,
              distinguished: adjustedDistinguished
            },
            performance: {
              ...currentData.performance,
              distinguishedPercent: (adjustedDistinguished / newTotal) * 100,
              membershipNet: currentData.performance?.membershipNet ?? 0,
              clubsNet: currentData.performance?.clubsNet ?? 0
            }
          }

          expectedChanges.push({
            hasChanges: true,
            changedFields: ['clubCount'],
            clubCountChange: {
              previous: previousData.clubs.total,
              current: currentData.clubs.total,
              absoluteChange: clubChange
            },
            timestamp: new Date(),
            sourceDataDate: this.addDays(baseData.asOfDate, day)
          })
        }
      }

      districtData.push({
        ...currentData,
        asOfDate: this.addDays(baseData.asOfDate, day)
      })
    }

    return {
      districtData,
      expectedChanges,
      reconciliationJob: this.generateTestJob('clubs-job', 'TEST-CLUBS', seed),
      config: this.generateTestConfig(seed),
      metadata: {
        pattern: 'club_changes',
        seed,
        generatedAt: new Date(),
        expectedOutcome: 'completed_with_club_changes'
      }
    }
  }

  /**
   * Generate distinguished changes pattern
   */
  private generateDistinguishedChangesPattern(seed: number): TestDataSet {
    const rng = this.createSeededRNG(seed)
    const baseData = this.generateBaseDistrictData('TEST-DIST', rng)
    
    const districtData: DistrictStatistics[] = []
    const expectedChanges: DataChanges[] = []
    let currentData = { ...baseData }

    for (let day = 0; day < 14; day++) {
      if (day > 0 && day % 3 === 0) {
        const previousData = { ...currentData }
        const distinguishedChange = Math.floor(rng() * 5) - 2 // -2 to +2
        
        if (distinguishedChange !== 0) {
          const newDistinguished = Math.max(0, 
            Math.min(currentData.clubs.total, currentData.clubs.distinguished + distinguishedChange)
          )

          currentData = {
            ...currentData,
            clubs: {
              ...currentData.clubs,
              distinguished: newDistinguished
            },
            performance: {
              ...currentData.performance,
              distinguishedPercent: (newDistinguished / currentData.clubs.total) * 100,
              membershipNet: currentData.performance?.membershipNet ?? 0,
              clubsNet: currentData.performance?.clubsNet ?? 0
            }
          }

          const percentChange = previousData.clubs.distinguished > 0 
            ? ((newDistinguished - previousData.clubs.distinguished) / previousData.clubs.distinguished) * 100 
            : 0

          expectedChanges.push({
            hasChanges: true,
            changedFields: ['distinguished'],
            distinguishedChange: {
              previous: this.extractDistinguishedCounts(previousData),
              current: this.extractDistinguishedCounts(currentData),
              percentChange
            },
            timestamp: new Date(),
            sourceDataDate: this.addDays(baseData.asOfDate, day)
          })
        }
      }

      districtData.push({
        ...currentData,
        asOfDate: this.addDays(baseData.asOfDate, day)
      })
    }

    return {
      districtData,
      expectedChanges,
      reconciliationJob: this.generateTestJob('dist-job', 'TEST-DIST', seed),
      config: this.generateTestConfig(seed),
      metadata: {
        pattern: 'distinguished_changes',
        seed,
        generatedAt: new Date(),
        expectedOutcome: 'completed_with_distinguished_changes'
      }
    }
  }

  /**
   * Generate property test case
   */
  private generatePropertyTestCase(property: string, seed: number): PropertyTestCase | null {
    const rng = this.createSeededRNG(seed)

    switch (property) {
      case 'change_detection_accuracy':
        return {
          name: `change_detection_${seed}`,
          property: 'change_detection_accuracy',
          inputs: [
            this.generateBaseDistrictData('PROP-TEST', rng),
            this.generateModifiedDistrictData('PROP-TEST', rng)
          ],
          expectedResult: 'should_detect_all_changes',
          seed
        }

      case 'stability_period_calculation':
        return {
          name: `stability_${seed}`,
          property: 'stability_period_calculation',
          inputs: [
            this.generateRandomTimeline(rng),
            Math.floor(rng() * 5) + 1 // stability period days
          ],
          expectedResult: 'correct_stability_count',
          seed
        }

      case 'configuration_validation':
        return {
          name: `config_${seed}`,
          property: 'configuration_validation',
          inputs: [
            this.generateRandomConfig(rng)
          ],
          expectedResult: 'valid_or_specific_error',
          seed
        }

      default:
        return null
    }
  }

  /**
   * Generate edge case: Zero membership district
   */
  private generateZeroMembershipCase(): TestDataSet {
    const baseData = this.generateBaseDistrictData('EDGE-ZERO', () => 0.5)
    baseData.membership.total = 0
    baseData.membership.new = 0
    baseData.membership.renewed = 0
    baseData.membership.dual = 0

    return {
      districtData: [baseData],
      expectedChanges: [],
      reconciliationJob: this.generateTestJob('zero-membership', 'EDGE-ZERO', 9999),
      config: this.generateTestConfig(9999),
      metadata: {
        pattern: 'edge_case_zero_membership',
        seed: 9999,
        generatedAt: new Date(),
        expectedOutcome: 'handle_gracefully'
      }
    }
  }

  /**
   * Generate edge case: Single club district
   */
  private generateSingleClubCase(): TestDataSet {
    const baseData = this.generateBaseDistrictData('EDGE-SINGLE', () => 0.5)
    baseData.clubs.total = 1
    baseData.clubs.chartered = 1
    baseData.clubs.suspended = 0
    baseData.clubs.distinguished = 0
    baseData.membership.total = 15
    // Update performance percentage to match the modified data
    baseData.performance!.distinguishedPercent = (baseData.clubs.distinguished / baseData.clubs.total) * 100

    return {
      districtData: [baseData],
      expectedChanges: [],
      reconciliationJob: this.generateTestJob('single-club', 'EDGE-SINGLE', 9998),
      config: this.generateTestConfig(9998),
      metadata: {
        pattern: 'edge_case_single_club',
        seed: 9998,
        generatedAt: new Date(),
        expectedOutcome: 'handle_gracefully'
      }
    }
  }

  /**
   * Generate edge case: Maximum size district
   */
  private generateMaxSizeCase(): TestDataSet {
    const baseData = this.generateBaseDistrictData('EDGE-MAX', () => 0.9)
    baseData.clubs.total = 100
    baseData.clubs.chartered = 98
    baseData.clubs.suspended = 2
    baseData.clubs.distinguished = 80
    baseData.membership.total = 2500
    // Update performance percentage to match the modified data
    baseData.performance!.distinguishedPercent = (baseData.clubs.distinguished / baseData.clubs.total) * 100

    return {
      districtData: [baseData],
      expectedChanges: [],
      reconciliationJob: this.generateTestJob('max-size', 'EDGE-MAX', 9997),
      config: this.generateTestConfig(9997),
      metadata: {
        pattern: 'edge_case_max_size',
        seed: 9997,
        generatedAt: new Date(),
        expectedOutcome: 'handle_gracefully'
      }
    }
  }

  /**
   * Generate edge case: All clubs distinguished
   */
  private generateAllDistinguishedCase(): TestDataSet {
    const baseData = this.generateBaseDistrictData('EDGE-ALL-DIST', () => 0.7)
    baseData.clubs.distinguished = baseData.clubs.total
    // Update performance percentage to match the modified data
    baseData.performance!.distinguishedPercent = (baseData.clubs.distinguished / baseData.clubs.total) * 100

    return {
      districtData: [baseData],
      expectedChanges: [],
      reconciliationJob: this.generateTestJob('all-distinguished', 'EDGE-ALL-DIST', 9996),
      config: this.generateTestConfig(9996),
      metadata: {
        pattern: 'edge_case_all_distinguished',
        seed: 9996,
        generatedAt: new Date(),
        expectedOutcome: 'handle_gracefully'
      }
    }
  }

  /**
   * Generate edge case: No distinguished clubs
   */
  private generateNoDistinguishedCase(): TestDataSet {
    const baseData = this.generateBaseDistrictData('EDGE-NO-DIST', () => 0.3)
    baseData.clubs.distinguished = 0
    // Update performance percentage to match the modified data
    baseData.performance!.distinguishedPercent = (baseData.clubs.distinguished / baseData.clubs.total) * 100

    return {
      districtData: [baseData],
      expectedChanges: [],
      reconciliationJob: this.generateTestJob('no-distinguished', 'EDGE-NO-DIST', 9995),
      config: this.generateTestConfig(9995),
      metadata: {
        pattern: 'edge_case_no_distinguished',
        seed: 9995,
        generatedAt: new Date(),
        expectedOutcome: 'handle_gracefully'
      }
    }
  }

  /**
   * Helper methods
   */
  private createSeededRNG(seed: number): () => number {
    let state = seed
    return () => {
      state = (state * 1664525 + 1013904223) % 4294967296
      return state / 4294967296
    }
  }

  private getNextSeed(): number {
    return this.seedCounter++
  }

  private generateBaseDistrictData(districtId: string, rng: () => number): DistrictStatistics {
    const clubCount = Math.floor(rng() * 50) + 20
    const membership = clubCount * (Math.floor(rng() * 10) + 15)
    const distinguished = Math.floor(clubCount * rng() * 0.5)

    return {
      districtId,
      asOfDate: '2024-01-31',
      clubs: {
        total: clubCount,
        active: clubCount - Math.floor(rng() * 2),
        chartered: clubCount - Math.floor(rng() * 3),
        suspended: Math.floor(rng() * 3),
        ineligible: Math.floor(rng() * 2),
        low: Math.floor(rng() * 2),
        distinguished
      },
      membership: {
        total: membership,
        change: Math.floor(rng() * 20) - 10,
        changePercent: (rng() * 4) - 2,
        byClub: [],
        new: Math.floor(membership * 0.1),
        renewed: Math.floor(membership * 0.8),
        dual: Math.floor(membership * 0.05)
      },
      education: {
        totalAwards: Math.floor(rng() * 50),
        byType: [],
        topClubs: []
      },
      goals: {
        clubsGoal: clubCount + Math.floor(rng() * 5),
        membershipGoal: membership + Math.floor(rng() * 50),
        distinguishedGoal: Math.floor(clubCount * 0.4)
      },
      performance: {
        clubsNet: Math.floor(rng() * 3) - 1,
        membershipNet: Math.floor(rng() * 20) - 10,
        distinguishedPercent: (distinguished / clubCount) * 100
      }
    }
  }

  private generateModifiedDistrictData(districtId: string, rng: () => number): DistrictStatistics {
    const baseData = this.generateBaseDistrictData(districtId, rng)
    
    // Apply random modifications
    baseData.membership.total += Math.floor(rng() * 10) - 5
    baseData.clubs.total += Math.floor(rng() * 3) - 1
    baseData.clubs.distinguished += Math.floor(rng() * 3) - 1

    // Ensure distinguished count doesn't exceed total clubs
    baseData.clubs.distinguished = Math.max(0, Math.min(baseData.clubs.total, baseData.clubs.distinguished))

    // Recalculate performance percentage to match the modified data
    if (baseData.clubs.total > 0) {
      baseData.performance!.distinguishedPercent = (baseData.clubs.distinguished / baseData.clubs.total) * 100
    } else {
      baseData.performance!.distinguishedPercent = 0
    }

    return baseData
  }

  private generateTestJob(jobId: string, districtId: string, seed: number): ReconciliationJob {
    return {
      id: `test-${jobId}-${seed}`,
      districtId,
      targetMonth: '2024-01',
      status: 'active',
      startDate: new Date(),
      maxEndDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      progress: {
        phase: 'monitoring',
        completionPercentage: Math.floor(seed * 100)
      },
      triggeredBy: 'manual',
      config: this.generateTestConfig(seed),
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        triggeredBy: 'manual'
      }
    }
  }

  private generateTestConfig(seed: number): ReconciliationConfig {
    const rng = this.createSeededRNG(seed)
    
    return {
      maxReconciliationDays: Math.floor(rng() * 10) + 10, // 10-20 days
      stabilityPeriodDays: Math.floor(rng() * 3) + 2, // 2-5 days
      checkFrequencyHours: Math.floor(rng() * 24) + 12, // 12-36 hours
      significantChangeThresholds: {
        membershipPercent: rng() * 2 + 0.5, // 0.5-2.5%
        clubCountAbsolute: Math.floor(rng() * 3) + 1, // 1-3 clubs
        distinguishedPercent: rng() * 3 + 1 // 1-4%
      },
      autoExtensionEnabled: rng() > 0.3, // 70% chance enabled
      maxExtensionDays: Math.floor(rng() * 5) + 3 // 3-8 days
    }
  }

  private generateRandomTimeline(rng: () => number): ReconciliationEntry[] {
    const entries: ReconciliationEntry[] = []
    const entryCount = Math.floor(rng() * 15) + 5 // 5-20 entries

    for (let i = 0; i < entryCount; i++) {
      entries.push({
        date: new Date(Date.now() + i * 24 * 60 * 60 * 1000),
        sourceDataDate: this.addDays('2024-01-31', i),
        changes: {
          hasChanges: rng() > 0.5,
          changedFields: rng() > 0.5 ? ['membership'] : [],
          timestamp: new Date(),
          sourceDataDate: this.addDays('2024-01-31', i)
        },
        isSignificant: rng() > 0.8, // 20% chance of significant change
        cacheUpdated: rng() > 0.3
      })
    }

    return entries
  }

  private generateRandomConfig(rng: () => number): Partial<ReconciliationConfig> {
    return {
      maxReconciliationDays: Math.floor(rng() * 50) - 10, // Can be negative (invalid)
      stabilityPeriodDays: Math.floor(rng() * 20) - 5, // Can be negative (invalid)
      checkFrequencyHours: Math.floor(rng() * 100) - 10, // Can be negative (invalid)
      significantChangeThresholds: {
        membershipPercent: rng() * 20 - 5, // Can be negative (invalid)
        clubCountAbsolute: Math.floor(rng() * 10) - 3, // Can be negative (invalid)
        distinguishedPercent: rng() * 30 - 10 // Can be negative (invalid)
      },
      autoExtensionEnabled: rng() > 0.5,
      maxExtensionDays: Math.floor(rng() * 30) - 5 // Can be negative (invalid)
    }
  }

  private extractDistinguishedCounts(data: DistrictStatistics): DistinguishedCounts {
    const total = data.clubs.distinguished
    return {
      select: Math.floor(total * 0.15),
      distinguished: Math.floor(total * 0.8),
      president: Math.floor(total * 0.05),
      total
    }
  }

  private addDays(dateString: string, days: number): string {
    const date = new Date(dateString)
    date.setDate(date.getDate() + days)
    return date.toISOString().split('T')[0]
  }
}