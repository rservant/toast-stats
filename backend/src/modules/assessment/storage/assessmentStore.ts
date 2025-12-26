/**
 * File-based JSON storage for assessment data
 * Handles CRUD operations for monthly assessments, goals, and configuration
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import {
  MonthlyAssessment,
  DistrictLeaderGoal,
  DistrictConfig,
} from '../types/assessment.js'

interface ErrnoException extends Error {
  code?: string
  errno?: number
  path?: string
  syscall?: string
}

interface AssessmentWithDataSources extends MonthlyAssessment {
  data_sources?: Record<string, { cache_file?: string }>
}

const DATA_DIR = path.resolve(__dirname, 'data')

/**
 * Validate district number to ensure it's a positive integer
 */
function validateDistrictNumber(districtNumber: number): void {
  if (!Number.isInteger(districtNumber) || districtNumber <= 0) {
    throw new Error('Invalid district number: must be a positive integer')
  }
}

/**
 * Validate program year format (YYYY-YYYY)
 */
function validateProgramYear(programYear: string): void {
  if (!/^\d{4}-\d{4}$/.test(programYear)) {
    throw new Error('Invalid program year format: must be YYYY-YYYY')
  }
}

/**
 * Validate month format (YYYY-MM)
 */
function validateMonth(month: string): void {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error('Invalid month format: must be YYYY-MM')
  }
}

/**
 * Validate goal ID to ensure it's safe for file operations
 */
function validateGoalId(goalId: string): void {
  if (!goalId || typeof goalId !== 'string' || goalId.trim().length === 0) {
    throw new Error('Invalid goal ID: must be a non-empty string')
  }

  // Ensure goal ID doesn't contain path separators or other unsafe characters
  if (!/^[A-Za-z0-9_-]+$/.test(goalId.trim())) {
    throw new Error(
      'Invalid goal ID: must contain only alphanumeric characters, underscores, and dashes'
    )
  }
}

/**
 * Sanitize a value so it is safe to use in a filename.
 * Allows only alphanumerics, underscore, and dash; replaces everything else with "_".
 */
function sanitizeForFilename(input: string): string {
  return input.replace(/[^A-Za-z0-9_-]/g, '_')
}

/**
 * Resolve a filename within the DATA_DIR and ensure it does not escape the directory.
 */
function resolveDataPath(fileName: string): string {
  const fullPath = path.resolve(DATA_DIR, fileName)
  const dataDirWithSep = DATA_DIR.endsWith(path.sep)
    ? DATA_DIR
    : DATA_DIR + path.sep
  if (!(fullPath === DATA_DIR || fullPath.startsWith(dataDirWithSep))) {
    throw new Error('Resolved path escapes data directory')
  }
  return fullPath
}

/**
 * Ensure data directory exists
 */
async function ensureDataDir(): Promise<void> {
  try {
    await fs.access(DATA_DIR)
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true })
  }
}

/**
 * Get file path for monthly assessment data (internal - assumes validation already done)
 */
function getAssessmentPathInternal(
  districtNumber: number,
  programYear: string,
  month: string
): string {
  const sanitizedDistrict = sanitizeForFilename(String(districtNumber))
  const sanitizedYear = sanitizeForFilename(programYear)
  const sanitizedMonth = sanitizeForFilename(month)
  const fileName = `assessment_${sanitizedDistrict}_${sanitizedYear}_${sanitizedMonth}.json`
  return resolveDataPath(fileName)
}

/**
 * Get file path for monthly assessment data
 */
function getAssessmentPath(
  districtNumber: number,
  programYear: string,
  month: string
): string {
  // Validate inputs before using in file path
  validateDistrictNumber(districtNumber)
  validateProgramYear(programYear)
  validateMonth(month)

  return getAssessmentPathInternal(districtNumber, programYear, month)
}

/**
 * Get file path for goals
 */
function getGoalsPath(districtNumber: number, programYear: string): string {
  // Validate inputs before using in file path
  validateDistrictNumber(districtNumber)
  validateProgramYear(programYear)

  const sanitizedDistrict = sanitizeForFilename(String(districtNumber))
  const sanitizedYear = sanitizeForFilename(programYear)
  const fileName = `goals_${sanitizedDistrict}_${sanitizedYear}.json`
  return resolveDataPath(fileName)
}

