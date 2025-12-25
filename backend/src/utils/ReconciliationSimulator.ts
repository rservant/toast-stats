/**
 * Reconciliation Scenario Simulation Tools
 * 
 * Provides tools for simulating various reconciliation scenarios for testing
 * and debugging purposes. Generates realistic data patterns and scenarios.
 */

import { logger } from './logger.js'
import type { 
  ReconciliationJob,
  ReconciliationConfig,
  DataChanges,
  ReconciliationTimeline,
  ReconciliationEntry,
  DistinguishedCounts
} from '../types/reconciliation.js'
import type { DistrictStatistics } from '../types/districts.js'

export interface SimulationScenario {
  name: string
  description: string
  districtId: string
  targetMonth: string
  config: ReconciliationConfig
  dataPattern: DataPattern
  expectedOutcome: 'completed' | 'extended' | 'timeout' | 'failed'
  expectedDuration: number // days
}

export interface DataPattern {
  type: 'stable' | 'gradual_change' | 'sudden_change' | 'volatile' | 'late_finalization'
  changeFrequency: number // days between changes
  changeIntensity: 'low' | 'medium' | 'high'
  stabilityPeriod: number // days of stability at end
  significantChanges: number // number of significant changes
}

export interface SimulationResult {
  scenario: SimulationScenario
  timeline: ReconciliationTimeline
  actualOutcome: 'completed' | 'extended' | 'timeout' | 'failed'
  actualDuration: number
  dataPoints: DistrictStatistics[]
  changeEvents: DataChanges[]
  metrics: {
    totalChanges: number
    significantChanges: number
    extensionCount: number
    finalStabilityDays: number
  }
}

export class ReconciliationSimulator {
  private scenarios: Map<string, SimulationScenario> = new Map()

  constructor() {
    this.initializeDefaultScenarios()
  }

  /**
   * Generate a reconciliation scenario simulation
   */
  async simulateScenario(scenarioName: string): Promise<SimulationResult> {
    const scenario = this.scenarios.get(scenarioName)
    if (!scenario) {
      throw new Error(`Scenario not found: ${scenarioName}`)
    }

    logger.info('Starting reconciliation simulation', { 
      scenario: scenarioName,
      districtId: scenario.districtId,
      targetMonth: scenario.targetMonth
    })

    // Generate base district data
    const baseData = this.generateBaseDistrictData(scenario.districtId)
    
    // Generate data timeline based on pattern
    const dataTimeline = this.generateDataTimeline(baseData, scenario.dataPattern)
    
    // Simulate reconciliation process
    const result = await this.runSimulation(scenario, dataTimeline)

    logger.info('Reconciliation simulation completed', {
      scenario: scenarioName,
      actualOutcome: result.actualOutcome,
      actualDuration: result.actualDuration,
      totalChanges: result.metrics.totalChanges
    })

    return result
  }

  /**
   * Create a custom simulation scenario
   */
  createScenario(scenario: SimulationScenario): void {
    this.scenarios.set(scenario.name, scenario)
    logger.debug('Custom scenario created', { name: scenario.name })
  }

  /**
   * Get all available scenarios
   */
  getAvailableScenarios(): SimulationScenario[] {
    return Array.from(this.scenarios.values())
  }

