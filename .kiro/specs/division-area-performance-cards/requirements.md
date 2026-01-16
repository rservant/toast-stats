# Requirements Document

## Introduction

The Division and Area Performance Cards feature provides district leaders with a comprehensive view of division and area progress toward Distinguished, Select Distinguished, and President's Distinguished status. This feature displays performance metrics, visit completion status, and qualifying criteria in an accessible, scannable format on the District Detail Page.

## Glossary

- **District_Detail_Page**: The existing page that displays comprehensive information about a specific Toastmasters district
- **Division**: A geographic subdivision of a district containing multiple areas
- **Area**: A geographic subdivision of a division containing multiple clubs
- **Club_Base**: The number of clubs that existed in a division or area at the start of the program year
- **Paid_Clubs**: The current number of clubs that have met membership payment requirements
- **Distinguished_Club**: A club that has achieved Distinguished status according to Toastmasters criteria
- **Net_Growth**: The difference between current paid clubs and club base (can be positive, negative, or zero)
- **Area_Visit**: A formal visit by an area director to a club, recorded in district snapshot data
- **First_Round_Visit**: Area visits completed in the first half of the program year (tracked as "Nov Visit award")
- **Second_Round_Visit**: Area visits completed in the second half of the program year (tracked as "May visit award")
- **District_Snapshot**: JSON data structure containing current district, division, area, and club information
- **Performance_Card**: A visual component displaying division-level summary and area-level details
- **Qualifying_Requirement**: Criteria that must be met before an area can achieve any distinguished status level

## Requirements

### Requirement 1: Display Division Performance Cards

**User Story:** As a district leader, I want to see performance cards for all divisions on the District Detail Page, so that I can quickly assess division progress toward distinguished status.

#### Acceptance Criteria

1. WHEN a user views the District Detail Page, THE System SHALL display one performance card for each division in the district
2. THE System SHALL display all division performance cards simultaneously on the same page
3. WHEN rendering division performance cards, THE System SHALL order them by division identifier
4. THE System SHALL retrieve division and area data from the district snapshot JSON

### Requirement 2: Calculate Division Status

**User Story:** As a district leader, I want to see each division's current distinguished status level, so that I can identify which divisions need support.

#### Acceptance Criteria

1. WHEN calculating division status, THE System SHALL determine the distinguished club threshold as 50% of the division's club base (rounded up)
2. WHEN a division has distinguished clubs ≥ 45% of club base AND paid clubs ≥ club base, THE System SHALL classify it as Distinguished
3. WHEN a division has distinguished clubs ≥ 50% of club base AND paid clubs show net growth ≥ 1, THE System SHALL classify it as Select Distinguished
4. WHEN a division has distinguished clubs ≥ 55% of club base AND paid clubs show net growth ≥ 2, THE System SHALL classify it as President's Distinguished
5. WHEN a division does not meet Distinguished criteria, THE System SHALL classify it as Not Distinguished
6. THE System SHALL calculate net growth as (current paid clubs - club base)

### Requirement 3: Display Division Summary Section

**User Story:** As a district leader, I want to see a summary of each division's performance at the top of its card, so that I can quickly understand its status without examining details.

#### Acceptance Criteria

