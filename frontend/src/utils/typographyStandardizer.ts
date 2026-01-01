/**
 * Typography Standardization System
 *
 * Implements comprehensive typography validation and standardization
 * for Toastmasters brand compliance according to requirements 2.1, 2.2, 2.5
 */

export interface TypographyValidationResult {
  isValid: boolean
  violations: TypographyViolation[]
  suggestions: string[]
}

export interface TypographyViolation {
  type: 'font-family' | 'font-size' | 'line-height' | 'text-effects'
  element: HTMLElement
  current: string
  expected: string
  severity: 'error' | 'warning'
  message: string
}

export interface FontFamilyRule {
  selector: string
  expectedFamily: 'headline' | 'body'
  elements: string[]
}

export interface FontSizeRule {
  selector: string
  minimumSize: number
  elements: string[]
}

// Brand-compliant font families with proper fallbacks
export const BRAND_FONT_FAMILIES = {
  headline:
    '"Montserrat", system-ui, -apple-system, "Segoe UI", "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
  body: '"Source Sans 3", system-ui, -apple-system, "Segoe UI", "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
} as const

// Font family validation rules (Requirements 2.1, 2.2)
export const FONT_FAMILY_RULES: FontFamilyRule[] = [
  {
    selector: 'headlines',
    expectedFamily: 'headline',
    elements: [
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      '.tm-headline',
      '.tm-nav-text',
      'nav a',
      'nav button',
    ],
  },
  {
    selector: 'body-text',
    expectedFamily: 'body',
    elements: [
      'p',
      'span',
      'div',
      'label',
      'input',
      'textarea',
      'select',
      'button',
      'td',
      'th',
      '.tm-body',
    ],
  },
]

// Font size validation rules (Requirement 2.5)
export const FONT_SIZE_RULES: FontSizeRule[] = [
  {
    selector: 'body-text',
    minimumSize: 14, // pixels
    elements: [
      'p',
      'span',
      'div',
      'label',
      'input',
      'textarea',
      'select',
      'td',
      'th',
      '.tm-body',
      '.tm-body-small',
      '.tm-caption',
    ],
  },
]

// Minimum line height requirement (Requirement 2.5)
export const MINIMUM_LINE_HEIGHT = 1.4

// Prohibited text effects (Requirements 2.3, 2.4)
export const PROHIBITED_TEXT_EFFECTS = [
  'text-shadow',
  'filter',
  '-webkit-text-stroke',
  'text-stroke',
  'text-outline',
] as const

/**
 * Validate font family compliance for an element
 */
export function validateFontFamily(
  element: HTMLElement
): TypographyViolation[] {
  const violations: TypographyViolation[] = []
  const computedStyle = window.getComputedStyle(element)
  const currentFontFamily = computedStyle.fontFamily.toLowerCase()

  // Determine expected font family based on element type
  const expectedFamily = getExpectedFontFamily(element)
  if (!expectedFamily) return violations

  // Check if current font family matches expected brand font
  const isValidFont = isValidBrandFont(currentFontFamily, expectedFamily)

  if (!isValidFont) {
    violations.push({
      type: 'font-family',
      element,
      current: computedStyle.fontFamily,
      expected: BRAND_FONT_FAMILIES[expectedFamily],
      severity: 'error',
      message: `${expectedFamily === 'headline' ? 'Headlines' : 'Body text'} must use ${expectedFamily === 'headline' ? 'Montserrat' : 'Source Sans 3'} font family`,
    })
  }

  return violations
}

/**
 * Validate font size compliance for an element
 */
export function validateFontSize(element: HTMLElement): TypographyViolation[] {
  const violations: TypographyViolation[] = []
  const computedStyle = window.getComputedStyle(element)
  const currentFontSize = parseFloat(computedStyle.fontSize)

  // Check if element should have minimum font size
  const shouldHaveMinimumSize = shouldEnforceMinimumFontSize(element)

  if (shouldHaveMinimumSize && currentFontSize < 14) {
    violations.push({
      type: 'font-size',
      element,
      current: `${currentFontSize}px`,
      expected: '14px minimum',
      severity: 'error',
      message: 'Body text must have minimum 14px font size for accessibility',
    })
  }

  return violations
}

/**
 * Validate line height compliance for an element
 */
