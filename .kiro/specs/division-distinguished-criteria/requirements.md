# Requirements Document

## Introduction

This feature adds Division recognition criteria and progress display to the existing Division Performance Cards on the District page. The feature displays the criteria required for a division to achieve Distinguished, Select Distinguished, and President's Distinguished status under the Toastmasters Distinguished Division Program (DDP). It provides educational content to help Division Directors understand the requirements and assess their current progress toward recognition.

## Glossary

- **Division**: A Toastmasters organizational unit consisting of multiple areas, led by a Division Director
- **DDP**: Distinguished Division Program - Toastmasters recognition program for divisions
- **Paid_Club**: A club in good standing with status "Active" (not "Suspended", "Ineligible", or "Low")
- **Distinguished_Club**: A club that has achieved Distinguished, Select Distinguished, President's Distinguished, or Smedley Distinguished status
- **Club_Base**: The number of clubs in a division at the start of the program year
- **Eligibility_Gate**: A prerequisite requirement that must be met before recognition levels can be evaluated (no net club loss)
- **No_Net_Club_Loss**: Requirement that paid clubs must be >= club base
- **Recognition_Level**: One of Distinguished Division, Select Distinguished Division, or President's Distinguished Division
- **Division_Recognition_Panel**: A UI section displaying division recognition criteria and progress

## Requirements

### Requirement 1: Integration with Division Performance Cards

**User Story:** As a district leader, I want to see division recognition criteria within the existing Division Performance Cards, so that I can view division performance and recognition requirements in one place.

#### Acceptance Criteria

1. WHEN a user views the Divisions & Areas tab, THE System SHALL display division recognition information within each Division Performance Card
2. THE Division_Recognition_Panel SHALL be positioned logically within the existing Division Performance Card layout
3. THE Division_Recognition_Panel SHALL maintain consistent styling with existing components following Toastmasters brand guidelines

### Requirement 2: Eligibility Gate Display

**User Story:** As a Division Director, I want to understand the eligibility requirements for division recognition, so that I know what prerequisites must be met before my division can be considered.

#### Acceptance Criteria

1. THE Criteria_Display SHALL show the eligibility gate requirement prominently
2. THE Criteria_Display SHALL explain that divisions must have no net club loss (paid clubs >= club base)
3. WHEN a division has net club loss, THE System SHALL display eligibility status as "Net Loss" with appropriate visual indicator

### Requirement 3: No Net Club Loss Requirement Display

**User Story:** As a Division Director, I want to understand the no net club loss requirement, so that I know my division must maintain or grow its club count.

#### Acceptance Criteria

1. THE Criteria_Display SHALL show that paid clubs must be at least equal to club base (no net loss)
2. THE Criteria_Display SHALL explain what constitutes a "paid club" (Active status, dues current)
3. THE Criteria_Display SHALL explain what statuses disqualify a club from being "paid" (Suspended, Ineligible, Low)

### Requirement 4: Recognition Level Criteria Display

**User Story:** As a Division Director, I want to see the specific criteria for each recognition level, so that I understand what my division needs to achieve.

#### Acceptance Criteria

1. THE Criteria_Display SHALL show Distinguished Division requires paid clubs >= club base AND at least 45% of club base to be distinguished
2. THE Criteria_Display SHALL show Select Distinguished Division requires paid clubs >= club base + 1 AND at least 50% of club base to be distinguished
3. THE Criteria_Display SHALL show President's Distinguished Division requires paid clubs >= club base + 2 AND at least 55% of club base to be distinguished
4. THE Criteria_Display SHALL clearly indicate that distinguished percentages are calculated against club base, not paid clubs
5. THE Criteria_Display SHALL present the three recognition levels in ascending order of achievement

### Requirement 5: Division Progress Display

**User Story:** As a Division Director, I want to see what my division has achieved and what remains to be done in a clear, readable format, so that I can take action to reach distinguished status.

#### Acceptance Criteria

