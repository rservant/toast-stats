#!/usr/bin/env node

/**
 * Brand Compliance Scanner
 *
 * Automated color detection across all frontend files to identify
 * non-brand colors and generate comprehensive brand compliance reports.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Brand colors that are allowed
const BRAND_COLORS = {
  loyalBlue: '#004165',
  trueMaroon: '#772432',
  coolGray: '#A9B2B1',
  happyYellow: '#F2DF74',
  black: '#000000',
  white: '#FFFFFF',
}

// Non-brand colors that should not be present
const FORBIDDEN_COLORS = [
  // Purple variations
  'purple',
  'violet',
  '#8b5cf6',
  '#7c3aed',
  '#6d28d9',
  '#5b21b6',
  'bg-purple',
  'text-purple',
  'border-purple',
  // Custom blues that aren't brand blue
  '#2563eb',
  '#3b82f6',
  '#1d4ed8',
  '#1e40af',
  'bg-blue-500',
  'bg-blue-600',
  'text-blue-600',
  'text-blue-700',
  'border-blue-500',
  'border-blue-600',
  // Other problematic colors
  'bg-indigo',
  'text-indigo',
  'bg-violet',
  'text-violet',
]

// File extensions to scan
const SCAN_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js', '.css', '.scss']

// Directories to scan
const SCAN_DIRECTORIES = ['src/pages', 'src/components', 'src/styles']

function scanDirectory(dirPath, violations = []) {
  if (!fs.existsSync(dirPath)) {
    console.warn(`Directory not found: ${dirPath}`)
    return violations
  }

  const items = fs.readdirSync(dirPath)

  for (const item of items) {
    const fullPath = path.join(dirPath, item)
    const stat = fs.statSync(fullPath)

    if (stat.isDirectory()) {
      // Skip node_modules and other build directories
      if (
        !item.startsWith('.') &&
        item !== 'node_modules' &&
        item !== 'dist' &&
        item !== 'build'
      ) {
        scanDirectory(fullPath, violations)
      }
    } else if (stat.isFile()) {
      const ext = path.extname(item)
      if (SCAN_EXTENSIONS.includes(ext)) {
        scanFile(fullPath, violations)
      }
    }
  }

  return violations
}

function scanFile(filePath, violations) {
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    const lines = content.split('\n')

    lines.forEach((line, lineNumber) => {
      FORBIDDEN_COLORS.forEach(forbiddenColor => {
        if (line.includes(forbiddenColor)) {
          violations.push({
            file: filePath,
            line: lineNumber + 1,
            content: line.trim(),
            violation: forbiddenColor,
            type: 'color',
            severity: 'error',
          })
        }
      })

      // Check for hex colors that aren't brand colors
      const hexColorRegex = /#[0-9A-Fa-f]{6}/g
      const hexMatches = line.match(hexColorRegex)
      if (hexMatches) {
        hexMatches.forEach(hexColor => {
          const upperHex = hexColor.toUpperCase()
          const isBrandColor = Object.values(BRAND_COLORS).some(
            brandColor => brandColor.toUpperCase() === upperHex
          )

          if (!isBrandColor) {
            violations.push({
              file: filePath,
              line: lineNumber + 1,
              content: line.trim(),
              violation: hexColor,
              type: 'hex-color',
              severity: 'warning',
            })
          }
        })
      }
    })
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message)
  }
}

function generateReport(violations) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalViolations: violations.length,
      errorViolations: violations.filter(v => v.severity === 'error').length,
      warningViolations: violations.filter(v => v.severity === 'warning')
        .length,
      filesScanned: [...new Set(violations.map(v => v.file))].length,
    },
    violationsByFile: {},
    violationsByType: {},
    recommendations: [],
  }

  // Group violations by file
  violations.forEach(violation => {
    if (!report.violationsByFile[violation.file]) {
      report.violationsByFile[violation.file] = []
    }
    report.violationsByFile[violation.file].push(violation)
  })

  // Group violations by type
  violations.forEach(violation => {
    if (!report.violationsByType[violation.violation]) {
      report.violationsByType[violation.violation] = []
    }
    report.violationsByType[violation.violation].push(violation)
  })

  // Generate recommendations
  const topViolations = Object.entries(report.violationsByType)
    .sort(([, a], [, b]) => b.length - a.length)
    .slice(0, 5)

  topViolations.forEach(([violation, instances]) => {
    if (violation.includes('purple') || violation.includes('violet')) {
      report.recommendations.push({
        violation,
        count: instances.length,
        suggestion: `Replace ${violation} with TM True Maroon (#772432) for emphasis or TM Loyal Blue (#004165) for primary actions`,
      })
    } else if (violation.includes('blue-5') || violation.includes('blue-6')) {
      report.recommendations.push({
        violation,
        count: instances.length,
        suggestion: `Replace ${violation} with TM Loyal Blue (#004165) for consistent brand compliance`,
      })
    } else {
      report.recommendations.push({
        violation,
        count: instances.length,
        suggestion: `Review usage of ${violation} and replace with appropriate brand color`,
      })
    }
  })

  return report
}

function main() {
  console.log('🔍 Starting Brand Compliance Scan...\n')

  let allViolations = []

  // Scan each directory
  SCAN_DIRECTORIES.forEach(dir => {
    console.log(`Scanning ${dir}...`)
    const violations = scanDirectory(dir)
    allViolations = allViolations.concat(violations)
  })

  // Generate report
  const report = generateReport(allViolations)

  // Output summary
  console.log('\n📊 Brand Compliance Scan Results:')
  console.log('=====================================')
  console.log(`Total Violations: ${report.summary.totalViolations}`)
  console.log(`Error Violations: ${report.summary.errorViolations}`)
  console.log(`Warning Violations: ${report.summary.warningViolations}`)
  console.log(`Files with Violations: ${report.summary.filesScanned}`)

  if (report.summary.totalViolations > 0) {
    console.log('\n🚨 Top Violations:')
    Object.entries(report.violationsByType)
      .sort(([, a], [, b]) => b.length - a.length)
      .slice(0, 10)
      .forEach(([violation, instances]) => {
        console.log(`  ${violation}: ${instances.length} occurrences`)
      })

    console.log('\n💡 Recommendations:')
    report.recommendations.forEach((rec, index) => {
      console.log(
        `  ${index + 1}. ${rec.suggestion} (${rec.count} occurrences)`
      )
    })

    // Save detailed report
    const reportPath = path.join(
      __dirname,
      '../compliance-reports/brand-compliance-report.json'
    )
    const reportDir = path.dirname(reportPath)

    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true })
    }

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
    console.log(`\n📄 Detailed report saved to: ${reportPath}`)
  } else {
    console.log('\n✅ No brand compliance violations found!')
  }

  // Exit with appropriate code
  process.exit(report.summary.errorViolations > 0 ? 1 : 0)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { scanDirectory, scanFile, generateReport }
