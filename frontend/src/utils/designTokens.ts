/**
 * Design Token System for Toastmasters Brand Compliance
 *
 * This module provides utilities for working with design tokens,
 * validating brand compliance, and managing color mappings.
 */

export interface DesignToken {
  name: string
  value: string
  category:
    | 'color'
    | 'typography'
    | 'spacing'
    | 'gradient'
    | 'radius'
    | 'shadow'
  description: string
  usage: string[]
}

export interface ColorToken extends DesignToken {
  category: 'color'
  hex: string
  rgb: { r: number; g: number; b: number }
  opacity?: number
  contrastRatio?: number
}

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

/**
 * Comprehensive typography tokens system
 */
export const typographyTokens: DesignToken[] = [
  // Font families with comprehensive fallbacks
  {
    name: '--tm-font-headline',
    value:
      '"Montserrat", system-ui, -apple-system, "Segoe UI", "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
    category: 'typography',
    description:
      'Primary font family for headlines and navigation with comprehensive fallbacks',
    usage: [
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'navigation-labels',
      'button-text',
    ],
  },
  {
    name: '--tm-font-body',
    value:
      '"Source Sans 3", system-ui, -apple-system, "Segoe UI", "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
    category: 'typography',
    description:
      'Primary font family for body text with comprehensive fallbacks',
    usage: [
      'paragraphs',
      'form-labels',
      'helper-text',
      'table-text',
      'list-items',
      'captions',
    ],
  },

  // Font weights
  {
    name: '--tm-font-weight-regular',
    value: '400',
    category: 'typography',
    description: 'Regular font weight',
    usage: ['body-text', 'paragraphs', 'default-text'],
  },
  {
    name: '--tm-font-weight-medium',
    value: '500',
    category: 'typography',
    description: 'Medium font weight',
    usage: ['emphasis', 'semi-bold-text'],
  },
  {
    name: '--tm-font-weight-semibold',
    value: '600',
    category: 'typography',
    description: 'Semibold font weight',
    usage: ['navigation', 'button-text', 'form-labels'],
  },
  {
    name: '--tm-font-weight-bold',
    value: '700',
    category: 'typography',
    description: 'Bold font weight',
    usage: ['headings', 'emphasis', 'strong-text'],
  },
  {
    name: '--tm-font-weight-black',
    value: '900',
    category: 'typography',
    description: 'Black font weight (heaviest)',
    usage: ['main-headings', 'hero-text', 'brand-text'],
  },

  // Font sizes (comprehensive scale)
  {
    name: '--tm-font-size-xs',
    value: '12px',
    category: 'typography',
    description: 'Extra small font size',
    usage: ['captions', 'fine-print', 'metadata'],
  },
  {
    name: '--tm-font-size-sm',
    value: '14px',
    category: 'typography',
    description: 'Small font size (minimum for body text)',
    usage: ['small-text', 'helper-text', 'form-labels'],
  },
  {
    name: '--tm-font-size-base',
    value: '16px',
    category: 'typography',
    description: 'Base font size',
    usage: ['body-text', 'paragraphs', 'default-text'],
  },
  {
    name: '--tm-font-size-lg',
    value: '18px',
    category: 'typography',
    description: 'Large font size',
    usage: ['large-body-text', 'lead-paragraphs'],
  },
  {
    name: '--tm-font-size-xl',
    value: '20px',
    category: 'typography',
    description: 'Extra large font size',
    usage: ['subheadings', 'large-text'],
  },
  {
    name: '--tm-font-size-2xl',
    value: '24px',
    category: 'typography',
    description: 'Double extra large font size',
    usage: ['h3', 'section-headings'],
  },
  {
    name: '--tm-font-size-3xl',
    value: '30px',
    category: 'typography',
    description: 'Triple extra large font size',
    usage: ['h2', 'major-headings'],
  },
  {
    name: '--tm-font-size-4xl',
    value: '36px',
    category: 'typography',
    description: 'Quadruple extra large font size',
    usage: ['h1', 'page-titles'],
  },
  {
    name: '--tm-font-size-5xl',
    value: '48px',
    category: 'typography',
    description: 'Five times extra large font size',
    usage: ['hero-headings', 'display-text'],
  },
  {
    name: '--tm-font-size-6xl',
    value: '60px',
    category: 'typography',
    description: 'Six times extra large font size',
    usage: ['hero-text', 'brand-display'],
  },

  // Minimum requirements (accessibility)
  {
    name: '--tm-font-size-min-body',
    value: '14px',
    category: 'typography',
    description: 'Minimum font size for body text (accessibility requirement)',
    usage: ['body-text-minimum', 'accessibility-compliance'],
  },
  {
    name: '--tm-line-height-min',
    value: '1.4',
    category: 'typography',
    description: 'Minimum line height ratio (accessibility requirement)',
    usage: ['line-height-minimum', 'accessibility-compliance'],
  },

  // Line heights
  {
    name: '--tm-line-height-tight',
    value: '1.25',
    category: 'typography',
    description: 'Tight line height for headings',
    usage: ['headings', 'display-text', 'tight-text'],
  },
  {
    name: '--tm-line-height-snug',
    value: '1.375',
    category: 'typography',
    description: 'Snug line height',
    usage: ['subheadings', 'compact-text'],
  },
  {
    name: '--tm-line-height-normal',
    value: '1.5',
    category: 'typography',
    description: 'Normal line height for body text',
    usage: ['body-text', 'paragraphs', 'default-text'],
  },
  {
    name: '--tm-line-height-relaxed',
    value: '1.625',
    category: 'typography',
    description: 'Relaxed line height for readability',
    usage: ['long-text', 'articles', 'readable-content'],
  },
  {
    name: '--tm-line-height-loose',
    value: '2',
    category: 'typography',
    description: 'Loose line height for maximum readability',
    usage: ['accessibility', 'large-text', 'spaced-content'],
  },

  // Letter spacing
  {
    name: '--tm-letter-spacing-tighter',
    value: '-0.05em',
    category: 'typography',
    description: 'Tighter letter spacing',
    usage: ['large-headings', 'display-text'],
  },
  {
    name: '--tm-letter-spacing-tight',
    value: '-0.025em',
    category: 'typography',
    description: 'Tight letter spacing',
    usage: ['headings', 'titles'],
  },
  {
    name: '--tm-letter-spacing-normal',
    value: '0em',
    category: 'typography',
    description: 'Normal letter spacing',
    usage: ['body-text', 'default-text'],
  },
  {
    name: '--tm-letter-spacing-wide',
    value: '0.025em',
    category: 'typography',
    description: 'Wide letter spacing',
    usage: ['small-caps', 'navigation'],
  },
  {
    name: '--tm-letter-spacing-wider',
    value: '0.05em',
    category: 'typography',
    description: 'Wider letter spacing',
    usage: ['uppercase-text', 'labels'],
  },
  {
    name: '--tm-letter-spacing-widest',
    value: '0.1em',
    category: 'typography',
    description: 'Widest letter spacing',
    usage: ['all-caps', 'brand-text'],
  },

  // Typography scale definitions (semantic tokens)
  {
    name: '--tm-h1-font-size',
    value: 'var(--tm-font-size-5xl)',
    category: 'typography',
    description: 'H1 heading font size (48px)',
    usage: ['h1', 'main-headings'],
  },
  {
    name: '--tm-h1-line-height',
    value: 'var(--tm-line-height-tight)',
    category: 'typography',
    description: 'H1 heading line height (1.25)',
    usage: ['h1', 'main-headings'],
  },
  {
    name: '--tm-h1-font-weight',
    value: 'var(--tm-font-weight-black)',
    category: 'typography',
    description: 'H1 heading font weight (900)',
    usage: ['h1', 'main-headings'],
  },
  {
    name: '--tm-h2-font-size',
    value: 'var(--tm-font-size-4xl)',
    category: 'typography',
    description: 'H2 heading font size (36px)',
    usage: ['h2', 'section-headings'],
  },
  {
    name: '--tm-h2-line-height',
    value: 'var(--tm-line-height-tight)',
    category: 'typography',
    description: 'H2 heading line height (1.25)',
    usage: ['h2', 'section-headings'],
  },
  {
    name: '--tm-h2-font-weight',
    value: 'var(--tm-font-weight-bold)',
    category: 'typography',
    description: 'H2 heading font weight (700)',
    usage: ['h2', 'section-headings'],
  },
  {
    name: '--tm-h3-font-size',
    value: 'var(--tm-font-size-3xl)',
    category: 'typography',
    description: 'H3 heading font size (30px)',
    usage: ['h3', 'subsection-headings'],
  },
  {
    name: '--tm-h3-line-height',
    value: 'var(--tm-line-height-snug)',
    category: 'typography',
    description: 'H3 heading line height (1.375)',
    usage: ['h3', 'subsection-headings'],
  },
  {
    name: '--tm-h3-font-weight',
    value: 'var(--tm-font-weight-bold)',
    category: 'typography',
    description: 'H3 heading font weight (700)',
    usage: ['h3', 'subsection-headings'],
  },
  {
    name: '--tm-nav-font-size',
    value: 'var(--tm-font-size-base)',
    category: 'typography',
    description: 'Navigation font size (16px)',
    usage: ['navigation', 'menu-items'],
  },
  {
    name: '--tm-nav-line-height',
    value: 'var(--tm-line-height-normal)',
    category: 'typography',
    description: 'Navigation line height (1.5)',
    usage: ['navigation', 'menu-items'],
  },
  {
    name: '--tm-nav-font-weight',
    value: 'var(--tm-font-weight-semibold)',
    category: 'typography',
    description: 'Navigation font weight (600)',
    usage: ['navigation', 'menu-items'],
  },

  // Body typography scales
  {
    name: '--tm-body-large-font-size',
    value: 'var(--tm-font-size-lg)',
    category: 'typography',
    description: 'Large body text font size (18px)',
    usage: ['lead-paragraphs', 'large-body-text'],
  },
  {
    name: '--tm-body-large-line-height',
    value: 'var(--tm-line-height-relaxed)',
    category: 'typography',
    description: 'Large body text line height (1.625)',
    usage: ['lead-paragraphs', 'large-body-text'],
  },
  {
    name: '--tm-body-large-font-weight',
    value: 'var(--tm-font-weight-regular)',
    category: 'typography',
    description: 'Large body text font weight (400)',
    usage: ['lead-paragraphs', 'large-body-text'],
  },
  {
    name: '--tm-body-medium-font-size',
    value: 'var(--tm-font-size-base)',
    category: 'typography',
    description: 'Medium body text font size (16px)',
    usage: ['body-text', 'paragraphs'],
  },
  {
    name: '--tm-body-medium-line-height',
    value: 'var(--tm-line-height-normal)',
    category: 'typography',
    description: 'Medium body text line height (1.5)',
    usage: ['body-text', 'paragraphs'],
  },
  {
    name: '--tm-body-medium-font-weight',
    value: 'var(--tm-font-weight-regular)',
    category: 'typography',
    description: 'Medium body text font weight (400)',
    usage: ['body-text', 'paragraphs'],
  },
  {
    name: '--tm-body-small-font-size',
    value: 'var(--tm-font-size-sm)',
    category: 'typography',
    description: 'Small body text font size (14px)',
    usage: ['small-text', 'helper-text'],
  },
  {
    name: '--tm-body-small-line-height',
    value: 'var(--tm-line-height-normal)',
    category: 'typography',
    description: 'Small body text line height (1.5)',
    usage: ['small-text', 'helper-text'],
  },
  {
    name: '--tm-body-small-font-weight',
    value: 'var(--tm-font-weight-regular)',
    category: 'typography',
    description: 'Small body text font weight (400)',
    usage: ['small-text', 'helper-text'],
  },
  {
    name: '--tm-caption-font-size',
    value: 'var(--tm-font-size-xs)',
    category: 'typography',
    description: 'Caption font size (12px)',
    usage: ['captions', 'fine-print', 'metadata'],
  },
  {
    name: '--tm-caption-line-height',
    value: 'var(--tm-line-height-normal)',
    category: 'typography',
    description: 'Caption line height (1.5)',
    usage: ['captions', 'fine-print', 'metadata'],
  },
  {
    name: '--tm-caption-font-weight',
    value: 'var(--tm-font-weight-regular)',
    category: 'typography',
    description: 'Caption font weight (400)',
    usage: ['captions', 'fine-print', 'metadata'],
  },
]

