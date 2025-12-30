/**
 * Brand Constants
 *
 * Official Toastmasters International brand colors, gradients, and typography definitions
 * Used throughout the application for consistent brand compliance
 */

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

export const SPACING = {
  touchTarget: '44px',
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
} as const

export const BORDER_RADIUS = {
  sm: '4px',
  md: '8px',
  lg: '12px',
} as const

// Contrast ratio requirements
export const CONTRAST_REQUIREMENTS = {
  normalText: 4.5,
  largeText: 3.0,
  nonTextElements: 3.0,
} as const

// Font size requirements
export const FONT_SIZE_REQUIREMENTS = {
  minBodySize: 14,
  minLineHeight: 1.4,
  largeTextThreshold: 18,
  boldLargeTextThreshold: 14,
} as const

// Touch target requirements
export const TOUCH_TARGET_REQUIREMENTS = {
  minWidth: 44,
  minHeight: 44,
} as const

// Validation rule categories
export const VALIDATION_CATEGORIES = {
  color: 'CV',
  typography: 'TV',
  accessibility: 'AV',
  component: 'CPV',
} as const

// Brand color usage guidelines
export const COLOR_USAGE = {
  loyalBlue: [
    'navigation',
    'headers',
    'primary buttons',
    'primary actions',
    'links',
  ],
  trueMaroon: [
    'emphasis',
    'secondary sections',
    'non-error alerts',
    'accent elements',
  ],
  coolGray: ['background panels', 'cards', 'secondary backgrounds', 'borders'],
  happyYellow: [
    'highlights',
    'accents',
    'icon accents',
    'callouts',
    'success states',
  ],
  black: ['primary text', 'icons', 'body content'],
  white: ['backgrounds', 'text on dark backgrounds', 'card backgrounds'],
} as const

// Typography usage guidelines
export const TYPOGRAPHY_USAGE = {
  headline: [
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'navigation labels',
    'button text',
    'form labels (when emphasized)',
  ],
  body: [
    'paragraphs',
    'form labels',
    'helper text',
    'table text',
    'list items',
    'captions',
  ],
} as const

// Component type definitions for validation
export const COMPONENT_TYPES = {
  button: {
    primary: 'tm-btn-primary',
    secondary: 'tm-btn-secondary',
    accent: 'tm-btn-accent',
  },
  card: {
    default: 'tm-card',
    panel: 'tm-panel',
  },
  navigation: {
    main: 'tm-nav',
    item: 'tm-nav-item',
  },
  status: {
    indicator: 'tm-status',
    alert: 'tm-alert',
  },
} as const

// Gradient usage constraints
export const GRADIENT_CONSTRAINTS = {
  maxPerScreen: 1,
  allowedTypes: ['linear', 'radial'],
  opacitySteps: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
} as const

// Error recovery defaults
export const ERROR_RECOVERY_DEFAULTS = {
  fallbackColor: BRAND_COLORS.coolGray,
  fallbackFont: TYPOGRAPHY_STACKS.body,
  minFontSize: FONT_SIZE_REQUIREMENTS.minBodySize,
  minTouchTarget: TOUCH_TARGET_REQUIREMENTS.minWidth,
} as const

// Development mode settings
export const DEV_MODE_SETTINGS = {
  enableValidation:
    typeof window !== 'undefined' && window.location.hostname === 'localhost',
  enableAutoFix: false,
  reportingLevel: 'error' as const,
  logValidationErrors: true,
} as const
