import { render, cleanup } from '@testing-library/react'
import fc from 'fast-check'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Alert } from '../../components/ui/Alert'
import { Navigation } from '../../components/Navigation'
import { Header } from '../../components/Header'
import StatCard from '../../components/StatCard'
import { safeString, safeClassName } from '../test-string-generators'

/**
 * Property test for Component Design Consistency
 *
 * **Property 6: Component Design Consistency**
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**
 *
 * This property test ensures that all components follow established design patterns:
 * - Primary buttons use TM Loyal Blue (#004165)
 * - Cards use TM Cool Gray (#A9B2B1) backgrounds
 * - Navigation uses TM Loyal Blue with white text
 * - Status indicators use appropriate brand colors
 * - All components maintain brand compliance
 *
 * **Feature: toastmasters-brand-compliance, Property 6: Component Design Consistency**
 */

// Test data generators
const buttonVariantArb = fc.constantFrom(
  'primary',
  'secondary',
  'accent',
  'ghost'
)
const buttonSizeArb = fc.constantFrom('sm', 'md', 'lg')
const cardVariantArb = fc.constantFrom('default', 'elevated', 'outlined')
const cardPaddingArb = fc.constantFrom('sm', 'md', 'lg')
const alertVariantArb = fc.constantFrom(
  'success',
  'warning',
  'error',
  'info',
  'highlight'
)
const headerVariantArb = fc.constantFrom('primary', 'secondary')

