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
// types used by services and storage
import AssessmentGenerationService from '../services/assessmentGenerationService.js';
import CacheIntegrationService from '../services/cacheIntegrationService.js';

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

    // Manual entry is no longer supported. Direct clients to the generation endpoint.
    if (data && (data.membership_payments_ytd !== undefined || data.paid_clubs_ytd !== undefined || data.distinguished_clubs_ytd !== undefined || data.csp_submissions_ytd !== undefined)) {
      res.status(400).json({
        error: {
          code: 'MANUAL_ENTRY_NOT_SUPPORTED',
          message: 'Manual entry is disabled. Use POST /api/assessment/generate to create assessments from cached data.',
          suggestion: 'POST /api/assessment/generate with district_number, program_year, month, cache_date (optional)'
        }
      });
      return;
    }

    if (!district_number || !program_year || !month) {
      res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'district_number, program_year, and month are required',
        },
      });
      return;
    }

    // This route is deprecated for manual submissions - guide clients to generate endpoint
    res.status(301).json({
      error: 'Manual submission removed. Use POST /api/assessment/generate instead.'
    });
  })
);

/**
 * POST /api/assessment/generate
 * Generate an assessment from cache (automated)
 */
router.post(
  '/generate',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { district_number, program_year, month, cache_date } = req.body;

    if (!district_number || !program_year || !month) {
      res.status(400).json({
        error: { code: 'INVALID_REQUEST', message: 'district_number, program_year and month are required' },
      });
      return;
    }

    const generator = new AssessmentGenerationService();

    try {
        // Server-side enforcement: only allow generation for the current month if the previous month is complete
        const todayIso = new Date().toISOString().slice(0, 10);
        const currentMonth = todayIso.slice(0, 7); // YYYY-MM

        // compute previous month's last calendar day string YYYY-MM-DD
        const prev = new Date();
        prev.setDate(1);
        prev.setMonth(prev.getMonth() - 1);
        const prevYear = prev.getFullYear();
        const prevMonthIdx = prev.getMonth();
        const prevLastDay = new Date(prevYear, prevMonthIdx + 1, 0).getDate();
        const prevLastStr = `${prevYear.toString().padStart(4, '0')}-${String(prevMonthIdx + 1).padStart(2, '0')}-${String(prevLastDay).padStart(2, '0')}`;

        // If client requests generation for the current month, verify cache contains prevLastStr
        if (month === currentMonth) {
          const cacheSvc = new CacheIntegrationService();
          const dates = await cacheSvc.getAvailableDates(String(district_number));
          const available = (dates || []).map((d: any) => d.date);
          if (!available.includes(prevLastStr)) {
            res.status(400).json({
              error: {
                code: 'PREVIOUS_MONTH_INCOMPLETE',
                message: `Previous month is not complete. Cache must include ${prevLastStr} before generating current month's assessment.`,
              },
            });
            return;
          }
        }

        const assessment = await generator.generateMonthlyAssessment({ district_number, program_year, month, cache_date });
        res.status(201).json({ success: true, data: { assessment } });
    } catch (err) {
      res.status(400).json({ error: { code: 'GENERATION_FAILED', message: (err as Error).message } });
    }
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

    // Sanitize programYear (replace slashes with underscores to match storage)
    const sanitizedProgramYear = programYear.replace(/\//g, '_');

    // Validate month to prevent unsafe path usage
    const normalizedMonth = month.toLowerCase();
    const allowedMonths = new Set([
      '01', '02', '03', '04', '05', '06',
      '07', '08', '09', '10', '11', '12',
      'jan', 'feb', 'mar', 'apr', 'may', 'jun',
      'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
    ]);
    if (!allowedMonths.has(normalizedMonth)) {
      res.status(400).json({
        error: {
          code: 'INVALID_MONTH',
          message: 'Month parameter is invalid',
        },
      });
      return;
    }

    const assessment = await assessmentStore.getMonthlyAssessment(
      parseInt(districtId, 10),
      sanitizedProgramYear,
      normalizedMonth
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

    // Include audit trail and immutable flag in response
    const audit = await assessmentStore.getAuditTrail(
      parseInt(districtId, 10),
      sanitizedProgramYear,
      normalizedMonth
    );

    res.json({
      success: true,
      data: assessment,
      audit_trail: audit,
      read_only: !!(assessment as any)?.read_only,
      immutable: true,
    });
  })
);

/**
 * DELETE /api/assessment/monthly/:districtId/:programYear/:month
 * Delete a monthly assessment (allows regeneration)
 */
router.delete(
  '/monthly/:districtId/:programYear/:month',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { districtId, programYear, month } = req.params;

    // Validate month to prevent unsafe path usage
    const normalizedMonth = month.toLowerCase();
    const allowedMonths = new Set([
      '01', '02', '03', '04', '05', '06',
      '07', '08', '09', '10', '11', '12',
      'jan', 'feb', 'mar', 'apr', 'may', 'jun',
      'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
    ]);
    if (!allowedMonths.has(normalizedMonth)) {
      res.status(400).json({
        error: {
          code: 'INVALID_MONTH',
          message: 'Month parameter is invalid',
        },
      });
      return;
    }

    // Sanitize programYear (replace slashes with underscores to match storage)
    const sanitizedProgramYear = programYear.replace(/\//g, '_');

    await assessmentStore.deleteMonthlyAssessment(
      parseInt(districtId, 10),
      sanitizedProgramYear,
      normalizedMonth
    );

    res.json({
      success: true,
      message: 'Assessment deleted successfully',
      data: {
        district_id: districtId,
        program_year: programYear,
        month: normalizedMonth,
      }
    });
  })
);

/**
 * GET /api/assessment/available-dates/:districtId
 * List cached dates and completeness info for a district
 */
router.get(
  '/available-dates/:districtId',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { districtId } = req.params;

    if (!districtId) {
      res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'districtId required' } });
      return;
    }

    const cacheSvc = new CacheIntegrationService();
    const dates = await cacheSvc.getAvailableDates(districtId);

    res.json({ success: true, data: { district_id: districtId, available_dates: dates, recommended_date: dates.length > 0 ? dates[dates.length - 1].date : null } });
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
