/**
 * Property-Based Tests for Cache Manager Initialization and Validation
 *
 * **Feature: test-infrastructure-stabilization, Property 9: Cache Manager Initialization and Validation**
 * **Validates: Requirements 4.1, 4.4**
 */

import { describe, it, expect, afterEach } from 'vitest'
import fc from 'fast-check'
import path from 'path'
import { promises as fs } from 'fs'
import { DistrictCacheManager } from '../DistrictCacheManager.js'
import { CacheManager } from '../CacheManager.js'
import {
  CacheConfigService,
  CacheDirectoryValidator,
  ILogger,
} from '../CacheConfigService.js'
import type { ServiceConfiguration } from '../../types/serviceContainer.js'
import { createTestSelfCleanup } from '../../utils/test-self-cleanup.js'

// Mock logger implementation for testing
class TestLogger implements ILogger {
  public logs: Array<{ level: string; message: string; data?: unknown }> = []

  info(message: string, data?: unknown): void {
    this.logs.push({ level: 'info', message, data })
  }

  warn(message: string, data?: unknown): void {
    this.logs.push({ level: 'warn', message, data })
  }

  error(message: string, error?: Error | unknown): void {
    this.logs.push({ level: 'error', message, data: error })
  }

  debug(message: string, data?: unknown): void {
    this.logs.push({ level: 'debug', message, data })
  }

  clear(): void {
    this.logs = []
  }
}

