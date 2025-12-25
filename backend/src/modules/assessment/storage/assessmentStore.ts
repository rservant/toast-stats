/**
 * File-based JSON storage for assessment data
 * Handles CRUD operations for monthly assessments, goals, and configuration
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { MonthlyAssessment, DistrictLeaderGoal, DistrictConfig } from '../types/assessment.js';

const DATA_DIR = path.join(process.cwd(), 'src', 'modules', 'assessment', 'storage', 'data');

/**
 * Sanitize a value so it is safe to use in a filename.
 * Allows only alphanumerics, underscore, and dash; replaces everything else with "_".
 */
function sanitizeForFilename(input: string): string {
  return input.replace(/[^A-Za-z0-9_-]/g, '_');
}

/**
 * Ensure data directory exists
 */
async function ensureDataDir(): Promise<void> {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

/**
 * Get file path for monthly assessment data
 */
function getAssessmentPath(districtNumber: number, programYear: string, month: string): string {
  const sanitizedDistrict = sanitizeForFilename(String(districtNumber));
  const sanitizedYear = sanitizeForFilename(programYear);
  const sanitizedMonth = sanitizeForFilename(month);
  return path.join(DATA_DIR, `assessment_${sanitizedDistrict}_${sanitizedYear}_${sanitizedMonth}.json`);
}

/**
 * Get file path for goals
 */
function getGoalsPath(districtNumber: number, programYear: string): string {
  const sanitizedDistrict = sanitizeForFilename(String(districtNumber));
  const sanitizedYear = sanitizeForFilename(programYear);
  return path.join(DATA_DIR, `goals_${sanitizedDistrict}_${sanitizedYear}.json`);
}

/**
 * Get file path for configuration
 */
function getConfigPath(districtNumber: number, programYear: string): string {
  const sanitizedDistrict = sanitizeForFilename(String(districtNumber));
  const sanitizedYear = sanitizeForFilename(programYear);
  return path.join(DATA_DIR, `config_${sanitizedDistrict}_${sanitizedYear}.json`);
}

/**
 * Save monthly assessment data
 */
export async function saveMonthlyAssessment(data: MonthlyAssessment): Promise<void> {
  await ensureDataDir();
  const filePath = getAssessmentPath(data.district_number, data.program_year, data.month);
  // Enforce immutability for auto-generated assessments: do not overwrite existing file
  try {
    await fs.access(filePath);
    // If file exists, throw - caller should delete first to regenerate
    throw new Error('Assessment already exists and is immutable. Delete before regenerating.');
  } catch (err) {
    // If ENOENT, file does not exist and we can proceed
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      // rethrow other access errors
      throw err;
    }
  }

  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Retrieve monthly assessment data
 */
export async function getMonthlyAssessment(
  districtNumber: number,
  programYear: string,
  month: string
): Promise<MonthlyAssessment | null> {
  try {
    const filePath = getAssessmentPath(districtNumber, programYear, month);
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data) as MonthlyAssessment;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw err;
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
  try {
    const filePath = getAssessmentPath(districtNumber, programYear, month);
    await fs.unlink(filePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      // File doesn't exist, return silently (idempotent)
      return;
    }
    throw err;
  }
}

/**
 * List all assessments for a district and year
 */
export async function listMonthlyAssessments(
  districtNumber: number,
  programYear: string
): Promise<MonthlyAssessment[]> {
  try {
    await ensureDataDir();
    const files = await fs.readdir(DATA_DIR);
    const prefix = `assessment_${districtNumber}_${programYear}_`;
    
    const assessments: MonthlyAssessment[] = [];
    for (const file of files) {
      if (file.startsWith(prefix) && file.endsWith('.json')) {
        const data = await fs.readFile(path.join(DATA_DIR, file), 'utf-8');
        assessments.push(JSON.parse(data) as MonthlyAssessment);
      }
    }
    
    return assessments.sort((a, b) => a.month.localeCompare(b.month));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

/**
 * Get audit trail for a monthly assessment (created_at, generated_from_cache_date, cache_files_used)
 */
export async function getAuditTrail(
  districtNumber: number,
  programYear: string,
  month: string
): Promise<{ created_at: string | null; generated_from_cache_date?: string | null; cache_files_used?: string[] } > {
  const assessment = await getMonthlyAssessment(districtNumber, programYear, month)
  if (!assessment) return { created_at: null }

  const created_at = assessment.created_at ?? null
  const generated_from_cache_date = (assessment as any).generated_from_cache_date ?? null
  const cache_files_used: string[] = []

  if ((assessment as any).data_sources) {
    for (const key of Object.keys((assessment as any).data_sources)) {
      const entry = (assessment as any).data_sources[key]
      if (entry && entry.cache_file) cache_files_used.push(entry.cache_file)
    }
  }

  return { created_at, generated_from_cache_date, cache_files_used }
}

/**
 * Save district leader goal
 */
export async function saveGoal(goal: DistrictLeaderGoal): Promise<void> {
  await ensureDataDir();
  const filePath = getGoalsPath(goal.district_number, goal.program_year);
  
  let goals: DistrictLeaderGoal[] = [];
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    goals = JSON.parse(data) as DistrictLeaderGoal[];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw err;
    }
  }
  
  // Update or add goal
  const index = goals.findIndex(g => g.id === goal.id);
  if (index >= 0) {
    goals[index] = goal;
  } else {
    goals.push(goal);
  }
  
  await fs.writeFile(filePath, JSON.stringify(goals, null, 2), 'utf-8');
}

/**
 * Retrieve goal by ID
 */
export async function getGoal(id: string): Promise<DistrictLeaderGoal | null> {
  try {
    await ensureDataDir();
    const files = await fs.readdir(DATA_DIR);
    
    for (const file of files) {
      if (file.startsWith('goals_') && file.endsWith('.json')) {
        const data = await fs.readFile(path.join(DATA_DIR, file), 'utf-8');
        const goals = JSON.parse(data) as DistrictLeaderGoal[];
        const goal = goals.find(g => g.id === id);
        if (goal) {
          return goal;
        }
      }
    }
    
    return null;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw err;
  }
}

/**
 * List all goals for a district and year
 */
export async function listGoals(
  districtNumber: number,
  programYear: string
): Promise<DistrictLeaderGoal[]> {
  try {
    const filePath = getGoalsPath(districtNumber, programYear);
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data) as DistrictLeaderGoal[];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

/**
 * Delete goal by ID
 */
export async function deleteGoal(districtNumber: number, programYear: string, goalId: string): Promise<boolean> {
  try {
    const filePath = getGoalsPath(districtNumber, programYear);
    const data = await fs.readFile(filePath, 'utf-8');
    let goals = JSON.parse(data) as DistrictLeaderGoal[];
    
    const initialLength = goals.length;
    goals = goals.filter(g => g.id !== goalId);
    
    if (goals.length < initialLength) {
      await fs.writeFile(filePath, JSON.stringify(goals, null, 2), 'utf-8');
      return true;
    }
    
    return false;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }
    throw err;
  }
}

/**
 * Save configuration
 */
export async function saveConfig(config: DistrictConfig): Promise<void> {
  await ensureDataDir();
  const filePath = getConfigPath(config.district_number, config.program_year);
  await fs.writeFile(filePath, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Retrieve configuration
 */
export async function getConfig(districtNumber: number, programYear: string): Promise<DistrictConfig | null> {
  try {
    const filePath = getConfigPath(districtNumber, programYear);
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data) as DistrictConfig;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw err;
  }
}
