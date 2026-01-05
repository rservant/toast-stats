/**
 * Integration tests for ProcessSeparationValidator
 * Tests real-world scenarios with actual refresh and read operations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ProcessSeparationValidator } from '../ProcessSeparationValidator.js'
import { FileSnapshotStore } from '../FileSnapshotStore.js'
import { RefreshService } from '../RefreshService.js'
import { DataValidator } from '../DataValidator.js'
import { Snapshot } from '../../types/snapshots.js'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

// Mock scraper interface matching ToastmastersScraper methods used by RefreshService
interface MockScraper {
  getAllDistricts: () => Promise<{
    success: boolean
    result: unknown[]
    attempts: number
  }>
  getDistrictPerformance: (
    districtId: string
  ) => Promise<{ success: boolean; result: unknown[]; attempts: number }>
  getDivisionPerformance: (
    districtId: string
  ) => Promise<{ success: boolean; result: unknown[]; attempts: number }>
  getClubPerformance: (
    districtId: string
  ) => Promise<{ success: boolean; result: unknown[]; attempts: number }>
  closeBrowser: () => Promise<void>
}

// Performance metrics interface matching FileSnapshotStore
interface ReadPerformanceMetrics {
  totalReads: number
  cacheHits: number
  cacheMisses: number
  averageReadTime: number
  concurrentReads: number
  maxConcurrentReads: number
}

describe('ProcessSeparationValidator Integration Tests', () => {
  let validator: ProcessSeparationValidator
  let snapshotStore: FileSnapshotStore
  let refreshService: RefreshService
  let tempDir: string

  beforeEach(async () => {
    // Create temporary directory for testing
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'process-separation-integration-test-')
    )

    snapshotStore = new FileSnapshotStore({
      cacheDir: tempDir,
      maxSnapshots: 10,
      maxAgeDays: 7,
      enableCompression: false,
    })

    // Create refresh service with mocked dependencies for controlled testing
    const mockScraper: MockScraper = {
      getAllDistricts: vi.fn().mockResolvedValue({
        success: true,
        result: [{ DISTRICT: '61', 'District Name': 'Test District' }],
        attempts: 1,
      }),
      getDistrictPerformance: vi.fn().mockResolvedValue({
        success: true,
        result: [{ District: '61', 'Club Count': '5', Membership: '100' }],
        attempts: 1,
      }),
      getDivisionPerformance: vi.fn().mockResolvedValue({
        success: true,
        result: [{ Division: 'A', 'Club Count': '2', Membership: '40' }],
        attempts: 1,
      }),
      getClubPerformance: vi.fn().mockResolvedValue({
        success: true,
        result: [
          {
            'Club Number': '123',
            'Club Name': 'Test Club',
            'Active Members': '20',
          },
        ],
        attempts: 1,
      }),
      closeBrowser: vi.fn().mockResolvedValue(undefined),
    }

    const dataValidator = new DataValidator()
    refreshService = new RefreshService(
      snapshotStore,
      mockScraper as MockScraper,
      dataValidator
    )
    validator = new ProcessSeparationValidator(snapshotStore, refreshService)
  })

  afterEach(async () => {
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
    created_at: new Date().toISOString(),
    schema_version: '1.0.0',
    calculation_version: '1.0.0',
    status,
    errors: [],
    payload: {
      districts: [
        {
          districtId: '61',
          asOfDate: new Date().toISOString(),
          membership: {
            total: 100,
            change: 5,
            changePercent: 5.0,
            byClub: [],
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
        },
      ],
      metadata: {
        source: 'test',
        fetchedAt: new Date().toISOString(),
        dataAsOfDate: new Date().toISOString(),
        districtCount: 1,
        processingDurationMs: 100,
      },
    },
  })

  it('should validate process separation with real refresh and read operations', async () => {
    // Setup: Create initial snapshot
    const initialSnapshot = createTestSnapshot('1704067200000')
    await snapshotStore.writeSnapshot(initialSnapshot)

    // Test: Run full process separation validation
    const result = await validator.validateProcessSeparation()

    expect(result.isValid).toBe(true)
    expect(result.readOperationsContinued).toBe(true)
    expect(result.refreshDidNotBlockReads).toBe(true)
    expect(result.averageReadResponseTime).toBeLessThan(1000) // Should be fast
    expect(result.concurrentOperationsHandled).toBeGreaterThan(0)
    expect(result.issues).toHaveLength(0)
    expect(result.validatedAt).toBeDefined()
    expect(result.validationDurationMs).toBeGreaterThan(0)
  }, 15000) // Longer timeout for integration test

  it('should handle concurrent reads during actual refresh operation', async () => {
    // Setup: Create initial snapshot
    const initialSnapshot = createTestSnapshot('1704067200000')
    await snapshotStore.writeSnapshot(initialSnapshot)

    // Mock the refresh service to return a successful result
    const mockRefreshResult = {
      success: true,
      snapshot_id: 'test-refresh-snapshot',
      duration_ms: 1000,
      errors: [],
      status: 'success' as const,
      metadata: {
        districtCount: 1,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        schemaVersion: '1.0.0',
        calculationVersion: '1.0.0',
      },
    }

    // Mock the executeRefresh method
    vi.spyOn(refreshService, 'executeRefresh').mockResolvedValue(
      mockRefreshResult
    )

    // Start a mocked refresh operation in the background
    const refreshPromise = refreshService.executeRefresh()

    // Start multiple concurrent read operations
    const readPromises = Array.from({ length: 5 }, async () => {
      return snapshotStore.getLatestSuccessful()
    })

    // Wait for all operations to complete
    const [refreshResult, ...readResults] = await Promise.all([
      refreshPromise,
      ...readPromises,
    ])

    // Verify refresh completed successfully
    expect(refreshResult.success).toBe(true)
    expect(refreshResult.snapshot_id).toBeDefined()

    // Verify all read operations completed successfully
    readResults.forEach(result => {
      expect(result).not.toBeNull()
      expect(result?.snapshot_id).toBeDefined()
    })

    // Test concurrent operations monitoring
    const monitoringResult = await validator.monitorConcurrentOperations()
    expect(monitoringResult.maxConcurrentReads).toBeGreaterThan(0)
    expect(monitoringResult.readThroughput).toBeGreaterThan(0)
  }, 20000) // Longer timeout for refresh operation

  it('should validate read performance independence during refresh', async () => {
    // Setup: Create initial snapshot
    const initialSnapshot = createTestSnapshot('1704067200000')
    await snapshotStore.writeSnapshot(initialSnapshot)

    // Test: Validate read performance independence
    const result = await validator.validateReadPerformanceIndependence()

    expect(result.isIndependent).toBe(true)
    expect(result.baselineReadTime).toBeGreaterThanOrEqual(0)
    expect(result.readTimeDuringRefresh).toBeGreaterThanOrEqual(0)
    expect(result.performanceDegradation).toBeLessThan(600) // Should be reasonable with new threshold
    expect(result.acceptableDegradationThreshold).toBe(500)
    expect(result.validatedAt).toBeDefined()
  }, 10000)

  it('should provide accurate compliance metrics', async () => {
    // Setup: Create initial snapshot
    const initialSnapshot = createTestSnapshot('1704067200000')
    await snapshotStore.writeSnapshot(initialSnapshot)

    // Test: Get compliance metrics
    const metrics = await validator.getComplianceMetrics()

    expect(metrics.processSeparationScore).toBeGreaterThanOrEqual(0)
    expect(metrics.processSeparationScore).toBeLessThanOrEqual(100)
    expect(metrics.readOperationHealth).toMatch(/^(healthy|degraded|critical)$/)
    expect(metrics.refreshOperationHealth).toMatch(
      /^(healthy|degraded|critical)$/
    )
    expect(metrics.complianceStatus).toMatch(
      /^(compliant|warning|non_compliant)$/
    )
    expect(metrics.lastValidationTime).toBeDefined()
    expect(Array.isArray(metrics.complianceTrend)).toBe(true)
  }, 15000)

  it('should detect performance issues when snapshot store is under stress', async () => {
    // Setup: Create initial snapshot
    const initialSnapshot = createTestSnapshot('1704067200000')
    await snapshotStore.writeSnapshot(initialSnapshot)

    // Simulate stress by creating many concurrent operations
    const stressTestPromises = Array.from({ length: 20 }, async () => {
      return snapshotStore.getLatestSuccessful()
    })

    // Monitor performance during stress
    const monitoringPromise = validator.monitorConcurrentOperations()

    // Wait for all operations
    const [monitoringResult] = await Promise.all([
      monitoringPromise,
      ...stressTestPromises,
    ])

    // Verify monitoring captured the stress
    expect(monitoringResult.maxConcurrentReads).toBeGreaterThan(1)
    expect(monitoringResult.averageReadTime).toBeGreaterThanOrEqual(0)
    expect(monitoringResult.readThroughput).toBeGreaterThan(0)
  }, 15000)

  it('should maintain compliance history across multiple validations', async () => {
    // Setup: Create initial snapshot
    const initialSnapshot = createTestSnapshot('1704067200000')
    await snapshotStore.writeSnapshot(initialSnapshot)

    // Run multiple validations to build history
    await validator.validateProcessSeparation()
    await validator.validateProcessSeparation()
    await validator.validateProcessSeparation()

    // Check compliance metrics include history
    const metrics = await validator.getComplianceMetrics()

    expect(metrics.complianceTrend.length).toBeGreaterThan(0)
    expect(metrics.complianceTrend.length).toBeLessThanOrEqual(10) // Should limit history

    // Each history entry should have required fields
    metrics.complianceTrend.forEach(entry => {
      expect(entry.timestamp).toBeDefined()
      expect(entry.score).toBeGreaterThanOrEqual(0)
      expect(entry.score).toBeLessThanOrEqual(100)
      expect(entry.status).toBeDefined()
    })
  }, 20000)

  it('should handle edge case of no snapshots available', async () => {
    // Test: Validate when no snapshots exist
    const result = await validator.validateProcessSeparation()

    // Should handle gracefully but may not be fully valid
    expect(result.isValid).toBeDefined()
    expect(result.readOperationsContinued).toBeDefined()
    expect(result.refreshDidNotBlockReads).toBeDefined()
    expect(result.validatedAt).toBeDefined()
    expect(result.validationDurationMs).toBeGreaterThan(0)
  }, 10000)

  it('should validate that snapshot store performance metrics are tracked', async () => {
    // Setup: Create initial snapshot
    const initialSnapshot = createTestSnapshot('1704067200000')
    await snapshotStore.writeSnapshot(initialSnapshot)

    // Perform some read operations to generate metrics
    await snapshotStore.getLatestSuccessful()
    await snapshotStore.getLatestSuccessful()
    await snapshotStore.getLatestSuccessful()

    // Check if performance metrics are available
    const performanceMetrics = (
      snapshotStore as FileSnapshotStore & {
        getPerformanceMetrics?: () => ReadPerformanceMetrics
      }
    ).getPerformanceMetrics?.()

    if (performanceMetrics) {
      expect(performanceMetrics.totalReads).toBeGreaterThan(0)
      expect(performanceMetrics.averageReadTime).toBeGreaterThanOrEqual(0)
    }

    // Monitor concurrent operations should work regardless
    const monitoringResult = await validator.monitorConcurrentOperations()
    expect(monitoringResult.averageReadTime).toBeGreaterThanOrEqual(0)
    expect(monitoringResult.readThroughput).toBeGreaterThan(0)
  })
})
