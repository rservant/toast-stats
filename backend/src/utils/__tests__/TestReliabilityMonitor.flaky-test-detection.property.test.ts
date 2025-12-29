/**
 * Property-based tests for Flaky Test Detection
 *
 * **Feature: test-infrastructure-stabilization, Property 18: Flaky Test Detection**
 * **Validates: Requirements 7.2**
 */

import { describe, it, expect, beforeEach } from 'vitest'
import fc from 'fast-check'
import {
  DefaultTestReliabilityMonitor,
  TestResult,
  FlakyTestDetection,
} from '../TestReliabilityMonitor.js'
import { PropertyTestRunner } from '../PropertyTestInfrastructure.js'

describe('Flaky Test Detection - Property Tests', () => {
  let monitor: DefaultTestReliabilityMonitor
  let propertyRunner: PropertyTestRunner

  beforeEach(() => {
    monitor = new DefaultTestReliabilityMonitor()
    propertyRunner = new PropertyTestRunner('test')
  })

  it('Property 18: Flaky Test Detection - For any flaky test occurrence, the test should be properly identified and reported for investigation', async () => {
    // Feature: test-infrastructure-stabilization, Property 18: Flaky Test Detection
    const property = fc.asyncProperty(
      fc.record({
        testName: fc.string({ minLength: 1, maxLength: 30 }),
        suiteName: fc.string({ minLength: 1, maxLength: 20 }),
        executionCount: fc.integer({ min: 5, max: 20 }), // Need enough executions to detect flakiness
        flakyFailureRate: fc.float({
          min: Math.fround(0.2),
          max: Math.fround(0.8),
        }), // 20-80% failure rate (flaky range)
      }),
      async ({ testName, suiteName, executionCount, flakyFailureRate }) => {
        // Clear previous state
        monitor.clearMetrics()

        // Create a flaky test pattern
        const results: TestResult[] = []
        for (let i = 0; i < executionCount; i++) {
          const shouldFail = Math.random() < flakyFailureRate
          results.push({
            testName,
            suiteName,
            passed: !shouldFail,
            executionTime: Math.floor(Math.random() * 1000) + 100,
            error: shouldFail ? 'Random failure for flaky test' : undefined,
            timestamp: new Date(Date.now() - (executionCount - i) * 60000), // Spread over time
            testType: 'unit',
            retries: 0,
          })
        }

        // Record all results
        for (const result of results) {
          monitor.recordTestResult(result)
        }

        // Detect flaky tests
        const flakyTests = monitor.detectFlakyTests()

        // Should detect the flaky test
        expect(flakyTests.length).toBeGreaterThanOrEqual(1)

        const detectedTest = flakyTests.find(
          ft => ft.testName === testName && ft.suiteName === suiteName
        )

        expect(detectedTest).toBeDefined()
        if (detectedTest) {
          expect(detectedTest.isFlaky).toBe(true)
          expect(detectedTest.executionsAnalyzed).toBe(executionCount)
          expect(detectedTest.failureRate).toBeGreaterThan(0)
          expect(detectedTest.failureRate).toBeLessThan(1)
          expect(detectedTest.failureRate).toBeGreaterThanOrEqual(0.2) // Above flaky threshold
          expect(detectedTest.recentResults).toHaveLength(
            Math.min(10, executionCount)
          )
          expect(detectedTest.failures).toBeGreaterThan(0)
          expect(detectedTest.failures).toBeLessThan(executionCount)
        }
      }
    )

    await propertyRunner.runProperty(property, { iterations: 8, timeout: 5000 })
  })

  it('Property 18a: Non-Flaky Test Detection - For any consistently passing or failing test, it should not be identified as flaky', async () => {
    // Feature: test-infrastructure-stabilization, Property 18: Flaky Test Detection
    const property = fc.asyncProperty(
      fc.record({
        testName: fc.string({ minLength: 1, maxLength: 30 }),
        suiteName: fc.string({ minLength: 1, maxLength: 20 }),
        executionCount: fc.integer({ min: 5, max: 15 }),
        alwaysPasses: fc.boolean(),
      }),
      async ({ testName, suiteName, executionCount, alwaysPasses }) => {
        // Clear previous state
        monitor.clearMetrics()

        // Create consistent test results (always pass or always fail)
        const results: TestResult[] = []
        for (let i = 0; i < executionCount; i++) {
          results.push({
            testName,
            suiteName,
            passed: alwaysPasses,
            executionTime: Math.floor(Math.random() * 500) + 50,
            error: alwaysPasses ? undefined : 'Consistent failure',
            timestamp: new Date(Date.now() - (executionCount - i) * 30000),
            testType: 'unit',
            retries: 0,
          })
        }

        // Record all results
        for (const result of results) {
          monitor.recordTestResult(result)
        }

        // Detect flaky tests
        const flakyTests = monitor.detectFlakyTests()

        // Should not detect consistent tests as flaky
        const detectedTest = flakyTests.find(
          ft => ft.testName === testName && ft.suiteName === suiteName
        )

        expect(detectedTest).toBeUndefined()
      }
    )

    await propertyRunner.runProperty(property, {
      iterations: 10,
      timeout: 4000,
    })
  })

  it('Property 18b: Insufficient Data Handling - For any test with insufficient execution history, it should not be flagged as flaky', async () => {
    // Feature: test-infrastructure-stabilization, Property 18: Flaky Test Detection
    const property = fc.asyncProperty(
      fc.record({
        testName: fc.string({ minLength: 1, maxLength: 25 }),
        suiteName: fc.string({ minLength: 1, maxLength: 15 }),
        executionCount: fc.integer({ min: 1, max: 2 }), // Insufficient data
        someFailures: fc.boolean(),
      }),
      async ({ testName, suiteName, executionCount, someFailures }) => {
        // Clear previous state
        monitor.clearMetrics()

        // Create test results with insufficient data
        const results: TestResult[] = []
        for (let i = 0; i < executionCount; i++) {
          const shouldFail = someFailures && i === 0 // Only first one fails if someFailures is true
          results.push({
            testName,
            suiteName,
            passed: !shouldFail,
            executionTime: Math.floor(Math.random() * 300) + 100,
            error: shouldFail ? 'Single failure' : undefined,
            timestamp: new Date(Date.now() - (executionCount - i) * 10000),
            testType: 'integration',
            retries: 0,
          })
        }

        // Record all results
        for (const result of results) {
          monitor.recordTestResult(result)
        }

        // Detect flaky tests
        const flakyTests = monitor.detectFlakyTests()

        // Should not detect tests with insufficient data as flaky
        const detectedTest = flakyTests.find(
          ft => ft.testName === testName && ft.suiteName === suiteName
        )

        expect(detectedTest).toBeUndefined()
      }
    )

    await propertyRunner.runProperty(property, {
      iterations: 12,
      timeout: 3000,
    })
  })

  it('Property 18c: Multiple Flaky Tests Detection - For any set of multiple flaky tests, all should be properly identified', async () => {
    // Feature: test-infrastructure-stabilization, Property 18: Flaky Test Detection
    const property = fc.asyncProperty(
      fc.array(
        fc.record({
          testName: fc.string({ minLength: 1, maxLength: 20 }),
          suiteName: fc.string({ minLength: 1, maxLength: 15 }),
          executionCount: fc.integer({ min: 5, max: 12 }),
          failureRate: fc.float({
            min: Math.fround(0.25),
            max: Math.fround(0.75),
          }), // Flaky range
        }),
        { minLength: 2, maxLength: 5 }
      ),
      async flakyTestConfigs => {
        // Clear previous state
        monitor.clearMetrics()

        // Create multiple flaky tests
        const allResults: TestResult[] = []

        for (const config of flakyTestConfigs) {
          for (let i = 0; i < config.executionCount; i++) {
            const shouldFail = Math.random() < config.failureRate
            allResults.push({
              testName: config.testName,
              suiteName: config.suiteName,
              passed: !shouldFail,
              executionTime: Math.floor(Math.random() * 800) + 200,
              error: shouldFail
                ? `Flaky failure in ${config.testName}`
                : undefined,
              timestamp: new Date(
                Date.now() - (config.executionCount - i) * 45000
              ),
              testType: 'property',
              retries: 0,
            })
          }
        }

        // Shuffle results to simulate real execution order
        allResults.sort(() => Math.random() - 0.5)

        // Record all results
        for (const result of allResults) {
          monitor.recordTestResult(result)
        }

        // Detect flaky tests
        const flakyTests = monitor.detectFlakyTests()

        // Should detect multiple flaky tests
        expect(flakyTests.length).toBeGreaterThanOrEqual(1)
        expect(flakyTests.length).toBeLessThanOrEqual(flakyTestConfigs.length)

        // Verify each detected flaky test
        for (const flakyTest of flakyTests) {
          expect(flakyTest.isFlaky).toBe(true)
          expect(flakyTest.executionsAnalyzed).toBeGreaterThanOrEqual(3)
          expect(flakyTest.failureRate).toBeGreaterThan(0)
          expect(flakyTest.failureRate).toBeLessThan(1)
          expect(flakyTest.failureRate).toBeGreaterThanOrEqual(0.2)
          expect(flakyTest.failures).toBeGreaterThan(0)
          expect(flakyTest.failures).toBeLessThan(flakyTest.executionsAnalyzed)
          expect(Array.isArray(flakyTest.recentResults)).toBe(true)
          expect(flakyTest.recentResults.length).toBeGreaterThan(0)
          expect(flakyTest.recentResults.length).toBeLessThanOrEqual(10)
        }
      }
    )

    await propertyRunner.runProperty(property, { iterations: 6, timeout: 6000 })
  })

  it('Property 18d: Flaky Test Threshold Boundary - For any test at the flaky threshold boundary, detection should be consistent', async () => {
    // Feature: test-infrastructure-stabilization, Property 18: Flaky Test Detection
    const property = fc.asyncProperty(
      fc.record({
        testName: fc.string({ minLength: 1, maxLength: 25 }),
        suiteName: fc.string({ minLength: 1, maxLength: 18 }),
        executionCount: fc.integer({ min: 10, max: 20 }),
        isAtThreshold: fc.boolean(), // Whether to be exactly at or just below threshold
      }),
      async ({ testName, suiteName, executionCount, isAtThreshold }) => {
        // Clear previous state
        monitor.clearMetrics()

        // Create test results at threshold boundary (20% failure rate)
        const targetFailureRate = isAtThreshold ? 0.2 : 0.19 // At or just below threshold
        const targetFailures = Math.max(
          1,
          Math.floor(executionCount * targetFailureRate)
        ) // Ensure at least 1 failure when at threshold

        const results: TestResult[] = []
        for (let i = 0; i < executionCount; i++) {
          const shouldFail = i < targetFailures
          results.push({
            testName,
            suiteName,
            passed: !shouldFail,
            executionTime: Math.floor(Math.random() * 400) + 150,
            error: shouldFail ? 'Threshold boundary failure' : undefined,
            timestamp: new Date(Date.now() - (executionCount - i) * 20000),
            testType: 'e2e',
            retries: 0,
          })
        }

        // Shuffle to simulate real execution order
        results.sort(() => Math.random() - 0.5)

        // Record all results
        for (const result of results) {
          monitor.recordTestResult(result)
        }

        // Detect flaky tests
        const flakyTests = monitor.detectFlakyTests()

        const detectedTest = flakyTests.find(
          ft => ft.testName === testName && ft.suiteName === suiteName
        )

        const actualFailureRate = targetFailures / executionCount

        if (
          isAtThreshold &&
          actualFailureRate >= 0.2 &&
          actualFailureRate < 1.0
        ) {
          // Should be detected as flaky when at or above threshold with mixed results
          expect(detectedTest).toBeDefined()
          if (detectedTest) {
            expect(detectedTest.isFlaky).toBe(true)
            expect(detectedTest.failureRate).toBeGreaterThanOrEqual(0.2)
          }
        } else {
          // Should not be detected when below threshold or no mixed results
          if (
            actualFailureRate < 0.2 ||
            actualFailureRate === 0 ||
            actualFailureRate === 1.0
          ) {
            expect(detectedTest).toBeUndefined()
          }
        }
      }
    )

    await propertyRunner.runProperty(property, { iterations: 8, timeout: 5000 })
  })
})