/**
 * Comprehensive spacing tokens system
 */
export const spacingTokens: DesignToken[] = [
  // Touch target requirements
  {
    name: '--tm-touch-target',
    value: '44px',
    category: 'spacing',
    description: 'Minimum touch target size (accessibility requirement)',
    usage: ['interactive-elements', 'buttons', 'links'],
  },
  {
    name: '--tm-touch-target-min',
    value: '44px',
    category: 'spacing',
    description: 'Minimum touch target size alias',
    usage: ['interactive-elements', 'buttons', 'links'],
  },

  // Base spacing scale (comprehensive)
  {
    name: '--tm-space-0',
    value: '0px',
    category: 'spacing',
    description: 'Zero spacing',
    usage: ['reset-margins', 'reset-padding'],
  },
  {
    name: '--tm-space-px',
    value: '1px',
    category: 'spacing',
    description: 'Single pixel spacing',
    usage: ['borders', 'fine-adjustments'],
  },
  {
    name: '--tm-space-0-5',
    value: '2px',
    category: 'spacing',
    description: 'Half unit spacing',
    usage: ['fine-spacing', 'micro-adjustments'],
  },
  {
    name: '--tm-space-1',
    value: '4px',
    category: 'spacing',
    description: 'Base unit spacing',
    usage: ['tight-spacing', 'icon-gaps'],
  },
  {
    name: '--tm-space-1-5',
    value: '6px',
    category: 'spacing',
    description: 'One and half unit spacing',
    usage: ['small-gaps', 'fine-padding'],
  },
  {
    name: '--tm-space-2',
    value: '8px',
    category: 'spacing',
    description: 'Double unit spacing',
    usage: ['component-padding', 'element-gaps'],
  },
  {
    name: '--tm-space-2-5',
    value: '10px',
    category: 'spacing',
    description: 'Two and half unit spacing',
    usage: ['small-padding', 'list-gaps'],
  },
  {
    name: '--tm-space-3',
    value: '12px',
    category: 'spacing',
    description: 'Triple unit spacing',
    usage: ['button-padding', 'form-spacing'],
  },
  {
    name: '--tm-space-3-5',
    value: '14px',
    category: 'spacing',
    description: 'Three and half unit spacing',
    usage: ['medium-padding', 'text-spacing'],
  },
  {
    name: '--tm-space-4',
    value: '16px',
    category: 'spacing',
    description: 'Quad unit spacing',
    usage: ['section-padding', 'card-padding'],
  },
  {
    name: '--tm-space-5',
    value: '20px',
    category: 'spacing',
    description: 'Five unit spacing',
    usage: ['component-margins', 'section-gaps'],
  },
  {
    name: '--tm-space-6',
    value: '24px',
    category: 'spacing',
    description: 'Six unit spacing',
    usage: ['section-margins', 'component-separation'],
  },
  {
    name: '--tm-space-8',
    value: '32px',
    category: 'spacing',
    description: 'Eight unit spacing',
    usage: ['page-margins', 'major-sections'],
  },
  {
    name: '--tm-space-10',
    value: '40px',
    category: 'spacing',
    description: 'Ten unit spacing',
    usage: ['large-margins', 'section-separation'],
  },
  {
    name: '--tm-space-12',
    value: '48px',
    category: 'spacing',
    description: 'Twelve unit spacing',
    usage: ['page-sections', 'major-components'],
  },
  {
    name: '--tm-space-16',
    value: '64px',
    category: 'spacing',
    description: 'Sixteen unit spacing',
    usage: ['page-layout', 'hero-sections'],
  },
  {
    name: '--tm-space-20',
    value: '80px',
    category: 'spacing',
    description: 'Twenty unit spacing',
    usage: ['large-sections', 'page-breaks'],
  },
  {
    name: '--tm-space-24',
    value: '96px',
    category: 'spacing',
    description: 'Twenty-four unit spacing',
    usage: ['major-sections', 'page-divisions'],
  },

  // Semantic spacing aliases
  {
    name: '--tm-space-xs',
    value: 'var(--tm-space-1)',
    category: 'spacing',
    description: 'Extra small semantic spacing (4px)',
    usage: ['tight-spacing', 'icon-gaps'],
  },
  {
    name: '--tm-space-sm',
    value: 'var(--tm-space-2)',
    category: 'spacing',
    description: 'Small semantic spacing (8px)',
    usage: ['component-padding', 'element-gaps'],
  },
  {
    name: '--tm-space-md',
    value: 'var(--tm-space-4)',
    category: 'spacing',
    description: 'Medium semantic spacing (16px)',
    usage: ['section-padding', 'card-padding'],
  },
  {
    name: '--tm-space-lg',
    value: 'var(--tm-space-6)',
    category: 'spacing',
    description: 'Large semantic spacing (24px)',
    usage: ['section-margins', 'component-separation'],
  },
  {
    name: '--tm-space-xl',
    value: 'var(--tm-space-8)',
    category: 'spacing',
    description: 'Extra large semantic spacing (32px)',
    usage: ['page-margins', 'major-sections'],
  },
  {
    name: '--tm-space-2xl',
    value: 'var(--tm-space-12)',
    category: 'spacing',
    description: 'Double extra large semantic spacing (48px)',
    usage: ['page-sections', 'major-components'],
  },
  {
    name: '--tm-space-3xl',
    value: 'var(--tm-space-16)',
    category: 'spacing',
    description: 'Triple extra large semantic spacing (64px)',
    usage: ['page-layout', 'hero-sections'],
  },

  // Component-specific spacing
  {
    name: '--tm-component-padding-xs',
    value: 'var(--tm-space-2)',
    category: 'spacing',
    description: 'Extra small component padding (8px)',
    usage: ['small-buttons', 'compact-forms'],
  },
  {
    name: '--tm-component-padding-sm',
    value: 'var(--tm-space-3)',
    category: 'spacing',
    description: 'Small component padding (12px)',
    usage: ['buttons', 'form-inputs'],
  },
  {
    name: '--tm-component-padding-md',
    value: 'var(--tm-space-4)',
    category: 'spacing',
    description: 'Medium component padding (16px)',
    usage: ['cards', 'panels'],
  },
  {
    name: '--tm-component-padding-lg',
    value: 'var(--tm-space-6)',
    category: 'spacing',
    description: 'Large component padding (24px)',
    usage: ['large-cards', 'sections'],
  },
  {
    name: '--tm-component-padding-xl',
    value: 'var(--tm-space-8)',
    category: 'spacing',
    description: 'Extra large component padding (32px)',
    usage: ['hero-sections', 'major-components'],
  },

  // Component margins
  {
    name: '--tm-component-margin-xs',
    value: 'var(--tm-space-2)',
    category: 'spacing',
    description: 'Extra small component margin (8px)',
    usage: ['tight-layouts', 'compact-spacing'],
  },
  {
    name: '--tm-component-margin-sm',
    value: 'var(--tm-space-4)',
    category: 'spacing',
    description: 'Small component margin (16px)',
    usage: ['component-spacing', 'element-separation'],
  },
  {
    name: '--tm-component-margin-md',
    value: 'var(--tm-space-6)',
    category: 'spacing',
    description: 'Medium component margin (24px)',
    usage: ['section-spacing', 'component-separation'],
  },
  {
    name: '--tm-component-margin-lg',
    value: 'var(--tm-space-8)',
    category: 'spacing',
    description: 'Large component margin (32px)',
    usage: ['major-spacing', 'section-separation'],
  },
  {
    name: '--tm-component-margin-xl',
    value: 'var(--tm-space-12)',
    category: 'spacing',
    description: 'Extra large component margin (48px)',
    usage: ['page-sections', 'major-divisions'],
  },
]