export function validateLineHeight(
  element: HTMLElement
): TypographyViolation[] {
  const violations: TypographyViolation[] = []
  const computedStyle = window.getComputedStyle(element)
  const lineHeight = parseFloat(computedStyle.lineHeight)
  const fontSize = parseFloat(computedStyle.fontSize)

  // Calculate line height ratio
  const lineHeightRatio = lineHeight / fontSize

  if (lineHeightRatio < MINIMUM_LINE_HEIGHT) {
    violations.push({
      type: 'line-height',
      element,
      current: lineHeightRatio.toFixed(2),
      expected: `${MINIMUM_LINE_HEIGHT} minimum`,
      severity: 'error',
      message:
        'Line height must be at least 1.4 times the font size for readability',
    })
  }

  return violations
}

/**
 * Validate text effects compliance for an element
 */
export function validateTextEffects(
  element: HTMLElement
): TypographyViolation[] {
  const violations: TypographyViolation[] = []
  const computedStyle = window.getComputedStyle(element)

  // Check for prohibited text effects
  PROHIBITED_TEXT_EFFECTS.forEach(effect => {
    const effectValue = computedStyle.getPropertyValue(effect)

    if (
      effectValue &&
      effectValue !== 'none' &&
      effectValue !== 'initial' &&
      effectValue !== 'unset'
    ) {
      violations.push({
        type: 'text-effects',
        element,
        current: `${effect}: ${effectValue}`,
        expected: 'none',
        severity: 'error',
        message: `Prohibited text effect detected: ${effect}. Remove drop-shadow, outline, glow, and other text effects`,
      })
    }
  })

  return violations
}

/**
 * Comprehensive typography validation for an element
 */
export function validateElementTypography(
  element: HTMLElement
): TypographyValidationResult {
  const violations: TypographyViolation[] = [
    ...validateFontFamily(element),
    ...validateFontSize(element),
    ...validateLineHeight(element),
    ...validateTextEffects(element),
  ]

  const suggestions = violations.map(violation => {
    switch (violation.type) {
      case 'font-family':
        return `Apply ${violation.expected} to ${getElementSelector(element)}`
      case 'font-size':
        return `Increase font size to ${violation.expected} for ${getElementSelector(element)}`
      case 'line-height':
        return `Increase line height to ${violation.expected} for ${getElementSelector(element)}`
      case 'text-effects':
        return `Remove ${violation.current} from ${getElementSelector(element)}`
      default:
        return `Fix typography issue for ${getElementSelector(element)}`
    }
  })

  return {
    isValid: violations.length === 0,
    violations,
    suggestions,
  }
}

/**
 * Validate typography for entire page
 */
export function validatePageTypography(): TypographyValidationResult {
  const allElements = document.querySelectorAll('*')
  const allViolations: TypographyViolation[] = []
  const allSuggestions: string[] = []

  allElements.forEach(element => {
    const result = validateElementTypography(element as HTMLElement)
    allViolations.push(...result.violations)
    allSuggestions.push(...result.suggestions)
  })

  // Remove duplicate suggestions
  const uniqueSuggestions = [...new Set(allSuggestions)]

  return {
    isValid: allViolations.length === 0,
    violations: allViolations,
    suggestions: uniqueSuggestions,
  }
}

/**
 * Apply typography standardization to an element
 */
export function standardizeElementTypography(element: HTMLElement): boolean {
  try {
    const expectedFamily = getExpectedFontFamily(element)

    if (expectedFamily) {
      // Apply correct font family
      element.style.fontFamily = BRAND_FONT_FAMILIES[expectedFamily]
    }

    // Ensure minimum font size for body text
    if (shouldEnforceMinimumFontSize(element)) {
      const currentSize = parseFloat(window.getComputedStyle(element).fontSize)
      if (currentSize < 14) {
        element.style.fontSize = '14px'
      }
    }

    // Ensure minimum line height
    const computedStyle = window.getComputedStyle(element)
    const lineHeight = parseFloat(computedStyle.lineHeight)
    const fontSize = parseFloat(computedStyle.fontSize)
    const lineHeightRatio = lineHeight / fontSize

    if (lineHeightRatio < MINIMUM_LINE_HEIGHT) {
      element.style.lineHeight = MINIMUM_LINE_HEIGHT.toString()
    }

    // Remove prohibited text effects
    PROHIBITED_TEXT_EFFECTS.forEach(effect => {
      element.style.setProperty(effect, 'none', 'important')
    })

    return true
  } catch (error) {
    console.warn('Failed to standardize typography for element:', error)
    return false
  }
}

/**
 * Apply typography standardization to entire page
 */
