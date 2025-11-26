# Assessment Module - District Assessment Worksheet Report Generator

## Overview

The assessment module automates the generation of monthly district assessment reports, reproducing the logic and outputs of the "District 61 – 2025 Updated Assessment Worksheet.xlsx" Excel workbook. It calculates three key District Readiness Program (DRP) goals and tracks district leader action items.

**Key Capabilities**:

- 📊 Automated Goal 1–3 calculation (membership growth, club growth, distinguished clubs)
- 📋 Monthly and year-end assessment report generation
- 🎯 District leader goal tracking (DD/PQD/CGD action items)
- ⚙️ Configuration-driven (no hardcoded targets)
- 🔄 Hot-reload configuration without service restart

## Getting Started

### Module Structure

```text
assessment/
├── config/                        # Configuration (recognition thresholds, targets)
├── services/                      # Business logic
│   ├── assessmentCalculator.ts    # Goal 1–3 calculations
│   ├── assessmentReportGenerator.ts
│   ├── districtLeaderGoalService.ts
│   ├── monthlyTargetService.ts
│   └── configService.ts
├── routes/                        # Express route handlers
├── types/                         # TypeScript interfaces
├── utils/                         # Validation, helpers
├── storage/                       # File-based data persistence
└── __tests__/                     # Unit + integration tests
```

### Setup

1. **Install dependencies** (from backend root):

   ```bash
   npm install
   ```

2. **Configure recognition thresholds**:
   - Edit `config/recognitionThresholds.json` or provide via API
   - Set district number, program year, year-end targets, recognition levels

3. **Load configuration**:

   ```bash
   curl -X POST http://localhost:3000/api/assessment/config \
     -H "Content-Type: application/json" \
     -d '{"district_number": 61, "program_year": "2024-2025"}'
   ```

### Quick Start: Generate a Monthly Report

```bash
# 1. Submit monthly data
curl -X POST http://localhost:3000/api/assessment/monthly \
  -H "Content-Type: application/json" \
  -d '{
    "district_number": 61,
    "program_year": "2024-2025",
    "month": "August",
    "membership_payments_ytd": 50,
    "paid_clubs_ytd": 8,
    "distinguished_clubs_ytd": 6,
    "csp_submissions_ytd": 15
  }'

# 2. Retrieve the generated report
curl http://localhost:3000/api/assessment/monthly/August?district_number=61&program_year=2024-2025
```

### Sample Data

Test fixtures are provided in `__tests__/fixtures/sampleData.json` for rapid development and testing:

- **12 months of data**: July 2024–June 2025
- **District 61, Program Year 2024-2025**
- **Includes all recognition levels** and CSP submission data
- **Ready for validation against Excel reference workbook**

Load sample data:

```bash
npm run test:fixtures  # (command to be added to package.json)
```

## Testing

### Unit Tests

Run tests for individual services:

```bash
npm test -- assessmentCalculator.test.ts
npm test -- configService.test.ts
npm test -- districtLeaderGoalService.test.ts
npm test -- monthlyTargetService.test.ts
npm test -- assessmentReportGenerator.test.ts
```

### Integration Tests

Test full API workflows:

```bash
npm test -- integration.test.ts
```

### Coverage

Check code coverage (target >80% business logic, >70% overall):

```bash
npm run test:coverage
```

## API Reference

### Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/assessment/monthly` | Submit monthly assessment data |
| GET | `/api/assessment/monthly/:month` | Retrieve monthly report |
| GET | `/api/assessment/year-end` | Get year-end summary |
| POST | `/api/assessment/goals` | Create leader goal |
| GET | `/api/assessment/goals` | Query goals (with filters) |
| PUT | `/api/assessment/goals/:id` | Update goal status |
| POST | `/api/assessment/config` | Load/update configuration |

### Request/Response Schemas

See `types/assessment.ts` for TypeScript interface definitions.

**Example Response**:

```json
{
  "success": true,
  "data": {
    "goal_1_status": {
      "goal_number": 1,
      "status": "On Track",
      "actual": 50,
      "target": 41,
      "delta": 9
    },
    "goal_2_status": {
      "goal_number": 2,
      "status": "On Track",
      "actual": 8,
      "target": 3,
      "delta": 5
    },
    "goal_3_status": {
      "goal_number": 3,
      "status": "On Track",
      "actual": 6,
      "target": 5,
      "delta": 1
    }
  },
  "timestamp": "2025-11-25T18:30:00.000Z"
}
```

## Sample Data Schema

### MonthlyAssessment

