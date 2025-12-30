/**
 * Responsive Design Hook
 *
 * This hook provides utilities for managing responsive design compliance
 * according to Toastmasters brand guidelines across all breakpoints.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { BREAKPOINTS } from '../components/brand/types'
import { useTouchTarget } from './useTouchTarget'
import { useContrastCheck } from './useContrastCheck'
import type { ContrastValidationResult } from '../utils/contrastCalculator'

export type BreakpointName = 'mobile' | 'tablet' | 'desktop' | 'wide'

export interface ResponsiveState {
  breakpoint: BreakpointName
  width: number
  height: number
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  isWide: boolean
  touchTargetSize: number
  minFontSize: number
  containerPadding: string
}

export interface ResponsiveValidationResult {
  touchTargetsValid: boolean
  fontSizesValid: boolean
  contrastValid: boolean
  brandColorsValid: boolean
  overallValid: boolean
  violations: ResponsiveViolation[]
}

export interface ResponsiveViolation {
  type: 'touch-target' | 'font-size' | 'contrast' | 'brand-color'
  element: HTMLElement
  message: string
  recommendation: string
  breakpoint: BreakpointName
}

export interface ResponsiveDesignOptions {
  enableValidation?: boolean
  enableAutoFix?: boolean
  onViolation?: (violation: ResponsiveViolation) => void
  onBreakpointChange?: (breakpoint: BreakpointName) => void
}

/**
 * Hook for managing responsive design compliance
 */
