/**
 * Error Recovery Strategies
 *
 * Comprehensive error recovery mechanisms for brand compliance violations
 */

import {
  BRAND_COLORS,
  TYPOGRAPHY_STACKS,
  ERROR_RECOVERY_DEFAULTS,
  FONT_SIZE_REQUIREMENTS,
  TOUCH_TARGET_REQUIREMENTS,
} from './brandConstants'
import { ValidationError } from './brandValidation'

export interface RecoveryResult {
  success: boolean
  appliedFixes: string[]
  remainingIssues: string[]
}

export interface RecoveryOptions {
  enableColorFallbacks: boolean
  enableFontFallbacks: boolean
  enableContrastAdjustment: boolean
  enableTouchTargetExpansion: boolean
  enableAutoSizing: boolean
}

const DEFAULT_RECOVERY_OPTIONS: RecoveryOptions = {
  enableColorFallbacks: true,
  enableFontFallbacks: true,
  enableContrastAdjustment: true,
  enableTouchTargetExpansion: true,
  enableAutoSizing: true,
}

// Color fallback strategies
export function applyColorFallback(
  element: HTMLElement,
  options: Partial<RecoveryOptions> = {}
): RecoveryResult {
  const opts = { ...DEFAULT_RECOVERY_OPTIONS, ...options }
  const appliedFixes: string[] = []
  const remainingIssues: string[] = []

  if (!opts.enableColorFallbacks) {
    return {
      success: false,
      appliedFixes,
      remainingIssues: ['Color fallbacks disabled'],
    }
  }

  try {
    const computedStyle = window.getComputedStyle(element)
    const backgroundColor = computedStyle.backgroundColor
    const color = computedStyle.color

    // Apply background color fallback
    if (backgroundColor && backgroundColor !== 'rgba(0, 0, 0, 0)') {
      const nearestBrandColor = findNearestBrandColor(backgroundColor)
      if (nearestBrandColor) {
        element.style.backgroundColor = nearestBrandColor
        appliedFixes.push(
          `Applied background color fallback: ${nearestBrandColor}`
        )
      } else {
        element.style.backgroundColor = ERROR_RECOVERY_DEFAULTS.fallbackColor
        appliedFixes.push(
          `Applied default background color: ${ERROR_RECOVERY_DEFAULTS.fallbackColor}`
        )
      }
    }

    // Apply text color fallback
    if (color && color !== 'rgba(0, 0, 0, 0)') {
      const nearestBrandColor = findNearestBrandColor(color)
      if (nearestBrandColor) {
        element.style.color = nearestBrandColor
        appliedFixes.push(`Applied text color fallback: ${nearestBrandColor}`)
      } else {
        element.style.color = BRAND_COLORS.black
        appliedFixes.push(`Applied default text color: ${BRAND_COLORS.black}`)
      }
    }

    return { success: appliedFixes.length > 0, appliedFixes, remainingIssues }
  } catch (error) {
    remainingIssues.push(`Color fallback failed: ${error}`)
    return { success: false, appliedFixes, remainingIssues }
  }
}

// Font fallback strategies
export function applyFontFallback(
  element: HTMLElement,
  options: Partial<RecoveryOptions> = {}
): RecoveryResult {
  const opts = { ...DEFAULT_RECOVERY_OPTIONS, ...options }
  const appliedFixes: string[] = []
  const remainingIssues: string[] = []

  if (!opts.enableFontFallbacks) {
    return {
      success: false,
      appliedFixes,
      remainingIssues: ['Font fallbacks disabled'],
    }
  }

  try {
    const tagName = element.tagName.toLowerCase()
    const isHeadline =
      ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName) ||
      element.classList.contains('tm-headline')

    if (isHeadline) {
      element.style.fontFamily = TYPOGRAPHY_STACKS.headline
      appliedFixes.push(`Applied headline font: ${TYPOGRAPHY_STACKS.headline}`)
    } else {
      element.style.fontFamily = TYPOGRAPHY_STACKS.body
      appliedFixes.push(`Applied body font: ${TYPOGRAPHY_STACKS.body}`)
    }

    return { success: true, appliedFixes, remainingIssues }
  } catch (error) {
    remainingIssues.push(`Font fallback failed: ${error}`)
    return { success: false, appliedFixes, remainingIssues }
  }
}

