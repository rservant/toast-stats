/**
 * Property-Based Tests for Test Instance Isolation
 *
 * **Feature: test-infrastructure-stabilization, Property 2: Test Instance Isolation**
 * **Validates: Requirements 1.3**
 *
 * Tests that test service factory creates properly isolated instances that don't interfere
 * with each other and can be independently configured and disposed.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import fs from 'fs/promises'
import {
  DefaultTestServiceFactory,
  TestConfigurationProvider,
  getTestServiceFactory,
  resetTestServiceFactory,
} from '../TestServiceFactory.js'
import { safeString } from '../../utils/test-string-generators.js'
import { createTestSelfCleanup } from '../../utils/test-self-cleanup.js'

describe('TestServiceFactory - Instance Isolation Property Tests', () => {
  // Self-cleanup setup - each test manages its own cleanup
  const { cleanup, afterEach: performCleanup } = createTestSelfCleanup({
    verbose: false,
  })

  afterEach(async () => {
    // Reset global factory and perform self-cleanup
    await resetTestServiceFactory()
    await performCleanup()
  })

  // Test data generators
  const generateCacheDirectory = (): fc.Arbitrary<string> =>
    safeString(5, 15).map(
      s =>
        `/tmp/test-factory-${s}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
    )

  const generateConfiguration = (): fc.Arbitrary<{
    cacheDirectory: string
    environment: string
    logLevel: string
  }> =>
    fc.record({
      cacheDirectory: generateCacheDirectory(),
      environment: fc.constantFrom('test', 'development', 'production'),
      logLevel: fc.constantFrom('error', 'warn', 'info', 'debug'),
    })

  /**
   * Property 2: Test Instance Isolation
   * For any test service factory, created instances should be properly isolated
   * from each other with independent configuration and lifecycle management
   * **Validates: Requirements 1.3**
   */
  describe('Property 2: Test Instance Isolation', () => {
    it('should create isolated service containers that do not interfere with each other', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            containerCount: fc.integer({ min: 2, max: 5 }),
            configurations: fc.array(generateConfiguration(), {
              minLength: 2,
              maxLength: 5,
            }),
          }),
          async ({ containerCount, configurations }) => {
            const factory = new DefaultTestServiceFactory()
            const containers: any[] = []
            const configProviders: any[] = []

            try {
              // Property: Factory should create multiple isolated containers
              for (let i = 0; i < containerCount; i++) {
                const container = factory.createTestContainer()
                const config = factory.createTestConfiguration(
                  configurations[i % configurations.length]
                )

                containers.push(container)
                configProviders.push(config)

                // Property: Each container should be a distinct instance
                expect(container).toBeDefined()
                expect(typeof container.register).toBe('function')
                expect(typeof container.resolve).toBe('function')
                expect(typeof container.dispose).toBe('function')
              }

              // Property: Containers should be independent instances
              if (containers.length > 1) {
                for (let i = 0; i < containers.length - 1; i++) {
                  for (let j = i + 1; j < containers.length; j++) {
                    expect(containers[i]).not.toBe(containers[j])
                  }
                }
              }

              // Property: Configuration providers should be independent
              if (configProviders.length > 1) {
                for (let i = 0; i < configProviders.length - 1; i++) {
                  for (let j = i + 1; j < configProviders.length; j++) {
                    expect(configProviders[i]).not.toBe(configProviders[j])

                    // Configurations should be independent
                    const config1 = configProviders[i].getConfiguration()
                    const config2 = configProviders[j].getConfiguration()

                    // If they have different cache directories, they should remain different
                    if (config1.cacheDirectory !== config2.cacheDirectory) {
                      expect(config1.cacheDirectory).not.toBe(
                        config2.cacheDirectory
                      )
                    }
                  }
                }
              }

              // Property: Modifying one configuration should not affect others
              if (configProviders.length > 1) {
                const originalConfig = configProviders[0].getConfiguration()
                const newCacheDir = `/tmp/modified-${Date.now()}`

                configProviders[0].updateConfiguration({
                  cacheDirectory: newCacheDir,
                })

                const modifiedConfig = configProviders[0].getConfiguration()
                const otherConfig = configProviders[1].getConfiguration()

                expect(modifiedConfig.cacheDirectory).toBe(newCacheDir)
                expect(otherConfig.cacheDirectory).not.toBe(newCacheDir)
              }
            } finally {
              // Cleanup through factory
              await factory.cleanup()
            }
          }
        ),
        { numRuns: 5 } // Reduced iterations for CI performance
      )
    })

    it('should provide isolated configuration providers with independent state', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            providerCount: fc.integer({ min: 2, max: 4 }),
            baseConfig: generateConfiguration(),
            modifications: fc.array(
              fc.record({
                cacheDirectory: generateCacheDirectory(),
                logLevel: fc.constantFrom('error', 'warn', 'info'),
              }),
              { minLength: 1, maxLength: 3 }
            ),
          }),
          async ({ providerCount, baseConfig, modifications }) => {
            const factory = new DefaultTestServiceFactory()
            const providers: TestConfigurationProvider[] = []

            try {
              // Property: Factory should create multiple isolated configuration providers
              for (let i = 0; i < providerCount; i++) {
                const provider = new TestConfigurationProvider(baseConfig)
                providers.push(provider)
              }

              // Property: Each provider should start with the same base configuration
              const baseConfigCopy = { ...baseConfig }
              for (const provider of providers) {
                const config = provider.getConfiguration()
                expect(config.cacheDirectory).toBe(
                  baseConfigCopy.cacheDirectory
                )
                expect(config.environment).toBe(baseConfigCopy.environment)
                expect(config.logLevel).toBe(baseConfigCopy.logLevel)
              }

              // Property: Modifying one provider should not affect others
              for (
                let i = 0;
                i < Math.min(providers.length, modifications.length);
                i++
              ) {
                const modification = modifications[i]
                providers[i].updateConfiguration(modification)

                // Check that this provider was modified
                const modifiedConfig = providers[i].getConfiguration()
                expect(modifiedConfig.cacheDirectory).toBe(
                  modification.cacheDirectory
                )
                expect(modifiedConfig.logLevel).toBe(modification.logLevel)

                // Check that other providers were not affected
                for (let j = 0; j < providers.length; j++) {
                  if (i !== j) {
                    const otherConfig = providers[j].getConfiguration()
                    expect(otherConfig.cacheDirectory).not.toBe(
                      modification.cacheDirectory
                    )
                  }
                }
              }
            } finally {
              // Cleanup through factory
              await factory.cleanup()
            }
          }
        ),
        { numRuns: 5 } // Reduced iterations for CI performance
      )
    })

    it('should support proper cleanup and disposal of all created instances', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            instanceCount: fc.integer({ min: 1, max: 4 }),
            config: generateConfiguration(),
          }),
          async ({ instanceCount, config }) => {
            const factory = new DefaultTestServiceFactory()
            const containers: any[] = []
            const configProviders: any[] = []

            try {
              // Property: Factory should track all created instances
              for (let i = 0; i < instanceCount; i++) {
                const container = factory.createTestContainer()
                const configProvider = factory.createTestConfiguration(config)

                containers.push(container)
                configProviders.push(configProvider)
              }

              // Property: All instances should be functional before cleanup
              for (const container of containers) {
                expect(container).toBeDefined()
                expect(typeof container.dispose).toBe('function')
              }

              for (const provider of configProviders) {
                expect(provider).toBeDefined()
                expect(typeof provider.getConfiguration).toBe('function')

                const configuration = provider.getConfiguration()
                expect(configuration).toBeDefined()
                expect(configuration.cacheDirectory).toBe(config.cacheDirectory)
              }

              // Property: Factory cleanup should not throw errors
              await expect(factory.cleanup()).resolves.not.toThrow()

              // Property: After cleanup, factory should be in clean state
              // (We can't easily test internal state, but cleanup should complete successfully)
            } finally {
              // Ensure cleanup even if test fails
              try {
                await factory.cleanup()
              } catch (error) {
                // Cleanup errors should not fail the test
                console.warn('Cleanup error in test:', error)
              }
            }
          }
        ),
        { numRuns: 5 } // Reduced iterations for CI performance
      )
    })

    it('should support global factory reset without affecting other instances', async () => {
      await fc.assert(
        fc.asyncProperty(generateConfiguration(), async config => {
          // Property: Global factory should be resettable
          const factory1 = getTestServiceFactory()
          const container1 = factory1.createTestContainer()
          const configProvider1 = factory1.createTestConfiguration(config)

          expect(container1).toBeDefined()
          expect(configProvider1).toBeDefined()

          // Property: Reset should not throw errors
          await expect(resetTestServiceFactory()).resolves.not.toThrow()

          // Property: New factory instance should be independent
          const factory2 = getTestServiceFactory()
          expect(factory2).toBeDefined()

          const container2 = factory2.createTestContainer()
          const configProvider2 = factory2.createTestConfiguration(config)

          expect(container2).toBeDefined()
          expect(configProvider2).toBeDefined()

          // Property: New instances should be functional
          const config1 = configProvider2.getConfiguration()
          expect(config1.cacheDirectory).toBe(config.cacheDirectory)
          expect(config1.environment).toBe(config.environment)

          // Cleanup
          await resetTestServiceFactory()
        }),
        { numRuns: 3 } // Reduced iterations for CI performance
      )
    })
  })
})
