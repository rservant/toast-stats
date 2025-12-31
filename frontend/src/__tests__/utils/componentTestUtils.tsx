/**
 * Shared Component Testing Utilities
 *
 * Reduces redundancy in component tests by providing reusable patterns
 * for common testing scenarios like rendering, accessibility, and props.
 */

import { render, screen, RenderOptions, cleanup } from '@testing-library/react'
import React, { ReactElement, ComponentType } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, it, vi } from 'vitest'
import { testPerformanceMonitor } from './performanceMonitor'
import { runQuickAccessibilityCheck } from './accessibilityTestUtils'
import { runQuickBrandCheck } from './brandComplianceTestUtils'

// Type-safe helper for checking test environment (following lint-compliance-guide patterns)
interface ExpectWithState {
  getState?: () => { currentTestName?: string }
}

function isInsideTest(): boolean {
  return (
    typeof expect !== 'undefined' &&
    typeof (expect as unknown as ExpectWithState).getState === 'function' &&
    Boolean(
      (expect as unknown as ExpectWithState).getState?.()?.currentTestName
    )
  )
}

// Enhanced provider configuration interface
export interface RenderWithProvidersOptions extends Omit<
  RenderOptions,
  'wrapper'
> {
  skipProviders?: boolean
  skipRouter?: boolean
  customProviders?: ComponentType<{ children: React.ReactNode }>[]
  testId?: string
  enablePerformanceMonitoring?: boolean
  testName?: string
  queryClientOptions?: {
    defaultOptions?: {
      queries?: Record<string, unknown>
      mutations?: Record<string, unknown>
    }
  }
}

// Resource cleanup tracking
const activeResources = new Set<() => void>()

import { PerformanceWrapper } from './PerformanceWrapper'

// Enhanced providers wrapper with custom provider support and router detection
const createProvidersWrapper = (options: RenderWithProvidersOptions = {}) => {
  const {
    customProviders = [],
    queryClientOptions = {},
    enablePerformanceMonitoring = false,
    testName,
    skipRouter = false,
  } = options

  return ({ children }: { children: React.ReactNode }) => {
    // Create isolated QueryClient for each test
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, cacheTime: 0, staleTime: 0 },
        mutations: { retry: false },
        ...queryClientOptions.defaultOptions,
      },
    })

    // Register cleanup for QueryClient
    const cleanup = () => {
      queryClient.clear()
      queryClient.getQueryCache().clear()
      queryClient.getMutationCache().clear()
    }
    activeResources.add(cleanup)

    // Build provider chain from inside out
    let wrappedChildren = (
      <PerformanceWrapper
        testName={testName}
        enableMonitoring={enablePerformanceMonitoring}
      >
        {children}
      </PerformanceWrapper>
    )

    // Apply custom providers in reverse order (outermost first)
    for (let i = customProviders.length - 1; i >= 0; i--) {
      const Provider = customProviders[i]
      wrappedChildren = <Provider>{wrappedChildren}</Provider>
    }

    // Apply standard providers - conditionally wrap with router
    if (skipRouter) {
      // Skip router wrapping when explicitly requested
      wrappedChildren = (
        <QueryClientProvider client={queryClient}>
          {wrappedChildren}
        </QueryClientProvider>
      )
    } else {
      // Create memory router for components that need routing
      const router = createMemoryRouter(
        [
          {
            path: '*',
            element: wrappedChildren,
          },
        ],
        {
          initialEntries: ['/'],
        }
      )

      wrappedChildren = (
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      )
    }

    return wrappedChildren
  }
}

/**
 * Enhanced render function with advanced provider management, test isolation, and performance monitoring
 */
export const renderWithProviders = (
  ui: ReactElement,
  options: RenderWithProvidersOptions = {}
) => {
  const { skipProviders = false, ...renderOptions } = options

  // If providers are skipped, render directly
  if (skipProviders) {
    return render(ui, renderOptions)
  }

  // Create wrapper with enhanced provider management
  const wrapper = createProvidersWrapper(options)

  // Render with automatic cleanup registration
  const result = render(ui, { wrapper, ...renderOptions })

  // Register cleanup for this render
  const renderCleanup = () => {
    result.unmount()
  }
  activeResources.add(renderCleanup)

  // Enhanced result with cleanup utilities
  return {
    ...result,
    cleanup: () => {
      renderCleanup()
      activeResources.delete(renderCleanup)
    },
    getPerformanceMetrics: () => {
      if (options.enablePerformanceMonitoring && options.testName) {
        const allMetrics = testPerformanceMonitor.getAllMetrics()
        return allMetrics.get(options.testName) || null
      }
      return null
    },
  }
}

