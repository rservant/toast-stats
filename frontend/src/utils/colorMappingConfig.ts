/**
 * Brand Compliance Color Mapping Configuration
 *
 * This configuration defines mappings from non-compliant colors to approved
 * Toastmasters brand colors for automated replacement during compliance remediation.
 */

export interface ColorMapping {
  from: string
  to: string
  context:
    | 'primary'
    | 'secondary'
    | 'accent'
    | 'neutral'
    | 'error'
    | 'success'
    | 'warning'
  preserveOpacity: boolean
  description: string
}

export interface ColorMappingConfig {
  tailwindClasses: ColorMapping[]
  hexColors: ColorMapping[]
  cssProperties: ColorMapping[]
  chartColors: ColorMapping[]
}

/**
 * Comprehensive color mapping configuration for brand compliance remediation
 */
export const colorMappingConfig: ColorMappingConfig = {
  // Tailwind CSS class mappings
  tailwindClasses: [
    // Blue color violations - Primary actions
    {
      from: 'text-blue-600',
      to: 'text-tm-loyal-blue',
      context: 'primary',
      preserveOpacity: false,
      description: 'Primary text color for links and actions',
    },
    {
      from: 'text-blue-700',
      to: 'text-tm-loyal-blue',
      context: 'primary',
      preserveOpacity: false,
      description: 'Darker primary text variant',
    },
    {
      from: 'text-blue-500',
      to: 'text-tm-loyal-blue',
      context: 'primary',
      preserveOpacity: false,
      description: 'Primary text color variant',
    },
    {
      from: 'bg-blue-600',
      to: 'bg-tm-loyal-blue',
      context: 'primary',
      preserveOpacity: false,
      description: 'Primary background color for buttons and highlights',
    },
    {
      from: 'bg-blue-700',
      to: 'bg-tm-loyal-blue',
      context: 'primary',
      preserveOpacity: false,
      description: 'Darker primary background variant',
    },
    {
      from: 'bg-blue-500',
      to: 'bg-tm-loyal-blue',
      context: 'primary',
      preserveOpacity: false,
      description: 'Primary background color variant',
    },
    {
      from: 'border-blue-600',
      to: 'border-tm-loyal-blue',
      context: 'primary',
      preserveOpacity: false,
      description: 'Primary border color for focus states and active elements',
    },
    {
      from: 'border-blue-700',
      to: 'border-tm-loyal-blue',
      context: 'primary',
      preserveOpacity: false,
      description: 'Darker primary border variant',
    },
    {
      from: 'border-blue-500',
      to: 'border-tm-loyal-blue',
      context: 'primary',
      preserveOpacity: false,
      description: 'Primary border color variant',
    },

    // Red color violations - Error states
    {
      from: 'text-red-600',
      to: 'text-tm-true-maroon',
      context: 'error',
      preserveOpacity: false,
      description: 'Error text color',
    },
    {
      from: 'text-red-500',
      to: 'text-tm-true-maroon',
      context: 'error',
      preserveOpacity: false,
      description: 'Error text color variant',
    },
    {
      from: 'bg-red-600',
      to: 'bg-tm-true-maroon',
      context: 'error',
      preserveOpacity: false,
      description: 'Error background color',
    },
    {
      from: 'bg-red-500',
      to: 'bg-tm-true-maroon',
      context: 'error',
      preserveOpacity: false,
      description: 'Error background color variant',
    },
    {
      from: 'border-red-600',
      to: 'border-tm-true-maroon',
      context: 'error',
      preserveOpacity: false,
      description: 'Error border color',
    },

    // Green color violations - Success states
    {
      from: 'text-green-600',
      to: 'text-tm-loyal-blue',
      context: 'success',
      preserveOpacity: false,
      description: 'Success text color mapped to loyal blue',
    },
    {
      from: 'text-green-500',
      to: 'text-tm-loyal-blue',
      context: 'success',
      preserveOpacity: false,
      description: 'Success text color variant',
    },
    {
      from: 'bg-green-600',
      to: 'bg-tm-loyal-blue',
      context: 'success',
      preserveOpacity: false,
      description: 'Success background color mapped to loyal blue',
    },
    {
      from: 'bg-green-500',
      to: 'bg-tm-loyal-blue',
      context: 'success',
      preserveOpacity: false,
      description: 'Success background color variant',
    },

    // Yellow/Orange color violations - Warning states
    {
      from: 'text-yellow-600',
      to: 'text-tm-happy-yellow',
      context: 'warning',
      preserveOpacity: false,
      description: 'Warning text color',
    },
    {
      from: 'text-orange-600',
      to: 'text-tm-happy-yellow',
      context: 'warning',
      preserveOpacity: false,
      description: 'Warning text color from orange',
    },
    {
      from: 'bg-yellow-600',
      to: 'bg-tm-happy-yellow',
      context: 'warning',
      preserveOpacity: false,
      description: 'Warning background color',
    },
    {
      from: 'bg-orange-600',
      to: 'bg-tm-happy-yellow',
      context: 'warning',
      preserveOpacity: false,
      description: 'Warning background color from orange',
    },

    // Gray color violations - Neutral states
    {
      from: 'text-gray-600',
      to: 'text-tm-cool-gray',
      context: 'neutral',
      preserveOpacity: false,
      description: 'Neutral text color',
    },
    {
      from: 'text-gray-500',
      to: 'text-tm-cool-gray',
      context: 'neutral',
      preserveOpacity: false,
      description: 'Neutral text color variant',
    },
    {
      from: 'bg-gray-100',
      to: 'bg-tm-cool-gray-20',
      context: 'neutral',
      preserveOpacity: true,
      description: 'Light neutral background',
    },
    {
      from: 'bg-gray-200',
      to: 'bg-tm-cool-gray-30',
      context: 'neutral',
      preserveOpacity: true,
      description: 'Neutral background',
    },
    {
      from: 'border-gray-300',
      to: 'border-tm-cool-gray',
      context: 'neutral',
      preserveOpacity: false,
      description: 'Neutral border color',
    },
  ],

  // Hardcoded hex color mappings
  hexColors: [
    // Blue hex colors
    {
      from: '#3b82f6',
      to: 'var(--tm-loyal-blue)',
      context: 'primary',
      preserveOpacity: false,
      description: 'Primary blue hex to TM Loyal Blue',
    },
    {
      from: '#2563eb',
      to: 'var(--tm-loyal-blue)',
      context: 'primary',
      preserveOpacity: false,
      description: 'Primary blue variant hex to TM Loyal Blue',
    },
    {
      from: '#1d4ed8',
      to: 'var(--tm-loyal-blue)',
      context: 'primary',
      preserveOpacity: false,
      description: 'Dark blue hex to TM Loyal Blue',
    },
    {
      from: '#1e40af',
      to: 'var(--tm-loyal-blue)',
      context: 'primary',
      preserveOpacity: false,
      description: 'Blue-700 hex to TM Loyal Blue',
    },
    {
      from: '#60a5fa',
      to: 'var(--tm-loyal-blue)',
      context: 'primary',
      preserveOpacity: false,
      description: 'Light blue hex to TM Loyal Blue',
    },

    // Red hex colors
    {
      from: '#ef4444',
      to: 'var(--tm-true-maroon)',
      context: 'error',
      preserveOpacity: false,
      description: 'Red hex to TM True Maroon for error states',
    },
    {
      from: '#dc2626',
      to: 'var(--tm-true-maroon)',
      context: 'error',
      preserveOpacity: false,
      description: 'Dark red hex to TM True Maroon',
    },
    {
      from: '#b91c1c',
      to: 'var(--tm-true-maroon)',
      context: 'error',
      preserveOpacity: false,
      description: 'Red-700 hex to TM True Maroon',
    },

    // Green hex colors (mapped to TM Loyal Blue for success states)
    {
      from: '#10b981',
      to: 'var(--tm-loyal-blue)',
      context: 'success',
      preserveOpacity: false,
      description: 'Green hex mapped to TM Loyal Blue for success states',
    },
    {
      from: '#059669',
      to: 'var(--tm-loyal-blue)',
      context: 'success',
      preserveOpacity: false,
      description: 'Dark green hex mapped to TM Loyal Blue',
    },
    {
      from: '#047857',
      to: 'var(--tm-loyal-blue)',
      context: 'success',
      preserveOpacity: false,
      description: 'Green-700 hex mapped to TM Loyal Blue',
    },

    // Yellow/Orange hex colors
    {
      from: '#f59e0b',
      to: 'var(--tm-happy-yellow)',
      context: 'warning',
      preserveOpacity: false,
      description: 'Orange hex to TM Happy Yellow for warning states',
    },
    {
      from: '#eab308',
      to: 'var(--tm-happy-yellow)',
      context: 'warning',
      preserveOpacity: false,
      description: 'Yellow hex to TM Happy Yellow',
    },
    {
      from: '#fbbf24',
      to: 'var(--tm-happy-yellow)',
      context: 'warning',
      preserveOpacity: false,
      description: 'Yellow-400 hex to TM Happy Yellow',
    },
    {
      from: '#d97706',
      to: 'var(--tm-happy-yellow)',
      context: 'warning',
      preserveOpacity: false,
      description: 'Amber-600 hex to TM Happy Yellow',
    },

    // Gray hex colors
    {
      from: '#6b7280',
      to: 'var(--tm-cool-gray)',
      context: 'neutral',
      preserveOpacity: false,
      description: 'Gray-500 hex to TM Cool Gray',
    },
    {
      from: '#9ca3af',
      to: 'var(--tm-cool-gray)',
      context: 'neutral',
      preserveOpacity: false,
      description: 'Gray-400 hex to TM Cool Gray',
    },
    {
      from: '#d1d5db',
      to: 'var(--tm-cool-gray-30)',
      context: 'neutral',
      preserveOpacity: true,
      description: 'Light gray hex to TM Cool Gray with opacity',
    },
    {
      from: '#e5e7eb',
      to: 'var(--tm-cool-gray-20)',
      context: 'neutral',
      preserveOpacity: true,
      description: 'Very light gray hex to TM Cool Gray with opacity',
    },
    {
      from: '#f3f4f6',
      to: 'var(--tm-cool-gray-10)',
      context: 'neutral',
      preserveOpacity: true,
      description: 'Ultra light gray hex to TM Cool Gray with opacity',
    },
    {
      from: '#374151',
      to: 'var(--tm-black)',
      context: 'neutral',
      preserveOpacity: false,
      description: 'Dark gray hex to TM Black',
    },
    {
      from: '#111827',
      to: 'var(--tm-black)',
      context: 'neutral',
      preserveOpacity: false,
      description: 'Very dark gray hex to TM Black',
    },

    // Purple/Pink hex colors (mapped to TM True Maroon)
    {
      from: '#ec4899',
      to: 'var(--tm-true-maroon)',
      context: 'accent',
      preserveOpacity: false,
      description: 'Pink hex mapped to TM True Maroon',
    },
    {
      from: '#db2777',
      to: 'var(--tm-true-maroon)',
      context: 'accent',
      preserveOpacity: false,
      description: 'Pink-600 hex mapped to TM True Maroon',
    },

    // Teal/Cyan hex colors (mapped to TM Loyal Blue)
    {
      from: '#14b8a6',
      to: 'var(--tm-loyal-blue)',
      context: 'accent',
      preserveOpacity: false,
      description: 'Teal hex mapped to TM Loyal Blue',
    },
    {
      from: '#0d9488',
      to: 'var(--tm-loyal-blue)',
      context: 'accent',
      preserveOpacity: false,
      description: 'Teal-600 hex mapped to TM Loyal Blue',
    },
  ],

  // CSS property mappings
  cssProperties: [
    {
      from: 'color: #3b82f6',
      to: 'color: var(--tm-loyal-blue)',
      context: 'primary',
      preserveOpacity: false,
      description: 'CSS color property mapping',
    },
    {
      from: 'background-color: #3b82f6',
      to: 'background-color: var(--tm-loyal-blue)',
      context: 'primary',
      preserveOpacity: false,
      description: 'CSS background-color property mapping',
    },
    {
      from: 'border-color: #3b82f6',
      to: 'border-color: var(--tm-loyal-blue)',
      context: 'primary',
      preserveOpacity: false,
      description: 'CSS border-color property mapping',
    },
  ],

  // Chart-specific color mappings
  chartColors: [
    {
      from: '#3b82f6',
      to: 'var(--tm-loyal-blue)',
      context: 'primary',
      preserveOpacity: false,
      description: 'Chart primary data series color',
    },
    {
      from: '#ef4444',
      to: 'var(--tm-true-maroon)',
      context: 'secondary',
      preserveOpacity: false,
      description: 'Chart secondary data series color',
    },
    {
      from: '#10b981',
      to: 'var(--tm-cool-gray)',
      context: 'neutral',
      preserveOpacity: false,
      description: 'Chart tertiary data series color',
    },
    {
      from: '#f59e0b',
      to: 'var(--tm-happy-yellow)',
      context: 'accent',
      preserveOpacity: false,
      description: 'Chart accent data series color',
    },
  ],
}

