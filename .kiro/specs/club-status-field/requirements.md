# Requirements Document

## Introduction

This feature adds support for surfacing the "Club Status" field from the Toastmasters dashboard club-performance.csv data. The club status indicates whether a club is Active, Suspended, Ineligible, or Low (membership below threshold). This field will be displayed in the ClubsTable component with full sorting and filtering capabilities, enabling district leaders to quickly identify and filter clubs by their operational status.

## Glossary

- **Club_Status**: The operational status of a Toastmasters club as reported by the Toastmasters International dashboard. Valid values include "Active", "Suspended", "Ineligible", and "Low".
- **ClubTrend**: The frontend data structure representing a club's performance data including membership trends, DCP goals, and health status.
- **ClubPerformanceRecord**: The backend type representing raw CSV data from the club-performance.csv file.
- **ClubsTable**: The React component that displays a sortable and filterable table of all clubs in a district.
- **Column_Filter**: A UI mechanism allowing users to filter table data by specific column values.
- **Categorical_Filter**: A filter type that allows selection from a predefined set of values.

## Requirements

### Requirement 1: Parse Club Status from CSV Data

**User Story:** As a system, I want to parse the club status field from CSV data, so that the status information is available for display and analysis.

#### Acceptance Criteria

1. WHEN the backend parses club-performance.csv data, THE ClubPerformanceRecord type SHALL include an optional "Club Status" field
2. WHEN extracting club data from CSV records, THE ClubHealthAnalyticsModule SHALL read the "Club Status" field value
3. IF the "Club Status" field is missing or empty, THEN THE System SHALL treat the value as undefined
4. WHEN the "Club Status" field contains a value, THE System SHALL preserve the exact string value from the CSV

### Requirement 2: Expose Club Status in ClubTrend Interface

**User Story:** As a frontend developer, I want the club status available in the ClubTrend interface, so that I can display it in the UI.

#### Acceptance Criteria

1. THE ClubTrend interface SHALL include an optional "clubStatus" field of type string
2. WHEN the ClubHealthAnalyticsModule builds ClubTrend objects, THE System SHALL populate the clubStatus field from the parsed CSV data
3. WHEN clubStatus is undefined, THE System SHALL not include the field in the ClubTrend object (optional field behavior)

### Requirement 3: Display Club Status Column in ClubsTable

**User Story:** As a district leader, I want to see the club status in the clubs table, so that I can quickly identify clubs with operational issues.

#### Acceptance Criteria

1. THE ClubsTable component SHALL display a "Club Status" column
2. WHEN a club has a defined clubStatus value, THE System SHALL display the status value in the column
3. WHEN a club has an undefined clubStatus value, THE System SHALL display a dash ("—") placeholder
4. THE Club Status column SHALL be positioned after the "Status" (health status) column in the table

### Requirement 4: Enable Sorting by Club Status

**User Story:** As a district leader, I want to sort clubs by their status, so that I can group clubs with similar operational states together.

#### Acceptance Criteria

1. THE Club Status column header SHALL be sortable
2. WHEN sorting by Club Status in ascending order, THE System SHALL sort alphabetically (Active, Ineligible, Low, Suspended)
3. WHEN sorting by Club Status in descending order, THE System SHALL sort reverse alphabetically
4. WHEN clubs have undefined clubStatus values, THE System SHALL sort them to the end regardless of sort direction

### Requirement 5: Enable Filtering by Club Status

**User Story:** As a district leader, I want to filter clubs by their status, so that I can focus on clubs that need attention.

#### Acceptance Criteria

1. THE Club Status column SHALL support categorical filtering
2. THE categorical filter SHALL include options for all known status values: "Active", "Suspended", "Ineligible", "Low"
3. WHEN a user selects one or more status values, THE System SHALL display only clubs matching the selected values
4. WHEN no filter values are selected, THE System SHALL display all clubs
5. WHEN filtering is active, THE System SHALL update the results count to reflect filtered results

### Requirement 6: Include Club Status in CSV Export

**User Story:** As a district leader, I want the club status included in CSV exports, so that I can analyze club data offline.

#### Acceptance Criteria

1. WHEN exporting club data to CSV, THE System SHALL include a "Club Status" column
2. THE exported Club Status column SHALL contain the clubStatus value or empty string for undefined values

### Requirement 7: Display Club Status Badge in Club Detail Modal

**User Story:** As a district leader, I want to see the club status prominently displayed in the club detail view, so that I can quickly understand a club's operational state.

#### Acceptance Criteria

1. THE ClubDetailModal component SHALL display a Club Status badge when clubStatus is defined
2. WHEN clubStatus is "Active", THE badge SHALL use a green color scheme (success styling)
3. WHEN clubStatus is "Suspended", THE badge SHALL use a red color scheme (error styling)
4. WHEN clubStatus is "Ineligible" or "Low", THE badge SHALL use a yellow/amber color scheme (warning styling)
5. WHEN clubStatus is undefined, THE System SHALL not display a Club Status badge
6. THE Club Status badge SHALL be positioned near the health status badge for visual grouping
