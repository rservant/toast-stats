/**
 * Property-Based Tests for CacheUpdateManager
 * 
 * **Feature: month-end-data-reconciliation, Property 2: Real-time Cache Updates**
 * **Validates: Requirements 2.3, 5.3**
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { CacheUpdateManager } from '../CacheUpdateManager'
import { DistrictCacheManager } from '../DistrictCacheManager'
import type { DistrictStatistics, DistrictCacheEntry } from '../../types/districts'
import type { DataChanges } from '../../types/reconciliation'
import fs from 'fs/promises'
import path from 'path'

describe('CacheUpdateManager - Property-Based Tests', () => {
  let cacheUpdateManager: CacheUpdateManager
  let cacheManager: DistrictCacheManager
  const testCacheDir = './cache/test-cache-updates'

  beforeEach(async () => {
    // Clean up any existing test cache
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true })
    } catch {
      // Ignore if directory doesn't exist
    }

    cacheManager = new DistrictCacheManager(testCacheDir)
    cacheUpdateManager = new CacheUpdateManager(cacheManager)
  })

  afterEach(async () => {
    // Clean up test cache
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  // Test data generators
  const generateDistrictStatistics = (seed: number = Math.random()): DistrictStatistics => {
    const membershipTotal = Math.floor(seed * 5000) + 100 // 100-5100 members
    const clubsTotal = Math.floor(seed * 100) + 10 // 10-110 clubs
    const distinguishedCount = Math.floor(seed * clubsTotal * 0.8) // 0-80% of clubs

    return {
      districtId: `D${Math.floor(seed * 100)}`,
      asOfDate: new Date(2024, 0, Math.floor(seed * 28) + 1).toISOString().split('T')[0],
      membership: {
        total: membershipTotal,
        change: Math.floor((seed - 0.5) * 200), // -100 to +100 change
        changePercent: (seed - 0.5) * 20, // -10% to +10%
        byClub: []
      },
      clubs: {
        total: clubsTotal,
        active: Math.floor(clubsTotal * (0.7 + seed * 0.25)), // 70-95% active
        suspended: Math.floor(clubsTotal * seed * 0.1), // 0-10% suspended
        ineligible: Math.floor(clubsTotal * seed * 0.05), // 0-5% ineligible
        low: Math.floor(clubsTotal * seed * 0.05), // 0-5% low
        distinguished: distinguishedCount
      },
      education: {
        totalAwards: Math.floor(seed * 500),
        byType: [],
        topClubs: []
      },
      districtPerformance: Array.from({ length: Math.floor(seed * 5) + 1 }, (_, i) => ({
        id: `district-${i}`,
        name: `District ${i}`,
        performance: seed * 100
      })),
      divisionPerformance: Array.from({ length: Math.floor(seed * 10) + 1 }, (_, i) => ({
        id: `division-${i}`,
        name: `Division ${i}`,
        performance: seed * 100
      })),
      clubPerformance: Array.from({ length: clubsTotal }, (_, i) => ({
        id: `club-${i}`,
        name: `Club ${i}`,
        performance: seed * 100
      }))
    }
  }

  const generateDataChanges = (
    hasChanges: boolean,
    seed: number = Math.random()
  ): DataChanges => {
    const sourceDate = new Date(2024, 0, Math.floor(seed * 28) + 1).toISOString().split('T')[0]
    
    if (!hasChanges) {
      return {
        hasChanges: false,
        changedFields: [],
        timestamp: new Date(),
        sourceDataDate: sourceDate
      }
    }

    const changes: DataChanges = {
      hasChanges: true,
      changedFields: [],
      timestamp: new Date(),
      sourceDataDate: sourceDate
    }

    // Randomly add different types of changes
    if (seed > 0.3) {
      changes.changedFields.push('membership')
      changes.membershipChange = {
        previous: Math.floor(seed * 1000) + 500,
        current: Math.floor(seed * 1000) + 600,
        percentChange: (seed - 0.5) * 10
      }
    }

    if (seed > 0.6) {
      changes.changedFields.push('clubCount')
      changes.clubCountChange = {
        previous: Math.floor(seed * 50) + 25,
        current: Math.floor(seed * 50) + 30,
        absoluteChange: Math.floor((seed - 0.5) * 10)
      }
    }

    if (seed > 0.8) {
      changes.changedFields.push('distinguished')
      changes.distinguishedChange = {
        previous: { president: 5, select: 3, distinguished: 2 },
        current: { president: 6, select: 4, distinguished: 3 },
        percentChange: seed * 20
      }
    }

    return changes
  }

  /**
   * Property 2: Real-time Cache Updates
   * For any data changes detected during reconciliation, the cached month-end entry 
   * should be immediately updated with the new data
   */
  describe('Property 2: Real-time Cache Updates', () => {
    it('should immediately update cache when changes are detected', async () => {
      // Generate 25 test cases with different data and change patterns
      for (let i = 0; i < 25; i++) {
        const seed = i / 25
        const districtId = `D${i}`
        const date = `2024-01-${(i % 28 + 1).toString().padStart(2, '0')}`
        
        // Generate initial data and cache it
        const initialData = generateDistrictStatistics(seed)
        initialData.districtId = districtId
        
        await cacheManager.cacheDistrictData(
          districtId,
          date,
          initialData.districtPerformance || [],
          initialData.divisionPerformance || [],
          initialData.clubPerformance || []
        )

        // Generate new data with changes
        const newData = generateDistrictStatistics(seed + 0.1)
        newData.districtId = districtId
        
        // Generate changes (always has changes for this test)
        const changes = generateDataChanges(true, seed)

        // Property: When changes are detected, cache should be updated immediately
        const result = await cacheUpdateManager.updateCacheImmediately(
          districtId,
          date,
          newData,
          changes
        )

        // Verify update was successful
        expect(result.success).toBe(true)
        expect(result.updated).toBe(true)

        // Verify cache contains the new data
        const cachedData = await cacheManager.getDistrictData(districtId, date)
        expect(cachedData).toBeDefined()
        expect(cachedData!.districtId).toBe(districtId)
        expect(cachedData!.date).toBe(date)
        
        // Verify data arrays match the new data
        expect(cachedData!.districtPerformance).toEqual(newData.districtPerformance || [])
        expect(cachedData!.divisionPerformance).toEqual(newData.divisionPerformance || [])
        expect(cachedData!.clubPerformance).toEqual(newData.clubPerformance || [])

        // Verify fetchedAt timestamp is recent (within last 5 seconds)
        const fetchedAt = new Date(cachedData!.fetchedAt)
        const now = new Date()
        const timeDiff = now.getTime() - fetchedAt.getTime()
        expect(timeDiff).toBeLessThan(5000) // Less than 5 seconds
      }
    })

    it('should not update cache when no changes are detected', async () => {
      // Generate 15 test cases where no changes are detected
      for (let i = 0; i < 15; i++) {
        const seed = i / 15
        const districtId = `D${i + 100}`
        const date = `2024-02-${(i % 28 + 1).toString().padStart(2, '0')}`
        
        // Generate initial data and cache it
        const initialData = generateDistrictStatistics(seed)
        initialData.districtId = districtId
        
        await cacheManager.cacheDistrictData(
          districtId,
          date,
          initialData.districtPerformance || [],
          initialData.divisionPerformance || [],
          initialData.clubPerformance || []
        )

        // Get the initial cache entry to compare timestamps later
        const initialCacheEntry = await cacheManager.getDistrictData(districtId, date)
        expect(initialCacheEntry).toBeDefined()

        // Generate changes with no actual changes
        const noChanges = generateDataChanges(false, seed)

        // Property: When no changes are detected, cache should not be updated
        const result = await cacheUpdateManager.updateCacheImmediately(
          districtId,
          date,
          initialData, // Same data as before
          noChanges
        )

        // Verify no update occurred
        expect(result.success).toBe(true)
        expect(result.updated).toBe(false)

        // Verify cache entry is unchanged
        const unchangedCacheEntry = await cacheManager.getDistrictData(districtId, date)
        expect(unchangedCacheEntry).toBeDefined()
        expect(unchangedCacheEntry!.fetchedAt).toBe(initialCacheEntry!.fetchedAt)
        expect(unchangedCacheEntry!.districtPerformance).toEqual(initialCacheEntry!.districtPerformance)
        expect(unchangedCacheEntry!.divisionPerformance).toEqual(initialCacheEntry!.divisionPerformance)
        expect(unchangedCacheEntry!.clubPerformance).toEqual(initialCacheEntry!.clubPerformance)
      }
    })

    it('should create and use backups for rollback on update failures', async () => {
      // Generate 10 test cases to test backup and rollback functionality
      for (let i = 0; i < 10; i++) {
        const seed = i / 10
        const districtId = `D${i + 200}`
        const date = `2024-03-${(i % 28 + 1).toString().padStart(2, '0')}`
        
        // Generate and cache initial data
        const initialData = generateDistrictStatistics(seed)
        initialData.districtId = districtId
        
        await cacheManager.cacheDistrictData(
          districtId,
          date,
          initialData.districtPerformance || [],
          initialData.divisionPerformance || [],
          initialData.clubPerformance || []
        )

        // Get initial cache entry
        const initialCacheEntry = await cacheManager.getDistrictData(districtId, date)
        expect(initialCacheEntry).toBeDefined()

        // Create a mock cache manager that will fail on the second write (the actual update)
        let writeCount = 0
        const failingCacheManager = new DistrictCacheManager(testCacheDir)
        const originalCacheMethod = failingCacheManager.cacheDistrictData.bind(failingCacheManager)
        
        failingCacheManager.cacheDistrictData = async (...args) => {
          writeCount++
          if (writeCount === 2) { // Fail on the actual update (after backup creation)
            throw new Error('Simulated cache write failure')
          }
          return originalCacheMethod(...args)
        }

        const failingCacheUpdateManager = new CacheUpdateManager(failingCacheManager)

        // Generate new data and changes
        const newData = generateDistrictStatistics(seed + 0.2)
        newData.districtId = districtId
        const changes = generateDataChanges(true, seed)

        // Property: When cache update fails, backup should be created and rollback should occur
        const result = await failingCacheUpdateManager.updateCacheImmediately(
          districtId,
          date,
          newData,
          changes
        )

        // Verify update failed but backup was created
        expect(result.success).toBe(false)
        expect(result.backupCreated).toBe(true)
        expect(result.rollbackAvailable).toBe(true)
        expect(result.error).toBeDefined()

        // Verify original data is still in cache (rollback occurred)
        const rolledBackEntry = await cacheManager.getDistrictData(districtId, date)
        expect(rolledBackEntry).toBeDefined()
        expect(rolledBackEntry!.districtPerformance).toEqual(initialCacheEntry!.districtPerformance)
        expect(rolledBackEntry!.divisionPerformance).toEqual(initialCacheEntry!.divisionPerformance)
        expect(rolledBackEntry!.clubPerformance).toEqual(initialCacheEntry!.clubPerformance)
      }
    })

    it('should maintain cache consistency across multiple concurrent updates', async () => {
      // Test concurrent updates to different districts
      const concurrentUpdates = 8
      const promises: Promise<any>[] = []

      for (let i = 0; i < concurrentUpdates; i++) {
        const seed = i / concurrentUpdates
        const districtId = `D${i + 300}`
        const date = `2024-04-${(i % 28 + 1).toString().padStart(2, '0')}`

        const updatePromise = (async () => {
          // Generate and cache initial data
          const initialData = generateDistrictStatistics(seed)
          initialData.districtId = districtId
          
          await cacheManager.cacheDistrictData(
            districtId,
            date,
            initialData.districtPerformance || [],
            initialData.divisionPerformance || [],
            initialData.clubPerformance || []
          )

          // Generate new data and changes
          const newData = generateDistrictStatistics(seed + 0.3)
          newData.districtId = districtId
          const changes = generateDataChanges(true, seed)

          // Perform concurrent update
          const result = await cacheUpdateManager.updateCacheImmediately(
            districtId,
            date,
            newData,
            changes
          )

          return { districtId, date, result, newData }
        })()

        promises.push(updatePromise)
      }

      // Wait for all concurrent updates to complete
      const results = await Promise.all(promises)

      // Property: All concurrent updates should succeed and maintain consistency
      for (const { districtId, date, result, newData } of results) {
        expect(result.success).toBe(true)
        expect(result.updated).toBe(true)

        // Verify each cache entry is consistent
        const cachedData = await cacheManager.getDistrictData(districtId, date)
        expect(cachedData).toBeDefined()
        expect(cachedData!.districtId).toBe(districtId)
        expect(cachedData!.date).toBe(date)
        expect(cachedData!.districtPerformance).toEqual(newData.districtPerformance || [])
        expect(cachedData!.divisionPerformance).toEqual(newData.divisionPerformance || [])
        expect(cachedData!.clubPerformance).toEqual(newData.clubPerformance || [])
      }
    })

    it('should handle cache consistency checks correctly', async () => {
      // Generate 12 test cases for consistency checking
      for (let i = 0; i < 12; i++) {
        const seed = i / 12
        const districtId = `D${i + 400}`
        const date = `2024-05-${(i % 28 + 1).toString().padStart(2, '0')}`
        
        // Generate and cache data
        const data = generateDistrictStatistics(seed)
        data.districtId = districtId
        
        await cacheManager.cacheDistrictData(
          districtId,
          date,
          data.districtPerformance || [],
          data.divisionPerformance || [],
          data.clubPerformance || []
        )

        // Property: Consistency check should pass for valid cached data
        const consistencyCheck = await cacheUpdateManager.checkCacheConsistency(
          districtId,
          date,
          data
        )

        expect(consistencyCheck.consistent).toBe(true)
        expect(consistencyCheck.issues).toHaveLength(0)
        expect(consistencyCheck.cacheIntegrity).toBe(true)
        expect(consistencyCheck.lastUpdateDate).toBeDefined()

        // Verify consistency check with expected data comparison
        const consistencyWithExpected = await cacheUpdateManager.checkCacheConsistency(
          districtId,
          date,
          data
        )

        expect(consistencyWithExpected.consistent).toBe(true)
        expect(consistencyWithExpected.issues).toHaveLength(0)
      }
    })

    it('should detect cache inconsistencies when data does not match', async () => {
      // Generate 8 test cases for inconsistency detection
      for (let i = 0; i < 8; i++) {
        const seed = i / 8
        const districtId = `D${i + 500}`
        const date = `2024-06-${(i % 28 + 1).toString().padStart(2, '0')}`
        
        // Generate and cache initial data
        const cachedData = generateDistrictStatistics(seed)
        cachedData.districtId = districtId
        
        await cacheManager.cacheDistrictData(
          districtId,
          date,
          cachedData.districtPerformance || [],
          cachedData.divisionPerformance || [],
          cachedData.clubPerformance || []
        )

        // Generate different expected data
        const expectedData = generateDistrictStatistics(seed + 0.4)
        expectedData.districtId = districtId

        // Property: Consistency check should detect mismatches
        const consistencyCheck = await cacheUpdateManager.checkCacheConsistency(
          districtId,
          date,
          expectedData
        )

        // Should detect inconsistency due to data mismatch
        expect(consistencyCheck.consistent).toBe(false)
        expect(consistencyCheck.issues.length).toBeGreaterThan(0)
        
        // Should still have cache integrity (structure is valid)
        expect(consistencyCheck.cacheIntegrity).toBe(true)
      }
    })

    it('should maintain update atomicity across all cache operations', async () => {
      // Generate 15 test cases to verify atomicity
      for (let i = 0; i < 15; i++) {
        const seed = i / 15
        const districtId = `D${i + 600}`
        const date = `2024-07-${(i % 28 + 1).toString().padStart(2, '0')}`
        
        // Generate initial and new data
        const initialData = generateDistrictStatistics(seed)
        const newData = generateDistrictStatistics(seed + 0.5)
        initialData.districtId = districtId
        newData.districtId = districtId
        
        // Cache initial data
        await cacheManager.cacheDistrictData(
          districtId,
          date,
          initialData.districtPerformance || [],
          initialData.divisionPerformance || [],
          initialData.clubPerformance || []
        )

        // Generate changes
        const changes = generateDataChanges(true, seed)

        // Property: Update operation should be atomic - either all data is updated or none
        const result = await cacheUpdateManager.updateCacheImmediately(
          districtId,
          date,
          newData,
          changes
        )

        if (result.success) {
          // If update succeeded, all data should be the new data
          const cachedEntry = await cacheManager.getDistrictData(districtId, date)
          expect(cachedEntry).toBeDefined()
          expect(cachedEntry!.districtPerformance).toEqual(newData.districtPerformance || [])
          expect(cachedEntry!.divisionPerformance).toEqual(newData.divisionPerformance || [])
          expect(cachedEntry!.clubPerformance).toEqual(newData.clubPerformance || [])
        } else {
          // If update failed, all data should still be the original data
          const cachedEntry = await cacheManager.getDistrictData(districtId, date)
          expect(cachedEntry).toBeDefined()
          expect(cachedEntry!.districtPerformance).toEqual(initialData.districtPerformance || [])
          expect(cachedEntry!.divisionPerformance).toEqual(initialData.divisionPerformance || [])
          expect(cachedEntry!.clubPerformance).toEqual(initialData.clubPerformance || [])
        }

        // Property: No partial updates should occur
        const finalEntry = await cacheManager.getDistrictData(districtId, date)
        expect(finalEntry).toBeDefined()
        
        // Verify that the cached data is either completely the initial data or completely the new data
        const matchesInitial = (
          JSON.stringify(finalEntry!.districtPerformance) === JSON.stringify(initialData.districtPerformance || []) &&
          JSON.stringify(finalEntry!.divisionPerformance) === JSON.stringify(initialData.divisionPerformance || []) &&
          JSON.stringify(finalEntry!.clubPerformance) === JSON.stringify(initialData.clubPerformance || [])
        )
        
        const matchesNew = (
          JSON.stringify(finalEntry!.districtPerformance) === JSON.stringify(newData.districtPerformance || []) &&
          JSON.stringify(finalEntry!.divisionPerformance) === JSON.stringify(newData.divisionPerformance || []) &&
          JSON.stringify(finalEntry!.clubPerformance) === JSON.stringify(newData.clubPerformance || [])
        )

        // Must match either initial or new data completely (no partial updates)
        expect(matchesInitial || matchesNew).toBe(true)
      }
    })
  })
})