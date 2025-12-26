/**
 * Test Data Seeding Script
 * 
 * Populates the assessment module with 12 months of sample data for District 61, 2024-2025.
 * This script is useful for:
 * - Testing report generation
 * - Demonstrating the system
 * - Benchmarking performance
 * 
 * Usage:
 *   npx ts-node src/modules/assessment/scripts/seedTestData.ts
 * 
 * Output:
 *   - Creates config file: src/modules/assessment/config/recognitionThresholds.json
 *   - Creates 12 monthly assessment files in storage/data/
 *   - Creates sample goals in storage/data/
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { MonthlyAssessment, DistrictConfig, DistrictLeaderGoal } from '../types/assessment.js';
import { v4 as uuidv4 } from 'uuid';

// Configuration for District 61
const DISTRICT_CONFIG: DistrictConfig = {
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
      membershipPaymentsTarget: 60,
      paidClubsTarget: 6,
      distinguishedClubsTarget: 12,
    },
    {
      level: 'Select',
      membershipPaymentsTarget: 30,
      paidClubsTarget: 3,
      distinguishedClubsTarget: 6,
    },
    {
      level: "President's",
      membershipPaymentsTarget: 20,
      paidClubsTarget: 2,
      distinguishedClubsTarget: 4,
    },
    {
      level: 'Smedley Distinguished',
      membershipPaymentsTarget: 10,
      paidClubsTarget: 1,
      distinguishedClubsTarget: 2,
    },
  ],
  csp_submission_target: 60,
  csp_to_distinguished_clubs_ratio: 0.5,
};

// Monthly assessment data (12 months of sample data)
const MONTHLY_DATA: Array<Omit<MonthlyAssessment, 'district_number' | 'program_year'>> = [
  { month: 'July', membership_payments_ytd: 12, paid_clubs_ytd: 1, distinguished_clubs_ytd: 2, csp_submissions_ytd: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { month: 'August', membership_payments_ytd: 25, paid_clubs_ytd: 2, distinguished_clubs_ytd: 3, csp_submissions_ytd: 10, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { month: 'September', membership_payments_ytd: 35, paid_clubs_ytd: 3, distinguished_clubs_ytd: 5, csp_submissions_ytd: 15, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { month: 'October', membership_payments_ytd: 45, paid_clubs_ytd: 4, distinguished_clubs_ytd: 6, csp_submissions_ytd: 20, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { month: 'November', membership_payments_ytd: 60, paid_clubs_ytd: 5, distinguished_clubs_ytd: 8, csp_submissions_ytd: 25, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { month: 'December', membership_payments_ytd: 75, paid_clubs_ytd: 6, distinguished_clubs_ytd: 10, csp_submissions_ytd: 30, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { month: 'January', membership_payments_ytd: 85, paid_clubs_ytd: 7, distinguished_clubs_ytd: 12, csp_submissions_ytd: 35, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { month: 'February', membership_payments_ytd: 95, paid_clubs_ytd: 8, distinguished_clubs_ytd: 14, csp_submissions_ytd: 40, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { month: 'March', membership_payments_ytd: 105, paid_clubs_ytd: 9, distinguished_clubs_ytd: 16, csp_submissions_ytd: 45, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { month: 'April', membership_payments_ytd: 112, paid_clubs_ytd: 10, distinguished_clubs_ytd: 18, csp_submissions_ytd: 50, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { month: 'May', membership_payments_ytd: 118, paid_clubs_ytd: 11, distinguished_clubs_ytd: 20, csp_submissions_ytd: 55, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { month: 'June', membership_payments_ytd: 125, paid_clubs_ytd: 12, distinguished_clubs_ytd: 22, csp_submissions_ytd: 60, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

// Sample district leader goals
const SAMPLE_GOALS: Array<Omit<DistrictLeaderGoal, 'id' | 'created_at' | 'updated_at'>> = [
  {
    district_number: 61,
    program_year: '2024-2025',
    text: 'Increase membership payments by 20%',
    assigned_to: 'DD',
    deadline: '2025-06-30',
    month: 'June',
    status: 'in_progress',
  },
  {
    district_number: 61,
    program_year: '2024-2025',
    text: 'Establish 2 new clubs',
    assigned_to: 'CGD',
    deadline: '2025-04-30',
    month: 'April',
    status: 'completed',
    date_completed: '2025-04-25T10:00:00.000Z',
  },
  {
    district_number: 61,
    program_year: '2024-2025',
    text: 'Conduct quarterly club visits',
    assigned_to: 'PQD',
    deadline: '2025-03-31',
    month: 'March',
    status: 'completed',
    date_completed: '2025-03-29T14:30:00.000Z',
  },
  {
    district_number: 61,
    program_year: '2024-2025',
    text: 'Award 10 distinguished clubs',
    assigned_to: 'DD',
    deadline: '2025-05-31',
    month: 'May',
    status: 'in_progress',
  },
];

// Utility functions
async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

async function saveFile(filePath: string, content: string): Promise<void> {
  const dir = path.dirname(filePath);
  await ensureDir(dir);
  await fs.writeFile(filePath, content, 'utf-8');
}

function log(message: string, status?: 'success' | 'error' | 'info'): void {
  const timestamp = new Date().toISOString();
  const prefix = status ? `[${status.toUpperCase()}]` : '[INFO]';
  console.log(`${timestamp} ${prefix} ${message}`);
}

async function main(): Promise<void> {
  try {
    log('Starting test data seeding...', 'info');

    // Get paths
    const projectRoot = process.cwd();
    const configDir = path.join(projectRoot, 'src', 'modules', 'assessment', 'config');
    const dataDir = path.join(projectRoot, 'src', 'modules', 'assessment', 'storage', 'data');
    const configPath = path.join(configDir, 'recognitionThresholds.json');

    // 1. Save configuration
    log('Saving district configuration...', 'info');
    await saveFile(configPath, JSON.stringify(DISTRICT_CONFIG, null, 2));
    log(`Configuration saved: ${configPath}`, 'success');

    // 2. Save monthly assessments
    log('Saving 12 months of assessment data...', 'info');
    for (const monthData of MONTHLY_DATA) {
      const assessment: MonthlyAssessment = {
        district_number: DISTRICT_CONFIG.district_number,
        program_year: DISTRICT_CONFIG.program_year,
        ...monthData,
      };

      const fileName = `assessment_${assessment.district_number}_${assessment.program_year}_${assessment.month}.json`;
      const filePath = path.join(dataDir, fileName);
      await saveFile(filePath, JSON.stringify(assessment, null, 2));
    }
    log(`✓ Saved 12 monthly assessments (${dataDir})`, 'success');

    // 3. Save sample goals
    log('Saving sample district leader goals...', 'info');
    const goalsFileName = `goals_${DISTRICT_CONFIG.district_number}_${DISTRICT_CONFIG.program_year}.json`;
    const goalsPath = path.join(dataDir, goalsFileName);

    const goalsWithIds: DistrictLeaderGoal[] = SAMPLE_GOALS.map((goal) => ({
      id: uuidv4(),
      ...goal,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    await saveFile(goalsPath, JSON.stringify(goalsWithIds, null, 2));
    log(`✓ Saved ${SAMPLE_GOALS.length} sample goals`, 'success');

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ Test Data Seeding Complete');
    console.log('='.repeat(60));
    console.log(`
District: 61
Program Year: 2024-2025
Year-End Targets:
  - Membership Growth: ${DISTRICT_CONFIG.year_end_targets.membership_growth}
  - Club Growth: ${DISTRICT_CONFIG.year_end_targets.club_growth}
  - Distinguished Clubs: ${DISTRICT_CONFIG.year_end_targets.distinguished_clubs}

Files Created:
  - Configuration: ${configPath}
  - Monthly Data: 12 files in ${dataDir}
  - Goals: ${goalsPath}

Test the module:
  1. Run tests: npm test
  2. Generate reports: POST /api/assessment/monthly
  3. Query goals: GET /api/assessment/goals

Verify data:
  - Check sample data: cat ${configPath}
  - List files: ls -la ${dataDir}
    `);

    log('Done!', 'success');
  } catch (error) {
    log(`Error during seeding: ${error instanceof Error ? error.message : String(error)}`, 'error');
    process.exit(1);
  }
}

main();