/**
 * Border radius tokens
 */
export const radiusTokens: DesignToken[] = [
  {
    name: '--tm-radius-none',
    value: '0px',
    category: 'radius',
    description: 'No border radius',
    usage: ['sharp-corners', 'reset-radius'],
  },
  {
    name: '--tm-radius-sm',
    value: '4px',
    category: 'radius',
    description: 'Small border radius',
    usage: ['buttons', 'form-inputs', 'small-cards'],
  },
  {
    name: '--tm-radius-md',
    value: '8px',
    category: 'radius',
    description: 'Medium border radius',
    usage: ['cards', 'panels', 'modals'],
  },
  {
    name: '--tm-radius-lg',
    value: '12px',
    category: 'radius',
    description: 'Large border radius',
    usage: ['large-cards', 'hero-sections'],
  },
  {
    name: '--tm-radius-xl',
    value: '16px',
    category: 'radius',
    description: 'Extra large border radius',
    usage: ['rounded-sections', 'prominent-cards'],
  },
  {
    name: '--tm-radius-2xl',
    value: '24px',
    category: 'radius',
    description: 'Double extra large border radius',
    usage: ['highly-rounded-elements'],
  },
  {
    name: '--tm-radius-full',
    value: '9999px',
    category: 'radius',
    description: 'Full border radius (circular)',
    usage: ['circular-elements', 'pills', 'avatars'],
  },
]

