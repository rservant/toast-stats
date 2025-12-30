/**
 * Toastmasters Brand Component Library
 *
 * This file exports all brand-related components, hooks, and utilities
 * for easy importing throughout the application.
 */

// Core Components
export {
  default as ThemeProvider,
  useTheme,
  useBrandTokens,
  useBrandColors,
  useTypography,
  useSpacing,
  useValidation,
  withTheme,
} from './ThemeProvider'
export {
  default as BrandValidator,
  withBrandValidation,
} from './BrandValidator'
export {
  default as AccessibilityChecker,
  withAccessibilityChecking,
} from './AccessibilityChecker'

// Types and Interfaces
export type {
  BrandTokens,
  BrandComponentProps,
  AccessibilityProps,
  ThemeProviderProps,
  ThemeContext,
  BrandColor,
  ColorPalette,
  TypographyScale,
  TypographySystem,
  ComponentVariant,
  ResponsiveBreakpoint,
  ResponsiveConfig,
  ValidationRule,
  ValidationConfig,
  ValidationError,
  BrandValidatorProps,
  AccessibilityCheckerProps,
  ContrastCheckResult,
  TouchTargetCheckResult,
} from './types'

// Constants
export {
  BRAND_COLORS,
  BRAND_GRADIENTS,
  TYPOGRAPHY_STACKS,
  BREAKPOINTS,
} from './types'

// Utility Functions
export {
  calculateContrastRatio,
  validateContrast,
  checkTouchTarget,
  isBrandColor,
  getClosestBrandColor,
  hasProhibitedTextEffects,
  getFontFamily,
  isBrandFont,
  getFontSizeInPixels,
  meetsMinimumFontSize,
  getLineHeightRatio,
  meetsMinimumLineHeight,
  debounce,
} from './utils'
