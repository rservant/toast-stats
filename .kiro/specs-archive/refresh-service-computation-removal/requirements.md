# Requirements Document

## Introduction

This feature removes on-demand computation from multiple backend services to enforce the data-computation-separation steering document. Several backend services currently violate the architectural mandate that the backend be a "read-only API server" by performing computation during snapshot creation and backfill operations.

### RefreshService Violations

- **triggerTimeSeriesIndexUpdate()** - Triggers on-demand time-series index computation
- **buildTimeSeriesDataPoint()** - Computes time-series data points from district statistics
- **calculateTotalMembership()** - Computes membership totals on-demand
- **calculateTotalPayments()** - Computes payment totals on-demand
- **calculateTotalDCPGoals()** - Computes DCP goal totals on-demand
- **calculateClubHealthCounts()** - Classifies clubs into health categories
- **calculateDistinguishedTotal()** - Counts distinguished clubs on-demand
- **isDistinguished()** - Determines if a club is distinguished

### BackfillService Violations

The BackfillService duplicates the same computation violations:

- **buildTimeSeriesDataPoint()** - Duplicates RefreshService computation
- **isDistinguished()** - Duplicates RefreshService computation
- **parseIntSafe()** - Utility method for computation

### SnapshotBuilder Violations

- **calculateAllDistrictsRankings()** - Computes Borda count rankings on-demand
- Uses **RankingCalculator** to compute rankings during snapshot creation

### PreComputedAnalyticsService Violations

- **computeDistrictAnalytics()** - Computes analytics on-demand
- **calculateTotalMembership()** - Computes membership totals
- **calculateClubHealthCounts()** - Classifies clubs into health categories
- **calculateDistinguishedClubCounts()** - Counts distinguished clubs by level
- **calculateTotalPayments()** - Computes payment totals
- **calculateTotalDCPGoals()** - Computes DCP goal totals

### AnalyticsGenerator (Unified Backfill) Violations

- **buildTimeSeriesDataPoint()** - Duplicates computation
- **calculateTotalMembership()** - Duplicates computation
- **calculateTotalPayments()** - Duplicates computation
- **calculateTotalDCPGoals()** - Duplicates computation
- **calculateClubHealthCounts()** - Duplicates computation
- **calculateDistinguishedTotal()** - Duplicates computation

### TimeSeriesIndexStorage Violations

Both LocalTimeSeriesIndexStorage and FirestoreTimeSeriesIndexStorage have:

- **calculateProgramYearSummary()** - Computes summary statistics

### Route Handler Violations

- **analyticsSummary.ts** - `calculateDistinguishedProjection()` computes projections on-demand
- **core.ts** - Computes `overallRank` by sorting rankings on-demand

Per the `data-computation-separation.md` steering document:

- "The backend MUST NOT perform any on-demand data computation"
- "The backend has a computation budget of **0ms** for data computation"
- "All computation happens in collector-cli"

### Solution Approach

**CRITICAL: Migrate existing implementation, do not rewrite.** The backend code has been hardened with bug fixes. We will:

1. Move time-series computation logic from RefreshService/BackfillService to analytics-core
2. Move ranking computation from SnapshotBuilder to collector-cli transform command
3. Update collector-cli to generate time-series index files during compute-analytics
4. Update collector-cli transform command to compute rankings
5. Remove computation methods from backend services
6. Update TimeSeriesIndexService to read pre-computed data only

## Glossary

- **RefreshService**: Backend service that orchestrates snapshot creation from cached CSV data
- **BackfillService**: Backend service that processes existing snapshots to generate pre-computed analytics
- **SnapshotBuilder**: Backend service that creates snapshots from cached CSV data
- **RankingCalculator**: Backend service that computes Borda count rankings for districts
- **TimeSeriesIndexService**: Backend service that manages time-series index files for efficient range queries
- **TimeSeriesDataPoint**: A data structure containing aggregated metrics for a single snapshot date
- **TimeSeriesDataPointBuilder**: New analytics-core class that computes time-series data points (migrated from backend)
- **Program_Year**: Toastmasters program year running from July 1 to June 30 (e.g., "2023-2024")
- **collector-cli**: Command-line tool that scrapes data and computes analytics during the data pipeline
- **transform**: The collector-cli command that converts raw CSV to snapshot JSON files
- **compute-analytics**: The collector-cli command that generates pre-computed analytics files
- **On-Demand_Computation**: Computing data at API request time (FORBIDDEN by steering document)
- **Pre-Computed_Data**: Data computed during the collector-cli pipeline and stored as JSON files
- **Club_Health_Classification**: Categorization of clubs as thriving, vulnerable, or intervention-required
- **Borda_Count_Ranking**: Ranking algorithm that assigns points based on position in multiple categories

