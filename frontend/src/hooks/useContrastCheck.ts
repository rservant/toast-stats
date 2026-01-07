/**
 * Contrast Check Hook
 *
 * This hook provides utilities for checking and validating color contrast
 * ratios with proper contrast ratios for focus indicators and text.
 *
 * Requirements: 3.1, 3.4 - Accessibility Compliance and Focus Indicators
 */

import React, { useCallback, useEffect, useState } from 'react'
import {
  calculateContrastRatio,
  validateContrastRatio,
  getAllColorCombinations,
  generateHighContrastColor,
  type ContrastValidationResult,
} from '../utils/contrastCalculator'

export interface ContrastCheckOptions {
  checkOnMount?: boolean
  checkOnResize?: boolean
  autoFix?: boolean
  onViolation?: (result: ContrastValidationResult) => void
}

export interface FocusIndicatorResult {
  element: HTMLElement
  focusColor: string
  backgroundColor: string
  contrastRatio: number
  passes: boolean
  recommendation?: string
}

/**
 * Hook for checking and validating color contrast ratios
 */
export function useContrastCheck(options: ContrastCheckOptions = {}) {
  const { checkOnMount = true, checkOnResize = false, onViolation } = options

  const [violations, setViolations] = useState<ContrastValidationResult[]>([])
  const [isChecking, setIsChecking] = useState(false)

  /**
   * Check contrast ratio between two colors
   */
  const checkContrast = useCallback(
    (
      foreground: string,
      background: string,
      isLargeText = false
    ): ContrastValidationResult => {
      return validateContrastRatio(foreground, background, isLargeText)
    },
    []
  )

  /**
   * Validate all color combinations in a container
   */
  const validateAllContrasts = useCallback(
    (container: HTMLElement = document.body): ContrastValidationResult[] => {
      setIsChecking(true)

      const combinations = getAllColorCombinations(container)
      const results: ContrastValidationResult[] = []

      combinations.forEach(({ foreground, background, element }) => {
        const isLargeText = isElementLargeText(element)
        const result = validateContrastRatio(
          foreground,
          background,
          isLargeText
        )

        results.push(result)

        if (!result.passes) {
          if (onViolation) {
            onViolation(result)
          }

          // Auto-fix will be handled separately to avoid circular dependencies
        }
      })

      setViolations(results.filter(r => !r.passes))
      setIsChecking(false)

      return results
    },
    [onViolation]
  )

  /**
   * Check focus indicator for a specific element
   */
  const checkFocusIndicator = useCallback(
    (element: HTMLElement): FocusIndicatorResult => {
      const backgroundColor = getEffectiveBackgroundColor(element)

      // Temporarily focus the element to get focus styles
      const originalFocus = document.activeElement
      element.focus()

      const focusStyle = window.getComputedStyle(element, ':focus')
      const focusOutlineColor = focusStyle.outlineColor
      const focusBorderColor = focusStyle.borderColor
      const focusBoxShadow = focusStyle.boxShadow

      // Restore original focus
      if (originalFocus && originalFocus instanceof HTMLElement) {
        originalFocus.focus()
      } else {
        element.blur()
      }

      // Determine focus indicator color
      let focusColor = '#000000' // Default fallback

      if (
        focusOutlineColor &&
        focusOutlineColor !== 'transparent' &&
        focusOutlineColor !== 'rgba(0, 0, 0, 0)'
      ) {
        focusColor = rgbStringToHex(focusOutlineColor) || focusColor
      } else if (
        focusBorderColor &&
        focusBorderColor !== 'transparent' &&
        focusBorderColor !== 'rgba(0, 0, 0, 0)'
      ) {
        focusColor = rgbStringToHex(focusBorderColor) || focusColor
      } else if (focusBoxShadow && focusBoxShadow !== 'none') {
        // Extract color from box-shadow
        const shadowColorMatch = focusBoxShadow.match(/rgba?\([^)]+\)/)
        if (shadowColorMatch) {
          focusColor = rgbStringToHex(shadowColorMatch[0]) || focusColor
        }
      }

      const contrastRatio = calculateContrastRatio(focusColor, backgroundColor)
      const passes = contrastRatio >= 3.0 // WCAG AA requirement for focus indicators

      let recommendation: string | undefined
      if (!passes) {
        recommendation = `Focus indicator contrast ratio ${contrastRatio.toFixed(2)}:1 is below WCAG AA requirement of 3:1. Consider using a higher contrast color for focus indicators.`
      }

      return {
        element,
        focusColor,
        backgroundColor,
        contrastRatio,
        passes,
        ...(recommendation && { recommendation }),
      }
    },
    []
  )

  /**
   * Check focus indicators for all interactive elements
   */
  const validateFocusIndicators = useCallback(
    (container: HTMLElement = document.body): FocusIndicatorResult[] => {
      const interactiveElements = container.querySelectorAll(
        'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"]), [role="button"], [role="link"]'
      )

      const results: FocusIndicatorResult[] = []

      interactiveElements.forEach(element => {
        const htmlElement = element as HTMLElement
        const result = checkFocusIndicator(htmlElement)
        results.push(result)

        if (!result.passes && onViolation) {
          onViolation({
            ratio: result.contrastRatio,
            passes: result.passes,
            level: result.passes ? 'AA' : 'fail',
            foreground: result.focusColor,
            background: result.backgroundColor,
            ...(result.recommendation && {
              recommendation: result.recommendation,
            }),
          })
        }
      })

      return results
    },
    [onViolation, checkFocusIndicator]
  )

  /**
   * Generate accessible color suggestions
   */
  const suggestAccessibleColors = useCallback(
    (backgroundColor: string, isLargeText = false): string[] => {
      const suggestions: string[] = []
      const requiredRatio = isLargeText ? 3.0 : 4.5

      // Common accessible colors to test
      const testColors = [
        '#000000', // Black
        '#ffffff', // White
        '#004165', // TM Loyal Blue
        '#772432', // TM True Maroon
        '#333333', // Dark gray
        '#666666', // Medium gray
        '#1a1a1a', // Very dark gray
        '#f5f5f5', // Light gray
      ]

      testColors.forEach(color => {
        const ratio = calculateContrastRatio(color, backgroundColor)
        if (ratio >= requiredRatio) {
          suggestions.push(color)
        }
      })

      // If no suggestions found, generate high contrast color
      if (suggestions.length === 0) {
        const highContrastColor = generateHighContrastColor(backgroundColor)
        suggestions.push(highContrastColor)
      }

      return suggestions
    },
    []
  )

  /**
   * Auto-fix contrast violations
   */
  const fixContrastViolation = useCallback(
    (element: HTMLElement, violation: ContrastValidationResult) => {
      const suggestions = suggestAccessibleColors(
        violation.background,
        violation.isLargeText
      )
      if (suggestions.length > 0 && suggestions[0]) {
        element.style.color = suggestions[0]
      }
    },
    [suggestAccessibleColors]
  )

  /**
   * Get current violations
   */
  const getCurrentViolations = useCallback(() => {
    return violations
  }, [violations])

  /**
   * Clear all violations
   */
  const clearViolations = useCallback(() => {
    setViolations([])
  }, [])

  // Auto-check on mount if enabled
  useEffect(() => {
    if (checkOnMount) {
      // Use setTimeout to avoid synchronous setState in effect
      const timeoutId = setTimeout(() => {
        validateAllContrasts()
      }, 0)
      return () => clearTimeout(timeoutId)
    }
    return undefined
  }, [checkOnMount, validateAllContrasts])

  // Handle resize if enabled
  useEffect(() => {
    if (!checkOnResize) return

    const handleResize = () => {
      validateAllContrasts()
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [checkOnResize, validateAllContrasts])

  return {
    checkContrast,
    validateAllContrasts,
    validateFocusIndicators,
    checkFocusIndicator,
    suggestAccessibleColors,
    fixContrastViolation,
    getCurrentViolations,
    clearViolations,
    violations,
    isChecking,
  }
}

/**
 * Hook for automatically validating contrast in a container
 */
export function useAutoContrastValidation(
  containerRef: React.RefObject<HTMLElement>,
  options: ContrastCheckOptions = {}
) {
  const contrastCheck = useContrastCheck(options)

  useEffect(() => {
    if (!containerRef.current) return

    contrastCheck.validateAllContrasts(containerRef.current)
  }, [containerRef, contrastCheck])

  return contrastCheck
}

// Helper functions

/**
 * Check if an element contains large text
 */
function isElementLargeText(element: HTMLElement): boolean {
  const computedStyle = window.getComputedStyle(element)
  const fontSize = parseFloat(computedStyle.fontSize)
  const fontWeight = computedStyle.fontWeight

  // Convert to points (1pt = 1.33px approximately)
  const fontSizeInPoints = fontSize * 0.75

  // Large text is 18pt+ or 14pt+ bold
  return (
    fontSizeInPoints >= 18 ||
    (fontSizeInPoints >= 14 &&
      (fontWeight === 'bold' ||
        fontWeight === '700' ||
        fontWeight === '800' ||
        fontWeight === '900' ||
        parseInt(fontWeight) >= 700))
  )
}

/**
 * Get effective background color by traversing up the DOM tree
 */
function getEffectiveBackgroundColor(element: HTMLElement): string {
  let current: HTMLElement | null = element

  while (current && current !== document.body) {
    const computedStyle = window.getComputedStyle(current)
    const backgroundColor = computedStyle.backgroundColor

    if (
      backgroundColor &&
      backgroundColor !== 'rgba(0, 0, 0, 0)' &&
      backgroundColor !== 'transparent'
    ) {
      const hex = rgbStringToHex(backgroundColor)
      if (hex) return hex
    }

    current = current.parentElement
  }

  return '#ffffff' // Default to white background
}

/**
 * Convert RGB string to hex
 */
function rgbStringToHex(rgbString: string): string | null {
  if (rgbString.startsWith('#')) {
    return rgbString
  }

  const rgbMatch = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  if (rgbMatch && rgbMatch[1] && rgbMatch[2] && rgbMatch[3]) {
    const r = parseInt(rgbMatch[1])
    const g = parseInt(rgbMatch[2])
    const b = parseInt(rgbMatch[3])
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  }

  const rgbaMatch = rgbString.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)/)
  if (rgbaMatch && rgbaMatch[1] && rgbaMatch[2] && rgbaMatch[3]) {
    const r = parseInt(rgbaMatch[1])
    const g = parseInt(rgbaMatch[2])
    const b = parseInt(rgbaMatch[3])
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  }

  return null
}
