# Requirements Document

## Introduction

This feature aligns the pre-computed analytics pipeline to produce the full `DistrictAnalytics` structure expected by the frontend. Currently, there are two separate analytics computation paths:

1. **scraper-cli's `AnalyticsComputer`** - Produces the correct full `DistrictAnalytics` structure with all club details, trends, and rankings
2. **backend's `PreComputedAnalyticsService`** - Produces simplified summary counts during snapshot creation

The backend serves pre-computed files via `PreComputedAnalyticsReader`, but the `PreComputedAnalyticsService` output lacks the detailed data the frontend needs, causing the clubs tab to crash and multiple features to be broken.

The solution is to ensure the scraper-cli's `AnalyticsComputer` output (which produces the correct structure) is what gets stored and served, deprecating the simplified `PreComputedAnalyticsService` approach.

## Glossary

- **DistrictAnalytics**: The complete analytics structure expected by the frontend, containing club arrays, trend arrays, rankings, and projections
- **ClubTrend**: Individual club data including division/area info, membership trends, DCP goals trends, health status, and payment breakdowns
- **PreComputedAnalyticsService**: Backend service that currently produces simplified summary counts during snapshot creation (to be deprecated)
- **AnalyticsComputer**: The analytics-core module that produces the full `DistrictAnalytics` structure
- **PreComputedAnalyticsReader**: Backend service that reads pre-computed analytics files from the file system
- **Snapshot**: A point-in-time capture of district data stored in the cache directory
- **ClubHealthStatus**: Classification of club health as 'thriving', 'stable', 'vulnerable', or 'intervention_required'
- **DistinguishedClubCounts**: Summary counts of distinguished clubs by recognition level (smedley, presidents, select, distinguished)

## Requirements

### Requirement 1: ClubTrend Type Alignment

**User Story:** As a frontend developer, I want the `ClubTrend` type in analytics-core to include all fields the frontend expects, so that the clubs tab renders correctly without crashes.

#### Acceptance Criteria

1. THE analytics-core ClubTrend type SHALL include `divisionId` and `divisionName` fields
2. THE analytics-core ClubTrend type SHALL include `areaId` and `areaName` fields
3. THE analytics-core ClubTrend type SHALL include `membershipTrend` as an array of date/count objects
4. THE analytics-core ClubTrend type SHALL include `dcpGoalsTrend` as an array of date/goalsAchieved objects
5. THE analytics-core ClubTrend type SHALL include `distinguishedLevel` field with values matching frontend expectations
6. THE analytics-core ClubTrend type SHALL include `riskFactors` as an array of strings (not an object)
7. THE analytics-core ClubTrend type SHALL include optional payment fields: `octoberRenewals`, `aprilRenewals`, `newMembers`
8. THE analytics-core ClubTrend type SHALL include optional `clubStatus` field for operational status

### Requirement 2: ClubHealthAnalyticsModule Enhancement

**User Story:** As a system operator, I want the ClubHealthAnalyticsModule to extract all required club data from snapshots, so that the pre-computed analytics contain complete club information.

#### Acceptance Criteria

1. WHEN generating club health data, THE ClubHealthAnalyticsModule SHALL extract division and area information for each club
2. WHEN generating club health data, THE ClubHealthAnalyticsModule SHALL build membership trend arrays from historical snapshots
3. WHEN generating club health data, THE ClubHealthAnalyticsModule SHALL build DCP goals trend arrays from historical snapshots
4. WHEN generating club health data, THE ClubHealthAnalyticsModule SHALL extract payment breakdown fields (October renewals, April renewals, new members)
5. WHEN generating club health data, THE ClubHealthAnalyticsModule SHALL extract club operational status from snapshot data
6. WHEN generating club health data, THE ClubHealthAnalyticsModule SHALL convert risk factors object to string array format
7. WHEN generating club health data, THE ClubHealthAnalyticsModule SHALL determine distinguished level for each club

### Requirement 3: DistrictAnalytics Structure Completeness

**User Story:** As a frontend developer, I want the pre-computed DistrictAnalytics to contain all required fields, so that all dashboard features work correctly.

#### Acceptance Criteria

1. THE DistrictAnalytics structure SHALL include `allClubs` as an array of complete ClubTrend objects
2. THE DistrictAnalytics structure SHALL include `vulnerableClubs` as an array of complete ClubTrend objects
3. THE DistrictAnalytics structure SHALL include `thrivingClubs` as an array of complete ClubTrend objects
4. THE DistrictAnalytics structure SHALL include `interventionRequiredClubs` as an array of complete ClubTrend objects
5. THE DistrictAnalytics structure SHALL include `membershipTrend` as an array of date/count objects (not a single point)
6. THE DistrictAnalytics structure SHALL include `divisionRankings` as an array of DivisionRanking objects
7. THE DistrictAnalytics structure SHALL include `topPerformingAreas` as an array of AreaPerformance objects
8. THE DistrictAnalytics structure SHALL include `distinguishedClubsList` as an array of DistinguishedClubSummary objects
9. THE DistrictAnalytics structure SHALL include `distinguishedProjection` as a DistinguishedProjection object

