# Requirements Document

## Introduction

This document specifies the requirements for fixing a bug where rankings data includes invalid "As of MM/DD/YYYY" entries as district IDs. The root cause is that the existing `DistrictIdValidator` service is not being applied when calculating rankings in two critical code paths: `SnapshotBuilder.calculateAllDistrictsRankings()` and `BackfillService.fetchAndCalculateAllDistrictsRankings()`.

The fix ensures that invalid district IDs (like date patterns from CSV footers) are filtered out before rankings are calculated, preventing corrupted data from appearing in the landing page and district page rankings.

## Glossary

- **DistrictIdValidator**: A service that validates district IDs and filters out invalid records (empty, whitespace-only, date patterns, or non-alphanumeric characters)
- **SnapshotBuilder**: A service that creates snapshots from cached CSV data without performing any scraping
- **BackfillService**: A service that orchestrates backfill operations for historical data collection
- **ScrapedRecord**: A raw record parsed from CSV data containing district performance information
- **DistrictStatistics**: A normalized data structure containing district performance metrics
- **AllDistrictsRankingsData**: A data structure containing calculated rankings for all districts
- **RankingCalculator**: A service that calculates BordaCount rankings from district statistics

## Requirements

### Requirement 1: Filter Invalid District IDs in SnapshotBuilder Rankings

**User Story:** As a system operator, I want invalid district IDs to be filtered out during snapshot rankings calculation, so that corrupted data does not appear in the rankings display.

#### Acceptance Criteria

1. WHEN the SnapshotBuilder calculates all-districts rankings, THE SnapshotBuilder SHALL filter the input ScrapedRecord array using the DistrictIdValidator before converting to DistrictStatistics
2. WHEN invalid district IDs are filtered during rankings calculation, THE SnapshotBuilder SHALL log a warning for each rejected record including the district ID and rejection reason
3. WHEN invalid district IDs are filtered during rankings calculation, THE SnapshotBuilder SHALL log a summary including total records, valid records, and rejected records count
4. IF all records are filtered out as invalid, THEN THE SnapshotBuilder SHALL return undefined for rankings data rather than calculating rankings on an empty set

### Requirement 2: Filter Invalid District IDs in BackfillService Rankings

**User Story:** As a system operator, I want invalid district IDs to be filtered out during backfill rankings calculation, so that historical rankings data is not corrupted.

#### Acceptance Criteria

1. WHEN the BackfillService fetches and calculates all-districts rankings, THE BackfillService SHALL filter the parsed CSV records using the DistrictIdValidator before converting to DistrictStatistics
2. WHEN invalid district IDs are filtered during backfill rankings calculation, THE BackfillService SHALL log a warning for each rejected record including the district ID and rejection reason
3. WHEN invalid district IDs are filtered during backfill rankings calculation, THE BackfillService SHALL log a summary including total records, valid records, and rejected records count
4. IF all records are filtered out as invalid, THEN THE BackfillService SHALL throw an error indicating no valid records were found

### Requirement 3: Consistent Validation Behavior

**User Story:** As a developer, I want consistent validation behavior across all rankings calculation paths, so that the system behaves predictably.

#### Acceptance Criteria

1. THE SnapshotBuilder and BackfillService SHALL use the same DistrictIdValidator instance or equivalent validation logic
2. THE validation SHALL reject district IDs matching the date pattern "As of MM/DD/YYYY" (case-insensitive)
3. THE validation SHALL reject empty, null, or whitespace-only district IDs
4. THE validation SHALL reject district IDs containing non-alphanumeric characters
5. THE validation SHALL accept valid alphanumeric district IDs (e.g., "42", "F", "D42")
