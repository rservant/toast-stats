import { describe, it, expect } from 'vitest';
import fixtures from './fixtures/sampleData.json';
import { calculateAllGoals } from '../services/assessmentCalculator.js';
import { calculateCumulativeTarget, getMonthNumber } from '../services/monthlyTargetService.js';
import { MonthlyAssessment, DistrictConfig } from '../types/assessment.js';

interface MonthlyData {
  month: string;
  membership_payments_ytd: number;
  paid_clubs_ytd: number;
  distinguished_clubs_ytd: number;
  csp_submissions_ytd: number;
}

interface FixtureData {
  district_number: number;
  program_year: string;
  config: DistrictConfig;
  monthly_data: MonthlyData[];
}

interface Fixtures {
  fixtures: {
    district61_2024_2025: FixtureData;
  };
}

describe('Phase 3 Verification - Assessment Calculator vs. expected targets', () => {
  const data = (fixtures as Fixtures).fixtures.district61_2024_2025;
  const config = data.config;

  data.monthly_data.forEach((monthData: MonthlyData) => {
    it(`calculates correct goals for ${monthData.month}`, () => {
      const assessment: MonthlyAssessment = {
        district_number: data.district_number,
        program_year: data.program_year,
        month: monthData.month,
        membership_payments_ytd: monthData.membership_payments_ytd,
        paid_clubs_ytd: monthData.paid_clubs_ytd,
        distinguished_clubs_ytd: monthData.distinguished_clubs_ytd,
        csp_submissions_ytd: monthData.csp_submissions_ytd,
      } as any;

      const result = calculateAllGoals(assessment, config as any);

      // Expected Goal 1
      const monthNumber = getMonthNumber(monthData.month);
      const expectedGoal1Target = calculateCumulativeTarget(
        config.year_end_targets.membership_growth,
        monthNumber
      );
      const expectedGoal1Actual = monthData.membership_payments_ytd;
      const expectedGoal1Status = expectedGoal1Actual >= expectedGoal1Target ? 'On Track' : 'Off Track';
      const expectedGoal1Delta = expectedGoal1Actual - expectedGoal1Target;

      expect(result.goal_1_status.goal_number).toBe(1);
      expect(result.goal_1_status.target).toBe(expectedGoal1Target);
      expect(result.goal_1_status.actual).toBe(expectedGoal1Actual);
      expect(result.goal_1_status.status).toBe(expectedGoal1Status);
      expect(result.goal_1_status.delta).toBe(expectedGoal1Delta);

      // Expected Goal 2
      const expectedGoal2Target = calculateCumulativeTarget(
        config.year_end_targets.club_growth,
        monthNumber
      );
      const expectedGoal2Actual = monthData.paid_clubs_ytd;
      const expectedGoal2Status = expectedGoal2Actual >= expectedGoal2Target ? 'On Track' : 'Off Track';
      const expectedGoal2Delta = expectedGoal2Actual - expectedGoal2Target;

      expect(result.goal_2_status.goal_number).toBe(2);
      expect(result.goal_2_status.target).toBe(expectedGoal2Target);
      expect(result.goal_2_status.actual).toBe(expectedGoal2Actual);
      expect(result.goal_2_status.status).toBe(expectedGoal2Status);
      expect(result.goal_2_status.delta).toBe(expectedGoal2Delta);

      // Expected Goal 3
      const expectedGoal3Target = calculateCumulativeTarget(
        config.year_end_targets.distinguished_clubs,
        monthNumber
      );

      let expectedGoal3Actual: number;
      if (monthData.distinguished_clubs_ytd !== null && monthData.distinguished_clubs_ytd !== undefined) {
        expectedGoal3Actual = monthData.distinguished_clubs_ytd;
      } else if (monthData.csp_submissions_ytd > 0) {
        expectedGoal3Actual = Math.round(monthData.csp_submissions_ytd * config.csp_to_distinguished_clubs_ratio);
      } else {
        expectedGoal3Actual = 0;
      }

      const expectedGoal3Status = expectedGoal3Actual >= expectedGoal3Target ? 'On Track' : (expectedGoal3Actual === 0 ? 'Pending Data' : 'Off Track');
      const expectedGoal3Delta = expectedGoal3Actual - expectedGoal3Target;

      expect(result.goal_3_status.goal_number).toBe(3);
      expect(result.goal_3_status.target).toBe(expectedGoal3Target);
      expect(result.goal_3_status.actual).toBe(expectedGoal3Actual);
      expect(result.goal_3_status.delta).toBe(expectedGoal3Delta);
      expect(result.goal_3_status.status).toBe(expectedGoal3Status);
    });
  });
});