### Requirement 4: Division and Area Data Extraction

**User Story:** As a system operator, I want division and area information to be correctly extracted from snapshot data, so that clubs can be properly grouped and ranked.

#### Acceptance Criteria

1. WHEN extracting club data, THE System SHALL parse division ID and name from the 'Division' field in snapshot data
2. WHEN extracting club data, THE System SHALL parse area ID and name from the 'Area' field in snapshot data
3. WHEN division/area data is missing, THE System SHALL use sensible defaults ('Unknown Division', 'Unknown Area')
4. THE DivisionAreaAnalyticsModule SHALL generate division rankings from extracted division data
5. THE DivisionAreaAnalyticsModule SHALL generate top performing areas from extracted area data

### Requirement 5: Trend Data as Arrays

**User Story:** As a frontend developer, I want trend data stored as arrays, so that charts can render historical data correctly.

#### Acceptance Criteria

1. WHEN computing analytics from multiple snapshots, THE System SHALL build membershipTrend as an array with one entry per snapshot date
2. WHEN computing analytics from multiple snapshots, THE System SHALL build paymentsTrend as an array with one entry per snapshot date
3. WHEN computing club trends, THE System SHALL build membershipTrend per club as an array with historical data points
4. WHEN computing club trends, THE System SHALL build dcpGoalsTrend per club as an array with historical data points
5. IF only one snapshot is available, THE System SHALL still return arrays (with single elements)

### Requirement 6: Distinguished Club Data

**User Story:** As a frontend developer, I want complete distinguished club data, so that the distinguished clubs section displays correctly.

#### Acceptance Criteria

1. THE DistrictAnalytics SHALL include `distinguishedClubs` as a counts object with smedley, presidents, select, distinguished, and total fields
2. THE DistrictAnalytics SHALL include `distinguishedClubsList` as an array of DistinguishedClubSummary objects
3. EACH DistinguishedClubSummary SHALL include clubId, clubName, status, dcpPoints, and goalsCompleted
4. THE DistrictAnalytics SHALL include `distinguishedProjection` with projected counts for each level

### Requirement 7: Backend Analytics Route Alignment

**User Story:** As a backend developer, I want the analytics route to serve the complete DistrictAnalytics structure, so that the frontend receives all required data.

#### Acceptance Criteria

1. WHEN serving pre-computed analytics, THE Backend SHALL return the full DistrictAnalytics structure
2. IF pre-computed analytics are missing required fields, THE Backend SHALL log a warning and return available data
3. THE Backend SHALL NOT transform or reduce the pre-computed analytics structure
4. THE Backend analytics route SHALL validate that served data matches the DistrictAnalytics type

### Requirement 8: Deprecate PreComputedAnalyticsService Summaries

**User Story:** As a system maintainer, I want to deprecate the simplified summary approach, so that there is a single source of truth for analytics computation.

#### Acceptance Criteria

1. THE PreComputedAnalyticsService SHALL be marked as deprecated with documentation explaining the migration path
2. THE System SHALL rely on scraper-cli's AnalyticsComputer for all pre-computed analytics generation
3. THE analytics-summary.json files SHALL remain for backward compatibility but SHALL NOT be the primary data source
4. WHEN both full analytics and summary files exist, THE Backend SHALL prefer the full analytics files

### Requirement 9: Club Status Extraction

**User Story:** As a frontend developer, I want club operational status (Active, Suspended, Low, Ineligible) to be available, so that I can display club status badges.

#### Acceptance Criteria

1. WHEN extracting club data, THE System SHALL extract club status from the 'Club Status' or 'Status' field in snapshot data
2. THE clubStatus field SHALL contain values: 'Active', 'Suspended', 'Low', 'Ineligible', or undefined
3. IF club status is not available in snapshot data, THE clubStatus field SHALL be undefined

### Requirement 10: Paid Clubs Calculation

**User Story:** As a system operator, I want paid clubs to be correctly calculated, so that DAP/DDP recognition thresholds work correctly.

#### Acceptance Criteria

1. THE System SHALL calculate paid clubs based on membership payment data (October renewals + April renewals + new members > 0)
2. THE System SHALL include paid club counts in area and division recognition calculations
3. WHEN payment data is unavailable, THE System SHALL use membership count as a fallback indicator
