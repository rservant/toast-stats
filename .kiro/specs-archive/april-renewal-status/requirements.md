# Requirements Document

## Introduction

This feature adds membership payment tracking columns to the Clubs tab in the frontend. Tracking October renewals, April renewals, and new member counts provides district leaders with a comprehensive view of club membership activity throughout the program year. These metrics help identify clubs with strong retention, active recruitment, or those needing attention.

The membership payment data will be displayed as new columns in the ClubsTable component, allowing users to filter, sort, and quickly identify clubs based on their membership payment activity.

## Glossary

- **ClubsTable**: The React component that displays all clubs in a district with filtering and sorting capabilities
- **October_Renewals**: The count of members in a club who have submitted their October membership renewal dues (derived from `Oct. Ren` field in dashboard CSV)
- **April_Renewals**: The count of members in a club who have submitted their April membership renewal dues (derived from `Apr. Ren` field in dashboard CSV)
- **New_Members**: The count of new members who have joined and paid dues for a club (derived from `New Members` field in dashboard CSV)
- **ClubTrend**: The data structure containing club performance metrics used by the frontend analytics

## Requirements

### Requirement 1: Display October Renewals Column

**User Story:** As a district leader, I want to see the count of October renewals for each club in the clubs table, so that I can monitor first-half membership retention.

#### Acceptance Criteria

1. WHEN the ClubsTable renders, THE ClubsTable SHALL display an "Oct Ren" column showing the count of members who submitted October renewal dues for each club
2. WHEN a club has one or more October renewals, THE ClubsTable SHALL display the numeric count
3. WHEN a club has zero October renewals, THE ClubsTable SHALL display "0"
4. WHEN October renewal data is unavailable for a club, THE ClubsTable SHALL display a dash (—)

### Requirement 2: Display April Renewals Column

**User Story:** As a district leader, I want to see the count of April renewals for each club in the clubs table, so that I can monitor second-half membership retention.

#### Acceptance Criteria

1. WHEN the ClubsTable renders, THE ClubsTable SHALL display an "Apr Ren" column showing the count of members who submitted April renewal dues for each club
2. WHEN a club has one or more April renewals, THE ClubsTable SHALL display the numeric count
3. WHEN a club has zero April renewals, THE ClubsTable SHALL display "0"
4. WHEN April renewal data is unavailable for a club, THE ClubsTable SHALL display a dash (—)

### Requirement 3: Display New Members Column

**User Story:** As a district leader, I want to see the count of new members for each club in the clubs table, so that I can identify clubs with strong recruitment.

#### Acceptance Criteria

1. WHEN the ClubsTable renders, THE ClubsTable SHALL display a "New" column showing the count of new members who have joined each club
2. WHEN a club has one or more new members, THE ClubsTable SHALL display the numeric count
3. WHEN a club has zero new members, THE ClubsTable SHALL display "0"
4. WHEN new member data is unavailable for a club, THE ClubsTable SHALL display a dash (—)

### Requirement 4: Filter by Membership Payment Counts

**User Story:** As a district leader, I want to filter clubs by their membership payment counts, so that I can focus on clubs with specific activity levels.

#### Acceptance Criteria

1. WHEN a user clicks any membership payment column header filter, THE ClubsTable SHALL display a numeric range filter
2. WHEN a user sets a minimum value, THE ClubsTable SHALL display only clubs with counts greater than or equal to that value
3. WHEN a user sets a maximum value, THE ClubsTable SHALL display only clubs with counts less than or equal to that value
4. WHEN a user clears the filter, THE ClubsTable SHALL display all clubs regardless of that payment count

### Requirement 5: Sort by Membership Payment Counts

**User Story:** As a district leader, I want to sort clubs by their membership payment counts, so that I can identify clubs with the most or fewest payments in each category.

#### Acceptance Criteria

1. WHEN a user clicks any membership payment column header, THE ClubsTable SHALL sort clubs by that payment count
2. WHEN sorting in ascending order, THE ClubsTable SHALL display clubs with fewer payments first
3. WHEN sorting in descending order, THE ClubsTable SHALL display clubs with more payments first
4. WHEN clubs have the same payment count, THE ClubsTable SHALL maintain secondary sort by club name

### Requirement 6: Export Membership Payment Data

**User Story:** As a district leader, I want to export club data including all membership payment counts, so that I can share the information with area and division directors.

#### Acceptance Criteria

1. WHEN a user exports club data to CSV, THE Export_Function SHALL include Oct Ren, Apr Ren, and New columns
2. WHEN exporting, THE Export_Function SHALL represent all payment counts as numeric values
3. WHEN payment data is unavailable, THE Export_Function SHALL export an empty value

### Requirement 7: Visual Styling for Membership Payments

**User Story:** As a district leader, I want clear visual indication of membership payment activity, so that I can quickly scan the table and identify clubs needing attention.

#### Acceptance Criteria

1. WHEN displaying membership payment counts, THE ClubsTable SHALL use consistent numeric formatting
2. WHEN a club has zero in any payment category, THE ClubsTable SHALL optionally highlight this with an attention-drawing style (e.g., muted text)
3. THE visual styling SHALL comply with Toastmasters brand guidelines and WCAG AA accessibility standards
4. THE visual styling SHALL have sufficient contrast ratio (minimum 4.5:1 for text)

### Requirement 8: Data Integration

**User Story:** As a system, I want to retrieve membership payment counts from the backend analytics data, so that the frontend can display accurate and current information.

#### Acceptance Criteria

1. WHEN the backend provides club performance data, THE ClubTrend interface SHALL include octoberRenewals, aprilRenewals, and newMembers fields of type number
2. WHEN a payment field is a positive number, THE System SHALL display that count
3. WHEN a payment field is zero, THE System SHALL display "0"
4. WHEN a payment field is undefined or null, THE System SHALL interpret this as data unavailable
5. THE octoberRenewals field SHALL be derived from the "Oct. Ren" field in the Toastmasters dashboard CSV data
6. THE aprilRenewals field SHALL be derived from the "Apr. Ren" field in the Toastmasters dashboard CSV data
7. THE newMembers field SHALL be derived from the "New Members" field in the Toastmasters dashboard CSV data
