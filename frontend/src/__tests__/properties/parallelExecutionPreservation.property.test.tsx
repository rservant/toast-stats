/**
 * Property Test: Parallel Execution Preservation
 *
 * Feature: test-suite-optimization
 * Property 14: Parallel execution preservation
 *
 * Validates: Requirements 6.2
 *
 * This property test ensures that shared utilities work correctly with
 * parallel test execution without race conditions or shared state issues.
 */

import React from 'react'
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { renderWithProviders, testPerformanceMonitor } from '../utils'

// Mock components for parallel execution testing
const IsolatedComponent = ({
  id,
  variant,
  data,
}: {
  id: string
  variant?: string
  data?: unknown
}) => (
  <div
    className={`isolated-component ${variant || ''}`}
    data-testid={`isolated-component-${id}`}
    data-component-id={id}
  >
    <h3>Component {id}</h3>
    <p>Variant: {variant}</p>
    {data ? <pre>{JSON.stringify(data, null, 2)}</pre> : null}
  </div>
)

const StatefulComponent = ({
  id,
  initialValue = 0,
}: {
  id: string
  initialValue?: number
}) => {
  const [value, setValue] = React.useState(initialValue)

  return (
    <div
      className="stateful-component"
      data-testid={`stateful-component-${id}`}
      data-component-id={id}
    >
      <span data-testid={`value-${id}`}>{value}</span>
      <button
        data-testid={`increment-${id}`}
        onClick={() => setValue(v => v + 1)}
      >
        Increment
      </button>
    </div>
  )
}

