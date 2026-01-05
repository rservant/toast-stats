/**
 * Data validation service using Zod schemas
 *
 * This service validates normalized data against defined schemas to prevent
 * corrupted snapshots from being created. It ensures data integrity and
 * provides detailed validation feedback.
 */

import { z } from 'zod'
import type {
  NormalizedData,
  SnapshotValidationResult,
} from '../types/snapshots.js'
import type { DistrictStatistics } from '../types/districts.js'

/**
 * Zod schema for club membership data
 */
const ClubMembershipSchema = z.object({
  clubId: z.string().min(1, 'Club ID cannot be empty'),
  clubName: z.string().min(1, 'Club name cannot be empty'),
  memberCount: z.number().int().min(0, 'Member count must be non-negative'),
})

/**
 * Zod schema for membership statistics
 */
const MembershipStatsSchema = z
  .object({
    total: z.number().int().min(0, 'Total membership must be non-negative'),
    change: z.number().int(),
    changePercent: z.number(),
    byClub: z.array(ClubMembershipSchema),
    new: z.number().int().min(0).optional(),
    renewed: z.number().int().min(0).optional(),
    dual: z.number().int().min(0).optional(),
  })
  .refine(data => data.byClub.length > 0 || data.total === 0, {
    message: 'If total membership > 0, byClub array must not be empty',
  })

/**
 * Zod schema for club statistics
 */
const ClubStatsSchema = z
  .object({
    total: z.number().int().min(0, 'Total clubs must be non-negative'),
    active: z.number().int().min(0, 'Active clubs must be non-negative'),
    suspended: z.number().int().min(0, 'Suspended clubs must be non-negative'),
    ineligible: z
      .number()
      .int()
      .min(0, 'Ineligible clubs must be non-negative'),
    low: z.number().int().min(0, 'Low clubs must be non-negative'),
    distinguished: z
      .number()
      .int()
      .min(0, 'Distinguished clubs must be non-negative'),
    chartered: z.number().int().min(0).optional(),
  })
  .refine(
    data =>
      data.active + data.suspended + data.ineligible + data.low === data.total,
    { message: 'Club status counts must sum to total clubs' }
  )
  .refine(data => data.distinguished <= data.active, {
    message: 'Distinguished clubs cannot exceed active clubs',
  })

/**
 * Zod schema for monthly awards data
 */
const MonthlyAwardsSchema = z.object({
  month: z.string().min(1, 'Month cannot be empty'),
  count: z.number().int().min(0, 'Award count must be non-negative'),
})

/**
 * Zod schema for award type counts
 */
const AwardTypeCountSchema = z.object({
  type: z.string().min(1, 'Award type cannot be empty'),
  count: z.number().int().min(0, 'Award count must be non-negative'),
})

/**
 * Zod schema for club awards data
 */
const ClubAwardsSchema = z.object({
  clubId: z.string().min(1, 'Club ID cannot be empty'),
  clubName: z.string().min(1, 'Club name cannot be empty'),
  awards: z.number().int().min(0, 'Awards count must be non-negative'),
})

/**
 * Zod schema for education statistics
 */
const EducationStatsSchema = z
  .object({
    totalAwards: z.number().int().min(0, 'Total awards must be non-negative'),
    byType: z.array(AwardTypeCountSchema),
    topClubs: z.array(ClubAwardsSchema),
    byMonth: z.array(MonthlyAwardsSchema).optional(),
  })
  .refine(
    data => {
      const sumByType = data.byType.reduce((sum, item) => sum + item.count, 0)
      return sumByType === data.totalAwards
    },
    { message: 'Sum of awards by type must equal total awards' }
  )

/**
 * Zod schema for district goals
 */
const DistrictGoalsSchema = z.object({
  clubsGoal: z.number().int().min(0, 'Clubs goal must be non-negative'),
  membershipGoal: z
    .number()
    .int()
    .min(0, 'Membership goal must be non-negative'),
  distinguishedGoal: z
    .number()
    .int()
    .min(0, 'Distinguished goal must be non-negative'),
})

/**
 * Zod schema for district performance
 */
const DistrictPerformanceSchema = z.object({
  membershipNet: z.number().int(),
  clubsNet: z.number().int(),
  distinguishedPercent: z
    .number()
    .min(0)
    .max(100, 'Distinguished percent must be between 0 and 100'),
})

/**
 * Zod schema for scraped record data
 */
const ScrapedRecordSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.null()])
)

/**
 * Zod schema for district statistics
 */
