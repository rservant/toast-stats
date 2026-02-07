# Requirements Document

## Introduction

The Trends tab on the DistrictDetailPage displays historical data charts (District Membership Trend, Membership Payments Trend) and a Year-Over-Year Comparison card. Currently, the Trends tab sources its data from the single-snapshot analytics endpoint (`useDistrictAnalytics`), which returns only one data point per trend. The correct data source is the aggregated analytics endpoint (`useAggregatedAnalytics`), which returns time-series data across all snapshots. This is a frontend-only data source wiring fix — no backend changes are needed.

## Glossary

- **Trends_Tab**: The "Trends" tab within the DistrictDetailPage that displays membership trend charts, payments trend charts, and year-over-year comparison data.
- **Single_Snapshot_Analytics**: Data returned by the `useDistrictAnalytics` hook (calls `GET /api/districts/:districtId/analytics`), containing analytics computed from a single snapshot. Contains only one data point for `membershipTrend`.
- **Aggregated_Analytics**: Data returned by the `useAggregatedAnalytics` hook (calls `GET /api/districts/:districtId/analytics-summary`), containing time-series data aggregated across all snapshots. Returns many data points for membership trends.
- **MembershipTrendChart**: A React component that renders a line chart of membership counts over time. Accepts an array of `{ date, count }` data points.
- **YearOverYearComparison**: A React component that displays year-over-year metric changes. Accepts optional `yearOverYear` data and `currentYear` summary metrics.
- **DistrictDetailPage**: The main page component (`frontend/src/pages/DistrictDetailPage.tsx`) that hosts the Overview, Clubs, Divisions, Trends, Analytics, and Global Rankings tabs.

## Requirements

### Requirement 1: Membership Trend Chart Data Source

**User Story:** As a district leader, I want the Membership Trend chart on the Trends tab to display historical data across all snapshots, so that I can observe membership trends over time.

#### Acceptance Criteria

1. WHEN the Trends_Tab renders the MembershipTrendChart, THE Trends_Tab SHALL pass membership trend data from Aggregated_Analytics (`aggregatedAnalytics.trends.membership`) instead of Single_Snapshot_Analytics (`analytics.membershipTrend`).
2. WHEN Aggregated_Analytics data is available, THE MembershipTrendChart SHALL display multiple data points representing the full time-series history.
3. WHEN Aggregated_Analytics data is loading, THE Trends_Tab SHALL display a loading state for the MembershipTrendChart.

### Requirement 2: Year-Over-Year Comparison Data Source

**User Story:** As a district leader, I want the Year-Over-Year Comparison card on the Trends tab to display comparison metrics, so that I can understand how the district is performing relative to the previous year.

#### Acceptance Criteria

1. WHEN the Trends_Tab renders the YearOverYearComparison component, THE Trends_Tab SHALL pass `yearOverYear` data from Aggregated_Analytics (`aggregatedAnalytics.yearOverYear`) instead of Single_Snapshot_Analytics (`analytics.yearOverYear`).
2. WHEN the Trends_Tab renders the YearOverYearComparison component, THE Trends_Tab SHALL pass `currentYear` summary metrics derived from Aggregated_Analytics (`aggregatedAnalytics.summary`) instead of Single_Snapshot_Analytics.
3. WHEN Aggregated_Analytics provides `yearOverYear` data, THE YearOverYearComparison component SHALL display the comparison metrics instead of "No Historical Data".

### Requirement 3: Trends Tab Data Availability Guard

**User Story:** As a district leader, I want the Trends tab to render correctly when aggregated data is available, so that I see trend charts without errors.

#### Acceptance Criteria

1. WHEN Aggregated_Analytics data is available, THE Trends_Tab SHALL render the MembershipTrendChart and YearOverYearComparison components using that data.
2. WHEN Aggregated_Analytics data is not available, THE Trends_Tab SHALL not render the MembershipTrendChart or YearOverYearComparison components that depend on it.
3. WHEN Aggregated_Analytics data is loading, THE Trends_Tab SHALL pass the loading state to child components.
