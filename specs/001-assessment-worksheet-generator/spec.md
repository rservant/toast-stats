# Feature Specification: District Assessment Worksheet Report Generator

**Feature Branch**: `001-assessment-worksheet-generator`  
**Created**: 2025-11-25  
**Status**: Draft  
**Input**: Build a reporting module that reproduces the logic and outputs of "District 61 – 2025 Updated Assessment Worksheet.xlsx" to generate monthly district assessment reports with automated calculation of Goals 1–3, matching the existing workbook structure.

## User Scenarios & Testing _(mandatory)_

### User Story 1 – District Director Reviews Monthly Assessment (Priority: P1)

The District Director loads the assessment report for a specific month and instantly sees whether the district is on track for all three DRP goals. The report mirrors the familiar monthly Excel sheet structure, requiring no translation or manual cross-checking.

**Why this priority**: The DD relies on this information to make strategic decisions, allocate resources, and communicate status to TI. This is the core value proposition.

**Independent Test**: Can fully test by providing sample monthly data (membership YTD, paid clubs YTD, distinguished clubs) and verifying the report displays correct goal status (on track / off track) with supporting metrics.

**Acceptance Scenarios**:

1. **Given** a monthly assessment record for July 2024 with membership_payments_ytd=991, paid_clubs_ytd=153, **When** the report is generated, **Then** Goal 1 status matches the Excel workbook calculation and displays "On Track" or "Off Track" with the delta vs. target.
2. **Given** incomplete input data (e.g., distinguished_clubs_ytd is null), **When** the report is generated, **Then** Goal 3 is marked as "Pending Data" or calculated using a fallback method documented in the spec.
3. **Given** a full year of monthly data (July–June), **When** the year-end summary is displayed, **Then** it shows aggregate performance against annual DRP targets.

---

### User Story 2 – PQD Captures and Tracks District Leader Goals (Priority: P2)

The Program Quality Director enters District Leader Goals (DD/PQD/CGD with deadlines) into the monthly assessment. The system stores these as structured data and allows filtering/viewing goals by leader role, month, and status (completed, in progress, overdue).

**Why this priority**: Leadership accountability and action tracking are critical to achieving DRP goals, but are currently lost in unstructured Excel cells. Capturing them enables follow-up and reporting.

**Independent Test**: Can fully test by entering 3–5 leader goals for a month, retrieving them via query, and verifying they are stored with role, deadline, and description intact.

**Acceptance Scenarios**:

1. **Given** a monthly assessment form, **When** the PQD adds a goal "Follow up with Division 5 club" assigned to DD with deadline "2024-08-15", **Then** the goal is stored and can be retrieved with all metadata.
2. **Given** goals from multiple months, **When** viewing "Goals due this week", **Then** only goals within 7 days of today are displayed, sorted by deadline.
3. **Given** a completed goal, **When** marked as done, **Then** the date completed is recorded and the goal no longer appears in "in progress" lists.

---

### User Story 3 – CGD Compares Actual vs. Monthly Targets (Priority: P2)

The Club Growth Director sees a side-by-side comparison of actual performance (membership payments, paid clubs, distinguished clubs) against the month's targets for each of the four recognition levels (Distinguished, Select, President's, Smedley).

**Why this priority**: This supports month-to-month planning and helps identify which recognition level needs support.

**Independent Test**: Can fully test by entering monthly actuals for a given month and verifying the report displays a table with actual, target, and delta columns for each goal/level.

**Acceptance Scenarios**:

1. **Given** monthly data for August 2024, **When** the comparison report is generated, **Then** each of the four recognition levels shows (actual, target, variance) for membership payments and club counts.
2. **Given** a month where the district is ahead of target, **When** the report is generated, **Then** the variance is highlighted in green/positive to indicate strong performance.
3. **Given** a month where the district is behind target, **When** the report is generated, **Then** the variance is highlighted in red/negative to prompt corrective action.

---

### User Story 4 – Admin Configures Year and Recognition Targets (Priority: P3)

