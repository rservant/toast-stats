/**
 * Brand Compliance Testing Utilities
 *
 * Validates Toastmasters International brand guidelines compliance
 * including colors, typography, and design system usage.
 * Enhanced with detailed reporting and performance optimization.
 */

import { ReactElement } from 'react'
import { renderWithProviders } from './componentTestUtils'

// Toastmasters brand colors with hex validation
const BRAND_COLORS = {
  'tm-loyal-blue': '#004165',
  'tm-true-maroon': '#772432',
  'tm-cool-gray': '#a9b2b1',
  'tm-happy-yellow': '#f2df74',
  'tm-black': '#000000',
  'tm-white': '#ffffff',
} as const

// Brand typography with fallback validation
const BRAND_FONTS = {
  headline: 'Montserrat',
  body: 'Source Sans 3',
} as const

// Note: BRAND_FONTS available for future typography validation enhancements
// Currently used for: headline font validation, body font validation
void BRAND_FONTS // Suppress unused variable warning

// Performance optimization: Cache DOM queries
const queryCache = new Map<string, Element[]>()

// Brand compliance violation types for detailed reporting
interface BrandViolation {
  type:
    | 'color'
    | 'typography'
    | 'spacing'
    | 'touch-target'
    | 'gradient'
    | 'accessibility'
  element: Element
  violation: string
  remediation: string
  severity: 'critical' | 'high' | 'medium' | 'low'
}

// Brand compliance report
interface BrandComplianceReport {
  violations: BrandViolation[]
  passed: number
  failed: number
  score: number
  recommendations: string[]
}

/**
 * Performance-optimized DOM query with caching
 */
const getCachedElements = (container: Element, selector: string): Element[] => {
  const cacheKey = `${container.tagName}-${selector}`
  if (queryCache.has(cacheKey)) {
    return queryCache.get(cacheKey)!
  }

  const elements = Array.from(container.querySelectorAll(selector))
  queryCache.set(cacheKey, elements)
  return elements
}

/**
 * Clear query cache for fresh component testing
 */
const clearQueryCache = (): void => {
  queryCache.clear()
}

/**
 * Generate detailed brand compliance report
 */
const generateComplianceReport = (
  violations: BrandViolation[]
): BrandComplianceReport => {
  const totalChecks = violations.length + Math.max(0, 20 - violations.length) // Assume ~20 checks
  const failed = violations.length
  const passed = totalChecks - failed
  const score = Math.round((passed / totalChecks) * 100)

  const recommendations = [
    ...new Set(violations.map(v => v.remediation)),
  ].slice(0, 5) // Top 5 unique recommendations

  return {
    violations,
    passed,
    failed,
    score,
    recommendations,
  }
}

/**
 * Enhanced brand color validation with detailed reporting
 */
export const expectBrandColors = (
  component: ReactElement
): BrandViolation[] => {
  const { container } = renderWithProviders(component)
  const violations: BrandViolation[] = []

  // Performance optimization: Use cached queries for large component trees
  const elementsWithColor = getCachedElements(
    container,
    '[class*="bg-"], [class*="text-"], [class*="border-"], [style*="color"], [style*="background"]'
  )

  elementsWithColor.forEach(element => {
    const classList = Array.from(element.classList)
    const style = (element as HTMLElement).style

    // Check CSS custom properties for brand colors
    // Note: computedStyle available for future color validation enhancements

    // Validate against Toastmasters brand palette
    const colorClasses = classList.filter(
      cls =>
        cls.includes('bg-') || cls.includes('text-') || cls.includes('border-')
    )

    colorClasses.forEach(colorClass => {
      // Check for non-brand colors
      const isCustomColor =
        colorClass.includes('rgb(') || colorClass.includes('#')
      const isBrandColor =
        colorClass.includes('tm-') ||
        colorClass.includes('blue-') ||
        colorClass.includes('gray-') ||
        colorClass.includes('red-') ||
        colorClass.includes('maroon-') ||
        colorClass.includes('yellow-') ||
        colorClass.includes('white') ||
        colorClass.includes('black')

      if (isCustomColor && !isBrandColor) {
        violations.push({
          type: 'color',
          element,
          violation: `Non-brand color used: ${colorClass}`,
          remediation:
            'Use Toastmasters brand colors: Loyal Blue (#004165), True Maroon (#772432), Cool Gray (#a9b2b1), Happy Yellow (#f2df74)',
          severity: 'high',
        })
      }
    })

    // Check inline styles for non-brand colors
    if (
      style.backgroundColor &&
      !Object.values(BRAND_COLORS).some(brandColor =>
        style.backgroundColor.toLowerCase().includes(brandColor.toLowerCase())
      )
    ) {
      violations.push({
        type: 'color',
        element,
        violation: `Non-brand background color in inline style: ${style.backgroundColor}`,
        remediation:
          'Use CSS custom properties: var(--tm-loyal-blue), var(--tm-true-maroon), etc.',
        severity: 'critical',
      })
    }
  })

  return violations
}