  /**
   * Generate multiple scenarios for comprehensive testing
   */
  async runBatchSimulation(scenarioNames: string[]): Promise<SimulationResult[]> {
    const results: SimulationResult[] = []
    
    for (const scenarioName of scenarioNames) {
      try {
        const result = await this.simulateScenario(scenarioName)
        results.push(result)
      } catch (error) {
        logger.error('Scenario simulation failed', { 
          scenario: scenarioName, 
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    return results
  }

  /**
   * Initialize default simulation scenarios
   */
  private initializeDefaultScenarios(): void {
    // Scenario 1: Stable data - quick completion
    this.scenarios.set('stable_quick', {
      name: 'stable_quick',
      description: 'Data stabilizes quickly with minimal changes',
      districtId: 'SIM-D001',
      targetMonth: '2024-01',
      config: this.getDefaultConfig(),
      dataPattern: {
        type: 'stable',
        changeFrequency: 1,
        changeIntensity: 'low',
        stabilityPeriod: 4,
        significantChanges: 0
      },
      expectedOutcome: 'completed',
      expectedDuration: 5
    })

    // Scenario 2: Gradual changes with eventual stability
    this.scenarios.set('gradual_stabilization', {
      name: 'gradual_stabilization',
      description: 'Gradual changes that eventually stabilize',
      districtId: 'SIM-D002',
      targetMonth: '2024-01',
      config: this.getDefaultConfig(),
      dataPattern: {
        type: 'gradual_change',
        changeFrequency: 2,
        changeIntensity: 'medium',
        stabilityPeriod: 3,
        significantChanges: 2
      },
      expectedOutcome: 'extended',
      expectedDuration: 8
    })

    // Scenario 3: Sudden significant change requiring extension
    this.scenarios.set('sudden_change_extension', {
      name: 'sudden_change_extension',
      description: 'Sudden significant change near end requiring extension',
      districtId: 'SIM-D003',
      targetMonth: '2024-01',
      config: this.getDefaultConfig(),
      dataPattern: {
        type: 'sudden_change',
        changeFrequency: 10,
        changeIntensity: 'high',
        stabilityPeriod: 3,
        significantChanges: 1
      },
      expectedOutcome: 'extended',
      expectedDuration: 12
    })

    // Scenario 4: Volatile data pattern
    this.scenarios.set('volatile_data', {
      name: 'volatile_data',
      description: 'Highly volatile data with frequent changes',
      districtId: 'SIM-D004',
      targetMonth: '2024-01',
      config: this.getDefaultConfig(),
      dataPattern: {
        type: 'volatile',
        changeFrequency: 1,
        changeIntensity: 'high',
        stabilityPeriod: 2,
        significantChanges: 5
      },
      expectedOutcome: 'extended',
      expectedDuration: 15
    })

    // Scenario 5: Late finalization (timeout scenario)
    this.scenarios.set('late_finalization', {
      name: 'late_finalization',
      description: 'Data never fully stabilizes, hits timeout',
      districtId: 'SIM-D005',
      targetMonth: '2024-01',
      config: { ...this.getDefaultConfig(), maxReconciliationDays: 10, stabilityPeriodDays: 5 },
      dataPattern: {
        type: 'late_finalization',
        changeFrequency: 2,
        changeIntensity: 'medium',
        stabilityPeriod: 0,
        significantChanges: 4
      },
      expectedOutcome: 'timeout',
      expectedDuration: 10
    })

    logger.debug('Default simulation scenarios initialized', { 
      count: this.scenarios.size 
    })
  }

  /**
   * Generate base district statistics for simulation
   */
  private generateBaseDistrictData(districtId: string): DistrictStatistics {
    // Generate realistic base data
    const baseClubCount = Math.floor(Math.random() * 50) + 20 // 20-70 clubs
    const baseMembership = baseClubCount * (Math.floor(Math.random() * 10) + 15) // 15-25 avg per club
    const baseDistinguished = Math.floor(baseClubCount * 0.3) // ~30% distinguished

    return {
      districtId,
      asOfDate: this.getMonthEndDate('2024-01'),
      clubs: {
        total: baseClubCount,
        chartered: baseClubCount - Math.floor(Math.random() * 3),
        suspended: Math.floor(Math.random() * 3),
        distinguished: baseDistinguished
      },
      membership: {
        total: baseMembership,
        new: Math.floor(baseMembership * 0.1),
        renewed: Math.floor(baseMembership * 0.8),
        dual: Math.floor(baseMembership * 0.05)
      },
      goals: {
        clubsGoal: baseClubCount + Math.floor(Math.random() * 5),
        membershipGoal: baseMembership + Math.floor(Math.random() * 50),
        distinguishedGoal: Math.floor(baseClubCount * 0.4)
      },
      performance: {
        clubsNet: Math.floor(Math.random() * 3) - 1,
        membershipNet: Math.floor(Math.random() * 20) - 10,
        distinguishedPercent: (baseDistinguished / baseClubCount) * 100
      }
    }
  }

  /**
   * Generate data timeline based on pattern
   */
  private generateDataTimeline(
    baseData: DistrictStatistics, 
    pattern: DataPattern
  ): DistrictStatistics[] {
    const timeline: DistrictStatistics[] = []
    let currentData = { ...baseData }
    
    // Generate 20 days of data (covers max reconciliation period)
    for (let day = 1; day <= 20; day++) {
      const shouldChange = this.shouldDataChange(day, pattern)
      
      if (shouldChange) {
        currentData = this.applyDataChange(currentData, pattern, day)
      }

      // Update as-of date
      const asOfDate = new Date(baseData.asOfDate)
      asOfDate.setDate(asOfDate.getDate() + day)
      
      timeline.push({
        ...currentData,
        asOfDate: asOfDate.toISOString().split('T')[0]
      })
    }

    return timeline
  }

  /**
   * Determine if data should change on a given day
   */
  private shouldDataChange(day: number, pattern: DataPattern): boolean {
    switch (pattern.type) {
      case 'stable':
        return day <= 1 // Only change on first day
      
      case 'gradual_change':
        return day > 0 && day % pattern.changeFrequency === 0 && day <= 10
      
      case 'sudden_change':
        return day === 8 // Sudden change in middle
      
      case 'volatile':
        return day > 0 && day % pattern.changeFrequency === 0
      
      case 'late_finalization':
        return day > 0 && day % pattern.changeFrequency === 0 && day <= 15
      
      default:
        return false
    }
  }

  /**
   * Apply data changes based on pattern and intensity
   */
  private applyDataChange(
    data: DistrictStatistics, 
    pattern: DataPattern, 
    day: number
  ): DistrictStatistics {
    const newData = { ...data }
    
    // Calculate change magnitude based on intensity
    const intensityMultiplier = {
      low: 0.5,
      medium: 1.0,
      high: 2.0
    }[pattern.changeIntensity]

    // Apply membership changes
    const membershipChange = Math.floor((Math.random() * 10 - 5) * intensityMultiplier)
    newData.membership.total = Math.max(0, data.membership.total + membershipChange)

    // Apply club count changes (less frequent, smaller changes)
    if (Math.random() < 0.3) {
      const clubChange = Math.floor((Math.random() * 3 - 1) * intensityMultiplier)
      newData.clubs.total = Math.max(1, data.clubs.total + clubChange)
    }

    // Apply distinguished changes
    if (Math.random() < 0.4) {
      const distinguishedChange = Math.floor((Math.random() * 3 - 1) * intensityMultiplier)
      newData.clubs.distinguished = Math.max(0, 
        Math.min(newData.clubs.total, data.clubs.distinguished + distinguishedChange)
      )
    }

    // Update performance metrics
    newData.performance.membershipNet = newData.membership.total - data.membership.total
    newData.performance.clubsNet = newData.clubs.total - data.clubs.total
    newData.performance.distinguishedPercent = 
      (newData.clubs.distinguished / newData.clubs.total) * 100

    return newData
  }

  /**
   * Run the actual simulation
   */
  private async runSimulation(
    scenario: SimulationScenario, 
    dataTimeline: DistrictStatistics[]
  ): Promise<SimulationResult> {
    const timeline: ReconciliationTimeline = {
      jobId: `sim-${scenario.name}-${Date.now()}`,
      districtId: scenario.districtId,
      targetMonth: scenario.targetMonth,
      entries: [],
      status: {
        phase: 'monitoring',
        daysActive: 0,
        daysStable: 0,
        message: 'Simulation started'
      }
    }

    const changeEvents: DataChanges[] = []
    let extensionCount = 0
    let currentDay = 0
    let stableDays = 0
    let lastSignificantChangeDay = 0

    // Simulate daily reconciliation cycles
    for (let day = 1; day < dataTimeline.length && currentDay < scenario.config.maxReconciliationDays + 10; day++) {
      currentDay = day
      const currentData = dataTimeline[day]
      const previousData = dataTimeline[day - 1]

      // Detect changes
      const changes = this.simulateChangeDetection(previousData, currentData)
      const isSignificant = this.isSignificantChange(changes, scenario.config.significantChangeThresholds)

      if (isSignificant) {
        lastSignificantChangeDay = day
        stableDays = 0
      } else {
        stableDays++
      }

      // Create timeline entry
      const entry: ReconciliationEntry = {
        date: new Date(Date.now() + day * 24 * 60 * 60 * 1000),
        sourceDataDate: currentData.asOfDate,
        changes,
        isSignificant,
        cacheUpdated: changes.hasChanges,
        notes: isSignificant ? 'Significant change detected' : undefined
      }

      timeline.entries.push(entry)
      if (changes.hasChanges) {
        changeEvents.push(changes)
      }

      // Check for extension conditions
      if (isSignificant && day > scenario.config.maxReconciliationDays - 3 && scenario.config.autoExtensionEnabled) {
        extensionCount++
        logger.debug('Simulation extension triggered', { day, scenario: scenario.name })
      }

      // Check completion conditions
      if (stableDays >= scenario.config.stabilityPeriodDays) {
        timeline.status = {
          phase: 'completed',
          daysActive: day,
          daysStable: stableDays,
          message: 'Simulation completed - stability achieved'
        }
        break
      }

      // Check timeout conditions - must come after stability check
      if (day >= scenario.config.maxReconciliationDays + (extensionCount * 3)) {
        timeline.status = {
          phase: 'failed',
          daysActive: day,
          daysStable: stableDays,
          message: 'Simulation timeout - maximum period exceeded'
        }
        break
      }
    }

    // Determine actual outcome
    let actualOutcome: 'completed' | 'extended' | 'timeout' | 'failed'
    if (timeline.status.phase === 'completed') {
      actualOutcome = extensionCount > 0 ? 'extended' : 'completed'
    } else {
      actualOutcome = timeline.status.phase === 'failed' ? 'timeout' : 'failed'
    }

    return {
      scenario,
      timeline,
      actualOutcome,
      actualDuration: currentDay,
      dataPoints: dataTimeline.slice(0, currentDay + 1),
      changeEvents,
      metrics: {
        totalChanges: changeEvents.length,
        significantChanges: changeEvents.filter(c => 
          this.isSignificantChange(c, scenario.config.significantChangeThresholds)
        ).length,
        extensionCount,
        finalStabilityDays: stableDays
      }
    }
  }

  /**
   * Simulate change detection between two data points
   */
  private simulateChangeDetection(
    previousData: DistrictStatistics, 
    currentData: DistrictStatistics
  ): DataChanges {
    const changedFields: string[] = []
    const changes: DataChanges = {
      hasChanges: false,
      changedFields,
      timestamp: new Date(),
      sourceDataDate: currentData.asOfDate
    }

    // Check membership changes
    if (previousData.membership.total !== currentData.membership.total) {
      const percentChange = previousData.membership.total > 0 
        ? ((currentData.membership.total - previousData.membership.total) / previousData.membership.total) * 100 
        : 0

      changes.membershipChange = {
        previous: previousData.membership.total,
        current: currentData.membership.total,
        percentChange: parseFloat(percentChange.toFixed(2))
      }
      changedFields.push('membership')
    }

    // Check club count changes
    if (previousData.clubs.total !== currentData.clubs.total) {
      changes.clubCountChange = {
        previous: previousData.clubs.total,
        current: currentData.clubs.total,
        absoluteChange: currentData.clubs.total - previousData.clubs.total
      }
      changedFields.push('clubCount')
    }

    // Check distinguished changes
    if (previousData.clubs.distinguished !== currentData.clubs.distinguished) {
      const percentChange = previousData.clubs.distinguished > 0 
        ? ((currentData.clubs.distinguished - previousData.clubs.distinguished) / previousData.clubs.distinguished) * 100 
        : 0

      changes.distinguishedChange = {
        previous: this.extractDistinguishedCounts(previousData),
        current: this.extractDistinguishedCounts(currentData),
        percentChange: parseFloat(percentChange.toFixed(2))
      }
      changedFields.push('distinguished')
    }

    changes.hasChanges = changedFields.length > 0
    return changes
  }

  /**
   * Check if changes are significant based on thresholds
   */
  private isSignificantChange(changes: DataChanges, thresholds: any): boolean {
    if (!changes.hasChanges) return false

    if (changes.membershipChange && Math.abs(changes.membershipChange.percentChange) >= thresholds.membershipPercent) {
      return true
    }

    if (changes.clubCountChange && Math.abs(changes.clubCountChange.absoluteChange) >= thresholds.clubCountAbsolute) {
      return true
    }

    if (changes.distinguishedChange && Math.abs(changes.distinguishedChange.percentChange) >= thresholds.distinguishedPercent) {
      return true
    }

    return false
  }

  /**
   * Extract distinguished counts (simplified for simulation)
   */
  private extractDistinguishedCounts(data: DistrictStatistics): DistinguishedCounts {
    const total = data.clubs.distinguished
    return {
      select: Math.floor(total * 0.15),
      distinguished: Math.floor(total * 0.8),
      president: Math.floor(total * 0.05),
      total
    }
  }

  /**
   * Get default reconciliation configuration
   */
  private getDefaultConfig(): ReconciliationConfig {
    return {
      maxReconciliationDays: 15,
      stabilityPeriodDays: 3,
      checkFrequencyHours: 24,
      significantChangeThresholds: {
        membershipPercent: 1,
        clubCountAbsolute: 1,
        distinguishedPercent: 2
      },
      autoExtensionEnabled: true,
      maxExtensionDays: 5
    }
  }

  /**
   * Get month end date for a target month
   */
  private getMonthEndDate(targetMonth: string): string {
    const [year, month] = targetMonth.split('-').map(Number)
    const lastDay = new Date(year, month, 0).getDate()
    return `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`
  }
}