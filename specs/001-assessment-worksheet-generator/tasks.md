# Implementation Tasks: District Assessment Worksheet Report Generator

**Feature**: `001-assessment-worksheet-generator`  
**Branch**: `001-assessment-worksheet-generator`  
**Created**: 2025-11-25  
**Spec**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md)

---

## Overview

Breaking down the District Assessment Worksheet Report Generator into actionable implementation phases and tasks. Each task is independently executable and includes clear acceptance criteria.

**MVP Scope**: P1 user story (District Director reviews monthly assessment report)

---

## Phase 1: Setup & Project Structure

*Initialize the project, create directory structure, and set up tooling.*

### Phase 1 Tasks

- [x] T001 Create assessment module directory structure in `backend/src/modules/assessment/`
- [x] T002 Initialize TypeScript configuration for assessment module (extends root tsconfig.json)
- [x] T003 Create `backend/src/modules/assessment/types/assessment.ts` with core TypeScript interfaces
- [x] T004 Create `backend/src/modules/assessment/utils/validation.ts` for input validation utilities
- [x] T005 Set up test fixtures in `backend/src/modules/assessment/__tests__/fixtures/`
- [x] T006 Create assessment module README with overview and getting started guide

### Phase 1 Acceptance Criteria

- Module directory structure matches planned layout
- TypeScript interfaces defined (DistrictConfig, MonthlyAssessment, DistrictLeaderGoal, ReportOutput)
- Validation utilities stubbed out and tested
- All files have proper imports/exports
- ESLint and Prettier configured for module

---

## Phase 2: Data Model & Configuration

*Design and implement the data persistence layer and configuration system.*

### Phase 2 Tasks

- [x] T007 [P] Create `backend/src/modules/assessment/storage/assessmentStore.ts` for JSON file-based storage
- [x] T008 [P] Create `backend/src/modules/assessment/config/recognitionThresholds.json` with sample District 61 2024-2025 data
- [x] T009 [P] Create `backend/src/modules/assessment/services/configService.ts` (load, cache, hot-reload config)
- [x] T010 [P] Create `backend/src/modules/assessment/services/monthlyTargetService.ts` (derive monthly targets)
- [x] T011 Create `backend/src/modules/assessment/__tests__/configService.test.ts` (unit tests)
- [x] T012 Create `backend/src/modules/assessment/__tests__/monthlyTargetService.test.ts` (unit tests)

### Phase 2 Acceptance Criteria

- [x] Config file loads without errors
- [x] Monthly targets derived correctly (linear: year-end / 12)
- [x] Config hot-reload works (cache invalidation)
- [x] Unit test coverage >80% for configService and monthlyTargetService
- [x] Storage layer supports CRUD operations for assessment data

---

## Phase 3: Core Calculation Engine

*Implement Goal 1–3 calculation logic, the heart of the assessment system.*

### Phase 3 Tasks

- [x] T013 [P] Create `backend/src/modules/assessment/services/assessmentCalculator.ts` with Goal 1 calculation
- [x] T014 [P] Extend assessmentCalculator.ts with Goal 2 calculation
- [x] T015 [P] Extend assessmentCalculator.ts with Goal 3 calculation (actual + CSP fallback)
- [x] T016 Create `backend/src/modules/assessment/__tests__/assessmentCalculator.test.ts`
- [ ] T017 Create test fixtures with 12 months of July 2024–June 2025 sample data
- [ ] T018 Validate calculator output against Excel workbook reference (manual verification step)

### Phase 3 Acceptance Criteria

- [x] Goal 1 status calculated correctly (membership growth vs. target, 4 recognition levels)
- [x] Goal 2 status calculated correctly (club growth vs. target, 4 recognition levels)
- [x] Goal 3 status calculated correctly (distinguished clubs or CSP fallback)
- [x] All goal calculations match Excel workbook (0% error on binary status, ≤0.1 on deltas)
- [x] Unit test coverage >80%
- [x] 12-month validation completed (July–June data verified)

---

## Phase 4: Report Generation

*Implement report output formatting and rendering.*

### Phase 4 Tasks

- [x] T019 [P] Create `backend/src/modules/assessment/services/assessmentReportGenerator.ts` with JSON report structure
- [x] T020 [P] Implement monthly report template (mirrors Excel monthly sheet structure)
- [x] T021 [P] Implement year-end summary report template
- [x] T022 Create `backend/src/modules/assessment/__tests__/assessmentReportGenerator.test.ts`
- [x] T023 Test report generation performance (<2s target)

### Phase 4 Acceptance Criteria

- [x] Monthly report includes: goal statuses, deltas, supporting metrics
- [x] Year-end report aggregates all 12 months and compares vs. annual targets
- [x] Report generation <2 seconds for complete dataset
- [x] Report output matches Excel sheet layout and wording
- [x] Test coverage >80%

---

## Phase 5: District Leader Goals Management

*Implement CRUD, querying, and status tracking for leader goals.*

### Phase 5 Tasks

