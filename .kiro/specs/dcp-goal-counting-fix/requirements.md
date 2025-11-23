# Requirements Document

## Introduction

This spec addresses a bug in the DCP goal counting logic within the AnalyticsEngine. Currently, Goals 5 and 6 (Level 4/Path Completion/DTM awards) are being counted incorrectly, showing zero clubs achieving these goals when data clearly shows clubs have achieved them. The issue stems from misunderstanding how the "additional" goal fields work in the Toastmasters data structure.

## Glossary

- **DCP**: Distinguished Club Program - Toastmasters' club recognition program with 10 goals
- **Goal 5**: Achieve 1 Level 4, Path Completion, or DTM award
- **Goal 6**: Achieve 1 additional Level 4, Path Completion, or DTM award (2 total)
- **AnalyticsEngine**: Backend service that processes cached district data to generate analytics
- **CSV Data Fields**: The column names from Toastmasters' exported club performance data

## Requirements

### Requirement 1: Fix Goal 5 and Goal 6 Counting Logic

**User Story:** As a district leader viewing the analytics page, I want to see accurate counts of clubs achieving Goals 5 and 6, so that I can properly assess district performance on educational awards.

#### Acceptance Criteria

1. WHEN THE AnalyticsEngine processes club performance data from 2025 or later, THE AnalyticsEngine SHALL count Goal 5 as achieved IF the club's "Level 4s, Path Completions, or DTM Awards" field value is greater than or equal to 1.

2. WHEN THE AnalyticsEngine processes club performance data from 2020-2024, THE AnalyticsEngine SHALL count Goal 5 as achieved IF the club's "Level 4s, Level 5s, or DTM award" field value is greater than or equal to 1.

3. WHEN THE AnalyticsEngine processes club performance data from 2019 or earlier, THE AnalyticsEngine SHALL count Goal 5 as achieved IF the club's "CL/AL/DTMs" field value is greater than or equal to 1.

4. WHEN THE AnalyticsEngine processes club performance data from 2025 or later, THE AnalyticsEngine SHALL count Goal 6 as achieved IF the club's "Level 4s, Path Completions, or DTM Awards" field value is greater than or equal to 1 AND the club's "Add. Level 4s, Path Completions, or DTM award" field value is greater than or equal to 1.

5. WHEN THE AnalyticsEngine processes club performance data from 2020-2024, THE AnalyticsEngine SHALL count Goal 6 as achieved IF the club's "Level 4s, Level 5s, or DTM award" field value is greater than or equal to 1 AND the club's "Add. Level 4s, Level 5s, or DTM award" field value is greater than or equal to 1.

6. WHEN THE AnalyticsEngine processes club performance data from 2019 or earlier, THE AnalyticsEngine SHALL count Goal 6 as achieved IF the club's "CL/AL/DTMs" field value is greater than or equal to 1 AND the club's "Add. CL/AL/DTMs" field value is greater than or equal to 1.

7. WHEN THE AnalyticsEngine calculates DCP goal analysis for a district, THE AnalyticsEngine SHALL return non-zero achievement counts for Goals 5 and 6 IF clubs in the district have achieved these goals.

8. WHEN a club has achieved Goal 5 but not Goal 6, THE AnalyticsEngine SHALL count only Goal 5 as achieved for that club.

9. WHEN a club has achieved both Goal 5 and Goal 6, THE AnalyticsEngine SHALL count both goals as achieved for that club.

### Requirement 2: Fix Similar Logic for Goals 3 and 8

**User Story:** As a district leader, I want to ensure that all "additional" goals (Goals 3, 6, and 8) are counted correctly using the same logical pattern, so that all DCP analytics are accurate.

#### Acceptance Criteria

1. WHEN THE AnalyticsEngine processes club performance data for Goal 3, THE AnalyticsEngine SHALL count Goal 3 as achieved IF the club's "Level 2s" field value is greater than or equal to 2 AND the club's "Add. Level 2s" field value is greater than or equal to 2.

2. WHEN THE AnalyticsEngine processes club performance data for Goal 8, THE AnalyticsEngine SHALL count Goal 8 as achieved IF the club's "New Members" field value is greater than or equal to 4 AND the club's "Add. New Members" field value is greater than or equal to 4.

3. WHEN THE AnalyticsEngine calculates DCP goal analysis, THE AnalyticsEngine SHALL apply consistent logic to all "additional" goals (3, 6, 8).

### Requirement 3: Add Unit Tests for DCP Goal Counting

**User Story:** As a developer, I want comprehensive unit tests for DCP goal counting logic, so that future changes don't reintroduce counting bugs.

#### Acceptance Criteria

1. WHEN unit tests are executed for the AnalyticsEngine, THE test suite SHALL include test cases for each of the 10 DCP goals.

2. WHEN unit tests verify Goal 5 counting, THE test suite SHALL include test cases for clubs with 0, 1, and 2+ Level 4 awards.

3. WHEN unit tests verify Goal 6 counting, THE test suite SHALL include test cases for clubs with Goal 5 achieved but not Goal 6, and clubs with both goals achieved.

4. WHEN unit tests verify Goals 3 and 8 counting, THE test suite SHALL include test cases for the prerequisite goal achieved without the additional goal, and both goals achieved.

5. WHEN all unit tests pass, THE AnalyticsEngine SHALL correctly count all 10 DCP goals according to official Toastmasters DCP requirements.

### Requirement 4: Validate Fix with Real Data

**User Story:** As a QA tester, I want to validate the fix using actual cached district data from the 2024-2025 program year, so that I can confirm the bug is resolved in production scenarios.

#### Acceptance Criteria

1. WHEN the fixed AnalyticsEngine processes cached data from November 2024, THE AnalyticsEngine SHALL return non-zero achievement counts for Goals 5 and 6 IF clubs have achieved these goals.

2. WHEN the analytics API endpoint returns DCP goal analysis, THE API response SHALL include accurate achievement counts and percentages for all 10 goals.

3. WHEN the frontend displays DCP goal analytics, THE UI SHALL show non-zero values for Goals 5 and 6 for the 2024-2025 program year.

4. WHEN comparing the fixed counts to the raw CSV data, THE achievement counts SHALL match manual verification of the data.
