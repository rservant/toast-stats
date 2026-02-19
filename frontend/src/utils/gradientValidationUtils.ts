/**
 * Pure utility functions for gradient validation.
 *
 * Extracted from useGradientValidation hook to enable unit testing
 * without React/DOM rendering overhead.
 */

// Brand gradient patterns for detection
export const BRAND_GRADIENT_PATTERNS = {
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
export const MIN_CONTRAST_RATIOS = {
  normal: 4.5, // WCAG AA for normal text
  large: 3.0, // WCAG AA for large text (18pt+ or 14pt+ bold)
}

/**
 * Check if a gradient value matches brand patterns
 */
export function isBrandGradient(gradientValue: string): string | null {
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
}

/**
 * Convert RGB string to hex
 */
export function rgbToHex(rgb: string): string {
  const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  if (!match || !match[1] || !match[2] || !match[3]) return '#000000'

  const r = parseInt(match[1])
  const g = parseInt(match[2])
  const b = parseInt(match[3])

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

/**
 * Convert hex to RGB object
 */
export function hexToRgb(
  hex: string
): { r: number; g: number; b: number } | null {
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
 * Extract gradient colors for contrast calculation
 */
export function extractGradientColors(gradientValue: string): string[] {
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
}

/**
 * Calculate average color from gradient for contrast checking
 */
export function getGradientAverageColor(gradientValue: string): string {
  const colors = extractGradientColors(gradientValue)

  if (colors.length === 0) {
    return '#808080' // Default gray if no colors found
  }

  if (colors.length === 1 && colors[0]) {
    return colors[0]
  }

  // Calculate average of first and last color for simplicity
  const firstColorHex = colors[0]
  const lastColorHex = colors[colors.length - 1]

  if (!firstColorHex || !lastColorHex) {
    return firstColorHex || '#808080'
  }

  const firstColor = hexToRgb(firstColorHex)
  const lastColor = hexToRgb(lastColorHex)

  if (!firstColor || !lastColor) {
    return firstColorHex
  }

  const avgR = Math.round((firstColor.r + lastColor.r) / 2)
  const avgG = Math.round((firstColor.g + lastColor.g) / 2)
  const avgB = Math.round((firstColor.b + lastColor.b) / 2)

  return `#${avgR.toString(16).padStart(2, '0')}${avgG.toString(16).padStart(2, '0')}${avgB.toString(16).padStart(2, '0')}`
}