export function useResponsiveDesign(options: ResponsiveDesignOptions = {}) {
  const {
    enableValidation = true,
    enableAutoFix = false,
    onViolation,
    onBreakpointChange,
  } = options

  const [responsiveState, setResponsiveState] = useState<ResponsiveState>(() =>
    getResponsiveState()
  )
  const [validationResult, setValidationResult] =
    useState<ResponsiveValidationResult>({
      touchTargetsValid: true,
      fontSizesValid: true,
      contrastValid: true,
      brandColorsValid: true,
      overallValid: true,
      violations: [],
    })

  const touchTarget = useTouchTarget({
    minSize: responsiveState.touchTargetSize,
    onViolation: result => {
      if (onViolation) {
        onViolation({
          type: 'touch-target',
          element: result.element,
          message: `Touch target too small: ${result.width}x${result.height}px`,
          recommendation: result.recommendation || 'Increase element size',
          breakpoint: responsiveState.breakpoint,
        })
      }
    },
  })

  const contrastCheck = useContrastCheck({
    onViolation: result => {
      if (onViolation) {
        // Create a mock element for the violation since ContrastValidationResult doesn't include element
        const mockElement = document.createElement('div')
        onViolation({
          type: 'contrast',
          element: mockElement,
          message: `Contrast ratio too low: ${result.ratio.toFixed(2)}:1`,
          recommendation: 'Use higher contrast colors or adjust opacity',
          breakpoint: responsiveState.breakpoint,
        })
      }
    },
  })

  const validationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  )

  /**
   * Get current responsive state based on viewport
   */
  function getResponsiveState(): ResponsiveState {
    const width = typeof window !== 'undefined' ? window.innerWidth : 1024
    const height = typeof window !== 'undefined' ? window.innerHeight : 768

    let breakpoint: BreakpointName = 'mobile'
    let touchTargetSize = 44
    let minFontSize = 14
    let containerPadding = '16px'

    if (width >= parseInt(BREAKPOINTS.wide)) {
      breakpoint = 'wide'
      touchTargetSize = 48
      minFontSize = 14
      containerPadding = '48px'
    } else if (width >= parseInt(BREAKPOINTS.desktop)) {
      breakpoint = 'desktop'
      touchTargetSize = 48
      minFontSize = 14
      containerPadding = '32px'
    } else if (width >= parseInt(BREAKPOINTS.tablet)) {
      breakpoint = 'tablet'
      touchTargetSize = 44
      minFontSize = 14
      containerPadding = '24px'
    } else {
      breakpoint = 'mobile'
      touchTargetSize = 44
      minFontSize = 14
      containerPadding = '16px'
    }

    return {
      breakpoint,
      width,
      height,
      isMobile: breakpoint === 'mobile',
      isTablet: breakpoint === 'tablet',
      isDesktop: breakpoint === 'desktop',
      isWide: breakpoint === 'wide',
      touchTargetSize,
      minFontSize,
      containerPadding,
    }
  }

  /**
   * Handle window resize
   */
  const handleResize = useCallback(() => {
    const newState = getResponsiveState()
    const previousBreakpoint = responsiveState.breakpoint

    setResponsiveState(newState)

    if (newState.breakpoint !== previousBreakpoint && onBreakpointChange) {
      onBreakpointChange(newState.breakpoint)
    }

    // Debounce validation on resize
    if (enableValidation) {
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current)
      }
      validationTimeoutRef.current = setTimeout(() => {
        validateResponsiveCompliance()
      }, 300)
    }
  }, [responsiveState.breakpoint, enableValidation, onBreakpointChange])

  /**
   * Validate responsive design compliance
   */
  const validateResponsiveCompliance = useCallback(
    (container: HTMLElement = document.body): ResponsiveValidationResult => {
      const violations: ResponsiveViolation[] = []

      // Validate touch targets
      const touchTargetResults = touchTarget.validateAllTouchTargets(container)
      const touchTargetViolations = touchTargetResults
        .filter(result => !result.passes)
        .map(result => ({
          type: 'touch-target' as const,
          element: result.element,
          message: `Touch target too small: ${result.width.toFixed(1)}x${result.height.toFixed(1)}px`,
          recommendation:
            result.recommendation ||
            'Increase element size to meet minimum requirements',
          breakpoint: responsiveState.breakpoint,
        }))

      violations.push(...touchTargetViolations)

      // Validate font sizes
      const textElements = container.querySelectorAll(
        'p, span, div, label, input, textarea, select, button'
      )
      const fontSizeViolations: ResponsiveViolation[] = []

      textElements.forEach(element => {
        const htmlElement = element as HTMLElement
        const computedStyle = window.getComputedStyle(htmlElement)
        const fontSize = parseFloat(computedStyle.fontSize)

        if (fontSize < responsiveState.minFontSize) {
          fontSizeViolations.push({
            type: 'font-size',
            element: htmlElement,
            message: `Font size too small: ${fontSize}px (minimum: ${responsiveState.minFontSize}px)`,
            recommendation: `Increase font size to at least ${responsiveState.minFontSize}px`,
            breakpoint: responsiveState.breakpoint,
          })
        }
      })

      violations.push(...fontSizeViolations)

      // Validate contrast ratios
      const contrastResults = contrastCheck.validateAllContrasts(container)
      const contrastViolations = contrastResults
        .filter((result: ContrastValidationResult) => !result.passes)
        .map((result: ContrastValidationResult) => ({
          type: 'contrast' as const,
          element: document.createElement('div'), // Mock element since ContrastValidationResult doesn't include element
          message: `Contrast ratio too low: ${result.ratio.toFixed(2)}:1 (minimum: 4.5:1)`,
          recommendation: 'Use higher contrast colors or adjust opacity',
          breakpoint: responsiveState.breakpoint,
        }))

      violations.push(...contrastViolations)

      // Validate brand colors
      const brandColorViolations = validateBrandColors(container)
      violations.push(...brandColorViolations)

      const result: ResponsiveValidationResult = {
        touchTargetsValid: touchTargetViolations.length === 0,
        fontSizesValid: fontSizeViolations.length === 0,
        contrastValid: contrastViolations.length === 0,
        brandColorsValid: brandColorViolations.length === 0,
        overallValid: violations.length === 0,
        violations,
      }

      setValidationResult(result)

      // Report violations
      violations.forEach(violation => {
        if (onViolation) {
          onViolation(violation)
        }
      })

      return result
    },
    [responsiveState, touchTarget, contrastCheck, onViolation]
  )

  /**
   * Validate brand color usage
   */
  const validateBrandColors = useCallback(
    (container: HTMLElement): ResponsiveViolation[] => {
      const violations: ResponsiveViolation[] = []
      const brandColors = [
        '#004165', // TM Loyal Blue
        '#772432', // TM True Maroon
        '#A9B2B1', // TM Cool Gray
        '#F2DF74', // TM Happy Yellow
        '#000000', // TM Black
        '#FFFFFF', // TM White
      ]

      const elements = container.querySelectorAll('*')
      elements.forEach(element => {
        const htmlElement = element as HTMLElement
        const computedStyle = window.getComputedStyle(htmlElement)
        const backgroundColor = computedStyle.backgroundColor
        const color = computedStyle.color

        // Convert RGB to hex for comparison
        const bgHex = rgbToHex(backgroundColor)
        const textHex = rgbToHex(color)

        // Check if colors are from brand palette (allow transparent/inherit)
        if (
          bgHex &&
          bgHex !== 'transparent' &&
          !brandColors.includes(bgHex.toUpperCase())
        ) {
          violations.push({
            type: 'brand-color',
            element: htmlElement,
            message: `Non-brand background color: ${backgroundColor}`,
            recommendation: 'Use only Toastmasters brand palette colors',
            breakpoint: responsiveState.breakpoint,
          })
        }

        if (
          textHex &&
          textHex !== 'inherit' &&
          !brandColors.includes(textHex.toUpperCase())
        ) {
          violations.push({
            type: 'brand-color',
            element: htmlElement,
            message: `Non-brand text color: ${color}`,
            recommendation: 'Use only Toastmasters brand palette colors',
            breakpoint: responsiveState.breakpoint,
          })
        }
      })

      return violations
    },
    [responsiveState.breakpoint]
  )

  /**
   * Auto-fix responsive violations
   */
  const autoFixViolations = useCallback(
    (
      violations: ResponsiveViolation[] = validationResult.violations
    ): number => {
      let fixedCount = 0

      violations.forEach(violation => {
        try {
          switch (violation.type) {
            case 'touch-target':
              if (touchTarget.autoFixTouchTarget(violation.element)) {
                fixedCount++
              }
              break

            case 'font-size':
              const currentSize = parseFloat(
                window.getComputedStyle(violation.element).fontSize
              )
              if (currentSize < responsiveState.minFontSize) {
                violation.element.style.fontSize = `${responsiveState.minFontSize}px`
                fixedCount++
              }
              break

            case 'contrast':
              // Auto-fix contrast by adjusting opacity or switching to high contrast colors
              const style = window.getComputedStyle(violation.element)
              const bgColor = style.backgroundColor

              // Simple fix: use high contrast brand colors
              if (bgColor.includes('rgb')) {
                violation.element.style.backgroundColor = 'var(--tm-loyal-blue)'
                violation.element.style.color = 'var(--tm-white)'
                fixedCount++
              }
              break

            case 'brand-color':
              // Auto-fix by replacing with nearest brand color
              const style2 = window.getComputedStyle(violation.element)
              if (style2.backgroundColor !== 'transparent') {
                violation.element.style.backgroundColor = 'var(--tm-cool-gray)'
              }
              if (style2.color !== 'inherit') {
                violation.element.style.color = 'var(--tm-black)'
              }
              fixedCount++
              break
          }
        } catch (error) {
          console.warn('Failed to auto-fix violation:', error)
        }
      })

      return fixedCount
    },
    [validationResult.violations, touchTarget, responsiveState.minFontSize]
  )

  /**
   * Get responsive CSS classes for an element
   */
  const getResponsiveClasses = useCallback(
    (baseClasses: string = ''): string => {
      const responsiveClasses = [
        baseClasses,
        'tm-responsive-element',
        `tm-breakpoint-${responsiveState.breakpoint}`,
      ]

      return responsiveClasses.filter(Boolean).join(' ')
    },
    [responsiveState.breakpoint]
  )

  /**
   * Get responsive styles for an element
   */
  const getResponsiveStyles = useCallback(
    (baseStyles: React.CSSProperties = {}): React.CSSProperties => {
      return {
        ...baseStyles,
        minHeight: `${responsiveState.touchTargetSize}px`,
        fontSize: `max(${responsiveState.minFontSize}px, 1rem)`,
        padding: responsiveState.containerPadding,
      }
    },
    [responsiveState]
  )

  /**
   * Check if current breakpoint matches
   */
  const isBreakpoint = useCallback(
    (breakpoint: BreakpointName | BreakpointName[]): boolean => {
      if (Array.isArray(breakpoint)) {
        return breakpoint.includes(responsiveState.breakpoint)
      }
      return responsiveState.breakpoint === breakpoint
    },
    [responsiveState.breakpoint]
  )

  // Set up resize listener
  useEffect(() => {
    if (typeof window === 'undefined') return

    window.addEventListener('resize', handleResize)

    // Initial validation
    if (enableValidation) {
      setTimeout(() => validateResponsiveCompliance(), 100)
    }

    return () => {
      window.removeEventListener('resize', handleResize)
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current)
      }
    }
  }, [handleResize, enableValidation, validateResponsiveCompliance])

  // Auto-fix violations if enabled
  useEffect(() => {
    if (enableAutoFix && validationResult.violations.length > 0) {
      const fixedCount = autoFixViolations()
      if (fixedCount > 0) {
        // Re-validate after auto-fix
        setTimeout(() => validateResponsiveCompliance(), 100)
      }
    }
  }, [
    enableAutoFix,
    validationResult.violations,
    autoFixViolations,
    validateResponsiveCompliance,
  ])

  return {
    // State
    ...responsiveState,
    validationResult,

    // Methods
    validateResponsiveCompliance,
    autoFixViolations,
    getResponsiveClasses,
    getResponsiveStyles,
    isBreakpoint,

    // Touch target utilities
    checkTouchTarget: touchTarget.checkTouchTarget,
    registerTouchTarget: touchTarget.registerElement,
    unregisterTouchTarget: touchTarget.unregisterElement,

    // Contrast utilities
    checkContrast: contrastCheck.checkContrast,
    validateAllContrasts: contrastCheck.validateAllContrasts,
  }
}

