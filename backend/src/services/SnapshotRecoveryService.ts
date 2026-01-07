/**
 * Snapshot recovery service for handling corruption and automatic recovery
 *
 * This service provides automatic recovery mechanisms for corrupted snapshots
 * and current.json pointers, with fallback to previous successful snapshots.
 */

import fs from 'fs/promises'
import path from 'path'
import { logger } from '../utils/logger.js'
import { SnapshotIntegrityValidator } from './SnapshotIntegrityValidator.js'
import type {
  CurrentSnapshotPointer,
  Snapshot,
  SnapshotStoreConfig,
} from '../types/snapshots.js'
import type {
  SnapshotStoreIntegrityResult,
  CurrentPointerIntegrityResult,
  SnapshotIntegrityResult,
} from './SnapshotIntegrityValidator.js'

/**
 * Result of a recovery operation
 */
export interface RecoveryResult {
  /** Whether the recovery was successful */
  success: boolean

  /** Actions taken during recovery */
  actionsTaken: string[]

  /** Issues that could not be automatically resolved */
  remainingIssues: string[]

  /** Manual steps required to complete recovery */
  manualStepsRequired: string[]

  /** ID of the snapshot now being used as current (if any) */
  currentSnapshotId?: string

  /** Metadata about the recovery process */
  recoveryMetadata: {
    recoveredAt: string
    recoveryDurationMs: number
    recoveryType: 'automatic' | 'partial' | 'failed'
    backupsCreated: string[]
  }
}

/**
 * Recovery options for controlling recovery behavior
 */
export interface RecoveryOptions {
  /** Whether to create backups before making changes */
  createBackups?: boolean

  /** Whether to remove corrupted files automatically */
  removeCorruptedFiles?: boolean

  /** Maximum age of snapshots to consider for recovery (in days) */
  maxRecoveryAgeDays?: number

  /** Whether to force recovery even if current state seems valid */
  forceRecovery?: boolean
}

/**
 * Snapshot recovery service
 */
export class SnapshotRecoveryService {
  private readonly integrityValidator: SnapshotIntegrityValidator

  constructor(private readonly config: Required<SnapshotStoreConfig>) {
    const snapshotsDir = path.join(config.cacheDir, 'snapshots')
    const currentPointerFile = path.join(config.cacheDir, 'current.json')

    this.integrityValidator = new SnapshotIntegrityValidator(
      config.cacheDir,
      snapshotsDir,
      currentPointerFile
    )
  }