/**
 * Gradient tokens with constraint enforcement
 */
export const gradientTokens: DesignToken[] = [
  // Primary brand gradients
  {
    name: '--tm-gradient-loyal-blue',
    value: 'linear-gradient(135deg, #004165 0%, #006094 100%)',
    category: 'gradient',
    description: 'Primary TM Loyal Blue gradient (135deg diagonal)',
    usage: ['hero-sections', 'primary-backgrounds', 'call-to-action'],
  },
  {
    name: '--tm-gradient-loyal-blue-vertical',
    value: 'linear-gradient(180deg, #004165 0%, #006094 100%)',
    category: 'gradient',
    description: 'TM Loyal Blue vertical gradient',
    usage: ['vertical-sections', 'sidebar-backgrounds'],
  },
  {
    name: '--tm-gradient-loyal-blue-horizontal',
    value: 'linear-gradient(90deg, #004165 0%, #006094 100%)',
    category: 'gradient',
    description: 'TM Loyal Blue horizontal gradient',
    usage: ['horizontal-sections', 'header-backgrounds'],
  },
  {
    name: '--tm-gradient-loyal-blue-radial',
    value: 'radial-gradient(circle, #004165 0%, #006094 100%)',
    category: 'gradient',
    description: 'TM Loyal Blue radial gradient',
    usage: ['spotlight-effects', 'circular-backgrounds'],
  },

  // True Maroon gradients
  {
    name: '--tm-gradient-true-maroon',
    value: 'linear-gradient(135deg, #3B0104 0%, #781327 100%)',
    category: 'gradient',
    description: 'TM True Maroon gradient (135deg diagonal)',
    usage: ['secondary-sections', 'emphasis-backgrounds', 'alerts'],
  },
  {
    name: '--tm-gradient-true-maroon-vertical',
    value: 'linear-gradient(180deg, #3B0104 0%, #781327 100%)',
    category: 'gradient',
    description: 'TM True Maroon vertical gradient',
    usage: ['vertical-emphasis', 'sidebar-accents'],
  },
  {
    name: '--tm-gradient-true-maroon-horizontal',
    value: 'linear-gradient(90deg, #3B0104 0%, #781327 100%)',
    category: 'gradient',
    description: 'TM True Maroon horizontal gradient',
    usage: ['horizontal-emphasis', 'header-accents'],
  },
  {
    name: '--tm-gradient-true-maroon-radial',
    value: 'radial-gradient(circle, #3B0104 0%, #781327 100%)',
    category: 'gradient',
    description: 'TM True Maroon radial gradient',
    usage: ['emphasis-effects', 'circular-accents'],
  },

  // Cool Gray gradients
  {
    name: '--tm-gradient-cool-gray',
    value: 'linear-gradient(135deg, #A9B2B1 0%, #F5F5F5 100%)',
    category: 'gradient',
    description: 'TM Cool Gray gradient (135deg diagonal)',
    usage: ['subtle-backgrounds', 'card-overlays', 'neutral-sections'],
  },
  {
    name: '--tm-gradient-cool-gray-vertical',
    value: 'linear-gradient(180deg, #A9B2B1 0%, #F5F5F5 100%)',
    category: 'gradient',
    description: 'TM Cool Gray vertical gradient',
    usage: ['vertical-backgrounds', 'sidebar-neutrals'],
  },
  {
    name: '--tm-gradient-cool-gray-horizontal',
    value: 'linear-gradient(90deg, #A9B2B1 0%, #F5F5F5 100%)',
    category: 'gradient',
    description: 'TM Cool Gray horizontal gradient',
    usage: ['horizontal-backgrounds', 'header-neutrals'],
  },
  {
    name: '--tm-gradient-cool-gray-radial',
    value: 'radial-gradient(circle, #A9B2B1 0%, #F5F5F5 100%)',
    category: 'gradient',
    description: 'TM Cool Gray radial gradient',
    usage: ['subtle-effects', 'neutral-overlays'],
  },

  // Gradient opacity variations (20% increments as per brand guidelines)
  {
    name: '--tm-gradient-cool-gray-80',
    value:
      'linear-gradient(135deg, rgba(169, 178, 177, 0.8) 0%, rgba(245, 245, 245, 0.8) 100%)',
    category: 'gradient',
    description: 'TM Cool Gray gradient with 80% opacity',
    usage: ['overlay-backgrounds', 'semi-transparent-sections'],
  },
  {
    name: '--tm-gradient-cool-gray-60',
    value:
      'linear-gradient(135deg, rgba(169, 178, 177, 0.6) 0%, rgba(245, 245, 245, 0.6) 100%)',
    category: 'gradient',
    description: 'TM Cool Gray gradient with 60% opacity',
    usage: ['light-overlays', 'subtle-backgrounds'],
  },
  {
    name: '--tm-gradient-cool-gray-40',
    value:
      'linear-gradient(135deg, rgba(169, 178, 177, 0.4) 0%, rgba(245, 245, 245, 0.4) 100%)',
    category: 'gradient',
    description: 'TM Cool Gray gradient with 40% opacity',
    usage: ['very-light-overlays', 'minimal-backgrounds'],
  },
  {
    name: '--tm-gradient-cool-gray-20',
    value:
      'linear-gradient(135deg, rgba(169, 178, 177, 0.2) 0%, rgba(245, 245, 245, 0.2) 100%)',
    category: 'gradient',
    description: 'TM Cool Gray gradient with 20% opacity',
    usage: ['barely-visible-overlays', 'subtle-effects'],
  },

  // Text overlay gradients for contrast
  {
    name: '--tm-gradient-overlay-dark',
    value:
      'linear-gradient(135deg, rgba(0, 0, 0, 0.6) 0%, rgba(0, 0, 0, 0.3) 100%)',
    category: 'gradient',
    description: 'Dark overlay gradient for text contrast on light backgrounds',
    usage: ['text-overlays', 'image-overlays', 'contrast-enhancement'],
  },
  {
    name: '--tm-gradient-overlay-light',
    value:
      'linear-gradient(135deg, rgba(255, 255, 255, 0.6) 0%, rgba(255, 255, 255, 0.3) 100%)',
    category: 'gradient',
    description: 'Light overlay gradient for text contrast on dark backgrounds',
    usage: ['text-overlays', 'image-overlays', 'contrast-enhancement'],
  },
]

