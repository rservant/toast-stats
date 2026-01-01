/**
 * Chart Accessibility and Brand Compliance Utilities
 *
 * This module provides utilities for ensuring chart components meet
 * WCAG AA accessibility standards and Toastmasters brand compliance.
 */

/**
 * WCAG AA contrast ratio requirements
 */
export const CONTRAST_RATIOS = {
  NORMAL_TEXT: 4.5,
  LARGE_TEXT: 3.0,
  NON_TEXT: 3.0,
} as const

/**
 * Brand-compliant chart color palette with accessibility validation
 */
export const CHART_COLORS = {
  PRIMARY: [
    'var(--tm-loyal-blue)', // #004165 - Primary data series
    'var(--tm-true-maroon)', // #772432 - Secondary data series
    'var(--tm-cool-gray)', // #A9B2B1 - Tertiary data series
    'var(--tm-happy-yellow)', // #F2DF74 - Accent data series
  ],
  EXTENDED: [
    'var(--tm-loyal-blue)',
    'var(--tm-true-maroon)',
    'var(--tm-cool-gray)',
    'var(--tm-happy-yellow)',
    'var(--tm-loyal-blue-80)',
    'var(--tm-true-maroon-80)',
    'var(--tm-cool-gray-80)',
    'var(--tm-happy-yellow-80)',
  ],
} as const

/**
 * Brand-compliant chart styling configuration
 */
export const CHART_STYLES = {
  GRID: {
    stroke: 'var(--tm-cool-gray-20)',
    strokeDasharray: '3 3',
  },
  AXIS: {
    stroke: 'var(--tm-cool-gray)',
    fontSize: '11px',
    fontFamily: 'var(--tm-font-body)',
  },
  LEGEND: {
    fontSize: '12px',
    fontFamily: 'var(--tm-font-body)',
    fontWeight: 'var(--tm-font-weight-medium)',
  },
  TOOLTIP: {
    backgroundColor: 'white',
    border: '1px solid var(--tm-cool-gray-20)',
    borderRadius: '0.375rem',
    fontSize: '12px',
    fontFamily: 'var(--tm-font-body)',
    boxShadow:
      '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  },
} as const

/**
 * Convert hex color to RGB values
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

/**
 * Calculate relative luminance of a color
 */
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/**
 * Calculate contrast ratio between two colors
 */
export function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1)
  const rgb2 = hexToRgb(color2)

  if (!rgb1 || !rgb2) {
    return 0
  }

  const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b)
  const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b)

  const brightest = Math.max(lum1, lum2)
  const darkest = Math.min(lum1, lum2)

  return (brightest + 0.05) / (darkest + 0.05)
}

/**
 * Validate if a color combination meets WCAG AA standards
 */
export function validateColorContrast(
  foreground: string,
  background: string,
  isLargeText = false
): { isValid: boolean; ratio: number; required: number } {
  const ratio = getContrastRatio(foreground, background)
  const required = isLargeText
    ? CONTRAST_RATIOS.LARGE_TEXT
    : CONTRAST_RATIOS.NORMAL_TEXT

  return {
    isValid: ratio >= required,
    ratio,
    required,
  }
}

/**
 * Get brand-compliant color palette for charts
 */
export function getChartColorPalette(dataPoints: number): string[] {
  if (dataPoints <= 4) {
    return [...CHART_COLORS.PRIMARY].slice(0, dataPoints)
  }

  // For more than 4 data points, use extended palette with opacity variations
  const colors: string[] = [...CHART_COLORS.EXTENDED]

  // If we need more colors, cycle through with different opacities
  while (colors.length < dataPoints) {
    const baseColors = [...CHART_COLORS.PRIMARY]
    const opacities = ['70', '60', '50', '40']

    for (const opacity of opacities) {
      for (const baseColor of baseColors) {
        if (colors.length >= dataPoints) break
        const colorWithOpacity = baseColor.replace(')', `-${opacity})`)
        colors.push(colorWithOpacity)
      }
      if (colors.length >= dataPoints) break
    }
  }

  return colors.slice(0, dataPoints)
}

/**
 * Validate chart accessibility for color-blind users
 */
export function validateColorBlindAccessibility(colors: string[]): {
  isAccessible: boolean
  issues: string[]
} {
  const issues: string[] = []

  // Check if colors are distinguishable beyond just hue
  // This is a simplified check - in practice, you'd use more sophisticated color vision simulation
  const hasVariedLightness = colors.some(color => {
    const rgb = hexToRgb(color)
    if (!rgb) return false
    const luminance = getLuminance(rgb.r, rgb.g, rgb.b)
    return luminance < 0.3 || luminance > 0.7
  })

  if (!hasVariedLightness && colors.length > 1) {
    issues.push('Colors may not be distinguishable for color-blind users')
  }

  // Check for sufficient contrast between adjacent colors
  for (let i = 0; i < colors.length - 1; i++) {
    const ratio = getContrastRatio(colors[i], colors[i + 1])
    if (ratio < 1.5) {
      issues.push(`Insufficient contrast between colors ${i + 1} and ${i + 2}`)
    }
  }

  return {
    isAccessible: issues.length === 0,
    issues,
  }
}

/**
 * Generate accessible chart description for screen readers
 */
export function generateChartDescription(
  chartType: 'bar' | 'line' | 'pie' | 'area',
  dataPoints: number,
  title: string,
  summary?: string
): string {
  const typeDescriptions = {
    bar: 'Bar chart',
    line: 'Line chart',
    pie: 'Pie chart',
    area: 'Area chart',
  }

  let description = `${typeDescriptions[chartType]} titled "${title}"`

  if (dataPoints > 0) {
    description += ` showing ${dataPoints} data point${dataPoints !== 1 ? 's' : ''}`
  }

  if (summary) {
    description += `. ${summary}`
  }

  return description
}

/**
 * Brand-compliant tooltip content styling
 */
export function createBrandTooltipContent(
  title: string,
  data: Array<{ label: string; value: string | number; color?: string }>
): string {
  // Return a simple string representation for now
  // This would be used to generate tooltip content
  let content = `${title}\n`
  data.forEach(item => {
    content += `${item.label}: ${item.value}\n`
  })
  return content
}

/**
 * Validate chart meets all accessibility requirements
 */
export function validateChartAccessibility(config: {
  colors: string[]
  hasLegend: boolean
  hasTooltips: boolean
  hasAriaLabels: boolean
  hasKeyboardNavigation: boolean
}): {
  isAccessible: boolean
  issues: string[]
  recommendations: string[]
} {
  const issues: string[] = []
  const recommendations: string[] = []

  // Color accessibility
  const colorValidation = validateColorBlindAccessibility(config.colors)
  if (!colorValidation.isAccessible) {
    issues.push(...colorValidation.issues)
  }

  // Essential accessibility features
  if (!config.hasAriaLabels) {
    issues.push('Chart missing aria-label or aria-describedby attributes')
  }

  if (!config.hasLegend && config.colors.length > 1) {
    issues.push('Multi-series chart missing legend for screen readers')
  }

  if (!config.hasTooltips) {
    recommendations.push(
      'Consider adding tooltips for better data accessibility'
    )
  }

  if (!config.hasKeyboardNavigation) {
    recommendations.push(
      'Consider adding keyboard navigation for interactive elements'
    )
  }

  return {
    isAccessible: issues.length === 0,
    issues,
    recommendations,
  }
}