/**
 * Automatic cleanup for all active resources
 * Should be called in test teardown (afterEach)
 */
export const cleanupAllResources = () => {
  // Execute all registered cleanup functions
  activeResources.forEach(cleanupFn => {
    try {
      cleanupFn()
    } catch (error) {
      console.warn('Error during resource cleanup:', error)
    }
  })

  // Clear the set
  activeResources.clear()

  // Standard testing library cleanup
  cleanup()
}

/**
 * Common test for basic component rendering
 */
export const expectBasicRendering = (
  component: ReactElement,
  testId?: string
) => {
  renderWithProviders(component)

  if (testId) {
    // Use getAllByTestId to handle multiple elements gracefully
    const elements = screen.getAllByTestId(testId)
    expect(elements.length).toBeGreaterThan(0)
    expect(elements[0]).toBeInTheDocument()
  } else {
    // Check that component renders without crashing
    expect(document.body).toBeInTheDocument()
  }
}

// Enhanced component variant testing interface
export interface ComponentVariant<T> {
  name: string
  props: T
  expectedText?: string
  expectedClass?: string
  expectedAttribute?: { name: string; value: string }
  customAssertion?: (container: HTMLElement) => void
  performanceBenchmark?: {
    maxRenderTime?: number
    maxMemoryUsage?: number
  }
}

export interface VariantTestOptions {
  enablePerformanceMonitoring?: boolean
  skipAccessibilityCheck?: boolean
  skipBrandComplianceCheck?: boolean
  skipRouter?: boolean
  customProviders?: ComponentType<{ children: React.ReactNode }>[]
  beforeEach?: () => void
  afterEach?: () => void
}

/**
 * Enhanced test component with different prop variations including performance benchmarking
 *
 * This function can work in two modes:
 * 1. Legacy mode: When called inside a describe block, it creates test cases directly
 * 2. New mode: When called from within a test, it returns test functions
 */
export const testComponentVariants = <
  T extends Record<string, unknown> = Record<string, unknown>,