const DistrictStatisticsSchema = z.object({
  districtId: z.string().min(1, 'District ID cannot be empty'),
  asOfDate: z.string().min(1, 'As of date cannot be empty'),
  membership: MembershipStatsSchema,
  clubs: ClubStatsSchema,
  education: EducationStatsSchema,
  goals: DistrictGoalsSchema.optional(),
  performance: DistrictPerformanceSchema.optional(),
  districtPerformance: z.array(ScrapedRecordSchema).optional(),
  divisionPerformance: z.array(ScrapedRecordSchema).optional(),
  clubPerformance: z.array(ScrapedRecordSchema).optional(),
})

/**
 * Zod schema for normalized data metadata
 */
const MetadataSchema = z.object({
  source: z.string().min(1, 'Source cannot be empty'),
  fetchedAt: z.string().datetime('Invalid fetchedAt timestamp format'),
  dataAsOfDate: z.string().min(1, 'Data as of date cannot be empty'),
  districtCount: z.number().int().min(0, 'District count must be non-negative'),
  processingDurationMs: z
    .number()
    .min(0, 'Processing duration must be non-negative'),
})

/**
 * Main Zod schema for normalized data
 */
const NormalizedDataSchema = z
  .object({
    districts: z
      .array(DistrictStatisticsSchema)
      .min(1, 'At least one district is required'),
    metadata: MetadataSchema,
  })
  .refine(data => data.districts.length === data.metadata.districtCount, {
    message:
      'District count in metadata must match actual districts array length',
  })

/**
 * Data validator class that validates normalized data against Zod schemas
 */
export class DataValidator {
  private readonly validatorVersion = '1.0.0'

  /**
   * Validate normalized data against the defined schema
   * @param data The normalized data to validate
   * @returns Validation result with success status, errors, and warnings
   */
  async validate(data: NormalizedData): Promise<SnapshotValidationResult> {
    const startTime = Date.now()
    const errors: string[] = []
    const warnings: string[] = []

    try {
      // Perform schema validation
      const result = NormalizedDataSchema.safeParse(data)

      if (!result.success) {
        // Extract detailed error messages from Zod
        result.error.issues.forEach(issue => {
          const path =
            issue.path.length > 0 ? ` at ${issue.path.join('.')}` : ''
          errors.push(`${issue.message}${path}`)
        })
      }

      // Additional business rule validations
      this.validateBusinessRules(data, warnings, errors)

      const validationDurationMs = Date.now() - startTime

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        validationMetadata: {
          validatedAt: new Date().toISOString(),
          validatorVersion: this.validatorVersion,
          validationDurationMs,
        },
      }
    } catch (error) {
      const validationDurationMs = Date.now() - startTime

      return {
        isValid: false,
        errors: [
          `Validation failed with unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ],
        warnings: [],
        validationMetadata: {
          validatedAt: new Date().toISOString(),
          validatorVersion: this.validatorVersion,
          validationDurationMs,
        },
      }
    }
  }

  /**
   * Validate additional business rules not covered by schema validation
   * @param data The normalized data to validate
   * @param warnings Array to collect warning messages
   * @param errors Array to collect error messages
   */
  private validateBusinessRules(
    data: NormalizedData,
    warnings: string[],
    errors: string[]
  ): void {
    // Validate district ID uniqueness
    const districtIds = data.districts.map(d => d.districtId)
    const uniqueDistrictIds = new Set(districtIds)
    if (districtIds.length !== uniqueDistrictIds.size) {
      errors.push('District IDs must be unique across all districts')
    }

    // Validate data freshness (warn if data is older than 7 days)
    const dataAsOfDate = new Date(data.metadata.dataAsOfDate)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    if (dataAsOfDate < sevenDaysAgo) {
      warnings.push(
        `Data is older than 7 days (as of ${data.metadata.dataAsOfDate})`
      )
    }

    // Validate processing duration (warn if unusually long)
    if (data.metadata.processingDurationMs > 300000) {
      // 5 minutes
      warnings.push(
        `Processing duration was unusually long: ${data.metadata.processingDurationMs}ms`
      )
    }

    // Validate district-level consistency
    data.districts.forEach((district, index) => {
      this.validateDistrictConsistency(district, index, warnings, errors)
    })

    // Validate metadata consistency
    const totalMembership = data.districts.reduce(
      (sum, d) => sum + d.membership.total,
      0
    )
    const totalClubs = data.districts.reduce((sum, d) => sum + d.clubs.total, 0)

    if (totalMembership === 0 && totalClubs > 0) {
      warnings.push(
        'Total membership is zero but clubs exist - this may indicate data collection issues'
      )
    }

    if (totalClubs === 0 && totalMembership > 0) {
      errors.push(
        'Total clubs is zero but membership exists - this is inconsistent'
      )
    }
  }

  /**
   * Validate consistency within a single district's data
   * @param district The district data to validate
   * @param index The index of the district in the array (for error reporting)
   * @param warnings Array to collect warning messages
   * @param errors Array to collect error messages
   */
  private validateDistrictConsistency(
    district: DistrictStatistics,
    index: number,
    warnings: string[],
    errors: string[]
  ): void {
    const prefix = `District ${district.districtId || index}`

    // Validate membership vs club consistency
    if (district.membership.total > 0 && district.clubs.total === 0) {
      errors.push(`${prefix}: Has membership but no clubs`)
    }

    // Validate club membership data consistency
    if (district.membership.byClub && district.membership.byClub.length > 0) {
      const sumByClub: number = district.membership.byClub.reduce(
        (sum: number, club: { memberCount: number }) => sum + club.memberCount,
        0
      )
      const tolerance = Math.max(
        1,
        Math.floor(district.membership.total * 0.01)
      ) // 1% tolerance or minimum 1

      if (Math.abs(sumByClub - district.membership.total) > tolerance) {
        warnings.push(
          `${prefix}: Sum of club memberships (${sumByClub}) doesn't match total membership (${district.membership.total})`
        )
      }
    }

