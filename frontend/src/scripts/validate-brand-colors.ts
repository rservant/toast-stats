#!/usr/bin/env tsx

/**
 * Brand Color Validation Script
 *
 * This script validates that all components maintain TM brand color compliance
 * after the removal of the brand compliance monitoring system.
 *
 * Requirements validated:
 * - 4.1: TM brand colors are preserved in components
 * - 4.4: Chart components maintain brand color usage
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, extname } from 'path'

// Expected brand color patterns in code
const BRAND_COLOR_PATTERNS = [
  // CSS custom property usage
  /var\(--tm-(loyal-blue|true-maroon|cool-gray|happy-yellow|black|white)(-\d+)?\)/g,

  // Tailwind class usage
  /(?:text-|bg-|border-)tm-(loyal-blue|true-maroon|cool-gray|happy-yellow|black|white)/g,

  // Direct hex color usage (should be minimal)
  /#(004165|772432|A9B2B1|F2DF74|000000|FFFFFF)/gi,
]

// Non-brand colors that should NOT be found (common violations)
const PROHIBITED_COLORS = [
  // Common non-brand blues
  /#0066cc/gi,
  /#007bff/gi,
  /#1e40af/gi,
  /#3b82f6/gi,

  // Common non-brand reds
  /#dc2626/gi,
  /#ef4444/gi,
  /#f87171/gi,
  /#dc3545/gi,

  // Common non-brand grays (except very light/dark ones)
  /#6b7280/gi,
  /#9ca3af/gi,
  /#d1d5db/gi,
  /#e5e7eb/gi,

  // Common non-brand yellows
  /#fbbf24/gi,
  /#f59e0b/gi,
  /#d97706/gi,
]

interface ValidationResult {
  file: string
  brandColorsFound: string[]
  prohibitedColorsFound: string[]
  hasDesignTokens: boolean
  isCompliant: boolean
  issues: string[]
}

interface ValidationSummary {
  totalFiles: number
  compliantFiles: number
  filesWithIssues: number
  totalBrandColorUsages: number
  totalProhibitedColors: number
  results: ValidationResult[]
}

/**
 * Recursively get all TypeScript/TSX files in a directory
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
        // Skip node_modules and other non-source directories
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
 * Validate brand color usage in a single file
 */