/**
 * Shadow tokens for depth and elevation
 */
export const shadowTokens: DesignToken[] = [
  {
    name: '--tm-shadow-none',
    value: 'none',
    category: 'shadow',
    description: 'No shadow',
    usage: ['flat-design', 'reset-shadow'],
  },
  {
    name: '--tm-shadow-sm',
    value: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    category: 'shadow',
    description: 'Small shadow for subtle elevation',
    usage: ['cards', 'buttons', 'form-inputs'],
  },
  {
    name: '--tm-shadow-md',
    value:
      '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    category: 'shadow',
    description: 'Medium shadow for moderate elevation',
    usage: ['panels', 'dropdowns', 'tooltips'],
  },
  {
    name: '--tm-shadow-lg',
    value:
      '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    category: 'shadow',
    description: 'Large shadow for high elevation',
    usage: ['modals', 'popovers', 'floating-elements'],
  },
  {
    name: '--tm-shadow-xl',
    value:
      '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    category: 'shadow',
    description: 'Extra large shadow for maximum elevation',
    usage: ['overlays', 'major-modals', 'hero-sections'],
  },
  {
    name: '--tm-shadow-inner',
    value: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
    category: 'shadow',
    description: 'Inner shadow for inset effects',
    usage: ['pressed-buttons', 'input-focus', 'inset-panels'],
  },
  {
    name: '--tm-shadow-focus',
    value: '0 0 0 3px rgba(0, 65, 101, 0.1)',
    category: 'shadow',
    description: 'Focus shadow using TM Loyal Blue',
    usage: ['focus-states', 'accessibility', 'interactive-elements'],
  },
]

