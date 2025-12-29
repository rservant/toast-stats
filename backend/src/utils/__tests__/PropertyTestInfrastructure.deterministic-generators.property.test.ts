/**
 * Property-Based Tests for Deterministic Generators
 *
 * **Feature: test-infrastructure-stabilization, Property 6: Property Test Performance and Determinism**
 * **Validates: Requirements 3.1, 3.2**
 *
 * Tests that property-based test generators are deterministic and perform within acceptable limits.
 */

import { describe, it, expect, afterEach } from 'vitest'
import fc from 'fast-check'
import {
  PropertyTestRunner,
  DeterministicGenerators,
  PropertyTestUtils,
} from '../PropertyTestInfrastructure.js'
import { createTestSelfCleanup } from '../test-self-cleanup.js'

describe('PropertyTestInfrastructure - Deterministic Generators Property Tests', () => {
  const { afterEach: cleanupAfterEach } = createTestSelfCleanup()

  afterEach(cleanupAfterEach)

  describe('Property 6: Property Test Performance and Determinism', () => {
    it('should generate deterministic results with same seed', async () => {
      // Feature: test-infrastructure-stabilization, Property 6: Property Test Performance and Determinism
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10000 }), // seed
          fc.integer({ min: 1, max: 20 }), // string length
          fc.integer({ min: 1, max: 10 }), // number of generations
          async (seed, stringLength, generationCount) => {
            // Property: Same seed should produce identical results across multiple runs
            const generator1 = new DeterministicGenerators(seed)
            const generator2 = new DeterministicGenerators(seed)

            const results1: string[] = []
            const results2: string[] = []

            // Generate multiple values with both generators
            for (let i = 0; i < generationCount; i++) {
              const result1 = generator1.deterministicSafeString(
                stringLength,
                stringLength
              )
              const result2 = generator2.deterministicSafeString(
                stringLength,
                stringLength
              )

              results1.push(result1)
              results2.push(result2)
            }

            // Property: Results should be identical for same seed
            expect(results1).toEqual(results2)

            // Property: All generated strings should have correct length
            for (const result of results1) {
              expect(result).toHaveLength(stringLength)
            }

            // Property: All generated strings should be filesystem-safe
            for (const result of results1) {
              expect(result).toMatch(/^[a-zA-Z0-9_-]+$/)
              expect(result).not.toMatch(/^[0-9-]/) // Should not start with number or hyphen
            }
          }
        ),
        PropertyTestUtils.createTestConfig({ iterations: 3, timeout: 5000 })
      )
    })

    it('should complete property tests within performance limits', async () => {
      // Feature: test-infrastructure-stabilization, Property 6: Property Test Performance and Determinism
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 1000 }), // seed
          fc.constantFrom('ci', 'local', 'test'), // environment
          async (seed, environment) => {
            const startTime = Date.now()
            const runner = new PropertyTestRunner(environment)
            const generators = runner.createDeterministicGenerators(seed)

            // Create a simple property test using deterministic values
            const testProperty = fc.asyncProperty(
              fc.constant(generators.deterministicSafeString(1, 10)),
              fc.constant(generators.deterministicInteger(1, 100)),
              async (str, num) => {
                // Simple property: string length should be within bounds
                expect(str.length).toBeGreaterThanOrEqual(1)
                expect(str.length).toBeLessThanOrEqual(10)
                expect(num).toBeGreaterThanOrEqual(1)
                expect(num).toBeLessThanOrEqual(100)
                return true
              }
            )

            // Run the property test
            const result = await runner.runProperty(testProperty, { seed })
            const executionTime = Date.now() - startTime

            // Property: Test should complete within 10 seconds (Requirement 3.1)
            expect(executionTime).toBeLessThan(10000)

            // Property: Test should pass with deterministic seed
            expect(result.passed).toBe(true)
            expect(result.seed).toBe(seed)

            // Property: Execution time should be recorded accurately (allow for very fast tests)
            expect(result.executionTime).toBeGreaterThanOrEqual(0)
            expect(result.executionTime).toBeLessThanOrEqual(executionTime)
          }
        ),
        PropertyTestUtils.createTestConfig({ iterations: 3, timeout: 15000 })
      )
    })

    it('should generate reproducible cache directories', async () => {
      // Feature: test-infrastructure-stabilization, Property 6: Property Test Performance and Determinism
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10000 }), // seed
          fc.integer({ min: 2, max: 5 }), // number of generators
          async (seed, generatorCount) => {
            // Property: Multiple generators with same seed should produce identical cache directories
            const generators: DeterministicGenerators[] = []
            const cacheDirectories: string[][] = []

            // Create multiple generators with same seed
            for (let i = 0; i < generatorCount; i++) {
              generators.push(new DeterministicGenerators(seed))
            }

            // Generate cache directories from each generator
            for (const generator of generators) {
              const directories: string[] = []
              for (let j = 0; j < 3; j++) {
                const directory = generator.deterministicCacheDirectory()
                directories.push(directory)
              }
              cacheDirectories.push(directories)
            }

            // Property: All generators should produce identical results
            for (let i = 1; i < cacheDirectories.length; i++) {
              expect(cacheDirectories[i]).toEqual(cacheDirectories[0])
            }

            // Property: All cache directories should be valid paths
            for (const directories of cacheDirectories) {
              for (const dir of directories) {
                expect(dir).toMatch(
                  /^\.\/test-dir\/test-cache-[a-zA-Z0-9_-]+-\d+$/
                )
                expect(dir).toContain(seed.toString())
              }
            }
          }
        ),
        PropertyTestUtils.createTestConfig({ iterations: 3, timeout: 5000 })
      )
    })

    it('should generate consistent service configurations', async () => {
      // Feature: test-infrastructure-stabilization, Property 6: Property Test Performance and Determinism
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10000 }), // seed
          async seed => {
            // Property: Service configurations should be deterministic and valid
            const generator1 = new DeterministicGenerators(seed)
            const generator2 = new DeterministicGenerators(seed)

            const config1 = generator1.deterministicServiceConfig()
            const config2 = generator2.deterministicServiceConfig()

            // Property: Same seed should produce identical configurations
            expect(config1).toEqual(config2)

            // Property: Configuration should have valid values
            expect(['test', 'development', 'production']).toContain(
              config1.environment
            )
            expect(['debug', 'info', 'warn', 'error']).toContain(
              config1.logLevel
            )
            expect(config1.cacheDirectory).toMatch(
              /^\.\/test-dir\/test-cache-[a-zA-Z0-9_-]+-\d+$/
            )

            // Property: Cache directory should contain the seed
            expect(config1.cacheDirectory).toContain(seed.toString())
          }
        ),
        PropertyTestUtils.createTestConfig({ iterations: 3, timeout: 5000 })
      )
    })

    it('should handle different environment configurations correctly', async () => {
      // Feature: test-infrastructure-stabilization, Property 6: Property Test Performance and Determinism
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('ci', 'local', 'test'), // environment
          fc.integer({ min: 1, max: 1000 }), // seed
          async (environment, seed) => {
            PropertyTestUtils.createEnvironmentConfig()
            const runner = new PropertyTestRunner(environment)

            // Create a simple test property using deterministic values
            const generators = runner.createDeterministicGenerators(seed)
            const testProperty = fc.asyncProperty(
              fc.constant(generators.deterministicBoolean(0.5)),
              async value => {
                expect(typeof value).toBe('boolean')
                return true
              }
            )

            const result = await runner.runProperty(testProperty, { seed })

            // Property: Test should complete successfully
            expect(result.passed).toBe(true)
            expect(result.seed).toBe(seed)
            expect(result.executionTime).toBeGreaterThanOrEqual(0)

            // Property: Environment-specific iteration counts should be respected
            switch (environment) {
              case 'ci':
                expect(result.iterations).toBeLessThanOrEqual(5)
                break
              case 'test':
                expect(result.iterations).toBeLessThanOrEqual(3)
                break
              case 'local':
                expect(result.iterations).toBeLessThanOrEqual(100)
                break
            }

            // Property: Execution time should be reasonable for environment
            const maxTime =
              environment === 'ci'
                ? 10000
                : environment === 'test'
                  ? 5000
                  : 30000
            expect(result.executionTime).toBeLessThan(maxTime)
          }
        ),
        PropertyTestUtils.createTestConfig({ iterations: 3, timeout: 10000 })
      )
    })
  })
})