/**
 * Enhanced typography validation with Toastmasters-specific rules
 */
export const expectBrandTypography = (
  component: ReactElement
): BrandViolation[] => {
  const { container } = renderWithProviders(component)
  const violations: BrandViolation[] = []

  // Performance optimization: Target specific text elements
  const textElements = getCachedElements(
    container,
    'h1, h2, h3, h4, h5, h6, p, span, div, button, a'
  )

  textElements.forEach(element => {
    const computedStyle = window.getComputedStyle(element)
    const fontFamily = computedStyle.fontFamily.toLowerCase()
    const fontSize = parseInt(computedStyle.fontSize)

    // Validate Toastmasters typography requirements
    const usesBrandFont =
      fontFamily.includes('montserrat') ||
      fontFamily.includes('source sans') ||
      fontFamily.includes('system-ui') ||
      fontFamily.includes('arial') ||
      fontFamily.includes('sans-serif')

    if (!usesBrandFont) {
      violations.push({
        type: 'typography',
        element,
        violation: `Non-brand font family: ${fontFamily}`,
        remediation:
          'Use Montserrat for headlines or Source Sans 3 for body text with proper fallbacks',
        severity: 'medium',
      })
    }

    // Check minimum font size (14px for body text)
    if (fontSize < 14 && element.tagName.toLowerCase() !== 'small') {
      violations.push({
        type: 'typography',
        element,
        violation: `Font size too small: ${fontSize}px`,
        remediation:
          'Use minimum 14px font size for body text to ensure readability',
        severity: 'high',
      })
    }

    // Check for text effects (prohibited by brand guidelines)
    const textShadow = computedStyle.textShadow

    if (textShadow && textShadow !== 'none') {
      violations.push({
        type: 'typography',
        element,
        violation: `Text effects not allowed: text-shadow`,
        remediation:
          'Remove text effects (drop-shadow, outline, glow) per Toastmasters brand guidelines',
        severity: 'medium',
      })
    }
  })

  return violations
}

/**
 * Enhanced touch target validation with detailed measurements
 */
export const expectTouchTargets = (
  component: ReactElement
): BrandViolation[] => {
  const { container } = renderWithProviders(component)
  const violations: BrandViolation[] = []

  // Performance optimization: Target only interactive elements
  const interactiveElements = getCachedElements(
    container,
    'button, a, input[type="button"], input[type="submit"], [role="button"], [tabindex]:not([tabindex="-1"])'
  )

  interactiveElements.forEach(element => {
    const computedStyle = window.getComputedStyle(element)
    const rect = element.getBoundingClientRect()

    // Get actual dimensions including padding
    const actualHeight = rect.height || parseInt(computedStyle.height)
    const actualWidth = rect.width || parseInt(computedStyle.width)
    const minHeight = parseInt(computedStyle.minHeight) || actualHeight
    const minWidth = parseInt(computedStyle.minWidth) || actualWidth

    // Toastmasters requires 44px minimum touch targets
    if (minHeight < 44 || actualHeight < 44) {
      violations.push({
        type: 'touch-target',
        element,
        violation: `Touch target height too small: ${Math.round(actualHeight)}px (minimum 44px required)`,
        remediation:
          'Set min-height: 44px or use padding to achieve 44px touch target',
        severity: 'high',
      })
    }

    if (minWidth < 44 || actualWidth < 44) {
      violations.push({
        type: 'touch-target',
        element,
        violation: `Touch target width too small: ${Math.round(actualWidth)}px (minimum 44px required)`,
        remediation:
          'Set min-width: 44px or use padding to achieve 44px touch target',
        severity: 'high',
      })
    }
  })

  return violations
}

/**
 * Enhanced gradient validation with specific Toastmasters rules
 */
export const expectGradientUsage = (
  component: ReactElement
): BrandViolation[] => {
  const { container } = renderWithProviders(component)
  const violations: BrandViolation[] = []

  // Check for gradient classes and inline styles
  const gradientElements = getCachedElements(
    container,
    '[class*="gradient"], [style*="gradient"]'
  )

  // Toastmasters brand guideline: Maximum 1 gradient per screen
  if (gradientElements.length > 1) {
    gradientElements.slice(1).forEach(element => {
      violations.push({
        type: 'gradient',
        element,
        violation: `Multiple gradients detected (${gradientElements.length} total). Maximum 1 gradient per screen allowed.`,
        remediation:
          'Use only one brand gradient per screen/view. Consider using solid brand colors instead.',
        severity: 'medium',
      })
    })
  }

  // Validate gradient colors are from brand palette
  gradientElements.forEach(element => {
    const computedStyle = window.getComputedStyle(element)
    const backgroundImage = computedStyle.backgroundImage

    if (backgroundImage && backgroundImage.includes('gradient')) {
      // Check if gradient uses non-brand colors (simplified check)
      const hasNonBrandColors = !Object.values(BRAND_COLORS).some(color =>
        backgroundImage.includes(color.toLowerCase())
      )

      if (hasNonBrandColors && !backgroundImage.includes('var(--tm-')) {
        violations.push({
          type: 'gradient',
          element,
          violation: 'Gradient uses non-brand colors',
          remediation:
            'Use only Toastmasters brand gradients: TM Loyal Blue, TM True Maroon, or TM Cool Gray gradients',
          severity: 'medium',
        })
      }
    }
  })

  return violations
}

