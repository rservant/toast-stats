# Requirements Document

## Introduction

This spec addresses a critical bug in the distinguished status calculation logic within the AnalyticsEngine. Currently, the `calculateDistinguishedClubs` method incorrectly marks clubs as "Distinguished" or "Select Distinguished" even when they have negative membership growth, which violates the official Toastmasters Distinguished Club Program (DCP) requirements. The method has comments indicating it needs historical data for net growth validation, but it's not utilizing the available "Mem. Base" field to calculate net growth from the existing data.

## Glossary

- **Distinguished Club Program (DCP)**: Toastmasters' club recognition program with 10 goals and 4 achievement levels
- **Net Growth**: The difference between current active membership and membership base (Active Members - Mem. Base)
- **Mem. Base**: The membership baseline used to calculate net growth, available in club performance data
- **Active Members**: Current active membership count in the club
- **Distinguished Levels**: Four levels of club recognition (Distinguished, Select Distinguished, President's Distinguished, Smedley Award)
- **AnalyticsEngine**: Backend service that processes cached district data to generate club analytics

## Requirements

### Requirement 1: Fix Distinguished Status Net Growth Validation

**User Story:** As a district leader viewing club analytics, I want to see accurate distinguished status calculations that properly validate net growth requirements, so that I can correctly assess which clubs have truly earned their distinguished status.

#### Acceptance Criteria

1. WHEN THE AnalyticsEngine calculates distinguished status for a club, THE AnalyticsEngine SHALL calculate net growth as the difference between "Active Members" and "Mem. Base" fields.

2. WHEN a club has 5+ DCP goals and 20+ members, THE AnalyticsEngine SHALL classify the club as "Distinguished" regardless of net growth.

3. WHEN a club has 5+ DCP goals, fewer than 20 members, and net growth of 3+, THE AnalyticsEngine SHALL classify the club as "Distinguished".

4. WHEN a club has 5+ DCP goals, fewer than 20 members, and net growth less than 3, THE AnalyticsEngine SHALL NOT classify the club as "Distinguished".

5. WHEN a club has 7+ DCP goals and 20+ members, THE AnalyticsEngine SHALL classify the club as "Select Distinguished" regardless of net growth.

6. WHEN a club has 7+ DCP goals, fewer than 20 members, and net growth of 5+, THE AnalyticsEngine SHALL classify the club as "Select Distinguished".

7. WHEN a club has 7+ DCP goals, fewer than 20 members, and net growth less than 5, THE AnalyticsEngine SHALL NOT classify the club as "Select Distinguished".

8. WHEN a club has 9+ DCP goals and 20+ members, THE AnalyticsEngine SHALL classify the club as "President's Distinguished".

9. WHEN a club has 10 DCP goals and 25+ members, THE AnalyticsEngine SHALL classify the club as "Smedley Award".

10. WHEN the "Mem. Base" field is missing or invalid, THE AnalyticsEngine SHALL treat net growth as zero and proceed with other validation criteria.

### Requirement 2: Maintain Backward Compatibility

**User Story:** As a system administrator, I want the distinguished status fix to work with all existing cached data formats, so that historical analytics remain accurate and no data migration is required.

#### Acceptance Criteria

1. WHEN THE AnalyticsEngine processes club data with "Active Members" and "Mem. Base" fields, THE AnalyticsEngine SHALL use these fields for net growth calculation.

2. WHEN THE AnalyticsEngine processes club data with "Active Membership" field instead of "Active Members", THE AnalyticsEngine SHALL use "Active Membership" for current membership count.

3. WHEN THE AnalyticsEngine processes club data with "Membership" field instead of "Active Members", THE AnalyticsEngine SHALL use "Membership" for current membership count.

4. WHEN THE AnalyticsEngine processes older data formats that lack "Mem. Base" field, THE AnalyticsEngine SHALL treat net growth as zero and apply other distinguished criteria.

5. WHEN THE AnalyticsEngine encounters null or undefined values in membership fields, THE AnalyticsEngine SHALL treat those values as zero.

### Requirement 3: Add Comprehensive Testing

**User Story:** As a developer, I want comprehensive unit tests for distinguished status calculation, so that future changes don't reintroduce the net growth validation bug.

#### Acceptance Criteria

1. WHEN unit tests are executed for distinguished status calculation, THE test suite SHALL include test cases for clubs with positive, zero, and negative net growth at different membership levels.

2. WHEN unit tests verify Distinguished level calculation, THE test suite SHALL include test cases for clubs with 20+ members (should qualify regardless of net growth) and clubs with fewer than 20 members (should require 3+ net growth).

3. WHEN unit tests verify Select Distinguished level calculation, THE test suite SHALL include test cases for clubs with 20+ members (should qualify regardless of net growth) and clubs with fewer than 20 members (should require 5+ net growth).

4. WHEN unit tests verify President's Distinguished level calculation, THE test suite SHALL confirm clubs with 9+ goals and 20+ members qualify regardless of net growth.

5. WHEN unit tests verify Smedley Award level calculation, THE test suite SHALL confirm clubs with 10 goals and 25+ members qualify regardless of net growth.

6. WHEN unit tests verify backward compatibility, THE test suite SHALL include test cases for different membership field names and missing "Mem. Base" fields.

### Requirement 4: Validate Fix with Real Data

**User Story:** As a QA tester, I want to validate the fix using actual cached district data, so that I can confirm the bug is resolved and clubs with negative growth are no longer incorrectly marked as distinguished.

#### Acceptance Criteria

1. WHEN the fixed AnalyticsEngine processes the Barrhaven Toastmasters club data (11 members, -15 member change, 6/10 DCP goals), THE AnalyticsEngine SHALL NOT classify it as "Distinguished" because it has fewer than 20 members and insufficient net growth (needs 3+ net growth but has negative growth).

2. WHEN the analytics API returns distinguished club counts, THE API response SHALL show accurate counts that properly validate both membership thresholds and net growth requirements.

3. WHEN the frontend displays club details, THE UI SHALL show accurate distinguished status that reflects the correct "20 members OR net growth" logic for Distinguished and Select Distinguished levels.

4. WHEN comparing fixed results to manual validation using official DCP criteria, THE distinguished status calculations SHALL match the correct interpretation of the rules.

### Requirement 5: Add Logging and Debugging Support

**User Story:** As a developer troubleshooting distinguished status issues, I want detailed logging of the calculation process, so that I can verify the logic is working correctly and debug any future issues.

#### Acceptance Criteria

1. WHEN THE AnalyticsEngine calculates distinguished status with debug logging enabled, THE AnalyticsEngine SHALL log the net growth calculation for each club.

2. WHEN a club fails distinguished status due to negative net growth, THE AnalyticsEngine SHALL log the specific reason for the failure.

3. WHEN THE AnalyticsEngine encounters missing or invalid membership data, THE AnalyticsEngine SHALL log a warning with the club details.

4. WHEN debug logging is disabled, THE AnalyticsEngine SHALL not impact performance with logging overhead.

5. WHEN logging distinguished status calculations, THE AnalyticsEngine SHALL include club ID, current members, membership base, net growth, DCP goals, and final status in the log entry.
