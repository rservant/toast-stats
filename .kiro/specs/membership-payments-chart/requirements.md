# Requirements Document

## Introduction

This feature adds a Membership Payments Tracking Chart to the District Membership Trend card's Trends tab. The chart displays YTD (Year-to-Date) membership payment data over time and compares the current program year against the previous two years. This enables district leaders to visualize payment trends, identify seasonal patterns, and compare year-over-year performance for membership payments.

## Glossary

- **Membership_Payments_Chart**: A line chart component that displays YTD membership payment data over time with multi-year comparison
- **YTD_Payments**: Year-to-date total membership payments for a district, sourced from the Toastmasters dashboard "Total YTD Payments" field
- **Program_Year**: The Toastmasters fiscal year running from July 1 to June 30
- **Year_Over_Year_Comparison**: A visual comparison of payment data across multiple program years aligned by relative date within the program year
- **Payment_Trend**: Time-series data showing YTD payment counts at each snapshot date
- **District_Ranking**: The existing data structure containing district-level metrics including totalPayments and paymentBase

## Requirements

### Requirement 1: Display Membership Payments Chart

**User Story:** As a district leader, I want to see a chart of YTD membership payments over time, so that I can track payment trends throughout the program year.

#### Acceptance Criteria

1. WHEN the Trends tab is displayed, THE Membership_Payments_Chart SHALL render below the existing Total Membership graph
2. THE Membership_Payments_Chart SHALL display a line chart with time on the X-axis and YTD payment count on the Y-axis
3. WHEN payment data is available, THE Membership_Payments_Chart SHALL show the YTD payments trend line for the current program year
4. WHEN hovering over a data point, THE Membership_Payments_Chart SHALL display a tooltip showing the date and YTD payment count

### Requirement 2: Multi-Year Comparison

**User Story:** As a district leader, I want to compare current year payments against the previous two years, so that I can identify trends and assess performance relative to historical data.

#### Acceptance Criteria

1. WHEN historical data is available, THE Membership_Payments_Chart SHALL display up to three program years of data
2. THE Membership_Payments_Chart SHALL align data by relative position within the program year (days since July 1) for accurate comparison
3. THE Membership_Payments_Chart SHALL visually distinguish each year's data using different line styles or colors
4. WHEN fewer than three years of data are available, THE Membership_Payments_Chart SHALL display only the available years
5. THE Membership_Payments_Chart SHALL include a legend identifying each year's data series

### Requirement 3: Payment Data Source

**User Story:** As a district leader, I want to see accurate district-level YTD payment totals, so that I can understand overall payment performance.

#### Acceptance Criteria

1. THE System SHALL retrieve YTD payment data from the District_Ranking totalPayments field
2. THE System SHALL build a payment trend from historical snapshots within the date range
3. IF payment data is unavailable for a snapshot, THEN THE System SHALL exclude that data point from the trend

### Requirement 4: Loading and Empty States

**User Story:** As a user, I want clear feedback when data is loading or unavailable, so that I understand the current state of the chart.

#### Acceptance Criteria

1. WHILE payment data is loading, THE Membership_Payments_Chart SHALL display a loading skeleton
2. WHEN no payment data is available, THE Membership_Payments_Chart SHALL display an empty state with an explanatory message
3. WHEN only partial year data is available, THE Membership_Payments_Chart SHALL display the available data with appropriate messaging

### Requirement 5: Visual Design and Accessibility

**User Story:** As a user, I want the chart to follow brand guidelines and be accessible, so that I can easily read and understand the data.

#### Acceptance Criteria

1. THE Membership_Payments_Chart SHALL use Toastmasters brand colors for chart elements
2. THE Membership_Payments_Chart SHALL meet WCAG AA contrast requirements for all text and data elements
3. THE Membership_Payments_Chart SHALL include appropriate ARIA labels for screen reader accessibility
4. THE Membership_Payments_Chart SHALL be responsive and display correctly on mobile devices
5. THE Membership_Payments_Chart SHALL use the same styling patterns as the existing MembershipTrendChart component

### Requirement 6: Statistics Summary

**User Story:** As a district leader, I want to see key payment statistics at a glance, so that I can quickly assess payment performance.

#### Acceptance Criteria

1. THE Membership_Payments_Chart SHALL display summary statistics including current YTD payments
2. THE Membership_Payments_Chart SHALL show year-over-year change in YTD payments when historical data is available
3. THE Membership_Payments_Chart SHALL display the payment base value when available
4. WHEN year-over-year data is available, THE Membership_Payments_Chart SHALL indicate whether payments are trending up or down compared to the same point in the previous year

### Requirement 7: Historical Data Fetching

**User Story:** As a district leader, I want the chart to automatically fetch historical data for comparison, so that I can see year-over-year trends without manual configuration.

#### Acceptance Criteria

1. THE usePaymentsTrend hook SHALL fetch payment data for the current program year plus the previous 2 years (3 years total)
2. THE usePaymentsTrend hook SHALL NOT be constrained by the selected program year filter when fetching historical data
3. THE System SHALL filter and display only the relevant years after fetching, respecting the selected program year context for the current year display
4. WHEN the selected program year changes, THE chart SHALL still show historical comparison data from previous years
