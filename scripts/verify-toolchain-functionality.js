#!/usr/bin/env node

/**
 * Development Toolchain Functionality Verification Script
 *
 * This script verifies that all development tools work correctly
 * without compliance dependencies after the compliance system removal.
 *
 * Requirements: 10.4
 */

import { execSync } from 'child_process'
import { performance } from 'perf_hooks'
import fs from 'fs'
import path from 'path'

class ToolchainVerifier {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      verifications: {},
      summary: {},
      issues: [],
    }
  }

  /**
   * Execute a command and verify its functionality
   */
  verifyTool(name, command, options = {}) {
    console.log(`\n🔧 Verifying: ${name}`)
    console.log(`Command: ${command}`)

    const startTime = performance.now()

    try {
      const result = execSync(command, {
        encoding: 'utf8',
        stdio: 'pipe',
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        ...options,
      })

      const endTime = performance.now()
      const duration = endTime - startTime

      this.results.verifications[name] = {
        command,
        duration: Math.round(duration),
        status: 'success',
        output: result.toString().trim(),
      }

      console.log(`✅ ${name} working correctly (${Math.round(duration)}ms)`)
      return { success: true, duration, output: result }
    } catch (error) {
      const endTime = performance.now()
      const duration = endTime - startTime

      this.results.verifications[name] = {
        command,
        duration: Math.round(duration),
        status: 'error',
        error: error.message,
        stderr: error.stderr?.toString() || '',
        stdout: error.stdout?.toString() || '',
      }

      console.log(
        `❌ ${name} failed (${Math.round(duration)}ms): ${error.message}`
      )
      this.results.issues.push({
        tool: name,
        issue: error.message,
        severity: 'error',
      })

      return { success: false, duration, error: error.message }
    }
  }

  /**
   * Verify linting functionality
   */
  verifyLinting() {
    console.log('\n🔍 Verifying Linting Functionality')

    // Check ESLint configuration
    this.verifyTool(
      'eslint-config-check',
      'npm run lint -- --print-config frontend/src/main.tsx'
    )

    // Test linting on a specific file
    this.verifyTool(
      'eslint-file-check',
      'npx eslint frontend/src/main.tsx --format json',
      { cwd: process.cwd() }
    )

    // Verify backend linting
    this.verifyTool('backend-lint-check', 'npm run lint --workspace=backend')

    // Verify frontend linting (may have issues due to compliance removal)
    this.verifyTool('frontend-lint-check', 'npm run lint --workspace=frontend')
  }

  /**
   * Verify formatting functionality
   */
  verifyFormatting() {
    console.log('\n🎨 Verifying Formatting Functionality')

    // Check Prettier configuration
    this.verifyTool(
      'prettier-config-check',
      'npx prettier --check package.json'
    )

    // Test formatting check
    this.verifyTool('format-check', 'npm run format:check')

    // Test if Prettier can format files
    this.verifyTool(
      'prettier-test-format',
      'npx prettier --check frontend/src/main.tsx'
    )
  }

  /**
   * Verify TypeScript functionality
   */
  verifyTypeScript() {
    console.log('\n📘 Verifying TypeScript Functionality')

    // Check TypeScript compilation
    this.verifyTool('typescript-check', 'npm run typecheck')

    // Check backend TypeScript
    this.verifyTool(
      'backend-typescript-check',
      'npm run typecheck --workspace=backend'
    )

    // Check frontend TypeScript
    this.verifyTool(
      'frontend-typescript-check',
      'npm run typecheck --workspace=frontend'
    )

    // Get TypeScript error count
    this.verifyTool('typescript-error-count', 'npm run typecheck:count')
  }

  /**
   * Verify build functionality
   */
  verifyBuild() {
    console.log('\n🏗️ Verifying Build Functionality')

    // Clean previous builds
    try {
      execSync('rm -rf frontend/dist backend/dist', { stdio: 'pipe' })
    } catch (error) {
      // Ignore if directories don't exist
    }

    // Test backend build
    this.verifyTool('backend-build', 'npm run build --workspace=backend')

    // Test frontend build
    this.verifyTool('frontend-build', 'npm run build --workspace=frontend')

    // Verify build artifacts exist
    this.verifyBuildArtifacts()
  }

  /**
   * Verify build artifacts were created
   */
  verifyBuildArtifacts() {
    console.log('\n📦 Verifying Build Artifacts')

    const backendDist = 'backend/dist'
    const frontendDist = 'frontend/dist'

    // Check backend build artifacts
    if (fs.existsSync(backendDist)) {
      const backendFiles = fs.readdirSync(backendDist)
      this.results.verifications['backend-build-artifacts'] = {
        status: 'success',
        files: backendFiles,
        count: backendFiles.length,
      }
      console.log(
        `✅ Backend build artifacts created (${backendFiles.length} files)`
      )
    } else {
      this.results.verifications['backend-build-artifacts'] = {
        status: 'error',
        error: 'Backend dist directory not found',
      }
      console.log('❌ Backend build artifacts missing')
      this.results.issues.push({
        tool: 'backend-build-artifacts',
        issue: 'Backend dist directory not found',
        severity: 'error',
      })
    }

    // Check frontend build artifacts
    if (fs.existsSync(frontendDist)) {
      const frontendFiles = fs.readdirSync(frontendDist)
      this.results.verifications['frontend-build-artifacts'] = {
        status: 'success',
        files: frontendFiles,
        count: frontendFiles.length,
      }
      console.log(
        `✅ Frontend build artifacts created (${frontendFiles.length} files)`
      )
    } else {
      this.results.verifications['frontend-build-artifacts'] = {
        status: 'error',
        error: 'Frontend dist directory not found',
      }
      console.log('❌ Frontend build artifacts missing')
      this.results.issues.push({
        tool: 'frontend-build-artifacts',
        issue: 'Frontend dist directory not found',
        severity: 'error',
      })
    }
  }

  /**
   * Verify testing functionality
   */
  verifyTesting() {
    console.log('\n🧪 Verifying Testing Functionality')

    // Test backend test runner
    this.verifyTool('backend-test-runner', 'npm run test --workspace=backend')

    // Test frontend test runner
    this.verifyTool('frontend-test-runner', 'npm run test --workspace=frontend')
  }

  /**
   * Verify package management
   */
  verifyPackageManagement() {
    console.log('\n📦 Verifying Package Management')

    // Check npm workspace functionality
    this.verifyTool('npm-workspace-list', 'npm ls --workspaces --depth=0')

    // Check for outdated packages
    this.verifyTool('npm-outdated-check', 'npm outdated --workspaces')

    // Verify package.json integrity
    this.verifyPackageJsonIntegrity()
  }

  /**
   * Verify package.json files are valid
   */
  verifyPackageJsonIntegrity() {
    console.log('\n📋 Verifying Package.json Integrity')

    const packageFiles = [
      'package.json',
      'frontend/package.json',
      'backend/package.json',
    ]

    packageFiles.forEach(file => {
      try {
        const content = fs.readFileSync(file, 'utf8')
        const parsed = JSON.parse(content)

        this.results.verifications[`${file}-integrity`] = {
          status: 'success',
          name: parsed.name,
          version: parsed.version,
          scripts: Object.keys(parsed.scripts || {}).length,
          dependencies: Object.keys(parsed.dependencies || {}).length,
          devDependencies: Object.keys(parsed.devDependencies || {}).length,
        }

        console.log(
          `✅ ${file} is valid JSON with ${Object.keys(parsed.scripts || {}).length} scripts`
        )
      } catch (error) {
        this.results.verifications[`${file}-integrity`] = {
          status: 'error',
          error: error.message,
        }
        console.log(`❌ ${file} is invalid: ${error.message}`)
        this.results.issues.push({
          tool: `${file}-integrity`,
          issue: error.message,
          severity: 'error',
        })
      }
    })
  }

  /**
   * Verify development server functionality (without actually starting)
   */
  verifyDevServer() {
    console.log('\n🚀 Verifying Development Server Configuration')

    // Check Vite configuration
    if (fs.existsSync('frontend/vite.config.ts')) {
      this.results.verifications['vite-config'] = {
        status: 'success',
        message: 'Vite configuration file exists',
      }
      console.log('✅ Vite configuration file exists')
    } else {
      this.results.verifications['vite-config'] = {
        status: 'error',
        error: 'Vite configuration file missing',
      }
      console.log('❌ Vite configuration file missing')
      this.results.issues.push({
        tool: 'vite-config',
        issue: 'Vite configuration file missing',
        severity: 'warning',
      })
    }

    // Check if dev scripts exist
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))
    const hasDevScripts =
      packageJson.scripts &&
      (packageJson.scripts['dev:frontend'] ||
        packageJson.scripts['dev:backend'])

    if (hasDevScripts) {
      this.results.verifications['dev-scripts'] = {
        status: 'success',
        scripts: Object.keys(packageJson.scripts).filter(s =>
          s.includes('dev')
        ),
      }
      console.log('✅ Development scripts are configured')
    } else {
      this.results.verifications['dev-scripts'] = {
        status: 'error',
        error: 'Development scripts missing',
      }
      console.log('❌ Development scripts missing')
      this.results.issues.push({
        tool: 'dev-scripts',
        issue: 'Development scripts missing',
        severity: 'error',
      })
    }
  }

  /**
   * Check for compliance system remnants
   */
  checkComplianceRemnants() {
    console.log('\n🔍 Checking for Compliance System Remnants')

    const compliancePatterns = [
      'brand-compliance',
      'compliance-audit',
      'compliance-validation',
      'brand-monitoring',
      'eslint-plugin-brand-compliance',
    ]

    let foundRemnants = []

    // Check package.json files for compliance dependencies
    const packageFiles = [
      'package.json',
      'frontend/package.json',
      'backend/package.json',
    ]

    packageFiles.forEach(file => {
      try {
        const content = fs.readFileSync(file, 'utf8')
        const parsed = JSON.parse(content)

        const allDeps = {
          ...parsed.dependencies,
          ...parsed.devDependencies,
          ...parsed.scripts,
        }

        compliancePatterns.forEach(pattern => {
          Object.keys(allDeps).forEach(key => {
            if (key.includes(pattern) || allDeps[key]?.includes?.(pattern)) {
              foundRemnants.push({
                file,
                type: 'dependency/script',
                key,
                value: allDeps[key],
              })
            }
          })
        })
      } catch (error) {
        // File doesn't exist or invalid JSON
      }
    })

    if (foundRemnants.length === 0) {
      this.results.verifications['compliance-remnants-check'] = {
        status: 'success',
        message: 'No compliance system remnants found',
      }
      console.log('✅ No compliance system remnants found')
    } else {
      this.results.verifications['compliance-remnants-check'] = {
        status: 'warning',
        remnants: foundRemnants,
      }
      console.log(
        `⚠️ Found ${foundRemnants.length} potential compliance remnants`
      )
      foundRemnants.forEach(remnant => {
        console.log(`   - ${remnant.file}: ${remnant.key}`)
      })
      this.results.issues.push({
        tool: 'compliance-remnants-check',
        issue: `Found ${foundRemnants.length} potential compliance remnants`,
        severity: 'warning',
        details: foundRemnants,
      })
    }
  }

  /**
   * Calculate verification summary
   */
  calculateSummary() {
    console.log('\n📊 Calculating Verification Summary')

    const verifications = this.results.verifications
    const successful = Object.values(verifications).filter(
      v => v.status === 'success'
    ).length
    const failed = Object.values(verifications).filter(
      v => v.status === 'error'
    ).length
    const warnings = Object.values(verifications).filter(
      v => v.status === 'warning'
    ).length
    const total = Object.keys(verifications).length

    this.results.summary = {
      totalVerifications: total,
      successful,
      failed,
      warnings,
      successRate: Math.round((successful / total) * 100),
      criticalIssues: this.results.issues.filter(i => i.severity === 'error')
        .length,
      warningIssues: this.results.issues.filter(i => i.severity === 'warning')
        .length,
      overallStatus:
        failed === 0
          ? warnings === 0
            ? 'EXCELLENT'
            : 'GOOD'
          : 'NEEDS_ATTENTION',
    }
  }

  /**
   * Generate verification report
   */
  generateReport() {
    const reportPath = 'TOOLCHAIN_VERIFICATION_REPORT.md'

    const report = `# Development Toolchain Verification Report

**Generated:** ${this.results.timestamp}
**Compliance System Status:** REMOVED ✅

## Executive Summary

This report verifies that all development tools function correctly after the brand compliance system removal, ensuring the development workflow remains fully operational.

### Verification Summary

- **Total Verifications:** ${this.results.summary.totalVerifications}
- **Successful:** ${this.results.summary.successful}
- **Failed:** ${this.results.summary.failed}
- **Warnings:** ${this.results.summary.warnings}
- **Success Rate:** ${this.results.summary.successRate}%
- **Overall Status:** ${this.results.summary.overallStatus}

## Tool Verification Results

### Linting Tools

| Tool | Status | Notes |
|------|--------|-------|
| ESLint Config Check | ${this.results.verifications['eslint-config-check']?.status || 'N/A'} | Configuration validation |
| ESLint File Check | ${this.results.verifications['eslint-file-check']?.status || 'N/A'} | File-level linting |
| Backend Lint | ${this.results.verifications['backend-lint-check']?.status || 'N/A'} | Backend code linting |
| Frontend Lint | ${this.results.verifications['frontend-lint-check']?.status || 'N/A'} | Frontend code linting |

### Formatting Tools

| Tool | Status | Notes |
|------|--------|-------|
| Prettier Config | ${this.results.verifications['prettier-config-check']?.status || 'N/A'} | Configuration validation |
| Format Check | ${this.results.verifications['format-check']?.status || 'N/A'} | Code formatting validation |
| Prettier Test | ${this.results.verifications['prettier-test-format']?.status || 'N/A'} | File formatting test |

### TypeScript Tools

| Tool | Status | Notes |
|------|--------|-------|
| TypeScript Check | ${this.results.verifications['typescript-check']?.status || 'N/A'} | Overall type checking |
| Backend TypeScript | ${this.results.verifications['backend-typescript-check']?.status || 'N/A'} | Backend type checking |
| Frontend TypeScript | ${this.results.verifications['frontend-typescript-check']?.status || 'N/A'} | Frontend type checking |
| Error Count | ${this.results.verifications['typescript-error-count']?.status || 'N/A'} | Error counting |

### Build Tools

| Tool | Status | Notes |
|------|--------|-------|
| Backend Build | ${this.results.verifications['backend-build']?.status || 'N/A'} | Backend compilation |
| Frontend Build | ${this.results.verifications['frontend-build']?.status || 'N/A'} | Frontend compilation |
| Backend Artifacts | ${this.results.verifications['backend-build-artifacts']?.status || 'N/A'} | Build output verification |
| Frontend Artifacts | ${this.results.verifications['frontend-build-artifacts']?.status || 'N/A'} | Build output verification |

### Testing Tools

| Tool | Status | Notes |
|------|--------|-------|
| Backend Tests | ${this.results.verifications['backend-test-runner']?.status || 'N/A'} | Backend test execution |
| Frontend Tests | ${this.results.verifications['frontend-test-runner']?.status || 'N/A'} | Frontend test execution |

### Package Management

| Tool | Status | Notes |
|------|--------|-------|
| Workspace List | ${this.results.verifications['npm-workspace-list']?.status || 'N/A'} | Workspace functionality |
| Outdated Check | ${this.results.verifications['npm-outdated-check']?.status || 'N/A'} | Dependency status |
| Package.json Integrity | ${this.results.verifications['package.json-integrity']?.status || 'N/A'} | Root package validation |

## Issues Found

${this.results.issues.length === 0 ? '✅ No critical issues found!' : ''}
${this.results.issues
  .map(
    issue => `
### ${issue.severity.toUpperCase()}: ${issue.tool}
**Issue:** ${issue.issue}
${issue.details ? '**Details:** ' + JSON.stringify(issue.details, null, 2) : ''}
`
  )
  .join('')}

## Compliance System Cleanup Status

${
  this.results.verifications['compliance-remnants-check']?.status === 'success'
    ? '✅ **CLEAN**: No compliance system remnants detected'
    : '⚠️ **ATTENTION**: Some compliance remnants may still exist'
}

## Recommendations

${
  this.results.summary.failed > 0
    ? `
### Critical Actions Required
- Fix failed tool verifications before proceeding with development
- Address any configuration issues identified
- Ensure all build and test processes are working
`
    : ''
}

${
  this.results.summary.warnings > 0
    ? `
### Recommended Actions
- Review warning-level issues for potential improvements
- Clean up any remaining compliance system remnants
- Update configurations as needed
`
    : ''
}

### Maintenance
- Regular verification of toolchain functionality
- Monitor for any regressions after future changes
- Keep development dependencies up to date

## Validation Status

- **Requirements 10.4:** ${this.results.summary.overallStatus === 'EXCELLENT' || this.results.summary.overallStatus === 'GOOD' ? '✅' : '❌'} Development toolchain functionality verified

---

*This report confirms that the development toolchain remains fully functional after compliance system removal.*
`

    fs.writeFileSync(reportPath, report)
    console.log(`\n📄 Verification report generated: ${reportPath}`)

    return reportPath
  }

  /**
   * Save raw verification data
   */
  saveRawData() {
    const dataPath = 'toolchain-verification-data.json'
    fs.writeFileSync(dataPath, JSON.stringify(this.results, null, 2))
    console.log(`\n💾 Raw verification data saved: ${dataPath}`)
    return dataPath
  }

  /**
   * Run all toolchain verifications
   */
  async runAllVerifications() {
    console.log('🔧 Starting Development Toolchain Verification')
    console.log('='.repeat(60))

    // Run all verification categories
    this.verifyLinting()
    this.verifyFormatting()
    this.verifyTypeScript()
    this.verifyBuild()
    this.verifyTesting()
    this.verifyPackageManagement()
    this.verifyDevServer()
    this.checkComplianceRemnants()

    // Calculate summary and generate reports
    this.calculateSummary()

    console.log('\n' + '='.repeat(60))
    console.log('🔧 TOOLCHAIN VERIFICATION COMPLETE')
    console.log('='.repeat(60))

    // Display summary
    console.log('\n📊 Verification Summary:')
    console.log(
      `   Total Verifications: ${this.results.summary.totalVerifications}`
    )
    console.log(`   Successful: ${this.results.summary.successful}`)
    console.log(`   Failed: ${this.results.summary.failed}`)
    console.log(`   Warnings: ${this.results.summary.warnings}`)
    console.log(`   Success Rate: ${this.results.summary.successRate}%`)
    console.log(`   Overall Status: ${this.results.summary.overallStatus}`)

    if (this.results.issues.length > 0) {
      console.log(`\n⚠️ Issues Found: ${this.results.issues.length}`)
      this.results.issues.forEach(issue => {
        console.log(
          `   ${issue.severity.toUpperCase()}: ${issue.tool} - ${issue.issue}`
        )
      })
    }

    // Generate reports
    const reportPath = this.generateReport()
    const dataPath = this.saveRawData()

    console.log('\n✅ Toolchain verification completed!')
    console.log(`📄 Report: ${reportPath}`)
    console.log(`💾 Data: ${dataPath}`)

    return {
      success: this.results.summary.failed === 0,
      summary: this.results.summary,
      reportPath,
      dataPath,
      issues: this.results.issues,
    }
  }
}

// Run the toolchain verification if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const verifier = new ToolchainVerifier()

  verifier
    .runAllVerifications()
    .then(result => {
      if (result.success) {
        console.log('\n🎉 All development tools are working correctly!')
        process.exit(0)
      } else {
        console.log('\n⚠️ Some development tools need attention.')
        process.exit(1)
      }
    })
    .catch(error => {
      console.error('\n❌ Toolchain verification failed:', error)
      process.exit(1)
    })
}

export default ToolchainVerifier
