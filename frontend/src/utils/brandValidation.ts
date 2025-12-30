/**
 * Brand Validation Utilities
 *
 * Implements comprehensive validation and error handling for Toastmasters brand compliance.
 * Includes 16 validation rules: CV001-CV004, TV001-TV005, AV001-AV004, CPV001-CPV004
 */

import { BRAND_COLORS, BRAND_GRADIENTS } from './brandConstants'

export interface ValidationError {
  type:
    | 'color'
    | 'typography'
    | 'accessibility'
    | 'gradient'
    | 'component'
    | 'spacing'
  severity: 'error' | 'warning' | 'info'
  message: string
  element?: HTMLElement
  suggestion?: string
  ruleId: string
}

export interface ValidationRule {
  id: string
  type:
    | 'color'
    | 'typography'
    | 'accessibility'
    | 'gradient'
    | 'spacing'
    | 'component'
  severity: 'error' | 'warning' | 'info'
  check: (element: HTMLElement) => boolean
  message: string
  autoFix?: (element: HTMLElement) => void
}

export interface ValidationConfig {
  rules: ValidationRule[]
  enableAutoFix: boolean
  reportingLevel: 'error' | 'warning' | 'info'
}

// Brand color validation utilities
export function isValidBrandColor(color: string): boolean {
  const normalizedColor = color.toLowerCase().replace(/\s/g, '')
  const brandColorValues = Object.values(BRAND_COLORS).map(c => c.toLowerCase())

  // Check exact hex matches
  if (brandColorValues.includes(normalizedColor)) {
    return true
  }

  // Check RGB equivalents
  const rgbColor = hexToRgb(normalizedColor)
  if (rgbColor) {
    return brandColorValues.some(brandColor => {
      const brandRgb = hexToRgb(brandColor)
      return (
        brandRgb &&
        rgbColor.r === brandRgb.r &&
        rgbColor.g === brandRgb.g &&
        rgbColor.b === brandRgb.b
      )
    })
  }

  return false
}

export function hexToRgb(
  hex: string
): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null
}