function validateFile(filePath: string): ValidationResult {
  const content = readFileSync(filePath, 'utf-8')
  const result: ValidationResult = {
    file: filePath,
    brandColorsFound: [],
    prohibitedColorsFound: [],
    hasDesignTokens: false,
    isCompliant: true,
    issues: [],
  }

  // Check for brand color usage
  for (const pattern of BRAND_COLOR_PATTERNS) {
    const matches = content.match(pattern)
    if (matches) {
      result.brandColorsFound.push(...matches)
      result.hasDesignTokens = true
    }
  }

  // Check for prohibited colors
  for (const pattern of PROHIBITED_COLORS) {
    const matches = content.match(pattern)
    if (matches) {
      result.prohibitedColorsFound.push(...matches)
      result.isCompliant = false
      result.issues.push(`Found prohibited color(s): ${matches.join(', ')}`)
    }
  }

  // Check for hardcoded brand colors (should use CSS custom properties instead)
  const hardcodedBrandColors = content.match(/#(004165|772432|A9B2B1|F2DF74)/gi)
  if (hardcodedBrandColors) {
    result.issues.push(
      `Found hardcoded brand colors (should use CSS custom properties): ${hardcodedBrandColors.join(', ')}`
    )
  }

  // Special validation for chart components
  if (filePath.includes('Chart') || filePath.includes('chart')) {
    if (!result.hasDesignTokens) {
      result.issues.push(
        'Chart component should use TM brand colors via CSS custom properties'
      )
      result.isCompliant = false
    }
  }

  // Update compliance status
  if (result.issues.length > 0) {
    result.isCompliant = false
  }

  return result
}

/**
 * Validate all component files for brand color compliance
 */
function validateBrandColors(): ValidationSummary {
  console.log('🎨 Validating TM Brand Color Compliance...\n')

  // Get all component files
  const componentDirs = ['src/components', 'src/pages', 'src/styles']

  const allFiles: string[] = []
  for (const dir of componentDirs) {
    try {
      allFiles.push(...getComponentFiles(dir))
    } catch {
      console.warn(`Warning: Could not scan directory ${dir}`)
    }
  }

  console.log(`📁 Scanning ${allFiles.length} files for brand color usage...\n`)

  // Validate each file
  const results: ValidationResult[] = []
  let totalBrandColorUsages = 0
  let totalProhibitedColors = 0

  for (const file of allFiles) {
    const result = validateFile(file)
    results.push(result)

    totalBrandColorUsages += result.brandColorsFound.length
    totalProhibitedColors += result.prohibitedColorsFound.length
  }

  const compliantFiles = results.filter(r => r.isCompliant).length
  const filesWithIssues = results.filter(r => !r.isCompliant).length

  return {
    totalFiles: allFiles.length,
    compliantFiles,
    filesWithIssues,
    totalBrandColorUsages,
    totalProhibitedColors,
    results,
  }
}

/**
 * Generate validation report
 */
function generateReport(summary: ValidationSummary): void {
  console.log('📊 BRAND COLOR VALIDATION REPORT')
  console.log('================================\n')

  // Summary statistics
  console.log('📈 Summary:')
  console.log(`   Total files scanned: ${summary.totalFiles}`)
  console.log(
    `   Compliant files: ${summary.compliantFiles} (${Math.round((summary.compliantFiles / summary.totalFiles) * 100)}%)`
  )
  console.log(`   Files with issues: ${summary.filesWithIssues}`)
  console.log(`   Total brand color usages: ${summary.totalBrandColorUsages}`)
  console.log(`   Prohibited colors found: ${summary.totalProhibitedColors}\n`)

  // Compliance status
  const isFullyCompliant = summary.filesWithIssues === 0
  console.log(
    `🎯 Overall Compliance: ${isFullyCompliant ? '✅ PASS' : '❌ FAIL'}\n`
  )

  // Files with brand color usage (good)
  const filesWithBrandColors = summary.results.filter(
    r => r.brandColorsFound.length > 0
  )
  if (filesWithBrandColors.length > 0) {
    console.log('✅ Files using TM brand colors:')
    for (const result of filesWithBrandColors.slice(0, 10)) {
      // Show first 10
      console.log(
        `   ${result.file.replace('src/', '')} (${result.brandColorsFound.length} usages)`
      )
    }
    if (filesWithBrandColors.length > 10) {
      console.log(`   ... and ${filesWithBrandColors.length - 10} more files`)
    }
    console.log()
  }

  // Files with issues (bad)
  const filesWithIssues = summary.results.filter(r => !r.isCompliant)
  if (filesWithIssues.length > 0) {
    console.log('❌ Files with brand compliance issues:')
    for (const result of filesWithIssues) {
      console.log(`   ${result.file.replace('src/', '')}:`)
      for (const issue of result.issues) {
        console.log(`     - ${issue}`)
      }
    }
    console.log()
  }

  // Chart component specific validation
  const chartFiles = summary.results.filter(
    r => r.file.includes('Chart') || r.file.includes('chart')
  )
  if (chartFiles.length > 0) {
    console.log('📊 Chart Component Validation:')
    for (const result of chartFiles) {
      const status = result.isCompliant ? '✅' : '❌'
      const brandColorCount = result.brandColorsFound.length
      console.log(
        `   ${status} ${result.file.replace('src/', '')} (${brandColorCount} brand colors)`
      )
    }
    console.log()
  }

  // Recommendations
  console.log('💡 Recommendations:')
  if (summary.totalProhibitedColors > 0) {
    console.log('   - Replace prohibited colors with TM brand colors')
  }
  if (summary.totalBrandColorUsages === 0) {
    console.log(
      '   - Ensure components use TM brand colors via CSS custom properties'
    )
  } else {
    console.log('   - Brand color usage looks good! ✅')
  }

  const hardcodedColors = summary.results.some(r =>
    r.issues.some(issue => issue.includes('hardcoded'))
  )
  if (hardcodedColors) {
    console.log(
      '   - Replace hardcoded hex colors with CSS custom properties (var(--tm-*))'
    )
  }

  console.log('\n🎨 Brand color validation complete!')

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
    const summary = validateBrandColors()
    generateReport(summary)
  } catch (error) {
    console.error('❌ Brand color validation failed:', error)
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { validateBrandColors, generateReport }