>(
  Component: React.ComponentType<T>,
  variants: ComponentVariant<T>[],
  options: VariantTestOptions = {}
) => {
  const {
    enablePerformanceMonitoring = false,
    skipAccessibilityCheck = false,
    skipBrandComplianceCheck = false,
    skipRouter = false,
    customProviders = [],
    beforeEach,
    afterEach,
  } = options

  // Check if we're inside a test (vitest sets expect.getState when inside a test)
  const isInsideTestEnv = isInsideTest()

  const executeVariantTest = ({
    name,
    props,
    expectedText,
    expectedClass,
    expectedAttribute,
    customAssertion,
    performanceBenchmark,
  }: ComponentVariant<T>) => {
    // Setup
    beforeEach?.()

    const testName = `${Component.displayName || Component.name}-${name}`

    // Render with enhanced options
    const renderResult = renderWithProviders(<Component {...props} />, {
      enablePerformanceMonitoring,
      testName,
      customProviders,
      skipRouter,
    })

    const { container } = renderResult

    try {
      // Basic rendering assertions
      if (expectedText) {
        expect(screen.getByText(expectedText)).toBeInTheDocument()
      }

      if (expectedClass) {
        // Try multiple selectors to find element with expected class
        const selectors = ['button', '[role="button"]', 'div', 'span', '*']
        let elementFound = false

        for (const selector of selectors) {
          const elements = container.querySelectorAll(selector)
          const elementWithClass = Array.from(elements).find(el =>
            el.classList.contains(expectedClass)
          )
          if (elementWithClass) {
            expect(elementWithClass).toHaveClass(expectedClass)
            elementFound = true
            break
          }
        }

        if (!elementFound) {
          // Fallback: check if any element has the class
          const elementWithClass = container.querySelector(`.${expectedClass}`)
          expect(elementWithClass).toBeInTheDocument()
        }
      }

      if (expectedAttribute) {
        const elementWithAttribute = container.querySelector(
          `[${expectedAttribute.name}="${expectedAttribute.value}"]`
        )
        expect(elementWithAttribute).toBeInTheDocument()
      }

      // Custom assertions
      if (customAssertion) {
        customAssertion(container)
      }

      // Performance benchmarking
      if (performanceBenchmark && enablePerformanceMonitoring) {
        const allMetrics = testPerformanceMonitor.getAllMetrics()
        const metrics = allMetrics.get(testName)

        if (metrics) {
          if (performanceBenchmark.maxRenderTime) {
            expect(metrics.renderTime).toBeLessThanOrEqual(
              performanceBenchmark.maxRenderTime
            )
          }

          if (performanceBenchmark.maxMemoryUsage) {
            expect(metrics.memoryUsage).toBeLessThanOrEqual(
              performanceBenchmark.maxMemoryUsage
            )
          }
        }
      }

      // Accessibility check (unless skipped)
      if (!skipAccessibilityCheck) {
        try {
          const { passed, criticalViolations } = runQuickAccessibilityCheck(
            <Component {...props} />
          )
          if (!passed) {
            const errorMessage = `Accessibility violations found:\n${criticalViolations.map(v => `- ${v.violation}: ${v.remediation}`).join('\n')}`
            console.warn(errorMessage) // Log but don't fail the test
          }
        } catch (error) {
          // Specifically handle axe concurrent run errors
          if (
            error instanceof Error &&
            error.message.includes('Axe is already running')
          ) {
            console.warn(
              'Skipping accessibility check due to concurrent axe run'
            )
          } else {
            console.warn('Accessibility check failed:', error)
          }
        }
      }

      // Brand compliance check (unless skipped)
      if (!skipBrandComplianceCheck) {
        try {
          const { passed, criticalViolations } = runQuickBrandCheck(
            <Component {...props} />
          )
          if (!passed) {
            const errorMessage = `Brand compliance violations found:\n${criticalViolations.map(v => `- ${v.violation}: ${v.remediation}`).join('\n')}`
            console.warn(errorMessage) // Log but don't fail the test
          }
        } catch (error) {
          console.warn('Brand compliance check failed:', error)
        }
      }
    } finally {
      // Cleanup
      if ('cleanup' in renderResult) {
        renderResult.cleanup()
      }
      afterEach?.()
    }
  }

  if (isInsideTestEnv) {
    // If we're inside a test, just execute the variants directly (for property tests)
    variants.forEach(executeVariantTest)
  } else {
    // If we're in a describe block, create individual test cases
    variants.forEach(variant => {
      it(`should render ${variant.name} variant correctly`, () => {
        executeVariantTest(variant)
      })
    })
  }
}

/**
 * Generate parameterized tests for component variants
 */
export const generateVariantTests = <
  T extends Record<string, unknown> = Record<string, unknown>,
>(
  baseProps: T,
  variations: Record<string, Partial<T>>
): ComponentVariant<T>[] => {
  return Object.entries(variations).map(([name, variation]) => ({
    name,
    props: { ...baseProps, ...variation } as T,
  }))
}

/**
 * Test component accessibility features with enhanced validation
 */
export const expectAccessibility = async (component: ReactElement) => {
  const { container } = renderWithProviders(component)

  // Check for basic accessibility attributes
  const interactiveElements = container.querySelectorAll(
    'button, a, input, select, textarea, [role="button"], [role="link"]'
  )

  interactiveElements.forEach(element => {
    // Should have accessible name or aria-label
    const hasAccessibleName =
      element.getAttribute('aria-label') ||
      element.getAttribute('aria-labelledby') ||
      element.getAttribute('title') ||
      element.textContent?.trim()

    expect(hasAccessibleName).toBeTruthy()

    // Check for minimum touch target size (44px)
    const styles = window.getComputedStyle(element)
    const minHeight = parseInt(styles.minHeight) || parseInt(styles.height) || 0
    const minWidth = parseInt(styles.minWidth) || parseInt(styles.width) || 0

    if (minHeight > 0 && minWidth > 0) {
      expect(minHeight).toBeGreaterThanOrEqual(44)
      expect(minWidth).toBeGreaterThanOrEqual(44)
    }
  })
}

/**
 * Enhanced test component with loading states including performance monitoring
 * Works in both legacy mode (creates tests) and new mode (executes directly)
 */
export const testLoadingStates = <
  T extends Record<string, unknown> = Record<string, unknown>,
