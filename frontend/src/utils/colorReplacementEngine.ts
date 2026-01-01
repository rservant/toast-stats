/**
 * Color Replacement Engine for Brand Compliance Remediation
 *
 * This module provides utilities for detecting and replacing non-compliant colors
 * with approved Toastmasters brand colors while preserving visual hierarchy.
 */

import {
  ColorMapping,
  getColorMapping,
  isBrandCompliantColor,
} from './colorMappingConfig'
import { validateContrastRatio } from './designTokens'

export interface ReplacementResult {
  originalContent: string
  modifiedContent: string
  replacements: ColorReplacement[]
  violationsFound: number
  violationsFixed: number
  preservedHierarchy: boolean
}

export interface ColorReplacement {
  line: number
  column: number
  originalColor: string
  replacementColor: string
  context: ColorMapping['context']
  description: string
  contrastValidated: boolean
}

export interface ColorDetectionPattern {
  pattern: RegExp
  category: 'tailwind' | 'hex' | 'css' | 'chart'
  contextHint: ColorMapping['context']
}

/**
 * Comprehensive regex patterns for detecting blue color violations
 */
export const blueColorPatterns: ColorDetectionPattern[] = [
  // Tailwind blue text classes
  {
    pattern: /\btext-blue-(\d+)\b/g,
    category: 'tailwind',
    contextHint: 'primary',
  },
  // Tailwind blue background classes
  {
    pattern: /\bbg-blue-(\d+)\b/g,
    category: 'tailwind',
    contextHint: 'primary',
  },
  // Tailwind blue border classes
  {
    pattern: /\bborder-blue-(\d+)\b/g,
    category: 'tailwind',
    contextHint: 'primary',
  },
  // Tailwind blue ring classes (focus states)
  {
    pattern: /\bring-blue-(\d+)\b/g,
    category: 'tailwind',
    contextHint: 'primary',
  },
  // Tailwind blue decoration classes
  {
    pattern: /\bdecoration-blue-(\d+)\b/g,
    category: 'tailwind',
    contextHint: 'primary',
  },
  // Hex blue colors (common blue shades)
  {
    pattern: /#(?:3b82f6|2563eb|1d4ed8|1e40af|1e3a8a|60a5fa|93c5fd|dbeafe)/gi,
    category: 'hex',
    contextHint: 'primary',
  },
  // CSS property blue colors
  {
    pattern:
      /(?:color|background-color|border-color):\s*#(?:3b82f6|2563eb|1d4ed8|1e40af|1e3a8a|60a5fa|93c5fd|dbeafe)/gi,
    category: 'css',
    contextHint: 'primary',
  },
  // RGB blue colors
  {
    pattern:
      /rgb\(\s*(?:59,\s*130,\s*246|37,\s*99,\s*235|29,\s*78,\s*216)\s*\)/gi,
    category: 'css',
    contextHint: 'primary',
  },
]

/**
 * Comprehensive hex color patterns for detection
 */
export const hexColorPatterns: ColorDetectionPattern[] = [
  // Common blue hex colors
  {
    pattern: /#(?:3b82f6|2563eb|1d4ed8|1e40af|1e3a8a|60a5fa|93c5fd|dbeafe)/gi,
    category: 'hex',
    contextHint: 'primary',
  },
  // Common red hex colors
  {
    pattern: /#(?:ef4444|dc2626|b91c1c|991b1b|7f1d1d|f87171|fca5a5|fecaca)/gi,
    category: 'hex',
    contextHint: 'error',
  },
  // Common green hex colors
  {
    pattern: /#(?:10b981|059669|047857|065f46|064e3b|34d399|6ee7b7|a7f3d0)/gi,
    category: 'hex',
    contextHint: 'success',
  },
  // Common yellow/orange hex colors
  {
    pattern: /#(?:f59e0b|eab308|d97706|b45309|92400e|fbbf24|fcd34d|fde68a)/gi,
    category: 'hex',
    contextHint: 'warning',
  },
  // Common gray hex colors
  {
    pattern: /#(?:6b7280|9ca3af|d1d5db|e5e7eb|f3f4f6|374151|4b5563|111827)/gi,
    category: 'hex',
    contextHint: 'neutral',
  },
  // Common purple/pink hex colors
  {
    pattern: /#(?:ec4899|db2777|be185d|9d174d|831843|f472b6|f9a8d4|fce7f3)/gi,
    category: 'hex',
    contextHint: 'accent',
  },
  // Common teal/cyan hex colors
  {
    pattern: /#(?:14b8a6|0d9488|0f766e|115e59|134e4a|5eead4|99f6e4|ccfbf1)/gi,
    category: 'hex',
    contextHint: 'accent',
  },
]

