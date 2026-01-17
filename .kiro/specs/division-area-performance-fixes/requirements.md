# Requirements Document

## Introduction

This specification addresses calculation bugs in the Division and Area Performance Cards feature. The current implementation has incorrect logic for determining club base values, distinguished club counts, and visit completion counts. These fixes ensure the performance cards display accurate data that matches the source CSV fields and maintains consistency with the analytics engine's calculations.

## Glossary

- **Division_Club_Base**: The number of clubs in a division at the start of the program year, stored as a field in the division-performance.csv file with the same value for all clubs in that division
- **Area_Club_Base**: The number of clubs in an area at the start of the program year, stored as a field in the division-performance.csv file with the same value for all clubs in that area
- **Nov_Visit_Award**: A per-club field in division-performance.csv indicating whether the first round visit was completed ("1" = completed, "0" or empty = not completed)
- **May_Visit_Award**: A per-club field in division-performance.csv indicating whether the second round visit was completed ("1" = completed, "0" or empty = not completed)
- **Distinguished_Club**: A club that has achieved Distinguished, Select Distinguished, President's Distinguished, or Smedley Distinguished status
- **Analytics_Engine**: The backend service module (DistinguishedClubAnalyticsModule) that calculates distinguished club status using official DCP criteria
- **Extraction_Function**: The `extractDivisionPerformance` function in `frontend/src/utils/extractDivisionPerformance.ts`

## Requirements

### Requirement 1: Read Division Club Base from CSV Field

**User Story:** As a district leader, I want the division club base to be read from the CSV data field, so that the performance calculations use the official baseline value rather than a derived count.

#### Acceptance Criteria

1. WHEN extracting division performance data, THE Extraction_Function SHALL read the "Division Club Base" field from the division-performance.csv data
2. WHEN the "Division Club Base" field is present, THE Extraction_Function SHALL use that value as the division's club base
3. WHEN multiple clubs exist in a division, THE Extraction_Function SHALL read the "Division Club Base" from any single club record since all clubs in a division have the same value
4. IF the "Division Club Base" field is missing or invalid, THEN THE Extraction_Function SHALL fall back to counting clubs in the division

### Requirement 2: Read Area Club Base from CSV Field

**User Story:** As a district leader, I want the area club base to be read from the CSV data field, so that the performance calculations use the official baseline value rather than a derived count.

#### Acceptance Criteria

1. WHEN extracting area performance data, THE Extraction_Function SHALL read the "Area Club Base" field from the division-performance.csv data
2. WHEN the "Area Club Base" field is present, THE Extraction_Function SHALL use that value as the area's club base
3. WHEN multiple clubs exist in an area, THE Extraction_Function SHALL read the "Area Club Base" from any single club record since all clubs in an area have the same value
4. IF the "Area Club Base" field is missing or invalid, THEN THE Extraction_Function SHALL fall back to counting clubs in the area

### Requirement 3: Calculate Distinguished Clubs Using Analytics Engine Method

**User Story:** As a district leader, I want the distinguished clubs count to use the same calculation method as the All Clubs table, so that the Division/Area Performance Cards show consistent data.

#### Acceptance Criteria

1. WHEN counting distinguished clubs for a division or area, THE Extraction_Function SHALL use the same distinguished level determination logic as the DistinguishedClubAnalyticsModule
2. THE Extraction_Function SHALL check the "Club Distinguished Status" field as the primary source for distinguished level
3. IF the "Club Distinguished Status" field is empty or missing, THEN THE Extraction_Function SHALL calculate the distinguished level using DCP goals, membership, and net growth criteria
4. THE Extraction_Function SHALL count clubs with Distinguished, Select Distinguished, President's Distinguished, or Smedley Distinguished status as distinguished clubs
5. WHEN CSP (Club Success Plan) data is available, THE Extraction_Function SHALL require CSP submission for a club to be counted as distinguished (2025-2026+ requirement)

### Requirement 4: Calculate First Round Visits by Counting Clubs

**User Story:** As a district leader, I want the first round visit count to accurately reflect how many clubs received visits, so that I can track area director progress.

#### Acceptance Criteria

1. WHEN calculating first round visits for an area, THE Extraction_Function SHALL iterate through all clubs in the area
2. THE Extraction_Function SHALL count each club that has "1" in the "Nov Visit award" column as one completed first round visit
3. THE Extraction_Function SHALL NOT read the "Nov Visit award" value from a single club and treat it as the total visit count
4. WHEN a club has "0", empty, or missing "Nov Visit award" value, THE Extraction_Function SHALL NOT count it as a completed visit
5. THE first round visit count SHALL equal the number of clubs in the area with "Nov Visit award" = "1"

### Requirement 5: Calculate Second Round Visits by Counting Clubs

**User Story:** As a district leader, I want the second round visit count to accurately reflect how many clubs received visits, so that I can track area director progress.

#### Acceptance Criteria

1. WHEN calculating second round visits for an area, THE Extraction_Function SHALL iterate through all clubs in the area
2. THE Extraction_Function SHALL count each club that has "1" in the "May visit award" column as one completed second round visit
3. THE Extraction_Function SHALL NOT read the "May visit award" value from a single club and treat it as the total visit count
4. WHEN a club has "0", empty, or missing "May visit award" value, THE Extraction_Function SHALL NOT count it as a completed visit
5. THE second round visit count SHALL equal the number of clubs in the area with "May visit award" = "1"

### Requirement 6: Maintain Backward Compatibility

**User Story:** As a developer, I want the bug fixes to maintain backward compatibility with existing tests and interfaces, so that the changes don't break other parts of the application.

#### Acceptance Criteria

1. THE Extraction_Function SHALL maintain the same return type signature (DivisionPerformance[] and AreaPerformance[])
2. THE Extraction_Function SHALL continue to handle missing or malformed data gracefully
3. WHEN CSV fields are missing, THE Extraction_Function SHALL use sensible fallback values
4. THE existing unit tests SHALL continue to pass after updating test data to reflect correct behavior
5. New unit tests SHALL validate the corrected calculation methods
