/**
 * District ID Validator Service
 *
 * Validates district IDs to filter out invalid records during snapshot creation.
 * This addresses data quality issues where malformed records (e.g., "As of MM/DD/YYYY"
 * stored as district IDs) corrupt analytics data.
 *
 * Validation Rules:
 * 1. Not empty, null, or whitespace-only (Requirement 9.2)
 * 2. Does not match date pattern (e.g., "As of MM/DD/YYYY") (Requirement 9.1)
 * 3. Contains only alphanumeric characters (Requirement 9.3)
 *
 * @module DistrictIdValidator
 */

import { logger } from '../utils/logger.js'
import type { DistrictStatistics, ScrapedRecord } from '../types/districts.js'

/**
 * Result of validating a district ID
 */
export interface ValidationResult {
  /** Whether the district ID is valid */
  isValid: boolean
  /** Reason for rejection if invalid */
  reason?: string
}

/**
 * Result of filtering a list of districts
 */
export interface FilterResult {
  /** Districts that passed validation */
  valid: DistrictStatistics[]
  /** Districts that were rejected with reasons */
  rejected: Array<{ districtId: string; reason: string }>
}

/**
 * Result of filtering a list of scraped records
 */
export interface ScrapedRecordFilterResult {
  /** Records that passed validation */
  valid: ScrapedRecord[]
  /** Records that were rejected with reasons */
  rejected: Array<{ districtId: string; reason: string }>
}

/**
 * Interface for the District ID Validator service
 */
export interface IDistrictIdValidator {
  /**
   * Validate a district ID
   * @param districtId - The district ID to validate
   * @returns Validation result with reason if invalid
   */
  validate(districtId: string): ValidationResult

  /**
   * Filter valid districts from a list
   * @param districts - Array of district statistics to filter
   * @returns Object containing valid districts and rejected records with reasons
   */
  filterValid(districts: DistrictStatistics[]): FilterResult

  /**
   * Filter valid scraped records from a list
   * Extracts district ID from DISTRICT or District field in each record
   * @param records - Array of scraped records to filter
   * @returns Object containing valid records and rejected records with reasons
   */
  filterValidRecords(records: ScrapedRecord[]): ScrapedRecordFilterResult
}

/**
 * Pattern to match date strings like "As of MM/DD/YYYY" or "As of M/D/YYYY"
 * Case-insensitive to handle variations
 */
const DATE_PATTERN = /^As of \d{1,2}\/\d{1,2}\/\d{4}$/i

/**
 * Pattern for valid district IDs - only alphanumeric characters allowed
 */
const VALID_DISTRICT_ID_PATTERN = /^[A-Za-z0-9]+$/

/**
 * Rejection reasons for invalid district IDs
 */
export const RejectionReasons = {
  EMPTY: 'District ID is empty or null',
  WHITESPACE_ONLY: 'District ID contains only whitespace',
  DATE_PATTERN: 'District ID matches date pattern (e.g., "As of MM/DD/YYYY")',
  INVALID_CHARACTERS: 'District ID contains invalid characters (only alphanumeric allowed)',
} as const

/**
 * District ID Validator Service
 *
 * Validates district IDs according to the following rules:
 * - Must not be empty, null, or whitespace-only
 * - Must not match date patterns (e.g., "As of 01/20/2026")
 * - Must contain only alphanumeric characters
 */
export class DistrictIdValidator implements IDistrictIdValidator {
  /**
   * Validate a district ID
   *
   * @param districtId - The district ID to validate
   * @returns ValidationResult with isValid flag and optional rejection reason
   *
   * @example
   * ```typescript
   * const validator = new DistrictIdValidator();
   *
   * validator.validate("42");           // { isValid: true }
   * validator.validate("F");            // { isValid: true }
   * validator.validate("");             // { isValid: false, reason: "District ID is empty or null" }
   * validator.validate("As of 1/20/2026"); // { isValid: false, reason: "District ID matches date pattern..." }
   * validator.validate("district-42");  // { isValid: false, reason: "District ID contains invalid characters..." }
   * ```
   */
  validate(districtId: string): ValidationResult {
    // Rule 1: Check for empty or null (Requirement 9.2)
    if (districtId === null || districtId === undefined || districtId === '') {
      return {
        isValid: false,
        reason: RejectionReasons.EMPTY,
      }
    }

    // Rule 2: Check for whitespace-only (Requirement 9.2)
    const trimmed = districtId.trim()
    if (trimmed === '') {
      return {
        isValid: false,
        reason: RejectionReasons.WHITESPACE_ONLY,
      }
    }

    // Rule 3: Check for date pattern (Requirement 9.1)
    if (DATE_PATTERN.test(districtId)) {
      return {
        isValid: false,
        reason: RejectionReasons.DATE_PATTERN,
      }
    }

    // Rule 4: Check for valid characters - alphanumeric only (Requirement 9.3)
    if (!VALID_DISTRICT_ID_PATTERN.test(districtId)) {
      return {
        isValid: false,
        reason: RejectionReasons.INVALID_CHARACTERS,
      }
    }

    return { isValid: true }
  }