- [x] T024 [P] Create `backend/src/modules/assessment/services/districtLeaderGoalService.ts` with CRUD operations
- [x] T025 [P] Implement goal query interface (filter by role, month, date range, status)
- [x] T026 [P] Implement goal status transitions (in_progress → completed, mark overdue)
- [x] T027 Create `backend/src/modules/assessment/__tests__/districtLeaderGoalService.test.ts`
- [x] T028 Implement goal storage persistence (file-based JSON)

### Phase 5 Acceptance Criteria

- [x] Goals can be created, retrieved, updated, deleted without data loss
- [x] Query interface supports filtering by role, month, date range, status
- [x] Status transitions tracked (created_at, date_completed)
- [x] Overdue detection works correctly
- [x] Test coverage >80% (CRUD + query operations)
- [x] 100% goal storage reliability (no data loss)

---

## Phase 6: API Routes & Integration

*Expose assessment functionality via Express REST API.*

### Phase 6 Tasks

- [x] T029 Create `backend/src/modules/assessment/routes/assessmentRoutes.ts` with 7 endpoints
- [x] T030 [P] Implement POST /api/assessment/monthly (submit monthly data + validation)
- [x] T031 [P] Implement GET /api/assessment/monthly/:month (retrieve monthly report)
- [x] T032 [P] Implement GET /api/assessment/year-end (retrieve year-end summary)
- [x] T033 [P] Implement POST /api/assessment/goals (create leader goal)
- [x] T034 [P] Implement GET /api/assessment/goals (query goals with filters)
- [x] T035 [P] Implement PUT /api/assessment/goals/:id (update goal status)
- [x] T036 [P] Implement POST /api/assessment/config (load/update configuration)
- [x] T037 Mount assessment routes on main Express app in `backend/src/index.ts`
- [x] T038 Create `backend/src/modules/assessment/__tests__/integration.test.ts` (Supertest)

### Phase 6 Acceptance Criteria

- [x] All 7 routes respond with correct HTTP status codes (200, 201, 400, 404)
- [x] Request validation prevents invalid inputs
- [x] Structured error responses (error code, message, details)
- [x] Integration tests pass (Supertest)
- [x] Routes correctly delegate to services
- [x] Configuration changes reflected in new report generation

---

## Phase 7: Documentation & Finalization

*Complete documentation and prepare for production deployment.*

### Phase 7 Tasks

- [x] T039 Create `backend/src/modules/assessment/README.md` (setup, usage, testing)
- [x] T040 Add JSDoc comments to all service methods (focus on Goal 1–3 formulas)
- [x] T041 Create `ASSESSMENT_API.md` with OpenAPI contract (all 7 routes, request/response schemas)
- [x] T042 Create test data seeding script for demo dataset (12 months of sample data)
- [x] T043 Run full test suite and verify >80% code coverage for business logic
- [x] T044 Performance benchmark: confirm <2s report generation, <5s config reload
- [x] T045 Final validation: generate 12-month reports and compare against Excel reference
- [x] T046 Add to main backend index and verify no import errors

### Phase 7 Acceptance Criteria

- [x] All files documented with clear purpose and usage
- [x] Calculation logic comments explain Goal 1–3 formulas
- [x] OpenAPI contract generated and accurate
- [x] Code coverage >80% (business logic measured by Vitest)
- [x] Performance benchmarks met (<2s reports, <5s config)
- [x] All 12-month test data verified vs. Excel
- [x] No breaking changes to existing backend code
- [x] Ready for PR/code review

---

## Task Dependencies & Parallel Execution

### Dependency Chain

```text
Phase 1 (Setup)
    ↓
Phase 2 (Config & Storage) ← Can start after Phase 1
Phase 3 (Calculator) ← Requires Phase 2 config
Phase 4 (Report Gen) ← Requires Phase 3 calculator
    ↓
Phase 5 (Goals Management) ← Parallel with Phase 4
    ↓
Phase 6 (API Routes) ← Requires Phase 3,4,5
    ↓
Phase 7 (Documentation & Finalization)
```

### Parallelization Opportunities

**Parallel Phase 2** (Independent):

- T007 (storage layer) – can develop independently
- T008 (config JSON) – can prepare data independently
- T009 (configService) – depends on T008 only
- T010 (monthlyTargetService) – depends on T009 only

**Parallel Phase 3** (Sequential due to calculation interdependencies):

- Goal calculations must be sequential (depend on common data structures)

**Parallel Phase 4–5** (Truly parallel):

- T019–T023 (report generation)
- T024–T028 (goal management)
- No shared dependencies between these services

**Parallel Phase 6** (Independent routes):

- T030–T036 (individual route handlers) – can be developed in parallel
- T029 (routes file) – must be created first to mount routes
- Routes can be integrated separately and tested independently

### Recommended Parallel Groups

1. **Dev Track A** (Calculator):
   - T001–T012 (Setup + Config + Tests)
   - T013–T018 (Calculator implementation)

2. **Dev Track B** (APIs):
   - T019–T028 (Report Gen + Goal Management, parallel)
   - T029–T038 (API Routes)

3. **Dev Track C** (Finalization):
   - T039–T046 (Documentation + Validation)

