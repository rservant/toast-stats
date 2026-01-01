#!/usr/bin/env tsx

/**
 * Brand Compliance Preservation Validation Script
 *
 * This script validates that all brand compliance improvements are preserved
 * after the removal of the brand compliance monitoring system.
 *
 * This is the main validation script that orchestrates all brand compliance checks.
 */

import { validateBrandColors } from './validate-brand-colors.js'
import { validateTypography } from './validate-typography.js'
import { validateComponentPatterns } from './validate-component-patterns.js'

interface ComprehensiveValidationResult {
  brandColors: {
    passed: boolean
    totalFiles: number
    compliantFiles: number
    issues: number
  }
  typography: {
    passed: boolean
    totalFiles: number
    compliantFiles: number
    issues: number
  }
  componentPatterns: {
    passed: boolean
    totalFiles: number
    compliantFiles: number
    issues: number
  }
  overallCompliance: boolean
  summary: string
}

/**
 * Run comprehensive brand compliance validation
 */
async function validateBrandCompliancePreservation(): Promise<ComprehensiveValidationResult> {
  console.log('🎨 COMPREHENSIVE BRAND COMPLIANCE VALIDATION')
  console.log('===========================================\n')

  const result: ComprehensiveValidationResult = {
    brandColors: { passed: false, totalFiles: 0, compliantFiles: 0, issues: 0 },
    typography: { passed: false, totalFiles: 0, compliantFiles: 0, issues: 0 },
    componentPatterns: {
      passed: false,
      totalFiles: 0,
      compliantFiles: 0,
      issues: 0,
    },
    overallCompliance: false,
    summary: '',
  }

  try {
    // 1. Validate Brand Colors
    console.log('🎨 Step 1: Brand Color Validation')
    console.log('================================\n')

    const brandColorSummary = validateBrandColors()
    result.brandColors = {
      passed: brandColorSummary.filesWithIssues === 0,
      totalFiles: brandColorSummary.totalFiles,
      compliantFiles: brandColorSummary.compliantFiles,
      issues: brandColorSummary.filesWithIssues,
    }

    console.log('\n' + '='.repeat(50) + '\n')

    // 2. Validate Typography
    console.log('📝 Step 2: Typography Validation')
    console.log('===============================\n')

    const typographySummary = validateTypography()
    result.typography = {
      passed: typographySummary.filesWithIssues === 0,
      totalFiles: typographySummary.totalFiles,
      compliantFiles: typographySummary.compliantFiles,
      issues: typographySummary.filesWithIssues,
    }

    console.log('\n' + '='.repeat(50) + '\n')

    // 3. Validate Component Patterns
    console.log('🧩 Step 3: Component Pattern Validation')
    console.log('=====================================\n')

    const componentPatternSummary = validateComponentPatterns()
    result.componentPatterns = {
      passed: componentPatternSummary.filesWithIssues === 0,
      totalFiles: componentPatternSummary.totalFiles,
      compliantFiles: componentPatternSummary.compliantFiles,
      issues: componentPatternSummary.filesWithIssues,
    }

    console.log('\n' + '='.repeat(50) + '\n')
  } catch (error) {
    console.error('❌ Validation process failed:', error)
    result.summary = 'Validation process encountered errors'
    return result
  }

  // Calculate overall compliance
  result.overallCompliance =
    result.brandColors.passed &&
    result.typography.passed &&
    result.componentPatterns.passed

  // Generate comprehensive summary
  generateComprehensiveSummary(result)

  return result
}

/**
 * Generate comprehensive validation summary
 */