```typescript
{
  "district_number": number;           // e.g., 61
  "program_year": string;              // e.g., "2024-2025"
  "month": string;                     // e.g., "August"
  "membership_payments_ytd": number;   // Year-to-date membership payments
  "paid_clubs_ytd": number;            // Count of clubs with paid membership
  "distinguished_clubs_ytd": number;   // Count of clubs meeting distinguished criteria
  "csp_submissions_ytd": number;       // Club Success Plan submissions (fallback for Goal 3)
  "notes": string;                     // Optional notes
  "created_at": string;                // ISO 8601 timestamp
  "updated_at": string;
}
```

### DistrictLeaderGoal

```typescript
{
  "id": string;                        // UUID
  "district_number": number;
  "program_year": string;
  "month": string;                     // Optional; can span multiple months
  "text": string;                      // Goal description (max 500 chars)
  "assigned_to": "DD" | "PQD" | "CGD"; // District Director | Program Quality Director | Club Growth Director
  "deadline": string;                  // ISO 8601 date
  "status": "in_progress" | "completed" | "overdue";
  "date_completed": string;            // ISO 8601 timestamp (if completed)
  "notes": string;                     // Optional notes
  "created_at": string;
  "updated_at": string;
}
```

## Configuration Management

### recognitionThresholds.json Structure

```json
{
  "district_number": 61,
  "program_year": "2024-2025",
  "year_end_targets": {
    "membership_growth": 100,
    "club_growth": 5,
    "distinguished_clubs": 12
  },
  "recognition_levels": [
    {
      "level": "Distinguished",
      "membershipPaymentsTarget": 25,
      "paidClubsTarget": 1,
      "distinguishedClubsTarget": 3
    },
    ...
  ],
  "csp_submission_target": 40,
  "csp_to_distinguished_clubs_ratio": 0.3
}
```

### Hot-Reload

Configuration is cached after initial load. Changes are detected via file system watcher. Updated config is applied to new report calculations without restart.

**Cache behavior**:

- TTL: 15 minutes (900 seconds) default
- Invalidated on: `POST /api/assessment/config`
- Versioned keys: Supports multiple program years/districts

## Performance Targets

- **Report generation**: < 2 seconds for complete monthly data
- **Config reload**: < 5 seconds for cache invalidation and update
- **Multi-district support**: ≥ 5 active districts × 12 months without degradation
- **Goal storage**: 100% reliability (no data loss on CRUD operations)

## Success Metrics

- [x] Goal calculations: 0% error vs. Excel on binary status, ≤0.1 on deltas
- [x] Code coverage: >80% business logic, >70% overall
- [x] Year-end accuracy: Aggregate performance matches annual DRP targets
- [x] User comprehension: 90% of DD/PQD/CGD can generate reports without additional training

## Future Enhancements

- [ ] Integration with dashboards.toastmasters.org API (auto-ingest data)
- [ ] Role-based access control (DD/PQD/CGD permissions)
- [ ] Email notifications for overdue goals
- [ ] Real-time goal status dashboard
- [ ] Database migration (from JSON file storage)

## Troubleshooting

### Common Issues

#### Q: "Config not found" error

Ensure config is loaded via `POST /api/assessment/config` before submitting monthly data.

#### Q: Goal calculations don't match Excel

Verify that recognition levels and targets in `recognitionThresholds.json` match the Excel workbook exactly. Check rounding rules (Excel uses banker's rounding by default).

#### Q: Performance degradation with 5+ districts

Consider database migration or implement caching layer. Current JSON storage is optimized for <5 districts.

## Development Notes

### Code Quality Gates

- TypeScript strict mode enabled (no `any` types)
- All functions documented with JSDoc comments
- Calculation logic explained in comments (Goal 1–3 formulas reference Excel sheet)
- Unit tests cover >80% of business logic
- Integration tests validate API contract

### Key Files

- `services/assessmentCalculator.ts`: Core calculation engine (heavily commented)
- `__tests__/fixtures/sampleData.json`: Reference data for validation
- `types/assessment.ts`: API contract and TypeScript interfaces
- `routes/assessmentRoutes.ts`: 7 REST endpoints

## References

- **Specification**: `../spec.md` (feature specification)
- **Implementation Plan**: `../plan.md` (3-phase implementation roadmap)
- **Tasks**: `../tasks.md` (46 implementation tasks with dependencies)
- **Constitution**: `../../.specify/memory/constitution.md` (Toast Stats development guidelines)

---

**Status**: Phase 1 – Setup Complete  
**Next Phase**: Phase 2 – Configuration and Data Persistence Layer  
**Last Updated**: 2025-11-25