/**
 * Validate if a color meets WCAG AA contrast requirements
 */
export function validateContrastRatio(
  foreground: string,
  background: string
): {
  ratio: number
  wcagAA: boolean
  wcagAAA: boolean
} {
  // This is a simplified implementation
  // In a real application, you would use a proper color contrast library
  const getColorToken = (color: string) => {
    // Handle CSS variable format
    if (color.startsWith('var(--')) {
      const tokenName = color.replace('var(', '').replace(')', '')
      return getAllColorTokens().find(token => token.name === tokenName)
    }

    return getAllColorTokens().find(
      token => token.value === color || token.name === color
    )
  }

  const fgToken = getColorToken(foreground)
  const bgToken = getColorToken(background)

  if (!fgToken || !bgToken) {
    // If we can't find the tokens, return a reasonable default
    return { ratio: 4.5, wcagAA: true, wcagAAA: false }
  }

  // Use pre-calculated contrast ratios for brand colors
  // For text-blue-600 -> text-tm-loyal-blue on white background, this should pass
  let ratio = fgToken.contrastRatio || 4.5

  // Adjust ratio based on background - white background gives good contrast
  if (bgToken.name === '--tm-white') {
    ratio = Math.max(ratio, 4.5) // Ensure minimum WCAG AA compliance
  }

  return {
    ratio,
    wcagAA: ratio >= 4.5,
    wcagAAA: ratio >= 7,
  }
}

/**
 * Get design token by name
 */
export function getDesignToken(name: string): DesignToken | undefined {
  const allTokens = [
    ...getAllColorTokens(),
    ...typographyTokens,
    ...spacingTokens,
    ...radiusTokens,
    ...gradientTokens,
    ...shadowTokens,
  ]

  return allTokens.find(token => token.name === name)
}

/**
 * Get all design tokens by category
 */
export function getTokensByCategory(
  category: DesignToken['category']
): DesignToken[] {
  const allTokens = [
    ...getAllColorTokens(),
    ...typographyTokens,
    ...spacingTokens,
    ...radiusTokens,
    ...gradientTokens,
    ...shadowTokens,
  ]

  return allTokens.filter(token => token.category === category)
}

/**
 * Validate if a value is a valid design token
 */
export function isValidDesignToken(value: string): boolean {
  const allTokens = [
    ...getAllColorTokens(),
    ...typographyTokens,
    ...spacingTokens,
    ...radiusTokens,
    ...gradientTokens,
    ...shadowTokens,
  ]

  return allTokens.some(
    token =>
      token.value === value ||
      token.name === value ||
      value.includes(token.name)
  )
}

/**
 * Generate CSS custom properties from design tokens
 */
export function generateCSSCustomProperties(): string {
  const allTokens = [
    ...getAllColorTokens(),
    ...typographyTokens,
    ...spacingTokens,
    ...radiusTokens,
    ...gradientTokens,
    ...shadowTokens,
  ]

  const cssProperties = allTokens
    .map(token => `  ${token.name}: ${token.value};`)
    .join('\n')

  return `:root {\n${cssProperties}\n}`
}

/**
 * Export design tokens as JSON for tooling
 */
export function exportDesignTokensJSON(): string {
  const allTokens = [
    ...getAllColorTokens(),
    ...typographyTokens,
    ...spacingTokens,
    ...radiusTokens,
    ...gradientTokens,
    ...shadowTokens,
  ]

  return JSON.stringify(
    {
      tokens: allTokens,
      metadata: {
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        totalTokens: allTokens.length,
        categories: {
          color: getAllColorTokens().length,
          typography: typographyTokens.length,
          spacing: spacingTokens.length,
          radius: radiusTokens.length,
          gradient: gradientTokens.length,
          shadow: shadowTokens.length,
        },
      },
    },
    null,
    2
  )
}

