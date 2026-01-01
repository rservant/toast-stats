/**
 * Component Testing Utilities - Usage Examples
 *
 * This file demonstrates how to use the shared component testing utilities
 * with real-world examples and best practices.
 */

import React from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { screen } from '@testing-library/react'
import {
  renderWithProviders,
  testComponentVariants,
  expectBasicRendering,
  testLoadingStates,
  testErrorStates,
  testResponsiveVariants,
  cleanupAllResources,
  ComponentVariant,
} from '../componentTestUtils'

// Example component interfaces for demonstration
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'small' | 'medium' | 'large'
  disabled?: boolean
  loading?: boolean
  children: React.ReactNode
  onClick?: () => void
}

interface CardProps {
  title: string
  content?: string
  loading?: boolean
  error?: string
  variant?: 'default' | 'highlighted' | 'warning'
}

interface DataTableProps {
  data: Record<string, unknown>[]
  loading?: boolean
  error?: string
  columns: string[]
}

// Mock components for examples
const ExampleButton: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  children,
  onClick,
}) => (
  <button
    className={`btn btn-${variant} btn-${size} ${loading ? 'loading' : ''}`}
    disabled={disabled || loading}
    onClick={onClick}
    data-testid="example-button"
  >
    {loading ? 'Loading...' : children}
  </button>
)

const ExampleCard: React.FC<CardProps> = ({
  title,
  content,
  loading,
  error,
  variant = 'default',
}) => (
  <div className={`card card-${variant}`} data-testid="example-card">
    <h3>{title}</h3>
    {loading && <div>Loading...</div>}
    {error && <div className="error">{error}</div>}
    {content && !loading && !error && <p>{content}</p>}
  </div>
)