    // Validate education awards consistency
    if (district.education.topClubs && district.education.topClubs.length > 0) {
      const totalClubAwards: number = district.education.topClubs.reduce(
        (sum: number, club: { awards: number }) => sum + club.awards,
        0
      )
      if (totalClubAwards > district.education.totalAwards) {
        warnings.push(
          `${prefix}: Sum of top club awards (${totalClubAwards}) exceeds total awards (${district.education.totalAwards})`
        )
      }
    }

    // Validate goals vs performance consistency
    if (district.goals && district.performance) {
      if (district.performance.distinguishedPercent > 100) {
        errors.push(`${prefix}: Distinguished percentage cannot exceed 100%`)
      }

      if (district.goals.distinguishedGoal > district.clubs.total) {
        warnings.push(
          `${prefix}: Distinguished goal (${district.goals.distinguishedGoal}) exceeds total clubs (${district.clubs.total})`
        )
      }
    }

    // Validate date format consistency
    try {
      new Date(district.asOfDate)
    } catch {
      errors.push(`${prefix}: Invalid asOfDate format: ${district.asOfDate}`)
    }
  }

  /**
   * Get the current validator version
   * @returns The version string of this validator
   */
  getValidatorVersion(): string {
    return this.validatorVersion
  }

  /**
   * Validate a partial data structure (useful for testing individual components)
   * @param data The partial data to validate
   * @param schemaName The name of the schema to use for validation
   * @returns Validation result
   */
  async validatePartial(
    data: unknown,
    schemaName: string
  ): Promise<SnapshotValidationResult> {
    const startTime = Date.now()
    const errors: string[] = []
    const warnings: string[] = []

    try {
      let schema: z.ZodSchema

      switch (schemaName) {
        case 'DistrictStatistics':
          schema = DistrictStatisticsSchema
          break
        case 'MembershipStats':
          schema = MembershipStatsSchema
          break
        case 'ClubStats':
          schema = ClubStatsSchema
          break
        case 'EducationStats':
          schema = EducationStatsSchema
          break
        case 'Metadata':
          schema = MetadataSchema
          break
        default:
          throw new Error(`Unknown schema name: ${schemaName}`)
      }

      const result = schema.safeParse(data)

      if (!result.success) {
        result.error.issues.forEach(issue => {
          const path =
            issue.path.length > 0 ? ` at ${issue.path.join('.')}` : ''
          errors.push(`${issue.message}${path}`)
        })
      }

      const validationDurationMs = Date.now() - startTime

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        validationMetadata: {
          validatedAt: new Date().toISOString(),
          validatorVersion: this.validatorVersion,
          validationDurationMs,
        },
      }
    } catch (error) {
      const validationDurationMs = Date.now() - startTime

      return {
        isValid: false,
        errors: [
          `Partial validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ],
        warnings: [],
        validationMetadata: {
          validatedAt: new Date().toISOString(),
          validatorVersion: this.validatorVersion,
          validationDurationMs,
        },
      }
    }
  }
}
