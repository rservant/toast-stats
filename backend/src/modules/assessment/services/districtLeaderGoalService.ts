/**
 * District Leader Goals Service
 *
 * Manages CRUD operations, querying, and status tracking for district leader goals.
 * Goals are action items tracked for District Directors (DD), Program Quality Directors (PQD),
 * and Club Growth Directors (CGD) during the assessment process.
 *
 * Goals support:
 * - Creation with deadline and assigned role
 * - Status transitions: in_progress → completed, automatic overdue detection
 * - Querying with filters: by role, month, date range, status
 * - Persistence with file-based JSON storage
 */

import { v4 as uuidv4 } from 'uuid';
import { DistrictLeaderGoal } from '../types/assessment';
import { saveGoal, getGoal, listGoals, deleteGoal } from '../storage/assessmentStore';

/**
 * Query options for filtering goals
 */
export interface GoalQueryOptions {
  district_number: number;
  program_year: string;
  role?: 'DD' | 'PQD' | 'CGD'; // Filter by assigned role
  month?: string; // Filter by month (e.g., "August")
  status?: 'in_progress' | 'completed' | 'overdue'; // Filter by status
  startDate?: string; // ISO 8601 date for range filtering
  endDate?: string; // ISO 8601 date for range filtering
}

/**
 * Create a new district leader goal
 *
 * @param districtNumber - District number
 * @param programYear - Program year (e.g., "2024-2025")
 * @param text - Goal description
 * @param assignedTo - Role assigned: DD, PQD, or CGD
 * @param deadline - ISO 8601 deadline date
 * @param month - Optional month when goal is due
 * @returns Created goal with generated UUID and timestamps
 *
 * @example
 * const goal = createGoal(61, "2024-2025", "Increase membership by 20%", "DD", "2025-06-30", "June");
 * // Returns: {
 * //   id: "a1b2c3d4-...",
 * //   district_number: 61,
 * //   program_year: "2024-2025",
 * //   text: "Increase membership by 20%",
 * //   assigned_to: "DD",
 * //   deadline: "2025-06-30",
 * //   status: "in_progress",
 * //   created_at: "2025-11-26T...",
 * //   updated_at: "2025-11-26T..."
 * // }
 */
