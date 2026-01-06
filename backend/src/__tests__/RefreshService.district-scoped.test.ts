/**
 * RefreshService District-Scoped Data Collection Tests
 *
 * Tests the enhanced RefreshService functionality for selective district processing
 * according to the district-scoped-data-collection specification.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RefreshService } from '../services/RefreshService.js'
import { FileSnapshotStore } from '../services/FileSnapshotStore.js'
import { ToastmastersScraper } from '../services/ToastmastersScraper.js'
import { DataValidator } from '../services/DataValidator.js'
import { DistrictConfigurationService } from '../services/DistrictConfigurationService.js'
import { createMockCacheService } from './utils/mockCacheService.js'
import type { ScrapedRecord } from '../types/districts.js'
import { tmpdir } from 'os'
import { join } from 'path'
import { mkdtemp, rm } from 'fs/promises'

// Mock the scraper to simulate network operations
vi.mock('../services/ToastmastersScraper.ts')

describe('RefreshService District-Scoped Data Collection', () => {
  let refreshService: RefreshService
  let mockScraper: vi.Mocked<ToastmastersScraper>
  let snapshotStore: FileSnapshotStore
  let districtConfigService: DistrictConfigurationService
  let tempDir: string

  beforeEach(async () => {
    // Create temporary directory for snapshots and configuration
    tempDir = await mkdtemp(join(tmpdir(), 'refresh-district-scoped-test-'))

    // Create snapshot store with correct config
    snapshotStore = new FileSnapshotStore({ cacheDir: tempDir })

    // Create district configuration service
    districtConfigService = new DistrictConfigurationService(tempDir)

    // Create mock scraper with mock cache service
    const mockCacheService = createMockCacheService()
    mockScraper = vi.mocked(new ToastmastersScraper(mockCacheService))

    // Create refresh service with mocked dependencies
    refreshService = new RefreshService(
      snapshotStore,
      mockScraper,
      new DataValidator(),
      districtConfigService
    )
  })

  afterEach(async () => {
    // Clean up temporary directory
    await rm(tempDir, { recursive: true, force: true })
    vi.clearAllMocks()
  })

  describe('Configuration Validation', () => {
    it('should fail refresh when no districts are configured', async () => {
      // Don't configure any districts
      mockScraper.closeBrowser.mockResolvedValue()

      // Execute refresh - should fail due to no configuration
      const result = await refreshService.executeRefresh()

      expect(result.success).toBe(false)
      expect(result.status).toBe('failed')
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]).toContain('No districts configured')

      // Verify scraper was not called since configuration validation failed
      expect(mockScraper.getAllDistricts).not.toHaveBeenCalled()
    })

    it('should validate district configuration before starting refresh', async () => {
      // Configure some districts
      await districtConfigService.addDistrict('42')
      await districtConfigService.addDistrict('F')

      // Mock successful scraping operations
      const mockAllDistricts: ScrapedRecord[] = [
        { DISTRICT: '42', 'District Name': 'Test District 42' },
        { DISTRICT: 'F', 'District Name': 'Test District F' },
        { DISTRICT: '15', 'District Name': 'Test District 15' },
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

      expect(result.success).toBe(true)
      expect(result.status).toBe('success')
      expect(result.errors).toHaveLength(0)

      // Verify scraper was called
      expect(mockScraper.getAllDistricts).toHaveBeenCalledTimes(1)
    })
  })

  describe('Selective District Processing', () => {
    it('should only process configured districts', async () => {
      // Configure only districts 42 and F
      await districtConfigService.addDistrict('42')
      await districtConfigService.addDistrict('F')

      // Mock all districts data (includes more than configured)
      const mockAllDistricts: ScrapedRecord[] = [
        { DISTRICT: '42', 'District Name': 'Test District 42' },
        { DISTRICT: 'F', 'District Name': 'Test District F' },
        { DISTRICT: '15', 'District Name': 'Test District 15' },
        { DISTRICT: '23', 'District Name': 'Test District 23' },
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

      // Execute refresh
      const result = await refreshService.executeRefresh()

      expect(result.success).toBe(true)

      // Verify only configured districts were processed
      expect(mockScraper.getDistrictPerformance).toHaveBeenCalledTimes(2)
      expect(mockScraper.getDistrictPerformance).toHaveBeenCalledWith('42')
      expect(mockScraper.getDistrictPerformance).toHaveBeenCalledWith('F')

      // Verify unconfigured districts were not processed
      expect(mockScraper.getDistrictPerformance).not.toHaveBeenCalledWith('15')
      expect(mockScraper.getDistrictPerformance).not.toHaveBeenCalledWith('23')
    })

    it('should handle configured districts not found in all-districts summary', async () => {
      // Configure districts including one that doesn't exist (but has valid format)
      await districtConfigService.addDistrict('42')
      await districtConfigService.addDistrict('Z') // Valid format but doesn't exist

      // Mock all districts data (missing Z)
      const mockAllDistricts: ScrapedRecord[] = [
        { DISTRICT: '42', 'District Name': 'Test District 42' },
        { DISTRICT: 'F', 'District Name': 'Test District F' },
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

      // Execute refresh - should succeed with valid districts only
      const result = await refreshService.executeRefresh()

      expect(result.success).toBe(true)

      // Verify only valid district was processed
      expect(mockScraper.getDistrictPerformance).toHaveBeenCalledTimes(1)
      expect(mockScraper.getDistrictPerformance).toHaveBeenCalledWith('42')
      expect(mockScraper.getDistrictPerformance).not.toHaveBeenCalledWith('Z')
    })

    it('should fail when no configured districts are found in all-districts summary', async () => {
      // Configure districts that don't exist in the summary (but have valid format)
      await districtConfigService.addDistrict('X') // Valid format but doesn't exist
      await districtConfigService.addDistrict('Y') // Valid format but doesn't exist

      // Mock all districts data (missing all configured districts)
      const mockAllDistricts: ScrapedRecord[] = [
        { DISTRICT: '42', 'District Name': 'Test District 42' },
        { DISTRICT: 'F', 'District Name': 'Test District F' },
      ]

      mockScraper.getAllDistricts.mockResolvedValue(mockAllDistricts)
      mockScraper.closeBrowser.mockResolvedValue()

      // Execute refresh - should fail
      const result = await refreshService.executeRefresh()

      expect(result.success).toBe(false)
      expect(result.status).toBe('failed')
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]).toContain(
        'None of the configured districts were found'
      )

      // Verify district-specific scraping was not attempted
      expect(mockScraper.getDistrictPerformance).not.toHaveBeenCalled()
    })
  })

  describe('District ID Format Support', () => {
    it('should support both numeric and alphabetic district IDs', async () => {
      // Configure mixed format districts
      await districtConfigService.addDistrict('42') // numeric
      await districtConfigService.addDistrict('F') // alphabetic
      await districtConfigService.addDistrict('123') // multi-digit numeric

      // Mock all districts data
      const mockAllDistricts: ScrapedRecord[] = [
        { DISTRICT: '42', 'District Name': 'Test District 42' },
        { DISTRICT: 'F', 'District Name': 'Test District F' },
        { DISTRICT: '123', 'District Name': 'Test District 123' },
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

      // Execute refresh
      const result = await refreshService.executeRefresh()

      expect(result.success).toBe(true)

      // Verify all district formats were processed
      expect(mockScraper.getDistrictPerformance).toHaveBeenCalledTimes(3)
      expect(mockScraper.getDistrictPerformance).toHaveBeenCalledWith('42')
      expect(mockScraper.getDistrictPerformance).toHaveBeenCalledWith('F')
      expect(mockScraper.getDistrictPerformance).toHaveBeenCalledWith('123')
    })
  })

  describe('Error Handling and Resilience', () => {
    it('should continue processing other districts when some fail', async () => {
      // Configure multiple districts
      await districtConfigService.addDistrict('42')
      await districtConfigService.addDistrict('F')

      // Mock all districts data
      const mockAllDistricts: ScrapedRecord[] = [
        { DISTRICT: '42', 'District Name': 'Test District 42' },
        { DISTRICT: 'F', 'District Name': 'Test District F' },
      ]

      const mockDistrictData: ScrapedRecord[] = [
        {
          'Club Number': '12345',
          'Club Name': 'Test Club',
          'Active Members': '25',
        },
      ]

      mockScraper.getAllDistricts.mockResolvedValue(mockAllDistricts)

      // Make district 42 succeed but district F fail
      mockScraper.getDistrictPerformance
        .mockResolvedValueOnce(mockDistrictData) // District 42 succeeds
        .mockRejectedValueOnce(new Error('District F failed')) // District F fails

      mockScraper.getDivisionPerformance
        .mockResolvedValueOnce(mockDistrictData) // District 42 succeeds
        .mockRejectedValueOnce(new Error('District F failed')) // District F fails

      mockScraper.getClubPerformance
        .mockResolvedValueOnce(mockDistrictData) // District 42 succeeds
        .mockRejectedValueOnce(new Error('District F failed')) // District F fails

      mockScraper.closeBrowser.mockResolvedValue()

      // Execute refresh - should succeed with partial data
      const result = await refreshService.executeRefresh()

      expect(result.success).toBe(true)
      expect(result.status).toBe('partial') // Changed from 'success' to 'partial' for resilient processing

      // Verify both districts were attempted
      expect(mockScraper.getDistrictPerformance).toHaveBeenCalledTimes(2)
      expect(mockScraper.getDistrictPerformance).toHaveBeenCalledWith('42')
      expect(mockScraper.getDistrictPerformance).toHaveBeenCalledWith('F')
    })
  })
})
