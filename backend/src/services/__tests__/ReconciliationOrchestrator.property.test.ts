/**
 * Property-Based Tests for ReconciliationOrchestrator
 *
 * **Feature: month-end-data-reconciliation, Property 4: Finalization Logic**
 * **Validates: Requirements 1.5, 2.4**
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ReconciliationOrchestrator } from '../ReconciliationOrchestrator'
import { ChangeDetectionEngine } from '../ChangeDetectionEngine'
import { ReconciliationStorageOptimizer } from '../ReconciliationStorageOptimizer'
import { ReconciliationConfigService } from '../ReconciliationConfigService'
import { ReconciliationCacheService } from '../ReconciliationCacheService'
import {
  createTestCacheConfig,
  cleanupTestCacheConfig,
} from '../../utils/test-cache-helper'
import type {
  ReconciliationTimeline,
  ReconciliationEntry,
  ReconciliationConfig,
  DataChanges,
} from '../../types/reconciliation'
import type { DistrictStatistics } from '../../types/districts'
import type { TestCacheConfig } from '../../utils/test-cache-helper'

describe('ReconciliationOrchestrator - Property-Based Tests', () => {
  let orchestrator: ReconciliationOrchestrator
  let storageManager: ReconciliationStorageOptimizer
  let configService: ReconciliationConfigService
  let cacheService: ReconciliationCacheService
  let changeDetectionEngine: ChangeDetectionEngine
  let testCacheConfig: TestCacheConfig

  beforeEach(async () => {
    // Create isolated test cache configuration
    testCacheConfig = await createTestCacheConfig(
      'reconciliation-orchestrator-property'
    )

    // Use test cache directory for storage
    storageManager = new ReconciliationStorageOptimizer(
      testCacheConfig.cacheDir
    )
    await storageManager.init() // Initialize the storage manager
    configService = new ReconciliationConfigService()
    cacheService = new ReconciliationCacheService()
    changeDetectionEngine = new ChangeDetectionEngine()
    orchestrator = new ReconciliationOrchestrator(
      changeDetectionEngine,
      storageManager,
      cacheService,
      configService
    )

    await storageManager.init()
  })

  afterEach(async () => {
    // Clean up test data
    if (storageManager) {
      await storageManager.clearAll()
    }

    // Clean up test cache configuration
    await cleanupTestCacheConfig(testCacheConfig)
  })

  // Test data generators using deterministic seeding
  const generateConfig = (seed: number = 0.5): ReconciliationConfig => ({
    maxReconciliationDays: Math.floor(seed * 20) + 5, // 5-25 days
    stabilityPeriodDays: Math.floor(seed * 5) + 1, // 1-6 days
    checkFrequencyHours: Math.floor(seed * 48) + 1, // 1-49 hours
    significantChangeThresholds: {
      membershipPercent: seed * 5 + 0.5, // 0.5% to 5.5%
      clubCountAbsolute: Math.floor(seed * 5) + 1, // 1 to 5 clubs
      distinguishedPercent: seed * 10 + 1, // 1% to 11%
    },
    autoExtensionEnabled: seed > 0.5,
    maxExtensionDays: Math.floor(seed * 10) + 1, // 1-11 days
  })

  const generateDistrictStatistics = (
    seed: number = 0.5
  ): DistrictStatistics => {
    const membershipTotal = Math.floor(seed * 5000) + 100 // 100-5100 members
    const clubsTotal = Math.floor(seed * 100) + 10 // 10-110 clubs
    const distinguishedCount = Math.floor(seed * clubsTotal * 0.8) // 0-80% of clubs

    return {
      districtId: `D${Math.floor(seed * 100)}`,
      asOfDate: new Date(2024, 0, Math.floor(seed * 28) + 1)
        .toISOString()
        .split('T')[0],
      membership: {
        total: membershipTotal,
        change: Math.floor((seed - 0.5) * 200), // -100 to +100 change
        changePercent: (seed - 0.5) * 20, // -10% to +10%
        byClub: [],
      },
      clubs: {
        total: clubsTotal,
        active: Math.floor(clubsTotal * (0.7 + seed * 0.25)), // 70-95% active
        suspended: Math.floor(clubsTotal * seed * 0.1), // 0-10% suspended
        ineligible: Math.floor(clubsTotal * seed * 0.05), // 0-5% ineligible
        low: Math.floor(clubsTotal * seed * 0.05), // 0-5% low
        distinguished: distinguishedCount,
      },
      education: {
        totalAwards: Math.floor(seed * 500),
        byType: [],
        topClubs: [],
      },
    }
  }

  const generateTimelineWithStablePeriod = (
    jobId: string,
    districtId: string,
    targetMonth: string,
    stableDays: number,
    hasRecentSignificantChanges: boolean = false
  ): ReconciliationTimeline => {
    const entries: ReconciliationEntry[] = []
    const now = new Date()

    // Generate entries for the stable period (working backwards from now)
    for (let i = 0; i < stableDays; i++) {
      const entryDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const changes: DataChanges = {
        hasChanges: false,
        changedFields: [],
        timestamp: entryDate,
        sourceDataDate: entryDate.toISOString().split('T')[0],
      }

      entries.unshift({
        date: entryDate,
        sourceDataDate: changes.sourceDataDate,
        changes,
        isSignificant: false,
        cacheUpdated: false,
        notes: 'No changes detected',
      })
    }

    // Add a significant change before the stable period if requested
    if (hasRecentSignificantChanges && stableDays > 0) {
      const significantChangeDate = new Date(
        now.getTime() - (stableDays + 1) * 24 * 60 * 60 * 1000
      )
      const significantChanges: DataChanges = {
        hasChanges: true,
        changedFields: ['membership'],
        membershipChange: {
          previous: 1000,
          current: 1050,
          percentChange: 5.0,
        },
        timestamp: significantChangeDate,
        sourceDataDate: significantChangeDate.toISOString().split('T')[0],
      }

      entries.unshift({
        date: significantChangeDate,
        sourceDataDate: significantChanges.sourceDataDate,
        changes: significantChanges,
        isSignificant: true,
        cacheUpdated: true,
        notes: 'Significant membership change detected',
      })
    }

    return {
      jobId,
      districtId,
      targetMonth,
      entries,
      status: {
        phase: 'monitoring',
        daysActive: stableDays + (hasRecentSignificantChanges ? 1 : 0),
        daysStable: stableDays,
        message: 'Generated timeline for testing',
      },
    }
  }

  /**
   * Property 10: Extension Logic
   * For any reconciliation where significant changes are detected near the end of the monitoring period,
   * the system should extend monitoring when auto-extension is enabled
   */
  describe('Property 10: Extension Logic', () => {
    it('should automatically extend reconciliation when significant changes detected near end', async () => {
      // Generate 15 test cases with different configurations
      for (let i = 0; i < 15; i++) {
        const seed = i / 15
        const config = generateConfig(seed)

        // Ensure auto-extension is enabled for this test
        config.autoExtensionEnabled = true
        config.maxExtensionDays = Math.max(1, Math.floor(seed * 10) + 1) // 1-10 days
        config.maxReconciliationDays = Math.max(5, Math.floor(seed * 15) + 5) // 5-20 days

        await configService.updateConfig(config)

        const districtId = `D${i + 1000}`
        const targetMonth = '2024-08'

        // Start reconciliation
        const job = await orchestrator.startReconciliation(
          districtId,
          targetMonth,
          undefined,
          'manual'
        )

        // Manually set the job to be close to max end date (within 2 days)
        const now = new Date()
        const originalMaxEndTime = now.getTime() + 1.5 * 24 * 60 * 60 * 1000 // 1.5 days from now
        job.maxEndDate = new Date(originalMaxEndTime)
        await storageManager.saveJob(job)

        // Generate current and cached data with significant changes
        const cachedData = generateDistrictStatistics(seed)
        const currentData = generateDistrictStatistics(seed + 0.1)

        // Ensure the change is significant by modifying membership substantially
        // Use a much larger change to guarantee it exceeds the threshold
        const membershipIncrease = Math.max(
          Math.floor(cachedData.membership.total * 0.1), // 10% increase
          Math.floor(
            (config.significantChangeThresholds.membershipPercent *
              cachedData.membership.total) /
              100
          ) + 1
        )
        currentData.membership.total =
          cachedData.membership.total + membershipIncrease
        currentData.membership.change = membershipIncrease
        currentData.membership.changePercent =
          (membershipIncrease / cachedData.membership.total) * 100
        currentData.asOfDate = now.toISOString().split('T')[0]

        // Process reconciliation cycle (this should trigger extension)
        const status = await orchestrator.processReconciliationCycle(
          job.id,
          currentData,
          cachedData
        )

        // Property: When significant changes are detected near end and auto-extension is enabled,
        // the reconciliation should be extended
        const updatedJob = await storageManager.getJob(job.id)
        expect(updatedJob).toBeDefined()

        // Debug: Log the values to understand what's happening
        console.log(
          `Test ${i}: originalMaxEndTime=${originalMaxEndTime}, updatedMaxEndTime=${updatedJob!.maxEndDate.getTime()}`
        )

        // The max end date should have been extended beyond the original time
        expect(updatedJob!.maxEndDate.getTime()).toBeGreaterThan(
          originalMaxEndTime
        )

        // The extension should not exceed the configured maximum
        const extensionMs =
          updatedJob!.maxEndDate.getTime() - originalMaxEndTime
        const extensionDays = extensionMs / (24 * 60 * 60 * 1000)
        expect(extensionDays).toBeLessThanOrEqual(config.maxExtensionDays)

        // Status message should indicate extension
        expect(status.message).toContain('extended')
      }
    })

    it('should not extend reconciliation when auto-extension is disabled', async () => {
      // Generate 10 test cases with auto-extension disabled
      for (let i = 0; i < 10; i++) {
        const seed = i / 10
        const config = generateConfig(seed)

        // Disable auto-extension for this test
        config.autoExtensionEnabled = false
        config.maxExtensionDays = Math.floor(seed * 5) + 1 // 1-5 days

        await configService.updateConfig(config)

        const districtId = `D${i + 2000}`
        const targetMonth = '2024-09'

        // Start reconciliation
        const job = await orchestrator.startReconciliation(
          districtId,
          targetMonth,
          undefined,
          'manual'
        )

        // Set job close to max end date
        const now = new Date()
        job.maxEndDate = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000) // 1 day from now
        await storageManager.saveJob(job)

        // Generate data with significant changes
        const cachedData = generateDistrictStatistics(seed)
        const currentData = generateDistrictStatistics(seed + 0.1)
        currentData.membership.total =
          cachedData.membership.total +
          Math.floor(cachedData.membership.total * 0.1) // 10% increase
        currentData.asOfDate = now.toISOString().split('T')[0]

        // Process reconciliation cycle
        const originalMaxEndDate = new Date(job.maxEndDate)
        await orchestrator.processReconciliationCycle(
          job.id,
          currentData,
          cachedData
        )

        // Property: When auto-extension is disabled, reconciliation should not be extended
        // even with significant changes near the end
        const updatedJob = await storageManager.getJob(job.id)
        expect(updatedJob).toBeDefined()
        expect(updatedJob!.maxEndDate.getTime()).toBe(
          originalMaxEndDate.getTime()
        )
      }
    })

    it('should support manual extension with proper limit enforcement', async () => {
      // Generate 12 test cases for manual extension
      for (let i = 0; i < 12; i++) {
        const seed = i / 12
        const config = generateConfig(seed)
        config.maxExtensionDays = Math.max(2, Math.floor(seed * 8) + 2) // 2-10 days

        await configService.updateConfig(config)

        const districtId = `D${i + 3000}`
        const targetMonth = '2024-10'

        // Start reconciliation
        const job = await orchestrator.startReconciliation(
          districtId,
          targetMonth,
          undefined,
          'manual'
        )
        const originalMaxEndDate = new Date(job.maxEndDate)

        // Test manual extension within limits
        const extensionDays = Math.min(
          config.maxExtensionDays,
          Math.floor(seed * 5) + 1
        ) // Within limits
        await orchestrator.extendReconciliation(job.id, extensionDays)

        // Property: Manual extension should work within configured limits
        const extendedJob = await storageManager.getJob(job.id)
        expect(extendedJob).toBeDefined()

        const expectedEndDate = new Date(
          originalMaxEndDate.getTime() + extensionDays * 24 * 60 * 60 * 1000
        )
        expect(extendedJob!.maxEndDate.getTime()).toBe(
          expectedEndDate.getTime()
        )

        // Test that we can extend multiple times up to the total limit
        if (extensionDays < config.maxExtensionDays) {
          const additionalExtension = Math.min(
            1,
            config.maxExtensionDays - extensionDays
          )
          if (additionalExtension > 0) {
            const beforeSecondExtension = new Date(extendedJob!.maxEndDate)
            await orchestrator.extendReconciliation(job.id, additionalExtension)

            const doubleExtendedJob = await storageManager.getJob(job.id)
            const expectedSecondEndDate = new Date(
              beforeSecondExtension.getTime() +
                additionalExtension * 24 * 60 * 60 * 1000
            )
            expect(doubleExtendedJob!.maxEndDate.getTime()).toBe(
              expectedSecondEndDate.getTime()
            )
          }
        }
      }
    })

    it('should not extend reconciliation when not close to max end date', async () => {
      // Generate 8 test cases where reconciliation is not close to end
      for (let i = 0; i < 8; i++) {
        const seed = i / 8
        const config = generateConfig(seed)
        config.autoExtensionEnabled = true
        config.maxExtensionDays = Math.floor(seed * 5) + 1

        await configService.updateConfig(config)

        const districtId = `D${i + 4000}`
        const targetMonth = '2024-11'

        // Start reconciliation
        const job = await orchestrator.startReconciliation(
          districtId,
          targetMonth,
          undefined,
          'manual'
        )

        // Set job far from max end date (more than 2 days)
        const now = new Date()
        job.maxEndDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000) // 5 days from now
        await storageManager.saveJob(job)

        // Generate data with significant changes
        const cachedData = generateDistrictStatistics(seed)
        const currentData = generateDistrictStatistics(seed + 0.1)
        currentData.membership.total =
          cachedData.membership.total +
          Math.floor(cachedData.membership.total * 0.08) // 8% increase
        currentData.asOfDate = now.toISOString().split('T')[0]

        // Process reconciliation cycle
        const originalMaxEndDate = new Date(job.maxEndDate)
        await orchestrator.processReconciliationCycle(
          job.id,
          currentData,
          cachedData
        )

        // Property: When not close to max end date, reconciliation should not be extended
        // even with significant changes
        const updatedJob = await storageManager.getJob(job.id)
        expect(updatedJob).toBeDefined()
        expect(updatedJob!.maxEndDate.getTime()).toBe(
          originalMaxEndDate.getTime()
        )
      }
    })

    it('should handle extension attempts on non-active jobs gracefully', async () => {
      // Test extension attempts on completed, failed, and cancelled jobs
      const config = generateConfig(0.5)
      await configService.updateConfig(config)

      const testStatuses: Array<'completed' | 'failed' | 'cancelled'> = [
        'completed',
        'failed',
        'cancelled',
      ]

      for (let i = 0; i < testStatuses.length; i++) {
        const status = testStatuses[i]
        const districtId = `D${5000 + i}`
        const targetMonth = '2024-12'

        // Start reconciliation
        const job = await orchestrator.startReconciliation(
          districtId,
          targetMonth,
          undefined,
          'manual'
        )

        // Manually set job status to non-active
        job.status = status
        if (status === 'completed') {
          job.endDate = new Date()
          job.finalizedDate = new Date()
        } else {
          job.endDate = new Date()
        }
        await storageManager.saveJob(job)

        const originalMaxEndDate = new Date(job.maxEndDate)

        // Property: Extension attempts on non-active jobs should not throw errors
        // and should not modify the job
        await expect(
          orchestrator.extendReconciliation(job.id, 2)
        ).resolves.not.toThrow()

        const unchangedJob = await storageManager.getJob(job.id)
        expect(unchangedJob).toBeDefined()
        expect(unchangedJob!.status).toBe(status)
        expect(unchangedJob!.maxEndDate.getTime()).toBe(
          originalMaxEndDate.getTime()
        )
      }
    })

    it('should maintain extension invariants across different scenarios', async () => {
      // Generate 10 test cases to verify extension invariants
      for (let i = 0; i < 10; i++) {
        const seed = i / 10
        const config = generateConfig(seed)
        config.autoExtensionEnabled = true
        config.maxExtensionDays = Math.max(3, Math.floor(seed * 7) + 3) // 3-10 days

        await configService.updateConfig(config)

        const districtId = `D${i + 6000}`
        const targetMonth = '2025-01'

        // Start reconciliation
        const job = await orchestrator.startReconciliation(
          districtId,
          targetMonth,
          undefined,
          'manual'
        )
        const originalStartDate = new Date(job.startDate)
        const originalMaxEndDate = new Date(job.maxEndDate)

        // Perform manual extension
        const extensionDays = Math.floor(seed * config.maxExtensionDays) + 1
        await orchestrator.extendReconciliation(job.id, extensionDays)

        const extendedJob = await storageManager.getJob(job.id)
        expect(extendedJob).toBeDefined()

        // Invariant 1: Start date should never change during extension
        expect(extendedJob!.startDate.getTime()).toBe(
          originalStartDate.getTime()
        )

        // Invariant 2: Max end date should be extended by exactly the requested amount
        const expectedEndDate = new Date(
          originalMaxEndDate.getTime() + extensionDays * 24 * 60 * 60 * 1000
        )
        expect(extendedJob!.maxEndDate.getTime()).toBe(
          expectedEndDate.getTime()
        )

        // Invariant 3: Job should remain active after extension
        expect(extendedJob!.status).toBe('active')

        // Invariant 4: Extension should not affect other job properties
        expect(extendedJob!.districtId).toBe(job.districtId)
        expect(extendedJob!.targetMonth).toBe(job.targetMonth)
        expect(extendedJob!.id).toBe(job.id)

        // Invariant 5: Updated timestamp should be recent
        const timeSinceUpdate =
          Date.now() - extendedJob!.metadata.updatedAt.getTime()
        expect(timeSinceUpdate).toBeLessThan(5000) // Within 5 seconds

        // Invariant 6: Max end date should always be after start date
        expect(extendedJob!.maxEndDate.getTime()).toBeGreaterThan(
          extendedJob!.startDate.getTime()
        )
      }
    })

    it('should handle edge cases in extension logic correctly', async () => {
      const config = generateConfig(0.8)
      config.autoExtensionEnabled = true
      config.maxExtensionDays = 1 // Minimum extension

      await configService.updateConfig(config)

      // Test case 1: Extension with minimum days
      const job1 = await orchestrator.startReconciliation(
        'D7001',
        '2025-02',
        undefined,
        'manual'
      )
      const originalEnd1 = new Date(job1.maxEndDate)

      await orchestrator.extendReconciliation(job1.id, 1)

      const extended1 = await storageManager.getJob(job1.id)
      const expectedEnd1 = new Date(
        originalEnd1.getTime() + 24 * 60 * 60 * 1000
      )
      expect(extended1!.maxEndDate.getTime()).toBe(expectedEnd1.getTime())

      // Test case 2: Extension with zero days (should be handled gracefully)
      const job2 = await orchestrator.startReconciliation(
        'D7002',
        '2025-03',
        undefined,
        'manual'
      )
      const originalEnd2 = new Date(job2.maxEndDate)

      await orchestrator.extendReconciliation(job2.id, 0)

      const extended2 = await storageManager.getJob(job2.id)
      expect(extended2!.maxEndDate.getTime()).toBe(originalEnd2.getTime()) // Should remain unchanged

      // Test case 3: Extension on job that doesn't exist
      await expect(
        orchestrator.extendReconciliation('nonexistent-job', 1)
      ).rejects.toThrow('Reconciliation job not found')
    })
  })

  /**
   * Property 4: Finalization Logic
   * For any reconciliation period where no changes are detected for the configured stability period,
   * the system should mark the month-end data as final
   */
  describe('Property 4: Finalization Logic', () => {
    it('should finalize reconciliation when stability period is met', async () => {
      // Generate 20 test cases with different configurations
      for (let i = 0; i < 20; i++) {
        const seed = i / 20
        const config = generateConfig(seed)

        // Set the configuration
        await configService.updateConfig(config)

        const districtId = `D${i}`
        const targetMonth = '2024-01'

        // Start reconciliation
        const job = await orchestrator.startReconciliation(
          districtId,
          targetMonth,
          undefined,
          'manual'
        )

        // Create a timeline with exactly the required stability period
        const timeline = generateTimelineWithStablePeriod(
          job.id,
          districtId,
          targetMonth,
          config.stabilityPeriodDays
        )

        // Save the timeline
        await storageManager.saveTimeline(timeline)

        // Property: When stability period is met, finalization should succeed
        await expect(
          orchestrator.finalizeReconciliation(job.id)
        ).resolves.not.toThrow()

        // Verify the job was finalized
        const finalizedJob = await storageManager.getJob(job.id)
        expect(finalizedJob).toBeDefined()
        expect(finalizedJob!.status).toBe('completed')
        expect(finalizedJob!.finalizedDate).toBeDefined()
        expect(finalizedJob!.endDate).toBeDefined()

        // Verify the timeline status was updated
        const finalizedTimeline = await storageManager.getTimeline(job.id)
        expect(finalizedTimeline).toBeDefined()
        expect(finalizedTimeline!.status.phase).toBe('completed')
        expect(finalizedTimeline!.status.daysStable).toBe(
          config.stabilityPeriodDays
        )
      }
    })

    it('should not finalize reconciliation when stability period is not met', async () => {
      // Generate 15 test cases with different configurations
      for (let i = 0; i < 15; i++) {
        const seed = i / 15
        const config = generateConfig(seed)

        // Ensure we have at least 2 days for stability period
        config.stabilityPeriodDays = Math.max(2, config.stabilityPeriodDays)

        // Set the configuration
        await configService.updateConfig(config)

        const districtId = `D${i + 100}`
        const targetMonth = '2024-02'

        // Start reconciliation
        const job = await orchestrator.startReconciliation(
          districtId,
          targetMonth,
          undefined,
          'manual'
        )

        // Create a timeline with insufficient stability period (one day less than required)
        const insufficientStableDays = config.stabilityPeriodDays - 1
        const timeline = generateTimelineWithStablePeriod(
          job.id,
          districtId,
          targetMonth,
          insufficientStableDays
        )

        // Save the timeline
        await storageManager.saveTimeline(timeline)

        // Property: When stability period is not met, finalization should fail
        await expect(
          orchestrator.finalizeReconciliation(job.id)
        ).rejects.toThrow('Stability period not met')

        // Verify the job was not finalized
        const job2 = await storageManager.getJob(job.id)
        expect(job2).toBeDefined()
        expect(job2!.status).toBe('active') // Should still be active
        expect(job2!.finalizedDate).toBeUndefined()
        expect(job2!.endDate).toBeUndefined()
      }
    })

    it('should correctly calculate stability period with mixed significant/non-significant changes', async () => {
      // Generate 10 test cases
      for (let i = 0; i < 10; i++) {
        const seed = i / 10
        const config = generateConfig(seed)
        config.stabilityPeriodDays = 3 // Fixed for this test

        await configService.updateConfig(config)

        const districtId = `D${i + 200}`
        const targetMonth = '2024-03'

        // Start reconciliation
        const job = await orchestrator.startReconciliation(
          districtId,
          targetMonth,
          undefined,
          'manual'
        )

        // Create a timeline with mixed changes:
        // - 3 stable days (most recent)
        // - 1 significant change (before stable period)
        // - 2 more stable days (older)
        const timeline = generateTimelineWithStablePeriod(
          job.id,
          districtId,
          targetMonth,
          3, // 3 stable days
          true // with a significant change before the stable period
        )

        // Add some older stable entries to test that only consecutive stable days count
        const olderDate1 = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
        const olderDate2 = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)

        timeline.entries.unshift(
          {
            date: olderDate1,
            sourceDataDate: olderDate1.toISOString().split('T')[0],
            changes: {
              hasChanges: false,
              changedFields: [],
              timestamp: olderDate1,
              sourceDataDate: olderDate1.toISOString().split('T')[0],
            },
            isSignificant: false,
            cacheUpdated: false,
          },
          {
            date: olderDate2,
            sourceDataDate: olderDate2.toISOString().split('T')[0],
            changes: {
              hasChanges: false,
              changedFields: [],
              timestamp: olderDate2,
              sourceDataDate: olderDate2.toISOString().split('T')[0],
            },
            isSignificant: false,
            cacheUpdated: false,
          }
        )

        await storageManager.saveTimeline(timeline)

        // Property: Only consecutive stable days from the most recent should count
        // Should be able to finalize because we have 3 consecutive stable days (meets requirement)
        await expect(
          orchestrator.finalizeReconciliation(job.id)
        ).resolves.not.toThrow()

        const finalizedJob = await storageManager.getJob(job.id)
        expect(finalizedJob!.status).toBe('completed')

        const finalizedTimeline = await storageManager.getTimeline(job.id)
        expect(finalizedTimeline!.status.daysStable).toBe(3) // Only the 3 consecutive stable days
      }
    })

    it('should handle edge case of minimum stability period requirement', async () => {
      // Test with minimum stability period (1 day)
      const config = generateConfig(0.5)
      config.stabilityPeriodDays = 1 // Minimum stability period

      await configService.updateConfig(config)

      const districtId = 'D999'
      const targetMonth = '2024-04'

      // Start reconciliation
      const job = await orchestrator.startReconciliation(
        districtId,
        targetMonth,
        undefined,
        'manual'
      )

      // Create timeline with exactly 1 stable day
      const timeline = generateTimelineWithStablePeriod(
        job.id,
        districtId,
        targetMonth,
        1
      )
      await storageManager.saveTimeline(timeline)

      // Property: With minimum stability period requirement, should be able to finalize with 1 stable day
      await expect(
        orchestrator.finalizeReconciliation(job.id)
      ).resolves.not.toThrow()

      const finalizedJob = await storageManager.getJob(job.id)
      expect(finalizedJob!.status).toBe('completed')
    })

    it('should maintain finalization invariants across different timeline patterns', async () => {
      // Generate 12 test cases with various timeline patterns
      for (let i = 0; i < 12; i++) {
        const seed = i / 12
        const config = generateConfig(seed)
        config.stabilityPeriodDays = 2 // Fixed for consistency

        await configService.updateConfig(config)

        const districtId = `D${i + 300}`
        const targetMonth = '2024-05'

        // Start reconciliation
        const job = await orchestrator.startReconciliation(
          districtId,
          targetMonth,
          undefined,
          'manual'
        )

        // Create different timeline patterns
        let timeline: ReconciliationTimeline

        if (i % 3 === 0) {
          // Pattern 1: Exactly required stability period
          timeline = generateTimelineWithStablePeriod(
            job.id,
            districtId,
            targetMonth,
            2
          )
        } else if (i % 3 === 1) {
          // Pattern 2: More than required stability period
          timeline = generateTimelineWithStablePeriod(
            job.id,
            districtId,
            targetMonth,
            4
          )
        } else {
          // Pattern 3: Required stability period with older significant changes
          timeline = generateTimelineWithStablePeriod(
            job.id,
            districtId,
            targetMonth,
            2,
            true
          )
        }

        await storageManager.saveTimeline(timeline)

        // Property: All patterns with sufficient stability should finalize successfully
        await expect(
          orchestrator.finalizeReconciliation(job.id)
        ).resolves.not.toThrow()

        const finalizedJob = await storageManager.getJob(job.id)
        const finalizedTimeline = await storageManager.getTimeline(job.id)

        // Invariant 1: Finalized job must have completed status
        expect(finalizedJob!.status).toBe('completed')

        // Invariant 2: Finalized job must have end date and finalized date
        expect(finalizedJob!.endDate).toBeDefined()
        expect(finalizedJob!.finalizedDate).toBeDefined()

        // Invariant 3: Timeline status must be completed
        expect(finalizedTimeline!.status.phase).toBe('completed')

        // Invariant 4: Days stable must be at least the required stability period
        expect(finalizedTimeline!.status.daysStable).toBeGreaterThanOrEqual(
          config.stabilityPeriodDays
        )

        // Invariant 5: Finalized date should be after or equal to start date
        expect(finalizedJob!.finalizedDate!.getTime()).toBeGreaterThanOrEqual(
          job.startDate.getTime()
        )

        // Invariant 6: End date should be after or equal to start date
        expect(finalizedJob!.endDate!.getTime()).toBeGreaterThanOrEqual(
          job.startDate.getTime()
        )
      }
    })

    it('should handle concurrent finalization attempts gracefully', async () => {
      // Test that multiple finalization attempts on the same job are handled correctly
      const config = generateConfig(0.7)
      config.stabilityPeriodDays = 1

      await configService.updateConfig(config)

      const districtId = 'D400'
      const targetMonth = '2024-06'

      // Start reconciliation
      const job = await orchestrator.startReconciliation(
        districtId,
        targetMonth,
        undefined,
        'manual'
      )

      // Create timeline with sufficient stability
      const timeline = generateTimelineWithStablePeriod(
        job.id,
        districtId,
        targetMonth,
        1
      )
      await storageManager.saveTimeline(timeline)

      // First finalization should succeed
      await expect(
        orchestrator.finalizeReconciliation(job.id)
      ).resolves.not.toThrow()

      // Second finalization attempt should not throw (should handle gracefully)
      await expect(
        orchestrator.finalizeReconciliation(job.id)
      ).resolves.not.toThrow()

      // Job should still be in completed state
      const finalJob = await storageManager.getJob(job.id)
      expect(finalJob!.status).toBe('completed')
    })

    it('should respect maximum reconciliation period in finalization logic', async () => {
      // Test that jobs can be finalized even without stability if max period is reached
      const config = generateConfig(0.3)
      config.maxReconciliationDays = 5 // Short max period
      config.stabilityPeriodDays = 3 // Less than max period but more than what we'll provide

      await configService.updateConfig(config)

      const districtId = 'D500'
      const targetMonth = '2024-07'

      // Start reconciliation with a past start date to simulate time passage
      const job = await orchestrator.startReconciliation(
        districtId,
        targetMonth,
        undefined,
        'manual'
      )

      // Manually adjust the job to simulate it being past the max end date
      job.startDate = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) // 6 days ago
      job.maxEndDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 day ago (past)
      await storageManager.saveJob(job)

      // Create timeline with insufficient stability (but job is past max end date)
      const timeline = generateTimelineWithStablePeriod(
        job.id,
        districtId,
        targetMonth,
        1
      ) // Less than required 3 days
      await storageManager.saveTimeline(timeline)

      // Property: Should be able to finalize even without sufficient stability if max period exceeded
      // Note: This tests the business logic that max period overrides stability requirements
      await expect(
        orchestrator.finalizeReconciliation(job.id)
      ).resolves.not.toThrow()

      const finalizedJob = await storageManager.getJob(job.id)
      expect(finalizedJob!.status).toBe('completed')
    })
  })
})
