/**
 * Assessment Report Generator Tests
 *
 * Tests for monthly reports, year-end summaries, and report validation.
 * Ensures reports accurately reflect goal statuses and match Excel layout.
 */

import { describe, it, expect } from 'vitest';
import {
  renderMonthlyReport,
  renderYearEndSummary,
  calculateMonthlyAchievementPercentage,
  formatReportTimestamp,
  validateReportStructure,
  MonthlyReport,
} from '../services/assessmentReportGenerator';
import { DistrictConfig, MonthlyAssessment } from '../types/assessment';

// Mock config matching District 61 sample
const mockConfig: DistrictConfig = {
  district_number: 61,
  program_year: '2024-2025',
  year_end_targets: {
    membership_growth: 120,
    club_growth: 12,
    distinguished_clubs: 24,
  },
  recognition_levels: [
    {
      level: 'Distinguished',
      membershipPaymentsTarget: 30,
      paidClubsTarget: 3,
      distinguishedClubsTarget: 6,
    },
    {
      level: 'Select',
      membershipPaymentsTarget: 25,
      paidClubsTarget: 2,
      distinguishedClubsTarget: 5,
    },
    {
      level: "President's",
      membershipPaymentsTarget: 20,
      paidClubsTarget: 2,
      distinguishedClubsTarget: 4,
    },
    {
      level: 'Smedley Distinguished',
      membershipPaymentsTarget: 45,
      paidClubsTarget: 5,
      distinguishedClubsTarget: 9,
    },
  ],
  csp_submission_target: 40,
  csp_to_distinguished_clubs_ratio: 0.3,
};