/**
 * Hook for automatically validating responsive design in a container
 */
export function useAutoResponsiveValidation(
  containerRef: React.RefObject<HTMLElement>,
  options: ResponsiveDesignOptions = {}
) {
  const responsive = useResponsiveDesign(options)
  const [isValidating, setIsValidating] = useState(false)

  useEffect(() => {
    if (!containerRef.current) return

    setIsValidating(true)
    responsive.validateResponsiveCompliance(containerRef.current)
    setIsValidating(false)
  }, [containerRef, responsive.breakpoint])

  return {
    ...responsive,
    isValidating,
  }
}

/**
 * Utility function to convert RGB color to hex
 */
function rgbToHex(rgb: string): string | null {
  if (!rgb || rgb === 'transparent' || rgb === 'inherit') return null

  const match = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/)
  if (!match) return null

  const r = parseInt(match[1], 10)
  const g = parseInt(match[2], 10)
  const b = parseInt(match[3], 10)

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`
}

/**
 * Utility function to get breakpoint name from width
 */
export function getBreakpointFromWidth(width: number): BreakpointName {
  if (width >= parseInt(BREAKPOINTS.wide)) return 'wide'
  if (width >= parseInt(BREAKPOINTS.desktop)) return 'desktop'
  if (width >= parseInt(BREAKPOINTS.tablet)) return 'tablet'
  return 'mobile'
}

/**
 * Utility function to check if width is mobile
 */
export function isMobileWidth(width: number): boolean {
  return width < parseInt(BREAKPOINTS.tablet)
}

/**
 * Utility function to get responsive font size
 */
export function getResponsiveFontSize(
  baseSize: number,
  breakpoint: BreakpointName
): number {
  const minSize = Math.max(14, baseSize * 0.75)
  const maxSize = baseSize * 1.25

  switch (breakpoint) {
    case 'mobile':
      return minSize
    case 'tablet':
      return baseSize
    case 'desktop':
      return baseSize * 1.125
    case 'wide':
      return Math.min(maxSize, baseSize * 1.25)
    default:
      return baseSize
  }
}

/**
 * Utility function to get responsive spacing
 */
export function getResponsiveSpacing(breakpoint: BreakpointName): string {
  switch (breakpoint) {
    case 'mobile':
      return '16px'
    case 'tablet':
      return '24px'
    case 'desktop':
      return '32px'
    case 'wide':
      return '48px'
    default:
      return '16px'
  }
}

/**
 * Utility function to get responsive touch target size
 */
export function getResponsiveTouchTargetSize(
  breakpoint: BreakpointName
): number {
  switch (breakpoint) {
    case 'mobile':
    case 'tablet':
      return 44
    case 'desktop':
    case 'wide':
      return 48
    default:
      return 44
  }
}
