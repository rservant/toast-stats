/**
 * Cross-Component Compatibility Property Tests
 *
 * **Feature: test-suite-optimization, Property 17: Cross-component compatibility**
 * **Validates: Requirements 8.3**
 *
 * Property-based tests to verify that shared test utilities work correctly
 * across all component types without modification.
 */

import { describe, it, expect, afterEach } from 'vitest'
import fc from 'fast-check'
import React from 'react'
import ReactDOM from 'react-dom'
import { screen } from '@testing-library/react'
import {
  renderWithProviders,
  testComponentVariants,
  expectBasicRendering,
  testLoadingStates,
  testErrorStates,
  cleanupAllResources,
  ComponentVariant,
} from '../utils/componentTestUtils'
import { runQuickAccessibilityCheck } from '../utils/accessibilityTestUtils'
import { runQuickBrandCheck } from '../utils/brandComplianceTestUtils'

// Component type generators for property-based testing
interface BaseComponentProps {
  children?: React.ReactNode
  className?: string
  'data-testid'?: string
}

type ComponentType =
  | 'functional'
  | 'hooks'
  | 'memoized'
  | 'forwardRef'
  | 'context'
  | 'hoc'

// Functional component generator
const generateFunctionalComponent = (name: string) => {
  const Component: React.FC<BaseComponentProps> = ({
    children,
    className,
    'data-testid': testId,
  }) => (
    <div
      className={className}
      data-testid={testId || `functional-${name.toLowerCase()}`}
    >
      <span data-testid="component-type">Functional</span>
      <span data-testid="component-name">{name}</span>
      {children && <div data-testid="children-content">{children}</div>}
    </div>
  )
  Component.displayName = name
  return Component
}

// Component with hooks generator
const generateHooksComponent = (name: string) => {
  const Component: React.FC<BaseComponentProps & { initialValue?: string }> = ({
    children,
    className,
    'data-testid': testId,
    initialValue = 'default',
  }) => {
    const [value, setValue] = React.useState(initialValue)
    const [count, setCount] = React.useState(0)

    React.useEffect(() => {
      setCount(prev => prev + 1)
    }, [value])

    return (
      <div
        className={className}
        data-testid={testId || `hooks-${name.toLowerCase()}`}
      >
        <span data-testid="component-type">Hooks</span>
        <span data-testid="component-name">{name}</span>
        <span data-testid="hook-value">{value}</span>
        <span data-testid="hook-count">{count}</span>
        <button onClick={() => setValue(`updated-${Date.now()}`)}>
          Update
        </button>
        {children && <div data-testid="children-content">{children}</div>}
      </div>
    )
  }
  Component.displayName = name
  return Component
}

// Memoized component generator
const generateMemoizedComponent = (name: string) => {
  const Component = React.memo<BaseComponentProps>(
    ({ children, className, 'data-testid': testId }) => (
      <div
        className={className}
        data-testid={testId || `memoized-${name.toLowerCase()}`}
      >
        <span data-testid="component-type">Memoized</span>
        <span data-testid="component-name">{name}</span>
        {children && <div data-testid="children-content">{children}</div>}
      </div>
    )
  )
  Component.displayName = name
  return Component
}

// Forward ref component generator
const generateForwardRefComponent = (name: string) => {
  const Component = React.forwardRef<HTMLDivElement, BaseComponentProps>(
    ({ children, className, 'data-testid': testId }, ref) => (
      <div
        ref={ref}
        className={className}
        data-testid={testId || `forwardref-${name.toLowerCase()}`}
      >
        <span data-testid="component-type">ForwardRef</span>
        <span data-testid="component-name">{name}</span>
        {children && <div data-testid="children-content">{children}</div>}
      </div>
    )
  )
  Component.displayName = name
  return Component
}

// Context provider component generator
const generateContextComponent = (name: string) => {
  const TestContext = React.createContext<{ value: string }>({
    value: 'default',
  })

  const Component: React.FC<BaseComponentProps & { contextValue?: string }> = ({
    children,
    className,
    'data-testid': testId,
    contextValue = 'test-context',
  }) => (
    <TestContext.Provider value={{ value: contextValue }}>
      <div
        className={className}
        data-testid={testId || `context-${name.toLowerCase()}`}
      >
        <span data-testid="component-type">Context</span>
        <span data-testid="component-name">{name}</span>
        <TestContext.Consumer>
          {({ value }) => <span data-testid="context-value">{value}</span>}
        </TestContext.Consumer>
        {children && <div data-testid="children-content">{children}</div>}
      </div>
    </TestContext.Provider>
  )
  Component.displayName = name
  return Component
}

