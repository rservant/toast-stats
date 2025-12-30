#!/usr/bin/env node

/**
 * Monitoring Setup Script
 *
 * Sets up brand compliance monitoring infrastructure including:
 * - Monitoring service configuration
 * - Alert thresholds
 * - Reporting schedules
 * - Performance tracking
 */

const fs = require('fs')
const path = require('path')

// Default monitoring configuration
const DEFAULT_CONFIG = {
  monitoring: {
    enabled: true,
    environment: process.env.NODE_ENV || 'development',
    reportingInterval: 60000, // 1 minute
    performanceTracking: true,
    autoReporting: true,
    dataRetentionDays: 30,
  },
  alertThresholds: {
    compliance: {
      minOverallScore: 85,
      minColorCompliance: 90,
      minTypographyCompliance: 90,
      minAccessibilityScore: 90,
      maxViolations: 10,
      maxGradientViolations: 1,
    },
    performance: {
      maxFontLoadTime: 3000, // 3 seconds
      maxCSSBundleSize: 500000, // 500KB
      maxValidationTime: 100, // 100ms
      maxMemoryUsage: 90, // 90% of heap limit
      maxPageLoadTime: 5000, // 5 seconds
    },
  },
  notifications: {
    console: true,
    localStorage: true,
    api: {
      enabled: process.env.NODE_ENV === 'production',
      endpoint: '/api/monitoring',
      timeout: 5000,
    },
    webhook: {
      enabled: false,
      url: process.env.MONITORING_WEBHOOK_URL || '',
      timeout: 10000,
    },
  },
  reporting: {
    realtime: {
      enabled: true,
      interval: 60000, // 1 minute
    },
    weekly: {
      enabled: true,
      day: 1, // Monday
      hour: 9, // 9 AM
    },
    monthly: {
      enabled: true,
      day: 1, // 1st of month
      hour: 9, // 9 AM
    },
  },
  validation: {
    enableAutoFix: false,
    logValidationErrors: true,
    reportingLevel: 'error',
    rules: {
      color: true,
      typography: true,
      accessibility: true,
      component: true,
      gradient: true,
    },
  },
}

/**
 * Setup monitoring configuration
 */
function setupMonitoringConfig() {
  console.log('🔧 Setting up monitoring configuration...')

  const configDir = path.join(process.cwd(), 'frontend/src/config')
  const configPath = path.join(configDir, 'monitoring.json')

  // Create config directory if it doesn't exist
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true })
  }

  // Load existing config or use defaults
  let config = DEFAULT_CONFIG
  if (fs.existsSync(configPath)) {
    try {
      const existingConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'))
      config = { ...DEFAULT_CONFIG, ...existingConfig }
      console.log('📝 Merged with existing configuration')
    } catch (error) {
      console.warn(
        '⚠️  Failed to load existing config, using defaults:',
        error.message
      )
    }
  }

  // Adjust config based on environment
  if (process.env.NODE_ENV === 'production') {
    config.monitoring.reportingInterval = 300000 // 5 minutes in production
    config.alertThresholds.compliance.minOverallScore = 90 // Higher threshold in production
    config.notifications.api.enabled = true
  } else if (process.env.NODE_ENV === 'development') {
    config.monitoring.reportingInterval = 30000 // 30 seconds in development
    config.validation.enableAutoFix = true // Enable auto-fix in development
    config.validation.logValidationErrors = true
  }

  // Save configuration
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
  console.log(`✅ Monitoring configuration saved to: ${configPath}`)

  return config
}

/**
 * Setup monitoring directories
 */
function setupMonitoringDirectories() {
  console.log('📁 Setting up monitoring directories...')

  const directories = [
    'frontend/src/utils/monitoring',
    'docs/monitoring',
    'scripts/monitoring',
    'compliance-reports',
    'performance-reports',
  ]

  directories.forEach(dir => {
    const fullPath = path.join(process.cwd(), dir)
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true })
      console.log(`📂 Created directory: ${dir}`)
    }
  })
}

