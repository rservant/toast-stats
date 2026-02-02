/**
 * Zod validation schema for per-district data wrapper.
 *
 * This schema provides runtime validation for the per-district data wrapper
 * structure, ensuring that district JSON files written by scraper-cli and
 * read by backend conform to the expected structure.
 *
 * The schema matches the TypeScript interface in per-district-data.ts exactly.
 *
 * @module per-district-data.schema
 * @see Requirements 6.1, 6.2, 6.3
 */

import { z } from 'zod'
import { DistrictStatisticsFileSchema } from './district-statistics-file.schema.js'

/**
 * Zod schema for per-district data wrapper.
 * Validates PerDistrictData interface structure.
 *
 * This schema validates the wrapper structure for district JSON files,
 * including metadata about the collection process and the actual
 * district statistics data.
 *
 * @example
 * ```typescript
 * const result = PerDistrictDataSchema.safeParse(jsonData)
 * if (result.success) {
 *   const districtData = result.data
 *   console.log(`District ${districtData.districtId}: ${districtData.status}`)
 * }
 * ```
 */
export const PerDistrictDataSchema = z.object({
  /** District identifier (e.g., "42", "F") */
  districtId: z.string(),

  /** Display name (e.g., "District 42") */
  districtName: z.string(),

  /** ISO timestamp when data was collected */
  collectedAt: z.string(),

  /** Whether collection succeeded or failed */
  status: z.enum(['success', 'failed']),

  /** Error message if status is 'failed' */
  errorMessage: z.string().optional(),

  /** The actual district statistics data */
  data: DistrictStatisticsFileSchema,
})

/**
 * TypeScript type inferred from PerDistrictDataSchema.
 * Can be used for type-safe validation results.
 */
export type PerDistrictDataSchemaType = z.infer<typeof PerDistrictDataSchema>