function generateComprehensiveSummary(
  result: ComprehensiveValidationResult
): void {
  console.log('📊 COMPREHENSIVE VALIDATION SUMMARY')
  console.log('==================================\n')

  // Overall status
  const overallStatus = result.overallCompliance ? '✅ PASS' : '❌ FAIL'
  console.log(`🎯 Overall Brand Compliance: ${overallStatus}\n`)

  // Individual validation results
  console.log('📈 Validation Results:')

  const brandColorStatus = result.brandColors.passed ? '✅' : '❌'
  console.log(
    `   ${brandColorStatus} Brand Colors: ${result.brandColors.compliantFiles}/${result.brandColors.totalFiles} files compliant (${result.brandColors.issues} issues)`
  )

  const typographyStatus = result.typography.passed ? '✅' : '❌'
  console.log(
    `   ${typographyStatus} Typography: ${result.typography.compliantFiles}/${result.typography.totalFiles} files compliant (${result.typography.issues} issues)`
  )

  const componentStatus = result.componentPatterns.passed ? '✅' : '❌'
  console.log(
    `   ${componentStatus} Component Patterns: ${result.componentPatterns.compliantFiles}/${result.componentPatterns.totalFiles} files compliant (${result.componentPatterns.issues} issues)`
  )

  console.log()

  // Compliance percentage
  const totalFiles = Math.max(
    result.brandColors.totalFiles,
    result.typography.totalFiles,
    result.componentPatterns.totalFiles
  )
  const totalCompliantFiles = Math.min(
    result.brandColors.compliantFiles,
    result.typography.compliantFiles,
    result.componentPatterns.compliantFiles
  )
  const compliancePercentage =
    totalFiles > 0 ? Math.round((totalCompliantFiles / totalFiles) * 100) : 0

  console.log(`📊 Overall Compliance Rate: ${compliancePercentage}%`)

  // Total issues
  const totalIssues =
    result.brandColors.issues +
    result.typography.issues +
    result.componentPatterns.issues
  console.log(`🚨 Total Issues Found: ${totalIssues}`)
  console.log()

  // Recommendations
  console.log('💡 Next Steps:')
  if (result.overallCompliance) {
    console.log('   ✅ All brand compliance validations passed!')
    console.log('   ✅ Brand improvements have been successfully preserved')
    console.log('   ✅ Compliance monitoring system can be safely removed')
  } else {
    console.log('   ❌ Brand compliance issues detected')

    if (!result.brandColors.passed) {
      console.log(
        '   - Fix brand color compliance issues before removing monitoring system'
      )
    }
    if (!result.typography.passed) {
      console.log(
        '   - Fix typography compliance issues before removing monitoring system'
      )
    }
    if (!result.componentPatterns.passed) {
      console.log(
        '   - Fix component pattern compliance issues before removing monitoring system'
      )
    }

    console.log('   - Re-run validation after fixes are applied')
  }

  console.log()

  // Requirements validation summary
  console.log('📋 Requirements Validation:')
  console.log(
    '   - Requirement 4.1 (TM brand colors preserved): ' +
      (result.brandColors.passed ? '✅ PASS' : '❌ FAIL')
  )
  console.log(
    '   - Requirement 4.2 (Typography compliance maintained): ' +
      (result.typography.passed ? '✅ PASS' : '❌ FAIL')
  )
  console.log(
    '   - Requirement 4.3 (Component styling patterns preserved): ' +
      (result.componentPatterns.passed ? '✅ PASS' : '❌ FAIL')
  )
  console.log(
    '   - Requirement 4.4 (Chart components maintain brand colors): ' +
      (result.brandColors.passed ? '✅ PASS' : '❌ FAIL')
  )
  console.log(
    '   - Requirement 4.5 (Visual brand compliance without monitoring): ' +
      (result.overallCompliance ? '✅ PASS' : '❌ FAIL')
  )

  console.log('\n🎨 Brand compliance preservation validation complete!')

  // Set summary for result
  result.summary = result.overallCompliance
    ? `All brand compliance validations passed (${compliancePercentage}% compliance rate)`
    : `Brand compliance issues detected (${totalIssues} total issues across ${totalFiles} files)`
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  try {
    const result = await validateBrandCompliancePreservation()

    // Exit with error code if not compliant
    if (!result.overallCompliance) {
      process.exit(1)
    }
  } catch (error) {
    console.error('❌ Brand compliance preservation validation failed:', error)
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { validateBrandCompliancePreservation }