/**
 * Setup package.json scripts
 */
function setupPackageScripts() {
  console.log('📦 Setting up package.json scripts...')

  const packagePath = path.join(process.cwd(), 'frontend/package.json')

  if (!fs.existsSync(packagePath)) {
    console.warn('⚠️  frontend/package.json not found, skipping script setup')
    return
  }

  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'))

  // Add monitoring scripts
  const monitoringScripts = {
    'audit:brand-compliance': 'node ../scripts/brand-compliance-audit.js',
    'audit:brand-compliance:manual':
      'node ../scripts/brand-compliance-audit.js --manual',
    'monitor:start': 'node ../scripts/monitoring-setup.js --start',
    'monitor:stop': 'node ../scripts/monitoring-setup.js --stop',
    'report:compliance': 'node ../scripts/generate-compliance-report.js',
    'report:performance': 'node ../scripts/generate-performance-report.js',
    'validate:brand-compliance': 'npm run test -- --run src/__tests__/brand/',
    'test:brand-compliance':
      'npm run test -- src/__tests__/brand/ src/__tests__/accessibility/',
    'test:brand-compliance:critical-pages':
      'npm run test -- --run src/__tests__/integration/brandCompliance.test.ts',
  }

  // Merge with existing scripts
  packageJson.scripts = { ...packageJson.scripts, ...monitoringScripts }

  // Save updated package.json
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2))
  console.log('✅ Added monitoring scripts to package.json')
}

/**
 * Setup environment variables template
 */
function setupEnvironmentTemplate() {
  console.log('🌍 Setting up environment variables template...')

  const envTemplate = `# Brand Compliance Monitoring Configuration

# Monitoring Service
MONITORING_ENABLED=true
MONITORING_ENVIRONMENT=development
MONITORING_REPORTING_INTERVAL=60000

# Alert Configuration
MONITORING_MIN_COMPLIANCE_SCORE=85
MONITORING_MAX_VIOLATIONS=10
MONITORING_MAX_FONT_LOAD_TIME=3000
MONITORING_MAX_BUNDLE_SIZE=500000

# Notification Configuration
MONITORING_WEBHOOK_URL=
MONITORING_API_ENDPOINT=/api/monitoring
MONITORING_CONSOLE_LOGGING=true

# Performance Tracking
PERFORMANCE_TRACKING_ENABLED=true
PERFORMANCE_MEMORY_MONITORING=true
PERFORMANCE_FONT_MONITORING=true

# Validation Configuration
VALIDATION_AUTO_FIX_ENABLED=false
VALIDATION_LOG_ERRORS=true
VALIDATION_REPORTING_LEVEL=error

# Report Configuration
WEEKLY_REPORTS_ENABLED=true
MONTHLY_REPORTS_ENABLED=true
REPORT_RETENTION_DAYS=30
`

  const envPath = path.join(process.cwd(), 'frontend/.env.monitoring.example')
  fs.writeFileSync(envPath, envTemplate)
  console.log(`✅ Environment template saved to: ${envPath}`)
}

/**
 * Setup monitoring service initialization
 */
