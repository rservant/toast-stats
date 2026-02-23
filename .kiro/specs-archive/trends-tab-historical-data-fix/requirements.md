# Requirements Document

## Introduction

The Trends tab on the DistrictDetailPage has three data display bugs affecting the Membership Trend chart, Membership Payments Trend chart, and Year-Over-Year Comparison panel. These bugs span the frontend, backend, and analytics-core computation pipeline. The root causes are: (1) the backend returns empty membership trend data when the selected date falls before the first available data point in a sparse time-series index, (2) the `usePaymentsTrend` hook hardcodes `getCurrentProgramYear()` instead of using the user-selected program year, and (3) the collector-cli passes only one snapshot to `computeYearOverYear`, causing it to compare the same snapshot against itself, producing zero-change results. Additionally, the backend sends absolute change values for YoY but the frontend interprets them as percentage changes.

## Glossary

- **Trends_Tab**: The "Trends" tab within the DistrictDetailPage that displays the MembershipTrendChart, MembershipPaymentsChart, and YearOverYearComparison components.
- **Time_Series_Index**: A per-district, per-program-year JSON file containing data points (date, membership, payments, etc.) stored at `time-series/district_{id}/{year}.json`. May be sparse (e.g., 4 monthly data points) or dense (e.g., 240 daily data points).
- **Analytics_Summary_Route**: The backend endpoint `GET /api/districts/:districtId/analytics-summary` that serves aggregated analytics including membership trend data from the Time_Series_Index and YoY comparison from pre-computed files.
- **UsePaymentsTrend_Hook**: The React hook `usePaymentsTrend` that fetches and transforms payment trend data with multi-year comparison. Groups data by program year and extracts the "current year" trend for display.
- **AnalyticsComputeService**: The collector-cli service that orchestrates analytics computation for a district, loading snapshots and calling AnalyticsComputer methods.
- **AnalyticsComputer**: The analytics-core class that computes year-over-year comparison data via `computeYearOverYear()`, which requires snapshots from both the current and previous program year.
- **MetricComparison**: A shared-contracts type containing `current`, `previous`, `change` (absolute), and `percentageChange` (percentage) fields for comparing metrics across years.
- **YearOverYearComparison_Component**: The React component that displays year-over-year metric comparisons. Receives `yearOverYear` data with `membershipChange`, `distinguishedChange`, and `clubHealthChange` fields.
- **Selected_Program_Year**: The program year chosen by the user via the date selector on the DistrictDetailPage. Determines the date range for all data queries.

## Requirements

### Requirement 1: Membership Trend Sparse Data Handling

**User Story:** As a district leader, I want the Membership Trend chart to display available data points even when my selected date falls before the first data point in a sparse time-series, so that I can see trend data for the program year instead of an empty chart.

#### Acceptance Criteria

1. WHEN the Analytics_Summary_Route receives a date range query that returns zero trend data points from the Time_Series_Index, THE Analytics_Summary_Route SHALL expand the query to cover the full program year for the requested end date and return all available data points within that program year.
2. WHEN the Analytics_Summary_Route expands the date range, THE Analytics_Summary_Route SHALL preserve the original requested date range in the response `dateRange` field.
3. WHEN the Time_Series_Index contains no data points for the entire program year, THE Analytics_Summary_Route SHALL return an empty trend array without error.

### Requirement 2: Payments Trend Selected Program Year

**User Story:** As a district leader, I want the Membership Payments Trend chart to display payment data for the program year I have selected, so that I can view historical payment trends for any available program year.

#### Acceptance Criteria

1. WHEN the UsePaymentsTrend_Hook groups payment data by program year, THE UsePaymentsTrend_Hook SHALL identify the "current year" trend using the Selected_Program_Year rather than the actual current calendar-based program year.
2. WHEN the Selected_Program_Year differs from the actual current program year, THE UsePaymentsTrend_Hook SHALL display the selected program year's data as the primary trend and treat adjacent years as comparison data.
3. WHEN the Selected_Program_Year has no payment data available, THE UsePaymentsTrend_Hook SHALL return an empty `currentYearTrend` array and null `multiYearData`.

### Requirement 3: Year-Over-Year Previous Year Snapshot Loading

**User Story:** As a district leader, I want the Year-Over-Year Comparison to show actual changes between the current and previous program year, so that I can understand real performance trends.

#### Acceptance Criteria

1. WHEN the AnalyticsComputeService computes district analytics, THE AnalyticsComputeService SHALL load the previous program year's snapshot for the same district and pass both the current and previous snapshots to AnalyticsComputer.computeYearOverYear().
2. WHEN a previous program year snapshot exists for the district, THE AnalyticsComputer SHALL compute MetricComparison values using the current snapshot and the previous year snapshot as distinct data sources.
3. WHEN no previous program year snapshot exists for the district, THE AnalyticsComputer SHALL set `dataAvailable` to false with a descriptive message indicating insufficient historical data.
4. IF the previous program year snapshot file cannot be read, THEN THE AnalyticsComputeService SHALL log a warning and proceed with single-snapshot computation, producing a YoY result with `dataAvailable` set to false.

### Requirement 4: Year-Over-Year Frontend-Backend Contract Alignment

**User Story:** As a district leader, I want the Year-Over-Year Comparison to display correct previous year values and percentage changes, so that the comparison metrics are accurate.

#### Acceptance Criteria

1. WHEN the Analytics_Summary_Route constructs the `yearOverYear` response field, THE Analytics_Summary_Route SHALL send `percentageChange` values from MetricComparison (not `change` values) for `membershipChange`, `distinguishedChange`, and `clubHealthChange`.
2. WHEN the YearOverYearComparison_Component receives `yearOverYear` data, THE YearOverYearComparison_Component SHALL derive previous year values from the percentage change values using the formula `previous = current / (1 + percentageChange / 100)`.
3. WHEN a `percentageChange` value is exactly -100, THE YearOverYearComparison_Component SHALL display the previous year value as 0.