/**
 * Additional color patterns for comprehensive detection
 */
export const allColorPatterns: ColorDetectionPattern[] = [
  ...blueColorPatterns,
  ...hexColorPatterns,
  // Red colors (error states)
  {
    pattern: /\btext-red-(\d+)\b/g,
    category: 'tailwind',
    contextHint: 'error',
  },
  {
    pattern: /\bbg-red-(\d+)\b/g,
    category: 'tailwind',
    contextHint: 'error',
  },
  // Green colors (success states)
  {
    pattern: /\btext-green-(\d+)\b/g,
    category: 'tailwind',
    contextHint: 'success',
  },
  {
    pattern: /\bbg-green-(\d+)\b/g,
    category: 'tailwind',
    contextHint: 'success',
  },
  // Yellow/Orange colors (warning states)
  {
    pattern: /\btext-(?:yellow|orange)-(\d+)\b/g,
    category: 'tailwind',
    contextHint: 'warning',
  },
  {
    pattern: /\bbg-(?:yellow|orange)-(\d+)\b/g,
    category: 'tailwind',
    contextHint: 'warning',
  },
  // Gray colors (neutral states)
  {
    pattern: /\btext-gray-(\d+)\b/g,
    category: 'tailwind',
    contextHint: 'neutral',
  },
  {
    pattern: /\bbg-gray-(\d+)\b/g,
    category: 'tailwind',
    contextHint: 'neutral',
  },
]

/**
 * Color Replacement Engine class
 */
export class ColorReplacementEngine {
  /**
   * Replace blue color violations in file content
   */
  async replaceBlueColors(content: string): Promise<ReplacementResult> {
    return this.replaceColorsByPatterns(content, blueColorPatterns)
  }

  /**
   * Replace all color violations in file content
   */
  async replaceAllColors(content: string): Promise<ReplacementResult> {
    return this.replaceColorsByPatterns(content, allColorPatterns)
  }

  /**
   * Replace hex colors with design tokens
   */
  async replaceHexColors(content: string): Promise<ReplacementResult> {
    const hexPatterns = allColorPatterns.filter(p => p.category === 'hex')
    return this.replaceColorsByPatterns(content, hexPatterns)
  }

