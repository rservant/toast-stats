/**
 * Toastmasters Brand Component Types and Interfaces
 *
 * This file defines all TypeScript interfaces and types for the brand component system.
 * These types ensure type safety and consistency across all brand-compliant components.
 */

import { ReactNode } from 'react'

// Brand Color Definitions
export const BRAND_COLORS = {
  loyalBlue: '#004165',
  trueMaroon: '#772432',
  coolGray: '#A9B2B1',
  happyYellow: '#F2DF74',
  black: '#000000',
  white: '#FFFFFF',
} as const

export const BRAND_GRADIENTS = {
  loyalBlue: 'linear-gradient(135deg, #004165 0%, #006094 100%)',
  trueMaroon: 'linear-gradient(135deg, #3B0104 0%, #781327 100%)',
  coolGray: 'linear-gradient(135deg, #A9B2B1 0%, #F5F5F5 100%)',
} as const

export const TYPOGRAPHY_STACKS = {
  headline:
    '"Montserrat", system-ui, -apple-system, "Segoe UI", Arial, sans-serif',
  body: '"Source Sans 3", system-ui, -apple-system, "Segoe UI", Arial, sans-serif',
} as const

export const BREAKPOINTS = {
  mobile: '320px',
  tablet: '768px',
  desktop: '1024px',
  wide: '1440px',
} as const

// Brand Token System Interface
export interface BrandTokens {
  colors: {
    primary: {
      loyalBlue: string
      trueMaroon: string
      coolGray: string
    }
    accent: {
      happyYellow: string
    }
    neutral: {
      black: string
      white: string
    }
  }
  typography: {
    headline: {
      fontFamily: string
      weights: string[]
    }
    body: {
      fontFamily: string
      weights: string[]
    }
    sizing: {
      minBodySize: string
      minLineHeight: number
    }
  }
  spacing: {
    touchTarget: string
    clearSpace: Record<string, string>
  }
  gradients: {
    loyalBlue: string
    trueMaroon: string
    coolGray: string
  }
  breakpoints: {
    mobile: string
    tablet: string
    desktop: string
    wide: string
  }
  borderRadius: {
    sm: string
    md: string
    lg: string
  }
}

// Brand Component Props Interface
export interface BrandComponentProps {
  variant?: 'primary' | 'secondary' | 'accent'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  children: ReactNode
}

// Accessibility Props Interface
export interface AccessibilityProps {
  'aria-label'?: string
  'aria-describedby'?: string
  tabIndex?: number
}

// Theme Provider Props Interface
export interface ThemeProviderProps {
  children: ReactNode
  enableValidation?: boolean
  contrastMode?: 'normal' | 'high'
}

// Theme Context Interface
export interface ThemeContext {
  tokens: BrandTokens
  validateContrast: (foreground: string, background: string) => boolean
  checkTouchTarget: (element: HTMLElement) => boolean
}

// Brand Color Model
export interface BrandColor {
  name: string
  hex: string
  usage: string[]
  contrastRatios: {
    onWhite: number
    onBlack: number
    onLoyalBlue?: number
  }
}

// Color Palette Interface
export interface ColorPalette {
  primary: BrandColor[]
  accent: BrandColor[]
  neutral: BrandColor[]
}

// Typography Scale Interface
export interface TypographyScale {
  fontFamily: string
  fontSize: string
  fontWeight: string | number
  lineHeight: number
  letterSpacing?: string
  textTransform?: string
}

// Typography System Interface
export interface TypographySystem {
  headline: {
    h1: TypographyScale
    h2: TypographyScale
    h3: TypographyScale
    nav: TypographyScale
  }
  body: {
    large: TypographyScale
    medium: TypographyScale
    small: TypographyScale
    caption: TypographyScale
  }
}

// Component Variant Interface
export interface ComponentVariant {
  name: string
  styles: {
    backgroundColor?: string
    color?: string
    border?: string
    padding?: string
    borderRadius?: string
    fontSize?: string
    fontWeight?: string
  }
  states: {
    hover?: Partial<ComponentVariant['styles']>
    focus?: Partial<ComponentVariant['styles']>
    active?: Partial<ComponentVariant['styles']>
    disabled?: Partial<ComponentVariant['styles']>
  }
}

// Responsive Design Interface
export interface ResponsiveBreakpoint {
  name: string
  minWidth: string
  maxWidth?: string
  touchTargetSize: string
  minFontSize: string
}

export interface ResponsiveConfig {
  breakpoints: ResponsiveBreakpoint[]
  fluidTypography: boolean
  adaptiveSpacing: boolean
}

// Validation Rule Interface
export interface ValidationRule {
  id: string
  type: 'color' | 'typography' | 'accessibility' | 'gradient' | 'component'
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

// Validation Error Interface
export interface ValidationError {
  type: 'color' | 'typography' | 'accessibility' | 'gradient' | 'component'
  severity: 'error' | 'warning' | 'info'
  message: string
  element?: HTMLElement
  suggestion?: string
}

// Brand Validator Props Interface
export interface BrandValidatorProps {
  children: ReactNode
  enableValidation?: boolean
  validationRules?: ValidationRule[]
  onValidationError?: (error: ValidationError) => void
}

// Accessibility Checker Props Interface
export interface AccessibilityCheckerProps {
  children: ReactNode
  enableRuntimeChecks?: boolean
  checkContrast?: boolean
  checkTouchTargets?: boolean
  onAccessibilityViolation?: (violation: ValidationError) => void
}

// Contrast Check Result Interface
export interface ContrastCheckResult {
  ratio: number
  passes: boolean
  level: 'AA' | 'AAA' | 'fail'
  foreground: string
  background: string
}

// Touch Target Check Result Interface
export interface TouchTargetCheckResult {
  width: number
  height: number
  passes: boolean
  element: HTMLElement
}
