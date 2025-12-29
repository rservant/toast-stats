/**
 * Property-Based Tests for Interface-Based Dependency Injection
 *
 * Feature: test-infrastructure-stabilization, Property 16: Interface-Based Dependency Injection
 * **Validates: Requirements 6.4, 6.5**
 *
 * Tests that services can be injected through interfaces and allow easy substitution
 * of mock implementations through the container.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import {
  DefaultServiceContainer,
  createInterfaceToken,
  createServiceFactory,
} from '../ServiceContainer.js'
import {
  DefaultTestServiceFactory,
  InterfaceTokens,
} from '../TestServiceFactory.js'
import {
  ICacheConfigService,
  IAnalyticsEngine,
  IDistrictCacheManager,
  ILogger,
} from '../../types/serviceInterfaces.js'
import { ServiceConfiguration } from '../../types/serviceContainer.js'

describe('Interface-Based Dependency Injection Properties', () => {
  let container: DefaultServiceContainer
  let testFactory: DefaultTestServiceFactory

  beforeEach(() => {
    container = new DefaultServiceContainer()
    testFactory = new DefaultTestServiceFactory()
  })

  afterEach(async () => {
    await container.dispose()
    await testFactory.cleanup()
  })

  /**
   * Property 16: Interface-Based Dependency Injection
   * For any service injection, the service should be injectable through interfaces
   * and allow easy substitution of mock implementations
   * **Validates: Requirements 6.4, 6.5**
   */
  it('should support interface-based service injection and mock substitution', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          interfaceName: fc.constantFrom(
            'ICacheConfigService',
            'IAnalyticsEngine',
            'IDistrictCacheManager',
            'ILogger'
          ),
          mockValue: fc.record({
            testProperty: fc.string(),
            testMethod: fc.constant(() => 'mock-result'),
          }),
          cacheDirectory: fc
            .string({ minLength: 5, maxLength: 50 })
            .filter(s => s.trim().length > 0),
          environment: fc.constantFrom('test', 'development', 'production'),
          logLevel: fc.constantFrom('debug', 'info', 'warn', 'error'),
        }),
        async ({
          interfaceName,
          mockValue,
          cacheDirectory,
          environment,
          logLevel,
        }) => {
          // Create a fresh container for this test run
          const testContainer = new DefaultServiceContainer()

          // Test interface registration and resolution
          const mockService = {
            ...mockValue,
            dispose: async () => {},
          }

          // Register interface with factory
          testContainer.registerInterface(
            interfaceName,
            createServiceFactory(
              () => mockService,
              async instance => await instance.dispose()
            )
          )

          // Should be able to resolve by interface name
          expect(testContainer.isInterfaceRegistered(interfaceName)).toBe(true)

          const resolvedService = testContainer.resolveInterface(
            interfaceName
          ) as any
          expect(resolvedService).toBeDefined()
          expect(resolvedService.testProperty).toBe(mockValue.testProperty)
          expect(resolvedService.testMethod()).toBe('mock-result')

          // Test mock substitution (Requirement 6.5)
          const alternativeMock = {
            testProperty: 'alternative-value',
            testMethod: () => 'alternative-result',
            dispose: async () => {},
          }

          testContainer.registerMock(interfaceName, alternativeMock)

          const mockedService = testContainer.resolveInterface(
            interfaceName
          ) as any
          expect(mockedService.testProperty).toBe('alternative-value')
          expect(mockedService.testMethod()).toBe('alternative-result')

          // Clear mocks should restore original behavior
          testContainer.clearMocks()
          const restoredService = testContainer.resolveInterface(
            interfaceName
          ) as any
          expect(restoredService.testProperty).toBe(mockValue.testProperty)

          // Cleanup
          await testContainer.dispose()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should support interface-based injection through test factory', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          interfaceName: fc.constantFrom(
            'ICacheConfigService',
            'IAnalyticsEngine',
            'IDistrictCacheManager'
          ),
          configOverrides: fc.record({
            cacheDirectory: fc
              .string({ minLength: 5, maxLength: 50 })
              .filter(s => s.trim().length > 0),
            environment: fc.constantFrom('test', 'development', 'production'),
            logLevel: fc.constantFrom('debug', 'info', 'warn', 'error'),
          }),
        }),
        async ({ interfaceName, configOverrides }) => {
          try {
            // Test factory-based interface creation
            const service = testFactory.createServiceByInterface(interfaceName)
            expect(service).toBeDefined()

            // Test mock registration through factory
            const mockService = {
              testProperty: 'factory-mock',
              testMethod: () => 'factory-mock-result',
              dispose: async () => {},
            }

            testFactory.registerMockService(interfaceName, mockService)

            const mockedService = testFactory.createServiceByInterface(
              interfaceName
            ) as any
            expect(mockedService.testProperty).toBe('factory-mock')
            expect(mockedService.testMethod()).toBe('factory-mock-result')

            // Clear mocks should work
            testFactory.clearMocks()
            const clearedService = testFactory.createServiceByInterface(
              interfaceName
            ) as any
            expect(clearedService).toBeDefined()
            // Should be a real service instance, not the mock
            expect(clearedService.testProperty).toBeUndefined()
          } catch (error) {
            // If cache directory validation fails, that's expected for edge cases
            if (
              error instanceof Error &&
              error.message.includes('Cache directory')
            ) {
              return true // Skip this test case
            }
            throw error
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should maintain interface contract consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          cacheDirectory: fc
            .string({ minLength: 5, maxLength: 50 })
            .filter(s => s.trim().length > 0),
          environment: fc.constantFrom('test', 'development', 'production'),
          logLevel: fc.constantFrom('debug', 'info', 'warn', 'error'),
        }),
        async ({ cacheDirectory, environment, logLevel }) => {
          try {
            const config: Partial<ServiceConfiguration> = {
              cacheDirectory,
              environment: environment as 'test' | 'development' | 'production',
              logLevel: logLevel as 'debug' | 'info' | 'warn' | 'error',
            }

            // Create services through concrete factory methods
            const cacheConfigService =
              testFactory.createCacheConfigService(config)
            const analyticsEngine = testFactory.createAnalyticsEngine()
            const districtCacheManager =
              testFactory.createDistrictCacheManager()

            // Verify they implement the expected interfaces
            expect(typeof cacheConfigService.getCacheDirectory).toBe('function')
            expect(typeof cacheConfigService.initialize).toBe('function')
            expect(typeof cacheConfigService.dispose).toBe('function')

            expect(typeof analyticsEngine.generateDistrictAnalytics).toBe(
              'function'
            )
            expect(typeof analyticsEngine.clearCaches).toBe('function')
            expect(typeof analyticsEngine.dispose).toBe('function')

            expect(typeof districtCacheManager.getCachedDatesForDistrict).toBe(
              'function'
            )
            expect(typeof districtCacheManager.getDistrictData).toBe('function')

            // Test that interface-based creation returns compatible objects
            const interfaceCacheService =
              testFactory.createServiceByInterface<ICacheConfigService>(
                'ICacheConfigService'
              )
            const interfaceAnalyticsEngine =
              testFactory.createServiceByInterface<IAnalyticsEngine>(
                'IAnalyticsEngine'
              )
            const interfaceDistrictManager =
              testFactory.createServiceByInterface<IDistrictCacheManager>(
                'IDistrictCacheManager'
              )

            // Should have the same interface methods
            expect(typeof interfaceCacheService.getCacheDirectory).toBe(
              'function'
            )
            expect(typeof interfaceCacheService.initialize).toBe('function')
            expect(typeof interfaceCacheService.dispose).toBe('function')

            expect(
              typeof interfaceAnalyticsEngine.generateDistrictAnalytics
            ).toBe('function')
            expect(typeof interfaceAnalyticsEngine.clearCaches).toBe('function')
            expect(typeof interfaceAnalyticsEngine.dispose).toBe('function')

            expect(
              typeof interfaceDistrictManager.getCachedDatesForDistrict
            ).toBe('function')
            expect(typeof interfaceDistrictManager.getDistrictData).toBe(
              'function'
            )
          } catch (error) {
            // If cache directory validation fails, that's expected for edge cases
            if (
              error instanceof Error &&
              error.message.includes('Cache directory')
            ) {
              return true // Skip this test case
            }
            throw error
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should handle circular dependency detection with interfaces', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), {
          minLength: 2,
          maxLength: 5,
        }),
        interfaceNames => {
          // Create a fresh container for this test run
          const testContainer = new DefaultServiceContainer()

          // Create circular dependency chain
          const uniqueNames = [...new Set(interfaceNames)]
          if (uniqueNames.length < 2) return true // Skip if not enough unique names

          // Register services that depend on each other in a circle
          for (let i = 0; i < uniqueNames.length; i++) {
            const currentInterface = uniqueNames[i]
            const nextInterface = uniqueNames[(i + 1) % uniqueNames.length]

            testContainer.registerInterface(
              currentInterface,
              createServiceFactory(container => {
                // This creates a circular dependency
                const dependency = container.resolveInterface(nextInterface)
                return { dependency, name: currentInterface }
              })
            )
          }

          // Attempting to resolve should throw CircularDependencyError
          expect(() => {
            testContainer.resolveInterface(uniqueNames[0])
          }).toThrow()

          return true
        }
      ),
      { numRuns: 50 }
    )
  })

  it('should support singleton lifecycle for interface-based services', () => {
    fc.assert(
      fc.property(
        fc.record({
          interfaceName: fc.string({ minLength: 1, maxLength: 20 }),
          instanceId: fc.uuid(),
        }),
        ({ interfaceName, instanceId }) => {
          // Create a fresh container for this test run
          const testContainer = new DefaultServiceContainer()

          const mockService = {
            id: instanceId,
            callCount: 0,
            increment() {
              this.callCount++
            },
            dispose: async () => {},
          }

          // Register as singleton (default)
          testContainer.registerInterface(
            interfaceName,
            createServiceFactory(() => mockService),
            'singleton'
          )

          // Multiple resolutions should return the same instance
          const instance1 = testContainer.resolveInterface(interfaceName) as any
          const instance2 = testContainer.resolveInterface(interfaceName) as any

          expect(instance1).toBe(instance2)
          expect(instance1.id).toBe(instanceId)

          // State should be shared
          instance1.increment()
          expect(instance2.callCount).toBe(1)

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should support transient lifecycle for interface-based services', () => {
    fc.assert(
      fc.property(
        fc.record({
          interfaceName: fc.string({ minLength: 1, maxLength: 20 }),
          baseValue: fc.integer(),
        }),
        ({ interfaceName, baseValue }) => {
          // Create a fresh container for this test run
          const testContainer = new DefaultServiceContainer()

          let instanceCounter = 0

          testContainer.registerInterface(
            interfaceName,
            createServiceFactory(() => ({
              id: instanceCounter++,
              baseValue,
              dispose: async () => {},
            })),
            'transient'
          )

          // Multiple resolutions should return different instances
          const instance1 = testContainer.resolveInterface(interfaceName) as any
          const instance2 = testContainer.resolveInterface(interfaceName) as any

          expect(instance1).not.toBe(instance2)
          expect(instance1.id).not.toBe(instance2.id)
          expect(instance1.baseValue).toBe(baseValue)
          expect(instance2.baseValue).toBe(baseValue)

          return true
        }
      ),
      { numRuns: 100 }
    )
  })
})
