# Requirements Document

## Introduction

This feature removes on-demand computation from the backend to enforce the data-computation-separation steering document. The backend currently violates the architectural mandate that it be a "read-only API server" by performing extensive analytics computation through the `AnalyticsEngine` class and its associated modules.

The violations include:
- **AnalyticsEngine** performing on-demand computation for 8+ API endpoints
- **Analytics modules** (MembershipAnalyticsModule, DistinguishedClubAnalyticsModule, etc.) computing analytics at request time
- **TargetCalculatorService** computing recognition level targets on-demand

The solution is to:
1. Extend the scraper-cli pre-computation pipeline to generate all required analytics files
2. Update backend routes to serve pre-computed files instead of computing on-demand
3. Deprecate and eventually remove the AnalyticsEngine from the backend

This spec complements the existing `precomputed-analytics-alignment` spec, which focuses on aligning the DistrictAnalytics structure. This spec focuses on eliminating the remaining on-demand computation violations.

## Glossary

- **AnalyticsEngine**: Backend service that performs on-demand analytics computation (to be deprecated)
- **PreComputedAnalyticsReader**: Backend service that reads pre-computed analytics files from the file system (correct pattern)
- **scraper-cli**: Command-line tool that scrapes data and computes analytics during the data pipeline
- **analytics-core**: Shared package containing analytics computation logic
- **On-Demand Computation**: Computing analytics at API request time (FORBIDDEN by steering document)
- **Pre-Computed Analytics**: Analytics computed during the scraper-cli pipeline and stored as JSON files
- **MembershipAnalytics**: Analytics about membership trends, year-over-year comparisons, and growth patterns
- **ClubTrends**: Individual club trend data including membership history and DCP goals progress
- **VulnerableClubs**: Clubs identified as at-risk based on health indicators
- **LeadershipInsights**: Analytics about leadership effectiveness and officer performance
- **DistinguishedClubAnalytics**: Comprehensive analytics about distinguished club progress and projections
- **YearOverYearComparison**: Comparison of metrics between current and previous program year
- **PerformanceTargets**: Recognition level targets (DAP, DDP, etc.) for districts

## Requirements

### Requirement 1: Pre-Compute Membership Analytics

**User Story:** As a system operator, I want membership analytics to be pre-computed by scraper-cli, so that the backend can serve them without on-demand computation.

#### Acceptance Criteria

1. WHEN the scraper-cli compute-analytics command runs, THE System SHALL generate a `membership-analytics.json` file for each district
2. THE membership-analytics.json file SHALL contain membership trends, year-over-year data, and growth patterns
3. THE membership-analytics.json file SHALL follow the PreComputedAnalyticsFile structure with metadata
4. WHEN the backend receives a request for membership analytics, THE Backend SHALL read from the pre-computed file
5. IF the pre-computed membership analytics file is missing, THE Backend SHALL return HTTP 404 with a clear error message

### Requirement 2: Pre-Compute Club Trends

**User Story:** As a system operator, I want individual club trend data to be pre-computed, so that the backend can serve club-specific analytics without computation.

#### Acceptance Criteria

1. WHEN the scraper-cli compute-analytics command runs, THE System SHALL generate club trend data for each club in each district
2. THE club trends data SHALL be stored in a format that allows efficient retrieval by club ID
3. THE club trends data SHALL include membership history, DCP goals progress, and health status
4. WHEN the backend receives a request for club trends, THE Backend SHALL read from pre-computed data
5. IF the pre-computed club trends data is missing, THE Backend SHALL return HTTP 404 with a clear error message

### Requirement 3: Pre-Compute Vulnerable Clubs List

**User Story:** As a system operator, I want the vulnerable clubs list to be pre-computed, so that the backend can serve it without on-demand risk assessment.

#### Acceptance Criteria

1. WHEN the scraper-cli compute-analytics command runs, THE System SHALL generate a `vulnerable-clubs.json` file for each district
2. THE vulnerable-clubs.json file SHALL contain clubs categorized as vulnerable and intervention-required
3. THE vulnerable-clubs.json file SHALL include risk factors and health scores for each club
4. WHEN the backend receives a request for vulnerable clubs, THE Backend SHALL read from the pre-computed file
5. IF the pre-computed vulnerable clubs file is missing, THE Backend SHALL return HTTP 404 with a clear error message

### Requirement 4: Pre-Compute Leadership Insights

**User Story:** As a system operator, I want leadership insights to be pre-computed, so that the backend can serve them without on-demand analysis.

#### Acceptance Criteria

1. WHEN the scraper-cli compute-analytics command runs, THE System SHALL generate a `leadership-insights.json` file for each district
2. THE leadership-insights.json file SHALL contain leadership effectiveness metrics and officer performance data
3. WHEN the backend receives a request for leadership insights, THE Backend SHALL read from the pre-computed file
4. IF the pre-computed leadership insights file is missing, THE Backend SHALL return HTTP 404 with a clear error message

### Requirement 5: Pre-Compute Distinguished Club Analytics

**User Story:** As a system operator, I want distinguished club analytics to be pre-computed, so that the backend can serve comprehensive distinguished club data without computation.

#### Acceptance Criteria