export async function createGoal(
  districtNumber: number,
  programYear: string,
  text: string,
  assignedTo: 'DD' | 'PQD' | 'CGD',
  deadline: string,
  month?: string,
): Promise<DistrictLeaderGoal> {
  // Validate inputs
  if (!text || text.trim().length === 0) {
    throw new Error('Goal text cannot be empty');
  }
  if (text.length > 500) {
    throw new Error('Goal text cannot exceed 500 characters');
  }
  if (!deadline) {
    throw new Error('Deadline is required (ISO 8601 format)');
  }

  // Validate deadline is future date
  const deadlineDate = new Date(deadline);
  if (isNaN(deadlineDate.getTime())) {
    throw new Error('Invalid deadline format (must be ISO 8601)');
  }

  // Validate program year format (e.g., "2024-2025")
  const programYearPattern = /^\d{4}-\d{4}$/;
  if (!programYearPattern.test(programYear)) {
    throw new Error('Invalid program year format (expected "YYYY-YYYY")');
  }

  const goal: DistrictLeaderGoal = {
    id: uuidv4(),
    district_number: districtNumber,
    program_year: programYear,
    month,
    text: text.trim(),
    assigned_to: assignedTo,
    deadline,
    status: 'in_progress',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await saveGoal(goal);
  return goal;
}

/**
 * Retrieve a goal by ID
 *
 * @param id - Goal UUID
 * @returns Goal object or null if not found
 */
export async function getGoalById(id: string): Promise<DistrictLeaderGoal | null> {
  if (!id) {
    throw new Error('Goal ID is required');
  }

  return getGoal(id);
}

/**
 * Update goal status and optional notes
 *
 * @param id - Goal UUID
 * @param status - New status: in_progress, completed, or overdue
 * @param notes - Optional update notes
 * @returns Updated goal
 *
 * @example
 * const updated = await updateGoalStatus(goalId, "completed", "All targets achieved");
 */
export async function updateGoalStatus(
  id: string,
  status: 'in_progress' | 'completed' | 'overdue',
  notes?: string,
): Promise<DistrictLeaderGoal> {
  const goal = await getGoal(id);
  if (!goal) {
    throw new Error(`Goal with ID ${id} not found`);
  }

  goal.status = status;
  if (status === 'completed') {
    goal.date_completed = new Date().toISOString();
  }
  if (notes) {
    goal.notes = notes;
  }
  goal.updated_at = new Date().toISOString();

  await saveGoal(goal);
  return goal;
}

/**
 * Mark goal as completed
 *
 * @param id - Goal UUID
 * @param notes - Optional completion notes
 * @returns Completed goal with date_completed timestamp
 */
export async function completeGoal(id: string, notes?: string): Promise<DistrictLeaderGoal> {
  return updateGoalStatus(id, 'completed', notes);
}

/**
 * Mark goal as overdue
 *
 * @param id - Goal UUID
 * @returns Updated goal with overdue status
 */
export async function markGoalOverdue(id: string): Promise<DistrictLeaderGoal> {
  return updateGoalStatus(id, 'overdue');
}

/**
 * Query goals with optional filtering
 *
 * @param options - Query options (district, year, optional filters)
 * @returns Array of goals matching query criteria
 *
 * @example
 * // Get all DD goals for August
 * const augustDDGoals = await queryGoals({
 *   district_number: 61,
 *   program_year: "2024-2025",
 *   role: "DD",
 *   month: "August"
 * });
 *
 * // Get all overdue goals
 * const overdueGoals = await queryGoals({
 *   district_number: 61,
 *   program_year: "2024-2025",
 *   status: "overdue"
 * });
 *
 * // Get goals with deadline in Q3
 * const q3Goals = await queryGoals({
 *   district_number: 61,
 *   program_year: "2024-2025",
 *   startDate: "2024-09-01",
 *   endDate: "2024-11-30"
 * });
 */
export async function queryGoals(options: GoalQueryOptions): Promise<DistrictLeaderGoal[]> {
  const { district_number, program_year, role, month, status, startDate, endDate } = options;

  // Get all goals for district/year
  const allGoals = await listGoals(district_number, program_year);

  // Apply filters
  let filtered = allGoals.filter((goal) => {
    // Role filter
    if (role && goal.assigned_to !== role) {
      return false;
    }

    // Month filter
    if (month && goal.month !== month) {
      return false;
    }

    // Status filter
    if (status && goal.status !== status) {
      return false;
    }

    // Date range filter
    if (startDate || endDate) {
      const goalDeadline = new Date(goal.deadline).getTime();
      if (startDate) {
        const start = new Date(startDate).getTime();
        if (goalDeadline < start) {
          return false;
        }
      }
      if (endDate) {
        const end = new Date(endDate).getTime();
        if (goalDeadline > end) {
          return false;
        }
      }
    }

    return true;
  });

  // Sort by deadline (ascending)
  filtered.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());

  return filtered;
}

/**
 * Get all goals for a specific role
 *
 * @param districtNumber - District number
 * @param programYear - Program year
 * @param role - Role: DD, PQD, or CGD
 * @returns Goals assigned to the specified role
 */
export async function getGoalsByRole(
  districtNumber: number,
  programYear: string,
  role: 'DD' | 'PQD' | 'CGD',
): Promise<DistrictLeaderGoal[]> {
  return queryGoals({
    district_number: districtNumber,
    program_year: programYear,
    role,
  });
}

/**
 * Get all goals for a specific month
 *
 * @param districtNumber - District number
 * @param programYear - Program year
 * @param month - Month name (e.g., "August")
 * @returns Goals scheduled for the specified month
 */
export async function getGoalsByMonth(
  districtNumber: number,
  programYear: string,
  month: string,
): Promise<DistrictLeaderGoal[]> {
  return queryGoals({
    district_number: districtNumber,
    program_year: programYear,
    month,
  });
}

/**
 * Get all active (in_progress) goals
 *
 * @param districtNumber - District number
 * @param programYear - Program year
 * @returns Goals with status "in_progress"
 */
