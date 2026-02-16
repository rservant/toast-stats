/**
 * Schema versioning for pre-computed analytics files.
 *
 * The schema version tracks the structure of analytics output files.
 * Major version changes indicate breaking changes that require recomputation.
 * Minor version changes are backward compatible additions.
 * Patch version changes are bug fixes that don't affect structure.
 */
export const ANALYTICS_SCHEMA_VERSION = '1.0.0'
export const COMPUTATION_VERSION = '1.0.0'
/**
 * Checks if a file's schema version is compatible with the current version.
 * Compatibility is determined by major version matching.
 *
 * @param fileVersion - The schema version from a pre-computed analytics file
 * @returns true if the file version is compatible with the current version
 */
export function isCompatibleVersion(fileVersion) {
  const fileParts = fileVersion.split('.')
  const currentParts = ANALYTICS_SCHEMA_VERSION.split('.')
  const fileMajor = fileParts[0]
  const currentMajor = currentParts[0]
  return fileMajor === currentMajor
}
