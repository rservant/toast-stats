# Requirements Document

## Introduction

This document specifies the requirements for fixing data inconsistencies in the District Overview dashboard. The dashboard currently displays incorrect or misleading data due to several bugs in the analytics computation and data transformation layers. These bugs cause confusion for users who see conflicting numbers across different parts of the dashboard.

## Glossary

- **Analytics_Computer**: The main class in analytics-core that orchestrates analytics computation using specialized modules
- **Performance_Targets_Data**: Pre-computed data structure containing district performance metrics, targets, and rankings
- **Distinguished_Club**: A club that meets the official Toastmasters Distinguished Club Program criteria (see criteria below)
- **DCP_Goals**: Distinguished Club Program goals - 10 measurable objectives clubs can achieve
- **Paid_Clubs**: Clubs that have paid their dues and are in good standing (status = "Active")
- **All_Districts_Rankings**: Pre-computed JSON file containing rankings data for all districts worldwide
- **Transformation_Layer**: Backend utilities that transform analytics-core data into frontend-expected formats
- **Snapshot**: A point-in-time capture of district statistics data
- **Net_Growth**: The difference between current active members and membership base (Active Members - Mem. Base)

### Distinguished Club Criteria (Official Toastmasters DCP)

Per official Toastmasters Distinguished Club Program requirements:

- **Distinguished**: 5+ DCP goals AND (20+ members OR 3+ net growth)
- **Select Distinguished**: 7+ DCP goals AND (20+ members OR 5+ net growth)
- **President's Distinguished**: 9+ DCP goals AND 20+ members
- **Smedley Award**: 10 DCP goals AND 25+ members

## Requirements

### Requirement 1: Paid Clubs Count

**User Story:** As a district leader, I want to see the accurate count of paid clubs in my district, so that I can track club health and payment compliance.

#### Acceptance Criteria

1. THE Performance_Targets_Data SHALL include a paidClubsCount field containing the total number of paid clubs
2. WHEN computing performance targets, THE Analytics_Computer SHALL calculate paidClubsCount by counting clubs with "Active" status in the district snapshot
3. WHEN transforming performance targets for the frontend, THE Transformation_Layer SHALL use the actual paidClubsCount value instead of hardcoded zero

### Requirement 2: Distinguished Clubs Definition Consistency

**User Story:** As a district leader, I want the distinguished clubs count to be consistent across all dashboard views, so that I can accurately track club recognition progress.

#### Acceptance Criteria

1. THE Analytics_Computer SHALL use the official Toastmasters DCP criteria for counting distinguished clubs: clubs meeting Distinguished, Select Distinguished, President's Distinguished, or Smedley Award thresholds
2. WHEN computing currentProgress.distinguished in Performance_Targets_Data, THE Analytics_Computer SHALL count only clubs meeting the full distinguished criteria (including membership/net growth requirements)
3. THE Performance_Targets_Data SHALL NOT conflate "clubs with 5+ DCP goals" with "distinguished clubs" - the membership/net growth requirements MUST be validated
4. WHEN displaying distinguished clubs count, THE Dashboard SHALL show the same value in both the overview card and the Distinguished Club Progress section

### Requirement 3: Data Serialization Round-Trip

**User Story:** As a developer, I want performance targets data to serialize and deserialize correctly, so that data integrity is maintained across the pre-computation pipeline.

#### Acceptance Criteria

1. FOR ALL valid Performance_Targets_Data objects, serializing to JSON then deserializing SHALL produce an equivalent object
2. THE paidClubsCount field SHALL be preserved through JSON serialization round-trip
3. THE currentProgress.distinguished field SHALL be preserved through JSON serialization round-trip with the correct distinguished clubs count

### Requirement 4: Type Safety

**User Story:** As a developer, I want all data types to be properly defined in analytics-core, so that type safety is maintained across the codebase.

#### Acceptance Criteria

1. THE PerformanceTargetsData type in analytics-core SHALL include the paidClubsCount field with proper TypeScript typing
2. THE TypeScript compiler SHALL report no errors after the changes are implemented
3. THE paidClubsCount field SHALL be typed as a non-negative integer (number)
