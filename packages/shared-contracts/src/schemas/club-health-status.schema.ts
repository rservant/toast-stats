/**
 * Zod validation schema for ClubHealthStatus type.
 *
 * This schema provides runtime validation for club health status values,
 * ensuring that data written by scraper-cli and read by backend conforms
 * to the expected values.
 *
 * The schema matches the TypeScript type in club-health-status.ts exactly.
 *
 * @module club-health-status.schema
 * @see Requirements 1.2
 */

import { z } from 'zod'

/**
 * Zod schema for ClubHealthStatus validation.
 *
 * Valid values:
 * - 'thriving': Club meets all health requirements
 * - 'vulnerable': Club has some but not all requirements met
 * - 'intervention-required': Club needs immediate attention
 *
 * @example
 * ```typescript
 * const result = ClubHealthStatusSchema.safeParse('intervention-required')
 * if (result.success) {
 *   const status = result.data // type: ClubHealthStatus
 * }
 * ```
 */
export const ClubHealthStatusSchema = z.enum([
  'thriving',
  'vulnerable',
  'intervention-required',
])

/**
 * TypeScript type inferred from ClubHealthStatusSchema.
 * Can be used for type-safe validation results.
 */
export type ClubHealthStatusSchemaType = z.infer<typeof ClubHealthStatusSchema>