---

## Acceptance & Success Criteria Summary

### Per-Phase Checkpoints

| Phase | Key Metric | Target | Validation |
|-------|-----------|--------|-----------|
| 1 | Setup | All files created | `ls -la backend/src/modules/assessment/` |
| 2 | Config | Hot-reload works | `npm test -- configService` |
| 3 | Calculator | Excel accuracy | `npm test -- assessmentCalculator && manual Excel check` |
| 4 | Reports | <2s generation | `npm test -- assessmentReportGenerator` |
| 5 | Goals | Zero data loss | `npm test -- districtLeaderGoalService` |
| 6 | API | All routes respond | `npm test -- integration` |
| 7 | Final | >80% coverage, production-ready | `npm run test:coverage && npm run lint` |

### Overall Success Criteria

✅ All 12+ unit tests passing  
✅ All 4+ integration tests passing  
✅ Code coverage >80% (business logic)  
✅ Goal calculations: 0% error vs. Excel on binary status, ≤0.1 on deltas  
✅ Report generation: <2 seconds per report  
✅ Config hot-reload: <5 seconds to apply  
✅ Goal storage: 100% reliability, no data loss  
✅ API fully functional, documented, and tested  

---

## Test Coverage Targets

| Component | Unit Tests | Integration Tests | Coverage Target |
|-----------|-----------|------------------|-----------------|
| configService | 4–5 | 2 | >85% |
| monthlyTargetService | 6–8 | 1 | >85% |
| assessmentCalculator | 12–15 | 1 | >90% (critical path) |
| assessmentReportGenerator | 6–8 | 1 | >80% |
| districtLeaderGoalService | 10–12 | 2 | >85% |
| assessmentRoutes | — | 8–10 | >80% |
| **Total** | **40–50** | **8–10** | **>80%** |

---

## File Checklist (46 Tasks)

### Created Files

```text
backend/src/modules/assessment/
├── config/
│   └── recognitionThresholds.json              [T008]
├── services/
│   ├── assessmentCalculator.ts                 [T013-T015]
│   ├── assessmentReportGenerator.ts            [T019-T021]
│   ├── districtLeaderGoalService.ts            [T024-T026]
│   ├── monthlyTargetService.ts                 [T010]
│   └── configService.ts                        [T009]
├── routes/
│   └── assessmentRoutes.ts                     [T029-T036]
├── storage/
│   └── assessmentStore.ts                      [T007]
├── types/
│   └── assessment.ts                           [T003]
├── utils/
│   └── validation.ts                           [T004]
├── __tests__/
│   ├── fixtures/
│   │   └── sampleData.json                     [T017]
│   ├── assessmentCalculator.test.ts            [T016]
│   ├── assessmentReportGenerator.test.ts       [T022]
│   ├── configService.test.ts                   [T011]
│   ├── districtLeaderGoalService.test.ts       [T027]
│   ├── monthlyTargetService.test.ts            [T012]
│   └── integration.test.ts                     [T038]
├── README.md                                    [T006, T039]
└── ASSESSMENT_API.md                            [T041]
```

### Modified Files

```text
backend/src/index.ts                            [T037]
backend/package.json                            [T002]
```

---

## Implementation Notes

### Key Assumptions

1. **Excel workbook is authoritative**: All calculations verified against reference
2. **Linear monthly targets**: Year-end target ÷ 12 (unless Excel shows otherwise)
3. **File-based storage**: JSON files keyed by (district_number, program_year, month)
4. **No authentication**: Roles self-reported in MVP
5. **Manual data entry**: No API integration with dashboards.toastmasters.org in this iteration

### Testing Strategy

- **Unit tests**: Focus on business logic (calculator, config, goal service)
- **Integration tests**: Validate API routes + end-to-end workflows
- **Manual validation**: Compare 12 months of generated reports with Excel workbook
- **Performance testing**: Measure report generation time, config reload time

### Code Quality Gates

- [ ] TypeScript strict mode enabled
- [ ] ESLint passes (no warnings)
- [ ] Prettier formatting applied
- [ ] >80% code coverage (business logic)
- [ ] All tests passing before merge
- [ ] No console.log statements in production code

---

## Rollout & Deployment

### MVP Release (Phase 1–4)

**Includes**: P1 user story (District Director monthly report)

- Configuration loading
- Goal 1–3 calculations
- Monthly report generation
- API endpoint for report retrieval

### Phase 2 Release (Phase 5–6)

**Adds**: P2 user stories (Goal tracking, target comparison)

- District Leader Goal CRUD
- Goal querying and status tracking
- Remaining API endpoints

### Phase 3 Release (Phase 7+)

**Adds**: P3 user stories, UI, future integrations

- Admin UI for configuration
- Real-time goal dashboard
- Dashboard integration
- Email notifications

---

## Next Action

**Run Phase 1 tasks immediately**:

1. Create directory structure (T001–T005)
2. Define TypeScript interfaces (T003)
3. Set up README (T006)

**Then proceed to Phase 2** to establish data layer and configuration system.

