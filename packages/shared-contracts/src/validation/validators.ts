/**
 * Validation helper functions for shared data contracts.
 *
 * These functions wrap Zod schema validation with a consistent interface,
 * providing type-safe validation results with descriptive error messages.
 *
 * All validation functions accept `unknown` data and return a ValidationResult
 * that indicates success or failure with the validated data or error message.
 *
 * @module validation/validators
 * @see Requirements 6.4, 6.5, 13.5
 */

import { PerDistrictDataSchema } from '../schemas/per-district-data.schema.js'
import { AllDistrictsRankingsDataSchema } from '../schemas/all-districts-rankings.schema.js'
import { SnapshotMetadataFileSchema } from '../schemas/snapshot-metadata.schema.js'
import { SnapshotManifestSchema } from '../schemas/snapshot-manifest.schema.js'
import {
  TimeSeriesDataPointSchema,
  ProgramYearIndexFileSchema,
  TimeSeriesIndexMetadataSchema,
  ProgramYearSummarySchema,
} from '../schemas/time-series.schema.js'
import type { PerDistrictData } from '../types/per-district-data.js'
import type { AllDistrictsRankingsData } from '../types/all-districts-rankings.js'
import type { SnapshotMetadataFile } from '../types/snapshot-metadata.js'
import type { SnapshotManifest } from '../types/snapshot-manifest.js'
import type {
  TimeSeriesDataPoint,
  ProgramYearIndexFile,
  TimeSeriesIndexMetadata,
  ProgramYearSummary,
} from '../types/time-series.js'

/**
 * Result of a validation operation.
 *
 * When validation succeeds, `success` is `true` and `data` contains
 * the validated and typed data.
 *
 * When validation fails, `success` is `false` and `error` contains
 * a descriptive error message indicating which fields are invalid.
 *
 * @template T - The type of the validated data
 *
 * @example
 * ```typescript
 * const result = validatePerDistrictData(jsonData)
 * if (result.success) {
 *   // result.data is typed as PerDistrictData
 *   console.log(result.data.districtId)
 * } else {
 *   // result.error contains the validation error message
 *   console.error(result.error)
 * }
 * ```
 */
export interface ValidationResult<T> {
  /** Whether validation succeeded */
  success: boolean
  /** The validated data (only present when success is true) */
  data?: T
  /** Error message describing validation failure (only present when success is false) */
  error?: string
}

/**
 * Validates per-district data against the PerDistrictData schema.
 *
 * Use this function to validate district JSON files read from disk
 * or received from external sources.
 *
 * @param data - Unknown data to validate
 * @returns ValidationResult with typed PerDistrictData on success, or error message on failure
 *
 * @example
 * ```typescript
 * const jsonData = JSON.parse(fileContent)
 * const result = validatePerDistrictData(jsonData)
 * if (result.success) {
 *   const districtData = result.data
 *   console.log(`District ${districtData.districtId}: ${districtData.status}`)
 * } else {
 *   console.error(`Validation failed: ${result.error}`)
 * }
 * ```
 *
 * @see Requirements 6.4, 6.5
 */
export function validatePerDistrictData(
  data: unknown
): ValidationResult<PerDistrictData> {
  const result = PerDistrictDataSchema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return {
    success: false,
    error: `PerDistrictData validation failed: ${result.error.message}`,
  }
}

/**
 * Validates all-districts rankings data against the AllDistrictsRankingsData schema.
 *
 * Use this function to validate all-districts-rankings.json files read from disk
 * or received from external sources.
 *
 * @param data - Unknown data to validate
 * @returns ValidationResult with typed AllDistrictsRankingsData on success, or error message on failure
 *
 * @example
 * ```typescript
 * const jsonData = JSON.parse(fileContent)
 * const result = validateAllDistrictsRankings(jsonData)
 * if (result.success) {
 *   const rankingsData = result.data
 *   console.log(`Total districts: ${rankingsData.metadata.totalDistricts}`)
 * } else {
 *   console.error(`Validation failed: ${result.error}`)
 * }
 * ```
 *
 * @see Requirements 6.4, 6.5
 */
export function validateAllDistrictsRankings(
  data: unknown
): ValidationResult<AllDistrictsRankingsData> {
  const result = AllDistrictsRankingsDataSchema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return {
    success: false,
    error: `AllDistrictsRankingsData validation failed: ${result.error.message}`,
  }
}

/**
 * Validates snapshot metadata against the SnapshotMetadataFile schema.
 *
 * Use this function to validate metadata.json files read from disk
 * or received from external sources.
 *
 * @param data - Unknown data to validate
 * @returns ValidationResult with typed SnapshotMetadataFile on success, or error message on failure
 *
 * @example
 * ```typescript
 * const jsonData = JSON.parse(fileContent)
 * const result = validateSnapshotMetadata(jsonData)
 * if (result.success) {
 *   const metadata = result.data
 *   console.log(`Snapshot ID: ${metadata.snapshotId}, Status: ${metadata.status}`)
 * } else {
 *   console.error(`Validation failed: ${result.error}`)
 * }
 * ```
 *
 * @see Requirements 6.4, 6.5
 */
export function validateSnapshotMetadata(
  data: unknown
): ValidationResult<SnapshotMetadataFile> {
  const result = SnapshotMetadataFileSchema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return {
    success: false,
    error: `SnapshotMetadataFile validation failed: ${result.error.message}`,
  }
}

