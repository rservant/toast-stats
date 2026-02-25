import type { DesignToken } from './types'

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
