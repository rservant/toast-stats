/**
 * Toastmasters Brand Validator Component
 *
 * This component provides development-time validation for brand compliance.
 * It checks components for proper color usage, typography, and design patterns.
 */

import React, { useEffect, useRef, useCallback } from 'react'
import { BrandValidatorProps, ValidationRule, ValidationError } from './types'
import {
  isBrandColor,
  getClosestBrandColor,
  hasProhibitedTextEffects,
  isBrandFont,
  meetsMinimumFontSize,
  meetsMinimumLineHeight,
  getFontFamily,
} from './utils'

/**
 * Default validation rules for brand compliance
 */
const defaultValidationRules: ValidationRule[] = [
  // Color Validation Rules
  {
    id: 'CV001',
    type: 'color',
    severity: 'error',
    message: 'Only brand palette colors are allowed',
    check: (element: HTMLElement) => {
      const computedStyle = window.getComputedStyle(element)
      const backgroundColor = computedStyle.backgroundColor
      const color = computedStyle.color

      // Convert RGB to hex for checking (simplified)
      const rgbToHex = (rgb: string): string => {
        const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
        if (!match) return rgb

        const [, r, g, b] = match
        return `#${parseInt(r).toString(16).padStart(2, '0')}${parseInt(g).toString(16).padStart(2, '0')}${parseInt(b).toString(16).padStart(2, '0')}`
      }

      const bgHex = backgroundColor.startsWith('rgb')
        ? rgbToHex(backgroundColor)
        : backgroundColor
      const colorHex = color.startsWith('rgb') ? rgbToHex(color) : color

      return (
        (backgroundColor === 'rgba(0, 0, 0, 0)' ||
          backgroundColor === 'transparent' ||
          isBrandColor(bgHex)) &&
        (color === 'rgba(0, 0, 0, 0)' ||
          color === 'transparent' ||
          isBrandColor(colorHex))
      )
    },
    autoFix: (element: HTMLElement) => {
      const computedStyle = window.getComputedStyle(element)
      const backgroundColor = computedStyle.backgroundColor
      const color = computedStyle.color

      if (
        backgroundColor !== 'rgba(0, 0, 0, 0)' &&
        backgroundColor !== 'transparent' &&
        !isBrandColor(backgroundColor)
      ) {
        const closestColor = getClosestBrandColor(backgroundColor)
        element.style.backgroundColor = closestColor
      }

      if (
        color !== 'rgba(0, 0, 0, 0)' &&
        color !== 'transparent' &&
        !isBrandColor(color)
      ) {
        const closestColor = getClosestBrandColor(color)
        element.style.color = closestColor
      }
    },
  },

  // Typography Validation Rules
  {
    id: 'TV001',
    type: 'typography',
    severity: 'error',
    message: 'Headlines must use Montserrat font family',
    check: (element: HTMLElement) => {
      const tagName = element.tagName.toLowerCase()
      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
        const fontFamily = getFontFamily(element)
        return (
          isBrandFont(fontFamily) &&
          fontFamily.toLowerCase().includes('montserrat')
        )
      }
      return true
    },
  },

  {
    id: 'TV002',
    type: 'typography',
    severity: 'error',
    message: 'Body text must use Source Sans 3 font family',
    check: (element: HTMLElement) => {
      const tagName = element.tagName.toLowerCase()
      if (
        ['p', 'span', 'div', 'label', 'input', 'textarea'].includes(tagName)
      ) {
        const fontFamily = getFontFamily(element)
        return (
          isBrandFont(fontFamily) &&
          (fontFamily.toLowerCase().includes('source sans') ||
            fontFamily.toLowerCase().includes('montserrat')) // Allow Montserrat for special cases
        )
      }
      return true
    },
  },

  {
    id: 'TV003',
    type: 'typography',
    severity: 'error',
    message: 'Minimum 14px font size required for body text',
    check: (element: HTMLElement) => {
      const tagName = element.tagName.toLowerCase()
      if (
        ['p', 'span', 'div', 'label', 'input', 'textarea'].includes(tagName)
      ) {
        return meetsMinimumFontSize(element)
      }
      return true
    },
  },

  {
    id: 'TV004',
    type: 'typography',
    severity: 'error',
    message: 'Minimum 1.4 line-height ratio required',
    check: (element: HTMLElement) => {
      return meetsMinimumLineHeight(element)
    },
  },

  {
    id: 'TV005',
    type: 'typography',
    severity: 'error',
    message:
      'Prohibited text effects detected (drop-shadow, word-art, distort, outline, glow)',
    check: (element: HTMLElement) => {
      return !hasProhibitedTextEffects(element)
    },
  },

  // Accessibility Validation Rules
  {
    id: 'AV001',
    type: 'accessibility',
    severity: 'error',
    message: 'Interactive elements must have minimum 44px touch targets',
    check: (element: HTMLElement) => {
      const tagName = element.tagName.toLowerCase()
      const isInteractive =
        ['button', 'a', 'input', 'select', 'textarea'].includes(tagName) ||
        element.getAttribute('role') === 'button' ||
        element.hasAttribute('onclick') ||
        element.tabIndex >= 0

      if (isInteractive) {
        const rect = element.getBoundingClientRect()
        return rect.width >= 44 && rect.height >= 44
      }
      return true
    },
    autoFix: (element: HTMLElement) => {
      const rect = element.getBoundingClientRect()
      if (rect.width < 44) {
        element.style.minWidth = '44px'
      }
      if (rect.height < 44) {
        element.style.minHeight = '44px'
      }
    },
  },
]

