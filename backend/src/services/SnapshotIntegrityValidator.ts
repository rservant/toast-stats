/**
 * Snapshot integrity validation and corruption detection service
 *
 * This service provides comprehensive validation of snapshot files and the
 * current.json pointer to detect corruption and provide recovery guidance.
 */

import fs from 'fs/promises'
import path from 'path'
import { z } from 'zod'
import { logger } from '../utils/logger.js'
import type {} from // Snapshot,
// CurrentSnapshotPointer,
// SnapshotValidationResult,
// SnapshotStatus,
'../types/snapshots.js'

/**
 * Result of snapshot integrity validation
 */
export interface SnapshotIntegrityResult {
  /** Whether the snapshot is valid and uncorrupted */
  isValid: boolean

  /** Specific corruption issues found */
  corruptionIssues: string[]

  /** Recovery recommendations */
  recoveryRecommendations: string[]

  /** Whether the snapshot file exists and is readable */
  fileAccessible: boolean

  /** Whether the JSON structure is valid */
  jsonValid: boolean

  /** Whether the snapshot schema is valid */
  schemaValid: boolean

  /** Whether the snapshot content is internally consistent */
  contentConsistent: boolean

  /** Metadata about the validation process */
  validationMetadata: {
    validatedAt: string
    validatorVersion: string
    validationDurationMs: number
    snapshotId?: string
    filePath?: string
  }
}

/**
 * Result of current pointer validation
 */
export interface CurrentPointerIntegrityResult {
  /** Whether the current pointer is valid */
  isValid: boolean

  /** Specific issues with the pointer */
  issues: string[]

  /** Recovery recommendations */
  recoveryRecommendations: string[]

  /** Whether the pointer file exists and is readable */
  fileAccessible: boolean

  /** Whether the JSON structure is valid */
  jsonValid: boolean

  /** Whether the referenced snapshot exists */
  referencedSnapshotExists: boolean

  /** Whether the referenced snapshot is successful */
  referencedSnapshotSuccessful: boolean

  /** Alternative successful snapshots that could be used */
  alternativeSnapshots: string[]

  /** Metadata about the validation process */
  validationMetadata: {
    validatedAt: string
    validatorVersion: string
    validationDurationMs: number
    pointerFilePath: string
    referencedSnapshotId?: string
  }
}

/**
 * Comprehensive snapshot store integrity result
 */
export interface SnapshotStoreIntegrityResult {
  /** Overall health status */
  isHealthy: boolean

  /** Current pointer validation result */
  currentPointer: CurrentPointerIntegrityResult

  /** Individual snapshot validation results */
  snapshots: SnapshotIntegrityResult[]

  /** Store-level issues */
  storeIssues: string[]

  /** Recovery recommendations for the entire store */
  storeRecoveryRecommendations: string[]

  /** Summary statistics */
  summary: {
    totalSnapshots: number
    validSnapshots: number
    corruptedSnapshots: number
    successfulSnapshots: number
    latestSuccessfulSnapshot?: string
  }
}

/**
 * Zod schema for validating snapshot structure
 */
const SnapshotSchema = z.object({
  snapshot_id: z.string().min(1),
  created_at: z.string().datetime(),
  schema_version: z.string().min(1),
  calculation_version: z.string().min(1),
  status: z.enum(['success', 'partial', 'failed']),
  errors: z.array(z.string()),
  payload: z.object({
    districts: z.array(z.any()).min(0),
    metadata: z.object({
      source: z.string().min(1),
      fetchedAt: z.string().datetime(),
      dataAsOfDate: z.string().min(1),
      districtCount: z.number().int().min(0),
      processingDurationMs: z.number().min(0),
    }),
  }),
})

/**
 * Zod schema for validating current pointer structure
 */
const CurrentPointerSchema = z.object({
  snapshot_id: z.string().min(1),
  updated_at: z.string().datetime(),
  schema_version: z.string().min(1),
  calculation_version: z.string().min(1),
})

