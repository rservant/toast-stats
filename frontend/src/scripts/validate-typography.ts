#!/usr/bin/env tsx

/**
 * Typography Validation Script
 *
 * This script validates that all components maintain TM typography compliance
 * after the removal of the brand compliance monitoring system.
 *
 * Requirements validated:
 * - 4.2: Typography compliance is maintained (Montserrat and Source Sans 3)
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, extname } from 'path'

// Expected typography patterns in code
const TYPOGRAPHY_PATTERNS = [
  // CSS custom property usage
  /var\(--tm-font-(headline|body)\)/g,

  // Tailwind class usage
  /font-tm-(headline|body)/g,

  // CSS class usage
  /\.tm-(headline|body|h[1-6]|nav|body-large|body-medium|body-small|caption)/g,

  // Direct font family usage (should be minimal)
  /font-family:\s*["']?(Montserrat|Source Sans 3)/gi,
]

// Non-brand fonts that should NOT be found (common violations)
const PROHIBITED_FONTS = [
  // Common system fonts used directly (should use fallback stack)
  /font-family:\s*["']?(Arial|Helvetica|Times|Georgia|Verdana|Tahoma)["']?(?!\s*,)/gi,

  // Other common web fonts
  /font-family:\s*["']?(Roboto|Open Sans|Lato|Poppins|Inter)["']?/gi,

  // Font size violations (less than 14px)
  /font-size:\s*(1[0-3]px|[0-9]px)/gi,
]

interface TypographyValidationResult {
  file: string
  typographyFound: string[]
  prohibitedFontsFound: string[]
  hasTypographyTokens: boolean
  hasMinimumFontSize: boolean
  isCompliant: boolean
  issues: string[]
}

interface TypographyValidationSummary {
  totalFiles: number
  compliantFiles: number
  filesWithIssues: number
  totalTypographyUsages: number
  totalProhibitedFonts: number
  results: TypographyValidationResult[]
}

/**
 * Recursively get all TypeScript/TSX/CSS files in a directory
 */
