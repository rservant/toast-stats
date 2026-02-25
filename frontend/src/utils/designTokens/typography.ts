/**
 * Typography Tokens
 *
 * Font families, weights, sizes, line heights, letter spacing,
 * and semantic heading/body/nav typography scales.
 */

import type { DesignToken } from './types'

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