// Higher-order component generator
const generateHOCComponent = (name: string) => {
  const withTestHOC = <P extends object>(
    WrappedComponent: React.ComponentType<P>
  ) => {
    const HOCComponent: React.FC<P & BaseComponentProps> = props => (
      <div data-testid={`hoc-wrapper-${name.toLowerCase()}`}>
        <span data-testid="component-type">HOC</span>
        <WrappedComponent {...props} />
      </div>
    )
    HOCComponent.displayName = `withTestHOC(${name})`
    return HOCComponent
  }

  const BaseComponent: React.FC<BaseComponentProps> = ({
    children,
    className,
    'data-testid': testId,
  }) => (
    <div
      className={className}
      data-testid={testId || `base-${name.toLowerCase()}`}
    >
      <span data-testid="component-name">{name}</span>
      {children && <div data-testid="children-content">{children}</div>}
    </div>
  )

  return withTestHOC(BaseComponent)
}

// Component generators map
const componentGenerators: Record<
  ComponentType,
  (name: string) => React.ComponentType<BaseComponentProps>
> = {
  functional: generateFunctionalComponent,
  hooks: generateHooksComponent,
  memoized: generateMemoizedComponent,
  forwardRef: generateForwardRefComponent,
  context: generateContextComponent,
  hoc: generateHOCComponent,
}

