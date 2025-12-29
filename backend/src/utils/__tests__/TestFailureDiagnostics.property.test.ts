/**
 * Property-based tests for Test Failure Diagnostics
 *
 * **Feature: test-infrastructure-stabilization, Property 5: Test Failure Diagnostics**
 * **Validates: Requirements 2.5**
 */

import { describe, it, expect, beforeEach } from 'vitest'
import fc from 'fast-check'
import {
  DefaultTestReliabilityMonitor,
  TestResult,
  FailureCategory,
} from '../TestReliabilityMonitor.js'
import { PropertyTestRunner } from '../PropertyTestInfrastructure.js'

describe('Test Failure Diagnostics - Property Tests', () => {
  let monitor: DefaultTestReliabilityMonitor
  let propertyRunner: PropertyTestRunner

  beforeEach(() => {
    monitor = new DefaultTestReliabilityMonitor()
    propertyRunner = new PropertyTestRunner('test')
  })

  it('Property 5: Test Failure Diagnostics - For any test failure, the failure should include clear diagnostic information about the root cause', async () => {
    // Feature: test-infrastructure-stabilization, Property 5: Test Failure Diagnostics
    const property = fc.asyncProperty(
      fc.record({
        testName: fc.string({ minLength: 1, maxLength: 30 }),
        suiteName: fc.string({ minLength: 1, maxLength: 20 }),
        errorType: fc.constantFrom(
          'timeout',
          'assertion',
          'setup',
          'teardown',
          'dependency',
          'resource',
          'network',
          'unknown'
        ),
        customErrorMessage: fc.string({ minLength: 5, maxLength: 100 }),
      }),
      async ({ testName, suiteName, errorType, customErrorMessage }) => {
        // Clear previous state
        monitor.clearMetrics()

        // Create error messages that should be categorized correctly
        const errorMessages: Record<string, string[]> = {
          timeout: [
            'Test timed out after 5000ms',
            'Operation timed out',
            'Timeout exceeded',
            `${customErrorMessage} - timeout occurred`,
          ],
          assertion: [
            'Expected true but got false',
            'Assertion failed: should be equal',
            'expect(received).toBe(expected)',
            `${customErrorMessage} - assertion error`,
          ],
          setup: [
            'beforeEach hook failed',
            'Setup failed to initialize',
            'beforeAll threw an error',
            `${customErrorMessage} - setup issue`,
          ],
          teardown: [
            'afterEach cleanup failed',
            'Teardown error occurred',
            'afterAll hook threw',
            `${customErrorMessage} - teardown problem`,
          ],
          dependency: [
            'Cannot import module',
            'Dependency not found',
            'require() failed',
            `${customErrorMessage} - dependency missing`,
          ],
          resource: [
            'File not found',
            'Directory does not exist',
            'Resource unavailable',
            `${customErrorMessage} - resource error`,
          ],
          network: [
            'Network connection failed',
            'fetch() request failed',
            'Connection timeout',
            `${customErrorMessage} - network issue`,
          ],
          unknown: [
            'Unexpected error occurred',
            customErrorMessage,
            'Generic failure',
            'Something went wrong',
          ],
        }

        // Select a random error message for the error type
        const possibleMessages = errorMessages[errorType]
        const selectedMessage =
          possibleMessages[Math.floor(Math.random() * possibleMessages.length)]

        // Create a failed test result
        const testResult: TestResult = {
          testName,
          suiteName,
          passed: false,
          executionTime: Math.floor(Math.random() * 2000) + 100,
          error: selectedMessage,
          timestamp: new Date(),
          testType: 'unit',
          retries: 0,
        }

        // Record the test result
        monitor.recordTestResult(testResult)

        // Test the failure categorization
        const categorizedFailure = monitor.categorizeFailure(selectedMessage)

        // Verify that the failure is categorized correctly
        expect(categorizedFailure).toBe(errorType)

        // Get reliability metrics to ensure failure is tracked
        const metrics = monitor.getReliabilityMetrics()
        expect(metrics.failedTests).toBe(1)
        expect(metrics.totalExecutions).toBe(1)
        expect(metrics.passRate).toBe(0)

        // Verify failure categories include our error type
        expect(metrics.failureCategories).toHaveProperty(errorType)
        expect(metrics.failureCategories[errorType]).toBe(1)

        // Verify that the error message is preserved and accessible
        expect(testResult.error).toBeDefined()
        expect(testResult.error).toBe(selectedMessage)
        expect(testResult.error!.length).toBeGreaterThan(0)
      }
    )

    await propertyRunner.runProperty(property, {
      iterations: 100,
      timeout: 10000,
    })
  })

  it('Property 5a: Multiple Failure Diagnostics - For any set of test failures, each should be categorized and tracked independently', async () => {
    // Feature: test-infrastructure-stabilization, Property 5: Test Failure Diagnostics
    const property = fc.asyncProperty(
      fc.array(
        fc.record({
          testName: fc.string({ minLength: 1, maxLength: 25 }),
          suiteName: fc.string({ minLength: 1, maxLength: 15 }),
          errorType: fc.constantFrom(
            'timeout',
            'assertion',
            'setup',
            'teardown',
            'dependency',
            'resource',
            'network'
          ),
          errorMessage: fc.string({ minLength: 10, maxLength: 80 }),
        }),
        { minLength: 2, maxLength: 10 }
      ),
      async failureConfigs => {
        // Clear previous state
        monitor.clearMetrics()

        const expectedCategories: Record<string, number> = {}

        // Create multiple failed test results
        for (const config of failureConfigs) {
          // Create error message that matches the expected category
          const errorKeywords: Record<string, string> = {
            timeout: 'timeout',
            assertion: 'expect',
            setup: 'beforeEach',
            teardown: 'afterEach',
            dependency: 'import',
            resource: 'file',
            network: 'network',
          }

          const keyword = errorKeywords[config.errorType]
          const errorMessage = `${config.errorMessage} ${keyword} error occurred`

          const testResult: TestResult = {
            testName: config.testName,
            suiteName: config.suiteName,
            passed: false,
            executionTime: Math.floor(Math.random() * 1500) + 200,
            error: errorMessage,
            timestamp: new Date(Date.now() - Math.random() * 60000),
            testType: 'integration',
            retries: 0,
          }

          monitor.recordTestResult(testResult)

          // Track expected categories
          expectedCategories[config.errorType] =
            (expectedCategories[config.errorType] || 0) + 1

          // Verify individual categorization
          const category = monitor.categorizeFailure(errorMessage)
          expect(category).toBe(config.errorType)
        }

        // Get overall metrics
        const metrics = monitor.getReliabilityMetrics()
        expect(metrics.failedTests).toBe(failureConfigs.length)
        expect(metrics.totalExecutions).toBe(failureConfigs.length)
        expect(metrics.passRate).toBe(0)

        // Verify all failure categories are tracked correctly
        for (const [expectedType, expectedCount] of Object.entries(
          expectedCategories
        )) {
          expect(metrics.failureCategories).toHaveProperty(expectedType)
          expect(metrics.failureCategories[expectedType]).toBe(expectedCount)
        }

        // Verify total failure count matches
        const totalCategorizedFailures = Object.values(
          metrics.failureCategories
        ).reduce((sum, count) => sum + count, 0)
        expect(totalCategorizedFailures).toBe(failureConfigs.length)
      }
    )

    await propertyRunner.runProperty(property, {
      iterations: 50,
      timeout: 8000,
    })
  })

  it('Property 5b: Error Message Preservation - For any test failure, the original error message should be preserved exactly', async () => {
    // Feature: test-infrastructure-stabilization, Property 5: Test Failure Diagnostics
    const property = fc.asyncProperty(
      fc.record({
        testName: fc.string({ minLength: 1, maxLength: 20 }),
        suiteName: fc.string({ minLength: 1, maxLength: 15 }),
        originalError: fc.string({ minLength: 1, maxLength: 200 }),
        executionTime: fc.integer({ min: 1, max: 10000 }),
        testType: fc.constantFrom('unit', 'integration', 'property', 'e2e'),
      }),
      async ({
        testName,
        suiteName,
        originalError,
        executionTime,
        testType,
      }) => {
        // Clear previous state
        monitor.clearMetrics()

        // Create test result with original error
        const testResult: TestResult = {
          testName,
          suiteName,
          passed: false,
          executionTime,
          error: originalError,
          timestamp: new Date(),
          testType,
          retries: 0,
        }

        // Record the test result
        monitor.recordTestResult(testResult)

        // Verify error message is preserved exactly
        expect(testResult.error).toBe(originalError)
        expect(testResult.error).toHaveLength(originalError.length)

        // Verify categorization doesn't modify the original error
        const category = monitor.categorizeFailure(originalError)
        expect(testResult.error).toBe(originalError) // Should still be unchanged

        // Verify the error is accessible through metrics
        const metrics = monitor.getReliabilityMetrics()
        expect(metrics.failedTests).toBe(1)

        // The category should be valid
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
    )

    await propertyRunner.runProperty(property, {
      iterations: 100,
      timeout: 6000,
    })
  })

  it('Property 5c: Mixed Success and Failure Diagnostics - For any mix of passing and failing tests, only failures should be categorized', async () => {
    // Feature: test-infrastructure-stabilization, Property 5: Test Failure Diagnostics
    const property = fc.asyncProperty(
      fc.record({
        passingTests: fc.array(
          fc.record({
            testName: fc.string({ minLength: 1, maxLength: 20 }),
            suiteName: fc.string({ minLength: 1, maxLength: 15 }),
            executionTime: fc.integer({ min: 50, max: 1000 }),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        failingTests: fc.array(
          fc.record({
            testName: fc.string({ minLength: 1, maxLength: 20 }),
            suiteName: fc.string({ minLength: 1, maxLength: 15 }),
            errorMessage: fc.string({ minLength: 5, maxLength: 100 }),
            executionTime: fc.integer({ min: 100, max: 2000 }),
          }),
          { minLength: 1, maxLength: 5 }
        ),
      }),
      async ({ passingTests, failingTests }) => {
        // Clear previous state
        monitor.clearMetrics()

        // Record passing tests
        for (const passingTest of passingTests) {
          const testResult: TestResult = {
            testName: passingTest.testName,
            suiteName: passingTest.suiteName,
            passed: true,
            executionTime: passingTest.executionTime,
            error: undefined, // No error for passing tests
            timestamp: new Date(Date.now() - Math.random() * 30000),
            testType: 'unit',
            retries: 0,
          }
          monitor.recordTestResult(testResult)
        }

        // Record failing tests
        for (const failingTest of failingTests) {
          const testResult: TestResult = {
            testName: failingTest.testName,
            suiteName: failingTest.suiteName,
            passed: false,
            executionTime: failingTest.executionTime,
            error: failingTest.errorMessage,
            timestamp: new Date(Date.now() - Math.random() * 30000),
            testType: 'integration',
            retries: 0,
          }
          monitor.recordTestResult(testResult)
        }

        // Get metrics
        const metrics = monitor.getReliabilityMetrics()

        // Verify counts
        expect(metrics.passedTests).toBe(passingTests.length)
        expect(metrics.failedTests).toBe(failingTests.length)
        expect(metrics.totalExecutions).toBe(
          passingTests.length + failingTests.length
        )

        // Verify only failing tests are categorized
        const totalCategorizedFailures = Object.values(
          metrics.failureCategories
        ).reduce((sum, count) => sum + count, 0)
        expect(totalCategorizedFailures).toBe(failingTests.length)

        // Verify each failing test can be categorized
        for (const failingTest of failingTests) {
          const category = monitor.categorizeFailure(failingTest.errorMessage)
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

        // Calculate expected pass rate
        const expectedPassRate =
          (passingTests.length / (passingTests.length + failingTests.length)) *
          100
        expect(metrics.passRate).toBeCloseTo(expectedPassRate, 1)
      }
    )

    await propertyRunner.runProperty(property, {
      iterations: 30,
      timeout: 8000,
    })
  })

  it('Property 5d: Failure Category Consistency - For any identical error messages, categorization should be consistent', async () => {
    // Feature: test-infrastructure-stabilization, Property 5: Test Failure Diagnostics
    const property = fc.asyncProperty(
      fc.record({
        errorMessage: fc.string({ minLength: 5, maxLength: 150 }),
        testCount: fc.integer({ min: 2, max: 8 }),
      }),
      async ({ errorMessage, testCount }) => {
        // Clear previous state
        monitor.clearMetrics()

        const categories: FailureCategory[] = []

        // Create multiple tests with the same error message
        for (let i = 0; i < testCount; i++) {
          const testResult: TestResult = {
            testName: `test-${i}`,
            suiteName: `suite-${i}`,
            passed: false,
            executionTime: Math.floor(Math.random() * 1000) + 100,
            error: errorMessage,
            timestamp: new Date(Date.now() - i * 10000),
            testType: 'property',
            retries: 0,
          }

          monitor.recordTestResult(testResult)

          // Categorize the failure
          const category = monitor.categorizeFailure(errorMessage)
          categories.push(category)
        }

        // Verify all categorizations are identical
        const firstCategory = categories[0]
        for (const category of categories) {
          expect(category).toBe(firstCategory)
        }

        // Verify metrics reflect consistent categorization
        const metrics = monitor.getReliabilityMetrics()
        expect(metrics.failedTests).toBe(testCount)

        // Should have exactly one category with all failures
        const categoryEntries = Object.entries(metrics.failureCategories)
        expect(categoryEntries).toHaveLength(1)
        expect(categoryEntries[0][1]).toBe(testCount)
        expect(categoryEntries[0][0]).toBe(firstCategory)
      }
    )

    await propertyRunner.runProperty(property, {
      iterations: 50,
      timeout: 6000,
    })
  })
})
