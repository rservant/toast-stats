/**
 * Property-based tests for Test Reliability Metrics
 *
 * **Feature: test-infrastructure-stabilization, Property 17: Test Reliability Metrics**
 * **Validates: Requirements 7.1**
 */

import { describe, it, expect, beforeEach } from 'vitest'
import fc from 'fast-check'
import {
  DefaultTestReliabilityMonitor,
  TestResult,
  TestReliabilityMetrics,
  FailureCategory,
} from '../TestReliabilityMonitor.js'
import {
  PropertyTestRunner,
  DeterministicGenerators,
} from '../PropertyTestInfrastructure.js'

describe('Test Reliability Metrics - Property Tests', () => {
  let monitor: DefaultTestReliabilityMonitor
  let propertyRunner: PropertyTestRunner

  beforeEach(() => {
    monitor = new DefaultTestReliabilityMonitor()
    propertyRunner = new PropertyTestRunner('test')
  })

  it('Property 17: Test Reliability Metrics - For any test execution, reliability metrics and failure patterns should be tracked correctly', async () => {
    // Feature: test-infrastructure-stabilization, Property 17: Test Reliability Metrics
    const property = fc.asyncProperty(
      fc.array(
        fc.record({
          testName: fc.string({ minLength: 1, maxLength: 50 }),
          suiteName: fc.string({ minLength: 1, maxLength: 30 }),
          passed: fc.boolean(),
          executionTime: fc.integer({ min: 1, max: 10000 }),
          error: fc.option(fc.string({ minLength: 1, maxLength: 100 })),
          testType: fc.constantFrom('unit', 'integration', 'property', 'e2e'),
          retries: fc.integer({ min: 0, max: 3 }),
        }),
        { minLength: 1, maxLength: 50 }
      ),
      async testResults => {
        // Clear previous state
        monitor.clearMetrics()

        // Record all test results
        for (const testData of testResults) {
          const result: TestResult = {
            ...testData,
            timestamp: new Date(),
            error: testData.error || undefined,
          }
          monitor.recordTestResult(result)
        }

        // Get reliability metrics
        const metrics = monitor.getReliabilityMetrics()

        // Verify metrics are correctly calculated
        expect(metrics.totalExecutions).toBe(testResults.length)

        const expectedPassed = testResults.filter(r => r.passed).length
        expect(metrics.passedTests).toBe(expectedPassed)

        const expectedFailed = testResults.length - expectedPassed
        expect(metrics.failedTests).toBe(expectedFailed)

        const expectedPassRate =
          testResults.length > 0
            ? (expectedPassed / testResults.length) * 100
            : 0
        expect(metrics.passRate).toBeCloseTo(expectedPassRate, 2)

        const totalTime = testResults.reduce(
          (sum, r) => sum + r.executionTime,
          0
        )
        const expectedAverage =
          testResults.length > 0 ? totalTime / testResults.length : 0
        expect(metrics.averageExecutionTime).toBeCloseTo(expectedAverage, 2)

        // Verify metrics are non-negative
        expect(metrics.totalExecutions).toBeGreaterThanOrEqual(0)
        expect(metrics.passedTests).toBeGreaterThanOrEqual(0)
        expect(metrics.failedTests).toBeGreaterThanOrEqual(0)
        expect(metrics.passRate).toBeGreaterThanOrEqual(0)
        expect(metrics.passRate).toBeLessThanOrEqual(100)
        expect(metrics.averageExecutionTime).toBeGreaterThanOrEqual(0)
        expect(metrics.flakyTestCount).toBeGreaterThanOrEqual(0)
        expect(metrics.performanceAlerts).toBeGreaterThanOrEqual(0)

        // Verify failure categories are properly tracked
        expect(typeof metrics.failureCategories).toBe('object')
        for (const [category, count] of Object.entries(
          metrics.failureCategories
        )) {
          expect(count).toBeGreaterThanOrEqual(0)
          expect([
            'timeout',
            'assertion',
            'setup',
            'teardown',
            'dependency',
            'resource',
            'network',
            'unknown',
          ]).toContain(category)
        }
      }
    )

    await propertyRunner.runProperty(property, {
      iterations: 10,
      timeout: 5000,
    })
  })

  it('Property 17a: Failure Categorization - For any test failure, the failure should be categorized by root cause correctly', async () => {
    // Feature: test-infrastructure-stabilization, Property 17: Test Reliability Metrics
    const property = fc.asyncProperty(
      fc.record({
        timeoutError: fc.constant('Test timed out after 5000ms'),
        assertionError: fc.constant('Expected 5 to equal 10'),
        setupError: fc.constant('Error in beforeEach hook'),
        teardownError: fc.constant('Error in afterEach cleanup'),
        dependencyError: fc.constant('Cannot import module'),
        resourceError: fc.constant('File not found'),
        networkError: fc.constant('Network connection failed'),
        unknownError: fc.constant('Something went wrong'),
      }),
      async errorMessages => {
        // Test each error type
        expect(monitor.categorizeFailure(errorMessages.timeoutError)).toBe(
          'timeout'
        )
        expect(monitor.categorizeFailure(errorMessages.assertionError)).toBe(
          'assertion'
        )
        expect(monitor.categorizeFailure(errorMessages.setupError)).toBe(
          'setup'
        )
        expect(monitor.categorizeFailure(errorMessages.teardownError)).toBe(
          'teardown'
        )
        expect(monitor.categorizeFailure(errorMessages.dependencyError)).toBe(
          'dependency'
        )
        expect(monitor.categorizeFailure(errorMessages.resourceError)).toBe(
          'resource'
        )
        expect(monitor.categorizeFailure(errorMessages.networkError)).toBe(
          'network'
        )
        expect(monitor.categorizeFailure(errorMessages.unknownError)).toBe(
          'unknown'
        )
      }
    )

    await propertyRunner.runProperty(property, { iterations: 5, timeout: 3000 })
  })

  it('Property 17b: Metrics Consistency - For any sequence of test results, metrics should remain consistent across multiple calculations', async () => {
    // Feature: test-infrastructure-stabilization, Property 17: Test Reliability Metrics
    const property = fc.asyncProperty(
      fc.array(
        fc.record({
          testName: fc.string({ minLength: 1, maxLength: 20 }),
          suiteName: fc.string({ minLength: 1, maxLength: 15 }),
          passed: fc.boolean(),
          executionTime: fc.integer({ min: 1, max: 1000 }),
          error: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
          testType: fc.constantFrom('unit', 'integration', 'property', 'e2e'),
          retries: fc.integer({ min: 0, max: 2 }),
        }),
        { minLength: 5, maxLength: 20 }
      ),
      async testResults => {
        // Clear previous state
        monitor.clearMetrics()

        // Record all test results
        for (const testData of testResults) {
          const result: TestResult = {
            ...testData,
            timestamp: new Date(),
            error: testData.error || undefined,
          }
          monitor.recordTestResult(result)
        }

        // Get metrics multiple times
        const metrics1 = monitor.getReliabilityMetrics()
        const metrics2 = monitor.getReliabilityMetrics()
        const metrics3 = monitor.getReliabilityMetrics()

        // Verify consistency
        expect(metrics1.totalExecutions).toBe(metrics2.totalExecutions)
        expect(metrics2.totalExecutions).toBe(metrics3.totalExecutions)

        expect(metrics1.passedTests).toBe(metrics2.passedTests)
        expect(metrics2.passedTests).toBe(metrics3.passedTests)

        expect(metrics1.failedTests).toBe(metrics2.failedTests)
        expect(metrics2.failedTests).toBe(metrics3.failedTests)

        expect(metrics1.passRate).toBeCloseTo(metrics2.passRate, 5)
        expect(metrics2.passRate).toBeCloseTo(metrics3.passRate, 5)

        expect(metrics1.averageExecutionTime).toBeCloseTo(
          metrics2.averageExecutionTime,
          5
        )
        expect(metrics2.averageExecutionTime).toBeCloseTo(
          metrics3.averageExecutionTime,
          5
        )
      }
    )

    await propertyRunner.runProperty(property, { iterations: 8, timeout: 4000 })
  })

  it('Property 17c: Metrics Bounds - For any test results, all metrics should be within valid bounds', async () => {
    // Feature: test-infrastructure-stabilization, Property 17: Test Reliability Metrics
    const property = fc.asyncProperty(
      fc.array(
        fc.record({
          testName: fc.string({ minLength: 1, maxLength: 30 }),
          suiteName: fc.string({ minLength: 1, maxLength: 20 }),
          passed: fc.boolean(),
          executionTime: fc.integer({ min: 1, max: 5000 }),
          error: fc.option(fc.string({ minLength: 1, maxLength: 80 })),
          testType: fc.constantFrom('unit', 'integration', 'property', 'e2e'),
          retries: fc.integer({ min: 0, max: 5 }),
        }),
        { minLength: 0, maxLength: 100 }
      ),
      async testResults => {
        // Clear previous state
        monitor.clearMetrics()

        // Record all test results
        for (const testData of testResults) {
          const result: TestResult = {
            ...testData,
            timestamp: new Date(),
            error: testData.error || undefined,
          }
          monitor.recordTestResult(result)
        }

        // Get reliability metrics
        const metrics = monitor.getReliabilityMetrics()

        // Verify all metrics are within valid bounds
        expect(metrics.totalExecutions).toBeGreaterThanOrEqual(0)
        expect(metrics.passedTests).toBeGreaterThanOrEqual(0)
        expect(metrics.failedTests).toBeGreaterThanOrEqual(0)
        expect(metrics.passRate).toBeGreaterThanOrEqual(0)
        expect(metrics.passRate).toBeLessThanOrEqual(100)
        expect(metrics.averageExecutionTime).toBeGreaterThanOrEqual(0)
        expect(metrics.flakyTestCount).toBeGreaterThanOrEqual(0)
        expect(metrics.performanceAlerts).toBeGreaterThanOrEqual(0)

        // Verify relationships between metrics
        expect(metrics.passedTests + metrics.failedTests).toBe(
          metrics.totalExecutions
        )

        if (metrics.totalExecutions > 0) {
          expect(metrics.passRate).toBeCloseTo(
            (metrics.passedTests / metrics.totalExecutions) * 100,
            2
          )
        } else {
          expect(metrics.passRate).toBe(0)
        }

        // Verify failure categories
        const totalCategorizedFailures = Object.values(
          metrics.failureCategories
        ).reduce((sum, count) => sum + count, 0)
        expect(totalCategorizedFailures).toBeLessThanOrEqual(
          metrics.failedTests
        )
      }
    )

    await propertyRunner.runProperty(property, {
      iterations: 12,
      timeout: 6000,
    })
  })
})