export function standardizePageTypography(): {
  success: boolean
  elementsProcessed: number
  errors: string[]
} {
  const allElements = document.querySelectorAll('*')
  let elementsProcessed = 0
  const errors: string[] = []

  allElements.forEach((element, index) => {
    try {
      const success = standardizeElementTypography(element as HTMLElement)
      if (success) {
        elementsProcessed++
      }
    } catch (error) {
      errors.push(
        `Element ${index}: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  })

  return {
    success: errors.length === 0,
    elementsProcessed,
    errors,
  }
}

// Helper functions

/**
 * Determine expected font family for an element
 */
function getExpectedFontFamily(
  element: HTMLElement
): 'headline' | 'body' | null {
  const tagName = element.tagName.toLowerCase()
  const classList = Array.from(element.classList)

  // Check for headline elements
  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
    return 'headline'
  }

  // Check for navigation elements
  if (tagName === 'nav' || element.closest('nav')) {
    return 'headline'
  }

  // Check for headline classes
  if (
    classList.some(cls => cls.includes('headline') || cls.includes('nav-text'))
  ) {
    return 'headline'
  }

  // Check for body text elements
  if (
    [
      'p',
      'span',
      'div',
      'label',
      'input',
      'textarea',
      'select',
      'button',
      'td',
      'th',
    ].includes(tagName)
  ) {
    return 'body'
  }

  // Check for body classes
  if (classList.some(cls => cls.includes('body') || cls.includes('text'))) {
    return 'body'
  }

  return null
}

/**
 * Check if current font family is valid for the expected type
 */
function isValidBrandFont(
  currentFont: string,
  expectedType: 'headline' | 'body'
): boolean {
  // Check if the current font includes the expected brand font
  if (expectedType === 'headline') {
    return (
      currentFont.includes('montserrat') ||
      currentFont.includes('system-ui') ||
      currentFont.includes('-apple-system')
    )
  } else {
    return (
      currentFont.includes('source sans') ||
      currentFont.includes('system-ui') ||
      currentFont.includes('-apple-system')
    )
  }
}

/**
 * Check if element should enforce minimum font size
 */
function shouldEnforceMinimumFontSize(element: HTMLElement): boolean {
  const tagName = element.tagName.toLowerCase()
  const classList = Array.from(element.classList)

  // Body text elements should have minimum font size
  const bodyTextElements = [
    'p',
    'span',
    'div',
    'label',
    'input',
    'textarea',
    'select',
    'td',
    'th',
  ]
  const bodyTextClasses = ['body', 'text', 'caption']

  return (
    bodyTextElements.includes(tagName) ||
    classList.some(cls =>
      bodyTextClasses.some(bodyClass => cls.includes(bodyClass))
    )
  )
}

/**
 * Get a CSS selector for an element (for debugging/suggestions)
 */
function getElementSelector(element: HTMLElement): string {
  if (element.id) {
    return `#${element.id}`
  }

  if (element.className) {
    const classes = Array.from(element.classList).slice(0, 2).join('.')
    return `.${classes}`
  }

  return element.tagName.toLowerCase()
}

/**
 * Generate CSS rules for typography standardization
 */
export function generateTypographyCSS(): string {
  return `
/* Typography Standardization - Auto-generated */

/* Headline Typography */
h1, h2, h3, h4, h5, h6, .tm-headline, .tm-nav-text, nav a, nav button {
  font-family: ${BRAND_FONT_FAMILIES.headline} !important;
  text-shadow: none;
  filter: none !important;
  -webkit-text-stroke: none;
  text-stroke: none;
}

/* Body Typography */
p, span, div, label, input, textarea, select, button, td, th, .tm-body {
  font-family: ${BRAND_FONT_FAMILIES.body} !important;
  font-size: max(1em, 14px) !important;
  line-height: max(1.4, inherit) !important;
  text-shadow: none;
  filter: none !important;
  -webkit-text-stroke: none;
  text-stroke: none;
}

/* Minimum Requirements Enforcement */
* {
  text-shadow: none;
  filter: none !important;
  -webkit-text-stroke: none;
  text-stroke: none;
}
`
}

/**
 * Inject typography standardization CSS into the page
 */
export function injectTypographyCSS(): void {
  const existingStyle = document.getElementById('typography-standardization')
  if (existingStyle) {
    existingStyle.remove()
  }

  const style = document.createElement('style')
  style.id = 'typography-standardization'
  style.textContent = generateTypographyCSS()
  document.head.appendChild(style)
}