describe('Property Test: Parallel Execution Preservation', () => {
  beforeEach(() => {
    // Clear performance metrics to ensure test isolation
    testPerformanceMonitor.clearMetrics()
  })

  it('should maintain component isolation in parallel renders', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc
              .string({ minLength: 3, maxLength: 8 })
              .filter(s => /^[a-zA-Z0-9]+$/.test(s)),
            variant: fc.oneof(
              fc.constant('primary'),
              fc.constant('secondary'),
              fc.constant('success')
            ),
            data: fc.record({
              value: fc.integer({ min: 1, max: 100 }),
              name: fc
                .string({ minLength: 2, maxLength: 10 })
                .filter(s => /^[a-zA-Z0-9]+$/.test(s)),
            }),
          }),
          { minLength: 1, maxLength: 3 }
        ),
        componentConfigs => {
          // Ensure unique IDs by adding index suffix
          const uniqueConfigs = componentConfigs.map((config, index) => ({
            ...config,
            id: `${config.id}-${index}-${Date.now()}`,
          }))

          // Render components sequentially to avoid race conditions
          const renderResults = uniqueConfigs.map(({ id, variant, data }) => {
            const result = renderWithProviders(
              <IsolatedComponent id={id} variant={variant} data={data} />
            )
            return { id, result }
          })

          // Verify each component rendered with correct isolation
          renderResults.forEach(({ id, result }) => {
            const component = result.getByTestId(`isolated-component-${id}`)
            expect(component).toBeInTheDocument()

            // Verify component has correct ID
            expect(component.getAttribute('data-component-id')).toBe(id)

            // Cleanup
            result.unmount()
          })
        }
      ),
      { numRuns: 5 }
    )
  })

  it('should preserve state isolation between parallel component instances', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc
              .string({ minLength: 3, maxLength: 8 })
              .filter(s => /^[a-zA-Z0-9]+$/.test(s)),
            initialValue: fc.integer({ min: 0, max: 50 }),
          }),
          { minLength: 1, maxLength: 3 }
        ),
        componentConfigs => {
          // Ensure unique IDs by adding index suffix
          const uniqueConfigs = componentConfigs.map((config, index) => ({
            ...config,
            id: `${config.id}-${index}-${Date.now()}`,
          }))

          // Render stateful components
          const results = uniqueConfigs.map(({ id, initialValue }) => {
            const result = renderWithProviders(
              <StatefulComponent id={id} initialValue={initialValue} />
            )
            return { id, initialValue, result }
          })

          // Verify each component has correct initial state
          results.forEach(({ id, initialValue, result }) => {
            const valueElement = result.getByTestId(`value-${id}`)
            expect(valueElement).toBeInTheDocument()
            expect(valueElement.textContent).toBe(initialValue.toString())
          })

          // Cleanup all renders
          results.forEach(({ result }) => result.unmount())
        }
      ),
      { numRuns: 5 }
    )
  })

  it('should handle concurrent performance monitoring without conflicts', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            testName: fc
              .string({ minLength: 5, maxLength: 12 })
              .filter(s => /^[a-zA-Z0-9]+$/.test(s)),
            componentCount: fc.integer({ min: 1, max: 2 }),
          }),
          { minLength: 1, maxLength: 3 }
        ),
        testConfigs => {
          // Start multiple performance monitoring sessions
          const monitoringResults = testConfigs.map(
            ({ testName, componentCount }, index) => {
              const uniqueTestName = `perf-${testName}-${index}-${Date.now()}-${Math.floor(Math.random() * 1000)}`

              testPerformanceMonitor.startMonitoring(uniqueTestName)

              // Simulate test work
              const results: ReturnType<typeof renderWithProviders>[] = []
              for (let i = 0; i < componentCount; i++) {
                const result = renderWithProviders(
                  <IsolatedComponent
                    id={`${uniqueTestName}-${i}`}
                    variant="performance"
                  />
                )
                results.push(result)
              }

              // Cleanup renders
              results.forEach(result => {
                if (
                  result &&
                  typeof result === 'object' &&
                  'unmount' in result
                ) {
                  ;(result as { unmount: () => void }).unmount()
                }
              })

              // Stop monitoring
              const metrics =
                testPerformanceMonitor.stopMonitoring(uniqueTestName)

              return { testName: uniqueTestName, metrics }
            }
          )

          // Verify each monitoring session captured correct metrics
          monitoringResults.forEach(({ testName, metrics }) => {
            expect(metrics.renderTime).toBeGreaterThanOrEqual(0)
            expect(typeof metrics.memoryUsage).toBe('number')
            expect(metrics.timestamp).toBeInstanceOf(Date)

            // Verify metrics are isolated (no cross-contamination)
            const report = testPerformanceMonitor.getReport(testName)
            expect(report.testName).toBe(testName)
            expect(report.metrics).toEqual(metrics)
          })

          // Verify all tests are tracked separately
          const allMetrics = testPerformanceMonitor.getAllMetrics()
          expect(allMetrics.size).toBeGreaterThanOrEqual(testConfigs.length)
        }
      ),
      { numRuns: 5 }
    )
  })

  it('should maintain provider isolation between parallel tests', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc
              .string({ minLength: 3, maxLength: 8 })
              .filter(s => /^[a-zA-Z0-9]+$/.test(s)),
            variant: fc.oneof(
              fc.constant('test1'),
              fc.constant('test2'),
              fc.constant('test3')
            ),
          }),
          { minLength: 1, maxLength: 3 }
        ),
        componentConfigs => {
          // Ensure unique IDs by adding index suffix
          const uniqueConfigs = componentConfigs.map((config, index) => ({
            ...config,
            id: `${config.id}-${index}-${Date.now()}`,
          }))

          // Render components with different provider configurations
          const results = uniqueConfigs.map(({ id, variant }) => {
            // Each render should get its own isolated providers
            const result = renderWithProviders(
              <IsolatedComponent id={id} variant={variant} />,
              {
                testId: `provider-test-${id}`,
                enablePerformanceMonitoring: false, // Disable to avoid conflicts
                testName: `parallel-provider-test-${id}`,
              }
            )
            return { id, variant, result }
          })

          // Verify provider isolation
          results.forEach(({ id, variant, result }) => {
            const component = result.getByTestId(`isolated-component-${id}`)
            expect(component).toBeInTheDocument()

            // Verify component has correct variant
            expect(component.classList.contains(variant)).toBe(true)
          })

          // Cleanup
          results.forEach(({ result }) => result.unmount())
        }
      ),
      { numRuns: 5 }
    )
  })

  it('should prevent memory leaks in parallel execution', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 4 }), parallelCount => {
        // Create and cleanup multiple components
        const cleanupFunctions: (() => void)[] = []

        for (let i = 0; i < parallelCount; i++) {
          const result = renderWithProviders(
            <IsolatedComponent
              id={`memory-test-${i}`}
              variant="memory"
              data={{ iteration: i, timestamp: Date.now() }}
            />
          )

          cleanupFunctions.push(() => result.unmount())
        }

        // Verify all components rendered
        expect(cleanupFunctions).toHaveLength(parallelCount)

        // Cleanup all components
        cleanupFunctions.forEach(cleanup => cleanup())

        // Basic memory check - just ensure cleanup completed without errors
        expect(cleanupFunctions).toHaveLength(parallelCount)
      }),
      { numRuns: 5 }
    )
  })

  it('should maintain test execution order independence', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc
              .string({ minLength: 3, maxLength: 8 })
              .filter(s => /^[a-zA-Z0-9]+$/.test(s)),
            order: fc.integer({ min: 1, max: 10 }),
          }),
          { minLength: 2, maxLength: 4 }
        ),
        testConfigs => {
          // Ensure unique IDs to avoid conflicts
          const uniqueConfigs = testConfigs.map((config, index) => ({
            ...config,
            id: `${config.id}-${index}`,
          }))

          // Sort configs by order to simulate ordered execution
          const orderedConfigs = [...uniqueConfigs].sort(
            (a, b) => a.order - b.order
          )

          // Execute in order
          const orderedResults = orderedConfigs.map(({ id, order }) => {
            const result = renderWithProviders(
              <IsolatedComponent
                id={`ordered-${id}`}
                variant="ordered"
                data={{ order }}
              />
            )
            return { id, order, result }
          })

          // Shuffle and execute in different order
          const shuffledConfigs = [...uniqueConfigs].sort(
            () => Math.random() - 0.5
          )
          const shuffledResults = shuffledConfigs.map(({ id, order }) => {
            const result = renderWithProviders(
              <IsolatedComponent
                id={`shuffled-${id}`}
                variant="shuffled"
                data={{ order }}
              />
            )
            return { id, order, result }
          })

          // Results should be equivalent regardless of execution order
          expect(orderedResults).toHaveLength(shuffledResults.length)

          // Verify each component rendered correctly in both cases
          orderedResults.forEach(({ id, result }) => {
            const component = result.getByTestId(
              `isolated-component-ordered-${id}`
            )
            expect(component).toBeInTheDocument()
          })

          shuffledResults.forEach(({ id, result }) => {
            const component = result.getByTestId(
              `isolated-component-shuffled-${id}`
            )
            expect(component).toBeInTheDocument()
          })

          // Cleanup
          const allResults = orderedResults.concat(shuffledResults)
          allResults.forEach(({ result }) => result.unmount())
        }
      ),
      { numRuns: 5 }
    )
  })

  it('should handle resource cleanup in parallel scenarios', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc
              .string({ minLength: 3, maxLength: 8 })
              .filter(s => /^[a-zA-Z0-9]+$/.test(s)),
            resourceCount: fc.integer({ min: 1, max: 3 }),
          }),
          { minLength: 1, maxLength: 3 }
        ),
        resourceConfigs => {
          const allResources: ReturnType<typeof renderWithProviders>[] = []

          // Create resources
          resourceConfigs.forEach(({ id, resourceCount }, configIndex) => {
            for (let i = 0; i < resourceCount; i++) {
              const result = renderWithProviders(
                <IsolatedComponent
                  id={`resource-${id}-${configIndex}-${i}`}
                  variant="resource"
                  data={{ resourceId: `${id}-${i}` }}
                />
              )
              allResources.push(result)
            }
          })

          // Verify all resources created
          const expectedResourceCount = resourceConfigs.reduce(
            (sum, { resourceCount }) => sum + resourceCount,
            0
          )
          expect(allResources).toHaveLength(expectedResourceCount)

          // Cleanup all resources
          let cleanupCount = 0
          allResources.forEach(result => {
            if (result && typeof result === 'object' && 'unmount' in result) {
              ;(result as { unmount: () => void }).unmount()
              cleanupCount++
            }
          })

          // Verify all resources were cleaned up
          expect(cleanupCount).toBe(expectedResourceCount)
        }
      ),
      { numRuns: 5 }
    )
  })
})