/**
 * Snapshot integrity validator service
 */
export class SnapshotIntegrityValidator {
  private readonly validatorVersion = '1.0.0'

  constructor(
    private readonly cacheDir: string,
    private readonly snapshotsDir: string,
    private readonly currentPointerFile: string
  ) {}

  /**
   * Validate the integrity of a specific snapshot file
   */
  async validateSnapshot(snapshotId: string): Promise<SnapshotIntegrityResult> {
    const startTime = Date.now()
    const snapshotPath = path.join(this.snapshotsDir, `${snapshotId}.json`)

    logger.info('Starting snapshot integrity validation', {
      operation: 'validateSnapshot',
      snapshot_id: snapshotId,
      file_path: snapshotPath,
    })

    const result: SnapshotIntegrityResult = {
      isValid: false,
      corruptionIssues: [],
      recoveryRecommendations: [],
      fileAccessible: false,
      jsonValid: false,
      schemaValid: false,
      contentConsistent: false,
      validationMetadata: {
        validatedAt: new Date().toISOString(),
        validatorVersion: this.validatorVersion,
        validationDurationMs: 0,
        snapshotId,
        filePath: snapshotPath,
      },
    }

    try {
      // Check file accessibility
      try {
        await fs.access(snapshotPath, fs.constants.R_OK)
        result.fileAccessible = true
      } catch {
        result.corruptionIssues.push(
          `Snapshot file is not accessible: ${snapshotPath}`
        )
        result.recoveryRecommendations.push(
          'Check file permissions and disk space'
        )
        result.recoveryRecommendations.push(
          'Verify the snapshot directory exists and is readable'
        )
        return this.finalizeResult(result, startTime)
      }

      // Check JSON validity
      let snapshot: Record<string, unknown>
      try {
        const content = await fs.readFile(snapshotPath, 'utf-8')
        snapshot = JSON.parse(content)
        result.jsonValid = true
      } catch (error) {
        result.corruptionIssues.push(
          `Invalid JSON structure: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
        result.recoveryRecommendations.push(
          'The snapshot file contains invalid JSON and cannot be recovered'
        )
        result.recoveryRecommendations.push(
          'Remove the corrupted file and use a previous successful snapshot'
        )
        return this.finalizeResult(result, startTime)
      }

      // Check schema validity
      let validatedSnapshot: z.infer<typeof SnapshotSchema> | undefined
      try {
        const schemaResult = SnapshotSchema.safeParse(snapshot)
        if (schemaResult.success) {
          result.schemaValid = true
          validatedSnapshot = schemaResult.data
        } else {
          result.corruptionIssues.push('Snapshot schema validation failed:')
          schemaResult.error.issues.forEach(issue => {
            const path =
              issue.path.length > 0 ? ` at ${issue.path.join('.')}` : ''
            result.corruptionIssues.push(`  - ${issue.message}${path}`)
          })
          result.recoveryRecommendations.push(
            'The snapshot structure is invalid and cannot be used'
          )
          result.recoveryRecommendations.push(
            'Remove the corrupted file and regenerate data'
          )
        }
      } catch (error) {
        result.corruptionIssues.push(
          `Schema validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
        result.recoveryRecommendations.push(
          'Schema validation failed unexpectedly'
        )
      }

      // Check content consistency
      if (result.schemaValid && validatedSnapshot) {
        this.validateSnapshotContentConsistency(validatedSnapshot, result)
      }

      // Determine overall validity
      result.isValid =
        result.fileAccessible &&
        result.jsonValid &&
        result.schemaValid &&
        result.contentConsistent

      if (result.isValid) {
        logger.info('Snapshot integrity validation passed', {
          operation: 'validateSnapshot',
          snapshot_id: snapshotId,
          status: validatedSnapshot?.status,
          district_count: validatedSnapshot?.payload?.districts?.length,
        })
      } else {
        logger.warn('Snapshot integrity validation failed', {
          operation: 'validateSnapshot',
          snapshot_id: snapshotId,
          corruption_issues: result.corruptionIssues.length,
          file_accessible: result.fileAccessible,
          json_valid: result.jsonValid,
          schema_valid: result.schemaValid,
          content_consistent: result.contentConsistent,
        })
      }

      return this.finalizeResult(result, startTime)
    } catch (error) {
      result.corruptionIssues.push(
        `Unexpected validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
      result.recoveryRecommendations.push(
        'An unexpected error occurred during validation'
      )
      result.recoveryRecommendations.push('Check system logs for more details')

      logger.error(
        'Snapshot integrity validation failed with unexpected error',
        {
          operation: 'validateSnapshot',
          snapshot_id: snapshotId,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      )

      return this.finalizeResult(result, startTime)
    }
  }

  /**
   * Validate the integrity of the current.json pointer file
   */
  async validateCurrentPointer(): Promise<CurrentPointerIntegrityResult> {
    const startTime = Date.now()

    logger.info('Starting current pointer integrity validation', {
      operation: 'validateCurrentPointer',
      pointer_file: this.currentPointerFile,
    })

    const result: CurrentPointerIntegrityResult = {
      isValid: false,
      issues: [],
      recoveryRecommendations: [],
      fileAccessible: false,
      jsonValid: false,
      referencedSnapshotExists: false,
      referencedSnapshotSuccessful: false,
      alternativeSnapshots: [],
      validationMetadata: {
        validatedAt: new Date().toISOString(),
        validatorVersion: this.validatorVersion,
        validationDurationMs: 0,
        pointerFilePath: this.currentPointerFile,
      },
    }

    try {
      // Check file accessibility
      try {
        await fs.access(this.currentPointerFile, fs.constants.R_OK)
        result.fileAccessible = true
      } catch {
        result.issues.push('Current pointer file is not accessible')
        result.recoveryRecommendations.push(
          'Scan snapshots directory to find latest successful snapshot'
        )
        result.recoveryRecommendations.push(
          'Recreate current.json pointer file'
        )

        // Find alternative snapshots
        result.alternativeSnapshots =
          await this.findAlternativeSuccessfulSnapshots()

        return this.finalizePointerResult(result, startTime)
      }

      // Check JSON validity
      let pointer: Record<string, unknown>
      try {
        const content = await fs.readFile(this.currentPointerFile, 'utf-8')
        pointer = JSON.parse(content)
        result.jsonValid = true
        result.validationMetadata.referencedSnapshotId =
          pointer.snapshot_id as string
      } catch (error) {
        result.issues.push(
          `Invalid JSON in current pointer: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
        result.recoveryRecommendations.push(
          'Current pointer file contains invalid JSON'
        )
        result.recoveryRecommendations.push(
          'Remove corrupted current.json and recreate from latest successful snapshot'
        )

        // Find alternative snapshots
        result.alternativeSnapshots =
          await this.findAlternativeSuccessfulSnapshots()

        return this.finalizePointerResult(result, startTime)
      }

      // Check pointer schema validity
      try {
        const schemaResult = CurrentPointerSchema.safeParse(pointer)
        if (!schemaResult.success) {
          result.issues.push('Current pointer schema validation failed:')
          schemaResult.error.issues.forEach(issue => {
            const path =
              issue.path.length > 0 ? ` at ${issue.path.join('.')}` : ''
            result.issues.push(`  - ${issue.message}${path}`)
          })
          result.recoveryRecommendations.push(
            'Current pointer structure is invalid'
          )
          result.recoveryRecommendations.push(
            'Recreate current.json with proper structure'
          )
        }
      } catch (error) {
        result.issues.push(
          `Pointer schema validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }

      // Check if referenced snapshot exists
      if (pointer.snapshot_id && typeof pointer.snapshot_id === 'string') {
        const snapshotPath = path.join(
          this.snapshotsDir,
          `${pointer.snapshot_id}.json`
        )
        try {
          await fs.access(snapshotPath, fs.constants.R_OK)
          result.referencedSnapshotExists = true

          // Check if referenced snapshot is successful
          try {
            const snapshotContent = await fs.readFile(snapshotPath, 'utf-8')
            const snapshot = JSON.parse(snapshotContent)
            result.referencedSnapshotSuccessful = snapshot.status === 'success'

            if (!result.referencedSnapshotSuccessful) {
              result.issues.push(
                `Referenced snapshot has status '${snapshot.status}', not 'success'`
              )
              result.recoveryRecommendations.push(
                'Current pointer references a non-successful snapshot'
              )
              result.recoveryRecommendations.push(
                'Update pointer to reference latest successful snapshot'
              )
            }
          } catch {
            result.issues.push(
              'Referenced snapshot file is corrupted or unreadable'
            )
            result.recoveryRecommendations.push(
              'Referenced snapshot is corrupted'
            )
            result.recoveryRecommendations.push(
              'Update pointer to reference a valid successful snapshot'
            )
          }
        } catch {
          result.issues.push(
            `Referenced snapshot does not exist: ${pointer.snapshot_id}`
          )
          result.recoveryRecommendations.push(
            'Current pointer references a non-existent snapshot'
          )
          result.recoveryRecommendations.push(
            'Update pointer to reference an existing successful snapshot'
          )
        }
      }

      // Find alternative snapshots regardless of current state
      result.alternativeSnapshots =
        await this.findAlternativeSuccessfulSnapshots()

      // Determine overall validity
      result.isValid =
        result.fileAccessible &&
        result.jsonValid &&
        result.referencedSnapshotExists &&
        result.referencedSnapshotSuccessful

      if (result.isValid) {
        logger.info('Current pointer integrity validation passed', {
          operation: 'validateCurrentPointer',
          referenced_snapshot: pointer.snapshot_id,
          updated_at: pointer.updated_at,
        })
      } else {
        logger.warn('Current pointer integrity validation failed', {
          operation: 'validateCurrentPointer',
          issues_count: result.issues.length,
          file_accessible: result.fileAccessible,
          json_valid: result.jsonValid,
          referenced_exists: result.referencedSnapshotExists,
          referenced_successful: result.referencedSnapshotSuccessful,
          alternatives_found: result.alternativeSnapshots.length,
        })
      }

      return this.finalizePointerResult(result, startTime)
    } catch (error) {
      result.issues.push(
        `Unexpected validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
      result.recoveryRecommendations.push(
        'An unexpected error occurred during pointer validation'
      )
      result.recoveryRecommendations.push(
        'Check system logs and file permissions'
      )

      logger.error('Current pointer validation failed with unexpected error', {
        operation: 'validateCurrentPointer',
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      return this.finalizePointerResult(result, startTime)
    }
  }

  /**
   * Validate the integrity of the entire snapshot store
   */
  async validateSnapshotStore(): Promise<SnapshotStoreIntegrityResult> {
    const startTime = Date.now()

    logger.info('Starting comprehensive snapshot store integrity validation', {
      operation: 'validateSnapshotStore',
      cache_dir: this.cacheDir,
    })

    const result: SnapshotStoreIntegrityResult = {
      isHealthy: false,
      currentPointer: await this.validateCurrentPointer(),
      snapshots: [],
      storeIssues: [],
      storeRecoveryRecommendations: [],
      summary: {
        totalSnapshots: 0,
        validSnapshots: 0,
        corruptedSnapshots: 0,
        successfulSnapshots: 0,
      },
    }

    try {
      // Check if snapshots directory exists
      try {
        await fs.access(this.snapshotsDir, fs.constants.R_OK)
      } catch {
        result.storeIssues.push('Snapshots directory is not accessible')
        result.storeRecoveryRecommendations.push(
          'Create snapshots directory with proper permissions'
        )
        result.storeRecoveryRecommendations.push(
          'Run initial data refresh to populate snapshots'
        )
        return result
      }

      // Get all snapshot files
      const files = await fs.readdir(this.snapshotsDir)
      const snapshotFiles = files.filter(file => file.endsWith('.json'))
      result.summary.totalSnapshots = snapshotFiles.length

      if (snapshotFiles.length === 0) {
        result.storeIssues.push(
          'No snapshot files found in snapshots directory'
        )
        result.storeRecoveryRecommendations.push(
          'Run data refresh to create initial snapshot'
        )
        return result
      }

      // Validate each snapshot
      for (const file of snapshotFiles) {
        const snapshotId = path.basename(file, '.json')
        const snapshotResult = await this.validateSnapshot(snapshotId)
        result.snapshots.push(snapshotResult)

        if (snapshotResult.isValid) {
          result.summary.validSnapshots++

          // Check if this is a successful snapshot
          try {
            const snapshotPath = path.join(this.snapshotsDir, file)
            const content = await fs.readFile(snapshotPath, 'utf-8')
            const snapshot = JSON.parse(content)
            if (snapshot.status === 'success') {
              result.summary.successfulSnapshots++
              if (
                !result.summary.latestSuccessfulSnapshot ||
                snapshotId > result.summary.latestSuccessfulSnapshot
              ) {
                result.summary.latestSuccessfulSnapshot = snapshotId
              }
            }
          } catch {
            // Already handled in individual snapshot validation
          }
        } else {
          result.summary.corruptedSnapshots++
        }
      }

      // Store-level validations
      if (result.summary.successfulSnapshots === 0) {
        result.storeIssues.push('No successful snapshots found')
        result.storeRecoveryRecommendations.push(
          'Run data refresh to create a successful snapshot'
        )
      }

      if (result.summary.corruptedSnapshots > 0) {
        result.storeIssues.push(
          `Found ${result.summary.corruptedSnapshots} corrupted snapshots`
        )
        result.storeRecoveryRecommendations.push(
          'Remove corrupted snapshot files'
        )
        result.storeRecoveryRecommendations.push(
          'Run data refresh to replace corrupted data'
        )
      }

      // Check current pointer consistency with available snapshots
      if (
        !result.currentPointer.isValid &&
        result.summary.successfulSnapshots > 0
      ) {
        result.storeIssues.push(
          'Current pointer is invalid but successful snapshots exist'
        )
        result.storeRecoveryRecommendations.push(
          'Recreate current.json pointer to reference latest successful snapshot'
        )
      }

      // Determine overall health
      result.isHealthy =
        result.currentPointer.isValid &&
        result.summary.successfulSnapshots > 0 &&
        result.summary.corruptedSnapshots === 0

      const duration = Date.now() - startTime

      if (result.isHealthy) {
        logger.info('Snapshot store integrity validation passed', {
          operation: 'validateSnapshotStore',
          total_snapshots: result.summary.totalSnapshots,
          valid_snapshots: result.summary.validSnapshots,
          successful_snapshots: result.summary.successfulSnapshots,
          latest_successful: result.summary.latestSuccessfulSnapshot,
          duration_ms: duration,
        })
      } else {
        logger.warn('Snapshot store integrity validation found issues', {
          operation: 'validateSnapshotStore',
          total_snapshots: result.summary.totalSnapshots,
          valid_snapshots: result.summary.validSnapshots,
          corrupted_snapshots: result.summary.corruptedSnapshots,
          successful_snapshots: result.summary.successfulSnapshots,
          store_issues: result.storeIssues.length,
          pointer_valid: result.currentPointer.isValid,
          duration_ms: duration,
        })
      }

      return result
    } catch (error) {
      result.storeIssues.push(
        `Unexpected store validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
      result.storeRecoveryRecommendations.push(
        'An unexpected error occurred during store validation'
      )
      result.storeRecoveryRecommendations.push(
        'Check system logs, file permissions, and disk space'
      )

      logger.error('Snapshot store validation failed with unexpected error', {
        operation: 'validateSnapshotStore',
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      return result
    }
  }

  /**
   * Validate snapshot content consistency (internal data relationships)
   */
  private validateSnapshotContentConsistency(
    snapshot: z.infer<typeof SnapshotSchema>,
    result: SnapshotIntegrityResult
  ): void {
    try {
      // Check basic required fields
      if (!snapshot.snapshot_id || !snapshot.created_at || !snapshot.payload) {
        result.corruptionIssues.push('Missing required snapshot fields')
        return
      }

      // Check payload structure
      if (
        !snapshot.payload?.districts ||
        !Array.isArray(snapshot.payload.districts)
      ) {
        result.corruptionIssues.push(
          'Invalid or missing districts array in payload'
        )
        return
      }

      if (!snapshot.payload?.metadata) {
        result.corruptionIssues.push('Missing metadata in payload')
        return
      }

      // Check metadata consistency
      const actualDistrictCount = snapshot.payload?.districts?.length || 0
      const reportedDistrictCount =
        snapshot.payload?.metadata?.districtCount || 0

      if (actualDistrictCount !== reportedDistrictCount) {
        result.corruptionIssues.push(
          `District count mismatch: metadata reports ${reportedDistrictCount} but found ${actualDistrictCount} districts`
        )
      }

      // Check timestamp consistency
      try {
        const createdAt = new Date(snapshot.created_at)
        const fetchedAt = new Date(snapshot.payload?.metadata?.fetchedAt)

        if (createdAt < fetchedAt) {
          result.corruptionIssues.push(
            'Snapshot created_at is before data fetchedAt - this is inconsistent'
          )
        }
      } catch {
        result.corruptionIssues.push(
          'Invalid timestamp format in snapshot or metadata'
        )
      }

      // Check snapshot ID format (should be timestamp-based)
      if (!/^\d+$/.test(snapshot.snapshot_id)) {
        result.corruptionIssues.push(
          'Snapshot ID is not in expected timestamp format'
        )
      }

      // Check status consistency
      if (snapshot.status === 'success' && snapshot.errors?.length > 0) {
        result.corruptionIssues.push(
          'Snapshot marked as success but contains errors'
        )
      }

      if (
        snapshot.status === 'failed' &&
        (!snapshot.errors || snapshot.errors.length === 0)
      ) {
        result.corruptionIssues.push(
          'Snapshot marked as failed but contains no error messages'
        )
      }

      // If we got here without issues, content is consistent
      if (result.corruptionIssues.length === 0) {
        result.contentConsistent = true
      }
    } catch (error) {
      result.corruptionIssues.push(
        `Content consistency check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Find alternative successful snapshots for recovery
   */
  private async findAlternativeSuccessfulSnapshots(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.snapshotsDir)
      const snapshotFiles = files
        .filter(file => file.endsWith('.json'))
        .sort((a, b) => {
          const timestampA = parseInt(path.basename(a, '.json'))
          const timestampB = parseInt(path.basename(b, '.json'))
          return timestampB - timestampA // Newest first
        })

      const alternatives: string[] = []

      for (const file of snapshotFiles) {
        try {
          const snapshotPath = path.join(this.snapshotsDir, file)
          const content = await fs.readFile(snapshotPath, 'utf-8')
          const snapshot = JSON.parse(content)

          if (snapshot.status === 'success') {
            alternatives.push(path.basename(file, '.json'))
          }
        } catch {
          // Skip corrupted files
          continue
        }
      }

      return alternatives
    } catch {
      return []
    }
  }

  /**
   * Finalize snapshot validation result with timing
   */
  private finalizeResult(
    result: SnapshotIntegrityResult,
    startTime: number
  ): SnapshotIntegrityResult {
    result.validationMetadata.validationDurationMs = Date.now() - startTime
    return result
  }

  /**
   * Finalize pointer validation result with timing
   */
  private finalizePointerResult(
    result: CurrentPointerIntegrityResult,
    startTime: number
  ): CurrentPointerIntegrityResult {
    result.validationMetadata.validationDurationMs = Date.now() - startTime
    return result
  }
}