1. WHEN the scraper-cli compute-analytics command runs, THE System SHALL generate a `distinguished-club-analytics.json` file for each district
2. THE distinguished-club-analytics.json file SHALL contain progress tracking, projections, and detailed club data
3. WHEN the backend receives a request for distinguished club analytics, THE Backend SHALL read from the pre-computed file
4. IF the pre-computed distinguished club analytics file is missing, THE Backend SHALL return HTTP 404 with a clear error message

### Requirement 6: Pre-Compute Year-Over-Year Comparison

**User Story:** As a system operator, I want year-over-year comparison data to be pre-computed, so that the backend can serve historical comparisons without computation.

#### Acceptance Criteria

1. WHEN the scraper-cli compute-analytics command runs, THE System SHALL generate a `year-over-year.json` file for each district
2. THE year-over-year.json file SHALL contain comparison metrics between current and previous program year
3. THE year-over-year.json file SHALL include membership, distinguished clubs, and club health comparisons
4. WHEN the backend receives a request for year-over-year data, THE Backend SHALL read from the pre-computed file
5. IF the pre-computed year-over-year file is missing, THE Backend SHALL return HTTP 404 with a message indicating insufficient historical data

### Requirement 7: Pre-Compute Performance Targets

**User Story:** As a system operator, I want performance targets to be pre-computed, so that the backend can serve recognition level targets without computation.

#### Acceptance Criteria

1. WHEN the scraper-cli compute-analytics command runs, THE System SHALL generate a `performance-targets.json` file for each district
2. THE performance-targets.json file SHALL contain DAP, DDP, and other recognition level targets
3. WHEN the backend receives a request that includes performance targets, THE Backend SHALL read from the pre-computed file
4. IF the pre-computed performance targets file is missing, THE Backend SHALL omit targets from the response (graceful degradation)

### Requirement 8: Update Backend Routes to Serve Pre-Computed Data

**User Story:** As a backend developer, I want all analytics routes to serve pre-computed data, so that the backend complies with the data-computation-separation steering document.

#### Acceptance Criteria

1. THE `/api/districts/:districtId/membership-analytics` route SHALL read from pre-computed files only
2. THE `/api/districts/:districtId/clubs/:clubId/trends` route SHALL read from pre-computed files only
3. THE `/api/districts/:districtId/vulnerable-clubs` route SHALL read from pre-computed files only
4. THE `/api/districts/:districtId/leadership-insights` route SHALL read from pre-computed files only
5. THE `/api/districts/:districtId/distinguished-club-analytics` route SHALL read from pre-computed files only
6. THE `/api/districts/:districtId/year-over-year/:date` route SHALL read from pre-computed files only
7. THE `/api/districts/:districtId/analytics/export` route SHALL read from pre-computed files only
8. THE `/api/districts/:districtId/analytics-summary` route SHALL NOT call AnalyticsEngine for year-over-year data

### Requirement 9: Remove AnalyticsEngine from Backend

**User Story:** As a system maintainer, I want the AnalyticsEngine and analytics modules removed from the backend, so that there is a single source of truth for analytics computation in scraper-cli.

#### Acceptance Criteria

1. THE AnalyticsEngine class SHALL be removed from the backend codebase
2. THE analytics modules in backend/src/services/analytics/ SHALL be removed from the backend codebase
3. THE TargetCalculatorService SHALL be removed from the backend codebase
4. ALL imports and references to removed services SHALL be cleaned up

### Requirement 10: Extend PreComputedAnalyticsReader

**User Story:** As a backend developer, I want the PreComputedAnalyticsReader to support all new pre-computed file types, so that routes can easily read the new analytics files.

#### Acceptance Criteria

1. THE PreComputedAnalyticsReader SHALL support reading membership-analytics.json files
2. THE PreComputedAnalyticsReader SHALL support reading vulnerable-clubs.json files
3. THE PreComputedAnalyticsReader SHALL support reading leadership-insights.json files
4. THE PreComputedAnalyticsReader SHALL support reading distinguished-club-analytics.json files
5. THE PreComputedAnalyticsReader SHALL support reading year-over-year.json files
6. THE PreComputedAnalyticsReader SHALL support reading performance-targets.json files
7. THE PreComputedAnalyticsReader SHALL validate schema versions for all new file types

### Requirement 11: Analytics Export from Pre-Computed Data

**User Story:** As a user, I want to export district analytics to CSV, so that I can analyze data in spreadsheet applications.

#### Acceptance Criteria

1. WHEN the backend receives an export request, THE Backend SHALL read from pre-computed analytics files
2. THE Backend SHALL transform pre-computed JSON data to CSV format
3. THE Backend SHALL NOT compute analytics on-demand for export
4. IF pre-computed data is missing, THE Backend SHALL return HTTP 404 with a clear error message

### Requirement 12: Clean Migration

**User Story:** As a system operator, I want a clean migration path, so that I can regenerate all computed data and have the system work correctly.

#### Acceptance Criteria

1. WHEN pre-computed files are missing, THE Backend SHALL return informative 404 errors with instructions to run scraper-cli
2. THE error messages SHALL indicate which scraper-cli command needs to be run
3. THE scraper-cli compute-analytics command SHALL generate all required pre-computed files in a single run

