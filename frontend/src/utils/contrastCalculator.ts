/**
 * WCAG AA Contrast Validation Utilities
 *
 * This module provides comprehensive contrast validation utilities for ensuring
 * WCAG AA compliance (4.5:1 ratio for normal text, 3:1 for large text).
 *
 * Requirements: 3.1 - Accessibility Compliance
 */

export interface ContrastValidationResult {
  ratio: number
  passes: boolean
  level: 'AA' | 'AAA' | 'fail'
  foreground: string
  background: string
  isLargeText?: boolean
  recommendation?: string
}

export interface ColorRGB {
  r: number
  g: number
  b: number
}

/**
 * Convert hex color to RGB values
 */
export function hexToRgb(hex: string): ColorRGB | null {
  // Remove # if present and handle 3-digit hex
  const cleanHex = hex.replace('#', '')

  if (cleanHex.length === 3) {
    const result = /^([a-f\d])([a-f\d])([a-f\d])$/i.exec(cleanHex)
    return result
      ? {
          r: parseInt(result[1] + result[1], 16),
          g: parseInt(result[2] + result[2], 16),
          b: parseInt(result[3] + result[3], 16),
        }
      : null
  }

  const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(cleanHex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null
}

/**
 * Convert RGB color to hex
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.round(Math.max(0, Math.min(255, n))).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * Calculate relative luminance of a color according to WCAG 2.1
 * https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html
 */
export function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/**
 * Calculate contrast ratio between two colors
 * Returns a value between 1 and 21 (21:1 is perfect contrast)
 */
export function calculateContrastRatio(
  foreground: string,
  background: string
): number {
  const fgRgb = hexToRgb(foreground)
  const bgRgb = hexToRgb(background)

  if (!fgRgb || !bgRgb) {
    console.warn(`Invalid color format: ${foreground} or ${background}`)
    return 1 // Worst case if colors can't be parsed
  }

  const fgLuminance = getRelativeLuminance(fgRgb.r, fgRgb.g, fgRgb.b)
  const bgLuminance = getRelativeLuminance(bgRgb.r, bgRgb.g, bgRgb.b)

  const lighter = Math.max(fgLuminance, bgLuminance)
  const darker = Math.min(fgLuminance, bgLuminance)

  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Validate contrast ratio against WCAG AA standards
 * @param foreground - Foreground color (hex)
 * @param background - Background color (hex)
 * @param isLargeText - Whether text is large (18pt+ or 14pt+ bold)
 */
export function validateContrastRatio(
  foreground: string,
  background: string,
  isLargeText = false
): ContrastValidationResult {
  const ratio = calculateContrastRatio(foreground, background)
  const requiredRatio = isLargeText ? 3.0 : 4.5
  const aaaRatio = isLargeText ? 4.5 : 7.0

  let level: 'AA' | 'AAA' | 'fail'
  let recommendation: string | undefined

  if (ratio >= aaaRatio) {
    level = 'AAA'
  } else if (ratio >= requiredRatio) {
    level = 'AA'
  } else {
    level = 'fail'
    recommendation = `Contrast ratio ${ratio.toFixed(2)}:1 is below WCAG AA requirement of ${requiredRatio}:1. Consider using a darker foreground or lighter background.`
  }

  return {
    ratio: Math.round(ratio * 100) / 100,
    passes: ratio >= requiredRatio,
    level,
    foreground,
    background,
    isLargeText,
    recommendation,
  }
}

/**
 * Get all text/background color combinations from DOM elements
 */
export function getAllColorCombinations(
  container: HTMLElement = document.body
): Array<{ foreground: string; background: string; element: HTMLElement }> {
  const combinations: Array<{
    foreground: string
    background: string
    element: HTMLElement
  }> = []
  const elements = container.querySelectorAll('*')

  elements.forEach(element => {
    const htmlElement = element as HTMLElement
    const computedStyle = window.getComputedStyle(htmlElement)
    const color = computedStyle.color
    const backgroundColor = computedStyle.backgroundColor

    // Convert RGB to hex if needed
    const foreground = rgbStringToHex(color)
    const background =
      rgbStringToHex(backgroundColor) || getBackgroundColor(htmlElement)

    if (foreground && background && foreground !== background) {
      combinations.push({
        foreground,
        background,
        element: htmlElement,
      })
    }
  })

  return combinations
}

/**
 * Convert RGB string to hex
 */
function rgbStringToHex(rgbString: string): string | null {
  if (rgbString.startsWith('#')) {
    return rgbString
  }

  const rgbMatch = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1])
    const g = parseInt(rgbMatch[2])
    const b = parseInt(rgbMatch[3])
    return rgbToHex(r, g, b)
  }

  const rgbaMatch = rgbString.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)/)
  if (rgbaMatch) {
    const r = parseInt(rgbaMatch[1])
    const g = parseInt(rgbaMatch[2])
    const b = parseInt(rgbaMatch[3])
    return rgbToHex(r, g, b)
  }

  return null
}

