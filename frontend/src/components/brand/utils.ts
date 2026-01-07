/**
 * Toastmasters Brand Utility Functions
 *
 * This file contains utility functions for brand compliance validation,
 * contrast checking, and accessibility verification.
 */

import {
  BRAND_COLORS,
  ContrastCheckResult,
  TouchTargetCheckResult,
} from './types'

/**
 * Convert hex color to RGB values
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result && result[1] && result[2] && result[3]
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null
}

/**
 * Calculate relative luminance of a color
 * Based on WCAG 2.1 specification
 */
function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * (rs ?? 0) + 0.7152 * (gs ?? 0) + 0.0722 * (bs ?? 0)
}

/**
 * Calculate contrast ratio between two colors
 * Returns a value between 1 and 21
 */
export function calculateContrastRatio(
  foreground: string,
  background: string
): number {
  const fgRgb = hexToRgb(foreground)
  const bgRgb = hexToRgb(background)

  if (!fgRgb || !bgRgb) {
    return 1 // Worst case if colors can't be parsed
  }

  const fgLuminance = getRelativeLuminance(fgRgb.r, fgRgb.g, fgRgb.b)
  const bgLuminance = getRelativeLuminance(bgRgb.r, bgRgb.g, bgRgb.b)

  const lighter = Math.max(fgLuminance, bgLuminance)
  const darker = Math.min(fgLuminance, bgLuminance)

  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Check if contrast ratio meets WCAG AA standards
 */
export function validateContrast(
  foreground: string,
  background: string,
  isLargeText = false
): ContrastCheckResult {
  const ratio = calculateContrastRatio(foreground, background)
  const requiredRatio = isLargeText ? 3.0 : 4.5
  const aaaRatio = isLargeText ? 4.5 : 7.0

  let level: 'AA' | 'AAA' | 'fail'
  if (ratio >= aaaRatio) {
    level = 'AAA'
  } else if (ratio >= requiredRatio) {
    level = 'AA'
  } else {
    level = 'fail'
  }

  return {
    ratio: Math.round(ratio * 100) / 100,
    passes: ratio >= requiredRatio,
    level,
    foreground,
    background,
  }
}

/**
 * Check if an element meets touch target requirements (44px minimum)
 */
export function checkTouchTarget(element: HTMLElement): TouchTargetCheckResult {
  const rect = element.getBoundingClientRect()
  const minSize = 44

  return {
    width: rect.width,
    height: rect.height,
    passes: rect.width >= minSize && rect.height >= minSize,
    element,
  }
}

/**
 * Check if a color is from the approved brand palette
 */
export function isBrandColor(color: string): boolean {
  const normalizedColor = color.toLowerCase()
  return Object.values(BRAND_COLORS).some(
    brandColor => brandColor.toLowerCase() === normalizedColor
  )
}

/**
 * Get the closest brand color to a given color
 */
export function getClosestBrandColor(color: string): string {
  const colorRgb = hexToRgb(color)
  if (!colorRgb) return BRAND_COLORS.black

  let closestColor: string = BRAND_COLORS.black
  let minDistance = Infinity

  Object.values(BRAND_COLORS).forEach(brandColor => {
    const brandRgb = hexToRgb(brandColor)
    if (!brandRgb) return

    // Calculate Euclidean distance in RGB space
    const distance = Math.sqrt(
      Math.pow(colorRgb.r - brandRgb.r, 2) +
        Math.pow(colorRgb.g - brandRgb.g, 2) +
        Math.pow(colorRgb.b - brandRgb.b, 2)
    )

    if (distance < minDistance) {
      minDistance = distance
      closestColor = brandColor
    }
  })

  return closestColor
}

/**
 * Check if an element uses prohibited text effects
 */
export function hasProhibitedTextEffects(element: HTMLElement): boolean {
  const computedStyle = window.getComputedStyle(element)

  // Check for prohibited CSS properties
  const textShadow = computedStyle.textShadow
  const filter = computedStyle.filter
  const textStroke =
    computedStyle.webkitTextStroke ||
    (computedStyle as unknown as { textStroke?: string }).textStroke

  // Check for text shadow (drop-shadow effect)
  if (textShadow && textShadow !== 'none') {
    return true
  }

  // Check for filters that might create prohibited effects
  if (filter && filter !== 'none') {
    const prohibitedFilters = [
      'drop-shadow',
      'blur',
      'brightness',
      'contrast',
      'hue-rotate',
    ]
    if (prohibitedFilters.some(filterType => filter.includes(filterType))) {
      return true
    }
  }

  // Check for text stroke (outline effect)
  if (textStroke && textStroke !== 'none' && textStroke !== '0px') {
    return true
  }

  return false
}

/**
 * Get font family from computed styles
 */
export function getFontFamily(element: HTMLElement): string {
  const computedStyle = window.getComputedStyle(element)
  return computedStyle.fontFamily
}

/**
 * Check if font family is brand compliant
 */
export function isBrandFont(fontFamily: string): boolean {
  const normalizedFont = fontFamily.toLowerCase()
  return (
    normalizedFont.includes('montserrat') ||
    normalizedFont.includes('source sans') ||
    normalizedFont.includes('source sans 3')
  )
}

/**
 * Get font size in pixels
 */
export function getFontSizeInPixels(element: HTMLElement): number {
  const computedStyle = window.getComputedStyle(element)
  const fontSize = computedStyle.fontSize

  if (fontSize.endsWith('px')) {
    return parseFloat(fontSize)
  }

  // Convert other units to pixels (simplified)
  if (fontSize.endsWith('em')) {
    const parentFontSize = getFontSizeInPixels(
      element.parentElement || document.body
    )
    return parseFloat(fontSize) * parentFontSize
  }

  if (fontSize.endsWith('rem')) {
    const rootFontSize = parseFloat(
      getComputedStyle(document.documentElement).fontSize
    )
    return parseFloat(fontSize) * rootFontSize
  }

  // Default fallback
  return 16
}

/**
 * Check if font size meets minimum requirements (14px for body text)
 */
export function meetsMinimumFontSize(element: HTMLElement): boolean {
  const fontSize = getFontSizeInPixels(element)
  return fontSize >= 14
}

/**
 * Get line height ratio
 */
export function getLineHeightRatio(element: HTMLElement): number {
  const computedStyle = window.getComputedStyle(element)
  const lineHeight = computedStyle.lineHeight
  const fontSize = getFontSizeInPixels(element)

  if (lineHeight === 'normal') {
    return 1.2 // Browser default
  }

  if (lineHeight.endsWith('px')) {
    return parseFloat(lineHeight) / fontSize
  }

  // If it's a number, it's already a ratio
  return parseFloat(lineHeight) || 1.2
}

/**
 * Check if line height meets minimum requirements (1.4 ratio)
 */
export function meetsMinimumLineHeight(element: HTMLElement): boolean {
  const ratio = getLineHeightRatio(element)
  return ratio >= 1.4
}

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null

  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout)
    }

    timeout = setTimeout(() => {
      func(...args)
    }, wait)
  }
}