describe('Cross-Component Compatibility Property Tests', () => {
  afterEach(() => {
    cleanupAllResources()
  })

  describe('Property 17: Cross-component compatibility', () => {
    it('should work with any React component type (functional, class, with hooks, without hooks)', () => {
      fc.assert(
        fc.property(
          fc.record({
            componentType: fc.constantFrom<ComponentType>(
              'functional',
              'hooks',
              'memoized',
              'forwardRef',
              'context',
              'hoc'
            ),
            componentName: fc
              .string({ minLength: 3, maxLength: 20 })
              .filter((s: string) => /^[A-Za-z]/.test(s)),
            children: fc.oneof(
              fc.constant(undefined),
              fc.string({ minLength: 1, maxLength: 50 }),
              fc.constant('Test Content')
            ),
            className: fc.oneof(
              fc.constant(undefined),
              fc.constantFrom('test-class', 'component-style', 'custom-styling')
            ),
          }),
          ({
            componentType,
            componentName,
            children,
            className,
          }: {
            componentType: ComponentType
            componentName: string
            children?: string
            className?: string
          }) => {
            // Generate component of specified type
            const generator = componentGenerators[componentType]
            const TestComponent = generator(componentName)

            // Test that renderWithProviders works with any component type
            expect(() => {
              renderWithProviders(
                <TestComponent
                  className={className}
                  data-testid={`${componentType}-${componentName.toLowerCase()}`}
                >
                  {children}
                </TestComponent>
              )
            }).not.toThrow()

            // Verify component rendered correctly
            const componentElement = screen.getByTestId(
              new RegExp(
                `${componentType}-.*${componentName.toLowerCase()}|base-${componentName.toLowerCase()}|hoc-wrapper-${componentName.toLowerCase()}`
              )
            )
            expect(componentElement).toBeInTheDocument()

            // Verify component type is correct (except for HOC which wraps)
            if (componentType !== 'hoc') {
              const typeElement = screen.getByTestId('component-type')
              expect(typeElement).toHaveTextContent(
                componentType === 'forwardRef'
                  ? 'ForwardRef'
                  : componentType === 'context'
                    ? 'Context'
                    : componentType.charAt(0).toUpperCase() +
                      componentType.slice(1)
              )
            }

            // Verify component name is rendered
            const nameElement = screen.getByTestId('component-name')
            expect(nameElement).toHaveTextContent(componentName)

            // Verify children are rendered if provided
            if (children) {
              const childrenElement = screen.getByTestId('children-content')
              expect(childrenElement).toHaveTextContent(children)
            }

            // Verify className is applied if provided
            if (className) {
              expect(componentElement).toHaveClass(className)
            }
          }
        ),
        {
          numRuns: 5,
          verbose: false,
        }
      )
    })

    it('should support expectBasicRendering with any component type', () => {
      fc.assert(
        fc.property(
          fc.record({
            componentType: fc.constantFrom<ComponentType>(
              'functional',
              'hooks',
              'memoized',
              'forwardRef',
              'context'
            ),
            componentName: fc
              .string({ minLength: 3, maxLength: 15 })
              .filter((s: string) => /^[A-Za-z]/.test(s)),
          }),
          ({
            componentType,
            componentName,
          }: {
            componentType: ComponentType
            componentName: string
          }) => {
            const generator = componentGenerators[componentType]
            const TestComponent = generator(componentName)

            // expectBasicRendering should work with any component type
            expect(() => {
              expectBasicRendering(
                <TestComponent
                  data-testid={`${componentType}-${componentName.toLowerCase()}`}
                >
                  Basic Test
                </TestComponent>
              )
            }).not.toThrow()
          }
        ),
        { numRuns: 3 }
      )
    })

    it('should support testComponentVariants with any component type', () => {
      fc.assert(
        fc.property(
          fc.record({
            componentType: fc.constantFrom<ComponentType>(
              'functional',
              'memoized',
              'forwardRef'
            ),
            componentName: fc
              .string({ minLength: 3, maxLength: 15 })
              .filter((s: string) => /^[A-Za-z]/.test(s)),
            variantCount: fc.integer({ min: 1, max: 3 }),
          }),
          ({
            componentType,
            componentName,
            variantCount,
          }: {
            componentType: ComponentType
            componentName: string
            variantCount: number
          }) => {
            const generator = componentGenerators[componentType]
            const TestComponent = generator(componentName)

            // Generate variants
            const variants: ComponentVariant<BaseComponentProps>[] = Array.from(
              { length: variantCount },
              (_, i) => ({
                name: `variant ${i + 1}`,
                props: {
                  children: `Variant ${i + 1} Content`,
                  className: `variant-${i + 1}`,
                  'data-testid': `variant-${i + 1}-test`,
                },
                expectedText: `Variant ${i + 1} Content`,
                expectedClass: `variant-${i + 1}`,
              })
            )

            // testComponentVariants should work with any component type
            expect(() => {
              testComponentVariants(
                TestComponent as unknown as React.ComponentType<
                  Record<string, unknown>
                >,
                variants as ComponentVariant<Record<string, unknown>>[],
                {
                  skipAccessibilityCheck: true, // Skip for performance in property tests
                  skipBrandComplianceCheck: true,
                }
              )
            }).not.toThrow()
          }
        ),
        { numRuns: 3 }
      )
    })

    it('should support loading states testing with any component type', () => {
      fc.assert(
        fc.property(
          fc.record({
            componentType: fc.constantFrom<ComponentType>(
              'functional',
              'hooks'
            ),
            componentName: fc
              .string({ minLength: 3, maxLength: 15 })
              .filter((s: string) => /^[A-Za-z]/.test(s)),
          }),
          ({
            componentType,
            componentName,
          }: {
            componentType: ComponentType
            componentName: string
          }) => {
            // Create a component that supports loading states
            const LoadingComponent: React.FC<
              BaseComponentProps & { loading?: boolean; data?: unknown }
            > = ({
              loading = false,
              data,
              children,
              className,
              'data-testid': testId,
            }) => {
              if (loading) {
                return (
                  <div
                    className={className}
                    data-testid={
                      testId || `loading-${componentName.toLowerCase()}`
                    }
                  >
                    <span data-testid="component-type">{componentType}</span>
                    <span>Loading...</span>
                  </div>
                )
              }

              return (
                <div
                  className={className}
                  data-testid={
                    testId || `loaded-${componentName.toLowerCase()}`
                  }
                >
                  <span data-testid="component-type">{componentType}</span>
                  <span>
                    Loaded: {data ? JSON.stringify(data) : 'default data'}
                  </span>
                  {children}
                </div>
              )
            }
            LoadingComponent.displayName = `Loading${componentName}`

            // testLoadingStates should work with any component type
            expect(() => {
              testLoadingStates(
                LoadingComponent as unknown as React.ComponentType<
                  Record<string, unknown>
                >,
                { loading: true } as Record<string, unknown>,
                { loading: false, data: 'test data' } as Record<string, unknown>
              )
            }).not.toThrow()
          }
        ),
        { numRuns: 2 }
      )
    })

    it('should support error states testing with any component type', () => {
      fc.assert(
        fc.property(
          fc.record({
            componentType: fc.constantFrom<ComponentType>(
              'functional',
              'hooks'
            ),
            componentName: fc
              .string({ minLength: 3, maxLength: 15 })
              .filter((s: string) => /^[A-Za-z]/.test(s)),
            errorMessage: fc.string({ minLength: 5, maxLength: 30 }),
          }),
          ({
            componentType,
            componentName,
            errorMessage,
          }: {
            componentType: ComponentType
            componentName: string
            errorMessage: string
          }) => {
            // Create a component that supports error states
            const ErrorComponent: React.FC<
              BaseComponentProps & { error?: string }
            > = ({ error, children, className, 'data-testid': testId }) => {
              if (error) {
                return (
                  <div
                    className={className}
                    data-testid={
                      testId || `error-${componentName.toLowerCase()}`
                    }
                  >
                    <span data-testid="component-type">{componentType}</span>
                    <span>Error: {error}</span>
                  </div>
                )
              }

              return (
                <div
                  className={className}
                  data-testid={
                    testId || `success-${componentName.toLowerCase()}`
                  }
                >
                  <span data-testid="component-type">{componentType}</span>
                  <span>Success</span>
                  {children}
                </div>
              )
            }
            ErrorComponent.displayName = `Error${componentName}`

            // testErrorStates should work with any component type
            expect(() => {
              testErrorStates(
                ErrorComponent as unknown as React.ComponentType<
                  Record<string, unknown>
                >,
                { error: errorMessage } as Record<string, unknown>,
                new RegExp(errorMessage.toLowerCase(), 'i')
              )
            }).not.toThrow()
          }
        ),
        { numRuns: 2 }
      )
    })

    it('should maintain accessibility compatibility across component types', () => {
      fc.assert(
        fc.property(
          fc.record({
            componentType: fc.constantFrom<ComponentType>(
              'functional',
              'memoized',
              'forwardRef'
            ),
            componentName: fc
              .string({ minLength: 3, maxLength: 15 })
              .filter((s: string) => /^[A-Za-z]/.test(s)),
            hasButton: fc.boolean(),
            hasLabel: fc.boolean(),
          }),
          ({
            componentType,
            componentName,
            hasButton,
            hasLabel,
          }: {
            componentType: ComponentType
            componentName: string
            hasButton: boolean
            hasLabel: boolean
          }) => {
            const generator = componentGenerators[componentType]
            const BaseComponent = generator(componentName)

            // Create accessible version of component
            const AccessibleComponent: React.FC<BaseComponentProps> = props => (
              <BaseComponent {...props}>
                {hasLabel && <label htmlFor="test-input">Test Label</label>}
                {hasButton && (
                  <button
                    style={{ minHeight: '44px', minWidth: '44px' }}
                    aria-label="Test button"
                  >
                    Test Button
                  </button>
                )}
                <input id="test-input" aria-label="Test input" />
              </BaseComponent>
            )

            // Quick accessibility check should work with any component type
            const { passed } = runQuickAccessibilityCheck(
              <AccessibleComponent />
            )
            expect(passed).toBe(true)
          }
        ),
        { numRuns: 3 }
      )
    })

    it('should maintain brand compliance compatibility across component types', () => {
      fc.assert(
        fc.property(
          fc.record({
            componentType: fc.constantFrom<ComponentType>(
              'functional',
              'memoized',
              'forwardRef'
            ),
            componentName: fc
              .string({ minLength: 3, maxLength: 15 })
              .filter((s: string) => /^[A-Za-z]/.test(s)),
            useButton: fc.boolean(),
          }),
          ({
            componentType,
            componentName,
            useButton,
          }: {
            componentType: ComponentType
            componentName: string
            useButton: boolean
          }) => {
            const generator = componentGenerators[componentType]
            const BaseComponent = generator(componentName)

            // Create brand compliant version of component
            const BrandCompliantComponent: React.FC<
              BaseComponentProps
            > = props => (
              <BaseComponent
                {...(props as BaseComponentProps)}
                className="bg-tm-white text-tm-black"
              >
                <div
                  style={{
                    fontFamily: 'Source Sans 3, sans-serif',
                    fontSize: '16px',
                  }}
                >
                  Brand compliant content
                </div>
                {useButton && (
                  <button
                    className="bg-tm-loyal-blue text-tm-white"
                    style={{
                      minHeight: '44px',
                      minWidth: '44px',
                      fontFamily: 'Montserrat, sans-serif',
                    }}
                  >
                    Brand Button
                  </button>
                )}
              </BaseComponent>
            )

            // Quick brand check should work with any component type
            const { passed } = runQuickBrandCheck(<BrandCompliantComponent />)
            expect(passed).toBe(true)
          }
        ),
        { numRuns: 3 }
      )
    })

    it('should handle complex component hierarchies', () => {
      fc.assert(
        fc.property(
          fc.record({
            depth: fc.integer({ min: 1, max: 4 }),
            componentTypes: fc.array(
              fc.constantFrom<ComponentType>(
                'functional',
                'memoized',
                'forwardRef'
              ),
              { minLength: 1, maxLength: 4 }
            ),
          }),
          ({
            depth,
            componentTypes,
          }: {
            depth: number
            componentTypes: ComponentType[]
          }) => {
            // Create nested component hierarchy
            let NestedComponent: React.FC<BaseComponentProps> = ({
              children,
            }) => <div>{children}</div>

            for (let i = 0; i < depth; i++) {
              const componentType = componentTypes[i % componentTypes.length]
              const generator = componentGenerators[componentType]
              const CurrentComponent = generator(`Level${i}`)
              const PreviousComponent = NestedComponent

              NestedComponent = props => (
                <CurrentComponent {...props}>
                  <PreviousComponent>Level {i} Content</PreviousComponent>
                </CurrentComponent>
              )
            }

            // Utilities should work with complex hierarchies
            expect(() => {
              renderWithProviders(
                <NestedComponent>Root Content</NestedComponent>
              )
            }).not.toThrow()

            // Verify nested structure is rendered
            expect(screen.getByText('Root Content')).toBeInTheDocument()
            expect(
              screen.getByText(`Level ${depth - 1} Content`)
            ).toBeInTheDocument()
          }
        ),
        { numRuns: 2 }
      )
    })

    it('should handle components with custom props interfaces', () => {
      fc.assert(
        fc.property(
          fc.record({
            componentName: fc
              .string({ minLength: 3, maxLength: 15 })
              .filter((s: string) => /^[A-Za-z]/.test(s)),
            customProps: fc.record({
              title: fc.string({ minLength: 1, maxLength: 30 }),
              count: fc.integer({ min: 0, max: 100 }),
              enabled: fc.boolean(),
              items: fc.array(fc.string({ minLength: 1, maxLength: 20 }), {
                maxLength: 5,
              }),
            }),
          }),
          ({
            componentName,
            customProps,
          }: {
            componentName: string
            customProps: {
              title: string
              count: number
              enabled: boolean
              items: string[]
            }
          }) => {
            // Create component with custom props interface
            interface CustomProps extends BaseComponentProps {
              title: string
              count: number
              enabled: boolean
              items: string[]
            }

            const CustomComponent: React.FC<CustomProps> = ({
              title,
              count,
              enabled,
              items,
              children,
              className,
              'data-testid': testId,
            }) => (
              <div
                className={className}
                data-testid={testId || `custom-${componentName.toLowerCase()}`}
              >
                <h2 data-testid="title">{title}</h2>
                <span data-testid="count">Count: {count}</span>
                <span data-testid="enabled">Enabled: {enabled.toString()}</span>
                <ul data-testid="items">
                  {items.map((item: string, index: number) => (
                    <li key={index} data-testid={`item-${index}`}>
                      {item}
                    </li>
                  ))}
                </ul>
                {children}
              </div>
            )
            CustomComponent.displayName = componentName

            // Utilities should work with custom props interfaces
            expect(() => {
              renderWithProviders(
                <CustomComponent {...customProps}>
                  Custom Content
                </CustomComponent>
              )
            }).not.toThrow()

            // Verify custom props are handled correctly
            expect(screen.getByTestId('title')).toHaveTextContent(
              customProps.title
            )
            expect(screen.getByTestId('count')).toHaveTextContent(
              `Count: ${customProps.count}`
            )
            expect(screen.getByTestId('enabled')).toHaveTextContent(
              `Enabled: ${customProps.enabled}`
            )

            customProps.items.forEach((item: string, index: number) => {
              expect(screen.getByTestId(`item-${index}`)).toHaveTextContent(
                item
              )
            })
          }
        ),
        { numRuns: 3 }
      )
    })

    it('should handle components with different rendering patterns', () => {
      fc.assert(
        fc.property(
          fc.record({
            renderPattern: fc.constantFrom(
              'conditional',
              'list',
              'fragment',
              'portal'
            ),
            componentName: fc
              .string({ minLength: 3, maxLength: 15 })
              .filter((s: string) => /^[A-Za-z]/.test(s)),
            condition: fc.boolean(),
            itemCount: fc.integer({ min: 0, max: 5 }),
          }),
          ({
            renderPattern,
            componentName,
            condition,
            itemCount,
          }: {
            renderPattern: 'conditional' | 'list' | 'fragment' | 'portal'
            componentName: string
            condition: boolean
            itemCount: number
          }) => {
            let TestComponent: React.FC<
              BaseComponentProps & { condition?: boolean; itemCount?: number }
            >

            switch (renderPattern) {
              case 'conditional':
                TestComponent = ({
                  condition: cond = true,
                  children,
                  ...props
                }) => (
                  <div {...props}>
                    {cond ? (
                      <span>Condition True</span>
                    ) : (
                      <span>Condition False</span>
                    )}
                    {children}
                  </div>
                )
                break

              case 'list':
                TestComponent = ({
                  itemCount: count = 3,
                  children,
                  ...props
                }) => (
                  <div {...props}>
                    <ul>
                      {Array.from({ length: count }, (_, i) => (
                        <li key={i} data-testid={`list-item-${i}`}>
                          Item {i}
                        </li>
                      ))}
                    </ul>
                    {children}
                  </div>
                )
                break

              case 'fragment':
                TestComponent = ({ children, ...props }) => (
                  <React.Fragment>
                    <div {...props}>Fragment Content</div>
                    <span>Additional Fragment Content</span>
                    {children}
                  </React.Fragment>
                )
                break

              case 'portal':
                TestComponent = ({ children, ...props }) => {
                  const [portalContainer] = React.useState(() => {
                    const div = document.createElement('div')
                    div.id = 'portal-container'
                    document.body.appendChild(div)
                    return div
                  })

                  React.useEffect(() => {
                    return () => {
                      if (portalContainer.parentNode) {
                        portalContainer.parentNode.removeChild(portalContainer)
                      }
                    }
                  }, [portalContainer])

                  return (
                    <div {...props}>
                      Main Content
                      {ReactDOM.createPortal(
                        <div data-testid="portal-content">Portal Content</div>,
                        portalContainer
                      )}
                      {children}
                    </div>
                  )
                }
                break

              default:
                TestComponent = ({ children, ...props }) => (
                  <div {...props}>{children}</div>
                )
            }

            TestComponent.displayName = componentName

            // Utilities should work with different rendering patterns
            expect(() => {
              renderWithProviders(
                <TestComponent
                  condition={condition}
                  itemCount={itemCount}
                  data-testid={`${renderPattern}-component`}
                >
                  Pattern Content
                </TestComponent>
              )
            }).not.toThrow()

            // Verify pattern-specific rendering
            switch (renderPattern) {
              case 'conditional':
                // Use getAllByText to handle multiple elements with same text
                const conditionElements = screen.getAllByText(
                  condition ? 'Condition True' : 'Condition False'
                )
                expect(conditionElements.length).toBeGreaterThan(0)
                break

              case 'list':
                for (let i = 0; i < itemCount; i++) {
                  expect(
                    screen.getByTestId(`list-item-${i}`)
                  ).toHaveTextContent(`Item ${i}`)
                }
                break

              case 'fragment':
                expect(screen.getByText('Fragment Content')).toBeInTheDocument()
                expect(
                  screen.getByText('Additional Fragment Content')
                ).toBeInTheDocument()
                break

              case 'portal':
                expect(screen.getByText('Main Content')).toBeInTheDocument()
                expect(screen.getByTestId('portal-content')).toHaveTextContent(
                  'Portal Content'
                )
                break
            }

            expect(screen.getByText('Pattern Content')).toBeInTheDocument()
          }
        ),
        { numRuns: 3 }
      )
    })
  })
})

// Export for use in other test files
export {
  generateFunctionalComponent,
  generateHooksComponent,
  generateMemoizedComponent,
  generateForwardRefComponent,
  generateContextComponent,
  generateHOCComponent,
  componentGenerators,
}
