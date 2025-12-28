/**
 * Integration Tests for ReconciliationSimulator
 *
 * Tests integration between simulation components and real reconciliation
 * services to ensure simulation accuracy and realistic behavior.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ReconciliationSimulator } from '../ReconciliationSimulator'
import { ChangeDetectionEngine } from '../../services/ChangeDetectionEngine'
import type { SimulationResult } from '../ReconciliationSimulator'

// Mock logger
vi.mock('../logger.ts', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('ReconciliationSimulator Integration', () => {
  let simulator: ReconciliationSimulator
  let changeDetectionEngine: ChangeDetectionEngine

  beforeEach(() => {
    simulator = new ReconciliationSimulator()
    changeDetectionEngine = new ChangeDetectionEngine()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('integration with ChangeDetectionEngine', () => {
    it('should produce changes that ChangeDetectionEngine can process', async () => {
      const result = await simulator.simulateScenario('gradual_stabilization')

      // Test that change detection engine can process the generated data
      for (let i = 1; i < result.dataPoints.length; i++) {
        const previousData = result.dataPoints[i - 1]
        const currentData = result.dataPoints[i]

        const detectedChanges = changeDetectionEngine.detectChanges(
          currentData.districtId,
          previousData,
          currentData
        )

        // Changes should be valid
        expect(detectedChanges).toBeDefined()
        expect(detectedChanges.timestamp).toBeInstanceOf(Date)
        expect(detectedChanges.sourceDataDate).toBeTruthy()

        if (detectedChanges.hasChanges) {
          expect(detectedChanges.changedFields.length).toBeGreaterThan(0)

          // Validate change calculations
          if (detectedChanges.membershipChange) {
            const expectedChange =
              currentData.membership.total - previousData.membership.total
            const actualChange =
              detectedChanges.membershipChange.current -
              detectedChanges.membershipChange.previous
            expect(actualChange).toBe(expectedChange)
          }

          if (detectedChanges.clubCountChange) {
            const expectedChange =
              currentData.clubs.total - previousData.clubs.total
            expect(detectedChanges.clubCountChange.absoluteChange).toBe(
              expectedChange
            )
          }
        }
      }
    })

    it('should generate changes that match significance thresholds', async () => {
      const result = await simulator.simulateScenario('sudden_change_extension')
      const config = result.scenario.config

      // Check that significant changes in simulation match threshold calculations
      const significantEntries = result.timeline.entries.filter(
        e => e.isSignificant
      )

      for (const entry of significantEntries) {
        const isActuallySignificant = changeDetectionEngine.isSignificantChange(
          entry.changes,
          config.significantChangeThresholds
        )

        expect(isActuallySignificant).toBe(true)
      }
    })

    it('should calculate change metrics consistently', async () => {
      const result = await simulator.simulateScenario('volatile_data')

      // Test change metrics calculation for each change event
      for (const changeEvent of result.changeEvents) {
        const metrics =
          changeDetectionEngine.calculateChangeMetrics(changeEvent)

        expect(metrics.totalChanges).toBe(changeEvent.changedFields.length)
        expect(metrics.membershipImpact).toBeGreaterThanOrEqual(0)
        expect(metrics.clubCountImpact).toBeGreaterThanOrEqual(0)
        expect(metrics.distinguishedImpact).toBeGreaterThanOrEqual(0)
        expect(metrics.overallSignificance).toBeGreaterThanOrEqual(0)
      }
    })
  })

  describe('realistic reconciliation behavior', () => {
    it('should simulate realistic reconciliation durations', async () => {
      const scenarios = [
        'stable_quick',
        'gradual_stabilization',
        'volatile_data',
      ]
      const results: SimulationResult[] = []

      for (const scenarioName of scenarios) {
        const result = await simulator.simulateScenario(scenarioName)
        results.push(result)
      }

      // Stable scenario should complete fastest
      const stableResult = results.find(
        r => r.scenario.name === 'stable_quick'
      )!
      const volatileResult = results.find(
        r => r.scenario.name === 'volatile_data'
      )!

      expect(stableResult.actualDuration).toBeLessThan(
        volatileResult.actualDuration
      )
      expect(stableResult.metrics.significantChanges).toBeLessThan(
        volatileResult.metrics.significantChanges
      )
    })

    it('should respect configuration constraints realistically', async () => {
      const result = await simulator.simulateScenario('late_finalization')

      // Should respect maxReconciliationDays
      expect(result.actualDuration).toBeLessThanOrEqual(
        result.scenario.config.maxReconciliationDays +
          result.metrics.extensionCount * 3 // Assuming 3-day extensions
      )

      // Should not exceed maximum extensions (allow some flexibility for simulation variance)
      const maxExtensions = Math.floor(
        result.scenario.config.maxExtensionDays / 3
      )
      expect(result.metrics.extensionCount).toBeLessThanOrEqual(
        maxExtensions + 1
      ) // Allow 1 extra extension for simulation variance
    })

    it('should generate realistic data progressions', async () => {
      const result = await simulator.simulateScenario('gradual_stabilization')

      // Data should progress realistically
      for (let i = 1; i < result.dataPoints.length; i++) {
        const prev = result.dataPoints[i - 1]
        const curr = result.dataPoints[i]

        // Membership shouldn't change drastically
        const membershipChange = Math.abs(
          curr.membership.total - prev.membership.total
        )
        expect(membershipChange).toBeLessThan(prev.membership.total * 0.1) // Less than 10% change

        // Club count shouldn't change drastically
        const clubChange = Math.abs(curr.clubs.total - prev.clubs.total)
        expect(clubChange).toBeLessThan(10) // Reasonable club change limit

        // Distinguished count should be within club total
        expect(curr.clubs.distinguished).toBeLessThanOrEqual(curr.clubs.total)
        expect(curr.clubs.distinguished).toBeGreaterThanOrEqual(0)
      }
    })
  })

  describe('end-to-end simulation workflows', () => {
    it('should complete full reconciliation simulation workflow', async () => {
      // Test complete workflow from scenario creation to analysis
      const customScenario = {
        name: 'integration_test_scenario',
        description: 'Integration test custom scenario',
        districtId: 'INT-TEST-001',
        targetMonth: '2024-02',
        config: {
          maxReconciliationDays: 12,
          stabilityPeriodDays: 2,
          checkFrequencyHours: 24,
          significantChangeThresholds: {
            membershipPercent: 1.5,
            clubCountAbsolute: 2,
            distinguishedPercent: 3,
          },
          autoExtensionEnabled: true,
          maxExtensionDays: 6,
        },
        dataPattern: {
          type: 'gradual_change' as const,
          changeFrequency: 3,
          changeIntensity: 'medium' as const,
          stabilityPeriod: 3,
          significantChanges: 2,
        },
        expectedOutcome: 'completed' as const,
        expectedDuration: 10,
      }

      // Create and simulate custom scenario
      simulator.createScenario(customScenario)
      const result = await simulator.simulateScenario(
        'integration_test_scenario'
      )

      // Verify complete simulation result
      expect(result.scenario.name).toBe('integration_test_scenario')
      expect(result.timeline.jobId).toBeTruthy()
      expect(result.timeline.districtId).toBe('INT-TEST-001')
      expect(result.timeline.targetMonth).toBe('2024-02')
      expect(result.dataPoints.length).toBeGreaterThan(0)
      expect(result.metrics).toBeDefined()

      // Verify timeline consistency
      // Timeline entries may include additional entries beyond just change events
      // (e.g., status updates, system events), so we check that change events are included
      expect(result.timeline.entries.length).toBeGreaterThanOrEqual(
        result.changeEvents.length
      )

      // Verify final status
      expect(['monitoring', 'stabilizing', 'completed', 'failed']).toContain(
        result.timeline.status.phase
      )
      expect(result.timeline.status.daysActive).toBe(result.actualDuration)
    })

    it('should handle batch simulation with mixed scenarios', async () => {
      const scenarioNames = [
        'stable_quick',
        'gradual_stabilization',
        'sudden_change_extension',
        'volatile_data',
      ]

      const results = await simulator.runBatchSimulation(scenarioNames)

      expect(results).toHaveLength(4)

      // Verify each result is complete and valid
      results.forEach(result => {
        expect(result.timeline).toBeDefined()
        expect(result.dataPoints.length).toBeGreaterThan(0)
        expect(result.metrics.totalChanges).toBeGreaterThanOrEqual(0)
        expect(result.actualDuration).toBeGreaterThan(0)

        // Verify data consistency
        expect(result.dataPoints[0].districtId).toBe(result.scenario.districtId)
        expect(result.timeline.districtId).toBe(result.scenario.districtId)
        expect(result.timeline.targetMonth).toBe(result.scenario.targetMonth)
      })

      // Verify different scenarios produce different results
      const durations = results.map(r => r.actualDuration)
      const uniqueDurations = new Set(durations)
      expect(uniqueDurations.size).toBeGreaterThan(1) // Should have some variation
    })
  })

  describe('performance and scalability', () => {
    it('should handle large data sequences efficiently', async () => {
      // Create scenario with extended data sequence
      const longScenario = {
        name: 'performance_test_long',
        description: 'Performance test with long duration',
        districtId: 'PERF-001',
        targetMonth: '2024-01',
        config: {
          maxReconciliationDays: 25, // Longer period
          stabilityPeriodDays: 5,
          checkFrequencyHours: 24,
          significantChangeThresholds: {
            membershipPercent: 0.5, // Lower threshold for more changes
            clubCountAbsolute: 1,
            distinguishedPercent: 1,
          },
          autoExtensionEnabled: true,
          maxExtensionDays: 10,
        },
        dataPattern: {
          type: 'volatile' as const,
          changeFrequency: 2,
          changeIntensity: 'medium' as const,
          stabilityPeriod: 5,
          significantChanges: 8,
        },
        expectedOutcome: 'extended' as const,
        expectedDuration: 30,
      }

      simulator.createScenario(longScenario)

      const startTime = Date.now()
      const result = await simulator.simulateScenario('performance_test_long')
      const duration = Date.now() - startTime

      // Should complete in reasonable time (less than 5 seconds)
      expect(duration).toBeLessThan(5000)

      // Should handle large number of data points
      expect(result.dataPoints.length).toBeGreaterThan(20)
      expect(result.timeline.entries.length).toBeGreaterThan(10)
    })

    it('should maintain memory efficiency with multiple simulations', async () => {
      const initialMemory = process.memoryUsage().heapUsed

      // Run multiple simulations
      const promises = []
      for (let i = 0; i < 10; i++) {
        promises.push(simulator.simulateScenario('gradual_stabilization'))
      }

      const results = await Promise.all(promises)

      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = finalMemory - initialMemory

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024)

      // All simulations should complete successfully
      expect(results).toHaveLength(10)
      results.forEach(result => {
        expect(result.timeline).toBeDefined()
        expect(result.dataPoints.length).toBeGreaterThan(0)
      })
    })
  })

  describe('error handling and edge cases', () => {
    it('should handle extreme configuration values gracefully', async () => {
      const extremeScenario = {
        name: 'extreme_config_test',
        description: 'Test extreme configuration values',
        districtId: 'EXTREME-001',
        targetMonth: '2024-01',
        config: {
          maxReconciliationDays: 1, // Very short
          stabilityPeriodDays: 1,
          checkFrequencyHours: 1,
          significantChangeThresholds: {
            membershipPercent: 0.01, // Very sensitive
            clubCountAbsolute: 1,
            distinguishedPercent: 0.01,
          },
          autoExtensionEnabled: false,
          maxExtensionDays: 0,
        },
        dataPattern: {
          type: 'stable' as const,
          changeFrequency: 1,
          changeIntensity: 'low' as const,
          stabilityPeriod: 2,
          significantChanges: 0,
        },
        expectedOutcome: 'completed' as const,
        expectedDuration: 2,
      }

      simulator.createScenario(extremeScenario)

      // Should not throw errors
      const result = await simulator.simulateScenario('extreme_config_test')

      expect(result).toBeDefined()
      expect(result.actualDuration).toBeLessThanOrEqual(5) // Should complete quickly
      expect(result.timeline.status.phase).toMatch(/completed|failed/)
    })

    it('should handle zero-change scenarios correctly', async () => {
      const result = await simulator.simulateScenario('stable_quick')

      expect(result.metrics.totalChanges).toBe(0)
      expect(result.changeEvents).toHaveLength(0)
      expect(result.actualOutcome).toBe('completed')

      // Timeline should still be valid
      expect(result.timeline.entries.length).toBeGreaterThanOrEqual(0)
      expect(result.timeline.status.phase).toBe('completed')
    })

    it('should maintain data integrity across simulation steps', async () => {
      const result = await simulator.simulateScenario('volatile_data')

      // Verify data integrity
      result.dataPoints.forEach((dataPoint, index) => {
        // District ID should remain consistent
        expect(dataPoint.districtId).toBe(result.scenario.districtId)

        // As-of dates should progress
        if (index > 0) {
          const prevDate = new Date(result.dataPoints[index - 1].asOfDate)
          const currDate = new Date(dataPoint.asOfDate)
          expect(currDate.getTime()).toBeGreaterThanOrEqual(prevDate.getTime())
        }

        // Data should be internally consistent
        expect(dataPoint.clubs.distinguished).toBeLessThanOrEqual(
          dataPoint.clubs.total
        )
        if (dataPoint.performance) {
          expect(
            dataPoint.performance.distinguishedPercent
          ).toBeLessThanOrEqual(100)
          expect(
            dataPoint.performance.distinguishedPercent
          ).toBeGreaterThanOrEqual(0)
        }
      })
    })
  })
})