## Requirements

### Requirement 1: Remove Time-Series Computation from RefreshService

**User Story:** As a system maintainer, I want the RefreshService to have zero computation, so that the backend complies with the data-computation-separation steering document.

#### Acceptance Criteria

1. THE RefreshService SHALL NOT contain the triggerTimeSeriesIndexUpdate method
2. THE RefreshService SHALL NOT contain the buildTimeSeriesDataPoint method
3. THE RefreshService SHALL NOT contain the calculateTotalMembership method
4. THE RefreshService SHALL NOT contain the calculateTotalPayments method
5. THE RefreshService SHALL NOT contain the calculateTotalDCPGoals method
6. THE RefreshService SHALL NOT contain the calculateClubHealthCounts method
7. THE RefreshService SHALL NOT contain the calculateDistinguishedTotal method
8. THE RefreshService SHALL NOT contain the isDistinguished method
9. THE RefreshService SHALL NOT contain the parseIntSafe method
10. THE RefreshService SHALL NOT have a dependency on ITimeSeriesIndexService

### Requirement 2: Remove Time-Series Computation from BackfillService

**User Story:** As a system maintainer, I want the BackfillService to have zero time-series computation, so that the backend complies with the data-computation-separation steering document.

#### Acceptance Criteria

1. THE BackfillService SHALL NOT contain the buildTimeSeriesDataPoint method
2. THE BackfillService SHALL NOT contain the isDistinguished method
3. THE BackfillService SHALL NOT contain the parseIntSafe method
4. THE BackfillService SHALL read time-series data from pre-computed files only
5. THE BackfillService SHALL NOT have a dependency on ITimeSeriesIndexService for writing

### Requirement 3: Remove Ranking Computation from SnapshotBuilder

**User Story:** As a system maintainer, I want the SnapshotBuilder to not compute rankings, so that the backend complies with the data-computation-separation steering document.

#### Acceptance Criteria

1. THE SnapshotBuilder SHALL NOT contain the calculateAllDistrictsRankings method
2. THE SnapshotBuilder SHALL NOT have a dependency on RankingCalculator
3. THE SnapshotBuilder SHALL read pre-computed rankings from the transform output
4. IF rankings are not available, THE SnapshotBuilder SHALL create snapshots without rankings

### Requirement 4: Generate Time-Series Index in collector-cli

**User Story:** As a system operator, I want time-series index data to be generated by collector-cli, so that the backend can serve it without on-demand computation.

#### Acceptance Criteria

1. WHEN the collector-cli compute-analytics command runs, THE System SHALL generate time-series data points for each district
2. THE time-series data points SHALL be written to program-year-partitioned index files
3. THE time-series data points SHALL include membership, payments, dcpGoals, distinguishedTotal, and clubCounts
4. THE time-series index files SHALL follow the existing TimeSeriesIndexService file structure
5. THE compute-analytics command SHALL update the index-metadata.json file for each district

### Requirement 5: Generate Rankings in collector-cli Transform Command

**User Story:** As a system operator, I want rankings to be computed during the transform command, so that the backend can serve them without on-demand computation.

#### Acceptance Criteria

1. WHEN the collector-cli transform command runs with all-districts data, THE System SHALL compute Borda count rankings
2. THE rankings SHALL be written to the all-districts-rankings.json file in the snapshot directory
3. THE rankings computation SHALL use the same algorithm as the current RankingCalculator
4. IF all-districts data is not available, THE transform command SHALL skip rankings computation