describe('Component Design Consistency Property Tests', () => {
  afterEach(() => {
    cleanup()
  })

  it('Property 6.1: Primary buttons always use TM Loyal Blue background', () => {
    fc.assert(
      fc.property(
        buttonSizeArb,
        safeString(1, 20),
        safeClassName(),
        (size, children, className) => {
          const { container } = render(
            <Button variant="primary" size={size} className={className}>
              {children}
            </Button>
          )

          const button = container.querySelector('button')
          expect(button).toBeInTheDocument()

          // Check for brand-compliant classes
          expect(button).toHaveClass('tm-bg-loyal-blue')
          expect(button).toHaveClass('tm-text-white')

          // Verify minimum touch target
          expect(button).toHaveClass('min-h-[44px]')

          // Verify brand typography
          expect(button).toHaveClass('tm-nav') // Uses headline font
          expect(button).toHaveClass('font-semibold')

          cleanup()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 6.2: Secondary buttons use TM Loyal Blue border with transparent background', () => {
    fc.assert(
      fc.property(
        buttonSizeArb,
        safeString(1, 20),
        safeClassName(),
        (size, children, className) => {
          const { container } = render(
            <Button variant="secondary" size={size} className={className}>
              {children}
            </Button>
          )

          const button = container.querySelector('button')
          expect(button).toBeInTheDocument()

          // Check for brand-compliant classes
          expect(button).toHaveClass('bg-transparent')
          expect(button).toHaveClass('tm-text-loyal-blue')
          expect(button).toHaveClass('border-2')
          expect(button).toHaveClass('border-current')

          // Verify minimum touch target
          expect(button).toHaveClass('min-h-[44px]')

          cleanup()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 6.3: Accent buttons use TM Happy Yellow background with black text', () => {
    fc.assert(
      fc.property(
        buttonSizeArb,
        safeString(1, 20),
        safeClassName(),
        (size, children, className) => {
          const { container } = render(
            <Button variant="accent" size={size} className={className}>
              {children}
            </Button>
          )

          const button = container.querySelector('button')
          expect(button).toBeInTheDocument()

          // Check for brand-compliant classes
          expect(button).toHaveClass('tm-bg-happy-yellow')
          expect(button).toHaveClass('tm-text-black')

          // Verify minimum touch target
          expect(button).toHaveClass('min-h-[44px]')

          cleanup()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 6.4: Cards use brand-compliant styling and structure', () => {
    fc.assert(
      fc.property(
        cardVariantArb,
        cardPaddingArb,
        safeString(1, 50),
        safeClassName(),
        (variant, padding, children, className) => {
          const { container } = render(
            <Card variant={variant} padding={padding} className={className}>
              {children}
            </Card>
          )

          const card = container.querySelector('div')
          expect(card).toBeInTheDocument()

          // Check for brand-compliant base classes
          expect(card).toHaveClass('tm-card')
          expect(card).toHaveClass('tm-brand-compliant')

          // Check variant-specific classes
          expect(card).toHaveClass(`tm-card-${variant}`)
          expect(card).toHaveClass(`tm-card-padding-${padding}`)

          cleanup()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 6.5: Alert components use appropriate brand colors for each variant', () => {
    fc.assert(
      fc.property(
        alertVariantArb,
        safeString(1, 50),
        safeClassName(),
        (variant, children, className) => {
          const { container } = render(
            <Alert variant={variant} className={className}>
              {children}
            </Alert>
          )

          const alert = container.querySelector('div[role="alert"]')
          expect(alert).toBeInTheDocument()

          // Check for brand-compliant base classes
          expect(alert).toHaveClass('tm-alert')
          expect(alert).toHaveClass('tm-brand-compliant')
          expect(alert).toHaveClass('tm-body')

          // Check variant-specific brand colors
          switch (variant) {
            case 'success':
              expect(alert).toHaveClass('tm-alert-success')
              expect(alert).toHaveClass('bg-tm-loyal-blue-10')
              expect(alert).toHaveClass('border-tm-loyal-blue')
              break
            case 'warning':
            case 'error':
              expect(alert).toHaveClass(`tm-alert-${variant}`)
              expect(alert).toHaveClass('bg-tm-true-maroon-10')
              expect(alert).toHaveClass('border-tm-true-maroon')
              break
            case 'info':
              expect(alert).toHaveClass('tm-alert-info')
              expect(alert).toHaveClass('bg-tm-cool-gray-20')
              expect(alert).toHaveClass('border-tm-cool-gray')
              break
            case 'highlight':
              expect(alert).toHaveClass('tm-alert-highlight')
              expect(alert).toHaveClass('bg-tm-happy-yellow-20')
              expect(alert).toHaveClass('border-tm-happy-yellow')
              break
          }

          // All alerts should have black text for proper contrast
          expect(alert).toHaveClass('text-tm-black')

          cleanup()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 6.6: Navigation components use TM Loyal Blue background with white text', () => {
    fc.assert(
      fc.property(safeString(1, 50), safeClassName(), (children, className) => {
        const { container } = render(
          <Navigation className={className}>{children}</Navigation>
        )

        const nav = container.querySelector('nav')
        expect(nav).toBeInTheDocument()

        // Check for brand-compliant classes
        expect(nav).toHaveClass('tm-bg-loyal-blue')
        expect(nav).toHaveClass('tm-text-white')

        // Check for proper semantic markup
        expect(nav).toHaveAttribute('role', 'navigation')
        expect(nav).toHaveAttribute('aria-label')

        cleanup()
      }),
      { numRuns: 100 }
    )
  })

  it('Property 6.7: Header components use appropriate brand colors based on variant', () => {
    fc.assert(
      fc.property(
        headerVariantArb,
        safeString(1, 50),
        safeClassName(),
        (variant, children, className) => {
          const { container } = render(
            <Header variant={variant} className={className}>
              {children}
            </Header>
          )

          const header = container.querySelector('header')
          expect(header).toBeInTheDocument()

          // Check for proper semantic markup
          expect(header).toHaveAttribute('role', 'banner')

          // Check variant-specific brand colors
          if (variant === 'primary') {
            expect(header).toHaveClass('tm-bg-loyal-blue')
            expect(header).toHaveClass('tm-text-white')
          } else if (variant === 'secondary') {
            expect(header).toHaveClass('tm-bg-cool-gray')
            expect(header).toHaveClass('tm-text-black')
          }

          cleanup()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 6.8: StatCard components use brand-compliant styling and colors', () => {
    fc.assert(
      fc.property(
        safeString(1, 20),
        fc.oneof(fc.string(), fc.integer()),
        fc.constantFrom('positive', 'negative', 'neutral'),
        fc.option(fc.float({ min: -100, max: 100 }), { nil: undefined }),
        (name, value, trend, changePercent) => {
          const { container } = render(
            <StatCard
              name={name}
              value={value}
              trend={trend}
              changePercent={changePercent}
            />
          )

          const card = container.querySelector('div')
          expect(card).toBeInTheDocument()

          // Check for brand-compliant typography
          const nameElement = container.querySelector('h3')
          expect(nameElement).toHaveClass('tm-body-small')
          expect(nameElement).toHaveClass('tm-text-cool-gray')

          const valueElement = container.querySelector('p[aria-live="polite"]')
          expect(valueElement).toHaveClass('tm-h2')
          expect(valueElement).toHaveClass('tm-text-black')

          // Check trend colors if present
          if (changePercent !== undefined) {
            const trendElement = container.querySelector('[role="status"]')
            expect(trendElement).toBeInTheDocument()

            if (trend === 'positive') {
              expect(trendElement).toHaveClass('tm-text-loyal-blue')
              expect(trendElement).toHaveClass('tm-bg-loyal-blue-10')
            } else if (trend === 'negative') {
              expect(trendElement).toHaveClass('tm-text-true-maroon')
              expect(trendElement).toHaveClass('tm-bg-true-maroon-10')
            } else {
              expect(trendElement).toHaveClass('tm-text-cool-gray')
              expect(trendElement).toHaveClass('tm-bg-cool-gray-20')
            }
          }

          cleanup()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 6.9: All interactive components meet minimum touch target requirements', () => {
    fc.assert(
      fc.property(
        buttonVariantArb,
        buttonSizeArb,
        safeString(1, 20),
        (variant, size, children) => {
          const { container } = render(
            <Button variant={variant} size={size}>
              {children}
            </Button>
          )

          const button = container.querySelector('button')
          expect(button).toBeInTheDocument()

          // All buttons should have minimum 44px height
          expect(button).toHaveClass('min-h-[44px]')

          // All buttons should have touch target class
          expect(button).toHaveClass('tm-touch-target')

          cleanup()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 6.10: All components use brand typography consistently', () => {
    fc.assert(
      fc.property(safeString(1, 20), children => {
        // Test Button typography
        const { container: buttonContainer } = render(
          <Button>{children}</Button>
        )
        const button = buttonContainer.querySelector('button')
        expect(button).toHaveClass('tm-nav') // Headline font
        expect(button).toHaveClass('font-semibold')
        cleanup()

        // Test Alert typography
        const { container: alertContainer } = render(<Alert>{children}</Alert>)
        const alert = alertContainer.querySelector('div[role="alert"]')
        expect(alert).toHaveClass('tm-body') // Body font
        cleanup()
      }),
      { numRuns: 100 }
    )
  })

  it('Property 6.11: Components maintain brand compliance markers', () => {
    fc.assert(
      fc.property(safeString(1, 50), safeClassName(), (children, className) => {
        // Test Card brand compliance
        const { container: cardContainer } = render(
          <Card className={className}>{children}</Card>
        )
        const card = cardContainer.querySelector('div')
        expect(card).toHaveClass('tm-brand-compliant')
        cleanup()

        // Test Alert brand compliance
        const { container: alertContainer } = render(
          <Alert className={className}>{children}</Alert>
        )
        const alert = alertContainer.querySelector('div[role="alert"]')
        expect(alert).toHaveClass('tm-brand-compliant')
        cleanup()
      }),
      { numRuns: 100 }
    )
  })

  it('Property 6.12: Focus indicators use brand-compliant colors', () => {
    fc.assert(
      fc.property(buttonVariantArb, safeString(1, 20), (variant, children) => {
        const { container } = render(
          <Button variant={variant}>{children}</Button>
        )

        const button = container.querySelector('button')
        expect(button).toBeInTheDocument()

        // All buttons should have focus-visible classes
        expect(button).toHaveClass('focus-visible:outline-2')
        expect(button).toHaveClass('focus-visible:outline-offset-2')

        // Focus outline colors should be brand-appropriate based on variant
        if (variant === 'primary') {
          expect(button).toHaveClass('focus-visible:outline-white')
        } else if (variant === 'accent') {
          expect(button).toHaveClass('focus-visible:outline-tm-black')
        } else {
          expect(button).toHaveClass('focus-visible:outline-tm-loyal-blue')
        }

        cleanup()
      }),
      { numRuns: 100 }
    )
  })
})
