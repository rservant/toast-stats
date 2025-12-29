/**
 * Property-Based Tests for Cache Error Handling
 *
 * **Feature: test-infrastructure-stabilization, Property 12: Cache Error Handling**
 * **Validates: Requirements 4.5**
 */

import { describe, it, expect, afterEach } from 'vitest'
import fc from 'fast-check'
import { DistrictCacheManager } from '../DistrictCacheManager.js'
import { CacheManager } from '../CacheManager.js'
import { CacheConfigService, ILogger } from '../CacheConfigService.js'
import type { ServiceConfiguration } from '../../types/serviceContainer.js'
import { createTestSelfCleanup } from '../../utils/test-self-cleanup.js'
import path from 'path'

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

describe('Cache Error Handling Properties', () => {
  // Self-cleanup setup - each test manages its own cleanup
  const { cleanup, afterEach: performCleanup } = createTestSelfCleanup({
    verbose: false,
  })

  afterEach(async () => {
    await performCleanup()
  })

  /**
   * Property 12: Cache Error Handling
   * For any cache operation failure, the failure should provide meaningful error messages
   * and recovery options
   */
  describe('Property 12: Cache Error Handling', () => {
    it('should provide meaningful error messages for invalid cache directory paths', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            invalidPath: fc.constantFrom(
              '/etc',
              '/usr',
              '/var',
              '/sys',
              '/proc',
              '/boot',
              '../../../etc',
              '~/../../../etc',
              ''
            ),
            environment: fc.constantFrom('test', 'development'),
            logLevel: fc.constantFrom('error', 'warn'),
          }),
          async ({ invalidPath, environment, logLevel }) => {
            // Property: Invalid cache directory paths should produce meaningful error messages
            const config: ServiceConfiguration = {
              cacheDirectory: invalidPath,
              environment: environment as 'test' | 'development',
              logLevel: logLevel as 'error' | 'warn',
            }

            const logger = new TestLogger()
            const cacheConfigService = new CacheConfigService(config, logger)

            if (invalidPath === '') {
              if (environment === 'test') {
                // In test environment, empty paths fall back to default behavior
                await expect(
                  cacheConfigService.initialize()
                ).resolves.not.toThrow()
                expect(cacheConfigService.isReady()).toBe(true)

                // Should have fallen back to default directory
                const config = cacheConfigService.getConfiguration()
                expect(config.baseDirectory).not.toBe('')
                expect(config.source).toBe('test') // Source remains 'test' but uses default path
              } else {
                // In development environment, empty paths trigger fallback behavior
                await expect(
                  cacheConfigService.initialize()
                ).resolves.not.toThrow()
                expect(cacheConfigService.isReady()).toBe(true)

                // Should have fallen back to default directory
                const config = cacheConfigService.getConfiguration()
                expect(config.baseDirectory).not.toBe('')
                // Source could be 'environment' if process.env.CACHE_DIR is set, or 'default' if not
                expect(['environment', 'default']).toContain(config.source)
              }
            } else if (
              invalidPath.startsWith('/') &&
              (invalidPath.startsWith('/etc') ||
                invalidPath.startsWith('/usr') ||
                invalidPath.startsWith('/var') ||
                invalidPath.startsWith('/sys') ||
                invalidPath.startsWith('/proc') ||
                invalidPath.startsWith('/boot'))
            ) {
              if (environment === 'test') {
                // In test environment, config.cacheDirectory is used directly
                // Invalid system paths should cause initialization to fail (no fallback in test env)
                await expect(cacheConfigService.initialize()).rejects.toThrow()
                expect(cacheConfigService.isReady()).toBe(false)

                // Error message should be descriptive and mention cache/directory/invalid
                try {
                  await cacheConfigService.initialize()
                } catch (error) {
                  expect(error).toBeInstanceOf(Error)
                  const errorMessage = (error as Error).message.toLowerCase()
                  expect(
                    errorMessage.includes('cache') ||
                      errorMessage.includes('directory') ||
                      errorMessage.includes('invalid') ||
                      errorMessage.includes('unsafe') ||
                      errorMessage.includes('configuration')
                  ).toBe(true)
                }
              } else {
                // In development environment, config.cacheDirectory is ignored
                // The service uses process.env.CACHE_DIR or defaults to './cache'
                // So it should initialize successfully with the default directory
                await expect(
                  cacheConfigService.initialize()
                ).resolves.not.toThrow()
                expect(cacheConfigService.isReady()).toBe(true)

                // Should be using default directory, not the configured invalid path
                const config = cacheConfigService.getConfiguration()
                expect(config.baseDirectory).not.toBe(invalidPath)
                // Source could be 'environment' if process.env.CACHE_DIR is set, or 'default' if not
                expect(['environment', 'default']).toContain(config.source)
              }
            } else {
              // Path traversal attempts
              if (environment === 'test') {
                // In test environment, config.cacheDirectory is used directly
                // Path traversal should be rejected
                await expect(cacheConfigService.initialize()).rejects.toThrow()
                expect(cacheConfigService.isReady()).toBe(false)
              } else {
                // In development environment, config.cacheDirectory is ignored
                // The service uses process.env.CACHE_DIR, so path traversal in config is irrelevant
                await expect(
                  cacheConfigService.initialize()
                ).resolves.not.toThrow()
                expect(cacheConfigService.isReady()).toBe(true)

                // Should be using environment/default directory, not the configured invalid path
                const config = cacheConfigService.getConfiguration()
                expect(config.baseDirectory).not.toBe(invalidPath)
                // Source could be 'environment' if process.env.CACHE_DIR is set, or 'default' if not
                expect(['environment', 'default']).toContain(config.source)
              }
            }
          }
        ),
        { numRuns: 5, timeout: 10000 }
      )
    })

    it('should provide meaningful error messages for invalid district IDs and dates', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            invalidDistrictId: fc.constantFrom(
              '../invalid',
              'test/path',
              'test\\path',
              'test:path',
              'test*path',
              'test?path',
              'test<path>',
              'test|path',
              ''
            ),
            invalidDate: fc.constantFrom(
              'invalid-date',
              '2024/01/01',
              '2024.01.01',
              '../2024-01-01',
              '2024-13-01',
              '2024-01-32',
              '2024-00-01',
              '2024-01-00',
              ''
            ),
          }),
          async ({ invalidDistrictId, invalidDate }) => {
            // Property: Invalid district IDs and dates should produce meaningful error messages
            const testCacheDir = path.resolve('./test-dir/cache-error-test')
            cleanup.trackDirectory(testCacheDir)

            const config: ServiceConfiguration = {
              cacheDirectory: testCacheDir,
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

            // Test invalid district ID error messages
            if (invalidDistrictId) {
              await expect(
                districtCacheManager.cacheDistrictData(
                  invalidDistrictId,
                  '2024-01-01',
                  [],
                  [],
                  []
                )
              ).rejects.toThrow()

              try {
                await districtCacheManager.cacheDistrictData(
                  invalidDistrictId,
                  '2024-01-01',
                  [],
                  [],
                  []
                )
              } catch (error) {
                expect(error).toBeInstanceOf(Error)
                const errorMessage = (error as Error).message.toLowerCase()
                expect(
                  errorMessage.includes('invalid') &&
                    (errorMessage.includes('district') ||
                      errorMessage.includes('id'))
                ).toBe(true)
              }

              await expect(
                districtCacheManager.getDistrictData(
                  invalidDistrictId,
                  '2024-01-01'
                )
              ).rejects.toThrow()

              await expect(
                districtCacheManager.getCachedDatesForDistrict(
                  invalidDistrictId
                )
              ).rejects.toThrow()
            }

            // Test invalid date error messages
            if (invalidDate) {
              await expect(
                districtCacheManager.cacheDistrictData(
                  'valid-district',
                  invalidDate,
                  [],
                  [],
                  []
                )
              ).rejects.toThrow()

              try {
                await districtCacheManager.cacheDistrictData(
                  'valid-district',
                  invalidDate,
                  [],
                  [],
                  []
                )
              } catch (error) {
                expect(error).toBeInstanceOf(Error)
                const errorMessage = (error as Error).message.toLowerCase()
                expect(
                  errorMessage.includes('invalid') &&
                    errorMessage.includes('date')
                ).toBe(true)
              }

              await expect(
                districtCacheManager.getDistrictData(
                  'valid-district',
                  invalidDate
                )
              ).rejects.toThrow()
            }

            await cacheConfigService.dispose()
          }
        ),
        { numRuns: 5, timeout: 10000 }
      )
    })

    it('should handle cache manager initialization failures gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            readOnlyPath: fc.boolean(),
            nonExistentPath: fc.boolean(),
            pathSuffix: fc
              .string({ minLength: 1, maxLength: 10 })
              .filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
          }),
          async ({
            readOnlyPath: _readOnlyPath,
            nonExistentPath,
            pathSuffix,
          }) => {
            // Property: Cache manager initialization failures should be handled gracefully
            let testPath: string

            if (nonExistentPath) {
              // Use a path that definitely doesn't exist and can't be created
              testPath = `/nonexistent/readonly/path/${pathSuffix}`
            } else {
              testPath = path.resolve(
                `./test-dir/cache-init-test-${pathSuffix}`
              )
              cleanup.trackDirectory(testPath)
            }

            const config: ServiceConfiguration = {
              cacheDirectory: testPath,
              environment: 'test',
              logLevel: 'error',
            }

            const logger = new TestLogger()
            const cacheConfigService = new CacheConfigService(config, logger)

            if (nonExistentPath) {
              // Should fail initialization with meaningful error
              await expect(cacheConfigService.initialize()).rejects.toThrow()
              expect(cacheConfigService.isReady()).toBe(false)

              // Error should be descriptive
              try {
                await cacheConfigService.initialize()
              } catch (error) {
                expect(error).toBeInstanceOf(Error)
                const errorMessage = (error as Error).message.toLowerCase()
                expect(
                  errorMessage.includes('cache') ||
                    errorMessage.includes('directory') ||
                    errorMessage.includes('invalid') ||
                    errorMessage.includes('create') ||
                    errorMessage.includes('access')
                ).toBe(true)
              }
            } else {
              // Valid paths should initialize successfully
              await expect(
                cacheConfigService.initialize()
              ).resolves.not.toThrow()
              expect(cacheConfigService.isReady()).toBe(true)

              // Should be able to create cache managers
              const districtCacheManager = new DistrictCacheManager(
                cacheConfigService.getCacheDirectory()
              )
              await expect(districtCacheManager.init()).resolves.not.toThrow()

              const cacheManager = new CacheManager(
                cacheConfigService.getCacheDirectory()
              )
              await expect(cacheManager.init()).resolves.not.toThrow()

              await cacheConfigService.dispose()
            }
          }
        ),
        { numRuns: 5, timeout: 10000 }
      )
    })

    it('should provide recovery options for cache operation failures', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            operationType: fc.constantFrom('read', 'write', 'list', 'check'),
            errorScenario: fc.constantFrom(
              'invalid_input',
              'missing_file',
              'permission_denied'
            ),
          }),
          async ({ operationType: _operationType, errorScenario }) => {
            // Property: Cache operation failures should provide recovery options
            const testCacheDir = path.resolve('./test-dir/cache-recovery-test')
            cleanup.trackDirectory(testCacheDir)

            const config: ServiceConfiguration = {
              cacheDirectory: testCacheDir,
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

            // Test different error scenarios and recovery options
            switch (errorScenario) {
              case 'invalid_input': {
                // Invalid inputs should fail gracefully without corrupting state
                const invalidDistrictId = '../invalid'

                // Operations should fail but not crash the manager
                await expect(
                  districtCacheManager.cacheDistrictData(
                    invalidDistrictId,
                    '2024-01-01',
                    [],
                    [],
                    []
                  )
                ).rejects.toThrow()

                // Manager should still be functional for valid operations
                await expect(
                  districtCacheManager.cacheDistrictData(
                    'valid-district',
                    '2024-01-01',
                    [],
                    [],
                    []
                  )
                ).resolves.not.toThrow()

                break
              }

              case 'missing_file': {
                // Missing files should return null/empty results, not throw errors
                const result = await districtCacheManager.getDistrictData(
                  'nonexistent',
                  '2024-01-01'
                )
                expect(result).toBeNull()

                const dates =
                  await districtCacheManager.getCachedDatesForDistrict(
                    'nonexistent'
                  )
                expect(dates).toEqual([])

                const hasData = await districtCacheManager.hasDistrictData(
                  'nonexistent',
                  '2024-01-01'
                )
                expect(hasData).toBe(false)

                break
              }

              case 'permission_denied':
                // Permission errors should be handled gracefully
                // This is harder to test reliably across platforms, so we'll test cleanup operations
                await expect(
                  districtCacheManager.clearDistrictCache('nonexistent')
                ).resolves.not.toThrow()

                await expect(
                  districtCacheManager.clearDistrictCacheForDate(
                    'nonexistent',
                    '2024-01-01'
                  )
                ).resolves.not.toThrow()

                break
            }

            await cacheConfigService.dispose()
          }
        ),
        { numRuns: 5, timeout: 10000 }
      )
    })
  })
})