function setupServiceInitialization() {
  console.log('🚀 Setting up service initialization...')

  const initScript = `/**
 * Monitoring Service Initialization
 * 
 * This file initializes the brand compliance monitoring system.
 * Import this in your main application file to start monitoring.
 */

import { brandMonitoringService } from '../brandMonitoring'
import { performanceMonitoringService } from '../performanceMonitoring'

// Load monitoring configuration
let monitoringConfig = {}
try {
  monitoringConfig = require('../../config/monitoring.json')
} catch (error) {
  console.warn('Failed to load monitoring config, using defaults:', error.message)
}

// Initialize monitoring services
export function initializeMonitoring() {
  console.log('🔍 Initializing brand compliance monitoring...')
  
  // Start monitoring services
  if (monitoringConfig.monitoring?.enabled !== false) {
    // Monitoring is initialized automatically via service constructors
    console.log('✅ Brand monitoring service started')
    console.log('✅ Performance monitoring service started')
    
    // Log initial status
    setTimeout(() => {
      const metrics = brandMonitoringService.trackComplianceMetrics()
      console.log('📊 Initial compliance metrics:', {
        overallScore: Math.round(metrics.overallComplianceScore),
        violations: metrics.totalViolations,
        colorCompliance: Math.round(metrics.colorComplianceRate),
        typographyCompliance: Math.round(metrics.typographyComplianceRate),
        accessibilityScore: Math.round(metrics.accessibilityScore),
      })
    }, 1000)
  } else {
    console.log('⏸️  Monitoring disabled by configuration')
  }
}

// Auto-initialize in production
if (process.env.NODE_ENV === 'production') {
  initializeMonitoring()
}

export { brandMonitoringService, performanceMonitoringService }
`

  const initPath = path.join(
    process.cwd(),
    'frontend/src/utils/monitoring/init.ts'
  )
  fs.writeFileSync(initPath, initScript)
  console.log(`✅ Service initialization script saved to: ${initPath}`)
}

/**
 * Setup CI/CD integration
 */
function setupCIIntegration() {
  console.log('🔄 Setting up CI/CD integration...')

  const githubWorkflow = `name: Brand Compliance Monitoring

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]
  schedule:
    # Run daily at 9 AM UTC
    - cron: '0 9 * * *'

jobs:
  brand-compliance-audit:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: |
        npm ci
        cd frontend && npm ci
    
    - name: Run brand compliance audit
      run: |
        cd frontend
        npm run audit:brand-compliance
      env:
        CI: true
    
    - name: Upload compliance report
      uses: actions/upload-artifact@v3
      if: always()
      with:
        name: compliance-report
        path: compliance-reports/
        retention-days: 30
    
    - name: Comment PR with results
      uses: actions/github-script@v6
      if: github.event_name == 'pull_request'
      with:
        script: |
          const fs = require('fs');
          const path = require('path');
          
          // Find the latest report
          const reportsDir = 'compliance-reports';
          if (fs.existsSync(reportsDir)) {
            const files = fs.readdirSync(reportsDir)
              .filter(f => f.endsWith('.json'))
              .sort()
              .reverse();
            
            if (files.length > 0) {
              const reportPath = path.join(reportsDir, files[0]);
              const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
              
              const comment = \`## 🎨 Brand Compliance Report
              
**Overall Status:** \${report.summary.overallStatus === 'pass' ? '✅ PASS' : '❌ FAIL'}
**Total Issues:** \${report.summary.totalIssues}
**Critical Issues:** \${report.summary.criticalIssues}

### Category Results
\${Object.entries(report.summary.categories).map(([cat, status]) => 
  \`- \${status === 'pass' ? '✅' : '❌'} \${cat}: \${status.toUpperCase()}\`
).join('\\n')}

\${report.recommendations.length > 0 ? \`
### Top Recommendations
\${report.recommendations.slice(0, 3).map((rec, i) => 
  \`\${i + 1}. **[\${rec.priority.toUpperCase()}]** \${rec.message}\`
).join('\\n')}
\` : ''}

<details>
<summary>View Full Report</summary>

\\\`\\\`\\\`json
\${JSON.stringify(report, null, 2)}
\\\`\\\`\\\`

</details>
              \`;
              
              github.rest.issues.createComment({
                issue_number: context.issue.number,
                owner: context.repo.owner,
                repo: context.repo.repo,
                body: comment
              });
            }
          }

  performance-monitoring:
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: |
        npm ci
        cd frontend && npm ci
    
    - name: Build and analyze bundle
      run: |
        cd frontend
        npm run build
        npm run report:performance
    
    - name: Upload performance report
      uses: actions/upload-artifact@v3
      with:
        name: performance-report
        path: performance-reports/
        retention-days: 30
`

  const workflowDir = path.join(process.cwd(), '.github/workflows')
  if (!fs.existsSync(workflowDir)) {
    fs.mkdirSync(workflowDir, { recursive: true })
  }

  const workflowPath = path.join(workflowDir, 'brand-compliance.yml')
  fs.writeFileSync(workflowPath, githubWorkflow)
  console.log(`✅ GitHub workflow saved to: ${workflowPath}`)
}

