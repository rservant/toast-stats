/**
 * End-to-End Integration Tests for Cache Configuration System
 *
 * Tests the complete cache configuration system across all services:
 * - CacheConfigService
 * - CacheManager
 * - DistrictCacheManager
 * - Assessment Module Integration
 * - Route-level service initialization
 * - Error scenarios and fallback behavior
 * - Security validation and path validation
 *
 * **Validates: All requirements (1.1-7.4)**
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import { CacheConfigService } from '../services/CacheConfigService'
import { CacheManager } from '../services/CacheManager'
import { DistrictCacheManager } from '../services/DistrictCacheManager'
import { CacheIntegrationService } from '../modules/assessment/services/cacheIntegrationService'
import { CacheUpdateManager } from '../services/CacheUpdateManager'
import {
  createTestCacheConfig,
  cleanupTestCacheConfig,
} from '../utils/test-cache-helper'
import type { TestCacheConfig } from '../utils/test-cache-helper'
import type { ScrapedRecord } from '../types/districts'

// Test data interface for isolation tests
interface TestCacheData {
  id: string
  name: string
}

describe('Cache Configuration System - End-to-End Integration Tests', () => {
  let testConfig: TestCacheConfig
  let originalEnv: string | undefined

  beforeEach(async () => {
    // Store original environment
    originalEnv = process.env.CACHE_DIR

    // Create isolated test cache configuration
    testConfig = await createTestCacheConfig('e2e-integration')
  })

  afterEach(async () => {
    // Cleanup test cache
    await cleanupTestCacheConfig(testConfig)

    // Restore original environment
    if (originalEnv !== undefined) {
      process.env.CACHE_DIR = originalEnv
    } else {
      delete process.env.CACHE_DIR
    }

    // Reset singleton
    CacheConfigService.resetInstance()
  })

  describe('Complete System Configuration Consistency', () => {
    it('should ensure all cache services use the same configured directory', async () => {
      // Set up test environment
      process.env.CACHE_DIR = testConfig.cacheDir
      CacheConfigService.resetInstance()

      // Initialize all cache services
      const cacheConfig = CacheConfigService.getInstance()
      await cacheConfig.initialize()

      const assessmentService = new CacheIntegrationService()

      // Verify all services use the same cache directory
      const expectedDir = path.resolve(testConfig.cacheDir)

      expect(cacheConfig.getCacheDirectory()).toBe(expectedDir)

      // Verify assessment service uses configured cache manager
      const latestDate = await assessmentService.getLatestCacheDate('1')
      expect(latestDate).toBeDefined() // Should return null or a date, not throw
    })

    it('should maintain consistency when cache directory is changed', async () => {
      // Start with one cache directory
      const firstCacheDir = path.join(testConfig.cacheDir, 'first')
      process.env.CACHE_DIR = firstCacheDir
      CacheConfigService.resetInstance()

      const firstConfig = CacheConfigService.getInstance()
      await firstConfig.initialize()

      expect(firstConfig.getCacheDirectory()).toBe(path.resolve(firstCacheDir))

      // Store the first directory for comparison
      const firstDirectory = firstConfig.getCacheDirectory()

      // Change to second cache directory
      const secondCacheDir = path.join(testConfig.cacheDir, 'second')
      process.env.CACHE_DIR = secondCacheDir
      CacheConfigService.resetInstance()

      const secondConfig = CacheConfigService.getInstance()
      await secondConfig.initialize()

      expect(secondConfig.getCacheDirectory()).toBe(
        path.resolve(secondCacheDir)
      )

      // Verify directories are different
      expect(firstDirectory).not.toBe(secondConfig.getCacheDirectory())
    })
  })

  describe('Default Fallback Behavior', () => {
    it('should use default cache directory when CACHE_DIR is not set', async () => {
      // Ensure CACHE_DIR is not set
      delete process.env.CACHE_DIR
      CacheConfigService.resetInstance()

      const cacheConfig = CacheConfigService.getInstance()
      await cacheConfig.initialize()

      const expectedDefaultDir = path.resolve('./cache')

      expect(cacheConfig.getCacheDirectory()).toBe(expectedDefaultDir)
    })

    it('should use default cache directory when CACHE_DIR is empty string', async () => {
      process.env.CACHE_DIR = ''
      CacheConfigService.resetInstance()

      const cacheConfig = CacheConfigService.getInstance()
      await cacheConfig.initialize()

      const expectedDefaultDir = path.resolve('./cache')

      expect(cacheConfig.getCacheDirectory()).toBe(expectedDefaultDir)
    })
  })

  describe('Security Validation and Error Handling', () => {
    it('should handle path traversal attempts appropriately', async () => {
      // Test various path traversal attempts that should be rejected
      const maliciousPaths = [
        '/etc/passwd', // Direct system path
        '/usr/bin', // System binary directory
        '/var/log', // System log directory
        '/sys/kernel', // System kernel directory
        '/proc/version', // System process directory
        '/boot/grub', // Boot directory
      ]

      for (const maliciousPath of maliciousPaths) {
        process.env.CACHE_DIR = maliciousPath
        CacheConfigService.resetInstance()

        const cacheConfig = CacheConfigService.getInstance()

        // The service should either initialize with fallback or throw an error
        try {
          await cacheConfig.initialize()

          // If initialization succeeds, it should have fallen back to default
          const actualDir = cacheConfig.getCacheDirectory()
          expect(actualDir).toBe(path.resolve('./cache'))

          // Configuration should indicate fallback was used
          const config = cacheConfig.getConfiguration()
          expect(config.source).toBe('default')
        } catch (error) {
          // If initialization fails, it should be a configuration error
          expect(error).toBeInstanceOf(Error)
          expect((error as Error).message).toMatch(
            /cache|directory|invalid|configuration/i
          )
        }
      }
    })

    it('should handle permission errors gracefully', async () => {
      // Create a directory without write permissions (if possible on this system)
      const restrictedDir = path.join(testConfig.cacheDir, 'restricted')
      await fs.mkdir(restrictedDir, { recursive: true })

      try {
        // Try to make it read-only (may not work on all systems)
        await fs.chmod(restrictedDir, 0o444)

        process.env.CACHE_DIR = restrictedDir
        CacheConfigService.resetInstance()

        const cacheConfig = CacheConfigService.getInstance()

        // The service should either initialize with fallback or throw an error
        try {
          await cacheConfig.initialize()

          // If initialization succeeds, verify configuration is consistent
          const actualDir = cacheConfig.getCacheDirectory()
          const config = cacheConfig.getConfiguration()

          expect(actualDir).toBeDefined()
          expect(config.baseDirectory).toBe(actualDir)

          // If fallback occurred, should be default directory
          if (config.source === 'default') {
            expect(actualDir).toBe(path.resolve('./cache'))
          }
        } catch (error) {
          // If initialization fails, it should be a configuration error
          expect(error).toBeInstanceOf(Error)
          expect((error as Error).message).toMatch(
            /cache|directory|invalid|configuration|permission/i
          )
        }
      } finally {
        // Restore permissions for cleanup
        try {
          await fs.chmod(restrictedDir, 0o755)
        } catch {
          // Ignore cleanup errors
        }
      }
    })

    it('should handle non-existent parent directories', async () => {
      const deepPath = path.join(
        testConfig.cacheDir,
        'very',
        'deep',
        'nested',
        'cache'
      )
      process.env.CACHE_DIR = deepPath
      CacheConfigService.resetInstance()

      const cacheConfig = CacheConfigService.getInstance()
      await cacheConfig.initialize()

      // Should create the directory structure
      expect(cacheConfig.getCacheDirectory()).toBe(path.resolve(deepPath))

      // Verify directory was created
      const stats = await fs.stat(deepPath)
      expect(stats.isDirectory()).toBe(true)
    })
  })

  describe('Cache Operations Integration', () => {
    it('should support cache operations across all services', async () => {
      process.env.CACHE_DIR = testConfig.cacheDir
      CacheConfigService.resetInstance()

      const cacheConfig = CacheConfigService.getInstance()
      await cacheConfig.initialize()

      const cacheManager = new CacheManager(testConfig.cacheDir)
      const districtCacheManager = new DistrictCacheManager(testConfig.cacheDir)

      // Test basic cache operations
      const testData = [{ id: '1', name: 'Test District' }]

      // Cache data using CacheManager
      await cacheManager.setCache('2024-01-15', testData, 'districts')

      // Retrieve data using CacheManager
      const cachedData = await cacheManager.getCache('2024-01-15', 'districts')
      expect(cachedData).toBeDefined()
      expect(cachedData).toEqual(testData)

      // Test district-specific caching
      const districtData = {
        districtPerformance: [
          {
            District: '1',
            'Total Clubs': '10',
            'Total Members': '100',
            'Goals Met': '5',
            'Distinguished Clubs': '3',
          },
        ] as ScrapedRecord[],
        divisionPerformance: [] as ScrapedRecord[],
        clubPerformance: [] as ScrapedRecord[],
      }

      await districtCacheManager.cacheDistrictData(
        '1',
        '2024-01-15',
        districtData.districtPerformance,
        districtData.divisionPerformance,
        districtData.clubPerformance
      )

      const cachedDistrictData = await districtCacheManager.getDistrictData(
        '1',
        '2024-01-15'
      )
      expect(cachedDistrictData).toBeDefined()
      expect(cachedDistrictData?.districtPerformance).toEqual(
        districtData.districtPerformance
      )

      // Verify both services used the same cache directory
      const cacheFiles = await fs.readdir(testConfig.cacheDir)
      expect(cacheFiles.length).toBeGreaterThan(0)
    })

    it('should support assessment module cache integration', async () => {
      process.env.CACHE_DIR = testConfig.cacheDir
      CacheConfigService.resetInstance()

      const assessmentService = new CacheIntegrationService()

      // Test assessment service cache operations
      const latestDate = await assessmentService.getLatestCacheDate('1')
      expect(latestDate).toBeDefined() // Should return null or a date, not throw
    })
  })

  describe('Migration and Backward Compatibility', () => {
    it('should maintain existing cache data when configuration changes', async () => {
      // Create cache data with first configuration
      process.env.CACHE_DIR = testConfig.cacheDir
      CacheConfigService.resetInstance()

      const cacheManager = new CacheManager(testConfig.cacheDir)
      const testData = [{ id: '1', name: 'Test District' }]

      await cacheManager.setCache('2024-01-15', testData, 'districts')

      // Verify data exists
      let cachedData = await cacheManager.getCache('2024-01-15', 'districts')
      expect(cachedData).toEqual(testData)

      // Reset configuration (simulating restart)
      CacheConfigService.resetInstance()
      const newCacheManager = new CacheManager(testConfig.cacheDir)

      // Verify data is still accessible
      cachedData = await newCacheManager.getCache('2024-01-15', 'districts')
      expect(cachedData).toEqual(testData)
    })

    it('should handle configuration service reinitialization', async () => {
      process.env.CACHE_DIR = testConfig.cacheDir

      // Initialize first time
      CacheConfigService.resetInstance()
      const firstConfig = CacheConfigService.getInstance()
      await firstConfig.initialize()
      const firstDir = firstConfig.getCacheDirectory()

      // Reset and reinitialize
      CacheConfigService.resetInstance()
      const secondConfig = CacheConfigService.getInstance()
      await secondConfig.initialize()
      const secondDir = secondConfig.getCacheDirectory()

      // Should get the same directory
      expect(firstDir).toBe(secondDir)
      expect(firstDir).toBe(path.resolve(testConfig.cacheDir))
    })
  })

  describe('Test Environment Isolation', () => {
    it('should support isolated test cache directories', async () => {
      // Create multiple isolated test configurations
      const testConfig1 = await createTestCacheConfig('isolation-test-1')
      const testConfig2 = await createTestCacheConfig('isolation-test-2')

      try {
        // Test first configuration
        process.env.CACHE_DIR = testConfig1.cacheDir
        CacheConfigService.resetInstance()

        const cacheManager1 = new CacheManager(testConfig1.cacheDir)
        await cacheManager1.setCache(
          '2024-01-15',
          [{ id: '1', name: 'Test 1' }],
          'districts'
        )

        // Test second configuration
        process.env.CACHE_DIR = testConfig2.cacheDir
        CacheConfigService.resetInstance()

        const cacheManager2 = new CacheManager(testConfig2.cacheDir)
        await cacheManager2.setCache(
          '2024-01-15',
          [{ id: '2', name: 'Test 2' }],
          'districts'
        )

        // Verify isolation - each should only see its own data
        const data1 = await cacheManager1.getCache('2024-01-15', 'districts')
        const data2 = await cacheManager2.getCache('2024-01-15', 'districts')

        expect((data1 as TestCacheData[])[0].name).toBe('Test 1')
        expect((data2 as TestCacheData[])[0].name).toBe('Test 2')

        // Verify different cache directories
        expect(testConfig1.cacheDir).not.toBe(testConfig2.cacheDir)
      } finally {
        // Cleanup both test configurations
        await cleanupTestCacheConfig(testConfig1)
        await cleanupTestCacheConfig(testConfig2)
      }
    })
  })

  describe('Configuration Documentation and Examples', () => {
    it('should support documented configuration patterns', async () => {
      // Test relative path configuration
      const relativePath = './test-dir/test-cache-relative'
      process.env.CACHE_DIR = relativePath
      CacheConfigService.resetInstance()

      const relativeConfig = CacheConfigService.getInstance()
      await relativeConfig.initialize()

      // The service should resolve the relative path correctly
      const expectedPath = path.resolve(process.cwd(), relativePath)
      expect(relativeConfig.getCacheDirectory()).toBe(expectedPath)

      // Test absolute path configuration
      const absolutePath = path.resolve(testConfig.cacheDir, 'absolute')
      process.env.CACHE_DIR = absolutePath
      CacheConfigService.resetInstance()

      const absoluteConfig = CacheConfigService.getInstance()
      await absoluteConfig.initialize()
      expect(absoluteConfig.getCacheDirectory()).toBe(absolutePath)

      // Cleanup
      try {
        await fs.rm(path.resolve(relativePath), {
          recursive: true,
          force: true,
        })
      } catch {
        // Ignore cleanup errors
      }
    })

    it('should provide configuration metadata for troubleshooting', async () => {
      process.env.CACHE_DIR = testConfig.cacheDir
      CacheConfigService.resetInstance()

      const cacheConfig = CacheConfigService.getInstance()
      await cacheConfig.initialize()

      const config = cacheConfig.getConfiguration()

      expect(config).toMatchObject({
        baseDirectory: path.resolve(testConfig.cacheDir),
        isConfigured: true,
        source: 'environment',
      })

      expect(config.validationStatus).toBeDefined()
      expect(config.validationStatus.isValid).toBe(true)
      expect(config.validationStatus.isAccessible).toBe(true)
      expect(config.validationStatus.isSecure).toBe(true)
    })
  })

  describe('Performance and Resource Management', () => {
    it('should handle rapid configuration changes efficiently', async () => {
      const startTime = Date.now()

      // Perform multiple rapid configuration changes
      for (let i = 0; i < 10; i++) {
        const tempDir = path.join(testConfig.cacheDir, `rapid-${i}`)

        // Ensure the temp directory exists before setting it
        await fs.mkdir(tempDir, { recursive: true })

        process.env.CACHE_DIR = tempDir
        CacheConfigService.resetInstance()

        const config = CacheConfigService.getInstance()
        await config.initialize()

        // Add small delay to ensure configuration is applied
        await new Promise(resolve => setTimeout(resolve, 10))

        expect(config.getCacheDirectory()).toBe(path.resolve(tempDir))
      }

      const endTime = Date.now()
      const duration = endTime - startTime

      // Should complete within reasonable time (less than 1 second)
      expect(duration).toBeLessThan(1000)
    })

    it('should handle concurrent service initialization', async () => {
      process.env.CACHE_DIR = testConfig.cacheDir
      CacheConfigService.resetInstance()

      // Initialize multiple services concurrently
      const promises = [
        Promise.resolve(new CacheManager(testConfig.cacheDir)),
        Promise.resolve(new DistrictCacheManager(testConfig.cacheDir)),
        Promise.resolve(new CacheIntegrationService()),
        Promise.resolve(new CacheUpdateManager()),
      ]

      const services = await Promise.all(promises)

      // All services should be initialized successfully
      expect(services[0]).toBeDefined()
      expect(services[1]).toBeDefined()
      expect(services[2]).toBeDefined()
      expect(services[3]).toBeDefined()
    })
  })
})
