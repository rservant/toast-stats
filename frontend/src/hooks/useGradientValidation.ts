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

// Brand gradient patterns for detection
const BRAND_GRADIENT_PATTERNS = {
  loyalBlue: [
    'linear-gradient(135deg, #004165 0%, #006094 100%)',
    'linear-gradient(135deg, rgb(0, 65, 101) 0%, rgb(0, 96, 148) 100%)',
    'radial-gradient(circle, #004165 0%, #006094 100%)',
    'linear-gradient(180deg, #004165 0%, #006094 100%)',
    'linear-gradient(90deg, #004165 0%, #006094 100%)',
  ],
  trueMaroon: [
    'linear-gradient(135deg, #3B0104 0%, #781327 100%)',
    'linear-gradient(135deg, rgb(59, 1, 4) 0%, rgb(120, 19, 39) 100%)',
    'radial-gradient(circle, #3B0104 0%, #781327 100%)',
    'linear-gradient(180deg, #3B0104 0%, #781327 100%)',
    'linear-gradient(90deg, #3B0104 0%, #781327 100%)',
  ],
  coolGray: [
    'linear-gradient(135deg, #A9B2B1 0%, #F5F5F5 100%)',
    'linear-gradient(135deg, rgb(169, 178, 177) 0%, rgb(245, 245, 245) 100%)',
    'radial-gradient(circle, #A9B2B1 0%, #F5F5F5 100%)',
    'linear-gradient(180deg, #A9B2B1 0%, #F5F5F5 100%)',
    'linear-gradient(90deg, #A9B2B1 0%, #F5F5F5 100%)',
  ],
}

// Minimum contrast ratios for text on gradients
const MIN_CONTRAST_RATIOS = {
  normal: 4.5, // WCAG AA for normal text
  large: 3.0, // WCAG AA for large text (18pt+ or 14pt+ bold)
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
      const normalizedGradient = gradientValue
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim()

      for (const [type, patterns] of Object.entries(BRAND_GRADIENT_PATTERNS)) {
        for (const pattern of patterns) {
          const normalizedPattern = pattern
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim()
          if (
            normalizedGradient.includes(normalizedPattern) ||
            normalizedPattern.includes(normalizedGradient)
          ) {
            return type
          }
        }
      }

      return null
    },
    []
  )

  /**
   * Extract gradient colors for contrast calculation
   */
  const extractGradientColors = useCallback(
    (gradientValue: string): string[] => {
      const colors: string[] = []

      // Extract hex colors
      const hexMatches = gradientValue.match(/#[0-9a-fA-F]{6}/g)
      if (hexMatches) {
        colors.push(...hexMatches)
      }

      // Extract rgb colors
      const rgbMatches = gradientValue.match(
        /rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)/g
      )
      if (rgbMatches) {
        colors.push(...rgbMatches.map(rgb => rgbToHex(rgb)))
      }

      return colors.filter(Boolean)
    },
    []
  )

  /**
   * Calculate average color from gradient for contrast checking
   */
  const getGradientAverageColor = useCallback(
    (gradientValue: string): string => {
      const colors = extractGradientColors(gradientValue)

      if (colors.length === 0) {
        return '#808080' // Default gray if no colors found
      }

      if (colors.length === 1) {
        return colors[0]
      }

      // Calculate average of first and last color for simplicity
      const firstColor = hexToRgb(colors[0])
      const lastColor = hexToRgb(colors[colors.length - 1])

      if (!firstColor || !lastColor) {
        return colors[0]
      }

      const avgR = Math.round((firstColor.r + lastColor.r) / 2)
      const avgG = Math.round((firstColor.g + lastColor.g) / 2)
      const avgB = Math.round((firstColor.b + lastColor.b) / 2)

      return `#${avgR.toString(16).padStart(2, '0')}${avgG.toString(16).padStart(2, '0')}${avgB.toString(16).padStart(2, '0')}`
    },
    [extractGradientColors]
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
        textContrastRatio,
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
      validateAllGradients()
    }
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

// Helper functions

/**
 * Convert RGB string to hex
 */
function rgbToHex(rgb: string): string {
  const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  if (!match) return '#000000'

  const r = parseInt(match[1])
  const g = parseInt(match[2])
  const b = parseInt(match[3])

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

/**
 * Convert hex to RGB object
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null
}
