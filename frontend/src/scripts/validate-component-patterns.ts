#!/usr/bin/env tsx

/**
 * Component Styling Patterns Validation Script
 *
 * This script validates that all components maintain TM brand-compliant styling patterns
 * after the removal of the brand compliance monitoring system.
 *
 * Requirements validated:
 * - 4.3: Component styling patterns are preserved (buttons, forms, navigation, touch targets)
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, extname } from 'path'

// Expected component pattern usage
const COMPONENT_PATTERN_CHECKS = [
  // Button component patterns
  {
    name: 'Button Components',
    filePattern: /Button|button/,
    requiredPatterns: [
      /tm-btn-(primary|secondary)/g,
      /min-(height|width):\s*(44px|var\(--tm-touch-target\))/g,
      /var\(--tm-loyal-blue\)/g,
    ],
    description:
      'Buttons should use TM button classes and meet touch target requirements',
  },

  // Form component patterns
  {
    name: 'Form Components',
    filePattern: /Form|Input|Select|Textarea/i,
    requiredPatterns: [
      /min-height:\s*(44px|var\(--tm-touch-target\))/g,
      /font-tm-(body|headline)/g,
    ],
    description:
      'Form elements should meet touch target requirements and use TM typography',
  },

  // Navigation component patterns
  {
    name: 'Navigation Components',
    filePattern: /Nav|Header|Menu/i,
    requiredPatterns: [
      /var\(--tm-loyal-blue\)/g,
      /font-tm-headline/g,
      /min-height:\s*(44px|var\(--tm-touch-target\))/g,
    ],
    description:
      'Navigation should use TM colors, typography, and touch targets',
  },

  // Chart component patterns
  {
    name: 'Chart Components',
    filePattern: /Chart/,
    requiredPatterns: [
      /var\(--tm-(loyal-blue|true-maroon|cool-gray|happy-yellow)\)/g,
      /tm-brand-compliant/g,
    ],
    description: 'Charts should use TM brand colors and compliance markers',
  },
]

// Accessibility and touch target patterns
const ACCESSIBILITY_PATTERNS = [
  // Touch target requirements
  /min-(height|width):\s*(44px|var\(--tm-touch-target\))/g,

  // Focus indicators
  /focus:(outline|ring)/g,

  // ARIA attributes
  /aria-(label|describedby|expanded|hidden)/g,

  // Role attributes
  /role=["'](button|link|navigation|menu)/g,
]

// Prohibited patterns that violate brand compliance
const PROHIBITED_PATTERNS = [
  // Non-brand button styles
  {
    pattern: /bg-(blue|red|green|yellow)-\d+/g,
    message: 'Use TM brand colors instead of generic Tailwind colors',
  },

  // Small touch targets
  {
    pattern: /min-(height|width):\s*([1-3]\d|[0-9])px/g,
    message: 'Touch targets must be at least 44px',
  },

  // Non-brand fonts
  {
    pattern: /font-(sans|serif|mono)(?!\s*,)/g,
    message: 'Use TM typography classes (font-tm-headline, font-tm-body)',
  },
]

interface ComponentPatternResult {
  file: string
  componentType: string
  patternsFound: string[]
  accessibilityFeatures: string[]
  prohibitedPatterns: string[]
  isCompliant: boolean
  issues: string[]
  recommendations: string[]
}

interface ComponentPatternSummary {
  totalFiles: number
  compliantFiles: number
  filesWithIssues: number
  componentTypes: Record<string, number>
  totalPatternUsages: number
  totalAccessibilityFeatures: number
  results: ComponentPatternResult[]
}

/**
 * Recursively get all component files
 */
function getComponentFiles(
  dir: string,
  extensions = ['.tsx', '.ts']
): string[] {
  const files: string[] = []

  try {
    const items = readdirSync(dir)

    for (const item of items) {
      const fullPath = join(dir, item)
      const stat = statSync(fullPath)

      if (stat.isDirectory()) {
        if (
          !item.startsWith('.') &&
          item !== 'node_modules' &&
          item !== 'dist'
        ) {
          files.push(...getComponentFiles(fullPath, extensions))
        }
      } else if (extensions.includes(extname(item))) {
        files.push(fullPath)
      }
    }
  } catch (error) {
    console.warn(`Warning: Could not read directory ${dir}:`, error)
  }

  return files
}

/**
 * Determine component type from file path and content
 */