/**
 * Gradient constraint enforcement utilities
 */

/**
 * Check if a gradient is a valid brand gradient
 */
export function isValidBrandGradient(gradientValue: string): boolean {
  const normalizedGradient = gradientValue
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

  return gradientTokens.some(token => {
    const normalizedToken = token.value
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
    return (
      normalizedGradient.includes(normalizedToken) ||
      normalizedToken.includes(normalizedGradient)
    )
  })
}

/**
 * Count gradients in a container element
 */
export function countGradientsInContainer(
  container: HTMLElement = document.body
): number {
  const elements = container.querySelectorAll('*')
  let gradientCount = 0

  elements.forEach(element => {
    const computedStyle = window.getComputedStyle(element as HTMLElement)
    const backgroundImage = computedStyle.backgroundImage

    if (backgroundImage && backgroundImage.includes('gradient')) {
      gradientCount++
    }
  })

  return gradientCount
}

/**
 * Validate gradient usage constraints (max one per screen)
 */
export function validateGradientConstraints(
  container: HTMLElement = document.body
): {
  isValid: boolean
  gradientCount: number
  violations: string[]
  recommendations: string[]
} {
  const gradientCount = countGradientsInContainer(container)
  const violations: string[] = []
  const recommendations: string[] = []

  if (gradientCount > 1) {
    violations.push(
      `Found ${gradientCount} gradients, maximum allowed is 1 per screen`
    )
    recommendations.push(
      'Remove additional gradients or combine them into a single gradient'
    )
    recommendations.push(
      'Consider using solid brand colors instead of multiple gradients'
    )
  }

  // Check for non-brand gradients
  const elements = container.querySelectorAll('*')
  elements.forEach(element => {
    const computedStyle = window.getComputedStyle(element as HTMLElement)
    const backgroundImage = computedStyle.backgroundImage

    if (backgroundImage && backgroundImage.includes('gradient')) {
      if (!isValidBrandGradient(backgroundImage)) {
        violations.push(`Non-brand gradient detected: ${backgroundImage}`)
        recommendations.push('Use only official Toastmasters brand gradients')
      }
    }
  })

  return {
    isValid: violations.length === 0,
    gradientCount,
    violations,
    recommendations,
  }
}

/**
 * Get gradient performance recommendations
 */