function getTypographyFiles(
  dir: string,
  extensions = ['.tsx', '.ts', '.css']
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
          files.push(...getTypographyFiles(fullPath, extensions))
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
 * Validate typography usage in a single file
 */
function validateFile(filePath: string): TypographyValidationResult {
  const content = readFileSync(filePath, 'utf-8')
  const result: TypographyValidationResult = {
    file: filePath,
    typographyFound: [],
    prohibitedFontsFound: [],
    hasTypographyTokens: false,
    hasMinimumFontSize: true,
    isCompliant: true,
    issues: [],
  }

  // Check for typography usage
  for (const pattern of TYPOGRAPHY_PATTERNS) {
    const matches = content.match(pattern)
    if (matches) {
      result.typographyFound.push(...matches)
      result.hasTypographyTokens = true
    }
  }

  // Check for prohibited fonts
  for (const pattern of PROHIBITED_FONTS) {
    const matches = content.match(pattern)
    if (matches) {
      result.prohibitedFontsFound.push(...matches)
      result.isCompliant = false
      result.issues.push(`Found prohibited font usage: ${matches.join(', ')}`)
    }
  }

  // Check for minimum font size violations
  const fontSizeViolations = content.match(/font-size:\s*(1[0-3]px|[0-9]px)/gi)
  if (fontSizeViolations) {
    result.hasMinimumFontSize = false
    result.isCompliant = false
    result.issues.push(
      `Font size below 14px minimum: ${fontSizeViolations.join(', ')}`
    )
  }

  // Check for line height violations
  const lineHeightViolations = content.match(
    /line-height:\s*(1\.[0-3]|0\.\d+)/gi
  )
  if (lineHeightViolations) {
    result.isCompliant = false
    result.issues.push(
      `Line height below 1.4 minimum: ${lineHeightViolations.join(', ')}`
    )
  }

  // Check for hardcoded font families (should use CSS custom properties)
  const hardcodedFonts = content.match(
    /font-family:\s*["']?(Montserrat|Source Sans 3)["']?(?!\s*,)/gi
  )
  if (hardcodedFonts) {
    result.issues.push(
      `Found hardcoded font families (should use CSS custom properties): ${hardcodedFonts.join(', ')}`
    )
  }

  // Special validation for component files
  if (filePath.includes('.tsx') || filePath.includes('.ts')) {
    // Check for proper Tailwind typography classes
    const tailwindTypographyClasses = content.match(
      /className.*font-tm-(headline|body)/g
    )
    if (tailwindTypographyClasses) {
      result.hasTypographyTokens = true
    }
  }

  // Update compliance status
  if (result.issues.length > 0) {
    result.isCompliant = false
  }

  return result
}

/**
 * Validate all files for typography compliance
 */
function validateTypography(): TypographyValidationSummary {
  console.log('📝 Validating TM Typography Compliance...\n')

  // Get all relevant files
  const typographyDirs = ['src/components', 'src/pages', 'src/styles']

  const allFiles: string[] = []
  for (const dir of typographyDirs) {
    try {
      allFiles.push(...getTypographyFiles(dir))
    } catch {
      console.warn(`Warning: Could not scan directory ${dir}`)
    }
  }

  console.log(`📁 Scanning ${allFiles.length} files for typography usage...\n`)

  // Validate each file
  const results: TypographyValidationResult[] = []
  let totalTypographyUsages = 0
  let totalProhibitedFonts = 0

  for (const file of allFiles) {
    const result = validateFile(file)
    results.push(result)

    totalTypographyUsages += result.typographyFound.length
    totalProhibitedFonts += result.prohibitedFontsFound.length
  }

  const compliantFiles = results.filter(r => r.isCompliant).length
  const filesWithIssues = results.filter(r => !r.isCompliant).length

  return {
    totalFiles: allFiles.length,
    compliantFiles,
    filesWithIssues,
    totalTypographyUsages,
    totalProhibitedFonts,
    results,
  }
}

/**
 * Generate typography validation report
 */
function generateTypographyReport(summary: TypographyValidationSummary): void {
  console.log('📊 TYPOGRAPHY VALIDATION REPORT')
  console.log('===============================\n')

  // Summary statistics
  console.log('📈 Summary:')
  console.log(`   Total files scanned: ${summary.totalFiles}`)
  console.log(
    `   Compliant files: ${summary.compliantFiles} (${Math.round((summary.compliantFiles / summary.totalFiles) * 100)}%)`
  )
  console.log(`   Files with issues: ${summary.filesWithIssues}`)
  console.log(`   Total typography usages: ${summary.totalTypographyUsages}`)
  console.log(`   Prohibited fonts found: ${summary.totalProhibitedFonts}\n`)

  // Compliance status
  const isFullyCompliant = summary.filesWithIssues === 0
  console.log(
    `🎯 Overall Compliance: ${isFullyCompliant ? '✅ PASS' : '❌ FAIL'}\n`
  )

  // Files with typography usage (good)
  const filesWithTypography = summary.results.filter(
    r => r.typographyFound.length > 0
  )
  if (filesWithTypography.length > 0) {
    console.log('✅ Files using TM typography:')
    for (const result of filesWithTypography.slice(0, 10)) {
      // Show first 10
      console.log(
        `   ${result.file.replace('src/', '')} (${result.typographyFound.length} usages)`
      )
    }
    if (filesWithTypography.length > 10) {
      console.log(`   ... and ${filesWithTypography.length - 10} more files`)
    }
    console.log()
  }

  // Files with issues (bad)
  const filesWithIssues = summary.results.filter(r => !r.isCompliant)
  if (filesWithIssues.length > 0) {
    console.log('❌ Files with typography compliance issues:')
    for (const result of filesWithIssues) {
      console.log(`   ${result.file.replace('src/', '')}:`)
      for (const issue of result.issues) {
        console.log(`     - ${issue}`)
      }
    }
    console.log()
  }

  // Typography token usage analysis
  const filesWithTokens = summary.results.filter(r => r.hasTypographyTokens)
  console.log('📝 Typography Token Usage:')
  console.log(
    `   Files using typography tokens: ${filesWithTokens.length}/${summary.totalFiles} (${Math.round((filesWithTokens.length / summary.totalFiles) * 100)}%)`
  )

  // Font compliance analysis
  const montserratUsage = summary.results.filter(r =>
    r.typographyFound.some(
      usage => usage.includes('headline') || usage.includes('Montserrat')
    )
  ).length
  const sourceSansUsage = summary.results.filter(r =>
    r.typographyFound.some(
      usage => usage.includes('body') || usage.includes('Source Sans')
    )
  ).length

  console.log(`   Montserrat (headline) usage: ${montserratUsage} files`)
  console.log(`   Source Sans 3 (body) usage: ${sourceSansUsage} files`)
  console.log()

  // Minimum requirements compliance
  const filesWithMinFontSize = summary.results.filter(
    r => r.hasMinimumFontSize
  ).length
  console.log('📏 Minimum Requirements:')
  console.log(
    `   Files meeting 14px minimum: ${filesWithMinFontSize}/${summary.totalFiles} (${Math.round((filesWithMinFontSize / summary.totalFiles) * 100)}%)`
  )
  console.log()

  // Recommendations
  console.log('💡 Recommendations:')
  if (summary.totalProhibitedFonts > 0) {
    console.log('   - Replace prohibited fonts with TM typography system')
  }
  if (summary.totalTypographyUsages === 0) {
    console.log(
      '   - Ensure components use TM typography via CSS custom properties'
    )
  } else {
    console.log('   - Typography usage looks good! ✅')
  }

  const hardcodedFonts = summary.results.some(r =>
    r.issues.some(issue => issue.includes('hardcoded'))
  )
  if (hardcodedFonts) {
    console.log(
      '   - Replace hardcoded font families with CSS custom properties (var(--tm-font-*))'
    )
  }

  const fontSizeIssues = summary.results.some(r => !r.hasMinimumFontSize)
  if (fontSizeIssues) {
    console.log('   - Ensure all text meets 14px minimum font size requirement')
  }

  console.log('\n📝 Typography validation complete!')

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
    const summary = validateTypography()
    generateTypographyReport(summary)
  } catch (error) {
    console.error('❌ Typography validation failed:', error)
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { validateTypography, generateTypographyReport }
