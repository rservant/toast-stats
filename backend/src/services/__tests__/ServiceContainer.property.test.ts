/**
 * Property-Based Tests for Service Container
 *
 * **Feature: test-infrastructure-stabilization, Property 15: Service Container Functionality**
 * **Validates: Requirements 6.1, 6.2, 6.3**
 *
 * Tests the core dependency injection container functionality including service registration,
 * resolution, lifecycle management, and proper cleanup for test isolation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import {
  DefaultServiceContainer,
  createServiceToken,
  createServiceFactory,
} from '../ServiceContainer.js'
import {
  ServiceContainer,
  ServiceToken,
  ServiceFactory,
  ServiceLifecycle,
  ServiceContainerError,
  CircularDependencyError,
  ServiceNotFoundError,
} from '../../types/serviceContainer.js'
import { safeString } from '../../utils/test-string-generators.js'
import { createTestSelfCleanup } from '../../utils/test-self-cleanup.js'

describe('ServiceContainer - Property-Based Tests', () => {
  let container: ServiceContainer

  // Self-cleanup setup - each test manages its own cleanup
  const { afterEach: performCleanup } = createTestSelfCleanup({
    verbose: false,
  })

  beforeEach(() => {
    // Create a completely fresh container for each test
    container = new DefaultServiceContainer()
  })

  afterEach(async () => {
    // Dispose container to clean up all services
    if (container) {
      await container.dispose()
    }

    // Perform self-cleanup of all tracked resources
    await performCleanup()
  })

  // Test data generators
  const generateServiceName = (): fc.Arbitrary<string> =>
    safeString(3, 20).map(
      (_s, _index) =>
        `Service_${_s}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    )

  const generateUniqueServiceNames = (count: number): string[] =>
    Array.from(
      { length: count },
      (_, i) =>
        `Service_${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${i}`
    )

  const generateServiceLifecycle = (): fc.Arbitrary<ServiceLifecycle> =>
    fc.oneof(
      fc.constant('singleton'),
      fc.constant('transient'),
      fc.constant('scoped')
    )

  // Mock service class for testing
  class MockService {
    public disposed = false
    public createdAt = new Date()

    constructor(
      public name: string,
      public dependencies: unknown[] = []
    ) {}

    async dispose(): Promise<void> {
      this.disposed = true
    }
  }

  const createMockServiceToken = (name: string): ServiceToken<MockService> =>
    createServiceToken(name, MockService)

  const createMockServiceFactory = (
    name: string,
    dependencies: ServiceToken<unknown>[] = []
  ): ServiceFactory<MockService> =>
    createServiceFactory(
      (container: ServiceContainer) => {
        const resolvedDependencies = dependencies.map(dep =>
          container.resolve(dep)
        )
        return new MockService(name, resolvedDependencies)
      },
      async (instance: MockService) => {
        await instance.dispose()
      }
    )

  /**
   * Property 15: Service Container Functionality
   * For any service container usage, the container should manage dependencies correctly,
   * provide factory methods for service creation, and resolve complex dependency graphs automatically
   */
  describe('Property 15: Service Container Functionality', () => {
    it('should register and resolve services correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }).chain(count =>
            fc.record({
              count: fc.constant(count),
              configs: fc.array(
                fc.record({
                  lifecycle: generateServiceLifecycle(),
                }),
                { minLength: count, maxLength: count }
              ),
            })
          ),
          async ({ count, configs }) => {
            // Create a fresh container for this property test iteration
            const testContainer = new DefaultServiceContainer()

            try {
              // Property: Container should register all services without conflicts
              const tokens: ServiceToken<MockService>[] = []
              const factories: ServiceFactory<MockService>[] = []
              const uniqueNames = generateUniqueServiceNames(count)

              for (let i = 0; i < count; i++) {
                const config = configs[i]
                const serviceName = uniqueNames[i]
                const token = createMockServiceToken(serviceName)
                const factory = createMockServiceFactory(serviceName)

                tokens.push(token)
                factories.push(factory)

                // Should not throw when registering unique services
                expect(() => {
                  testContainer.register(token, factory, config.lifecycle)
                }).not.toThrow()

                // Property: Service should be registered
                expect(testContainer.isRegistered(token)).toBe(true)
              }

              // Property: All registered services should be resolvable
              for (let i = 0; i < tokens.length; i++) {
                const token = tokens[i]
                const config = configs[i]
                const serviceName = uniqueNames[i]

                const instance = testContainer.resolve(token)
                expect(instance).toBeInstanceOf(MockService)
                expect(instance.name).toBe(serviceName)
                expect(instance.disposed).toBe(false)

                // Property: Singleton services should return the same instance
                if (config.lifecycle === 'singleton') {
                  const instance2 = testContainer.resolve(token)
                  expect(instance2).toBe(instance)
                }

                // Property: Transient services should return new instances
                if (config.lifecycle === 'transient') {
                  const instance2 = testContainer.resolve(token)
                  expect(instance2).not.toBe(instance)
                  expect(instance2.name).toBe(serviceName)
                }
              }

              // Property: Container stats should reflect registered services
              const stats = testContainer.getStats()
              expect(stats.totalRegistrations).toBe(count)
              // Only singleton and scoped instances are tracked in the container
              const trackedCount = configs.filter(
                c => c.lifecycle === 'singleton' || c.lifecycle === 'scoped'
              ).length
              if (trackedCount > 0) {
                expect(stats.activeInstances).toBeGreaterThanOrEqual(
                  trackedCount
                )
              } else {
                expect(stats.activeInstances).toBeGreaterThanOrEqual(0)
              }
            } finally {
              // Clean up the test container
              await testContainer.dispose()
            }
          }
        ),
        { numRuns: 10 }
      )
    })

    it('should handle service dependencies correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            baseServiceName: generateServiceName(),
            dependentServiceName: generateServiceName(),
            lifecycle: generateServiceLifecycle(),
          }),
          async ({ baseServiceName, dependentServiceName, lifecycle }) => {
            // Ensure service names are different
            if (baseServiceName === dependentServiceName) {
              return // Skip this test case
            }

            // Property: Container should resolve dependencies automatically
            const baseToken = createMockServiceToken(baseServiceName)
            const baseFactory = createMockServiceFactory(baseServiceName)

            const dependentToken = createMockServiceToken(dependentServiceName)
            const dependentFactory = createServiceFactory(
              (container: ServiceContainer) => {
                const baseDependency = container.resolve(baseToken)
                return new MockService(dependentServiceName, [baseDependency])
              },
              async (instance: MockService) => {
                await instance.dispose()
              }
            )

            // Register base service first
            container.register(baseToken, baseFactory, 'singleton')

            // Register dependent service
            container.register(dependentToken, dependentFactory, lifecycle)

            // Property: Dependent service should resolve with its dependencies
            const dependentInstance = container.resolve(dependentToken)
            expect(dependentInstance).toBeInstanceOf(MockService)
            expect(dependentInstance.name).toBe(dependentServiceName)
            expect(dependentInstance.dependencies).toHaveLength(1)
            expect(dependentInstance.dependencies[0]).toBeInstanceOf(
              MockService
            )
            expect(dependentInstance.dependencies[0].name).toBe(baseServiceName)

            // Property: Base service should also be resolvable independently
            const baseInstance = container.resolve(baseToken)
            expect(baseInstance).toBeInstanceOf(MockService)
            expect(baseInstance.name).toBe(baseServiceName)

            // Property: Dependencies should be the same instance for singletons
            expect(dependentInstance.dependencies[0]).toBe(baseInstance)
          }
        ),
        { numRuns: 10 }
      )
    })

    it('should detect circular dependencies', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            service1Name: generateServiceName(),
            service2Name: generateServiceName(),
          }),
          async ({ service1Name, service2Name }) => {
            // Ensure service names are different
            if (service1Name === service2Name) {
              return // Skip this test case
            }

            // Property: Container should detect and prevent circular dependencies
            const token1 = createMockServiceToken(service1Name)
            const token2 = createMockServiceToken(service2Name)

            // Create circular dependency: service1 depends on service2, service2 depends on service1
            const factory1 = createServiceFactory(
              (container: ServiceContainer) => {
                const dependency = container.resolve(token2) // Depends on service2
                return new MockService(service1Name, [dependency])
              }
            )

            const factory2 = createServiceFactory(
              (container: ServiceContainer) => {
                const dependency = container.resolve(token1) // Depends on service1
                return new MockService(service2Name, [dependency])
              }
            )

            // Register both services
            container.register(token1, factory1)
            container.register(token2, factory2)

            // Property: Resolving either service should throw CircularDependencyError
            expect(() => {
              container.resolve(token1)
            }).toThrow(CircularDependencyError)

            expect(() => {
              container.resolve(token2)
            }).toThrow(CircularDependencyError)
          }
        ),
        { numRuns: 10 }
      )
    })

    it('should handle service disposal correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }).chain(count =>
            fc.record({
              count: fc.constant(count),
              configs: fc.array(
                fc.record({
                  lifecycle: generateServiceLifecycle(),
                }),
                { minLength: count, maxLength: count }
              ),
            })
          ),
          async ({ count, configs }) => {
            // Create a fresh container for this property test iteration
            const testContainer = new DefaultServiceContainer()

            try {
              // Property: Container should dispose all services properly
              const tokens: ServiceToken<MockService>[] = []
              const instances: MockService[] = []
              const uniqueNames = generateUniqueServiceNames(count)

              for (let i = 0; i < count; i++) {
                const config = configs[i]
                const serviceName = uniqueNames[i]
                const token = createMockServiceToken(serviceName)
                const factory = createMockServiceFactory(serviceName)

                testContainer.register(token, factory, config.lifecycle)
                tokens.push(token)

                // Resolve to create instances (only for singleton/scoped lifecycle will they be tracked)
                const instance = testContainer.resolve(token)
                instances.push(instance)
                expect(instance.disposed).toBe(false)
              }

              // Property: All instances should be active before disposal
              for (const instance of instances) {
                expect(instance.disposed).toBe(false)
              }

              // Dispose container
              await testContainer.dispose()

              // Property: All tracked instances should be disposed after container disposal
              // Note: Only singleton and scoped instances are tracked in the container
              const trackedInstances = instances.filter(
                (_, i) =>
                  configs[i].lifecycle === 'singleton' ||
                  configs[i].lifecycle === 'scoped'
              )
              for (const instance of trackedInstances) {
                expect(instance.disposed).toBe(true)
              }

              // Property: Container stats should reflect disposal if there were tracked instances
              const stats = testContainer.getStats()
              const trackedCount = configs.filter(
                c => c.lifecycle === 'singleton' || c.lifecycle === 'scoped'
              ).length
              if (trackedCount > 0) {
                expect(stats.disposedInstances).toBeGreaterThan(0)
              } else {
                // No tracked instances means no instances to dispose
                expect(stats.disposedInstances).toBe(0)
              }
            } finally {
              // Container is already disposed in the test
            }
          }
        ),
        { numRuns: 10 }
      )
    })

    it('should throw appropriate errors for invalid operations', async () => {
      await fc.assert(
        fc.asyncProperty(generateServiceName(), async serviceName => {
          const token = createMockServiceToken(serviceName)
          const factory = createMockServiceFactory(serviceName)

          // Property: Resolving unregistered service should throw ServiceNotFoundError
          expect(() => {
            container.resolve(token)
          }).toThrow(ServiceNotFoundError)

          // Register service
          container.register(token, factory)

          // Property: Registering same service twice should throw ServiceContainerError
          expect(() => {
            container.register(token, factory)
          }).toThrow(ServiceContainerError)

          // Property: Service should be resolvable after registration
          const instance = container.resolve(token)
          expect(instance).toBeInstanceOf(MockService)
          expect(instance.name).toBe(serviceName)
        }),
        { numRuns: 10 }
      )
    })

    it('should maintain container statistics correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 8 }).chain(count =>
            fc.record({
              count: fc.constant(count),
              configs: fc.array(
                fc.record({
                  lifecycle: generateServiceLifecycle(),
                }),
                { minLength: count, maxLength: count }
              ),
            })
          ),
          async ({ count, configs }) => {
            // Create a fresh container for this property test iteration
            const testContainer = new DefaultServiceContainer()

            try {
              // Property: Container statistics should accurately reflect container state
              let expectedRegistrations = 0
              const uniqueNames = generateUniqueServiceNames(count)

              for (let i = 0; i < count; i++) {
                const config = configs[i]
                const serviceName = uniqueNames[i]
                const token = createMockServiceToken(serviceName)
                const factory = createMockServiceFactory(serviceName)

                testContainer.register(token, factory, config.lifecycle)
                expectedRegistrations++

                // Check stats after registration
                let stats = testContainer.getStats()
                expect(stats.totalRegistrations).toBe(expectedRegistrations)

                // Resolve service to create instance
                const instance = testContainer.resolve(token)
                expect(instance).toBeInstanceOf(MockService)

                // Check stats after resolution
                stats = testContainer.getStats()
                expect(stats.totalRegistrations).toBe(expectedRegistrations)
              }

              // Property: Final stats should be consistent
              const finalStats = testContainer.getStats()
              expect(finalStats.totalRegistrations).toBe(count)

              // Count tracked instances (singleton and scoped)
              const trackedCount = configs.filter(
                c => c.lifecycle === 'singleton' || c.lifecycle === 'scoped'
              ).length
              if (trackedCount > 0) {
                expect(finalStats.activeInstances).toBeGreaterThanOrEqual(
                  trackedCount
                )
              }
              expect(finalStats.disposedInstances).toBe(0) // No disposal yet

              // Dispose and check final stats
              await testContainer.dispose()
              const disposedStats = testContainer.getStats()
              if (trackedCount > 0) {
                expect(disposedStats.disposedInstances).toBeGreaterThan(0)
              } else {
                // No tracked instances means no instances to dispose
                expect(disposedStats.disposedInstances).toBe(0)
              }
            } finally {
              // Container is already disposed in the test
            }
          }
        ),
        { numRuns: 10 }
      )
    })

    it('should handle complex dependency graphs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            baseService: generateServiceName(),
            middleService: generateServiceName(),
            topService: generateServiceName(),
          }),
          async ({ baseService, middleService, topService }) => {
            // Ensure all service names are different
            const names = [baseService, middleService, topService]
            if (new Set(names).size !== names.length) {
              return // Skip if names are not unique
            }

            // Property: Container should resolve complex dependency chains
            // Create dependency chain: topService -> middleService -> baseService
            const baseToken = createMockServiceToken(baseService)
            const middleToken = createMockServiceToken(middleService)
            const topToken = createMockServiceToken(topService)

            const baseFactory = createMockServiceFactory(baseService)

            const middleFactory = createServiceFactory(
              (container: ServiceContainer) => {
                const baseDep = container.resolve(baseToken)
                return new MockService(middleService, [baseDep])
              },
              async (instance: MockService) => {
                await instance.dispose()
              }
            )

            const topFactory = createServiceFactory(
              (container: ServiceContainer) => {
                const middleDep = container.resolve(middleToken)
                return new MockService(topService, [middleDep])
              },
              async (instance: MockService) => {
                await instance.dispose()
              }
            )

            // Register services in any order
            container.register(topToken, topFactory)
            container.register(baseToken, baseFactory)
            container.register(middleToken, middleFactory)

            // Property: Top service should resolve with complete dependency chain
            const topInstance = container.resolve(topToken)
            expect(topInstance).toBeInstanceOf(MockService)
            expect(topInstance.name).toBe(topService)
            expect(topInstance.dependencies).toHaveLength(1)

            const middleInstance = topInstance.dependencies[0]
            expect(middleInstance).toBeInstanceOf(MockService)
            expect(middleInstance.name).toBe(middleService)
            expect(middleInstance.dependencies).toHaveLength(1)

            const baseInstance = middleInstance.dependencies[0]
            expect(baseInstance).toBeInstanceOf(MockService)
            expect(baseInstance.name).toBe(baseService)
            expect(baseInstance.dependencies).toHaveLength(0)

            // Property: Each service should also be resolvable independently
            const directBaseInstance = container.resolve(baseToken)
            const directMiddleInstance = container.resolve(middleToken)

            expect(directBaseInstance).toBe(baseInstance) // Same singleton instance
            expect(directMiddleInstance).toBe(middleInstance) // Same singleton instance
          }
        ),
        { numRuns: 10 }
      )
    })
  })
})