function determineComponentType(filePath: string, content: string): string {
  const fileName = filePath.split('/').pop() || ''

  if (fileName.includes('Button') || content.includes('button')) return 'Button'
  if (fileName.includes('Form') || fileName.includes('Input')) return 'Form'
  if (fileName.includes('Nav') || fileName.includes('Header'))
    return 'Navigation'
  if (fileName.includes('Chart')) return 'Chart'
  if (fileName.includes('Modal') || fileName.includes('Dialog')) return 'Modal'
  if (fileName.includes('Table')) return 'Table'
  if (fileName.includes('Card')) return 'Card'

  return 'Other'
}

/**
 * Validate component styling patterns in a single file
 */
function validateComponentFile(filePath: string): ComponentPatternResult {
  const content = readFileSync(filePath, 'utf-8')
  const componentType = determineComponentType(filePath, content)

  const result: ComponentPatternResult = {
    file: filePath,
    componentType,
    patternsFound: [],
    accessibilityFeatures: [],
    prohibitedPatterns: [],
    isCompliant: true,
    issues: [],
    recommendations: [],
  }

  // Check for required component patterns
  const relevantChecks = COMPONENT_PATTERN_CHECKS.filter(
    check => check.filePattern.test(filePath) || check.filePattern.test(content)
  )

  for (const check of relevantChecks) {
    let hasRequiredPatterns = false

    for (const pattern of check.requiredPatterns) {
      const matches = content.match(pattern)
      if (matches) {
        result.patternsFound.push(...matches)
        hasRequiredPatterns = true
      }
    }

    if (!hasRequiredPatterns && relevantChecks.length > 0) {
      result.issues.push(`${check.name}: ${check.description}`)
      result.isCompliant = false
    }
  }

  // Check for accessibility features
  for (const pattern of ACCESSIBILITY_PATTERNS) {
    const matches = content.match(pattern)
    if (matches) {
      result.accessibilityFeatures.push(...matches)
    }
  }

  // Check for prohibited patterns
  for (const prohibited of PROHIBITED_PATTERNS) {
    const matches = content.match(prohibited.pattern)
    if (matches) {
      result.prohibitedPatterns.push(...matches)
      result.issues.push(`${prohibited.message}: ${matches.join(', ')}`)
      result.isCompliant = false
    }
  }

  // Specific validations by component type
  switch (componentType) {
    case 'Button':
      if (!content.includes('tm-btn-') && !content.includes('min-height')) {
        result.issues.push(
          'Button component should use TM button classes or touch target sizing'
        )
        result.isCompliant = false
      }
      break

    case 'Form':
      if (!content.includes('min-height') && !content.includes('44px')) {
        result.recommendations.push(
          'Form elements should meet 44px touch target requirement'
        )
      }
      break

    case 'Navigation':
      if (!content.includes('tm-loyal-blue') && !content.includes('tm-nav')) {
        result.recommendations.push(
          'Navigation should use TM brand colors and navigation classes'
        )
      }
      break

    case 'Chart':
      if (!content.includes('tm-') && !content.includes('var(--tm-')) {
        result.issues.push('Chart component should use TM brand colors')
        result.isCompliant = false
      }
      break
  }

  // Touch target validation for interactive elements
  const interactiveElements = content.match(
    /(button|input|select|textarea|a\s+|role=["']button)/gi
  )
  if (
    interactiveElements &&
    !content.includes('44px') &&
    !content.includes('tm-touch-target')
  ) {
    result.recommendations.push(
      'Interactive elements should meet 44px touch target requirement'
    )
  }

  return result
}

/**
 * Validate all component files for styling patterns
 */
function validateComponentPatterns(): ComponentPatternSummary {
  console.log('🎨 Validating TM Component Styling Patterns...\n')

  // Get all component files
  const componentDirs = ['src/components', 'src/pages']

  const allFiles: string[] = []
  for (const dir of componentDirs) {
    try {
      allFiles.push(...getComponentFiles(dir))
    } catch {
      console.warn(`Warning: Could not scan directory ${dir}`)
    }
  }

  console.log(
    `📁 Scanning ${allFiles.length} component files for styling patterns...\n`
  )

  // Validate each file
  const results: ComponentPatternResult[] = []
  const componentTypes: Record<string, number> = {}
  let totalPatternUsages = 0
  let totalAccessibilityFeatures = 0

  for (const file of allFiles) {
    const result = validateComponentFile(file)
    results.push(result)

    // Count component types
    componentTypes[result.componentType] =
      (componentTypes[result.componentType] || 0) + 1

    totalPatternUsages += result.patternsFound.length
    totalAccessibilityFeatures += result.accessibilityFeatures.length
  }

  const compliantFiles = results.filter(r => r.isCompliant).length
  const filesWithIssues = results.filter(r => !r.isCompliant).length

  return {
    totalFiles: allFiles.length,
    compliantFiles,
    filesWithIssues,
    componentTypes,
    totalPatternUsages,
    totalAccessibilityFeatures,
    results,
  }
}

/**
 * Generate component patterns validation report
 */
function generateComponentPatternsReport(
  summary: ComponentPatternSummary
): void {
  console.log('📊 COMPONENT STYLING PATTERNS REPORT')
  console.log('===================================\n')

  // Summary statistics
  console.log('📈 Summary:')
  console.log(`   Total files scanned: ${summary.totalFiles}`)
  console.log(
    `   Compliant files: ${summary.compliantFiles} (${Math.round((summary.compliantFiles / summary.totalFiles) * 100)}%)`
  )
  console.log(`   Files with issues: ${summary.filesWithIssues}`)
  console.log(`   Total pattern usages: ${summary.totalPatternUsages}`)
  console.log(
    `   Accessibility features: ${summary.totalAccessibilityFeatures}\n`
  )

  // Compliance status
  const isFullyCompliant = summary.filesWithIssues === 0
  console.log(
    `🎯 Overall Compliance: ${isFullyCompliant ? '✅ PASS' : '❌ FAIL'}\n`
  )

  // Component type breakdown
  console.log('🧩 Component Types:')
  for (const [type, count] of Object.entries(summary.componentTypes)) {
    const typeResults = summary.results.filter(r => r.componentType === type)
    const compliantCount = typeResults.filter(r => r.isCompliant).length
    const complianceRate = Math.round((compliantCount / count) * 100)
    console.log(
      `   ${type}: ${count} files (${compliantCount}/${count} compliant - ${complianceRate}%)`
    )
  }
  console.log()

  // Files with good patterns (good)
  const filesWithPatterns = summary.results.filter(
    r => r.patternsFound.length > 0
  )
  if (filesWithPatterns.length > 0) {
    console.log('✅ Files using TM component patterns:')
    for (const result of filesWithPatterns.slice(0, 10)) {
      console.log(
        `   ${result.file.replace('src/', '')} (${result.componentType}, ${result.patternsFound.length} patterns)`
      )
    }
    if (filesWithPatterns.length > 10) {
      console.log(`   ... and ${filesWithPatterns.length - 10} more files`)
    }
    console.log()
  }

  // Files with issues (bad)
  const filesWithIssues = summary.results.filter(r => !r.isCompliant)
  if (filesWithIssues.length > 0) {
    console.log('❌ Files with component pattern issues:')
    for (const result of filesWithIssues) {
      console.log(
        `   ${result.file.replace('src/', '')} (${result.componentType}):`
      )
      for (const issue of result.issues) {
        console.log(`     - ${issue}`)
      }
    }
    console.log()
  }

  // Accessibility analysis
  const filesWithA11y = summary.results.filter(
    r => r.accessibilityFeatures.length > 0
  )
  console.log('♿ Accessibility Features:')
  console.log(
    `   Files with accessibility features: ${filesWithA11y.length}/${summary.totalFiles} (${Math.round((filesWithA11y.length / summary.totalFiles) * 100)}%)`
  )

  // Touch target analysis
  const filesWithTouchTargets = summary.results.filter(r =>
    r.patternsFound.some(
      pattern => pattern.includes('44px') || pattern.includes('touch-target')
    )
  )
  console.log(
    `   Files with proper touch targets: ${filesWithTouchTargets.length}/${summary.totalFiles} (${Math.round((filesWithTouchTargets.length / summary.totalFiles) * 100)}%)`
  )
  console.log()

  // Recommendations
  console.log('💡 Recommendations:')

  const filesWithRecommendations = summary.results.filter(
    r => r.recommendations.length > 0
  )
  if (filesWithRecommendations.length > 0) {
    console.log('   Component-specific recommendations:')
    for (const result of filesWithRecommendations.slice(0, 5)) {
      console.log(
        `   - ${result.file.replace('src/', '')}: ${result.recommendations[0]}`
      )
    }
  }

  if (summary.totalPatternUsages === 0) {
    console.log('   - Ensure components use TM styling patterns and classes')
  } else {
    console.log('   - Component pattern usage looks good! ✅')
  }

  if (summary.totalAccessibilityFeatures < summary.totalFiles * 0.5) {
    console.log(
      '   - Consider adding more accessibility features (ARIA labels, focus indicators)'
    )
  }

  console.log('\n🎨 Component styling patterns validation complete!')

  // Exit with error code if not compliant
  if (!isFullyCompliant) {
    process.exit(1)
  }
}

/**
 * Main execution
 */
function main(): void {
  try {
    const summary = validateComponentPatterns()
    generateComponentPatternsReport(summary)
  } catch (error) {
    console.error('❌ Component patterns validation failed:', error)
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { validateComponentPatterns, generateComponentPatternsReport }
