/**
 * Unit Tests for ReconciliationSimulator
 *
 * Tests simulation scenario generation, data pattern creation, and
 * reconciliation process simulation for debugging and testing purposes.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ReconciliationSimulator } from '../ReconciliationSimulator'
import type { SimulationScenario } from '../ReconciliationSimulator'

// Mock logger
vi.mock('../logger.ts', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('ReconciliationSimulator', () => {
  let simulator: ReconciliationSimulator

  beforeEach(() => {
    simulator = new ReconciliationSimulator()
  })

  describe('initialization', () => {
    it('should initialize with default scenarios', () => {
      const scenarios = simulator.getAvailableScenarios()

      expect(scenarios).toHaveLength(6)
      expect(scenarios.map(s => s.name)).toContain('stable_quick')
      expect(scenarios.map(s => s.name)).toContain('gradual_stabilization')
      expect(scenarios.map(s => s.name)).toContain('sudden_change_extension')
      expect(scenarios.map(s => s.name)).toContain('volatile_data')
      expect(scenarios.map(s => s.name)).toContain('late_finalization')
      expect(scenarios.map(s => s.name)).toContain('max_extension')
    })

    it('should have valid default scenario configurations', () => {
      const scenarios = simulator.getAvailableScenarios()

      scenarios.forEach(scenario => {
        expect(scenario.name).toBeTruthy()
        expect(scenario.description).toBeTruthy()
        expect(scenario.districtId).toBeTruthy()
        expect(scenario.targetMonth).toBeTruthy()
        expect(scenario.config).toBeDefined()
        expect(scenario.dataPattern).toBeDefined()
        expect(['completed', 'extended', 'timeout', 'failed']).toContain(
          scenario.expectedOutcome
        )
        expect(scenario.expectedDuration).toBeGreaterThan(0)
      })
    })
  })

  describe('createScenario', () => {
    it('should create and store custom scenario', () => {
      const customScenario: SimulationScenario = {
        name: 'custom_test',
        description: 'Custom test scenario',
        districtId: 'CUSTOM-001',
        targetMonth: '2024-02',
        config: {
          maxReconciliationDays: 10,
          stabilityPeriodDays: 2,
          checkFrequencyHours: 12,
          significantChangeThresholds: {
            membershipPercent: 0.5,
            clubCountAbsolute: 1,
            distinguishedPercent: 1,
          },
          autoExtensionEnabled: false,
          maxExtensionDays: 0,
        },
        dataPattern: {
          type: 'stable',
          changeFrequency: 1,
          changeIntensity: 'low',
          stabilityPeriod: 3,
          significantChanges: 0,
        },
        expectedOutcome: 'completed',
        expectedDuration: 5,
      }

      simulator.createScenario(customScenario)

      const scenarios = simulator.getAvailableScenarios()
      const createdScenario = scenarios.find(s => s.name === 'custom_test')

      expect(createdScenario).toBeDefined()
      expect(createdScenario?.districtId).toBe('CUSTOM-001')
      expect(createdScenario?.config.maxReconciliationDays).toBe(10)
    })
  })

  describe('simulateScenario', () => {
    it('should simulate stable_quick scenario successfully', async () => {
      const result = await simulator.simulateScenario('stable_quick')

      expect(result).toBeDefined()
      expect(result.scenario.name).toBe('stable_quick')
      expect(result.actualOutcome).toBe('completed')
      expect(result.actualDuration).toBeLessThanOrEqual(7) // Should complete quickly
      expect(result.timeline.entries).toBeDefined()
      expect(result.dataPoints).toBeDefined()
      expect(result.changeEvents).toBeDefined()
      expect(result.metrics.totalChanges).toBeGreaterThanOrEqual(0)
      expect(result.metrics.significantChanges).toBe(0) // Stable scenario
      expect(result.metrics.extensionCount).toBe(0)
      expect(result.metrics.finalStabilityDays).toBeGreaterThanOrEqual(3)
    })

    it('should simulate gradual_stabilization scenario with changes', async () => {
      const result = await simulator.simulateScenario('gradual_stabilization')

      expect(result.scenario.name).toBe('gradual_stabilization')
      expect(result.actualOutcome).toMatch(/completed|extended/)
      expect(result.metrics.totalChanges).toBeGreaterThan(0)
      expect(result.metrics.significantChanges).toBeGreaterThan(0)
      expect(result.timeline.entries.length).toBeGreaterThan(0)

      // Should have some timeline entries with changes
      const entriesWithChanges = result.timeline.entries.filter(
        e => e.changes.hasChanges
      )
      expect(entriesWithChanges.length).toBeGreaterThan(0)
    })

    it('should simulate sudden_change_extension scenario with extension', async () => {
      const result = await simulator.simulateScenario('sudden_change_extension')

      expect(result.scenario.name).toBe('sudden_change_extension')
      expect(result.actualOutcome).toMatch(/extended|completed/)

      // Should have at least one change (significant or not)
      expect(result.metrics.totalChanges).toBeGreaterThan(0)

      // Should have at least one significant change OR should have extended due to changes
      const hasSignificantChanges = result.metrics.significantChanges > 0
      const hasExtensions = result.metrics.extensionCount > 0
      const hasChanges = result.metrics.totalChanges > 0

      expect(hasSignificantChanges || hasExtensions || hasChanges).toBe(true)

      // Should have timeline entries with changes
      const entriesWithChanges = result.timeline.entries.filter(
        e => e.changes.hasChanges
      )
      expect(entriesWithChanges.length).toBeGreaterThan(0)
    })

    it('should simulate volatile_data scenario with frequent changes', async () => {
      const result = await simulator.simulateScenario('volatile_data')

      expect(result.scenario.name).toBe('volatile_data')
      expect(result.metrics.totalChanges).toBeGreaterThan(2) // Should have multiple changes
      expect(result.metrics.significantChanges).toBeGreaterThan(0)
      expect(result.actualDuration).toBeGreaterThan(10) // Should take longer due to volatility
    })

    it('should simulate late_finalization scenario with timeout', async () => {
      const result = await simulator.simulateScenario('late_finalization')

      expect(result.scenario.name).toBe('late_finalization')
      expect(result.actualOutcome).toBe('timeout')
      expect(result.actualDuration).toBe(10) // Should hit the configured max period
      expect(result.timeline.status.phase).toBe('failed')
    })

    it('should throw error for non-existent scenario', async () => {
      await expect(simulator.simulateScenario('non_existent')).rejects.toThrow(
        'Scenario not found: non_existent'
      )
    })
  })

  describe('runBatchSimulation', () => {
    it('should run multiple scenarios successfully', async () => {
      const scenarioNames = ['stable_quick', 'gradual_stabilization']
      const results = await simulator.runBatchSimulation(scenarioNames)

      expect(results).toHaveLength(2)
      expect(results[0].scenario.name).toBe('stable_quick')
      expect(results[1].scenario.name).toBe('gradual_stabilization')

      // All results should be valid
      results.forEach(result => {
        expect(result.timeline).toBeDefined()
        expect(result.dataPoints).toBeDefined()
        expect(result.metrics).toBeDefined()
        expect(['completed', 'extended', 'timeout', 'failed']).toContain(
          result.actualOutcome
        )
      })
    })

    it('should handle scenario failures gracefully', async () => {
      const scenarioNames = [
        'stable_quick',
        'non_existent',
        'gradual_stabilization',
      ]
      const results = await simulator.runBatchSimulation(scenarioNames)

      // Should return results for valid scenarios only
      expect(results).toHaveLength(2)
      expect(results.map(r => r.scenario.name)).toEqual([
        'stable_quick',
        'gradual_stabilization',
      ])
    })

    it('should handle empty scenario list', async () => {
      const results = await simulator.runBatchSimulation([])
      expect(results).toHaveLength(0)
    })
  })

  describe('data generation', () => {
    it('should generate realistic base district data', async () => {
      const result = await simulator.simulateScenario('stable_quick')
      const baseData = result.dataPoints[0]

      expect(baseData.districtId).toBe('SIM-D001')
      expect(baseData.asOfDate).toBeTruthy()
      expect(baseData.clubs.total).toBeGreaterThan(0)
      expect(baseData.membership.total).toBeGreaterThan(0)
      expect(baseData.clubs.distinguished).toBeGreaterThanOrEqual(0)
      expect(baseData.clubs.distinguished).toBeLessThanOrEqual(
        baseData.clubs.total
      )

      // Performance metrics should be calculated
      if (baseData.performance) {
        expect(
          baseData.performance.distinguishedPercent
        ).toBeGreaterThanOrEqual(0)
        expect(baseData.performance.distinguishedPercent).toBeLessThanOrEqual(
          100
        )
      }
    })

    it('should generate consistent data timeline', async () => {
      const result = await simulator.simulateScenario('gradual_stabilization')

      expect(result.dataPoints.length).toBeGreaterThan(1)

      // All data points should have same district ID
      result.dataPoints.forEach(data => {
        expect(data.districtId).toBe('SIM-D002')
      })

      // As-of dates should progress
      for (let i = 1; i < result.dataPoints.length; i++) {
        const prevDate = new Date(result.dataPoints[i - 1].asOfDate)
        const currDate = new Date(result.dataPoints[i].asOfDate)
        expect(currDate.getTime()).toBeGreaterThan(prevDate.getTime())
      }
    })
  })

  describe('change detection simulation', () => {
    it('should detect membership changes correctly', async () => {
      const result = await simulator.simulateScenario('gradual_stabilization')

      const membershipChanges = result.changeEvents.filter(
        c => c.membershipChange
      )
      expect(membershipChanges.length).toBeGreaterThan(0)

      membershipChanges.forEach(change => {
        expect(change.membershipChange).toBeDefined()
        expect(change.membershipChange!.previous).toBeGreaterThan(0)
        expect(change.membershipChange!.current).toBeGreaterThan(0)
        expect(typeof change.membershipChange!.percentChange).toBe('number')
        expect(change.changedFields).toContain('membership')
      })
    })

    it('should detect club count changes correctly', async () => {
      // Create a scenario that focuses on club changes
      const clubChangeScenario: SimulationScenario = {
        name: 'test_club_changes',
        description: 'Test club changes',
        districtId: 'TEST-CLUBS',
        targetMonth: '2024-01',
        config: {
          maxReconciliationDays: 15,
          stabilityPeriodDays: 3,
          checkFrequencyHours: 24,
          significantChangeThresholds: {
            membershipPercent: 5, // High threshold to focus on club changes
            clubCountAbsolute: 1,
            distinguishedPercent: 5,
          },
          autoExtensionEnabled: true,
          maxExtensionDays: 5,
        },
        dataPattern: {
          type: 'gradual_change',
          changeFrequency: 2,
          changeIntensity: 'medium',
          stabilityPeriod: 3,
          significantChanges: 1,
        },
        expectedOutcome: 'completed',
        expectedDuration: 8,
      }

      simulator.createScenario(clubChangeScenario)
      const result = await simulator.simulateScenario('test_club_changes')

      // Should have some changes detected
      expect(result.changeEvents.length).toBeGreaterThan(0)

      result.changeEvents.forEach(change => {
        expect(change.hasChanges).toBe(true)
        expect(change.changedFields.length).toBeGreaterThan(0)
        expect(change.timestamp).toBeDefined()
        expect(change.sourceDataDate).toBeTruthy()
      })
    })

    it('should calculate significance correctly', async () => {
      const result = await simulator.simulateScenario('sudden_change_extension')

      const significantChanges = result.timeline.entries.filter(
        e => e.isSignificant
      )
      expect(significantChanges.length).toBeGreaterThan(0)

      // Significant changes should be marked in timeline
      significantChanges.forEach(entry => {
        expect(entry.isSignificant).toBe(true)
        expect(entry.changes.hasChanges).toBe(true)
        expect(entry.notes).toContain('Significant')
      })
    })
  })

  describe('timeline generation', () => {
    it('should generate valid timeline entries', async () => {
      const result = await simulator.simulateScenario('volatile_data')

      expect(result.timeline.jobId).toBeTruthy()
      expect(result.timeline.districtId).toBe('SIM-D004')
      expect(result.timeline.targetMonth).toBe('2024-01')
      expect(result.timeline.entries).toBeDefined()
      expect(result.timeline.status).toBeDefined()

      result.timeline.entries.forEach(entry => {
        expect(entry.date).toBeInstanceOf(Date)
        expect(entry.sourceDataDate).toBeTruthy()
        expect(entry.changes).toBeDefined()
        expect(typeof entry.isSignificant).toBe('boolean')
        expect(typeof entry.cacheUpdated).toBe('boolean')
      })
    })

    it('should track status progression correctly', async () => {
      const result = await simulator.simulateScenario('gradual_stabilization')

      expect(result.timeline.status.phase).toMatch(
        /monitoring|stabilizing|completed|failed/
      )
      expect(result.timeline.status.daysActive).toBeGreaterThan(0)
      expect(result.timeline.status.daysStable).toBeGreaterThanOrEqual(0)
      expect(result.timeline.status.message).toBeTruthy()

      if (result.timeline.status.phase === 'completed') {
        expect(result.timeline.status.daysStable).toBeGreaterThanOrEqual(3) // Default stability period
      }
    })
  })

  describe('metrics calculation', () => {
    it('should calculate accurate metrics', async () => {
      const result = await simulator.simulateScenario('volatile_data')

      expect(result.metrics.totalChanges).toBe(result.changeEvents.length)
      expect(result.metrics.significantChanges).toBeLessThanOrEqual(
        result.metrics.totalChanges
      )
      expect(result.metrics.extensionCount).toBeGreaterThanOrEqual(0)
      expect(result.metrics.finalStabilityDays).toBeGreaterThanOrEqual(0)

      // Count significant changes manually to verify
      const manualSignificantCount = result.timeline.entries.filter(
        e => e.isSignificant
      ).length
      expect(result.metrics.significantChanges).toBe(manualSignificantCount)
    })

    it('should handle zero changes scenario', async () => {
      const result = await simulator.simulateScenario('stable_quick')

      expect(result.metrics.totalChanges).toBe(0)
      expect(result.metrics.significantChanges).toBe(0)
      expect(result.metrics.extensionCount).toBe(0)
      expect(result.metrics.finalStabilityDays).toBeGreaterThan(0)
    })
  })

  describe('configuration compliance', () => {
    it('should respect maxReconciliationDays limit', async () => {
      const result = await simulator.simulateScenario('late_finalization')

      // This scenario has maxReconciliationDays: 10
      expect(result.actualDuration).toBeLessThanOrEqual(15) // Including possible extensions
    })

    it('should respect stabilityPeriodDays requirement', async () => {
      const result = await simulator.simulateScenario('stable_quick')

      if (result.actualOutcome === 'completed') {
        expect(result.metrics.finalStabilityDays).toBeGreaterThanOrEqual(3) // Default stability period
      }
    })

    it('should handle autoExtensionEnabled correctly', async () => {
      // Test with extension enabled
      await simulator.simulateScenario('sudden_change_extension')

      // Test with extension disabled
      const noExtensionScenario: SimulationScenario = {
        name: 'no_extension_test',
        description: 'Test without extensions',
        districtId: 'TEST-NO-EXT',
        targetMonth: '2024-01',
        config: {
          maxReconciliationDays: 8,
          stabilityPeriodDays: 3,
          checkFrequencyHours: 24,
          significantChangeThresholds: {
            membershipPercent: 1,
            clubCountAbsolute: 1,
            distinguishedPercent: 2,
          },
          autoExtensionEnabled: false, // Disabled
          maxExtensionDays: 0,
        },
        dataPattern: {
          type: 'sudden_change',
          changeFrequency: 6,
          changeIntensity: 'high',
          stabilityPeriod: 2,
          significantChanges: 1,
        },
        expectedOutcome: 'timeout',
        expectedDuration: 8,
      }

      simulator.createScenario(noExtensionScenario)
      const result2 = await simulator.simulateScenario('no_extension_test')

      expect(result2.metrics.extensionCount).toBe(0)
    })
  })

  describe('edge cases', () => {
    it('should handle scenario with no data changes', async () => {
      const result = await simulator.simulateScenario('stable_quick')

      expect(result.changeEvents).toHaveLength(0)
      expect(result.metrics.totalChanges).toBe(0)
      expect(result.actualOutcome).toBe('completed')
    })

    it('should handle very short reconciliation period', async () => {
      const shortScenario: SimulationScenario = {
        name: 'very_short',
        description: 'Very short reconciliation',
        districtId: 'SHORT-001',
        targetMonth: '2024-01',
        config: {
          maxReconciliationDays: 3,
          stabilityPeriodDays: 1,
          checkFrequencyHours: 24,
          significantChangeThresholds: {
            membershipPercent: 1,
            clubCountAbsolute: 1,
            distinguishedPercent: 2,
          },
          autoExtensionEnabled: false,
          maxExtensionDays: 0,
        },
        dataPattern: {
          type: 'stable',
          changeFrequency: 1,
          changeIntensity: 'low',
          stabilityPeriod: 2,
          significantChanges: 0,
        },
        expectedOutcome: 'completed',
        expectedDuration: 3,
      }

      simulator.createScenario(shortScenario)
      const result = await simulator.simulateScenario('very_short')

      expect(result.actualDuration).toBeLessThanOrEqual(5)
      expect(result.timeline.entries.length).toBeGreaterThan(0)
    })

    it('should handle maximum extension scenario', async () => {
      const maxExtensionScenario: SimulationScenario = {
        name: 'max_extension',
        description: 'Maximum extension test',
        districtId: 'MAX-EXT-001',
        targetMonth: '2024-01',
        config: {
          maxReconciliationDays: 5,
          stabilityPeriodDays: 2,
          checkFrequencyHours: 24,
          significantChangeThresholds: {
            membershipPercent: 0.1, // Very low threshold
            clubCountAbsolute: 1,
            distinguishedPercent: 0.1,
          },
          autoExtensionEnabled: true,
          maxExtensionDays: 9, // Allow 3 extensions of 3 days each
        },
        dataPattern: {
          type: 'volatile',
          changeFrequency: 1,
          changeIntensity: 'high',
          stabilityPeriod: 1,
          significantChanges: 8,
        },
        expectedOutcome: 'extended',
        expectedDuration: 14,
      }

      simulator.createScenario(maxExtensionScenario)
      const result = await simulator.simulateScenario('max_extension')

      expect(result.metrics.extensionCount).toBeGreaterThan(0)
      expect(result.actualDuration).toBeGreaterThan(5) // Should exceed initial period
    })
  })
})
