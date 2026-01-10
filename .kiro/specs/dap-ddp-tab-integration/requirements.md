# Requirements Document

## Introduction

This specification defines the integration of Distinguished Area Program (DAP) and Distinguished Division Program (DDP) recognition data into the existing Divisions & Areas tab on the District Detail page. The backend recognition calculation module already exists; this spec covers the API endpoint, data flow, and UI enhancements needed to display recognition status to users.

## Glossary

- **DAP**: Distinguished Area Program - Toastmasters recognition program for Areas
- **DDP**: Distinguished Division Program - Toastmasters recognition program for Divisions
- **Recognition_Level**: One of NotDistinguished, Distinguished, Select, or Presidents (ordinal)
- **Eligibility**: Status indicating whether a unit can be evaluated for recognition (eligible, ineligible, unknown)
- **Paid_Club**: A club in good standing with Toastmasters International (dues paid, status "Active")
- **Paid_Area**: An Area not suspended due to unpaid clubs; operationally determined by having at least one paid club (since suspension data is not available from dashboard)
- **Distinguished_Percentage**: Percentage of distinguished units calculated against paid units only
- **Recognition_Badge**: Visual indicator showing the recognition level achieved
- **Division_Rankings_Component**: Existing table component displaying division performance metrics
- **Area_Performance_Component**: Existing chart component displaying area performance metrics
- **Recognition_API**: Backend endpoint providing DAP/DDP recognition data

## Requirements

### Requirement 1: Recognition API Endpoint

**User Story:** As a frontend developer, I want a dedicated API endpoint for recognition data, so that I can fetch DAP/DDP metrics independently from other analytics.

#### Acceptance Criteria

1. WHEN a client requests recognition data for a district, THE Recognition_API SHALL return division recognition data including all nested area recognition data
2. WHEN a client specifies a date parameter, THE Recognition_API SHALL calculate recognition based on snapshot data for that date
3. WHEN no date parameter is provided, THE Recognition_API SHALL use the current snapshot date
4. IF the requested district has no data, THEN THE Recognition_API SHALL return a 404 status with a descriptive error message
5. THE Recognition_API SHALL return recognition data conforming to the DivisionRecognition and AreaRecognition type schemas

### Requirement 2: Division Recognition Display

**User Story:** As a district leader, I want to see DDP recognition status for each division, so that I can track progress toward Distinguished Division goals.

#### Acceptance Criteria

1. WHEN displaying a division row, THE Division_Rankings_Component SHALL display a recognition badge indicating the division's recognition level
2. WHEN a division has recognition level "Presidents", THE Division_Rankings_Component SHALL display a gold badge with "President's Distinguished" text
3. WHEN a division has recognition level "Select", THE Division_Rankings_Component SHALL display a silver badge with "Select Distinguished" text
4. WHEN a division has recognition level "Distinguished", THE Division_Rankings_Component SHALL display a bronze badge with "Distinguished" text
5. WHEN a division has recognition level "NotDistinguished", THE Division_Rankings_Component SHALL display no recognition badge
6. WHEN hovering over a division row, THE Division_Rankings_Component SHALL display a tooltip showing paid areas percentage and distinguished areas percentage
7. THE Division_Rankings_Component SHALL display the paid areas percentage with a visual indicator showing progress toward the 85% threshold

### Requirement 3: Area Recognition Display

**User Story:** As an area director, I want to see DAP recognition status for each area, so that I can track progress toward Distinguished Area goals.

#### Acceptance Criteria