/**
 * Get effective background color by traversing up the DOM tree
 */
function getBackgroundColor(element: HTMLElement): string {
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
 * Validate all text/background combinations in a container
 */
export function validateAllContrasts(
  container: HTMLElement = document.body
): ContrastValidationResult[] {
  const combinations = getAllColorCombinations(container)

  return combinations.map(({ foreground, background, element }) => {
    const isLargeText = isElementLargeText(element)
    return validateContrastRatio(foreground, background, isLargeText)
  })
}

/**
 * Check if an element contains large text (18pt+ or 14pt+ bold)
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
 * Find the best contrasting color from a set of options
 */
export function findBestContrastingColor(
  background: string,
  colorOptions: string[],
  isLargeText = false
): { color: string; ratio: number } | null {
  let bestColor: string | null = null
  let bestRatio = 0

  for (const color of colorOptions) {
    const ratio = calculateContrastRatio(color, background)
    if (ratio > bestRatio) {
      bestRatio = ratio
      bestColor = color
    }
  }

  if (!bestColor) return null

  const requiredRatio = isLargeText ? 3.0 : 4.5
  return bestRatio >= requiredRatio
    ? { color: bestColor, ratio: bestRatio }
    : null
}

/**
 * Generate a high-contrast version of a color
 */
export function generateHighContrastColor(
  background: string,
  preferDark = true
): string {
  const bgRgb = hexToRgb(background)
  if (!bgRgb) return preferDark ? '#000000' : '#ffffff'

  const bgLuminance = getRelativeLuminance(bgRgb.r, bgRgb.g, bgRgb.b)

  // If background is light, return dark color; if dark, return light color
  return bgLuminance > 0.5 ? '#000000' : '#ffffff'
}

/**
 * Batch validate multiple color combinations
 */
export function batchValidateContrasts(
  combinations: Array<{
    foreground: string
    background: string
    isLargeText?: boolean
  }>
): ContrastValidationResult[] {
  return combinations.map(({ foreground, background, isLargeText = false }) =>
    validateContrastRatio(foreground, background, isLargeText)
  )
}

/**
 * Semantic Markup Validation Utilities
 * Requirements: 3.5 - Semantic markup and proper heading hierarchy
 */

export interface SemanticValidationResult {
  element: HTMLElement
  issues: string[]
  passes: boolean
  recommendations: string[]
}

export interface HeadingHierarchyResult {
  headings: Array<{
    element: HTMLElement
    level: number
    text: string
    hasSkippedLevel: boolean
  }>
  violations: Array<{
    element: HTMLElement
    issue: string
    recommendation: string
  }>
  passes: boolean
}

/**
 * Validate semantic markup for interactive elements
 */
export function validateSemanticMarkup(
  element: HTMLElement
): SemanticValidationResult {
  const issues: string[] = []
  const recommendations: string[] = []

  // Check for proper ARIA labels
  if (isInteractiveElement(element)) {
    const ariaLabel = element.getAttribute('aria-label')
    const ariaLabelledBy = element.getAttribute('aria-labelledby')
    const textContent = element.textContent?.trim()

    // Interactive elements should have accessible names
    if (!ariaLabel && !ariaLabelledBy && !textContent) {
      issues.push('Interactive element lacks accessible name')
      recommendations.push(
        'Add aria-label, aria-labelledby, or visible text content'
      )
    }

    // Check for proper roles
    const role = element.getAttribute('role')
    const tagName = element.tagName.toLowerCase()

    if (tagName === 'div' && element.onclick && !role) {
      issues.push('Clickable div lacks proper role')
      recommendations.push('Add role="button" or use a proper button element')
    }

    // Check for keyboard accessibility
    const tabIndex = element.getAttribute('tabindex')
    if (
      element.onclick &&
      !['button', 'a', 'input', 'select', 'textarea'].includes(tagName) &&
      tabIndex === null
    ) {
      issues.push('Interactive element not keyboard accessible')
      recommendations.push('Add tabindex="0" or use a focusable element')
    }
  }

  // Check for proper form labels
  if (
    element.tagName.toLowerCase() === 'input' &&
    element.getAttribute('type') !== 'hidden'
  ) {
    const id = element.getAttribute('id')
    const ariaLabel = element.getAttribute('aria-label')
    const ariaLabelledBy = element.getAttribute('aria-labelledby')

    let hasLabel = false
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`)
      hasLabel = !!label
    }

    if (!hasLabel && !ariaLabel && !ariaLabelledBy) {
      issues.push('Form input lacks proper label')
      recommendations.push(
        'Add a label element with for attribute, aria-label, or aria-labelledby'
      )
    }
  }

  // Check for proper heading structure
  if (element.tagName.match(/^H[1-6]$/)) {
    const textContent = element.textContent?.trim()

    if (!textContent) {
      issues.push('Heading element is empty')
      recommendations.push('Add descriptive text content to the heading')
    }
  }

  // Check for proper list structure
  if (element.tagName.toLowerCase() === 'li') {
    const parent = element.parentElement
    if (!parent || !['ul', 'ol'].includes(parent.tagName.toLowerCase())) {
      issues.push('List item not contained in proper list element')
      recommendations.push('Wrap list items in ul or ol elements')
    }
  }

  return {
    element,
    issues,
    passes: issues.length === 0,
    recommendations,
  }
}

/**
 * Validate heading hierarchy in a container
 */
export function validateHeadingHierarchy(
  container: HTMLElement = document.body
): HeadingHierarchyResult {
  const headingElements = container.querySelectorAll('h1, h2, h3, h4, h5, h6')
  const headings: HeadingHierarchyResult['headings'] = []
  const violations: HeadingHierarchyResult['violations'] = []

  let previousLevel = 0

  headingElements.forEach(element => {
    const htmlElement = element as HTMLElement
    const level = parseInt(htmlElement.tagName.charAt(1))
    const text = htmlElement.textContent?.trim() || ''

    // Check for skipped levels
    const hasSkippedLevel = level > previousLevel + 1 && previousLevel > 0

    if (hasSkippedLevel) {
      violations.push({
        element: htmlElement,
        issue: `Heading level ${level} follows h${previousLevel}, skipping intermediate levels`,
        recommendation: `Use h${previousLevel + 1} instead of h${level}, or add intermediate heading levels`,
      })
    }

    // Check for empty headings
    if (!text) {
      violations.push({
        element: htmlElement,
        issue: 'Heading element is empty',
        recommendation: 'Add descriptive text content to the heading',
      })
    }

    headings.push({
      element: htmlElement,
      level,
      text,
      hasSkippedLevel,
    })

    previousLevel = level
  })

  // Check for missing h1
  const hasH1 = headings.some(h => h.level === 1)
  if (headings.length > 0 && !hasH1) {
    violations.push({
      element: container,
      issue: 'Page lacks h1 heading',
      recommendation: 'Add an h1 element as the main page heading',
    })
  }

  return {
    headings,
    violations,
    passes: violations.length === 0,
  }
}

/**
 * Validate all semantic markup in a container
 */
export function validateAllSemanticMarkup(
  container: HTMLElement = document.body
): SemanticValidationResult[] {
  const elements = container.querySelectorAll('*')
  const results: SemanticValidationResult[] = []

  elements.forEach(element => {
    const htmlElement = element as HTMLElement
    const result = validateSemanticMarkup(htmlElement)

    if (!result.passes) {
      results.push(result)
    }
  })

  return results
}

/**
 * Check if an element is interactive
 */
function isInteractiveElement(element: HTMLElement): boolean {
  const interactiveTags = ['button', 'a', 'input', 'select', 'textarea']
  const interactiveRoles = [
    'button',
    'link',
    'menuitem',
    'tab',
    'checkbox',
    'radio',
  ]

  const tagName = element.tagName.toLowerCase()
  const role = element.getAttribute('role')
  const tabIndex = element.getAttribute('tabindex')
  const hasClickHandler =
    element.onclick !== null || element.getAttribute('onclick') !== null

  return (
    interactiveTags.includes(tagName) ||
    (role && interactiveRoles.includes(role)) ||
    (tabIndex && tabIndex !== '-1') ||
    hasClickHandler
  )
}

/**
 * Generate accessibility report for a container
 */
export function generateAccessibilityReport(
  container: HTMLElement = document.body
): {
  contrastViolations: ContrastValidationResult[]
  semanticIssues: SemanticValidationResult[]
  headingHierarchy: HeadingHierarchyResult
  summary: {
    totalIssues: number
    criticalIssues: number
    passesBasicAccessibility: boolean
  }
} {
  const contrastViolations = validateAllContrasts(container).filter(
    r => !r.passes
  )
  const semanticIssues = validateAllSemanticMarkup(container)
  const headingHierarchy = validateHeadingHierarchy(container)

  const totalIssues =
    contrastViolations.length +
    semanticIssues.length +
    headingHierarchy.violations.length
  const criticalIssues =
    contrastViolations.filter(v => v.level === 'fail').length +
    semanticIssues.filter(s =>
      s.issues.some(i => i.includes('accessible name'))
    ).length

  return {
    contrastViolations,
    semanticIssues,
    headingHierarchy,
    summary: {
      totalIssues,
      criticalIssues,
      passesBasicAccessibility: totalIssues === 0,
    },
  }
}