/**
 * Get file path for configuration
 */
function getConfigPath(districtNumber: number, programYear: string): string {
  // Validate inputs before using in file path
  validateDistrictNumber(districtNumber)
  validateProgramYear(programYear)

  const sanitizedDistrict = sanitizeForFilename(String(districtNumber))
  const sanitizedYear = sanitizeForFilename(programYear)
  const fileName = `config_${sanitizedDistrict}_${sanitizedYear}.json`
  return resolveDataPath(fileName)
}

/**
 * Save monthly assessment data
 */
export async function saveMonthlyAssessment(
  data: MonthlyAssessment
): Promise<void> {
  await ensureDataDir()
  const filePath = getAssessmentPath(
    data.district_number,
    data.program_year,
    data.month
  )
  // Enforce immutability for auto-generated assessments: do not overwrite existing file
  try {
    await fs.access(filePath)
    // If file exists, throw - caller should delete first to regenerate
    throw new Error(
      'Assessment already exists and is immutable. Delete before regenerating.'
    )
  } catch (err) {
    // If ENOENT, file does not exist and we can proceed
    if ((err as ErrnoException).code !== 'ENOENT') {
      // rethrow other access errors
      throw err
    }
  }

  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

/**
 * Retrieve monthly assessment data
 */
export async function getMonthlyAssessment(
  districtNumber: number,
  programYear: string,
  month: string
): Promise<MonthlyAssessment | null> {
  // Validate inputs before using in file path - these should throw immediately
  validateDistrictNumber(districtNumber)
  validateProgramYear(programYear)
  validateMonth(month)

  try {
    const filePath = getAssessmentPathInternal(
      districtNumber,
      programYear,
      month
    )
    const data = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(data) as MonthlyAssessment
  } catch (err) {
    // Only catch file system errors, not validation errors
    if ((err as ErrnoException).code === 'ENOENT') {
      return null
    }
    throw err
  }
}

/**
 * Delete monthly assessment data (allows regeneration)
 */
export async function deleteMonthlyAssessment(
  districtNumber: number,
  programYear: string,
  month: string
): Promise<void> {
  // Validate inputs before using in file path
  validateDistrictNumber(districtNumber)
  validateProgramYear(programYear)
  validateMonth(month)

  try {
    const filePath = getAssessmentPath(districtNumber, programYear, month)
    await fs.unlink(filePath)
  } catch (err) {
    if ((err as ErrnoException).code === 'ENOENT') {
      // File doesn't exist, return silently (idempotent)
      return
    }
    throw err
  }
}

/**
 * List all assessments for a district and year
 */
export async function listMonthlyAssessments(
  districtNumber: number,
  programYear: string
): Promise<MonthlyAssessment[]> {
  // Validate inputs before using in file operations
  validateDistrictNumber(districtNumber)
  validateProgramYear(programYear)

  try {
    await ensureDataDir()
    const files = await fs.readdir(DATA_DIR)
    const prefix = `assessment_${districtNumber}_${programYear}_`

    const assessments: MonthlyAssessment[] = []
    for (const file of files) {
      if (file.startsWith(prefix) && file.endsWith('.json')) {
        const data = await fs.readFile(path.join(DATA_DIR, file), 'utf-8')
        assessments.push(JSON.parse(data) as MonthlyAssessment)
      }
    }

    return assessments.sort((a, b) => a.month.localeCompare(b.month))
  } catch (err) {
    if ((err as ErrnoException).code === 'ENOENT') {
      return []
    }
    throw err
  }
}

/**
 * Get audit trail for a monthly assessment (created_at, generated_from_cache_date, cache_files_used)
 */
export async function getAuditTrail(
  districtNumber: number,
  programYear: string,
  month: string
): Promise<{
  created_at: string | null
  generated_from_cache_date?: string | null
  cache_files_used?: string[]
}> {
  // Validate inputs before using in file operations
  validateDistrictNumber(districtNumber)
  validateProgramYear(programYear)
  validateMonth(month)

  const assessment = await getMonthlyAssessment(
    districtNumber,
    programYear,
    month
  )
  if (!assessment) return { created_at: null }

  const created_at = assessment.created_at ?? null
  const assessmentWithSources = assessment as AssessmentWithDataSources
  const generated_from_cache_date =
    assessmentWithSources.generated_from_cache_date ?? null
  const cache_files_used: string[] = []

  if (assessmentWithSources.data_sources) {
    for (const key of Object.keys(assessmentWithSources.data_sources)) {
      const entry = assessmentWithSources.data_sources[key]
      if (entry && entry.cache_file) cache_files_used.push(entry.cache_file)
    }
  }

  return { created_at, generated_from_cache_date, cache_files_used }
}

/**
 * Save district leader goal
 */
export async function saveGoal(goal: DistrictLeaderGoal): Promise<void> {
  await ensureDataDir()
  const filePath = getGoalsPath(goal.district_number, goal.program_year)

  let goals: DistrictLeaderGoal[] = []
  try {
    const data = await fs.readFile(filePath, 'utf-8')
    goals = JSON.parse(data) as DistrictLeaderGoal[]
  } catch (err) {
    if ((err as ErrnoException).code !== 'ENOENT') {
      throw err
    }
  }

  // Update or add goal
  const index = goals.findIndex(g => g.id === goal.id)
  if (index >= 0) {
    goals[index] = goal
  } else {
    goals.push(goal)
  }

  await fs.writeFile(filePath, JSON.stringify(goals, null, 2), 'utf-8')
}

/**
 * Retrieve goal by ID
 */
export async function getGoal(id: string): Promise<DistrictLeaderGoal | null> {
  // Validate goal ID before using in file operations
  validateGoalId(id)

  try {
    await ensureDataDir()
    const files = await fs.readdir(DATA_DIR)

    for (const file of files) {
      if (file.startsWith('goals_') && file.endsWith('.json')) {
        const data = await fs.readFile(resolveDataPath(file), 'utf-8')
        const goals = JSON.parse(data) as DistrictLeaderGoal[]
        const goal = goals.find(g => g.id === id)
        if (goal) {
          return goal
        }
      }
    }

    return null
  } catch (err) {
    if ((err as ErrnoException).code === 'ENOENT') {
      return null
    }
    throw err
  }
}

/**
 * List all goals for a district and year
 */
export async function listGoals(
  districtNumber: number,
  programYear: string
): Promise<DistrictLeaderGoal[]> {
  // Validate inputs before using in file operations
  validateDistrictNumber(districtNumber)
  validateProgramYear(programYear)

  try {
    const filePath = getGoalsPath(districtNumber, programYear)
    const data = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(data) as DistrictLeaderGoal[]
  } catch (err) {
    if ((err as ErrnoException).code === 'ENOENT') {
      return []
    }
    throw err
  }
}

/**
 * Delete goal by ID
 */
export async function deleteGoal(
  districtNumber: number,
  programYear: string,
  goalId: string
): Promise<boolean> {
  // Validate inputs before using in file operations
  validateDistrictNumber(districtNumber)
  validateProgramYear(programYear)
  validateGoalId(goalId)

  try {
    const filePath = getGoalsPath(districtNumber, programYear)
    const data = await fs.readFile(filePath, 'utf-8')
    let goals = JSON.parse(data) as DistrictLeaderGoal[]

    const initialLength = goals.length
    goals = goals.filter(g => g.id !== goalId)

    if (goals.length < initialLength) {
      await fs.writeFile(filePath, JSON.stringify(goals, null, 2), 'utf-8')
      return true
    }

    return false
  } catch (err) {
    if ((err as ErrnoException).code === 'ENOENT') {
      return false
    }
    throw err
  }
}

/**
 * Save configuration
 */
export async function saveConfig(config: DistrictConfig): Promise<void> {
  await ensureDataDir()
  const filePath = getConfigPath(config.district_number, config.program_year)
  await fs.writeFile(filePath, JSON.stringify(config, null, 2), 'utf-8')
}

/**
 * Retrieve configuration
 */
export async function getConfig(
  districtNumber: number,
  programYear: string
): Promise<DistrictConfig | null> {
  // Validate inputs before using in file operations
  validateDistrictNumber(districtNumber)
  validateProgramYear(programYear)

  try {
    const filePath = getConfigPath(districtNumber, programYear)
    const data = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(data) as DistrictConfig
  } catch (err) {
    if ((err as ErrnoException).code === 'ENOENT') {
      return null
    }
    throw err
  }
}
