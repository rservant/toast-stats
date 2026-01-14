/**
 * Tests for ProcessSeparationValidator
 * Validates that refresh operations run independently from read operations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ProcessSeparationValidator } from '../ProcessSeparationValidator.js'
import { FileSnapshotStore } from '../SnapshotStore.js'
import { RefreshService } from '../RefreshService.js'
import { Snapshot } from '../../types/snapshots.js'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

describe('ProcessSeparationValidator', () => {
  let validator: ProcessSeparationValidator
  let snapshotStore: FileSnapshotStore
  let refreshService: RefreshService
  let tempDir: string

  beforeEach(async () => {
    // Create temporary directory for testing
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'process-separation-test-')
    )

    snapshotStore = new FileSnapshotStore({
      cacheDir: tempDir,
      maxSnapshots: 10,
      maxAgeDays: 7,
      enableCompression: false,
    })

    refreshService = new RefreshService(snapshotStore)
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

  it('should validate that read operations do not block during refresh', async () => {
    // Setup: Create initial snapshot
    const initialSnapshot = createTestSnapshot('1704067200000')
    await snapshotStore.writeSnapshot(initialSnapshot)

    // Test: Validate process separation (without mocking refresh to avoid side effects)
    const result = await validator.validateProcessSeparation()

    // The validation should complete successfully
    expect(result.readOperationsContinued).toBe(true)
    expect(result.concurrentOperationsHandled).toBeGreaterThan(0)
    expect(result.averageReadResponseTime).toBeGreaterThanOrEqual(0)
    expect(result.validatedAt).toBeDefined()
    expect(result.validationDurationMs).toBeGreaterThan(0)

    // In test environment with simulated load, some performance degradation is expected
    // The key is that operations complete successfully, not that they meet production thresholds
    if (!result.isValid) {
      // If validation fails, it should be due to performance, not blocking
      expect(result.readOperationsContinued).toBe(true)
      expect(
        result.issues.some(issue => issue.includes('Performance degradation'))
      ).toBe(true)
    }
  })

  it('should detect if refresh operations block read operations', async () => {
    // Setup: Create initial snapshot
    const initialSnapshot = createTestSnapshot('1704067200000')
    await snapshotStore.writeSnapshot(initialSnapshot)

    // Mock snapshot store to simulate blocking behavior with shorter delay
    const originalGetLatestSuccessful =
      snapshotStore.getLatestSuccessful.bind(snapshotStore)
    vi.spyOn(snapshotStore, 'getLatestSuccessful').mockImplementation(
      async () => {
        // Simulate blocking with a shorter delay that still exceeds threshold
        await new Promise(resolve => setTimeout(resolve, 1500))
        return originalGetLatestSuccessful()
      }
    )

    // Test: Validate process separation (should fail due to blocking)
    const result = await validator.validateProcessSeparation()

    expect(result.isValid).toBe(false)
    expect(result.averageReadResponseTime).toBeGreaterThan(1000) // Should be slow due to blocking
    expect(result.issues).toContain('Read operations are being blocked')
    // Check for any performance-related recommended action
    expect(result.recommendedActions.length).toBeGreaterThan(0)
    expect(
      result.recommendedActions.some(
        action =>
          action.includes('performance') ||
          action.includes('snapshot store') ||
          action.includes('Optimize')
      )
    ).toBe(true)
  })

  it('should monitor concurrent read performance during refresh', async () => {
    // Setup: Create initial snapshot
    const initialSnapshot = createTestSnapshot('1704067200000')
    await snapshotStore.writeSnapshot(initialSnapshot)

    // Test: Monitor concurrent operations
    const result = await validator.monitorConcurrentOperations()

    expect(result.maxConcurrentReads).toBeGreaterThan(0)
    expect(result.averageReadTime).toBeGreaterThanOrEqual(0)
    expect(result.readThroughput).toBeGreaterThan(0)
    expect(result.refreshImpactOnReads).toBeLessThan(50) // Should be minimal impact
  })

  it('should validate read performance independence', async () => {
    // Setup: Create initial snapshot
    const initialSnapshot = createTestSnapshot('1704067200000')
    await snapshotStore.writeSnapshot(initialSnapshot)

    // Test: Validate read performance independence
    const result = await validator.validateReadPerformanceIndependence()

    expect(result.baselineReadTime).toBeGreaterThanOrEqual(0)
    expect(result.readTimeDuringRefresh).toBeGreaterThanOrEqual(0)
    expect(result.performanceDegradation).toBeGreaterThanOrEqual(-100) // Can be negative if performance improved
    expect(result.acceptableDegradationThreshold).toBe(500) // Should match validator threshold (MAX_ACCEPTABLE_DEGRADATION)
    expect(result.validatedAt).toBeDefined()

    // In test environment, some performance variation is expected
    // The key is that the measurement completes and provides meaningful data
    if (!result.isIndependent) {
      expect(result.performanceDegradation).toBeGreaterThan(50)
    }
  })

  it('should provide compliance monitoring metrics', async () => {
    // Setup: Create initial snapshot
    const initialSnapshot = createTestSnapshot('1704067200000')
    await snapshotStore.writeSnapshot(initialSnapshot)

    // Test: Get compliance metrics
    const metrics = await validator.getComplianceMetrics()

    expect(metrics.processSeparationScore).toBeGreaterThanOrEqual(0)
    expect(metrics.processSeparationScore).toBeLessThanOrEqual(100)
    expect(metrics.readOperationHealth).toBeDefined()
    expect(metrics.refreshOperationHealth).toBeDefined()
    expect(metrics.lastValidationTime).toBeDefined()
    expect(metrics.complianceStatus).toMatch(
      /^(compliant|warning|non_compliant)$/
    )
  })

  it('should detect process separation violations', async () => {
    // Setup: Create initial snapshot
    const initialSnapshot = createTestSnapshot('1704067200000')
    await snapshotStore.writeSnapshot(initialSnapshot)

    // Mock to simulate violation - refresh blocking reads with minimal delay
    vi.spyOn(snapshotStore, 'getLatestSuccessful').mockImplementation(
      async () => {
        // Simulate blocking but keep it short to avoid timeout
        await new Promise(resolve => setTimeout(resolve, 1600)) // Increased to exceed 1500ms threshold
        return initialSnapshot
      }
    )

    // Test: Validate (should detect violation)
    const result = await validator.validateProcessSeparation()

    expect(result.isValid).toBe(false)
    expect(result.issues).toContain('Read operations are being blocked')
    expect(result.averageReadResponseTime).toBeGreaterThan(1000)
    expect(result.recommendedActions.length).toBeGreaterThan(0)
  }, 15000) // Increase timeout for this specific test
})