  /**
   * Replace chart colors with brand-compliant alternatives
   */
  async replaceChartColors(content: string): Promise<ReplacementResult> {
    const result: ReplacementResult = {
      originalContent: content,
      modifiedContent: content,
      replacements: [],
      violationsFound: 0,
      violationsFixed: 0,
      preservedHierarchy: true,
    }

    // Chart-specific patterns for color arrays and configurations
    const chartColorArrayPattern =
      /(?:colors?|palette|scheme):\s*\[([^\]]+)\]/gi
    const chartColorPropertyPattern =
      /(?:backgroundColor|borderColor|pointBackgroundColor):\s*['"`]([^'"`]+)['"`]/gi

    let modifiedContent = content

    // Replace color arrays in chart configurations
    const arrayMatches = Array.from(content.matchAll(chartColorArrayPattern))
    for (const match of arrayMatches) {
      const fullMatch = match[0]
      const colorArray = match[1]

      const lineNumber = this.getLineNumber(content, match.index!)
      const replacedArray = this.replaceChartColorArray(colorArray)

      if (replacedArray !== colorArray) {
        const replacement = fullMatch.replace(colorArray, replacedArray)
        modifiedContent = modifiedContent.replace(fullMatch, replacement)

        result.replacements.push({
          line: lineNumber,
          column: match.index! - this.getLineStartIndex(content, match.index!),
          originalColor: colorArray,
          replacementColor: replacedArray,
          context: 'primary',
          description: 'Chart color array replaced with brand colors',
          contrastValidated: true,
        })

        result.violationsFound++
        result.violationsFixed++
      }
    }

    // Replace individual chart color properties
    const propertyMatches = Array.from(
      content.matchAll(chartColorPropertyPattern)
    )
    for (const match of propertyMatches) {
      const fullMatch = match[0]
      const colorValue = match[1]

      if (!isBrandCompliantColor(colorValue)) {
        const mapping = this.findBestColorMapping(colorValue, 'primary')
        if (mapping) {
          const lineNumber = this.getLineNumber(content, match.index!)
          const replacement = fullMatch.replace(colorValue, mapping.to)
          modifiedContent = modifiedContent.replace(fullMatch, replacement)

          result.replacements.push({
            line: lineNumber,
            column:
              match.index! - this.getLineStartIndex(content, match.index!),
            originalColor: colorValue,
            replacementColor: mapping.to,
            context: mapping.context,
            description: mapping.description,
            contrastValidated: true,
          })

          result.violationsFound++
          result.violationsFixed++
        }
      }
    }

    result.modifiedContent = modifiedContent
    return result
  }

  /**
   * Replace colors based on provided patterns
   */
  private async replaceColorsByPatterns(
    content: string,
    patterns: ColorDetectionPattern[]
  ): Promise<ReplacementResult> {
    const result: ReplacementResult = {
      originalContent: content,
      modifiedContent: content,
      replacements: [],
      violationsFound: 0,
      violationsFixed: 0,
      preservedHierarchy: true,
    }

    let modifiedContent = content

    for (const patternConfig of patterns) {
      // Create a fresh regex for each pattern to avoid lastIndex issues
      const pattern = new RegExp(
        patternConfig.pattern.source,
        patternConfig.pattern.flags
      )
      const matches = Array.from(content.matchAll(pattern))

      for (const match of matches) {
        const fullMatch = match[0]
        const colorValue = fullMatch

        // Skip if already brand compliant
        if (isBrandCompliantColor(colorValue)) {
          continue
        }

        // Skip if this match has already been replaced
        if (!modifiedContent.includes(fullMatch)) {
          continue
        }

        const mapping = this.findBestColorMapping(
          colorValue,
          patternConfig.contextHint
        )

        if (mapping) {
          const lineNumber = this.getLineNumber(content, match.index!)
          const columnNumber =
            match.index! - this.getLineStartIndex(content, match.index!)

          // Validate contrast if this is a text color change
          const contrastValidated = this.validateColorReplacement(
            mapping,
            colorValue
          )

          // Apply the replacement - replace only the first occurrence to avoid double replacements
          const beforeReplacement = modifiedContent
          modifiedContent = modifiedContent.replace(fullMatch, mapping.to)

          // Only count as fixed if replacement actually happened
          if (beforeReplacement !== modifiedContent) {
            result.replacements.push({
              line: lineNumber,
              column: columnNumber,
              originalColor: colorValue,
              replacementColor: mapping.to,
              context: mapping.context,
              description: mapping.description,
              contrastValidated,
            })

            result.violationsFound++
            result.violationsFixed++
          }
        } else {
          result.violationsFound++
        }
      }
    }

    result.modifiedContent = modifiedContent
    return result
  }

  /**
   * Find the best color mapping for a given color and context
   */
  private findBestColorMapping(
    color: string,
    contextHint: ColorMapping['context']
  ): ColorMapping | undefined {
    // Try exact match first
    let mapping =
      getColorMapping(color, 'tailwindClasses') ||
      getColorMapping(color, 'hexColors') ||
      getColorMapping(color, 'cssProperties') ||
      getColorMapping(color, 'chartColors')

    if (mapping) {
      return mapping
    }

    // Try pattern matching for hex colors
    if (color.startsWith('#')) {
      return this.findHexColorMapping(color)
    }

    // Try pattern matching for Tailwind classes
    if (color.includes('blue')) {
      return {
        from: color,
        to: color.replace(/blue-\d+/, 'tm-loyal-blue'),
        context: contextHint,
        preserveOpacity: false,
        description: `Blue color ${color} replaced with TM Loyal Blue`,
      }
    }

    if (color.includes('red')) {
      return {
        from: color,
        to: color.replace(/red-\d+/, 'tm-true-maroon'),
        context: 'error',
        preserveOpacity: false,
        description: `Red color ${color} replaced with TM True Maroon`,
      }
    }

    if (color.includes('green')) {
      return {
        from: color,
        to: color.replace(/green-\d+/, 'tm-loyal-blue'),
        context: 'success',
        preserveOpacity: false,
        description: `Green color ${color} replaced with TM Loyal Blue`,
      }
    }

    if (color.includes('yellow') || color.includes('orange')) {
      return {
        from: color,
        to: color.replace(/(?:yellow|orange)-\d+/, 'tm-happy-yellow'),
        context: 'warning',
        preserveOpacity: false,
        description: `Warning color ${color} replaced with TM Happy Yellow`,
      }
    }

    if (color.includes('gray')) {
      return {
        from: color,
        to: color.replace(/gray-\d+/, 'tm-cool-gray'),
        context: 'neutral',
        preserveOpacity: false,
        description: `Gray color ${color} replaced with TM Cool Gray`,
      }
    }

    return undefined
  }

  /**
   * Find hex color mapping based on color analysis
   */
  private findHexColorMapping(hexColor: string): ColorMapping | undefined {
    const hex = hexColor.toLowerCase()

    // Blue-ish colors
    if (this.isBlueish(hex)) {
      return {
        from: hexColor,
        to: 'var(--tm-loyal-blue)',
        context: 'primary',
        preserveOpacity: false,
        description: `Blue hex color ${hexColor} replaced with TM Loyal Blue`,
      }
    }

    // Red-ish colors
    if (this.isReddish(hex)) {
      return {
        from: hexColor,
        to: 'var(--tm-true-maroon)',
        context: 'error',
        preserveOpacity: false,
        description: `Red hex color ${hexColor} replaced with TM True Maroon`,
      }
    }

    // Green-ish colors (map to loyal blue for success states)
    if (this.isGreenish(hex)) {
      return {
        from: hexColor,
        to: 'var(--tm-loyal-blue)',
        context: 'success',
        preserveOpacity: false,
        description: `Green hex color ${hexColor} mapped to TM Loyal Blue`,
      }
    }

    // Yellow/Orange-ish colors
    if (this.isYellowish(hex) || this.isOrangish(hex)) {
      return {
        from: hexColor,
        to: 'var(--tm-happy-yellow)',
        context: 'warning',
        preserveOpacity: false,
        description: `Yellow/Orange hex color ${hexColor} replaced with TM Happy Yellow`,
      }
    }

    // Gray-ish colors
    if (this.isGrayish(hex)) {
      // Light grays get opacity variants
      if (this.isLightGray(hex)) {
        return {
          from: hexColor,
          to: 'var(--tm-cool-gray-20)',
          context: 'neutral',
          preserveOpacity: true,
          description: `Light gray hex color ${hexColor} replaced with TM Cool Gray with opacity`,
        }
      } else {
        return {
          from: hexColor,
          to: 'var(--tm-cool-gray)',
          context: 'neutral',
          preserveOpacity: false,
          description: `Gray hex color ${hexColor} replaced with TM Cool Gray`,
        }
      }
    }

    // Purple/Pink colors (map to true maroon)
    if (this.isPurplish(hex) || this.isPinkish(hex)) {
      return {
        from: hexColor,
        to: 'var(--tm-true-maroon)',
        context: 'accent',
        preserveOpacity: false,
        description: `Purple/Pink hex color ${hexColor} mapped to TM True Maroon`,
      }
    }

    // Teal/Cyan colors (map to loyal blue)
    if (this.isTealish(hex) || this.isCyanish(hex)) {
      return {
        from: hexColor,
        to: 'var(--tm-loyal-blue)',
        context: 'accent',
        preserveOpacity: false,
        description: `Teal/Cyan hex color ${hexColor} mapped to TM Loyal Blue`,
      }
    }

    return undefined
  }

  /**
   * Color analysis helper methods
   */
  private isBlueish(hex: string): boolean {
    const rgb = this.hexToRgb(hex)
    if (!rgb) return false
    return rgb.b > rgb.r && rgb.b > rgb.g && rgb.b > 100
  }

  private isReddish(hex: string): boolean {
    const rgb = this.hexToRgb(hex)
    if (!rgb) return false
    return rgb.r > rgb.g && rgb.r > rgb.b && rgb.r > 100
  }

  private isGreenish(hex: string): boolean {
    const rgb = this.hexToRgb(hex)
    if (!rgb) return false
    return rgb.g > rgb.r && rgb.g > rgb.b && rgb.g > 100
  }

  private isYellowish(hex: string): boolean {
    const rgb = this.hexToRgb(hex)
    if (!rgb) return false
    return rgb.r > 200 && rgb.g > 200 && rgb.b < 150
  }

  private isOrangish(hex: string): boolean {
    const rgb = this.hexToRgb(hex)
    if (!rgb) return false
    return rgb.r > 200 && rgb.g > 100 && rgb.g < 200 && rgb.b < 100
  }

  private isGrayish(hex: string): boolean {
    const rgb = this.hexToRgb(hex)
    if (!rgb) return false
    const diff = Math.max(rgb.r, rgb.g, rgb.b) - Math.min(rgb.r, rgb.g, rgb.b)
    return diff < 30 // Low color difference indicates gray
  }

  private isLightGray(hex: string): boolean {
    const rgb = this.hexToRgb(hex)
    if (!rgb) return false
    const avg = (rgb.r + rgb.g + rgb.b) / 3
    return avg > 200 // Light colors
  }

  private isPurplish(hex: string): boolean {
    const rgb = this.hexToRgb(hex)
    if (!rgb) return false
    return rgb.r > rgb.g && rgb.b > rgb.g && Math.abs(rgb.r - rgb.b) < 50
  }

  private isPinkish(hex: string): boolean {
    const rgb = this.hexToRgb(hex)
    if (!rgb) return false
    return rgb.r > 200 && rgb.g < 150 && rgb.b > 100 && rgb.b < 200
  }

  private isTealish(hex: string): boolean {
    const rgb = this.hexToRgb(hex)
    if (!rgb) return false
    return rgb.g > rgb.r && rgb.b > rgb.r && Math.abs(rgb.g - rgb.b) < 50
  }

  private isCyanish(hex: string): boolean {
    const rgb = this.hexToRgb(hex)
    if (!rgb) return false
    return rgb.g > 150 && rgb.b > 150 && rgb.r < 100
  }

  /**
   * Convert hex color to RGB
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null
  }

  /**
   * Replace chart color array with brand colors
   */
  private replaceChartColorArray(colorArray: string): string {
    const brandChartColors = [
      'var(--tm-loyal-blue)', // Primary data series
      'var(--tm-true-maroon)', // Secondary data series
      'var(--tm-cool-gray)', // Tertiary data series
      'var(--tm-happy-yellow)', // Accent data series
    ]

    // Extract individual colors from the array
    const colors = colorArray.split(',').map(c => c.trim().replace(/['"]/g, ''))

    // Replace with brand colors, cycling through if more colors needed
    const replacedColors = colors.map((color, index) => {
      if (isBrandCompliantColor(color)) {
        return `'${color}'`
      }

      const brandColor = brandChartColors[index % brandChartColors.length]
      return `'${brandColor}'`
    })

    return replacedColors.join(', ')
  }

  /**
   * Validate color replacement maintains accessibility
   */
  private validateColorReplacement(
    mapping: ColorMapping,
    originalColor: string
  ): boolean {
    // For text colors, validate against white background
    if (mapping.to.includes('text-') || originalColor.includes('text-')) {
      const contrast = validateContrastRatio(mapping.to, 'var(--tm-white)')
      return contrast.wcagAA
    }

    // For background colors, validate against black text
    if (mapping.to.includes('bg-') || originalColor.includes('bg-')) {
      const contrast = validateContrastRatio('var(--tm-black)', mapping.to)
      return contrast.wcagAA
    }

    // Default to true for border and other properties
    return true
  }

  /**
   * Get line number for a given character index
   */
  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length
  }

  /**
   * Get the start index of the line containing the given index
   */
  private getLineStartIndex(content: string, index: number): number {
    const beforeIndex = content.substring(0, index)
    const lastNewlineIndex = beforeIndex.lastIndexOf('\n')
    return lastNewlineIndex === -1 ? 0 : lastNewlineIndex + 1
  }

  /**
   * Validate color contrast meets WCAG AA requirements
   */
  validateColorContrast(foreground: string, background: string): boolean {
    const contrast = validateContrastRatio(foreground, background)
    return contrast.wcagAA
  }

  /**
   * Get replacement statistics
   */
  getReplacementStats(result: ReplacementResult): {
    totalViolations: number
    fixedViolations: number
    complianceRate: number
    contextBreakdown: Record<string, number>
  } {
    const contextBreakdown: Record<string, number> = {}

    result.replacements.forEach(replacement => {
      contextBreakdown[replacement.context] =
        (contextBreakdown[replacement.context] || 0) + 1
    })

    return {
      totalViolations: result.violationsFound,
      fixedViolations: result.violationsFixed,
      complianceRate:
        result.violationsFound > 0
          ? (result.violationsFixed / result.violationsFound) * 100
          : 100,
      contextBreakdown,
    }
  }
}

/**
 * Default instance for easy importing
 */
export const colorReplacementEngine = new ColorReplacementEngine()

/**
 * Utility function to replace blue colors in content
 */
export async function replaceBlueColors(
  content: string
): Promise<ReplacementResult> {
  return colorReplacementEngine.replaceBlueColors(content)
}

/**
 * Utility function to replace hex colors in content
 */
export async function replaceHexColors(
  content: string
): Promise<ReplacementResult> {
  return colorReplacementEngine.replaceHexColors(content)
}

/**
 * Utility function to replace chart colors in content
 */
export async function replaceChartColors(
  content: string
): Promise<ReplacementResult> {
  return colorReplacementEngine.replaceChartColors(content)
}

/**
 * Utility function to replace all color violations in content
 */
export async function replaceAllColors(
  content: string
): Promise<ReplacementResult> {
  return colorReplacementEngine.replaceAllColors(content)
}
