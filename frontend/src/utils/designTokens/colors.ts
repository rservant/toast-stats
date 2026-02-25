/**
 * Brand Color Tokens
 *
 * Toastmasters brand color definitions and opacity variation utilities.
 */

import type { ColorToken } from './types'

/**
 * All Toastmasters brand color tokens
 */
export const brandColorTokens: ColorToken[] = [
  // Primary Brand Colors
  {
    name: '--tm-loyal-blue',
    value: '#004165',
    category: 'color',
    description:
      'Primary brand color for navigation, headers, and primary actions',
    usage: ['navigation', 'headers', 'primary-buttons', 'primary-actions'],
    hex: '#004165',
    rgb: { r: 0, g: 65, b: 101 },
    contrastRatio: 9.8,
  },
  {
    name: '--tm-true-maroon',
    value: '#772432',
    category: 'color',
    description: 'Secondary brand color for emphasis and non-error alerts',
    usage: ['emphasis', 'secondary-sections', 'alerts'],
    hex: '#772432',
    rgb: { r: 119, g: 36, b: 50 },
    contrastRatio: 8.2,
  },
  {
    name: '--tm-cool-gray',
    value: '#A9B2B1',
    category: 'color',
    description: 'Neutral color for background panels and cards',
    usage: ['background-panels', 'cards', 'secondary-backgrounds'],
    hex: '#A9B2B1',
    rgb: { r: 169, g: 178, b: 177 },
    contrastRatio: 2.8,
  },
  {
    name: '--tm-happy-yellow',
    value: '#F2DF74',
    category: 'color',
    description: 'Accent color for highlights and callouts',
    usage: ['highlights', 'accents', 'icon-accents', 'callouts'],
    hex: '#F2DF74',
    rgb: { r: 242, g: 223, b: 116 },
    contrastRatio: 1.4,
  },
  {
    name: '--tm-black',
    value: '#000000',
    category: 'color',
    description: 'Primary text and icon color',
    usage: ['primary-text', 'icons'],
    hex: '#000000',
    rgb: { r: 0, g: 0, b: 0 },
    contrastRatio: 21,
  },
  {
    name: '--tm-white',
    value: '#FFFFFF',
    category: 'color',
    description: 'Background color and text on dark backgrounds',
    usage: ['backgrounds', 'text-on-dark'],
    hex: '#FFFFFF',
    rgb: { r: 255, g: 255, b: 255 },
    contrastRatio: 21,
  },
]

/**
 * Generate opacity variations for a color token
 */
export function generateOpacityVariations(baseToken: ColorToken): ColorToken[] {
  const variations: ColorToken[] = []

  for (let opacity = 100; opacity >= 10; opacity -= 10) {
    const opacityDecimal = opacity / 100
    variations.push({
      ...baseToken,
      name: `${baseToken.name}-${opacity}`,
      value: `rgba(${baseToken.rgb.r}, ${baseToken.rgb.g}, ${baseToken.rgb.b}, ${opacityDecimal})`,
      description: `${baseToken.description} with ${opacity}% opacity`,
      opacity: opacityDecimal,
    })
  }

  return variations
}

/**
 * Get all color tokens including opacity variations
 */
export function getAllColorTokens(): ColorToken[] {
  const allTokens: ColorToken[] = [...brandColorTokens]

  brandColorTokens.forEach(token => {
    allTokens.push(...generateOpacityVariations(token))
  })

  return allTokens
}
