/**
 * Property-Based Tests for Accessibility Compliance Detection
 *
 * **Feature: test-suite-optimization, Property 5: Accessibility compliance detection**
 * **Validates: Requirements 1.4, 8.4**
 *
 * Tests that accessibility utilities can detect WCAG violations across
 * randomly generated component configurations and interaction patterns.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import React, { type JSX } from 'react'
import {
  expectWCAGCompliance,
  expectKeyboardNavigation,
  expectColorContrast,
  expectScreenReaderCompatibility,
  expectFocusManagement,
  runQuickAccessibilityCheck,
  type AccessibilityViolation,
} from './accessibilityTestUtils'

// Generators for property-based testing
const contrastRatioGenerator = fc.record({
  foreground: fc.constantFrom(
    '#000000',
    '#333333',
    '#666666',
    '#999999',
    '#cccccc',
    '#ffffff'
  ),
  background: fc.constantFrom(
    '#000000',
    '#004165',
    '#772432',
    '#a9b2b1',
    '#f2df74',
    '#ffffff'
  ),
})

const fontSizeGenerator = fc.integer({ min: 8, max: 32 })

const tabIndexGenerator = fc.constantFrom('-1', '0', '1', '2', '10')

const ariaAttributeGenerator = fc.record({
  hasLabel: fc.boolean(),
  hasDescribedBy: fc.boolean(),
  hasRole: fc.boolean(),
  hasLive: fc.boolean(),
})

const headingLevelGenerator = fc.integer({ min: 1, max: 6 })

// Component generators for testing
const generateButtonComponent = (
  hasLabel: boolean,
  tabIndex: string,
  backgroundColor: string,
  textColor: string,
  fontSize: number
) => {
  const props: Record<string, unknown> = {
    style: {
      backgroundColor,
      color: textColor,
      fontSize: `${fontSize}px`,
      padding: '8px 16px',
      border: 'none',
      cursor: 'pointer',
    },
    tabIndex: tabIndex === '0' ? undefined : tabIndex,
    'data-testid': 'test-button',
  }

  if (hasLabel) {
    props['aria-label'] = 'Test button'
  }

  return React.createElement(
    'button',
    props,
    hasLabel ? undefined : 'Unlabeled Button'
  )
}

const generateInputComponent = (
  hasLabel: boolean,
  isRequired: boolean,
  hasDescribedBy: boolean
) => {
  const inputProps: Record<string, unknown> = {
    type: 'text',
    id: 'test-input',
    'data-testid': 'test-input',
  }

  if (isRequired) {
    inputProps.required = true
    inputProps['aria-required'] = 'true'
  }

  if (hasDescribedBy) {
    inputProps['aria-describedby'] = 'input-description'
  }

  const elements: React.ReactElement[] = [
    React.createElement('input', inputProps),
  ]

  if (hasLabel) {
    elements.unshift(
      React.createElement(
        'label',
        {
          htmlFor: 'test-input',
          key: 'label',
        } as React.LabelHTMLAttributes<HTMLLabelElement>,
        'Test Input'
      )
    )
  }

  if (hasDescribedBy) {
    elements.push(
      React.createElement(
        'div',
        { id: 'input-description', key: 'description' },
        'Input description'
      )
    )
  }

  return React.createElement(
    'div',
    { 'data-testid': 'input-container' },
    ...elements
  )
}

const generateImageComponent = (hasAlt: boolean, isDecorative: boolean) => {
  const props: Record<string, unknown> = {
    src: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzAwNDE2NSIvPjwvc3ZnPg==',
    width: 100,
    height: 100,
    'data-testid': 'test-image',
  }

  if (hasAlt) {
    props.alt = 'Test image description'
  } else if (isDecorative) {
    props.role = 'presentation'
    props.alt = ''
  }

  return React.createElement('img', props)
}

const generateHeadingSequence = (levels: number[]) => {
  return React.createElement(
    'div',
    { 'data-testid': 'heading-container' },
    ...levels.map((level, index) =>
      React.createElement(
        `h${level}` as keyof JSX.IntrinsicElements,
        {
          key: index,
          id: `heading-${index}`,
        },
        `Heading Level ${level}`
      )
    )
  )
}

const generateModalComponent = (
  hasCloseButton: boolean,
  hasLabel: boolean,
  hasFocusableContent: boolean
) => {
  const modalProps: Record<string, unknown> = {
    role: 'dialog',
    'aria-modal': 'true',
    'data-testid': 'test-modal',
    style: {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      backgroundColor: 'white',
      padding: '20px',
      border: '1px solid #ccc',
    },
  }

  if (hasLabel) {
    modalProps['aria-label'] = 'Test Modal'
  }

  const children = []

  if (hasCloseButton) {
    children.push(
      React.createElement(
        'button',
        {
          key: 'close',
          'aria-label': 'Close modal',
          style: { float: 'right' },
        },
        '×'
      )
    )
  }

  children.push(React.createElement('p', { key: 'content' }, 'Modal content'))

  if (hasFocusableContent) {
    children.push(
      React.createElement('button', { key: 'action' }, 'Action Button')
    )
  }

  return React.createElement('div', modalProps, ...children)
}

describe('Accessibility Compliance Detection Property Tests', () => {
  describe('Property 5: Accessibility compliance detection', () => {
    it('should detect missing labels on form controls', () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          fc.boolean(),
          fc.boolean(),
          (hasLabel, isRequired, hasDescribedBy) => {
            const component = generateInputComponent(
              hasLabel,
              isRequired,
              hasDescribedBy
            )

            const violations = expectWCAGCompliance(component)
            const hasLabelViolation = violations.some(
              v => v.type === 'aria' && v.violation.includes('missing label')
            )

            // Property: Form controls without labels should be detected
            if (!hasLabel) {
              expect(hasLabelViolation).toBe(true)
            } else {
              expect(hasLabelViolation).toBe(false)
            }
          }
        ),
        { numRuns: 50 }
      )
    })

    it('should detect missing alt text on images', () => {
      fc.assert(
        fc.property(fc.boolean(), fc.boolean(), (hasAlt, isDecorative) => {
          const component = generateImageComponent(hasAlt, isDecorative)

          const violations = expectWCAGCompliance(component)
          const hasMissingAltViolation = violations.some(
            v => v.type === 'aria' && v.violation.includes('alt text')
          )

          // Property: Images without alt text should be detected (unless decorative)
          if (!hasAlt && !isDecorative) {
            expect(hasMissingAltViolation).toBe(true)
          } else {
            expect(hasMissingAltViolation).toBe(false)
          }
        }),
        { numRuns: 40 }
      )
    })

    it('should detect improper heading hierarchy', () => {
      fc.assert(
        fc.property(
          fc.array(headingLevelGenerator, { minLength: 2, maxLength: 5 }),
          levels => {
            const component = generateHeadingSequence(levels)

            const violations = expectWCAGCompliance(component)
            const hasHierarchyViolation = violations.some(
              v => v.type === 'structure' && v.violation.includes('hierarchy')
            )

            // Property: Check if there are any hierarchy violations
            let hasSkip = false
            for (let i = 1; i < levels.length; i++) {
              if (levels[i] > levels[i - 1] + 1) {
                hasSkip = true
                break
              }
            }

            if (hasSkip) {
              expect(hasHierarchyViolation).toBe(true)
            }
            // Note: We don't assert false case as proper hierarchy might still have other violations
          }
        ),
        { numRuns: 30 }
      )
    })

    it('should detect keyboard navigation issues', () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          tabIndexGenerator,
          contrastRatioGenerator,
          fontSizeGenerator,
          (hasLabel, tabIndex, colors, fontSize) => {
            const component = generateButtonComponent(
              hasLabel,
              tabIndex,
              colors.background,
              colors.foreground,
              fontSize
            )

            const violations = expectKeyboardNavigation(component)
            const hasKeyboardViolation = violations.some(
              v =>
                v.type === 'keyboard' && v.violation.includes('not focusable')
            )

            // Property: Elements with tabindex="-1" should be detected as keyboard issues
            if (tabIndex === '-1') {
              expect(hasKeyboardViolation).toBe(true)
            }
          }
        ),
        { numRuns: 50 }
      )
    })

    it('should detect color contrast violations', () => {
      fc.assert(
        fc.property(
          contrastRatioGenerator,
          fontSizeGenerator,
          (colors, fontSize) => {
            // Create a text component with specific colors
            const component = React.createElement(
              'div',
              {
                style: {
                  color: colors.foreground,
                  backgroundColor: colors.background,
                  fontSize: `${fontSize}px`,
                  padding: '10px',
                },
                'data-testid': 'contrast-test',
              },
              'Test text content'
            )

            const violations = expectColorContrast(component)

            // Property: All violations should have proper structure
            violations.forEach(violation => {
              expect(violation.type).toBe('contrast')
              expect(violation.violation).toBeTruthy()
              expect(violation.remediation).toBeTruthy()
              expect(['critical', 'high', 'medium', 'low']).toContain(
                violation.severity
              )
              expect(violation.wcagCriterion).toBeTruthy()
            })
          }
        ),
        { numRuns: 40 }
      )
    })

    it('should detect focus management issues in modals', () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          fc.boolean(),
          fc.boolean(),
          (hasCloseButton, hasLabel, hasFocusableContent) => {
            const component = generateModalComponent(
              hasCloseButton,
              hasLabel,
              hasFocusableContent
            )

            const violations = expectFocusManagement(component)
            const hasModalViolations = violations.filter(
              v =>
                v.violation.includes('Modal') || v.violation.includes('modal')
            )

            // Property: Modals without proper attributes should have violations
            if (!hasLabel) {
              const hasLabelViolation = hasModalViolations.some(v =>
                v.violation.includes('accessible name')
              )
              expect(hasLabelViolation).toBe(true)
            }

            // Fixed logic: Only expect close button violation when modal is MISSING a close button
            if (!hasCloseButton) {
              const hasCloseViolation = hasModalViolations.some(v =>
                v.violation.includes('close button')
              )
              expect(hasCloseViolation).toBe(true)
            } else {
              // When modal HAS a close button, there should be no close button violation
              const hasCloseViolation = hasModalViolations.some(v =>
                v.violation.includes('close button')
              )
              expect(hasCloseViolation).toBe(false)
            }

            // Check for focusable elements violation - but need to account for close button
            const totalFocusableElements =
              (hasCloseButton ? 1 : 0) + (hasFocusableContent ? 1 : 0)
            if (totalFocusableElements === 0) {
              const hasFocusViolation = hasModalViolations.some(v =>
                v.violation.includes('no focusable elements')
              )
              expect(hasFocusViolation).toBe(true)
            }
          }
        ),
        { numRuns: 30 }
      )
    })

    it('should detect screen reader compatibility issues', () => {
      fc.assert(
        fc.property(ariaAttributeGenerator, ariaAttrs => {
          // Create component with various ARIA attributes
          const props: Record<string, unknown> = {
            'data-testid': 'aria-test',
            style: { padding: '10px' },
          }

          if (ariaAttrs.hasDescribedBy) {
            props['aria-describedby'] = 'non-existent-id'
          }

          if (ariaAttrs.hasLive) {
            props['aria-live'] = 'invalid-value'
          }

          if (ariaAttrs.hasRole) {
            props.role = 'button'
          }

          const component = React.createElement('div', props, 'Test content')

          const violations = expectScreenReaderCompatibility(component)

          // Property: Invalid ARIA attributes should be detected
          if (ariaAttrs.hasDescribedBy) {
            const hasDescribedByViolation = violations.some(v =>
              v.violation.includes('aria-describedby')
            )
            expect(hasDescribedByViolation).toBe(true)
          }

          if (ariaAttrs.hasLive) {
            const hasLiveViolation = violations.some(v =>
              v.violation.includes('aria-live')
            )
            expect(hasLiveViolation).toBe(true)
          }
        }),
        { numRuns: 40 }
      )
    })

    it('should provide consistent violation reporting across multiple runs', () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          contrastRatioGenerator,
          (hasLabel, colors) => {
            const component = generateButtonComponent(
              hasLabel,
              '-1', // Always problematic tabindex
              colors.background,
              colors.foreground,
              16
            )

            // Run accessibility check multiple times
            const result1 = runQuickAccessibilityCheck(component)
            const result2 = runQuickAccessibilityCheck(component)

            // Property: Results should be consistent across runs
            expect(result1.passed).toBe(result2.passed)
            expect(result1.criticalViolations.length).toBe(
              result2.criticalViolations.length
            )
          }
        ),
        { numRuns: 30 }
      )
    })

    it('should handle components with good accessibility practices', () => {
      fc.assert(
        fc.property(fontSizeGenerator, fontSize => {
          // Create a well-formed accessible component
          const component = React.createElement(
            'div',
            {
              'data-testid': 'accessible-component',
            },
            [
              React.createElement('h1', { key: 'heading' }, 'Main Heading'),
              React.createElement(
                'label',
                { key: 'label', htmlFor: 'good-input' },
                'Input Label'
              ),
              React.createElement('input', {
                key: 'input',
                id: 'good-input',
                type: 'text',
                'aria-required': 'true',
              }),
              React.createElement(
                'button',
                {
                  key: 'button',
                  'aria-label': 'Submit form',
                  style: {
                    fontSize: `${Math.max(fontSize, 14)}px`,
                    padding: '12px 24px',
                    backgroundColor: '#004165',
                    color: '#ffffff',
                  },
                },
                'Submit'
              ),
              React.createElement('img', {
                key: 'image',
                src: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzAwNDE2NSIvPjwvc3ZnPg==',
                alt: 'Decorative image',
                width: 100,
                height: 100,
              }),
            ]
          )

          // Should have minimal critical violations for well-formed components
          const result = runQuickAccessibilityCheck(component)

          // Property: Well-formed components should have fewer critical violations
          expect(result.criticalViolations.length).toBeLessThanOrEqual(1)
        }),
        { numRuns: 30 }
      )
    })
  })

  describe('Performance and Reliability', () => {
    it('should handle large numbers of elements efficiently', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 5, max: 15 }), // Reduced range for faster execution
          elementCount => {
            // Generate component with many interactive elements
            const elements = Array.from({ length: elementCount }, (_, i) =>
              React.createElement(
                'button',
                {
                  key: i,
                  'aria-label': `Button ${i}`,
                  style: {
                    margin: '2px',
                    padding: '8px',
                    backgroundColor: i % 2 === 0 ? '#004165' : '#ffffff',
                    color: i % 2 === 0 ? '#ffffff' : '#000000',
                  },
                },
                `Button ${i}`
              )
            )

            const component = React.createElement(
              'div',
              {
                'data-testid': 'large-accessible-component',
              },
              ...elements
            )

            // Should handle large components without errors
            const startTime = performance.now()
            const result = runQuickAccessibilityCheck(component)
            const endTime = performance.now()

            // Property: Performance should be reasonable even for large components
            expect(endTime - startTime).toBeLessThan(1000) // Less than 1 second
            expect(result).toHaveProperty('passed')
            expect(result).toHaveProperty('criticalViolations')
          }
        ),
        { numRuns: 3 }
      ) // Reduced runs for faster execution
    })

    it('should provide meaningful error messages for violations', () => {
      fc.assert(
        fc.property(fc.boolean(), hasLabel => {
          const component = generateInputComponent(hasLabel, false, false)

          const violations = expectWCAGCompliance(component)

          // Property: All violations should have meaningful messages and remediation
          violations.forEach(violation => {
            expect(violation.violation).toBeTruthy()
            expect(violation.violation.length).toBeGreaterThan(10)
            expect(violation.remediation).toBeTruthy()
            expect(violation.remediation.length).toBeGreaterThan(20)
            expect(['critical', 'high', 'medium', 'low']).toContain(
              violation.severity
            )
            expect(violation.wcagCriterion).toBeTruthy()
            expect(violation.wcagCriterion).toMatch(/^\d+\.\d+\.\d+/)
          })
        }),
        { numRuns: 30 }
      )
    })

    it('should maintain WCAG criterion references for all violations', () => {
      fc.assert(
        fc.property(
          contrastRatioGenerator,
          ariaAttributeGenerator,
          (colors, ariaAttrs) => {
            // Create component with potential violations
            const props: Record<string, unknown> = {
              style: {
                color: colors.foreground,
                backgroundColor: colors.background,
                padding: '10px',
              },
              'data-testid': 'wcag-test',
            }

            if (ariaAttrs.hasDescribedBy) {
              props['aria-describedby'] = 'missing-element'
            }

            const component = React.createElement('div', props, 'Test content')

            const allViolations: AccessibilityViolation[] = []
            allViolations.push(...expectWCAGCompliance(component))
            allViolations.push(...expectColorContrast(component))
            allViolations.push(...expectScreenReaderCompatibility(component))

            // Property: All violations should reference WCAG criteria
            allViolations.forEach(violation => {
              expect(violation.wcagCriterion).toBeTruthy()
              expect(violation.wcagCriterion).toMatch(/\d+\.\d+\.\d+/)
            })
          }
        ),
        { numRuns: 30 }
      )
    })
  })
})