/**
 * Setup pre-commit hooks
 */
function setupPreCommitHooks() {
  console.log('🪝 Setting up pre-commit hooks...')

  const huskyDir = path.join(process.cwd(), '.husky')
  if (!fs.existsSync(huskyDir)) {
    fs.mkdirSync(huskyDir, { recursive: true })
  }

  const preCommitHook = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "🔍 Running brand compliance checks..."

# Run brand compliance validation
cd frontend && npm run validate:brand-compliance

# Check if validation passed
if [ $? -ne 0 ]; then
  echo "❌ Brand compliance validation failed!"
  echo "Please fix the violations before committing."
  exit 1
fi

echo "✅ Brand compliance validation passed!"
`

  const preCommitPath = path.join(huskyDir, 'pre-commit')
  fs.writeFileSync(preCommitPath, preCommitHook)
  fs.chmodSync(preCommitPath, '755')
  console.log(`✅ Pre-commit hook saved to: ${preCommitPath}`)
}

/**
 * Main setup function
 */
function setupMonitoring() {
  console.log('🚀 Setting up brand compliance monitoring system...')
  console.log('='.repeat(60))

  try {
    // Setup all components
    const config = setupMonitoringConfig()
    setupMonitoringDirectories()
    setupPackageScripts()
    setupEnvironmentTemplate()
    setupServiceInitialization()
    setupCIIntegration()
    setupPreCommitHooks()

    console.log('\n' + '='.repeat(60))
    console.log('✅ MONITORING SETUP COMPLETE!')
    console.log('='.repeat(60))

    console.log('\n📋 Next Steps:')
    console.log(
      '1. Review monitoring configuration in frontend/src/config/monitoring.json'
    )
    console.log(
      '2. Copy frontend/.env.monitoring.example to .env.local and configure'
    )
    console.log('3. Import monitoring initialization in your main app file:')
    console.log(
      '   import { initializeMonitoring } from "./utils/monitoring/init"'
    )
    console.log(
      '4. Add BrandMonitoringDashboard component to your admin interface'
    )
    console.log('5. Test the setup with: npm run audit:brand-compliance')

    console.log('\n🔧 Available Commands:')
    console.log(
      '- npm run audit:brand-compliance     # Run full compliance audit'
    )
    console.log('- npm run validate:brand-compliance  # Quick validation check')
    console.log(
      '- npm run test:brand-compliance      # Run brand compliance tests'
    )
    console.log(
      '- npm run report:compliance          # Generate compliance report'
    )
    console.log(
      '- npm run report:performance         # Generate performance report'
    )

    console.log('\n📊 Monitoring Features:')
    console.log('- Real-time compliance tracking')
    console.log('- Performance monitoring (fonts, CSS, validation)')
    console.log('- Automated alerting system')
    console.log('- Weekly and monthly reporting')
    console.log('- CI/CD integration')
    console.log('- Pre-commit validation hooks')

    return config
  } catch (error) {
    console.error('💥 Setup failed:', error.message)
    process.exit(1)
  }
}

// Handle command line arguments
if (require.main === module) {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Brand Compliance Monitoring Setup

Usage: node monitoring-setup.js [options]

Options:
  --help, -h     Show this help message
  --config-only  Setup configuration only
  --ci-only      Setup CI/CD integration only
  
Examples:
  node monitoring-setup.js              # Full setup
  node monitoring-setup.js --config-only # Configuration only
    `)
    process.exit(0)
  }

  if (args.includes('--config-only')) {
    setupMonitoringConfig()
  } else if (args.includes('--ci-only')) {
    setupCIIntegration()
  } else {
    setupMonitoring()
  }
}

module.exports = {
  setupMonitoring,
  setupMonitoringConfig,
  setupMonitoringDirectories,
  setupPackageScripts,
  DEFAULT_CONFIG,
}
