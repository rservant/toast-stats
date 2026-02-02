/**
 * Schema version for file format compatibility.
 * Increment major version for breaking changes.
 */
export const SCHEMA_VERSION = '1.0.0'

/**
 * Calculation version for business logic compatibility.
 * Increment when computation algorithms change.
 */
export const CALCULATION_VERSION = '1.0.0'

/**
 * Ranking algorithm version.
 * Increment when ranking calculations change.
 */
export const RANKING_VERSION = '2.0'

/**
 * Check if a file's schema version is compatible with current version.
 */
export function isSchemaCompatible(fileVersion: string): boolean {
  const [fileMajor] = fileVersion.split('.')
  const [currentMajor] = SCHEMA_VERSION.split('.')
  return fileMajor === currentMajor
}
