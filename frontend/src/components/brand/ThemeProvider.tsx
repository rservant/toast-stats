/**
 * Toastmasters Brand Theme Provider
 *
 * This component provides brand context and tokens to all child components.
 * It ensures consistent access to brand colors, typography, and validation functions.
 */

import React, { createContext, useContext, useMemo } from 'react'
import {
  ThemeProviderProps,
  ThemeContext as ThemeContextType,
  BrandTokens,
  BRAND_COLORS,
  BRAND_GRADIENTS,
  TYPOGRAPHY_STACKS,
  BREAKPOINTS,
} from './types'
import { validateContrast, checkTouchTarget } from './utils'

// Create the theme context
const ThemeContext = createContext<ThemeContextType | null>(null)

/**
 * Brand tokens configuration
 */
const brandTokens: BrandTokens = {
  colors: {
    primary: {
      loyalBlue: BRAND_COLORS.loyalBlue,
      trueMaroon: BRAND_COLORS.trueMaroon,
      coolGray: BRAND_COLORS.coolGray,
    },
    accent: {
      happyYellow: BRAND_COLORS.happyYellow,
    },
    neutral: {
      black: BRAND_COLORS.black,
      white: BRAND_COLORS.white,
    },
  },
  typography: {
    headline: {
      fontFamily: TYPOGRAPHY_STACKS.headline,
      weights: ['500', '600', '700', '900'], // Medium, Semibold, Bold, Black
    },
    body: {
      fontFamily: TYPOGRAPHY_STACKS.body,
      weights: ['400', '600', '700'], // Regular, Semibold, Bold
    },
    sizing: {
      minBodySize: '14px',
      minLineHeight: 1.4,
    },
  },
  spacing: {
    touchTarget: '44px',
    clearSpace: {
      xs: '4px',
      sm: '8px',
      md: '16px',
      lg: '24px',
      xl: '32px',
    },
  },
  gradients: {
    loyalBlue: BRAND_GRADIENTS.loyalBlue,
    trueMaroon: BRAND_GRADIENTS.trueMaroon,
    coolGray: BRAND_GRADIENTS.coolGray,
  },
  breakpoints: {
    mobile: BREAKPOINTS.mobile,
    tablet: BREAKPOINTS.tablet,
    desktop: BREAKPOINTS.desktop,
    wide: BREAKPOINTS.wide,
  },
  borderRadius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
  },
}

/**
 * ThemeProvider component that provides brand context to all children
 */
export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  enableValidation = typeof window !== 'undefined' &&
    window.location.hostname === 'localhost',
}) => {
  const contextValue = useMemo<ThemeContextType>(() => {
    return {
      tokens: brandTokens,
      validateContrast: (foreground: string, background: string) => {
        const result = validateContrast(foreground, background)

        if (enableValidation && !result.passes) {
          console.warn(
            `Brand Compliance Warning: Contrast ratio ${result.ratio}:1 between ${foreground} and ${background} does not meet WCAG AA standards (required: 4.5:1)`
          )
        }

        return result.passes
      },
      checkTouchTarget: (element: HTMLElement) => {
        const result = checkTouchTarget(element)

        if (enableValidation && !result.passes) {
          console.warn(
            `Brand Compliance Warning: Touch target ${result.width}x${result.height}px does not meet minimum 44px requirement`,
            element
          )
        }

        return result.passes
      },
    }
  }, [enableValidation])

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  )
}

/**
 * Hook to access the theme context
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }

  return context
}

/**
 * Hook to access brand tokens directly
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useBrandTokens = (): BrandTokens => {
  const { tokens } = useTheme()
  return tokens
}

/**
 * Hook to access brand colors
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useBrandColors = () => {
  const { tokens } = useTheme()
  return tokens.colors
}

/**
 * Hook to access typography tokens
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useTypography = () => {
  const { tokens } = useTheme()
  return tokens.typography
}

/**
 * Hook to access spacing tokens
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useSpacing = () => {
  const { tokens } = useTheme()
  return tokens.spacing
}

/**
 * Hook to access validation functions
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useValidation = () => {
  const { validateContrast, checkTouchTarget } = useTheme()
  return { validateContrast, checkTouchTarget }
}

/**
 * Higher-order component to wrap components with theme provider
 */
// eslint-disable-next-line react-refresh/only-export-components
export const withTheme = <P extends object>(
  Component: React.ComponentType<P>
): React.FC<P & Partial<ThemeProviderProps>> => {
  const WrappedComponent: React.FC<P & Partial<ThemeProviderProps>> = ({
    enableValidation,
    contrastMode,
    ...props
  }) => (
    <ThemeProvider
      enableValidation={enableValidation}
      contrastMode={contrastMode}
    >
      <Component {...(props as P)} />
    </ThemeProvider>
  )

  WrappedComponent.displayName = `withTheme(${Component.displayName || Component.name})`

  return WrappedComponent
}

export default ThemeProvider