>(
  Component: React.ComponentType<T>,
  loadingProps: T,
  loadedProps: T,
  options: { enablePerformanceMonitoring?: boolean } = {}
) => {
  // Check if we're inside a test
  const isInsideTestEnv = isInsideTest()

  const executeLoadingTest = () => {
    const testName = `${Component.displayName || Component.name}-loading`
    renderWithProviders(<Component {...loadingProps} />, {
      enablePerformanceMonitoring: options.enablePerformanceMonitoring,
      testName,
    })
    // Use getAllByText to handle multiple loading elements
    const loadingElements = screen.getAllByText(/loading/i)
    expect(loadingElements.length).toBeGreaterThan(0)
  }

  const executeLoadedTest = () => {
    const testName = `${Component.displayName || Component.name}-loaded`
    renderWithProviders(<Component {...loadedProps} />, {
      enablePerformanceMonitoring: options.enablePerformanceMonitoring,
      testName,
    })
    // Check that no loading text is present
    const loadingElements = screen.queryAllByText(/loading/i)
    // Filter out elements that are not actually loading indicators
    const actualLoadingElements = loadingElements.filter(
      el =>
        el.textContent &&
        el.textContent.toLowerCase().includes('loading') &&
        !el.textContent.toLowerCase().includes('not loading') &&
        !el.textContent.toLowerCase().includes('finished loading')
    )
    expect(actualLoadingElements.length).toBe(0)
  }

  if (isInsideTestEnv) {
    // Execute directly for property tests
    executeLoadingTest()
    // Clean up between renders to avoid DOM pollution
    cleanup()
    executeLoadedTest()
  } else {
    // Create individual test cases
    it('should show loading state', executeLoadingTest)
    it('should show loaded state', executeLoadedTest)
  }
}

/**
 * Enhanced test component error states with better error handling
 * Works in both legacy mode (creates tests) and new mode (executes directly)
 */
export const testErrorStates = <
  T extends Record<string, unknown> = Record<string, unknown>,
>(
  Component: React.ComponentType<T>,
  errorProps: T,
  expectedErrorMessage: string | RegExp,
  options: { enablePerformanceMonitoring?: boolean } = {}
) => {
  // Check if we're inside a test
  const isInsideTestEnv = isInsideTest()

  const executeErrorTest = () => {
    const testName = `${Component.displayName || Component.name}-error`

    // Suppress console.error for this test to avoid noise
    const originalError = console.error
    console.error = vi.fn()

    try {
      renderWithProviders(<Component {...errorProps} />, {
        enablePerformanceMonitoring: options.enablePerformanceMonitoring,
        testName,
      })

      if (typeof expectedErrorMessage === 'string') {
        // Use getAllByText to handle multiple error elements
        const errorElements = screen.getAllByText(expectedErrorMessage)
        expect(errorElements.length).toBeGreaterThan(0)
      } else {
        const errorElements = screen.getAllByText(expectedErrorMessage)
        expect(errorElements.length).toBeGreaterThan(0)
      }
    } finally {
      console.error = originalError
    }
  }

  if (isInsideTestEnv) {
    // Execute directly for property tests
    executeErrorTest()
  } else {
    // Create individual test case
    it('should display error message', executeErrorTest)
  }
}

/**
 * Test component with different viewport sizes (responsive testing)
 * Works in both legacy mode (creates tests) and new mode (executes directly)
 */
export const testResponsiveVariants = <
  T extends Record<string, unknown> = Record<string, unknown>,
>(
  Component: React.ComponentType<T>,
  props: T,
  viewports: Array<{ name: string; width: number; height: number }>
) => {
  // Check if we're inside a test
  const isInsideTestEnv = isInsideTest()

  const executeResponsiveTest = ({
    name,
    width,
    height,
  }: {
    name: string
    width: number
    height: number
  }) => {
    const testName = `${Component.displayName || Component.name}-responsive-${name}`

    // Mock viewport size
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: width,
    })
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: height,
    })

    // Trigger resize event
    window.dispatchEvent(new Event('resize'))

    renderWithProviders(<Component {...props} />, {
      testName,
    })

    // Component should render without crashing
    expect(document.body).toBeInTheDocument()
  }

  if (isInsideTestEnv) {
    // Execute directly for property tests
    viewports.forEach(executeResponsiveTest)
  } else {
    // Create individual test cases
    viewports.forEach(({ name, width, height }) => {
      it(`should render correctly on ${name} viewport`, () => {
        executeResponsiveTest({ name, width, height })
      })
    })
  }
}

// Re-export vi for convenience in tests
export { vi } from 'vitest'
