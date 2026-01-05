#!/usr/bin/env node

/**
 * Snapshot integrity validation and recovery CLI script
 *
 * This script provides command-line access to snapshot integrity validation
 * and automatic recovery functionality.
 */

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { FileSnapshotStore } from '../services/FileSnapshotStore.js'
import type {
  SnapshotStoreIntegrityResult,
  SnapshotIntegrityResult,
} from '../services/SnapshotIntegrityValidator.js'
import type { RecoveryResult } from '../services/SnapshotRecoveryService.js'
// import { logger } from '../utils/logger.js'

type RecoveryGuidance = {
  integrityStatus: SnapshotStoreIntegrityResult
  recoverySteps: string[]
  urgencyLevel: 'low' | 'medium' | 'high' | 'critical'
  estimatedRecoveryTime: string
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Configuration
const CACHE_DIR = process.env.CACHE_DIR || join(__dirname, '../../cache')

/**
 * Display usage information
 */
function displayUsage(): void {
  console.log(`
Snapshot Integrity Validation and Recovery Tool

Usage: npm run validate-snapshots [command] [options]

Commands:
  validate    - Validate snapshot store integrity (default)
  recover     - Attempt automatic recovery of corrupted snapshots
  guidance    - Get recovery guidance for manual intervention
  help        - Display this help message

Options:
  --cache-dir <path>     - Override cache directory path
  --create-backups       - Create backups before recovery (default: true)
  --remove-corrupted     - Remove corrupted files during recovery (default: false)
  --force-recovery       - Force recovery even if store appears healthy
  --verbose              - Enable verbose logging

Examples:
  npm run validate-snapshots
  npm run validate-snapshots validate --verbose
  npm run validate-snapshots recover --create-backups --remove-corrupted
  npm run validate-snapshots guidance
`)
}

/**
 * Parse command line arguments
 */
function parseArguments(): {
  command: string
  cacheDir: string
  createBackups: boolean
  removeCorrupted: boolean
  forceRecovery: boolean
  verbose: boolean
} {
  const args = process.argv.slice(2)

  const config = {
    command: 'validate',
    cacheDir: CACHE_DIR,
    createBackups: true,
    removeCorrupted: false,
    forceRecovery: false,
    verbose: false,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    switch (arg) {
      case 'validate':
      case 'recover':
      case 'guidance':
      case 'help':
        config.command = arg
        break
      case '--cache-dir':
        config.cacheDir = args[++i] || config.cacheDir
        break
      case '--create-backups':
        config.createBackups = true
        break
      case '--no-create-backups':
        config.createBackups = false
        break
      case '--remove-corrupted':
        config.removeCorrupted = true
        break
      case '--force-recovery':
        config.forceRecovery = true
        break
      case '--verbose':
        config.verbose = true
        break
      default:
        if (arg.startsWith('--')) {
          console.error(`Unknown option: ${arg}`)
          process.exit(1)
        }
        break
    }
  }

  return config
}

/**
 * Format integrity result for display
 */
function formatIntegrityResult(result: SnapshotStoreIntegrityResult): void {
  console.log('\n📊 SNAPSHOT STORE INTEGRITY REPORT')
  console.log('=====================================\n')

  // Overall health status
  const healthStatus = result.isHealthy ? '✅ HEALTHY' : '❌ ISSUES DETECTED'
  console.log(`Overall Status: ${healthStatus}\n`)

  // Summary statistics
  console.log('📈 Summary Statistics:')
  console.log(`   Total Snapshots: ${result.summary.totalSnapshots}`)
  console.log(`   Valid Snapshots: ${result.summary.validSnapshots}`)
  console.log(`   Corrupted Snapshots: ${result.summary.corruptedSnapshots}`)
  console.log(`   Successful Snapshots: ${result.summary.successfulSnapshots}`)

  if (result.summary.latestSuccessfulSnapshot) {
    console.log(
      `   Latest Successful: ${result.summary.latestSuccessfulSnapshot}`
    )
  }
  console.log()

  // Current pointer status
  console.log('🎯 Current Pointer Status:')
  const pointerStatus = result.currentPointer.isValid
    ? '✅ Valid'
    : '❌ Invalid'
  console.log(`   Status: ${pointerStatus}`)

  if (!result.currentPointer.isValid) {
    console.log('   Issues:')
    result.currentPointer.issues.forEach((issue: string) => {
      console.log(`     - ${issue}`)
    })
  }

  if (result.currentPointer.alternativeSnapshots.length > 0) {
    console.log(
      `   Alternative Snapshots Available: ${result.currentPointer.alternativeSnapshots.length}`
    )
  }
  console.log()

  // Store-level issues
  if (result.storeIssues.length > 0) {
    console.log('⚠️  Store Issues:')
    result.storeIssues.forEach((issue: string) => {
      console.log(`   - ${issue}`)
    })
    console.log()
  }

  // Recovery recommendations
  if (result.storeRecoveryRecommendations.length > 0) {
    console.log('🔧 Recovery Recommendations:')
    result.storeRecoveryRecommendations.forEach((rec: string) => {
      console.log(`   - ${rec}`)
    })
    console.log()
  }

  // Individual snapshot issues (if any)
  const corruptedSnapshots = result.snapshots.filter(
    (s: SnapshotIntegrityResult) => !s.isValid
  )
  if (corruptedSnapshots.length > 0) {
    console.log('🚨 Corrupted Snapshots:')
    corruptedSnapshots.forEach((snapshot: SnapshotIntegrityResult) => {
      console.log(`   Snapshot ${snapshot.validationMetadata.snapshotId}:`)
      snapshot.corruptionIssues.forEach((issue: string) => {
        console.log(`     - ${issue}`)
      })
    })
    console.log()
  }
}

/**
 * Format recovery result for display
 */
function formatRecoveryResult(result: RecoveryResult): void {
  console.log('\n🔧 SNAPSHOT STORE RECOVERY REPORT')
  console.log('==================================\n')

  // Recovery status
  const recoveryStatus = result.success ? '✅ SUCCESSFUL' : '⚠️  PARTIAL/FAILED'
  console.log(`Recovery Status: ${recoveryStatus}`)
  console.log(
    `Recovery Type: ${result.recoveryMetadata.recoveryType.toUpperCase()}`
  )
  console.log(`Duration: ${result.recoveryMetadata.recoveryDurationMs}ms\n`)

  // Actions taken
  if (result.actionsTaken.length > 0) {
    console.log('✅ Actions Taken:')
    result.actionsTaken.forEach((action: string) => {
      console.log(`   - ${action}`)
    })
    console.log()
  }

  // Current snapshot
  if (result.currentSnapshotId) {
    console.log(`🎯 Current Snapshot: ${result.currentSnapshotId}\n`)
  }

  // Backups created
  if (result.recoveryMetadata.backupsCreated.length > 0) {
    console.log('💾 Backups Created:')
    result.recoveryMetadata.backupsCreated.forEach((backup: string) => {
      console.log(`   - ${backup}`)
    })
    console.log()
  }

  // Remaining issues
  if (result.remainingIssues.length > 0) {
    console.log('⚠️  Remaining Issues:')
    result.remainingIssues.forEach((issue: string) => {
      console.log(`   - ${issue}`)
    })
    console.log()
  }

  // Manual steps required
  if (result.manualStepsRequired.length > 0) {
    console.log('👤 Manual Steps Required:')
    result.manualStepsRequired.forEach((step: string) => {
      console.log(`   - ${step}`)
    })
    console.log()
  }
}

/**
 * Format recovery guidance for display
 */
function formatRecoveryGuidance(guidance: RecoveryGuidance): void {
  console.log('\n🩺 RECOVERY GUIDANCE')
  console.log('====================\n')

  // Urgency level
  const urgencyEmoji: Record<string, string> = {
    low: '🟢',
    medium: '🟡',
    high: '�',
    critical: '�',
  }
  const emoji = urgencyEmoji[guidance.urgencyLevel] || '⚪'

  console.log(`${emoji} Urgency Level: ${guidance.urgencyLevel.toUpperCase()}`)
  console.log(
    `⏱️  Estimated Recovery Time: ${guidance.estimatedRecoveryTime}\n`
  )

  // Recovery steps
  console.log('📋 Recovery Steps:')
  guidance.recoverySteps.forEach((step: string) => {
    console.log(`   ${step}`)
  })
  console.log()

  // Quick integrity summary
  const integrityStatus = guidance.integrityStatus
  console.log('📊 Quick Status Summary:')
  console.log(`   Healthy: ${integrityStatus.isHealthy ? 'Yes' : 'No'}`)
  console.log(`   Total Snapshots: ${integrityStatus.summary.totalSnapshots}`)
  console.log(
    `   Successful Snapshots: ${integrityStatus.summary.successfulSnapshots}`
  )
  console.log(
    `   Corrupted Snapshots: ${integrityStatus.summary.corruptedSnapshots}`
  )
  console.log(
    `   Current Pointer Valid: ${integrityStatus.currentPointer.isValid ? 'Yes' : 'No'}`
  )
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  const config = parseArguments()

  if (config.command === 'help') {
    displayUsage()
    return
  }

  console.log('🔍 Snapshot Integrity Validation Tool')
  console.log(`Cache Directory: ${config.cacheDir}`)
  console.log(`Command: ${config.command}`)
  console.log()

  try {
    // Initialize snapshot store
    const snapshotStore = new FileSnapshotStore({
      cacheDir: config.cacheDir,
      maxSnapshots: 100,
      maxAgeDays: 30,
      enableCompression: false,
    })

    // Check if store is ready
    const isReady = await snapshotStore.isReady()
    if (!isReady) {
      console.error('❌ Snapshot store is not ready or accessible')
      console.error('   Check cache directory permissions and disk space')
      process.exit(1)
    }

    switch (config.command) {
      case 'validate': {
        console.log('🔍 Validating snapshot store integrity...\n')
        const result = await snapshotStore.validateIntegrity()
        formatIntegrityResult(result)

        if (!result.isHealthy) {
          console.log(
            '💡 Tip: Run "npm run validate-snapshots recover" to attempt automatic recovery'
          )
          process.exit(1)
        }
        break
      }

      case 'recover': {
        console.log('🔧 Attempting snapshot store recovery...\n')
        const result = await snapshotStore.recoverFromCorruption({
          createBackups: config.createBackups,
          removeCorruptedFiles: config.removeCorrupted,
          forceRecovery: config.forceRecovery,
        })
        formatRecoveryResult(result)

        if (!result.success) {
          console.log(
            '💡 Tip: Run "npm run validate-snapshots guidance" for manual recovery steps'
          )
          process.exit(1)
        }
        break
      }

      case 'guidance': {
        console.log('🩺 Getting recovery guidance...\n')
        const guidance = await snapshotStore.getRecoveryGuidance()
        formatRecoveryGuidance(guidance)

        if (
          guidance.urgencyLevel === 'critical' ||
          guidance.urgencyLevel === 'high'
        ) {
          process.exit(1)
        }
        break
      }

      default:
        console.error(`Unknown command: ${config.command}`)
        displayUsage()
        process.exit(1)
    }

    console.log('✅ Operation completed successfully')
  } catch (error) {
    console.error(
      '❌ Operation failed:',
      error instanceof Error ? error.message : 'Unknown error'
    )

    if (config.verbose) {
      console.error('\nStack trace:')
      console.error(error)
    }

    process.exit(1)
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}
