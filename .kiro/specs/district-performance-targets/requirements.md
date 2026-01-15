# Requirements Document

## Introduction

This feature enhances the District Overview page by integrating performance targets and rankings into the existing metric cards. The "Total Clubs" card becomes a Paid Clubs card with targets, the "Total Membership" card becomes a Membership Payments card with targets, and the "Distinguished Clubs" card is enhanced with distinguished clubs targets. Each card displays progress against recognition level targets (Distinguished, Select, President's, Smedley) along with world rank, world percentile, and region rank. The existing "Projected Year-End" card will be removed. Existing sub-information (club health badges, distinguished level badges) will be retained.

## Glossary

- **District_Overview**: The main dashboard component displaying district-level statistics and performance metrics
- **Paid_Clubs**: Count of clubs in good standing (Active status with current dues)
- **Membership_Payments**: Total count of membership payments (New + April + October + Late + Charter payments, or Total YTD Payments)
- **Distinguished_Clubs**: Count of clubs achieving any Distinguished level (Distinguished, Select, President's, or Smedley)
- **Club_Base**: The starting number of paid clubs for the district at program year start (from "Paid Club Base" CSV column)
- **Payment_Base**: The starting payment count for the district at program year start (from "Payment Base" CSV column)
- **Recognition_Level**: One of Base, Distinguished, Select, President's, or Smedley achievement tiers
- **World_Rank**: The district's rank among all districts worldwide for a given metric (1 = best)
- **Region_Rank**: The district's rank among districts in the same region for a given metric (1 = best)
- **World_Percentile**: The percentage of districts that the current district outperforms worldwide (higher = better)
- **Target_Calculator**: The service that computes recognition level targets based on base values and percentage thresholds

## Requirements

### Requirement 1: Calculate Paid Clubs Targets

**User Story:** As a district leader, I want to see my paid clubs count against recognition level targets, so that I can track progress toward each distinguished district level.

#### Acceptance Criteria

1. THE Target_Calculator SHALL compute paid clubs targets using the Club_Base value from the district data
2. WHEN calculating Distinguished target, THE Target_Calculator SHALL compute Club_Base + 1% of Club_Base, rounded up to the nearest integer
3. WHEN calculating Select target, THE Target_Calculator SHALL compute Club_Base + 3% of Club_Base, rounded up to the nearest integer
4. WHEN calculating President's target, THE Target_Calculator SHALL compute Club_Base + 5% of Club_Base, rounded up to the nearest integer
5. WHEN calculating Smedley target, THE Target_Calculator SHALL compute Club_Base + 8% of Club_Base, rounded up to the nearest integer
6. THE Target_Calculator SHALL always round up fractional results using ceiling function

### Requirement 2: Calculate Membership Payments Targets

**User Story:** As a district leader, I want to see my membership payments count against recognition level targets, so that I can track payment growth toward each distinguished district level.

#### Acceptance Criteria

1. THE Target_Calculator SHALL compute membership payments targets using the Payment_Base value from the district data
2. WHEN calculating Distinguished target, THE Target_Calculator SHALL compute Payment_Base + 1% of Payment_Base, rounded up to the nearest integer
3. WHEN calculating Select target, THE Target_Calculator SHALL compute Payment_Base + 3% of Payment_Base, rounded up to the nearest integer
4. WHEN calculating President's target, THE Target_Calculator SHALL compute Payment_Base + 5% of Payment_Base, rounded up to the nearest integer
5. WHEN calculating Smedley target, THE Target_Calculator SHALL compute Payment_Base + 8% of Payment_Base, rounded up to the nearest integer
6. THE Target_Calculator SHALL always round up fractional results using ceiling function

### Requirement 3: Calculate Distinguished Clubs Targets

**User Story:** As a district leader, I want to see my distinguished clubs count against recognition level targets, so that I can track club achievement toward each distinguished district level.

#### Acceptance Criteria

1. THE Target_Calculator SHALL compute distinguished clubs targets using the Club_Base value from the district data
2. WHEN calculating Distinguished target, THE Target_Calculator SHALL compute 45% of Club_Base, rounded up to the nearest integer
3. WHEN calculating Select target, THE Target_Calculator SHALL compute 50% of Club_Base, rounded up to the nearest integer
4. WHEN calculating President's target, THE Target_Calculator SHALL compute 55% of Club_Base, rounded up to the nearest integer
5. WHEN calculating Smedley target, THE Target_Calculator SHALL compute 60% of Club_Base, rounded up to the nearest integer
6. THE Target_Calculator SHALL always round up fractional results using ceiling function

### Requirement 4: Calculate Region Rankings

**User Story:** As a district leader, I want to see how my district ranks within my region, so that I can compare performance against peer districts.

#### Acceptance Criteria

1. THE System SHALL derive region rankings from the existing world rankings data
2. WHEN calculating region rank for a metric, THE System SHALL filter all districts to those in the same region as the current district
3. THE System SHALL assign region rank based on the district's position among filtered regional districts (1 = best in region)
4. THE System SHALL calculate region rank for each of the three metrics: paid clubs, membership payments, and distinguished clubs

### Requirement 5: Calculate World Percentile

**User Story:** As a district leader, I want to see what percentile my district falls into worldwide, so that I can understand relative performance.

#### Acceptance Criteria

1. THE System SHALL calculate world percentile for each metric based on world rank and total district count
2. WHEN calculating percentile, THE System SHALL use the formula: ((totalDistricts - worldRank) / totalDistricts) * 100
3. THE System SHALL round percentile to one decimal place
4. THE System SHALL display percentile as "Top X%" where X is 100 minus the calculated percentile (e.g., rank 10 of 100 = "Top 10%")

### Requirement 6: Enhance Existing Cards with Targets and Rankings

**User Story:** As a district leader, I want to see performance targets and rankings integrated into the existing overview cards, so that I can quickly assess district status without UI clutter.

#### Acceptance Criteria

1. THE District_Overview SHALL enhance the "Total Clubs" card to display Paid_Clubs with targets and rankings
2. WHEN displaying the Paid Clubs card, THE System SHALL retain the existing Thriving, Vulnerable, and Intervention Required club count badges
3. THE District_Overview SHALL enhance the "Total Membership" card to display Membership_Payments with targets and rankings
4. THE District_Overview SHALL enhance the "Distinguished Clubs" card to display Distinguished_Clubs count with targets and rankings
5. WHEN displaying the Distinguished Clubs card, THE System SHALL retain the existing Smedley, President's, Select, and Distinguished level badges
6. THE District_Overview SHALL remove the existing "Projected Year-End" card
7. WHEN displaying each enhanced card, THE System SHALL show progress against recognition level targets (Distinguished, Select, President's, Smedley)
8. WHEN displaying each enhanced card, THE System SHALL show world rank, world percentile, and region rank
9. WHEN a target is met or exceeded, THE System SHALL visually indicate achievement (e.g., checkmark, color change)

### Requirement 7: Provide Target and Ranking Data via API

**User Story:** As a frontend developer, I want the backend to provide calculated targets and rankings, so that the UI can display them without client-side calculation.

#### Acceptance Criteria

1. THE Backend SHALL include target calculations in the district analytics response
2. THE Backend SHALL include world rank, region rank, and world percentile for each metric
3. THE Backend SHALL include the base values (Club_Base, Payment_Base) used for target calculations
4. IF base values are unavailable, THEN THE Backend SHALL return null for targets and indicate data unavailability

### Requirement 8: Handle Missing or Invalid Data

**User Story:** As a user, I want the system to gracefully handle missing data, so that I see meaningful information even when some data is unavailable.

#### Acceptance Criteria

1. IF Club_Base or Payment_Base is zero or missing, THEN THE System SHALL display "N/A" for affected targets
2. IF ranking data is unavailable, THEN THE System SHALL display "—" for rank fields
3. IF region information is missing, THEN THE System SHALL omit region rank display
4. THE System SHALL display a tooltip explaining why data is unavailable when hovering over "N/A" or "—" indicators
