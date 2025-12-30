#!/usr/bin/env node

/* global console, process */

/**
 * Comprehensive Brand Compliance Report Generator
 *
 * Generates detailed reports on brand compliance across the entire frontend,
 * including typography usage, accessibility metrics, and performance impact.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Brand compliance metrics
const BRAND_METRICS = {
  colors: {
    loyalBlue: '#004165',
    trueMaroon: '#772432',
    coolGray: '#A9B2B1',
    happyYellow: '#F2DF74',
    black: '#000000',
    white: '#FFFFFF',
  },
  typography: {
    headline: ['Montserrat', 'font-tm-headline', 'tm-headline'],
    body: ['Source Sans 3', 'font-tm-body', 'tm-body'],
  },
  components: {
    brandClasses: ['tm-', 'brand-', 'bg-tm-', 'text-tm-', 'border-tm-'],
  },
}

function analyzeFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    const lines = content.split('\n')

    const analysis = {
      file: filePath,
      totalLines: lines.length,
      brandColorUsage: 0,
      nonBrandColorUsage: 0,
      brandTypographyUsage: 0,
      brandComponentUsage: 0,
      violations: [],
      brandCompliance: {
        colors: [],
        typography: [],
        components: [],
      },
    }

    lines.forEach((line, lineNumber) => {
      const trimmedLine = line.trim()

      // Check for brand color usage
      Object.entries(BRAND_METRICS.colors).forEach(([name, color]) => {
        if (trimmedLine.includes(color)) {
          analysis.brandColorUsage++
          analysis.brandCompliance.colors.push({
            line: lineNumber + 1,
            color: name,
            value: color,
          })
        }
      })

      // Check for brand typography usage
      BRAND_METRICS.typography.headline.forEach(font => {
        if (trimmedLine.includes(font)) {
          analysis.brandTypographyUsage++
          analysis.brandCompliance.typography.push({
            line: lineNumber + 1,
            type: 'headline',
            value: font,
          })
        }
      })

      BRAND_METRICS.typography.body.forEach(font => {
        if (trimmedLine.includes(font)) {
          analysis.brandTypographyUsage++
          analysis.brandCompliance.typography.push({
            line: lineNumber + 1,
            type: 'body',
            value: font,
          })
        }
      })

      // Check for brand component usage
      BRAND_METRICS.components.brandClasses.forEach(brandClass => {
        if (trimmedLine.includes(brandClass)) {
          analysis.brandComponentUsage++
          analysis.brandCompliance.components.push({
            line: lineNumber + 1,
            class: brandClass,
          })
        }
      })
    })

    return analysis
  } catch (error) {
    console.error(`Error analyzing file ${filePath}:`, error.message)
    return null
  }
}

function scanDirectory(dirPath, analyses = []) {
  if (!fs.existsSync(dirPath)) {
    return analyses
  }

  const items = fs.readdirSync(dirPath)

  for (const item of items) {
    const fullPath = path.join(dirPath, item)
    const stat = fs.statSync(fullPath)

    if (stat.isDirectory()) {
      if (
        !item.startsWith('.') &&
        item !== 'node_modules' &&
        item !== 'dist' &&
        item !== 'build'
      ) {
        scanDirectory(fullPath, analyses)
      }
    } else if (stat.isFile()) {
      const ext = path.extname(item)
      if (['.tsx', '.ts', '.jsx', '.js', '.css', '.scss'].includes(ext)) {
        const analysis = analyzeFile(fullPath)
        if (analysis) {
          analyses.push(analysis)
        }
      }
    }
  }

  return analyses
}

function generateComprehensiveReport(analyses) {
  const report = {
    metadata: {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      scanType: 'comprehensive-brand-compliance',
    },
    summary: {
      totalFiles: analyses.length,
      totalLines: analyses.reduce((sum, a) => sum + a.totalLines, 0),
      brandColorUsage: analyses.reduce((sum, a) => sum + a.brandColorUsage, 0),
      brandTypographyUsage: analyses.reduce(
        (sum, a) => sum + a.brandTypographyUsage,
        0
      ),
      brandComponentUsage: analyses.reduce(
        (sum, a) => sum + a.brandComponentUsage,
        0
      ),
    },
    compliance: {
      colorCompliance: {
        filesWithBrandColors: analyses.filter(a => a.brandColorUsage > 0)
          .length,
        totalBrandColorUsage: analyses.reduce(
          (sum, a) => sum + a.brandColorUsage,
          0
        ),
        complianceRate: 0,
      },
      typographyCompliance: {
        filesWithBrandTypography: analyses.filter(
          a => a.brandTypographyUsage > 0
        ).length,
        totalBrandTypographyUsage: analyses.reduce(
          (sum, a) => sum + a.brandTypographyUsage,
          0
        ),
        complianceRate: 0,
      },
      componentCompliance: {
        filesWithBrandComponents: analyses.filter(
          a => a.brandComponentUsage > 0
        ).length,
        totalBrandComponentUsage: analyses.reduce(
          (sum, a) => sum + a.brandComponentUsage,
          0
        ),
        complianceRate: 0,
      },
    },
    fileAnalyses: analyses,
    recommendations: [],
  }

  // Calculate compliance rates
  report.compliance.colorCompliance.complianceRate =
    (report.compliance.colorCompliance.filesWithBrandColors /
      report.summary.totalFiles) *
    100

  report.compliance.typographyCompliance.complianceRate =
    (report.compliance.typographyCompliance.filesWithBrandTypography /
      report.summary.totalFiles) *
    100

  report.compliance.componentCompliance.complianceRate =
    (report.compliance.componentCompliance.filesWithBrandComponents /
      report.summary.totalFiles) *
    100

  // Generate recommendations
  const lowComplianceFiles = analyses.filter(
    a =>
      a.brandColorUsage === 0 &&
      a.brandTypographyUsage === 0 &&
      a.brandComponentUsage === 0
  )

  if (lowComplianceFiles.length > 0) {
    report.recommendations.push({
      type: 'low-compliance-files',
      priority: 'high',
      description: `${lowComplianceFiles.length} files have no brand compliance indicators`,
      files: lowComplianceFiles.map(f => f.file).slice(0, 10),
      action:
        'Review these files and add appropriate brand classes, colors, or typography',
    })
  }

  const highComplianceFiles = analyses.filter(
    a =>
      a.brandColorUsage > 0 ||
      a.brandTypographyUsage > 0 ||
      a.brandComponentUsage > 0
  )

  if (highComplianceFiles.length > 0) {
    report.recommendations.push({
      type: 'high-compliance-files',
      priority: 'info',
      description: `${highComplianceFiles.length} files show good brand compliance`,
      files: highComplianceFiles.map(f => f.file).slice(0, 5),
      action: 'Use these files as examples for brand compliance best practices',
    })
  }

  return report
}

function generateHTMLReport(report) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Brand Compliance Report</title>
    <style>
        body {
            font-family: 'Source Sans 3', system-ui, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1, h2, h3 {
            font-family: 'Montserrat', system-ui, sans-serif;
            color: #004165;
        }
        .metric-card {
            background: #A9B2B1;
            padding: 20px;
            margin: 10px 0;
            border-radius: 6px;
            display: inline-block;
            min-width: 200px;
            margin-right: 20px;
        }
        .metric-value {
            font-size: 2em;
            font-weight: bold;
            color: #004165;
        }
        .metric-label {
            color: #772432;
            font-weight: 600;
        }
        .compliance-bar {
            width: 100%;
            height: 20px;
            background: #e5e5e5;
            border-radius: 10px;
            overflow: hidden;
            margin: 10px 0;
        }
        .compliance-fill {
            height: 100%;
            background: linear-gradient(90deg, #772432 0%, #004165 100%);
            transition: width 0.3s ease;
        }
        .recommendation {
            background: #F2DF74;
            padding: 15px;
            margin: 10px 0;
            border-radius: 6px;
            border-left: 4px solid #004165;
        }
        .file-list {
            max-height: 200px;
            overflow-y: auto;
            background: #f8f9fa;
            padding: 10px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 0.9em;
        }
        .timestamp {
            color: #6b7280;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎨 Brand Compliance Report</h1>
        <p class="timestamp">Generated: ${new Date(report.metadata.timestamp).toLocaleString()}</p>
        
        <h2>📊 Summary Metrics</h2>
        <div class="metrics">
            <div class="metric-card">
                <div class="metric-value">${report.summary.totalFiles}</div>
                <div class="metric-label">Files Scanned</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${report.summary.totalLines.toLocaleString()}</div>
                <div class="metric-label">Total Lines</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${report.summary.brandColorUsage}</div>
                <div class="metric-label">Brand Color Usage</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${report.summary.brandTypographyUsage}</div>
                <div class="metric-label">Brand Typography Usage</div>
            </div>
        </div>

        <h2>🎯 Compliance Rates</h2>
        
        <h3>Color Compliance</h3>
        <div class="compliance-bar">
            <div class="compliance-fill" style="width: ${report.compliance.colorCompliance.complianceRate}%"></div>
        </div>
        <p>${report.compliance.colorCompliance.complianceRate.toFixed(1)}% of files use brand colors</p>

        <h3>Typography Compliance</h3>
        <div class="compliance-bar">
            <div class="compliance-fill" style="width: ${report.compliance.typographyCompliance.complianceRate}%"></div>
        </div>
        <p>${report.compliance.typographyCompliance.complianceRate.toFixed(1)}% of files use brand typography</p>

        <h3>Component Compliance</h3>
        <div class="compliance-bar">
            <div class="compliance-fill" style="width: ${report.compliance.componentCompliance.complianceRate}%"></div>
        </div>
        <p>${report.compliance.componentCompliance.complianceRate.toFixed(1)}% of files use brand components</p>

        <h2>💡 Recommendations</h2>
        ${report.recommendations
          .map(
            rec => `
            <div class="recommendation">
                <h4>${rec.type.replace(/-/g, ' ').toUpperCase()}</h4>
                <p><strong>Priority:</strong> ${rec.priority}</p>
                <p>${rec.description}</p>
                <p><strong>Action:</strong> ${rec.action}</p>
                ${
                  rec.files
                    ? `
                    <details>
                        <summary>Affected Files (${rec.files.length})</summary>
                        <div class="file-list">
                            ${rec.files.map(file => `<div>${file}</div>`).join('')}
                        </div>
                    </details>
                `
                    : ''
                }
            </div>
        `
          )
          .join('')}

        <h2>📈 Next Steps</h2>
        <ul>
            <li>Review files with low brand compliance</li>
            <li>Implement brand color classes consistently</li>
            <li>Update typography to use brand font families</li>
            <li>Add brand component classes where appropriate</li>
            <li>Run regular compliance scans to track progress</li>
        </ul>
    </div>
</body>
</html>`

  return html
}

function main() {
  console.log('📊 Generating Comprehensive Brand Compliance Report...\n')

  const directories = ['src/pages', 'src/components', 'src/styles']
  let allAnalyses = []

  directories.forEach(dir => {
    console.log(`Analyzing ${dir}...`)
    const analyses = scanDirectory(dir)
    allAnalyses = allAnalyses.concat(analyses)
  })

  const report = generateComprehensiveReport(allAnalyses)

  // Save JSON report
  const reportsDir = path.join(__dirname, '../compliance-reports')
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true })
  }

  const jsonReportPath = path.join(
    reportsDir,
    'comprehensive-brand-compliance.json'
  )
  fs.writeFileSync(jsonReportPath, JSON.stringify(report, null, 2))

  // Save HTML report
  const htmlReport = generateHTMLReport(report)
  const htmlReportPath = path.join(reportsDir, 'brand-compliance-report.html')
  fs.writeFileSync(htmlReportPath, htmlReport)

  // Output summary
  console.log('\n📊 Comprehensive Brand Compliance Report:')
  console.log('==========================================')
  console.log(`Files Scanned: ${report.summary.totalFiles}`)
  console.log(`Total Lines: ${report.summary.totalLines.toLocaleString()}`)
  console.log(`Brand Color Usage: ${report.summary.brandColorUsage}`)
  console.log(`Brand Typography Usage: ${report.summary.brandTypographyUsage}`)
  console.log(`Brand Component Usage: ${report.summary.brandComponentUsage}`)
  console.log('')
  console.log('Compliance Rates:')
  console.log(
    `  Color Compliance: ${report.compliance.colorCompliance.complianceRate.toFixed(1)}%`
  )
  console.log(
    `  Typography Compliance: ${report.compliance.typographyCompliance.complianceRate.toFixed(1)}%`
  )
  console.log(
    `  Component Compliance: ${report.compliance.componentCompliance.complianceRate.toFixed(1)}%`
  )
  console.log('')
  console.log(`📄 JSON Report: ${jsonReportPath}`)
  console.log(`🌐 HTML Report: ${htmlReportPath}`)
  console.log('')
  console.log('💡 Key Recommendations:')
  report.recommendations.forEach((rec, index) => {
    console.log(`  ${index + 1}. ${rec.description}`)
  })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { analyzeFile, scanDirectory, generateComprehensiveReport }