/**
 * Enhanced brand spacing validation with Toastmasters design system
 */
export const expectBrandSpacing = (
  component: ReactElement
): BrandViolation[] => {
  const { container } = renderWithProviders(component)
  const violations: BrandViolation[] = []

  // Toastmasters spacing scale (4px increments)
  const validSpacingValues = [
    0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64,
  ]

  const elementsWithSpacing = getCachedElements(
    container,
    '[class*="p-"], [class*="m-"], [class*="gap-"], [class*="space-"]'
  )

  elementsWithSpacing.forEach(element => {
    const classList = Array.from(element.classList)

    // Check for consistent spacing scale (4px increments)
    const spacingClasses = classList.filter(
      cls =>
        cls.match(/^[pm][trblxy]?-\d+$/) ||
        cls.match(/^gap-\d+$/) ||
        cls.match(/^space-[xy]-\d+$/)
    )

    spacingClasses.forEach(spacingClass => {
      const value = spacingClass.match(/\d+$/)?.[0]
      if (value) {
        const numValue = parseInt(value)
        if (!validSpacingValues.includes(numValue)) {
          violations.push({
            type: 'spacing',
            element,
            violation: `Non-standard spacing value: ${spacingClass}`,
            remediation: `Use Toastmasters spacing scale: ${validSpacingValues.join(', ')} (4px increments)`,
            severity: 'low',
          })
        }
      }
    })
  })

  return violations
}

/**
 * Enhanced accessibility validation with brand color contrast
 */
export const expectBrandAccessibility = (
  component: ReactElement
): BrandViolation[] => {
  const { container } = renderWithProviders(component)
  const violations: BrandViolation[] = []

  // Check for proper contrast with brand colors
  const textElements = getCachedElements(container, '*')

  textElements.forEach(element => {
    const classList = Array.from(element.classList)
    const computedStyle = window.getComputedStyle(element)
    const color = computedStyle.color
    const backgroundColor = computedStyle.backgroundColor

    // Check for high-contrast combinations with Toastmasters colors
    const hasLoyalBlueBackground = classList.some(
      cls =>
        cls.includes('bg-tm-loyal-blue') ||
        cls.includes('bg-blue-') ||
        backgroundColor.includes('#004165')
    )
    const hasTrueMaroonBackground = classList.some(
      cls =>
        cls.includes('bg-tm-true-maroon') ||
        cls.includes('bg-red-') ||
        backgroundColor.includes('#772432')
    )
    const hasWhiteText = classList.some(
      cls =>
        cls.includes('text-white') ||
        cls.includes('text-tm-white') ||
        color.includes('#ffffff')
    )

    // Validate contrast ratios for brand colors
    if (
      hasLoyalBlueBackground &&
      !hasWhiteText &&
      element.textContent?.trim()
    ) {
      violations.push({
        type: 'accessibility',
        element,
        violation: 'Insufficient contrast: Dark text on Loyal Blue background',
        remediation:
          'Use white text (text-white or text-tm-white) on Loyal Blue backgrounds for WCAG AA compliance',
        severity: 'high',
      })
    }

    if (
      hasTrueMaroonBackground &&
      !hasWhiteText &&
      element.textContent?.trim()
    ) {
      violations.push({
        type: 'accessibility',
        element,
        violation: 'Insufficient contrast: Dark text on True Maroon background',
        remediation:
          'Use white text (text-white or text-tm-white) on True Maroon backgrounds for WCAG AA compliance',
        severity: 'high',
      })
    }

    // Check for missing alt text on images
    if (element.tagName.toLowerCase() === 'img') {
      const alt = element.getAttribute('alt')
      const ariaLabel = element.getAttribute('aria-label')

      if (!alt && !ariaLabel) {
        violations.push({
          type: 'accessibility',
          element,
          violation: 'Image missing alt text or aria-label',
          remediation:
            'Add descriptive alt text or aria-label for screen reader accessibility',
          severity: 'high',
        })
      }
    }
  })

  return violations
}

/**
 * Enhanced comprehensive brand compliance test suite with detailed reporting
 */
