# Requirements Document

## Introduction

This feature adds a new "Area Recognition" tab to the District page that displays the criteria required for an area to achieve Distinguished, Select Distinguished, and President's Distinguished status under the Toastmasters Distinguished Area Program (DAP). The tab provides educational content to help Area Directors understand the requirements and assess their current progress toward recognition.

## Glossary

- **Area**: A Toastmasters organizational unit consisting of multiple clubs, led by an Area Director
- **DAP**: Distinguished Area Program - Toastmasters recognition program for areas
- **Paid_Club**: A club in good standing with status "Active" (not "Suspended", "Ineligible", or "Low")
- **Distinguished_Club**: A club that has achieved Distinguished, Select Distinguished, President's Distinguished, or Smedley Distinguished status
- **Club_Base**: The number of clubs in an area at the start of the program year
- **Club_Visit**: An official Area Director Club Visit Report submitted for a club
- **Eligibility_Gate**: A prerequisite requirement that must be met before recognition levels can be evaluated (no net club loss + club visits)
- **No_Net_Club_Loss**: Requirement that paid clubs must be >= club base
- **Recognition_Level**: One of Distinguished Area, Select Distinguished Area, or President's Distinguished Area
- **Area_Recognition_Section**: A UI section within the Divisions & Areas tab displaying area recognition criteria and progress

## Requirements

### Requirement 1: Integration with Divisions & Areas Tab

**User Story:** As a district leader, I want to see area recognition criteria within the existing Divisions & Areas tab, so that I can view area performance and recognition requirements in one place.

#### Acceptance Criteria

1. WHEN a user views the Divisions & Areas tab, THE System SHALL display an Area Recognition section alongside existing content
2. THE Area_Recognition_Section SHALL be positioned logically within the existing tab layout
3. THE Area_Recognition_Section SHALL maintain consistent styling with existing components following Toastmasters brand guidelines

### Requirement 2: Eligibility Gate Display

**User Story:** As an Area Director, I want to understand the eligibility requirements for area recognition, so that I know what prerequisites must be met before my area can be considered.

#### Acceptance Criteria for Requirement 2

1. THE Criteria_Display SHALL show the eligibility gate requirements prominently at the top of the content
2. THE Criteria_Display SHALL explain that areas must have no net club loss (paid clubs >= club base)
3. THE Criteria_Display SHALL explain that 75% of club base must have first-round visits by Nov 30 and 75% must have second-round visits by May 31
4. THE Criteria_Display SHALL indicate that club visit data is not currently available from dashboard exports
5. WHEN club visit data is unavailable, THE System SHALL display eligibility status as "Unknown"

### Requirement 3: No Net Club Loss Requirement Display

**User Story:** As an Area Director, I want to understand the no net club loss requirement, so that I know my area must maintain or grow its club count.

#### Acceptance Criteria for Requirement 3

1. THE Criteria_Display SHALL show that paid clubs must be at least equal to club base (no net loss)
2. THE Criteria_Display SHALL explain what constitutes a "paid club" (Active status, dues current)
3. THE Criteria_Display SHALL explain what statuses disqualify a club from being "paid" (Suspended, Ineligible, Low)

### Requirement 4: Recognition Level Criteria Display

**User Story:** As an Area Director, I want to see the specific criteria for each recognition level, so that I understand what my area needs to achieve.

#### Acceptance Criteria for Requirement 4

1. THE Criteria_Display SHALL show Distinguished Area requires paid clubs >= club base AND at least 50% of club base to be distinguished
2. THE Criteria_Display SHALL show Select Distinguished Area requires paid clubs >= club base AND at least 50% of club base + 1 club to be distinguished
3. THE Criteria_Display SHALL show President's Distinguished Area requires paid clubs >= club base + 1 AND at least 50% of club base + 1 club to be distinguished
4. THE Criteria_Display SHALL clearly indicate that distinguished percentages are calculated against club base, not paid clubs
5. THE Criteria_Display SHALL present the three recognition levels in ascending order of achievement

### Requirement 5: Area Progress Display

**User Story:** As an Area Director, I want to see what my area has achieved and what remains to be done, so that I can take action to reach distinguished status.

#### Acceptance Criteria for Requirement 5

1. THE System SHALL display all areas in the district with their current progress
2. FOR EACH area, THE System SHALL display the current paid clubs count and club base count
3. FOR EACH area, THE System SHALL display the current distinguished clubs count
4. FOR EACH area, THE System SHALL calculate and display whether no net club loss requirement is met (paid clubs >= club base)
5. FOR EACH area, THE System SHALL calculate and display the distinguished clubs percentage achieved (of club base)
6. FOR EACH area, THE System SHALL indicate which recognition level the area currently qualifies for (if any)

### Requirement 6: Gap Analysis Display

**User Story:** As an Area Director, I want to see exactly what my area needs to achieve each recognition level, so that I can set clear goals and track progress.

#### Acceptance Criteria for Requirement 6

1. FOR EACH area, THE System SHALL calculate and display the number of additional paid clubs needed to meet the no net loss requirement (if not already met)
2. FOR EACH area, THE System SHALL calculate and display the number of additional distinguished clubs needed for Distinguished Area status (50% of club base)
3. FOR EACH area, THE System SHALL calculate and display the number of additional distinguished clubs needed for Select Distinguished Area status (50% of club base + 1)
4. FOR EACH area, THE System SHALL calculate and display the number of additional paid clubs AND distinguished clubs needed for President's Distinguished Area status (club base + 1 paid, 50% of club base + 1 distinguished)
5. WHEN an area has already achieved a recognition level, THE System SHALL indicate that level as "Achieved"
6. WHEN an area cannot achieve a recognition level due to net club loss, THE System SHALL indicate the no net loss requirement must be met first

### Requirement 7: Accessibility and Brand Compliance

**User Story:** As a user with accessibility needs, I want the criteria display to be accessible, so that I can understand the information regardless of how I access the application.

#### Acceptance Criteria for Requirement 7

1. THE Criteria_Display SHALL meet WCAG AA contrast requirements (4.5:1 for normal text, 3:1 for large text)
2. THE Criteria_Display SHALL use Toastmasters brand colors (TM Loyal Blue, TM True Maroon, TM Cool Gray)
3. THE Criteria_Display SHALL provide minimum 44px touch targets for interactive elements
4. THE Criteria_Display SHALL use semantic HTML with appropriate ARIA labels
5. THE Criteria_Display SHALL be keyboard navigable

### Requirement 8: Responsive Design

**User Story:** As a mobile user, I want the criteria display to work well on my device, so that I can access the information anywhere.

#### Acceptance Criteria for Requirement 8

1. THE Criteria_Display SHALL adapt layout for mobile, tablet, and desktop viewports
2. THE Criteria_Display SHALL maintain readability with minimum 14px font size for body text
3. THE Criteria_Display SHALL use appropriate spacing and padding for touch interaction on mobile devices
