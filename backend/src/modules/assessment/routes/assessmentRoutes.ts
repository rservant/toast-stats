/**
 * Assessment Routes
 *
 * Provides REST API endpoints for assessment operations:
 * - Monthly assessment CRUD
 * - District Leader Goal CRUD
 * - Report generation
 * - Goal querying and statistics
 */

import { Router, Request, Response, NextFunction } from 'express';
import * as districtLeaderGoalService from '../services/districtLeaderGoalService.js';
import * as assessmentReportGenerator from '../services/assessmentReportGenerator.js';
import * as assessmentStore from '../storage/assessmentStore.js';
import { loadConfig } from '../services/configService.js';
import type { MonthlyAssessment } from '../types/assessment.js';

const router = Router();

/**
 * Error handler middleware
 */
interface ApiError extends Error {
  status?: number;
  code?: string;
}

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * POST /api/assessment/monthly
 * Create or update a monthly assessment
 */
router.post(
  '/monthly',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { district_number, program_year, month, ...data } = req.body;

    if (!district_number || !program_year || !month) {
      res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'district_number, program_year, and month are required',
        },
      });
      return;
    }

    const assessment: MonthlyAssessment = {
      district_number,
      program_year,
      month,
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await assessmentStore.saveMonthlyAssessment(assessment);

    res.status(201).json({
      success: true,
      data: assessment,
    });
  })
);

/**
 * GET /api/assessment/monthly/:districtId/:programYear/:month
 * Retrieve a monthly assessment
 */
router.get(
  '/monthly/:districtId/:programYear/:month',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { districtId, programYear, month } = req.params;

    const assessment = await assessmentStore.getMonthlyAssessment(
      parseInt(districtId, 10),
      programYear,
      month
    );

    if (!assessment) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Assessment not found',
        },
      });
      return;
    }

    res.json({
      success: true,
      data: assessment,
    });
  })
);

/**
 * GET /api/assessment/goals
 * Query goals with filtering
 */
router.get(
  '/goals',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const {
      districtNumber,
      programYear,
      assignedTo,
      month,
      status,
      startDate,
      endDate,
    } = req.query;

    if (!districtNumber || !programYear) {
      res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'districtNumber and programYear are required',
        },
      });
      return;
    }

    const goals = await districtLeaderGoalService.queryGoals({
      district_number: parseInt(districtNumber as string, 10),
      program_year: programYear as string,
      role: assignedTo as 'DD' | 'PQD' | 'CGD' | undefined,
      month: month as string | undefined,
      status: (status as 'in_progress' | 'completed' | 'overdue' | undefined),
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
    });

    res.json({
      success: true,
      data: goals,
      count: goals.length,
    });
  })
);

/**
 * POST /api/assessment/goals
 * Create a new goal
 */
router.post(
  '/goals',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { district_number, program_year, text, assigned_to, deadline, month } =
      req.body;

    if (!district_number || !program_year || !text || !assigned_to || !deadline) {
      res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message:
            'district_number, program_year, text, assigned_to, and deadline are required',
        },
      });
      return;
    }

    const goal = await districtLeaderGoalService.createGoal(
      district_number,
      program_year,
      text,
      assigned_to,
      deadline,
      month,
    );

    res.status(201).json({
      success: true,
      data: goal,
    });
  })
);

/**
 * PUT /api/assessment/goals/:goalId/status
 * Update goal status
 */
router.put(
  '/goals/:goalId/status',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { goalId } = req.params;
    const { status } = req.body;

    if (!status) {
      res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'status is required',
        },
      });
      return;
    }

    const goal = await districtLeaderGoalService.updateGoalStatus(goalId, status);

    res.json({
      success: true,
      data: goal,
    });
  })
);

/**
 * DELETE /api/assessment/goals/:goalId
 * Delete a goal
 */
router.delete(
  '/goals/:goalId',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { goalId } = req.params;

    // Get goal to retrieve district and program year
    const goal = await districtLeaderGoalService.getGoalById(goalId);

    if (!goal) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Goal not found',
        },
      });
      return;
    }

    const result = await districtLeaderGoalService.deleteGoalById(
      goalId,
      goal.district_number,
      goal.program_year,
    );

    if (!result) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Goal not found',
        },
      });
      return;
    }

    res.json({
      success: true,
      message: 'Goal deleted',
    });
  })
);

/**
 * GET /api/assessment/report/:districtId/:programYear
 * Generate a complete year-end report
 */
router.get(
  '/report/:districtId/:programYear',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { districtId, programYear } = req.params;

    const districtNumber = parseInt(districtId, 10);

    // Load configuration
    const config = await loadConfig(districtNumber, programYear);

    if (!config) {
      res.status(404).json({
        error: {
          code: 'CONFIG_NOT_FOUND',
          message: `No configuration found for District ${districtNumber}, Program Year ${programYear}`,
        },
      });
      return;
    }

    // Get all monthly assessments
    const months = [
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
    ];

    const monthlyReports: assessmentReportGenerator.MonthlyReport[] = [];

    for (const month of months) {
      const assessment = await assessmentStore.getMonthlyAssessment(districtNumber, programYear, month);

      if (assessment) {
        const monthReport = assessmentReportGenerator.renderMonthlyReport(
          assessment,
          config
        );
        monthlyReports.push(monthReport);
      }
    }

    // Generate year-end summary
    const yearEndSummary = assessmentReportGenerator.renderYearEndSummary(
      monthlyReports,
      config
    );

    res.json({
      success: true,
      data: {
        district_number: districtNumber,
        program_year: programYear,
        monthly_reports: monthlyReports,
        year_end_summary: yearEndSummary,
        generated_at: new Date().toISOString(),
      },
    });
  })
);

/**
 * GET /api/assessment/goals/statistics/:districtId/:programYear
 * Get goal statistics
 */
router.get(
  '/goals/statistics/:districtId/:programYear',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { districtId, programYear } = req.params;

    const stats = await districtLeaderGoalService.getGoalStatistics(
      parseInt(districtId, 10),
      programYear
    );

    res.json({
      success: true,
      data: stats,
    });
  })
);

/**
 * Error handling middleware for this router
 */
router.use(
  (err: ApiError, _req: Request, res: Response, _next: NextFunction): void => {
    const status = err.status || 500;
    const code = err.code || 'INTERNAL_SERVER_ERROR';

    res.status(status).json({
      error: {
        code,
        message: err.message || 'An error occurred',
      },
    });
  }
);

export default router;