  /**
   * Filter valid districts from a list
   *
   * Validates each district's ID and separates valid from invalid records.
   * Logs warnings for rejected records to aid in debugging data quality issues.
   *
   * @param districts - Array of DistrictStatistics to filter
   * @returns FilterResult containing valid districts and rejected records with reasons
   *
   * @example
   * ```typescript
   * const validator = new DistrictIdValidator();
   * const districts = [
   *   { districtId: "42", ... },
   *   { districtId: "As of 1/20/2026", ... },
   *   { districtId: "61", ... }
   * ];
   *
   * const result = validator.filterValid(districts);
   * // result.valid = [{ districtId: "42", ... }, { districtId: "61", ... }]
   * // result.rejected = [{ districtId: "As of 1/20/2026", reason: "..." }]
   * ```
   */
  filterValid(districts: DistrictStatistics[]): FilterResult {
    const valid: DistrictStatistics[] = []
    const rejected: Array<{ districtId: string; reason: string }> = []

    for (const district of districts) {
      const validationResult = this.validate(district.districtId)

      if (validationResult.isValid) {
        valid.push(district)
      } else {
        const reason = validationResult.reason ?? 'Unknown validation error'
        rejected.push({
          districtId: district.districtId,
          reason,
        })

        // Log warning for rejected records (Requirement 9.4)
        logger.warn('Rejected invalid district ID during snapshot creation', {
          districtId: district.districtId,
          reason,
          asOfDate: district.asOfDate,
        })
      }
    }

    // Log summary if any records were rejected
    if (rejected.length > 0) {
      logger.info('District ID validation summary', {
        totalRecords: districts.length,
        validRecords: valid.length,
        rejectedRecords: rejected.length,
        rejectionReasons: this.summarizeRejectionReasons(rejected),
      })
    }

    return { valid, rejected }
  }

  /**
   * Filter valid scraped records from a list
   *
   * Validates each record's district ID (extracted from DISTRICT or District field)
   * and separates valid from invalid records.
   * Logs warnings for rejected records to aid in debugging data quality issues.
   *
   * @param records - Array of ScrapedRecord to filter
   * @returns ScrapedRecordFilterResult containing valid records and rejected records with reasons
   *
   * @example
   * ```typescript
   * const validator = new DistrictIdValidator();
   * const records = [
   *   { DISTRICT: "42", ... },
   *   { DISTRICT: "As of 1/20/2026", ... },
   *   { District: "61", ... }
   * ];
   *
   * const result = validator.filterValidRecords(records);
   * // result.valid = [{ DISTRICT: "42", ... }, { District: "61", ... }]
   * // result.rejected = [{ districtId: "As of 1/20/2026", reason: "..." }]
   * ```
   */
  filterValidRecords(records: ScrapedRecord[]): ScrapedRecordFilterResult {
    const valid: ScrapedRecord[] = []
    const rejected: Array<{ districtId: string; reason: string }> = []

    for (const record of records) {
      // Extract district ID from DISTRICT or District field
      const districtId = String(
        record['DISTRICT'] ?? record['District'] ?? ''
      )

      const validationResult = this.validate(districtId)

      if (validationResult.isValid) {
        valid.push(record)
      } else {
        const reason = validationResult.reason ?? 'Unknown validation error'
        rejected.push({
          districtId,
          reason,
        })

        // Log warning for rejected records (Requirement 9.4)
        logger.warn('Rejected invalid district ID during snapshot creation', {
          districtId,
          reason,
          recordKeys: Object.keys(record).slice(0, 5), // Log first 5 keys for context
        })
      }
    }

    // Log summary if any records were rejected
    if (rejected.length > 0) {
      logger.info('District ID validation summary for scraped records', {
        totalRecords: records.length,
        validRecords: valid.length,
        rejectedRecords: rejected.length,
        rejectionReasons: this.summarizeRejectionReasons(rejected),
      })
    }

    return { valid, rejected }
  }

  /**
   * Summarize rejection reasons for logging
   * @param rejected - Array of rejected records
   * @returns Object with counts per rejection reason
   */
  private summarizeRejectionReasons(
    rejected: Array<{ districtId: string; reason: string }>
  ): Record<string, number> {
    const summary: Record<string, number> = {}

    for (const record of rejected) {
      summary[record.reason] = (summary[record.reason] ?? 0) + 1
    }

    return summary
  }
}

/**
 * Factory function to create a DistrictIdValidator instance
 * @returns A new DistrictIdValidator instance
 */
export function createDistrictIdValidator(): IDistrictIdValidator {
  return new DistrictIdValidator()
}