export async function getActiveGoals(
  districtNumber: number,
  programYear: string,
): Promise<DistrictLeaderGoal[]> {
  return queryGoals({
    district_number: districtNumber,
    program_year: programYear,
    status: 'in_progress',
  });
}

/**
 * Get all completed goals
 *
 * @param districtNumber - District number
 * @param programYear - Program year
 * @returns Goals with status "completed"
 */
export async function getCompletedGoals(
  districtNumber: number,
  programYear: string,
): Promise<DistrictLeaderGoal[]> {
  return queryGoals({
    district_number: districtNumber,
    program_year: programYear,
    status: 'completed',
  });
}

/**
 * Get all overdue goals
 *
 * @param districtNumber - District number
 * @param programYear - Program year
 * @returns Goals with status "overdue"
 */
export async function getOverdueGoals(
  districtNumber: number,
  programYear: string,
): Promise<DistrictLeaderGoal[]> {
  return queryGoals({
    district_number: districtNumber,
    program_year: programYear,
    status: 'overdue',
  });
}

/**
 * Auto-detect and mark goals as overdue based on deadline
 *
 * Scans all in_progress goals and marks those with past deadlines as overdue.
 *
 * @param districtNumber - District number
 * @param programYear - Program year
 * @returns Array of newly marked overdue goals
 */
export async function detectAndMarkOverdueGoals(
  districtNumber: number,
  programYear: string,
): Promise<DistrictLeaderGoal[]> {
  const activeGoals = await getActiveGoals(districtNumber, programYear);
  const now = new Date();
  const overdueGoals: DistrictLeaderGoal[] = [];

  for (const goal of activeGoals) {
    const deadline = new Date(goal.deadline);
    if (deadline < now) {
      const marked = await markGoalOverdue(goal.id);
      overdueGoals.push(marked);
    }
  }

  return overdueGoals;
}

/**
 * Calculate goal completion statistics
 *
 * @param districtNumber - District number
 * @param programYear - Program year
 * @returns Statistics: total, completed, in_progress, overdue, completion percentage
 */
export async function getGoalStatistics(
  districtNumber: number,
  programYear: string,
): Promise<{
  total: number;
  completed: number;
  in_progress: number;
  overdue: number;
  completion_percentage: number;
}> {
  const allGoals = await listGoals(districtNumber, programYear);

  const completed = allGoals.filter((g) => g.status === 'completed').length;
  const inProgress = allGoals.filter((g) => g.status === 'in_progress').length;
  const overdue = allGoals.filter((g) => g.status === 'overdue').length;
  const total = allGoals.length;

  const completionPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    total,
    completed,
    in_progress: inProgress,
    overdue,
    completion_percentage: completionPercentage,
  };
}

/**
 * Delete a goal by ID
 *
 * @param id - Goal UUID
 * @param districtNumber - District number
 * @param programYear - Program year
 * @returns true if deleted, false if not found
 */
export async function deleteGoalById(
  id: string,
  districtNumber: number,
  programYear: string,
): Promise<boolean> {
  if (!id) {
    throw new Error('Goal ID is required');
  }

  return deleteGoal(districtNumber, programYear, id);
}

/**
 * Validate goal data structure
 *
 * @param goal - Goal object to validate
 * @returns { valid: boolean; errors: string[] }
 */
export function validateGoal(goal: Partial<DistrictLeaderGoal>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!goal.id) errors.push('Missing id');
  if (!goal.district_number || goal.district_number <= 0) errors.push('Invalid district_number');
  if (!goal.program_year) errors.push('Missing program_year');
  if (!goal.text || goal.text.length === 0) errors.push('Missing text');
  if (!goal.assigned_to || !['DD', 'PQD', 'CGD'].includes(goal.assigned_to))
    errors.push('Invalid assigned_to (must be DD, PQD, or CGD)');
  if (!goal.deadline) errors.push('Missing deadline');
  if (!goal.status || !['in_progress', 'completed', 'overdue'].includes(goal.status))
    errors.push('Invalid status');
  if (!goal.created_at) errors.push('Missing created_at');
  if (!goal.updated_at) errors.push('Missing updated_at');

  return {
    valid: errors.length === 0,
    errors,
  };
}