1. THE Division_Summary_Section SHALL display the division identifier
2. THE Division_Summary_Section SHALL display the current distinguished status level (Not Distinguished, Distinguished, Select Distinguished, or President's Distinguished)
3. THE Division_Summary_Section SHALL display paid clubs progress as "current / base" with net growth indicator
4. THE Division_Summary_Section SHALL display distinguished clubs progress as "current / required threshold"
5. WHEN displaying the division summary, THE System SHALL use visual indicators (colors, icons) to communicate status at a glance

### Requirement 4: Calculate Area Qualifying Requirements

**User Story:** As a district leader, I want to see which areas meet qualifying requirements, so that I can identify areas that need immediate attention.

#### Acceptance Criteria

1. WHEN calculating area qualifying status, THE System SHALL verify that paid clubs ≥ club base (no net club loss)
2. WHEN calculating area qualifying status, THE System SHALL verify that first round visit reports are submitted for ≥ 75% of club base
3. WHEN calculating area qualifying status, THE System SHALL verify that second round visit reports are submitted for ≥ 75% of club base
4. WHEN an area meets all three qualifying criteria, THE System SHALL mark it as qualified for distinguished status
5. WHEN an area fails any qualifying criterion, THE System SHALL mark it as not qualified and prevent distinguished status classification

### Requirement 5: Calculate Area Distinguished Status

**User Story:** As a district leader, I want to see each area's distinguished status level, so that I can recognize high-performing areas and support struggling ones.

#### Acceptance Criteria

1. WHEN an area does not meet qualifying requirements, THE System SHALL classify it as Not Qualified regardless of other metrics
2. WHEN a qualified area has distinguished clubs ≥ 50% of club base AND paid clubs ≥ club base, THE System SHALL classify it as Distinguished
3. WHEN a qualified area has distinguished clubs ≥ (50% of club base + 1) AND paid clubs ≥ club base, THE System SHALL classify it as Select Distinguished
4. WHEN a qualified area has distinguished clubs ≥ (50% of club base + 1) AND paid clubs show net growth ≥ 1, THE System SHALL classify it as President's Distinguished
5. THE System SHALL calculate the distinguished club threshold as 50% of the area's club base (rounded up)

### Requirement 6: Display Area Performance Table

**User Story:** As a district leader, I want to see detailed performance data for all areas within each division, so that I can drill down into specific area challenges.

#### Acceptance Criteria

1. THE Area_Performance_Table SHALL display one row for each area in the division
2. THE Area_Performance_Table SHALL display the area identifier in each row
3. THE Area_Performance_Table SHALL display paid clubs as "current / base" with net growth indicator
4. THE Area_Performance_Table SHALL display distinguished clubs as "current / required threshold"
5. THE Area_Performance_Table SHALL display first round visit completion status
6. THE Area_Performance_Table SHALL display second round visit completion status
7. THE Area_Performance_Table SHALL display the current status level (Not Qualified, Distinguished, Select Distinguished, or President's Distinguished)
8. WHEN rendering the area table, THE System SHALL order areas by area identifier

### Requirement 7: Retrieve Area Visit Data

**User Story:** As a district leader, I want to see area visit completion status, so that I can ensure area directors are fulfilling their visit requirements.

#### Acceptance Criteria

1. WHEN retrieving first round visit data, THE System SHALL extract "Nov Visit award" information from the district snapshot JSON
2. WHEN retrieving second round visit data, THE System SHALL extract "May visit award" information from the district snapshot JSON
3. THE System SHALL calculate visit completion percentage as (completed visits / club base) × 100
4. WHEN displaying visit status, THE System SHALL indicate whether the 75% threshold is met
5. WHEN visit data is unavailable for a round, THE System SHALL display an appropriate indicator

### Requirement 8: Apply Brand Compliance

**User Story:** As a district leader, I want the performance cards to follow Toastmasters brand guidelines, so that the application maintains visual consistency and professionalism.

#### Acceptance Criteria

1. THE System SHALL use TM Loyal Blue (#004165) for primary elements including headers and navigation
2. THE System SHALL use brand-approved colors from the Toastmasters palette for status indicators
3. THE System SHALL use Montserrat font for headings and labels
4. THE System SHALL use Source Sans 3 font for body text and table content
5. THE System SHALL maintain minimum 14px font size for all text content
6. THE System SHALL ensure minimum 4.5:1 contrast ratio for normal text (WCAG AA compliance)
7. THE System SHALL ensure minimum 44px touch targets for interactive elements

### Requirement 9: Ensure Responsive Design

**User Story:** As a district leader using a mobile device, I want the performance cards to display properly on small screens, so that I can review division performance anywhere.

#### Acceptance Criteria

1. WHEN the viewport width is below tablet breakpoint, THE System SHALL adapt the card layout for mobile viewing
2. WHEN displaying on mobile, THE System SHALL maintain readability of all performance metrics
3. WHEN displaying on mobile, THE System SHALL ensure table content remains accessible through horizontal scrolling or responsive table patterns
4. THE System SHALL maintain minimum touch target sizes on all screen sizes

### Requirement 10: Update with New Snapshot Data

**User Story:** As a district leader, I want the performance cards to reflect the latest data, so that I'm making decisions based on current information.

#### Acceptance Criteria

1. WHEN new district snapshot data becomes available, THE System SHALL recalculate all division and area status classifications
2. WHEN new district snapshot data becomes available, THE System SHALL update all displayed metrics
3. THE System SHALL display the timestamp of the current snapshot data
4. WHEN snapshot data is being refreshed, THE System SHALL indicate loading state to the user
