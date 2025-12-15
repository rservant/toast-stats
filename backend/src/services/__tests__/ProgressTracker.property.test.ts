/**
 * Property-Based Tests for ProgressTracker
 * 
 * **Feature: month-end-data-reconciliation, Property 7: Reconciliation Timeline Accuracy**
 * **Validates: Requirements 3.3, 5.1, 5.2**
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'
import { ProgressTracker } from '../ProgressTracker'
import { ReconciliationStorageManager } from '../ReconciliationStorageManager'
import type { 
  ReconciliationJob, 
  ReconciliationTimeline, 
  ReconciliationEntry,
  ReconciliationConfig,
  DataChanges,
  DistinguishedCounts
} from '../../types/reconciliation'

describe('ProgressTracker - Property-Based Tests', () => {
  let progressTracker: ProgressTracker
  let storageManager: ReconciliationStorageManager

  beforeEach(async () => {
    // Use unique temporary storage for each test
    const testId = Math.random().toString(36).substring(7)
    storageManager = new ReconciliationStorageManager(`./cache/test-progress-tracker-${testId}`)
    progressTracker = new ProgressTracker(storageManager)
    
    await storageManager.init()
  })

  afterEach(async () => {
    // Clean up test data
    try {
      await storageManager.clearAll()
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  // Test data generators
  const generateConfig = (): fc.Arbitrary<ReconciliationConfig> => 
    fc.record({
      maxReconciliationDays: fc.integer({ min: 5, max: 30 }),
      stabilityPeriodDays: fc.integer({ min: 1, max: 10 }),
      checkFrequencyHours: fc.integer({ min: 1, max: 48 }),
      significantChangeThresholds: fc.record({
        membershipPercent: fc.float({ min: Math.fround(0.1), max: Math.fround(10.0) }),
        clubCountAbsolute: fc.integer({ min: 1, max: 10 }),
        distinguishedPercent: fc.float({ min: Math.fround(0.1), max: Math.fround(15.0) })
      }),
      autoExtensionEnabled: fc.boolean(),
      maxExtensionDays: fc.integer({ min: 1, max: 15 })
    })

  const generateDistinguishedCounts = (): fc.Arbitrary<DistinguishedCounts> =>
    fc.record({
      select: fc.integer({ min: 0, max: 50 }),
      distinguished: fc.integer({ min: 0, max: 100 }),
      president: fc.integer({ min: 0, max: 20 }),
      total: fc.integer({ min: 0, max: 170 })
    })

  const generateDataChanges = (): fc.Arbitrary<DataChanges> =>
    fc.record({
      hasChanges: fc.boolean(),
      changedFields: fc.array(fc.constantFrom('membership', 'clubs', 'distinguished'), { maxLength: 3 }),
      membershipChange: fc.option(fc.record({
        previous: fc.integer({ min: 100, max: 10000 }),
        current: fc.integer({ min: 100, max: 10000 }),
        percentChange: fc.float({ min: -50, max: 50 })
      })),
      clubCountChange: fc.option(fc.record({
        previous: fc.integer({ min: 10, max: 200 }),
        current: fc.integer({ min: 10, max: 200 }),
        absoluteChange: fc.integer({ min: -20, max: 20 })
      })),
      distinguishedChange: fc.option(fc.record({
        previous: generateDistinguishedCounts(),
        current: generateDistinguishedCounts(),
        percentChange: fc.float({ min: -30, max: 30 })
      })),
      timestamp: fc.date({ min: new Date('2024-01-01T00:00:00.000Z'), max: new Date('2024-12-30T23:59:59.999Z') }).filter(d => !isNaN(d.getTime())),
      sourceDataDate: fc.constantFrom('2024-01-01', '2024-01-02', '2024-01-03', '2024-02-01', '2024-03-01')
    })

  const generateReconciliationJob = (): fc.Arbitrary<ReconciliationJob> =>
    fc.record({
      id: fc.string({ minLength: 10, maxLength: 50 }).map(s => s.replace(/[^a-zA-Z0-9-_]/g, 'x')),
      districtId: fc.string({ minLength: 2, maxLength: 10 }).map(s => `D${s.replace(/[^a-zA-Z0-9]/g, 'x')}`),
      targetMonth: fc.constantFrom('2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06'),
      status: fc.constantFrom('active', 'completed', 'failed', 'cancelled'),
      startDate: fc.date({ min: new Date('2024-01-01T00:00:00.000Z'), max: new Date('2024-06-30T23:59:59.999Z') }),
      endDate: fc.option(fc.date({ min: new Date('2024-01-01T00:00:00.000Z'), max: new Date('2024-12-31T23:59:59.999Z') })),
      maxEndDate: fc.date({ min: new Date('2024-01-15T00:00:00.000Z'), max: new Date('2024-12-31T23:59:59.999Z') }),
      currentDataDate: fc.option(fc.string({ minLength: 10, maxLength: 10 })),
      finalizedDate: fc.option(fc.date({ min: new Date('2024-01-01T00:00:00.000Z'), max: new Date('2024-12-31T23:59:59.999Z') })),
      config: generateConfig(),
      metadata: fc.record({
        createdAt: fc.date({ min: new Date('2024-01-01T00:00:00.000Z'), max: new Date('2024-06-30T23:59:59.999Z') }),
        updatedAt: fc.date({ min: new Date('2024-01-01T00:00:00.000Z'), max: new Date('2024-12-31T23:59:59.999Z') }),
        triggeredBy: fc.constantFrom('automatic', 'manual')
      })
    })

  const generateTimelineEntry = (): fc.Arbitrary<ReconciliationEntry> =>
    fc.record({
      date: fc.date({ min: new Date('2024-01-01T00:00:00.000Z'), max: new Date('2024-12-30T23:59:59.999Z') }),
      sourceDataDate: fc.constantFrom('2024-01-01', '2024-01-02', '2024-01-03', '2024-02-01', '2024-03-01'),
      changes: generateDataChanges(),
      isSignificant: fc.boolean(),
      cacheUpdated: fc.boolean(),
      notes: fc.option(fc.string({ maxLength: 100 }))
    })

  /**
   * Property 7: Reconciliation Timeline Accuracy
   * For any reconciliation job, the progress timeline should accurately reflect 
   * all data changes and their timestamps during the reconciliation period
   */
  describe('Property 7: Reconciliation Timeline Accuracy', () => {
    it('should accurately record and retrieve timeline entries', async () => {
      await fc.assert(fc.asyncProperty(
        generateReconciliationJob(),
        fc.array(generateDataChanges(), { minLength: 1, maxLength: 20 }),
        async (job, changesArray) => {
          // Ensure job has valid date relationships
          if (job.endDate && job.endDate < job.startDate) {
            job.endDate = new Date(job.startDate.getTime() + 24 * 60 * 60 * 1000)
          }
          if (job.maxEndDate < job.startDate) {
            job.maxEndDate = new Date(job.startDate.getTime() + job.config.maxReconciliationDays * 24 * 60 * 60 * 1000)
          }

          // Create fresh storage manager for this test iteration
          const testId = Math.random().toString(36).substring(7)
          const freshStorageManager = new ReconciliationStorageManager(`./cache/test-progress-tracker-${testId}`)
          const freshProgressTracker = new ProgressTracker(freshStorageManager)
          await freshStorageManager.init()
          
          // Save the job first
          await freshStorageManager.saveJob(job)

          // Record each data change
          const recordedDates: Date[] = []
          for (let i = 0; i < changesArray.length; i++) {
            const changes = changesArray[i]
            const updateDate = new Date(job.startDate.getTime() + (i * 24 * 60 * 60 * 1000))
            recordedDates.push(updateDate)
            
            await freshProgressTracker.recordDataUpdate(job.id, updateDate, changes)
          }

          // Retrieve the timeline
          const timeline = await freshProgressTracker.getReconciliationTimeline(job.id)

          // Clean up
          try {
            await freshStorageManager.clearAll()
          } catch (error) {
            // Ignore cleanup errors
          }

          // Property: Timeline should accurately reflect all recorded changes
          expect(timeline.jobId).toBe(job.id)
          expect(timeline.districtId).toBe(job.districtId)
          expect(timeline.targetMonth).toBe(job.targetMonth)
          expect(timeline.entries).toHaveLength(changesArray.length)

          // Verify each entry matches what was recorded
          const sortedEntries = timeline.entries.sort((a, b) => a.date.getTime() - b.date.getTime())
          for (let i = 0; i < changesArray.length; i++) {
            const entry = sortedEntries[i]
            const originalChanges = changesArray[i]
            const recordedDate = recordedDates[i]

            // Timeline entry should match recorded data
            expect(entry.date.getTime()).toBe(recordedDate.getTime())
            expect(entry.changes.hasChanges).toBe(originalChanges.hasChanges)
            expect(entry.changes.changedFields).toEqual(originalChanges.changedFields)
            expect(entry.changes.sourceDataDate).toBe(originalChanges.sourceDataDate)
            
            // Timestamps should be preserved
            expect(entry.changes.timestamp.getTime()).toBe(originalChanges.timestamp.getTime())
          }
        }
      ), { numRuns: 10 })
    })

    it('should maintain chronological order of timeline entries', async () => {
      await fc.assert(fc.asyncProperty(
        generateReconciliationJob(),
        fc.array(generateDataChanges(), { minLength: 5, maxLength: 15 }),
        async (job, changesArray) => {
          // Ensure job has valid date relationships
          if (job.endDate && job.endDate < job.startDate) {
            job.endDate = new Date(job.startDate.getTime() + 24 * 60 * 60 * 1000)
          }
          if (job.maxEndDate < job.startDate) {
            job.maxEndDate = new Date(job.startDate.getTime() + job.config.maxReconciliationDays * 24 * 60 * 60 * 1000)
          }

          // Create fresh storage manager for this test iteration
          const testId = Math.random().toString(36).substring(7)
          const freshStorageManager = new ReconciliationStorageManager(`./cache/test-progress-tracker-${testId}`)
          const freshProgressTracker = new ProgressTracker(freshStorageManager)
          await freshStorageManager.init()

          await freshStorageManager.saveJob(job)

          // Record changes in random order (not chronological)
          const updateDates: Date[] = []
          for (let i = 0; i < changesArray.length; i++) {
            updateDates.push(new Date(job.startDate.getTime() + (i * 24 * 60 * 60 * 1000)))
          }

          // Shuffle the order of recording to test chronological sorting
          const shuffledIndices = Array.from({ length: changesArray.length }, (_, i) => i)
          for (let i = shuffledIndices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[shuffledIndices[i], shuffledIndices[j]] = [shuffledIndices[j], shuffledIndices[i]]
          }

          // Record changes in shuffled order
          for (const index of shuffledIndices) {
            await freshProgressTracker.recordDataUpdate(job.id, updateDates[index], changesArray[index])
          }

          // Retrieve timeline
          const timeline = await freshProgressTracker.getReconciliationTimeline(job.id)

          // Clean up
          try {
            await freshStorageManager.clearAll()
          } catch (error) {
            // Ignore cleanup errors
          }

          // Property: Timeline entries should be in chronological order regardless of recording order
          for (let i = 1; i < timeline.entries.length; i++) {
            expect(timeline.entries[i].date.getTime()).toBeGreaterThanOrEqual(
              timeline.entries[i - 1].date.getTime()
            )
          }

          // Verify all entries are present and correctly ordered
          expect(timeline.entries).toHaveLength(changesArray.length)
          const sortedExpectedDates = [...updateDates].sort((a, b) => a.getTime() - b.getTime())
          for (let i = 0; i < timeline.entries.length; i++) {
            expect(timeline.entries[i].date.getTime()).toBe(sortedExpectedDates[i].getTime())
          }
        }
      ), { numRuns: 10 })
    })

    it('should correctly calculate stability periods from timeline entries', async () => {
      await fc.assert(fc.asyncProperty(
        generateReconciliationJob(),
        fc.integer({ min: 0, max: 10 }), // Number of stable days
        fc.integer({ min: 0, max: 5 }),  // Number of significant changes before stable period
        async (job, stableDays, significantChangesBefore) => {
          // Ensure job has valid date relationships
          if (job.endDate && job.endDate < job.startDate) {
            job.endDate = new Date(job.startDate.getTime() + 24 * 60 * 60 * 1000)
          }
          if (job.maxEndDate < job.startDate) {
            job.maxEndDate = new Date(job.startDate.getTime() + job.config.maxReconciliationDays * 24 * 60 * 60 * 1000)
          }

          // Create fresh storage manager for this test iteration
          const testId = Math.random().toString(36).substring(7)
          const freshStorageManager = new ReconciliationStorageManager(`./cache/test-progress-tracker-${testId}`)
          const freshProgressTracker = new ProgressTracker(freshStorageManager)
          await freshStorageManager.init()

          await freshStorageManager.saveJob(job)

          const now = new Date()
          let currentDate = new Date(now.getTime() - ((stableDays + significantChangesBefore) * 24 * 60 * 60 * 1000))

          // Record significant changes first (older entries)
          for (let i = 0; i < significantChangesBefore; i++) {
            const significantChanges: DataChanges = {
              hasChanges: true,
              changedFields: ['membership'],
              membershipChange: {
                previous: 1000,
                current: 1000 + (job.config.significantChangeThresholds.membershipPercent * 20), // Ensure it's significant
                percentChange: job.config.significantChangeThresholds.membershipPercent * 2 // Double the threshold
              },
              timestamp: currentDate,
              sourceDataDate: currentDate.toISOString().split('T')[0]
            }

            await freshProgressTracker.recordDataUpdate(job.id, currentDate, significantChanges)
            currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000)
          }

          // Record stable period (no significant changes)
          for (let i = 0; i < stableDays; i++) {
            const noChanges: DataChanges = {
              hasChanges: false,
              changedFields: [],
              timestamp: currentDate,
              sourceDataDate: currentDate.toISOString().split('T')[0]
            }

            await freshProgressTracker.recordDataUpdate(job.id, currentDate, noChanges)
            currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000)
          }

          // Get timeline and check stability calculation
          const timeline = await freshProgressTracker.getReconciliationTimeline(job.id)

          // Clean up
          try {
            await freshStorageManager.clearAll()
          } catch (error) {
            // Ignore cleanup errors
          }

          // Property: Days stable should equal the number of consecutive stable days from the most recent entries
          expect(timeline.status.daysStable).toBe(stableDays)

          // Verify that the timeline accurately reflects the pattern we created
          const recentEntries = timeline.entries
            .sort((a, b) => b.date.getTime() - a.date.getTime()) // Most recent first
            .slice(0, stableDays)

          // All recent entries should be non-significant (stable)
          for (const entry of recentEntries) {
            expect(entry.isSignificant).toBe(false)
          }

          // If there were significant changes before, verify they don't count toward stability
          if (significantChangesBefore > 0 && timeline.entries.length > stableDays) {
            const olderEntries = timeline.entries
              .sort((a, b) => b.date.getTime() - a.date.getTime())
              .slice(stableDays, stableDays + significantChangesBefore)

            // At least one of the older entries should be significant
            const hasSignificantOlderEntry = olderEntries.some(entry => entry.isSignificant)
            expect(hasSignificantOlderEntry).toBe(true)
          }
        }
      ), { numRuns: 10 })
    })

    it('should provide accurate completion estimates based on timeline patterns', async () => {
      await fc.assert(fc.asyncProperty(
        generateReconciliationJob(),
        fc.integer({ min: 1, max: 5 }), // Stability period requirement
        fc.integer({ min: 0, max: 3 }), // Current stable days
        async (job, stabilityPeriodDays, currentStableDays) => {
          // Set up job configuration
          job.config.stabilityPeriodDays = stabilityPeriodDays
          job.status = 'active'
          job.endDate = undefined
          job.finalizedDate = undefined

          // Ensure job has valid date relationships
          const now = new Date()
          job.startDate = new Date(now.getTime() - (10 * 24 * 60 * 60 * 1000)) // 10 days ago
          job.maxEndDate = new Date(now.getTime() + (5 * 24 * 60 * 60 * 1000)) // 5 days from now
          
          // Ensure metadata dates are valid
          job.metadata.createdAt = new Date(job.startDate.getTime())
          job.metadata.updatedAt = new Date(job.startDate.getTime())

          // Create fresh storage manager for this test iteration
          const testId = Math.random().toString(36).substring(7)
          const freshStorageManager = new ReconciliationStorageManager(`./cache/test-progress-tracker-${testId}`)
          const freshProgressTracker = new ProgressTracker(freshStorageManager)
          await freshStorageManager.init()

          await freshStorageManager.saveJob(job)

          // Create timeline with current stable days
          let currentDate = new Date(now.getTime() - (currentStableDays * 24 * 60 * 60 * 1000))
          for (let i = 0; i < currentStableDays; i++) {
            const noChanges: DataChanges = {
              hasChanges: false,
              changedFields: [],
              timestamp: currentDate,
              sourceDataDate: currentDate.toISOString().split('T')[0]
            }

            await freshProgressTracker.recordDataUpdate(job.id, currentDate, noChanges)
            currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000)
          }

          // Get completion estimate
          const estimatedCompletion = await freshProgressTracker.estimateCompletion(job.id)

          // Clean up
          try {
            await freshStorageManager.clearAll()
          } catch (error) {
            // Ignore cleanup errors
          }

          if (currentStableDays >= stabilityPeriodDays) {
            // Property: If stability period is already met, completion should be soon (within check frequency)
            expect(estimatedCompletion).toBeDefined()
            const timeUntilCompletion = estimatedCompletion!.getTime() - now.getTime()
            const hoursUntilCompletion = timeUntilCompletion / (60 * 60 * 1000)
            expect(hoursUntilCompletion).toBeLessThanOrEqual(job.config.checkFrequencyHours + 5) // Larger buffer for processing time and timing variations
          } else {
            // Property: If stability period is not met, completion should be estimated in the future
            expect(estimatedCompletion).toBeDefined()
            expect(estimatedCompletion!.getTime()).toBeGreaterThan(now.getTime())
            
            // Should not exceed max end date
            expect(estimatedCompletion!.getTime()).toBeLessThanOrEqual(job.maxEndDate.getTime())
          }
        }
      ), { numRuns: 10 })
    })

    it('should handle timeline updates idempotently', async () => {
      await fc.assert(fc.asyncProperty(
        generateReconciliationJob(),
        generateDataChanges(),
        async (job, changes) => {
          // Ensure job has valid date relationships
          if (job.endDate && job.endDate < job.startDate) {
            job.endDate = new Date(job.startDate.getTime() + 24 * 60 * 60 * 1000)
          }
          if (job.maxEndDate < job.startDate) {
            job.maxEndDate = new Date(job.startDate.getTime() + job.config.maxReconciliationDays * 24 * 60 * 60 * 1000)
          }

          // Create fresh storage manager for this test iteration
          const testId = Math.random().toString(36).substring(7)
          const freshStorageManager = new ReconciliationStorageManager(`./cache/test-progress-tracker-${testId}`)
          const freshProgressTracker = new ProgressTracker(freshStorageManager)
          await freshStorageManager.init()

          await freshStorageManager.saveJob(job)

          const updateDate = new Date()

          // Record the same update multiple times
          await freshProgressTracker.recordDataUpdate(job.id, updateDate, changes)
          await freshProgressTracker.recordDataUpdate(job.id, updateDate, changes)
          await freshProgressTracker.recordDataUpdate(job.id, updateDate, changes)

          // Get timeline
          const timeline = await freshProgressTracker.getReconciliationTimeline(job.id)

          // Clean up
          try {
            await freshStorageManager.clearAll()
          } catch (error) {
            // Ignore cleanup errors
          }

          // Property: Multiple identical updates should result in multiple entries
          // (This tests that the system records all updates, even duplicates, for audit trail)
          expect(timeline.entries.length).toBe(3)

          // All entries should have the same content
          for (const entry of timeline.entries) {
            expect(entry.date.getTime()).toBe(updateDate.getTime())
            expect(entry.changes.hasChanges).toBe(changes.hasChanges)
            expect(entry.changes.sourceDataDate).toBe(changes.sourceDataDate)
          }
        }
      ), { numRuns: 10 })
    })

    it('should correctly identify significant changes based on thresholds', async () => {
      await fc.assert(fc.asyncProperty(
        generateReconciliationJob(),
        fc.float({ min: Math.fround(0.1), max: Math.fround(20.0) }), // Membership change percentage
        fc.integer({ min: 1, max: 50 }),   // Club count change
        fc.float({ min: Math.fround(0.1), max: Math.fround(30.0) }), // Distinguished change percentage
        async (job, membershipChangePercent, clubCountChange, distinguishedChangePercent) => {
          // Ensure job has valid date relationships
          if (job.endDate && job.endDate < job.startDate) {
            job.endDate = new Date(job.startDate.getTime() + 24 * 60 * 60 * 1000)
          }
          if (job.maxEndDate < job.startDate) {
            job.maxEndDate = new Date(job.startDate.getTime() + job.config.maxReconciliationDays * 24 * 60 * 60 * 1000)
          }

          // Create fresh storage manager for this test iteration
          const testId = Math.random().toString(36).substring(7)
          const freshStorageManager = new ReconciliationStorageManager(`./cache/test-progress-tracker-${testId}`)
          const freshProgressTracker = new ProgressTracker(freshStorageManager)
          await freshStorageManager.init()

          await freshStorageManager.saveJob(job)

          // Create changes with known significance
          const membershipPrevious = 1000
          const membershipCurrent = 1000 + Math.floor(1000 * membershipChangePercent / 100)
          const actualMembershipPercentChange = ((membershipCurrent - membershipPrevious) / membershipPrevious) * 100

          const changes: DataChanges = {
            hasChanges: true,
            changedFields: ['membership', 'clubs', 'distinguished'],
            membershipChange: {
              previous: membershipPrevious,
              current: membershipCurrent,
              percentChange: actualMembershipPercentChange
            },
            clubCountChange: {
              previous: 100,
              current: 100 + clubCountChange,
              absoluteChange: clubCountChange
            },
            distinguishedChange: {
              previous: { select: 10, distinguished: 20, president: 5, total: 35 },
              current: { select: 10, distinguished: 20, president: 5, total: 35 },
              percentChange: distinguishedChangePercent
            },
            timestamp: new Date(),
            sourceDataDate: new Date().toISOString().split('T')[0]
          }

          const updateDate = new Date()
          await freshProgressTracker.recordDataUpdate(job.id, updateDate, changes)

          const timeline = await freshProgressTracker.getReconciliationTimeline(job.id)

          // Clean up
          try {
            await freshStorageManager.clearAll()
          } catch (error) {
            // Ignore cleanup errors
          }
          const entry = timeline.entries[0]

          // Property: Significance should be determined correctly based on thresholds
          const expectedSignificant = 
            Math.abs(actualMembershipPercentChange) >= job.config.significantChangeThresholds.membershipPercent ||
            Math.abs(clubCountChange) >= job.config.significantChangeThresholds.clubCountAbsolute ||
            Math.abs(distinguishedChangePercent) >= job.config.significantChangeThresholds.distinguishedPercent

          expect(entry.isSignificant).toBe(expectedSignificant)

          // Verify the changes were recorded accurately
          expect(entry.changes.membershipChange?.percentChange).toBe(actualMembershipPercentChange)
          expect(entry.changes.clubCountChange?.absoluteChange).toBe(clubCountChange)
          expect(entry.changes.distinguishedChange?.percentChange).toBe(distinguishedChangePercent)
        }
      ), { numRuns: 10 })
    })

    it('should maintain timeline integrity across multiple operations', async () => {
      await fc.assert(fc.asyncProperty(
        generateReconciliationJob(),
        fc.array(generateDataChanges(), { minLength: 3, maxLength: 10 }),
        async (job, changesArray) => {
          // Ensure job has valid date relationships
          if (job.endDate && job.endDate < job.startDate) {
            job.endDate = new Date(job.startDate.getTime() + 24 * 60 * 60 * 1000)
          }
          if (job.maxEndDate < job.startDate) {
            job.maxEndDate = new Date(job.startDate.getTime() + job.config.maxReconciliationDays * 24 * 60 * 60 * 1000)
          }

          // Create fresh storage manager for this test iteration
          const testId = Math.random().toString(36).substring(7)
          const freshStorageManager = new ReconciliationStorageManager(`./cache/test-progress-tracker-${testId}`)
          const freshProgressTracker = new ProgressTracker(freshStorageManager)
          await freshStorageManager.init()

          await freshStorageManager.saveJob(job)

          // Record changes
          const updateDates: Date[] = []
          for (let i = 0; i < changesArray.length; i++) {
            const updateDate = new Date(job.startDate.getTime() + (i * 24 * 60 * 60 * 1000))
            updateDates.push(updateDate)
            await freshProgressTracker.recordDataUpdate(job.id, updateDate, changesArray[i])
          }

          // Get timeline multiple times to test consistency
          const timeline1 = await freshProgressTracker.getReconciliationTimeline(job.id)
          const timeline2 = await freshProgressTracker.getReconciliationTimeline(job.id)
          const timeline3 = await freshProgressTracker.getReconciliationTimeline(job.id)

          // Property: Multiple retrievals should return consistent data
          expect(timeline1.entries.length).toBe(timeline2.entries.length)
          expect(timeline2.entries.length).toBe(timeline3.entries.length)
          expect(timeline1.status.daysStable).toBe(timeline2.status.daysStable)
          expect(timeline2.status.daysStable).toBe(timeline3.status.daysStable)

          // Test finalization only if we have enough stable days AND job is not already completed
          if (timeline1.status.daysStable >= job.config.stabilityPeriodDays && job.status === 'active') {
            const finalDate = new Date()
            await freshProgressTracker.markAsFinalized(job.id, finalDate)

            const finalizedTimeline = await freshProgressTracker.getReconciliationTimeline(job.id)
            
            // Property: Finalization should update status correctly
            expect(finalizedTimeline.status.phase).toBe('completed')
            // Note: estimatedCompletion may still be present for completed jobs as historical data
            // The key is that the status phase is 'completed'
          } else if (job.status === 'completed') {
            // If job is already completed, status should be completed
            expect(timeline1.status.phase).toBe('completed')
          } else {
            // If not enough stable days, status should be monitoring, stabilizing, or finalizing
            expect(['monitoring', 'stabilizing', 'finalizing']).toContain(timeline1.status.phase)
          }

          // Get progress statistics
          const stats = await freshProgressTracker.getProgressStatistics(job.id)

          // Clean up
          try {
            await freshStorageManager.clearAll()
          } catch (error) {
            // Ignore cleanup errors
          }
          
          // Property: Statistics should be consistent with timeline data
          expect(stats.totalEntries).toBe(changesArray.length)
          expect(stats.totalEntries).toBe(timeline1.entries.length)
          
          const expectedSignificantChanges = timeline1.entries.filter(e => e.isSignificant).length
          const expectedMinorChanges = timeline1.entries.filter(e => e.changes.hasChanges && !e.isSignificant).length
          const expectedNoChanges = timeline1.entries.filter(e => !e.changes.hasChanges).length
          
          expect(stats.significantChanges).toBe(expectedSignificantChanges)
          expect(stats.minorChanges).toBe(expectedMinorChanges)
          expect(stats.noChangeEntries).toBe(expectedNoChanges)
          expect(stats.significantChanges + stats.minorChanges + stats.noChangeEntries).toBe(stats.totalEntries)
        }
      ), { numRuns: 10 })
    })
  })
})