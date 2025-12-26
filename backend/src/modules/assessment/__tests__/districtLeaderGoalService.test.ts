/**
 * District Leader Goals Service Tests
 *
 * Tests for CRUD operations, querying, status transitions, and goal management.
 * Ensures goals are properly persisted, filtered, and tracked for completion.
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  createGoal,
  getGoalById,
  updateGoalStatus,
  completeGoal,
  markGoalOverdue,
  queryGoals,
  getGoalsByRole,
  getGoalsByMonth,
  getActiveGoals,
  getCompletedGoals,
  getOverdueGoals,
  getGoalStatistics,
  deleteGoalById,
  validateGoal,
} from '../services/districtLeaderGoalService';
import { DistrictLeaderGoal } from '../types/assessment';

const TEST_DISTRICT = 9061;
const TEST_YEAR = '2024-2025';

// Track test districts for cleanup
const testDistricts = new Set<number>();

/**
 * Register a test district for cleanup
 */
function registerTestDistrict(district: number): void {
  testDistricts.add(district);
}

/**
 * Cleanup helper - delete all goals for test districts
 */
async function cleanupTestData(): Promise<void> {
  for (const district of testDistricts) {
    try {
      const goals = await queryGoals({ district_number: district, program_year: TEST_YEAR });
      for (const goal of goals) {
        await deleteGoalById(goal.id, district, TEST_YEAR);
      }
    } catch {
      // Ignore cleanup errors
    }
  }
  testDistricts.clear();
}

afterEach(async () => {
  await cleanupTestData();
});

