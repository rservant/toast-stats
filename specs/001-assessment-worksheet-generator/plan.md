# Implementation Plan: District Assessment Worksheet Report Generator

**Branch**: `001-assessment-worksheet-generator` | **Date**: 2025-11-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-assessment-worksheet-generator/spec.md`

## Summary

Build a modular assessment report generator that reproduces the logic and outputs of the "District 61 – 2025 Updated Assessment Worksheet.xlsx" Excel workbook. The system will:

1. **Read configuration** (recognition thresholds, year-end targets, monthly targets) from JSON/YAML
2. **Accept monthly performance input** (membership payments YTD, paid clubs YTD, distinguished clubs YTD, CSP submissions)
3. **Calculate goal statuses** for Goals 1–3 (Membership Growth, Club Growth, Distinguished Clubs) by comparing actuals vs. targets
4. **Generate reports** that mirror the Excel sheet structure, displaying goal statuses with supporting metrics
5. **Track district leader goals** (DD/PQD/CGD) with deadlines and status
6. **Support multiple districts** and program years without code changes

**Technical approach**: Implement as a self-contained backend module (TypeScript/Node.js) with clearly defined service boundaries (calculation, reporting, goal tracking). Expose functionality via REST API with structured JSON responses. Store data in JSON files initially (allow future migration to database). Follow the Toast Stats constitution (TypeScript strict mode, Vitest >80% coverage, no implementation details in spec).

## Technical Context

**Language/Version**: TypeScript 5.2+, Node.js 18+  
**Primary Dependencies**: Express.js (routing), Vitest (testing), Axios (for future dashboard integration)  
**Storage**: JSON files initially (keyed by district_number, program_year, month); designed for future DB migration  
**Testing**: Vitest + Supertest for API integration tests; unit tests for calculator and report logic  
**Target Platform**: Node.js backend service (REST API); consumed by React frontend (future UI)  
**Project Type**: Monorepo (backend/frontend) - adding assessment module to backend workspace  
**Performance Goals**: Reports generated in <2 seconds; support ≥5 districts × 12 months  
**Constraints**: Calculation accuracy ≤0.1 variance (rounding); zero data loss on goal storage  
**Scale/Scope**: 3 core entities (DistrictConfig, MonthlyAssessment, DistrictLeaderGoal); ~4 API routes; 12+ unit tests per service

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Toast Stats Constitution Compliance**:

- [x] **Monorepo with Clear Separation of Concerns**: Assessment module is self-contained within backend/src/modules/assessment, with no dependencies on frontend code.
- [x] **Type-Safe Development**: All code in TypeScript (strict mode). API contracts defined via TypeScript interfaces (types/assessment.ts).
- [x] **Test-First**: Spec includes unit test files (assessmentCalculator.test.ts, etc.); coverage target >80% for business logic.
- [x] **Accessibility**: Not applicable to backend module (accessibility applies to UI, handled by frontend).
- [x] **Performance Optimization**: <2s report generation; caching of config on load; deferred Goal 3 calculation fallback.
- [x] **Data-Driven Development**: Input data from structured JSON; mock data available for testing; configuration versioning for future extensibility.

**Status**: ✅ ALL CHECKS PASS – No violations. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/001-assessment-worksheet-generator/
├── spec.md              # Feature specification (COMPLETE)
├── plan.md              # This file (CURRENT)
├── research.md          # Phase 0 output (TODO: research/clarification)
├── data-model.md        # Phase 1 output (TODO: entity design + validation)
├── contracts/           # Phase 1 output (TODO: API contract definitions)
│   ├── assessment-api.openapi.json
│   └── request-response-schemas.ts
├── quickstart.md        # Phase 1 output (TODO: getting started guide)
└── checklists/
    └── requirements.md  # Quality gate (COMPLETE)
```

### Source Code (backend)

```text
backend/
├── src/
│   ├── modules/
│   │   ├── assessment/
│   │   │   ├── config/
│   │   │   │   └── recognitionThresholds.json       # Recognition levels, year-end targets
│   │   │   ├── services/
│   │   │   │   ├── assessmentCalculator.ts          # Goal 1–3 calculations
│   │   │   │   ├── assessmentReportGenerator.ts     # Report output formatting
│   │   │   │   ├── districtLeaderGoalService.ts     # Goal CRUD, query, status tracking
│   │   │   │   ├── monthlyTargetService.ts          # Derive monthly targets from config
│   │   │   │   └── configService.ts                 # Load, cache, hot-reload config
│   │   │   ├── routes/
│   │   │   │   └── assessmentRoutes.ts              # POST/GET/PUT endpoints
│   │   │   ├── types/
│   │   │   │   └── assessment.ts                    # TypeScript interfaces
│   │   │   ├── utils/
│   │   │   │   └── validation.ts                    # Input validation, error handling
│   │   │   ├── storage/
│   │   │   │   └── assessmentStore.ts               # File-based storage (JSON)
│   │   │   └── __tests__/
│   │   │       ├── assessmentCalculator.test.ts     # Unit: Goal 1–3 logic
│   │   │       ├── assessmentReportGenerator.test.ts
│   │   │       ├── districtLeaderGoalService.test.ts
│   │   │       ├── monthlyTargetService.test.ts
│   │   │       └── integration.test.ts              # Integration: API routes
│   │   └── [existing modules...]
│   ├── index.ts                                     # Main entry; mount assessment routes
│   └── ...
└── tests/
    └── fixtures/
        └── assessment-data.json                     # Test fixtures
```