const ExampleDataTable: React.FC<DataTableProps> = ({
  data,
  loading,
  error,
  columns,
}) => (
  <div className="data-table" data-testid="data-table">
    {loading && <div>Loading data...</div>}
    {error && <div className="error">{error}</div>}
    {!loading && !error && (
      <table>
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr key={index}>
              {columns.map(col => (
                <td key={col}>{row[col] as React.ReactNode}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
)

describe('Component Testing Utilities - Examples', () => {
  afterEach(() => {
    cleanupAllResources()
  })

  describe('renderWithProviders Examples', () => {
    it('should render component with default providers', () => {
      const { container } = renderWithProviders(
        <ExampleButton>Click me</ExampleButton>
      )

      expect(screen.getByText('Click me')).toBeInTheDocument()
      expect(container.querySelector('.btn')).toBeInTheDocument()
    })

    it('should render with performance monitoring enabled', () => {
      const result = renderWithProviders(
        <ExampleButton>Performance Test</ExampleButton>,
        {
          enablePerformanceMonitoring: true,
          testName: 'button-performance-test',
        }
      )

      expect(screen.getByText('Performance Test')).toBeInTheDocument()

      // Access performance metrics
      const metrics =
        'getPerformanceMetrics' in result
          ? (
              result as { getPerformanceMetrics: () => unknown }
            ).getPerformanceMetrics()
          : null
      expect(metrics).toBeDefined()
    })

    it('should render with custom providers', () => {
      const CustomProvider: React.FC<{ children: React.ReactNode }> = ({
        children,
      }) => <div data-testid="custom-provider">{children}</div>

      renderWithProviders(<ExampleButton>Custom Provider Test</ExampleButton>, {
        customProviders: [CustomProvider],
      })

      expect(screen.getByTestId('custom-provider')).toBeInTheDocument()
      expect(screen.getByText('Custom Provider Test')).toBeInTheDocument()
    })

    it('should render without router when skipRouter is true', () => {
      renderWithProviders(<ExampleButton>No Router</ExampleButton>, {
        skipRouter: true,
      })

      expect(screen.getByText('No Router')).toBeInTheDocument()
    })
  })

  describe('expectBasicRendering Examples', () => {
    it('should test basic rendering without test ID', () => {
      expectBasicRendering(<ExampleButton>Basic Test</ExampleButton>)
    })

    it('should test basic rendering with test ID', () => {
      expectBasicRendering(
        <ExampleButton>Test ID Example</ExampleButton>,
        'example-button'
      )
    })
  })

  describe('testComponentVariants Examples', () => {
    it('should test button variants comprehensively', () => {
      const buttonVariants: ComponentVariant<ButtonProps>[] = [
        {
          name: 'primary button',
          props: { variant: 'primary', children: 'Primary' },
          expectedText: 'Primary',
          expectedClass: 'btn-primary',
        },
        {
          name: 'secondary button',
          props: { variant: 'secondary', children: 'Secondary' },
          expectedText: 'Secondary',
          expectedClass: 'btn-secondary',
        },
        {
          name: 'danger button',
          props: { variant: 'danger', children: 'Delete' },
          expectedText: 'Delete',
          expectedClass: 'btn-danger',
        },
        {
          name: 'small button',
          props: { size: 'small', children: 'Small' },
          expectedClass: 'btn-small',
        },
        {
          name: 'large button',
          props: { size: 'large', children: 'Large' },
          expectedClass: 'btn-large',
        },
        {
          name: 'disabled button',
          props: { disabled: true, children: 'Disabled' },
          expectedAttribute: { name: 'disabled', value: '' },
        },
        {
          name: 'loading button',
          props: { loading: true, children: 'Submit' },
          expectedText: 'Loading...',
          expectedClass: 'loading',
        },
      ]

      testComponentVariants(
        ExampleButton as unknown as React.ComponentType<
          Record<string, unknown>
        >,
        buttonVariants as unknown as ComponentVariant<
          Record<string, unknown>
        >[],
        {
          enablePerformanceMonitoring: true,
          skipAccessibilityCheck: false,
        }
      )
    })

    it('should test card variants with custom assertions', () => {
      const cardVariants: ComponentVariant<CardProps>[] = [
        {
          name: 'default card',
          props: { title: 'Default Card', content: 'Default content' },
          expectedText: 'Default Card',
          customAssertion: container => {
            expect(container.querySelector('.card-default')).toBeInTheDocument()
            expect(container.querySelector('p')).toHaveTextContent(
              'Default content'
            )
          },
        },
        {
          name: 'highlighted card',
          props: {
            title: 'Important',
            content: 'Important content',
            variant: 'highlighted',
          },
          expectedClass: 'card-highlighted',
          customAssertion: container => {
            const card = container.querySelector('.card')
            expect(card).toHaveClass('card-highlighted')
          },
        },
        {
          name: 'warning card',
          props: {
            title: 'Warning',
            content: 'Warning message',
            variant: 'warning',
          },
          expectedClass: 'card-warning',
        },
      ]

      testComponentVariants(
        ExampleCard as unknown as React.ComponentType<Record<string, unknown>>,
        cardVariants as unknown as ComponentVariant<Record<string, unknown>>[],
        {
          beforeEach: () => {
            console.log('Setting up card test')
          },
          afterEach: () => {
            console.log('Cleaning up card test')
          },
        }
      )
    })

    it('should test variants with performance benchmarks', () => {
      const performanceVariants: ComponentVariant<ButtonProps>[] = [
        {
          name: 'performance-critical button',
          props: { variant: 'primary', children: 'Fast Button' },
          performanceBenchmark: {
            maxRenderTime: 50, // 50ms max render time
            maxMemoryUsage: 1024, // 1KB max memory usage
          },
        },
      ]

      testComponentVariants(
        ExampleButton as unknown as React.ComponentType<
          Record<string, unknown>
        >,
        performanceVariants as unknown as ComponentVariant<
          Record<string, unknown>
        >[],
        {
          enablePerformanceMonitoring: true,
        }
      )
    })
  })

  describe('testLoadingStates Examples', () => {
    it('should test card loading states', () => {
      testLoadingStates(
        ExampleCard as unknown as React.ComponentType<Record<string, unknown>>,
        { title: 'Test Card', loading: true },
        { title: 'Test Card', content: 'Content loaded successfully' },
        { enablePerformanceMonitoring: true }
      )
    })

    it('should test data table loading states', () => {
      const mockData = [
        { name: 'John', age: 30, city: 'New York' },
        { name: 'Jane', age: 25, city: 'San Francisco' },
      ]

      testLoadingStates(
        ExampleDataTable as unknown as React.ComponentType<
          Record<string, unknown>
        >,
        { data: [], loading: true, columns: ['name', 'age', 'city'] },
        { data: mockData, loading: false, columns: ['name', 'age', 'city'] }
      )
    })
  })

  describe('testErrorStates Examples', () => {
    it('should test card error states', () => {
      testErrorStates(
        ExampleCard as unknown as React.ComponentType<Record<string, unknown>>,
        { title: 'Error Card', error: 'Failed to load data' },
        /failed to load data/i
      )
    })

    it('should test data table error states', () => {
      testErrorStates(
        ExampleDataTable as unknown as React.ComponentType<
          Record<string, unknown>
        >,
        {
          data: [],
          error: 'Network connection failed',
          columns: ['name', 'age'],
        },
        /network connection failed/i,
        { enablePerformanceMonitoring: true }
      )
    })

    it('should test multiple error message patterns', () => {
      testErrorStates(
        ExampleCard as unknown as React.ComponentType<Record<string, unknown>>,
        { title: 'Validation Error', error: 'Invalid input provided' },
        'Invalid input provided' // Exact string match
      )
    })
  })

  describe('testResponsiveVariants Examples', () => {
    it('should test button responsive behavior', () => {
      const viewports = [
        { name: 'mobile', width: 375, height: 667 },
        { name: 'tablet', width: 768, height: 1024 },
        { name: 'desktop', width: 1920, height: 1080 },
        { name: 'large-desktop', width: 2560, height: 1440 },
      ]

      testResponsiveVariants(
        ExampleButton as unknown as React.ComponentType<
          Record<string, unknown>
        >,
        { variant: 'primary', children: 'Responsive Button' },
        viewports
      )
    })

    it('should test card responsive layout', () => {
      const viewports = [
        { name: 'mobile-portrait', width: 375, height: 812 },
        { name: 'mobile-landscape', width: 812, height: 375 },
        { name: 'tablet', width: 1024, height: 768 },
      ]

      testResponsiveVariants(
        ExampleCard as unknown as React.ComponentType<Record<string, unknown>>,
        {
          title: 'Responsive Card',
          content: 'This card adapts to different screen sizes',
        },
        viewports
      )
    })
  })

  describe('Advanced Usage Examples', () => {
    it('should combine multiple utilities for comprehensive testing', () => {
      // Basic rendering test
      expectBasicRendering(<ExampleButton>Comprehensive Test</ExampleButton>)

      // Variant testing
      testComponentVariants(
        ExampleButton as unknown as React.ComponentType<
          Record<string, unknown>
        >,
        [
          {
            name: 'comprehensive variant',
            props: { variant: 'primary', size: 'large', children: 'Test' },
            expectedClass: 'btn-primary',
            customAssertion: container => {
              expect(container.querySelector('.btn-large')).toBeInTheDocument()
            },
          },
        ]
      )

      // State testing
      testLoadingStates(
        ExampleButton as unknown as React.ComponentType<
          Record<string, unknown>
        >,
        { loading: true, children: 'Submit' },
        { loading: false, children: 'Submit' }
      )
    })

    it('should demonstrate custom provider usage', () => {
      const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
        children,
      }) => <div data-theme="dark">{children}</div>

      const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
        children,
      }) => <div data-auth="authenticated">{children}</div>

      renderWithProviders(<ExampleButton>Multi-Provider Test</ExampleButton>, {
        customProviders: [ThemeProvider, AuthProvider],
        enablePerformanceMonitoring: true,
        testName: 'multi-provider-test',
      })

      expect(screen.getByText('Multi-Provider Test')).toBeInTheDocument()
      expect(document.querySelector('[data-theme="dark"]')).toBeInTheDocument()
      expect(
        document.querySelector('[data-auth="authenticated"]')
      ).toBeInTheDocument()
    })

    it('should demonstrate performance monitoring usage', () => {
      const result = renderWithProviders(
        <ExampleDataTable
          data={Array.from({ length: 100 }, (_, i) => ({
            id: i,
            name: `Item ${i}`,
          }))}
          columns={['id', 'name']}
        />,
        {
          enablePerformanceMonitoring: true,
          testName: 'large-data-table-test',
        }
      )

      expect(screen.getByTestId('data-table')).toBeInTheDocument()

      // Check performance metrics
      const metrics =
        'getPerformanceMetrics' in result
          ? (
              result as { getPerformanceMetrics: () => unknown }
            ).getPerformanceMetrics()
          : null
      if (metrics) {
        expect((metrics as { renderTime: number }).renderTime).toBeDefined()
        expect(typeof (metrics as { renderTime: number }).renderTime).toBe(
          'number'
        )
      }
    })
  })

  describe('Error Handling Examples', () => {
    it('should handle components that throw errors gracefully', () => {
      const ErrorComponent: React.FC = () => {
        throw new Error('Component error')
      }

      // Suppress console.error for this test
      const originalError = console.error
      console.error = vi.fn()

      try {
        // React Router's error boundary catches the error and shows "Unexpected Application Error!"
        renderWithProviders(<ErrorComponent />)

        // The error boundary should render an error message
        expect(
          screen.getByText('Unexpected Application Error!')
        ).toBeInTheDocument()
      } finally {
        console.error = originalError
      }
    })

    it('should handle missing props gracefully', () => {
      // Test with minimal props
      expectBasicRendering(<ExampleCard title="Minimal Card" />)
    })
  })

  describe('Cleanup Examples', () => {
    it('should demonstrate manual cleanup', () => {
      const result = renderWithProviders(
        <ExampleButton>Manual Cleanup Test</ExampleButton>
      )

      expect(screen.getByText('Manual Cleanup Test')).toBeInTheDocument()

      // Manual cleanup
      if ('cleanup' in result) {
        result.cleanup()
      }
    })

    it('should demonstrate automatic cleanup with afterEach', () => {
      // This test relies on the afterEach hook calling cleanupAllResources()
      renderWithProviders(<ExampleButton>Auto Cleanup Test</ExampleButton>)

      expect(screen.getByText('Auto Cleanup Test')).toBeInTheDocument()
      // Cleanup happens automatically in afterEach
    })
  })
})

// Export example components for use in other test files
export { ExampleButton, ExampleCard, ExampleDataTable }
export type { ButtonProps, CardProps, DataTableProps }
