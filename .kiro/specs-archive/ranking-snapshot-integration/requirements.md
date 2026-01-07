# Requirements Document

## Introduction

This feature integrates district ranking calculations into the snapshot creation process to ensure that ranking data is consistently available from the per-district snapshot system. Currently, the new snapshot-based architecture lacks the sophisticated ranking calculations that existed in the legacy cache system, causing the `/api/districts/rankings` endpoint to return incomplete data.

## Glossary

- **Ranking_Calculator**: Service responsible for computing district rankings using Borda count scoring
- **Snapshot_Creation_Process**: The process that creates immutable snapshots from scraped Toastmasters data
- **District_Rankings**: Computed ranking data including individual category ranks and aggregate scores
- **Borda_Count_System**: Scoring system where districts receive points based on their rank position across categories
- **Per_District_Snapshot**: Individual JSON files containing district data within a snapshot directory
- **Ranking_Metadata**: Information about which ranking algorithm version was used for calculations

## Requirements

### Requirement 1

**User Story:** As a system administrator, I want district rankings to be calculated during snapshot creation, so that ranking data is consistently available from the snapshot system without requiring separate cache files.

#### Acceptance Criteria

1. WHEN a snapshot is created from scraped district data, THE Ranking_Calculator SHALL compute district rankings using the Borda count system
2. WHEN rankings are calculated, THE Ranking_Calculator SHALL rank districts by club growth percentage with highest positive percentage receiving rank 1
3. WHEN rankings are calculated, THE Ranking_Calculator SHALL rank districts by payment growth percentage with highest positive percentage receiving rank 1
4. WHEN rankings are calculated, THE Ranking_Calculator SHALL rank districts by distinguished clubs percentage with highest positive percentage receiving rank 1
5. WHEN districts have equal values for a metric, THE Ranking_Calculator SHALL assign the same rank number to all tied districts
6. WHEN calculating aggregate scores, THE Ranking_Calculator SHALL use Borda points where points equal total districts minus rank plus one
7. WHEN calculating the overall score, THE Ranking_Calculator SHALL sum the Borda points from all three categories
8. WHEN sorting districts by overall score, THE Ranking_Calculator SHALL order districts in descending order by total Borda points

### Requirement 2

**User Story:** As a developer, I want ranking data to be stored within district snapshot files, so that the `/api/districts/rankings` endpoint can serve complete ranking information directly from snapshots.

#### Acceptance Criteria

1. WHEN district data is written to a per-district snapshot file, THE System SHALL include computed ranking fields in the district data
2. WHEN ranking data is stored, THE System SHALL include clubsRank, paymentsRank, distinguishedRank, and aggregateScore fields
3. WHEN ranking data is stored, THE System SHALL include growth percentages and base values used for ranking calculations
4. THE System SHALL store ranking data in the same DistrictStatistics structure used for other district data
5. WHEN reading district data from snapshots, THE System SHALL return ranking fields as part of the district statistics

### Requirement 3

**User Story:** As a system maintainer, I want ranking calculation versioning to be tracked in snapshot metadata, so that I can understand which ranking algorithm was used for historical snapshots.

#### Acceptance Criteria

1. WHEN rankings are calculated during snapshot creation, THE System SHALL record the ranking algorithm version in snapshot metadata
2. WHEN the ranking calculation logic changes, THE System SHALL increment the calculation version number
3. WHEN serving ranking data from historical snapshots, THE System SHALL preserve the original ranking calculations without recalculation
4. THE System SHALL maintain backward compatibility with snapshots created using different ranking algorithm versions

### Requirement 4

**User Story:** As an API consumer, I want the `/api/districts/rankings` endpoint to return complete ranking data from snapshots, so that I can access district rankings without relying on legacy cache files.

#### Acceptance Criteria

1. WHEN the `/api/districts/rankings` endpoint is called, THE System SHALL retrieve ranking data from the latest successful per-district snapshot
2. WHEN serving ranking data, THE System SHALL return all fields required by the DistrictRanking interface
3. WHEN no snapshot is available, THE System SHALL return a 503 error with appropriate error messaging
4. THE System SHALL include snapshot metadata in the response to indicate data freshness and calculation version

### Requirement 5

**User Story:** As a system architect, I want the ranking calculation to be integrated into the existing snapshot creation workflow, so that rankings are computed consistently with other derived data.

#### Acceptance Criteria

1. THE Ranking_Calculator SHALL be integrated into the RefreshService snapshot creation process
2. WHEN the RefreshService creates a snapshot, THE System SHALL calculate rankings before writing district data to snapshot files
3. WHEN ranking calculation fails for any reason, THE System SHALL log the error but continue with snapshot creation for districts without ranking data
4. THE System SHALL ensure ranking calculations use the same source data that is stored in the snapshot
5. WHEN backfill operations create historical snapshots, THE System SHALL calculate rankings using the same algorithm version for consistency
