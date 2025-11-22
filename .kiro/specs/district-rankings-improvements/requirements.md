# Requirements Document

## Introduction

This feature addresses improvements to the Toastmasters District Rankings display on the landing page. Users need to see both rank numbers and percentage values for paid clubs and total payments to better understand district performance. Additionally, there are concerns about the accuracy of rank calculations that need to be investigated and corrected.

## Glossary

- **District Rankings System**: The web application component that displays comparative performance metrics across Toastmasters districts
- **Paid Clubs Metric**: The count of clubs within a district that have paid memberships
- **Total Payments Metric**: The year-to-date sum of membership payments for a district
- **Rank Number**: The ordinal position of a district when sorted by a specific metric (1 = best)
- **Percentage Value**: The calculated percentage representing growth or achievement rate for a metric
- **Rankings Table**: The UI component on the landing page that displays district performance data in tabular format
- **Borda Count System**: A ranked voting method where points are assigned to each rank position, with higher ranks receiving more points
- **Borda Points**: Numerical score assigned to a district based on its rank in a category (e.g., if there are N districts, rank 1 gets N points, rank 2 gets N-1 points, etc.)
- **Aggregate Score**: The sum of Borda points across all three ranking categories (paid clubs, total payments, distinguished clubs)

## Requirements

### Requirement 1

**User Story:** As a district leader, I want to see percentage values alongside rank numbers for paid clubs and total payments, so that I can understand both relative position and actual performance metrics.

#### Acceptance Criteria

1. WHEN THE Rankings Table displays paid clubs data, THE District Rankings System SHALL display both the rank number and the percentage value for club growth
2. WHEN THE Rankings Table displays total payments data, THE District Rankings System SHALL display both the rank number and the percentage value for payment growth
3. WHEN a user views the Rankings Table, THE District Rankings System SHALL format percentage values with one decimal place precision
4. WHEN percentage values are displayed, THE District Rankings System SHALL use distinct visual styling to differentiate between rank numbers and percentages

### Requirement 2

**User Story:** As a district administrator, I want the rank calculations to use a Borda-style scoring system, so that the overall rankings accurately reflect performance across all categories with proper point allocation.

#### Acceptance Criteria

1. WHEN districts have equal values for a metric, THE District Rankings System SHALL assign the same rank number to all tied districts
2. WHEN calculating aggregate scores, THE District Rankings System SHALL use a Borda-style point system where points are assigned based on rank position
3. WHEN assigning Borda points, THE District Rankings System SHALL award higher points to better-performing districts (rank 1 receives the most points)
4. WHEN calculating the overall score, THE District Rankings System SHALL sum the Borda points from all three categories (paid clubs, total payments, distinguished clubs)
5. WHEN sorting districts by overall score, THE District Rankings System SHALL order districts in descending order by total Borda points (highest points = best overall)
6. WHEN ranking districts for paid clubs category, THE District Rankings System SHALL rank based on club growth percentage with highest positive percentage receiving rank 1
7. WHEN ranking districts for total payments category, THE District Rankings System SHALL rank based on payment growth percentage with highest positive percentage receiving rank 1
8. WHEN ranking districts for distinguished clubs category, THE District Rankings System SHALL rank based on distinguished clubs percentage with highest positive percentage receiving rank 1
9. WHEN sorting districts by a specific category in the table, THE District Rankings System SHALL order districts by the rank for that category in ascending order (rank 1 first)
10. WHEN displaying rank numbers in the table, THE District Rankings System SHALL show the correct rank for each category based on the sorted order
11. THE District Rankings System SHALL handle edge cases where districts have zero or missing values for metrics

### Requirement 3

**User Story:** As a system user, I want the rankings display to be clear and easy to understand, so that I can quickly compare district performance.

#### Acceptance Criteria

1. WHEN viewing the Rankings Table, THE District Rankings System SHALL display paid clubs data with both "Rank #X" and "Y.Z%" on separate lines
2. WHEN viewing the Rankings Table, THE District Rankings System SHALL display total payments data with both "Rank #X" and "Y.Z%" on separate lines
3. WHEN percentage values are positive, THE District Rankings System SHALL display them with a plus sign prefix to indicate growth
4. WHEN percentage values are negative, THE District Rankings System SHALL display them with a minus sign prefix to indicate decline
5. WHEN percentage values are zero, THE District Rankings System SHALL display "0.0%" without a sign prefix
6. WHEN displaying percentage values, THE District Rankings System SHALL use green color for positive percentages and red color for negative percentages
7. THE District Rankings System SHALL maintain consistent column alignment for all numeric values in the table
