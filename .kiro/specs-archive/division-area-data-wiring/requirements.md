# Requirements Document

## Introduction

This feature addresses a data format mismatch between the collector-cli pipeline and the frontend's Divisions & Areas tab on the District Detail page. Currently, the "Divisions & Areas" tab shows empty data ("No Divisions Found") because the `DataTransformer` class discards raw CSV arrays during transformation, but the frontend's `extractDivisionPerformance` function requires these raw arrays to calculate division/area status and recognition levels.

The frontend implementation (from archived specs `division-area-performance-cards`, `division-area-performance-fixes`, `area-distinguished-criteria`, and `division-distinguished-criteria`) expects the district statistics API response to include:

- `divisionPerformance`: Raw CSV records from Division.aspx scrape containing club-level data with Division, Area, Club Base fields, and visit award fields
- `clubPerformance`: Raw CSV records from Club.aspx scrape containing Club Status and Club Distinguished Status fields

The solution follows the data-computation-separation steering document: all computation happens in collector-cli, and the backend serves pre-computed data. The `DataTransformer` must preserve raw CSV arrays alongside transformed data.

## Glossary

- **DataTransformer**: The class in `packages/analytics-core` that transforms raw CSV data from the Toastmasters dashboard into structured `DistrictStatistics` objects
- **RawCSVData**: The input format containing `clubPerformance`, `divisionPerformance`, and `districtPerformance` as 2D string arrays
- **DistrictStatistics**: The output format containing transformed clubs, divisions, areas, and totals
- **DistrictStatisticsFile**: The shared-contracts type defining the file format for district JSON files
- **ScrapedRecord**: A record type representing a single row from CSV data as key-value pairs (`Record<string, string | number | null>`)
- **TransformService**: The collector-cli service that orchestrates CSV transformation and file writing
- **PerDistrictData**: The wrapper structure for district JSON files containing metadata and district statistics
- **extractDivisionPerformance**: The frontend utility function that extracts division and area performance data from district statistics, expecting raw CSV arrays
- **Division_Club_Base**: The number of clubs in a division at the start of the program year, stored in the "Division Club Base" CSV field
- **Area_Club_Base**: The number of clubs in an area at the start of the program year, stored in the "Area Club Base" CSV field
- **Nov_Visit_Award**: A per-club field indicating first round visit completion ("1" = completed)
- **May_Visit_Award**: A per-club field indicating second round visit completion ("1" = completed)

## Requirements

### Requirement 1: Preserve Raw CSV Data in Transformation Output

**User Story:** As a frontend developer, I want the district statistics to include raw CSV arrays, so that the Divisions & Areas tab can calculate division/area status and recognition levels using the `extractDivisionPerformance` function.

#### Acceptance Criteria

1. WHEN the DataTransformer transforms raw CSV data, THE DataTransformer SHALL include the original `divisionPerformance` records in the output as an array of ScrapedRecord objects
2. WHEN the DataTransformer transforms raw CSV data, THE DataTransformer SHALL include the original `clubPerformance` records in the output as an array of ScrapedRecord objects
3. WHEN the DataTransformer transforms raw CSV data, THE DataTransformer SHALL include the original `districtPerformance` records in the output as an array of ScrapedRecord objects
4. THE DataTransformer SHALL convert raw CSV 2D arrays to arrays of ScrapedRecord objects by mapping headers to values for each row
5. IF a raw CSV array is empty or missing, THEN THE DataTransformer SHALL include an empty array in the output
6. THE raw CSV arrays SHALL preserve all original column names and values from the CSV files including "Division Club Base", "Area Club Base", "Nov Visit award", "May visit award", "Club Status", and "Club Distinguished Status"

### Requirement 2: Update Shared Contracts for Raw Data Fields

**User Story:** As a developer, I want the shared contracts to define raw data fields, so that both collector-cli and backend have a consistent type definition.

#### Acceptance Criteria

1. THE DistrictStatisticsFile type SHALL include a required `divisionPerformance` field of type `ScrapedRecord[]`
2. THE DistrictStatisticsFile type SHALL include a required `clubPerformance` field of type `ScrapedRecord[]`
3. THE DistrictStatisticsFile type SHALL include a required `districtPerformance` field of type `ScrapedRecord[]`
4. THE ScrapedRecord type SHALL be defined in shared-contracts as `Record<string, string | number | null>`
5. THE Zod schema for DistrictStatisticsFile SHALL validate the raw data fields with appropriate type checking

### Requirement 3: Update Analytics-Core Interfaces

**User Story:** As a developer, I want the analytics-core interfaces to include raw data fields, so that the DataTransformer output type is accurate.

#### Acceptance Criteria

1. THE DistrictStatistics interface in analytics-core SHALL include a required `divisionPerformance` field of type `ScrapedRecord[]`
2. THE DistrictStatistics interface in analytics-core SHALL include a required `clubPerformance` field of type `ScrapedRecord[]`
3. THE DistrictStatistics interface in analytics-core SHALL include a required `districtPerformance` field of type `ScrapedRecord[]`
4. THE ScrapedRecord type SHALL be imported from shared-contracts or defined consistently

### Requirement 4: Backend Serves Raw Data Without Computation

**User Story:** As a developer, I want the backend to serve raw CSV data as-is from snapshots, so that the frontend receives the data it needs without backend computation.

#### Acceptance Criteria

1. WHEN the backend serves district statistics, THE response SHALL include the raw data fields (`divisionPerformance`, `clubPerformance`, `districtPerformance`) from the snapshot
2. THE backend SHALL NOT compute, transform, or modify the raw data fields - it SHALL serve them exactly as stored in the snapshot
3. THE backend type definitions SHALL remain compatible with the shared-contracts DistrictStatisticsFile type

### Requirement 5: Validation of Raw Data Fields

**User Story:** As a developer, I want proper validation of raw data fields, so that malformed data is caught early.

#### Acceptance Criteria

1. WHEN validating district statistics files, THE Zod schema SHALL require the raw data fields to be present
2. WHEN a raw data field contains invalid data, THE validation SHALL fail with a descriptive error message
3. THE validation SHALL ensure each ScrapedRecord contains only string, number, or null values