### Requirement 6: Move Time-Series Computation Logic to analytics-core

**User Story:** As a developer, I want time-series computation logic in a shared package, so that collector-cli can use it without code duplication.

#### Acceptance Criteria

1. THE analytics-core package SHALL contain a TimeSeriesDataPointBuilder class
2. THE TimeSeriesDataPointBuilder SHALL be migrated from RefreshService (not rewritten)
3. THE TimeSeriesDataPointBuilder SHALL compute membership totals from district statistics
4. THE TimeSeriesDataPointBuilder SHALL compute payment totals from district statistics
5. THE TimeSeriesDataPointBuilder SHALL compute DCP goal totals from district statistics
6. THE TimeSeriesDataPointBuilder SHALL compute club health counts from district statistics
7. THE TimeSeriesDataPointBuilder SHALL compute distinguished club totals from district statistics
8. THE TimeSeriesDataPointBuilder SHALL produce TimeSeriesDataPoint objects

### Requirement 7: Move Ranking Computation Logic to analytics-core

**User Story:** As a developer, I want ranking computation logic in a shared package, so that collector-cli can use it without code duplication.

#### Acceptance Criteria

1. THE analytics-core package SHALL contain a BordaCountRankingCalculator class
2. THE BordaCountRankingCalculator SHALL be migrated from backend RankingCalculator (not rewritten)
3. THE BordaCountRankingCalculator SHALL compute rankings using the same algorithm
4. THE BordaCountRankingCalculator SHALL preserve all bug fixes from the backend implementation

### Requirement 8: Update TimeSeriesIndexService for Read-Only Operation

**User Story:** As a backend developer, I want the TimeSeriesIndexService to only read pre-computed data, so that it complies with the data-computation-separation steering document.

#### Acceptance Criteria

1. THE TimeSeriesIndexService SHALL read time-series data from pre-computed files only
2. THE TimeSeriesIndexService appendDataPoint method SHALL be removed or deprecated
3. THE TimeSeriesIndexService rebuildIndex method SHALL be removed or deprecated
4. IF time-series data is missing, THE TimeSeriesIndexService SHALL return null or empty results
5. THE TimeSeriesIndexService SHALL NOT perform any computation

### Requirement 9: Integrate Time-Series Generation with Analytics Pipeline

**User Story:** As a system operator, I want time-series index generation to happen during the compute-analytics command, so that I have a single command to generate all pre-computed data.

#### Acceptance Criteria

1. WHEN compute-analytics runs, THE System SHALL generate time-series index files alongside other analytics files
2. THE time-series index generation SHALL use the same snapshot data as other analytics
3. THE time-series index generation SHALL be atomic (write to temp file, then rename)
4. IF time-series index generation fails for a district, THE System SHALL log the error and continue with other districts

### Requirement 10: Maintain Time-Series Index File Structure

**User Story:** As a system operator, I want the time-series index file structure to remain unchanged, so that existing data remains compatible.

#### Acceptance Criteria

1. THE time-series index files SHALL be stored in CACHE*DIR/time-series/district*{id}/
2. THE program year index files SHALL be named {year}-{year+1}.json (e.g., "2023-2024.json")
3. THE index-metadata.json file SHALL be updated with available program years
4. THE ProgramYearIndexFile structure SHALL remain unchanged
5. THE TimeSeriesDataPoint structure SHALL remain unchanged

### Requirement 11: Clean Migration Path

**User Story:** As a system operator, I want a clean migration path, so that I can regenerate time-series data and have the system work correctly.

#### Acceptance Criteria

1. WHEN time-series data is missing, THE Backend SHALL return empty results (not errors)
2. THE collector-cli compute-analytics command SHALL regenerate time-series indexes from existing snapshots
3. THE migration SHALL NOT require manual intervention beyond running compute-analytics

### Requirement 12: Remove RankingCalculator from Backend

**User Story:** As a system maintainer, I want the RankingCalculator removed from the backend, so that there is a single source of truth for ranking computation in analytics-core.

#### Acceptance Criteria