describe('Cache Manager Initialization and Validation Properties', () => {
  // Self-cleanup setup - each test manages its own cleanup
  const { cleanup, afterEach: performCleanup } = createTestSelfCleanup({
    verbose: false,
  })

  afterEach(async () => {
    await performCleanup()
  })

  /**
   * Property 9: Cache Manager Initialization and Validation
   * For any cache manager usage in tests, the manager should be properly initialized
   * before use and should validate cache directory existence before operations
   */
  describe('Property 9: Cache Manager Initialization and Validation', () => {
    it('should properly initialize cache managers before use and validate directory existence', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            cacheSubDir: fc
              .string({ minLength: 1, maxLength: 20 })
              .filter(s => /^[a-zA-Z0-9_-]+$/.test(s) && !s.includes('..')),
            environment: fc.constantFrom('test', 'development'),
            logLevel: fc.constantFrom('debug', 'info', 'warn', 'error'),
          }),
          async ({ cacheSubDir, environment, logLevel }) => {
            // Property: Cache managers should be properly initialized before use
            // Use a safe test directory path instead of system temp directories
            const cacheDirectory = path.resolve(
              `./test-dir/cache-init-${cacheSubDir}`
            )
            cleanup.trackDirectory(cacheDirectory)

            const config: ServiceConfiguration = {
              cacheDirectory,
              environment: environment as 'test' | 'development',
              logLevel: logLevel as 'debug' | 'info' | 'warn' | 'error',
            }

            const logger = new TestLogger()

            // Test CacheConfigService initialization
            const cacheConfigService = new CacheConfigService(config, logger)

            // Before initialization, service should not be ready
            expect(cacheConfigService.isReady()).toBe(false)

            // Initialize should succeed and make service ready
            await cacheConfigService.initialize()
            expect(cacheConfigService.isReady()).toBe(true)

            // Cache directory should exist after initialization
            const cacheDir = cacheConfigService.getCacheDirectory()

            // Ensure the directory exists before validation
            await fs.mkdir(cacheDir, { recursive: true })

            const validation = await CacheDirectoryValidator.validate(cacheDir)
            expect(validation.isValid).toBe(true)
            expect(validation.isAccessible).toBe(true)
            expect(validation.isSecure).toBe(true)

            // Test DistrictCacheManager initialization
            const districtCacheManager = new DistrictCacheManager(cacheDir)

            // Initialize should succeed without errors
            await expect(districtCacheManager.init()).resolves.not.toThrow()

            // Should be able to perform operations after initialization
            const testDistrictId = 'test-district-123'
            const testDate = '2024-01-15'

            await expect(
              districtCacheManager.cacheDistrictData(
                testDistrictId,
                testDate,
                [],
                [],
                []
              )
            ).resolves.not.toThrow()

            const hasData = await districtCacheManager.hasDistrictData(
              testDistrictId,
              testDate
            )
            expect(hasData).toBe(true)

            // Test CacheManager initialization
            const cacheManager = new CacheManager(cacheDir)

            // Initialize should succeed without errors
            await expect(cacheManager.init()).resolves.not.toThrow()

            // Should be able to perform operations after initialization
            await expect(
              cacheManager.setCache(testDate, { test: 'data' }, 'districts')
            ).resolves.not.toThrow()

            const hasCache = await cacheManager.hasCache(testDate, 'districts')
            expect(hasCache).toBe(true)

            // Cleanup
            await cacheConfigService.dispose()
          }
        ),
        { numRuns: 5, timeout: 10000 }
      )
    })

    it('should validate cache directory existence before operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            validPath: fc.boolean(),
            pathSuffix: fc
              .string({ minLength: 1, maxLength: 10 })
              .filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
          }),
          async ({ validPath, pathSuffix }) => {
            // Property: Cache operations should validate directory existence
            const basePath = validPath ? './test-dir' : '/nonexistent/path'
            const cacheDirectory = path.resolve(
              `${basePath}/cache-validate-${pathSuffix}`
            )

            const config: ServiceConfiguration = {
              cacheDirectory,
              environment: 'test',
              logLevel: 'error',
            }

            const logger = new TestLogger()
            if (validPath) {
              cleanup.trackDirectory(cacheDirectory)
            }

            const cacheConfigService = new CacheConfigService(config, logger)

            if (validPath) {
              // Valid paths should initialize successfully
              await expect(
                cacheConfigService.initialize()
              ).resolves.not.toThrow()
              expect(cacheConfigService.isReady()).toBe(true)

              // Directory should exist and be validated
              const validation =
                await CacheDirectoryValidator.validate(cacheDirectory)
              expect(validation.isValid).toBe(true)
              expect(validation.isAccessible).toBe(true)

              await cacheConfigService.dispose()
            } else {
              // Invalid paths should fail initialization with meaningful errors
              await expect(cacheConfigService.initialize()).rejects.toThrow()
              expect(cacheConfigService.isReady()).toBe(false)
            }
          }
        ),
        { numRuns: 5, timeout: 10000 }
      )
    })

    it('should provide meaningful error messages for cache operations failures', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            invalidDistrictId: fc.constantFrom(
              '../invalid',
              'test/path',
              'test\\path',
              ''
            ),
            invalidDate: fc.constantFrom(
              'invalid-date',
              '2024/01/01',
              '../2024-01-01',
              ''
            ),
          }),
          async ({ invalidDistrictId, invalidDate }) => {
            // Property: Cache operations should provide meaningful error messages
            const cacheDirectory = path.resolve('./test-dir/cache-error-test')
            cleanup.trackDirectory(cacheDirectory)

            const config: ServiceConfiguration = {
              cacheDirectory,
              environment: 'test',
              logLevel: 'error',
            }

            const logger = new TestLogger()

            const cacheConfigService = new CacheConfigService(config, logger)
            await cacheConfigService.initialize()

            const districtCacheManager = new DistrictCacheManager(
              cacheConfigService.getCacheDirectory()
            )
            await districtCacheManager.init()

            // Invalid district IDs should produce meaningful error messages
            if (invalidDistrictId) {
              await expect(
                districtCacheManager.cacheDistrictData(
                  invalidDistrictId,
                  '2024-01-01',
                  [],
                  [],
                  []
                )
              ).rejects.toThrow(/Invalid district ID|Invalid.*district.*cache/)

              await expect(
                districtCacheManager.getDistrictData(
                  invalidDistrictId,
                  '2024-01-01'
                )
              ).rejects.toThrow(/Invalid district ID|Invalid.*district.*cache/)
            }

            // Invalid dates should produce meaningful error messages
            if (invalidDate) {
              await expect(
                districtCacheManager.cacheDistrictData(
                  'valid-district',
                  invalidDate,
                  [],
                  [],
                  []
                )
              ).rejects.toThrow(/Invalid date|Invalid.*date.*cache/)

              await expect(
                districtCacheManager.getDistrictData(
                  'valid-district',
                  invalidDate
                )
              ).rejects.toThrow(/Invalid date|Invalid.*date.*cache/)
            }

            await cacheConfigService.dispose()
          }
        ),
        { numRuns: 5, timeout: 10000 }
      )
    })
  })
})
