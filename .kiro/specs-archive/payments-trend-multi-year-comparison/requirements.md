# Requirements Document

## Introduction

The Membership Payments Trend chart on the Trends tab currently displays only a single program year of payment data, despite the chart component (`MembershipPaymentsChart`) and the hook (`usePaymentsTrend`) having full infrastructure for multi-year rendering (grouping by program year, limiting to 3 years, rendering multiple colored lines). The root cause is that `DistrictDetailPage` passes single-year `aggregatedPaymentsTrend` data from the `useAggregatedAnalytics` hook, which overrides the multi-year data that `usePaymentsTrend` fetches internally via `useDistrictAnalytics`. This spec addresses the data flow so the chart receives and displays up to 3 program years of payment data for comparison.

## Glossary

- **Payments_Trend_Hook**: The `usePaymentsTrend` React hook that fetches, groups, and transforms payment trend data for chart rendering
- **Aggregated_Analytics_Hook**: The `useAggregatedAnalytics` React hook that fetches combined analytics from the `/analytics-summary` backend endpoint
- **District_Analytics_Hook**: The `useDistrictAnalytics` React hook that fetches per-district analytics including multi-year payment trend data
- **District_Detail_Page**: The `DistrictDetailPage` React component that orchestrates data fetching and renders the Trends tab
- **Payments_Chart**: The `MembershipPaymentsChart` React component that renders payment trend lines
- **Program_Year**: A Toastmasters program year running from July 1 to June 30
- **Multi_Year_Data**: Payment trend data spanning the current program year plus up to 2 previous program years
- **aggregatedPaymentsTrend**: The single-year payments time-series array passed from Aggregated_Analytics_Hook to Payments_Trend_Hook

## Requirements

### Requirement 1: Multi-Year Payment Data Selection

**User Story:** As a district leader, I want the Membership Payments Trend chart to display the current program year plus up to 2 previous program years, so that I can compare payment patterns across years.

#### Acceptance Criteria

1. WHEN the Payments_Trend_Hook processes payment data, THE Payments_Trend_Hook SHALL use Multi_Year_Data from the District_Analytics_Hook rather than single-year aggregatedPaymentsTrend for multi-year grouping
2. WHEN the Payments_Trend_Hook builds multi-year chart data, THE Payments_Trend_Hook SHALL include data from up to 3 program years (current year plus up to 2 previous years)
3. WHEN the District_Detail_Page renders the Trends tab, THE District_Detail_Page SHALL stop passing aggregatedPaymentsTrend to the Payments_Trend_Hook

### Requirement 2: Current Year Statistics Accuracy

**User Story:** As a district leader, I want the payment statistics panel (current YTD payments, payment base, year-over-year change) to remain accurate, so that I can trust the summary numbers shown alongside the chart.

#### Acceptance Criteria

1. WHEN the Payments_Trend_Hook computes current YTD payments, THE Payments_Trend_Hook SHALL derive the value from the performanceTargets field of the District_Analytics_Hook response
2. WHEN the Payments_Trend_Hook computes year-over-year change, THE Payments_Trend_Hook SHALL compare the current year payment count at the latest data point against the closest matching program year day in the most recent previous year
3. IF no previous year data exists within 7 days of the current program year day, THEN THE Payments_Trend_Hook SHALL report year-over-year change as null

### Requirement 3: Backward Compatibility

**User Story:** As a developer, I want the fix to preserve existing behavior for components that depend on the current hook interface, so that no other features regress.

#### Acceptance Criteria

1. THE Payments_Trend_Hook SHALL continue to return the same `UsePaymentsTrendResult` interface shape (currentYearTrend, multiYearData, statistics)
2. THE Payments_Chart SHALL render without modification, receiving multi-year data through the existing props interface
3. WHEN the Payments_Trend_Hook receives a selectedProgramYear parameter, THE Payments_Trend_Hook SHALL use the selectedProgramYear as the current year for grouping and statistics

### Requirement 4: Data Fetching Efficiency

**User Story:** As a developer, I want to avoid redundant API calls when removing the aggregatedPaymentsTrend parameter, so that the page does not make unnecessary network requests.

#### Acceptance Criteria

1. WHEN the District_Detail_Page renders the Trends tab, THE District_Detail_Page SHALL NOT trigger additional API calls beyond what the Payments_Trend_Hook already makes internally via the District_Analytics_Hook
2. WHEN the Payments_Trend_Hook fetches data via the District_Analytics_Hook, THE Payments_Trend_Hook SHALL request a date range spanning from 2 program years before the current program year start through the effective end date