**Structure Decision**: Follows Toast Stats monorepo pattern. Assessment module is self-contained within backend/src/modules/assessment, with clear separation of concerns:

- **services/**: Business logic (calculations, reporting, goal tracking)
- **routes/**: Express route handlers (thin layer delegating to services)
- **types/**: TypeScript interfaces for contract definition
- **config/**: Static configuration (recognition thresholds, targets)
- **storage/**: Data persistence (JSON files)
- **tests/**: Unit + integration tests (co-located with code)

This structure allows:

- Easy testing (mock services, inject dependencies)
- Future migration to database (storage layer abstraction)
- Reuse by frontend (import types, consume REST API)

## Implementation Phases

### Phase 0: Research & Clarification

**Goals**: Resolve unknowns, finalize calculation formulas, determine input/output formats.

**Tasks**:

1. Obtain and analyze "District 61 – 2025 Updated Assessment Worksheet.xlsx"
   - Extract Goal 1–3 calculation formulas (exact Excel formulas or pseudocode)
   - Confirm monthly target derivation (linear vs. accelerated)
   - Document any conditional logic (e.g., fallback to CSP if distinguished_clubs unavailable)

2. Confirm input data schema
   - Sample monthly data for July 2024–June 2025
   - Verify membership_payments_ytd, paid_clubs_ytd, distinguished_clubs_ytd fields
   - Confirm CSP submission data source and frequency

3. Determine output format preference
   - HTML report (static HTML template + data injection)?
   - PDF (via wkhtmltopdf or puppeteer)?
   - JSON (API returns structured data, frontend renders)?

4. Clarify storage requirements
   - File-based JSON vs. database migration plan
   - Historical data retention policy
   - Correction/amendment workflow

**Deliverable**: `research.md` with all NEEDS CLARIFICATION items resolved.

### Phase 1: Design & Contracts

**Goals**: Define data model, API contracts, and implementation approach.

**Tasks**:

1. Design data model (output: `data-model.md`)
   - DistrictConfig entity (fields, validation, schema)
   - MonthlyAssessment entity (fields, validation, keying strategy)
   - DistrictLeaderGoal entity (fields, state transitions, queries)
   - Relationships and cardinality

2. Generate API contracts (output: `contracts/`)
   - POST /api/assessment/monthly (submit monthly data)
   - GET /api/assessment/monthly/:month (retrieve report)
   - GET /api/assessment/year-end (year-end summary)
   - POST /api/assessment/goals (add leader goal)
   - GET /api/assessment/goals (query goals by filter)
   - PUT /api/assessment/goals/:id (update goal status)
   - POST /api/assessment/config (load/update config)

3. Design calculation algorithms (output: pseudocode in `data-model.md`)
   - Goal 1 logic (membership growth vs. target)
   - Goal 2 logic (club growth vs. target)
   - Goal 3 logic (distinguished clubs or CSP fallback)
   - Variance/delta computation

4. Create quickstart guide (output: `quickstart.md`)
   - How to load config
   - How to submit monthly data
   - How to generate a report
   - Example curl commands

**Deliverable**: `data-model.md`, `contracts/` (OpenAPI + TypeScript), `quickstart.md`; agent context updated.

### Phase 2: Implementation

**Goals**: Build services, routes, tests, and verify against Excel workbook.

**Tasks**:

1. Implement services (Vitest-driven)
   - `configService.ts`: Load JSON config, cache, hot-reload on change
   - `monthlyTargetService.ts`: Derive monthly targets from year-end targets
   - `assessmentCalculator.ts`: Implement Goal 1–3 calculations (unit-tested against Excel data)
   - `districtLeaderGoalService.ts`: CRUD goals, query by filter, track status
   - `assessmentReportGenerator.ts`: Render report output (JSON structure)

2. Implement routes (Supertest integration tested)
   - Mount on Express app (e.g., /api/assessment/*)
   - Request validation (zod or custom)
   - Error handling (structured error responses)

3. Test against Excel workbook
   - Extract 12 months of historical data from Excel
   - Compare generated reports with Excel output
   - Verify goal statuses match (0% error on binary status, ≤0.1 on deltas)

4. Set up storage layer
   - File-based JSON storage (keyed by district_number, program_year, month)
   - Directory structure: data/districts/{district_number}/{program_year}/{month}.json
   - Migration utilities (future DB integration)

5. Documentation
   - Code comments on calculation logic (esp. Goal 1–3 formulas)
   - README in assessment module (setup, usage, testing)

**Success Criteria**:

- All 12+ unit tests passing
- All 4+ integration tests passing
- Code coverage >80% (business logic)
- Goal status accuracy verified against Excel

**Deliverable**: Complete backend module with routes, tests, and documentation.

## Complexity Tracking

> No Constitution Check violations – all code adheres to Toast Stats constitution. No complexity justification required.

## Next Steps

1. **Run Phase 0 research** (resolve unknowns, extract Excel formulas)
2. **Generate Phase 1 design artifacts** (data-model.md, contracts/, quickstart.md)
3. **Create Phase 2 implementation tasks** (via /speckit.tasks command)
4. **Begin implementation** (Feature 1: P1 user story – District Director report generation)