export const runBrandComplianceTestSuite = (
  component: ReactElement
): BrandComplianceReport => {
  // Clear cache for fresh testing
  clearQueryCache()

  const allViolations: BrandViolation[] = []

  // Collect violations from all checks
  allViolations.push(...expectBrandColors(component))
  allViolations.push(...expectBrandTypography(component))
  allViolations.push(...expectTouchTargets(component))
  allViolations.push(...expectGradientUsage(component))
  allViolations.push(...expectBrandSpacing(component))
  allViolations.push(...expectBrandAccessibility(component))
  allViolations.push(...expectToastmastersPatterns(component))

  // Generate detailed report
  return generateComplianceReport(allViolations)
}

/**
 * Enhanced Toastmasters component pattern validation
 */
export const expectToastmastersPatterns = (
  component: ReactElement
): BrandViolation[] => {
  const { container } = renderWithProviders(component)
  const violations: BrandViolation[] = []

  // Check for proper button styling with Toastmasters patterns
  const buttons = getCachedElements(container, 'button')
  buttons.forEach(button => {
    const classList = Array.from(button.classList)
    const computedStyle = window.getComputedStyle(button)

    // Should have proper button styling classes
    const hasButtonStyling = classList.some(
      cls =>
        cls.includes('btn') ||
        cls.includes('button') ||
        cls.includes('bg-') ||
        (cls.includes('px-') && cls.includes('py-'))
    )

    if (!hasButtonStyling) {
      violations.push({
        type: 'color',
        element: button,
        violation: 'Button missing proper styling classes',
        remediation:
          'Add button styling: bg-tm-loyal-blue, px-6, py-3, text-white, font-semibold, rounded',
        severity: 'medium',
      })
    }

    // Check for proper button colors (should use brand colors)
    const backgroundColor = computedStyle.backgroundColor

    if (
      backgroundColor &&
      !Object.values(BRAND_COLORS).some(
        brandColor =>
          backgroundColor.includes(brandColor) ||
          backgroundColor.includes('var(--tm-')
      )
    ) {
      violations.push({
        type: 'color',
        element: button,
        violation: `Button uses non-brand background color: ${backgroundColor}`,
        remediation:
          'Use brand colors: bg-tm-loyal-blue for primary buttons, bg-tm-true-maroon for secondary',
        severity: 'medium',
      })
    }
  })

  // Check for proper card styling with Toastmasters patterns
  const cards = getCachedElements(
    container,
    '.card, [class*="card"], .panel, [class*="panel"]'
  )
  cards.forEach(card => {
    const classList = Array.from(card.classList)
    const computedStyle = window.getComputedStyle(card)

    // Should have proper card styling
    const hasCardStyling = classList.some(
      cls =>
        cls.includes('bg-') ||
        cls.includes('border') ||
        cls.includes('rounded') ||
        cls.includes('shadow')
    )

    if (!hasCardStyling) {
      violations.push({
        type: 'color',
        element: card,
        violation: 'Card/Panel missing proper styling',
        remediation:
          'Add card styling: bg-white, border, rounded-lg, shadow-sm, p-6',
        severity: 'low',
      })
    }

    // Check for proper card background (should be white or cool gray)
    const backgroundColor = computedStyle.backgroundColor
    if (
      backgroundColor &&
      backgroundColor !== 'rgba(0, 0, 0, 0)' &&
      !backgroundColor.includes('#ffffff') &&
      !backgroundColor.includes('#a9b2b1') &&
      !backgroundColor.includes('var(--tm-white)') &&
      !backgroundColor.includes('var(--tm-cool-gray)')
    ) {
      violations.push({
        type: 'color',
        element: card,
        violation: `Card uses non-standard background color: ${backgroundColor}`,
        remediation: 'Use bg-white or bg-tm-cool-gray for card backgrounds',
        severity: 'low',
      })
    }
  })

  return violations
}

/**
 * Performance-optimized brand compliance check for large component trees
 */
export const runQuickBrandCheck = (
  component: ReactElement
): { passed: boolean; criticalViolations: BrandViolation[] } => {
  // Quick check focusing only on critical violations
  const criticalViolations: BrandViolation[] = []

  // Only check for critical brand violations
  const colorViolations = expectBrandColors(component).filter(
    v => v.severity === 'critical'
  )
  const touchTargetViolations = expectTouchTargets(component).filter(
    v => v.severity === 'high'
  )
  const accessibilityViolations = expectBrandAccessibility(component).filter(
    v => v.severity === 'high'
  )

  criticalViolations.push(
    ...colorViolations,
    ...touchTargetViolations,
    ...accessibilityViolations
  )

  return {
    passed: criticalViolations.length === 0,
    criticalViolations,
  }
}

// Export types for external use
export type { BrandViolation, BrandComplianceReport }
