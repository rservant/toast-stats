/**
 * Per-district data wrapper type.
 *
 * This interface defines the wrapper structure for district JSON files.
 * It contains metadata about the collection process and the actual
 * district statistics data.
 *
 * File location: snapshots/{date}/district_{id}.json
 *
 * @module per-district-data
 * @see Requirements 2.1, 2.2, 2.3
 */

import type { DistrictStatisticsFile } from './district-statistics-file.js'

/**
 * Wrapper structure for district JSON files.
 *
 * This interface wraps the district statistics data with metadata
 * about the collection process, including status and error information.
 *
 * @example
 * ```typescript
 * const districtData: PerDistrictData = {
 *   districtId: "42",
 *   districtName: "District 42",
 *   collectedAt: "2024-01-15T10:30:00.000Z",
 *   status: "success",
 *   data: { ... }
 * }
 * ```
 */
export interface PerDistrictData {
  /** District identifier (e.g., "42", "F") */
  districtId: string

  /** Display name (e.g., "District 42") */
  districtName: string

  /** ISO timestamp when data was collected */
  collectedAt: string

  /** Whether collection succeeded or failed */
  status: 'success' | 'failed'

  /** Error message if status is 'failed' */
  errorMessage?: string

  /** The actual district statistics data */
  data: DistrictStatisticsFile
}
