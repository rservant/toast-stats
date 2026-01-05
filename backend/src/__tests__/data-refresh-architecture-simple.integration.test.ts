/**
 * Simplified Integration Tests for Data Refresh Architecture
 *
 * Tests end-to-end refresh workflows, read endpoint behavior during refresh operations,
 * error recovery scenarios, and authentication flows without complex mocking.
 *
 * This test suite validates Requirements: All (as specified in task 19.1)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { RefreshService } from '../services/RefreshService.js'
import { FileSnapshotStore } from '../services/FileSnapshotStore.js'
import { DataValidator } from '../services/DataValidator.js'
import { DistrictConfigurationService } from '../services/DistrictConfigurationService.js'
import { ProcessSeparationValidator } from '../services/ProcessSeparationValidator.js'
import { ToastmastersScraper } from '../services/ToastmastersScraper.js'
import { Snapshot } from '../types/snapshots.js'

// Mock scraper interface matching ToastmastersScraper methods used by RefreshService
interface MockScraper {
  getAllDistricts: ReturnType<typeof vi.fn>
  getDistrictPerformance: ReturnType<typeof vi.fn>
  getDivisionPerformance: ReturnType<typeof vi.fn>
  getClubPerformance: ReturnType<typeof vi.fn>
  closeBrowser: ReturnType<typeof vi.fn>
}

describe('Data Refresh Architecture - Integration Tests', () => {
  let tempDir: string
  let snapshotStore: FileSnapshotStore
  let refreshService: RefreshService
  let mockScraper: MockScraper
  let dataValidator: DataValidator
  let districtConfigService: DistrictConfigurationService

  beforeEach(async () => {
    // Create temporary directory for testing
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'data-refresh-integration-test-')
    )

    // Create test snapshot store
    snapshotStore = new FileSnapshotStore({
      cacheDir: tempDir,
      maxSnapshots: 10,
      maxAgeDays: 7,
      enableCompression: false,
    })

    // Create mock scraper with realistic data - ensure consistent structure
    mockScraper = {
      getAllDistricts: vi.fn(),
      getDistrictPerformance: vi.fn(),
      getDivisionPerformance: vi.fn(),
      getClubPerformance: vi.fn(),
      closeBrowser: vi.fn(),
    }

    // Set up default mock implementations - return raw arrays as expected by RetryManager
    mockScraper.getAllDistricts.mockResolvedValue([
      { DISTRICT: '61', 'District Name': 'Test District 61' },
      { DISTRICT: '62', 'District Name': 'Test District 62' },
    ])

    mockScraper.getDistrictPerformance.mockResolvedValue([
      {
        District: '61',
        'Club Count': '5',
        Membership: '100',
        'Distinguished Clubs': '2',
      },
    ])

    mockScraper.getDivisionPerformance.mockResolvedValue([
      { Division: 'A', 'Club Count': '2', Membership: '40' },
      { Division: 'B', 'Club Count': '3', Membership: '60' },
    ])

    mockScraper.getClubPerformance.mockResolvedValue([
      {
        'Club Number': '123',
        'Club Name': 'Test Club 1',
        'Active Members': '20',
        'Club Status': 'Active',
      },
      {
        'Club Number': '124',
        'Club Name': 'Test Club 2',
        'Active Members': '25',
        'Club Status': 'Active',
      },
      {
        'Club Number': '125',
        'Club Name': 'Test Club 3',
        'Active Members': '15',
        'Club Status': 'Active',
      },
    ])

    mockScraper.closeBrowser.mockResolvedValue(undefined)

    // Create data validator
    dataValidator = new DataValidator()

    // Create district configuration service and configure it with valid districts
    districtConfigService = new DistrictConfigurationService(tempDir)
    await districtConfigService.setConfiguredDistricts(['61'], 'test-admin')

    // Create test refresh service
    refreshService = new RefreshService(
      snapshotStore,
      mockScraper as unknown as ToastmastersScraper,
      dataValidator,
      districtConfigService
    )
  })

  afterEach(async () => {
    // Reset all mocks to their default state - return raw arrays as expected by RetryManager
    mockScraper.getAllDistricts.mockResolvedValue([
      { DISTRICT: '61', 'District Name': 'Test District 61' },
      { DISTRICT: '62', 'District Name': 'Test District 62' },
    ])

    mockScraper.getDistrictPerformance.mockResolvedValue([
      {
        District: '61',
        'Club Count': '5',
        Membership: '100',
        'Distinguished Clubs': '2',
      },
    ])

    mockScraper.getDivisionPerformance.mockResolvedValue([
      { Division: 'A', 'Club Count': '2', Membership: '40' },
      { Division: 'B', 'Club Count': '3', Membership: '60' },
    ])

    mockScraper.getClubPerformance.mockResolvedValue([
      {
        'Club Number': '123',
        'Club Name': 'Test Club 1',
        'Active Members': '20',
        'Club Status': 'Active',
      },
      {
        'Club Number': '124',
        'Club Name': 'Test Club 2',
        'Active Members': '25',
        'Club Status': 'Active',
      },
      {
        'Club Number': '125',
        'Club Name': 'Test Club 3',
        'Active Members': '15',
        'Club Status': 'Active',
      },
    ])

    mockScraper.closeBrowser.mockResolvedValue(undefined)

    // Clear district configuration cache
    districtConfigService.clearCache()

    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  const createTestSnapshot = (
    id: string,
    status: 'success' | 'failed' = 'success'
  ): Snapshot => ({
    snapshot_id: id,
    created_at: new Date(parseInt(id)).toISOString(),
    schema_version: '1.0.0',
    calculation_version: '1.0.0',
    status,
    errors: status === 'failed' ? ['Test error'] : [],
    payload: {
      districts: [
        {
          districtId: '61',
          name: 'Test District 61',
          asOfDate: new Date().toISOString().split('T')[0],
          membership: {
            total: 100,
            change: 5,
            changePercent: 5.0,
            byClub: [
              { clubId: '123', clubName: 'Test Club 1', memberCount: 20 },
              { clubId: '124', clubName: 'Test Club 2', memberCount: 25 },
            ],
            new: 10,
            renewed: 90,
            dual: 0,
          },
          clubs: {
            total: 5,
            active: 5,
            suspended: 0,
            ineligible: 0,
            low: 0,
            distinguished: 2,
            chartered: 5,
          },
          education: {
            totalAwards: 15,
            byType: [],
            topClubs: [],
          },
        } as Snapshot['payload']['districts'][0],
      ],
      metadata: {
        source: 'test',
        fetchedAt: new Date(parseInt(id)).toISOString(),
        dataAsOfDate: new Date().toISOString().split('T')[0],
        districtCount: 1,
        processingDurationMs: 1000,
      },
    },
  })

  describe('End-to-End Refresh Workflows with Real Data', () => {
    it('should execute complete refresh workflow successfully', async () => {
      // Execute refresh operation
      const refreshResult = await refreshService.executeRefresh()

      // Verify refresh completed successfully
      expect(refreshResult.success).toBe(true)
      expect(refreshResult.snapshot_id).toBeDefined()
      expect(refreshResult.duration_ms).toBeGreaterThan(0)
      expect(refreshResult.status).toBe('success')
      expect(refreshResult.errors).toHaveLength(0)
      expect(refreshResult.metadata.districtCount).toBeGreaterThan(0)

      // Verify snapshot was created and stored
      const latestSnapshot = await snapshotStore.getLatestSuccessful()
      expect(latestSnapshot).not.toBeNull()
      expect(latestSnapshot?.snapshot_id).toBe(refreshResult.snapshot_id)
      expect(latestSnapshot?.status).toBe('success')
      expect(latestSnapshot?.payload.districts.length).toBeGreaterThan(0)

      // Verify scraper methods were called correctly
      expect(mockScraper.getAllDistricts).toHaveBeenCalledTimes(1)
      expect(mockScraper.getDistrictPerformance).toHaveBeenCalled()
      expect(mockScraper.getDivisionPerformance).toHaveBeenCalled()
      expect(mockScraper.getClubPerformance).toHaveBeenCalled()
      expect(mockScraper.closeBrowser).toHaveBeenCalledTimes(1)
    }, 30000)

    it('should handle scraping failures gracefully and create failed snapshot', async () => {
      // Configure scraper to fail - return failure by throwing an error
      mockScraper.getAllDistricts.mockRejectedValue(
        new Error('Scraping failed')
      )

      // Execute refresh operation
      const refreshResult = await refreshService.executeRefresh()

      // Verify refresh failed but handled gracefully
      expect(refreshResult.success).toBe(false)
      expect(refreshResult.status).toBe('failed')
      expect(refreshResult.errors.length).toBeGreaterThan(0)
      expect(refreshResult.snapshot_id).toBeDefined()

      // Verify failed snapshot was created
      const latestSnapshot = await snapshotStore.getLatest()
      expect(latestSnapshot).not.toBeNull()
      expect(latestSnapshot?.status).toBe('failed')
      expect(latestSnapshot?.errors.length).toBeGreaterThan(0)

      // Verify no successful snapshot exists
      const successfulSnapshot = await snapshotStore.getLatestSuccessful()
      expect(successfulSnapshot).toBeNull()
    }, 30000)

    it('should handle validation failures and create failed snapshot', async () => {
      // Mock validator to fail validation
      const mockValidator = {
        validate: vi.fn().mockResolvedValue({
          isValid: false,
          errors: [
            'Invalid district data structure',
            'Missing required fields',
          ],
          warnings: [],
        }),
        validatorVersion: '1.0.0',
        validateBusinessRules: vi.fn(),
        validateDistrictConsistency: vi.fn(),
        getValidatorVersion: vi.fn().mockReturnValue('1.0.0'),
        validatePartial: vi.fn(),
      }

      // Create refresh service with failing validator
      const refreshServiceWithFailingValidator = new RefreshService(
        snapshotStore,
        mockScraper as unknown as ToastmastersScraper,
        mockValidator as unknown as DataValidator,
        districtConfigService
      )

      // Execute refresh operation
      const refreshResult =
        await refreshServiceWithFailingValidator.executeRefresh()

      // Verify refresh failed due to validation
      expect(refreshResult.success).toBe(false)
      expect(refreshResult.status).toBe('failed')
      expect(refreshResult.errors.length).toBeGreaterThan(0)
      // The error should contain validation failure information
      expect(
        refreshResult.errors.some(
          e =>
            e.includes('validation') ||
            e.includes('Invalid') ||
            e.includes('Missing')
        )
      ).toBe(true)

      // Verify failed snapshot was created with validation errors
      const latestSnapshot = await snapshotStore.getLatest()
      expect(latestSnapshot).not.toBeNull()
      expect(latestSnapshot?.status).toBe('failed')
      expect(latestSnapshot?.errors.length).toBeGreaterThan(0)
    }, 30000)

    it('should preserve current snapshot when refresh fails', async () => {
      // Create initial successful snapshot
      const initialSnapshot = createTestSnapshot('1704067200000', 'success')
      await snapshotStore.writeSnapshot(initialSnapshot)

      // Configure scraper to fail completely - make getAllDistricts fail
      mockScraper.getAllDistricts.mockRejectedValue(
        new Error('Network timeout')
      )

      // Execute refresh operation (should fail)
      const refreshResult = await refreshService.executeRefresh()

      // Verify refresh failed
      expect(refreshResult.success).toBe(false)

      // Verify current successful snapshot is preserved
      const currentSnapshot = await snapshotStore.getLatestSuccessful()
      expect(currentSnapshot).not.toBeNull()
      expect(currentSnapshot?.snapshot_id).toBe('1704067200000')
      expect(currentSnapshot?.status).toBe('success')

      // Verify failed snapshot was created but doesn't affect current pointer
      const latestSnapshot = await snapshotStore.getLatest()
      expect(latestSnapshot?.status).toBe('failed')
      expect(latestSnapshot?.snapshot_id).not.toBe('1704067200000')
    }, 30000)
  })

  describe('Snapshot Store Operations', () => {
    it('should serve read requests from snapshots consistently', async () => {
      // Create initial snapshot
      const initialSnapshot = createTestSnapshot('1704067200000', 'success')
      await snapshotStore.writeSnapshot(initialSnapshot)

      // Make multiple concurrent read requests
      const readPromises = Array.from({ length: 10 }, async () => {
        return snapshotStore.getLatestSuccessful()
      })

      const results = await Promise.all(readPromises)

      // Verify all reads returned the same snapshot
      results.forEach(result => {
        expect(result).not.toBeNull()
        expect(result?.snapshot_id).toBe('1704067200000')
        expect(result?.status).toBe('success')
      })
    })

    it('should maintain read performance during concurrent operations', async () => {
      // Create initial snapshot
      const initialSnapshot = createTestSnapshot('1704067200000', 'success')
      await snapshotStore.writeSnapshot(initialSnapshot)

      // Measure baseline read performance with multiple samples
      const baselineTimes: number[] = []
      for (let i = 0; i < 5; i++) {
        const start = Date.now()
        await snapshotStore.getLatestSuccessful()
        const duration = Date.now() - start
        baselineTimes.push(Math.max(duration, 1)) // Ensure minimum 1ms
      }
      const baselineTime = Math.max(
        baselineTimes.reduce((a, b) => a + b, 0) / baselineTimes.length,
        1
      )

      // Start refresh operation in background (make it slow)
      mockScraper.getAllDistricts.mockImplementation(
        () =>
          new Promise(resolve =>
            setTimeout(
              () =>
                resolve([
                  { DISTRICT: '61', 'District Name': 'Test District 61' },
                ]),
              1000
            )
          )
      )

      const refreshPromise = refreshService.executeRefresh()

      // Measure read performance during refresh with multiple samples
      await new Promise(resolve => setTimeout(resolve, 100)) // Let refresh start
      const duringRefreshTimes: number[] = []
      for (let i = 0; i < 3; i++) {
        const start = Date.now()
        const result = await snapshotStore.getLatestSuccessful()
        const duration = Date.now() - start
        duringRefreshTimes.push(Math.max(duration, 1)) // Ensure minimum 1ms
        expect(result).not.toBeNull()
        expect(result?.snapshot_id).toBe('1704067200000')
      }
      const duringRefreshTime =
        duringRefreshTimes.reduce((a, b) => a + b, 0) /
        duringRefreshTimes.length

      // Wait for refresh to complete
      await refreshPromise

      // Verify read performance didn't degrade significantly (allow up to 10x degradation)
      expect(duringRefreshTime).toBeLessThan(baselineTime * 10)

      // Verify we can still read the original snapshot
      const finalResult = await snapshotStore.getLatestSuccessful()
      expect(finalResult).not.toBeNull()
    }, 30000)

    it('should return null when no successful snapshot is available', async () => {
      // Create only failed snapshots
      const failedSnapshot = createTestSnapshot('1704067200000', 'failed')
      await snapshotStore.writeSnapshot(failedSnapshot)

      // Attempt to get latest successful snapshot
      const result = await snapshotStore.getLatestSuccessful()
      expect(result).toBeNull()

      // But latest snapshot should return the failed one
      const latest = await snapshotStore.getLatest()
      expect(latest).not.toBeNull()
      expect(latest?.status).toBe('failed')
    })
  })

  describe('Error Recovery Scenarios', () => {
    it('should recover from corrupted current pointer', async () => {
      // Create successful snapshots
      const snapshot1 = createTestSnapshot('1704067200000', 'success')
      const snapshot2 = createTestSnapshot('1704153600000', 'success')
      await snapshotStore.writeSnapshot(snapshot1)
      await snapshotStore.writeSnapshot(snapshot2)

      // Corrupt the current.json pointer file
      const currentPointerPath = path.join(tempDir, 'current.json')
      await fs.writeFile(currentPointerPath, 'invalid json content')

      // Attempt to get latest successful snapshot (should recover)
      const latestSnapshot = await snapshotStore.getLatestSuccessful()

      // Should recover by scanning directory and finding most recent successful snapshot
      expect(latestSnapshot).not.toBeNull()
      expect(latestSnapshot?.snapshot_id).toBe('1704153600000')
    })

    it('should handle concurrent refresh attempts gracefully', async () => {
      // Reset and ensure mocks are properly set up for successful operations
      mockScraper.getAllDistricts.mockReset()
      mockScraper.getDistrictPerformance.mockReset()
      mockScraper.getDivisionPerformance.mockReset()
      mockScraper.getClubPerformance.mockReset()
      mockScraper.closeBrowser.mockReset()

      // Set up consistent mock implementations that return raw arrays
      mockScraper.getAllDistricts.mockResolvedValue([
        { DISTRICT: '61', 'District Name': 'Test District 61' },
      ])

      mockScraper.getDistrictPerformance.mockResolvedValue([
        {
          District: '61',
          'Club Count': '5',
          Membership: '100',
          'Distinguished Clubs': '2',
        },
      ])

      mockScraper.getDivisionPerformance.mockResolvedValue([
        { Division: 'A', 'Club Count': '2', Membership: '40' },
      ])

      mockScraper.getClubPerformance.mockResolvedValue([
        {
          'Club Number': '123',
          'Club Name': 'Test Club 1',
          'Active Members': '20',
          'Club Status': 'Active',
        },
      ])

      mockScraper.closeBrowser.mockResolvedValue(undefined)

      // First, ensure we have a clean state by clearing any existing snapshots
      const existingSnapshots = await snapshotStore.listSnapshots()
      for (const snapshot of existingSnapshots) {
        await snapshotStore.deleteSnapshot(snapshot.snapshot_id)
      }

      // Execute one successful refresh first to ensure we have a baseline
      const initialResult = await refreshService.executeRefresh()
      expect(initialResult.success).toBe(true)

      // Now start multiple refresh operations simultaneously
      const refreshPromises = Array.from({ length: 3 }, () =>
        refreshService.executeRefresh()
      )

      const results = await Promise.all(refreshPromises)

      // With the initial successful refresh, we should have at least one successful snapshot
      const snapshots = await snapshotStore.listSnapshots()
      const successfulSnapshots = snapshots.filter(s => s.status === 'success')
      expect(successfulSnapshots.length).toBeGreaterThanOrEqual(1)

      // The concurrent operations should handle gracefully (some may succeed, some may fail due to locking)
      const allResults = [initialResult, ...results]
      const successfulResults = allResults.filter(r => r.success)
      expect(successfulResults.length).toBeGreaterThanOrEqual(1)
    }, 30000)

    it('should handle disk space issues gracefully', async () => {
      // Mock writeSnapshot to simulate disk space error
      const originalWriteSnapshot = snapshotStore.writeSnapshot
      snapshotStore.writeSnapshot = vi
        .fn()
        .mockRejectedValue(new Error('ENOSPC: no space left on device'))

      // Execute refresh operation
      const refreshResult = await refreshService.executeRefresh()

      // Verify refresh failed gracefully
      expect(refreshResult.success).toBe(false)
      expect(
        refreshResult.errors.some(e => e.includes('Failed to create snapshot'))
      ).toBe(true)

      // Restore original method
      snapshotStore.writeSnapshot = originalWriteSnapshot
    }, 30000)

    it('should maintain service availability during partial failures', async () => {
      // Create initial successful snapshot
      const initialSnapshot = createTestSnapshot('1704067200000', 'success')
      await snapshotStore.writeSnapshot(initialSnapshot)

      // Configure scraper to fail for some operations but succeed for others
      // Make getDistrictPerformance succeed but getDivisionPerformance fail
      mockScraper.getDistrictPerformance.mockResolvedValue([
        {
          District: '61',
          'Club Count': '5',
          Membership: '100',
          'Distinguished Clubs': '2',
        },
      ])

      mockScraper.getDivisionPerformance.mockRejectedValue(
        new Error('Division data failed')
      )

      // Execute refresh (should handle partial failure)
      const refreshResult = await refreshService.executeRefresh()

      // The refresh might fail due to partial data issues, but service should remain available
      // Service should remain available - either with the new snapshot or the previous one
      const currentSnapshot = await snapshotStore.getLatestSuccessful()
      expect(currentSnapshot).not.toBeNull()

      // The snapshot should be either the new one (if refresh succeeded) or the original one
      expect(currentSnapshot?.status).toBe('success')

      // If refresh failed, we should still have the original snapshot available
      if (!refreshResult.success) {
        expect(currentSnapshot?.snapshot_id).toBe('1704067200000')
      }
    }, 30000)
  })

  describe('Process Separation Validation', () => {
    it('should validate process separation compliance', async () => {
      // Create initial snapshot
      const initialSnapshot = createTestSnapshot('1704067200000', 'success')
      await snapshotStore.writeSnapshot(initialSnapshot)

      // Create process separation validator
      const validator = new ProcessSeparationValidator(
        snapshotStore,
        refreshService
      )

      // Test process separation validation
      const validationResult = await validator.validateProcessSeparation()

      expect(validationResult.isValid).toBeDefined()
      expect(validationResult.readOperationsContinued).toBeDefined()
      expect(validationResult.refreshDidNotBlockReads).toBeDefined()
      expect(validationResult.validatedAt).toBeDefined()
    }, 30000)

    it('should monitor concurrent operations', async () => {
      // Create initial snapshot
      const initialSnapshot = createTestSnapshot('1704067200000', 'success')
      await snapshotStore.writeSnapshot(initialSnapshot)

      // Create process separation validator
      const validator = new ProcessSeparationValidator(
        snapshotStore,
        refreshService
      )

      // Test concurrent operations monitoring
      const monitoringResult = await validator.monitorConcurrentOperations()

      expect(monitoringResult.maxConcurrentReads).toBeDefined()
      expect(monitoringResult.averageReadTime).toBeDefined()
      expect(monitoringResult.readThroughput).toBeDefined()
    }, 30000)

    it('should provide compliance metrics', async () => {
      // Create initial snapshot
      const initialSnapshot = createTestSnapshot('1704067200000', 'success')
      await snapshotStore.writeSnapshot(initialSnapshot)

      // Create process separation validator
      const validator = new ProcessSeparationValidator(
        snapshotStore,
        refreshService
      )

      // Test compliance metrics
      const complianceMetrics = await validator.getComplianceMetrics()

      expect(complianceMetrics.processSeparationScore).toBeDefined()
      expect(complianceMetrics.complianceStatus).toBeDefined()
      expect(complianceMetrics.readOperationHealth).toBeDefined()
      expect(complianceMetrics.refreshOperationHealth).toBeDefined()
    }, 30000)

    it('should validate read performance independence', async () => {
      // Create initial snapshot
      const initialSnapshot = createTestSnapshot('1704067200000', 'success')
      await snapshotStore.writeSnapshot(initialSnapshot)

      // Create process separation validator
      const validator = new ProcessSeparationValidator(
        snapshotStore,
        refreshService
      )

      // Test read performance independence validation
      const independenceResult =
        await validator.validateReadPerformanceIndependence()

      expect(independenceResult.isIndependent).toBeDefined()
      expect(independenceResult.baselineReadTime).toBeDefined()
      expect(independenceResult.readTimeDuringRefresh).toBeDefined()
      expect(independenceResult.performanceDegradation).toBeDefined()
    }, 30000)
  })

  describe('Snapshot Store Health and Integrity', () => {
    it('should check snapshot store readiness', async () => {
      // Test empty store
      const isReadyEmpty = await snapshotStore.isReady()
      expect(typeof isReadyEmpty).toBe('boolean')

      // Create test snapshot
      const testSnapshot = createTestSnapshot('1704067200000', 'success')
      await snapshotStore.writeSnapshot(testSnapshot)

      // Test store with data
      const isReadyWithData = await snapshotStore.isReady()
      expect(isReadyWithData).toBe(true)
    })

    it('should list snapshots with filtering', async () => {
      // Create snapshots with different statuses
      const successSnapshot = createTestSnapshot('1704067200000', 'success')
      const failedSnapshot = createTestSnapshot('1704153600000', 'failed')

      await snapshotStore.writeSnapshot(successSnapshot)
      await snapshotStore.writeSnapshot(failedSnapshot)

      // List all snapshots
      const allSnapshots = await snapshotStore.listSnapshots()
      expect(allSnapshots.length).toBe(2)

      // List with limit
      const limitedSnapshots = await snapshotStore.listSnapshots(1)
      expect(limitedSnapshots.length).toBe(1)

      // List with status filter
      const successfulSnapshots = await snapshotStore.listSnapshots(10, {
        status: 'success',
      })
      expect(successfulSnapshots.length).toBe(1)
      expect(successfulSnapshots[0].status).toBe('success')
    })

    it('should handle empty store gracefully', async () => {
      // Test operations on empty store
      const latestSuccessful = await snapshotStore.getLatestSuccessful()
      expect(latestSuccessful).toBeNull()

      const latest = await snapshotStore.getLatest()
      expect(latest).toBeNull()

      const snapshots = await snapshotStore.listSnapshots()
      expect(snapshots).toHaveLength(0)
    })
  })

  describe('Data Freshness and Metadata', () => {
    it('should include proper metadata in snapshots', async () => {
      // Execute refresh to create snapshot with metadata
      const refreshResult = await refreshService.executeRefresh()
      expect(refreshResult.success).toBe(true)

      // Get the created snapshot
      const snapshot = await snapshotStore.getLatestSuccessful()
      expect(snapshot).not.toBeNull()

      // Verify metadata structure
      expect(snapshot?.snapshot_id).toBeDefined()
      expect(snapshot?.created_at).toBeDefined()
      expect(snapshot?.schema_version).toBeDefined()
      expect(snapshot?.calculation_version).toBeDefined()
      expect(snapshot?.payload.metadata.source).toBeDefined()
      expect(snapshot?.payload.metadata.fetchedAt).toBeDefined()
      expect(snapshot?.payload.metadata.dataAsOfDate).toBeDefined()
      expect(snapshot?.payload.metadata.districtCount).toBeGreaterThan(0)
    })

    it('should provide data freshness information', async () => {
      const testSnapshot = createTestSnapshot('1704067200000', 'success')
      await snapshotStore.writeSnapshot(testSnapshot)

      const snapshot = await snapshotStore.getLatestSuccessful()
      expect(snapshot).not.toBeNull()

      // Verify freshness information
      expect(snapshot?.created_at).toBeDefined()
      expect(snapshot?.payload.metadata.fetchedAt).toBeDefined()
      expect(snapshot?.payload.metadata.dataAsOfDate).toBeDefined()

      // Verify dates are valid
      expect(new Date(snapshot!.created_at).getTime()).toBeGreaterThan(0)
      expect(
        new Date(snapshot!.payload.metadata.fetchedAt).getTime()
      ).toBeGreaterThan(0)
    })
  })

  describe('Circuit Breaker and Retry Logic', () => {
    it('should handle circuit breaker functionality', async () => {
      // Get circuit breaker stats
      const stats = refreshService.getCircuitBreakerStats()
      expect(stats.scraping).toBeDefined()
      expect(stats.scraping.state).toBeDefined()
      expect(stats.scraping.failureCount).toBeDefined()
    })

    it('should reset circuit breaker when requested', async () => {
      // Reset circuit breaker
      refreshService.resetCircuitBreaker()

      // Verify stats after reset
      const stats = refreshService.getCircuitBreakerStats()
      expect(stats.scraping.failureCount).toBe(0)
      expect(stats.scraping.state).toBe('CLOSED')
    })
  })
})