/**
 * BrandValidator component for development-time validation
 */
export const BrandValidator: React.FC<BrandValidatorProps> = ({
  children,
  enableValidation = typeof window !== 'undefined' &&
    window.location.hostname === 'localhost',
  validationRules = defaultValidationRules,
  onValidationError,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)

  const validateElement = useCallback(
    (element: HTMLElement) => {
      if (!enableValidation) return

      validationRules.forEach(rule => {
        try {
          const passes = rule.check(element)

          if (!passes) {
            const error: ValidationError = {
              type: rule.type,
              severity: rule.severity,
              message: `${rule.id}: ${rule.message}`,
              element,
              suggestion: rule.autoFix
                ? 'Auto-fix available'
                : 'Manual fix required',
            }

            // Log the error
            if (rule.severity === 'error') {
              console.error('Brand Compliance Error:', error.message, element)
            } else if (rule.severity === 'warning') {
              console.warn('Brand Compliance Warning:', error.message, element)
            } else {
              console.info('Brand Compliance Info:', error.message, element)
            }

            // Call the error handler if provided
            if (onValidationError) {
              onValidationError(error)
            }

            // Apply auto-fix if available and enabled
            if (rule.autoFix && rule.severity === 'error') {
              rule.autoFix(element)
            }
          }
        } catch (error) {
          console.error('Error during brand validation:', error, element)
        }
      })
    },
    [enableValidation, validationRules, onValidationError]
  )

  const validateAllElements = useCallback(() => {
    if (!containerRef.current || !enableValidation) return

    // Get all elements within the container
    const elements = containerRef.current.querySelectorAll('*')

    elements.forEach(element => {
      if (element instanceof HTMLElement) {
        validateElement(element)
      }
    })
  }, [validateElement, enableValidation])

  useEffect(() => {
    if (!enableValidation) return

    // Initial validation
    validateAllElements()

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
        attributeFilter: ['style', 'class'],
      })
    }

    return () => {
      observer.disconnect()
    }
  }, [enableValidation, validateAllElements])

  // If validation is disabled, just render children without wrapper
  if (!enableValidation) {
    return <>{children}</>
  }

  return (
    <div ref={containerRef} data-brand-validator="true">
      {children}
    </div>
  )
}

/**
 * Higher-order component to wrap components with brand validation
 */
// eslint-disable-next-line react-refresh/only-export-components
export const withBrandValidation = <P extends object>(
  Component: React.ComponentType<P>
): React.FC<P & Partial<BrandValidatorProps>> => {
  const WrappedComponent: React.FC<P & Partial<BrandValidatorProps>> = ({
    enableValidation,
    validationRules,
    onValidationError,
    ...props
  }) => (
    <BrandValidator
      enableValidation={enableValidation}
      validationRules={validationRules}
      onValidationError={onValidationError}
    >
      <Component {...(props as P)} />
    </BrandValidator>
  )

  WrappedComponent.displayName = `withBrandValidation(${Component.displayName || Component.name})`

  return WrappedComponent
}

export default BrandValidator