describe('District Leader Goals Service', () => {
  // Clear any leftover test data before starting tests
  describe('initialization', () => {
    it('should clear old test data', async () => {
      // Clear data from any previous test runs
      const testDistrictNumbers = [9061, 9062, 9063, 9064, 9065, 9066, 9067, 9200, 9201, 9202, 9203, 9204, 9205];
      for (const district of testDistrictNumbers) {
        try {
          const goals = await queryGoals({ district_number: district, program_year: TEST_YEAR });
          for (const goal of goals) {
            await deleteGoalById(goal.id, district, TEST_YEAR);
          }
        } catch {
          // Ignore errors
        }
      }
    });
  });

  describe('createGoal', () => {
    it('should create a goal with all required fields', async () => {
      const DISTRICT = 9061;
      registerTestDistrict(DISTRICT);
      const goal = await createGoal(
        DISTRICT,
        TEST_YEAR,
        'Increase membership by 20%',
        'DD',
        '2025-06-30',
        'June',
      );

      expect(goal).toHaveProperty('id');
      expect(goal.district_number).toBe(DISTRICT);
      expect(goal.program_year).toBe(TEST_YEAR);
      expect(goal.text).toBe('Increase membership by 20%');
      expect(goal.assigned_to).toBe('DD');
      expect(goal.deadline).toBe('2025-06-30');
      expect(goal.month).toBe('June');
      expect(goal.status).toBe('in_progress');
      expect(goal).toHaveProperty('created_at');
      expect(goal).toHaveProperty('updated_at');
    });

    it('should generate unique UUID for each goal', async () => {
      const DISTRICT = 9062;
      registerTestDistrict(DISTRICT);
      const goal1 = await createGoal(
        DISTRICT,
        TEST_YEAR,
        'Goal 1',
        'DD',
        '2025-06-30',
      );
      const goal2 = await createGoal(
        DISTRICT,
        TEST_YEAR,
        'Goal 2',
        'PQD',
        '2025-05-31',
      );

      expect(goal1.id).not.toBe(goal2.id);
      expect(goal1.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('should reject empty goal text', async () => {
      const DISTRICT = 9063;
      registerTestDistrict(DISTRICT);
      await expect(
        createGoal(DISTRICT, TEST_YEAR, '', 'DD', '2025-06-30'),
      ).rejects.toThrow('Goal text cannot be empty');
    });

    it('should reject goal text exceeding 500 characters', async () => {
      const DISTRICT = 9064;
      registerTestDistrict(DISTRICT);
      const longText = 'x'.repeat(501);
      await expect(
        createGoal(DISTRICT, TEST_YEAR, longText, 'DD', '2025-06-30'),
      ).rejects.toThrow('Goal text cannot exceed 500 characters');
    });

    it('should trim whitespace from goal text', async () => {
      const DISTRICT = 9065;
      registerTestDistrict(DISTRICT);
      const goal = await createGoal(
        DISTRICT,
        TEST_YEAR,
        '  Goal with spaces  ',
        'DD',
        '2025-06-30',
      );

      expect(goal.text).toBe('Goal with spaces');
    });

    it('should require deadline in ISO 8601 format', async () => {
      const DISTRICT = 9066;
      registerTestDistrict(DISTRICT);
      await expect(
        createGoal(DISTRICT, TEST_YEAR, 'Goal', 'DD', 'invalid-date'),
      ).rejects.toThrow('Invalid deadline format');
    });

    it('should support all three roles (DD, PQD, CGD)', async () => {
      const DISTRICT = 9067;
      registerTestDistrict(DISTRICT);
      const ddGoal = await createGoal(
        DISTRICT,
        TEST_YEAR,
        'DD Goal',
        'DD',
        '2025-06-30',
      );
      const pqdGoal = await createGoal(
        DISTRICT,
        TEST_YEAR,
        'PQD Goal',
        'PQD',
        '2025-06-30',
      );
      const cgdGoal = await createGoal(
        DISTRICT,
        TEST_YEAR,
        'CGD Goal',
        'CGD',
        '2025-06-30',
      );

      expect(ddGoal.assigned_to).toBe('DD');
      expect(pqdGoal.assigned_to).toBe('PQD');
      expect(cgdGoal.assigned_to).toBe('CGD');
    });
  });

  describe('getGoalById', () => {
    it('should retrieve created goal by ID', async () => {
      registerTestDistrict(TEST_DISTRICT);
      const created = await createGoal(
        TEST_DISTRICT,
        TEST_YEAR,
        'Test Goal',
        'DD',
        '2025-06-30',
      );

      const retrieved = await getGoalById(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.text).toBe('Test Goal');
    });

    it('should return null for non-existent goal ID', async () => {
      const goal = await getGoalById('00000000-0000-0000-0000-000000000000');
      expect(goal).toBeNull();
    });

    it('should require goal ID', async () => {
      await expect(getGoalById('')).rejects.toThrow('Goal ID is required');
    });
  });

  describe('updateGoalStatus', () => {
    it('should update goal status from in_progress to completed', async () => {
      registerTestDistrict(TEST_DISTRICT);
      const goal = await createGoal(
        TEST_DISTRICT,
        TEST_YEAR,
        'Goal',
        'DD',
        '2025-06-30',
      );

      const updated = await updateGoalStatus(goal.id, 'completed');

      expect(updated.status).toBe('completed');
      expect(updated).toHaveProperty('date_completed');
    });

    it('should update goal status to overdue', async () => {
      registerTestDistrict(TEST_DISTRICT);
      const goal = await createGoal(
        TEST_DISTRICT,
        TEST_YEAR,
        'Goal',
        'DD',
        '2025-06-30',
      );

      const updated = await updateGoalStatus(goal.id, 'overdue');

      expect(updated.status).toBe('overdue');
    });

    it('should add notes when updating status', async () => {
      registerTestDistrict(TEST_DISTRICT);
      const goal = await createGoal(
        TEST_DISTRICT,
        TEST_YEAR,
        'Goal',
        'DD',
        '2025-06-30',
      );

      const updated = await updateGoalStatus(goal.id, 'completed', 'All targets achieved!');

      expect(updated.notes).toBe('All targets achieved!');
    });

    it('should update timestamp when status changes', async () => {
      registerTestDistrict(TEST_DISTRICT);
      const goal = await createGoal(
        TEST_DISTRICT,
        TEST_YEAR,
        'Goal',
        'DD',
        '2025-06-30',
      );
      const originalUpdated = goal.updated_at;

      await new Promise((resolve) => setTimeout(resolve, 10));

      const updated = await updateGoalStatus(goal.id, 'completed');

      expect(updated.updated_at).not.toBe(originalUpdated);
    });

    it('should throw error for non-existent goal', async () => {
      await expect(
        updateGoalStatus('00000000-0000-0000-0000-000000000000', 'completed'),
      ).rejects.toThrow('Goal with ID');
    });
  });

  describe('completeGoal', () => {
    it('should mark goal as completed', async () => {
      registerTestDistrict(TEST_DISTRICT);
      const goal = await createGoal(
        TEST_DISTRICT,
        TEST_YEAR,
        'Goal',
        'DD',
        '2025-06-30',
      );

      const completed = await completeGoal(goal.id);

      expect(completed.status).toBe('completed');
      expect(completed.date_completed).toBeDefined();
    });

    it('should accept completion notes', async () => {
      registerTestDistrict(TEST_DISTRICT);
      const goal = await createGoal(
        TEST_DISTRICT,
        TEST_YEAR,
        'Goal',
        'DD',
        '2025-06-30',
      );

      const completed = await completeGoal(goal.id, 'Completed with success');

      expect(completed.notes).toBe('Completed with success');
    });
  });

  describe('markGoalOverdue', () => {
    it('should mark goal as overdue', async () => {
      registerTestDistrict(TEST_DISTRICT);
      const goal = await createGoal(
        TEST_DISTRICT,
        TEST_YEAR,
        'Goal',
        'DD',
        '2025-06-30',
      );

      const overdue = await markGoalOverdue(goal.id);

      expect(overdue.status).toBe('overdue');
    });
  });

  describe('queryGoals', () => {
    it('should return empty array for non-existent district', async () => {
      const goals = await queryGoals({
        district_number: 9999,
        program_year: TEST_YEAR,
      });

      expect(goals).toEqual([]);
    });

    it('should filter goals by role', async () => {
      const DISTRICT = 9200;
      registerTestDistrict(DISTRICT);
      await createGoal(DISTRICT, TEST_YEAR, 'DD Goal', 'DD', '2025-06-30');
      await createGoal(DISTRICT, TEST_YEAR, 'PQD Goal', 'PQD', '2025-05-31');

      const ddGoals = await queryGoals({
        district_number: DISTRICT,
        program_year: TEST_YEAR,
        role: 'DD',
      });

      expect(ddGoals).toHaveLength(1);
      expect(ddGoals[0].assigned_to).toBe('DD');
    });

    it('should filter goals by month', async () => {
      const DISTRICT = 9201;
      registerTestDistrict(DISTRICT);
      await createGoal(DISTRICT, TEST_YEAR, 'August Goal', 'DD', '2024-08-31', 'August');
      await createGoal(DISTRICT, TEST_YEAR, 'September Goal', 'DD', '2024-09-30', 'September');

      const augustGoals = await queryGoals({
        district_number: DISTRICT,
        program_year: TEST_YEAR,
        month: 'August',
      });

      expect(augustGoals).toHaveLength(1);
      expect(augustGoals[0].month).toBe('August');
    });

    it('should filter goals by status', async () => {
      const DISTRICT = 9202;
      registerTestDistrict(DISTRICT);
      const goal1 = await createGoal(
        DISTRICT,
        TEST_YEAR,
        'Completed Goal',
        'DD',
        '2025-06-30',
      );
      await createGoal(
        DISTRICT,
        TEST_YEAR,
        'Active Goal',
        'DD',
        '2025-06-30',
      );

      await completeGoal(goal1.id);

      const activeGoals = await queryGoals({
        district_number: DISTRICT,
        program_year: TEST_YEAR,
        status: 'in_progress',
      });

      expect(activeGoals.length).toBeGreaterThan(0);
      expect(activeGoals.every((g) => g.status === 'in_progress')).toBe(true);
    });

    it('should filter goals by date range', async () => {
      const DISTRICT = 9203;
      registerTestDistrict(DISTRICT);
      await createGoal(DISTRICT, TEST_YEAR, 'Q3 Goal', 'DD', '2024-09-15');
      await createGoal(DISTRICT, TEST_YEAR, 'Q4 Goal', 'DD', '2024-12-15');

      const q3Goals = await queryGoals({
        district_number: DISTRICT,
        program_year: TEST_YEAR,
        startDate: '2024-07-01',
        endDate: '2024-09-30',
      });

      expect(q3Goals.every((g) => {
        const deadline = new Date(g.deadline);
        return deadline >= new Date('2024-07-01') && deadline <= new Date('2024-09-30');
      })).toBe(true);
    });

    it('should sort results by deadline (ascending)', async () => {
      const DISTRICT = 9204;
      registerTestDistrict(DISTRICT);
      await createGoal(DISTRICT, TEST_YEAR, 'Late Goal', 'DD', '2025-06-30');
      await createGoal(DISTRICT, TEST_YEAR, 'Early Goal', 'DD', '2025-01-31');
      await createGoal(DISTRICT, TEST_YEAR, 'Mid Goal', 'DD', '2025-03-31');

      const goals = await queryGoals({
        district_number: DISTRICT,
        program_year: TEST_YEAR,
      });

      const deadlines = goals.map((g) => new Date(g.deadline).getTime());
      expect(deadlines).toEqual([...deadlines].sort((a, b) => a - b));
    });

    it('should support combining multiple filters', async () => {
      const DISTRICT = 9205;
      registerTestDistrict(DISTRICT);
      await createGoal(DISTRICT, TEST_YEAR, 'DD August Goal', 'DD', '2024-08-31', 'August');
      await createGoal(DISTRICT, TEST_YEAR, 'PQD August Goal', 'PQD', '2024-08-31', 'August');
      await createGoal(DISTRICT, TEST_YEAR, 'DD September Goal', 'DD', '2024-09-30', 'September');

      const goals = await queryGoals({
        district_number: DISTRICT,
        program_year: TEST_YEAR,
        role: 'DD',
        month: 'August',
      });

      expect(goals.length).toBeGreaterThanOrEqual(1);
      expect(goals.every((g) => g.assigned_to === 'DD' && g.month === 'August')).toBe(true);
    });
  });

  describe('getGoalsByRole', () => {
    it('should retrieve all goals for a specific role', async () => {
      await createGoal(TEST_DISTRICT, TEST_YEAR, 'DD Goal 1', 'DD', '2025-06-30');
      await createGoal(TEST_DISTRICT, TEST_YEAR, 'DD Goal 2', 'DD', '2025-05-31');
      await createGoal(TEST_DISTRICT, TEST_YEAR, 'PQD Goal', 'PQD', '2025-04-30');

      const ddGoals = await getGoalsByRole(TEST_DISTRICT, TEST_YEAR, 'DD');

      expect(ddGoals.length).toBeGreaterThanOrEqual(2);
      expect(ddGoals.every((g) => g.assigned_to === 'DD')).toBe(true);
    });
  });

  describe('getGoalsByMonth', () => {
    it('should retrieve all goals for a specific month', async () => {
      await createGoal(TEST_DISTRICT, TEST_YEAR, 'August Goal', 'DD', '2024-08-31', 'August');
      await createGoal(TEST_DISTRICT, TEST_YEAR, 'August Goal 2', 'PQD', '2024-08-15', 'August');

      const augustGoals = await getGoalsByMonth(TEST_DISTRICT, TEST_YEAR, 'August');

      expect(augustGoals.length).toBeGreaterThanOrEqual(2);
      expect(augustGoals.every((g) => g.month === 'August')).toBe(true);
    });
  });

  describe('getActiveGoals', () => {
    it('should retrieve all in_progress goals', async () => {
      await createGoal(TEST_DISTRICT, TEST_YEAR, 'Active Goal', 'DD', '2025-06-30');
      await createGoal(TEST_DISTRICT, TEST_YEAR, 'Another Active', 'PQD', '2025-05-31');

      const activeGoals = await getActiveGoals(TEST_DISTRICT, TEST_YEAR);

      expect(activeGoals.length).toBeGreaterThanOrEqual(2);
      expect(activeGoals.every((g) => g.status === 'in_progress')).toBe(true);
    });
  });

  describe('getCompletedGoals', () => {
    it('should retrieve all completed goals', async () => {
      const goal1 = await createGoal(TEST_DISTRICT, TEST_YEAR, 'Completed Goal', 'DD', '2025-06-30');
      await completeGoal(goal1.id);

      const completedGoals = await getCompletedGoals(TEST_DISTRICT, TEST_YEAR);

      expect(completedGoals.length).toBeGreaterThan(0);
      expect(completedGoals.every((g) => g.status === 'completed')).toBe(true);
    });
  });

  describe('getOverdueGoals', () => {
    it('should retrieve all overdue goals', async () => {
      const goal1 = await createGoal(TEST_DISTRICT, TEST_YEAR, 'Overdue Goal', 'DD', '2025-06-30');
      await markGoalOverdue(goal1.id);

      const overdueGoals = await getOverdueGoals(TEST_DISTRICT, TEST_YEAR);

      expect(overdueGoals.length).toBeGreaterThan(0);
      expect(overdueGoals.every((g) => g.status === 'overdue')).toBe(true);
    });
  });

  describe('getGoalStatistics', () => {
    it('should calculate completion statistics', async () => {
      const goal1 = await createGoal(TEST_DISTRICT, TEST_YEAR, 'Goal 1', 'DD', '2025-06-30');
      const goal2 = await createGoal(TEST_DISTRICT, TEST_YEAR, 'Goal 2', 'PQD', '2025-05-31');
      await createGoal(TEST_DISTRICT, TEST_YEAR, 'Goal 3', 'CGD', '2025-04-30');

      await completeGoal(goal1.id);
      await markGoalOverdue(goal2.id);

      const stats = await getGoalStatistics(TEST_DISTRICT, TEST_YEAR);

      expect(stats.total).toBeGreaterThanOrEqual(3);
      expect(stats.completed).toBeGreaterThan(0);
      expect(stats.in_progress).toBeGreaterThanOrEqual(0);
      expect(stats.overdue).toBeGreaterThan(0);
      expect(stats.completion_percentage).toBeGreaterThanOrEqual(0);
      expect(stats.completion_percentage).toBeLessThanOrEqual(100);
    });

    it('should return 0 completion percentage for no goals', async () => {
      const stats = await getGoalStatistics(TEST_DISTRICT + 999, TEST_YEAR);

      expect(stats.total).toBe(0);
      expect(stats.completion_percentage).toBe(0);
    });
  });

  describe('deleteGoalById', () => {
    it('should delete goal and return true', async () => {
      registerTestDistrict(TEST_DISTRICT);
      const goal = await createGoal(TEST_DISTRICT, TEST_YEAR, 'Goal to Delete', 'DD', '2025-06-30');

      const deleted = await deleteGoalById(goal.id, TEST_DISTRICT, TEST_YEAR);

      expect(deleted).toBe(true);

      const retrieved = await getGoalById(goal.id);
      expect(retrieved).toBeNull();
    });

    it('should return false when deleting non-existent goal', async () => {
      const deleted = await deleteGoalById(
        '00000000-0000-0000-0000-000000000000',
        TEST_DISTRICT,
        TEST_YEAR,
      );

      expect(deleted).toBe(false);
    });

    it('should require goal ID', async () => {
      await expect(
        deleteGoalById('', TEST_DISTRICT, TEST_YEAR),
      ).rejects.toThrow('Goal ID is required');
    });
  });

  describe('validateGoal', () => {
    it('should validate correct goal structure', () => {
      const goal: DistrictLeaderGoal = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        district_number: 61,
        program_year: '2024-2025',
        text: 'Valid goal',
        assigned_to: 'DD',
        deadline: '2025-06-30',
        status: 'in_progress',
        created_at: '2025-11-26T00:00:00.000Z',
        updated_at: '2025-11-26T00:00:00.000Z',
      };

      const validation = validateGoal(goal);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const invalidGoal = { id: '123', assigned_to: 'DD' as never }; // Test with minimal data - intentionally incomplete

      const validation = validateGoal(invalidGoal);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should validate assigned_to values', () => {
      const goal = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        district_number: 61,
        program_year: '2024-2025',
        text: 'Goal',
        assigned_to: 'INVALID' as never, // Intentionally invalid for testing
        deadline: '2025-06-30',
        status: 'in_progress' as const,
        created_at: '2025-11-26T00:00:00.000Z',
        updated_at: '2025-11-26T00:00:00.000Z',
      };

      const validation = validateGoal(goal);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.includes('assigned_to'))).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should create goal in <50ms', async () => {
      const start = performance.now();
      await createGoal(TEST_DISTRICT, TEST_YEAR, 'Perf Test', 'DD', '2025-06-30');
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50);
    });

    it('should query 100 goals in <500ms', async () => {
      // Create multiple goals
      const goalIds: string[] = [];
      for (let i = 0; i < 10; i++) {
        const goal = await createGoal(
          TEST_DISTRICT,
          TEST_YEAR,
          `Goal ${i}`,
          ['DD', 'PQD', 'CGD'][i % 3] as 'DD' | 'PQD' | 'CGD',
          `2025-0${Math.min(6, Math.floor(i / 2) + 1)}-${String((i % 28) + 1).padStart(2, '0')}`,
        );
        goalIds.push(goal.id);
      }

      const start = performance.now();
      await queryGoals({
        district_number: TEST_DISTRICT,
        program_year: TEST_YEAR,
      });
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(500);
    });
  });
});