1. THE RankingCalculator class SHALL be removed from the backend codebase
2. ALL imports and references to RankingCalculator in backend SHALL be cleaned up
3. THE shared.ts initialization SHALL NOT create a RankingCalculator instance

### Requirement 14: Remove Computation from PreComputedAnalyticsService

**User Story:** As a system maintainer, I want the PreComputedAnalyticsService to only read pre-computed data, so that the backend complies with the data-computation-separation steering document.

#### Acceptance Criteria

1. THE PreComputedAnalyticsService SHALL NOT contain the computeDistrictAnalytics method
2. THE PreComputedAnalyticsService SHALL NOT contain the calculateTotalMembership method
3. THE PreComputedAnalyticsService SHALL NOT contain the calculateClubHealthCounts method
4. THE PreComputedAnalyticsService SHALL NOT contain the calculateDistinguishedClubCounts method
5. THE PreComputedAnalyticsService SHALL NOT contain the calculateTotalPayments method
6. THE PreComputedAnalyticsService SHALL NOT contain the calculateTotalDCPGoals method
7. THE PreComputedAnalyticsService SHALL read analytics from pre-computed files only

### Requirement 15: Remove Computation from AnalyticsGenerator

**User Story:** As a system maintainer, I want the AnalyticsGenerator to not perform computation, so that the backend complies with the data-computation-separation steering document.

#### Acceptance Criteria

1. THE AnalyticsGenerator SHALL NOT contain the buildTimeSeriesDataPoint method
2. THE AnalyticsGenerator SHALL NOT contain the calculateTotalMembership method
3. THE AnalyticsGenerator SHALL NOT contain the calculateTotalPayments method
4. THE AnalyticsGenerator SHALL NOT contain the calculateTotalDCPGoals method
5. THE AnalyticsGenerator SHALL NOT contain the calculateClubHealthCounts method
6. THE AnalyticsGenerator SHALL NOT contain the calculateDistinguishedTotal method
7. THE AnalyticsGenerator SHALL read pre-computed analytics and time-series data only

### Requirement 16: Remove Computation from TimeSeriesIndexStorage

**User Story:** As a system maintainer, I want the TimeSeriesIndexStorage implementations to not perform computation, so that the backend complies with the data-computation-separation steering document.

#### Acceptance Criteria

1. THE LocalTimeSeriesIndexStorage SHALL NOT contain the calculateProgramYearSummary method
2. THE FirestoreTimeSeriesIndexStorage SHALL NOT contain the calculateProgramYearSummary method
3. THE program year summary SHALL be pre-computed by collector-cli and stored in the index files
4. THE TimeSeriesIndexStorage implementations SHALL read summaries from pre-computed files only

### Requirement 13: Define Time-Series Types in shared-contracts

**User Story:** As a developer, I want time-series data types defined in shared-contracts, so that both collector-cli and backend use the same validated types.

#### Acceptance Criteria

1. THE shared-contracts package SHALL contain TimeSeriesDataPoint type definition
2. THE shared-contracts package SHALL contain ProgramYearIndexFile type definition
3. THE shared-contracts package SHALL contain TimeSeriesIndexMetadata type definition
4. THE shared-contracts package SHALL contain Zod schemas for all time-series types
5. THE shared-contracts package SHALL export validation helpers for time-series types
6. THE collector-cli SHALL import time-series types from shared-contracts
7. THE backend SHALL import time-series types from shared-contracts
8. THE analytics-core SHALL import time-series types from shared-contracts

### Requirement 17: Remove Computation from Route Handlers

**User Story:** As a system maintainer, I want route handlers to not perform computation, so that the backend complies with the data-computation-separation steering document.

#### Acceptance Criteria

1. THE analyticsSummary route SHALL NOT contain the calculateDistinguishedProjection function
2. THE distinguishedProjection SHALL be pre-computed by collector-cli and stored in analytics files
3. THE core.ts route SHALL NOT compute overallRank by sorting rankings
4. THE overallRank SHALL be pre-computed by collector-cli and stored in rankings files
5. ALL route handlers SHALL only read and format pre-computed data
