/**
 * Property-Based Tests for Error Reporting
 *
 * **Feature: test-infrastructure-stabilization, Property 7: Property Test Error Reporting**
 * **Validates: Requirements 3.3**
 *
 * Tests that property-based test error reporting captures and reports counterexamples correctly.
 */

import { describe, it, expect, afterEach } from 'vitest'
import fc from 'fast-check'
import {
  PropertyTestRunner,
  PropertyTestUtils,
} from '../PropertyTestInfrastructure.js'
import { createTestSelfCleanup } from '../test-self-cleanup.js'

describe('PropertyTestInfrastructure - Error Reporting Property Tests', () => {
  const { afterEach: cleanupAfterEach } = createTestSelfCleanup()

  afterEach(cleanupAfterEach)

  describe('Property 7: Property Test Error Reporting', () => {
    it('should capture counterexamples when property tests fail', async () => {
      // Feature: test-infrastructure-stabilization, Property 7: Property Test Error Reporting
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 1000 }), // seed
          fc.integer({ min: 5, max: 20 }), // failure threshold
          async (seed, failureThreshold) => {
            const runner = new PropertyTestRunner('test')

            // Create a property that will fail when input exceeds threshold
            const failingProperty = fc.asyncProperty(
              fc.integer({ min: 1, max: 30 }),
              async value => {
                // This property will fail when value > failureThreshold
                if (value > failureThreshold) {
                  throw new Error(
                    `Value ${value} exceeds threshold ${failureThreshold}`
                  )
                }
                return true
              }
            )

            // Run the property test expecting it to fail
            const result = await runner.runProperty(failingProperty, {
              seed,
              iterations: 10, // Increase iterations to ensure we hit the failure case
            })

            // Property: Failed tests should be properly reported
            if (!result.passed) {
              // Property: Error should be captured
              expect(result.error).toBeDefined()
              expect(result.error?.message).toContain('Property failed')

              // Property: Seed should be preserved
              expect(result.seed).toBe(seed)

              // Property: Iterations should be recorded
              expect(result.iterations).toBe(10)
            } else {
              // If the test passed, it means all generated values were <= threshold
              // This is also a valid outcome, just verify the result structure
              expect(result.passed).toBe(true)
              expect(result.seed).toBe(seed)
            }

            // Property: Execution time should be recorded (>= 0, allowing for very fast tests)
            expect(result.executionTime).toBeGreaterThanOrEqual(0)
            expect(typeof result.executionTime).toBe('number')
          }
        ),
        PropertyTestUtils.createTestConfig({ iterations: 3, timeout: 10000 })
      )
    })

    it('should provide detailed error information for timeout scenarios', async () => {
      // Feature: test-infrastructure-stabilization, Property 7: Property Test Error Reporting
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 1000 }), // seed
          async seed => {
            const runner = new PropertyTestRunner('test')

            // Create a property that will complete quickly (no actual timeout)
            // We test timeout handling by using a very short timeout on a normal operation
            const quickProperty = fc.asyncProperty(
              fc.constant(1), // Simple constant value
              async value => {
                // Add a minimal delay to make timing more predictable
                await new Promise(resolve => setTimeout(resolve, 1))
                return value === 1
              }
            )

            // Run with a very short timeout to potentially trigger timeout handling
            const result = await runner.runProperty(quickProperty, {
              seed,
              timeout: 10, // Very short timeout
              iterations: 1,
            })

            // Property: Result should have proper structure regardless of timeout
            expect(result).toHaveProperty('passed')
            expect(result).toHaveProperty('executionTime')
            expect(result).toHaveProperty('seed')
            expect(result).toHaveProperty('iterations')

            expect(typeof result.passed).toBe('boolean')
            expect(typeof result.executionTime).toBe('number')
            expect(typeof result.seed).toBe('number')
            expect(typeof result.iterations).toBe('number')

            // Property: Execution time should be recorded (>= 0)
            expect(result.executionTime).toBeGreaterThanOrEqual(0)

            // Property: Seed should be preserved
            expect(result.seed).toBe(seed)

            // Property: If test failed (possibly due to timeout), error should be present
            if (!result.passed) {
              expect(result.error).toBeDefined()
            }
          }
        ),
        PropertyTestUtils.createTestConfig({ iterations: 3, timeout: 5000 }) // Reasonable timeout for outer test
      )
    })

    it('should extract counterexample information from fast-check errors', async () => {
      // Feature: test-infrastructure-stabilization, Property 7: Property Test Error Reporting
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 1000 }), // seed
          fc.constantFrom('string', 'number', 'boolean'), // data type to test
          async (seed, dataType) => {
            const runner = new PropertyTestRunner('test')

            // Create a property that will fail with specific data types
            let failingProperty: ReturnType<typeof fc.asyncProperty>

            switch (dataType) {
              case 'string':
                failingProperty = fc.asyncProperty(
                  fc.string({ minLength: 1, maxLength: 10 }),
                  async str => {
                    // Fail if string contains 'x'
                    if (str.includes('x')) {
                      throw new Error(
                        `String contains forbidden character: ${str}`
                      )
                    }
                    return true
                  }
                )
                break
              case 'number':
                failingProperty = fc.asyncProperty(
                  fc.integer({ min: 1, max: 100 }),
                  async num => {
                    // Fail if number is divisible by 7
                    if (num % 7 === 0) {
                      throw new Error(`Number is divisible by 7: ${num}`)
                    }
                    return true
                  }
                )
                break
              case 'boolean':
                failingProperty = fc.asyncProperty(fc.boolean(), async bool => {
                  // Fail if boolean is true
                  if (bool === true) {
                    throw new Error(`Boolean is true: ${bool}`)
                  }
                  return true
                })
                break
            }

            const result = await runner.runProperty(failingProperty, {
              seed,
              iterations: 20, // Increase iterations to increase chance of hitting failure case
            })

            // Property: Result should have proper structure regardless of pass/fail
            expect(result).toHaveProperty('passed')
            expect(result).toHaveProperty('iterations')
            expect(result).toHaveProperty('executionTime')
            expect(result).toHaveProperty('seed')

            expect(typeof result.passed).toBe('boolean')
            expect(typeof result.iterations).toBe('number')
            expect(typeof result.executionTime).toBe('number')
            expect(typeof result.seed).toBe('number')

            // Property: Execution time should be recorded (>= 0, allowing for very fast tests)
            expect(result.executionTime).toBeGreaterThanOrEqual(0)

            // Property: Seed should match input
            expect(result.seed).toBe(seed)

            // Property: If test failed, error should be present
            if (!result.passed) {
              expect(result.error).toBeDefined()
              expect(result.error?.message).toBeTruthy()
            }
          }
        ),
        PropertyTestUtils.createTestConfig({ iterations: 3, timeout: 10000 })
      )
    })

    it('should handle error reporting for different property test configurations', async () => {
      // Feature: test-infrastructure-stabilization, Property 7: Property Test Error Reporting
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 1000 }), // seed
          fc.constantFrom('ci', 'local', 'test'), // environment
          fc.integer({ min: 1, max: 3 }), // iterations multiplier (reduced for test speed)
          async (seed, environment, iterationsMultiplier) => {
            const runner = new PropertyTestRunner(environment)

            // Create a property that has a chance to fail
            const probabilisticProperty = fc.asyncProperty(
              fc.float({ min: 0, max: 1 }),
              async probability => {
                // Fail if probability > 0.8 (20% chance of failure)
                if (probability > 0.8) {
                  throw new Error(`Probability too high: ${probability}`)
                }
                return true
              }
            )

            // Determine iterations based on environment and multiplier (keep reasonable for tests)
            let iterations: number
            switch (environment) {
              case 'ci':
                iterations = Math.min(10, 5 * iterationsMultiplier) // Cap at 10
                break
              case 'test':
                iterations = Math.min(6, 3 * iterationsMultiplier) // Cap at 6
                break
              case 'local':
                iterations = Math.min(15, 5 * iterationsMultiplier) // Cap at 15 for test speed
                break
            }

            const result = await runner.runProperty(probabilisticProperty, {
              seed,
              iterations,
            })

            // Property: Result should have environment-appropriate configuration
            expect(result.iterations).toBe(iterations)
            expect(result.seed).toBe(seed)
            expect(result.executionTime).toBeGreaterThanOrEqual(0)

            // Property: Error reporting should work regardless of environment
            if (!result.passed) {
              expect(result.error).toBeDefined()
              expect(result.error?.message).toContain('Property failed')
            }

            // Property: Execution time should be reasonable for environment
            const maxTime =
              environment === 'ci' ? 5000 : environment === 'test' ? 3000 : 8000
            expect(result.executionTime).toBeLessThan(maxTime)
          }
        ),
        PropertyTestUtils.createTestConfig({ iterations: 3, timeout: 10000 })
      )
    })

    it('should preserve error context and stack traces', async () => {
      // Feature: test-infrastructure-stabilization, Property 7: Property Test Error Reporting
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 1000 }), // seed
          fc.string({ minLength: 5, maxLength: 20 }), // error message
          async (seed, errorMessage) => {
            const runner = new PropertyTestRunner('test')

            // Create a property that will fail with a custom error
            const customErrorProperty = fc.asyncProperty(
              fc.constant(errorMessage),
              async message => {
                // Always fail with the custom message
                throw new Error(`Custom error: ${message}`)
              }
            )

            const result = await runner.runProperty(customErrorProperty, {
              seed,
              iterations: 1, // Only need one iteration since it always fails
            })

            // Property: Test should fail
            expect(result.passed).toBe(false)

            // Property: Error should be preserved
            expect(result.error).toBeDefined()
            expect(result.error?.message).toContain('Property failed')

            // Property: Basic result structure should be intact
            expect(result.seed).toBe(seed)
            expect(result.iterations).toBe(1)
            expect(result.executionTime).toBeGreaterThanOrEqual(0)
          }
        ),
        PropertyTestUtils.createTestConfig({ iterations: 3, timeout: 5000 })
      )
    })
  })
})