/**
 * Validates snapshot manifest against the SnapshotManifest schema.
 *
 * Use this function to validate manifest.json files read from disk
 * or received from external sources.
 *
 * @param data - Unknown data to validate
 * @returns ValidationResult with typed SnapshotManifest on success, or error message on failure
 *
 * @example
 * ```typescript
 * const jsonData = JSON.parse(fileContent)
 * const result = validateSnapshotManifest(jsonData)
 * if (result.success) {
 *   const manifest = result.data
 *   console.log(`Total districts: ${manifest.totalDistricts}`)
 * } else {
 *   console.error(`Validation failed: ${result.error}`)
 * }
 * ```
 *
 * @see Requirements 6.4, 6.5
 */
export function validateSnapshotManifest(
  data: unknown
): ValidationResult<SnapshotManifest> {
  const result = SnapshotManifestSchema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return {
    success: false,
    error: `SnapshotManifest validation failed: ${result.error.message}`,
  }
}

/**
 * Validates a time-series data point against the TimeSeriesDataPoint schema.
 *
 * Use this function to validate individual time-series data points
 * read from disk or generated during computation.
 *
 * @param data - Unknown data to validate
 * @returns ValidationResult with typed TimeSeriesDataPoint on success, or error message on failure
 *
 * @example
 * ```typescript
 * const jsonData = JSON.parse(fileContent)
 * const result = validateTimeSeriesDataPoint(jsonData)
 * if (result.success) {
 *   const dataPoint = result.data
 *   console.log(`Date: ${dataPoint.date}, Membership: ${dataPoint.membership}`)
 * } else {
 *   console.error(`Validation failed: ${result.error}`)
 * }
 * ```
 *
 * @see Requirements 13.5
 */
export function validateTimeSeriesDataPoint(
  data: unknown
): ValidationResult<TimeSeriesDataPoint> {
  const result = TimeSeriesDataPointSchema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return {
    success: false,
    error: `TimeSeriesDataPoint validation failed: ${result.error.message}`,
  }
}

/**
 * Validates a program year index file against the ProgramYearIndexFile schema.
 *
 * Use this function to validate program year index JSON files read from disk
 * or received from external sources.
 *
 * @param data - Unknown data to validate
 * @returns ValidationResult with typed ProgramYearIndexFile on success, or error message on failure
 *
 * @example
 * ```typescript
 * const jsonData = JSON.parse(fileContent)
 * const result = validateProgramYearIndexFile(jsonData)
 * if (result.success) {
 *   const indexFile = result.data
 *   console.log(`District: ${indexFile.districtId}, Year: ${indexFile.programYear}`)
 *   console.log(`Data points: ${indexFile.dataPoints.length}`)
 * } else {
 *   console.error(`Validation failed: ${result.error}`)
 * }
 * ```
 *
 * @see Requirements 13.5
 */
export function validateProgramYearIndexFile(
  data: unknown
): ValidationResult<ProgramYearIndexFile> {
  const result = ProgramYearIndexFileSchema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return {
    success: false,
    error: `ProgramYearIndexFile validation failed: ${result.error.message}`,
  }
}

/**
 * Validates time-series index metadata against the TimeSeriesIndexMetadata schema.
 *
 * Use this function to validate index-metadata.json files read from disk
 * or received from external sources.
 *
 * @param data - Unknown data to validate
 * @returns ValidationResult with typed TimeSeriesIndexMetadata on success, or error message on failure
 *
 * @example
 * ```typescript
 * const jsonData = JSON.parse(fileContent)
 * const result = validateTimeSeriesIndexMetadata(jsonData)
 * if (result.success) {
 *   const metadata = result.data
 *   console.log(`District: ${metadata.districtId}`)
 *   console.log(`Available years: ${metadata.availableProgramYears.join(', ')}`)
 * } else {
 *   console.error(`Validation failed: ${result.error}`)
 * }
 * ```
 *
 * @see Requirements 13.5
 */
export function validateTimeSeriesIndexMetadata(
  data: unknown
): ValidationResult<TimeSeriesIndexMetadata> {
  const result = TimeSeriesIndexMetadataSchema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return {
    success: false,
    error: `TimeSeriesIndexMetadata validation failed: ${result.error.message}`,
  }
}

/**
 * Validates a program year summary against the ProgramYearSummary schema.
 *
 * Use this function to validate program year summary data
 * read from disk or generated during computation.
 *
 * @param data - Unknown data to validate
 * @returns ValidationResult with typed ProgramYearSummary on success, or error message on failure
 *
 * @example
 * ```typescript
 * const jsonData = JSON.parse(fileContent)
 * const result = validateProgramYearSummary(jsonData)
 * if (result.success) {
 *   const summary = result.data
 *   console.log(`Total data points: ${summary.totalDataPoints}`)
 *   console.log(`Membership peak: ${summary.membershipPeak}`)
 * } else {
 *   console.error(`Validation failed: ${result.error}`)
 * }
 * ```
 *
 * @see Requirements 13.5
 */
export function validateProgramYearSummary(
  data: unknown
): ValidationResult<ProgramYearSummary> {
  const result = ProgramYearSummarySchema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return {
    success: false,
    error: `ProgramYearSummary validation failed: ${result.error.message}`,
  }
}
