#!/usr/bin/env node

/**
 * Test Standards Validation Script
 *
 * Validates that test files comply with the established testing standards.
 * This script is run as part of the pre-commit hooks and CI/CD pipeline.
 */

const fs = require('fs')
const path = require('path')
const glob = require('glob')

// Configuration
const CONFIG = {
  testFilePatterns: ['src/**/*.test.{ts,tsx}', 'src/**/*.spec.{ts,tsx}'],
  excludePatterns: ['node_modules/**', 'dist/**', 'build/**', '**/*.d.ts'],
  rules: {
    requireSharedUtilities: true,
    requireCleanup: true,
    requireAccessibilityTesting: true,
    requireBrandComplianceTesting: true,
    prohibitDirectRender: true,
    requireDescriptiveNames: true,
  },
}

// Validation rules
const VALIDATION_RULES = {
  // Prohibit direct render usage
  directRenderUsage: {
    pattern:
      /import\s*{\s*[^}]*render[^}]*}\s*from\s*['"]@testing-library\/react['"]/,
    message:
      'Direct render import found. Use renderWithProviders from test utils instead.',
    severity: 'error',
  },

  // Require cleanup
  missingCleanup: {
    pattern: /cleanupAllResources/,
    message: 'Missing cleanupAllResources in afterEach hook.',
    severity: 'error',
    inverse: true, // Rule passes if pattern is found
  },

  // Require accessibility testing
  missingAccessibilityTesting: {
    patterns: [/runAccessibilityTestSuite/, /runQuickAccessibilityCheck/],
    message:
      'Missing accessibility testing. Add runAccessibilityTestSuite or runQuickAccessibilityCheck.',
    severity: 'warning',
    inverse: true,
    condition: content =>
      content.includes('Component') && !content.includes('.property.test.'),
  },

  // Require brand compliance testing
  missingBrandComplianceTesting: {
    patterns: [/runBrandComplianceTestSuite/, /runQuickBrandCheck/],
    message:
      'UI component missing brand compliance testing. Add runBrandComplianceTestSuite or runQuickBrandCheck.',
    severity: 'warning',
    inverse: true,
    condition: content => {
      // Check if it's a UI component test (has JSX and Component)
      return (
        content.includes('Component') &&
        content.includes('<') &&
        !content.includes('.property.test.') &&
        !content.includes('.integration.test.')
      )
    },
  },

  // Require shared utility usage
  missingSharedUtilities: {
    patterns: [
      /renderWithProviders/,
      /testComponentVariants/,
      /expectBasicRendering/,
    ],
    message:
      'Missing shared utility usage. Use renderWithProviders, testComponentVariants, or expectBasicRendering.',
    severity: 'warning',
    inverse: true,
    condition: content =>
      content.includes('Component') && content.includes('describe'),
  },

  // Check for descriptive test names
  vagueTestNames: {
    patterns: [
      /it\s*\(\s*['"]should work['"]/,
      /it\s*\(\s*['"]test\s*\d*['"]/,
      /it\s*\(\s*['"]renders['"]/,
      /describe\s*\(\s*['"]test/i,
    ],
    message:
      'Vague test names found. Use descriptive test names that explain what is being tested.',
    severity: 'warning',
  },

  // Check for proper variant naming
  vagueVariantNames: {
    patterns: [
      /name:\s*['"]variant\s*\d*['"]/,
      /name:\s*['"]test\s*case['"]/,
      /name:\s*['"]test\s*\d*['"]/,
    ],
    message: 'Vague variant names found. Use descriptive variant names.',
    severity: 'warning',
  },

  // Check for missing TypeScript types
  missingTypes: {
    pattern: /interface\s+\w+Props/,
    message: 'Consider defining TypeScript interfaces for component props.',
    severity: 'info',
    inverse: true,
    condition: content =>
      content.includes('Component') && content.includes('.test.tsx'),
  },
}

// Utility functions
function findTestFiles() {
  const files = []

  CONFIG.testFilePatterns.forEach(pattern => {
    const matches = glob.sync(pattern, {
      ignore: CONFIG.excludePatterns,
      absolute: true,
    })
    files.push(...matches)
  })

  return [...new Set(files)] // Remove duplicates
}

function validateFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const relativePath = path.relative(process.cwd(), filePath)
  const violations = []

  // Apply validation rules
  Object.entries(VALIDATION_RULES).forEach(([ruleName, rule]) => {
    // Check if rule condition is met (if specified)
    if (rule.condition && !rule.condition(content)) {
      return
    }

    let ruleViolated = false

    if (rule.pattern) {
      // Single pattern rule
      const matches = rule.pattern.test(content)
      ruleViolated = rule.inverse ? !matches : matches
    } else if (rule.patterns) {
      // Multiple pattern rule (OR logic)
      const matches = rule.patterns.some(pattern => pattern.test(content))
      ruleViolated = rule.inverse ? !matches : matches
    }

    if (ruleViolated) {
      violations.push({
        rule: ruleName,
        message: rule.message,
        severity: rule.severity || 'warning',
        file: relativePath,
      })
    }
  })

  return violations
}

function generateReport(allViolations) {
  const report = {
    totalFiles: 0,
    filesWithViolations: 0,
    violations: {
      error: 0,
      warning: 0,
      info: 0,
    },
    details: allViolations,
  }

  const fileSet = new Set()

  allViolations.forEach(violation => {
    fileSet.add(violation.file)
    report.violations[violation.severity]++
  })

  report.totalFiles = findTestFiles().length
  report.filesWithViolations = fileSet.size

  return report
}

function printReport(report) {
  console.log('\n🧪 Test Standards Validation Report')
  console.log('=====================================')

  // Summary
  console.log(`\n📊 Summary:`)
  console.log(`   Total test files: ${report.totalFiles}`)
  console.log(`   Files with violations: ${report.filesWithViolations}`)
  console.log(`   Errors: ${report.violations.error}`)
  console.log(`   Warnings: ${report.violations.warning}`)
  console.log(`   Info: ${report.violations.info}`)

  // Calculate compliance score
  const totalViolations = report.violations.error + report.violations.warning
  const complianceScore = Math.max(
    0,
    Math.round(
      ((report.totalFiles - report.filesWithViolations) / report.totalFiles) *
        100
    )
  )

  console.log(`   Compliance Score: ${complianceScore}%`)

  // Detailed violations
  if (report.details.length > 0) {
    console.log(`\n📋 Violations:`)

    // Group by file
    const violationsByFile = {}
    report.details.forEach(violation => {
      if (!violationsByFile[violation.file]) {
        violationsByFile[violation.file] = []
      }
      violationsByFile[violation.file].push(violation)
    })

    Object.entries(violationsByFile).forEach(([file, violations]) => {
      console.log(`\n   📄 ${file}:`)
      violations.forEach(violation => {
        const icon =
          violation.severity === 'error'
            ? '❌'
            : violation.severity === 'warning'
              ? '⚠️'
              : 'ℹ️'
        console.log(`      ${icon} ${violation.message}`)
      })
    })
  }

  // Recommendations
  if (report.violations.error > 0 || report.violations.warning > 0) {
    console.log(`\n💡 Recommendations:`)

    if (report.violations.error > 0) {
      console.log(
        `   • Fix ${report.violations.error} error(s) before committing`
      )
    }

    if (report.violations.warning > 0) {
      console.log(
        `   • Address ${report.violations.warning} warning(s) to improve test quality`
      )
    }

    console.log(`   • Refer to TEST_STANDARDS.md for detailed guidelines`)
    console.log(`   • Use templates in frontend/src/__tests__/utils/templates/`)
    console.log(`   • Run migration guide: MIGRATION_GUIDE.md`)
  }

  // Success message
  if (report.details.length === 0) {
    console.log(`\n✅ All test files meet the required standards!`)
    console.log(`   Great job maintaining high test quality! 🎉`)
  }
}

function main() {
  console.log('🔍 Validating test standards...')

  try {
    // Find all test files
    const testFiles = findTestFiles()

    if (testFiles.length === 0) {
      console.log('⚠️  No test files found.')
      return 0
    }

    console.log(`Found ${testFiles.length} test files`)

    // Validate each file
    const allViolations = []

    testFiles.forEach(filePath => {
      const violations = validateFile(filePath)
      allViolations.push(...violations)
    })

    // Generate and print report
    const report = generateReport(allViolations)
    printReport(report)

    // Determine exit code
    const hasErrors = report.violations.error > 0
    const hasWarnings = report.violations.warning > 0

    if (hasErrors) {
      console.log(
        `\n❌ Validation failed with ${report.violations.error} error(s)`
      )
      return 1
    } else if (hasWarnings && process.env.STRICT_WARNINGS === 'true') {
      console.log(`\n⚠️  Validation completed with warnings (strict mode)`)
      return 1
    } else {
      console.log(`\n✅ Validation completed successfully`)
      return 0
    }
  } catch (error) {
    console.error('❌ Error during validation:', error.message)
    return 1
  }
}

// CLI handling
if (require.main === module) {
  const exitCode = main()
  process.exit(exitCode)
}

module.exports = {
  validateFile,
  findTestFiles,
  generateReport,
  VALIDATION_RULES,
  CONFIG,
}
