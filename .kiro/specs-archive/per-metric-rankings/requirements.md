# Requirements Document

## Introduction

This feature adds per-metric ranking data (world rank, world percentile, region rank) to the district overview cards. Currently, the three metric cards (Paid Clubs, Membership Payments, Distinguished Clubs) display "—" for rankings because the data is not being computed and stored in the pre-computed analytics files.

The ranking data must be computed in the collector-cli pipeline (per the data-computation-separation steering document) and included in the pre-computed `performance-targets` analytics files. The backend will serve this data as-is, and the frontend already expects the `MetricRankings` structure.

**Critical Consistency Requirement**: The per-metric rankings MUST be consistent with the existing all-districts-rankings.json data used on the landing page. The `clubsRank`, `paymentsRank`, and `distinguishedRank` fields already exist in all-districts-rankings.json and MUST be reused for the district detail page.

## Glossary

- **Collector_CLI**: The command-line tool that scrapes data from Toastmasters dashboard, transforms it, and computes analytics
- **Analytics_Computer**: The shared analytics computation module in analytics-core that computes district analytics
- **Performance_Targets_Data**: The pre-computed file containing recognition level targets and rankings for each metric
- **All_Districts_Rankings**: The existing pre-computed file containing aggregate rankings for all districts, including per-metric ranks (clubsRank, paymentsRank, distinguishedRank)
- **Metric_Rankings**: The ranking data structure containing world rank, world percentile, region rank, and totals
- **World_Rank**: A district's position among all districts worldwide for a specific metric (1 = best), sourced from all-districts-rankings.json
- **World_Percentile**: The percentage of districts a district outperforms worldwide (0-100), calculated from world rank
- **Region_Rank**: A district's position within its geographic region for a specific metric (1 = best)
- **Clubs_Rank**: The existing rank field in all-districts-rankings.json for club growth percentage
- **Payments_Rank**: The existing rank field in all-districts-rankings.json for payment growth percentage
- **Distinguished_Rank**: The existing rank field in all-districts-rankings.json for distinguished club percentage

## Requirements

### Requirement 1: Reuse Existing Rankings from All-Districts-Rankings

**User Story:** As a district leader, I want to see consistent rankings between the landing page and district detail page, so that I can trust the data.

#### Acceptance Criteria

1. WHEN computing per-metric rankings, THE Analytics_Computer SHALL use the existing clubsRank, paymentsRank, and distinguishedRank from all-districts-rankings.json
2. THE per-metric world rank for paid clubs SHALL equal the clubsRank from all-districts-rankings.json
3. THE per-metric world rank for membership payments SHALL equal the paymentsRank from all-districts-rankings.json
4. THE per-metric world rank for distinguished clubs SHALL equal the distinguishedRank from all-districts-rankings.json
5. WHEN all-districts-rankings.json is not available, THE Analytics_Computer SHALL set all rankings to null

### Requirement 2: Compute World Percentile from Existing Ranks

**User Story:** As a district leader, I want to see my percentile ranking, so that I can understand how I compare to other districts.

#### Acceptance Criteria

1. WHEN computing world percentile, THE Analytics_Computer SHALL calculate as ((totalDistricts - worldRank) / totalDistricts) \* 100
2. THE Analytics_Computer SHALL round world percentile to 1 decimal place
3. IF totalDistricts is 0 or 1, THEN THE Analytics_Computer SHALL set world percentile to null
4. IF worldRank is null, THEN THE Analytics_Computer SHALL set world percentile to null

### Requirement 3: Compute Region Rankings

**User Story:** As a district leader, I want to see how I rank within my region, so that I can compare with nearby districts.

#### Acceptance Criteria

1. WHEN computing region rank, THE Analytics_Computer SHALL filter districts by the same region value from all-districts-rankings.json
2. WHEN computing region rank for a metric, THE Analytics_Computer SHALL rank districts within the region from highest to lowest metric value (1 = best)
3. THE Analytics_Computer SHALL extract region information from the all-districts-rankings.json data
4. IF a district's region is not available or is "Unknown", THEN THE Analytics_Computer SHALL set region to null and regionRank to null
5. THE Analytics_Computer SHALL set totalInRegion to the count of districts with the same region value

### Requirement 4: Update Performance Targets Data Structure

**User Story:** As a developer, I want the PerformanceTargetsData type to include MetricRankings, so that the pre-computed files contain all data needed by the frontend.

#### Acceptance Criteria

1. THE Performance_Targets_Data type SHALL include a paidClubsRankings field of type Metric_Rankings
2. THE Performance_Targets_Data type SHALL include a membershipPaymentsRankings field of type Metric_Rankings
3. THE Performance_Targets_Data type SHALL include a distinguishedClubsRankings field of type Metric_Rankings
4. THE Metric_Rankings type SHALL include worldRank (number | null), worldPercentile (number | null), regionRank (number | null), totalDistricts (number), totalInRegion (number), and region (string | null)

### Requirement 5: Pass All-Districts Data to Analytics Computer

**User Story:** As a developer, I want the AnalyticsComputeService to pass all-districts data to the computePerformanceTargets method, so that rankings can be computed.

#### Acceptance Criteria

1. WHEN computing analytics for a district, THE Analytics_Compute_Service SHALL load the all-districts-rankings.json file for the snapshot date
2. WHEN computing performance targets, THE Analytics_Compute_Service SHALL pass the all-districts rankings data to the Analytics_Computer
3. IF the all-districts-rankings.json file is not available, THEN THE Analytics_Compute_Service SHALL log a warning and compute performance targets with null rankings
4. THE Analytics_Compute_Service SHALL NOT fail if all-districts-rankings.json is missing

### Requirement 6: Handle Tied Rankings

**User Story:** As a developer, I want tied rankings to be handled consistently, so that districts with the same metric value get the same rank.

#### Acceptance Criteria

1. WHEN computing region rank, THE Analytics_Computer SHALL assign the same rank to districts with equal metric values
2. THE existing clubsRank, paymentsRank, and distinguishedRank in all-districts-rankings.json already handle ties correctly and SHALL be used as-is
