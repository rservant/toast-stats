# Requirements Document

## Introduction

The `DataTransformer.extractClubs()` method produces incorrect values for `octoberRenewals`, `aprilRenewals`, and `paymentsCount` fields in `ClubStatistics` objects. These fields are always 0 because the method only reads from `clubPerformance` records (sourced from club-performance.csv), but the actual renewal and payment data resides in `districtPerformance` records (sourced from district-performance.csv). The `newMembers` field works correctly because it exists in both CSV files.

The fix requires merging data from `districtPerformance` records into `ClubStatistics` during the transformation step, matching clubs by normalized club ID.

## Glossary

- **DataTransformer**: The class in `packages/analytics-core/src/transformation/DataTransformer.ts` responsible for transforming raw CSV data into `DistrictStatistics` objects.
- **ClubStatistics**: The data structure representing a single club's statistics within a snapshot, including membership, payments, renewals, and DCP goals.
- **clubPerformance**: Parsed records from the Toastmasters club-performance.csv file. Contains club membership, DCP goals, and status data. Does NOT contain renewal or payment breakdown columns.
- **districtPerformance**: Parsed records from the Toastmasters district-performance.csv file. Contains renewal counts (`Oct. Ren.`, `Apr. Ren.`), charter info, and payment totals (`Total to Date`).
- **ParsedRecord**: A key-value object produced by `parseCSVRows()`, mapping CSV column headers to their string values.
- **Club_ID_Normalization**: The process of stripping leading zeros from club ID strings so that club IDs from different CSV sources (e.g., `00009905` and `9905`) match correctly.

## Requirements

### Requirement 1: Merge District Performance Data into Club Statistics

**User Story:** As a district leader, I want club renewal and payment data to be accurate in snapshots, so that I can track club health and membership trends correctly.

#### Acceptance Criteria

1. WHEN `districtPerformance` records are available, THE DataTransformer SHALL build a lookup map from `districtPerformance` records keyed by normalized club ID
2. WHEN constructing a `ClubStatistics` object, THE DataTransformer SHALL source `octoberRenewals` from the matching `districtPerformance` record using column names `Oct. Ren.` or `Oct. Ren`
3. WHEN constructing a `ClubStatistics` object, THE DataTransformer SHALL source `aprilRenewals` from the matching `districtPerformance` record using column names `Apr. Ren.` or `Apr. Ren`
4. WHEN constructing a `ClubStatistics` object, THE DataTransformer SHALL source `paymentsCount` from the matching `districtPerformance` record using column name `Total to Date`
5. WHEN constructing a `ClubStatistics` object, THE DataTransformer SHALL source `newMembers` from the matching `districtPerformance` record using column names `New Members` or `New`
6. WHEN no matching `districtPerformance` record exists for a club, THE DataTransformer SHALL fall back to extracting `octoberRenewals`, `aprilRenewals`, `newMembers`, and `paymentsCount` from the `clubPerformance` record
7. WHEN no data is available from either source, THE DataTransformer SHALL default `octoberRenewals`, `aprilRenewals`, `newMembers`, and `paymentsCount` to 0

### Requirement 2: Club ID Normalization for Cross-CSV Matching

**User Story:** As a data pipeline operator, I want club IDs from different CSV files to match reliably, so that data merging produces correct results regardless of leading-zero formatting.

#### Acceptance Criteria

1. WHEN building the `districtPerformance` lookup map, THE DataTransformer SHALL normalize club IDs by stripping leading zeros
2. WHEN looking up a club in the `districtPerformance` map, THE DataTransformer SHALL normalize the `clubPerformance` club ID by stripping leading zeros before lookup
3. THE DataTransformer SHALL match club IDs from `districtPerformance` using column names `Club`, `Club Number`, or `Club ID`
4. WHEN a club ID consists entirely of zeros, THE DataTransformer SHALL preserve the original value rather than producing an empty string

### Requirement 3: Preserve Existing Behavior for Unaffected Fields

**User Story:** As a developer, I want the fix to only change the source of renewal and payment fields, so that all other club statistics remain unaffected.

#### Acceptance Criteria

1. THE DataTransformer SHALL continue to source `membershipCount`, `dcpGoals`, `membershipBase`, `clubStatus`, `divisionId`, `areaId`, `clubName`, and `charterDate` from `clubPerformance` records
2. WHEN `districtPerformance` data is empty or missing, THE DataTransformer SHALL produce the same output as the current implementation for all fields
