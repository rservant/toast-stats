/**
 * Toastmasters Accessibility Checker Component
 *
 * This component provides runtime accessibility validation for WCAG AA compliance.
 * It checks for contrast ratios, touch targets, and semantic markup.
 */

import React, { useEffect, useRef, useCallback } from 'react'
import { AccessibilityCheckerProps, ValidationError } from './types'
import {
  validateContrast,
  checkTouchTarget,
  getFontSizeInPixels,
  debounce,
} from './utils'

/**
 * AccessibilityChecker component for runtime accessibility validation
 */
export const AccessibilityChecker: React.FC<AccessibilityCheckerProps> = ({
  children,
  enableRuntimeChecks = typeof window !== 'undefined' &&
    window.location.hostname === 'localhost',
  checkContrast = true,
  checkTouchTargets = true,
  onAccessibilityViolation,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)

  const checkElementContrast = useCallback(
    (element: HTMLElement) => {
      if (!checkContrast) return

      const computedStyle = window.getComputedStyle(element)
      const color = computedStyle.color
      const backgroundColor = computedStyle.backgroundColor

      // Skip if no text content or transparent background
      if (
        !element.textContent?.trim() ||
        backgroundColor === 'rgba(0, 0, 0, 0)' ||
        backgroundColor === 'transparent'
      ) {
        return
      }

      // Convert RGB to hex for validation (simplified)
      const rgbToHex = (rgb: string): string => {
        const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
        if (!match) return rgb

        const [, r, g, b] = match
        return `#${parseInt(r).toString(16).padStart(2, '0')}${parseInt(g).toString(16).padStart(2, '0')}${parseInt(b).toString(16).padStart(2, '0')}`
      }

      const foregroundHex = color.startsWith('rgb') ? rgbToHex(color) : color
      const backgroundHex = backgroundColor.startsWith('rgb')
        ? rgbToHex(backgroundColor)
        : backgroundColor

      // Check if we have valid hex colors
      if (!foregroundHex.startsWith('#') || !backgroundHex.startsWith('#')) {
        return
      }

      const fontSize = getFontSizeInPixels(element)
      const isLargeText =
        fontSize >= 18 ||
        (fontSize >= 14 && computedStyle.fontWeight === 'bold')

      const contrastResult = validateContrast(
        foregroundHex,
        backgroundHex,
        isLargeText
      )

      if (!contrastResult.passes) {
        const error: ValidationError = {
          type: 'accessibility',
          severity: 'error',
          message: `Contrast ratio ${contrastResult.ratio}:1 does not meet WCAG AA standards (required: ${isLargeText ? '3.0' : '4.5'}:1)`,
          element,
          suggestion: `Consider using a different color combination. Current: ${foregroundHex} on ${backgroundHex}`,
        }

        console.error(
          'Accessibility Violation - Contrast:',
          error.message,
          element
        )

        if (onAccessibilityViolation) {
          onAccessibilityViolation(error)
        }
      }
    },
    [checkContrast, onAccessibilityViolation]
  )

  const checkElementTouchTarget = useCallback(
    (element: HTMLElement) => {
      if (!checkTouchTargets) return

      const tagName = element.tagName.toLowerCase()
      const isInteractive =
        ['button', 'a', 'input', 'select', 'textarea'].includes(tagName) ||
        element.getAttribute('role') === 'button' ||
        element.hasAttribute('onclick') ||
        element.tabIndex >= 0

      if (isInteractive) {
        const touchTargetResult = checkTouchTarget(element)

        if (!touchTargetResult.passes) {
          const error: ValidationError = {
            type: 'accessibility',
            severity: 'error',
            message: `Touch target ${touchTargetResult.width}x${touchTargetResult.height}px does not meet minimum 44px requirement`,
            element,
            suggestion:
              'Increase padding or minimum dimensions to meet 44px touch target requirement',
          }

          console.error(
            'Accessibility Violation - Touch Target:',
            error.message,
            element
          )

          if (onAccessibilityViolation) {
            onAccessibilityViolation(error)
          }
        }
      }
    },
    [checkTouchTargets, onAccessibilityViolation]
  )

  const checkSemanticMarkup = useCallback(
    (element: HTMLElement) => {
      const tagName = element.tagName.toLowerCase()

      // Check for proper heading hierarchy
      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
        const headingLevel = parseInt(tagName.charAt(1))
        const previousHeadings = Array.from(
          document.querySelectorAll('h1, h2, h3, h4, h5, h6')
        ).filter(
          h =>
            h !== element &&
            h.compareDocumentPosition(element) &
              Node.DOCUMENT_POSITION_FOLLOWING
        )

        if (previousHeadings.length > 0) {
          const lastHeading = previousHeadings[previousHeadings.length - 1]
          const lastLevel = parseInt(lastHeading.tagName.charAt(1))

          if (headingLevel > lastLevel + 1) {
            const error: ValidationError = {
              type: 'accessibility',
              severity: 'warning',
              message: `Heading hierarchy violation: ${tagName} follows ${lastHeading.tagName.toLowerCase()} (skipped levels)`,
              element,
              suggestion:
                'Use proper heading hierarchy (h1 → h2 → h3, etc.) without skipping levels',
            }

            console.warn(
              'Accessibility Violation - Heading Hierarchy:',
              error.message,
              element
            )

            if (onAccessibilityViolation) {
              onAccessibilityViolation(error)
            }
          }
        }
      }

      // Check for missing alt text on images
      if (tagName === 'img') {
        const alt = element.getAttribute('alt')
        const role = element.getAttribute('role')

        if (!alt && role !== 'presentation' && role !== 'none') {
          const error: ValidationError = {
            type: 'accessibility',
            severity: 'error',
            message: 'Image missing alt text',
            element,
            suggestion:
              'Add descriptive alt text or use role="presentation" for decorative images',
          }

          console.error(
            'Accessibility Violation - Missing Alt Text:',
            error.message,
            element
          )

          if (onAccessibilityViolation) {
            onAccessibilityViolation(error)
          }
        }
      }

      // Check for missing labels on form inputs
      if (['input', 'select', 'textarea'].includes(tagName)) {
        const id = element.getAttribute('id')
        const ariaLabel = element.getAttribute('aria-label')
        const ariaLabelledBy = element.getAttribute('aria-labelledby')

        let hasLabel = false

        if (id) {
          const label = document.querySelector(`label[for="${id}"]`)
          hasLabel = !!label
        }

        if (!hasLabel && !ariaLabel && !ariaLabelledBy) {
          const error: ValidationError = {
            type: 'accessibility',
            severity: 'error',
            message: 'Form input missing accessible label',
            element,
            suggestion:
              'Add a <label> element, aria-label, or aria-labelledby attribute',
          }

          console.error(
            'Accessibility Violation - Missing Label:',
            error.message,
            element
          )

          if (onAccessibilityViolation) {
            onAccessibilityViolation(error)
          }
        }
      }

      // Check for missing focus indicators
      if (
        element.tabIndex >= 0 ||
        ['button', 'a', 'input', 'select', 'textarea'].includes(tagName)
      ) {
        const computedStyle = window.getComputedStyle(element, ':focus-visible')
        const outline = computedStyle.outline
        const boxShadow = computedStyle.boxShadow

        if (
          outline === 'none' &&
          !boxShadow.includes('inset') &&
          !boxShadow.includes('0px')
        ) {
          const error: ValidationError = {
            type: 'accessibility',
            severity: 'warning',
            message: 'Interactive element may lack visible focus indicator',
            element,
            suggestion:
              'Ensure focus indicators are visible and meet contrast requirements',
          }

          console.warn(
            'Accessibility Violation - Focus Indicator:',
            error.message,
            element
          )

          if (onAccessibilityViolation) {
            onAccessibilityViolation(error)
          }
        }
      }
    },
    [onAccessibilityViolation]
  )

  const validateElement = useCallback(
    (element: HTMLElement) => {
      if (!enableRuntimeChecks) return

      try {
        checkElementContrast(element)
        checkElementTouchTarget(element)
        checkSemanticMarkup(element)
      } catch (error) {
        console.error('Error during accessibility validation:', error, element)
      }
    },
    [
      enableRuntimeChecks,
      checkElementContrast,
      checkElementTouchTarget,
      checkSemanticMarkup,
    ]
  )

  const validateAllElements = useCallback(
    debounce(() => {
      if (!containerRef.current || !enableRuntimeChecks) return

      // Get all elements within the container
      const elements = containerRef.current.querySelectorAll('*')

      elements.forEach(element => {
        if (element instanceof HTMLElement) {
          validateElement(element)
        }
      })
    }, 200),
    [validateElement, enableRuntimeChecks]
  )

  useEffect(() => {
    if (!enableRuntimeChecks) return

    // Initial validation after a short delay to allow rendering
    const timeoutId = setTimeout(() => {
      validateAllElements()
    }, 100)

    // Set up mutation observer to watch for changes
    const observer = new MutationObserver(mutations => {
      let shouldValidate = false

      mutations.forEach(mutation => {
        if (mutation.type === 'childList' || mutation.type === 'attributes') {
          shouldValidate = true
        }
      })

      if (shouldValidate) {
        validateAllElements()
      }
    })

    if (containerRef.current) {
      observer.observe(containerRef.current, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: [
          'style',
          'class',
          'aria-label',
          'aria-labelledby',
          'alt',
          'role',
        ],
      })
    }

    return () => {
      clearTimeout(timeoutId)
      observer.disconnect()
    }
  }, [enableRuntimeChecks, validateAllElements])

  // If runtime checks are disabled, just render children without wrapper
  if (!enableRuntimeChecks) {
    return <>{children}</>
  }

  return (
    <div ref={containerRef} data-accessibility-checker="true">
      {children}
    </div>
  )
}

/**
 * Higher-order component to wrap components with accessibility checking
 */
export const withAccessibilityChecking = <P extends object>(
  Component: React.ComponentType<P>
): React.FC<P & Partial<AccessibilityCheckerProps>> => {
  const WrappedComponent: React.FC<P & Partial<AccessibilityCheckerProps>> = ({
    enableRuntimeChecks,
    checkContrast,
    checkTouchTargets,
    onAccessibilityViolation,
    ...props
  }) => (
    <AccessibilityChecker
      enableRuntimeChecks={enableRuntimeChecks}
      checkContrast={checkContrast}
      checkTouchTargets={checkTouchTargets}
      onAccessibilityViolation={onAccessibilityViolation}
    >
      <Component {...(props as P)} />
    </AccessibilityChecker>
  )

  WrappedComponent.displayName = `withAccessibilityChecking(${Component.displayName || Component.name})`

  return WrappedComponent
}

export default AccessibilityChecker