1. THE System SHALL display all divisions in the district with their current progress as concise English paragraphs
2. FOR EACH division, THE System SHALL describe the current recognition level achieved (or that it's not yet distinguished)
3. FOR EACH division, THE System SHALL describe what's needed to reach the next achievable level
4. FOR EACH division, THE System SHALL describe the incremental differences for higher levels (building on previous requirements, not repeating them)
5. FOR EACH division, THE System SHALL indicate which recognition level the division currently qualifies for (if any)

### Requirement 6: Gap Analysis Display

**User Story:** As a Division Director, I want to see exactly what my division needs to achieve each recognition level in plain English, so that I can set clear goals and track progress.

#### Acceptance Criteria

1. FOR EACH division with net club loss, THE System SHALL first explain the eligibility requirement (paid clubs needed to meet club base)
2. FOR EACH division, THE System SHALL describe the distinguished clubs needed for Distinguished Division status (45% of club base)
3. FOR EACH division, THE System SHALL describe the additional distinguished clubs needed for Select Distinguished Division status (only the increment beyond Distinguished, plus 1 paid club)
4. FOR EACH division, THE System SHALL describe the additional paid clubs and distinguished clubs needed for President's Distinguished Division status (only the increment beyond Select)
5. WHEN a division has already achieved a recognition level, THE System SHALL clearly state the achievement
6. WHEN a division has achieved President's Distinguished, THE System SHALL not mention any further gaps
7. THE gap descriptions SHALL build incrementally (e.g., "For Select Distinguished, 1 more club needs to become distinguished and add 1 paid club. For President's Distinguished, 1 more distinguished club and 1 more paid club.")

### Requirement 7: Accessibility and Brand Compliance

**User Story:** As a user with accessibility needs, I want the criteria display to be accessible, so that I can understand the information regardless of how I access the application.

#### Acceptance Criteria

1. THE Criteria_Display SHALL meet WCAG AA contrast requirements (4.5:1 for normal text, 3:1 for large text)
2. THE Criteria_Display SHALL use Toastmasters brand colors (TM Loyal Blue, TM True Maroon, TM Cool Gray)
3. THE Criteria_Display SHALL provide minimum 44px touch targets for interactive elements
4. THE Criteria_Display SHALL use semantic HTML with appropriate ARIA labels
5. THE Criteria_Display SHALL be keyboard navigable

### Requirement 8: Responsive Design

**User Story:** As a mobile user, I want the criteria display to work well on my device, so that I can access the information anywhere.

#### Acceptance Criteria

1. THE Criteria_Display SHALL adapt layout for mobile, tablet, and desktop viewports
2. THE Criteria_Display SHALL maintain readability with minimum 14px font size for body text
3. THE Criteria_Display SHALL use appropriate spacing and padding for touch interaction on mobile devices

### Requirement 9: Enhanced DivisionSummary Component

**User Story:** As a district leader, I want division recognition metrics integrated into the existing DivisionSummary component, so that all division information is consolidated in one place.

#### Acceptance Criteria

1. THE DivisionSummary component SHALL display a recognition badge indicating the current recognition level (Distinguished, Select Distinguished, President's Distinguished, Not Distinguished, or Net Loss)
2. THE DivisionSummary component SHALL display Gap to D (distinguished clubs needed for Distinguished Division)
3. THE DivisionSummary component SHALL display Gap to S (distinguished clubs and paid clubs needed for Select Distinguished Division)
4. THE DivisionSummary component SHALL display Gap to P (distinguished clubs and paid clubs needed for President's Distinguished Division)
5. THE gap indicators SHALL show "✓" when a level is achieved
6. THE gap indicators SHALL show the number of clubs needed when a level is not achieved
7. WHEN a division has net club loss, THE gap indicators SHALL indicate the level is not achievable until eligibility is met

### Requirement 10: Augment Area Recognition Panel to Division and Area Recognition

**User Story:** As a district leader, I want to see both division and area recognition information in a unified panel, so that I can understand the complete recognition picture for my district.

#### Acceptance Criteria

1. THE System SHALL rename the existing AreaRecognitionPanel to DivisionAreaRecognitionPanel
2. THE System SHALL rename the section header from "Area Recognition" to "Division and Area Recognition"
3. THE DivisionAreaRecognitionPanel SHALL include a DivisionCriteriaExplanation component explaining DDP eligibility and recognition criteria
4. THE DivisionAreaRecognitionPanel SHALL include the existing CriteriaExplanation component for DAP (renamed or reorganized as needed)
5. THE System SHALL augment the existing AreaProgressSummary to include division progress narratives
6. THE division progress narratives SHALL appear before the area progress narratives within each division grouping
7. THE System SHALL update all references from "Area Recognition" to "Division and Area Recognition" throughout the UI

### Requirement 11: Unified Progress Summary

**User Story:** As a district leader, I want to see division and area progress narratives together, so that I can understand how divisions and their areas are progressing toward recognition.

#### Acceptance Criteria

1. THE ProgressSummary component SHALL display division progress narratives grouped by division
2. FOR EACH division, THE System SHALL first display the division's progress narrative
3. FOR EACH division, THE System SHALL then display the area progress narratives for all areas within that division
4. THE division narratives SHALL use the same paragraph-based format as area narratives
5. THE division narratives SHALL be visually distinguished from area narratives (e.g., different heading level, indentation, or styling)
