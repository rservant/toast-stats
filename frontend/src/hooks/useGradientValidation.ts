/**
 * Gradient Validation Hook
 *
 * This hook provides utilities for validating brand gradient usage
 * and ensuring compliance with Toastmasters brand guidelines.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5 - Gradient and Visual Effects
 */

import React, { useCallback, useEffect, useState } from 'react'
import { calculateContrastRatio } from '../utils/contrastCalculator'
import {
  isBrandGradient as isBrandGradientUtil,
  getGradientAverageColor as getGradientAverageColorUtil,
  MIN_CONTRAST_RATIOS,
} from '../utils/gradientValidationUtils'

// Re-export utils for backward compatibility
export {
  BRAND_GRADIENT_PATTERNS,
  MIN_CONTRAST_RATIOS,
  isBrandGradient,
  rgbToHex,
  hexToRgb,
  extractGradientColors,
  getGradientAverageColor,
} from '../utils/gradientValidationUtils'

export interface GradientValidationResult {
  element: HTMLElement
  gradientType: string
  gradientValue: string
  hasTextOverlay: boolean
  textContrastRatio?: number
  passes: boolean
  violations: string[]
  recommendations: string[]
}

export interface GradientUsageResult {
  totalGradients: number
  gradientElements: HTMLElement[]
  violatesOneGradientRule: boolean
  violations: string[]
}

export interface GradientValidationOptions {
  checkOnMount?: boolean
  checkOnResize?: boolean
  autoFix?: boolean
  onViolation?: (result: GradientValidationResult) => void
  onUsageViolation?: (result: GradientUsageResult) => void
}

/**
 * Hook for validating brand gradient usage and constraints
 */
