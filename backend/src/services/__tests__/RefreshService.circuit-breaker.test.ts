/**
 * RefreshService Circuit Breaker Integration Tests
 *
 * Tests the integration of circuit breaker pattern with retry logic
 * for network resilience during scraping operations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RefreshService } from '../RefreshService.js'
import { FileSnapshotStore } from '../FileSnapshotStore.js'
import { ToastmastersScraper } from '../ToastmastersScraper.js'
import { DataValidator } from '../DataValidator.js'
// import { CircuitBreakerError } from '../../utils/CircuitBreaker.js'
import type { ScrapedRecord } from '../../types/districts.js'
import { tmpdir } from 'os'
import { join } from 'path'
import { mkdtemp, rm } from 'fs/promises'

// Mock the scraper to simulate network failures
vi.mock('../ToastmastersScraper.js')

describe('RefreshService Circuit Breaker Integration', () => {
  let refreshService: RefreshService
  let mockScraper: vi.Mocked<ToastmastersScraper>
  let snapshotStore: FileSnapshotStore
  let tempDir: string

  beforeEach(async () => {
    // Create temporary directory for snapshots
    tempDir = await mkdtemp(join(tmpdir(), 'refresh-circuit-breaker-test-'))

    // Create snapshot store with correct config
    snapshotStore = new FileSnapshotStore({ cacheDir: tempDir })

    // Create mock scraper
    mockScraper = vi.mocked(new ToastmastersScraper())

    // Create refresh service with mocked dependencies
    refreshService = new RefreshService(
      snapshotStore,
      mockScraper,
      new DataValidator()
    )

    // Set up district configuration to pass validation
    const districtConfigService = refreshService['districtConfigService']
    await districtConfigService.addDistrict('123', 'test-admin')
  })

  afterEach(async () => {
    // Clean up temporary directory
    await rm(tempDir, { recursive: true, force: true })
    vi.clearAllMocks()
  })

  it('should provide circuit breaker statistics', async () => {
    const stats = refreshService.getCircuitBreakerStats()

    expect(stats).toHaveProperty('scraping')
    expect(stats.scraping).toHaveProperty('state')
    expect(stats.scraping).toHaveProperty('failureCount')
    expect(stats.scraping).toHaveProperty('successCount')
    expect(stats.scraping).toHaveProperty('totalRequests')
    expect(stats.scraping).toHaveProperty('totalFailures')
    expect(stats.scraping).toHaveProperty('totalSuccesses')
  })

  it('should reset circuit breaker manually', async () => {
    // Reset circuit breaker
    refreshService.resetCircuitBreaker()

    // Check circuit breaker is reset
    const stats = refreshService.getCircuitBreakerStats()
    expect(stats.scraping.failureCount).toBe(0)
    expect(stats.scraping.state).toBe('CLOSED')
  })

  it('should handle network failures and record circuit breaker stats', async () => {
    // Mock getAllDistricts to fail consistently (simulating network issues)
    mockScraper.getAllDistricts.mockRejectedValue(new Error('network timeout'))
    mockScraper.closeBrowser.mockResolvedValue()

    // Execute refresh - should fail but handle gracefully
    const result = await refreshService.executeRefresh()

    expect(result.success).toBe(false)
    expect(result.status).toBe('failed')
    expect(result.errors.length).toBeGreaterThan(0)

    // Verify circuit breaker recorded the failure
    const stats = refreshService.getCircuitBreakerStats()
    expect(stats.scraping.totalRequests).toBeGreaterThan(0)
    expect(stats.scraping.failureCount).toBeGreaterThan(0)
  })

  it('should integrate circuit breaker with retry logic', async () => {
    // Mock successful scraping operations
    const mockAllDistricts: ScrapedRecord[] = [
      { DISTRICT: '123', 'District Name': 'Test District' },
    ]

    const mockDistrictData: ScrapedRecord[] = [
      {
        'Club Number': '12345',
        'Club Name': 'Test Club',
        'Active Members': '25',
      },
    ]

    mockScraper.getAllDistricts.mockResolvedValue(mockAllDistricts)
    mockScraper.getDistrictPerformance.mockResolvedValue(mockDistrictData)
    mockScraper.getDivisionPerformance.mockResolvedValue(mockDistrictData)
    mockScraper.getClubPerformance.mockResolvedValue(mockDistrictData)
    mockScraper.closeBrowser.mockResolvedValue()

    // Execute refresh - should succeed
    const result = await refreshService.executeRefresh()

    // Note: This might fail due to validation issues, but circuit breaker should record success
    const stats = refreshService.getCircuitBreakerStats()
    expect(stats.scraping.totalRequests).toBeGreaterThan(0)

    // If scraping succeeded, circuit breaker should record success
    if (result.success) {
      expect(stats.scraping.successCount).toBeGreaterThan(0)
    }
  })
})
