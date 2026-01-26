# Requirements Document

## Introduction

This document specifies the requirements for fixing the global ranking discrepancy in the Toastmasters dashboard application. Currently, a district's overall rank displays differently between the main rankings page (LandingPage.tsx) and the district detail page's Global Rankings tab (GlobalRankingsTab.tsx). The main rankings page correctly uses the Borda count aggregate score to determine rank position, while the Global Rankings tab incorrectly calculates overall rank by averaging the three category ranks. This inconsistency confuses users and undermines trust in the data.

## Glossary

- **Aggregate_Score**: A Borda count score calculated by summing points from three categories (clubs, payments, distinguished). Higher scores indicate better overall performance.
- **Overall_Rank**: A district's position when all districts are sorted by Aggregate_Score in descending order (1 = best).
- **Category_Rank**: A district's position within a single metric (clubsRank, paymentsRank, or distinguishedRank).
- **Borda_Count_System**: A ranking method where points are awarded based on position (rank #1 gets N points, rank #2 gets N-1 points, etc., where N is total districts).
- **Rank_History_API**: The backend endpoint `/api/districts/:districtId/rank-history` that returns historical ranking data.
- **Global_Rankings_Tab**: The frontend component displaying a district's global ranking information on the district detail page.
- **Landing_Page**: The main rankings page showing all districts sorted by aggregate score.

## Requirements

### Requirement 1: Consistent Overall Rank Calculation

**User Story:** As a user, I want to see the same overall rank for a district on both the main rankings page and the district detail page, so that I can trust the ranking data is accurate and consistent.

#### Acceptance Criteria

1. WHEN the Global_Rankings_Tab displays a district's overall rank, THE System SHALL use the same Borda_Count_System ranking as the Landing_Page
2. WHEN districts are ranked by Aggregate_Score, THE System SHALL assign Overall_Rank based on position in the sorted list (index + 1)
3. THE System SHALL NOT calculate Overall_Rank by averaging Category_Ranks
4. WHEN two districts have the same Aggregate_Score, THE System SHALL assign them the same Overall_Rank

### Requirement 2: Backend Overall Rank in History Data

**User Story:** As a frontend developer, I want the rank history API to include the overall rank based on aggregate score position, so that I can display consistent rankings without recalculating.

#### Acceptance Criteria

1. WHEN the Rank_History_API returns historical data, THE System SHALL include an overallRank field for each data point
2. THE overallRank field SHALL represent the district's position when all districts are sorted by Aggregate_Score (1 = best)
3. WHEN building rank history from snapshots, THE System SHALL calculate overallRank by sorting all districts by aggregateScore and determining position
4. THE System SHALL include overallRank in the HistoricalRankPoint type definition

### Requirement 3: Frontend Overall Rank Display

**User Story:** As a user viewing the Global Rankings tab, I want to see the correct overall rank that matches the main rankings page, so that I understand my district's true standing.

#### Acceptance Criteria

1. WHEN extractEndOfYearRankings processes rank history data, THE System SHALL use the overallRank field from the API response
2. THE System SHALL NOT calculate overall rank by averaging clubsRank, paymentsRank, and distinguishedRank
3. WHEN buildYearlyRankingSummaries creates yearly summaries, THE System SHALL use the overallRank field from the latest data point
4. IF the overallRank field is not present in legacy data, THEN THE System SHALL fall back to calculating rank from aggregateScore position within the available data

### Requirement 4: Data Type Updates

**User Story:** As a developer, I want the TypeScript types to accurately reflect the data structure including overall rank, so that the codebase is type-safe and self-documenting.

#### Acceptance Criteria

1. THE HistoricalRankPoint interface SHALL include an overallRank field of type number
2. THE overallRank field SHALL be required in new data and optional for backward compatibility with existing snapshots
3. WHEN the frontend receives data without overallRank, THE System SHALL handle the missing field gracefully
