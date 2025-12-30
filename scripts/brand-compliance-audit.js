#!/usr/bin/env node

/**
 * Brand Compliance Audit Script
 *
 * Automated script for running comprehensive brand compliance audits.
 * Can be run manually or as part of CI/CD pipeline.
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// Configuration
const CONFIG = {
  outputDir: './compliance-reports',
  reportFormat: 'json', // 'json' | 'html' | 'markdown'
  includeScreenshots: false,
  testUrls: [
    'http://localhost:3000',
    'http://localhost:3000/districts',
    'http://localhost:3000/clubs',
    'http://localhost:3000/reports',
  ],
  thresholds: {
    minComplianceScore: 85,
    maxViolations: 10,
    maxFontLoadTime: 3000,
    maxBundleSize: 500000,
  },
  exitOnFailure: process.env.CI === 'true',
}

// Ensure output directory exists
if (!fs.existsSync(CONFIG.outputDir)) {
  fs.mkdirSync(CONFIG.outputDir, { recursive: true })
}

/**
 * Run brand compliance tests
 */
async function runComplianceTests() {
  console.log('🔍 Running brand compliance tests...')

  try {
    // Run Vitest tests for brand compliance
    const testOutput = execSync(
      'npx vitest --reporter=json --run src/__tests__/brand/',
      {
        encoding: 'utf8',
        stdio: 'pipe',
      }
    )

    const testResults = JSON.parse(testOutput)
    return {
      success: testResults.success,
      numTotalTests: testResults.numTotalTests,
      numPassedTests: testResults.numPassedTests,
      numFailedTests: testResults.numFailedTests,
      testResults: testResults.testResults,
    }
  } catch (error) {
    console.error('❌ Brand compliance tests failed:', error.message)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * Run accessibility audit
 */
async function runAccessibilityAudit() {
  console.log('♿ Running accessibility audit...')

  try {
    // Run accessibility tests
    const testOutput = execSync(
      'npx vitest --reporter=json --run src/__tests__/accessibility/',
      {
        encoding: 'utf8',
        stdio: 'pipe',
      }
    )

    const testResults = JSON.parse(testOutput)
    return {
      success: testResults.success,
      numTotalTests: testResults.numTotalTests,
      numPassedTests: testResults.numPassedTests,
      numFailedTests: testResults.numFailedTests,
      testResults: testResults.testResults,
    }
  } catch (error) {
    console.error('❌ Accessibility audit failed:', error.message)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * Analyze bundle size
 */
async function analyzeBundleSize() {
  console.log('📦 Analyzing bundle size...')

  try {
    // Build the project to get bundle size
    execSync('npm run build', { stdio: 'pipe' })

    const distPath = path.join(process.cwd(), 'frontend/dist')
    const cssFiles = fs
      .readdirSync(distPath)
      .filter(file => file.endsWith('.css'))
      .map(file => {
        const filePath = path.join(distPath, file)
        const stats = fs.statSync(filePath)
        return {
          name: file,
          size: stats.size,
          sizeKB: Math.round(stats.size / 1024),
        }
      })

    const totalSize = cssFiles.reduce((sum, file) => sum + file.size, 0)

    return {
      success: true,
      totalSize,
      totalSizeKB: Math.round(totalSize / 1024),
      files: cssFiles,
      exceedsThreshold: totalSize > CONFIG.thresholds.maxBundleSize,
    }
  } catch (error) {
    console.error('❌ Bundle size analysis failed:', error.message)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * Check TypeScript compliance
 */
async function checkTypeScriptCompliance() {
  console.log('📝 Checking TypeScript compliance...')

  try {
    // Run TypeScript compiler check
    execSync('npx tsc --noEmit --skipLibCheck', { stdio: 'pipe' })

    return {
      success: true,
      errors: 0,
      message: 'No TypeScript errors found',
    }
  } catch (error) {
    // Count TypeScript errors
    const errorOutput =
      error.stdout?.toString() || error.stderr?.toString() || ''
    const errorLines = errorOutput
      .split('\n')
      .filter(line => line.includes('error TS'))

    return {
      success: false,
      errors: errorLines.length,
      message: `Found ${errorLines.length} TypeScript errors`,
      details: errorLines.slice(0, 10), // First 10 errors
    }
  }
}

/**
 * Check lint compliance
 */
async function checkLintCompliance() {
  console.log('🔧 Checking lint compliance...')

  try {
    // Run ESLint
    const lintOutput = execSync('npm run lint -- --format=json', {
      encoding: 'utf8',
      stdio: 'pipe',
    })

    const lintResults = JSON.parse(lintOutput)
    const totalErrors = lintResults.reduce(
      (sum, result) => sum + result.errorCount,
      0
    )
    const totalWarnings = lintResults.reduce(
      (sum, result) => sum + result.warningCount,
      0
    )

    return {
      success: totalErrors === 0,
      errors: totalErrors,
      warnings: totalWarnings,
      message: `Found ${totalErrors} errors and ${totalWarnings} warnings`,
      results: lintResults,
    }
  } catch (error) {
    console.error('❌ Lint check failed:', error.message)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * Generate compliance report
 */
function generateReport(results) {
  const timestamp = new Date().toISOString()
  const reportId = `compliance-audit-${Date.now()}`

  const report = {
    id: reportId,
    timestamp,
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    results,
    summary: generateSummary(results),
    recommendations: generateRecommendations(results),
  }

  // Save report
  const reportPath = path.join(CONFIG.outputDir, `${reportId}.json`)
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))

  console.log(`📊 Report saved to: ${reportPath}`)

  // Generate HTML report if requested
  if (CONFIG.reportFormat === 'html') {
    generateHTMLReport(report, reportPath.replace('.json', '.html'))
  }

  return report
}

/**
 * Generate summary from results
 */
function generateSummary(results) {
  const summary = {
    overallStatus: 'pass',
    totalIssues: 0,
    criticalIssues: 0,
    categories: {},
  }

  // Analyze each category
  Object.entries(results).forEach(([category, result]) => {
    if (!result.success) {
      summary.overallStatus = 'fail'
      summary.categories[category] = 'fail'

      if (category === 'brandCompliance' || category === 'accessibility') {
        summary.criticalIssues += result.numFailedTests || 1
      }

      summary.totalIssues += result.errors || result.numFailedTests || 1
    } else {
      summary.categories[category] = 'pass'
    }
  })

  return summary
}

/**
 * Generate recommendations based on results
 */
function generateRecommendations(results) {
  const recommendations = []

  // Brand compliance recommendations
  if (!results.brandCompliance?.success) {
    recommendations.push({
      category: 'Brand Compliance',
      priority: 'high',
      message:
        'Fix brand compliance violations to ensure consistent visual identity',
      actions: [
        'Review failed brand compliance tests',
        'Update components to use brand colors and typography',
        'Ensure proper contrast ratios and accessibility standards',
      ],
    })
  }

  // Accessibility recommendations
  if (!results.accessibility?.success) {
    recommendations.push({
      category: 'Accessibility',
      priority: 'critical',
      message:
        'Address accessibility issues to ensure inclusive user experience',
      actions: [
        'Fix WCAG AA compliance violations',
        'Ensure proper touch target sizes',
        'Add missing ARIA labels and semantic markup',
      ],
    })
  }

  // Bundle size recommendations
  if (results.bundleSize?.exceedsThreshold) {
    recommendations.push({
      category: 'Performance',
      priority: 'medium',
      message: 'Optimize CSS bundle size to improve loading performance',
      actions: [
        'Remove unused CSS with PurgeCSS',
        'Implement CSS code splitting',
        'Optimize Tailwind CSS configuration',
      ],
    })
  }

  // TypeScript recommendations
  if (!results.typeScript?.success) {
    recommendations.push({
      category: 'Code Quality',
      priority: 'high',
      message: 'Fix TypeScript errors to ensure type safety',
      actions: [
        'Address TypeScript compilation errors',
        'Add proper type definitions',
        'Remove any explicit any types',
      ],
    })
  }

  // Lint recommendations
  if (!results.lint?.success) {
    recommendations.push({
      category: 'Code Quality',
      priority: 'medium',
      message: 'Fix linting errors to maintain code consistency',
      actions: [
        'Address ESLint errors',
        'Fix code formatting issues',
        'Remove unused variables and imports',
      ],
    })
  }

  return recommendations
}

/**
 * Generate HTML report
 */
function generateHTMLReport(report, outputPath) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Brand Compliance Audit Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: #004165; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { padding: 20px; }
        .status-pass { color: #22c55e; }
        .status-fail { color: #ef4444; }
        .priority-critical { color: #dc2626; font-weight: bold; }
        .priority-high { color: #ea580c; font-weight: bold; }
        .priority-medium { color: #d97706; }
        .section { margin-bottom: 30px; }
        .metric { display: inline-block; margin: 10px; padding: 15px; background: #f8fafc; border-radius: 6px; min-width: 150px; }
        .recommendation { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 10px 0; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
        th { background: #f9fafb; font-weight: 600; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Brand Compliance Audit Report</h1>
            <p>Generated: ${report.timestamp}</p>
            <p>Report ID: ${report.id}</p>
        </div>
        
        <div class="content">
            <div class="section">
                <h2>Summary</h2>
                <div class="metric">
                    <h3>Overall Status</h3>
                    <p class="status-${report.summary.overallStatus}">${report.summary.overallStatus.toUpperCase()}</p>
                </div>
                <div class="metric">
                    <h3>Total Issues</h3>
                    <p>${report.summary.totalIssues}</p>
                </div>
                <div class="metric">
                    <h3>Critical Issues</h3>
                    <p>${report.summary.criticalIssues}</p>
                </div>
            </div>
            
            <div class="section">
                <h2>Category Results</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Category</th>
                            <th>Status</th>
                            <th>Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.entries(report.summary.categories)
                          .map(
                            ([category, status]) => `
                            <tr>
                                <td>${category}</td>
                                <td class="status-${status}">${status.toUpperCase()}</td>
                                <td>${getResultDetails(report.results[category])}</td>
                            </tr>
                        `
                          )
                          .join('')}
                    </tbody>
                </table>
            </div>
            
            <div class="section">
                <h2>Recommendations</h2>
                ${report.recommendations
                  .map(
                    rec => `
                    <div class="recommendation">
                        <h3 class="priority-${rec.priority}">${rec.category} (${rec.priority.toUpperCase()})</h3>
                        <p>${rec.message}</p>
                        <ul>
                            ${rec.actions.map(action => `<li>${action}</li>`).join('')}
                        </ul>
                    </div>
                `
                  )
                  .join('')}
            </div>
        </div>
    </div>
</body>
</html>
  `

  fs.writeFileSync(outputPath, html)
  console.log(`📄 HTML report saved to: ${outputPath}`)
}

/**
 * Get result details for HTML report
 */
function getResultDetails(result) {
  if (!result) return 'No data'
  if (result.success) return 'All checks passed'

  const details = []
  if (result.errors) details.push(`${result.errors} errors`)
  if (result.warnings) details.push(`${result.warnings} warnings`)
  if (result.numFailedTests)
    details.push(`${result.numFailedTests} failed tests`)
  if (result.message) details.push(result.message)

  return details.join(', ') || 'Failed'
}

/**
 * Main audit function
 */
async function runAudit() {
  console.log('🚀 Starting brand compliance audit...')
  console.log('='.repeat(50))

  const results = {}

  // Run all audits
  results.brandCompliance = await runComplianceTests()
  results.accessibility = await runAccessibilityAudit()
  results.bundleSize = await analyzeBundleSize()
  results.typeScript = await checkTypeScriptCompliance()
  results.lint = await checkLintCompliance()

  // Generate report
  const report = generateReport(results)

  // Print summary
  console.log('\n' + '='.repeat(50))
  console.log('📊 AUDIT SUMMARY')
  console.log('='.repeat(50))
  console.log(`Overall Status: ${report.summary.overallStatus.toUpperCase()}`)
  console.log(`Total Issues: ${report.summary.totalIssues}`)
  console.log(`Critical Issues: ${report.summary.criticalIssues}`)

  console.log('\nCategory Results:')
  Object.entries(report.summary.categories).forEach(([category, status]) => {
    const icon = status === 'pass' ? '✅' : '❌'
    console.log(`  ${icon} ${category}: ${status.toUpperCase()}`)
  })

  if (report.recommendations.length > 0) {
    console.log('\nTop Recommendations:')
    report.recommendations.slice(0, 3).forEach((rec, index) => {
      console.log(
        `  ${index + 1}. [${rec.priority.toUpperCase()}] ${rec.message}`
      )
    })
  }

  console.log(`\n📊 Full report: ${path.resolve(CONFIG.outputDir)}`)

  // Exit with appropriate code
  if (CONFIG.exitOnFailure && report.summary.overallStatus === 'fail') {
    console.log('\n❌ Audit failed - exiting with error code 1')
    process.exit(1)
  } else {
    console.log('\n✅ Audit completed successfully')
    process.exit(0)
  }
}

// Run audit if called directly
if (require.main === module) {
  runAudit().catch(error => {
    console.error('💥 Audit failed with error:', error)
    process.exit(1)
  })
}

module.exports = {
  runAudit,
  runComplianceTests,
  runAccessibilityAudit,
  analyzeBundleSize,
  checkTypeScriptCompliance,
  checkLintCompliance,
}
