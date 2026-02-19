/**
 * Snapshot Writer
 *
 * Write and delete operations for snapshot data.
 * Functions accept explicit dependencies for independent testability.
 */

import fs from 'fs/promises'
import path from 'path'
import { logger } from '../../utils/logger.js'
import {
  resolvePathUnderBase,
  validateSnapshotId,
  validateDistrictId,
} from './SnapshotPathUtils.js'
import type { Snapshot } from '../../types/snapshots.js'
import type { DistrictStatistics } from '../../types/districts.js'
import type {
  SnapshotManifest,
  DistrictManifestEntry,
  AllDistrictsRankingsData,
} from '@toastmasters/shared-contracts'
import type {
  PerDistrictSnapshotMetadata,
  WriteSnapshotOptions,
  SnapshotComparisonResult,
} from '../SnapshotStore.js'
import { getSnapshotMetadata } from './SnapshotReader.js'

// ============================================================================
// Write operations
// ============================================================================

/**
 * Generate ISO date-based snapshot directory name from dataAsOfDate
 */
export function generateSnapshotDirectoryName(dataAsOfDate: string): string {
  const date = new Date(dataAsOfDate)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Extract detailed district error information from snapshot errors
 */
export function extractDistrictErrorsFromSnapshot(snapshot: Snapshot): Array<{
  districtId: string
  operation: string
  error: string
  timestamp: string
  shouldRetry: boolean
}> {
  const districtErrors: Array<{
    districtId: string
    operation: string
    error: string
    timestamp: string
    shouldRetry: boolean
  }> = []

  for (const error of snapshot.errors) {
    const match = error.match(/^([^:]+):\s*([^-]+)\s*-\s*(.+)$/)
    if (match && match[1] && match[2] && match[3]) {
      const [, districtId, operation, errorMessage] = match
      districtErrors.push({
        districtId: districtId.trim(),
        operation: operation.trim(),
        error: errorMessage.trim(),
        timestamp: snapshot.created_at,
        shouldRetry: !errorMessage.includes('Circuit breaker'),
      })
    }
  }

  return districtErrors
}

/**
 * Extract ranking algorithm version from districts with ranking data
 */
export function extractRankingVersion(snapshot: Snapshot): string | undefined {
  for (const district of snapshot.payload.districts) {
    if (district.ranking?.rankingVersion) {
      logger.debug('Extracted ranking version from district data', {
        operation: 'extractRankingVersion',
        snapshot_id: snapshot.snapshot_id,
        ranking_version: district.ranking.rankingVersion,
        district_id: district.districtId,
      })
      return district.ranking.rankingVersion
    }
  }

  logger.debug('No ranking version found in district data', {
    operation: 'extractRankingVersion',
    snapshot_id: snapshot.snapshot_id,
    district_count: snapshot.payload.districts.length,
  })
  return undefined
}

/**
 * Write district data to a snapshot directory.
 *
 * This method converts the backend's internal DistrictStatistics format
 * to the shared contracts PerDistrictData format for storage.
 */
export async function writeDistrictData(
  snapshotsDir: string,
  snapshotId: string,
  districtId: string,
  data: DistrictStatistics
): Promise<void> {
  validateSnapshotId(snapshotId)
  validateDistrictId(districtId)

  const districtFile = resolvePathUnderBase(
    snapshotsDir,
    snapshotId,
    `district_${districtId}.json`
  )

  // Calculate DCP goals per club to preserve education.totalAwards
  const totalAwards = data.education?.totalAwards ?? 0
  const byClub = data.membership?.byClub ?? []

  // Build status counts
  const activeCount = data.clubs?.active ?? 0
  const suspendedCount = data.clubs?.suspended ?? 0
  const ineligibleCount = data.clubs?.ineligible ?? 0
  const lowCount = data.clubs?.low ?? 0
  const totalStatusCount =
    activeCount + suspendedCount + ineligibleCount + lowCount

  const statusList: string[] = []
  for (let i = 0; i < activeCount; i++) statusList.push('Active')
  for (let i = 0; i < suspendedCount; i++) statusList.push('Suspended')
  for (let i = 0; i < ineligibleCount; i++) statusList.push('Ineligible')
  for (let i = 0; i < lowCount; i++) statusList.push('Low')

  let clubs: Array<{
    clubId: string
    clubName: string
    divisionId: string
    areaId: string
    membershipCount: number
    paymentsCount: number
    dcpGoals: number
    status: string
    divisionName: string
    areaName: string
    octoberRenewals: number
    aprilRenewals: number
    newMembers: number
    membershipBase: number
    clubStatus?: string
  }> = []

  // Create clubs from byClub entries
  for (let index = 0; index < byClub.length; index++) {
    const club = byClub[index]!
    clubs.push({
      clubId: club.clubId,
      clubName: club.clubName,
      divisionId: '',
      areaId: '',
      membershipCount: club.memberCount,
      paymentsCount: 0,
      dcpGoals: 0,
      status: statusList[index] ?? 'Active',
      divisionName: '',
      areaName: '',
      octoberRenewals: 0,
      aprilRenewals: 0,
      newMembers: data.membership?.new ?? 0,
      membershipBase: 0,
    })
  }

  // Create placeholder clubs for remaining status counts
  for (let i = byClub.length; i < totalStatusCount; i++) {
    clubs.push({
      clubId: `placeholder_${i}`,
      clubName: `Placeholder Club ${i}`,
      divisionId: '',
      areaId: '',
      membershipCount: 0,
      paymentsCount: 0,
      dcpGoals: 0,
      status: statusList[i] ?? 'Active',
      divisionName: '',
      areaName: '',
      octoberRenewals: 0,
      aprilRenewals: 0,
      newMembers: 0,
      membershipBase: 0,
    })
  }

  // Distribute DCP goals across clubs
  if (totalAwards > 0 && clubs.length > 0) {
    const goalsPerClub = Math.floor(totalAwards / clubs.length)
    const extraGoals = totalAwards % clubs.length
    for (let i = 0; i < clubs.length; i++) {
      clubs[i]!.dcpGoals = goalsPerClub + (i < extraGoals ? 1 : 0)
    }
  }

  // Synthetic club to preserve awards if no real clubs
  if (totalAwards > 0 && clubs.length === 0) {
    clubs = [
      {
        clubId: 'synthetic',
        clubName: 'Synthetic Club',
        divisionId: '',
        areaId: '',
        membershipCount: 0,
        paymentsCount: 0,
        dcpGoals: totalAwards,
        status: 'synthetic',
        divisionName: '',
        areaName: '',
        octoberRenewals: 0,
        aprilRenewals: 0,
        newMembers: 0,
        membershipBase: 0,
        clubStatus: 'synthetic',
      },
    ]
  }

  const districtStatisticsFile = {
    districtId: data.districtId,
    snapshotDate: data.asOfDate,
    clubs,
    divisions: [] as Array<{
      divisionId: string
      divisionName: string
      clubCount: number
      membershipTotal: number
      paymentsTotal: number
    }>,
    areas: [] as Array<{
      areaId: string
      areaName: string
      divisionId: string
      clubCount: number
      membershipTotal: number
      paymentsTotal: number
    }>,
    totals: {
      totalClubs: data.clubs?.total ?? 0,
      totalMembership: data.membership?.total ?? 0,
      totalPayments: 0,
      distinguishedClubs: data.clubs?.distinguished ?? 0,
      selectDistinguishedClubs: 0,
      presidentDistinguishedClubs: 0,
    },
    divisionPerformance: data.divisionPerformance ?? [],
    clubPerformance: data.clubPerformance ?? [],
    districtPerformance: data.districtPerformance ?? [],
  }

  const perDistrictData = {
    districtId,
    districtName: `District ${districtId}`,
    collectedAt: new Date().toISOString(),
    status: 'success' as const,
    data: districtStatisticsFile,
  }

  await fs.writeFile(
    districtFile,
    JSON.stringify(perDistrictData, null, 2),
    'utf-8'
  )

  logger.debug('Wrote district data file', {
    operation: 'writeDistrictData',
    snapshot_id: snapshotId,
    district_id: districtId,
    file_path: districtFile,
  })
}

/**
 * Write all-districts rankings data to a snapshot directory
 */
export async function writeAllDistrictsRankings(
  snapshotsDir: string,
  snapshotId: string,
  rankingsData: AllDistrictsRankingsData
): Promise<void> {
  validateSnapshotId(snapshotId)

  const snapshotDir = resolvePathUnderBase(snapshotsDir, snapshotId)
  await fs.mkdir(snapshotDir, { recursive: true })

  const rankingsFile = resolvePathUnderBase(
    snapshotsDir,
    snapshotId,
    'all-districts-rankings.json'
  )

  const updatedRankingsData = {
    ...rankingsData,
    metadata: {
      ...rankingsData.metadata,
      snapshotId,
    },
  }

  await fs.writeFile(
    rankingsFile,
    JSON.stringify(updatedRankingsData, null, 2),
    'utf-8'
  )

  logger.info('Wrote all-districts rankings file', {
    operation: 'writeAllDistrictsRankings',
    snapshot_id: snapshotId,
    file_path: rankingsFile,
    district_count: updatedRankingsData.rankings.length,
    total_districts: updatedRankingsData.metadata.totalDistricts,
  })
}

/**
 * Write a complete snapshot using per-district directory structure.
 *
 * @param invalidateCachesFn - callback to invalidate caches after successful write
 */
export async function writeSnapshot(
  snapshotsDir: string,
  snapshot: Snapshot,
  invalidateCachesFn: () => Promise<void>,
  allDistrictsRankings?: AllDistrictsRankingsData,
  options?: WriteSnapshotOptions
): Promise<void> {
  const startTime = Date.now()
  logger.info('Starting per-district snapshot write operation', {
    operation: 'writeSnapshot',
    snapshot_id: snapshot.snapshot_id,
    status: snapshot.status,
    schema_version: snapshot.schema_version,
    calculation_version: snapshot.calculation_version,
    district_count: snapshot.payload.districts.length,
    error_count: snapshot.errors.length,
    has_rankings: !!allDistrictsRankings,
    override_snapshot_date: options?.overrideSnapshotDate,
  })

  try {
    await fs.mkdir(snapshotsDir, { recursive: true })

    const snapshotDirName = options?.overrideSnapshotDate
      ? generateSnapshotDirectoryName(options.overrideSnapshotDate)
      : generateSnapshotDirectoryName(snapshot.payload.metadata.dataAsOfDate)
    const snapshotDir = path.join(snapshotsDir, snapshotDirName)

    await fs.mkdir(snapshotDir, { recursive: true })

    logger.debug('Created snapshot directory', {
      operation: 'writeSnapshot',
      snapshot_id: snapshot.snapshot_id,
      snapshot_dir: snapshotDir,
      snapshot_dir_name: snapshotDirName,
    })

    // Write individual district files
    const manifestEntries: DistrictManifestEntry[] = []
    let successfulDistricts = 0
    let failedDistricts = 0

    for (const district of snapshot.payload.districts) {
      try {
        await writeDistrictData(
          snapshotsDir,
          snapshotDirName,
          district.districtId,
          district
        )

        const districtFile = path.join(
          snapshotDir,
          `district_${district.districtId}.json`
        )
        const stats = await fs.stat(districtFile)

        manifestEntries.push({
          districtId: district.districtId,
          fileName: `district_${district.districtId}.json`,
          status: 'success',
          fileSize: stats.size,
          lastModified: stats.mtime.toISOString(),
        })

        successfulDistricts++
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error'

        manifestEntries.push({
          districtId: district.districtId,
          fileName: `district_${district.districtId}.json`,
          status: 'failed',
          fileSize: 0,
          lastModified: new Date().toISOString(),
          errorMessage,
        })

        failedDistricts++

        logger.warn('Failed to write district data', {
          operation: 'writeSnapshot',
          snapshot_id: snapshotDirName,
          district_id: district.districtId,
          error: errorMessage,
        })
      }
    }

    // Write manifest.json
    const manifest: SnapshotManifest = {
      snapshotId: snapshotDirName,
      createdAt: snapshot.created_at,
      districts: manifestEntries,
      totalDistricts: snapshot.payload.districts.length,
      successfulDistricts,
      failedDistricts,
    }

    // Write all-districts rankings if provided
    if (allDistrictsRankings) {
      try {
        await writeAllDistrictsRankings(
          snapshotsDir,
          snapshotDirName,
          allDistrictsRankings
        )

        const rankingsFile = path.join(
          snapshotDir,
          'all-districts-rankings.json'
        )
        const rankingsStats = await fs.stat(rankingsFile)
        manifest.allDistrictsRankings = {
          filename: 'all-districts-rankings.json',
          size: rankingsStats.size,
          status: 'present',
        }

        logger.info('Successfully wrote all-districts rankings to snapshot', {
          operation: 'writeSnapshot',
          snapshot_id: snapshotDirName,
          rankings_count: allDistrictsRankings.rankings.length,
          file_size: rankingsStats.size,
        })
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error'
        logger.error('Failed to write all-districts rankings', {
          operation: 'writeSnapshot',
          snapshot_id: snapshotDirName,
          error: errorMessage,
        })
        throw new Error(
          `Failed to write all-districts rankings: ${errorMessage}`
        )
      }
    } else {
      manifest.allDistrictsRankings = {
        filename: 'all-districts-rankings.json',
        size: 0,
        status: 'missing',
      }
    }

    const manifestPath = path.join(snapshotDir, 'manifest.json')
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8')

    logger.debug('Wrote snapshot manifest', {
      operation: 'writeSnapshot',
      snapshot_id: snapshotDirName,
      manifest_path: manifestPath,
      total_districts: manifest.totalDistricts,
      successful_districts: manifest.successfulDistricts,
      failed_districts: manifest.failedDistricts,
    })

    // Write metadata.json
    const districtErrorsFromSnap = extractDistrictErrorsFromSnapshot(snapshot)

    const rankingVersion = allDistrictsRankings
      ? allDistrictsRankings.metadata.rankingVersion
      : extractRankingVersion(snapshot)

    const metadata: PerDistrictSnapshotMetadata = {
      snapshotId: snapshotDirName,
      createdAt: snapshot.created_at,
      schemaVersion: snapshot.schema_version,
      calculationVersion: snapshot.calculation_version,
      rankingVersion,
      status: snapshot.status,
      configuredDistricts: snapshot.payload.districts.map(d => d.districtId),
      successfulDistricts: manifestEntries
        .filter(e => e.status === 'success')
        .map(e => e.districtId),
      failedDistricts: manifestEntries
        .filter(e => e.status === 'failed')
        .map(e => e.districtId),
      errors: snapshot.errors,
      districtErrors: districtErrorsFromSnap,
      processingDuration: Date.now() - startTime,
      source: snapshot.payload.metadata.source,
      dataAsOfDate: snapshot.payload.metadata.dataAsOfDate,
      isClosingPeriodData: snapshot.payload.metadata.isClosingPeriodData,
      collectionDate: snapshot.payload.metadata.collectionDate,
      logicalDate: snapshot.payload.metadata.logicalDate,
    }

    const metadataPath = path.join(snapshotDir, 'metadata.json')
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8')

    logger.debug('Wrote snapshot metadata', {
      operation: 'writeSnapshot',
      snapshot_id: snapshotDirName,
      metadata_path: metadataPath,
      processing_duration: metadata.processingDuration,
    })

    // Invalidate caches when writing a successful snapshot
    if (snapshot.status === 'success') {
      await invalidateCachesFn()

      logger.info('Caches invalidated for successful snapshot', {
        operation: 'writeSnapshot',
        snapshot_id: snapshotDirName,
      })
    }

    const duration = Date.now() - startTime
    logger.info('Snapshot write operation completed successfully', {
      operation: 'writeSnapshot',
      snapshot_id: snapshotDirName,
      status: snapshot.status,
      successful_districts: successfulDistricts,
      failed_districts: failedDistricts,
      duration_ms: duration,
    })
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    logger.error('Failed to write snapshot', {
      operation: 'writeSnapshot',
      snapshot_id: snapshot.snapshot_id,
      error: errorMessage,
      duration_ms: duration,
    })
    throw new Error(`Failed to write snapshot: ${errorMessage}`)
  }
}

// ============================================================================
// Delete operations
// ============================================================================

/**
 * Delete a snapshot and all its associated data.
 *
 * @param invalidateSnapshotCacheFn - callback to invalidate cached data for this snapshot
 */
export async function deleteSnapshot(
  snapshotsDir: string,
  snapshotId: string,
  invalidateSnapshotCacheFn: (snapshotId: string) => void
): Promise<boolean> {
  const startTime = Date.now()

  logger.info('Starting deleteSnapshot operation', {
    operation: 'deleteSnapshot',
    snapshot_id: snapshotId,
  })

  try {
    validateSnapshotId(snapshotId)

    const snapshotDir = resolvePathUnderBase(snapshotsDir, snapshotId)

    try {
      await fs.access(snapshotDir)
    } catch {
      logger.info('Snapshot not found for deletion', {
        operation: 'deleteSnapshot',
        snapshot_id: snapshotId,
        duration_ms: Date.now() - startTime,
      })
      return false
    }

    await fs.rm(snapshotDir, { recursive: true, force: true })

    invalidateSnapshotCacheFn(snapshotId)

    logger.info('Successfully deleted snapshot', {
      operation: 'deleteSnapshot',
      snapshot_id: snapshotId,
      duration_ms: Date.now() - startTime,
    })

    return true
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    logger.error('Failed to delete snapshot', {
      operation: 'deleteSnapshot',
      snapshot_id: snapshotId,
      error: errorMessage,
      duration_ms: Date.now() - startTime,
    })
    throw error
  }
}

// ============================================================================
// Comparison operations
// ============================================================================

/**
 * Compare a new snapshot's collection date against an existing snapshot
 */
export async function shouldUpdateClosingPeriodSnapshot(
  snapshotsDir: string,
  snapshotDate: string,
  newCollectionDate: string
): Promise<SnapshotComparisonResult> {
  try {
    const existingMetadata = await getSnapshotMetadata(
      snapshotsDir,
      snapshotDate
    )

    if (!existingMetadata) {
      logger.debug('No existing snapshot found, should create new', {
        operation: 'shouldUpdateClosingPeriodSnapshot',
        snapshot_date: snapshotDate,
        new_collection_date: newCollectionDate,
      })

      return {
        shouldUpdate: true,
        reason: 'no_existing',
        newCollectionDate,
      }
    }

    const existingCollectionDate =
      existingMetadata.collectionDate ?? existingMetadata.dataAsOfDate

    const existingDate = new Date(existingCollectionDate)
    const newDate = new Date(newCollectionDate)

    if (newDate > existingDate) {
      logger.info('New data is newer, should update snapshot', {
        operation: 'shouldUpdateClosingPeriodSnapshot',
        snapshot_date: snapshotDate,
        existing_collection_date: existingCollectionDate,
        new_collection_date: newCollectionDate,
      })

      return {
        shouldUpdate: true,
        reason: 'newer_data',
        existingCollectionDate,
        newCollectionDate,
      }
    } else if (newDate.getTime() === existingDate.getTime()) {
      logger.info('Same collection date, allowing same-day refresh', {
        operation: 'shouldUpdateClosingPeriodSnapshot',
        snapshot_date: snapshotDate,
        existing_collection_date: existingCollectionDate,
        new_collection_date: newCollectionDate,
      })

      return {
        shouldUpdate: true,
        reason: 'same_day_refresh',
        existingCollectionDate,
        newCollectionDate,
      }
    } else {
      logger.info('Existing snapshot has newer data, skipping update', {
        operation: 'shouldUpdateClosingPeriodSnapshot',
        snapshot_date: snapshotDate,
        existing_collection_date: existingCollectionDate,
        new_collection_date: newCollectionDate,
      })

      return {
        shouldUpdate: false,
        reason: 'existing_is_newer',
        existingCollectionDate,
        newCollectionDate,
      }
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'

    logger.warn(
      'Error reading existing snapshot metadata, treating as no existing',
      {
        operation: 'shouldUpdateClosingPeriodSnapshot',
        snapshot_date: snapshotDate,
        new_collection_date: newCollectionDate,
        error: errorMessage,
      }
    )

    return {
      shouldUpdate: true,
      reason: 'no_existing',
      newCollectionDate,
    }
  }
}