/**
 * Get color mapping by source color
 */
export function getColorMapping(
  sourceColor: string,
  category: keyof ColorMappingConfig
): ColorMapping | undefined {
  return colorMappingConfig[category].find(
    mapping => mapping.from === sourceColor
  )
}

/**
 * Get all mappings for a specific context
 */
export function getMappingsByContext(
  context: ColorMapping['context']
): ColorMapping[] {
  return [
    ...colorMappingConfig.tailwindClasses,
    ...colorMappingConfig.hexColors,
    ...colorMappingConfig.cssProperties,
    ...colorMappingConfig.chartColors,
  ].filter(mapping => mapping.context === context)
}

/**
 * Validate if a color is brand compliant
 */
export function isBrandCompliantColor(color: string): boolean {
  const brandColors = [
    '#004165', // TM Loyal Blue
    '#772432', // TM True Maroon
    '#A9B2B1', // TM Cool Gray
    '#F2DF74', // TM Happy Yellow
    '#000000', // TM Black
    '#FFFFFF', // TM White
  ]

  const brandColorVariables = [
    'var(--tm-loyal-blue)',
    'var(--tm-true-maroon)',
    'var(--tm-cool-gray)',
    'var(--tm-happy-yellow)',
    'var(--tm-black)',
    'var(--tm-white)',
  ]

  const brandTailwindClasses = [
    'tm-loyal-blue',
    'tm-true-maroon',
    'tm-cool-gray',
    'tm-happy-yellow',
    'tm-black',
    'tm-white',
  ]

  return (
    brandColors.includes(color) ||
    brandColorVariables.includes(color) ||
    brandTailwindClasses.some(brandClass => color.includes(brandClass))
  )
}
