/**
 * Design Token System — Barrel Export
 *
 * Re-exports all design tokens and utilities from domain-specific files.
 * Consumer imports remain unchanged: import { ... } from './designTokens'
 */

// Types
export type { DesignToken, ColorToken } from './types'

// Token data
export {
  brandColorTokens,
  generateOpacityVariations,
  getAllColorTokens,
} from './colors'
export { typographyTokens } from './typography'
export { spacingTokens } from './spacing'
export { radiusTokens, gradientTokens, shadowTokens } from './decorations'

// Utilities
export {
  validateContrastRatio,
  getDesignToken,
  getTokensByCategory,
  isValidDesignToken,
  generateCSSCustomProperties,
  exportDesignTokensJSON,
  isValidBrandGradient,
  countGradientsInContainer,
  validateGradientConstraints,
  getGradientPerformanceRecommendations,
  generateTokenDocumentation,
  generateTokenUsageExamples,
} from './utilities'