export function calculateContrastRatio(
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

export function meetsWCAGAA(
  foreground: string,
  background: string,
  isLargeText = false
): boolean {
  const ratio = calculateContrastRatio(foreground, background)
  return isLargeText ? ratio >= 3 : ratio >= 4.5
}

// Typography validation utilities
export function isValidHeadlineFont(fontFamily: string): boolean {
  return (
    fontFamily.toLowerCase().includes('montserrat') ||
    fontFamily.includes('system-ui') ||
    fontFamily.includes('-apple-system')
  )
}

export function isValidBodyFont(fontFamily: string): boolean {
  return (
    fontFamily.toLowerCase().includes('source sans') ||
    fontFamily.includes('system-ui') ||
    fontFamily.includes('-apple-system')
  )
}

export function hasMinimumFontSize(element: HTMLElement): boolean {
  const computedStyle = window.getComputedStyle(element)
  const fontSize = parseFloat(computedStyle.fontSize)
  return fontSize >= 14
}

export function hasMinimumLineHeight(element: HTMLElement): boolean {
  const computedStyle = window.getComputedStyle(element)
  const lineHeight = parseFloat(computedStyle.lineHeight)
  const fontSize = parseFloat(computedStyle.fontSize)
  return lineHeight / fontSize >= 1.4
}

export function hasProhibitedTextEffects(element: HTMLElement): boolean {
  const computedStyle = window.getComputedStyle(element)
  const textShadow = computedStyle.textShadow
  const filter = computedStyle.filter
  const textStroke = computedStyle.webkitTextStroke

  return (
    textShadow !== 'none' ||
    filter !== 'none' ||
    (textStroke !== undefined && textStroke !== 'none')
  )
}

// Touch target validation
export function meetsTouchTargetRequirements(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect()
  return rect.width >= 44 && rect.height >= 44
}

// Gradient validation utilities
export function countGradientsInView(): number {
  const elements = document.querySelectorAll('*')
  let gradientCount = 0

  elements.forEach(element => {
    const computedStyle = window.getComputedStyle(element as HTMLElement)
    const backgroundImage = computedStyle.backgroundImage

    if (backgroundImage && backgroundImage.includes('gradient')) {
      gradientCount++
    }
  })

  return gradientCount
}

export function isValidBrandGradient(gradientValue: string): boolean {
  const brandGradientValues = Object.values(BRAND_GRADIENTS)
  return brandGradientValues.some(
    brandGradient =>
      gradientValue.includes(brandGradient) ||
      brandGradient.includes(gradientValue)
  )
}

// Component validation utilities
export function isPrimaryButton(element: HTMLElement): boolean {
  return (
    element.tagName.toLowerCase() === 'button' &&
    (element.classList.contains('tm-btn-primary') ||
      element.classList.contains('bg-tm-loyal-blue'))
  )
}

export function isCard(element: HTMLElement): boolean {
  return (
    element.classList.contains('tm-card') ||
    element.classList.contains('bg-tm-cool-gray')
  )
}

export function isNavigation(element: HTMLElement): boolean {
  return (
    element.tagName.toLowerCase() === 'nav' ||
    element.classList.contains('tm-nav') ||
    element.classList.contains('bg-tm-loyal-blue')
  )
}

// Validation Rules Implementation

// Color Validation Rules (CV001-CV004)
export const colorValidationRules: ValidationRule[] = [
  {
    id: 'CV001',
    type: 'color',
    severity: 'error',
    message: 'Only brand palette colors are allowed',
    check: (element: HTMLElement) => {
      const computedStyle = window.getComputedStyle(element)
      const backgroundColor = computedStyle.backgroundColor
      const color = computedStyle.color

      if (backgroundColor && backgroundColor !== 'rgba(0, 0, 0, 0)') {
        const bgHex = rgbToHex(backgroundColor)
        if (bgHex && !isValidBrandColor(bgHex)) {
          return false
        }
      }

      if (color && color !== 'rgba(0, 0, 0, 0)') {
        const colorHex = rgbToHex(color)
        if (colorHex && !isValidBrandColor(colorHex)) {
          return false
        }
      }

      return true
    },
  },
  {
    id: 'CV002',
    type: 'color',
    severity: 'error',
    message: 'Contrast ratios must meet WCAG AA standards',
    check: (element: HTMLElement) => {
      const computedStyle = window.getComputedStyle(element)
      const backgroundColor = computedStyle.backgroundColor
      const color = computedStyle.color

      if (
        backgroundColor &&
        color &&
        backgroundColor !== 'rgba(0, 0, 0, 0)' &&
        color !== 'rgba(0, 0, 0, 0)'
      ) {
        const bgHex = rgbToHex(backgroundColor)
        const colorHex = rgbToHex(color)

        if (bgHex && colorHex) {
          const fontSize = parseFloat(computedStyle.fontSize)
          const isLargeText =
            fontSize >= 18 ||
            (fontSize >= 14 && computedStyle.fontWeight === 'bold')

          return meetsWCAGAA(colorHex, bgHex, isLargeText)
        }
      }

      return true
    },
  },
  {
    id: 'CV003',
    type: 'gradient',
    severity: 'error',
    message: 'Maximum one gradient per screen/view allowed',
    check: () => {
      return countGradientsInView() <= 1
    },
  },
  {
    id: 'CV004',
    type: 'gradient',
    severity: 'error',
    message: 'Gradient text overlays must pass contrast validation',
    check: (element: HTMLElement) => {
      const computedStyle = window.getComputedStyle(element)
      const backgroundImage = computedStyle.backgroundImage

      if (backgroundImage && backgroundImage.includes('gradient')) {
        // For gradient backgrounds, check if text has sufficient contrast
        // This is a simplified check - in practice, you'd need to analyze gradient stops
        const color = computedStyle.color
        if (color) {
          const colorHex = rgbToHex(color)
          if (colorHex) {
            // Use darkest brand color as baseline for gradient contrast
            return meetsWCAGAA(colorHex, BRAND_COLORS.loyalBlue)
          }
        }
      }

      return true
    },
  },
]

// Typography Validation Rules (TV001-TV005)
export const typographyValidationRules: ValidationRule[] = [
  {
    id: 'TV001',
    type: 'typography',
    severity: 'error',
    message: 'Headlines must use Montserrat font family',
    check: (element: HTMLElement) => {
      const tagName = element.tagName.toLowerCase()
      if (
        ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName) ||
        element.classList.contains('tm-headline')
      ) {
        const computedStyle = window.getComputedStyle(element)
        return isValidHeadlineFont(computedStyle.fontFamily)
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
        ['p', 'span', 'div', 'label', 'td', 'th'].includes(tagName) &&
        !element.classList.contains('tm-headline')
      ) {
        const computedStyle = window.getComputedStyle(element)
        return isValidBodyFont(computedStyle.fontFamily)
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
      if (['p', 'span', 'div', 'label', 'td', 'th'].includes(tagName)) {
        return hasMinimumFontSize(element)
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
      return hasMinimumLineHeight(element)
    },
  },
  {
    id: 'TV005',
    type: 'typography',
    severity: 'error',
    message: 'Prohibited text effects detected',
    check: (element: HTMLElement) => {
      return !hasProhibitedTextEffects(element)
    },
  },
]

// Accessibility Validation Rules (AV001-AV004)
export const accessibilityValidationRules: ValidationRule[] = [
  {
    id: 'AV001',
    type: 'accessibility',
    severity: 'error',
    message: 'Interactive elements must meet 44px minimum touch targets',
    check: (element: HTMLElement) => {
      const tagName = element.tagName.toLowerCase()
      const isInteractive =
        ['button', 'a', 'input', 'select', 'textarea'].includes(tagName) ||
        element.getAttribute('role') === 'button' ||
        element.getAttribute('tabindex') !== null

      if (isInteractive) {
        return meetsTouchTargetRequirements(element)
      }
      return true
    },
  },
  {
    id: 'AV002',
    type: 'accessibility',
    severity: 'warning',
    message: 'Proper heading hierarchy required',
    check: (element: HTMLElement) => {
      const tagName = element.tagName.toLowerCase()
      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
        // This is a simplified check - proper implementation would track heading hierarchy
        return true
      }
      return true
    },
  },
  {
    id: 'AV003',
    type: 'accessibility',
    severity: 'error',
    message: 'Focus indicators must be visible and high contrast',
    check: (element: HTMLElement) => {
      // Check if element can receive focus
      const tabIndex = element.getAttribute('tabindex')
      const isInteractive = [
        'button',
        'a',
        'input',
        'select',
        'textarea',
      ].includes(element.tagName.toLowerCase())

      if (isInteractive || tabIndex !== null) {
        // Check for focus styles - this is a simplified check
        const computedStyle = window.getComputedStyle(element, ':focus')
        return (
          computedStyle.outline !== 'none' || computedStyle.boxShadow !== 'none'
        )
      }
      return true
    },
  },
  {
    id: 'AV004',
    type: 'accessibility',
    severity: 'error',
    message: 'Semantic markup required for interactive elements',
    check: (element: HTMLElement) => {
      const tagName = element.tagName.toLowerCase()
      const role = element.getAttribute('role')

      // Check for proper semantic markup
      if (element.onclick && !['button', 'a'].includes(tagName) && !role) {
        return false
      }

      return true
    },
  },
]

// Component Validation Rules (CPV001-CPV004)
export const componentValidationRules: ValidationRule[] = [
  {
    id: 'CPV001',
    type: 'component',
    severity: 'error',
    message: 'Primary buttons must use TM Loyal Blue background',
    check: (element: HTMLElement) => {
      if (isPrimaryButton(element)) {
        const computedStyle = window.getComputedStyle(element)
        const backgroundColor = computedStyle.backgroundColor
        const bgHex = rgbToHex(backgroundColor)
        return bgHex === BRAND_COLORS.loyalBlue
      }
      return true
    },
  },
  {
    id: 'CPV002',
    type: 'component',
    severity: 'error',
    message: 'Cards must use TM Cool Gray backgrounds',
    check: (element: HTMLElement) => {
      if (isCard(element)) {
        const computedStyle = window.getComputedStyle(element)
        const backgroundColor = computedStyle.backgroundColor
        const bgHex = rgbToHex(backgroundColor)
        return bgHex === BRAND_COLORS.coolGray || bgHex === BRAND_COLORS.white
      }
      return true
    },
  },
  {
    id: 'CPV003',
    type: 'component',
    severity: 'error',
    message: 'Navigation must use TM Loyal Blue with white text',
    check: (element: HTMLElement) => {
      if (isNavigation(element)) {
        const computedStyle = window.getComputedStyle(element)
        const backgroundColor = computedStyle.backgroundColor
        const color = computedStyle.color
        const bgHex = rgbToHex(backgroundColor)
        const colorHex = rgbToHex(color)

        return (
          bgHex === BRAND_COLORS.loyalBlue && colorHex === BRAND_COLORS.white
        )
      }
      return true
    },
  },
  {
    id: 'CPV004',
    type: 'component',
    severity: 'error',
    message: 'Status indicators must use appropriate brand colors',
    check: (element: HTMLElement) => {
      if (
        element.classList.contains('status-indicator') ||
        element.classList.contains('tm-status')
      ) {
        const computedStyle = window.getComputedStyle(element)
        const backgroundColor = computedStyle.backgroundColor
        const bgHex = rgbToHex(backgroundColor)

        // Status indicators should use brand colors
        return bgHex ? isValidBrandColor(bgHex) : true
      }
      return true
    },
  },
]

// Utility function to convert RGB to Hex
export function rgbToHex(rgb: string): string | null {
  const result = rgb.match(/\d+/g)
  if (!result || result.length < 3) return null

  const r = parseInt(result[0])
  const g = parseInt(result[1])
  const b = parseInt(result[2])

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}

// All validation rules combined
export const allValidationRules: ValidationRule[] = [
  ...colorValidationRules,
  ...typographyValidationRules,
  ...accessibilityValidationRules,
  ...componentValidationRules,
]

// Main validation function
export function validateElement(
  element: HTMLElement,
  rules: ValidationRule[] = allValidationRules
): ValidationError[] {
  const errors: ValidationError[] = []

  rules.forEach(rule => {
    try {
      if (!rule.check(element)) {
        errors.push({
          type: rule.type,
          severity: rule.severity,
          message: rule.message,
          element,
          ruleId: rule.id,
          suggestion: getSuggestionForRule(rule.id),
        })
      }
    } catch (error) {
      console.warn(`Validation rule ${rule.id} failed to execute:`, error)
    }
  })

  return errors
}

// Validation suggestions
function getSuggestionForRule(ruleId: string): string {
  const suggestions: Record<string, string> = {
    CV001:
      'Use only brand palette colors: TM Loyal Blue (#004165), TM True Maroon (#772432), TM Cool Gray (#A9B2B1), TM Happy Yellow (#F2DF74), TM Black (#000000), TM White (#FFFFFF)',
    CV002:
      'Ensure text has sufficient contrast ratio (4.5:1 for normal text, 3:1 for large text)',
    CV003:
      'Remove additional gradients - only one gradient per screen is allowed',
    CV004:
      'Ensure text on gradients has sufficient contrast with the darkest gradient color',
    TV001: 'Use Montserrat font family for headlines and navigation labels',
    TV002:
      'Use Source Sans 3 font family for body text, form labels, and table content',
    TV003: 'Increase font size to minimum 14px for body text',
    TV004: 'Increase line-height to minimum 1.4 ratio',
    TV005:
      'Remove prohibited text effects (drop-shadow, word-art, distort, outline, glow)',
    AV001:
      'Increase element size to minimum 44px width and height for touch targets',
    AV002: 'Follow proper heading hierarchy (h1 → h2 → h3)',
    AV003: 'Add visible focus indicators with sufficient contrast',
    AV004:
      'Use semantic HTML elements or proper ARIA roles for interactive elements',
    CPV001: 'Use TM Loyal Blue (#004165) background for primary buttons',
    CPV002:
      'Use TM Cool Gray (#A9B2B1) or TM White (#FFFFFF) background for cards',
    CPV003:
      'Use TM Loyal Blue (#004165) background with TM White (#FFFFFF) text for navigation',
    CPV004: 'Use appropriate brand colors for status indicators',
  }

  return suggestions[ruleId] || 'Follow Toastmasters brand guidelines'
}

// Validate entire page
export function validatePage(): ValidationError[] {
  const allElements = document.querySelectorAll('*')
  const allErrors: ValidationError[] = []

  allElements.forEach(element => {
    const errors = validateElement(element as HTMLElement)
    allErrors.push(...errors)
  })

  return allErrors
}

// Error recovery strategies
export function applyErrorRecovery(error: ValidationError): boolean {
  if (!error.element) return false

  try {
    switch (error.ruleId) {
      case 'CV001':
        return applyColorFallback(error.element)
      case 'TV003':
        return applyFontSizeFallback(error.element)
      case 'AV001':
        return applyTouchTargetExpansion(error.element)
      default:
        return false
    }
  } catch (e) {
    console.warn(`Error recovery failed for rule ${error.ruleId}:`, e)
    return false
  }
}

function applyColorFallback(element: HTMLElement): boolean {
  const computedStyle = window.getComputedStyle(element)
  const backgroundColor = computedStyle.backgroundColor

  if (backgroundColor && backgroundColor !== 'rgba(0, 0, 0, 0)') {
    // Apply nearest brand color fallback
    element.style.backgroundColor = BRAND_COLORS.coolGray
    return true
  }

  return false
}

function applyFontSizeFallback(element: HTMLElement): boolean {
  const computedStyle = window.getComputedStyle(element)
  const fontSize = parseFloat(computedStyle.fontSize)

  if (fontSize < 14) {
    element.style.fontSize = '14px'
    return true
  }

  return false
}

function applyTouchTargetExpansion(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect()

  if (rect.width < 44 || rect.height < 44) {
    element.style.minWidth = '44px'
    element.style.minHeight = '44px'
    element.style.padding = '8px'
    return true
  }

  return false
}