An administrator defines or updates the recognition level thresholds, year-end targets, and derived monthly targets for a new program year (e.g., 2025-2026). The system stores these as configuration and generates monthly targets automatically for the year.

**Why this priority**: Enables the system to support new years and districts without code changes, but is lower priority than the core reporting flow.

**Independent Test**: Can fully test by uploading or entering a config file with recognition thresholds and verifying that monthly targets are derived and stored correctly.

**Acceptance Scenarios**:

1. **Given** year-end targets (e.g., membership growth +100, club growth +5), **When** the config is loaded, **Then** monthly targets are derived (e.g., July target = 100/12 ≈ 8.33).
2. **Given** a config change for an existing program year, **When** the change is applied, **Then** reports for affected months are recalculated and cached values are invalidated.

---

### Edge Cases

- What happens if a month's data is submitted after the deadline (e.g., August data submitted in October)?
- How does the system handle a district that was not established at program year start (districts can be created mid-year)?
- What if membership or club data becomes unavailable from dashboards.toastmasters.org (e.g., API outage)?
- How are historical corrections handled if the district leader notices an error in a previously submitted month?
- Should the system calculate CSP submission efficiency (submitted vs. target) separately from goal tracking?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST read configuration file (JSON/YAML) containing recognition levels, year-end targets, and monthly target derivation rules for a given program year and district.
- **FR-002**: System MUST accept monthly performance input (membership payments YTD, paid clubs YTD, distinguished clubs YTD, CSP submissions YTD) and store it in a structured data format (database or file).
- **FR-003**: System MUST calculate Goal 1 (Membership Payments Growth) status by comparing membership_payments_ytd against the monthly target for each recognition level (Distinguished, Select, President's, Smedley Distinguished), and output "On Track" or "Off Track" with numeric delta.
- **FR-004**: System MUST calculate Goal 2 (Club Growth) status by comparing paid_clubs_ytd against the monthly target for each recognition level, and output "On Track" or "Off Track" with numeric delta.
- **FR-005**: System MUST calculate Goal 3 (Distinguished Clubs) status using either (a) actual distinguished_clubs_ytd count vs. target, or (b) a fallback calculation based on CSP submission rates if actual count is unavailable, and output "On Track" or "Off Track" with numeric delta.
- **FR-006**: System MUST generate a monthly assessment report in a human-readable format (HTML, PDF, or interactive dashboard) that mirrors the structure of the "Assessment Worksheet" Excel sheet, displaying goal statuses and supporting metrics for a given month.
- **FR-007**: System MUST allow District Leaders (DD/PQD/CGD) to add structured goals (text, assigned leader, deadline) to a monthly assessment and store them persistently.
- **FR-008**: System MUST provide a query interface to retrieve goals by leader role, month, date range, and status (completed, in progress, overdue).
- **FR-009**: System MUST support configuration updates without requiring a system restart, and MUST invalidate cached calculations when configuration changes.
- **FR-010**: System MUST provide a year-end summary report that aggregates monthly performance across all 12 months and compares against annual DRP targets.
- **FR-011**: System MUST support multiple districts by accepting district_number as an input parameter and storing/retrieving data keyed by district.
- **FR-012**: System MUST be extensible to accept new input sources (e.g., CSV, API endpoints from dashboards.toastmasters.org) without requiring core logic changes.

### Key Entities _(include if feature involves data)_

- **DistrictConfig**: Defines recognition thresholds, year-end targets, monthly derivation rules, and CSP submission targets for a program year. Keyed by (district_number, program_year).
- **MonthlyAssessment**: Contains performance data for a single month, including membership_payments_ytd, paid_clubs_ytd, distinguished_clubs_ytd, club_success_plans_submitted_ytd, calculated goal statuses, and any notes. Keyed by (district_number, program_year, month).
- **DistrictLeaderGoal**: Represents a single action item (text, assigned leader role, deadline, date_completed, notes). Linked to a MonthlyAssessment or free-standing for multi-month tracking.
- **ReportOutput**: Generated report artifact (HTML, PDF, or JSON) representing a single month's assessment, year-end summary, or goal list. Contains rendered data and metadata (generated_at, report_version).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A monthly assessment report can be generated in under 2 seconds from a complete input dataset.
- **SC-002**: All three goal statuses (Goals 1, 2, 3) in the generated report MUST match the corresponding calculations in the reference Excel workbook for the same input data, verified against at least 12 months of historical data (July 2024–June 2025).
- **SC-003**: District leaders can add a goal and have it stored/retrieved without errors 100% of the time (no data loss).
- **SC-004**: A configuration change (e.g., updated target for a recognition level) is reflected in newly generated reports within 5 seconds, with no manual restart required.
- **SC-005**: The system supports at least 5 active districts and 12 months of historical data without performance degradation (reports still generated in <2s).
- **SC-006**: Year-end summary report is accurate to within 0% error on goal status calculations (binary match: on-track vs. off-track) and numeric deltas (≤ 0.1 variance allowed due to rounding).
- **SC-007**: 90% of intended users (DD/PQD/CGD) can generate a monthly report and understand the output without additional documentation or training.

## Implementation Notes & Assumptions

### Assumptions

1. **Excel workbook as oracle**: The existing "District 61 – 2025 Updated Assessment Worksheet.xlsx" is the single source of truth for calculation logic and wording. Any ambiguity in requirements is resolved by replicating Excel behavior.
2. **Monthly target derivation**: Monthly targets are assumed to be linear (year-end target / 12) unless the Excel workbook indicates a different formula (e.g., accelerated early-year targets).
3. **Data availability**: Monthly input data is assumed to be available or manually entered each month. We do not yet assume automated scraping from dashboards.toastmasters.org.
4. **CSP submission as proxy**: If distinguished_clubs_ytd is unavailable, CSP submission count is used as a proxy for Goal 3 tracking, with a configurable conversion factor.
5. **Single program year scope**: Initially, the system is scoped to a single program year at a time (e.g., 2024–2025), though the data model supports multi-year storage.
6. **User roles are self-reported**: DD, PQD, CGD roles are assigned by the user entering a goal; no authentication or role-based access control is implemented in this iteration.
7. **Config files are hand-maintained**: Initial configuration (recognition thresholds, targets) is maintained manually by an admin; no UI for editing config is included in this iteration.

### Out of Scope (for future work)

- Integration with dashboards.toastmasters.org API (manual data entry only in this iteration).
- Role-based access control or user authentication.
- Real-time goal status dashboard or email notifications.
- Mobile app or native clients.
- Automated archival or data purging.

### Technical Considerations

- The solution should be modeled as a self-contained library or service that can be consumed by both backend (REST API) and frontend (UI components), in line with the Toast Stats constitution.
- Configuration should be stored in JSON or YAML files initially, but the data model should be designed to allow future migration to a database without significant refactoring.
- All calculations should be deterministic and testable; random or external factors should be minimized.
- Error handling should gracefully degrade to fallback calculations (e.g., CSP submission count for Goal 3) rather than failing the entire report.

---

## File Structure & Deliverables

```text
backend/
  src/
    modules/
      assessment/
        config/
          recognitionThresholds.json       # Recognition levels and targets
          monthlyTargets.ts                # Logic to derive monthly targets
        services/
          assessmentCalculator.ts          # Core goal calculation logic
          assessmentReportGenerator.ts    # Report output formatting
          districtLeaderGoalService.ts    # Goal CRUD and query
        routes/
          assessmentRoutes.ts              # API endpoints
        types/
          assessment.ts                    # TypeScript interfaces
        __tests__/
          assessmentCalculator.test.ts     # Unit tests
          assessmentReportGenerator.test.ts
          districtLeaderGoalService.test.ts
```

All code follows the Toast Stats constitution: TypeScript, Vitest, >80% coverage for business logic, no implementation details in the spec.
