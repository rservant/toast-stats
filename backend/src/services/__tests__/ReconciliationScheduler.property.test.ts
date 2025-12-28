/**
 * Property-based tests for ReconciliationScheduler
 *
 * Tests the automatic reconciliation initiation property using property-based testing.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fc from 'fast-check'
import { ReconciliationScheduler } from '../ReconciliationScheduler.ts'
import { ReconciliationOrchestrator } from '../ReconciliationOrchestrator.ts'
import { ReconciliationStorageManager } from '../ReconciliationStorageManager.ts'
import { ReconciliationConfigService } from '../ReconciliationConfigService.ts'

describe('ReconciliationScheduler Property Tests', () => {
  let scheduler: ReconciliationScheduler
  let mockOrchestrator: ReconciliationOrchestrator
  let mockStorageManager: ReconciliationStorageManager
  let mockConfigService: ReconciliationConfigService

  beforeEach(() => {
    // Create mocks
    mockOrchestrator = {
      changeDetectionEngine: {} as unknown,
      storageManager: {} as unknown,
      cacheService: {} as unknown,
      configService: {} as unknown,
      performanceMonitor: {} as unknown,
      jobs: new Map(),
      activeJobs: new Map(),
      jobQueue: [],
      isProcessing: false,
      config: {},
      startReconciliation: vi.fn(),
      cancelReconciliation: vi.fn(),
      getStatus: vi.fn(),
      pauseReconciliation: vi.fn(),
      resumeReconciliation: vi.fn(),
      getAllJobs: vi.fn(),
      getJobsByDistrict: vi.fn(),
      cleanupOldJobs: vi.fn(),
      getJobHistory: vi.fn(),
      getPerformanceMetrics: vi.fn(),
      validateJobConfiguration: vi.fn(),
      scheduleReconciliation: vi.fn(),
      cancelScheduledReconciliation: vi.fn(),
      getScheduledJobs: vi.fn(),
      updateJobPriority: vi.fn(),
      getJobQueue: vi.fn(),
      pauseAllJobs: vi.fn(),
      resumeAllJobs: vi.fn(),
      getSystemStatus: vi.fn(),
      shutdown: vi.fn(),
    } as unknown as ReconciliationOrchestrator

    mockStorageManager = {
      storageDir: './test',
      jobsDir: './test/jobs',
      timelinesDir: './test/timelines',
      configFile: './test/config.json',
      getJobsByDistrict: vi.fn(),
      getAllJobs: vi.fn(),
      cleanupOldJobs: vi.fn(),
      saveJob: vi.fn(),
      getJob: vi.fn(),
      saveTimeline: vi.fn(),
      getTimeline: vi.fn(),
      getAllTimelines: vi.fn(),
      getTimelinesByDistrict: vi.fn(),
      getTimelinesByMonth: vi.fn(),
      cleanupOldTimelines: vi.fn(),
      getConfig: vi.fn(),
      validateConfig: vi.fn(),
      updateConfig: vi.fn(),
      resetToDefaults: vi.fn(),
      initializeStorage: vi.fn(),
      getStorageStats: vi.fn(),
      exportData: vi.fn(),
      importData: vi.fn(),
      backupStorage: vi.fn(),
      restoreFromBackup: vi.fn(),
      compactStorage: vi.fn(),
      validateStorageIntegrity: vi.fn(),
      repairStorage: vi.fn(),
      migrateStorage: vi.fn(),
      getStorageVersion: vi.fn(),
      setStorageVersion: vi.fn(),
    } as unknown as ReconciliationStorageManager

    mockConfigService = {
      configFilePath: './test/config.json',
      cacheKey: 'test-config',
      cacheTTL: 3600,
      defaultConfig: {},
      cacheService: {} as unknown,
      config: {},
      getConfig: vi.fn(),
      validateConfig: vi.fn(),
      updateConfig: vi.fn(),
      resetToDefaults: vi.fn(),
      watchConfigChanges: vi.fn(),
      stopWatching: vi.fn(),
      exportConfig: vi.fn(),
      importConfig: vi.fn(),
      backupConfig: vi.fn(),
      restoreConfig: vi.fn(),
    } as unknown as ReconciliationConfigService

    scheduler = new ReconciliationScheduler(
      mockOrchestrator,
      mockStorageManager,
      mockConfigService
    )
  })

  afterEach(() => {
    scheduler.stop()
    // Clear the scheduler's internal state by creating a new instance
    scheduler = new ReconciliationScheduler(
      mockOrchestrator,
      mockStorageManager,
      mockConfigService
    )
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  /**
   * Property 1: Automatic Reconciliation Initiation
   * For any month transition, the system should automatically initiate reconciliation
   * monitoring for the previous month without manual intervention
   * **Feature: month-end-data-reconciliation, Property 1: Automatic Reconciliation Initiation**
   * **Validates: Requirements 2.1**
   */
  it('should automatically initiate reconciliation for month transitions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          districts: fc.array(
            fc.integer({ min: 1, max: 10 }).map(n => n.toString()),
            { minLength: 1, maxLength: 3 }
          ),
          month: fc.integer({ min: 2, max: 12 }), // Feb to Dec
          year: fc.constantFrom(2024, 2025),
        }),
        async ({ districts, month, year }) => {
          // Remove duplicates from districts array since scheduler prevents duplicate scheduling
          const uniqueDistricts = [...new Set(districts)]

          // Create test date in first 3 days of month for auto-scheduling
          const testDate = new Date(year, month - 1, 2)
          const expectedPreviousMonth = `${year}-${(month - 1).toString().padStart(2, '0')}`

          // Set up mocks - return empty array to indicate no existing jobs
          vi.mocked(mockStorageManager.getJobsByDistrict).mockResolvedValue([])

          // Mock date with proper spread operator
          const OriginalDate = Date
          vi.stubGlobal(
            'Date',
            class extends OriginalDate {
              constructor(...args: unknown[]) {
                if (args.length === 0) {
                  super(testDate.getTime())
                } else {
                  super(...(args as ConstructorParameters<typeof Date>))
                }
              }
              static now() {
                return testDate.getTime()
              }
            }
          )

          try {
            const scheduledCount =
              await scheduler.autoScheduleForMonthTransition(uniqueDistricts)

            // The scheduler should schedule reconciliations for all unique districts
            expect(scheduledCount).toBe(uniqueDistricts.length)

            const scheduled = scheduler.getScheduledReconciliations()
            const relevant = scheduled.filter(
              s =>
                uniqueDistricts.includes(s.districtId) &&
                s.targetMonth === expectedPreviousMonth
            )
            expect(relevant).toHaveLength(uniqueDistricts.length)
          } finally {
            vi.unstubAllGlobals()
          }
        }
      ),
      { numRuns: 5 } // Reduced for performance
    )
  })

  it('should handle month transition edge cases correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          dayOfMonth: fc.integer({ min: 1, max: 15 }),
          districts: fc.array(
            fc.integer({ min: 1, max: 5 }).map(n => n.toString()),
            { minLength: 1, maxLength: 2 }
          ),
        }),
        async ({ dayOfMonth, districts }) => {
          const testDate = new Date(2024, 5, dayOfMonth) // June 2024

          vi.mocked(mockStorageManager.getJobsByDistrict).mockResolvedValue([])

          const OriginalDate = Date
          vi.stubGlobal(
            'Date',
            class extends OriginalDate {
              constructor(...args: unknown[]) {
                if (args.length === 0) {
                  super(testDate.getTime())
                } else {
                  super(...(args as ConstructorParameters<typeof Date>))
                }
              }
              static now() {
                return testDate.getTime()
              }
            }
          )

          try {
            const scheduledCount =
              await scheduler.autoScheduleForMonthTransition(districts)

            if (dayOfMonth <= 5) {
              expect(scheduledCount).toBe(districts.length)
            } else {
              expect(scheduledCount).toBe(0)
            }
          } finally {
            vi.unstubAllGlobals()
          }
        }
      ),
      { numRuns: 5 } // Reduced for performance
    )
  })

  it('should properly calculate previous month for different scenarios', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          month: fc.integer({ min: 2, max: 12 }), // Feb to Dec
          districts: fc.array(
            fc.integer({ min: 1, max: 3 }).map(n => n.toString()),
            { minLength: 1, maxLength: 2 }
          ),
        }),
        async ({ month, districts }) => {
          // Remove duplicates from districts array since scheduler prevents duplicate scheduling
          const uniqueDistricts = [...new Set(districts)]

          const testDate = new Date(2024, month - 1, 3) // 3rd day of month
          const expectedPreviousMonth = `2024-${(month - 1).toString().padStart(2, '0')}`

          vi.mocked(mockStorageManager.getJobsByDistrict).mockResolvedValue([])

          const OriginalDate = Date
          vi.stubGlobal(
            'Date',
            class extends OriginalDate {
              constructor(...args: unknown[]) {
                if (args.length === 0) {
                  super(testDate.getTime())
                } else {
                  super(...(args as ConstructorParameters<typeof Date>))
                }
              }
              static now() {
                return testDate.getTime()
              }
            }
          )

          try {
            const scheduledCount =
              await scheduler.autoScheduleForMonthTransition(uniqueDistricts)
            expect(scheduledCount).toBe(uniqueDistricts.length)

            const scheduled = scheduler.getScheduledReconciliations()
            const relevant = scheduled.filter(
              s =>
                uniqueDistricts.includes(s.districtId) &&
                s.targetMonth === expectedPreviousMonth
            )

            expect(relevant).toHaveLength(uniqueDistricts.length)
            relevant.forEach(s => {
              expect(s.targetMonth).toBe(expectedPreviousMonth)
            })
          } finally {
            vi.unstubAllGlobals()
          }
        }
      ),
      { numRuns: 5 } // Reduced for performance
    )
  })
})