  /**
   * Perform automatic recovery of the snapshot store
   */
  async recoverSnapshotStore(
    options: RecoveryOptions = {}
  ): Promise<RecoveryResult> {
    const startTime = Date.now()

    logger.info('Starting snapshot store recovery', {
      operation: 'recoverSnapshotStore',
      cache_dir: this.config.cacheDir,
      options,
    })

    const result: RecoveryResult = {
      success: false,
      actionsTaken: [],
      remainingIssues: [],
      manualStepsRequired: [],
      recoveryMetadata: {
        recoveredAt: new Date().toISOString(),
        recoveryDurationMs: 0,
        recoveryType: 'failed',
        backupsCreated: [],
      },
    }

    try {
      // First, validate the current state
      const integrityResult =
        await this.integrityValidator.validateSnapshotStore()

      if (integrityResult.isHealthy && !options.forceRecovery) {
        result.success = true
        result.actionsTaken.push(
          'Snapshot store is already healthy - no recovery needed'
        )
        result.recoveryMetadata.recoveryType = 'automatic'
        return this.finalizeRecoveryResult(result, startTime)
      }

      // Create backups if requested
      if (options.createBackups !== false) {
        await this.createRecoveryBackups(result)
      }

      // Recover current pointer if needed
      if (!integrityResult.currentPointer.isValid) {
        await this.recoverCurrentPointer(
          integrityResult.currentPointer,
          result,
          options
        )
      }

      // Remove corrupted snapshots if requested
      if (options.removeCorruptedFiles) {
        await this.removeCorruptedSnapshots(integrityResult.snapshots, result)
      }

      // Validate recovery success
      const postRecoveryResult =
        await this.integrityValidator.validateSnapshotStore()

      if (postRecoveryResult.isHealthy) {
        result.success = true
        result.recoveryMetadata.recoveryType = 'automatic'
        result.currentSnapshotId =
          postRecoveryResult.summary.latestSuccessfulSnapshot

        logger.info('Snapshot store recovery completed successfully', {
          operation: 'recoverSnapshotStore',
          actions_taken: result.actionsTaken.length,
          current_snapshot: result.currentSnapshotId,
          duration_ms: Date.now() - startTime,
        })
      } else {
        result.recoveryMetadata.recoveryType = 'partial'
        result.remainingIssues = postRecoveryResult.storeIssues
        result.manualStepsRequired =
          postRecoveryResult.storeRecoveryRecommendations

        logger.warn('Snapshot store recovery partially successful', {
          operation: 'recoverSnapshotStore',
          actions_taken: result.actionsTaken.length,
          remaining_issues: result.remainingIssues.length,
          manual_steps_required: result.manualStepsRequired.length,
          duration_ms: Date.now() - startTime,
        })
      }

      return this.finalizeRecoveryResult(result, startTime)
    } catch (error) {
      result.remainingIssues.push(
        `Recovery failed with unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
      result.manualStepsRequired.push(
        'Check system logs for detailed error information'
      )
      result.manualStepsRequired.push('Verify file permissions and disk space')
      result.manualStepsRequired.push(
        'Consider manual snapshot store reconstruction'
      )

      logger.error('Snapshot store recovery failed with unexpected error', {
        operation: 'recoverSnapshotStore',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration_ms: Date.now() - startTime,
      })

      return this.finalizeRecoveryResult(result, startTime)
    }
  }

  /**
   * Recover a corrupted current.json pointer
   */
  async recoverCurrentPointer(
    pointerResult: CurrentPointerIntegrityResult,
    recoveryResult: RecoveryResult,
    _options: RecoveryOptions
  ): Promise<void> {
    const currentPointerFile = path.join(this.config.cacheDir, 'current.json')

    logger.info('Starting current pointer recovery', {
      operation: 'recoverCurrentPointer',
      pointer_valid: pointerResult.isValid,
      alternatives_available: pointerResult.alternativeSnapshots.length,
    })

    try {
      // If we have alternative successful snapshots, use the latest one
      if (pointerResult.alternativeSnapshots.length > 0) {
        const latestSuccessfulId = pointerResult.alternativeSnapshots[0] // Already sorted newest first

        if (!latestSuccessfulId) {
          recoveryResult.remainingIssues.push(
            'No valid snapshot ID found in alternative snapshots'
          )
          return
        }

        // Get the snapshot to extract metadata
        const snapshotPath = path.join(
          this.config.cacheDir,
          'snapshots',
          `${latestSuccessfulId}.json`
        )
        const snapshotContent = await fs.readFile(snapshotPath, 'utf-8')
        const snapshot: Snapshot = JSON.parse(snapshotContent)

        // Create new current pointer
        const newPointer: CurrentSnapshotPointer = {
          snapshot_id: latestSuccessfulId,
          updated_at: new Date().toISOString(),
          schema_version: snapshot.schema_version,
          calculation_version: snapshot.calculation_version,
        }

        // Write new pointer atomically
        const tempPath = `${currentPointerFile}.recovery.tmp`
        await fs.writeFile(
          tempPath,
          JSON.stringify(newPointer, null, 2),
          'utf-8'
        )
        await fs.rename(tempPath, currentPointerFile)

        recoveryResult.actionsTaken.push(
          `Recreated current.json pointer to reference snapshot ${latestSuccessfulId}`
        )
        recoveryResult.currentSnapshotId = latestSuccessfulId

        logger.info('Current pointer recovery successful', {
          operation: 'recoverCurrentPointer',
          new_snapshot_id: latestSuccessfulId,
          snapshot_created_at: snapshot.created_at,
          schema_version: snapshot.schema_version,
          calculation_version: snapshot.calculation_version,
        })
      } else {
        recoveryResult.remainingIssues.push(
          'No successful snapshots available for current pointer recovery'
        )
        recoveryResult.manualStepsRequired.push(
          'Run data refresh to create a successful snapshot'
        )
        recoveryResult.manualStepsRequired.push(
          'Manually create current.json pointer after successful refresh'
        )

        logger.warn(
          'Current pointer recovery failed - no successful snapshots available',
          {
            operation: 'recoverCurrentPointer',
          }
        )
      }
    } catch (error) {
      recoveryResult.remainingIssues.push(
        `Current pointer recovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
      recoveryResult.manualStepsRequired.push(
        'Manually recreate current.json with proper structure'
      )

      logger.error('Current pointer recovery failed with error', {
        operation: 'recoverCurrentPointer',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  /**
   * Remove corrupted snapshot files
   */
  async removeCorruptedSnapshots(
    snapshotResults: SnapshotIntegrityResult[],
    recoveryResult: RecoveryResult
  ): Promise<void> {
    logger.info('Starting corrupted snapshot removal', {
      operation: 'removeCorruptedSnapshots',
      total_snapshots: snapshotResults.length,
    })

    let removedCount = 0

    for (const snapshotResult of snapshotResults) {
      if (
        !snapshotResult.isValid &&
        snapshotResult.validationMetadata.filePath
      ) {
        try {
          // Create backup before removal if file is accessible
          if (snapshotResult.fileAccessible) {
            const backupPath = `${snapshotResult.validationMetadata.filePath}.corrupted.backup`
            await fs.copyFile(
              snapshotResult.validationMetadata.filePath,
              backupPath
            )
            recoveryResult.recoveryMetadata.backupsCreated.push(backupPath)
          }

          // Remove the corrupted file
          await fs.unlink(snapshotResult.validationMetadata.filePath)

          recoveryResult.actionsTaken.push(
            `Removed corrupted snapshot file: ${snapshotResult.validationMetadata.snapshotId}`
          )
          removedCount++

          logger.info('Removed corrupted snapshot file', {
            operation: 'removeCorruptedSnapshots',
            snapshot_id: snapshotResult.validationMetadata.snapshotId,
            file_path: snapshotResult.validationMetadata.filePath,
            backup_created: snapshotResult.fileAccessible,
          })
        } catch (error) {
          recoveryResult.remainingIssues.push(
            `Failed to remove corrupted snapshot ${snapshotResult.validationMetadata.snapshotId}: ${error instanceof Error ? error.message : 'Unknown error'}`
          )

          logger.error('Failed to remove corrupted snapshot file', {
            operation: 'removeCorruptedSnapshots',
            snapshot_id: snapshotResult.validationMetadata.snapshotId,
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      }
    }

    if (removedCount > 0) {
      logger.info('Corrupted snapshot removal completed', {
        operation: 'removeCorruptedSnapshots',
        removed_count: removedCount,
        backups_created: recoveryResult.recoveryMetadata.backupsCreated.length,
      })
    }
  }

  /**
   * Create backups before recovery operations
   */
  async createRecoveryBackups(recoveryResult: RecoveryResult): Promise<void> {
    const backupDir = path.join(this.config.cacheDir, 'recovery-backups')
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupSubDir = path.join(backupDir, `backup-${timestamp}`)

    logger.info('Creating recovery backups', {
      operation: 'createRecoveryBackups',
      backup_dir: backupSubDir,
    })

    try {
      await fs.mkdir(backupSubDir, { recursive: true })

      // Backup current.json if it exists
      const currentPointerFile = path.join(this.config.cacheDir, 'current.json')
      try {
        await fs.access(currentPointerFile)
        const backupPointerPath = path.join(backupSubDir, 'current.json')
        await fs.copyFile(currentPointerFile, backupPointerPath)
        recoveryResult.recoveryMetadata.backupsCreated.push(backupPointerPath)
        recoveryResult.actionsTaken.push(
          'Created backup of current.json pointer'
        )
      } catch {
        // current.json doesn't exist, which is fine
      }

      // Backup snapshots directory structure (metadata only, not full files due to size)
      const snapshotsDir = path.join(this.config.cacheDir, 'snapshots')
      try {
        const files = await fs.readdir(snapshotsDir)
        const snapshotFiles = files.filter(file => file.endsWith('.json'))

        const inventoryPath = path.join(backupSubDir, 'snapshot-inventory.json')
        const inventory = {
          backupCreatedAt: new Date().toISOString(),
          snapshotCount: snapshotFiles.length,
          snapshotFiles: snapshotFiles,
          backupReason: 'Pre-recovery backup',
        }

        await fs.writeFile(
          inventoryPath,
          JSON.stringify(inventory, null, 2),
          'utf-8'
        )
        recoveryResult.recoveryMetadata.backupsCreated.push(inventoryPath)
        recoveryResult.actionsTaken.push(
          `Created snapshot inventory backup with ${snapshotFiles.length} files`
        )
      } catch {
        // Snapshots directory might not exist
      }

      logger.info('Recovery backups created successfully', {
        operation: 'createRecoveryBackups',
        backup_dir: backupSubDir,
        backups_created: recoveryResult.recoveryMetadata.backupsCreated.length,
      })
    } catch (error) {
      recoveryResult.remainingIssues.push(
        `Failed to create recovery backups: ${error instanceof Error ? error.message : 'Unknown error'}`
      )

      logger.error('Failed to create recovery backups', {
        operation: 'createRecoveryBackups',
        backup_dir: backupSubDir,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  /**
   * Get recovery guidance for manual intervention
   */
  async getRecoveryGuidance(): Promise<{
    integrityStatus: SnapshotStoreIntegrityResult
    recoverySteps: string[]
    urgencyLevel: 'low' | 'medium' | 'high' | 'critical'
    estimatedRecoveryTime: string
  }> {
    const integrityStatus =
      await this.integrityValidator.validateSnapshotStore()
    const recoverySteps: string[] = []
    let urgencyLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'
    let estimatedRecoveryTime = '5-10 minutes'

    // Determine urgency and recovery steps based on issues found
    if (!integrityStatus.isHealthy) {
      if (integrityStatus.summary.successfulSnapshots === 0) {
        urgencyLevel = 'critical'
        estimatedRecoveryTime = '30-60 minutes'
        recoverySteps.push('CRITICAL: No successful snapshots available')
        recoverySteps.push('1. Run immediate data refresh: npm run refresh')
        recoverySteps.push('2. Verify refresh completes successfully')
        recoverySteps.push('3. Check that current.json is created')
      } else if (!integrityStatus.currentPointer.isValid) {
        urgencyLevel = 'high'
        estimatedRecoveryTime = '10-15 minutes'
        recoverySteps.push(
          'HIGH: Current pointer is corrupted but successful snapshots exist'
        )
        recoverySteps.push(
          '1. Run automatic recovery: await recoveryService.recoverSnapshotStore()'
        )
        recoverySteps.push(
          '2. If automatic recovery fails, manually recreate current.json'
        )
        recoverySteps.push(
          `3. Use latest successful snapshot: ${integrityStatus.summary.latestSuccessfulSnapshot}`
        )
      } else if (integrityStatus.summary.corruptedSnapshots > 0) {
        urgencyLevel = 'medium'
        estimatedRecoveryTime = '15-20 minutes'
        recoverySteps.push('MEDIUM: Some snapshots are corrupted')
        recoverySteps.push(
          '1. Run recovery with cleanup: recoveryService.recoverSnapshotStore({ removeCorruptedFiles: true })'
        )
        recoverySteps.push('2. Run data refresh to replace corrupted data')
        recoverySteps.push('3. Monitor for recurring corruption issues')
      }

      // Add general recovery steps
      recoverySteps.push('')
      recoverySteps.push('General recovery steps:')
      recoverySteps.push('- Check disk space and file permissions')
      recoverySteps.push('- Review system logs for underlying issues')
      recoverySteps.push('- Consider running integrity validation regularly')
      recoverySteps.push('- Set up monitoring for snapshot health')
    } else {
      recoverySteps.push('Snapshot store is healthy - no recovery needed')
      recoverySteps.push(
        'Consider running periodic integrity checks for monitoring'
      )
    }

    return {
      integrityStatus,
      recoverySteps,
      urgencyLevel,
      estimatedRecoveryTime,
    }
  }

  /**
   * Finalize recovery result with timing and summary
   */
  private finalizeRecoveryResult(
    result: RecoveryResult,
    startTime: number
  ): RecoveryResult {
    result.recoveryMetadata.recoveryDurationMs = Date.now() - startTime
    return result
  }
}