// Helper: Create monthly assessment for testing
function createAssessment(
  month: string,
  membership: number,
  clubs: number,
  distinguished: number | null,
  csp: number,
): MonthlyAssessment {
  return {
    district_number: 61,
    program_year: '2024-2025',
    month,
    membership_payments_ytd: membership,
    paid_clubs_ytd: clubs,
    distinguished_clubs_ytd: distinguished,
    csp_submissions_ytd: csp,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

describe('Assessment Report Generator', () => {
  describe('renderMonthlyReport', () => {
    it('should generate monthly report with all required fields', () => {
      const assessment = createAssessment('August', 25, 3, 5, 20);
      const report = renderMonthlyReport(assessment, mockConfig);

      expect(report).toHaveProperty('district_number', 61);
      expect(report).toHaveProperty('program_year', '2024-2025');
      expect(report).toHaveProperty('month', 'August');
      expect(report).toHaveProperty('month_number', 2);
      expect(report).toHaveProperty('report_generated_at');
      expect(report).toHaveProperty('metrics');
      expect(report).toHaveProperty('goal_1');
      expect(report).toHaveProperty('goal_2');
      expect(report).toHaveProperty('goal_3');
      expect(report).toHaveProperty('recognition_levels');
      expect(report).toHaveProperty('overall_status');
    });

    it('should capture actual metrics in monthly report', () => {
      const assessment = createAssessment('September', 35, 5, 8, 25);
      const report = renderMonthlyReport(assessment, mockConfig);

      expect(report.metrics.membership_payments_ytd).toBe(35);
      expect(report.metrics.paid_clubs_ytd).toBe(5);
      expect(report.metrics.distinguished_clubs_ytd).toBe(8);
      expect(report.metrics.csp_submissions_ytd).toBe(25);
    });

    it('should calculate correct month number for each month', () => {
      const monthTests: Array<[string, number]> = [
        ['July', 1],
        ['August', 2],
        ['September', 3],
        ['October', 4],
        ['November', 5],
        ['December', 6],
        ['January', 7],
        ['February', 8],
        ['March', 9],
        ['April', 10],
        ['May', 11],
        ['June', 12],
      ];

      for (const [month, expectedNumber] of monthTests) {
        const assessment = createAssessment(month, 30, 5, 5, 20);
        const report = renderMonthlyReport(assessment, mockConfig);
        expect(report.month_number).toBe(expectedNumber);
      }
    });

    it('should mark overall_status as On Track when all goals on track', () => {
      // August: month 2, targets = (120/12)*2=20 membership, (12/12)*2=2 clubs, (24/12)*2=4 distinguished
      const assessment = createAssessment('August', 25, 3, 5, 20);
      const report = renderMonthlyReport(assessment, mockConfig);

      // All actuals >= targets => On Track
      expect(report.overall_status).toBe('On Track');
      expect(report.on_track_goals).toBe(3);
      expect(report.pending_data_goals).toBe(0);
    });

    it('should mark overall_status as Off Track when goals miss targets', () => {
      // August: targets = 20 membership, 2 clubs, 4 distinguished
      const assessment = createAssessment('August', 15, 1, 2, 20);
      const report = renderMonthlyReport(assessment, mockConfig);

      expect(report.overall_status).toBe('Off Track');
      expect(report.on_track_goals).toBeLessThan(3);
    });

    it('should mark overall_status as Pending Data when Goal 3 lacks data', () => {
      // Goal 3 has no distinguished_clubs_ytd and no CSP submissions
      const assessment = createAssessment('July', 20, 2, null, 0);
      const report = renderMonthlyReport(assessment, mockConfig);

      expect(report.overall_status).toBe('Pending Data');
      expect(report.pending_data_goals).toBeGreaterThan(0);
      expect(report.goal_3.status).toBe('Pending Data');
    });

    it('should populate recognition_levels with all 4 levels', () => {
      const assessment = createAssessment('October', 40, 5, 7, 30);
      const report = renderMonthlyReport(assessment, mockConfig);

      expect(Object.keys(report.recognition_levels)).toHaveLength(4);
      expect(report.recognition_levels).toHaveProperty('Distinguished');
      expect(report.recognition_levels).toHaveProperty('Select');
      expect(report.recognition_levels).toHaveProperty("President's");
      expect(report.recognition_levels).toHaveProperty('Smedley Distinguished');
    });

    it('should set recognition_level targets correctly for month', () => {
      // October: month 4
      const assessment = createAssessment('October', 50, 6, 10, 30);
      const report = renderMonthlyReport(assessment, mockConfig);

      // Distinguished: (30/12)*4 = 10 → rounds to 10
      expect(report.recognition_levels['Distinguished'].target).toBe(10);
      // Select: (25/12)*4 ≈ 8.33 → 8
      expect(report.recognition_levels['Select'].target).toBe(8);
      // President's: (20/12)*4 ≈ 6.67 → 7
      expect(report.recognition_levels["President's"].target).toBe(7);
      // Smedley: (45/12)*4 = 15
      expect(report.recognition_levels['Smedley Distinguished'].target).toBe(15);
    });

    it('should include goal statuses from calculator', () => {
      const assessment = createAssessment('August', 25, 3, 5, 20);
      const report = renderMonthlyReport(assessment, mockConfig);

      expect(report.goal_1).toHaveProperty('goal_number', 1);
      expect(report.goal_1).toHaveProperty('status');
      expect(report.goal_1).toHaveProperty('actual');
      expect(report.goal_1).toHaveProperty('target');
      expect(report.goal_1).toHaveProperty('delta');

      expect(report.goal_2).toHaveProperty('goal_number', 2);
      expect(report.goal_3).toHaveProperty('goal_number', 3);
    });

    it('should timestamp report generation', () => {
      const beforeTime = new Date();
      const assessment = createAssessment('July', 15, 2, 4, 15);
      const report = renderMonthlyReport(assessment, mockConfig);
      const afterTime = new Date();

      const reportTime = new Date(report.report_generated_at);
      expect(reportTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(reportTime.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should handle null distinguished_clubs_ytd gracefully', () => {
      const assessment = createAssessment('July', 10, 2, null, 15);
      const report = renderMonthlyReport(assessment, mockConfig);

      expect(report.metrics.distinguished_clubs_ytd).toBeNull();
      expect(report.goal_3.status).toBe('On Track'); // CSP fallback: 15 * 0.3 = 4.5 → 5 ≥ 4
    });
  });

  describe('renderYearEndSummary', () => {
    it('should generate year-end summary with required fields', () => {
      const reports: MonthlyReport[] = [];
      for (let i = 1; i <= 12; i++) {
        const month = [
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
        ][i - 1];
        const assessment = createAssessment(month, i * 10, i, i * 2, i * 3);
        reports.push(renderMonthlyReport(assessment, mockConfig));
      }

      const summary = renderYearEndSummary(reports, mockConfig);

      expect(summary).toHaveProperty('district_number', 61);
      expect(summary).toHaveProperty('program_year', '2024-2025');
      expect(summary).toHaveProperty('report_generated_at');
      expect(summary).toHaveProperty('annual_totals');
      expect(summary).toHaveProperty('annual_targets');
      expect(summary).toHaveProperty('goal_1_final');
      expect(summary).toHaveProperty('goal_2_final');
      expect(summary).toHaveProperty('goal_3_final');
      expect(summary).toHaveProperty('monthly_reports');
      expect(summary).toHaveProperty('summary');
    });

    it('should use final month report data as annual totals', () => {
      const reports: MonthlyReport[] = [];
      for (let i = 1; i <= 12; i++) {
        const month = [
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
        ][i - 1];
        const assessment = createAssessment(month, i * 10, i, i * 2, i * 3);
        reports.push(renderMonthlyReport(assessment, mockConfig));
      }

      const summary = renderYearEndSummary(reports, mockConfig);

      // Final month (June): 120 membership, 12 clubs, 24 distinguished, 36 CSP
      expect(summary.annual_totals.membership_payments_ytd).toBe(120);
      expect(summary.annual_totals.paid_clubs_ytd).toBe(12);
      expect(summary.annual_totals.distinguished_clubs_ytd).toBe(24);
      expect(summary.annual_totals.csp_submissions_ytd).toBe(36);
    });

    it('should set annual targets from config', () => {
      const reports: MonthlyReport[] = [];
      for (let i = 1; i <= 1; i++) {
        const assessment = createAssessment('July', 10, 1, 2, 10);
        reports.push(renderMonthlyReport(assessment, mockConfig));
      }

      const summary = renderYearEndSummary(reports, mockConfig);

      expect(summary.annual_targets.membership_growth).toBe(120);
      expect(summary.annual_targets.club_growth).toBe(12);
      expect(summary.annual_targets.distinguished_clubs).toBe(24);
      expect(summary.annual_targets.csp_submissions).toBe(40);
    });

    it('should use final month goal statuses as final goals', () => {
      const reports: MonthlyReport[] = [];
      for (let i = 1; i <= 12; i++) {
        const month = [
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
        ][i - 1];
        const assessment = createAssessment(month, i * 10, i, i * 2, i * 3);
        reports.push(renderMonthlyReport(assessment, mockConfig));
      }

      const summary = renderYearEndSummary(reports, mockConfig);

      expect(summary.goal_1_final).toBeDefined();
      expect(summary.goal_2_final).toBeDefined();
      expect(summary.goal_3_final).toBeDefined();
    });

    it('should include all monthly reports in summary', () => {
      const reports: MonthlyReport[] = [];
      for (let i = 1; i <= 12; i++) {
        const month = [
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
        ][i - 1];
        const assessment = createAssessment(month, i * 10, i, i * 2, i * 3);
        reports.push(renderMonthlyReport(assessment, mockConfig));
      }

      const summary = renderYearEndSummary(reports, mockConfig);

      expect(summary.monthly_reports).toHaveLength(12);
      expect(summary.monthly_reports[0].month).toBe('July');
      expect(summary.monthly_reports[11].month).toBe('June');
    });

    it('should calculate summary statistics correctly', () => {
      const reports: MonthlyReport[] = [];
      for (let i = 1; i <= 12; i++) {
        const month = [
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
        ][i - 1];
        const assessment = createAssessment(month, i * 10, i, i * 2, i * 3);
        reports.push(renderMonthlyReport(assessment, mockConfig));
      }

      const summary = renderYearEndSummary(reports, mockConfig);

      expect(summary.summary.total_goals).toBe(3);
      expect(summary.summary.goals_on_track).toBeGreaterThanOrEqual(0);
      expect(summary.summary.goals_off_track).toBeGreaterThanOrEqual(0);
      expect(summary.summary.goals_pending).toBeGreaterThanOrEqual(0);
      expect(summary.summary.goals_on_track + summary.summary.goals_off_track + summary.summary.goals_pending).toBe(3);
    });

    it('should calculate overall achievement percentage', () => {
      const reports: MonthlyReport[] = [];
      for (let i = 1; i <= 12; i++) {
        const month = [
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
        ][i - 1];
        const assessment = createAssessment(month, i * 10, i, i * 2, i * 3);
        reports.push(renderMonthlyReport(assessment, mockConfig));
      }

      const summary = renderYearEndSummary(reports, mockConfig);

      expect(summary.summary.overall_achievement_percentage).toBeGreaterThanOrEqual(0);
      expect(summary.summary.overall_achievement_percentage).toBeLessThanOrEqual(100);
      expect(typeof summary.summary.overall_achievement_percentage).toBe('number');
    });

    it('should throw error if no monthly reports provided', () => {
      expect(() => renderYearEndSummary([], mockConfig)).toThrow(
        'Year-end summary requires at least 1 monthly report',
      );
    });

    it('should handle single month report', () => {
      const assessment = createAssessment('July', 10, 1, 2, 10);
      const report = renderMonthlyReport(assessment, mockConfig);
      const summary = renderYearEndSummary([report], mockConfig);

      expect(summary.annual_totals.membership_payments_ytd).toBe(10);
      expect(summary.monthly_reports).toHaveLength(1);
    });
  });

  describe('calculateMonthlyAchievementPercentage', () => {
    it('should calculate achievement percentage for on-track month', () => {
      const assessment = createAssessment('August', 25, 3, 5, 20);
      const report = renderMonthlyReport(assessment, mockConfig);

      const percentage = calculateMonthlyAchievementPercentage(report);

      expect(percentage).toBeGreaterThan(50);
      expect(percentage).toBeLessThanOrEqual(100);
      expect(typeof percentage).toBe('number');
    });

    it('should cap achievement percentage at 100', () => {
      // Over-achieve on all goals
      const assessment = createAssessment('August', 50, 10, 20, 50);
      const report = renderMonthlyReport(assessment, mockConfig);

      const percentage = calculateMonthlyAchievementPercentage(report);

      expect(percentage).toBeLessThanOrEqual(100);
    });

    it('should return low percentage for under-performing month', () => {
      const assessment = createAssessment('August', 5, 1, 1, 5);
      const report = renderMonthlyReport(assessment, mockConfig);

      const percentage = calculateMonthlyAchievementPercentage(report);

      expect(percentage).toBeLessThan(50);
    });
  });

  describe('formatReportTimestamp', () => {
    it('should format ISO timestamp to human-readable string', () => {
      const isoString = '2025-11-26T14:30:45.123Z';
      const formatted = formatReportTimestamp(isoString);

      expect(formatted).toContain('Nov');
      expect(formatted).toContain('26');
      expect(formatted).toContain('2025');
    });

    it('should include time in formatted output', () => {
      const isoString = '2025-11-26T14:30:00.000Z';
      const formatted = formatReportTimestamp(isoString);

      expect(formatted).toMatch(/\d{1,2}:\d{2}/); // HH:MM format
    });
  });

  describe('validateReportStructure', () => {
    it('should validate correct monthly report structure', () => {
      const assessment = createAssessment('August', 25, 3, 5, 20);
      const report = renderMonthlyReport(assessment, mockConfig);

      const validation = validateReportStructure(report);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const incompleteReport = {
        district_number: 61,
        // Missing program_year and other fields
      };

      const validation = validateReportStructure(incompleteReport as MonthlyReport);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should detect invalid goal status values', () => {
      const assessment = createAssessment('August', 25, 3, 5, 20);
      const report = renderMonthlyReport(assessment, mockConfig);
      report.goal_1.status = null as never; // Invalid - testing error handling

      const validation = validateReportStructure(report);

      expect(validation.valid).toBe(false);
    });

    it('should validate year-end summary structure', () => {
      const reports: MonthlyReport[] = [];
      for (let i = 1; i <= 2; i++) {
        const month = i === 1 ? 'July' : 'August';
        const assessment = createAssessment(month, i * 10, i, i * 2, i * 3);
        reports.push(renderMonthlyReport(assessment, mockConfig));
      }
      const summary = renderYearEndSummary(reports, mockConfig);

      const validation = validateReportStructure(summary);

      expect(validation.valid).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should generate monthly report in <100ms', () => {
      const assessment = createAssessment('August', 25, 3, 5, 20);

      const start = performance.now();
      renderMonthlyReport(assessment, mockConfig);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
    });

    it('should generate year-end summary in <500ms', () => {
      const reports: MonthlyReport[] = [];
      for (let i = 1; i <= 12; i++) {
        const month = [
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
        ][i - 1];
        const assessment = createAssessment(month, i * 10, i, i * 2, i * 3);
        reports.push(renderMonthlyReport(assessment, mockConfig));
      }

      const start = performance.now();
      renderYearEndSummary(reports, mockConfig);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(500);
    });

    it('should handle 100 monthly reports in <1 second', () => {
      const reports: MonthlyReport[] = [];
      for (let i = 0; i < 100; i++) {
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
        const month = months[i % 12];
        const assessment = createAssessment(month, (i + 1) * 10, i + 1, (i + 1) * 2, (i + 1) * 3);
        reports.push(renderMonthlyReport(assessment, mockConfig));
      }

      const start = performance.now();
      for (const report of reports) {
        calculateMonthlyAchievementPercentage(report);
      }
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(1000);
    });
  });
});