// Contrast adjustment strategies
export function applyContrastAdjustment(
  element: HTMLElement,
  options: Partial<RecoveryOptions> = {}
): RecoveryResult {
  const opts = { ...DEFAULT_RECOVERY_OPTIONS, ...options }
  const appliedFixes: string[] = []
  const remainingIssues: string[] = []

  if (!opts.enableContrastAdjustment) {
    return {
      success: false,
      appliedFixes,
      remainingIssues: ['Contrast adjustment disabled'],
    }
  }

  try {
    const computedStyle = window.getComputedStyle(element)
    const backgroundColor = computedStyle.backgroundColor
    const color = computedStyle.color

    if (backgroundColor && color) {
      const bgHex = rgbToHex(backgroundColor)
      const colorHex = rgbToHex(color)

      if (bgHex && colorHex) {
        const contrastRatio = calculateContrastRatio(colorHex, bgHex)

        if (contrastRatio < 4.5) {
          // Try to improve contrast by adjusting text color
          const improvedTextColor = getHighContrastTextColor(bgHex)
          element.style.color = improvedTextColor
          appliedFixes.push(
            `Improved text contrast: ${improvedTextColor} on ${bgHex}`
          )
        }
      }
    }

    return { success: appliedFixes.length > 0, appliedFixes, remainingIssues }
  } catch (error) {
    remainingIssues.push(`Contrast adjustment failed: ${error}`)
    return { success: false, appliedFixes, remainingIssues }
  }
}

// Touch target expansion strategies
export function applyTouchTargetExpansion(
  element: HTMLElement,
  options: Partial<RecoveryOptions> = {}
): RecoveryResult {
  const opts = { ...DEFAULT_RECOVERY_OPTIONS, ...options }
  const appliedFixes: string[] = []
  const remainingIssues: string[] = []

  if (!opts.enableTouchTargetExpansion) {
    return {
      success: false,
      appliedFixes,
      remainingIssues: ['Touch target expansion disabled'],
    }
  }

  try {
    const rect = element.getBoundingClientRect()
    const currentWidth = rect.width
    const currentHeight = rect.height

    if (
      currentWidth < TOUCH_TARGET_REQUIREMENTS.minWidth ||
      currentHeight < TOUCH_TARGET_REQUIREMENTS.minHeight
    ) {
      // Apply minimum dimensions
      element.style.minWidth = `${TOUCH_TARGET_REQUIREMENTS.minWidth}px`
      element.style.minHeight = `${TOUCH_TARGET_REQUIREMENTS.minHeight}px`

      // Add padding if needed
      const computedStyle = window.getComputedStyle(element)
      const currentPadding = parseFloat(computedStyle.padding) || 0

      if (currentPadding < 8) {
        element.style.padding = '8px'
        appliedFixes.push('Added padding for touch target expansion')
      }

      appliedFixes.push(
        `Expanded touch target to ${TOUCH_TARGET_REQUIREMENTS.minWidth}x${TOUCH_TARGET_REQUIREMENTS.minHeight}px`
      )
    }

    return { success: appliedFixes.length > 0, appliedFixes, remainingIssues }
  } catch (error) {
    remainingIssues.push(`Touch target expansion failed: ${error}`)
    return { success: false, appliedFixes, remainingIssues }
  }
}