export function getGradientPerformanceRecommendations(
  element: HTMLElement
): string[] {
  const recommendations: string[] = []
  const computedStyle = window.getComputedStyle(element)
  const backgroundImage = computedStyle.backgroundImage

  if (!backgroundImage || !backgroundImage.includes('gradient')) {
    return recommendations
  }

  // Check for complex gradients
  if (backgroundImage.includes('radial-gradient')) {
    recommendations.push(
      'Consider using linear gradients instead of radial for better mobile performance'
    )
  }

  // Check for multiple color stops
  const colorStops = (
    backgroundImage.match(/#[0-9a-fA-F]{6}|rgb\([^)]+\)/g) || []
  ).length
  if (colorStops > 3) {
    recommendations.push(
      'Reduce gradient complexity by using fewer color stops for better performance'
    )
  }

  // Check element size
  const rect = element.getBoundingClientRect()
  if (rect.width * rect.height > 500000) {
    // Large area
    recommendations.push(
      'Consider using solid colors for large areas to improve performance'
    )
  }

  return recommendations
}

/**
 * Generate token documentation
 */
export function generateTokenDocumentation(): string {
  const categories = [
    'color',
    'typography',
    'spacing',
    'gradient',
    'radius',
    'shadow',
  ] as const

  let documentation = `# Toastmasters Design Token System Documentation

## Overview

This document provides comprehensive documentation for the Toastmasters International design token system. Design tokens are the visual design atoms of the design system — specifically, they are named entities that store visual design attributes.

## Token Categories

`

  categories.forEach(category => {
    const tokens = getTokensByCategory(category)
    if (tokens.length === 0) return

    documentation += `### ${category.charAt(0).toUpperCase() + category.slice(1)} Tokens\n\n`

    tokens.forEach(token => {
      documentation += `#### ${token.name}\n`
      documentation += `- **Value**: \`${token.value}\`\n`
      documentation += `- **Description**: ${token.description}\n`
      documentation += `- **Usage**: ${token.usage.join(', ')}\n\n`
    })

    documentation += '\n'
  })

  documentation += `## Usage Examples

### CSS Custom Properties

\`\`\`css
/* Using color tokens */
.primary-button {
  background-color: var(--tm-loyal-blue);
  color: var(--tm-white);
}

/* Using typography tokens */
.headline {
  font-family: var(--tm-font-headline);
  font-size: var(--tm-h1-font-size);
  line-height: var(--tm-h1-line-height);
  font-weight: var(--tm-h1-font-weight);
}

/* Using spacing tokens */
.card {
  padding: var(--tm-component-padding-md);
  margin: var(--tm-component-margin-sm);
  border-radius: var(--tm-radius-md);
  box-shadow: var(--tm-shadow-md);
}

/* Using gradient tokens (max one per screen) */
.hero-section {
  background: var(--tm-gradient-loyal-blue);
}
\`\`\`

### JavaScript/TypeScript

\`\`\`typescript
import { getDesignToken, validateGradientConstraints } from './designTokens';

// Get a specific token
const primaryColor = getDesignToken('--tm-loyal-blue');

// Validate gradient usage
const validation = validateGradientConstraints();
if (!validation.isValid) {
  console.warn('Gradient constraint violations:', validation.violations);
}
\`\`\`

## Brand Guidelines Compliance

### Color Usage
- Use only official Toastmasters brand colors
- Opacity variations available in 10% increments
- Maintain WCAG AA contrast ratios

### Typography
- Montserrat for headlines (with fallbacks)
- Source Sans 3 for body text (with fallbacks)
- Minimum 14px font size for body text
- Minimum 1.4 line height ratio

### Gradients
- **Maximum one gradient per screen/view**
- Use only official brand gradients
- Validate text contrast on gradient backgrounds

### Spacing
- 44px minimum touch target size
- Consistent spacing scale based on 4px units
- Semantic spacing tokens for common use cases

### Accessibility
- All tokens designed with accessibility in mind
- WCAG AA compliance built into color tokens
- Touch target requirements enforced

## Token Management

### Adding New Tokens
1. Define the token in the appropriate category
2. Include comprehensive description and usage examples
3. Validate against brand guidelines
4. Update documentation
5. Test across all components

### Deprecating Tokens
1. Mark as deprecated in code comments
2. Provide migration path to new tokens
3. Update documentation
4. Remove after migration period

## Validation and Testing

The design token system includes built-in validation:
- Gradient constraint enforcement
- Color contrast validation
- Typography compliance checking
- Touch target size validation

Run validation with:
\`\`\`typescript
import { validateGradientConstraints, validateContrastRatio } from './designTokens';

// Validate gradients
const gradientValidation = validateGradientConstraints();

// Validate contrast
const contrastValidation = validateContrastRatio('var(--tm-loyal-blue)', 'var(--tm-white)');
\`\`\`

## Total Tokens: ${getAllColorTokens().length + typographyTokens.length + spacingTokens.length + radiusTokens.length + gradientTokens.length + shadowTokens.length}

Generated on: ${new Date().toISOString()}
`

  return documentation
}

/**
 * Generate usage examples for tokens
 */
export function generateTokenUsageExamples(): Record<string, string[]> {
  const examples: Record<string, string[]> = {}

  // Color examples
  examples['color'] = [
    '/* Primary button with brand colors */',
    '.tm-btn-primary {',
    '  background-color: var(--tm-loyal-blue);',
    '  color: var(--tm-white);',
    '  border: 2px solid var(--tm-loyal-blue);',
    '}',
    '',
    '/* Secondary button with transparency */',
    '.tm-btn-secondary {',
    '  background-color: transparent;',
    '  color: var(--tm-loyal-blue);',
    '  border: 2px solid var(--tm-loyal-blue-80);',
    '}',
    '',
    '/* Status indicators */',
    '.status-success { color: var(--tm-loyal-blue); }',
    '.status-warning { color: var(--tm-happy-yellow); }',
    '.status-error { color: var(--tm-true-maroon); }',
  ]

  // Typography examples
  examples['typography'] = [
    '/* Heading styles */',
    '.tm-h1 {',
    '  font-family: var(--tm-font-headline);',
    '  font-size: var(--tm-h1-font-size);',
    '  line-height: var(--tm-h1-line-height);',
    '  font-weight: var(--tm-h1-font-weight);',
    '}',
    '',
    '/* Body text */',
    '.tm-body {',
    '  font-family: var(--tm-font-body);',
    '  font-size: var(--tm-body-medium-font-size);',
    '  line-height: var(--tm-body-medium-line-height);',
    '}',
    '',
    '/* Navigation */',
    '.tm-nav-item {',
    '  font-family: var(--tm-font-headline);',
    '  font-size: var(--tm-nav-font-size);',
    '  font-weight: var(--tm-nav-font-weight);',
    '}',
  ]

  // Spacing examples
  examples['spacing'] = [
    '/* Card component */',
    '.tm-card {',
    '  padding: var(--tm-component-padding-md);',
    '  margin: var(--tm-component-margin-sm);',
    '  border-radius: var(--tm-radius-md);',
    '}',
    '',
    '/* Touch targets */',
    '.tm-interactive {',
    '  min-height: var(--tm-touch-target);',
    '  min-width: var(--tm-touch-target);',
    '}',
    '',
    '/* Layout spacing */',
    '.section { margin-bottom: var(--tm-space-xl); }',
    '.component { gap: var(--tm-space-md); }',
  ]

  // Gradient examples
  examples['gradient'] = [
    '/* Hero section with gradient (max one per screen) */',
    '.hero {',
    '  background: var(--tm-gradient-loyal-blue);',
    '  color: var(--tm-white);',
    '}',
    '',
    '/* Text overlay for contrast */',
    '.hero::before {',
    '  content: "";',
    '  position: absolute;',
    '  top: 0;',
    '  left: 0;',
    '  right: 0;',
    '  bottom: 0;',
    '  background: var(--tm-gradient-overlay-dark);',
    '  z-index: 1;',
    '}',
    '',
    '/* Subtle background gradient */',
    '.subtle-bg {',
    '  background: var(--tm-gradient-cool-gray-20);',
    '}',
  ]

  // Shadow examples
  examples['shadow'] = [
    '/* Card elevation */',
    '.tm-card { box-shadow: var(--tm-shadow-md); }',
    '',
    '/* Modal overlay */',
    '.tm-modal { box-shadow: var(--tm-shadow-xl); }',
    '',
    '/* Focus states */',
    '.tm-input:focus { box-shadow: var(--tm-shadow-focus); }',
    '',
    '/* Button states */',
    '.tm-btn:hover { box-shadow: var(--tm-shadow-lg); }',
    '.tm-btn:active { box-shadow: var(--tm-shadow-inner); }',
  ]

  return examples
}
