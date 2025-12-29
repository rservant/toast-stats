/**
 * Property-Based Tests for Configuration Injection
 *
 * **Feature: test-infrastructure-stabilization, Property 3: Configuration Injection**
 * **Validates: Requirements 1.5**
 *
 * This test validates that services receive configuration through constructor parameters
 * rather than accessing global environment variables directly, ensuring proper
 * dependency injection and test isolation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import path from 'path'
import { CacheConfigService } from '../CacheConfigService.js'
import { ILogger } from '../../types/serviceInterfaces.js'
import { AnalyticsEngine } from '../AnalyticsEngine.js'
import { DistrictCacheManager } from '../DistrictCacheManager.js'
import { ServiceConfiguration } from '../../types/serviceContainer.js'
import { safeString } from '../../utils/test-string-generators.js'
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

describe('Configuration Injection Property Tests', () => {
  let originalEnv: Record<string, string | undefined> = {}

  // Self-cleanup setup - each test manages its own cleanup
  const { cleanup, afterEach: performCleanup } = createTestSelfCleanup({
    verbose: false,
  })

  beforeEach(() => {
    // Store original environment variables
    originalEnv = {
      CACHE_DIR: process.env.CACHE_DIR,
      NODE_ENV: process.env.NODE_ENV,
      LOG_LEVEL: process.env.LOG_LEVEL,
    }
  })

  afterEach(async () => {
    // Restore original environment variables
    Object.keys(originalEnv).forEach(key => {
      if (originalEnv[key] !== undefined) {
        process.env[key] = originalEnv[key]
      } else {
        delete process.env[key]
      }
    })

    // Perform self-cleanup of all tracked resources
    await performCleanup()
  })

  // Test data generators
  const generateServiceConfiguration = (): fc.Arbitrary<ServiceConfiguration> =>
    fc.record({
      cacheDirectory: safeString(5, 20).map(
        s => `./test-dir/config-inject-${s}`
      ),
      environment: fc.constantFrom('test', 'development', 'production'),
      logLevel: fc.constantFrom('debug', 'info', 'warn', 'error'),
    })

  const generateEnvironmentVariables = (): fc.Arbitrary<{
    CACHE_DIR?: string
    NODE_ENV?: string
    LOG_LEVEL?: string
  }> =>
    fc.record({
      CACHE_DIR: fc.option(safeString(5, 20).map(s => `./test-dir/env-${s}`)),
      NODE_ENV: fc.option(fc.constantFrom('test', 'development', 'production')),
      LOG_LEVEL: fc.option(fc.constantFrom('debug', 'info', 'warn', 'error')),
    })

  /**
   * Property 3: Configuration Injection
   * For any service requiring configuration, the service should receive configuration
   * through constructor parameters rather than accessing global environment variables directly
   */
  describe('Property 3: Configuration Injection', () => {
    it('should receive configuration through constructor parameters instead of global access', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            generateServiceConfiguration(),
            generateEnvironmentVariables()
          ),
          async ([serviceConfig, envVars]) => {
            const logger = new TestLogger()

            // Set environment variables that should NOT be used by injected services
            Object.entries(envVars).forEach(([key, value]) => {
              if (value !== undefined) {
                process.env[key] = value
              } else {
                delete process.env[key]
              }
            })

            // Track directories that might be created
            cleanup.trackDirectory(path.resolve(serviceConfig.cacheDirectory))
            if (envVars.CACHE_DIR) {
              cleanup.trackDirectory(path.resolve(envVars.CACHE_DIR))
            }

            // Property: CacheConfigService should use injected configuration, not environment
            const cacheConfigService = new CacheConfigService(
              serviceConfig,
              logger
            )
            await cacheConfigService.initialize()

            // Property: For test environment, should use injected config regardless of env vars
            if (serviceConfig.environment === 'test') {
              const actualCacheDir = cacheConfigService.getCacheDirectory()
              expect(actualCacheDir).toBe(serviceConfig.cacheDirectory)

              const config = cacheConfigService.getConfiguration()
              expect(config.source).toBe('test')
              expect(config.baseDirectory).toBe(serviceConfig.cacheDirectory)

              // Property: Should NOT use environment variable when test config is injected
              if (
                envVars.CACHE_DIR &&
                envVars.CACHE_DIR !== serviceConfig.cacheDirectory
              ) {
                expect(actualCacheDir).not.toBe(path.resolve(envVars.CACHE_DIR))
              }
            }

            // Property: AnalyticsEngine should use injected dependencies
            const cacheManager = new DistrictCacheManager(
              serviceConfig.cacheDirectory
            )
            const analyticsEngine = new AnalyticsEngine(cacheManager)

            // Property: AnalyticsEngine should work with injected cache manager
            expect(analyticsEngine).toBeInstanceOf(AnalyticsEngine)
            expect(typeof analyticsEngine.generateDistrictAnalytics).toBe(
              'function'
            )
            expect(typeof analyticsEngine.getClubTrends).toBe('function')
            expect(typeof analyticsEngine.clearCaches).toBe('function')
            expect(typeof analyticsEngine.dispose).toBe('function')

            // Property: Services should be independently configurable
            const differentConfig: ServiceConfiguration = {
              cacheDirectory: `${serviceConfig.cacheDirectory}-different`,
              environment: serviceConfig.environment,
              logLevel: serviceConfig.logLevel,
            }

            cleanup.trackDirectory(path.resolve(differentConfig.cacheDirectory))

            const differentCacheService = new CacheConfigService(
              differentConfig,
              logger
            )
            await differentCacheService.initialize()

            if (serviceConfig.environment === 'test') {
              expect(differentCacheService.getCacheDirectory()).toBe(
                differentConfig.cacheDirectory
              )
              expect(differentCacheService.getCacheDirectory()).not.toBe(
                cacheConfigService.getCacheDirectory()
              )
            }

            // Property: Services should be disposable
            await cacheConfigService.dispose()
            await analyticsEngine.dispose()
            await differentCacheService.dispose()

            expect(cacheConfigService.isReady()).toBe(false)
            expect(differentCacheService.isReady()).toBe(false)
          }
        ),
        { numRuns: 10 }
      )
    })

    it('should maintain configuration isolation between service instances', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(generateServiceConfiguration(), {
            minLength: 2,
            maxLength: 4,
          }),
          async configs => {
            // Ensure unique cache directories
            const uniqueConfigs = configs.map((config, index) => ({
              ...config,
              cacheDirectory: `${config.cacheDirectory}-instance-${index}`,
            }))

            // Track directories that might be created
            uniqueConfigs.forEach(config => {
              cleanup.trackDirectory(path.resolve(config.cacheDirectory))
            })

            // Property: Each service instance should maintain its own configuration
            const services = uniqueConfigs.map(config => {
              const logger = new TestLogger()
              return {
                service: new CacheConfigService(config, logger),
                config,
                logger,
              }
            })

            // Initialize all services
            await Promise.all(
              services.map(({ service }) => service.initialize())
            )

            // Property: Each service should use its own injected configuration
            services.forEach(({ service, config }, index) => {
              if (config.environment === 'test') {
                expect(service.getCacheDirectory()).toBe(config.cacheDirectory)
                expect(service.getConfiguration().source).toBe('test')
              }

              // Property: Configuration should be isolated from other instances
              services.forEach(
                (
                  { service: otherService, config: otherConfig },
                  otherIndex
                ) => {
                  if (
                    index !== otherIndex &&
                    config.environment === 'test' &&
                    otherConfig.environment === 'test'
                  ) {
                    expect(service.getCacheDirectory()).not.toBe(
                      otherService.getCacheDirectory()
                    )
                  }
                }
              )
            })

            // Property: Modifying one service's state should not affect others
            const firstService = services[0].service
            await firstService.dispose()
            expect(firstService.isReady()).toBe(false)

            // Other services should remain ready
            services.slice(1).forEach(({ service }) => {
              expect(service.isReady()).toBe(true)
            })

            // Cleanup remaining services
            await Promise.all(
              services.slice(1).map(({ service }) => service.dispose())
            )
          }
        ),
        { numRuns: 8 }
      )
    })

    it('should support different configuration sources without global state dependency', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            testConfig: generateServiceConfiguration(),
            devConfig: generateServiceConfiguration(),
            prodConfig: generateServiceConfiguration(),
            envVarValue: fc.option(
              safeString(5, 15).map(s => `./test-dir/env-${s}`)
            ),
          }),
          async ({ testConfig, devConfig, prodConfig, envVarValue }) => {
            // Set up different environment configurations
            const configs = [
              { ...testConfig, environment: 'test' as const },
              { ...devConfig, environment: 'development' as const },
              { ...prodConfig, environment: 'production' as const },
            ]

            // Ensure unique cache directories
            configs.forEach((config, index) => {
              config.cacheDirectory = `${config.cacheDirectory}-env-${index}`
              cleanup.trackDirectory(path.resolve(config.cacheDirectory))
            })

            if (envVarValue) {
              process.env.CACHE_DIR = envVarValue
              cleanup.trackDirectory(path.resolve(envVarValue))
            } else {
              delete process.env.CACHE_DIR
            }

            // Property: Services should behave according to their injected configuration
            const services = configs.map(config => {
              const logger = new TestLogger()
              return {
                service: new CacheConfigService(config, logger),
                config,
                logger,
              }
            })

            await Promise.all(
              services.map(({ service }) => service.initialize())
            )

            // Property: Test environment service should always use injected config
            const testService = services.find(
              ({ config }) => config.environment === 'test'
            )
            if (testService) {
              expect(testService.service.getCacheDirectory()).toBe(
                testService.config.cacheDirectory
              )
              expect(testService.service.getConfiguration().source).toBe('test')
            }

            // Property: Non-test services should respect environment variables when available
            const nonTestServices = services.filter(
              ({ config }) => config.environment !== 'test'
            )
            nonTestServices.forEach(({ service, config: _config }) => {
              const actualDir = service.getCacheDirectory()
              const serviceConfig = service.getConfiguration()

              if (envVarValue) {
                expect(actualDir).toBe(path.resolve(envVarValue))
                expect(serviceConfig.source).toBe('environment')
              } else {
                expect(actualDir).toBe(path.resolve('./cache'))
                expect(serviceConfig.source).toBe('default')
              }
            })

            // Property: All services should be independently functional
            services.forEach(({ service }) => {
              expect(service.isReady()).toBe(true)
            })

            // Property: Services should be independently disposable
            await Promise.all(services.map(({ service }) => service.dispose()))
            services.forEach(({ service }) => {
              expect(service.isReady()).toBe(false)
            })
          }
        ),
        { numRuns: 8 }
      )
    })

    it('should handle configuration changes through dependency injection, not global state', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            generateServiceConfiguration(),
            generateServiceConfiguration()
          ),
          async ([initialConfig, updatedConfig]) => {
            const logger = new TestLogger()

            // Ensure different cache directories
            if (initialConfig.cacheDirectory === updatedConfig.cacheDirectory) {
              updatedConfig.cacheDirectory = `${updatedConfig.cacheDirectory}-updated`
            }

            // Track directories that might be created
            cleanup.trackDirectory(path.resolve(initialConfig.cacheDirectory))
            cleanup.trackDirectory(path.resolve(updatedConfig.cacheDirectory))

            // Property: Initial service should use initial configuration
            const initialService = new CacheConfigService(initialConfig, logger)
            await initialService.initialize()

            if (initialConfig.environment === 'test') {
              expect(initialService.getCacheDirectory()).toBe(
                initialConfig.cacheDirectory
              )
            }

            // Property: New service with updated config should use new configuration
            const updatedService = new CacheConfigService(updatedConfig, logger)
            await updatedService.initialize()

            if (updatedConfig.environment === 'test') {
              expect(updatedService.getCacheDirectory()).toBe(
                updatedConfig.cacheDirectory
              )
            }

            // Property: Services should be independent despite configuration changes
            if (
              initialConfig.environment === 'test' &&
              updatedConfig.environment === 'test'
            ) {
              expect(initialService.getCacheDirectory()).not.toBe(
                updatedService.getCacheDirectory()
              )
            }

            // Property: Both services should be functional
            expect(initialService.isReady()).toBe(true)
            expect(updatedService.isReady()).toBe(true)

            // Property: Configuration changes should not affect existing instances
            const updatedDir = updatedService.getCacheDirectory()

            // Dispose one service
            await initialService.dispose()
            expect(initialService.isReady()).toBe(false)

            // Other service should remain unaffected
            expect(updatedService.isReady()).toBe(true)
            expect(updatedService.getCacheDirectory()).toBe(updatedDir)

            await updatedService.dispose()
          }
        ),
        { numRuns: 10 }
      )
    })

    it('should validate that services do not access global environment directly', async () => {
      await fc.assert(
        fc.asyncProperty(
          generateServiceConfiguration(),
          async serviceConfig => {
            const logger = new TestLogger()

            // Set conflicting environment variables
            const conflictingCacheDir = `${serviceConfig.cacheDirectory}-conflict`
            process.env.CACHE_DIR = conflictingCacheDir
            process.env.NODE_ENV = 'production'
            process.env.LOG_LEVEL = 'error'

            // Track directories that might be created
            cleanup.trackDirectory(path.resolve(serviceConfig.cacheDirectory))
            cleanup.trackDirectory(path.resolve(conflictingCacheDir))

            // Property: Service should use injected configuration, not environment
            const service = new CacheConfigService(serviceConfig, logger)
            await service.initialize()

            // Property: Test environment should ignore conflicting environment variables
            if (serviceConfig.environment === 'test') {
              expect(service.getCacheDirectory()).toBe(
                serviceConfig.cacheDirectory
              )
              expect(service.getCacheDirectory()).not.toBe(
                path.resolve(conflictingCacheDir)
              )

              const config = service.getConfiguration()
              expect(config.source).toBe('test')
              expect(config.baseDirectory).toBe(serviceConfig.cacheDirectory)
            }

            // Property: Service should use injected logger, not global console
            expect(logger.logs.length).toBeGreaterThan(0)
            const hasInitLog = logger.logs.some(log =>
              log.message.includes(
                'Cache configuration initialized successfully'
              )
            )
            expect(hasInitLog).toBe(true)

            await service.dispose()
          }
        ),
        { numRuns: 10 }
      )
    })
  })
})