1. WHEN displaying an area, THE Area_Performance_Component SHALL display a recognition badge indicating the area's recognition level
2. WHEN an area has recognition level "Presidents", THE Area_Performance_Component SHALL display a gold badge with "President's Distinguished" text
3. WHEN an area has recognition level "Select", THE Area_Performance_Component SHALL display a silver badge with "Select Distinguished" text
4. WHEN an area has recognition level "Distinguished", THE Area_Performance_Component SHALL display a bronze badge with "Distinguished" text
5. WHEN an area has recognition level "NotDistinguished", THE Area_Performance_Component SHALL display no recognition badge
6. WHEN hovering over an area, THE Area_Performance_Component SHALL display a tooltip showing paid clubs percentage and distinguished clubs percentage
7. THE Area_Performance_Component SHALL display the paid clubs percentage with a visual indicator showing progress toward the 75% threshold

### Requirement 4: Eligibility Status Display

**User Story:** As a user, I want to understand why recognition cannot be determined, so that I know what data is missing.

#### Acceptance Criteria

1. WHEN eligibility is "unknown", THE System SHALL display an informational indicator explaining that club visit data is unavailable
2. WHEN eligibility is "unknown", THE System SHALL still display calculated recognition levels with a caveat that eligibility cannot be confirmed
3. WHEN hovering over the eligibility indicator, THE System SHALL display the eligibility reason from the API response
4. THE System SHALL use a consistent visual style for eligibility indicators across both division and area displays

### Requirement 5: Recognition Threshold Progress

**User Story:** As a district leader, I want to see progress toward recognition thresholds, so that I can identify areas needing attention.

#### Acceptance Criteria

1. WHEN displaying division metrics, THE Division_Rankings_Component SHALL show a progress bar for paid areas percentage toward the 85% threshold
2. WHEN displaying division metrics, THE Division_Rankings_Component SHALL show a progress bar for distinguished areas percentage toward the current level's threshold
3. WHEN displaying area metrics, THE Area_Performance_Component SHALL show a progress bar for paid clubs percentage toward the 75% threshold
4. WHEN displaying area metrics, THE Area_Performance_Component SHALL show a progress bar for distinguished clubs percentage toward the current level's threshold
5. WHEN a threshold is met, THE System SHALL display the progress bar in a success color (green)
6. WHEN a threshold is not met, THE System SHALL display the progress bar in a warning color (amber) or danger color (red) based on distance from threshold

### Requirement 6: Recognition Data Integration

**User Story:** As a developer, I want recognition data integrated with existing analytics hooks, so that components can access recognition data efficiently.

#### Acceptance Criteria

1. THE System SHALL provide a useRecognitionData hook that fetches recognition data for a district
2. WHEN recognition data is loading, THE System SHALL display loading skeletons in recognition-related UI areas
3. WHEN recognition data fails to load, THE System SHALL display an error state without breaking the rest of the analytics display
4. THE System SHALL cache recognition data with the same strategy as other analytics data (10 minute stale time)

### Requirement 7: Sorting and Filtering by Recognition

**User Story:** As a district leader, I want to sort and filter by recognition status, so that I can quickly identify high-performing and struggling units.

#### Acceptance Criteria

1. THE Division_Rankings_Component SHALL support sorting by recognition level (ordinal: NotDistinguished < Distinguished < Select < Presidents)
2. THE Division_Rankings_Component SHALL support filtering to show only divisions that have achieved a specific recognition level or higher
3. THE Area_Performance_Component SHALL support filtering areas by recognition level
4. WHEN sorting by recognition level, THE System SHALL use the ordinal ordering defined in the recognition level type

### Requirement 8: Accessibility Compliance

**User Story:** As a user with accessibility needs, I want recognition information to be accessible, so that I can understand recognition status using assistive technologies.

#### Acceptance Criteria

1. THE Recognition_Badge component SHALL include appropriate ARIA labels describing the recognition level
2. THE System SHALL ensure recognition badges meet WCAG AA contrast requirements (4.5:1 for text)
3. THE System SHALL provide text alternatives for all visual recognition indicators
4. THE System SHALL ensure tooltips are keyboard accessible
5. THE System SHALL ensure progress bars have appropriate ARIA attributes (role, aria-valuenow, aria-valuemin, aria-valuemax)