// Font size adjustment strategies
export function applyFontSizeAdjustment(
  element: HTMLElement,
  options: Partial<RecoveryOptions> = {}
): RecoveryResult {
  const opts = { ...DEFAULT_RECOVERY_OPTIONS, ...options }
  const appliedFixes: string[] = []
  const remainingIssues: string[] = []

  if (!opts.enableAutoSizing) {
    return {
      success: false,
      appliedFixes,
      remainingIssues: ['Auto sizing disabled'],
    }
  }

  try {
    const computedStyle = window.getComputedStyle(element)
    const currentFontSize = parseFloat(computedStyle.fontSize)

    if (currentFontSize < FONT_SIZE_REQUIREMENTS.minBodySize) {
      element.style.fontSize = `${FONT_SIZE_REQUIREMENTS.minBodySize}px`
      appliedFixes.push(
        `Increased font size from ${currentFontSize}px to ${FONT_SIZE_REQUIREMENTS.minBodySize}px`
      )
    }

    // Check and adjust line height
    const currentLineHeight = parseFloat(computedStyle.lineHeight)
    const fontSize = parseFloat(computedStyle.fontSize)
    const lineHeightRatio = currentLineHeight / fontSize

    if (lineHeightRatio < FONT_SIZE_REQUIREMENTS.minLineHeight) {
      element.style.lineHeight = FONT_SIZE_REQUIREMENTS.minLineHeight.toString()
      appliedFixes.push(
        `Adjusted line height to ${FONT_SIZE_REQUIREMENTS.minLineHeight}`
      )
    }

    return { success: appliedFixes.length > 0, appliedFixes, remainingIssues }
  } catch (error) {
    remainingIssues.push(`Font size adjustment failed: ${error}`)
    return { success: false, appliedFixes, remainingIssues }
  }
}

// Comprehensive error recovery
export function applyComprehensiveRecovery(
  errors: ValidationError[],
  options: Partial<RecoveryOptions> = {}
): RecoveryResult {
  const allAppliedFixes: string[] = []
  const allRemainingIssues: string[] = []
  let overallSuccess = false

  errors.forEach(error => {
    if (!error.element) return

    let result: RecoveryResult

    switch (error.ruleId) {
      case 'CV001': // Color validation
        result = applyColorFallback(error.element, options)
        break
      case 'CV002': // Contrast validation
        result = applyContrastAdjustment(error.element, options)
        break
      case 'TV001':
      case 'TV002': // Font validation
        result = applyFontFallback(error.element, options)
        break
      case 'TV003':
      case 'TV004': // Font size validation
        result = applyFontSizeAdjustment(error.element, options)
        break
      case 'AV001': // Touch target validation
        result = applyTouchTargetExpansion(error.element, options)
        break
      default:
        result = {
          success: false,
          appliedFixes: [],
          remainingIssues: [`No recovery strategy for ${error.ruleId}`],
        }
    }

    allAppliedFixes.push(...result.appliedFixes)
    allRemainingIssues.push(...result.remainingIssues)

    if (result.success) {
      overallSuccess = true
    }
  })

  return {
    success: overallSuccess,
    appliedFixes: allAppliedFixes,
    remainingIssues: allRemainingIssues,
  }
}

// Utility functions
function findNearestBrandColor(color: string): string | null {
  // Simplified nearest color calculation
  // In production, use proper color distance algorithms

  // For now, return a sensible default based on lightness
  const rgb = hexToRgb(rgbToHex(color) || color)
  if (!rgb) return null

  const lightness = (rgb.r + rgb.g + rgb.b) / 3

  if (lightness > 200) return BRAND_COLORS.white
  if (lightness > 150) return BRAND_COLORS.coolGray
  if (lightness > 100) return BRAND_COLORS.loyalBlue
  return BRAND_COLORS.black
}

function getHighContrastTextColor(backgroundColor: string): string {
  const rgb = hexToRgb(backgroundColor)
  if (!rgb) return BRAND_COLORS.black

  const lightness = (rgb.r + rgb.g + rgb.b) / 3
  return lightness > 128 ? BRAND_COLORS.black : BRAND_COLORS.white
}

function calculateContrastRatio(
  foreground: string,
  background: string
): number {
  const getLuminance = (color: string): number => {
    const rgb = hexToRgb(color)
    if (!rgb) return 0

    const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(c => {
      c = c / 255
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    })

    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }

  const l1 = getLuminance(foreground)
  const l2 = getLuminance(background)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)

  return (lighter + 0.05) / (darker + 0.05)
}

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

function rgbToHex(rgb: string): string | null {
  const result = rgb.match(/\d+/g)
  if (!result || result.length < 3) return null

  const r = parseInt(result[0])
  const g = parseInt(result[1])
  const b = parseInt(result[2])

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}