export function useGradientValidation(options: GradientValidationOptions = {}) {
  const {
    checkOnMount = true,
    checkOnResize = false,
    autoFix = false,
    onViolation,
    onUsageViolation,
  } = options

  const [violations, setViolations] = useState<GradientValidationResult[]>([])
  const [usageViolations, setUsageViolations] =
    useState<GradientUsageResult | null>(null)
  const [isValidating, setIsValidating] = useState(false)

  /**
   * Check if a gradient value matches brand patterns
   */
  const isBrandGradient = useCallback(
    (gradientValue: string): string | null => {
      return isBrandGradientUtil(gradientValue)
    },
    []
  )

  /**
   * Calculate average color from gradient for contrast checking
   */
  const getGradientAverageColor = useCallback(
    (gradientValue: string): string => {
      return getGradientAverageColorUtil(gradientValue)
    },
    []
  )

  /**
   * Check if element has text content
   */
  const hasTextContent = useCallback((element: HTMLElement): boolean => {
    const textContent = element.textContent?.trim()
    return Boolean(textContent && textContent.length > 0)
  }, [])

  /**
   * Check if text is large (18pt+ or 14pt+ bold)
   */
  const isLargeText = useCallback((element: HTMLElement): boolean => {
    const computedStyle = window.getComputedStyle(element)
    const fontSize = parseFloat(computedStyle.fontSize)
    const fontWeight = computedStyle.fontWeight

    // Convert to points (1pt = 1.33px approximately)
    const fontSizeInPoints = fontSize * 0.75

    return (
      fontSizeInPoints >= 18 ||
      (fontSizeInPoints >= 14 &&
        (fontWeight === 'bold' ||
          fontWeight === '700' ||
          fontWeight === '800' ||
          fontWeight === '900' ||
          parseInt(fontWeight) >= 700))
    )
  }, [])

  /**
   * Validate a single gradient element
   */
  const validateGradientElement = useCallback(
    (element: HTMLElement): GradientValidationResult => {
      const computedStyle = window.getComputedStyle(element)
      const backgroundImage = computedStyle.backgroundImage

      const violations: string[] = []
      const recommendations: string[] = []

      // Check if it's a brand gradient
      const gradientType = isBrandGradient(backgroundImage)
      if (!gradientType && backgroundImage.includes('gradient')) {
        violations.push('Non-brand gradient detected')
        recommendations.push('Use only official Toastmasters brand gradients')
      }

      // Check text overlay contrast
      const hasText = hasTextContent(element)
      let textContrastRatio: number | undefined

      if (hasText) {
        const textColor = computedStyle.color
        const gradientAvgColor = getGradientAverageColor(backgroundImage)
        textContrastRatio = calculateContrastRatio(textColor, gradientAvgColor)

        const isLarge = isLargeText(element)
        const minRatio = isLarge
          ? MIN_CONTRAST_RATIOS.large
          : MIN_CONTRAST_RATIOS.normal

        if (textContrastRatio < minRatio) {
          violations.push(
            `Text contrast ratio ${textContrastRatio.toFixed(2)}:1 is below WCAG AA requirement of ${minRatio}:1`
          )
          recommendations.push(
            'Add a semi-transparent overlay or use higher contrast text color'
          )
        }
      }

      const result: GradientValidationResult = {
        element,
        gradientType: gradientType || 'unknown',
        gradientValue: backgroundImage,
        hasTextOverlay: hasText,
        ...(textContrastRatio !== undefined && { textContrastRatio }),
        passes: violations.length === 0,
        violations,
        recommendations,
      }

      return result
    },
    [isBrandGradient, hasTextContent, getGradientAverageColor, isLargeText]
  )

  /**
   * Validate gradient usage constraints (max one per screen)
   */
  const validateGradientUsage = useCallback(
    (container: HTMLElement = document.body): GradientUsageResult => {
      const gradientElements: HTMLElement[] = []
      const violations: string[] = []

      // Find all elements with gradients
      const allElements = container.querySelectorAll('*')
      allElements.forEach(el => {
        const element = el as HTMLElement
        const computedStyle = window.getComputedStyle(element)
        const backgroundImage = computedStyle.backgroundImage

        if (backgroundImage && backgroundImage.includes('gradient')) {
          gradientElements.push(element)
        }
      })

      const totalGradients = gradientElements.length
      const violatesOneGradientRule = totalGradients > 1

      if (violatesOneGradientRule) {
        violations.push(
          `Found ${totalGradients} gradients on screen, maximum allowed is 1`
        )
      }

      return {
        totalGradients,
        gradientElements,
        violatesOneGradientRule,
        violations,
      }
    },
    []
  )

  /**
   * Validate all gradients in a container
   */
  const validateAllGradients = useCallback(
    (
      container: HTMLElement = document.body
    ): {
      elementResults: GradientValidationResult[]
      usageResult: GradientUsageResult
    } => {
      setIsValidating(true)

      // Check usage constraints first
      const usageResult = validateGradientUsage(container)
      setUsageViolations(usageResult)

      if (usageResult.violatesOneGradientRule && onUsageViolation) {
        onUsageViolation(usageResult)
      }

      // Validate individual gradient elements
      const elementResults: GradientValidationResult[] = []

      usageResult.gradientElements.forEach(element => {
        const result = validateGradientElement(element)
        elementResults.push(result)

        if (!result.passes && onViolation) {
          onViolation(result)
        }
      })

      const failedResults = elementResults.filter(r => !r.passes)
      setViolations(failedResults)
      setIsValidating(false)

      return { elementResults, usageResult }
    },
    [
      validateGradientUsage,
      validateGradientElement,
      onViolation,
      onUsageViolation,
    ]
  )

  /**
   * Get gradient performance recommendations for mobile
   */
  const getPerformanceRecommendations = useCallback(
    (element: HTMLElement): string[] => {
      const recommendations: string[] = []
      const computedStyle = window.getComputedStyle(element)
      const backgroundImage = computedStyle.backgroundImage

      // Check for complex gradients
      if (backgroundImage.includes('radial-gradient')) {
        recommendations.push(
          'Consider using linear gradients instead of radial for better mobile performance'
        )
      }

      // Check for multiple color stops
      const colorStops = (
        backgroundImage.match(/#[0-9a-fA-F]{6}|rgb\([^)]+\)/g) || []
      ).length
      if (colorStops > 3) {
        recommendations.push(
          'Reduce gradient complexity by using fewer color stops for better performance'
        )
      }

      // Check element size
      const rect = element.getBoundingClientRect()
      if (rect.width * rect.height > 500000) {
        // Large area
        recommendations.push(
          'Consider using solid colors for large areas to improve performance'
        )
      }

      return recommendations
    },
    []
  )

  /**
   * Auto-fix gradient violations
   */
  const fixGradientViolations = useCallback(
    (result: GradientValidationResult) => {
      if (!autoFix) return

      const { element, violations } = result

      violations.forEach(violation => {
        if (violation.includes('contrast ratio')) {
          // Add overlay for better contrast
          const overlay = document.createElement('div')
          overlay.style.position = 'absolute'
          overlay.style.top = '0'
          overlay.style.left = '0'
          overlay.style.right = '0'
          overlay.style.bottom = '0'
          overlay.style.background = 'rgba(0, 0, 0, 0.4)'
          overlay.style.zIndex = '1'

          element.style.position = 'relative'
          element.appendChild(overlay)

          // Ensure text is above overlay
          const textElements = element.querySelectorAll('*')
          textElements.forEach(textEl => {
            const htmlEl = textEl as HTMLElement
            if (htmlEl.textContent?.trim()) {
              htmlEl.style.position = 'relative'
              htmlEl.style.zIndex = '2'
            }
          })
        }
      })
    },
    [autoFix]
  )

  /**
   * Get current violations
   */
  const getCurrentViolations = useCallback(() => {
    return { violations, usageViolations }
  }, [violations, usageViolations])

  /**
   * Clear all violations
   */
  const clearViolations = useCallback(() => {
    setViolations([])
    setUsageViolations(null)
  }, [])

  // Auto-validate on mount if enabled
  useEffect(() => {
    if (checkOnMount) {
      // Use setTimeout to avoid synchronous setState in effect
      const timeoutId = setTimeout(() => {
        validateAllGradients()
      }, 0)
      return () => clearTimeout(timeoutId)
    }
    return undefined
  }, [checkOnMount, validateAllGradients])

  // Handle resize if enabled
  useEffect(() => {
    if (!checkOnResize) return

    const handleResize = () => {
      validateAllGradients()
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [checkOnResize, validateAllGradients])

  return {
    validateGradientElement,
    validateGradientUsage,
    validateAllGradients,
    getPerformanceRecommendations,
    fixGradientViolations,
    getCurrentViolations,
    clearViolations,
    isBrandGradient,
    violations,
    usageViolations,
    isValidating,
  }
}

/**
 * Hook for automatically validating gradients in a container
 */
export function useAutoGradientValidation(
  containerRef: React.RefObject<HTMLElement>,
  options: GradientValidationOptions = {}
) {
  const gradientValidation = useGradientValidation(options)

  useEffect(() => {
    if (!containerRef.current) return

    gradientValidation.validateAllGradients(containerRef.current)
  }, [containerRef, gradientValidation])

  return gradientValidation
}
